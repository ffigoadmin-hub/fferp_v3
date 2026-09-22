// @ts-nocheck   ← daily_stock_counts is missing from types.ts (see fferp-database)
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Building2, Loader2, RefreshCw, Save, ClipboardList, History } from 'lucide-react';
import { subDays } from 'date-fns';

interface StockRow {
  product_id: string;
  product_name: string;
  unit: string;
  opening_qty: number;
  closing_qty: number | null;
  dirty: boolean;
}

export default function DailyStockPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isHubLocked = !!(user as any)?.hub_id;
  const [hubId, setHubId] = useState((user as any)?.hub_id ?? '');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [rows, setRows] = useState<Record<string, StockRow>>({});
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'entry' | 'history'>('entry');
  const [historyFrom, setHistoryFrom] = useState(format(subDays(new Date(), 13), 'yyyy-MM-dd'));
  const [historyTo, setHistoryTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: hubs = [] } = useQuery({
    queryKey: ['hubs-active'],
    queryFn: async () => {
      const { data } = await supabase.from('hubs').select('id, name').eq('is_active', true);
      return data ?? [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, unit')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { isLoading, refetch, isFetching } = useQuery({
    queryKey: ['daily-stock-counts', hubId, date],
    enabled: !!hubId && products.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_stock_counts')
        .select('product_id, product_name, unit, opening_qty, closing_qty')
        .eq('hub_id', hubId)
        .eq('stock_date', date);
      if (error) throw error;

      // No count saved for this date yet — prefill Opening Qty from the current
      // live inventory level (itself last set by yesterday's closing count, or by
      // QC receiving) instead of always starting at 0, so the hub manager isn't
      // re-typing the same carried-forward number every morning.
      const { data: invRows, error: invErr } = await supabase
        .from('inventory')
        .select('product_id, quantity')
        .eq('hub_id', hubId);
      if (invErr) throw invErr;
      const inventoryByProduct = new Map((invRows ?? []).map((r: any) => [r.product_id, Number(r.quantity)]));

      const existing = new Map((data ?? []).map((r: any) => [r.product_id, r]));
      const merged: Record<string, StockRow> = {};
      for (const p of products) {
        const found = existing.get(p.id);
        merged[p.id] = {
          product_id: p.id,
          product_name: p.name,
          unit: p.unit || 'kg',
          opening_qty: found ? Number(found.opening_qty) : (inventoryByProduct.get(p.id) ?? 0),
          closing_qty: found?.closing_qty != null ? Number(found.closing_qty) : null,
          dirty: false,
        };
      }
      setRows(merged);
      return data ?? [];
    },
  });

  const { data: history = [], isLoading: historyLoading, refetch: refetchHistory, isFetching: historyFetching } = useQuery({
    queryKey: ['daily-stock-history', hubId, historyFrom, historyTo],
    enabled: !!hubId && view === 'history',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_stock_counts')
        .select('stock_date, product_name, unit, opening_qty, closing_qty, updated_at')
        .eq('hub_id', hubId)
        .gte('stock_date', historyFrom)
        .lte('stock_date', historyTo)
        .order('stock_date', { ascending: false })
        .order('product_name', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateRow = (productId: string, patch: Partial<StockRow>) =>
    setRows(prev => ({ ...prev, [productId]: { ...prev[productId], ...patch, dirty: true } }));

  const dirtyRows = useMemo(() => Object.values(rows).filter(r => r.dirty), [rows]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!dirtyRows.length) return;
      const payload = dirtyRows.map(r => ({
        hub_id: hubId,
        product_id: r.product_id,
        product_name: r.product_name,
        unit: r.unit,
        stock_date: date,
        opening_qty: r.opening_qty || 0,
        closing_qty: r.closing_qty,
        recorded_by: (user as any)?.id ?? null,
      }));
      const { error } = await supabase
        .from('daily_stock_counts')
        .upsert(payload, { onConflict: 'hub_id,product_id,stock_date' });
      if (error) throw error;

      // A closing count is a physical stock-take -- it becomes the day's true
      // inventory number (correcting for sales/wastage this app doesn't otherwise
      // deduct automatically), not just a side log. Rows with no closing_qty yet
      // (still mid-day) don't touch inventory.
      const closedRows = dirtyRows.filter(r => r.closing_qty != null);
      if (closedRows.length) {
        const invPayload = closedRows.map(r => ({
          hub_id: hubId,
          product_id: r.product_id,
          product_name: r.product_name,
          unit: r.unit,
          quantity: r.closing_qty,
          updated_at: new Date().toISOString(),
        }));
        const { error: invErr } = await supabase
          .from('inventory')
          .upsert(invPayload, { onConflict: 'hub_id,product_id' });
        if (invErr) throw new Error(`Stock count saved, but inventory update failed: ${invErr.message}`);
      }
    },
    onSuccess: () => {
      toast.success(`Saved stock count for ${dirtyRows.length} product${dirtyRows.length > 1 ? 's' : ''}`);
      qc.invalidateQueries({ queryKey: ['daily-stock-counts'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      refetch();
    },
    onError: (e: any) => toast.error(`Failed to save: ${e.message}`),
  });

  const filteredProducts = useMemo(
    () => products.filter((p: any) => !search || p.name.toLowerCase().includes(search.toLowerCase())),
    [products, search]
  );

  const hubName = (hubs as any[]).find(h => h.id === hubId)?.name ?? '';

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-12 pt-2">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 tracking-tight">Daily Stock Count</h1>
          <p className="text-[13px] text-slate-500">Manual opening / closing stock — one entry per product per day</p>
        </div>
        {view === 'entry' && (
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!dirtyRows.length || saveMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save {dirtyRows.length > 0 ? `(${dirtyRows.length})` : ''}
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setView('entry')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'entry' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <ClipboardList className="h-3.5 w-3.5" /> Today's Entry
        </button>
        <button
          onClick={() => setView('history')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'history' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <History className="h-3.5 w-3.5" /> History
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-slate-400" />
          {isHubLocked ? (
            <span className="text-sm font-medium text-slate-700">{hubName || 'My Hub'}</span>
          ) : (
            <select
              value={hubId}
              onChange={e => setHubId(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-md text-sm"
            >
              <option value="">Select hub…</option>
              {(hubs as any[]).map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          )}
        </div>
        {view === 'entry' ? (
          <>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-md text-sm"
            />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter product…"
              className="flex-1 min-w-[160px] px-3 py-2 border border-slate-200 rounded-md text-sm"
            />
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </>
        ) : (
          <>
            <span className="text-xs text-gray-500">From</span>
            <input
              type="date"
              value={historyFrom}
              onChange={e => setHistoryFrom(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-md text-sm"
            />
            <span className="text-xs text-gray-500">To</span>
            <input
              type="date"
              value={historyTo}
              onChange={e => setHistoryTo(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-md text-sm"
            />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter product…"
              className="flex-1 min-w-[160px] px-3 py-2 border border-slate-200 rounded-md text-sm"
            />
            <button
              onClick={() => refetchHistory()}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${historyFetching ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </>
        )}
      </div>

      {view === 'history' ? (
        !hubId ? (
          <div className="p-10 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
            Select a hub to view history.
          </div>
        ) : historyLoading ? (
          <div className="p-10 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Loading…
          </div>
        ) : (history as any[]).filter((r: any) => !search || r.product_name.toLowerCase().includes(search.toLowerCase())).length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
            <History className="h-10 w-10 mx-auto mb-3 text-gray-200" />
            No stock counts recorded in this date range.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-[110px_1fr_100px_100px_100px] gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">
              <span>Date</span>
              <span>Product</span>
              <span className="text-right">Opening</span>
              <span className="text-right">Closing</span>
              <span className="text-right">Net Change</span>
            </div>
            <div className="divide-y divide-gray-50">
              {(history as any[])
                .filter((r: any) => !search || r.product_name.toLowerCase().includes(search.toLowerCase()))
                .map((r: any, i: number) => {
                  const net = r.closing_qty != null ? Number(r.closing_qty) - Number(r.opening_qty) : null;
                  return (
                    <div key={`${r.stock_date}-${r.product_name}-${i}`} className="grid grid-cols-[110px_1fr_100px_100px_100px] gap-3 px-5 py-2.5 items-center hover:bg-gray-50">
                      <span className="text-sm text-gray-600">{format(new Date(r.stock_date), 'd MMM yyyy')}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{r.product_name}</p>
                        <p className="text-xs text-gray-400 uppercase">{r.unit}</p>
                      </div>
                      <span className="text-right text-sm text-gray-700">{Number(r.opening_qty)}</span>
                      <span className="text-right text-sm text-gray-700">{r.closing_qty != null ? Number(r.closing_qty) : '—'}</span>
                      <span className={`text-right text-sm font-semibold ${net == null ? 'text-gray-300' : net < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {net == null ? '—' : (net > 0 ? '+' : '') + net}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )
      ) : !hubId ? (
        <div className="p-10 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
          Select a hub to record stock counts.
        </div>
      ) : isLoading ? (
        <div className="p-10 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Loading…
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="p-10 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 text-gray-200" />
          No active products found.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_120px_100px] gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">
            <span>Product</span>
            <span className="text-right">Opening Qty</span>
            <span className="text-right">Closing Qty</span>
            <span className="text-right">Net Change</span>
          </div>
          <div className="divide-y divide-gray-50">
            {filteredProducts.map((p: any) => {
              const row = rows[p.id];
              if (!row) return null;
              const net = row.closing_qty != null ? row.closing_qty - row.opening_qty : null;
              return (
                <div key={p.id} className="grid grid-cols-[1fr_120px_120px_100px] gap-3 px-5 py-2.5 items-center hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.name}</p>
                    <p className="text-xs text-gray-400 uppercase">{row.unit}</p>
                  </div>
                  <input
                    type="number"
                    value={row.opening_qty}
                    onChange={e => updateRow(p.id, { opening_qty: Number(e.target.value) })}
                    className="text-right px-2 py-1.5 border border-gray-200 rounded-md text-sm"
                  />
                  <input
                    type="number"
                    value={row.closing_qty ?? ''}
                    onChange={e => updateRow(p.id, { closing_qty: e.target.value === '' ? null : Number(e.target.value) })}
                    placeholder="—"
                    className="text-right px-2 py-1.5 border border-gray-200 rounded-md text-sm"
                  />
                  <span className={`text-right text-sm font-semibold ${net == null ? 'text-gray-300' : net < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {net == null ? '—' : (net > 0 ? '+' : '') + net}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
