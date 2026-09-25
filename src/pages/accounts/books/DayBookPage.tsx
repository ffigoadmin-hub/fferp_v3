// @ts-nocheck
// Day Book — every voucher in a period, plus the approval queue for manual
// journals and the list of auto-postings that failed (so nothing is silently missing).
import { useState } from 'react';
import { format } from 'date-fns';
import { Link, useLocation } from 'react-router-dom';
import { Zap, Plus, CheckCircle2, AlertTriangle, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useVouchers, usePendingVouchers, usePostingErrors, useResolvePostingError, useAccountsRole,
  VOUCHER_TYPE_LABEL, fyOf, inr,
} from '@/hooks/useAccounts';
import { BooksPage, FilterBar, DateRange, Field, inputCls, LoadState, RefreshButton, StatusBadge, Num, downloadCsv } from '@/components/accounts/BooksUI';
import { VoucherDrawer } from '@/components/accounts/VoucherDrawer';

type Tab = 'daybook' | 'approvals' | 'errors';

function DayBook({ onOpen }: { onOpen: (id: string) => void }) {
  const now = new Date();
  const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(iso(now));
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const q = useVouchers({ from, to, type, status, search });
  const rows = q.data ?? [];
  const posted = rows.filter((r) => r.status === 'posted');

  const exportCsv = () => downloadCsv(`day-book-${from}-to-${to}.csv`, [
    ['Date', 'Voucher', 'Type', 'Party', 'Reference', 'Narration', 'Status', 'Amount', 'Auto'],
    ...rows.map((r) => [r.posting_date, r.voucher_no, VOUCHER_TYPE_LABEL[r.voucher_type], r.party_name, r.reference_no, r.narration, r.reversed_by ? 'reversed' : r.status, (+r.total_debit).toFixed(2), r.is_auto ? 'yes' : '']),
  ]);

  return (
    <div className="space-y-4">
      <FilterBar>
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
        <Field label="Type">
          <select id="db-type" className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {Object.entries(VOUCHER_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select id="db-status" className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option><option value="posted">Posted</option><option value="pending_approval">Pending approval</option>
            <option value="draft">Draft</option><option value="cancelled">Cancelled</option>
          </select>
        </Field>
        <Field label="Search"><input id="db-search" className={inputCls + ' w-56'} placeholder="Voucher no, party, UTR…" value={search} onChange={(e) => setSearch(e.target.value)} /></Field>
        <button onClick={exportCsv} className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"><Download className="w-3.5 h-3.5" /> CSV</button>
      </FilterBar>
      <LoadState isLoading={q.isLoading} error={q.error} empty={!rows.length} emptyText="No vouchers in this period.">
        <p className="text-xs text-gray-500">{rows.length} vouchers · {posted.length} posted · total posted {inr(posted.reduce((s, r) => s + +r.total_debit, 0))}</p>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm min-w-[860px]">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
              <tr><th className="text-left px-4 py-2.5">Date</th><th className="text-left px-3 py-2.5">Voucher</th><th className="text-left px-3 py-2.5">Party / narration</th><th className="text-left px-3 py-2.5">Status</th><th className="text-right px-4 py-2.5">Amount</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} onClick={() => onOpen(r.id)} className={cn('cursor-pointer border-t border-gray-100 hover:bg-emerald-50/40', r.reversed_by && 'text-gray-400')}>
                  <td className="px-4 py-2 whitespace-nowrap">{format(new Date(r.posting_date), 'dd MMM yy')}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={cn('font-mono text-xs', r.reversed_by && 'line-through')}>{r.voucher_no}</span>
                    <span className="ml-1.5 text-[11px] text-gray-400">{VOUCHER_TYPE_LABEL[r.voucher_type]}</span>
                    {r.is_auto && <Zap className="ml-1 inline w-3 h-3 text-amber-500" aria-label="Auto-posted" />}
                  </td>
                  <td className="px-3 py-2 max-w-[380px] truncate">{r.party_name && <span className="text-slate-700 mr-1.5">{r.party_name}</span>}<span className="text-xs text-gray-400">{r.narration}{r.reference_no ? ` · ${r.reference_no}` : ''}</span></td>
                  <td className="px-3 py-2">{r.reversed_by ? <span className="text-[11px] text-amber-700">reversed</span> : <StatusBadge status={r.status} />}</td>
                  <td className="px-4 py-2 text-right"><Num v={r.total_debit} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LoadState>
    </div>
  );
}

function Approvals({ onOpen }: { onOpen: (id: string) => void }) {
  const q = usePendingVouchers();
  const rows = q.data ?? [];
  return (
    <LoadState isLoading={q.isLoading} error={q.error} empty={!rows.length} emptyText="No journals are waiting for approval.">
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
            <tr><th className="text-left px-4 py-2.5">Submitted</th><th className="text-left px-3 py-2.5">Voucher</th><th className="text-left px-3 py-2.5">Narration</th><th className="text-right px-4 py-2.5">Amount</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} onClick={() => onOpen(r.id)} className="cursor-pointer border-t border-gray-100 hover:bg-amber-50/50">
                <td className="px-4 py-2 whitespace-nowrap text-slate-600">{r.submitted_at ? format(new Date(r.submitted_at), 'dd MMM, HH:mm') : ''}</td>
                <td className="px-3 py-2"><span className="font-mono text-xs">{r.voucher_no}</span> <span className="text-[11px] text-gray-400">{VOUCHER_TYPE_LABEL[r.voucher_type]} · {format(new Date(r.posting_date), 'dd MMM')}</span></td>
                <td className="px-3 py-2 text-slate-600 max-w-[380px] truncate">{r.party_name && <b className="font-medium mr-1">{r.party_name}</b>}{r.narration}</td>
                <td className="px-4 py-2 text-right font-medium"><Num v={r.total_debit} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </LoadState>
  );
}

function PostingErrors() {
  const { canWrite } = useAccountsRole();
  const q = usePostingErrors();
  const resolve = useResolvePostingError();
  const rows = q.data ?? [];
  return (
    <LoadState isLoading={q.isLoading} error={q.error} empty={!rows.length} emptyText="Every operational document has been posted to the books. Nothing is waiting.">
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        These documents were saved in the ERP but could not be posted to the ledger. Fix the cause (usually a missing account or a locked period), then post them again with a journal entry or by re-running the back-posting script. Mark a row resolved once it is handled.
      </p>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
            <tr><th className="text-left px-4 py-2.5">When</th><th className="text-left px-3 py-2.5">Document</th><th className="text-left px-3 py-2.5">Problem</th>{canWrite && <th />}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100 align-top">
                <td className="px-4 py-2 whitespace-nowrap text-slate-600">{format(new Date(r.created_at), 'dd MMM, HH:mm')}</td>
                <td className="px-3 py-2"><span className="text-slate-700">{r.source_table}</span> <span className="text-[11px] text-gray-400">{VOUCHER_TYPE_LABEL[r.voucher_type] || r.voucher_type}</span><div className="font-mono text-[11px] text-gray-400">{r.source_id}</div></td>
                <td className="px-3 py-2 text-red-700">{r.error_message}</td>
                {canWrite && <td className="px-3 py-2 text-right"><button disabled={resolve.isPending} onClick={() => resolve.mutate(r.id)} className="text-xs px-2.5 py-1 rounded-md border border-gray-200 hover:bg-gray-50">Mark resolved</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </LoadState>
  );
}

export default function DayBookPage() {
  const { canWrite } = useAccountsRole();
  const [tab, setTab] = useState<Tab>(() => (['approvals', 'errors'].includes(location.hash.slice(1)) ? location.hash.slice(1) as Tab : 'daybook'));
  const loc = useLocation();
  const [open, setOpen] = useState<string | null>((loc.state as any)?.opened ?? null);
  const pending = usePendingVouchers();
  const errors = usePostingErrors();
  const tabs: [Tab, string, number?][] = [
    ['daybook', 'Day Book'],
    ['approvals', 'Awaiting approval', pending.data?.length],
    ['errors', 'Posting problems', errors.data?.length],
  ];
  return (
    <BooksPage title="Vouchers" subtitle="Every accounting entry — posted automatically from operations or entered by hand."
      actions={<>
        <RefreshButton onClick={() => { pending.refetch(); errors.refetch(); }} />
        {canWrite && <Link to="/accounts/books/journal/new" className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"><Plus className="w-3.5 h-3.5" /> New journal entry</Link>}
      </>}>
      <div className="inline-flex flex-wrap rounded-lg border border-gray-200 bg-white p-1">
        {tabs.map(([k, l, n]) => (
          <button key={k} onClick={() => { setTab(k); history.replaceState(null, '', k === 'daybook' ? '#' : `#${k}`); }}
            className={cn('flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm', tab === k ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-gray-50')}>
            {k === 'approvals' && <CheckCircle2 className="w-3.5 h-3.5" />}{k === 'errors' && <AlertTriangle className="w-3.5 h-3.5" />}
            {l}{!!n && <span className={cn('rounded-full px-1.5 text-[11px] font-semibold', tab === k ? 'bg-white/25' : k === 'errors' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>{n}</span>}
          </button>
        ))}
      </div>
      {tab === 'daybook' && <DayBook onOpen={setOpen} />}
      {tab === 'approvals' && <Approvals onOpen={setOpen} />}
      {tab === 'errors' && <PostingErrors />}
      <VoucherDrawer id={open} onClose={() => setOpen(null)} onOpen={setOpen} />
    </BooksPage>
  );
}
