// @ts-nocheck
// General Ledger — every posting to one account (or one customer / vendor) with a
// running balance. Presets give the Cash Book and Bank Book. Filters live in the URL
// so Trial Balance / Chart of Accounts can deep-link here.
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Download, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useChartOfAccounts, useAccountLedger, searchParties, fyOf, drCr, VOUCHER_TYPE_LABEL,
} from '@/hooks/useAccounts';
import { BooksPage, FilterBar, DateRange, HubSelect, Field, inputCls, LoadState, RefreshButton, Num, downloadCsv } from '@/components/accounts/BooksUI';
import { VoucherDrawer } from '@/components/accounts/VoucherDrawer';

function PartyPicker({ type, value, label, onPick }: { type: string; value: string; label: string; onPick: (id: string, name: string) => void }) {
  const [term, setTerm] = useState(label);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  useEffect(() => setTerm(label), [label]);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => searchParties(type, term).then(setResults).catch((e) => console.error(e)), 250);
    return () => clearTimeout(t);
  }, [term, type, open]);
  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
        <input id="gl-party" className={inputCls + ' pl-8 w-64'} placeholder={`Search ${type}…`} value={term}
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onChange={(e) => setTerm(e.target.value)} />
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {results.map((r) => (
            <li key={r.id}>
              <button type="button" onMouseDown={() => { onPick(r.id, r.name); setTerm(r.name); setOpen(false); }}
                className={cn('w-full px-3 py-2 text-left text-sm hover:bg-emerald-50', r.id === value && 'bg-emerald-50')}>
                <span className="text-slate-700">{r.name}</span>{r.sub && <span className="ml-2 text-xs text-gray-400">{r.sub}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function GeneralLedgerPage() {
  const fy = fyOf();
  const [sp, setSp] = useSearchParams();
  const accountId = sp.get('account') || '';
  const partyType = sp.get('ptype') || '';
  const partyId = sp.get('party') || '';
  const partyName = sp.get('pname') || '';
  const from = sp.get('from') || fy.from;
  const to = sp.get('to') || fy.to;
  const hub = sp.get('hub') || '';
  const [mode, setMode] = useState<'account' | 'party'>(partyType ? 'party' : 'account');
  const [openVoucher, setOpenVoucher] = useState<string | null>(null);

  const set = (patch: Record<string, string>) => {
    const n = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    setSp(n, { replace: true });
  };

  const accountsQ = useChartOfAccounts();
  const leaves = (accountsQ.data ?? []).filter((a) => !a.is_group);
  const account = leaves.find((a) => a.id === accountId);
  const cash = leaves.find((a) => a.system_key === 'cash');
  const bank = leaves.find((a) => a.system_key === 'bank_default');

  const ledgerQ = useAccountLedger({
    accountId: mode === 'account' ? accountId : null, from, to, hubId: hub || null,
    partyType: mode === 'party' ? partyType : null, partyId: mode === 'party' ? partyId : null,
  });
  // the DB always returns the opening balance as a first row with no line_id
  const all = ledgerQ.data ?? [];
  const opening = all.length ? Number(all[0].opening) : 0;
  const rows = all.filter((r) => r.line_id);
  const tot = useMemo(() => rows.reduce((t, r) => ({ dr: t.dr + Number(r.debit), cr: t.cr + Number(r.credit) }), { dr: 0, cr: 0 }), [rows]);
  const closing = opening + tot.dr - tot.cr;
  const title = mode === 'party' ? (partyName || 'Party ledger') : (account ? `${account.code} · ${account.name}` : 'General Ledger');

  const exportCsv = () => downloadCsv(`ledger-${(account?.code || partyName || 'party').replace(/\W+/g, '-')}-${from}-to-${to}.csv`, [
    ['Date', 'Voucher', 'Type', 'Particulars', 'Reference', 'Debit', 'Credit', 'Balance'],
    ['', '', '', 'Opening balance', '', '', '', drCr(opening)],
    ...rows.map((r) => [r.posting_date, r.voucher_no, VOUCHER_TYPE_LABEL[r.voucher_type], r.narration || r.party_name || '', r.reference_no || '', Number(r.debit).toFixed(2), Number(r.credit).toFixed(2), drCr(r.balance)]),
    ['', '', '', 'Closing balance', '', tot.dr.toFixed(2), tot.cr.toFixed(2), drCr(closing)],
  ]);

  const nothingChosen = mode === 'account' ? !accountId : !partyId;

  return (
    <BooksPage title={title} subtitle="Every posting with a running balance. Click a row to open its voucher."
      actions={<>
        {cash && <button onClick={() => { setMode('account'); set({ account: cash.id, ptype: '', party: '', pname: '' }); }} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50">Cash Book</button>}
        {bank && <button onClick={() => { setMode('account'); set({ account: bank.id, ptype: '', party: '', pname: '' }); }} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50">Bank Book</button>}
        <button disabled={nothingChosen} onClick={exportCsv} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40"><Download className="w-3.5 h-3.5" /> CSV</button>
        <RefreshButton onClick={() => ledgerQ.refetch()} busy={ledgerQ.isFetching} />
      </>}>
      <FilterBar>
        <Field label="Ledger of">
          <select id="gl-mode" className={inputCls} value={mode} onChange={(e) => setMode(e.target.value as any)}>
            <option value="account">An account</option>
            <option value="party">A customer / vendor</option>
          </select>
        </Field>
        {mode === 'account' ? (
          <Field label="Account">
            <select id="gl-account" className={inputCls + ' w-72'} value={accountId} onChange={(e) => set({ account: e.target.value })}>
              <option value="">Choose an account…</option>
              {leaves.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}{a.is_active ? '' : ' (inactive)'}</option>)}
            </select>
          </Field>
        ) : (
          <>
            <Field label="Party type">
              <select id="gl-ptype" className={inputCls} value={partyType || 'customer'} onChange={(e) => set({ ptype: e.target.value, party: '', pname: '' })}>
                <option value="customer">Customer</option>
                <option value="vendor">Vendor</option>
                <option value="driver">Transporter / driver</option>
                <option value="employee">Employee</option>
              </select>
            </Field>
            <Field label="Party">
              <PartyPicker type={partyType || 'customer'} value={partyId} label={partyName}
                onPick={(id, name) => set({ ptype: partyType || 'customer', party: id, pname: name })} />
            </Field>
          </>
        )}
        <DateRange from={from} to={to} onChange={(f, t) => set({ from: f, to: t })} />
        <HubSelect value={hub} onChange={(v) => set({ hub: v })} />
      </FilterBar>

      {nothingChosen ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-400">
          Choose {mode === 'account' ? 'an account' : 'a customer or vendor'} to see its ledger.
        </div>
      ) : (
        <LoadState isLoading={ledgerQ.isLoading} error={ledgerQ.error}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[['Opening', drCr(opening)], ['Total debit', tot.dr], ['Total credit', tot.cr], ['Closing', drCr(closing)]].map(([k, v]) => (
              <div key={k as string} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                <p className="text-[11px] uppercase tracking-wider text-gray-400">{k}</p>
                <p className="mt-0.5 text-base font-semibold text-slate-800 tabular-nums">{typeof v === 'number' ? <Num v={v} /> : v}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm min-w-[820px]">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2.5">Date</th><th className="text-left px-3 py-2.5">Voucher</th>
                  <th className="text-left px-3 py-2.5">Particulars</th><th className="text-right px-3 py-2.5">Debit</th>
                  <th className="text-right px-3 py-2.5">Credit</th><th className="text-right px-4 py-2.5">Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-100 bg-slate-50/60 text-slate-600">
                  <td className="px-4 py-2 text-xs" colSpan={5}>Opening balance as of {format(new Date(from), 'dd MMM yyyy')}</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">{drCr(opening)}</td>
                </tr>
                {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No postings in this period.</td></tr>}
                {rows.map((r) => (
                  <tr key={r.line_id} onClick={() => setOpenVoucher(r.voucher_id)} className="cursor-pointer border-t border-gray-100 hover:bg-emerald-50/40">
                    <td className="px-4 py-2 whitespace-nowrap text-slate-600">{format(new Date(r.posting_date), 'dd MMM yy')}</td>
                    <td className="px-3 py-2 whitespace-nowrap"><span className="font-mono text-xs text-slate-700">{r.voucher_no}</span><span className="ml-1.5 text-[11px] text-gray-400">{VOUCHER_TYPE_LABEL[r.voucher_type]}</span></td>
                    <td className="px-3 py-2 text-slate-600 max-w-[340px] truncate" title={r.narration || ''}>
                      {mode === 'party' ? <span className="text-xs text-gray-400 mr-1">{r.account_name}</span> : r.party_name && <span className="mr-1">{r.party_name}</span>}
                      <span className="text-xs text-gray-400">{r.narration}{r.reference_no ? ` · ${r.reference_no}` : ''}</span>
                    </td>
                    <td className="px-3 py-2 text-right"><Num v={r.debit} /></td>
                    <td className="px-3 py-2 text-right"><Num v={r.credit} /></td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-700">{drCr(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-slate-800">
                <tr>
                  <td className="px-4 py-2.5" colSpan={3}>Closing balance as of {format(new Date(to), 'dd MMM yyyy')}</td>
                  <td className="px-3 py-2.5 text-right"><Num v={tot.dr} /></td>
                  <td className="px-3 py-2.5 text-right"><Num v={tot.cr} /></td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{drCr(closing)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </LoadState>
      )}
      <VoucherDrawer id={openVoucher} onClose={() => setOpenVoucher(null)} onOpen={setOpenVoucher} />
    </BooksPage>
  );
}
