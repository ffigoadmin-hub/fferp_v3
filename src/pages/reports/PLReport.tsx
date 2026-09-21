import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Download } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

type Dimension = 'overall' | 'product' | 'hub' | 'channel';

export default function PLReport() {
  const [dimension, setDimension] = useState<Dimension>('overall');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  const monthDate = new Date(selectedMonth + '-01');
  const monthStart = format(startOfMonth(monthDate), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd');

  // Whole-business total — a direct query, not derived from summing one of
  // the per-dimension breakdowns below, so it's unaffected by any one
  // dimension's data limitations (see the channel dimension's honest
  // "cost not available" note further down).
  const { data: overallPL = [] } = useQuery({
    queryKey: ['pl-overall', monthStart],
    queryFn: async () => {
      const { data: orders, error: ordersErr } = await supabase
        .from('sales_orders')
        .select('net_amount, status')
        .gte('order_date', monthStart)
        .lte('order_date', monthEnd)
        .neq('status', 'cancelled');
      if (ordersErr) throw ordersErr;

      const { data: pos, error: posErr } = await supabase
        .from('purchase_orders')
        .select('total_amount, status')
        .gte('order_date', monthStart)
        .lte('order_date', monthEnd)
        .neq('status', 'cancelled');
      if (posErr) throw posErr;

      const revenue = (orders ?? []).reduce((s, o: any) => s + (Number(o.net_amount) || 0), 0);
      const cost = (pos ?? []).reduce((s, p: any) => s + (Number(p.total_amount) || 0), 0);
      return [{
        name: 'Farmers Factory — Overall',
        revenue, cost,
        profit: revenue - cost,
        margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
      }];
    },
    enabled: dimension === 'overall',
  });

  const { data: productPL = [] } = useQuery({
    queryKey: ['pl-product', monthStart],
    queryFn: async () => {
      const { data: items } = await supabase
        .from('sales_order_items')
        .select(`qty_kg, unit_price, total_price, product:products(name, grade_a_price), order:sales_orders(status, order_date)`)
        .gte('created_at', `${monthStart}T00:00:00`)
        .lte('created_at', `${monthEnd}T23:59:59`);

      const { data: poItems } = await supabase
        .from('purchase_order_items')
        .select('product_id, received_qty, unit_price, product:products(name)')
        .gte('created_at', `${monthStart}T00:00:00`)
        .lte('created_at', `${monthEnd}T23:59:59`);

      const salesMap: Record<string, { name: string; revenue: number; qty: number }> = {};
      (items ?? []).forEach((item: any) => {
        if (item.order?.status === 'cancelled') return;
        const name = item.product?.name ?? 'Unknown';
        if (!salesMap[name]) salesMap[name] = { name, revenue: 0, qty: 0 };
        salesMap[name].revenue += Number(item.total_price) || 0;
        salesMap[name].qty += Number(item.qty_kg) || 0;
      });

      const costMap: Record<string, number> = {};
      (poItems ?? []).forEach((item: any) => {
        const name = item.product?.name ?? 'Unknown';
        costMap[name] = (costMap[name] ?? 0) + (Number(item.received_qty) * Number(item.unit_price) || 0);
      });

      return Object.values(salesMap)
        .map(s => ({
          name: s.name,
          revenue: s.revenue,
          cost: costMap[s.name] ?? 0,
          profit: s.revenue - (costMap[s.name] ?? 0),
          margin: s.revenue > 0 ? (((s.revenue - (costMap[s.name] ?? 0)) / s.revenue) * 100) : 0,
          qty: s.qty,
        }))
        .sort((a, b) => b.profit - a.profit);
    },
    enabled: dimension === 'product',
  });

  const { data: hubPL = [] } = useQuery({
    queryKey: ['pl-hub', monthStart],
    queryFn: async () => {
      const { data: hubs } = await supabase.from('hubs').select('id, name');
      const { data: orders } = await supabase
        .from('sales_orders')
        .select('hub_id, net_amount, status')
        .gte('order_date', monthStart)
        .lte('order_date', monthEnd)
        .neq('status', 'cancelled');

      const { data: pos } = await supabase
        .from('purchase_orders')
        .select('hub_id, total_amount')
        .gte('order_date', monthStart)
        .lte('order_date', monthEnd)
        .neq('status', 'cancelled');

      return (hubs ?? []).map(hub => {
        const revenue = (orders ?? [])
          .filter(o => o.hub_id === hub.id)
          .reduce((s, o) => s + (Number(o.net_amount) || 0), 0);
        const cost = (pos ?? [])
          .filter(p => p.hub_id === hub.id)
          .reduce((s, p) => s + (Number(p.total_amount) || 0), 0);
        return {
          name: hub.name,
          revenue,
          cost,
          profit: revenue - cost,
          margin: revenue > 0 ? (((revenue - cost) / revenue) * 100) : 0,
        };
      });
    },
    enabled: dimension === 'hub',
  });

  // Cost isn't trackable per sales channel anywhere in this schema —
  // purchase orders aren't linked to which channel eventually sells the
  // stock. Previously this hardcoded cost=0 / profit=revenue*0.15 for every
  // row, which is exactly why the summary cards showed a flat, fake 100%
  // margin. Now: real revenue (grouped by sales_orders.source — the actual
  // live channel column; payment_mode was the wrong field, that's how the
  // customer paid, not which channel the order came through), cost/profit/
  // margin rendered as "Not Available" instead of a fabricated number.
  const { data: channelPL = [] } = useQuery({
    queryKey: ['pl-channel', monthStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_orders')
        .select('source, net_amount')
        .gte('order_date', monthStart)
        .lte('order_date', monthEnd)
        .neq('status', 'cancelled');
      if (error) throw error;

      const map: Record<string, number> = {};
      (data ?? []).forEach((o: any) => {
        const src = o.source ?? 'manual';
        map[src] = (map[src] ?? 0) + (Number(o.net_amount) || 0);
      });

      return Object.entries(map).map(([channel, revenue]) => ({
        name: channel.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        revenue,
        cost: null,
        profit: null,
        margin: null,
        costAvailable: false,
      }));
    },
    enabled: dimension === 'channel',
  });

  const activeData = dimension === 'overall' ? overallPL
    : dimension === 'product' ? productPL
    : dimension === 'hub' ? hubPL
    : channelPL;

  // Channel rows have cost=null (no per-channel cost data exists) — treat
  // that as "the whole dimension has no cost data" rather than silently
  // summing null as 0, which is exactly what produced the fake 100% margin
  // before (revenue - 0 = revenue, however many rows contributed).
  const costAvailable = (activeData as any[]).every(d => d.cost !== null && d.cost !== undefined);
  const totalRevenue = (activeData as any[]).reduce((s, d) => s + (d.revenue || 0), 0);
  const totalCost = costAvailable ? (activeData as any[]).reduce((s, d) => s + (d.cost || 0), 0) : null;
  const totalProfit = costAvailable ? totalRevenue - (totalCost as number) : null;
  const totalMargin = costAvailable && totalRevenue > 0 ? ((totalProfit as number / totalRevenue) * 100).toFixed(1) : null;

  const exportExcel = () => {
    const rows = (activeData as any[]).map(d => ({
      [dimension.charAt(0).toUpperCase() + dimension.slice(1)]: d.name,
      'Revenue (₹)': d.revenue?.toFixed(0),
      'Cost (₹)': d.cost?.toFixed(0),
      'Profit (₹)': d.profit?.toFixed(0),
      'Margin %': d.margin?.toFixed(1),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'P&L Report');
    XLSX.writeFile(wb, `FF_PL_${dimension}_${selectedMonth}.xlsx`);
    toast.success('Exported!');
  };

  const COLORS = { revenue: '#10b981', cost: '#ef4444', profit: '#3b82f6' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">P&L Report</h1>
          <p className="text-sm text-gray-500">{dimension === 'overall' ? 'Overall Profit & Loss' : `Profit & Loss by ${dimension}`}</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          <button onClick={exportExcel}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            <Download className="h-4 w-4" /> Export
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(['overall', 'product', 'hub', 'channel'] as const).map(d => (
          <button key={d}
            onClick={() => setDimension(d)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all capitalize ${
              dimension === d ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-800'
            }`}>
            {d === 'overall' ? 'Overall' : `By ${d}`}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Revenue</p>
          <p className="text-xl font-bold text-gray-900">₹{(totalRevenue / 100000).toFixed(2)}L</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Gross Profit</p>
          {costAvailable ? (
            <p className={`text-xl font-bold ${(totalProfit as number) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {(totalProfit as number) >= 0 ? '+' : ''}₹{(Math.abs(totalProfit as number) / 100000).toFixed(2)}L
            </p>
          ) : (
            <p className="text-xl font-bold text-gray-300">—</p>
          )}
        </div>
        <div className={`rounded-xl border p-4 text-center ${!costAvailable ? 'bg-gray-50 border-gray-200' : parseFloat(totalMargin as string) >= 15 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          <p className="text-xs text-gray-500 mb-1">Margin</p>
          {costAvailable ? (
            <p className={`text-xl font-bold ${parseFloat(totalMargin as string) >= 15 ? 'text-green-700' : 'text-amber-700'}`}>
              {totalMargin}%
            </p>
          ) : (
            <p className="text-xl font-bold text-gray-300">—</p>
          )}
        </div>
      </div>
      {!costAvailable && (
        <p className="text-xs text-gray-400 -mt-2">
          No per-channel cost data exists in this schema (purchases aren't tracked by sales channel) — showing revenue only.
        </p>
      )}

      {(activeData as any[]).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">{dimension === 'overall' ? 'Revenue vs Cost' : `Revenue vs Cost by ${dimension}`}</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={activeData} layout={dimension === 'product' ? 'vertical' : 'horizontal'}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              {dimension === 'product' ? (
                <>
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: '#6b7280' }} />
                </>
              ) : (
                <>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                </>
              )}
              <Tooltip
                formatter={(v: number, name) => [`₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, name]}
                contentStyle={{ borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: 12 }} />
              <Legend />
              <Bar dataKey="revenue" name="Revenue" fill={COLORS.revenue} radius={4} />
              {costAvailable && <Bar dataKey="cost" name="Cost" fill={COLORS.cost} radius={4} />}
              {costAvailable && <Bar dataKey="profit" name="Profit" fill={COLORS.profit} radius={4} />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-5 gap-3 px-5 py-3 text-xs font-semibold text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
          <div className="col-span-2 capitalize">{dimension === 'overall' ? 'Business' : dimension}</div>
          <div className="text-right">Revenue</div>
          <div className="text-right">Profit</div>
          <div className="text-right">Margin</div>
        </div>
        <div className="divide-y divide-gray-50">
          {(activeData as any[]).map((row: any, idx) => (
            <div key={idx} className="grid grid-cols-5 gap-3 px-5 py-3 items-center hover:bg-gray-50">
              <div className="col-span-2">
                <p className="text-sm font-medium text-gray-800">{row.name}</p>
                {row.qty && <p className="text-xs text-gray-400">{row.qty.toFixed(1)} kg sold</p>}
              </div>
              <div className="text-right text-sm text-gray-700">
                ₹{Number(row.revenue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
              {row.cost === null || row.cost === undefined ? (
                <>
                  <div className="text-right text-sm text-gray-300">—</div>
                  <div className="text-right"><span className="text-xs text-gray-300">—</span></div>
                </>
              ) : (
                <>
                  <div className={`text-right text-sm font-semibold ${row.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {row.profit >= 0 ? '+' : ''}₹{Number(row.profit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-semibold rounded px-1.5 py-0.5 ${
                      row.margin >= 20 ? 'bg-green-100 text-green-700' :
                      row.margin >= 10 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-600'
                    }`}>
                      {Number(row.margin).toFixed(1)}%
                    </span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
