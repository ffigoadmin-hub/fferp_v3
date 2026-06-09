// @ts-nocheck
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import {
  ShoppingCart, Smartphone, Globe, FilePlus, Upload,
  Filter, RefreshCw, Eye, ChevronDown, ChevronUp,
  Package, User, MapPin, Clock,
} from 'lucide-react';

const SOURCE_CONFIG = {
  manual:      { label: 'Manual Entry',  icon: FilePlus,   color: 'bg-gray-100 text-gray-700',   dot: 'bg-gray-400' },
  app:         { label: 'Mobile App',    icon: Smartphone, color: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
  website:     { label: 'Website',       icon: Globe,      color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  bulk_upload: { label: 'Bulk Upload',   icon: Upload,     color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
};

const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-amber-100 text-amber-700',
  confirmed:  'bg-blue-100 text-blue-700',
  processing: 'bg-cyan-100 text-cyan-700',
  shipped:    'bg-indigo-100 text-indigo-700',
  delivered:  'bg-green-100 text-green-700',
  cancelled:  'bg-red-100 text-red-600',
  returned:   'bg-orange-100 text-orange-700',
};

function OrderRow({ order }: { order: any }) {
  const [expanded, setExpanded] = useState(false);
  const src = SOURCE_CONFIG[order.source] || SOURCE_CONFIG.manual;
  const SrcIcon = src.icon;

  return (
    <div className="border-b border-gray-50 last:border-0">
      <div
        className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50 cursor-pointer transition"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-1.5 rounded-lg shrink-0 ${src.color}`}>
            <SrcIcon className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-800 truncate">
                {order.customers?.name || order.customer_name || 'Walk-in Customer'}
              </p>
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${src.color}`}>
                {src.label}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              #{order.id?.slice(0,8)} · {format(new Date(order.created_at), 'dd MMM, h:mm a')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <p className="text-sm font-bold text-gray-900">
              ₹{Number(order.total_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-500'}`}>
              {order.status}
            </span>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-4 bg-gray-50/60 grid grid-cols-2 gap-3 text-xs text-gray-600">
          {order.customers?.phone && (
            <div><span className="text-gray-400">Phone:</span> {order.customers.phone}</div>
          )}
          {order.delivery_address && (
            <div className="flex items-start gap-1">
              <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-gray-400" />
              {order.delivery_address}
            </div>
          )}
          {order.sales_order_items?.length > 0 && (
            <div className="col-span-2">
              <p className="text-gray-400 mb-1 font-medium">Items:</p>
              {order.sales_order_items.map((item: any, i: number) => (
                <span key={i} className="inline-block bg-white border border-gray-200 rounded px-2 py-1 mr-1 mb-1 text-xs">
                  {item.products?.name || 'Product'} × {item.quantity}
                </span>
              ))}
            </div>
          )}
          {order.notes && (
            <div className="col-span-2"><span className="text-gray-400">Notes:</span> {order.notes}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AppOrdersDashboard() {
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['app-orders', sourceFilter, statusFilter],
    queryFn: async () => {
      let q = (supabase as any)
        .from('sales_orders')
        .select(`
          id, created_at, source, status, total_amount,
          customer_name, delivery_address, notes,
          customers(name, phone),
          sales_order_items(quantity, products(name))
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (sourceFilter !== 'all') q = q.eq('source', sourceFilter);
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });

  const filtered = search
    ? orders.filter(o =>
        o.customers?.name?.toLowerCase().includes(search.toLowerCase()) ||
        o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        o.id?.includes(search)
      )
    : orders;

  // KPIs
  const kpis = Object.entries(SOURCE_CONFIG).map(([key, cfg]) => ({
    key, cfg,
    count: orders.filter(o => o.source === key).length,
    total: orders.filter(o => o.source === key).reduce((s, o) => s + Number(o.total_amount || 0), 0),
  }));

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-12 pt-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">All Orders</h1>
          <p className="text-xs text-gray-500 mt-0.5">Orders from all channels — app, website, manual, and bulk</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Source KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {kpis.map(({ key, cfg, count, total }) => {
          const Icon = cfg.icon;
          return (
            <button
              key={key}
              onClick={() => setSourceFilter(sourceFilter === key ? 'all' : key)}
              className={`bg-white rounded-xl border p-4 text-left transition shadow-sm hover:shadow-md ${
                sourceFilter === key ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-100'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${cfg.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-medium text-gray-600">{cfg.label}</span>
              </div>
              <p className="text-xl font-bold text-gray-900">{count}</p>
              <p className="text-xs text-gray-400 mt-0.5">₹{Number(total).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search customer name or order ID..."
          className="flex-1 min-w-48 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          {['all','pending','confirmed','delivered','cancelled'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                statusFilter === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {s === 'all' ? 'All Status' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Orders list */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            Orders <span className="text-gray-400 font-normal">({filtered.length})</span>
          </h2>
        </div>

        {isLoading ? (
          <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading orders...
          </div>
        ) : filtered.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-gray-400">
            <ShoppingCart className="w-8 h-8 mb-2 text-gray-300" />
            <p className="text-sm">No orders found</p>
          </div>
        ) : (
          <div>
            {filtered.map(order => <OrderRow key={order.id} order={order} />)}
          </div>
        )}
      </div>
    </div>
  );
}
