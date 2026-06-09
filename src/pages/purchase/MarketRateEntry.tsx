import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Plus, X, Check, TrendingUp } from 'lucide-react';

export default function MarketRateEntry() {
  const qc = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(today);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ product_id: '', market_name: '', price_per_kg: '', source: '' });

  const { data: products = [] } = useQuery({
    queryKey: ['products-active'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id, name').eq('is_active', true).order('name');
      return data ?? [];
    },
  });

  const { data: rates = [], isLoading, refetch } = useQuery({
    queryKey: ['market-rates', selectedDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('market_rates')
        .select('*, product:products(name)')
        .eq('rate_date', selectedDate)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const saveRate = useMutation({
    mutationFn: async () => {
      if (!form.product_id || !form.price_per_kg) throw new Error('Product and price required');
      const { error } = await supabase.from('market_rates').insert({
        product_id: form.product_id,
        market_name: form.market_name || 'General',
        price_per_kg: parseFloat(form.price_per_kg),
        rate_date: selectedDate,
        source: form.source || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Market rate added!');
      setShowForm(false);
      setForm({ product_id: '', market_name: '', price_per_kg: '', source: '' });
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Market Rate Entry</h1>
          <p className="text-sm text-gray-500">Track daily wholesale market prices</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={() => setShowForm(true)} className="btn-zoho-primary">
            <Plus className="h-4 w-4" /> Add Rate
          </button>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Add Market Rate</h2>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Product *</label>
                <select value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select product</option>
                  {(products as any[]).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Market Name</label>
                  <input type="text" value={form.market_name} onChange={e => setForm(f => ({ ...f, market_name: e.target.value }))}
                    placeholder="e.g. Chennai APMC"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Price (₹/kg) *</label>
                  <input type="number" value={form.price_per_kg} onChange={e => setForm(f => ({ ...f, price_per_kg: e.target.value }))}
                    min="0" step="0.5" placeholder="0.00"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Source / Reference</label>
                <input type="text" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                  placeholder="Optional"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 btn-zoho-secondary justify-center py-2.5">Cancel</button>
              <button onClick={() => saveRate.mutate()} disabled={saveRate.isPending} className="flex-1 btn-zoho-primary justify-center py-2.5">
                <Check className="h-4 w-4" /> {saveRate.isPending ? 'Saving...' : 'Save Rate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rates table */}
      <div className="zoho-card">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
        ) : (rates as any[]).length === 0 ? (
          <div className="p-8 text-center">
            <TrendingUp className="h-10 w-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No market rates for {selectedDate}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="zoho-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Market</th>
                  <th>Rate (₹/kg)</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {(rates as any[]).map((r: any) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="font-medium text-slate-800">{r.product?.name}</td>
                    <td>{r.market_name}</td>
                    <td className="font-semibold text-[#2C64E3]">₹{r.price_per_kg}</td>
                    <td className="text-gray-400 text-xs">{r.source ?? '—'}</td>
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
