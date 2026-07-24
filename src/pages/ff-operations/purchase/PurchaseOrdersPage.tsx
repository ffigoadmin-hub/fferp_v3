// @ts-nocheck
import { useState } from 'react';
import type { ElementType } from 'react';
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
  id?: number | string;
  itemName?: string;
  product_name?: string;
  item_name?: string;
  quantity?: number;
  required_qty?: number;
  rate?: number;
  unit_price?: number;
  estimated_price?: number;
  unit?: string;
  ordered_qty?: number | null;
  customerDetails?: string;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  hub_id: string | null;
  hub_name: string | null;
  status: string;
  total_amount: number | null;
  sub_total?: number | null;
  vendor_name?: string | null;
  delivery_date?: string | null;
  order_date?: string | null;
  created_at: string;
  notes?: string | null;
  items: POItem[];
}

function itemName(i: POItem) { return i.itemName || i.product_name || i.item_name || '—'; }
function itemQty(i: POItem)  { return Number(i.quantity ?? i.required_qty ?? 0); }
function itemRate(i: POItem) { return Number(i.rate ?? i.unit_price ?? i.estimated_price ?? 0); }

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS: Record<string, { label: string; cls: string; icon: ElementType }> = {
  pending_approval: { label: 'Pending Approval', cls: 'bg-yellow-100 text-yellow-700', icon: Clock        },
  pending:          { label: 'Pending',           cls: 'bg-amber-100  text-amber-700',  icon: Clock        },
  approved:         { label: 'Approved',          cls: 'bg-blue-100   text-blue-700',   icon: CheckCircle2 },
  ordered:          { label: 'Ordered',           cls: 'bg-purple-100 text-purple-700', icon: ShoppingBag  },
  received:         { label: 'Received',          cls: 'bg-green-100  text-green-700',  icon: CheckCircle2 },
  cancelled:        { label: 'Cancelled',         cls: 'bg-red-100    text-red-600',    icon: XCircle      },
  partial:          { label: 'Partial',           cls: 'bg-orange-100 text-orange-700', icon: Package      },
  open:             { label: 'Open',              cls: 'bg-sky-100    text-sky-700',    icon: CheckCircle2 },
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
function PORow({ po, showBuy }: { po: PurchaseOrder; showBuy: boolean }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const items = Array.isArray(po.items) ? po.items : [];
  const dateLabel = po.delivery_date || po.order_date || po.created_at;

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 bg-white hover:bg-slate-50 transition-colors text-left"
      >
        {open
          ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
          : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}

        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 items-center">
          <div>
            <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">PO Number</p>
            <p className="text-sm font-bold text-blue-700">{po.po_number}</p>
            {po.hub_name && <p className="text-[11px] text-gray-500 mt-0.5">{po.hub_name}</p>}
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-gray-400" />
            <div>
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Date</p>
              <p className="text-sm font-semibold text-gray-700">
                {dateLabel ? format(new Date(dateLabel), 'd MMM yyyy') : '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Hash className="h-3.5 w-3.5 text-gray-400" />
            <div>
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Items / Amount</p>
              <p className="text-sm font-semibold text-gray-700">
                {items.length} items · ₹{Number(po.total_amount ?? po.sub_total ?? 0).toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          <div className="flex justify-end md:justify-start">
            <StatusBadge status={po.status} />
          </div>
        </div>

        {showBuy && (
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
        )}
      </button>

      {open && (
        <div className="bg-gray-50 border-t border-gray-100 px-5 py-3">
          {items.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">No items in this PO.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-200">
                  <th className="text-left py-2 font-semibold">Product</th>
                  <th className="text-right py-2 font-semibold">Qty</th>
                  <th className="text-right py-2 font-semibold">Rate</th>
                  <th className="text-right py-2 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-white transition-colors">
                    <td className="py-2.5 font-medium text-gray-800">{itemName(item)}</td>
                    <td className="py-2.5 text-right text-gray-700">{itemQty(item).toFixed(1)} {item.unit || 'kg'}</td>
                    <td className="py-2.5 text-right text-gray-700">
                      {itemRate(item) ? `₹${itemRate(item).toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="py-2.5 text-right text-gray-700">
                      {itemRate(item) ? `₹${(itemQty(item) * itemRate(item)).toLocaleString('en-IN')}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {po.notes && <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">{po.notes}</p>}
        </div>
      )}
    </div>
  );
}

// ── Hub name helpers — handle spelling variants (Palikarani vs Pallikaranai)
const normHub = (s: string) =>
  (s ?? '').toLowerCase().replace(/\s*hub\s*/gi, '').replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');
// Two hub names match if normalised forms share ≥8 char prefix
// e.g. "palikarani" vs "palikaranai" → share "palikaran" (9) → same hub
const hubNormMatch = (a: string, b: string) => {
  if (!a || !b || a.length < 5 || b.length < 5) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i >= 8;
};

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function PurchaseOrdersPage() {
  const { user } = useAuth();
  const hubId = (user as any)?.hub_id ?? null;
  const isManagement = ['ceo', 'gm', 'admin', 'director', 'ff_operations_manager'].includes(user?.role ?? '');
  const showBuy = user?.role === 'shift_employee';
  const [filter, setFilter] = useState<'all' | 'pending' | 'ordered' | 'received'>('all');

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['purchase-orders-exec', hubId],
    queryFn: async () => {
      // Fetch all POs — filter client-side so spelling variants of hub names still match
      // (DB may have duplicate hub records: "Palikarani Hub" vs "Pallikarani Hub" with different UUIDs)
      const { data, error } = await (supabase as any)
        .from('purchase_orders')
        .select('id, po_number, hub_id, hub_name, status, total_amount, sub_total, vendor_name, delivery_date, order_date, created_at, notes, items, assigned_executive_id')
        .order('created_at', { ascending: false });

      if (error) throw error;
      let result = (data ?? []).map((po: any) => ({
        ...po,
        items: Array.isArray(po.items) ? po.items : [],
      })) as PurchaseOrder[];

      // Purchase Executives only see POs actually assigned to them by their hub
      // manager (via the PO Assignment page) — not every PO for their hub.
      if (user?.role === 'shift_employee') {
        result = result.filter(po => po.assigned_executive_id === user.id);
      } else if (!isManagement && hubId) {
        // Non-management, non-exec roles (e.g. hub_manager): keep only this hub's POs
        // Fetch exec's canonical hub name for fuzzy fallback matching
        const { data: hubRow } = await (supabase as any)
          .from('hubs').select('name').eq('id', hubId).maybeSingle();
        const execNorm = normHub(hubRow?.name ?? '');

        result = result.filter(po =>
          po.hub_id === hubId ||                                          // exact UUID match (fast path)
          (execNorm.length >= 5 && hubNormMatch(normHub(po.hub_name ?? ''), execNorm)) // fuzzy name fallback
        );
      }

      return result;
    },
    enabled: !!user,
  });

  const filtered = filter === 'all'
    ? orders
    : filter === 'pending'
      ? orders.filter(o => o.status === 'pending' || o.status === 'pending_approval')
      : orders.filter(o => o.status === filter);

  const grouped = filtered.reduce<Record<string, PurchaseOrder[]>>((acc, po) => {
    const raw = po.order_date ?? po.delivery_date ?? po.created_at;
    const key = raw ? raw.slice(0, 10) : 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(po);
    return acc;
  }, {});

  const tabs: Array<{ key: typeof filter; label: string }> = [
    { key: 'all',      label: 'All POs'  },
    { key: 'pending',  label: 'Pending'  },
    { key: 'ordered',  label: 'Ordered'  },
    { key: 'received', label: 'Received' },
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-blue-600" />
            My Purchase Orders
          </h1>
          <p className="text-[13px] text-slate-500">All EOD-generated POs assigned to your hub</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total POs', value: orders.length,                                                                              color: 'text-blue-700',   bg: 'bg-blue-50'   },
          { label: 'Pending',   value: orders.filter(o => o.status === 'pending' || o.status === 'pending_approval').length,       color: 'text-amber-700',  bg: 'bg-amber-50'  },
          { label: 'Ordered',   value: orders.filter(o => o.status === 'ordered').length,                                          color: 'text-purple-700', bg: 'bg-purple-50' },
          { label: 'Received',  value: orders.filter(o => o.status === 'received').length,                                         color: 'text-green-700',  bg: 'bg-green-50'  },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl border border-gray-100 px-5 py-4 shadow-sm', s.bg)}>
            <p className="text-[12px] font-medium text-slate-500 mb-1">{s.label}</p>
            <p className={cn('text-2xl font-black', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={cn(
              'px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px',
              filter === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
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
                    {date !== 'Unknown' ? format(new Date(date), 'd MMMM yyyy') : 'Unknown Date'}
                  </h3>
                  <span className="text-xs text-gray-400">({pos.length} PO{pos.length !== 1 ? 's' : ''})</span>
                </div>
                <div className="space-y-2">
                  {pos.map(po => <PORow key={po.id} po={po} showBuy={showBuy} />)}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
