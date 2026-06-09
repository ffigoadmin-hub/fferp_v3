import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Flag, AlertTriangle, Loader2, IndianRupee } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// CEO Components
import { CEODashboardHeader } from '@/components/ceo/CEODashboardHeader';
import { CEODashboardTabs, DashboardTab } from '@/components/ceo/CEODashboardTabs';
import { CEOOperationalPulse } from '@/components/ceo/CEOOperationalPulse';
import { CEOPulseCard } from '@/components/ceo/CEOPulseCard';
import { CEOStatsGrid } from '@/components/ceo/CEOStatsGrid';
import { CEOQuickActions } from '@/components/ceo/CEOQuickActions';
import { CEOActivityLogWidget } from '@/components/ceo/CEOActivityLogWidget';
import { CEOEscalationOverview } from '@/components/ceo/CEOEscalationOverview';

// Widget Components
import { EmployeeLOPSummaryWidget } from '@/components/EmployeeLOPSummaryWidget';
import { TodayAttendanceWidget } from '@/components/TodayAttendanceWidget';
import { DeviationApprovalsWidget } from '@/components/engineering/DeviationApprovalsWidget';
import { FarmUpdatesWidget } from '@/components/FarmUpdatesWidget';
import { WorkOrderMonitoringWidget } from '@/components/WorkOrderMonitoringWidget';
import { RecentSalesOrdersWidget } from '@/components/RecentSalesOrdersWidget';

// Hooks
import { useCEOIntelligence } from '@/hooks/useCEOIntelligence';
import { useProjects } from '@/hooks/useProjects';
import { useRealtimeEscalations } from '@/hooks/useRealtimeEscalations';
import { useQueryClient } from '@tanstack/react-query';

export function CEODashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setIsRefreshing(false), 1000);
  }, [queryClient]);

  const { paymentTrends, overallStats, isLoading: intelligenceLoading } = useCEOIntelligence();
  const { projects } = useProjects();
  const { counts: ticketCounts, isLoading: ticketsLoading } = useRealtimeEscalations();

  const isLoading = intelligenceLoading || ticketsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading command center...</p>
        </div>
      </div>
    );
  }

  const civilProjects = projects.filter(p => p.vertical?.toLowerCase() === 'civil');
  const agriProjects = projects.filter(p => p.vertical?.toLowerCase() === 'agri');

  const dailySpend = paymentTrends.length > 0
    ? paymentTrends.map(t => ({ day: t.date, amount: t.amount }))
    : [{ day: 'No Data', amount: 0 }];

  const weeklySpend = projects.length > 0
    ? `₹${(overallStats.todayApproved / 100000).toFixed(1)}L`
    : '₹0.0L';

  // Escalation metrics
  const escalationMetrics = [
    { value: ticketCounts.escalationActive, label: 'Active Briefs', colorClass: 'text-primary', bgClass: 'bg-primary/5', borderClass: 'border-primary/20' },
    { value: ticketCounts.escalationAudit, label: 'Audit Waiting', colorClass: 'text-status-pending', bgClass: 'bg-status-pending/5', borderClass: 'border-status-pending/20' },
    { value: ticketCounts.escalationClosed, label: 'Closed', colorClass: 'text-status-live', bgClass: 'bg-status-live/5', borderClass: 'border-status-live/20' },
  ];

  // Critical metrics
  const criticalMetrics = [
    { value: ticketCounts.criticalActive, label: 'Active Criticals', colorClass: 'text-destructive', bgClass: 'bg-destructive/5', borderClass: 'border-destructive/20' },
    { value: ticketCounts.criticalAudit, label: 'Audit Waiting', colorClass: 'text-status-pending', bgClass: 'bg-status-pending/5', borderClass: 'border-status-pending/20' },
    { value: ticketCounts.criticalClosed, label: 'Closed', colorClass: 'text-status-live', bgClass: 'bg-status-live/5', borderClass: 'border-status-live/20' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5 pb-8"
    >
      {/* Header */}
      <CEODashboardHeader isRefreshing={isRefreshing} onRefresh={handleManualRefresh} />

      {/* Tabs Navigation */}
      <CEODashboardTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Tab Contents */}
      <div className="mt-4">
        {activeTab === 'overview' && (
          <div className="space-y-5">
            {/* Operational Pulse Header */}
            <CEOOperationalPulse isLoading={ticketsLoading} />

            {/* Attendance Widget */}
            <TodayAttendanceWidget />

            {/* Pulse Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <CEOPulseCard
                title="Escalations Pulse"
                icon={Flag}
                metrics={escalationMetrics}
                onClick={() => navigate('/dashboard/escalations?tab=escalations')}
                variant="primary"
              />
              <CEOPulseCard
                title="Criticals Pulse"
                icon={AlertTriangle}
                metrics={criticalMetrics}
                onClick={() => navigate('/dashboard/escalations?tab=criticals')}
                variant="destructive"
              />
            </div>

            {/* Stats Grid */}
            <CEOStatsGrid
              weeklySpend={weeklySpend}
              adminRejections={overallStats.adminRejections}
              activeProjects={civilProjects.length + agriProjects.length}
              pendingApprovals={overallStats.pendingApprovals}
            />

            {/* Daily Spend Chart */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-5 shadow-lg">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                <IndianRupee className="w-3.5 h-3.5 text-primary" />
                Daily Paid Spend
              </h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailySpend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" opacity={0.1} />
                    <XAxis
                      dataKey="day"
                      stroke="rgba(255,255,255,0.4)"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="rgba(255,255,255,0.4)"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `₹${v / 1000}k`}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      contentStyle={{
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        backdropFilter: 'blur(10px)',
                        fontSize: '11px',
                        color: '#fff'
                      }}
                    />
                    <Bar dataKey="amount" fill="#7c3aed" radius={[4, 4, 0, 0]} barSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Sales Orders Overview */}
            <RecentSalesOrdersWidget title="Sales Orders — Live Feed" limit={10} />

            {/* Quick Actions */}
            <CEOQuickActions />

            {/* Escalation Command Center */}
            <CEOEscalationOverview />
          </div>
        )}

        {activeTab === 'my-activity' && <CEOActivityLogWidget />}
        {activeTab === 'lop-summary' && <EmployeeLOPSummaryWidget />}
        {activeTab === 'deviations' && <DeviationApprovalsWidget role="ceo" />}
        {activeTab === 'farm' && <FarmUpdatesWidget title="Farm & Site Updates" maxHeight="600px" />}
      </div>
    </motion.div>
  );
}
