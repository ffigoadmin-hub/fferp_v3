import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Target, TrendingUp, Check, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

const EMPTY_FORM = {
  hub_id: '', target_revenue: '', target_orders: '', target_qty_kg: '',
  target_date: format(new Date(), 'yyyy-MM-dd'), target_type: 'daily', notes: '',
};

// Only these roles can set / delete targets
const TARGET_MANAGERS = ['ff_operations_manager', 'admin', 'ceo', 'gm'];

export default function SalesTargets() {
  const { user } = useAuth();
  const canManage = TARGET_MANAGERS.includes((user?.role || '').toLowerCase());
  const qc = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const monthDate  = new Date(selectedMonth + '-01');
  const monthStart = format(startOfMonth(monthDate), 'yyyy-MM-dd');
  const monthEnd   = format(endOfMonth(monthDate),   'yyyy-MM-dd');

  const { data: hubs = [] } = useQuery({
    queryKey: ['hubs-list'],
    queryFn: async () => {
      const { data } = await supabase.from('hubs').select('id, name').order('name');
      return data ?? [];
    },
  });

  const { data: targets = [] } = useQuery({
    queryKey: ['sales-targets', monthStart],
    queryFn: async () => {
      const { data } = await supabase
        .from('sales_targets')
        .select('*, hub:hubs(name)')
        .gte('target_date', monthStart)
        .lte('target_date', monthEnd)
        .order('target_date', { ascending: false });
      return data ?? [];
    },
  });

  const { data: actuals } = useQuery({
    queryKey: ['sales-actuals', monthStart],
    queryFn: async () => {
      const { data } = await supabase
        .from('sales_orders')
        .select('hub_id, net_amount, status, order_date')
        .gte('order_date', monthStart)
        .lte('order_date', monthEnd)
        .neq('status', 'cancelled');
      const orders = data ?? [];
      const delivered = orders.filter(o => o.status === 'delivered');
      return {
        totalRevenue: orders.reduce((s, o) => s + Number(o.net_amount || 0), 0),
        totalOrders:  orders.length,
        deliveredRevenue: delivered.reduce((s, o) => s + Number(o.net_amount || 0), 0),
      };
    },
  });

  const saveTarget = useMutation({
    mutationFn: async () => {
      if (!form.target_revenue && !form.target_orders) throw new Error('Set at least one target value');
      const { error } = await supabase.from('sales_targets').insert({
        hub_id: form.hub_id || null,
        target_date: form.target_date,
        target_type: form.target_type,
        target_revenue: Number(form.target_revenue) || 0,
        target_orders: Number(form.target_orders) || 0,
        target_qty_kg: Number(form.target_qty_kg) || 0,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Target set');
      setShowForm(false);
      setForm(EMPTY_FORM);
      qc.invalidateQueries({ queryKey: ['sales-targets'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTarget = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sales_targets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Target removed');
      qc.invalidateQueries({ queryKey: ['sales-targets'] });
    },
  });

  const allTargets = targets as any[];

  const totalTargetRevenue = allTargets.reduce((s, t) => s + Number(t.target_revenue || 0), 0);
  const totalTargetOrders  = allTargets.reduce((s, t) => s + Number(t.target_orders || 0), 0);
  const actualRevenue      = actuals?.totalRevenue ?? 0;
  const actualOrders       = actuals?.totalOrders ?? 0;

  const revenuePct  = totalTargetRevenue > 0 ? Math.min(100, (actualRevenue / totalTargetRevenue) * 100) : 0;
  const ordersPct   = totalTargetOrders > 0  ? Math.min(100, (actualOrders  / totalTargetOrders)  * 100) : 0;

  const progressColor = (pct: number) =>
    pct >= 100 ? 'bg-green-500' : pct >= 75 ? 'bg-blue-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Sales Targets</h1>
          <p className="text-sm text-gray-500">Set and track monthly targets vs actuals</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          {canManage && (
            <button onClick={() => { setShowForm(true); setForm(EMPTY_FORM); }}
              className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
              <Plus className="h-4 w-4" /> Set Target
            </button>
          )}
        </div>
      </div>

      {!canManage && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
          <Target className="h-4 w-4 shrink-0 text-blue-500" />
          Targets are set by your FF Operations Manager. This page shows your current progress.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span className="font-semibold text-gray-800">Revenue</span>
            </div>
            <span className={`text-sm font-bold ${revenuePct >= 100 ? 'text-green-600' : revenuePct >= 75 ? 'text-blue-600' : 'text-amber-600'}`}>
              {revenuePct.toFixed(1)}%
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden mb-3">
            <div className={`h-full rounded-full transition-all ${progressColor(revenuePct)}`}
              style={{ width: `${revenuePct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Actual: <strong className="text-gray-800">₹{(actualRevenue / 1000).toFixed(1)}k</strong></span>
            <span>Target: <strong className="text-gray-800">₹{(totalTargetRevenue / 1000).toFixed(1)}k</strong></span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-gray-800">Orders</span>
            </div>
            <span className={`text-sm font-bold ${ordersPct >= 100 ? 'text-green-600' : ordersPct >= 75 ? 'text-blue-600' : 'text-amber-600'}`}>
              {ordersPct.toFixed(1)}%
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden mb-3">
            <div className={`h-full rounded-full transition-all ${progressColor(ordersPct)}`}
              style={{ width: `${ordersPct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Actual: <strong className="text-gray-800">{actualOrders}</strong></span>
            <span>Target: <strong className="text-gray-800">{totalTargetOrders}</strong></span>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Set Sales Target</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Hub (optional)</label>
                  <select value={form.hub_id} onChange={e => setForm(f => ({ ...f, hub_id: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">All Hubs</option>
                    {(hubs as any[]).map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <select value={form.target_type} onChange={e => setForm(f => ({ ...f, target_type: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                <input type="date" value={form.target_date} onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Revenue (₹)</label>
                  <input type="number" value={form.target_revenue} onChange={e => setForm(f => ({ ...f, target_revenue: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="0" min="0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Orders</label>
                  <input type="number" value={form.target_orders} onChange={e => setForm(f => ({ ...f, target_orders: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="0" min="0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Qty (kg)</label>
                  <input type="number" value={form.target_qty_kg} onChange={e => setForm(f => ({ ...f, target_qty_kg: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="0" min="0" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Optional" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)}
                className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={() => saveTarget.mutate()} disabled={saveTarget.isPending}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                <Check className="h-4 w-4" />
                {saveTarget.isPending ? 'Saving...' : 'Set Target'}
              </button>
            </div>
          </div>
        </div>
      )}

      {allTargets.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Target className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-500">No targets set for this month</p>
          <p className="text-sm text-gray-400 mt-1">Click "Set Target" to define your sales goals</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h2 className="font-semibold text-gray-800">Target Records</h2>
          </div>
          <div className="divide-y">
            {allTargets.map((t: any) => (
              <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">
                      {t.hub?.name ?? 'All Hubs'}
                    </span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded capitalize">
                      {t.target_type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {format(new Date(t.target_date), 'dd MMM yyyy')}
                    {t.notes ? ` · ${t.notes}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-600 flex-shrink-0">
                  {Number(t.target_revenue) > 0 && (
                    <div className="text-right">
                      <p className="font-semibold text-gray-800">₹{Number(t.target_revenue).toLocaleString()}</p>
                      <p className="text-gray-400">revenue</p>
                    </div>
                  )}
                  {Number(t.target_orders) > 0 && (
                    <div className="text-right">
                      <p className="font-semibold text-gray-800">{t.target_orders}</p>
                      <p className="text-gray-400">orders</p>
                    </div>
                  )}
                  {canManage && (
                    <button onClick={() => deleteTarget.mutate(t.id)} disabled={deleteTarget.isPending}
                      className="text-gray-300 hover:text-red-500 transition-colors p-1">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
