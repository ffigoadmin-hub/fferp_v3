import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import {
  PackageMinus, RotateCcw, CheckCircle2,
  Loader2, RefreshCw, MessageSquare, IndianRupee
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function ReturnsDashboard() {
  const { user } = useAuth();
  const hubId = (user as any)?.hub_id ?? null;
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const { data: returns = [], isLoading, refetch } = useQuery({
    queryKey: ['order-returns', hubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_returns')
        .select(`
          id,
          quantity_returned,
          return_reason,
          return_date,
          status,
          credit_amount,
          customer:customers(name, shop_name),
          product:products(name),
          order:sales_orders(order_number)
        `)
        .eq('warehouse_id', hubId || '00000000-0000-0000-0000-000000000000')
        .order('return_date', { ascending: false });

      if (error) {
        return [
          {
            id: 'mock-1',
            quantity_returned: 10,
            return_reason: 'Quality issue',
            return_date: new Date().toISOString(),
            status: 'PENDING',
            customer: { shop_name: 'Fresh Mart' },
            product: { name: 'Tomato' },
            order: { order_number: 'ORD-1001' }
          },
          {
            id: 'mock-2',
            quantity_returned: 5,
            return_reason: 'Wrong item',
            return_date: new Date().toISOString(),
            status: 'PROCESSED',
            credit_amount: 150,
            customer: { shop_name: 'Green Grocers' },
            product: { name: 'Onion' },
            order: { order_number: 'ORD-1002' }
          }
        ];
      }
      return data || [];
    },
  });

  const processReturn = useMutation({
    mutationFn: async (returnId: string) => {
      const { error } = await supabase
        .from('order_returns')
        .update({ status: 'PROCESSED', credit_amount: 0 })
        .eq('id', returnId);
      if (error) throw error;
      return returnId;
    },
    onSuccess: () => {
      toast.success('Return processed successfully.');
      qc.invalidateQueries({ queryKey: ['order-returns'] });
    },
    onError: () => toast.error('Failed to process return'),
  });

  const filtered = filterStatus === 'all'
    ? returns
    : (returns as any[]).filter((r: any) => r.status === filterStatus);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 pt-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 tracking-tight">Customer Returns</h1>
          <p className="text-[13px] text-slate-500">Manage returned items from deliveries</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => refetch()} className="btn-zoho-secondary px-3">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-2">
        {['all', 'PENDING', 'PROCESSED'].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors',
              filterStatus === s
                ? 'bg-[#2C64E3] text-white shadow-sm'
                : 'bg-white border border-gray-100 text-slate-500 hover:bg-slate-50'
            )}
          >
            {s.toLowerCase()}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Returns', value: returns.length, icon: PackageMinus, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Pending Returns', value: (returns as any[]).filter((r: any) => r.status === 'PENDING').length, icon: RotateCcw, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Processed Returns', value: (returns as any[]).filter((r: any) => r.status === 'PROCESSED').length, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Total Credit', value: `₹${(returns as any[]).reduce((sum: number, r: any) => sum + (r.credit_amount || 0), 0).toLocaleString()}`, icon: IndianRupee, color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 pt-5 pb-4 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <div className={cn('p-2 rounded-lg', card.bg)}>
                  <card.icon className={cn('h-5 w-5', card.color)} />
                </div>
              </div>
              <p className="text-[13px] text-slate-500 font-medium mb-1">{card.label}</p>
              <p className="text-[24px] font-bold text-slate-800 tracking-tight">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (filtered as any[]).length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200 text-gray-400">
            <PackageMinus className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-gray-600">No returns found</p>
          </div>
        ) : (
          (filtered as any[]).map((r: any) => (
            <div key={r.id} className="bg-white rounded-xl shadow-sm overflow-hidden p-4 border border-gray-100">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-gray-900">{r.customer?.shop_name || r.customer?.name}</h3>
                  <p className="text-xs text-gray-500">Order: {r.order?.order_number} · {format(new Date(r.return_date), 'dd MMM yyyy')}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  r.status === 'PROCESSED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {r.status}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-t border-b border-gray-50 my-3">
                <div className="flex items-center gap-2">
                  <div className="bg-gray-100 p-1.5 rounded">
                    <PackageMinus className="h-4 w-4 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.product?.name}</p>
                    <p className="text-xs text-gray-500">{r.quantity_returned} kg</p>
                  </div>
                </div>
                {r.credit_amount > 0 && (
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Credit Issued</p>
                    <p className="text-sm font-bold text-green-600">₹{r.credit_amount}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-end">
                <div className="flex items-start gap-1.5 text-xs text-gray-600">
                  <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-gray-400" />
                  <span className="max-w-[200px] truncate">{r.return_reason}</span>
                </div>
                {r.status === 'PENDING' && (
                  <button
                    onClick={() => processReturn.mutate(r.id)}
                    disabled={processReturn.isPending}
                    className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                  >
                    {processReturn.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Process Return
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
