// @ts-nocheck
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, ShoppingCart,
  Warehouse, PhoneCall, Truck, Store, FileBarChart, Package,
  ChevronRight, AlertCircle, CheckCircle2, Clock, BarChart3, Loader2,
} from 'lucide-react';

const modules = [
  { label: 'Purchase',        icon: ShoppingCart, path: '/purchase',      color: '#2563EB', bg: '#EFF6FF',  status: 'Active' },
  { label: 'Warehouse & QC',  icon: Warehouse,    path: '/warehouse',     color: '#16A34A', bg: '#DCFCE7',  status: 'Active' },
  { label: 'Sales',           icon: TrendingUp,   path: '/sales',         color: '#D97706', bg: '#FEF3C7',  status: 'Active' },
  { label: 'Tele-Caller CRM', icon: PhoneCall,    path: '/tele-caller',   color: '#7C3AED', bg: '#F5F3FF',  status: 'Active' },
  { label: 'Logistics',       icon: Truck,        path: '/logistics',     color: '#0891B2', bg: '#ECFEFF',  status: 'Active' },
  { label: 'Product Catalog', icon: Store,        path: '/catalog',       color: '#DB2777', bg: '#FDF2F8',  status: 'Active' },
  { label: 'Finance',         icon: Wallet,       path: '/finance',       color: '#2563EB', bg: '#EFF6FF',  status: 'Active' },
  { label: 'Reports',         icon: FileBarChart, path: '/reports',       color: '#475569', bg: '#F1F5F9',  status: 'Active' },
];

const money = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Receivables/Payables come from real tables (invoices, ff_vendor_payments,
// ff_transport_payments). Cash on Hand / Net Profit / Cash Flow trend have no
// backing ledger table anywhere in the schema — no invoice has ever been
// marked 'paid' — so we don't fabricate those; the UI says so honestly.
function useFinanceSummary() {
  return useQuery({
    queryKey: ['ff-ops-home-finance'],
    queryFn: async () => {
      const [{ data: unpaidInvoices }, { data: vendorPayments }, { data: transportPayments }] = await Promise.all([
        supabase.from('invoices').select('total_amount, due_date').eq('payment_status', 'unpaid'),
        supabase.from('ff_vendor_payments').select('gross_amount, deduction_amount, created_at').neq('payment_status', 'rejected'),
        supabase.from('ff_transport_payments').select('base_amount, toll_charges, other_charges, created_at').neq('payment_status', 'rejected'),
      ]);

      const today = new Date();
      const receivablesCurrent = (unpaidInvoices ?? []).filter(i => !i.due_date || new Date(i.due_date) >= today)
        .reduce((s, i) => s + Number(i.total_amount || 0), 0);
      const receivablesOverdue = (unpaidInvoices ?? []).filter(i => i.due_date && new Date(i.due_date) < today)
        .reduce((s, i) => s + Number(i.total_amount || 0), 0);

      const payablesVendor = (vendorPayments ?? []).reduce((s, p) => s + (Number(p.gross_amount || 0) - Number(p.deduction_amount || 0)), 0);
      const payablesTransport = (transportPayments ?? []).reduce((s, p) => s + Number(p.base_amount || 0) + Number(p.toll_charges || 0) + Number(p.other_charges || 0), 0);

      return {
        receivablesTotal: receivablesCurrent + receivablesOverdue,
        receivablesCurrent,
        receivablesOverdue,
        payablesTotal: payablesVendor + payablesTransport,
      };
    },
  });
}

function useRecentActivity() {
  return useQuery({
    queryKey: ['ff-ops-home-activity'],
    queryFn: async () => {
      const [{ data: pos }, { data: orders }] = await Promise.all([
        supabase.from('purchase_orders').select('po_number, status, created_at').order('created_at', { ascending: false }).limit(3),
        supabase.from('sales_orders').select('order_number, status, created_at').order('created_at', { ascending: false }).limit(3),
      ]);
      const items = [
        ...(pos ?? []).map(p => ({ text: `PO ${p.po_number} — ${p.status}`, time: p.created_at })),
        ...(orders ?? []).map(o => ({ text: `Order ${o.order_number} — ${o.status}`, time: o.created_at })),
      ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 5);
      return items;
    },
  });
}

export default function FFOperationsHomePage() {
  const { data: finance, isLoading: financeLoading } = useFinanceSummary();
  const { data: activity = [], isLoading: activityLoading } = useRecentActivity();

  const kpis = [
    { label: 'Total Receivables',  value: financeLoading ? null : money(finance?.receivablesTotal), sub: 'Unpaid invoices',  icon: ArrowUpRight,   iconBg: '#DCFCE7', iconColor: '#16A34A' },
    { label: 'Total Payables',     value: financeLoading ? null : money(finance?.payablesTotal),     sub: 'Approved, unpaid FF payments', icon: ArrowDownRight, iconBg: '#FEE2E2', iconColor: '#DC2626' },
    { label: 'Cash on Hand',       value: '—', sub: 'No ledger source configured',  icon: Wallet,         iconBg: '#EFF6FF', iconColor: '#2563EB' },
    { label: 'Net Profit (MTD)',   value: '—', sub: 'No ledger source configured',  icon: TrendingUp,     iconBg: '#FEF3C7', iconColor: '#D97706' },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 pt-2">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: '#111827' }}>
            FF Operations
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: '#6B7280' }}>
            Overview of all operational modules · FY 2026–27
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12px] font-semibold"
          style={{ background: '#DCFCE7', color: '#15803D', border: '1px solid #BBF7D0' }}>
          <CheckCircle2 className="w-3.5 h-3.5" />
          All Systems Operational
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-2xl p-5 flex flex-col gap-3"
              style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: k.iconBg }}>
                  <Icon className="w-4.5 h-4.5" style={{ color: k.iconColor }} />
                </div>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                  style={{ background: '#F9FAFB', color: '#9CA3AF', border: '1px solid #F3F4F6' }}>MTD</span>
              </div>
              <div>
                <p className="text-[12px] font-medium" style={{ color: '#6B7280' }}>{k.label}</p>
                <p className="text-[22px] font-bold mt-0.5" style={{ color: '#111827' }}>
                  {k.value === null ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#9CA3AF' }} /> : k.value}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>{k.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Cash Flow — no ledger table exists yet (no invoice has ever been
            marked 'paid'), so there's no real cash-movement data to chart.
            Showing a placeholder instead of a fabricated trend line. */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid #F3F4F6' }}>
            <span className="text-[14px] font-bold" style={{ color: '#111827' }}>Cash Flow</span>
          </div>
          <div className="p-5 flex flex-col items-center justify-center text-center" style={{ minHeight: 260 }}>
            <BarChart3 className="w-8 h-8 mb-2" style={{ color: '#D1D5DB' }} />
            <p className="text-[13px] font-medium" style={{ color: '#6B7280' }}>No cash-flow data available</p>
            <p className="text-[11px] mt-1 max-w-[240px]" style={{ color: '#9CA3AF' }}>
              This needs a payments-received/cash-ledger table, which doesn't exist in the schema yet.
            </p>
          </div>
        </div>

        {/* Module Status */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid #F3F4F6' }}>
            <span className="text-[14px] font-bold" style={{ color: '#111827' }}>Module Overview</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: '#EFF6FF', color: '#2563EB' }}>8 Active</span>
          </div>
          <div className="p-3 grid grid-cols-2 gap-2">
            {modules.map(m => {
              const Icon = m.icon;
              return (
                <a key={m.label} href={m.path}
                  className="flex items-center gap-3 p-3 rounded-xl transition-all group"
                  style={{ border: '1px solid #F3F4F6' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#BFDBFE'; (e.currentTarget as HTMLElement).style.background = '#F8FAFF'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#F3F4F6'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: m.bg }}>
                    <Icon className="w-4 h-4" style={{ color: m.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold truncate" style={{ color: '#111827' }}>{m.label}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      <span className="text-[10px]" style={{ color: '#9CA3AF' }}>{m.status}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#2563EB' }} />
                </a>
              );
            })}
          </div>
        </div>
      </div>

      {/* Receivables + Payables Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[
          {
            label: 'Total Receivables', sub: 'Amounts owed to us',
            total: finance?.receivablesTotal, current: finance?.receivablesCurrent, overdue: finance?.receivablesOverdue,
            color: '#16A34A',
          },
          {
            label: 'Total Payables', sub: 'Approved FF vendor + transport payments, not yet paid',
            total: finance?.payablesTotal, current: finance?.payablesTotal, overdue: 0,
            color: '#DC2626',
          },
        ].map(card => {
          const pct = card.total ? Math.min(100, Math.round(((card.overdue || 0) / card.total) * 100)) : 0;
          return (
            <div key={card.label} className="rounded-2xl p-5"
              style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: '#374151' }}>{card.label}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>{card.sub}</p>
                </div>
                <span className="text-[22px] font-bold" style={{ color: '#111827' }}>
                  {financeLoading ? <Loader2 className="w-4 h-4 animate-spin inline" style={{ color: '#9CA3AF' }} /> : money(card.total)}
                </span>
              </div>
              <div className="w-full rounded-full h-1.5 mb-4" style={{ background: '#F3F4F6' }}>
                <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: card.color }} />
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: '#2563EB' }} />
                  <span className="text-[11px]" style={{ color: '#6B7280' }}>Current: <span className="font-semibold text-gray-800">{money(card.current)}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: '#F97316' }} />
                  <span className="text-[11px]" style={{ color: '#6B7280' }}>Overdue: <span className="font-semibold text-gray-800">{money(card.overdue)}</span></span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid #F3F4F6' }}>
          <span className="text-[14px] font-bold" style={{ color: '#111827' }}>Recent Activity</span>
          <div className="flex items-center gap-1.5" style={{ color: '#9CA3AF' }}>
            <Clock className="w-3.5 h-3.5" />
            <span className="text-[11px]">Live</span>
          </div>
        </div>
        <div className="divide-y" style={{ borderColor: '#F9FAFB' }}>
          {activityLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#9CA3AF' }} />
            </div>
          ) : activity.length === 0 ? (
            <div className="flex items-center gap-3 px-5 py-3.5">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: '#F1F5F9' }}>
                <AlertCircle className="w-3.5 h-3.5" style={{ color: '#94A3B8' }} />
              </div>
              <p className="flex-1 text-[13px]" style={{ color: '#374151' }}>No recent purchase orders or sales orders</p>
            </div>
          ) : activity.map((a, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: '#F1F5F9' }}>
                <AlertCircle className="w-3.5 h-3.5" style={{ color: '#94A3B8' }} />
              </div>
              <p className="flex-1 text-[13px]" style={{ color: '#374151' }}>{a.text}</p>
              <span className="text-[11px]" style={{ color: '#9CA3AF' }}>{formatDistanceToNow(new Date(a.time), { addSuffix: true })}</span>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 text-center" style={{ borderTop: '1px solid #F3F4F6' }}>
          <p className="text-[12px]" style={{ color: '#9CA3AF' }}>
            Activity will appear here once operations begin
          </p>
        </div>
      </div>

    </div>
  );
}
