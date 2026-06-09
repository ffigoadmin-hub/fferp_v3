import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Users, Banknote, FolderKanban, FileText, FileSearch,
  AlertTriangle, Loader2, RotateCcw, ClipboardList, ClipboardCheck,
  RefreshCw, Flag, Package, Camera, Star, Boxes, ArrowRight, Warehouse,
  TrendingUp, CreditCard, Activity, Target, UserCog, ChevronRight,
  Building2, Zap, Bot, Search, MoreHorizontal, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePaymentRequests } from '@/hooks/usePaymentRequests';
import { useProjects } from '@/hooks/useProjects';
import { useAuditLogs } from '@/hooks/useAuditLogs';
import { ExecutiveTicketTable } from '@/components/ExecutiveTicketTable';
import { EmployeeActivityWidget } from '@/components/EmployeeActivityWidget';
import { AttendanceStatsWidget } from '@/components/AttendanceStatsWidget';
import { SelfieAttendanceWidget } from '@/components/SelfieAttendanceWidget';
import { TodayAttendanceWidget } from '@/components/TodayAttendanceWidget';
import { LOPReversalApprovalWidget } from '@/components/LOPReversalApprovalWidget';
import { DeviationApprovalsWidget } from '@/components/engineering/DeviationApprovalsWidget';
import { MaterialApprovalWidget } from '@/components/purchase/MaterialApprovalWidget';
import { PurchaseUpdatesWidget } from '@/components/purchase/PurchaseUpdatesWidget';
import { ProjectHealthWidget } from '@/components/monitoring/ProjectHealthWidget';
import { VendorPerformanceWidget } from '@/components/monitoring/VendorPerformanceWidget';
import { ConsumptionSummaryWidget } from '@/components/inventory/ConsumptionSummaryWidget';
import { WorkOrderMonitoringWidget } from '@/components/WorkOrderMonitoringWidget';
import { PaymentReminderButton } from '@/components/payment/PaymentReminderButton';
import { CoreHeadsManagementPage } from './CoreHeadsManagementPage';
import { WeeklyAchievementsDashboard } from './WeeklyAchievementsDashboard';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// ── Efficio-style KPI Card ─────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon: Icon, color, onClick, trend, isLoading,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
  onClick?: () => void;
  trend?: 'up' | 'down' | 'neutral';
  isLoading?: boolean;
}) {
  return (
    <div
      className={cn('rounded-2xl p-5 transition-all duration-200', onClick && 'cursor-pointer')}
      style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
      onClick={onClick}
      onMouseEnter={e => { if (onClick) { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; (e.currentTarget as HTMLElement).style.borderColor = '#D1D5DB'; } }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; (e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB'; }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[13px] font-medium" style={{ color: '#6B7280' }}>{label}</span>
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" style={{ color: '#D1D5DB' }} />
          <MoreHorizontal className="w-4 h-4" style={{ color: '#D1D5DB' }} />
        </div>
      </div>

      {/* Value + trend */}
      <div className="flex items-end gap-2 mb-3">
        {isLoading ? (
          <div className="h-9 w-16 rounded-lg animate-pulse" style={{ background: '#F3F4F6' }} />
        ) : (
          <span className="text-[32px] font-bold leading-none tabular-nums" style={{ color: '#111827' }}>{value}</span>
        )}
        {trend && !isLoading && (
          <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full mb-0.5',
            trend === 'up' ? 'bg-green-50 text-green-600' : trend === 'down' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500')}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—'}
          </span>
        )}
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between">
        <span className="text-[12px]" style={{ color: '#9CA3AF' }}>{sub}</span>
        {onClick && (
          <button className="text-[12px] font-medium px-3 py-1 rounded-lg transition-colors"
            style={{ color: '#2563EB', border: '1px solid #BFDBFE', background: '#EFF6FF' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#DBEAFE'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#EFF6FF'; }}>
            Details →
          </button>
        )}
      </div>
    </div>
  );
}

// ── Quick Action Button ───────────────────────────────────────────────────────
function QuickAction({ label, icon: Icon, path, color }: {
  label: string; icon: React.ElementType; path: string; color: string;
}) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(path)}
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-all duration-150 group"
      style={{ color: '#374151' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = '#F9FAFB';
        (e.currentTarget as HTMLElement).style.color = '#111827';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
        (e.currentTarget as HTMLElement).style.color = '#374151';
      }}
    >
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: color + '12', border: `1px solid ${color}25` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <span className="text-[13px] font-medium flex-1 truncate">{label}</span>
      <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#9CA3AF' }} />
    </button>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export function AdminDashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { requests: pendingPayments, isLoading: paymentsLoading } = usePaymentRequests(['pending']);
  const { projects, isLoading: projectsLoading } = useProjects();
  const { logs, isLoading: logsLoading } = useAuditLogs();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setIsRefreshing(false), 1000);
  }, [queryClient]);

  const { data: workOrders } = useQuery({
    queryKey: ['admin-work-orders-count'],
    queryFn: async () => {
      const { data, error } = await supabase.from('work_orders').select('id, status').eq('status', 'pending');
      if (error) throw error;
      return data;
    },
    refetchOnWindowFocus: false,
    staleTime: 60000,
  });

  const { data: purchaseOrders } = useQuery({
    queryKey: ['admin-purchase-orders-count'],
    queryFn: async () => {
      const { data, error } = await supabase.from('purchase_orders').select('id, status').eq('status', 'pending');
      if (error) throw error;
      return data;
    },
    refetchOnWindowFocus: false,
    staleTime: 60000,
  });

  const { data: pendingReversals } = useQuery({
    queryKey: ['admin-pending-reversals-count'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lop_entries').select('id').eq('reversal_requested', true).eq('reversal_status', 'REV_PENDING_ADMIN');
      if (error) throw error;
      return data;
    },
    refetchOnWindowFocus: false,
    staleTime: 60000,
  });

  const { data: employeeCount } = useQuery({
    queryKey: ['admin-employee-count'],
    queryFn: async () => {
      const { count, error } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
      if (error) throw error;
      return count ?? 0;
    },
    refetchOnWindowFocus: false,
    staleTime: 300000,
  });

  const isLoading = paymentsLoading || projectsLoading || logsLoading;

  const pendingWO = workOrders?.length || 0;
  const pendingPO = purchaseOrders?.length || 0;
  const pendingReversalsCount = pendingReversals?.length || 0;
  const activeProjects = projects.filter(p => p.status === 'active');
  const recentLogs = logs.slice(0, 10);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: '#111827' }}>
            Admin Dashboard
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: '#6B7280' }}>
            {format(new Date(), 'EEEE, d MMMM yyyy')} · Central control & monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PaymentReminderButton variant="outline" size="sm" className="gap-2 text-[12px]" />
          <Button variant="outline" size="sm" onClick={handleManualRefresh} disabled={isRefreshing} className="gap-2 text-[12px]">
            <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── KPI Cards Row (Zoho Books style) ───────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Employees"
          value={isLoading ? '…' : (employeeCount ?? '—')}
          sub="registered users"
          icon={Users}
          color="#1B6FD8"
          onClick={() => navigate('/admin/employees')}
          isLoading={isLoading}
        />
        <KpiCard
          label="Pending Payments"
          value={isLoading ? '…' : pendingPayments?.length || 0}
          sub="awaiting approval"
          icon={Banknote}
          color="#D97706"
          onClick={() => navigate('/admin-queue')}
          isLoading={isLoading}
        />
        <KpiCard
          label="Active Projects"
          value={isLoading ? '…' : activeProjects.length}
          sub="in progress"
          icon={FolderKanban}
          color="#0E8A6B"
          onClick={() => navigate('/projects')}
          isLoading={isLoading}
        />
      </div>

      {/* ── Secondary KPIs ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="LOP Reversals" value={pendingReversalsCount} sub="pending admin" icon={RotateCcw} color="#DC2626" onClick={() => navigate('/admin-lop')} />
        <KpiCard label="Pending POs" value={pendingPO} sub="purchase orders" icon={Package} color="#0891B2" onClick={() => navigate('/purchase')} />
        <KpiCard label="Hub Operations" value="3" sub="Pal · Van · Hyd" icon={Warehouse} color="#1B6FD8" onClick={() => navigate('/admin/hubs')} />
        <KpiCard label="Audit Entries" value={logs.length} sub="system events" icon={FileSearch} color="#6B7A8D" onClick={() => navigate('/audit-logs')} />
      </div>

      {/* ── Main Content Grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left col (2/3) — Tabs with detail views */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="overview" className="w-full">
            {/* Tab Bar — clean light */}
            <TabsList className="mb-4 px-1.5 py-1.5 h-auto flex overflow-x-auto gap-0.5 w-full justify-start rounded-xl"
              style={{ background: '#F1F5F9', border: '1px solid #E2E8F0' }}>
              {[
                { value: 'overview',  label: 'Overview',       icon: ShieldCheck },
                { value: 'selfie',    label: 'Attendance',     icon: Camera },
                { value: 'lop',       label: 'LOP', icon: RotateCcw, badge: pendingReversalsCount },
                { value: 'materials', label: 'Materials',      icon: Package },
                { value: 'deviations',label: 'Deviations',     icon: Flag },
                { value: 'projects',  label: 'Projects',       icon: FolderKanban },
                { value: 'vendors',   label: 'Vendors',        icon: Star },
                { value: 'inventory', label: 'Inventory',      icon: Boxes },
                { value: 'activity',  label: 'Activity',       icon: Users },
                { value: 'performance',label: 'Performance',   icon: Target },
              ].map(tab => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-all duration-150 data-[state=active]:shadow-sm data-[state=active]:bg-white data-[state=active]:text-blue-600"
                  style={{ color: '#6B7280' }}
                >
                  <tab.icon className="w-3.5 h-3.5 shrink-0" />
                  {tab.label}
                  {tab.badge && tab.badge > 0 && (
                    <span className="flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black"
                      style={{ background: '#F87171', color: '#fff' }}>
                      {tab.badge}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview" className="mt-0 space-y-4">
              <AttendanceStatsWidget />

              {/* Audit Log */}
              <div className="rounded-2xl overflow-hidden"
                style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div className="flex items-center justify-between px-5 py-4"
                  style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <div className="flex items-center gap-2">
                    <FileSearch className="w-4 h-4" style={{ color: '#2563EB' }} />
                    <span className="text-[13px] font-bold" style={{ color: '#111827' }}>Real-Time Audit Log</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/audit-logs')}
                    className="text-[12px] gap-1" style={{ color: '#2563EB' }}>
                    View All <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
                <ScrollArea className="h-[260px]">
                  <Table>
                    <TableHeader>
                      <TableRow style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>Time</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>Action</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>User</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>Module</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentLogs.map((log) => (
                        <TableRow key={log.id} className="transition-colors border-0"
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                          <TableCell className="font-mono text-[11px] tabular-nums" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            {format(new Date(log.created_at), 'HH:mm:ss')}
                          </TableCell>
                          <TableCell>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(170,255,0,0.1)', color: '#2563EB' }}>
                              {log.action.replace(/_/g, ' ')}
                            </span>
                          </TableCell>
                          <TableCell className="text-[12px] font-medium" style={{ color: '#374151' }}>
                            {log.performed_by_name || 'System'}
                          </TableCell>
                          <TableCell className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            {log.record_type}
                          </TableCell>
                        </TableRow>
                      ))}
                      {recentLogs.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-10 text-[13px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                            No audit entries yet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>

              {/* Escalation Intelligence */}
              <div className="rounded-2xl overflow-hidden"
                style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div className="flex items-center justify-between px-5 py-4"
                  style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" style={{ color: '#FBBF24' }} />
                    <span className="text-[13px] font-bold" style={{ color: '#111827' }}>Escalation Intelligence</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/escalations')}
                    className="text-[12px] gap-1" style={{ color: '#2563EB' }}>
                    Unified View <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
                <div className="p-4">
                  <ExecutiveTicketTable role="admin" hideHeader={true} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="selfie" className="mt-0 space-y-4">
              <TodayAttendanceWidget />
              <SelfieAttendanceWidget />
            </TabsContent>
            <TabsContent value="lop" className="mt-0">
              <LOPReversalApprovalWidget role="admin" />
            </TabsContent>
            <TabsContent value="materials" className="mt-0 space-y-4">
              <MaterialApprovalWidget role="admin" />
              <PurchaseUpdatesWidget />
            </TabsContent>
            <TabsContent value="deviations" className="mt-0">
              <DeviationApprovalsWidget role="admin" />
            </TabsContent>
            <TabsContent value="projects" className="mt-0">
              <ProjectHealthWidget />
            </TabsContent>
            <TabsContent value="vendors" className="mt-0">
              <VendorPerformanceWidget />
            </TabsContent>
            <TabsContent value="inventory" className="mt-0">
              <ConsumptionSummaryWidget />
            </TabsContent>
            <TabsContent value="activity" className="mt-0">
              <EmployeeActivityWidget title="All Employee Activity" />
            </TabsContent>
            <TabsContent value="core-heads" className="mt-0">
              <CoreHeadsManagementPage />
            </TabsContent>
            <TabsContent value="performance" className="mt-0">
              <WeeklyAchievementsDashboard />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right col (1/3) — Quick Actions + FF Hub Summary */}
        <div className="space-y-4">

          {/* Quick Actions */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="px-4 py-3.5" style={{ borderBottom: '1px solid #F3F4F6' }}>
              <span className="text-[13px] font-black" style={{ color: '#111827' }}>Quick Actions</span>
            </div>
            <div className="p-3 space-y-1.5">
              <QuickAction label="Payment Queue"         icon={Banknote}       path="/admin-queue"              color="#D97706" />
              <QuickAction label="Escalations"           icon={AlertTriangle}  path="/admin-escalations"        color="#DC2626" />
              <QuickAction label="User Management"       icon={Users}          path="/user-management"          color="#0E8A6B" />
              <QuickAction label="Hub Management"        icon={Warehouse}      path="/admin/hubs"               color="#7C3AED" />
              <QuickAction label="LOP Register"          icon={ClipboardList}  path="/admin-lop"                color="#D97706" />
              <QuickAction label="Audit Logs"            icon={FileSearch}     path="/audit-logs"               color="#6B7A8D" />
              <QuickAction label="AI Assistant"          icon={Bot}            path="/admin/ai-assistant"       color="#1B6FD8" />
              <QuickAction label="Payment Search"        icon={Search}         path="/payment-search"           color="#0891B2" />
            </div>
          </div>

          {/* FF Hub Summary */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between px-4 py-3.5"
              style={{ borderBottom: '1px solid #F3F4F6' }}>
              <span className="text-[13px] font-black" style={{ color: '#111827' }}>Hub Overview</span>
              <button onClick={() => navigate('/admin/hubs')}
                className="text-[11px] font-bold flex items-center gap-1"
                style={{ color: '#2563EB' }}>
                Manage <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div style={{ borderTop: 'none' }}>
              {[
                { name: 'Palikarani', code: 'HUB-1', manager: 'Arun Karthick', routes: 3, channels: ['FF', 'DMART'], color: '#38BDF8', path: '/admin/hubs/palikarani' },
                { name: 'Vanagaram',  code: 'HUB-2', manager: 'Prakash',        routes: 6, channels: ['FF', 'DMART', 'BLINKIT', 'ZEPTO'], color: '#2563EB', path: '/admin/hubs/vanagaram' },
                { name: 'Hyderabad', code: 'HUB-3', manager: 'Hari',           routes: 4, channels: ['FF', 'DMART', 'ZEPTO'], color: '#A78BFA', path: '/admin/hubs/hyderabad' },
              ].map(hub => (
                <button key={hub.code} onClick={() => navigate(hub.path)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200 group"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-[11px] font-black"
                    style={{ background: hub.color + '15', color: hub.color, border: `1px solid ${hub.color}25` }}>
                    {hub.code.split('-')[1]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold truncate" style={{ color: 'rgba(255,255,255,0.8)' }}>{hub.name}</p>
                    <p className="text-[10px]" style={{ color: '#9CA3AF' }}>{hub.manager} · {hub.routes} routes</p>
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {hub.channels.slice(0, 2).map(ch => (
                      <span key={ch} className="text-[9px] font-black px-1.5 py-0.5 rounded-lg"
                        style={{ background: hub.color + '12', color: hub.color }}>{ch}</span>
                    ))}
                    {hub.channels.length > 2 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-lg"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
                        +{hub.channels.length - 2}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* FF Operations Links */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="px-4 py-3.5" style={{ borderBottom: '1px solid #F3F4F6' }}>
              <span className="text-[13px] font-black" style={{ color: '#111827' }}>FF Operations</span>
            </div>
            <div className="p-3 grid grid-cols-3 gap-2">
              {[
                { label: 'Purchase', icon: Package, path: '/purchase', color: '#D97706' },
                { label: 'Warehouse', icon: Warehouse, path: '/warehouse', color: '#0891B2' },
                { label: 'Sales', icon: TrendingUp, path: '/sales', color: '#0E8A6B' },
                { label: 'Logistics', icon: Activity, path: '/logistics', color: '#7C3AED' },
                { label: 'Finance', icon: CreditCard, path: '/finance', color: '#1B6FD8' },
                { label: 'Reports', icon: FileText, path: '/reports', color: '#6B7A8D' },
              ].map(item => (
                <button key={item.label} onClick={() => navigate(item.path)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl text-center transition-all duration-150 hover:-translate-y-0.5"
                  style={{ background: item.color + '0D', border: `1px solid ${item.color}20` }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = item.color + '18'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = item.color + '0D'}>
                  <item.icon className="w-4 h-4" style={{ color: item.color }} />
                  <span className="text-[10px] font-semibold" style={{ color: item.color }}>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
