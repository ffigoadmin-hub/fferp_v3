import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  LayoutDashboard, Package, Hammer,
  Loader2, FolderKanban, RefreshCw,
  TrendingUp, Clock, AlertCircle, Activity,
  CheckCircle, ArrowRight, AlertTriangle,
  Calendar, Target, Zap, Bell,
  FileText, ShoppingCart, Wrench, Eye,
  ChevronRight, Sparkles, CircleDot
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects } from '@/hooks/useProjects';
import { useMaterialRequests } from '@/hooks/useMaterialRequests';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format, differenceInDays, isToday, isYesterday, subDays } from 'date-fns';
import { LIFECYCLE_STAGES } from '@/constants/projectCategories';

export default function EngineerDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { projects, isLoading: projectsLoading, refetch: refetchProjects } = useProjects();
  const { requests: materialRequests, isLoading: materialsLoading, refetch: refetchMaterials } = useMaterialRequests();
  const { workOrders, isLoading: workOrdersLoading, refetch: refetchWorkOrders } = useWorkOrders();
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  const isLoading = projectsLoading || materialsLoading || workOrdersLoading;

  const handleRefetchAll = useCallback(() => {
    refetchProjects();
    refetchMaterials();
    refetchWorkOrders();
  }, [refetchProjects, refetchMaterials, refetchWorkOrders]);

  useEffect(() => {
    handleRefetchAll();
  }, []);

  // Set up real-time subscriptions
  useEffect(() => {
    const timestamp = Date.now();
    const channels = [
      supabase.channel(`eng-dash-projects-${timestamp}`).on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => refetchProjects()),
      supabase.channel(`eng-dash-boq-${timestamp}`).on('postgres_changes', { event: '*', schema: 'public', table: 'project_boq' }, () => refetchProjects()),
      supabase.channel(`eng-dash-materials-${timestamp}`).on('postgres_changes', { event: '*', schema: 'public', table: 'material_requests' }, () => refetchMaterials()),
      supabase.channel(`eng-dash-work-orders-${timestamp}`).on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders' }, () => refetchWorkOrders())
    ];
    channels.forEach(c => c.subscribe());
    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, [refetchProjects, refetchMaterials, refetchWorkOrders]);

  // Fetch recent activity timeline
  useEffect(() => {
    if (!user?.id) return;
    const fetchActivity = async () => {
      const since = subDays(new Date(), 3).toISOString();
      const { data } = await supabase
        .from('project_timeline')
        .select('*, projects!inner(project_name, assigned_engineer_id, assigned_project_engineer_id)')
        .or(`projects.assigned_engineer_id.eq.${user.id},projects.assigned_project_engineer_id.eq.${user.id}`)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(15);
      setRecentActivity(data || []);
    };
    fetchActivity();
  }, [user?.id, projects]);

  // Derived data
  const myProjects = useMemo(() => (projects || []).filter(p =>
    p.assigned_project_engineer_id === user?.id || p.assigned_engineer_id === user?.id
  ), [projects, user?.id]);

  const pendingMaterials = useMemo(() => (materialRequests || []).filter(r => !['delivered', 'cancelled'].includes(r.status)), [materialRequests]);
  const pendingWorkOrders = useMemo(() => (workOrders || []).filter(w => !['completed', 'rejected'].includes(w.status)), [workOrders]);

  // Urgent items: projects stuck in the same stage for too long, or BOQ rejected
  const urgentItems = useMemo(() => {
    const items: { type: string; title: string; subtitle: string; icon: React.ElementType; color: string; path: string }[] = [];

    myProjects.forEach(p => {
      if (p.boq_rejection_reason) {
        items.push({
          type: 'boq_rejected', title: `BOQ Rejected — ${p.project_name}`,
          subtitle: `Feedback: ${p.boq_rejection_reason?.slice(0, 60)}...`,
          icon: AlertTriangle, color: 'text-rose-500 bg-rose-500/10', path: '/employee-projects'
        });
      }

      const daysSinceUpdate = differenceInDays(new Date(), new Date(p.updated_at || p.created_at));

      if (p.lifecycle_stage === 'engineering_assigned' && daysSinceUpdate > 3) {
        items.push({
          type: 'stale', title: `BOQ Action Required — ${p.project_name}`,
          subtitle: `Project assigned ${daysSinceUpdate} days ago. Please submit BOQ.`,
          icon: Clock, color: 'text-amber-500 bg-amber-500/10', path: '/employee-projects'
        });
      }

      if (['boq_submitted_smo', 'boq_submitted_gmo'].includes(p.lifecycle_stage)) {
        items.push({
          type: 'in_review', title: `BOQ In Review — ${p.project_name}`,
          subtitle: `Waiting for ${p.lifecycle_stage === 'boq_submitted_smo' ? 'SMO (L1)' : 'GMO (L2)'} approval.`,
          icon: Loader2, color: 'text-sky-500 bg-sky-500/10', path: '/employee-projects'
        });
      }
    });

    pendingMaterials.filter(r => r.status === 'pending' && differenceInDays(new Date(), new Date(r.created_at)) > 2).forEach(r => {
      items.push({
        type: 'material_delay', title: `Material Request Pending`,
        subtitle: `Waiting ${differenceInDays(new Date(), new Date(r.created_at))} days for approval`,
        icon: Package, color: 'text-amber-500 bg-amber-500/10', path: '/my-requests'
      });
    });

    return items.slice(0, 5);
  }, [myProjects, pendingMaterials]);

  // Project stage distribution
  const stageDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    myProjects.forEach(p => {
      const stage = LIFECYCLE_STAGES.find(s => s.value === p.lifecycle_stage);
      const label = stage?.label || p.lifecycle_stage;
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([label, count]) => ({ label, count }));
  }, [myProjects]);

  const stats = {
    activeProjects: myProjects.length,
    pendingMaterials: pendingMaterials.length,
    pendingWorkOrders: pendingWorkOrders.length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-100px)]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-primary/20 animate-pulse" />
            <div className="absolute inset-0 w-12 h-12 rounded-full border-4 border-t-primary animate-spin" />
          </div>
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative group">
            <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500" />
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-xl shadow-primary/20 ring-1 ring-white/10">
              <LayoutDashboard className="w-7 h-7 text-primary-foreground" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Engineering Command Center</h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-sm font-medium">Welcome back, {user?.name}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefetchAll} className="h-9 gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
          <Button size="sm" onClick={() => navigate('/employee-projects')} className="h-9 gap-2 shadow-lg shadow-primary/20">
            <FolderKanban className="w-4 h-4" /> My Projects
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard icon={FolderKanban} label="Active Projects" value={stats.activeProjects} subValue="Currently Managing" color="blue" link="/employee-projects" />
        <StatsCard icon={Package} label="Material Requests" value={stats.pendingMaterials} subValue="Pending Delivery" color="amber" link="/my-requests" urgent={stats.pendingMaterials > 5} />
        <StatsCard icon={Hammer} label="Work Orders" value={stats.pendingWorkOrders} subValue="Active Sites" color="emerald" link="/my-requests" />
      </div>

      {/* Main Content: 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-6">


          {/* Project Health Overview */}
          <Card className="border-border/50 overflow-hidden">
            <CardHeader className="py-3.5 px-5 border-b border-border/30 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Target className="h-4 w-4 text-primary" />
                </div>
                Project Health
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground" onClick={() => navigate('/employee-projects')}>
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4">
              {myProjects.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                    <FolderKanban className="w-6 h-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">No projects assigned yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myProjects.slice(0, 5).map((project, i) => {
                    const stage = LIFECYCLE_STAGES.find(s => s.value === project.lifecycle_stage);
                    const age = differenceInDays(new Date(), new Date(project.created_at));
                    const stageProgress = ((stage?.order || 1) / LIFECYCLE_STAGES.length) * 100;
                    const isAtRisk = project.boq_rejection_reason || (project.lifecycle_stage === 'engineering_assigned' && age > 5);

                    return (
                      <motion.div
                        key={project.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <Link to="/employee-projects">
                          <div className="group flex items-center gap-4 p-3.5 rounded-xl hover:bg-muted/30 transition-all border border-transparent hover:border-border/40">
                            {/* Health indicator */}
                            <div className={cn(
                              "w-2 h-10 rounded-full shrink-0",
                              isAtRisk ? "bg-rose-500" : stageProgress > 60 ? "bg-emerald-500" : "bg-blue-500"
                            )} />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="font-mono text-[10px] shrink-0">{project.project_id}</Badge>
                                <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{project.project_name}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <Progress value={stageProgress} className="h-1.5 flex-1" />
                                <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">{Math.round(stageProgress)}%</span>
                              </div>
                            </div>

                            <Badge variant="outline" className={cn(
                              "text-[10px] shrink-0 whitespace-nowrap font-bold",
                              isAtRisk ? "text-rose-500 border-rose-500/30 bg-rose-500/5 shadow-sm shadow-rose-500/5"
                                : ['boq_submitted_smo', 'boq_submitted_gmo'].includes(project.lifecycle_stage)
                                  ? "text-amber-500 border-amber-500/30 bg-amber-500/5 shadow-sm shadow-amber-500/5 animate-pulse"
                                  : project.lifecycle_stage === 'boq_approved'
                                    ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/5 shadow-sm shadow-emerald-500/5"
                                    : "text-muted-foreground bg-muted/5 shadow-sm"
                            )}>
                              {project.lifecycle_stage === 'boq_submitted_smo' ? 'L1 REVIEW'
                                : project.lifecycle_stage === 'boq_submitted_gmo' ? 'L2 REVIEW'
                                  : stage?.label || project.lifecycle_stage}
                            </Badge>
                          </div>
                        </Link>
                      </motion.div>
                    );
                  })}
                  {myProjects.length > 5 && (
                    <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground gap-1.5" onClick={() => navigate('/employee-projects')}>
                      View {myProjects.length - 5} more projects <ArrowRight className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stage Distribution */}
          {stageDistribution.length > 0 && (
            <Card className="border-border/50 overflow-hidden">
              <CardHeader className="py-3.5 px-5 border-b border-border/30">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-indigo-400" />
                  </div>
                  Pipeline Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 flex-wrap">
                  {stageDistribution.map((stage, i) => (
                    <div key={stage.label} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/30 border border-border/40">
                      <span className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-xs font-medium">{stage.label}</span>
                      <Badge variant="secondary" className="text-[10px] h-5 min-w-[20px] justify-center">{stage.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column (1/3) */}
        <div className="space-y-6">

          {/* Quick Actions */}
          <Card className="border-border/50 overflow-hidden">
            <CardHeader className="py-3.5 px-5 border-b border-border/30">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                </div>
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <div className="space-y-1.5">
                {[
                  { icon: FolderKanban, label: 'Open My Projects', path: '/employee-projects', color: 'text-blue-400 bg-blue-500/10' },
                  { icon: Eye, label: 'BOQ Builder', path: '/boq-builder', color: 'text-indigo-400 bg-indigo-500/10' },
                  { icon: FileText, label: 'View My Requests', path: '/my-requests', color: 'text-violet-400 bg-violet-500/10' },
                  { icon: CheckCircle, label: 'My Tasks', path: '/my-tasks', color: 'text-emerald-400 bg-emerald-500/10' },
                ].map((action) => (
                  <Link key={action.path} to={action.path}>
                    <div className="group flex items-center gap-3 p-3 rounded-xl hover:bg-muted/40 transition-all">
                      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", action.color)}>
                        <action.icon className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium group-hover:text-primary transition-colors">{action.label}</span>
                      <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground/30 group-hover:text-primary transition-all" />
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity Feed */}
          <Card className="border-border/50 overflow-hidden">
            <CardHeader className="py-3.5 px-5 border-b border-border/30">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-sky-400" />
                </div>
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[420px]">
                {recentActivity.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                      <Bell className="w-5 h-5 text-muted-foreground/40" />
                    </div>
                    <p className="text-xs text-muted-foreground">No recent activity</p>
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="relative">
                      <div className="absolute left-[13px] top-2 bottom-2 w-px bg-border/50" />
                      <div className="space-y-4">
                        {recentActivity.map((event, i) => {
                          const eventDate = new Date(event.created_at);
                          const timeLabel = isToday(eventDate) ? format(eventDate, 'h:mm a')
                            : isYesterday(eventDate) ? `Yesterday ${format(eventDate, 'h:mm a')}`
                              : format(eventDate, 'dd MMM, h:mm a');

                          return (
                            <motion.div
                              key={event.id}
                              initial={{ opacity: 0, x: -5 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.03 }}
                              className="flex gap-3 items-start"
                            >
                              <div className="w-[27px] h-[27px] rounded-full bg-primary/10 flex items-center justify-center z-10 shrink-0 mt-0.5 ring-2 ring-background">
                                <CircleDot className="w-3 h-3 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0 pb-1">
                                <p className="text-xs font-medium leading-snug">{event.action?.replace(/_/g, ' ')}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">{event.projects?.project_name}</p>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <Clock className="w-2.5 h-2.5 text-muted-foreground/50" />
                                  <span className="text-[10px] text-muted-foreground/60">{timeLabel}</span>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// --- Stats Card Component ---
function StatsCard({ icon: Icon, label, value, subValue, color, link, urgent }: any) {
  const gradients = {
    blue: 'from-blue-500/10 to-blue-600/5 hover:from-blue-500/20 hover:to-blue-600/10 border-blue-200/20',
    amber: 'from-amber-500/10 to-amber-600/5 hover:from-amber-500/20 hover:to-amber-600/10 border-amber-200/20',
    emerald: 'from-emerald-500/10 to-emerald-600/5 hover:from-emerald-500/20 hover:to-emerald-600/10 border-emerald-200/20',
  };
  const textColors = { blue: 'text-blue-500', amber: 'text-amber-500', emerald: 'text-emerald-500' };
  const bgColors = { blue: 'bg-blue-500', amber: 'bg-amber-500', emerald: 'bg-emerald-500' };

  const CardBody = (
    <motion.div whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
      <Card className={cn("relative overflow-hidden border transition-all duration-300", gradients[color as keyof typeof gradients])}>
        <CardContent className="p-5">
          <div className="flex justify-between items-start">
            <div className="space-y-3 relative z-10">
              <div className={cn("p-2 w-fit rounded-xl bg-background/60 backdrop-blur-md shadow-sm border border-black/5 dark:border-white/10", textColors[color as keyof typeof textColors])}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-bold tracking-tight">{value}</h3>
                  {urgent && <AlertCircle className="w-4 h-4 text-rose-500 animate-pulse" />}
                </div>
                <p className="font-medium text-muted-foreground text-sm mt-0.5">{label}</p>
                <p className="text-xs text-muted-foreground/60">{subValue}</p>
              </div>
            </div>
            <div className={cn("absolute -right-6 -top-6 w-28 h-28 rounded-full opacity-10 blur-3xl", bgColors[color as keyof typeof bgColors])} />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  return link ? <Link to={link}>{CardBody}</Link> : CardBody;
}
