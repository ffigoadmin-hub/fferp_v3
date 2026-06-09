import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, Clock, AlertTriangle, CheckCircle2, XCircle,
  ArrowRight, Zap, Building2, Tractor, Briefcase, IndianRupee,
  Users, Timer, Pause
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PaymentRequestData } from '@/hooks/usePaymentRequests';
import { differenceInHours } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { normalizeDepartment } from '@/lib/paymentWorkflow';

interface PaymentFlowAnalyticsProps {
  requests: PaymentRequestData[];
}

interface FlowStage {
  id: string;
  label: string;
  shortLabel: string;
  count: number;
  amount: number;
  color: string;
}

// Department workflow definitions
const ENGINEERING_FLOW = ['smo_audit', 'gmo_audit', 'boi_audit', 'gm_audit', 'admin_audit', 'ceo_audit', 'ceo_approved', 'paid'];
const RND_FLOW = ['gm_audit', 'admin_audit', 'ceo_audit', 'ceo_approved', 'paid'];
const PURCHASE_FLOW = ['gm_audit', 'admin_audit', 'ceo_audit', 'ceo_approved', 'paid'];
const AGRI_FLOW = ['smo_audit', 'boi_audit', 'director_audit', 'admin_audit', 'ceo_audit', 'ceo_approved', 'paid'];
const OTHERS_FLOW = ['admin_audit', 'ceo_audit', 'ceo_approved', 'paid'];

const statusLabels: Record<string, { label: string; shortLabel: string; color: string }> = {
  smo_audit: { label: 'SMO Audit', shortLabel: 'SMO', color: 'bg-blue-500' },
  gmo_audit: { label: 'GMO Audit', shortLabel: 'GMO', color: 'bg-indigo-500' },
  boi_audit: { label: 'BOI Audit', shortLabel: 'BOI', color: 'bg-purple-500' },
  gm_audit: { label: 'GM Audit', shortLabel: 'GM', color: 'bg-violet-500' },
  director_audit: { label: 'Director Audit', shortLabel: 'Director', color: 'bg-pink-500' },
  admin_audit: { label: 'Admin Audit', shortLabel: 'Admin', color: 'bg-orange-500' },
  ceo_audit: { label: 'CEO Audit', shortLabel: 'CEO', color: 'bg-amber-500' },
  ceo_approved: { label: 'Ready to Pay', shortLabel: 'Ready', color: 'bg-emerald-500' },
  paid: { label: 'Paid', shortLabel: 'Paid', color: 'bg-green-600' },
  rejected: { label: 'Rejected', shortLabel: 'Rejected', color: 'bg-red-500' },
  ceo_hold: { label: 'On Hold', shortLabel: 'Hold', color: 'bg-yellow-500' },
};

export function PaymentFlowAnalytics({ requests }: PaymentFlowAnalyticsProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'engineering' | 'agri' | 'rnd_purchase' | 'others'>('all');

  const analytics = useMemo(() => {
    const now = new Date();

    // Categorize requests by department
    const engineeringRequests = requests.filter(r => normalizeDepartment(r.department) === 'engineering');
    const agriRequests = requests.filter(r => normalizeDepartment(r.department) === 'agri');
    const agriMartRequests = requests.filter(r => normalizeDepartment(r.department) === 'agri_mart');
    const rndPurchaseRequests = requests.filter(r => {
      const d = normalizeDepartment(r.department);
      return d === 'r_and_d' || d === 'purchase';
    });
    const othersRequests = requests.filter(r => {
      const d = normalizeDepartment(r.department);
      return d !== 'engineering' && d !== 'agri' && d !== 'r_and_d' && d !== 'purchase' && d !== 'agri_mart';
    });

    // Count by status for each department
    const countByStatus = (reqs: PaymentRequestData[]) => {
      return reqs.reduce((acc, r) => {
        acc[r.status] = acc[r.status] || { count: 0, amount: 0 };
        acc[r.status].count++;
        acc[r.status].amount += Number(r.amount);
        return acc;
      }, {} as Record<string, { count: number; amount: number }>);
    };

    const engineeringCounts = countByStatus(engineeringRequests);
    const agriCounts = countByStatus(agriRequests);
    const rndPurchaseCounts = countByStatus(rndPurchaseRequests);
    const othersCounts = countByStatus(othersRequests);
    const allCounts = countByStatus(requests);

    // Build flow stages for each department
    const buildFlowStages = (flow: string[], counts: Record<string, { count: number; amount: number }>): FlowStage[] => {
      return flow.map(status => {
        const info = statusLabels[status] || { label: status, shortLabel: status, color: 'bg-muted' };
        const data = counts[status] || { count: 0, amount: 0 };
        return {
          id: status,
          label: info.label,
          shortLabel: info.shortLabel,
          count: data.count,
          amount: data.amount,
          color: info.color,
        };
      });
    };

    // Critical items (emergency + important approaching cutoff)
    const getCriticalItems = (reqs: PaymentRequestData[]) => {
      return reqs.filter(r => {
        if (r.status === 'paid' || r.status === 'rejected') return false;
        const cutoff = new Date(`${r.cutoff_date}T${r.cutoff_time}`);
        const hoursUntil = differenceInHours(cutoff, now);
        return r.urgency === 'emergency' || hoursUntil <= 12;
      }).length;
    };

    // Bottlenecks (items stuck too long)
    const getBottlenecks = (reqs: PaymentRequestData[]) => {
      return reqs.filter(r => {
        if (r.status === 'paid' || r.status === 'rejected') return false;
        return differenceInHours(now, new Date(r.created_at)) > 24;
      }).length;
    };

    // Calculate average processing time for paid requests
    const getAvgTime = (reqs: PaymentRequestData[]) => {
      const paidReqs = reqs.filter(r => r.status === 'paid' && r.paid_at);
      if (paidReqs.length === 0) return 0;
      return paidReqs.reduce((sum, r) => {
        return sum + differenceInHours(new Date(r.paid_at!), new Date(r.created_at));
      }, 0) / paidReqs.length;
    };

    return {
      engineering: {
        requests: engineeringRequests,
        flow: buildFlowStages(ENGINEERING_FLOW, engineeringCounts),
        total: engineeringRequests.length,
        totalAmount: engineeringRequests.reduce((s, r) => s + Number(r.amount), 0),
        critical: getCriticalItems(engineeringRequests),
        bottlenecks: getBottlenecks(engineeringRequests),
        avgTime: getAvgTime(engineeringRequests),
        rejected: engineeringCounts.rejected?.count || 0,
        onHold: engineeringCounts.ceo_hold?.count || 0,
      },
      agri: {
        requests: agriRequests,
        flow: buildFlowStages(AGRI_FLOW, agriCounts),
        total: agriRequests.length,
        totalAmount: agriRequests.reduce((s, r) => s + Number(r.amount), 0),
        critical: getCriticalItems(agriRequests),
        bottlenecks: getBottlenecks(agriRequests),
        avgTime: getAvgTime(agriRequests),
        rejected: agriCounts.rejected?.count || 0,
        onHold: agriCounts.ceo_hold?.count || 0,
      },
      rnd_purchase: {
        requests: rndPurchaseRequests,
        flow: buildFlowStages(RND_FLOW, rndPurchaseCounts),
        total: rndPurchaseRequests.length,
        totalAmount: rndPurchaseRequests.reduce((s, r) => s + Number(r.amount), 0),
        critical: getCriticalItems(rndPurchaseRequests),
        bottlenecks: getBottlenecks(rndPurchaseRequests),
        avgTime: getAvgTime(rndPurchaseRequests),
        rejected: rndPurchaseCounts.rejected?.count || 0,
        onHold: rndPurchaseCounts.ceo_hold?.count || 0,
      },
      others: {
        requests: othersRequests,
        flow: buildFlowStages(OTHERS_FLOW, othersCounts),
        total: othersRequests.length,
        totalAmount: othersRequests.reduce((s, r) => s + Number(r.amount), 0),
        critical: getCriticalItems(othersRequests),
        bottlenecks: getBottlenecks(othersRequests),
        avgTime: getAvgTime(othersRequests),
        rejected: othersCounts.rejected?.count || 0,
        onHold: othersCounts.ceo_hold?.count || 0,
      },
      all: {
        total: requests.length,
        totalAmount: requests.reduce((s, r) => s + Number(r.amount), 0),
        critical: getCriticalItems(requests),
        bottlenecks: getBottlenecks(requests),
        avgTime: getAvgTime(requests),
        rejected: allCounts.rejected?.count || 0,
        onHold: allCounts.ceo_hold?.count || 0,
        active: requests.filter(r => !['paid', 'rejected'].includes(r.status)).length,
      },
    };
  }, [requests]);

  const FlowPipeline = ({ stages, title }: { stages: FlowStage[]; title: string }) => (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</h4>
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {stages.map((stage, index) => (
          <div key={stage.id} className="flex items-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                'flex flex-col items-center justify-center p-3 rounded-lg min-w-[80px] border',
                stage.count > 0 ? 'bg-card border-border' : 'bg-muted/20 border-transparent'
              )}
            >
              <div className={cn('w-2.5 h-2.5 rounded-full mb-1', stage.color)} />
              <span className="text-[10px] text-muted-foreground font-medium">{stage.shortLabel}</span>
              <span className="text-lg font-bold">{stage.count}</span>
              {stage.amount > 0 && (
                <span className="text-[10px] text-muted-foreground flex items-center">
                  <IndianRupee className="w-2.5 h-2.5" />
                  {(stage.amount / 1000).toFixed(0)}K
                </span>
              )}
            </motion.div>
            {index < stages.length - 1 && (
              <ArrowRight className="w-4 h-4 text-muted-foreground/50 mx-0.5 shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const StatsCards = ({ data, showActive = false }: { data: typeof analytics.engineering; showActive?: boolean }) => (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {showActive && (
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="p-3 rounded-lg bg-primary/10 border border-primary/30"
        >
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">Active</span>
          </div>
          <p className="text-xl font-bold">{(data as any).active || data.total}</p>
        </motion.div>
      )}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05 }}
        className={cn(
          'p-3 rounded-lg border',
          data.critical > 0 ? 'bg-status-missed/10 border-status-missed/40' : 'bg-muted/30 border-border'
        )}
      >
        <div className="flex items-center gap-2 mb-1">
          <Zap className={cn('w-3.5 h-3.5', data.critical > 0 ? 'text-status-missed' : 'text-muted-foreground')} />
          <span className="text-xs text-muted-foreground">Critical</span>
        </div>
        <p className="text-xl font-bold">{data.critical}</p>
      </motion.div>
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className={cn(
          'p-3 rounded-lg border',
          data.bottlenecks > 0 ? 'bg-status-late/10 border-status-late/40' : 'bg-muted/30 border-border'
        )}
      >
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className={cn('w-3.5 h-3.5', data.bottlenecks > 0 ? 'text-status-late' : 'text-muted-foreground')} />
          <span className="text-xs text-muted-foreground">Delayed</span>
        </div>
        <p className="text-xl font-bold">{data.bottlenecks}</p>
      </motion.div>
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="p-3 rounded-lg bg-muted/30 border border-border"
      >
        <div className="flex items-center gap-2 mb-1">
          <Timer className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs text-muted-foreground">Avg Time</span>
        </div>
        <p className="text-xl font-bold">{data.avgTime.toFixed(0)}h</p>
      </motion.div>
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="p-3 rounded-lg bg-muted/30 border border-border"
      >
        <div className="flex items-center gap-2 mb-1">
          <XCircle className="w-3.5 h-3.5 text-status-missed" />
          <span className="text-xs text-muted-foreground">Rejected</span>
        </div>
        <p className="text-xl font-bold">{data.rejected}</p>
      </motion.div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20"
        >
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-5 h-5 text-blue-500" />
            <span className="text-sm font-medium">Engineering</span>
          </div>
          <p className="text-2xl font-bold">{analytics.engineering.total}</p>
          <p className="text-xs text-muted-foreground flex items-center">
            <IndianRupee className="w-3 h-3" />
            {analytics.engineering.totalAmount.toLocaleString('en-IN')}
          </p>
        </motion.div>

        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20"
        >
          <div className="flex items-center gap-2 mb-2">
            <Tractor className="w-5 h-5 text-green-500" />
            <span className="text-sm font-medium">Agri</span>
          </div>
          <p className="text-2xl font-bold">{analytics.agri.total}</p>
          <p className="text-xs text-muted-foreground flex items-center">
            <IndianRupee className="w-3 h-3" />
            {analytics.agri.totalAmount.toLocaleString('en-IN')}
          </p>
        </motion.div>

        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20"
        >
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="w-5 h-5 text-purple-500" />
            <span className="text-sm font-medium">R&D / Purchase</span>
          </div>
          <p className="text-2xl font-bold">{analytics.rnd_purchase.total}</p>
          <p className="text-xs text-muted-foreground flex items-center">
            <IndianRupee className="w-3 h-3" />
            {analytics.rnd_purchase.totalAmount.toLocaleString('en-IN')}
          </p>
        </motion.div>

        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20"
        >
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-amber-500" />
            <span className="text-sm font-medium">Others</span>
          </div>
          <p className="text-2xl font-bold">{analytics.others.total}</p>
          <p className="text-xs text-muted-foreground flex items-center">
            <IndianRupee className="w-3 h-3" />
            {analytics.others.totalAmount.toLocaleString('en-IN')}
          </p>
        </motion.div>
      </div>

      {/* Department Flow Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="all" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="engineering" className="gap-2">
            <Building2 className="w-4 h-4" />
            Engineering
          </TabsTrigger>
          <TabsTrigger value="agri" className="gap-2">
            <Tractor className="w-4 h-4" />
            Agri
          </TabsTrigger>
          <TabsTrigger value="rnd_purchase" className="gap-2">
            <Briefcase className="w-4 h-4" />
            R&D/Purchase
          </TabsTrigger>
          <TabsTrigger value="others" className="gap-2">
            <Users className="w-4 h-4" />
            Others
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <div className="authority-card">
            <StatsCards data={analytics.all as any} showActive />
          </div>
          <div className="authority-card space-y-4">
            <FlowPipeline stages={analytics.engineering.flow} title="Engineering Flow (7 Steps)" />
            <FlowPipeline stages={analytics.agri.flow} title="Agri Flow (6 Steps)" />
            <FlowPipeline stages={analytics.rnd_purchase.flow} title="R&D / Purchase Flow (5 Steps)" />
            <FlowPipeline stages={analytics.others.flow} title="Others Flow (4 Steps)" />
          </div>
        </TabsContent>

        <TabsContent value="engineering" className="space-y-4">
          <div className="authority-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold">Engineering Department</h3>
                <p className="text-sm text-muted-foreground">SMO → GMO → BOI → GM → Admin → CEO → Payment</p>
              </div>
            </div>
            <StatsCards data={analytics.engineering} />
          </div>
          <div className="authority-card">
            <FlowPipeline stages={analytics.engineering.flow} title="Approval Pipeline" />
          </div>
        </TabsContent>

        <TabsContent value="agri" className="space-y-4">
          <div className="authority-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Tractor className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold">Agri Department</h3>
                <p className="text-sm text-muted-foreground">SMO → BOI → Director → Admin → CEO → Payment</p>
              </div>
            </div>
            <StatsCards data={analytics.agri} />
          </div>
          <div className="authority-card">
            <FlowPipeline stages={analytics.agri.flow} title="Approval Pipeline" />
          </div>
        </TabsContent>

        <TabsContent value="rnd_purchase" className="space-y-4">
          <div className="authority-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <h3 className="font-semibold">R&D / Purchase Departments</h3>
                <p className="text-sm text-muted-foreground">GM → Admin → CEO → Payment</p>
              </div>
            </div>
            <StatsCards data={analytics.rnd_purchase} />
          </div>
          <div className="authority-card">
            <FlowPipeline stages={analytics.rnd_purchase.flow} title="Approval Pipeline" />
          </div>
        </TabsContent>

        <TabsContent value="others" className="space-y-4">
          <div className="authority-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <h3 className="font-semibold">Other Departments</h3>
                <p className="text-sm text-muted-foreground">Admin → CEO → Payment</p>
              </div>
            </div>
            <StatsCards data={analytics.others} />
          </div>
          <div className="authority-card">
            <FlowPipeline stages={analytics.others.flow} title="Approval Pipeline" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
