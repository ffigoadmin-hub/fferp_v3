// @ts-nocheck
import { useState } from 'react';
import { Plus, Search, RefreshCw, CreditCard, CheckCircle2, Clock, XCircle, Banknote } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-700' },
  paid:    { label: 'Paid',    cls: 'bg-green-100 text-green-700' },
  failed:  { label: 'Failed',  cls: 'bg-red-100   text-red-600'   },
};

const PAYMENT_MODES = ['bank_transfer','upi','cheque','cash','neft','rtgs'];

const EMPTY_FORM = {
  vendor_name: '', bill_reference: '', amount: '',
  payment_mode: 'bank_transfer', utr_number: '',
  payment_date: new Date().toISOString().split('T')[0], notes: '',
};

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const INPUT = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder:text-gray-400';

export default function PaymentsMadePage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const { data: payments = [], isLoading, refetch } = useQuery({
    queryKey: ['payments-made'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('payments_made').select('*').order('payment_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = payments.filter((p: any) => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.vendor_name?.toLowerCase().includes(q) || p.utr_number?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalAmount = filtered.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

  const statCards = [
    { key: 'all',     label: 'Total',   icon: Banknote,      color: 'text-blue-600',  bg: 'bg-blue-50'   },
    { key: 'paid',    label: 'Paid',    icon: CheckCircle2,  color: 'text-green-600', bg: 'bg-green-50'  },
    { key: 'pending', label: 'Pending', icon: Clock,         color: 'text-amber-600', bg: 'bg-amber-50'  },
  ];

  const handleCreate = async () => {
    if (!form.vendor_name || !form.amount) { toast.error('Vendor and amount required'); return; }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from('payments_made').insert({
        vendor_name:   form.vendor_name,
        bill_reference: form.bill_reference || null,
        amount:        parseFloat(form.amount),
        payment_mode:  form.payment_mode,
        utr_number:    form.utr_number || null,
        payment_date:  form.payment_date,
        notes:         form.notes || null,
        status:        'paid',
        recorded_by:   user?.id,
      });
      if (error) throw error;
      toast.success('Payment recorded');
      setShowForm(false);
      setForm(EMPTY_FORM);
      refetch();
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 tracking-tight">Payments Made</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Track all outgoing payments to vendors</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" /> Record Payment
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        {statCards.map(({ key, label, icon: Icon, color, bg }) => {
          const items = key === 'all' ? payments : payments.filter((p: any) => p.status === key);
          const amt   = items.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
          const active = statusFilter === key;
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={cn(
                'text-left p-4 rounded-2xl border transition-all',
                active
                  ? 'border-blue-300 bg-blue-50 shadow-sm ring-1 ring-blue-200'
                  : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm',
              )}
            >
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', bg)}>
                <Icon className={cn('w-4 h-4', color)} />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
              <p className="text-2xl font-black text-gray-900 mt-0.5">{items.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">₹{amt.toLocaleString('en-IN')}</p>
            </button>
          );
        })}
      </div>

      {/* Record payment form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-900">Record Payment Made</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Vendor Name" required>
              <input value={form.vendor_name} onChange={set('vendor_name')} placeholder="Vendor name" className={INPUT} />
            </Field>
            <Field label="Bill Reference">
              <input value={form.bill_reference} onChange={set('bill_reference')} placeholder="BILL-XXXX" className={INPUT} />
            </Field>
            <Field label="Amount (₹)" required>
              <input type="number" value={form.amount} onChange={set('amount')} placeholder="0.00" min="0" step="0.01" className={INPUT} />
            </Field>
            <Field label="Payment Mode">
              <select value={form.payment_mode} onChange={set('payment_mode')} className={INPUT}>
                {PAYMENT_MODES.map(m => <option key={m} value={m}>{m.replace(/_/g,' ').toUpperCase()}</option>)}
              </select>
            </Field>
            <Field label="UTR / Ref No.">
              <input value={form.utr_number} onChange={set('utr_number')} placeholder="UTR number" className={INPUT} />
            </Field>
            <Field label="Payment Date">
              <input type="date" value={form.payment_date} onChange={set('payment_date')} className={INPUT} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Notes">
                <input value={form.notes} onChange={set('notes')} placeholder="Optional notes" className={INPUT} />
              </Field>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold"
            >
              {saving ? 'Saving…' : 'Record'}
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by vendor or UTR…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <CreditCard className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">No payments found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Vendor', 'Bill Ref', 'Amount', 'Mode', 'UTR / Ref', 'Status', 'Date'].map(h => (
                    <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((p: any) => {
                  const s = STATUS_CFG[p.status] || STATUS_CFG.pending;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{p.vendor_name}</td>
                      <td className="px-4 py-3 text-gray-500">{p.bill_reference || '—'}</td>
                      <td className="px-4 py-3 font-semibold text-red-600">₹{Number(p.amount).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-gray-500 uppercase text-xs">{p.payment_mode?.replace(/_/g,' ')}</td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{p.utr_number || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold', s.cls)}>{s.label}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{p.payment_date || p.created_at?.split('T')[0]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-sm text-gray-500 text-right">
          Total: <span className="font-bold text-red-600">₹{totalAmount.toLocaleString('en-IN')}</span>
        </p>
      )}
    </div>
  );
}
