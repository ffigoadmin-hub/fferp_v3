// @ts-nocheck
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import {
  TrendingUp, Banknote, Truck, ShoppingCart, Warehouse,
  Users, ArrowUpRight, ArrowDownRight, Clock, CheckCircle2,
  AlertCircle, BarChart3, Activity,
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
                height: `${Math.max((counts[s.key] || 0) * 6, counts[s.key] ? 4 : 0)}px`,
                minHeight: counts[s.key] ? '4px' : '0',
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
        .select('id, total_amount, status, source, created_at')
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd + 'T23:59:59');
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
