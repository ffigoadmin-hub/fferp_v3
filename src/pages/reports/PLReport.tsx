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

type Dimension = 'product' | 'hub' | 'channel';

export default function PLReport() {
  const [dimension, setDimension] = useState<Dimension>('product');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  const monthDate = new Date(selectedMonth + '-01');
  const monthStart = format(startOfMonth(monthDate), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd');

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

  const { data: channelPL = [] } = useQuery({
    queryKey: ['pl-channel', monthStart],
    queryFn: async () => {
      const { data } = await supabase
        .from('sales_orders')
        .select('payment_mode, net_amount')
        .gte('order_date', monthStart)
        .neq('status', 'cancelled');

      const map: Record<string, number> = {};
      (data ?? []).forEach(o => {
        const mode = o.payment_mode ?? 'unknown';
        map[mode] = (map[mode] ?? 0) + (Number(o.net_amount) || 0);
      });

      return Object.entries(map).map(([channel, revenue]) => ({
        name: channel.toUpperCase(),
        revenue,
        cost: 0,
        profit: revenue * 0.15,
        margin: 15,
      }));
    },
    enabled: dimension === 'channel',
  });

  const activeData = dimension === 'product' ? productPL
    : dimension === 'hub' ? hubPL
    : channelPL;

  const totalRevenue = (activeData as any[]).reduce((s, d) => s + (d.revenue || 0), 0);
  const totalCost = (activeData as any[]).reduce((s, d) => s + (d.cost || 0), 0);
  const totalProfit = totalRevenue - totalCost;
  const totalMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0';

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
          <p className="text-sm text-gray-500">Profit & Loss by {dimension}</p>
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
        {(['product', 'hub', 'channel'] as const).map(d => (
          <button key={d}
            onClick={() => setDimension(d)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all capitalize ${
              dimension === d ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-800'
            }`}>
            By {d}
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
          <p className={`text-xl font-bold ${totalProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {totalProfit >= 0 ? '+' : ''}₹{(Math.abs(totalProfit) / 100000).toFixed(2)}L
          </p>
        </div>
        <div className={`rounded-xl border p-4 text-center ${parseFloat(totalMargin) >= 15 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          <p className="text-xs text-gray-500 mb-1">Margin</p>
          <p className={`text-xl font-bold ${parseFloat(totalMargin) >= 15 ? 'text-green-700' : 'text-amber-700'}`}>
            {totalMargin}%
          </p>
        </div>
      </div>

      {(activeData as any[]).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Revenue vs Cost by {dimension}</h2>
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
              <Bar dataKey="cost" name="Cost" fill={COLORS.cost} radius={4} />
              <Bar dataKey="profit" name="Profit" fill={COLORS.profit} radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-5 gap-3 px-5 py-3 text-xs font-semibold text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
          <div className="col-span-2 capitalize">{dimension}</div>
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
