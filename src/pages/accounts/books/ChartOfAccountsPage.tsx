// @ts-nocheck
// Chart of Accounts — the account tree with each account's balance as of today.
// Accounts / Admin can add and edit accounts; system accounts (used by auto-posting)
// can be renamed but not re-parented or deactivated.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, FolderTree, Plus, Pencil, Lock, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useChartOfAccounts, useTrialBalance, useSaveAccount, useAccountsRole, buildTree, rollUp,
  ROOT_LABEL, drCr, today, type Account, type RootType,
} from '@/hooks/useAccounts';
import { BooksPage, LoadState, RefreshButton, Field, inputCls, downloadCsv } from '@/components/accounts/BooksUI';

const ACCOUNT_TYPES = ['cash','bank','receivable','payable','stock','tax','fixed_asset','cost_of_goods',
  'direct_expense','indirect_expense','direct_income','indirect_income','equity','round_off','temporary','other'];

function AccountForm({ initial, accounts, onClose }: { initial: Partial<Account>; accounts: Account[]; onClose: () => void }) {
  const save = useSaveAccount();
  const [f, setF] = useState<Partial<Account>>(initial);
  const groups = accounts.filter((a) => a.is_group && (!f.root_type || a.root_type === f.root_type) && a.id !== f.id);
  const isSystem = !!initial.system_key;
  const set = (k: keyof Account, v: any) => setF((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.code?.trim() || !f.name?.trim() || !f.root_type) return;
    await save.mutateAsync(f);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">{f.id ? 'Edit account' : 'New account'}</h2>
        {isSystem && (
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
            <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Auto-posting uses this account ({initial.system_key}). You can rename it, but its place in the tree and its type are fixed.
          </p>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Code"><input id="acc-code" className={inputCls} value={f.code || ''} onChange={(e) => set('code', e.target.value)} required disabled={isSystem} /></Field>
          <Field label="Name" className="col-span-2"><input id="acc-name" className={inputCls} value={f.name || ''} onChange={(e) => set('name', e.target.value)} required /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Root type">
            <select id="acc-root" className={inputCls} value={f.root_type || ''} disabled={isSystem || !!f.id}
              onChange={(e) => setF((p) => ({ ...p, root_type: e.target.value as RootType, parent_id: null }))} required>
              <option value="" disabled>Choose…</option>
              {Object.entries(ROOT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Parent group">
            <select id="acc-parent" className={inputCls} value={f.parent_id || ''} disabled={isSystem} onChange={(e) => set('parent_id', e.target.value || null)} required>
              <option value="" disabled>Choose…</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.code} · {g.name}</option>)}
            </select>
          </Field>
          <Field label="Account type">
            <select id="acc-type" className={inputCls} value={f.account_type || ''} disabled={isSystem || f.is_group} onChange={(e) => set('account_type', e.target.value || null)}>
              <option value="">—</option>
              {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </Field>
          <div className="flex flex-col justify-end gap-2 pb-1 text-sm text-slate-700">
            <label className="flex items-center gap-2"><input id="acc-group" type="checkbox" checked={!!f.is_group} disabled={isSystem || !!f.id} onChange={(e) => set('is_group', e.target.checked)} /> Group (holds other accounts)</label>
            <label className="flex items-center gap-2"><input id="acc-active" type="checkbox" checked={f.is_active ?? true} disabled={isSystem} onChange={(e) => set('is_active', e.target.checked)} /> Active</label>
          </div>
        </div>
        <Field label="Description (optional)"><input id="acc-desc" className={inputCls} value={f.description || ''} onChange={(e) => set('description', e.target.value)} /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={save.isPending} className="h-9 px-4 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
            {save.isPending ? 'Saving…' : 'Save account'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ChartOfAccountsPage() {
  const { canWrite } = useAccountsRole();
  const accountsQ = useChartOfAccounts();
  const asOf = today();
  const tbQ = useTrialBalance('1900-01-01', asOf);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Partial<Account> | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const accounts = accountsQ.data ?? [];
  const sums = useMemo(() => rollUp(accounts, tbQ.data ?? []), [accounts, tbQ.data]);
  const tree = useMemo(() => buildTree(accounts.filter((a) => showInactive || a.is_active)), [accounts, showInactive]);

  const toggle = (id: string) => setCollapsed((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const rows: any[] = [];
  const walk = (nodes: any[]) => nodes.forEach((n) => { rows.push(n); if (!collapsed.has(n.item.id)) walk(n.children); });
  walk(tree);

  const exportCsv = () => downloadCsv(`chart-of-accounts-${asOf}.csv`, [
    ['Code', 'Name', 'Root', 'Type', 'Group', 'System key', 'Active', `Balance ${asOf}`],
    ...accounts.map((a) => [a.code, a.name, a.root_type, a.account_type, a.is_group ? 'yes' : '', a.system_key, a.is_active ? 'yes' : 'no', (sums.get(a.id)?.closing ?? 0).toFixed(2)]),
  ]);

  return (
    <BooksPage
      title="Chart of Accounts"
      subtitle={`Every ledger account and its balance as of ${asOf}. Click an account to open its ledger.`}
      actions={<>
        <label className="flex items-center gap-1.5 text-xs text-slate-600"><input id="coa-inactive" type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive</label>
        <button onClick={exportCsv} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"><Download className="w-3.5 h-3.5" /> CSV</button>
        <RefreshButton onClick={() => { accountsQ.refetch(); tbQ.refetch(); }} busy={accountsQ.isFetching || tbQ.isFetching} />
        {canWrite && (
          <button onClick={() => setEditing({ is_active: true })} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
            <Plus className="w-3.5 h-3.5" /> New account
          </button>
        )}
      </>}
    >
      <LoadState isLoading={accountsQ.isLoading} error={accountsQ.error || tbQ.error} empty={!accounts.length}>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold">Account</th>
                <th className="text-left px-3 py-2.5 font-semibold">Type</th>
                <th className="text-right px-4 py-2.5 font-semibold">Balance</th>
                {canWrite && <th className="w-10" />}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ item: a, depth, children }) => {
                const bal = sums.get(a.id)?.closing ?? 0;
                return (
                  <tr key={a.id} className={cn('border-t border-gray-100 hover:bg-emerald-50/40', a.is_group && 'bg-slate-50/60', !a.is_active && 'opacity-50')}>
                    <td className="px-4 py-2" style={{ paddingLeft: 16 + depth * 20 }}>
                      <div className="flex items-center gap-1.5">
                        {a.is_group ? (
                          <button onClick={() => toggle(a.id)} className="text-gray-400 hover:text-gray-700" aria-label={collapsed.has(a.id) ? 'Expand' : 'Collapse'}>
                            {collapsed.has(a.id) ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        ) : <span className="w-4" />}
                        {a.is_group && <FolderTree className="w-3.5 h-3.5 text-slate-400" />}
                        <span className="font-mono text-xs text-gray-400 w-10">{a.code}</span>
                        {a.is_group
                          ? <span className="font-semibold text-slate-700">{a.name}</span>
                          : <Link to={`/accounts/books/ledger?account=${a.id}`} className="text-slate-700 hover:text-emerald-700 hover:underline">{a.name}</Link>}
                        {a.system_key && <span title={`Used by auto-posting: ${a.system_key}`}><Lock className="w-3 h-3 text-amber-500" /></span>}
                        {a.is_group && !children.length && <span className="text-[11px] text-gray-400">(empty)</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 capitalize">{a.is_group ? 'group' : (a.account_type || '').replace(/_/g, ' ')}</td>
                    <td className={cn('px-4 py-2 text-right tabular-nums', a.is_group ? 'font-semibold text-slate-700' : 'text-slate-600')}>{drCr(bal)}</td>
                    {canWrite && (
                      <td className="px-2">
                        <button onClick={() => setEditing(a)} className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label={`Edit ${a.name}`}><Pencil className="w-3.5 h-3.5" /></button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </LoadState>
      {editing && <AccountForm initial={editing} accounts={accounts} onClose={() => setEditing(null)} />}
    </BooksPage>
  );
}
