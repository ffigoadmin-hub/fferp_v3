import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { CreditCard, Plus, X, Check, Search } from 'lucide-react';

const EMPTY_FORM = {
  vendor_id: '', purchase_order_id: '', amount: '', payment_mode: 'bank_transfer',
  payment_date: format(new Date(), 'yyyy-MM-dd'), utr_number: '', notes: '',
};

export default function VendorPayments() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors-list'],
    queryFn: async () => {
      const { data } = await supabase.from('vendors').select('id, name').eq('is_active', true).order('name');
      return data ?? [];
    },
  });

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['vendor-payments'],
    queryFn: async () => {
      const { data } = await supabase
        .from('vendor_payments')
        .select('*, vendor:vendors(name), po:purchase_orders(po_number)')
        .order('payment_date', { ascending: false });
      return data ?? [];
    },
  });

  const savePayment = useMutation({
    mutationFn: async () => {
      if (!form.vendor_id || !form.amount) throw new Error('Vendor and amount required');
      const { error } = await supabase.from('vendor_payments').insert({
        vendor_id: form.vendor_id,
        purchase_order_id: form.purchase_order_id || null,
        amount: parseFloat(form.amount),
        payment_mode: form.payment_mode,
        payment_date: form.payment_date,
        utr_number: form.utr_number || null,
        notes: form.notes || null,
        status: 'completed',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Payment recorded!');
      setShowForm(false);
      setForm(EMPTY_FORM);
      qc.invalidateQueries({ queryKey: ['vendor-payments'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (payments as any[]).filter(p =>
    !search || p.vendor?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const f = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Vendor Payments</h1>
          <p className="text-sm text-gray-500">Track payments to fresh produce vendors</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-zoho-primary">
          <Plus className="h-4 w-4" /> Record Payment
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by vendor..." className="w-full rounded-xl border border-gray-200 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Record Payment</h2>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Vendor *</label>
                <select value={form.vendor_id} onChange={f('vendor_id')}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select vendor</option>
                  {(vendors as any[]).map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Amount (₹) *</label>
                  <input type="number" value={form.amount} onChange={f('amount')} min="0" placeholder="0"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Payment Date</label>
                  <input type="date" value={form.payment_date} onChange={f('payment_date')}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Mode</label>
                  <select value={form.payment_mode} onChange={f('payment_mode')}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">UTR / Ref #</label>
                  <input type="text" value={form.utr_number} onChange={f('utr_number')} placeholder="Optional"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <input type="text" value={form.notes} onChange={f('notes')} placeholder="Optional"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 btn-zoho-secondary justify-center py-2.5">Cancel</button>
              <button onClick={() => savePayment.mutate()} disabled={savePayment.isPending} className="flex-1 btn-zoho-primary justify-center py-2.5">
                <Check className="h-4 w-4" /> {savePayment.isPending ? 'Saving...' : 'Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="zoho-card">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading payments...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <CreditCard className="h-10 w-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No payments found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="zoho-table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Mode</th>
                  <th>UTR</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="font-medium text-slate-800">{p.vendor?.name}</td>
                    <td className="text-gray-500">{p.payment_date}</td>
                    <td className="font-semibold text-green-700">₹{Number(p.amount).toLocaleString('en-IN')}</td>
                    <td>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded capitalize">
                        {p.payment_mode?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="text-gray-400 text-xs">{p.utr_number ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
