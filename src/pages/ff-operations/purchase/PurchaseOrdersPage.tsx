import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  Package, ChevronDown, ChevronRight, RefreshCw,
  ShoppingCart, Clock, CheckCircle2, XCircle, Loader2,
  Calendar, Hash, ShoppingBag,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────
interface POItem {
  id: string;
  product_name: string;
  item_name: string | null;
  required_qty: number;
  ordered_qty: number | null;
  unit: string;
  estimated_price: number | null;
  unit_price: number | null;
  status: string;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  hub_id: string;
  hub_name: string | null;
  eod_date: string;
  status: string;
  total_estimated: number | null;
  total_amount: number | null;
  items_count: number | null;
  created_at: string;
  items: POItem[];
}

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  pending:   { label: 'Pending',   cls: 'bg-amber-100  text-amber-700',  icon: Clock         },
  approved:  { label: 'Approved',  cls: 'bg-blue-100   text-blue-700',   icon: CheckCircle2  },
  ordered:   { label: 'Ordered',   cls: 'bg-purple-100 text-purple-700', icon: ShoppingBag   },
  received:  { label: 'Received',  cls: 'bg-green-100  text-green-700',  icon: CheckCircle2  },
  cancelled: { label: 'Cancelled', cls: 'bg-red-100    text-red-600',    icon: XCircle       },
  partial:   { label: 'Partial',   cls: 'bg-orange-100 text-orange-700', icon: Package       },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600', icon: Package };
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold capitalize', cfg.cls)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

// ── PO Row (expandable) ────────────────────────────────────────────────────────
function PORow({ po }: { po: PurchaseOrder }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const itemsDone = po.items.filter(i => ['ordered','received'].includes(i.status)).length;
  const total = po.items.length || po.items_count || 0;

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
      {/* Header row */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 bg-white hover:bg-slate-50 transition-colors text-left"
      >
        {open
          ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
          : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}

        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 items-center">
          {/* PO number */}
          <div>
            <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">PO Number</p>
            <p className="text-sm font-bold text-blue-700">{po.po_number}</p>
          </div>

          {/* EOD date */}
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-gray-400" />
            <div>
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">EOD Date</p>
              <p className="text-sm font-semibold text-gray-700">
                {po.eod_date ? format(new Date(po.eod_date), 'd MMM yyyy') : '—'}
              </p>
            </div>
          </div>

          {/* Items progress */}
          <div className="flex items-center gap-2">
            <Hash className="h-3.5 w-3.5 text-gray-400" />
            <div>
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Items</p>
              <p className="text-sm font-semibold text-gray-700">
                {itemsDone}/{total} bought
              </p>
            </div>
          </div>

          {/* Status */}
          <div className="flex justify-end md:justify-start">
            <StatusBadge status={po.status} />
          </div>
        </div>

        {/* Buy button */}
        <button
          onClick={e => {
            e.stopPropagation();
            navigate('/purchase/buy', { state: { poId: po.id, poNumber: po.po_number } });
          }}
          className="shrink-0 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
        >
          <ShoppingBag className="h-3.5 w-3.5" />
          Buy
        </button>
      </button>

      {/* Items table */}
      {open && (
        <div className="bg-gray-50 border-t border-gray-100 px-5 py-3">
          {po.items.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">No items found for this PO.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-200">
                  <th className="text-left py-2 font-semibold">Product</th>
                  <th className="text-right py-2 font-semibold">Required Qty</th>
                  <th className="text-right py-2 font-semibold">Ordered Qty</th>
                  <th className="text-right py-2 font-semibold">Unit</th>
                  <th className="text-right py-2 font-semibold">Est. Price</th>
                  <th className="text-right py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {po.items.map(item => (
                  <tr key={item.id} className="hover:bg-white transition-colors">
                    <td className="py-2.5 font-medium text-gray-800">
                      {item.product_name || item.item_name || '—'}
                    </td>
                    <td className="py-2.5 text-right text-gray-700">
                      {Number(item.required_qty || 0).toFixed(1)}
                    </td>
                    <td className="py-2.5 text-right text-gray-700">
                      {item.ordered_qty != null ? Number(item.ordered_qty).toFixed(1) : '—'}
                    </td>
                    <td className="py-2.5 text-right text-gray-500">{item.unit || 'kg'}</td>
                    <td className="py-2.5 text-right text-gray-700">
                      {item.estimated_price
                        ? `₹${Number(item.estimated_price).toLocaleString('en-IN')}`
                        : '—'}
                    </td>
                    <td className="py-2.5 text-right">
                      <StatusBadge status={item.status || 'pending'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function PurchaseOrdersPage() {
  const { user } = useAuth();
  const hubId = (user as any)?.hub_id ?? null;
  const isManagement = ['ceo', 'gm', 'admin', 'director', 'ff_operations_manager'].includes(user?.role ?? '');
  const [filter, setFilter] = useState<'all' | 'pending' | 'ordered' | 'received'>('all');

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['purchase-orders-exec', hubId],
    queryFn: async () => {
      let q = supabase
        .from('purchase_orders')
        .select('*, items:purchase_order_items(*)')
        .order('eod_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (!isManagement && hubId) q = q.eq('hub_id', hubId);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PurchaseOrder[];
    },
    enabled: !!user,
  });

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  // Group by EOD date
  const grouped = filtered.reduce<Record<string, PurchaseOrder[]>>((acc, po) => {
    const key = po.eod_date ?? 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(po);
    return acc;
  }, {});

  const tabs: Array<{ key: typeof filter; label: string }> = [
    { key: 'all',      label: 'All POs'   },
    { key: 'pending',  label: 'Pending'   },
    { key: 'ordered',  label: 'Ordered'   },
    { key: 'received', label: 'Received'  },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 pt-4 px-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-blue-600" />
            My Purchase Orders
          </h1>
          <p className="text-[13px] text-slate-500">
            All EOD-generated POs assigned to your hub
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total POs',  value: orders.length,                                          color: 'text-blue-700',   bg: 'bg-blue-50'   },
          { label: 'Pending',    value: orders.filter(o => o.status === 'pending').length,       color: 'text-amber-700',  bg: 'bg-amber-50'  },
          { label: 'Ordered',    value: orders.filter(o => o.status === 'ordered').length,       color: 'text-purple-700', bg: 'bg-purple-50' },
          { label: 'Received',   value: orders.filter(o => o.status === 'received').length,      color: 'text-green-700',  bg: 'bg-green-50'  },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl border border-gray-100 px-5 py-4 shadow-sm', s.bg)}>
            <p className="text-[12px] font-medium text-slate-500 mb-1">{s.label}</p>
            <p className={cn('text-2xl font-black', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={cn(
              'px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px',
              filter === t.key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {t.label}
            {t.key !== 'all' && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-gray-100 text-gray-500">
                {orders.filter(o => o.status === t.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* PO list grouped by EOD date */}
      {Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Package className="h-12 w-12 mb-3 opacity-30" />
          <p className="font-medium">No purchase orders found</p>
          <p className="text-sm">EOD-generated POs will appear here</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, pos]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                    EOD — {date !== 'Unknown' ? format(new Date(date), 'd MMMM yyyy') : 'Unknown Date'}
                  </h3>
                  <span className="text-xs text-gray-400">({pos.length} PO{pos.length !== 1 ? 's' : ''})</span>
                </div>
                <div className="space-y-2">
                  {pos.map(po => <PORow key={po.id} po={po} />)}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
