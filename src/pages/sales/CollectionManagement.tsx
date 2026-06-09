import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays } from 'date-fns';
import { CheckCircle2, AlertTriangle, Phone, Search, Clock, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { logEvent } from '@/lib/audit';

const AGING_BUCKETS = [
  { label: '0–7 days',  min: 0,  max: 7,  color: 'bg-green-100 text-green-700' },
  { label: '8–15 days', min: 8,  max: 15, color: 'bg-yellow-100 text-yellow-700' },
  { label: '16–30 days',min: 16, max: 30, color: 'bg-orange-100 text-orange-700' },
  { label: '30+ days',  min: 31, max: Infinity, color: 'bg-red-100 text-red-700' },
];

function agingBucket(orderDate: string) {
  const days = differenceInDays(new Date(), new Date(orderDate));
  return AGING_BUCKETS.find(b => days >= b.min && days <= b.max) ?? AGING_BUCKETS[3];
}

export default function CollectionManagement() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [agingFilter, setAgingFilter] = useState('all');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['credit-collections'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sales_orders')
        .select(`
          id, order_number, order_date, net_amount, total_amount,
          payment_mode, payment_status, status,
          customer:customers(id, name, shop_name, phone, area, credit_days, wallet_balance)
        `)
        .eq('payment_mode', 'credit')
        .neq('payment_status', 'paid')
        .neq('status', 'cancelled')
        .order('order_date', { ascending: true });
      return data ?? [];
    },
  });

  const markCollected = useMutation({
    mutationFn: async (order: any) => {
      const { error } = await supabase
        .from('sales_orders')
        .update({ payment_status: 'paid' })
        .eq('id', order.id);
      if (error) throw error;
      return order;
    },
    onSuccess: (order) => {
      toast.success('Marked as collected');
      logEvent({
        entity_type: 'sales_order',
        entity_id: order.id,
        action: 'status_changed',
        description: `Collection recorded for ${order.order_number}: ₹${order.net_amount}`,
        payload: { order_number: order.order_number, amount: order.net_amount }
      });
      qc.invalidateQueries({ queryKey: ['credit-collections'] });
    },
    onError: () => toast.error('Failed to update'),
  });

  const allOrders = orders as any[];

  const filtered = allOrders.filter(o => {
    const matchSearch = !search ||
      (o.customer?.shop_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (o.customer?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (o.order_number ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (o.customer?.area ?? '').toLowerCase().includes(search.toLowerCase());

    if (!matchSearch) return false;
    if (agingFilter === 'all') return true;

    const days = differenceInDays(new Date(), new Date(o.order_date));
    if (agingFilter === '0-7')  return days >= 0 && days <= 7;
    if (agingFilter === '8-15') return days >= 8 && days <= 15;
    if (agingFilter === '16-30')return days >= 16 && days <= 30;
    if (agingFilter === '30+')  return days > 30;
    return true;
  });

  const totalDue = allOrders.reduce((s, o) => s + Number(o.net_amount || o.total_amount || 0), 0);
  const overdueCount = allOrders.filter(o => {
    const days = differenceInDays(new Date(), new Date(o.order_date));
    return days > (Number(o.customer?.credit_days) || 7);
  }).length;

  const agingSummary = AGING_BUCKETS.map(b => ({
    ...b,
    count: allOrders.filter(o => {
      const d = differenceInDays(new Date(), new Date(o.order_date));
      return d >= b.min && d <= b.max;
    }).length,
    amount: allOrders
      .filter(o => {
        const d = differenceInDays(new Date(), new Date(o.order_date));
        return d >= b.min && d <= b.max;
      })
      .reduce((s, o) => s + Number(o.net_amount || o.total_amount || 0), 0),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Collection Management</h1>
        <p className="text-sm text-gray-500">Pending customer credit payments & aging</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <Clock className="h-5 w-5 text-amber-500 mb-1" />
          <p className="text-xl font-bold text-amber-800">₹{(totalDue / 1000).toFixed(1)}k</p>
          <p className="text-xs text-amber-700">Total Outstanding</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xl font-bold text-gray-900">{allOrders.length}</p>
          <p className="text-xs text-gray-500">Pending Collections</p>
        </div>
        <div className={`rounded-xl border p-4 ${overdueCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <AlertTriangle className={`h-5 w-5 mb-1 ${overdueCount > 0 ? 'text-red-500' : 'text-gray-300'}`} />
          <p className={`text-xl font-bold ${overdueCount > 0 ? 'text-red-700' : 'text-gray-900'}`}>{overdueCount}</p>
          <p className={`text-xs ${overdueCount > 0 ? 'text-red-600' : 'text-gray-500'}`}>Overdue</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {agingSummary.map(b => (
          <button key={b.label} onClick={() => setAgingFilter(
            agingFilter === b.label.split(' ')[0] ? 'all' :
            b.min === 0 ? '0-7' : b.min === 8 ? '8-15' : b.min === 16 ? '16-30' : '30+'
          )}
            className={`rounded-xl border p-3 text-center transition-all ${b.color} ${
              b.count === 0 ? 'opacity-50' : ''
            }`}>
            <p className="text-xl font-bold">{b.count}</p>
            <p className="text-xs font-medium">{b.label}</p>
            {b.amount > 0 && (
              <p className="text-xs opacity-80 mt-0.5">₹{(b.amount / 1000).toFixed(1)}k</p>
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
        <Search className="h-4 w-4 text-gray-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by customer, order#, or area..."
          className="text-sm outline-none flex-1 bg-transparent" />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-300" />
          <p className="font-medium text-gray-500">
            {allOrders.length === 0 ? 'No pending collections!' : 'No orders match your filter'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="divide-y">
            {filtered.map((o: any) => {
              const bucket = agingBucket(o.order_date);
              const days = differenceInDays(new Date(), new Date(o.order_date));
              const amount = Number(o.net_amount || o.total_amount || 0);
              return (
                <div key={o.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-800">
                        {o.customer?.shop_name || o.customer?.name}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${bucket.color}`}>
                        {days}d old
                      </span>
                      {Number(o.customer?.wallet_balance) > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-green-100 text-green-700 flex items-center gap-1">
                          <Wallet className="h-3 w-3" /> Wallet: ₹{o.customer.wallet_balance}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {o.order_number}
                      {o.order_date && ` · ${format(new Date(o.order_date), 'dd MMM yyyy')}`}
                      {o.customer?.area && ` · ${o.customer.area}`}
                    </p>
                    {o.customer?.phone && (
                      <a href={`tel:${o.customer.phone}`}
                        className="flex items-center gap-1 text-xs text-green-600 mt-0.5">
                        <Phone className="h-3 w-3" /> {o.customer.phone}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <p className="text-base font-bold text-gray-900">₹{amount.toLocaleString()}</p>
                    <button onClick={() => markCollected.mutate(o)} disabled={markCollected.isPending}
                      className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Collected
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
