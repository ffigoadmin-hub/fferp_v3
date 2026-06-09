import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderKanban, Plus, Search, Filter, Edit, Trash2, Eye, Loader2, AlertTriangle, Clock, CreditCard, FileText, ShoppingCart, LayoutGrid, List, ExternalLink, Layers, Flag, Target, TrendingUp, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { ProjectStatsRibbon } from '@/components/projects/ProjectStatsRibbon';
import { ProjectDetailsDialog } from '@/components/projects/ProjectDetailsDialog';
import { useProjectInsights } from '@/hooks/useProjectInsights';

interface Project {
  id: string;
  project_id: string;
  project_name: string;
  location_city: string;
  location_state: string;
  vertical: string; // Agri or Civil
  project_type?: string; // Polyhouse, New JV etc.
  current_spend: number;
  client_name: string;
  client_contact: string;
  assigned_manager_id: string | null;
  assigned_engineer_id: string | null;
  target_start_date: string;
  target_completion_date: string;
  status: string;
  remarks: string | null;
  created_at: string;
  manager?: { name: string };
  engineer?: { name: string };
  deal_file_url: string | null;
  jv_commitments: string | null;
  approved_budget: number;
  total_project_value?: number;
}

interface ProjectStats {
  project_id: string;
  total_escalations: number;
  critical_escalations: number;
}

const statusColors: Record<string, string> = {
  active: 'bg-status-live/20 text-status-live border-status-live',
  upcoming: 'bg-primary/20 text-primary border-primary',
  hold: 'bg-status-late/20 text-status-late border-status-late',
  closed: 'bg-muted text-muted-foreground border-border',
};

const verticals = ['Civil', 'Agri'];

export function ProjectsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Determine default vertical based on user role
  const getDefaultVertical = () => {
    return 'all';
  };

  const [verticalFilter, setVerticalFilter] = useState(getDefaultVertical());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [initialTab, setInitialTab] = useState('overview');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);

  const isCEO = user?.role?.toLowerCase() === 'ceo';
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const userRoleLower = user?.role?.toLowerCase() || '';
  const isBDData = userRoleLower === 'bd_data' || userRoleLower === 'business development' || userRoleLower.includes('bd') || user?.department?.toLowerCase()?.includes('business development');
  const canCreateProject = isAdmin || isCEO || isBDData;



  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          manager:profiles!projects_assigned_manager_id_fkey(name),
          engineer:profiles!projects_assigned_engineer_id_fkey(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as Project[];
    },
  });

  const { data: escalationStats } = useQuery({
    queryKey: ['project-escalation-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_escalation_stats' as any)
        .select('*');
      if (error) {
        console.error("Error fetching stats", error);
        return [];
      }
      return data as unknown as ProjectStats[];
    },
  });

  // Batch fetch phases, milestones, escalation insights for all projects
  const projectIds = useMemo(() => (projects || []).map(p => p.id), [projects]);
  const { getInsights, isLoading: insightsLoading } = useProjectInsights(projectIds);

  // Real-time Subscription for Projects & Stats
  useEffect(() => {
    const channel = supabase
      .channel('projects-realtime-dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['projects'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payment_requests' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['projects'] });
          queryClient.invalidateQueries({ queryKey: ['project-escalation-stats'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'work_orders' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['projects'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'escalations' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['projects'] });
          queryClient.invalidateQueries({ queryKey: ['project-escalation-stats'] });
          queryClient.invalidateQueries({ queryKey: ['bulk-project-escalations'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_phases' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['bulk-project-phases'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_milestones' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['bulk-project-milestones'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // ... (delete mutation kept same)
  const deleteMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const { data, error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .select();

      if (error) {
        console.error('Delete error:', error);
        throw new Error(error.message || 'Failed to delete project');
      }

      if (!data || data.length === 0) {
        throw new Error('Project not deleted. You may not have permission to delete this project.');
      }

      return data;
    },
    onSuccess: () => {
      toast.success('Project deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setDeletingProject(null);
      setDeleteConfirmText('');
      setDeleteStep(1);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete project');
    },
  });

  const filteredProjects = projects?.filter(project => {
    const matchesSearch = searchQuery === '' ||
      project.project_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.project_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.client_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    const matchesVertical = verticalFilter === 'all' || project.vertical === verticalFilter;

    return matchesSearch && matchesStatus && matchesVertical;
  }) || [];


  return (
    <div
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center">
            <FolderKanban className="w-7 h-7 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold">Projects</h1>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-status-live/10 border border-status-live/20">
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-status-live"></span>
                </span>
                <span className="text-[10px] font-bold text-status-live uppercase tracking-wider">Live</span>
              </div>
            </div>
            <p className="text-muted-foreground">Manage all company projects and budgets</p>
          </div>
        </div>
        {canCreateProject && (
          <Link to="/projects/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Create Project
            </Button>
          </Link>
        )}
      </div>

      {/* Summary Cards */}
      <ProjectStatsRibbon
        totalProjects={projects?.length || 0}
        activeProjects={projects?.filter(p => p.status === 'active').length || 0}
        // Calculate total criticals across all projects
        criticalEscalations={escalationStats?.reduce((acc, stat) => acc + stat.critical_escalations, 0) || 0}
        upcomingProjects={projects?.filter(p => p.status === 'upcoming').length || 0}
      />

      {/* Filters Overlay (Glassmorphic Sticky Header) */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-background/60 backdrop-blur-xl border-b mb-6 flex flex-wrap items-center gap-4 transition-all">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-background/50 border-muted-foreground/20 focus:bg-background transition-all"
          />
        </div>

        {/* Status Pills */}
        <div className="flex bg-muted/50 p-1 rounded-lg border border-border/50">
          {['all', 'active', 'upcoming', 'hold', 'closed'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize",
                statusFilter === status
                  ? "bg-background text-foreground shadow-sm scale-105"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              {status === 'all' ? 'All' : status}
            </button>
          ))}
        </div>

        <Select value={verticalFilter} onValueChange={setVerticalFilter}>
          <SelectTrigger className="w-[140px] h-9 bg-background/50 border-muted-foreground/20">
            <SelectValue placeholder="Vertical" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Verticals</SelectItem>
            {verticals.map(v => (
              <SelectItem key={v} value={v}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center bg-muted/50 rounded-lg p-1 ml-auto border border-border/50">
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className={cn("h-7 w-7 p-0 rounded-md", viewMode === 'list' && "bg-background shadow-sm")}
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className={cn("h-7 w-7 p-0 rounded-md", viewMode === 'grid' && "bg-background shadow-sm")}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Projects List/Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="authority-card text-center py-12">
          <FolderKanban className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-semibold">No Projects Found</p>
          <p className="text-muted-foreground">Try clearing applied filters</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(
            filteredProjects.reduce((acc, project) => {
              const category = project.project_type || 'General';
              if (!acc[category]) acc[category] = [];
              acc[category].push(project);
              return acc;
            }, {} as Record<string, typeof filteredProjects>)
          ).sort(([a], [b]) => a.localeCompare(b)).map(([category, categoryProjects], categoryIndex) => (
            <div key={category} className="space-y-4">
              <div className="flex items-center gap-3 mt-2 mb-4">
                <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                  {category}
                </h2>
                <Badge variant="secondary" className="bg-primary/10 text-primary rounded-full px-2.5">
                  {categoryProjects.length}
                </Badge>
                <div className="flex-1 h-px bg-border/50"></div>
            </div>
            <motion.div
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: categoryIndex * 0.1 }}
              className={cn(
                viewMode === 'grid'
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                  : "space-y-2"
              )}
            >
              <AnimatePresence mode="popLayout">
                {[...categoryProjects].sort((a, b) => {
                  const statsA = escalationStats?.find(s => s.project_id === a.id);
                  const statsB = escalationStats?.find(s => s.project_id === b.id);
                  const critA = statsA?.critical_escalations || 0;
                  const critB = statsB?.critical_escalations || 0;
                  const overA = differenceInDays(new Date(), new Date(a.target_completion_date)) > 0 && a.status === 'active';
                  const overB = differenceInDays(new Date(), new Date(b.target_completion_date)) > 0 && b.status === 'active';
                  
                  const scoreA = (critA * 100) + (overA ? 50 : 0);
                  const scoreB = (critB * 100) + (overB ? 50 : 0);
                  
                  if (scoreA !== scoreB) return scoreB - scoreA;
                  return new Date(b.target_start_date).getTime() - new Date(a.target_start_date).getTime();
                }).map((project, index) => {
                  // Calculate stats for List View & Grid View
                  const projectAge = differenceInDays(new Date(), new Date(project.target_start_date));
                  const stats = escalationStats?.find(s => s.project_id === project.id);
                  const totalEsc = stats?.total_escalations || 0;
                  const criticalEsc = stats?.critical_escalations || 0;
                  const insights = getInsights(project.id);

                  if (viewMode === 'grid') {
                    return (
                      <motion.div
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
                        key={project.id}
                      >
                        <ProjectCard
                          project={project}
                          stats={stats}
                          insights={insights}
                          canEdit={isAdmin || isBDData}
                          onClick={(p) => { setInitialTab('overview'); setViewingProject(p); }}
                          onEscalationClick={(p) => { setInitialTab('escalations'); setViewingProject(p); }}
                          index={index}
                        />
                      </motion.div>
                    );
                  }
                  // ═══════════════════════════════════════
                  // ENHANCED LIST VIEW
                  // ═══════════════════════════════════════
                  const today = new Date();
                  const startDate = new Date(project.target_start_date);
                  const endDate = new Date(project.target_completion_date);
                  const totalDuration = differenceInDays(endDate, startDate) + 1;
                  const elapsed = differenceInDays(today, startDate);
                  const progressPercent = Math.min(100, Math.max(0, (elapsed / (totalDuration || 1)) * 100));
                  const isOverdue = differenceInDays(today, endDate) > 0 && project.status === 'active';

                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                      key={project.id}
                      className={cn(
                        "group authority-card mb-1 p-4 cursor-pointer transition-all",
                        (criticalEsc > 0 || isOverdue) 
                          ? "border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.2)] bg-red-500/[0.02] hover:border-red-500/60" 
                          : "hover:border-primary/30"
                      )}
                      onClick={() => { setInitialTab('overview'); setViewingProject(project); }}
                    >
                      {/* Row 1: Main Info */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold truncate">{project.project_name}</p>
                              <Badge variant="outline" className="text-xs gap-1 bg-muted/50 shrink-0">
                                <Clock className="w-3 h-3" />
                                {projectAge} {projectAge === 1 ? 'day' : 'days'}
                              </Badge>
                              {isOverdue && (
                                <Badge variant="destructive" className="text-[9px] h-4 px-1.5 shrink-0">OVERDUE</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {project.project_id} • {project.vertical} • {project.project_type || 'General'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <Badge variant="outline" className={cn('text-xs', statusColors[project.status])}>
                            {project.status.toUpperCase()}
                          </Badge>
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setViewingProject(project)}
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {isAdmin && (
                              <Link to={`/projects/${project.id}/edit`}>
                                <Button variant="ghost" size="icon" title="Edit">
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </Link>
                            )}
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  setDeleteConfirmText('');
                                  setDeletingProject(project);
                                }}
                                title="Hard Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Row 2: Meta + Timeline bar */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                        <span>City: {project.location_city}</span>
                        <span>Client: {project.client_name}</span>
                        <span>Manager: {project.manager?.name || 'Unassigned'}</span>
                        <span>Timeline: {format(startDate, 'dd MMM')} - {format(endDate, 'dd MMM yyyy')}</span>
                      </div>

                      {/* Row 3: Progress bar */}
                      <div className="mb-3">
                        <div className="h-1.5 w-full bg-secondary/50 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full bg-gradient-to-r transition-all duration-700",
                              progressPercent > 90 ? "from-red-500 to-red-400"
                                : progressPercent > 75 ? "from-orange-500 to-orange-400"
                                : "from-emerald-500 to-emerald-400"
                            )}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Row 4: Unified Insights Strip */}
                      {(insights.totalPhases > 0 || insights.totalMilestones > 0 || insights.openEscalations > 0 || totalEsc > 0) && (
                        <div className="flex items-center gap-0 rounded-lg border border-border/40 bg-muted/20 overflow-hidden h-8">

                          {/* ─ Phases ─ */}
                          {insights.totalPhases > 0 && (
                            <div className="flex items-center gap-2 px-3 h-full border-r border-border/30">
                              <Layers className="w-3 h-3 text-primary/50 shrink-0" />
                              {/* phase segment bars */}
                              <div className="flex items-center gap-0.5">
                                {insights.phases.slice(0, 6).map((ph) => (
                                  <div
                                    key={ph.id}
                                    title={`${ph.phase_name}: ${ph.completion_percentage}%`}
                                    className={cn(
                                      'w-3.5 h-1.5 rounded-sm transition-all',
                                      ph.status === 'completed' ? 'bg-emerald-500'
                                        : ph.status === 'in_progress' ? 'bg-primary/80'
                                        : 'bg-muted-foreground/15'
                                    )}
                                  />
                                ))}
                                {insights.totalPhases > 6 && (
                                  <span className="text-[8px] text-muted-foreground/40 ml-0.5 font-bold">+{insights.totalPhases - 6}</span>
                                )}
                              </div>
                              <span className="text-[10px] font-bold text-foreground/50 tabular-nums">
                                {insights.completedPhases}<span className="text-muted-foreground/30">/{insights.totalPhases}</span>
                              </span>
                            </div>
                          )}

                          {/* ─ Milestones ─ */}
                          {insights.totalMilestones > 0 && (
                            <div className="flex items-center gap-2 px-3 h-full border-r border-border/30">
                              <Flag className="w-3 h-3 text-amber-500/60 shrink-0" />
                              {/* milestone dots */}
                              <div className="flex items-center gap-0.5">
                                {insights.milestones.slice(0, 7).map((m) => {
                                  const isDelayed = m.status !== 'completed' && new Date(m.planned_date) < today;
                                  return (
                                    <div
                                      key={m.id}
                                      title={`${m.milestone_name}${isDelayed ? ' — DELAYED' : ''}`}
                                      className={cn(
                                        'w-2 h-2 rounded-full',
                                        m.status === 'completed' ? 'bg-emerald-500'
                                          : isDelayed ? 'bg-red-500 animate-pulse'
                                          : m.status === 'in_progress' ? 'bg-amber-400'
                                          : 'bg-muted-foreground/20'
                                      )}
                                    />
                                  );
                                })}
                              </div>
                              <span className="text-[10px] font-bold text-foreground/50 tabular-nums">
                                {insights.completedMilestones}<span className="text-muted-foreground/30">/{insights.totalMilestones}</span>
                              </span>
                              {insights.delayedMilestones > 0 && (
                                <span className="text-[9px] font-black text-red-500 bg-red-500/10 px-1.5 rounded">
                                  {insights.delayedMilestones}↓
                                </span>
                              )}
                            </div>
                          )}

                          {/* ─ Next Milestone target ─ */}
                          {insights.nextMilestone && (
                            <div className="flex items-center gap-1.5 px-3 h-full border-r border-border/30 min-w-0">
                              <Target className="w-3 h-3 text-amber-400 shrink-0" />
                              <span className="text-[10px] text-foreground/50 truncate max-w-[100px]">
                                {insights.nextMilestone.milestone_name}
                              </span>
                              <span className="text-[9px] font-bold text-muted-foreground/40 shrink-0">
                                {format(new Date(insights.nextMilestone.planned_date), 'dd MMM')}
                              </span>
                            </div>
                          )}

                          {/* ─ Escalations chip (primary source) ─ */}
                          {insights.openEscalations > 0 && (
                            <button
                              className={cn(
                                'flex items-center gap-1.5 px-3 h-full transition-all outline-none',
                                insights.criticalEscalations > 0
                                  ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400'
                                  : 'bg-orange-500/[0.07] hover:bg-orange-500/[0.14] text-orange-400'
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                setInitialTab('escalations');
                                setViewingProject(project);
                              }}
                              title="Click to view escalation details"
                            >
                              <AlertTriangle className={cn(
                                'w-3 h-3 shrink-0',
                                insights.criticalEscalations > 0 && 'animate-pulse'
                              )} />
                              <span className="text-[10px] font-black">
                                {insights.openEscalations} Escalation{insights.openEscalations > 1 ? 's' : ''}
                              </span>
                              {insights.criticalEscalations > 0 && (
                                <span className="text-[8px] font-black uppercase bg-red-500 text-white px-1 py-px rounded animate-pulse">
                                  {insights.criticalEscalations}×CRIT
                                </span>
                              )}
                            </button>
                          )}

                          {/* ─ Escalations chip (fallback from stats) ─ */}
                          {insights.openEscalations === 0 && totalEsc > 0 && (
                            <button
                              className={cn(
                                'flex items-center gap-1.5 px-3 h-full transition-all outline-none',
                                criticalEsc > 0
                                  ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400'
                                  : 'bg-orange-500/[0.07] hover:bg-orange-500/[0.14] text-orange-400'
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                setInitialTab('escalations');
                                setViewingProject(project);
                              }}
                              title="Click to view escalation details"
                            >
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span className="text-[10px] font-black">
                                {totalEsc} Escalation{totalEsc > 1 ? 's' : ''}
                              </span>
                            </button>
                          )}

                          {/* trailing flex spacer */}
                          <div className="flex-1" />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          </div>
        ))}
        </div>
      )}

      {/* Delete Confirmation Dialog with Double Confirmation */}
      <Dialog open={!!deletingProject} onOpenChange={(open) => {
        if (!open) {
          setDeletingProject(null);
          setDeleteConfirmText('');
          setDeleteStep(1);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Hard Delete Project - Step {deleteStep} of 2
            </DialogTitle>
            <DialogDescription className="text-sm">
              This action is <strong>permanent and irreversible</strong>. All associated data including payments, work orders, and purchase orders linked to this project will be affected.
            </DialogDescription>
          </DialogHeader>
          {deletingProject && (
            <div className="space-y-4">
              <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                <p className="font-semibold text-destructive">{deletingProject.project_name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {deletingProject.project_id} • Status: {deletingProject.status}
                </p>
              </div>

              {deleteStep === 1 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Step 1: Type <span className="font-mono bg-muted px-1 py-0.5 rounded">DELETE</span> to proceed:
                  </p>
                  <Input
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                    placeholder="Type DELETE"
                    className="font-mono"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-destructive/20 border border-destructive rounded-lg">
                    <p className="text-sm font-bold text-destructive text-center">
                      ⚠️ FINAL WARNING ⚠️
                    </p>
                    <p className="text-xs text-center mt-1">
                      You are about to permanently delete "{deletingProject.project_name}". This cannot be undone.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                if (deleteStep === 2) {
                  setDeleteStep(1);
                } else {
                  setDeletingProject(null);
                  setDeleteConfirmText('');
                  setDeleteStep(1);
                }
              }}
            >
              {deleteStep === 2 ? 'Go Back' : 'Cancel'}
            </Button>
            {deleteStep === 1 ? (
              <Button
                variant="destructive"
                onClick={() => setDeleteStep(2)}
                disabled={deleteConfirmText !== 'DELETE'}
              >
                Proceed to Final Confirmation
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={() => deletingProject && deleteMutation.mutate(deletingProject.id)}
                disabled={deleteMutation.isPending}
                className="bg-destructive hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Permanently Delete Project
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Project Dialog with Payment Transactions */}
      <ProjectDetailsDialog
        project={(projects?.find(p => p.id === viewingProject?.id) || viewingProject) as any}
        stats={escalationStats?.find(s => s.project_id === viewingProject?.id)}
        onClose={() => { setViewingProject(null); setInitialTab('overview'); }}
        statusColors={statusColors}
        initialTab={initialTab}
      />
    </div >
  );
}
