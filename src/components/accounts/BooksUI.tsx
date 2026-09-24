// @ts-nocheck
// Small shared building blocks for the Books of Accounts pages.
import { ReactNode } from 'react';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHubs, STATUS_STYLE, fyOf } from '@/hooks/useAccounts';

export function BooksPage({ title, subtitle, actions, children }:
  { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-12 pt-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Books of Accounts</p>
          <h1 className="text-[22px] font-bold text-slate-800 tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-3">{children}</div>;
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-1 text-xs font-medium text-gray-600', className)}>
      {label}
      {children}
    </label>
  );
}

export const inputCls = 'h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/40';

export function DateRange({ from, to, onChange }:
  { from: string; to: string; onChange: (from: string, to: string) => void }) {
  const fy = fyOf();
  const month = new Date(); const m0 = new Date(month.getFullYear(), month.getMonth(), 1);
  const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return (
    <>
      <Field label="From"><input id="acct-from" type="date" className={inputCls} value={from} onChange={(e) => onChange(e.target.value, to)} /></Field>
      <Field label="To"><input id="acct-to" type="date" className={inputCls} value={to} onChange={(e) => onChange(from, e.target.value)} /></Field>
      <div className="flex gap-1 pb-0.5">
        <button type="button" onClick={() => onChange(iso(m0), iso(new Date()))} className="h-8 px-2.5 rounded-md text-xs border border-gray-200 hover:bg-gray-50">This month</button>
        <button type="button" onClick={() => onChange(fy.from, fy.to)} className="h-8 px-2.5 rounded-md text-xs border border-gray-200 hover:bg-gray-50">{fy.label}</button>
      </div>
    </>
  );
}

export function HubSelect({ value, onChange, label = 'Hub (cost centre)' }:
  { value: string; onChange: (v: string) => void; label?: string }) {
  const { data: hubs = [] } = useHubs();
  return (
    <Field label={label}>
      <select id="acct-hub" className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All hubs + head office</option>
        {hubs.map((h: any) => <option key={h.id} value={h.id}>{h.code} · {h.name}</option>)}
      </select>
    </Field>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize', STATUS_STYLE[status] || STATUS_STYLE.draft)}>
      {status.replace('_', ' ')}
    </span>
  );
}

export function RefreshButton({ onClick, busy }: { onClick: () => void; busy?: boolean }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50">
      <RefreshCw className={cn('w-3.5 h-3.5', busy && 'animate-spin')} /> Refresh
    </button>
  );
}

export function LoadState({ isLoading, error, empty, emptyText = 'Nothing here yet.', children }:
  { isLoading: boolean; error: any; empty?: boolean; emptyText?: string; children: ReactNode }) {
  if (isLoading) return <div className="p-10 flex items-center justify-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;
  if (error) {
    const msg = error?.message || String(error);
    const missing = /acct_|does not exist|Could not find/i.test(msg);
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">Failed to load: {msg}</p>
          {missing && <p className="mt-1 text-red-600/80">If this is the first run, ADD_ACCOUNTS_LEDGER_CORE.sql has not been applied to the database yet.</p>}
        </div>
      </div>
    );
  }
  if (empty) return <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-400">{emptyText}</div>;
  return <>{children}</>;
}

export function Num({ v, className }: { v: number; className?: string }) {
  const n = Number(v || 0);
  if (Math.abs(n) < 0.005) return <span className={cn('text-gray-300', className)}>—</span>;
  return <span className={cn('tabular-nums', className)}>{n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
}

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const esc = (c: any) => {
    const s = c == null ? '' : String(c);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const blob = new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
