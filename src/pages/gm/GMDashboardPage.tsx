import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClientEscalations } from '@/hooks/useClientEscalations';
import { useHourlyCriticals } from '@/hooks/useHourlyCriticals';
import { useProjects } from '@/hooks/useProjects';
import { useBrowserNotifications, triggerTicketNotification } from '@/hooks/useBrowserNotifications';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ExecutiveTicketTable } from '@/components/ExecutiveTicketTable';
import { EmployeeActivityWidget } from '@/components/EmployeeActivityWidget';
import { TaskAssignmentWidget } from '@/components/TaskAssignmentWidget';
import { PaymentSearchWidget } from '@/components/PaymentSearchWidget';
import { PurchaseUpdatesWidget } from '@/components/purchase/PurchaseUpdatesWidget';
import { RecentSalesOrdersWidget } from '@/components/RecentSalesOrdersWidget';
import { MaterialRequestAuditWidget } from '@/components/purchase/MaterialRequestAuditWidget';
import { WorkOrderMonitoringWidget } from '@/components/WorkOrderMonitoringWidget';
import { WorkRequestApprovalWidget } from '@/components/WorkRequestApprovalWidget';
import { useVendorWorkRequests } from '@/hooks/useVendorWorkRequests';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Clock, AlertTriangle, Loader2, Building2, Leaf, RefreshCw,
  ClipboardList, Users, TrendingUp, Shield, IndianRupee, Calendar, Package, FileText, Hammer
} from 'lucide-react';

type DashboardTab = 'overview' | 'activity' | 'tasks' | 'payments' | 'purchase-updates' | 'work-orders';

export default function GMDashboardPage() {
  const { user } = useAuth();
  const { escalations, gmAcknowledge, gmResolve, isLoading: escLoading, isSaving: escSaving, refetch: refetchEscalations } = useClientEscalations();
  const { criticals, openCriticals, acknowledgedCriticals, acknowledgeCritical, resolveCritical, isLoading: critLoading, isSaving: critSaving, refetch: refetchCriticals } = useHourlyCriticals();
  const { projects } = useProjects();
  const { showNotification, playBreachAlert } = useBrowserNotifications();
  const { requests: workRequests } = useVendorWorkRequests();
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const pendingWorkApprovalsCount = workRequests.filter(r => r.approval_status === 'pending_gm').length;

  // Comment dialog state
  const [commentDialog, setCommentDialog] = useState<{ type: 'escalation' | 'critical'; item: any } | null>(null);
  const [comment, setComment] = useState('');

  // Resolution dialog state
  const [resolveDialog, setResolveDialog] = useState<{ type: 'escalation' | 'critical'; item: any } | null>(null);
  const [resolution, setResolution] = useState('');

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('gm-realtime-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'client_escalations' }, (payload) => {
        const newEsc = payload.new as any;
        triggerTicketNotification(
          showNotification,
          'assigned',
          `ESC-${String(newEsc.ticket_number || '').padStart(3, '0')}`,
          `New escalation: ${newEsc.issue_title}`
        );
        refetchEscalations();
        setLastUpdated(new Date());
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'client_escalations' }, (payload) => {
        const updatedEsc = payload.new as any;
        if (updatedEsc.status === 'breached' || (updatedEsc.ack_late && !payload.old?.ack_late)) {
          triggerTicketNotification(
            showNotification,
            'breached',
            `ESC-${String(updatedEsc.ticket_number || '').padStart(3, '0')}`,
            `SLA breached!`,
            playBreachAlert
          );
        }
        refetchEscalations();
        setLastUpdated(new Date());
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hourly_criticals' }, (payload) => {
        const newCrit = payload.new as any;
        triggerTicketNotification(
          showNotification,
          'assigned',
          `CRT-${String(newCrit.ticket_number || '').padStart(3, '0')}`,
          `New critical: ${newCrit.issue_title}`
        );
        refetchCriticals();
        setLastUpdated(new Date());
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hourly_criticals' }, (payload) => {
        const updatedCrit = payload.new as any;
        if (updatedCrit.blast_triggered_at && !payload.old?.blast_triggered_at) {
          triggerTicketNotification(
            showNotification,
            'breached',
            `CRT-${String(updatedCrit.ticket_number || '').padStart(3, '0')}`,
            `Critical SLA breached!`,
            playBreachAlert
          );
        }
        refetchCriticals();
        setLastUpdated(new Date());
      })
      .subscribe();

    const interval = setInterval(() => {
      refetchEscalations();
      refetchCriticals();
      setLastUpdated(new Date());
    }, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [refetchEscalations, refetchCriticals, showNotification, playBreachAlert]);

  // Computed data
  const allPendingEscalations = escalations.filter(e => e.status !== 'resolved');
  const allPendingCriticals = criticals.filter(c => c.status !== 'resolved');

  // Project stats by vertical
  const filteredProjects = projects;

  const handleAcknowledge = async (type: 'escalation' | 'critical', id: string) => {
    if (type === 'escalation') {
      await gmAcknowledge(id);
    } else {
      await acknowledgeCritical(id);
    }
  };

  const handleResolve = async () => {
    if (!resolveDialog || !resolution) return;

    if (resolveDialog.type === 'escalation') {
      await gmResolve(resolveDialog.item.id, resolution);
    } else {
      await resolveCritical(resolveDialog.item.id, resolution);
    }

    setResolveDialog(null);
    setResolution('');
  };

  const handleAddComment = async () => {
    if (!commentDialog || !comment || !user) return;

    try {
      if (commentDialog.type === 'escalation') {
        await supabase.from('client_escalation_timeline').insert({
          escalation_id: commentDialog.item.id,
          action: 'gm_comment',
          performed_by: user.id,
          performed_by_name: user.name,
          performed_by_role: user.role,
          details: { comment },
        });
      } else {
        await supabase.from('hourly_critical_timeline').insert({
          critical_id: commentDialog.item.id,
          action: 'gm_comment',
          performed_by: user.id,
          performed_by_name: user.name,
          performed_by_role: user.role,
          details: { comment },
        });
      }

      toast.success('Comment added');
      setCommentDialog(null);
      setComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    }
  };

  const isLoading = escLoading || critLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Premium Header */}
      <div className="dashboard-header">
        <div className="relative z-10 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center shadow-lg">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                GM Command Center
              </h1>
              <p className="text-muted-foreground mt-1">Real-time escalation & team management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-status-live/10 text-status-live border-status-live/30 px-3 py-1">
              <span className="w-2 h-2 rounded-full bg-status-live mr-2 animate-pulse" />
              LIVE
            </Badge>
            <div className="text-right">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <RefreshCw className="w-3 h-3" />
                Last updated
              </span>
              <span className="text-sm font-mono">{format(lastUpdated, 'HH:mm:ss')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DashboardTab)} className="w-full">
        <div className="premium-tabs inline-block">
          <TabsList className="bg-transparent gap-1 p-0">
            <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:shadow-lg rounded-lg px-4">
              <Shield className="w-4 h-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:shadow-lg rounded-lg px-4">
              <Users className="w-4 h-4" /> Activity
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:shadow-lg rounded-lg px-4">
              <ClipboardList className="w-4 h-4" /> Tasks
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:shadow-lg rounded-lg px-4">
              <IndianRupee className="w-4 h-4" /> Payments
            </TabsTrigger>
            <TabsTrigger value="work-orders" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:shadow-lg rounded-lg px-4">
              <FileText className="w-4 h-4" /> Work Orders
            </TabsTrigger>
            <TabsTrigger value="purchase-updates" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:shadow-lg rounded-lg px-4">
              <Package className="w-4 h-4" /> Purchase
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="h-4" />

          {/* Summary Stats - Premium Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="stat-card-danger"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-status-missed/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-status-missed" />
                </div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Escalations</span>
              </div>
              <p className="text-4xl font-bold text-status-missed">{allPendingEscalations.length}</p>
              <p className="text-sm text-muted-foreground mt-1">{escalations.length} total</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="stat-card-warning"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-status-late/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-status-late" />
                </div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Criticals</span>
              </div>
              <p className="text-4xl font-bold text-status-late">{allPendingCriticals.length}</p>
              <p className="text-sm text-muted-foreground mt-1">{criticals.length} total</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="stat-card-primary"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Projects</span>
              </div>
              <p className="text-4xl font-bold">{filteredProjects.length}</p>
              <p className="text-sm text-muted-foreground mt-1 underline decoration-primary/30">Total active projects</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="stat-card-success cursor-pointer"
              onClick={() => setActiveTab('work-orders')}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Hammer className="w-5 h-5 text-emerald-500" />
                </div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Work Approvals</span>
              </div>
              <p className="text-4xl font-bold text-emerald-500">{pendingWorkApprovalsCount}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Awaiting your pre-approval
              </p>
            </motion.div>
          </div>

          {/* Executive Ticket Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <ExecutiveTicketTable role="gm" />
          </motion.div>

          {/* Sales Orders Feed */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <RecentSalesOrdersWidget title="Sales Orders — Live Feed" limit={10} />
          </motion.div>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <EmployeeActivityWidget title="All Employee Activity" />
        </TabsContent>

        <TabsContent value="tasks" className="mt-6">
          <TaskAssignmentWidget title="Task Assignment" />
        </TabsContent>

        <TabsContent value="payments" className="mt-6">
          <PaymentSearchWidget title="Payment Search" />
        </TabsContent>

        <TabsContent value="purchase-updates" className="mt-6 space-y-6">
          <MaterialRequestAuditWidget
            role="gm"
            targetStatus="pending_gm"
            title="GM Procurement Audit"
            subtitle="Verify vendor quotes and sourcing details before Admin compliance"
          />
          <PurchaseUpdatesWidget />
        </TabsContent>

        <TabsContent value="work-orders" className="mt-6 space-y-6">
          <WorkRequestApprovalWidget
            role="gm"
            targetStatus="pending_gm"
            title="Work Request Pre-Approvals"
            subtitle="Approve work requests before they move to sourcing department"
          />
          <WorkOrderMonitoringWidget role="gm" showApprovalActions={true} />
        </TabsContent>
      </Tabs>

      {/* Comment Dialog */}
      <Dialog open={!!commentDialog} onOpenChange={() => setCommentDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Comment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="comment">Comment</Label>
              <Textarea
                id="comment"
                placeholder="Enter your comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentDialog(null)}>Cancel</Button>
            <Button onClick={handleAddComment} disabled={!comment}>Add Comment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolution Dialog */}
      <Dialog open={!!resolveDialog} onOpenChange={() => setResolveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve {resolveDialog?.type === 'escalation' ? 'Escalation' : 'Critical'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="resolution">Resolution Details</Label>
              <Textarea
                id="resolution"
                placeholder="Describe how the issue was resolved..."
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialog(null)}>Cancel</Button>
            <Button onClick={handleResolve} disabled={!resolution || escSaving || critSaving}>
              {escSaving || critSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Mark as Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
