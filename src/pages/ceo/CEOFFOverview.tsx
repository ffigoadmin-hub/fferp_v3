// @ts-nocheck
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import {
  TrendingUp, Banknote, Truck, ShoppingCart, Warehouse,
  Users, ArrowUpRight, ArrowDownRight, Clock, CheckCircle2,
  AlertCircle, BarChart3, Activity, Package, Boxes, ClipboardCheck,
  Gauge, Building2, PackageCheck, Timer, ListChecks, Wallet,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend } from 'recharts';

function KPICard({ label, value, sub, icon: Icon, iconBg, iconColor, trend }: any) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className="p-2.5 rounded-xl" style={{ background: iconBg }}>
          <Icon className="w-5 h-5" style={{ color: iconColor }} />
        </div>
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {trend >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
          {Math.abs(trend)}% vs last month
        </div>
      )}
    </div>
  );
}

function CompactKPICard({ label, value, sub, icon: Icon, iconBg, iconColor, notAvailable }: any) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3.5 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <div className="p-1.5 rounded-lg" style={{ background: iconBg }}>
          <Icon className="w-3.5 h-3.5" style={{ color: iconColor }} />
        </div>
      </div>
      <p className={`text-lg font-bold leading-tight ${notAvailable ? 'text-gray-300' : 'text-gray-900'}`}>{value}</p>
      <p className="text-[11px] text-gray-500 font-medium mt-0.5 leading-tight">{label}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{sub}</p>}
    </div>
  );
}

function PaymentPipelineBar({ label, counts }: { label: string; counts: Record<string,number> }) {
  const stages = [
    { key: 'pending_ff_ops', label: 'FF Ops', color: '#F59E0B' },
    { key: 'pending_gm',     label: 'GM',     color: '#3B82F6' },
    { key: 'pending_l1',     label: 'L1',     color: '#8B5CF6' },
    { key: 'pending_auditor',label: 'Auditor',color: '#06B6D4' },
    { key: 'pending_ceo',    label: 'CEO',    color: '#F97316' },
    { key: 'approved',       label: 'Approved',color:'#10B981' },
    { key: 'paid',           label: 'Paid',   color: '#16A34A' },
    { key: 'rejected',       label: 'Rejected',color:'#EF4444' },
  ];
  // Bar heights are relative to the largest count, not a fixed px-per-unit
  // scale — a fixed 6px/unit made a 262-count "Paid" bar render at 1572px
  // tall, blowing out the whole page layout once payment volume grew.
  const maxCount = Math.max(1, ...stages.map(s => counts[s.key] || 0));
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-2">{label}</p>
      <div className="flex items-end gap-2 h-16">
        {stages.map(s => (
          <div key={s.key} className="flex flex-col items-center gap-1 flex-1">
            <div
              className="w-full rounded-t-sm transition-all"
              style={{
                background: s.color,
                height: counts[s.key] ? `${Math.max((counts[s.key] / maxCount) * 56, 4)}px` : '0',
              }}
            />
            <span className="text-xs text-gray-400">{counts[s.key] || 0}</span>
            <span className="text-[9px] text-gray-400 text-center leading-tight">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CEOFFOverview() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const monthEnd   = format(endOfMonth(new Date()),   'yyyy-MM-dd');

  // Sales this month
  const { data: salesData } = useQuery({
    queryKey: ['ceo-ff-sales'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sales_orders')
        .select('id, total_amount, status, source, hub_id, created_at')
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd + 'T23:59:59');
      return data || [];
    },
  });

  // ── CEO Control (Top 15) — additional sources ──────────────────────────

  // #2 SO Quantity — sales_order_items.quantity for this month's orders
  const { data: soItems } = useQuery({
    queryKey: ['ceo-top15-so-items', monthStart],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('sales_order_items')
        .select('quantity, sales_orders!inner(created_at)')
        .gte('sales_orders.created_at', monthStart)
        .lte('sales_orders.created_at', monthEnd + 'T23:59:59');
      if (error) throw error;
      return data || [];
    },
  });

  // #4 PO Quantity — purchase_order_items.ordered_qty (actually bought) for this month's POs
  const { data: poItemsMonth } = useQuery({
    queryKey: ['ceo-top15-po-items-month', monthStart],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('purchase_order_items')
        .select('ordered_qty, purchase_orders!inner(created_at)')
        .gte('purchase_orders.created_at', monthStart)
        .lte('purchase_orders.created_at', monthEnd + 'T23:59:59');
      if (error) throw error;
      return data || [];
    },
  });

  // #7 Purchase Requirement — required_qty on today's POs (daily, like the EOD engine's own shortfall calc)
  const { data: poItemsToday } = useQuery({
    queryKey: ['ceo-top15-po-items-today', today],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('purchase_order_items')
        .select('required_qty, purchase_orders!inner(created_at)')
        .gte('purchase_orders.created_at', `${today}T00:00:00`)
        .lte('purchase_orders.created_at', `${today}T23:59:59`);
      if (error) throw error;
      return data || [];
    },
  });

  // #6 Available Inventory — total quantity across all hubs
  const { data: inventoryAll } = useQuery({
    queryKey: ['ceo-top15-inventory'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('inventory').select('quantity');
      if (error) throw error;
      return data || [];
    },
  });

  // #10 Hub Distribution — hub names for the sales_orders.hub_id breakdown above
  const { data: hubsList } = useQuery({
    queryKey: ['ceo-top15-hubs'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('hubs').select('id, name').eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
  });

  // #8 QC Pass % — qc_inspections.status is written as accepted/partial/rejected (see QCInspection.tsx)
  const { data: qcMonth } = useQuery({
    queryKey: ['ceo-top15-qc', monthStart],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('qc_inspections')
        .select('status')
        .gte('created_at', `${monthStart}T00:00:00`)
        .lte('created_at', monthEnd + 'T23:59:59');
      if (error) throw error;
      return data || [];
    },
  });

  // #11 Packing Completion % — same delivery_packs pattern as GMOperationsDashboard, scoped to the month
  const { data: packsMonth } = useQuery({
    queryKey: ['ceo-top15-packs', monthStart],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('delivery_packs')
        .select('status')
        .gte('created_at', `${monthStart}T00:00:00`)
        .lte('created_at', monthEnd + 'T23:59:59');
      if (error) throw error;
      return data || [];
    },
  });

  // #12 Dispatch Completion % — same boxes.status pattern as GMOperationsDashboard, scoped to the month
  const { data: boxesMonth } = useQuery({
    queryKey: ['ceo-top15-boxes', monthStart],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('boxes')
        .select('status')
        .gte('created_at', `${monthStart}T00:00:00`)
        .lte('created_at', monthEnd + 'T23:59:59');
      if (error) throw error;
      return data || [];
    },
  });

  // #13 On-Time Delivery % — trip_orders.delivered_at vs the order's promised sales_orders.delivery_date
  const { data: otdRows } = useQuery({
    queryKey: ['ceo-top15-otd', monthStart],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('trip_orders')
        .select('delivered_at, delivery_status, sales_orders(delivery_date)')
        .eq('delivery_status', 'delivered')
        .gte('delivered_at', `${monthStart}T00:00:00`)
        .lte('delivered_at', monthEnd + 'T23:59:59');
      if (error) throw error;
      return data || [];
    },
  });

  // #15 Outstanding / Collection — customers.outstanding_balance (confirmed live in CustomerManagement.tsx)
  const { data: customersBalance } = useQuery({
    queryKey: ['ceo-top15-outstanding'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('customers').select('outstanding_balance');
      if (error) throw error;
      return data || [];
    },
  });

  // Purchase orders
  const { data: poData } = useQuery({
    queryKey: ['ceo-ff-po'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('purchase_orders')
        .select('id, total_amount, status, created_at')
        .gte('created_at', monthStart);
      return data || [];
    },
  });

  // Vendor payments pipeline
  const { data: vpData } = useQuery({
    queryKey: ['ceo-ff-vendor-payments'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('ff_vendor_payments')
        .select('id, payment_status, net_amount, created_at');
      return data || [];
    },
  });

  // Transport payments pipeline
  const { data: tpData } = useQuery({
    queryKey: ['ceo-ff-transport-payments'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('ff_transport_payments')
        .select('id, payment_status, total_amount, created_at');
      return data || [];
    },
  });

  // Task performance
  const { data: taskData } = useQuery({
    queryKey: ['ceo-ff-tasks'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('ff_task_assignments')
        .select('id, status, order_target, completed_orders, amount_target, completed_amount, task_date')
        .gte('task_date', monthStart);
      return data || [];
    },
  });

  // Derived KPIs
  const totalSales  = (salesData || []).reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const totalPO     = (poData || []).reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const pendingVP   = (vpData || []).filter(p => p.payment_status?.startsWith('pending')).length;
  const pendingTP   = (tpData || []).filter(p => p.payment_status?.startsWith('pending')).length;
  const totalVPAmt  = (vpData || []).filter(p => ['pending_ceo','approved'].includes(p.payment_status)).reduce((s, p) => s + Number(p.net_amount || 0), 0);

  const taskComplete = (taskData || []).filter(t => t.status === 'completed').length;
  const taskTotal    = (taskData || []).length;
  const taskOrdersDone = (taskData || []).reduce((s, t) => s + (t.completed_orders || 0), 0);
  const taskOrdersTarget = (taskData || []).reduce((s, t) => s + (t.order_target || 0), 0);

  const vpCounts = Object.fromEntries(
    (vpData || []).reduce((acc, p) => {
      acc.set(p.payment_status, (acc.get(p.payment_status) || 0) + 1); return acc;
    }, new Map<string,number>()).entries()
  );
  const tpCounts = Object.fromEntries(
    (tpData || []).reduce((acc, p) => {
      acc.set(p.payment_status, (acc.get(p.payment_status) || 0) + 1); return acc;
    }, new Map<string,number>()).entries()
  );

  // ── CEO Control (Top 15) — derived values ───────────────────────────────

  const soQuantity = (soItems || []).reduce((s: number, i: any) => s + Number(i.quantity || 0), 0);
  const poQuantity = (poItemsMonth || []).reduce((s: number, i: any) => s + Number(i.ordered_qty || 0), 0);
  const purchaseRequirement = (poItemsToday || []).reduce((s: number, i: any) => s + Number(i.required_qty || 0), 0);
  const availableInventory = (inventoryAll || []).reduce((s: number, i: any) => s + Number(i.quantity || 0), 0);

  const qcTotal = (qcMonth || []).length;
  const qcAccepted = (qcMonth || []).filter((q: any) => q.status === 'accepted').length;
  const qcPassRate = qcTotal > 0 ? Math.round((qcAccepted / qcTotal) * 100) : null;

  const hubOrderCounts = new Map<string, number>();
  (salesData || []).forEach((o: any) => {
    if (!o.hub_id) return;
    hubOrderCounts.set(o.hub_id, (hubOrderCounts.get(o.hub_id) || 0) + 1);
  });
  const hubDistribution = (hubsList || [])
    .map((h: any) => ({ name: h.name, count: hubOrderCounts.get(h.id) || 0 }))
    .filter((h: any) => h.count > 0)
    .sort((a: any, b: any) => b.count - a.count);
  const hubDistributionTotal = hubDistribution.reduce((s: number, h: any) => s + h.count, 0);

  const packsTotal = (packsMonth || []).length;
  const packsDone = (packsMonth || []).filter((p: any) => ['dispatched', 'delivered'].includes(p.status)).length;
  const packingCompletion = packsTotal > 0 ? Math.round((packsDone / packsTotal) * 100) : null;

  const boxesTotal = (boxesMonth || []).length;
  const boxesDone = (boxesMonth || []).filter((b: any) => ['dispatched', 'delivered'].includes(b.status)).length;
  const dispatchCompletion = boxesTotal > 0 ? Math.round((boxesDone / boxesTotal) * 100) : null;

  // Only count deliveries that actually had a promised date — otherwise a
  // missing delivery_date would silently count as "late" or "on time"
  // instead of just being data we don't have.
  const otdEligible = (otdRows || []).filter((r: any) => r.sales_orders?.delivery_date && r.delivered_at);
  const otdOnTime = otdEligible.filter((r: any) =>
    r.delivered_at.split('T')[0] <= r.sales_orders.delivery_date
  ).length;
  const onTimeDeliveryRate = otdEligible.length > 0 ? Math.round((otdOnTime / otdEligible.length) * 100) : null;

  const soClearanceTotal = (salesData || []).length;
  const soCleared = (salesData || []).filter((o: any) => o.status !== 'pending').length;
  const soClearanceRate = soClearanceTotal > 0 ? Math.round((soCleared / soClearanceTotal) * 100) : null;

  const totalOutstanding = (customersBalance || []).reduce((s: number, c: any) => s + Number(c.outstanding_balance || 0), 0);

  // Hub-wise sales chart data (from sales orders)
  const hubSalesChart = [
    { name: 'Apr', sales: 0, purchase: 0 },
    { name: 'May', sales: Math.round(totalSales / 1000), purchase: Math.round(totalPO / 1000) },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 pt-2">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Farmers Factory — Overview</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Month to date · {format(new Date(), 'MMMM yyyy')}
        </p>
      </div>

      {/* CEO Control (Top 15) */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">CEO Control — Top 15</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <CompactKPICard
            label="Total Orders" value={(salesData || []).length} sub="This month"
            icon={ShoppingCart} iconBg="#EFF6FF" iconColor="#2563EB"
          />
          <CompactKPICard
            label="SO Quantity"
            value={(soItems || []).length > 0 ? `${soQuantity.toLocaleString('en-IN', { maximumFractionDigits: 0 })} kg` : '—'}
            sub={(soItems || []).length > 0 ? 'This month' : 'No order items this month'}
            icon={Package} iconBg="#EFF6FF" iconColor="#2563EB"
          />
          <CompactKPICard
            label="SO Value"
            value={(salesData || []).length > 0 ? `₹${(totalSales / 1000).toFixed(0)}k` : '—'}
            sub={(salesData || []).length > 0 ? 'This month' : 'No orders this month'}
            icon={TrendingUp} iconBg="#DCFCE7" iconColor="#16A34A"
          />
          <CompactKPICard
            label="PO Quantity"
            value={(poItemsMonth || []).length > 0 ? `${poQuantity.toLocaleString('en-IN', { maximumFractionDigits: 0 })} kg` : '—'}
            sub={(poItemsMonth || []).length > 0 ? 'Actually bought this month' : 'No PO items this month'}
            icon={ShoppingCart} iconBg="#F5F3FF" iconColor="#7C3AED"
          />
          <CompactKPICard
            label="PO Value"
            value={(poData || []).length > 0 ? `₹${(totalPO / 1000).toFixed(0)}k` : '—'}
            sub={(poData || []).length > 0 ? 'This month' : 'No POs this month'}
            icon={Banknote} iconBg="#F5F3FF" iconColor="#7C3AED"
          />
          <CompactKPICard
            label="Available Inventory"
            value={(inventoryAll || []).length > 0 ? `${availableInventory.toLocaleString('en-IN', { maximumFractionDigits: 0 })} kg` : '—'}
            sub={(inventoryAll || []).length > 0 ? 'All hubs' : 'No inventory rows found'}
            icon={Boxes} iconBg="#EEF2FF" iconColor="#4F46E5"
          />
          <CompactKPICard
            label="Purchase Requirement"
            value={(poItemsToday || []).length > 0 ? `${purchaseRequirement.toLocaleString('en-IN', { maximumFractionDigits: 0 })} kg` : '—'}
            sub={(poItemsToday || []).length > 0 ? 'Today' : 'No POs raised today'}
            icon={ClipboardCheck} iconBg="#FEF3C7" iconColor="#D97706"
          />
          <CompactKPICard
            label="QC Pass %" value={qcPassRate !== null ? `${qcPassRate}%` : '—'} sub={qcTotal > 0 ? `${qcAccepted}/${qcTotal} accepted` : 'No inspections this month'}
            icon={CheckCircle2} iconBg="#DCFCE7" iconColor="#16A34A"
          />
          <CompactKPICard
            label="Inventory Accuracy %" value="—" sub="No stocktake source configured"
            icon={Gauge} iconBg="#F3F4F6" iconColor="#9CA3AF" notAvailable
          />
          <CompactKPICard
            label="Hub Distribution" value={hubDistribution[0]?.name ?? '—'}
            sub={hubDistributionTotal > 0 ? `${Math.round((hubDistribution[0]?.count / hubDistributionTotal) * 100)}% of orders` : 'No orders this month'}
            icon={Building2} iconBg="#EEF2FF" iconColor="#4F46E5"
          />
          <CompactKPICard
            label="Packing Completion %" value={packingCompletion !== null ? `${packingCompletion}%` : '—'} sub={packsTotal > 0 ? `${packsDone}/${packsTotal} packs` : 'No packs this month'}
            icon={PackageCheck} iconBg="#F0FDFA" iconColor="#0D9488"
          />
          <CompactKPICard
            label="Dispatch Completion %" value={dispatchCompletion !== null ? `${dispatchCompletion}%` : '—'} sub={boxesTotal > 0 ? `${boxesDone}/${boxesTotal} boxes` : 'No boxes this month'}
            icon={Truck} iconBg="#EEF2FF" iconColor="#4F46E5"
          />
          <CompactKPICard
            label="On-Time Delivery %" value={onTimeDeliveryRate !== null ? `${onTimeDeliveryRate}%` : '—'}
            sub={otdEligible.length > 0 ? `${otdOnTime}/${otdEligible.length} on time` : 'No dated deliveries this month'}
            icon={Timer} iconBg="#FFF7ED" iconColor="#EA580C"
          />
          <CompactKPICard
            label="SO Clearance %" value={soClearanceRate !== null ? `${soClearanceRate}%` : '—'} sub={`${soCleared}/${soClearanceTotal} cleared`}
            icon={ListChecks} iconBg="#DCFCE7" iconColor="#16A34A"
          />
          <CompactKPICard
            label="Outstanding / Collection"
            value={(customersBalance || []).length > 0 ? `₹${(totalOutstanding / 1000).toFixed(0)}k` : '—'}
            sub={(customersBalance || []).length > 0 ? 'All customers' : 'No customer records found'}
            icon={Wallet} iconBg="#FEF2F2" iconColor="#DC2626"
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          label="Sales Revenue (MTD)"
          value={`₹${Number(totalSales).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          sub={`${(salesData || []).length} orders`}
          icon={TrendingUp}
          iconBg="#DCFCE7" iconColor="#16A34A"
        />
        <KPICard
          label="Purchase Spend (MTD)"
          value={`₹${Number(totalPO).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          sub={`${(poData || []).length} POs`}
          icon={ShoppingCart}
          iconBg="#EFF6FF" iconColor="#2563EB"
        />
        <KPICard
          label="Payments Pending Approval"
          value={pendingVP + pendingTP}
          sub={`${pendingVP} vendor · ${pendingTP} transport`}
          icon={Clock}
          iconBg="#FEF3C7" iconColor="#D97706"
        />
        <KPICard
          label="Team Task Completion"
          value={taskTotal > 0 ? `${Math.round(taskComplete / taskTotal * 100)}%` : '—'}
          sub={`${taskComplete}/${taskTotal} completed today`}
          icon={Users}
          iconBg="#F5F3FF" iconColor="#7C3AED"
        />
      </div>

      {/* Payment pipelines */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Banknote className="w-4 h-4 text-blue-500" /> Vendor Payment Pipeline
          </h2>
          <PaymentPipelineBar label="" counts={vpCounts} />
          <div className="mt-3 pt-3 border-t border-gray-50 flex justify-between text-xs text-gray-500">
            <span>Total awaiting CEO: <b className="text-orange-600">{vpCounts['pending_ceo'] || 0}</b></span>
            <span>Paid MTD: <b className="text-green-600">{vpCounts['paid'] || 0}</b></span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Truck className="w-4 h-4 text-orange-500" /> Transport Payment Pipeline
          </h2>
          <PaymentPipelineBar label="" counts={tpCounts} />
          <div className="mt-3 pt-3 border-t border-gray-50 flex justify-between text-xs text-gray-500">
            <span>Total awaiting CEO: <b className="text-orange-600">{tpCounts['pending_ceo'] || 0}</b></span>
            <span>Paid MTD: <b className="text-green-600">{tpCounts['paid'] || 0}</b></span>
          </div>
        </div>
      </div>

      {/* Sales order channel breakdown */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Order Source Breakdown</h2>
          {['manual','app','website','bulk_upload'].map(src => {
            const srcOrders = (salesData || []).filter(o => o.source === src);
            const pct = (salesData || []).length > 0 ? srcOrders.length / (salesData || []).length : 0;
            const labels: Record<string,string> = { manual:'Manual', app:'Mobile App', website:'Website', bulk_upload:'Bulk Upload' };
            const colors: Record<string,string> = { manual:'bg-gray-400', app:'bg-blue-500', website:'bg-purple-500', bulk_upload:'bg-amber-500' };
            return (
              <div key={src} className="flex items-center gap-3 mb-2.5">
                <div className={`w-2 h-2 rounded-full shrink-0 ${colors[src]}`} />
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-gray-600">{labels[src]}</span>
                    <span className="font-medium text-gray-800">{srcOrders.length}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${colors[src]}`} style={{ width: `${pct * 100}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Field Team Performance (MTD)</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Tasks Assigned</span>
              <span className="font-semibold text-gray-800">{taskTotal}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Completed</span>
              <span className="font-semibold text-green-600">{taskComplete}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Orders Delivered / Target</span>
              <span className="font-semibold text-gray-800">{taskOrdersDone} / {taskOrdersTarget}</span>
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Order fulfilment rate</span>
                <span>{taskOrdersTarget > 0 ? Math.round(taskOrdersDone / taskOrdersTarget * 100) : 0}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-blue-500 transition-all"
                  style={{ width: `${taskOrdersTarget > 0 ? Math.min(taskOrdersDone / taskOrdersTarget * 100, 100) : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
