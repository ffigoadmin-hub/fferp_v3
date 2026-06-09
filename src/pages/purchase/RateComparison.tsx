import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays } from 'date-fns';
import { BarChart2, TrendingDown, TrendingUp } from 'lucide-react';

export default function RateComparison() {
  const [days, setDays] = useState(7);

  const since = format(subDays(new Date(), days), 'yyyy-MM-dd');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['rate-comparison', since],
    queryFn: async () => {
      const { data } = await supabase
        .from('purchase_order_items')
        .select('unit_price, received_qty, product:products(name), po:purchase_orders(order_date, vendor:vendors(name))')
        .gte('created_at', `${since}T00:00:00`)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  // Group by product
  const byProduct: Record<string, { name: string; rates: { vendor: string; price: number; date: string }[] }> = {};
  (items as any[]).forEach((item: any) => {
    const name = item.product?.name ?? 'Unknown';
    if (!byProduct[name]) byProduct[name] = { name, rates: [] };
    byProduct[name].rates.push({
      vendor: item.po?.vendor?.name ?? '?',
      price: Number(item.unit_price),
      date: item.po?.order_date ?? '',
    });
  });

  const products = Object.values(byProduct).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Rate Comparison</h1>
          <p className="text-sm text-gray-500">Vendor price trends by product</p>
        </div>
        <select value={days} onChange={e => setDays(Number(e.target.value))}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-sm text-gray-400">Loading rates...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-12">
          <BarChart2 className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">No purchase data in this period</p>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map(product => {
            const rates = product.rates;
            const minRate = Math.min(...rates.map(r => r.price));
            const maxRate = Math.max(...rates.map(r => r.price));
            const avgRate = rates.reduce((s, r) => s + r.price, 0) / rates.length;
            return (
              <div key={product.name} className="zoho-card">
                <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
                  <h2 className="font-semibold text-slate-800">{product.name}</h2>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1 text-green-600 font-semibold">
                      <TrendingDown className="h-3.5 w-3.5" /> ₹{minRate}/kg (best)
                    </span>
                    <span className="flex items-center gap-1 text-red-500 font-semibold">
                      <TrendingUp className="h-3.5 w-3.5" /> ₹{maxRate}/kg (highest)
                    </span>
                    <span>Avg ₹{avgRate.toFixed(1)}</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="zoho-table">
                    <thead>
                      <tr>
                        <th>Vendor</th>
                        <th>Rate (₹/kg)</th>
                        <th>Date</th>
                        <th>vs Best</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rates
                        .sort((a, b) => a.price - b.price)
                        .map((r, i) => {
                          const diff = ((r.price - minRate) / minRate * 100).toFixed(1);
                          return (
                            <tr key={i} className={`hover:bg-slate-50/60 ${r.price === minRate ? 'bg-green-50/50' : ''}`}>
                              <td className="font-medium">{r.vendor}</td>
                              <td className={`font-semibold ${r.price === minRate ? 'text-green-700' : r.price === maxRate ? 'text-red-600' : ''}`}>
                                ₹{r.price}
                              </td>
                              <td className="text-gray-400">{r.date}</td>
                              <td>
                                {r.price === minRate ? (
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Best</span>
                                ) : (
                                  <span className="text-xs text-red-600">+{diff}%</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
