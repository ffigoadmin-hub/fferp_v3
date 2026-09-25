// @ts-nocheck
// Voucher detail side panel: header, debit/credit lines, and the actions the
// viewer is allowed to take (submit / approve / cancel / reverse).
import { useState } from 'react';
import { X, CheckCircle2, Undo2, Send, Ban, Zap, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import {
  useVoucherDetail, useApproveVoucher, useRejectVoucher, useReverseVoucher, useSubmitVoucher,
  useAccountsRole, VOUCHER_TYPE_LABEL, inr, today,
} from '@/hooks/useAccounts';
import { StatusBadge, Num, inputCls } from './BooksUI';
import { useAuth } from '@/contexts/AuthContext';

const SOURCE_LABEL: Record<string, string> = {
  invoices: 'Sales invoice', payments_received: 'Payment received', purchase_entries: 'Market buy',
  ff_vendor_payments: 'FF vendor payment', ff_transport_payments: 'FF transport payment',
  credit_notes: 'Credit note', vendor_credits: 'Vendor credit', wastage_entries: 'Wastage entry',
  payments_made: 'Payment made',
};

export function VoucherDrawer({ id, onClose, onOpen }: { id: string | null; onClose: () => void; onOpen?: (id: string) => void }) {
  const { user } = useAuth();
  const { canWrite, canApprove } = useAccountsRole();
  const q = useVoucherDetail(id);
  const approve = useApproveVoucher();
  const reject = useRejectVoucher();
  const reverse = useReverseVoucher();
  const submit = useSubmitVoucher();
  const [mode, setMode] = useState<null | 'reject' | 'reverse'>(null);
  const [reason, setReason] = useState('');
  const [revDate, setRevDate] = useState(today());

  if (!id) return null;
  const v = q.data?.voucher;
  const lines = q.data?.lines ?? [];
  const busy = approve.isPending || reject.isPending || reverse.isPending || submit.isPending;
  const mine = v?.created_by === user?.id;

  const confirm = async () => {
    if (!reason.trim()) return;
    if (mode === 'reject') await reject.mutateAsync({ id, reason });
    else await reverse.mutateAsync({ id, reason, date: revDate });
    setMode(null); setReason('');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/25" onClick={onClose}>
      <aside onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-100 bg-white px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{v ? VOUCHER_TYPE_LABEL[v.voucher_type] : 'Voucher'}</p>
            <h2 className="font-mono text-lg font-semibold text-slate-800">{v?.voucher_no ?? '…'}</h2>
          </div>
          <div className="flex items-center gap-2">
            {v && <StatusBadge status={v.reversed_by ? 'cancelled' : v.status} />}
            <button onClick={onClose} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100" aria-label="Close"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {q.isLoading && <p className="p-6 text-sm text-gray-400">Loading…</p>}
        {q.error && <p className="p-6 text-sm text-red-600">Failed to load: {q.error.message}</p>}

        {v && (
          <div className="space-y-5 p-5">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div><dt className="text-xs text-gray-400">Posting date</dt><dd className="text-slate-700">{format(new Date(v.posting_date), 'dd MMM yyyy')}</dd></div>
              <div><dt className="text-xs text-gray-400">Amount</dt><dd className="font-semibold text-slate-800">{inr(v.total_debit)}</dd></div>
              {v.party_name && <div><dt className="text-xs text-gray-400">Party</dt><dd className="text-slate-700">{v.party_name} <span className="text-xs text-gray-400 capitalize">({v.party_type})</span></dd></div>}
              {v.reference_no && <div><dt className="text-xs text-gray-400">Reference</dt><dd className="font-mono text-xs text-slate-700">{v.reference_no}</dd></div>}
              {v.source_table && (
                <div className="col-span-2 flex items-center gap-1.5 text-xs text-slate-500">
                  <Zap className="w-3.5 h-3.5 text-amber-500" /> Posted automatically from {SOURCE_LABEL[v.source_table] || v.source_table}
                </div>
              )}
              {v.narration && <div className="col-span-2"><dt className="text-xs text-gray-400">Narration</dt><dd className="text-slate-700 whitespace-pre-wrap">{v.narration}</dd></div>}
              {v.cancel_reason && <div className="col-span-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">Cancelled: {v.cancel_reason}</div>}
              {v.reversed_by && (
                <div className="col-span-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                  This voucher has been reversed.{' '}
                  {onOpen && <button className="underline" onClick={() => onOpen(v.reversed_by)}>Open the reversal</button>}
                </div>
              )}
              {v.reversal_of && onOpen && (
                <div className="col-span-2 text-xs"><button className="inline-flex items-center gap-1 text-emerald-700 underline" onClick={() => onOpen(v.reversal_of)}><ExternalLink className="w-3 h-3" /> Open the original voucher</button></div>
              )}
            </dl>

            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm min-w-[520px]">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                  <tr><th className="text-left px-3 py-2">Account</th><th className="text-left px-3 py-2">Party / remark</th><th className="text-right px-3 py-2">Debit</th><th className="text-right px-3 py-2">Credit</th></tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id} className="border-t border-gray-100">
                      <td className="px-3 py-2"><span className="font-mono text-xs text-gray-400 mr-1.5">{l.acct_accounts?.code}</span>{l.acct_accounts?.name}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {l.party_name}{l.party_name && l.remarks ? ' · ' : ''}{l.remarks}
                        {l.gst_rate != null && <span className="ml-1 text-gray-400">GST {Number(l.gst_rate)}%{l.taxable_value != null ? ` on ${inr(l.taxable_value)}` : ''}</span>}
                      </td>
                      <td className="px-3 py-2 text-right"><Num v={l.debit} /></td>
                      <td className="px-3 py-2 text-right"><Num v={l.credit} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                  <tr><td className="px-3 py-2" colSpan={2}>Total</td><td className="px-3 py-2 text-right"><Num v={v.total_debit} /></td><td className="px-3 py-2 text-right"><Num v={v.total_credit} /></td></tr>
                </tfoot>
              </table>
            </div>

            <p className="text-xs text-gray-400">
              Created {format(new Date(v.created_at), 'dd MMM yyyy, HH:mm')}
              {v.approved_at && ` · approved ${format(new Date(v.approved_at), 'dd MMM, HH:mm')}`}
              {v.posted_at && ` · posted ${format(new Date(v.posted_at), 'dd MMM, HH:mm')}`}
            </p>

            {/* actions */}
            {mode ? (
              <div className="space-y-2 rounded-xl border border-gray-200 p-3">
                <p className="text-sm font-medium text-slate-700">
                  {mode === 'reject' ? 'Cancel this voucher' : 'Reverse this posted voucher'}
                </p>
                {mode === 'reverse' && (
                  <p className="text-xs text-slate-500">A new reversal voucher with debits and credits swapped will be posted. The original stays in the ledger for the audit trail.</p>
                )}
                <textarea id="voucher-reason" rows={2} className={inputCls + ' h-auto w-full py-2'} placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
                {mode === 'reverse' && (
                  <label className="flex items-center gap-2 text-xs text-slate-600">Reversal date
                    <input id="voucher-rev-date" type="date" className={inputCls} value={revDate} onChange={(e) => setRevDate(e.target.value)} />
                  </label>
                )}
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setMode(null); setReason(''); }} className="h-9 px-3 rounded-lg border border-gray-200 text-sm">Back</button>
                  <button onClick={confirm} disabled={busy || !reason.trim()} className="h-9 px-3 rounded-lg bg-red-600 text-white text-sm disabled:opacity-50">
                    {mode === 'reject' ? 'Cancel voucher' : 'Post reversal'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap justify-end gap-2">
                {v.status === 'draft' && canWrite && mine && (
                  <button disabled={busy} onClick={() => submit.mutate(id)} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-emerald-600 text-white text-sm disabled:opacity-50">
                    <Send className="w-4 h-4" /> {canApprove ? 'Post' : 'Submit for approval'}
                  </button>
                )}
                {v.status === 'pending_approval' && canApprove && (
                  <button disabled={busy} onClick={() => approve.mutate(id)} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-emerald-600 text-white text-sm disabled:opacity-50">
                    <CheckCircle2 className="w-4 h-4" /> Approve &amp; post
                  </button>
                )}
                {['draft', 'pending_approval'].includes(v.status) && (canApprove || mine) && (
                  <button disabled={busy} onClick={() => setMode('reject')} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-red-200 text-red-600 text-sm hover:bg-red-50">
                    <Ban className="w-4 h-4" /> {canApprove && !mine ? 'Reject' : 'Cancel'}
                  </button>
                )}
                {v.status === 'posted' && !v.reversed_by && v.voucher_type !== 'reversal' && canApprove && (
                  <button disabled={busy} onClick={() => setMode('reverse')} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-amber-300 text-amber-700 text-sm hover:bg-amber-50">
                    <Undo2 className="w-4 h-4" /> Reverse
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
