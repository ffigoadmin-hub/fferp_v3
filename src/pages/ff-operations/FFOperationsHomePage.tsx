// @ts-nocheck
import { useState } from 'react';
import {
  ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, ShoppingCart,
  Warehouse, PhoneCall, Truck, Store, FileBarChart, Package,
  ChevronRight, AlertCircle, CheckCircle2, Clock, BarChart3,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, Legend,
} from 'recharts';

const cashFlowData = [
  { month: 'Apr', income: 0, expense: 0, cash: 0 },
  { month: 'May', income: 0, expense: 0, cash: 0 },
  { month: 'Jun', income: 0, expense: 0, cash: 0 },
  { month: 'Jul', income: 0, expense: 0, cash: 0 },
  { month: 'Aug', income: 0, expense: 0, cash: 0 },
  { month: 'Sep', income: 0, expense: 0, cash: 0 },
];

const kpis = [
  { label: 'Total Receivables',  value: '₹0.00', sub: 'Unpaid invoices',  icon: ArrowUpRight,   iconBg: '#DCFCE7', iconColor: '#16A34A' },
  { label: 'Total Payables',     value: '₹0.00', sub: 'Unpaid bills',     icon: ArrowDownRight, iconBg: '#FEE2E2', iconColor: '#DC2626' },
  { label: 'Cash on Hand',       value: '₹0.00', sub: 'Current balance',  icon: Wallet,         iconBg: '#EFF6FF', iconColor: '#2563EB' },
  { label: 'Net Profit (MTD)',   value: '₹0.00', sub: 'Month to date',    icon: TrendingUp,     iconBg: '#FEF3C7', iconColor: '#D97706' },
];

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

const recentActivity = [
  { type: 'info',    text: 'No recent purchase orders',       time: 'Now' },
  { type: 'info',    text: 'No pending QC inspections',       time: 'Now' },
  { type: 'info',    text: 'No open sales orders',            time: 'Now' },
  { type: 'info',    text: 'No logistics trips scheduled',    time: 'Now' },
];

export default function FFOperationsHomePage() {
  const [cashView, setCashView] = useState<'flow' | 'income'>('flow');

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
                <p className="text-[22px] font-bold mt-0.5" style={{ color: '#111827' }}>{k.value}</p>
                <p className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>{k.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Cash Flow */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid #F3F4F6' }}>
            <span className="text-[14px] font-bold" style={{ color: '#111827' }}>Cash Flow</span>
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
              {(['flow', 'income'] as const).map(v => (
                <button key={v} onClick={() => setCashView(v)}
                  className="px-3 py-1 text-[11px] font-semibold transition-all"
                  style={{
                    background: cashView === v ? '#2563EB' : '#FFFFFF',
                    color: cashView === v ? '#FFFFFF' : '#6B7280',
                  }}>
                  {v === 'flow' ? 'Cash Flow' : 'Income/Exp'}
                </button>
              ))}
            </div>
          </div>
          <div className="p-5">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                {cashView === 'flow' ? (
                  <LineChart data={cashFlowData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={v => v === 0 ? '0' : `${v/1000}K`} />
                    <Tooltip formatter={(v) => `₹${Number(v).toLocaleString('en-IN')}`} contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }} />
                    <Line type="monotone" dataKey="cash" stroke="#2563EB" strokeWidth={2} dot={false} name="Cash" />
                  </LineChart>
                ) : (
                  <BarChart data={cashFlowData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={v => v === 0 ? '0' : `${v/1000}K`} />
                    <Tooltip formatter={(v) => `₹${Number(v).toLocaleString('en-IN')}`} contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }} />
                    <Bar dataKey="income" fill="#2563EB" radius={[4,4,0,0]} name="Income" />
                    <Bar dataKey="expense" fill="#FCA5A5" radius={[4,4,0,0]} name="Expense" />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { label: 'Opening Cash', value: '₹0.00', dot: '#9CA3AF' },
                { label: 'Total Income',  value: '₹0.00', dot: '#2DD482' },
                { label: 'Total Expense', value: '₹0.00', dot: '#F46A6A' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-0.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: s.dot }} />
                    <span className="text-[10px]" style={{ color: '#9CA3AF' }}>{s.label}</span>
                  </div>
                  <p className="text-[13px] font-semibold" style={{ color: '#111827' }}>{s.value}</p>
                </div>
              ))}
            </div>
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
          { label: 'Total Receivables', sub: 'Amounts owed to us', current: '₹0.00', overdue: '₹0.00', color: '#16A34A', bg: '#DCFCE7', border: '#BBF7D0' },
          { label: 'Total Payables',    sub: 'Amounts we owe',     current: '₹0.00', overdue: '₹0.00', color: '#DC2626', bg: '#FEE2E2', border: '#FECACA' },
        ].map(card => (
          <div key={card.label} className="rounded-2xl p-5"
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[13px] font-semibold" style={{ color: '#374151' }}>{card.label}</p>
                <p className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>{card.sub}</p>
              </div>
              <span className="text-[22px] font-bold" style={{ color: '#111827' }}>₹0.00</span>
            </div>
            <div className="w-full rounded-full h-1.5 mb-4" style={{ background: '#F3F4F6' }}>
              <div className="h-1.5 rounded-full w-0" style={{ background: card.color }} />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: '#2563EB' }} />
                <span className="text-[11px]" style={{ color: '#6B7280' }}>Current: <span className="font-semibold text-gray-800">{card.current}</span></span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: '#F97316' }} />
                <span className="text-[11px]" style={{ color: '#6B7280' }}>Overdue: <span className="font-semibold text-gray-800">{card.overdue}</span></span>
              </div>
            </div>
          </div>
        ))}
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
          {recentActivity.map((a, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: '#F1F5F9' }}>
                <AlertCircle className="w-3.5 h-3.5" style={{ color: '#94A3B8' }} />
              </div>
              <p className="flex-1 text-[13px]" style={{ color: '#374151' }}>{a.text}</p>
              <span className="text-[11px]" style={{ color: '#9CA3AF' }}>{a.time}</span>
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
