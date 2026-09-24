// @ts-nocheck
// Receivables / Payables ageing — who owes us (customers) and whom we owe
// (vendors, transporters), with the outstanding split by how old the bills are.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAgeing, today, inr, fyOf } from '@/hooks/useAccounts';
import { BooksPage, FilterBar, Field, inputCls, LoadState, RefreshButton, Num, downloadCsv } from '@/components/accounts/BooksUI';

const BUCKETS = [['d0_30', '0–30 days'], ['d31_60', '31–60'], ['d61_90', '61–90'], ['d90_plus', '90+ days']] as const;

export default function AgeingPage() {
  const [kind, setKind] = useState<'receivable' | 'payable'>(() => (location.hash === '#payables' ? 'payable' : 'receivable'));
  const [asOf, setAsOf] = useState(today());
  const [search, setSearch] = useState('');
  const q = useAgeing(kind, asOf);
  const rows = (q.data ?? []).filter((r) => !search.trim() || (r.party_name || '').toLowerCase().includes(search.trim().toLowerCase()));
  const tot = rows.reduce((t, r) => {
    t.outstanding += +r.outstanding; BUCKETS.forEach(([k]) => { t[k] += +r[k]; }); return t;
  }, { outstanding: 0, d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 });
  const fy = fyOf();

  const exportCsv = () => downloadCsv(`${kind}-ageing-${asOf}.csv`, [
    ['Party', 'Type', 'Outstanding', ...BUCKETS.map(([, l]) => l), 'Last transaction'],
    ...rows.map((r) => [r.party_name, r.party_type, (+r.outstanding).toFixed(2), ...BUCKETS.map(([k]) => (+r[k]).toFixed(2)), r.last_txn]),
    ['TOTAL', '', tot.outstanding.toFixed(2), ...BUCKETS.map(([k]) => tot[k].toFixed(2)), ''],
  ]);

  return (
    <BooksPage title={kind === 'receivable' ? 'Receivables Ageing' : 'Payables Ageing'}
      subtitle={kind === 'receivable' ? 'Money customers owe Farmers Factory, by how long it has been due.' : 'Money Farmers Factory owes vendors and transporters, by bill age.'}
      actions={<>
        <button onClick={exportCsv} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"><Download className="w-3.5 h-3.5" /> CSV</button>
        <RefreshButton onClick={() => q.refetch()} busy={q.isFetching} />
      </>}>
      <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
        {[['receivable', 'Receivables'], ['payable', 'Payables']].map(([k, l]) => (
          <button key={k} onClick={() => { setKind(k as any); history.replaceState(null, '', k === 'payable' ? '#payables' : '#'); }}
            className={cn('px-4 py-1.5 rounded-md text-sm', kind === k ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-gray-50')}>{l}</button>
        ))}
      </div>
      <FilterBar>
        <Field label="As of"><input id="ageing-asof" type="date" className={inputCls} value={asOf} onChange={(e) => setAsOf(e.target.value)} /></Field>
        <Field label="Search party"><input id="ageing-search" className={inputCls + ' w-56'} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name…" /></Field>
      </FilterBar>

      <LoadState isLoading={q.isLoading} error={q.error} empty={!rows.length} emptyText={`No outstanding ${kind === 'receivable' ? 'receivables' : 'payables'} as of ${asOf}.`}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 col-span-2 sm:col-span-1">
            <p className="text-[11px] uppercase tracking-wider text-gray-400">Total outstanding</p>
            <p className="mt-0.5 text-lg font-bold text-slate-800 tabular-nums">{inr(tot.outstanding, 0)}</p>
            <p className="text-xs text-gray-400">{rows.length} parties</p>
          </div>
          {BUCKETS.map(([k, l], i) => (
            <div key={k} className={cn('rounded-xl border bg-white px-4 py-3', i === 3 && tot[k] > 0 ? 'border-red-200' : 'border-gray-200')}>
              <p className="text-[11px] uppercase tracking-wider text-gray-400">{l}</p>
              <p className={cn('mt-0.5 text-base font-semibold tabular-nums', i === 3 && tot[k] > 0 ? 'text-red-600' : 'text-slate-700')}>{inr(tot[k], 0)}</p>
              <div className="mt-1.5 h-1.5 rounded-full bg-gray-100">
                <div className={cn('h-1.5 rounded-full', ['bg-emerald-500', 'bg-amber-400', 'bg-orange-500', 'bg-red-500'][i])}
                  style={{ width: `${tot.outstanding ? Math.min(100, (tot[k] / tot.outstanding) * 100) : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm min-w-[820px]">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="text-left px-4 py-2.5">Party</th><th className="text-right px-3 py-2.5">Outstanding</th>
                {BUCKETS.map(([k, l]) => <th key={k} className="text-right px-3 py-2.5">{l}</th>)}
                <th className="text-right px-4 py-2.5">Last txn</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.party_type}-${r.party_id}`} className="border-t border-gray-100 hover:bg-emerald-50/40">
                  <td className="px-4 py-2">
                    <Link className="text-slate-700 hover:text-emerald-700 hover:underline"
                      to={`/accounts/books/ledger?ptype=${r.party_type}&party=${r.party_id}&pname=${encodeURIComponent(r.party_name || '')}&from=${fy.from}&to=${asOf}`}>
                      {r.party_name || 'Unnamed'}
                    </Link>
                    <span className="ml-1.5 text-[11px] capitalize text-gray-400">{r.party_type}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold"><Num v={r.outstanding} /></td>
                  {BUCKETS.map(([k], i) => <td key={k} className={cn('px-3 py-2 text-right', i === 3 && +r[k] > 0 && 'text-red-600 font-medium')}><Num v={r[k]} /></td>)}
                  <td className="px-4 py-2 text-right text-xs text-gray-500">{r.last_txn ? format(new Date(r.last_txn), 'dd MMM yy') : ''}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-800">
              <tr>
                <td className="px-4 py-2.5">Total</td><td className="px-3 py-2.5 text-right"><Num v={tot.outstanding} /></td>
                {BUCKETS.map(([k]) => <td key={k} className="px-3 py-2.5 text-right"><Num v={tot[k]} /></td>)}<td />
              </tr>
            </tfoot>
          </table>
        </div>
      </LoadState>
    </BooksPage>
  );
}
