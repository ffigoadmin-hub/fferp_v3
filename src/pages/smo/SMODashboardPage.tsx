import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, isPast } from 'date-fns';
import {
  AlertTriangle, RefreshCw, Users, FolderKanban, CheckSquare, Loader2, ArrowRight,
  Bell, Clock, Target, TrendingUp, Plus, Sparkles, Flag, Package, FileText
} from 'lucide-react';
import { useSMOEscalations, useSMOCriticals, useSMOProjects, useSMOTasks } from '@/hooks/useSMOData';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DeviationApprovalsWidget } from '@/components/engineering/DeviationApprovalsWidget';
import { BOQPipelineWidget } from '@/components/monitoring/BOQPipelineWidget';
import { DeliveryTrackingWidget } from '@/components/inventory/DeliveryTrackingWidget';
import { useMonitoringAlerts } from '@/hooks/useMonitoringAlerts';
import { useBOQPipeline } from '@/hooks/useBOQPipeline';
import { WorkOrderMonitoringWidget } from '@/components/WorkOrderMonitoringWidget';

export default function SMODashboardPage() {
  const { user } = useAuth();
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const { escalations, isLoading: escLoading, refetch: refetchEsc } = useSMOEscalations();
  const { criticals, isLoading: critLoading, refetch: refetchCrit } = useSMOCriticals();
  const { projects, refetch: refetchProj } = useSMOProjects();
  const { tasks, refetch: refetchTasks } = useSMOTasks();
  const { summary: boqSummary } = useBOQPipeline();
  const { unreadCount } = useNotifications();

  const isLoading = escLoading || critLoading;

  // Real-time notifications for new tickets
  useEffect(() => {
    const channel = supabase
      .channel('smo-dashboard-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'client_escalations' },
        (payload) => {
          const newEsc = payload.new as any;
          toast({
            title: "🚨 New Escalation!",
            description: `Ticket #${newEsc.ticket_number}: ${newEsc.issue_title} - Shared Queue`,
            variant: "destructive",
          });
          refetchEsc();
          setLastUpdated(new Date());
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'hourly_criticals' },
        (payload) => {
          const newCrit = payload.new as any;
          toast({
            title: "⚡ New Critical Ticket!",
            description: `Ticket #${newCrit.ticket_number}: ${newCrit.issue_title}`,
            variant: "destructive",
          });
          refetchCrit();
          setLastUpdated(new Date());
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'task_assignments', filter: `assigned_to=eq.${user?.id}` },
        (payload) => {
          const newTask = payload.new as any;
          toast({
            title: "📋 New Task Assigned!",
            description: `"${newTask.title}" has been assigned to you.`,
          });
          refetchTasks();
          setLastUpdated(new Date());
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'client_escalations' },
        () => { refetchEsc(); setLastUpdated(new Date()); }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'hourly_criticals' },
        () => { refetchCrit(); setLastUpdated(new Date()); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refetchEsc, refetchCrit, refetchTasks]);

  // Auto-refresh every 60 seconds as backup
  useEffect(() => {
    const interval = setInterval(() => {
      refetchEsc();
      refetchCrit();
      refetchProj();
      refetchTasks();
      setLastUpdated(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, [refetchEsc, refetchCrit, refetchProj, refetchTasks]);

  // Stats - SMO sees assigned tickets
  const activeEscalations = escalations.filter(e => e.status !== 'resolved' && e.status !== 'closed' && (e.assigned_role?.toLowerCase().includes('smo') || e.current_owner?.toLowerCase() === 'smo'));
  const activeCriticals = criticals.filter(c => c.status !== 'resolved' && c.status !== 'closed' && (c.assigned_role?.toLowerCase().includes('smo') || c.current_owner?.toLowerCase() === 'smo'));
  const breachedEscalations = activeEscalations.filter(e => e.ack_late || isPast(new Date(e.ack_deadline)));
  const breachedCriticals = activeCriticals.filter(c => c.blast_triggered_at);
  const myTasks = tasks.filter(t => t.assigned_to === user?.id);
  const pendingTasks = myTasks.filter(t => t.status !== 'completed').length;
  const overdueTasks = myTasks.filter(t => isPast(new Date(t.due_date)) && t.status !== 'completed').length;
  const totalActiveTickets = activeEscalations.length + activeCriticals.length;
  const totalBreached = breachedEscalations.length + breachedCriticals.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Premium Header */}
      <div className="dashboard-header">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/30 via-primary/20 to-transparent flex items-center justify-center shadow-lg border border-primary/20">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-background animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                  SMO Dashboard
                </h1>
                <Sparkles className="w-5 h-5 text-primary animate-pulse" />
              </div>
              <p className="text-muted-foreground">Senior Manager Operations • Real-time Assigned Tickets</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {unreadCount > 0 && (
              <Badge variant="destructive" className="animate-pulse py-1.5 px-3">
                <Bell className="w-3.5 h-3.5 mr-1.5" />
                {unreadCount} new
              </Badge>
            )}
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 py-1.5 px-3">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
              LIVE
            </Badge>
            <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 py-1.5 px-3 rounded-full">
              <RefreshCw className="w-3 h-3" />
              {format(lastUpdated, 'HH:mm:ss')}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {/* Quick Actions */}
        <div className="flex justify-end gap-3">
          <Button asChild variant="outline" size="lg" className="shadow-sm hover:shadow-md transition-all duration-300 gap-2">
            <Link to="/dashboard/smo/tickets">
              <Plus className="w-5 h-5" />
              All Tickets
            </Link>
          </Button>
          <Button asChild size="lg" className="shadow-lg hover:shadow-xl transition-all duration-300 gap-2">
            <Link to="/dashboard/my-escalations">
              <AlertTriangle className="w-5 h-5" />
              My Escalations
            </Link>
          </Button>
        </div>

        {/* Deviation Approvals */}

        <DeviationApprovalsWidget role="smo" />

        <WorkOrderMonitoringWidget role="smo" showApprovalActions={true} />

        {/* New Monitoring Widgets */}
        <div className="grid grid-cols-1 gap-6">
          <BOQPipelineWidget compact maxItems={5} />
        </div>

        <DeliveryTrackingWidget />

        {/* Real-time Status */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Real-time Workflow Status
            </h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 rounded-lg bg-green-500/10">
                <p className="text-xs text-muted-foreground mb-1">L1 (Operations)</p>
                <p className="text-3xl font-bold text-green-600">{totalActiveTickets}</p>
                <p className="text-xs text-muted-foreground">SMO, BOI, GMO</p>
              </div>
              <div className="p-4 rounded-lg bg-indigo-500/10 border border-indigo-500/20 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:opacity-20 transition-opacity">
                  <FileText className="w-8 h-8 text-indigo-500" />
                </div>
                <p className="text-xs text-muted-foreground mb-1 font-medium">BOQs Pending</p>
                <p className="text-3xl font-bold text-indigo-600">{boqSummary.pending_approval}</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  <p className="text-[10px] text-muted-foreground truncate font-mono">NEEDS REVIEW</p>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-orange-500/10">
                <p className="text-xs text-muted-foreground mb-1">L2 (GM Review)</p>
                <p className="text-3xl font-bold text-orange-500">
                  {escalations.filter(e => e.forwarded_to_gm_at && !e.pushed_to_ceo_at && e.status !== 'resolved').length}
                </p>
                <p className="text-xs text-muted-foreground">Auto-escalated</p>
              </div>
              <div className="p-4 rounded-lg bg-destructive/10">
                <p className="text-xs text-muted-foreground mb-1">L3 (CEO)</p>
                <p className="text-3xl font-bold text-destructive">
                  {escalations.filter(e => e.pushed_to_ceo_at && e.status !== 'resolved').length}
                </p>
                <p className="text-xs text-muted-foreground">Critical</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
