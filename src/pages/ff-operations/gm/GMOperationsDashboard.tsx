import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Box,
  Boxes,
  PackageCheck,
  PackageX,
  Activity,
  BarChart3,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Hub {
  id: string;
  name: string;
  code?: string;
  city?: string;
}

interface OrderSummary {
  total: number;
  pending: number;
  confirmed: number;
  processing: number;
  dispatched: number;
  delivered: number;
  cancelled: number;
  totalRevenue: number;
}

interface InventoryHub {
  hub_id: string;
  hub_name: string;
  hub_code: string;
  totalProducts: number;
  totalStockKg: number;
  lowStock: number;
  outOfStock: number;
}

interface BoxStatusCounts {
  created: number;
  qc_pending: number;
  qc_passed: number;
  qc_failed: number;
  dispatched: number;
  delivered: number;
  returned: number;
}

interface DeliveryPackSummary {
  total: number;
  pending: number;
  ready: number;
  dispatched: number;
  delivered: number;
}

interface RecentOrder {
  id: string;
  order_number?: string;
  customer_name?: string;
  total_amount?: number;
  status: string;
  created_at: string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

const TODAY = format(new Date(), 'yyyy-MM-dd');

function statusColor(status: string) {
  const map: Record<string, string> = {
    pending:    'bg-yellow-100 text-yellow-700',
    confirmed:  'bg-blue-100 text-blue-700',
    processing: 'bg-purple-100 text-purple-700',
    dispatched: 'bg-indigo-100 text-indigo-700',
    delivered:  'bg-green-100 text-green-700',
    cancelled:  'bg-red-100 text-red-700',
    qc_pending: 'bg-amber-100 text-amber-700',
    qc_passed:  'bg-emerald-100 text-emerald-700',
    qc_failed:  'bg-red-100 text-red-700',
    created:    'bg-gray-100 text-gray-600',
    returned:   'bg-orange-100 text-orange-700',
    ready:      'bg-teal-100 text-teal-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize', statusColor(status))}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  trend?: 'up' | 'down' | 'neutral';
}

function StatCard({ label, value, sub, icon: Icon, color, bgColor, trend }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start gap-3 shadow-sm hover:shadow-md transition-shadow">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', bgColor)}>
        <Icon className={cn('w-5 h-5', color)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide leading-none mb-1">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        {sub && (
          <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
            {trend === 'up' && <TrendingUp className="w-3 h-3 text-green-500" />}
            {trend === 'down' && <TrendingDown className="w-3 h-3 text-red-500" />}
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, icon: Icon, count }: { title: string; icon: React.ElementType; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-gray-500" />
      <h2 className="text-[13px] font-semibold text-gray-700 uppercase tracking-wide">{title}</h2>
      {count !== undefined && (
        <span className="ml-auto text-[11px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GMOperationsDashboard() {
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
    setLastRefreshed(new Date());
  }, []);

  // ── Realtime: auto-refresh on key table changes ──────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('gm-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boxes' }, refresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inventory_log' }, refresh)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [refresh]);

  // ── Queries ───────────────────────────────────────────────────────────────

  // Hubs
  const { data: hubs = [] } = useQuery<Hub[]>({
    queryKey: ['gm-hubs', refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase.from('hubs').select('id, name, code, city').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Today's orders
  const { data: orderSummary } = useQuery<OrderSummary>({
    queryKey: ['gm-orders-today', refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_orders')
        .select('id, status, total_amount, created_at')
        .gte('created_at', `${TODAY}T00:00:00`)
        .lte('created_at', `${TODAY}T23:59:59`);

      if (error) throw error;
      const rows = data ?? [];

      const summary: OrderSummary = {
        total: rows.length,
        pending: 0, confirmed: 0, processing: 0,
        dispatched: 0, delivered: 0, cancelled: 0,
        totalRevenue: 0,
      };

      rows.forEach(r => {
        const s = r.status as string;
        if (s in summary) (summary as any)[s]++;
        summary.totalRevenue += Number(r.total_amount ?? 0);
      });

      return summary;
    },
  });

  // Recent orders (last 10)
  const { data: recentOrders = [] } = useQuery<RecentOrder[]>({
    queryKey: ['gm-recent-orders', refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_orders')
        .select('id, order_number, customer_name, total_amount, status, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data ?? [];
    },
  });

  // Inventory across hubs
  const { data: inventoryHubs = [] } = useQuery<InventoryHub[]>({
    queryKey: ['gm-inventory-hubs', refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select('hub_id, quantity, min_threshold, hubs(id, name, code)');

      if (error) throw error;
      const rows = data ?? [];

      // Group by hub
      const map = new Map<string, InventoryHub>();

      rows.forEach((r: any) => {
        const hub = r.hubs;
        if (!hub) return;

        const key = hub.id;
        if (!map.has(key)) {
          map.set(key, {
            hub_id: hub.id,
            hub_name: hub.name,
            hub_code: hub.code ?? hub.name.slice(0, 3).toUpperCase(),
            totalProducts: 0,
            totalStockKg: 0,
            lowStock: 0,
            outOfStock: 0,
          });
        }

        const entry = map.get(key)!;
        entry.totalProducts++;
        entry.totalStockKg += Number(r.quantity ?? 0);

        const qty = Number(r.quantity ?? 0);
        const min = Number(r.min_threshold ?? 0);

        if (qty === 0) entry.outOfStock++;
        else if (min > 0 && qty <= min) entry.lowStock++;
      });

      return Array.from(map.values()).sort((a, b) => a.hub_name.localeCompare(b.hub_name));
    },
  });

  // Box status counts
  const { data: boxCounts } = useQuery<BoxStatusCounts>({
    queryKey: ['gm-box-counts', refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('boxes')
        .select('status');

      if (error) throw error;
      const rows = data ?? [];

      const counts: BoxStatusCounts = {
        created: 0, qc_pending: 0, qc_passed: 0,
        qc_failed: 0, dispatched: 0, delivered: 0, returned: 0,
      };

      rows.forEach((r: any) => {
        const s = r.status as keyof BoxStatusCounts;
        if (s in counts) counts[s]++;
      });

      return counts;
    },
  });

  // Delivery packs
  const { data: packSummary } = useQuery<DeliveryPackSummary>({
    queryKey: ['gm-delivery-packs', refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_packs')
        .select('status')
        .gte('created_at', `${TODAY}T00:00:00`);

      if (error) throw error;
      const rows = data ?? [];

      const s: DeliveryPackSummary = { total: rows.length, pending: 0, ready: 0, dispatched: 0, delivered: 0 };
      rows.forEach((r: any) => {
        const st = r.status as string;
        if (st in s) (s as any)[st]++;
      });

      return s;
    },
  });

  // Total inventory overview
  const totalStockKg = inventoryHubs.reduce((a, b) => a + b.totalStockKg, 0);
  const totalLowStock = inventoryHubs.reduce((a, b) => a + b.lowStock, 0);
  const totalOutOfStock = inventoryHubs.reduce((a, b) => a + b.outOfStock, 0);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-[17px] font-bold text-gray-900">GM Operations Dashboard</h1>
              <p className="text-[11px] text-gray-400">{format(new Date(), 'EEEE, dd MMM yyyy')} · Live</p>
            </div>
          </div>

          <button
            onClick={refresh}
            className="flex items-center gap-1.5 text-[12px] font-medium text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh · {format(lastRefreshed, 'HH:mm:ss')}
          </button>
        </div>
      </div>

      <div className="px-6 py-5 space-y-6 max-w-[1400px] mx-auto">

        {/* ── Top KPI Cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            label="Orders Today"
            value={orderSummary?.total ?? 0}
            sub={`₹${((orderSummary?.totalRevenue ?? 0) / 1000).toFixed(1)}k revenue`}
            icon={ShoppingCart}
            color="text-blue-600"
            bgColor="bg-blue-50"
          />
          <StatCard
            label="Pending Orders"
            value={orderSummary?.pending ?? 0}
            sub="Awaiting confirmation"
            icon={Clock}
            color="text-amber-600"
            bgColor="bg-amber-50"
          />
          <StatCard
            label="Dispatched"
            value={(orderSummary?.dispatched ?? 0) + (orderSummary?.delivered ?? 0)}
            sub={`${orderSummary?.delivered ?? 0} delivered`}
            icon={Truck}
            color="text-green-600"
            bgColor="bg-green-50"
            trend="up"
          />
          <StatCard
            label="Total Stock"
            value={`${totalStockKg.toFixed(0)} kg`}
            sub={`${inventoryHubs.length} hubs`}
            icon={Boxes}
            color="text-indigo-600"
            bgColor="bg-indigo-50"
          />
          <StatCard
            label="Low / Out of Stock"
            value={totalLowStock + totalOutOfStock}
            sub={`${totalOutOfStock} out of stock`}
            icon={AlertTriangle}
            color={totalOutOfStock > 0 ? 'text-red-600' : 'text-orange-500'}
            bgColor={totalOutOfStock > 0 ? 'bg-red-50' : 'bg-orange-50'}
            trend={totalOutOfStock > 0 ? 'down' : 'neutral'}
          />
          <StatCard
            label="QC Pending"
            value={boxCounts?.qc_pending ?? 0}
            sub={`${boxCounts?.qc_failed ?? 0} rejected`}
            icon={PackageCheck}
            color="text-purple-600"
            bgColor="bg-purple-50"
          />
        </div>

        {/* ── Main Grid ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left: Today's Orders + Recent Orders */}
          <div className="lg:col-span-2 space-y-5">

            {/* Order Status Breakdown */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <SectionHeader title="Today's Order Breakdown" icon={BarChart3} />

              {orderSummary && orderSummary.total > 0 ? (
                <>
                  {/* Progress bars */}
                  <div className="space-y-2.5 mb-4">
                    {[
                      { key: 'pending',    label: 'Pending',    color: 'bg-yellow-400' },
                      { key: 'confirmed',  label: 'Confirmed',  color: 'bg-blue-400' },
                      { key: 'processing', label: 'Processing', color: 'bg-purple-400' },
                      { key: 'dispatched', label: 'Dispatched', color: 'bg-indigo-400' },
                      { key: 'delivered',  label: 'Delivered',  color: 'bg-green-500' },
                      { key: 'cancelled',  label: 'Cancelled',  color: 'bg-red-400' },
                    ].map(({ key, label, color }) => {
                      const count = (orderSummary as any)[key] as number;
                      const pct = orderSummary.total > 0 ? (count / orderSummary.total) * 100 : 0;
                      return (
                        <div key={key} className="flex items-center gap-3">
                          <span className="text-[12px] text-gray-600 w-20 shrink-0">{label}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={cn('h-full rounded-full transition-all duration-500', color)}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[12px] font-semibold text-gray-700 w-8 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Quick stat row */}
                  <div className="flex gap-3 pt-3 border-t border-gray-50">
                    <div className="flex-1 text-center">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Total</p>
                      <p className="text-[15px] font-bold text-gray-800">{orderSummary.total}</p>
                    </div>
                    <div className="flex-1 text-center">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Revenue</p>
                      <p className="text-[15px] font-bold text-gray-800">
                        ₹{(orderSummary.totalRevenue / 1000).toFixed(1)}k
                      </p>
                    </div>
                    <div className="flex-1 text-center">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Fulfilment</p>
                      <p className="text-[15px] font-bold text-green-600">
                        {orderSummary.total > 0
                          ? Math.round(((orderSummary.delivered + orderSummary.dispatched) / orderSummary.total) * 100)
                          : 0}%
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-[13px]">No orders yet today</p>
                </div>
              )}
            </div>

            {/* Recent Orders Table */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <SectionHeader title="Recent Orders" icon={Activity} count={recentOrders.length} />

              {recentOrders.length > 0 ? (
                <div className="divide-y divide-gray-50">
                  {recentOrders.map(order => (
                    <div key={order.id} className="flex items-center justify-between py-2.5 gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-gray-800 truncate">
                          {order.order_number ?? order.id.slice(0, 8)}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate">
                          {order.customer_name ?? 'Unknown customer'} · {format(new Date(order.created_at), 'HH:mm')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {order.total_amount !== undefined && (
                          <span className="text-[12px] font-bold text-gray-700">
                            ₹{Number(order.total_amount).toLocaleString('en-IN')}
                          </span>
                        )}
                        <StatusBadge status={order.status} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400">
                  <Activity className="w-7 h-7 mx-auto mb-2 opacity-30" />
                  <p className="text-[13px]">No recent orders</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Inventory + Box Status + Dispatch */}
          <div className="space-y-5">

            {/* Hub Inventory Overview */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <SectionHeader title="Hub Inventory" icon={Boxes} count={inventoryHubs.length} />

              {inventoryHubs.length > 0 ? (
                <div className="space-y-3">
                  {inventoryHubs.map(hub => (
                    <div key={hub.hub_id} className="rounded-xl border border-gray-100 p-3 hover:border-gray-200 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                            {hub.hub_code}
                          </span>
                          <span className="text-[12px] font-semibold text-gray-800">{hub.hub_name}</span>
                        </div>
                        <span className="text-[11px] text-gray-400">{hub.totalStockKg.toFixed(0)} kg</span>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        <div className="text-center bg-gray-50 rounded-lg py-1">
                          <p className="text-[10px] text-gray-400">Products</p>
                          <p className="text-[13px] font-bold text-gray-700">{hub.totalProducts}</p>
                        </div>
                        <div className={cn(
                          'text-center rounded-lg py-1',
                          hub.lowStock > 0 ? 'bg-amber-50' : 'bg-gray-50'
                        )}>
                          <p className="text-[10px] text-gray-400">Low Stock</p>
                          <p className={cn(
                            'text-[13px] font-bold',
                            hub.lowStock > 0 ? 'text-amber-600' : 'text-gray-700'
                          )}>{hub.lowStock}</p>
                        </div>
                        <div className={cn(
                          'text-center rounded-lg py-1',
                          hub.outOfStock > 0 ? 'bg-red-50' : 'bg-gray-50'
                        )}>
                          <p className="text-[10px] text-gray-400">Out</p>
                          <p className={cn(
                            'text-[13px] font-bold',
                            hub.outOfStock > 0 ? 'text-red-600' : 'text-gray-700'
                          )}>{hub.outOfStock}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400">
                  <Boxes className="w-7 h-7 mx-auto mb-2 opacity-30" />
                  <p className="text-[13px]">No inventory data</p>
                </div>
              )}
            </div>

            {/* Box Pipeline */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <SectionHeader title="Box Pipeline" icon={Box} />

              {boxCounts ? (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'created',    label: 'Created',     icon: Package,    col: 'text-gray-600',   bg: 'bg-gray-50'    },
                    { key: 'qc_pending', label: 'QC Pending',  icon: Clock,      col: 'text-amber-600',  bg: 'bg-amber-50'   },
                    { key: 'qc_passed',  label: 'QC Passed',   icon: CheckCircle2, col: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { key: 'qc_failed',  label: 'QC Failed',   icon: PackageX,   col: 'text-red-600',    bg: 'bg-red-50'     },
                    { key: 'dispatched', label: 'Dispatched',  icon: Truck,      col: 'text-indigo-600', bg: 'bg-indigo-50'  },
                    { key: 'delivered',  label: 'Delivered',   icon: PackageCheck, col: 'text-green-600', bg: 'bg-green-50'   },
                  ].map(({ key, label, icon: Icon, col, bg }) => (
                    <div key={key} className={cn('rounded-xl p-3 text-center', bg)}>
                      <Icon className={cn('w-4 h-4 mx-auto mb-1', col)} />
                      <p className="text-[18px] font-bold text-gray-800">{(boxCounts as any)[key]}</p>
                      <p className={cn('text-[10px] font-medium', col)}>{label}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400">
                  <Box className="w-7 h-7 mx-auto mb-2 opacity-30" />
                  <p className="text-[13px]">Loading...</p>
                </div>
              )}
            </div>

            {/* Dispatch Readiness */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <SectionHeader title="Dispatch Readiness" icon={Zap} />

              {packSummary ? (
                packSummary.total > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-gray-600">Total Packs Today</span>
                      <span className="text-[15px] font-bold text-gray-800">{packSummary.total}</span>
                    </div>

                    {[
                      { key: 'pending',    label: 'Pending',    color: 'bg-yellow-400' },
                      { key: 'ready',      label: 'Ready',      color: 'bg-teal-400' },
                      { key: 'dispatched', label: 'Dispatched', color: 'bg-indigo-500' },
                      { key: 'delivered',  label: 'Delivered',  color: 'bg-green-500' },
                    ].map(({ key, label, color }) => {
                      const count = (packSummary as any)[key] as number;
                      const pct = packSummary.total > 0 ? (count / packSummary.total) * 100 : 0;
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-[11px] text-gray-500 w-16 shrink-0">{label}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[12px] font-semibold text-gray-700 w-5 text-right">{count}</span>
                        </div>
                      );
                    })}

                    {/* Readiness score */}
                    <div className="mt-2 pt-3 border-t border-gray-50 text-center">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Completion Rate</p>
                      <p className={cn(
                        'text-2xl font-bold',
                        packSummary.total > 0 && ((packSummary.delivered + packSummary.dispatched) / packSummary.total) >= 0.8
                          ? 'text-green-600'
                          : 'text-amber-500'
                      )}>
                        {packSummary.total > 0
                          ? Math.round(((packSummary.delivered + packSummary.dispatched) / packSummary.total) * 100)
                          : 0}%
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-400">
                    <Truck className="w-7 h-7 mx-auto mb-2 opacity-30" />
                    <p className="text-[13px]">No packs created today</p>
                  </div>
                )
              ) : (
                <div className="text-center py-6 text-gray-400">
                  <p className="text-[13px]">Loading...</p>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ── Alert Banner ────────────────────────────────────────────────── */}
        {(totalOutOfStock > 0 || (boxCounts?.qc_failed ?? 0) > 0) && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-semibold text-red-700 mb-1">Action Required</p>
              <ul className="space-y-0.5">
                {totalOutOfStock > 0 && (
                  <li className="text-[12px] text-red-600 flex items-center gap-1.5">
                    <ChevronRight className="w-3 h-3" />
                    {totalOutOfStock} product{totalOutOfStock > 1 ? 's are' : ' is'} out of stock across hubs — raise PO immediately
                  </li>
                )}
                {(boxCounts?.qc_failed ?? 0) > 0 && (
                  <li className="text-[12px] text-red-600 flex items-center gap-1.5">
                    <ChevronRight className="w-3 h-3" />
                    {boxCounts!.qc_failed} box{boxCounts!.qc_failed > 1 ? 'es' : ''} failed QC — review wastage logs
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
