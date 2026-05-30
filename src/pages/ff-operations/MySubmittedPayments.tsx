// @ts-nocheck
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { Banknote, Truck, ChevronDown, ChevronUp, RefreshCw, Clock, CheckCircle2, XCircle } from 'lucide-react';

// ── Status config ──────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  pending_ff_ops:   'bg-amber-100 text-amber-700 border-amber-200',
  pending_gm:       'bg-blue-100 text-blue-700 border-blue-200',
  pending_l1:       'bg-purple-100 text-purple-700 border-purple-200',
  pending_auditor:  'bg-cyan-100 text-cyan-700 border-cyan-200',
  pending_ceo:      'bg-orange-100 text-orange-700 border-orange-200',
  approved:         'bg-teal-100 text-teal-700 border-teal-200',
  paid:             'bg-green-100 text-green-700 border-green-200',
  rejected:         'bg-red-100 text-red-700 border-red-200',
};

const STATUS_LABELS: Record<string, string> = {
  pending_ff_ops:  'Pending FF Ops',
  pending_gm:      'Pending GM',
  pending_l1:      'Pending L1',
  pending_auditor: 'Pending Auditor',
  pending_ceo:     'Pending CEO',
  approved:        'Approved — Awaiting Payment',
  paid:            'Paid',
  rejected:        'Rejected',
};

const APPROVAL_CHAIN = [
  'pending_ff_ops', 'pending_gm', 'pending_l1', 'pending_auditor', 'pending_ceo', 'approved',
];

function ApprovalTimeline({ status }: { status: string }) {
  const steps = [
    { key: 'pending_ff_ops',   label: 'FF Ops' },
    { key: 'pending_gm',       label: 'GM' },
    { key: 'pending_l1',       label: 'L1' },
    { key: 'pending_auditor',  label: 'Auditor' },
    { key: 'pending_ceo',      label: 'CEO' },
    { key: 'approved',         label: 'Approved' },
  ];
  const idx = APPROVAL_CHAIN.indexOf(status);
  if (status === 'paid')     return <div className="flex items-center gap-1.5 text-xs font-semibold text-green-600"><CheckCircle2 className="w-3.5 h-3.5" /> Fully Paid</div>;
  if (status === 'rejected') return <div className="flex items-center gap-1.5 text-xs font-semibold text-red-500"><XCircle className="w-3.5 h-3.5" /> Rejected</div>;
  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center gap-0.5">
          <div className="flex flex-col items-center">
            <div className={`h-2.5 w-2.5 rounded-full transition-colors ${
              i < idx  ? 'bg-green-500' :
              i === idx ? 'bg-blue-500 ring-2 ring-blue-200' :
              'bg-gray-200'
            }`} />
            <span className={`text-[9px] mt-0.5 whitespace-nowrap ${i === idx ? 'text-blue-600 font-semibold' : i < idx ? 'text-green-600' : 'text-gray-400'}`}>
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-0.5 w-4 mb-3 ${i < idx ? 'bg-green-400' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function PaymentRow({ payment, type }: { payment: any; type: 'vendor' | 'transport' }) {
  const [expanded, setExpanded] = useState(false);

  const amount = type === 'vendor'
    ? (payment.net_amount ?? payment.gross_amount)
    : payment.total_amount;

  const title = type === 'vendor'
    ? (payment.vendors?.name || 'Vendor Payment')
    : `Vehicle: ${payment.vehicle_number || '—'}`;

  const subtitle = type === 'vendor'
    ? `Hub: ${payment.hubs?.name || '—'} · PO ref`
    : `${payment.origin || '—'} → ${payment.destination || '—'} · ${payment.hubs?.name || '—'}`;

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg shrink-0 ${type === 'vendor' ? 'bg-blue-50' : 'bg-orange-50'}`}>
              {type === 'vendor'
                ? <Banknote className="w-4 h-4 text-blue-600" />
                : <Truck className="w-4 h-4 text-orange-600" />
              }
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-800">{title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{format(new Date(payment.created_at), 'dd MMM yyyy, h:mm a')}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <p className="text-base font-bold text-gray-900">
              ₹{Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[payment.payment_status] || 'bg-gray-100 text-gray-600'}`}>
              {STATUS_LABELS[payment.payment_status] || payment.payment_status}
            </span>
            <button
              onClick={() => setExpanded(v => !v)}
              className="mt-1 p-1 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 transition"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Approval timeline */}
        {!['paid', 'rejected'].includes(payment.payment_status) && (
          <div className="mt-3 pt-3 border-t border-gray-50">
            <ApprovalTimeline status={payment.payment_status} />
          </div>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50/40 space-y-2 pt-3">
          {type === 'vendor' && (
            <>
              <div className="flex gap-4 text-xs text-gray-600">
                <span><b>Gross:</b> ₹{Number(payment.gross_amount || 0).toLocaleString('en-IN')}</span>
                <span><b>Deduction:</b> ₹{Number(payment.deduction_amount || 0).toLocaleString('en-IN')}</span>
                <span className="font-semibold text-gray-800"><b>Net:</b> ₹{Number(payment.net_amount || 0).toLocaleString('en-IN')}</span>
              </div>
              {payment.bill_url && (
                <a href={payment.bill_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-600 underline">📎 View Bill</a>
              )}
            </>
          )}
          {type === 'transport' && (
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div><b>Trip Date:</b> {payment.trip_date ? format(new Date(payment.trip_date), 'dd MMM yyyy') : '—'}</div>
              <div><b>KM:</b> {payment.km_covered ?? '—'} km</div>
              <div><b>Base:</b> ₹{Number(payment.base_amount || 0).toLocaleString('en-IN')}</div>
              <div><b>Toll:</b> ₹{Number(payment.toll_charges || 0).toLocaleString('en-IN')}</div>
              <div><b>Other:</b> ₹{Number(payment.other_charges || 0).toLocaleString('en-IN')}</div>
              <div className="font-semibold text-gray-800"><b>Total:</b> ₹{Number(payment.total_amount || 0).toLocaleString('en-IN')}</div>
            </div>
          )}
          {/* Approval timestamps */}
          <div className="space-y-0.5 mt-2">
            {payment.ff_ops_approved_at && <p className="text-[11px] text-gray-500">✓ FF Ops approved: {format(new Date(payment.ff_ops_approved_at), 'dd MMM, h:mm a')}</p>}
            {payment.gm_approved_at      && <p className="text-[11px] text-gray-500">✓ GM approved: {format(new Date(payment.gm_approved_at), 'dd MMM, h:mm a')}</p>}
            {payment.l1_approved_at      && <p className="text-[11px] text-gray-500">✓ L1 approved: {format(new Date(payment.l1_approved_at), 'dd MMM, h:mm a')}</p>}
            {payment.auditor_approved_at && <p className="text-[11px] text-gray-500">✓ Auditor approved: {format(new Date(payment.auditor_approved_at), 'dd MMM, h:mm a')}</p>}
            {payment.ceo_approved_at     && <p className="text-[11px] text-gray-500">✓ CEO approved: {format(new Date(payment.ceo_approved_at), 'dd MMM, h:mm a')}</p>}
            {payment.payment_status === 'paid' && payment.paid_at && (
              <p className="text-[11px] text-green-600 font-medium">
                ✓ Paid on {format(new Date(payment.paid_at), 'dd MMM yyyy, h:mm a')}
                {payment.utr_number && ` · UTR: ${payment.utr_number}`}
              </p>
            )}
            {payment.payment_status === 'rejected' && payment.rejection_reason && (
              <p className="text-[11px] text-red-500">✗ Rejected: {payment.rejection_reason}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function MySubmittedPayments() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'vendor' | 'transport'>('vendor');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const userId = user?.id;

  const { data: vendorPayments = [], isLoading: vLoading, refetch: vRefetch } = useQuery({
    queryKey: ['my-vendor-payments', userId, statusFilter],
    queryFn: async () => {
      if (!userId) return [];
      let q = (supabase as any)
        .from('ff_vendor_payments')
        .select(`*, vendors(name), hubs(name)`)
        .eq('created_by', userId)
        .order('created_at', { ascending: false });
      if (statusFilter !== 'all') q = q.eq('payment_status', statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: transportPayments = [], isLoading: tLoading, refetch: tRefetch } = useQuery({
    queryKey: ['my-transport-payments', userId, statusFilter],
    queryFn: async () => {
      if (!userId) return [];
      let q = (supabase as any)
        .from('ff_transport_payments')
        .select(`*, hubs(name)`)
        .eq('created_by', userId)
        .order('created_at', { ascending: false });
      if (statusFilter !== 'all') q = q.eq('payment_status', statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const payments = tab === 'vendor' ? vendorPayments : transportPayments;
  const isLoading = tab === 'vendor' ? vLoading : tLoading;
  const refetch   = tab === 'vendor' ? vRefetch  : tRefetch;

  // KPI counts
  const vendorCounts = {
    total:    vendorPayments.length,
    pending:  vendorPayments.filter((p: any) => p.payment_status.startsWith('pending')).length,
    approved: vendorPayments.filter((p: any) => p.payment_status === 'approved').length,
    paid:     vendorPayments.filter((p: any) => p.payment_status === 'paid').length,
    rejected: vendorPayments.filter((p: any) => p.payment_status === 'rejected').length,
  };
  const transportCounts = {
    total:    transportPayments.length,
    pending:  transportPayments.filter((p: any) => p.payment_status.startsWith('pending')).length,
    approved: transportPayments.filter((p: any) => p.payment_status === 'approved').length,
    paid:     transportPayments.filter((p: any) => p.payment_status === 'paid').length,
    rejected: transportPayments.filter((p: any) => p.payment_status === 'rejected').length,
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Submitted Payments</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track FF vendor & transport payments you submitted</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total',    value: tab === 'vendor' ? vendorCounts.total    : transportCounts.total,    color: 'text-gray-800',  bg: 'bg-white' },
          { label: 'Pending',  value: tab === 'vendor' ? vendorCounts.pending  : transportCounts.pending,  color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Approved', value: tab === 'vendor' ? vendorCounts.approved : transportCounts.approved, color: 'text-teal-700',  bg: 'bg-teal-50' },
          { label: 'Paid',     value: tab === 'vendor' ? vendorCounts.paid     : transportCounts.paid,     color: 'text-green-700', bg: 'bg-green-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl border border-gray-100 p-3 shadow-sm`}>
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs + Filter row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex gap-2">
          {(['vendor', 'transport'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === t
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {t === 'vendor' ? <Banknote className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
              {t === 'vendor' ? 'Vendor Payments' : 'Transport Payments'}
              <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                tab === t ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
              }`}>
                {t === 'vendor' ? vendorCounts.total : transportCounts.total}
              </span>
            </button>
          ))}
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="all">All Status</option>
          <option value="pending_ff_ops">Pending FF Ops</option>
          <option value="pending_gm">Pending GM</option>
          <option value="pending_l1">Pending L1</option>
          <option value="pending_auditor">Pending Auditor</option>
          <option value="pending_ceo">Pending CEO</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Payment list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Clock className="w-5 h-5 animate-spin mr-2" /> Loading...
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">{tab === 'vendor' ? '🏦' : '🚛'}</div>
          <p className="text-gray-500 font-medium">No {tab} payments found</p>
          <p className="text-gray-400 text-sm mt-1">
            {statusFilter === 'all'
              ? "You haven't submitted any payments yet."
              : `No payments with status "${STATUS_LABELS[statusFilter] || statusFilter}".`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((payment: any) => (
            <PaymentRow key={payment.id} payment={payment} type={tab} />
          ))}
        </div>
      )}
    </div>
  );
}
