// @ts-nocheck
// ─────────────────────────────────────────────────────────────
//  Accounts Execution Desk — bulk batch payout for FF vendor
//  payments sitting at pending_accounts.
//
//  Flow: select payments -> create a batch (downloads the Kotak
//  bulk-transfer .txt) -> upload the bank's returned statement to
//  auto-match UTRs -> Mark Processed (flips each payment to paid).
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Layers, PackageCheck, Download, Upload, CheckCircle2, ChevronDown, ChevronUp,
  Loader2, RefreshCw, Banknote, AlertCircle, RotateCcw,
} from 'lucide-react';
import {
  generateFFKotakBulkFile, parseFFBankStatement, matchFFPayments,
  type BatchPaymentForExport, type MatchResult,
} from '@/lib/ffPaymentBatchExport';

const DEBIT_ACCOUNT_STORAGE_KEY = 'ff-execution-desk-debit-account';
// Farmers Factory is a brand under IGO Group, sharing the same Kotak CMS
// account the sibling IGO Group ERP already bulk-pays from — confirmed
// by the user, not guessed. Still an editable field below, just
// pre-filled with the right value instead of blank.
const IGO_GROUP_KOTAK_DEBIT_ACCOUNT = '5949192052';

function fmt(n: number) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

// ── Batch Creation tab ──────────────────────────────────────────
function BatchCreationTab({ onBatchCreated }: { onBatchCreated: () => void }) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [debitAccount, setDebitAccount] = useState(() => localStorage.getItem(DEBIT_ACCOUNT_STORAGE_KEY) || IGO_GROUP_KOTAK_DEBIT_ACCOUNT);
  const [creating, setCreating] = useState(false);
  const [hubFilter, setHubFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: hubs = [] } = useQuery({
    queryKey: ['hubs-list'],
    queryFn: async () => {
      const { data } = await supabase.from('hubs').select('id, name').order('name');
      return data ?? [];
    },
  });

  const { data: allPayments = [], isLoading, refetch } = useQuery({
    queryKey: ['pending-accounts-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ff_vendor_payments')
        .select('id, gross_amount, net_amount, created_at, hub_id, vendors(id, name, account_number, bank_name, ifsc_code), hubs(name), purchase_orders(po_number, eod_date)')
        .eq('payment_status', 'pending_accounts')
        .is('batch_id', null)
        .order('created_at', { ascending: false });
      if (error) { console.error('[ExecutionDesk] pending payments:', error.message); return []; }
      return data ?? [];
    },
  });

  // This whole list is, by definition, every payment that has already
  // cleared Manager -> L1 -> Admin -> CEO — pending_accounts only ever
  // means "CEO approved, waiting for Accounts to pay." Filtered client-side
  // (not in the query) so a hub/date filter never drops an already-checked
  // row out from under a selection made before the filter was applied.
  const payments = allPayments.filter((p: any) => {
    if (hubFilter !== 'all' && p.hub_id !== hubFilter) return false;
    const eod = p.purchase_orders?.eod_date;
    if (dateFrom && (!eod || eod < dateFrom)) return false;
    if (dateTo && (!eod || eod > dateTo)) return false;
    return true;
  });
  const filtersActive = hubFilter !== 'all' || !!dateFrom || !!dateTo;
  const selectedHubName = hubFilter === 'all' ? null : hubs.find((h: any) => h.id === hubFilter)?.name;

  const missingBank = payments.filter((p: any) => !p.vendors?.account_number || !p.vendors?.ifsc_code);
  const selectedPayments = allPayments.filter((p: any) => selected.has(p.id));
  const selectedTotal = selectedPayments.reduce((s: number, p: any) => s + Number(p.net_amount ?? p.gross_amount ?? 0), 0);
  const selectedHubNames = Array.from(new Set(selectedPayments.map((p: any) => p.hubs?.name).filter(Boolean)));
  const batchScopeLabel = selectedHubNames.length === 1 ? `for ${selectedHubNames[0]}` : selectedHubNames.length > 1 ? `(${selectedHubNames.length} Hubs)` : '';

  const toggleAll = () => {
    if (selected.size === payments.length) setSelected(new Set());
    else setSelected(new Set(payments.map((p: any) => p.id)));
  };
  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const createBatch = async () => {
    if (!debitAccount.trim()) { toast.error('Enter the Kotak debit account number first'); return; }
    if (selectedPayments.length === 0) { toast.error('Select at least one payment'); return; }
    const withoutBank = selectedPayments.filter((p: any) => !p.vendors?.account_number || !p.vendors?.ifsc_code);
    if (withoutBank.length > 0) {
      toast.error(`${withoutBank.length} selected payment(s) have no vendor bank details — deselect them first`);
      return;
    }

    localStorage.setItem(DEBIT_ACCOUNT_STORAGE_KEY, debitAccount.trim());
    setCreating(true);
    try {
      const batchRef = `FFPAY-${format(new Date(), 'yyyyMMdd-HHmmss')}`;
      const { data: batch, error: batchErr } = await supabase
        .from('ff_payment_batches')
        .insert({
          batch_ref: batchRef,
          payment_type: 'vendor',
          total_amount: selectedTotal,
          payment_count: selectedPayments.length,
          created_by: user?.id,
        })
        .select('id')
        .single();
      if (batchErr) throw batchErr;

      const { error: updateErr } = await supabase
        .from('ff_vendor_payments')
        .update({ batch_id: batch.id })
        .in('id', selectedPayments.map((p: any) => p.id));
      if (updateErr) throw updateErr;

      const exportRows: BatchPaymentForExport[] = selectedPayments.map((p: any) => ({
        id: p.id,
        amount: Number(p.net_amount ?? p.gross_amount ?? 0),
        vendor_name: p.vendors?.name || 'Unknown',
        vendor_account_number: p.vendors?.account_number,
        vendor_ifsc_code: p.vendors?.ifsc_code,
      }));
      generateFFKotakBulkFile(exportRows, batchRef, debitAccount.trim());

      await supabase.from('ff_payment_batches').update({ kotak_file_generated_at: new Date().toISOString() }).eq('id', batch.id);

      toast.success(`Batch ${batchRef} created — ${selectedPayments.length} payments, ${fmt(selectedTotal)}. Bank file downloaded.`);
      setSelected(new Set());
      refetch();
      onBatchCreated();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create batch');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kotak Debit Account Number</label>
        <input
          type="text" value={debitAccount} onChange={e => setDebitAccount(e.target.value)}
          placeholder="Your company's Kotak CMS account number"
          className="mt-1 w-full max-w-xs rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-[11px] text-gray-400 mt-1">Pre-filled with the IGO Group Kotak account (Farmers Factory is billed under it) — editable if that ever changes.</p>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 text-xs font-semibold w-fit">
        <CheckCircle2 className="w-3.5 h-3.5" /> CEO Approved · Waiting at Accounts
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Hub</label>
          <select value={hubFilter} onChange={e => setHubFilter(e.target.value)}
            className="mt-1 block rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All Hubs</option>
            {hubs.map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">PO Date From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="mt-1 block rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">PO Date To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="mt-1 block rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {filtersActive && (
          <button onClick={() => { setHubFilter('all'); setDateFrom(''); setDateTo(''); }}
            className="text-xs font-semibold text-blue-600 hover:underline pb-2.5">
            Clear filters
          </button>
        )}
        <p className="text-[11px] text-gray-500 w-full font-semibold">
          Batch scope: {selectedHubName ? `${selectedHubName} only` : 'All Hubs'} — "Select All" below selects everything currently shown, so switch the Hub dropdown back to "All Hubs" to batch across every hub instead.
        </p>
      </div>

      {missingBank.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {missingBank.length} payment(s) below have no vendor bank details on file — add them from the Purchase Report page before including them in a batch.
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <input type="checkbox" checked={payments.length > 0 && selected.size === payments.length} onChange={toggleAll} />
            Select All ({payments.length} ready{selectedHubName ? ` in ${selectedHubName}` : ''})
          </label>
          <span className="text-sm font-bold text-gray-800">{selected.size} selected · {fmt(selectedTotal)}</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : payments.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">
            {filtersActive ? 'No payments match this hub/date filter.' : 'No payments waiting at Accounts right now.'}
          </div>
        ) : (
          <div className="divide-y divide-gray-50 max-h-[50vh] overflow-y-auto">
            {payments.map((p: any) => {
              const noBank = !p.vendors?.account_number || !p.vendors?.ifsc_code;
              return (
                <label key={p.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${noBank ? 'opacity-50' : 'hover:bg-gray-50 cursor-pointer'}`}>
                  <input type="checkbox" checked={selected.has(p.id)} disabled={noBank} onChange={() => toggleOne(p.id)} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{p.vendors?.name || 'Unknown vendor'}</p>
                    <p className="text-[11px] text-gray-400">
                      {p.hubs?.name || '—'} {p.purchase_orders?.po_number && `· ${p.purchase_orders.po_number}`} {p.purchase_orders?.eod_date && `· ${format(new Date(p.purchase_orders.eod_date), 'dd MMM')}`} {noBank && '· no bank details'}
                    </p>
                  </div>
                  <span className="font-bold text-gray-800">{fmt(p.net_amount ?? p.gross_amount)}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <button
        onClick={createBatch}
        disabled={creating || selected.size === 0}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        Create Batch {batchScopeLabel} &amp; Download Kotak File
      </button>
    </div>
  );
}

// ── Batch Processing tab ─────────────────────────────────────────
function BatchCard({ batch, onChanged }: { batch: any; onChanged: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [matches, setMatches] = useState<MatchResult[] | null>(null);

  const { data: linkedPayments = [] } = useQuery({
    queryKey: ['batch-payments', batch.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('ff_vendor_payments')
        .select('id, gross_amount, net_amount, utr_number, vendors(name, account_number, ifsc_code)')
        .eq('batch_id', batch.id);
      return data ?? [];
    },
    enabled: expanded || batch.status === 'created',
  });

  const handleStatementUpload = async (file: File) => {
    setUploading(true);
    try {
      const rows = await parseFFBankStatement(file);
      const exportRows: BatchPaymentForExport[] = linkedPayments.map((p: any) => ({
        id: p.id,
        amount: Number(p.net_amount ?? p.gross_amount ?? 0),
        vendor_name: p.vendors?.name || 'Unknown',
        vendor_account_number: p.vendors?.account_number,
        vendor_ifsc_code: p.vendors?.ifsc_code,
      }));
      const results = matchFFPayments(exportRows, rows);
      setMatches(results);
    } catch (e: any) {
      toast.error(e.message || 'Failed to read statement');
    } finally {
      setUploading(false);
    }
  };

  const confirmMatches = async () => {
    if (!matches) return;
    setUploading(true);
    try {
      for (const m of matches) {
        if (m.matchedUTR) {
          await supabase.from('ff_vendor_payments').update({ utr_number: m.matchedUTR }).eq('id', m.paymentId);
        }
      }
      await supabase.from('ff_payment_batches').update({
        status: 'verified',
        statement_uploaded_at: new Date().toISOString(),
      }).eq('id', batch.id);
      toast.success('UTRs matched — batch verified');
      setMatches(null);
      onChanged();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save matches');
    } finally {
      setUploading(false);
    }
  };

  const markProcessed = async () => {
    setProcessing(true);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase.from('ff_vendor_payments').update({
        payment_status: 'paid',
        paid_by: user?.id,
        paid_at: nowIso,
        accounts_approved_by: user?.id,
        accounts_approved_at: nowIso,
      }).eq('batch_id', batch.id);
      if (error) throw error;

      await supabase.from('ff_payment_batches').update({
        status: 'processed', processed_by: user?.id, processed_at: nowIso,
      }).eq('id', batch.id);

      toast.success(`Batch ${batch.batch_ref} processed — ${batch.payment_count} payments marked paid`);
      onChanged();
    } catch (e: any) {
      toast.error(e.message || 'Failed to mark processed');
    } finally {
      setProcessing(false);
    }
  };

  const revokeBatch = async () => {
    if (!window.confirm(`Revoke batch ${batch.batch_ref}? Its ${batch.payment_count} payment(s) will be unlinked and go back to the Batch Creation list — nothing gets marked paid, this just undoes the batch itself.`)) return;
    setRevoking(true);
    try {
      const { error: unlinkErr } = await supabase.from('ff_vendor_payments').update({ batch_id: null }).eq('batch_id', batch.id);
      if (unlinkErr) throw unlinkErr;
      const { error: delErr } = await supabase.from('ff_payment_batches').delete().eq('id', batch.id);
      if (delErr) throw delErr;
      toast.success(`Batch ${batch.batch_ref} revoked — payments are back in Batch Creation`);
      qc.invalidateQueries({ queryKey: ['pending-accounts-payments'] });
      onChanged();
    } catch (e: any) {
      toast.error(e.message || 'Failed to revoke batch');
    } finally {
      setRevoking(false);
    }
  };

  const redownload = () => {
    const exportRows: BatchPaymentForExport[] = linkedPayments.map((p: any) => ({
      id: p.id,
      amount: Number(p.net_amount ?? p.gross_amount ?? 0),
      vendor_name: p.vendors?.name || 'Unknown',
      vendor_account_number: p.vendors?.account_number,
      vendor_ifsc_code: p.vendors?.ifsc_code,
    }));
    const debitAccount = localStorage.getItem(DEBIT_ACCOUNT_STORAGE_KEY) || IGO_GROUP_KOTAK_DEBIT_ACCOUNT;
    generateFFKotakBulkFile(exportRows, batch.batch_ref, debitAccount);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-mono font-bold text-gray-800">{batch.batch_ref}</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${batch.status === 'verified' ? 'bg-teal-100 text-teal-700' : 'bg-amber-100 text-amber-700'}`}>
              {batch.status === 'verified' ? 'VERIFIED' : 'PENDING'}
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">{format(new Date(batch.created_at), 'dd MMM, h:mm a')}</p>
          <div className="flex items-center gap-4 mt-1 text-xs">
            <span className="text-gray-400">TOTAL AMOUNT</span>
            <span className="font-bold text-green-600">{fmt(batch.total_amount)}</span>
            <span className="text-gray-400">COUNT</span>
            <span className="font-bold text-gray-800">{batch.payment_count}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={redownload} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50">
            <Download className="w-3.5 h-3.5" /> Bank File
          </button>
          {batch.status === 'verified' ? (
            <button onClick={markProcessed} disabled={processing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700 disabled:opacity-50">
              {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Mark Processed
            </button>
          ) : (
            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 cursor-pointer">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Upload Statement
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleStatementUpload(f); e.target.value = ''; }} />
            </label>
          )}
          <button onClick={revokeBatch} disabled={revoking}
            title="Undo this batch — payments go back to Batch Creation, nothing is marked paid"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 disabled:opacity-50">
            {revoking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Revoke
          </button>
          <button onClick={() => setExpanded(v => !v)} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {matches && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold text-gray-500 mb-2">Match Review — {matches.filter(m => m.status === 'matched').length}/{matches.length} matched confidently</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400"><th className="text-left font-medium py-1">Vendor</th><th className="text-right font-medium py-1">Amount</th><th className="text-left font-medium py-1">Matched UTR</th><th className="text-left font-medium py-1">Status</th></tr>
            </thead>
            <tbody>
              {matches.map(m => (
                <tr key={m.paymentId} className="border-t border-gray-50">
                  <td className="py-1.5">{m.vendorName}</td>
                  <td className="py-1.5 text-right font-semibold">{fmt(m.amount)}</td>
                  <td className="py-1.5 font-mono">{m.matchedUTR || '—'}</td>
                  <td className="py-1.5">
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      m.status === 'matched' ? 'bg-green-100 text-green-700' :
                      m.status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'
                    }`}>{m.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-2 mt-3">
            <button onClick={confirmMatches} disabled={uploading}
              className="px-4 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 disabled:opacity-50">
              Confirm &amp; Verify Batch
            </button>
            <button onClick={() => setMatches(null)} className="px-4 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-500">Cancel</button>
          </div>
        </div>
      )}

      {expanded && !matches && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400"><th className="text-left font-medium py-1">Vendor</th><th className="text-right font-medium py-1">Amount</th><th className="text-left font-medium py-1">UTR</th></tr>
            </thead>
            <tbody>
              {linkedPayments.map((p: any) => (
                <tr key={p.id} className="border-t border-gray-50">
                  <td className="py-1.5">{p.vendors?.name || '—'}</td>
                  <td className="py-1.5 text-right font-semibold">{fmt(p.net_amount ?? p.gross_amount)}</td>
                  <td className="py-1.5 font-mono">{p.utr_number || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BatchProcessingTab() {
  const { data: batches = [], isLoading, refetch } = useQuery({
    queryKey: ['ff-payment-batches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ff_payment_batches')
        .select('*')
        .in('status', ['created', 'verified'])
        .order('created_at', { ascending: false });
      if (error) { console.error('[ExecutionDesk] batches:', error.message); return []; }
      return data ?? [];
    },
  });

  if (isLoading) return <div className="p-8 text-center text-sm text-gray-400">Loading…</div>;
  if (batches.length === 0) return <div className="p-10 text-center text-sm text-gray-400">No pending or verified batches.</div>;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pending &amp; Verified Batches</p>
      {batches.map((b: any) => <BatchCard key={b.id} batch={b} onChanged={refetch} />)}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────
export default function ExecutionDeskPage() {
  const [tab, setTab] = useState<'create' | 'process'>('create');
  const qc = useQueryClient();

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['pending-accounts-payments'] });
    qc.invalidateQueries({ queryKey: ['ff-payment-batches'] });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12 pt-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Layers className="w-5 h-5 text-blue-600" /> Execution Desk</h1>
          <p className="text-xs text-gray-500 mt-0.5">Batching, execution &amp; reconciliation for vendor payouts</p>
        </div>
        <button onClick={refreshAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: 'create', label: 'Batch Creation', icon: Banknote },
          { key: 'process', label: 'Batch Processing', icon: PackageCheck },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t.key ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'create' ? <BatchCreationTab onBatchCreated={() => setTab('process')} /> : <BatchProcessingTab />}
    </div>
  );
}
