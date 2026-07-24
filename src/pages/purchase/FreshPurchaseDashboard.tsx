import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Link } from 'react-router-dom';
import {
  ShoppingCart, TrendingUp, AlertCircle, CheckCircle2, Clock,
  Package, ChevronRight, RefreshCw, Plus, BarChart3, Printer, Tag, Banknote
} from 'lucide-react';
import { printPurchaseOrder } from '@/utils/printPurchaseOrder';
import { toast } from 'sonner';
import { PaymentDueAlerts } from '@/components/PaymentDueAlerts';

export default function FreshPurchaseDashboard() {
  const { user } = useAuth();
  const hubId = (user as any)?.hub_id ?? null;
  const isManagement = ['ceo', 'gm', 'admin', 'director', 'nsm'].includes(user?.role ?? '');
  const [printingPO, setPrintingPO] = useState<string | null>(null);

  const handlePrint = async (poId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPrintingPO(poId);
    try {
      await printPurchaseOrder(poId);
    } catch (err: any) {
      toast.error(err.message || 'Print failed');
    } finally {
      setPrintingPO(null);
    }
  };

  const today = format(new Date(), 'yyyy-MM-dd');
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

  const { data: todayOrders = [], isLoading, refetch } = useQuery({
    queryKey: ['ff-purchase-today', today, hubId],
    queryFn: async () => {
      let q = supabase
        .from('purchase_orders')
        .select('*, vendor:vendors(name)')
        .eq('order_date', today)
        .order('created_at', { ascending: false });
      if (!isManagement && hubId) q = q.eq('hub_id', hubId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: monthStats } = useQuery({
    queryKey: ['ff-purchase-month-stats', monthStart, hubId],
    queryFn: async () => {
      let q = supabase
        .from('purchase_orders')
        .select('total_amount, status')
        .gte('order_date', monthStart)
        .lte('order_date', monthEnd);
      if (!isManagement && hubId) q = q.eq('hub_id', hubId);
      const { data } = await q;
      const orders = data ?? [];
      return {
        total: orders.length,
        pending: orders.filter(o => o.status === 'pending').length,
        received: orders.filter(o => o.status === 'received').length,
        value: orders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0),
      };
    },
  });

  const { data: demandForecasts = [] } = useQuery({
    queryKey: ['ff-demand-forecasts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('demand_forecasts')
        .select('*, product:products(name)')
        .eq('forecast_date', today)
        .order('forecasted_qty', { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const STATUS_COLOR: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-blue-100 text-blue-700',
    ordered: 'bg-purple-100 text-purple-700',
    received: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-600',
  };

  const stats = monthStats ?? { total: 0, pending: 0, received: 0, value: 0 };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 pt-4">
      <PaymentDueAlerts />
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 tracking-tight">Purchase Dashboard</h1>
          <p className="text-[13px] text-slate-500">Fresh Produce Procurement · {format(new Date(), 'd MMMM yyyy')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => refetch()} className="btn-zoho-secondary px-3">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: 'This Month POs', value: stats.total, icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Pending Delivery', value: stats.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Received', value: stats.received, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Month Spend', value: `₹${(stats.value / 1000).toFixed(1)}k`, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 pt-5 pb-4">
            <div className={`p-2 ${card.bg} rounded-lg w-fit mb-2`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <p className="text-[13px] text-slate-500 font-medium mb-1">{card.label}</p>
            <p className="text-[24px] font-bold text-slate-800">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Purchase Orders */}
        <div className="lg:col-span-2 zoho-card">
          <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Today's Purchase Orders</h2>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
          ) : (todayOrders as any[]).length === 0 ? (
            <div className="p-8 text-center">
              <Package className="h-10 w-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No purchase orders today</p>
            </div>
          ) : (
            <div className="zoho-table-container rounded-none border-0">
              <table className="zoho-table">
                <thead>
                  <tr>
                    <th>PO #</th>
                    <th>Vendor</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(todayOrders as any[]).map((po: any) => (
                    <tr key={po.id} className="hover:bg-slate-50/60">
                      <td className="font-medium text-blue-700">{po.po_number}</td>
                      <td>{po.vendor?.name ?? '—'}</td>
                      <td>₹{Number(po.total_amount || 0).toLocaleString('en-IN')}</td>
                      <td>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLOR[po.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {po.status}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={(e) => handlePrint(po.id, e)}
                          disabled={printingPO === po.id}
                          title="Print Purchase Order"
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 transition-colors"
                        >
                          {printingPO === po.id
                            ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            : <Printer className="h-3.5 w-3.5" />}
                          Print
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Demand Forecast panel */}
        <div className="zoho-card">
          <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Today's Demand</h2>
            <Link to="/purchase/demand" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {(demandForecasts as any[]).length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">
              <BarChart3 className="h-8 w-8 mx-auto mb-2 text-gray-200" />
              No forecasts today
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F0]">
              {(demandForecasts as any[]).map((f: any) => (
                <div key={f.id} className="px-5 py-3 flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">{f.product?.name}</p>
                  <span className="text-sm font-semibold text-blue-700">{f.forecasted_qty} kg</span>
                </div>
              ))}
            </div>
          )}
          <div className="px-5 py-3 border-t border-[#E2E8F0]">
            <Link to="/purchase/demand" className="text-xs text-blue-600 hover:underline">Manage forecasts →</Link>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Box Labels',          path: '/ff-operations/labels',         icon: Tag },
          { label: 'Gate Entry',         path: '/transit/gate-entry',           icon: Package },
          { label: 'Payment Approvals',  path: '/purchase/payment-approvals',   icon: AlertCircle },
          { label: 'Vendor Payments',    path: '/purchase/vendor-payments',     icon: Banknote },
          { label: 'Rate Comparison',    path: '/purchase/rate-comparison',     icon: BarChart3 },
          { label: 'Market Rates',       path: '/purchase/market-rates',        icon: TrendingUp },
          { label: 'New Payment',        path: '/purchase/payment-form',        icon: Plus },
          { label: 'Performance',        path: '/purchase/vendor-performance',  icon: CheckCircle2 },
        ].map(item => (
          <Link key={item.path} to={item.path}
            className="zoho-card px-4 py-4 flex flex-col items-center gap-2 text-center hover:border-blue-300">
            <item.icon className="h-6 w-6 text-[#2C64E3]" />
            <p className="text-xs font-semibold text-slate-600">{item.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
