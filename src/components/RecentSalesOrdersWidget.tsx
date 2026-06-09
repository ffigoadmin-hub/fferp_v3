import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ShoppingBag, ChevronRight, Clock, CheckCircle2,
  Truck, XCircle, User2, RefreshCw,
} from 'lucide-react';

/* ─── Status config ───────────────────────────────────────────────────────── */
const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft:      { label: 'Draft',      cls: 'bg-slate-100 text-slate-600' },
  pending:    { label: 'Pending',    cls: 'bg-amber-100 text-amber-700' },
  confirmed:  { label: 'Confirmed',  cls: 'bg-blue-50 text-blue-700' },
  dispatched: { label: 'Dispatched', cls: 'bg-purple-50 text-purple-700' },
  delivered:  { label: 'Delivered',  cls: 'bg-green-50 text-green-700' },
  cancelled:  { label: 'Cancelled',  cls: 'bg-red-50 text-red-600' },
  partial:    { label: 'Partial',    cls: 'bg-orange-50 text-orange-700' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

/* ─── Props ───────────────────────────────────────────────────────────────── */
interface Props {
  /** Limit how many rows are shown (default 10) */
  limit?: number;
  /** Optional hub_id to scope to a single hub; undefined = all hubs */
  hubId?: string | null;
  /** Card title */
  title?: string;
}

/* ─── Widget ──────────────────────────────────────────────────────────────── */
export function RecentSalesOrdersWidget({ limit = 10, hubId, title = 'Recent Sales Orders' }: Props) {
  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['recent-sales-orders-widget', limit, hubId],
    queryFn: async () => {
      let q = supabase
        .from('sales_orders')
        .select(`
          id, order_number, status, net_amount, total_amount,
          payment_mode, order_date, created_at,
          customer:customers(shop_name, name, area),
          creator:profiles!created_by(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (hubId) q = q.eq('hub_id', hubId);
      const { data } = await q;
      return data ?? [];
    },
    refetchInterval: 60_000, // refresh every 60 s
  });

  return (
    <div className="zoho-card">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-[#2C64E3]" />
          <h2 className="font-semibold text-slate-800">{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            to="/sales/orders"
            className="text-xs font-semibold text-[#2C64E3] hover:underline flex items-center gap-0.5"
          >
            View All <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="p-10 text-center text-sm text-gray-400">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-gray-200" />
          Loading orders…
        </div>
      ) : (orders as any[]).length === 0 ? (
        <div className="p-10 text-center">
          <ShoppingBag className="h-10 w-10 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No orders yet</p>
          <Link to="/sales/new-order" className="mt-3 inline-block text-xs text-[#2C64E3] font-semibold hover:underline">
            + Create First Order
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-[#E2E8F0]">
                <th className="text-left px-4 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Order</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Customer</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Amount</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Created By</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wide">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {(orders as any[]).map((order: any) => {
                const amount = Number(order.net_amount ?? order.total_amount) || 0;
                const customerName = order.customer?.shop_name ?? order.customer?.name ?? '—';
                const creatorName = order.creator?.full_name ?? 'Unknown';
                const createdAt = order.created_at ? new Date(order.created_at) : null;

                return (
                  <tr
                    key={order.id}
                    className="hover:bg-slate-50/70 cursor-pointer group transition-colors"
                    onClick={() => window.location.href = `/sales/orders/${order.id}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-bold text-[#2C64E3] text-xs">
                        {order.order_number ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-700 text-xs truncate max-w-[140px]">{customerName}</div>
                      {order.customer?.area && (
                        <div className="text-[10px] text-slate-400">{order.customer.area}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold text-slate-800 text-xs">
                        ₹{amount.toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <User2 className="h-3 w-3 text-slate-400" />
                        </div>
                        <span className="text-xs text-slate-600 truncate max-w-[100px]">{creatorName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {createdAt ? (
                        <div>
                          <div className="text-xs text-slate-600">{format(createdAt, 'd MMM yyyy')}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {format(createdAt, 'h:mm a')}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      {(orders as any[]).length > 0 && (
        <div className="px-5 py-3 border-t border-[#E2E8F0] flex items-center justify-between">
          <span className="text-xs text-slate-400">Showing {(orders as any[]).length} most recent orders</span>
          <Link to="/sales/orders" className="text-xs font-semibold text-[#2C64E3] hover:underline">
            See full list →
          </Link>
        </div>
      )}
    </div>
  );
}
