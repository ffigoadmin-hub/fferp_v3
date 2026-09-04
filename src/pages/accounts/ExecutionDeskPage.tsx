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
  Loader2, RefreshCw, Banknote, AlertCircle,
} from 'lucide-react';
import {
  generateFFKotakBulkFile, parseFFBankStatement, matchFFPayments,
  type BatchPaymentForExport, type MatchResult,
} from '@/lib/ffPaymentBatchExport';

const DEBIT_ACCOUNT_STORAGE_KEY = 'ff-execution-desk-debit-account';

function fmt(n: number) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

// ── Batch Creation tab ──────────────────────────────────────────
function BatchCreationTab({ onBatchCreated }: { onBatchCreated: () => void }) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [debitAccount, setDebitAccount] = useState(() => localStorage.getItem(DEBIT_ACCOUNT_STORAGE_KEY) || '');
  const [creating, setCreating] = useState(false);

  const { data: payments = [], isLoading, refetch } = useQuery({
    queryKey: ['pending-accounts-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ff_vendor_payments')
        .select('id, gross_amount, net_amount, created_at, vendors(id, name, account_number, bank_name, ifsc_code), hubs(name)')
        .eq('payment_status', 'pending_accounts')
        .is('batch_id', null)
        .order('created_at', { ascending: false });
      if (error) { console.error('[ExecutionDesk] pending payments:', error.message); return []; }
      return data ?? [];
    },
  });

  const missingBank = payments.filter((p: any) => !p.vendors?.account_number || !p.vendors?.ifsc_code);
  const selectedPayments = payments.filter((p: any) => selected.has(p.id));
  const selectedTotal = selectedPayments.reduce((s: number, p: any) => s + Number(p.net_amount ?? p.gross_amount ?? 0), 0);

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
        <p className="text-[11px] text-gray-400 mt-1">Remembered on this device — the account money is debited from for the Kotak bulk file.</p>
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
            Select All ({payments.length} ready)
          </label>
          <span className="text-sm font-bold text-gray-800">{selected.size} selected · {fmt(selectedTotal)}</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : payments.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">No payments waiting at Accounts right now.</div>
        ) : (
          <div className="divide-y divide-gray-50 max-h-[50vh] overflow-y-auto">
            {payments.map((p: any) => {
              const noBank = !p.vendors?.account_number || !p.vendors?.ifsc_code;
              return (
                <label key={p.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${noBank ? 'opacity-50' : 'hover:bg-gray-50 cursor-pointer'}`}>
                  <input type="checkbox" checked={selected.has(p.id)} disabled={noBank} onChange={() => toggleOne(p.id)} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{p.vendors?.name || 'Unknown vendor'}</p>
                    <p className="text-[11px] text-gray-400">{p.hubs?.name || '—'} {noBank && '· no bank details'}</p>
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
        Create Batch &amp; Download Kotak File
      </button>
    </div>
  );
}

// ── Batch Processing tab ─────────────────────────────────────────
function BatchCard({ batch, onChanged }: { batch: any; onChanged: () => void }) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
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

  const redownload = () => {
    const exportRows: BatchPaymentForExport[] = linkedPayments.map((p: any) => ({
      id: p.id,
      amount: Number(p.net_amount ?? p.gross_amount ?? 0),
      vendor_name: p.vendors?.name || 'Unknown',
      vendor_account_number: p.vendors?.account_number,
      vendor_ifsc_code: p.vendors?.ifsc_code,
    }));
    const debitAccount = localStorage.getItem(DEBIT_ACCOUNT_STORAGE_KEY) || '';
    if (!debitAccount) { toast.error('Debit account number not remembered on this device — re-enter it on Batch Creation first'); return; }
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
