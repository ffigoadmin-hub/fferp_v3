import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Star, TrendingUp, CheckCircle2, AlertCircle } from 'lucide-react';

export default function VendorPerformance() {
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors-all'],
    queryFn: async () => {
      const { data } = await supabase.from('vendors').select('id, name').eq('is_active', true).order('name');
      return data ?? [];
    },
  });

  const { data: poItems = [], isLoading } = useQuery({
    queryKey: ['po-items-month', monthStart],
    queryFn: async () => {
      const { data } = await supabase
        .from('purchase_order_items')
        .select('received_qty, ordered_qty, qc_grade, unit_price, po:purchase_orders(vendor_id, order_date, expected_delivery_date, actual_delivery_date, status)')
        .gte('created_at', `${monthStart}T00:00:00`)
        .lte('created_at', `${monthEnd}T23:59:59`);
      return data ?? [];
    },
  });

  // Aggregate per vendor
  const vendorStats: Record<string, {
    name: string;
    totalOrders: number;
    onTimeDeliveries: number;
    totalReceived: number;
    gradeAKg: number;
    totalSpend: number;
  }> = {};

  (vendors as any[]).forEach((v: any) => {
    vendorStats[v.id] = { name: v.name, totalOrders: 0, onTimeDeliveries: 0, totalReceived: 0, gradeAKg: 0, totalSpend: 0 };
  });

  (poItems as any[]).forEach((item: any) => {
    const vid = item.po?.vendor_id;
    if (!vid || !vendorStats[vid]) return;
    const s = vendorStats[vid];
    s.totalOrders++;
    s.totalReceived += Number(item.received_qty || 0);
    s.totalSpend += Number(item.received_qty || 0) * Number(item.unit_price || 0);
    if (item.qc_grade === 'A') s.gradeAKg += Number(item.received_qty || 0);
    if (item.po?.actual_delivery_date && item.po?.expected_delivery_date &&
      item.po.actual_delivery_date <= item.po.expected_delivery_date) {
      s.onTimeDeliveries++;
    }
  });

  const performanceList = Object.values(vendorStats)
    .filter(v => v.totalOrders > 0)
    .map(v => ({
      ...v,
      onTimeRate: v.totalOrders > 0 ? Math.round((v.onTimeDeliveries / v.totalOrders) * 100) : 0,
      gradeARate: v.totalReceived > 0 ? Math.round((v.gradeAKg / v.totalReceived) * 100) : 0,
      score: Math.round(
        (v.totalOrders > 0 ? (v.onTimeDeliveries / v.totalOrders) * 40 : 0) +
        (v.totalReceived > 0 ? (v.gradeAKg / v.totalReceived) * 60 : 0)
      ),
    }))
    .sort((a, b) => b.score - a.score);

  const ScoreBadge = ({ score }: { score: number }) => (
    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
      score >= 80 ? 'bg-green-100 text-green-700' :
      score >= 60 ? 'bg-yellow-100 text-yellow-700' :
      'bg-red-100 text-red-600'
    }`}>
      {score}
    </span>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Vendor Performance</h1>
        <p className="text-sm text-gray-500">This month's supplier scorecard</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-sm text-gray-400">Calculating performance...</div>
      ) : performanceList.length === 0 ? (
        <div className="text-center py-12">
          <Star className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">No vendor data for this month</p>
        </div>
      ) : (
        <div className="zoho-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="zoho-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Vendor</th>
                  <th className="text-center">Score</th>
                  <th className="text-right">On-Time %</th>
                  <th className="text-right">Grade A %</th>
                  <th className="text-right">Received (kg)</th>
                  <th className="text-right">Spend (₹)</th>
                </tr>
              </thead>
              <tbody>
                {performanceList.map((v, idx) => (
                  <tr key={v.name} className="hover:bg-slate-50/60">
                    <td>
                      <span className={`text-sm font-bold ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-orange-400' : 'text-gray-600'}`}>
                        #{idx + 1}
                      </span>
                    </td>
                    <td className="font-medium text-slate-800">{v.name}</td>
                    <td className="text-center"><ScoreBadge score={v.score} /></td>
                    <td className="text-right">
                      <span className={`font-semibold ${v.onTimeRate >= 90 ? 'text-green-600' : v.onTimeRate >= 70 ? 'text-amber-600' : 'text-red-500'}`}>
                        {v.onTimeRate}%
                      </span>
                    </td>
                    <td className="text-right">
                      <span className={`font-semibold ${v.gradeARate >= 80 ? 'text-green-600' : v.gradeARate >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
                        {v.gradeARate}%
                      </span>
                    </td>
                    <td className="text-right text-slate-700">{v.totalReceived.toFixed(1)}</td>
                    <td className="text-right text-slate-700">₹{v.totalSpend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
