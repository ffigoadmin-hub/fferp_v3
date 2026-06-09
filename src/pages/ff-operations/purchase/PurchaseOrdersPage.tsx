import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Plus, X, Search, ChevronDown,
  MoreVertical, Edit2, Trash2, Copy,
  ArrowLeft, ArrowRight,
  Package, ShoppingCart, Receipt, CreditCard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  fetchAllPOs, savePOToStore, deletePOFromStore, fetchMaxPOSerial,
  type StoredPO,
} from '@/lib/purchaseStore';

// ─── Types ────────────────────────────────────────────────
interface LineItem {
  id: number;
  itemName: string;
  account: string;
  quantity: number;
  rate: number;
}

interface PurchaseOrder {
  id: number;
  poNumber: string;
  vendorName: string;
  date: string;
  deliveryDate: string;
  status: 'draft' | 'open' | 'billed' | 'cancelled';
  total: number;
  currency: string;
}

// ─── Item suggestions ─────────────────────────────────────
const ITEM_SUGGESTIONS = [
  'Rice Bags (50kg)', 'Wheat Flour (25kg)', 'Sunflower Oil (15L)',
  'Sugar (50kg)', 'Salt (25kg)', 'Fertilizer (50kg)',
  'Pesticide (5L)', 'Tractor Fuel (200L)', 'Packaging Boxes (100)',
  'Seeds (10kg)', 'Irrigation Pipes (m)', 'Gloves (pair)',
  'Tomatoes', 'Onions', 'Potatoes', 'Carrots', 'Spinach', 'Cabbage',
  'Mangoes', 'Bananas', 'Apples', 'Grapes', 'Pomegranate',
];

function formatDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatCurrency(n: number, cur = 'INR') {
  return `${cur} ${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

// ─── useOutsideClick ──────────────────────────────────────
function useOutsideClick(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      handler();
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [ref, handler]);
}

// ─── Life Cycle Banner ────────────────────────────────────
function LifeCycleBanner() {
  const steps = [
    { label: 'RAISE PURCHASE ORDER', icon: <ShoppingCart className="w-5 h-5 text-blue-500" /> },
    { label: 'RECEIVE GOODS',        icon: <Package      className="w-5 h-5 text-green-500" /> },
    { label: 'CONVERT TO BILL',      icon: <Receipt      className="w-5 h-5 text-purple-500" /> },
    { label: 'RECORD PAYMENT',       icon: <CreditCard   className="w-5 h-5 text-blue-400" /> },
  ];
  const connectors = ['CONVERT TO OPEN', '', ''];

  return (
    <div className="bg-white border-b border-gray-100 px-8 py-8">
      <p className="text-center text-base font-semibold text-gray-700 mb-8">Life cycle of a Purchase Order</p>
      <div className="flex items-center justify-center gap-0 flex-wrap">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center">
            <div className="flex items-center gap-2.5 px-5 py-3 border-2 border-blue-200 rounded-xl bg-white shadow-sm min-w-[160px]">
              {step.icon}
              <span className="text-xs font-bold text-gray-700 tracking-wide leading-tight">{step.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className="flex flex-col items-center mx-1">
                {connectors[i] && (
                  <span className="text-[9px] text-gray-400 font-semibold tracking-widest uppercase mb-0.5 whitespace-nowrap">
                    {connectors[i]}
                  </span>
                )}
                <div className="flex items-center gap-0.5">
                  {[1,2,3,4,5].map(d => (
                    <div key={d} className="w-2 h-0.5 bg-blue-300 rounded-full" />
                  ))}
                  <ArrowRight className="w-3 h-3 text-blue-400 -ml-0.5" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Item Row ─────────────────────────────────────────────
function ItemRow({ row, onChange, onRemove }: {
  row: LineItem;
  onChange: (id: number, k: keyof LineItem, v: string | number) => void;
  onRemove: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(row.itemName);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => { setOpen(false); });

  const filtered = ITEM_SUGGESTIONS.filter(i =>
    i.toLowerCase().includes(input.toLowerCase())
  );

  return (
    <tr className="group border-b border-gray-100 hover:bg-blue-50/20 transition-colors">
      {/* Item name */}
      <td className="py-2.5 px-3" style={{ minWidth: 280 }}>
        <div ref={ref} className="relative">
          <input
            value={input}
            placeholder="Type item / product name…"
            onChange={e => {
              const v = e.target.value;
              setInput(v);
              onChange(row.id, 'itemName', v);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            className="w-full h-9 px-2 text-sm border border-transparent hover:border-gray-200 rounded-md focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 bg-transparent text-gray-700 placeholder-gray-400"
          />
          {open && filtered.length > 0 && (
            <div className="absolute z-50 left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden w-72">
              <div className="max-h-48 overflow-y-auto">
                {filtered.map(name => (
                  <button
                    key={name} type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      onChange(row.id, 'itemName', name);
                      setInput(name);
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </td>
      {/* Quantity */}
      <td className="py-2.5 px-3" style={{ width: 130 }}>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChange(row.id, 'quantity', Math.max(1, row.quantity - 1))}
            className="w-7 h-7 rounded-md border border-gray-200 flex items-center justify-center text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors font-bold text-sm leading-none shrink-0"
          >−</button>
          <input
            type="number" min="1" step="1" value={row.quantity}
            onChange={e => onChange(row.id, 'quantity', parseInt(e.target.value) || 1)}
            className="flex-1 h-7 text-center text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 bg-white text-gray-700 font-medium"
          />
          <button
            type="button"
            onClick={() => onChange(row.id, 'quantity', row.quantity + 1)}
            className="w-7 h-7 rounded-md border border-gray-200 flex items-center justify-center text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors font-bold text-sm leading-none shrink-0"
          >+</button>
        </div>
      </td>
      {/* Remove */}
      <td className="py-2.5 pr-3 w-8 text-right">
        <button
          type="button" onClick={() => onRemove(row.id)}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-1 rounded"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}

// ─── New PO Form ──────────────────────────────────────────
function NewPOForm({ onClose, onSave, editData }: {
  onClose: () => void;
  onSave: (po: Omit<PurchaseOrder, 'id'>, items: LineItem[]) => void;
  editData?: PurchaseOrder | null;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [nextSerial, setNextSerial] = useState(0);
  useEffect(() => { fetchMaxPOSerial().then(s => setNextSerial(s + 1)); }, []);

  const poNumber = editData?.poNumber ?? `PO-${String(nextSerial).padStart(5, '0')}`;

  const [items, setItems] = useState<LineItem[]>([
    { id: 1, itemName: '', account: '', quantity: 1, rate: 0 },
  ]);

  const addRow = () => setItems(p => [
    ...p, { id: Date.now(), itemName: '', account: '', quantity: 1, rate: 0 }
  ]);

  const removeRow = (id: number) => {
    if (items.length <= 1) return;
    setItems(p => p.filter(r => r.id !== id));
  };

  const changeItem = useCallback((id: number, k: keyof LineItem, v: string | number) => {
    setItems(p => p.map(r => r.id === id ? { ...r, [k]: v } : r));
  }, []);

  const handleSave = (asDraft = false) => {
    const validItems = items.filter(i => i.itemName.trim());
    if (validItems.length === 0) {
      toast.error('Add at least one item');
      return;
    }
    const status: PurchaseOrder['status'] = asDraft ? 'draft' : 'open';

    const storedPO: StoredPO = {
      id:           editData?.id ? String(editData.id) : '',
      poNumber,
      vendorName:   '',
      date:         today,
      deliveryDate: '',
      paymentTerms: '',
      status,
      items: validItems.map(i => ({
        id:              i.id,
        itemName:        i.itemName,
        account:         '',
        quantity:        i.quantity,
        rate:            0,
        tax:             '',
        discount:        0,
        customerDetails: '',
      })),
      subTotal: 0,
      total:    0,
      notes:    '',
    };
    savePOToStore(storedPO).catch(console.error);

    onSave(
      { poNumber, vendorName: '', date: today, deliveryDate: '', status, total: 0, currency: 'INR' },
      items,
    );
    toast.success(asDraft ? 'Saved as draft' : 'Purchase order created');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <ShoppingCart className="w-6 h-6 text-gray-600" />
          <h2 className="text-xl font-bold text-gray-900">
            {editData ? 'Edit Purchase Order' : 'New Purchase Order'}
          </h2>
          <span className="text-sm text-gray-400 font-mono bg-gray-100 px-2.5 py-1 rounded-lg">
            {poNumber}
          </span>
        </div>
        <button onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-10">

          <div className="border border-gray-200 rounded-2xl overflow-visible">
            {/* Card header */}
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
              <p className="text-sm font-bold text-gray-800">Order Items</p>
              <p className="text-xs text-gray-400 mt-0.5">Add the products / items you want to purchase</p>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Item / Product Name
                    </th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ width: 130 }}>
                      Quantity
                    </th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {items.map(row => (
                    <ItemRow key={row.id} row={row} onChange={changeItem} onRemove={removeRow} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add row */}
            <div className="px-5 py-3 border-t border-gray-100">
              <button type="button" onClick={addRow}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-semibold py-1 transition-colors">
                <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                  <Plus className="w-2.5 h-2.5 text-white" />
                </div>
                Add Another Item
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <div className="px-8 py-4 border-t border-gray-200 flex items-center gap-3 shrink-0 bg-white">
        <Button onClick={() => handleSave(false)}
          className="h-9 px-6 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold">
          Save Order
        </Button>
        <Button variant="outline" onClick={() => handleSave(true)}
          className="h-9 px-5 text-sm border-gray-300 text-gray-600 hover:bg-gray-50">
          Save as Draft
        </Button>
        <Button variant="ghost" onClick={onClose}
          className="h-9 px-4 text-sm text-gray-500 hover:text-gray-700">
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── PO Detail View (read-only) ──────────────────────────
function PODetailView({ order, storedPOs, onClose, onEdit }: {
  order: PurchaseOrder;
  storedPOs: StoredPO[];
  onClose: () => void;
  onEdit: () => void;
}) {
  const stored = storedPOs.find(s => s.poNumber === order.poNumber);
  const items  = stored?.items ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-xl font-bold text-gray-900">{order.poNumber}</span>
          <StatusBadge status={order.status} />
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={onEdit} variant="outline" className="h-9 px-4 text-sm border-gray-300 text-gray-600">
            <Edit2 className="w-4 h-4 mr-1.5" /> Edit
          </Button>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
        <div className="max-w-2xl mx-auto space-y-5">

          {/* Info strip */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-8">
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">PO Number</p>
              <p className="text-sm font-bold text-gray-800 font-mono">{order.poNumber}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Date</p>
              <p className="text-sm text-gray-700">{formatDate(order.date)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Status</p>
              <StatusBadge status={order.status} />
            </div>
          </div>

          {/* Items table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-sm font-semibold text-gray-700">
                Items{items.length > 0 ? ` (${items.length})` : ''}
              </p>
            </div>
            {items.length === 0 ? (
              <div className="p-10 text-center">
                <Package className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No items recorded for this PO</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Item / Product</th>
                    <th className="px-4 py-2.5 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider" style={{ width: 100 }}>Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-sm text-gray-800 font-medium">{item.itemName || '—'}</td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-700 text-center">{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {stored?.notes && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">Notes</p>
              <p className="text-sm text-amber-800">{stored.notes}</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────
function StatusBadge({ status }: { status: PurchaseOrder['status'] }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700' },
    draft:     { label: 'Draft',     cls: 'bg-gray-100 text-gray-600' },
    open:      { label: 'Open',      cls: 'bg-blue-100 text-blue-700' },
    billed:    { label: 'Billed',    cls: 'bg-green-100 text-green-700' },
    received:  { label: 'Received',  cls: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-600' },
  };
  const s = map[status] ?? { label: status ?? 'Unknown', cls: 'bg-gray-100 text-gray-500' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}

// ─── Row Kebab ────────────────────────────────────────────
function RowMenu({ onEdit, onDuplicate, onDelete }: {
  onEdit: () => void; onDuplicate: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100">
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-36 z-50">
          <button type="button" onClick={() => { onEdit(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700">
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </button>
          <button type="button" onClick={() => { onDuplicate(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700">
            <Copy className="w-3.5 h-3.5" /> Duplicate
          </button>
          <div className="border-t border-gray-100 my-1" />
          <button type="button" onClick={() => { onDelete(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────
export default function PurchaseOrdersPage() {
  const qc = useQueryClient();
  const { data: storedPOs = [] } = useQuery({ queryKey: ['all-pos'], queryFn: fetchAllPOs });
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);

  useEffect(() => {
    setOrders(storedPOs.map((s, i) => ({
      id:           i + 1,
      poNumber:     s.poNumber,
      vendorName:   s.vendorName,
      date:         s.date,
      deliveryDate: s.deliveryDate,
      status:       s.status,
      total:        s.total,
      currency:     'INR',
    })));
  }, [storedPOs]);

  const [showForm,     setShowForm]     = useState(false);
  const [editOrder,    setEditOrder]    = useState<PurchaseOrder | null>(null);
  const [viewOrder,    setViewOrder]    = useState<PurchaseOrder | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | PurchaseOrder['status']>('all');
  const [dateFilter,   setDateFilter]   = useState<'today' | 'all'>('today');
  const [search,       setSearch]       = useState('');
  const [showLifeCycle, setShowLifeCycle] = useState(true);
  const todayStr = new Date().toISOString().split('T')[0];

  // Merge DB POs
  useQuery({
    queryKey: ['purchase-orders-db'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('purchase_orders')
        .select('id, po_number, vendor_name, created_at, delivery_date, status, total_amount')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) return [];
      const dbPOs: PurchaseOrder[] = (data ?? []).map((row: any, i: number) => ({
        id:           Date.now() + i,
        poNumber:     row.po_number,
        vendorName:   row.vendor_name || '',
        date:         row.created_at?.slice(0, 10) ?? '',
        deliveryDate: row.delivery_date ?? '',
        status:       (row.status === 'approved' ? 'open' : row.status) as PurchaseOrder['status'],
        total:        Number(row.total_amount || 0),
        currency:     'INR',
      }));
      setOrders(prev => {
        const localOnly = prev.filter(p => !dbPOs.some(d => d.poNumber === p.poNumber));
        return [...dbPOs, ...localOnly];
      });
      return dbPOs;
    },
    refetchInterval: 30_000,
  });

  const filtered = orders.filter(o => {
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    const matchSearch = o.poNumber.toLowerCase().includes(search.toLowerCase());
    const matchDate   = dateFilter === 'all' || (o.date && o.date.startsWith(todayStr));
    return matchStatus && matchSearch && matchDate;
  });

  const handleSave = (data: Omit<PurchaseOrder, 'id'>, _items: unknown) => {
    if (editOrder) {
      setOrders(p => p.map(o => o.id === editOrder.id ? { ...o, ...data } : o));
    } else {
      setOrders(p => [{ ...data, id: Date.now() }, ...p]);
    }
    // refresh from DB
    qc.invalidateQueries({ queryKey: ['all-pos'] });
    qc.invalidateQueries({ queryKey: ['purchase-orders-db'] });
  };

  const handleDuplicate = async (o: PurchaseOrder) => {
    const serial = await fetchMaxPOSerial();
    const newNum = `PO-${String(serial + 1).padStart(5, '0')}`;
    await savePOToStore({
      id: '', poNumber: newNum, vendorName: '',
      date: o.date, deliveryDate: '', paymentTerms: '',
      status: 'draft', items: [], subTotal: 0, total: 0, notes: '',
    });
    qc.invalidateQueries({ queryKey: ['all-pos'] });
    toast.success('Purchase order duplicated');
  };

  const handleDelete = async (id: number) => {
    const po = orders.find(o => o.id === id);
    if (po) await deletePOFromStore(po.poNumber);
    qc.invalidateQueries({ queryKey: ['all-pos'] });
    toast.success('Purchase order deleted');
  };

  const openNew  = () => { setEditOrder(null); setShowForm(true); };
  const openEdit = (o: PurchaseOrder) => { setEditOrder(o); setViewOrder(null); setShowForm(true); };
  const openView = (o: PurchaseOrder) => { setViewOrder(o); };

  const counts = {
    all:       orders.length,
    draft:     orders.filter(o => o.status === 'draft').length,
    open:      orders.filter(o => o.status === 'open').length,
    billed:    orders.filter(o => o.status === 'billed').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* PO Detail View */}
      {viewOrder && !showForm && (
        <PODetailView
          order={viewOrder}
          storedPOs={storedPOs}
          onClose={() => setViewOrder(null)}
          onEdit={() => openEdit(viewOrder)}
        />
      )}

      {/* Full-screen PO Form */}
      {showForm && (
        <NewPOForm
          onClose={() => setShowForm(false)}
          onSave={handleSave}
          editData={editOrder}
        />
      )}

      {/* Life Cycle banner */}
      {showLifeCycle && (
        <div className="relative">
          <LifeCycleBanner />
          <button onClick={() => setShowLifeCycle(false)}
            className="absolute top-3 right-4 text-xs text-gray-400 hover:text-gray-600 font-medium">
            Hide
          </button>
        </div>
      )}

      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Purchase Orders</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage your purchase orders</p>
          </div>
          <div className="flex items-center gap-3">
            {!showLifeCycle && (
              <button onClick={() => setShowLifeCycle(true)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50">
                Show Lifecycle
              </button>
            )}
            <Button onClick={openNew}
              className="h-9 px-4 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold">
              <Plus className="w-4 h-4 mr-1.5" /> New Purchase Order
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4">

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Orders', value: counts.all,    color: 'text-blue-600',  bg: 'bg-blue-50'  },
              { label: 'Open',         value: counts.open,   color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Billed',       value: counts.billed, color: 'text-green-600', bg: 'bg-green-50' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-xl border border-gray-200 px-5 py-4`}>
                <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Table card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Filters */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 gap-4 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <button type="button"
                  onClick={() => setDateFilter(d => d === 'today' ? 'all' : 'today')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors border ${
                    dateFilter === 'today'
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}>
                  {dateFilter === 'today' ? '📅 Today' : '📅 All Time'}
                </button>
                <div className="w-px h-5 bg-gray-200" />
                {(['all', 'draft', 'open', 'billed', 'cancelled'] as const).map(s => (
                  <button key={s} type="button" onClick={() => setFilterStatus(s)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                      filterStatus === s
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                    }`}>
                    {s === 'all'
                      ? `All (${counts.all})`
                      : `${s.charAt(0).toUpperCase() + s.slice(1)} (${counts[s as keyof typeof counts]})`
                    }
                  </button>
                ))}
              </div>
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search PO number…"
                  className="w-full h-8 pl-9 pr-3 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400" />
                {search && (
                  <button onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['PO Number', 'Items', 'Date', 'Status', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <ShoppingCart className="w-10 h-10 text-gray-200" />
                        <p className="text-sm text-gray-400 font-medium">No purchase orders found</p>
                        <Button onClick={openNew} size="sm"
                          className="h-8 px-4 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                          <Plus className="w-3.5 h-3.5 mr-1" /> Create First PO
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map(o => {
                  const poItems = storedPOs.find(s => s.poNumber === o.poNumber)?.items ?? [];
                  const itemSummary = poItems.length > 0
                    ? poItems.slice(0, 2).map(i => i.itemName).filter(Boolean).join(', ')
                      + (poItems.length > 2 ? ` +${poItems.length - 2} more` : '')
                    : '—';
                  return (
                    <tr key={o.id}
                      className="group hover:bg-blue-50/30 transition-colors cursor-pointer"
                      onClick={() => openView(o)}>
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-blue-600 hover:underline">
                          {o.poNumber}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[280px] truncate">
                        {itemSummary}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(o.date)}</td>
                      <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <RowMenu
                          onEdit={() => openEdit(o)}
                          onDuplicate={() => handleDuplicate(o)}
                          onDelete={() => handleDelete(o.id)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  );
}
