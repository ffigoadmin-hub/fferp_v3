// @ts-nocheck
// Trial Balance — opening, period debit/credit and closing for every account,
// grouped under the chart of accounts. Totals must agree; a mismatch is shown loudly.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChartOfAccounts, useTrialBalance, buildTree, rollUp, fyOf } from '@/hooks/useAccounts';
import { BooksPage, FilterBar, DateRange, HubSelect, LoadState, RefreshButton, Num, downloadCsv } from '@/components/accounts/BooksUI';

const split = (n: number) => (n >= 0 ? [n, 0] : [0, -n]);

export default function TrialBalancePage() {
  const fy = fyOf();
  const [from, setFrom] = useState(fy.from);
  const [to, setTo] = useState(fy.to);
  const [hub, setHub] = useState('');
  const [hideZero, setHideZero] = useState(true);
  const [groupsOnly, setGroupsOnly] = useState(false);

  const accountsQ = useChartOfAccounts();
  const tbQ = useTrialBalance(from, to, hub || null);
  const accounts = accountsQ.data ?? [];
  const tb = tbQ.data ?? [];
  const sums = useMemo(() => rollUp(accounts, tb), [accounts, tb]);

  const totals = tb.reduce((t, r) => {
    const [od, oc] = split(r.opening); const [cd, cc] = split(r.closing);
    return { od: t.od + od, oc: t.oc + oc, pd: t.pd + r.period_debit, pc: t.pc + r.period_credit, cd: t.cd + cd, cc: t.cc + cc };
  }, { od: 0, oc: 0, pd: 0, pc: 0, cd: 0, cc: 0 });
  const balanced = Math.abs(totals.pd - totals.pc) < 0.01 && Math.abs(totals.cd - totals.cc) < 0.01;

  const rows: any[] = [];
  const walk = (nodes: any[]) => nodes.forEach((n) => {
    const s = sums.get(n.item.id);
    const zero = !s || (Math.abs(s.opening) < 0.005 && Math.abs(s.debit) < 0.005 && Math.abs(s.credit) < 0.005 && Math.abs(s.closing) < 0.005);
    if (hideZero && zero) return;
    if (groupsOnly && !n.item.is_group) return;
    rows.push({ ...n, s: s ?? { opening: 0, debit: 0, credit: 0, closing: 0 } });
    walk(n.children);
  });
  walk(buildTree(accounts));

  const exportCsv = () => downloadCsv(`trial-balance-${from}-to-${to}.csv`, [
    ['Code', 'Account', 'Opening Dr', 'Opening Cr', 'Debit', 'Credit', 'Closing Dr', 'Closing Cr'],
    ...tb.filter((r) => !hideZero || r.opening || r.period_debit || r.period_credit || r.closing).map((r) => {
      const [od, oc] = split(r.opening); const [cd, cc] = split(r.closing);
      return [r.code, r.name, od.toFixed(2), oc.toFixed(2), r.period_debit.toFixed(2), r.period_credit.toFixed(2), cd.toFixed(2), cc.toFixed(2)];
    }),
    ['', 'TOTAL', totals.od.toFixed(2), totals.oc.toFixed(2), totals.pd.toFixed(2), totals.pc.toFixed(2), totals.cd.toFixed(2), totals.cc.toFixed(2)],
  ]);

  return (
    <BooksPage title="Trial Balance" subtitle="Balances of every account for the period. Debits and credits must agree."
      actions={<>
        <button onClick={exportCsv} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"><Download className="w-3.5 h-3.5" /> CSV</button>
        <RefreshButton onClick={() => tbQ.refetch()} busy={tbQ.isFetching} />
      </>}>
      <FilterBar>
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
        <HubSelect value={hub} onChange={setHub} />
        <div className="flex flex-col gap-1 pb-1 text-xs text-slate-600">
          <label className="flex items-center gap-1.5"><input id="tb-zero" type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} /> Hide zero balances</label>
          <label className="flex items-center gap-1.5"><input id="tb-groups" type="checkbox" checked={groupsOnly} onChange={(e) => setGroupsOnly(e.target.checked)} /> Groups only</label>
        </div>
      </FilterBar>

      <LoadState isLoading={accountsQ.isLoading || tbQ.isLoading} error={accountsQ.error || tbQ.error}>
        <div className={cn('flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm',
          balanced ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700')}>
          {balanced ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {balanced
            ? 'Balanced: total debits equal total credits.'
            : `Out of balance by ${(totals.pd - totals.pc).toFixed(2)} — this should never happen; report it immediately.`}
        </div>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm min-w-[860px]">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold" rowSpan={2}>Account</th>
                <th className="text-center px-3 pt-2.5 font-semibold border-l border-gray-200" colSpan={2}>Opening</th>
                <th className="text-center px-3 pt-2.5 font-semibold border-l border-gray-200" colSpan={2}>Period</th>
                <th className="text-center px-3 pt-2.5 font-semibold border-l border-gray-200" colSpan={2}>Closing</th>
              </tr>
              <tr>{['Dr','Cr','Debit','Credit','Dr','Cr'].map((h, i) => <th key={i} className={cn('text-right px-3 pb-2 font-semibold', i % 2 === 0 && 'border-l border-gray-200')}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map(({ item: a, depth, s }) => {
                const [od, oc] = split(s.opening); const [cd, cc] = split(s.closing);
                return (
                  <tr key={a.id} className={cn('border-t border-gray-100', a.is_group ? 'bg-slate-50/70 font-semibold text-slate-700' : 'text-slate-600 hover:bg-emerald-50/40')}>
                    <td className="px-4 py-1.5 whitespace-nowrap" style={{ paddingLeft: 16 + depth * 18 }}>
                      <span className="font-mono text-xs text-gray-400 mr-2">{a.code}</span>
                      {a.is_group ? a.name : <Link className="hover:text-emerald-700 hover:underline" to={`/accounts/books/ledger?account=${a.id}&from=${from}&to=${to}${hub ? `&hub=${hub}` : ''}`}>{a.name}</Link>}
                    </td>
                    <td className="px-3 py-1.5 text-right border-l border-gray-100"><Num v={od} /></td>
                    <td className="px-3 py-1.5 text-right"><Num v={oc} /></td>
                    <td className="px-3 py-1.5 text-right border-l border-gray-100"><Num v={s.debit} /></td>
                    <td className="px-3 py-1.5 text-right"><Num v={s.credit} /></td>
                    <td className="px-3 py-1.5 text-right border-l border-gray-100"><Num v={cd} /></td>
                    <td className="px-3 py-1.5 text-right"><Num v={cc} /></td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-800">
              <tr>
                <td className="px-4 py-2.5">Total</td>
                {[totals.od, totals.oc, totals.pd, totals.pc, totals.cd, totals.cc].map((v, i) => (
                  <td key={i} className={cn('px-3 py-2.5 text-right', i % 2 === 0 && 'border-l border-gray-200')}><Num v={v} /></td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </LoadState>
    </BooksPage>
  );
}
