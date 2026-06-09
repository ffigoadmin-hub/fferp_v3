import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  CheckCircle2, XCircle, Clock, RefreshCw, ChevronDown,
  ChevronUp, CreditCard, AlertTriangle, Shield,
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; step: number }> = {
  pending_admin:    { label: 'Pending Admin',    color: 'bg-amber-100 text-amber-700',  step: 1 },
  pending_director: { label: 'Pending Director', color: 'bg-blue-100 text-blue-700',    step: 2 },
  approved:         { label: 'Approved',         color: 'bg-teal-100 text-teal-700',    step: 3 },
  rejected:         { label: 'Rejected',         color: 'bg-red-100 text-red-700',      step: 0 },
  processed:        { label: 'Processed',        color: 'bg-green-100 text-green-700',  step: 4 },
};

const PAYMENT_TYPE_LABEL: Record<string, string> = {
  advance:     'Advance',
  partial:     'Partial',
  full:        'Full Settlement',
  porter:      'Porter',
  credit_note: 'Credit Note',
};

// Progress steps indicator
function StatusFlow({ status }: { status: string }) {
  const steps = [
    { key: 'pending_admin',    label: 'Admin Review' },
    { key: 'pending_director', label: 'Director Review' },
    { key: 'approved',         label: 'Approved' },
    { key: 'processed',        label: 'Processed' },
  ];
  const current = STATUS_CONFIG[status]?.step ?? 0;

  if (status === 'rejected') {
    return <div className="text-xs text-red-600 font-medium flex items-center gap-1"><XCircle className="h-3.5 w-3.5" /> Rejected</div>;
  }

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center gap-1">
          <div className={`h-2 w-2 rounded-full ${i < current ? 'bg-green-500' : i === current - 1 ? 'bg-blue-500' : 'bg-gray-200'}`} />
          {i < steps.length - 1 && <div className={`h-0.5 w-4 ${i < current - 1 ? 'bg-green-500' : 'bg-gray-200'}`} />}
        </div>
      ))}
    </div>
  );
}

// Reject modal
function RejectModal({
  paymentId,
  onClose,
  onDone,
}: {
  paymentId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleReject = async () => {
    if (!reason.trim()) { toast.error('Enter a rejection reason'); return; }
    setSaving(true);
    const { error } = await supabase
      .from('vendor_payments')
      .update({ status: 'rejected', rejection_reason: reason })
      .eq('id', paymentId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Payment rejected');
    onDone();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-slate-800 mb-3">Reject Payment</h3>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          placeholder="Reason for rejection…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400 mb-4"
        />
        <div className="flex gap-2">
          <button
            onClick={handleReject}
            disabled={saving}
            className="flex-1 bg-red-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? 'Rejecting…' : 'Reject'}
          </button>
          <button onClick={onClose} className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm font-semibold text-slate-600 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentApprovalQueue() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const role = user?.role ?? '';

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [rejectModal, setRejectModal]   = useState<string | null>(null);

  // Determine what statuses this role can see and approve
  const canApproveAdmin    = ['admin', 'ff_operations_manager', 'purchase_head'].includes(role);
  const canApproveDirector = ['director', 'Director', 'ceo', 'gm'].includes(role);
  const canViewAll         = canApproveDirector || role === 'admin';

  // Filter tabs available
  const availableFilters = (() => {
    if (canApproveDirector) return ['all', 'pending_admin', 'pending_director', 'approved', 'processed', 'rejected'];
    if (canApproveAdmin)    return ['all', 'pending_admin', 'pending_director', 'approved', 'processed', 'rejected'];
    return ['all', 'pending_admin', 'approved', 'rejected', 'processed'];
  })();

  const { data: payments = [], isLoading, refetch } = useQuery({
    queryKey: ['payment-approval-queue', filterStatus, role],
    queryFn: async () => {
      let q = supabase
        .from('vendor_payments')
        .select(`
          id, payment_type, amount, deduction_total, net_amount,
          payment_method, payment_date, status, rejection_reason, notes,
          reference_no, created_at,
          vendor:vendors(id, name, account_number, bank_name, ifsc_code),
          po:purchase_orders(po_number),
          creator:profiles(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (filterStatus !== 'all') {
        q = q.eq('status', filterStatus);
      }

      const { data } = await q;
      return data ?? [];
    },
  });

  const approvePayment = useMutation({
    mutationFn: async (payment: any) => {
      const isAdminApproval    = payment.status === 'pending_admin'    && canApproveAdmin;
      const isDirectorApproval = payment.status === 'pending_director' && canApproveDirector;

      if (!isAdminApproval && !isDirectorApproval) {
        throw new Error('You are not authorized to approve this payment at this stage');
      }

      const update: Record<string, any> = {};

      if (isAdminApproval) {
        update.status                = 'pending_director';
        update.approved_by_admin     = user!.id;
        update.admin_approved_at     = new Date().toISOString();
      } else if (isDirectorApproval) {
        update.status                = 'approved';
        update.approved_by_director  = user!.id;
        update.director_approved_at  = new Date().toISOString();
      }

      const { error } = await supabase.from('vendor_payments').update(update).eq('id', payment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Payment approved ✓');
      queryClient.invalidateQueries({ queryKey: ['payment-approval-queue'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canApprove = (payment: any) => {
    if (payment.status === 'pending_admin'    && canApproveAdmin)    return true;
    if (payment.status === 'pending_director' && canApproveDirector) return true;
    return false;
  };

  const fmt = (n: number | null | undefined) =>
    n == null ? '—' : '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  const pendingCount = (payments as any[]).filter(p =>
    p.status === 'pending_admin' || p.status === 'pending_director'
  ).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 pt-4">

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 tracking-tight">Payment Approval Queue</h1>
          <p className="text-[13px] text-slate-500">
            {canApproveDirector ? 'Director approval level' : canApproveAdmin ? 'Admin approval level' : 'Viewing payments'} ·{' '}
            <span className="text-amber-600 font-medium">{pendingCount} awaiting action</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/purchase/payment-form" className="btn-zoho-primary text-sm">
            <CreditCard className="h-4 w-4" /> New Payment
          </Link>
          <button onClick={() => refetch()} className="btn-zoho-secondary px-3">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Role Notice */}
      {(canApproveAdmin || canApproveDirector) && (
        <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
          canApproveDirector ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'
        }`}>
          <Shield className={`h-5 w-5 ${canApproveDirector ? 'text-blue-500' : 'text-amber-500'}`} />
          <div>
            <p className={`text-sm font-semibold ${canApproveDirector ? 'text-blue-700' : 'text-amber-700'}`}>
              {canApproveDirector ? 'Director / CEO Level' : 'Admin Level'} — You can approve payments
            </p>
            <p className={`text-xs ${canApproveDirector ? 'text-blue-500' : 'text-amber-500'}`}>
              {canApproveDirector
                ? 'Approving moves status from "Pending Director" → "Approved"'
                : 'Approving moves status from "Pending Admin" → "Pending Director"'}
            </p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {availableFilters.map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${
              filterStatus === s
                ? 'bg-slate-800 text-white'
                : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
            }`}
          >
            {s === 'all' ? 'All' : STATUS_CONFIG[s]?.label ?? s}
          </button>
        ))}
      </div>

      {/* Payments List */}
      <div className="zoho-card">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : (payments as any[]).length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No payments found</p>
          </div>
        ) : (
          <div className="divide-y divide-[#E2E8F0]">
            {(payments as any[]).map((payment: any) => (
              <div key={payment.id}>
                {/* Row */}
                <div
                  className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === payment.id ? null : payment.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-slate-800 text-sm">{payment.vendor?.name ?? '—'}</span>
                      <span className="text-xs bg-gray-100 text-slate-500 px-2 py-0.5 rounded-full capitalize">
                        {PAYMENT_TYPE_LABEL[payment.payment_type] ?? payment.payment_type}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      {payment.po?.po_number && <span>PO: {payment.po.po_number}</span>}
                      <span>{format(new Date(payment.created_at), 'd MMM yyyy')}</span>
                      <StatusFlow status={payment.status} />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-800">{fmt(payment.net_amount ?? payment.amount)}</p>
                    {payment.deduction_total > 0 && (
                      <p className="text-xs text-red-500">-{fmt(payment.deduction_total)} deducted</p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_CONFIG[payment.status]?.color ?? 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_CONFIG[payment.status]?.label ?? payment.status}
                  </span>
                  {expandedId === payment.id
                    ? <ChevronUp className="h-4 w-4 text-gray-300" />
                    : <ChevronDown className="h-4 w-4 text-gray-300" />}
                </div>

                {/* Expanded */}
                {expandedId === payment.id && (
                  <div className="px-5 pb-5 bg-slate-50 border-t border-slate-100 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
                      {[
                        { label: 'Gross Amount',   value: fmt(payment.amount) },
                        { label: 'Deductions',     value: payment.deduction_total > 0 ? `- ${fmt(payment.deduction_total)}` : '—' },
                        { label: 'Net Payable',    value: fmt(payment.net_amount ?? payment.amount) },
                        { label: 'Method',         value: payment.payment_method?.replace('_', ' ') ?? '—' },
                        { label: 'Payment Date',   value: payment.payment_date ? format(new Date(payment.payment_date), 'dd MMM yyyy') : '—' },
                        { label: 'Reference No.',  value: payment.reference_no || '—' },
                        { label: 'Submitted By',   value: payment.creator?.full_name ?? '—' },
                        { label: 'Bank',           value: payment.vendor?.bank_name ?? '—' },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-white rounded-lg p-2.5">
                          <p className="text-[10px] text-gray-400">{label}</p>
                          <p className="text-sm font-semibold text-slate-700 mt-0.5">{value}</p>
                        </div>
                      ))}
                    </div>

                    {payment.notes && (
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-xs text-gray-400">Notes</p>
                        <p className="text-sm text-slate-700 mt-0.5">{payment.notes}</p>
                      </div>
                    )}

                    {payment.rejection_reason && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-red-600 flex items-center gap-1">
                          <XCircle className="h-3.5 w-3.5" /> Rejection Reason
                        </p>
                        <p className="text-sm text-red-700 mt-0.5">{payment.rejection_reason}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {canApprove(payment) && (
                      <div className="flex gap-3 pt-1">
                        <button
                          onClick={() => approvePayment.mutate(payment)}
                          disabled={approvePayment.isPending}
                          className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {payment.status === 'pending_admin' ? 'Approve (→ Director)' : 'Final Approve'}
                        </button>
                        <button
                          onClick={() => setRejectModal(payment.id)}
                          className="flex items-center gap-2 px-5 py-2.5 border border-red-300 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors"
                        >
                          <XCircle className="h-4 w-4" /> Reject
                        </button>
                      </div>
                    )}

                    {payment.status === 'approved' && (
                      <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-4 py-2.5">
                        <CheckCircle2 className="h-4 w-4 text-teal-600" />
                        <p className="text-sm text-teal-700 font-medium">
                          Approved — Awaiting Finance to process bank transfer
                        </p>
                        <Link to="/finance/process-payments" className="ml-auto text-xs text-teal-600 hover:underline whitespace-nowrap">
                          Process →
                        </Link>
                      </div>
                    )}

                    {payment.status === 'processed' && (
                      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <p className="text-sm text-green-700 font-medium">Payment Processed ✓</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectModal && (
        <RejectModal
          paymentId={rejectModal}
          onClose={() => setRejectModal(null)}
          onDone={() => queryClient.invalidateQueries({ queryKey: ['payment-approval-queue'] })}
        />
      )}
    </div>
  );
}
