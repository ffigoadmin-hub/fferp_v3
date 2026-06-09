import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, RefreshCw, CreditCard, Download,
  Building2, ChevronDown, ChevronUp,
} from 'lucide-react';

// Modal: Enter UTR & confirm transfer
function ProcessModal({
  payment,
  onClose,
  onDone,
}: {
  payment: any;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [utr, setUtr]         = useState('');
  const [date, setDate]       = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving]   = useState(false);

  const handleProcess = async () => {
    if (!utr.trim()) { toast.error('Enter UTR / reference number'); return; }
    setSaving(true);
    const { error } = await supabase
      .from('vendor_payments')
      .update({
        status:        'processed',
        utr_reference: utr,
        processed_by:  user!.id,
        processed_at:  new Date().toISOString(),
      })
      .eq('id', payment.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Payment processed — UTR: ${utr}`);
    onDone();
    onClose();
  };

  const fmt = (n: number) => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-slate-800 text-lg mb-1">Confirm Bank Transfer</h3>
        <p className="text-xs text-slate-400 mb-4">Enter UTR after completing the transfer</p>

        {/* Payment summary */}
        <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Vendor</span>
            <span className="font-semibold text-slate-800">{payment.vendor?.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Bank</span>
            <span className="text-slate-700">{payment.vendor?.bank_name ?? '—'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Account</span>
            <span className="text-slate-700 font-mono text-xs">{payment.vendor?.account_number ?? '—'}</span>
          </div>
          <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2 mt-1">
            <span className="text-slate-700">Net Amount</span>
            <span className="text-green-700">{fmt(payment.net_amount ?? payment.amount)}</span>
          </div>
        </div>

        <div className="space-y-3 mb-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">UTR / Reference Number *</label>
            <input
              value={utr}
              onChange={e => setUtr(e.target.value)}
              placeholder="UTR123456789012"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Transfer Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleProcess}
            disabled={saving}
            className="flex-1 bg-green-600 text-white rounded-xl py-2.5 font-semibold text-sm hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <><RefreshCw className="h-4 w-4 animate-spin" /> Processing…</> : <><CheckCircle2 className="h-4 w-4" /> Mark Processed</>}
          </button>
          <button onClick={onClose} className="flex-1 border border-gray-300 rounded-xl py-2.5 font-semibold text-sm text-slate-600 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FinancePaymentProcessPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>('approved');
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [processModal, setProcessModal] = useState<any>(null);

  const { data: payments = [], isLoading, refetch } = useQuery({
    queryKey: ['finance-payments', filterStatus],
    queryFn: async () => {
      let q = supabase
        .from('vendor_payments')
        .select(`
          id, payment_type, amount, deduction_total, net_amount,
          payment_method, payment_date, status, utr_reference,
          reference_no, processed_at, created_at, notes,
          vendor:vendors(id, name, account_number, bank_name, ifsc_code, phone),
          po:purchase_orders(po_number),
          creator:profiles(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (filterStatus !== 'all') q = q.eq('status', filterStatus);
      const { data } = await q;
      return data ?? [];
    },
  });

  const fmt = (n: number | null | undefined) =>
    n == null ? '—' : '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  const totalApproved  = (payments as any[]).filter(p => p.status === 'approved')
    .reduce((s, p) => s + Number(p.net_amount ?? p.amount ?? 0), 0);
  const totalProcessed = (payments as any[]).filter(p => p.status === 'processed')
    .reduce((s, p) => s + Number(p.net_amount ?? p.amount ?? 0), 0);

  const PAYMENT_TYPE_LABEL: Record<string, string> = {
    advance: 'Advance', partial: 'Partial', full: 'Full',
    porter: 'Porter', credit_note: 'Credit Note',
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 pt-4">

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 tracking-tight">Finance — Payment Processing</h1>
          <p className="text-[13px] text-slate-500">Process approved payments & log UTR references</p>
        </div>
        <button onClick={() => refetch()} className="btn-zoho-secondary px-3">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-5">
        {[
          { label: 'Ready to Process', value: fmt(totalApproved),  icon: CreditCard,   color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Processed Today',  value: fmt(totalProcessed), icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 pt-5 pb-4">
            <div className={`p-2 ${card.bg} rounded-lg w-fit mb-2`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <p className="text-[13px] text-slate-500 font-medium mb-1">{card.label}</p>
            <p className="text-[20px] font-bold text-slate-800">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'approved',  label: 'Ready to Process' },
          { key: 'processed', label: 'Processed' },
          { key: 'all',       label: 'All' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterStatus === tab.key ? 'bg-slate-800 text-white' : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Payments */}
      <div className="zoho-card">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : (payments as any[]).length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">
              {filterStatus === 'approved' ? 'No payments ready to process' : 'No payments found'}
            </p>
            <Link to="/purchase/payment-approvals" className="mt-2 inline-block text-xs text-blue-600 hover:underline">
              View Approval Queue →
            </Link>
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
                      <span className="text-xs bg-gray-100 text-slate-500 px-2 py-0.5 rounded-full">
                        {PAYMENT_TYPE_LABEL[payment.payment_type] ?? payment.payment_type}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      {payment.po?.po_number && <span>PO: {payment.po.po_number}</span>}
                      <span>{format(new Date(payment.created_at), 'd MMM yyyy')}</span>
                      {payment.utr_reference && (
                        <span className="text-green-600 font-medium">UTR: {payment.utr_reference}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-800">{fmt(payment.net_amount ?? payment.amount)}</p>
                    {payment.deduction_total > 0 && (
                      <p className="text-xs text-red-500">-{fmt(payment.deduction_total)} deducted</p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                    payment.status === 'approved'  ? 'bg-teal-100 text-teal-700' :
                    payment.status === 'processed' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {payment.status === 'approved' ? 'Ready' : payment.status === 'processed' ? '✓ Processed' : payment.status}
                  </span>
                  {expandedId === payment.id
                    ? <ChevronUp className="h-4 w-4 text-gray-300" />
                    : <ChevronDown className="h-4 w-4 text-gray-300" />}
                </div>

                {/* Expanded */}
                {expandedId === payment.id && (
                  <div className="px-5 pb-5 bg-slate-50 border-t border-slate-100 pt-4 space-y-4">
                    {/* Bank Details */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Building2 className="h-4 w-4 text-slate-400" />
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Bank Details</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Bank Name',    value: payment.vendor?.bank_name ?? '—' },
                          { label: 'Account No.',  value: payment.vendor?.account_number ?? '—' },
                          { label: 'IFSC Code',    value: payment.vendor?.ifsc_code ?? '—' },
                          { label: 'Phone',        value: payment.vendor?.phone ?? '—' },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <p className="text-[10px] text-gray-400">{label}</p>
                            <p className="text-sm font-semibold text-slate-700 font-mono">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Payment summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: 'Gross Amount',  value: fmt(payment.amount) },
                        { label: 'Deductions',    value: payment.deduction_total > 0 ? `- ${fmt(payment.deduction_total)}` : '—' },
                        { label: 'Net Payable',   value: fmt(payment.net_amount ?? payment.amount) },
                        { label: 'Method',        value: payment.payment_method?.replace('_', ' ') ?? '—' },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-white rounded-lg p-2.5 border border-gray-100">
                          <p className="text-[10px] text-gray-400">{label}</p>
                          <p className="text-sm font-semibold text-slate-700 mt-0.5">{value}</p>
                        </div>
                      ))}
                    </div>

                    {payment.notes && (
                      <div className="bg-white rounded-lg p-3 border border-gray-100">
                        <p className="text-xs text-gray-400">Notes</p>
                        <p className="text-sm text-slate-700 mt-0.5">{payment.notes}</p>
                      </div>
                    )}

                    {/* Action */}
                    {payment.status === 'approved' && (
                      <button
                        onClick={() => setProcessModal(payment)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
                      >
                        <CreditCard className="h-4 w-4" /> Process Bank Transfer
                      </button>
                    )}

                    {payment.status === 'processed' && (
                      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                        <p className="text-sm font-semibold text-green-700 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" /> Payment Processed
                        </p>
                        {payment.utr_reference && (
                          <p className="text-xs text-green-600 mt-0.5">UTR: <strong>{payment.utr_reference}</strong></p>
                        )}
                        {payment.processed_at && (
                          <p className="text-xs text-green-500">{format(new Date(payment.processed_at), 'd MMM yyyy · hh:mm a')}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Process Modal */}
      {processModal && (
        <ProcessModal
          payment={processModal}
          onClose={() => setProcessModal(null)}
          onDone={() => queryClient.invalidateQueries({ queryKey: ['finance-payments'] })}
        />
      )}
    </div>
  );
}
