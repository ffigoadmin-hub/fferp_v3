import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';
import { BarChart2, Plus, X, Check, Loader2 } from 'lucide-react';

export default function DemandForecast() {
  const { user } = useAuth();
  const hubId = (user as any)?.hub_id ?? null;
  const qc = useQueryClient();

  const today = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  const [selectedDate, setSelectedDate] = useState(tomorrow);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ product_id: '', forecasted_qty: '', notes: '' });
  const [calculating, setCalculating] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ['products-active'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id, name').eq('is_active', true).order('name');
      return data ?? [];
    },
  });

  const { data: forecasts = [], isLoading, refetch } = useQuery({
    queryKey: ['demand-forecasts', selectedDate, hubId],
    queryFn: async () => {
      let q = supabase
        .from('demand_forecasts')
        .select('*, product:products(name)')
        .eq('forecast_date', selectedDate)
        .order('forecasted_qty', { ascending: false });
      if (hubId) q = q.eq('hub_id', hubId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const saveForecast = useMutation({
    mutationFn: async () => {
      if (!form.product_id || !form.forecasted_qty) throw new Error('Product and quantity required');
      const { error } = await supabase.from('demand_forecasts').insert({
        product_id: form.product_id,
        hub_id: hubId,
        forecast_date: selectedDate,
        forecasted_qty: parseFloat(form.forecasted_qty),
        notes: form.notes || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Forecast added!');
      setShowForm(false);
      setForm({ product_id: '', forecasted_qty: '', notes: '' });
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const calculateForecast = async () => {
    setCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-demand-forecast', {
        body: { forecast_date: selectedDate, hub_id: hubId },
      });
      if (error) throw error;
      toast.success('AI forecast calculated!');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Forecast calculation failed');
    } finally {
      setCalculating(false);
    }
  };

  const totalForecast = (forecasts as any[]).reduce((s, f) => s + Number(f.forecasted_qty || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Demand Forecast</h1>
          <p className="text-sm text-gray-500">Plan purchase quantities based on demand</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={calculateForecast} disabled={calculating}
            className="btn-zoho-secondary">
            {calculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart2 className="h-4 w-4" />}
            {calculating ? 'Calculating...' : 'Auto Forecast'}
          </button>
          <button onClick={() => setShowForm(true)} className="btn-zoho-primary">
            <Plus className="h-4 w-4" /> Add Manual
          </button>
        </div>
      </div>

      {/* Summary */}
      {(forecasts as any[]).length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 flex items-center justify-between">
          <p className="text-sm text-blue-800 font-medium">
            Total forecasted demand for {selectedDate}
          </p>
          <p className="text-xl font-bold text-blue-700">{totalForecast.toFixed(1)} kg</p>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Add Forecast</h2>
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
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Forecasted Qty (kg) *</label>
                <input type="number" value={form.forecasted_qty}
                  onChange={e => setForm(f => ({ ...f, forecasted_qty: e.target.value }))}
                  min="0" step="0.5" placeholder="0"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Reason / context"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 btn-zoho-secondary justify-center py-2.5">Cancel</button>
              <button onClick={() => saveForecast.mutate()} disabled={saveForecast.isPending} className="flex-1 btn-zoho-primary justify-center py-2.5">
                <Check className="h-4 w-4" /> {saveForecast.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forecasts table */}
      <div className="zoho-card">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading forecasts...</div>
        ) : (forecasts as any[]).length === 0 ? (
          <div className="p-8 text-center">
            <BarChart2 className="h-10 w-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No forecasts for {selectedDate}</p>
            <p className="text-xs text-gray-400 mt-1">Click "Auto Forecast" or add manually</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="zoho-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="text-right">Forecasted Qty</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {(forecasts as any[]).map((f: any) => (
                  <tr key={f.id} className="hover:bg-slate-50/60">
                    <td className="font-medium text-slate-800">{f.product?.name}</td>
                    <td className="text-right font-semibold text-[#2C64E3]">{f.forecasted_qty} kg</td>
                    <td className="text-gray-400 text-xs">{f.notes ?? '—'}</td>
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
