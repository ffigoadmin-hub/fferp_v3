// @ts-nocheck
import React, { useState, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import {
  Plus, Download, Search, Eye, Edit2, CheckCircle2, X,
  Package, FileText, ChevronDown, Truck, Calendar,
  MoreVertical, Zap, ClipboardList, ShoppingCart,
  ArrowUpDown, RefreshCw, Filter, ThumbsUp, ThumbsDown,
  Clock, AlertCircle, ShoppingBag, Building2, Sun, Moon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchBoughtQty } from '@/lib/buyStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  fetchAllPOs, savePOToStore, deletePOFromStore, fetchMaxPOSerial,
  fetchPendingApprovalPOs,
  type StoredPO, type StoredPOItem,
} from '@/lib/purchaseStore';
// vendorStore no longer needed — PO is linked to sales orders, not vendors

// ─── Types ────────────────────────────────────────────────────────────────────

interface AggregatedProduct {
  productName: string;
  totalOrders: number;
  totalQty: number;
  unit: string;
  avgPrice: number;
  totalValue: number;
  suggestedVendor: string;
  status: 'Pending' | 'PO Created' | 'Verified';
}

interface CustomerOrder {
  id: string;
  shopName: string;
  customerName: string;
  address: string;
  phone: string;
  products: Array<{ name: string; qty: number; unit: string; price: number }>;
  orderDate: string;
  deliveryDate: string;
  status: string;
}

interface POModalItem {
  id: number;
  product: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

// ─── Cost price map (grade_c_price = our avg purchase price from vendors) ──
// Selling price (grade_a) is always higher → profit = selling - cost
const PRODUCT_COST_MAP: Record<string, number> = {
  'Onion':        22,
  'Tomato':       32,
  'Potato':       26,
  'Carrot':       30,
  'Cabbage':      14,
  'Beetroot':     20,
  'Coriander':    50,
  'Drumstick':    35,
  'Beans':        44,
  'Brinjal':      22,
  'Capsicum':     40,
  'Lady Finger':  30,
  'Raw Banana':   24,
  'Bitter Gourd': 28,
  'Green Chilli': 40,
  'Garlic':       80,
  'Ginger':       70,
  'Spinach':      20,
  'Mango':        50,
  'Banana':       28,
  'Apple':        90,
  'Papaya':       22,
  'Watermelon':   10,
  'Rice':         52,
  'Wheat':        26,
  'Toor Dal':     100,
  'Moong Dal':    90,
  'Coconut Oil':  140,
  'Sunflower Oil':120,
  'Milk':         52,
  'Paneer':       260,
  'Turmeric':     100,
  'Red Chilli':   130,
  'Cumin':        250,
};

const PRODUCT_VENDOR_MAP: Record<string, string> = {
  Onion: 'Ravi Farms',
  Tomato: 'Fresh Vendors Co.',
  Potato: 'AK Traders',
  Carrot: 'Green Valley Agro',
  Cabbage: 'Tamil Nadu Produce',
  Beetroot: 'Sri Murugan Traders',
};

const MOCK_CUSTOMER_ORDERS: CustomerOrder[] = [
  { id: 'ORD001', shopName: 'Fresh Mart', customerName: 'Suresh Kumar', address: '45, Anna Nagar, Chennai', phone: '9444123456', products: [{ name: 'Onion', qty: 5, unit: 'kg', price: 25 }, { name: 'Tomato', qty: 3, unit: 'kg', price: 40 }], orderDate: '2026-05-16', deliveryDate: '2026-05-18', status: 'Pending' },
  { id: 'ORD002', shopName: 'Daily Needs', customerName: 'Priya S', address: '12, T Nagar, Chennai', phone: '9555234567', products: [{ name: 'Onion', qty: 8, unit: 'kg', price: 26 }, { name: 'Potato', qty: 5, unit: 'kg', price: 30 }], orderDate: '2026-05-16', deliveryDate: '2026-05-18', status: 'Pending' },
  { id: 'ORD003', shopName: 'Green Grocers', customerName: 'Rajan M', address: '78, Velachery, Chennai', phone: '9666345678', products: [{ name: 'Onion', qty: 10, unit: 'kg', price: 25 }, { name: 'Carrot', qty: 4, unit: 'kg', price: 35 }], orderDate: '2026-05-16', deliveryDate: '2026-05-19', status: 'Pending' },
  { id: 'ORD004', shopName: 'Star Veggie', customerName: 'Kalpana R', address: '23, Adyar, Chennai', phone: '9777456789', products: [{ name: 'Tomato', qty: 6, unit: 'kg', price: 40 }, { name: 'Onion', qty: 4, unit: 'kg', price: 25 }], orderDate: '2026-05-16', deliveryDate: '2026-05-18', status: 'Pending' },
  { id: 'ORD005', shopName: 'Healthy Hub', customerName: 'Vikram B', address: '56, Porur, Chennai', phone: '9888567890', products: [{ name: 'Potato', qty: 8, unit: 'kg', price: 30 }, { name: 'Onion', qty: 5, unit: 'kg', price: 26 }], orderDate: '2026-05-16', deliveryDate: '2026-05-19', status: 'Pending' },
  { id: 'ORD006', shopName: 'Farm Fresh', customerName: 'Deepa L', address: '89, Tambaram, Chennai', phone: '9999678901', products: [{ name: 'Carrot', qty: 6, unit: 'kg', price: 35 }, { name: 'Tomato', qty: 5, unit: 'kg', price: 42 }], orderDate: '2026-05-15', deliveryDate: '2026-05-17', status: 'Pending' },
  { id: 'ORD007', shopName: "Nature's Best", customerName: 'Arun K', address: '34, Kodambakkam, Chennai', phone: '9111789012', products: [{ name: 'Onion', qty: 12, unit: 'kg', price: 24 }, { name: 'Potato', qty: 6, unit: 'kg', price: 31 }], orderDate: '2026-05-15', deliveryDate: '2026-05-17', status: 'Pending' },
  { id: 'ORD008', shopName: 'Quick Shop', customerName: 'Meena T', address: '67, Guindy, Chennai', phone: '9222890123', products: [{ name: 'Tomato', qty: 4, unit: 'kg', price: 41 }, { name: 'Carrot', qty: 3, unit: 'kg', price: 36 }], orderDate: '2026-05-15', deliveryDate: '2026-05-17', status: 'Pending' },
  { id: 'ORD009', shopName: 'Veg Palace', customerName: 'Senthil V', address: '90, Sholinganallur, Chennai', phone: '9333901234', products: [{ name: 'Cabbage', qty: 10, unit: 'kg', price: 20 }, { name: 'Onion', qty: 6, unit: 'kg', price: 25 }], orderDate: '2026-05-15', deliveryDate: '2026-05-18', status: 'Pending' },
  { id: 'ORD010', shopName: 'Green Basket', customerName: 'Kavitha M', address: '45, Perambur, Chennai', phone: '9444012345', products: [{ name: 'Beetroot', qty: 4, unit: 'kg', price: 28 }, { name: 'Carrot', qty: 5, unit: 'kg', price: 34 }], orderDate: '2026-05-15', deliveryDate: '2026-05-17', status: 'Pending' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function aggregateProducts(orders: CustomerOrder[]): AggregatedProduct[] {
  const map = new Map<string, { qty: number; prices: number[]; orderIds: Set<string>; unit: string }>();

  for (const order of orders) {
    for (const p of order.products) {
      const existing = map.get(p.name);
      if (existing) {
        existing.qty += p.qty;
        existing.prices.push(p.price);
        existing.orderIds.add(order.id);
      } else {
        map.set(p.name, { qty: p.qty, prices: [p.price], orderIds: new Set([order.id]), unit: p.unit });
      }
    }
  }

  return Array.from(map.entries()).map(([name, data]) => {
    const avgPrice = data.prices.reduce((s, p) => s + p, 0) / data.prices.length;
    return {
      productName: name,
      totalOrders: data.orderIds.size,
      totalQty: data.qty,
      unit: data.unit,
      avgPrice: Math.round(avgPrice),
      totalValue: Math.round(data.qty * avgPrice),
      suggestedVendor: PRODUCT_VENDOR_MAP[name] || 'TBD',
      status: 'Pending' as const,
    };
  });
}

function fmt(n: number) { return n.toLocaleString('en-IN'); }

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { cls: string; label: string }> = {
    Pending:          { cls: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Pending' },
    'PO Created':     { cls: 'bg-blue-100 text-blue-700 border-blue-200',       label: 'PO Created' },
    Verified:         { cls: 'bg-green-100 text-green-700 border-green-200',     label: 'Verified' },
    draft:            { cls: 'bg-gray-100 text-gray-600 border-gray-200',        label: 'Draft' },
    pending_approval: { cls: 'bg-amber-100 text-amber-700 border-amber-200',     label: 'Pending Approval' },
    open:             { cls: 'bg-blue-100 text-blue-700 border-blue-200',        label: 'Approved' },
    rejected:         { cls: 'bg-red-100 text-red-600 border-red-200',           label: 'Rejected' },
    billed:           { cls: 'bg-purple-100 text-purple-700 border-purple-200',  label: 'Billed' },
    cancelled:        { cls: 'bg-red-100 text-red-600 border-red-200',           label: 'Cancelled' },
  };
  const c = cfg[status] ?? { cls: 'bg-gray-100 text-gray-600 border-gray-200', label: status };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${c.cls}`}>
      {c.label}
    </span>
  );
}

// ─── Create / Edit PO Modal ───────────────────────────────────────────────────

function CreatePOModal({
  open, onClose, prefillItems = [], linkedOrders = [], editPO = null,
  onSave,
}: {
  open: boolean; onClose: () => void;
  prefillItems?: Array<{ product: string; qty: number; unit: string; rate: number }>;
  linkedOrders?: CustomerOrder[];
  editPO?: StoredPO | null;
  onSave: () => void;
}) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [nextSerial, setNextSerial] = useState(0);
  useEffect(() => { fetchMaxPOSerial().then(s => setNextSerial(s + 1)); }, []);
  const autoPONum = `PO-${String(nextSerial).padStart(5, '0')}`;

  const [poDate, setPoDate] = useState(editPO?.date ?? today);
  const [delivDate, setDelivDate] = useState(editPO?.deliveryDate ?? '');
  const [notes, setNotes] = useState(editPO?.notes ?? '');
  const [showOrders, setShowOrders] = useState(false);
  const [items, setItems] = useState<POModalItem[]>(() => {
    if (editPO?.items?.length) {
      return editPO.items.map((i, idx) => ({
        id: idx + 1, product: i.itemName, quantity: i.quantity,
        unit: 'kg', rate: i.rate, amount: i.quantity * i.rate,
      }));
    }
    if (prefillItems.length) {
      return prefillItems.map((p, idx) => ({
        id: idx + 1, product: p.product, quantity: p.qty, unit: p.unit,
        rate: p.rate, amount: p.qty * p.rate,
      }));
    }
    return [{ id: 1, product: '', quantity: 0, unit: 'kg', rate: 0, amount: 0 }];
  });

  useEffect(() => {
    if (!open) return;
    setPoDate(editPO?.date ?? today);
    setDelivDate(editPO?.deliveryDate ?? '');
    setNotes(editPO?.notes ?? '');
    setShowOrders(false);
    if (editPO?.items?.length) {
      setItems(editPO.items.map((i, idx) => ({ id: idx + 1, product: i.itemName, quantity: i.quantity, unit: 'kg', rate: i.rate, amount: i.quantity * i.rate })));
    } else if (prefillItems.length) {
      setItems(prefillItems.map((p, idx) => ({ id: idx + 1, product: p.product, quantity: p.qty, unit: p.unit, rate: p.rate, amount: p.qty * p.rate })));
    }
  }, [open]);

  const updateItem = (id: number, field: keyof POModalItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      updated.amount = (updated.quantity || 0) * (updated.rate || 0);
      return updated;
    }));
  };

  const addItem = () => {
    setItems(prev => [...prev, { id: Date.now(), product: '', quantity: 0, unit: 'kg', rate: 0, amount: 0 }]);
  };

  const removeItem = (id: number) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const subTotal = items.reduce((s, i) => s + i.amount, 0);
  const tax = subTotal * 0.05;
  const total = subTotal + tax;

  // Derive earliest delivery date from linked orders
  const earliestDelivery = linkedOrders.length > 0
    ? linkedOrders.map(o => o.deliveryDate).filter(Boolean).sort()[0]
    : '';

  const handleSave = (status: 'draft' | 'pending_approval') => {
    if (items.some(i => !i.product.trim())) { toast.error('Fill all product names'); return; }

    const po: StoredPO = {
      id: editPO?.id ?? String(Date.now()),
      poNumber: editPO?.poNumber ?? autoPONum,
      vendorName: 'Sales Order Based',
      date: poDate,
      deliveryDate: delivDate || earliestDelivery,
      paymentTerms: 'Net 30',
      status,
      items: items.map((i, idx) => ({
        id: idx + 1, itemName: i.product, account: 'Cost of Goods Sold',
        quantity: i.quantity, rate: i.rate,
        tax: 'GST 5%', discount: 0, customerDetails: '',
      })),
      subTotal, total, notes,
    };
    savePOToStore(po).then(() => {
      toast.success(status === 'draft'
        ? `PO ${po.poNumber} saved as draft`
        : `PO ${po.poNumber} submitted for approval ✓`);
      onSave();
      onClose();
    }).catch(() => toast.error('Failed to save PO'));
  };

  if (!open) return null;

  // Deduplicate orders shown
  const displayOrders = linkedOrders.length > 0 ? linkedOrders : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{editPO ? `Edit ${editPO.poNumber}` : 'Create Purchase Order'}</h2>
            <p className="text-sm text-gray-500 mt-0.5">PO #{editPO?.poNumber ?? autoPONum}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* PO Date + Delivery Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">PO Number</label>
              <input value={editPO?.poNumber ?? autoPONum} readOnly
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">PO Date *</label>
              <input type="date" value={poDate} onChange={e => setPoDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Delivery Date</label>
              <input type="date" value={delivDate || earliestDelivery} onChange={e => setDelivDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {earliestDelivery && !delivDate && (
                <p className="text-[10px] text-blue-500 mt-0.5">Auto-set from earliest order delivery</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Total Orders Linked</label>
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                <ShoppingCart size={15} className="text-blue-600" />
                <span className="text-sm font-bold text-blue-700">{displayOrders.length} Sales Orders</span>
              </div>
            </div>
          </div>

          {/* ── Linked Sales Orders from Sales Team ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ClipboardList size={15} className="text-green-600" />
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Sales Orders from Sales Team
                </label>
                <span className="text-[10px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full">
                  {displayOrders.length} orders
                </span>
              </div>
              {displayOrders.length > 0 && (
                <button onClick={() => setShowOrders(v => !v)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1">
                  {showOrders ? 'Hide' : 'View All'} Orders
                  <ChevronDown size={12} className={`transition-transform ${showOrders ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>

            {displayOrders.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-700">
                No linked orders — this is a manual PO
              </div>
            ) : (
              <>
                {/* Summary cards — always visible */}
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[
                    { label: 'Total Shops', value: new Set(displayOrders.map(o => o.shopName)).size, icon: '🏪' },
                    { label: 'Total Items', value: displayOrders.reduce((s, o) => s + o.products.reduce((ss, p) => ss + p.qty, 0), 0) + ' kg', icon: '📦' },
                    { label: 'Est. Value', value: '₹' + fmt(displayOrders.reduce((s, o) => s + o.products.reduce((ss, p) => ss + p.qty * p.price, 0), 0)), icon: '💰' },
                  ].map(c => (
                    <div key={c.label} className="bg-gray-50 rounded-xl px-3 py-2 text-center">
                      <p className="text-base">{c.icon}</p>
                      <p className="text-sm font-bold text-gray-900">{c.value}</p>
                      <p className="text-[10px] text-gray-400 font-medium">{c.label}</p>
                    </div>
                  ))}
                </div>

                {/* Expanded order list */}
                {showOrders && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {displayOrders.map((order, idx) => (
                      <div key={order.id}
                        className={`flex items-start justify-between px-4 py-2.5 text-sm ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <div className="flex items-start gap-3">
                          <div className="h-7 w-7 rounded-lg bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 flex-shrink-0 mt-0.5">
                            {idx + 1}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800">{order.shopName}</p>
                            <p className="text-[11px] text-gray-400">{order.customerName} · {order.phone}</p>
                            <p className="text-[11px] text-gray-400">{order.address}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <p className="text-xs font-semibold text-gray-700">
                            {order.products.map(p => `${p.name} ${p.qty}${p.unit}`).join(', ')}
                          </p>
                          <p className="text-[10px] text-green-600 font-medium mt-0.5">
                            Delivery: {order.deliveryDate || '—'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Purchase Items (to buy)
              </label>
            </div>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold">Product</th>
                    <th className="px-3 py-2.5 text-left font-semibold w-20">Qty</th>
                    <th className="px-3 py-2.5 text-left font-semibold w-20">Unit</th>
                    <th className="px-3 py-2.5 text-left font-semibold w-24">Rate (₹)</th>
                    <th className="px-3 py-2.5 text-left font-semibold w-28">Amount (₹)</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-t border-gray-100">
                      <td className="px-2 py-1.5">
                        <input value={item.product} onChange={e => updateItem(item.id, 'product', e.target.value)}
                          placeholder="Product name"
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" value={item.quantity || ''} onChange={e => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </td>
                      <td className="px-2 py-1.5">
                        <select value={item.unit} onChange={e => updateItem(item.id, 'unit', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none">
                          {['kg', 'piece', 'litre', 'dozen', 'box'].map(u => <option key={u}>{u}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" value={item.rate || ''} onChange={e => updateItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="text-sm font-medium text-gray-800">₹{fmt(item.amount)}</span>
                      </td>
                      <td className="px-1 py-1.5">
                        <button onClick={() => removeItem(item.id)} className="p-1 text-gray-400 hover:text-red-500"><X size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
                <button onClick={addItem} className="flex items-center gap-1.5 text-blue-600 text-sm font-medium hover:text-blue-700">
                  <Plus size={14} /> Add Item
                </button>
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-600"><span>Sub Total</span><span>₹{fmt(subTotal)}</span></div>
            <div className="flex justify-between text-sm text-gray-600"><span>Tax (5% GST)</span><span>₹{fmt(Math.round(tax))}</span></div>
            <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-2 mt-1">
              <span>Total Amount</span><span className="text-green-600">₹{fmt(Math.round(total))}</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes / Remarks</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Optional notes for this purchase order…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 sticky bottom-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">Cancel</button>
          <button onClick={() => handleSave('draft')}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-100">
            Save as Draft
          </button>
          <button onClick={() => handleSave('pending_approval')}
            className="px-5 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold flex items-center gap-1.5">
            <Clock size={14} /> Submit for Approval
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── View PO Modal ────────────────────────────────────────────────────────────

function ViewPOModal({ po, onClose }: { po: StoredPO; onClose: () => void }) {
  const subTotal = po.subTotal;
  const tax = subTotal * 0.05;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{po.poNumber}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{po.vendorName} · {po.date}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={po.status} />
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={20} /></button>
          </div>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">Vendor</span><p className="font-semibold text-gray-900 mt-0.5">{po.vendorName}</p></div>
            <div><span className="text-gray-500">Delivery Date</span><p className="font-semibold text-gray-900 mt-0.5">{po.deliveryDate || '—'}</p></div>
            <div><span className="text-gray-500">Payment Terms</span><p className="font-semibold text-gray-900 mt-0.5">{po.paymentTerms}</p></div>
            <div><span className="text-gray-500">Status</span><p className="mt-0.5"><StatusBadge status={po.status} /></p></div>
          </div>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">#</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Product</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Qty</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Rate (₹)</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {po.items.map((item, idx) => (
                  <tr key={idx} className="border-t border-gray-100">
                    <td className="px-4 py-2.5 text-gray-500">{idx + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{item.itemName}</td>
                    <td className="px-4 py-2.5 text-gray-700">{item.quantity}</td>
                    <td className="px-4 py-2.5 text-gray-700">₹{fmt(item.rate)}</td>
                    <td className="px-4 py-2.5 font-semibold text-gray-900">₹{fmt(item.quantity * item.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-600"><span>Sub Total</span><span>₹{fmt(subTotal)}</span></div>
            <div className="flex justify-between text-sm text-gray-600"><span>Tax (5%)</span><span>₹{fmt(Math.round(tax))}</span></div>
            <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2">
              <span>Total</span><span className="text-green-600">₹{fmt(Math.round(po.total))}</span>
            </div>
          </div>
          {po.notes && <p className="text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-lg p-3">{po.notes}</p>}
        </div>
        <div className="flex justify-end p-4 border-t bg-gray-50">
          <button onClick={onClose} className="px-5 py-2 text-sm bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-900">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Verify + Assign Shift Modal ──────────────────────────────────────────────

function VerifyModal({
  po, onClose, onVerify,
}: { po: StoredPO; onClose: () => void; onVerify: (po: StoredPO, shift: string, date: string, notes: string) => void }) {
  const [shift, setShift] = useState<'Morning' | 'Afternoon' | 'Night'>('Morning');
  const [shiftDate, setShiftDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    onVerify(po, shift, shiftDate, notes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Verify & Assign to Shift</h2>
            <p className="text-sm text-gray-500 mt-0.5">{po.poNumber} · {po.vendorName}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Verified By</label>
            <input value="Admin User" readOnly
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Assign to Shift</label>
            <div className="flex gap-3">
              {(['Morning', 'Afternoon', 'Night'] as const).map(s => (
                <button key={s} onClick={() => setShift(s)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${shift === s
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {s === 'Morning' ? '🌅' : s === 'Afternoon' ? '☀️' : '🌙'} {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Shift Date</label>
            <input type="date" value={shiftDate} onChange={e => setShiftDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Any instructions for the shift team…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">Cancel</button>
          <button onClick={handleSubmit}
            className="px-5 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold flex items-center gap-1.5">
            <CheckCircle2 size={15} /> Verify & Assign
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reject PO Modal ──────────────────────────────────────────────────────────

function RejectModal({
  po, onClose, onReject,
}: { po: StoredPO; onClose: () => void; onReject: (po: StoredPO, reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Reject Purchase Order</h2>
            <p className="text-sm text-gray-500 mt-0.5">{po.poNumber} · {po.vendorName}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-3">
            <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">This PO will be sent back to the creator. Please provide a reason.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Rejection Reason *</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
              placeholder="e.g. Rate is too high, please re-negotiate with vendor…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">Cancel</button>
          <button
            onClick={() => { if (!reason.trim()) { toast.error('Please enter a rejection reason'); return; } onReject(po, reason); onClose(); }}
            className="px-5 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold flex items-center gap-1.5">
            <ThumbsDown size={14} /> Reject PO
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── View Orders Modal ────────────────────────────────────────────────────────

function ViewOrdersModal({ product, orders, onClose }: { product: string; orders: CustomerOrder[]; onClose: () => void }) {
  const filtered = orders.filter(o => o.products.some(p => p.name === product));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Orders for: {product}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{filtered.length} orders</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={20} /></button>
        </div>
        <div className="p-4 space-y-2">
          {filtered.map(order => {
            const prod = order.products.find(p => p.name === product)!;
            return (
              <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{order.shopName}</p>
                  <p className="text-xs text-gray-500">{order.customerName} · {order.phone}</p>
                  <p className="text-xs text-gray-400">{order.address}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{prod.qty} {prod.unit}</p>
                  <p className="text-xs text-gray-500">₹{prod.price}/kg</p>
                  <p className="text-xs text-gray-400">{order.orderDate}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-800 text-white rounded-lg font-medium">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// ─── Hub PO Panel (Supabase-backed, shift/hub based) ─────────────────────────

function HubPOPanel() {
  const qc = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: hubPOs = [], isLoading } = useQuery({
    queryKey: ['hub-pos', today],
    queryFn: async () => {
      const { data } = await supabase
        .from('purchase_orders')
        .select('id, po_number, hub_name, shift, status, approval_status, routed_to, total_amount, created_at, notes')
        .gte('order_date', today)
        .not('hub_name', 'is', null)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const approvePO = async (poId: string, poNumber: string) => {
    const { error } = await supabase
      .from('purchase_orders')
      .update({ status: 'approved', approval_status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', poId);
    if (error) { toast.error(error.message); return; }
    toast.success(`✅ ${poNumber} approved — sent to Purchase Executive`);
    qc.invalidateQueries({ queryKey: ['hub-pos'] });
  };

  const rejectPOById = async (poId: string, poNumber: string) => {
    const reason = prompt(`Rejection reason for ${poNumber}:`);
    if (!reason) return;
    const { error } = await supabase
      .from('purchase_orders')
      .update({ status: 'rejected', approval_status: 'rejected', rejection_reason: reason })
      .eq('id', poId);
    if (error) { toast.error(error.message); return; }
    toast.error(`${poNumber} rejected`);
    qc.invalidateQueries({ queryKey: ['hub-pos'] });
  };

  if (isLoading) return <div className="px-6 py-4 text-sm text-gray-400">Loading hub POs…</div>;
  if (!hubPOs.length) return null;

  const shift1POs = hubPOs.filter(p => p.shift === 1);
  const shift2POs = hubPOs.filter(p => p.shift === 2);

  const renderPORow = (po: any) => (
    <div key={po.id} className={`flex items-center gap-4 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 ${po.approval_status === 'rejected' ? 'opacity-60' : ''}`}>
      <div className="w-7">
        {po.shift === 1 ? <Sun size={14} className="text-blue-500" /> : <Moon size={14} className="text-orange-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 font-mono">{po.po_number}</p>
        <p className="text-[11px] text-gray-500 truncate">
          <Building2 size={10} className="inline mr-1" />
          {po.hub_name} · Shift {po.shift} · {po.routed_to === 'operations_manager' ? '📋 Ops Manager' : '⚡ Direct'}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-gray-900">₹{Number(po.total_amount || 0).toLocaleString('en-IN')}</p>
        <p className="text-[10px] text-gray-400">{po.approval_status}</p>
      </div>
      <div className="flex items-center gap-2">
        {po.approval_status === 'pending' && (
          <>
            <button onClick={() => approvePO(po.id, po.po_number)}
              className="p-1.5 rounded-lg bg-green-100 hover:bg-green-200 text-green-700" title="Approve">
              <CheckCircle2 size={14} />
            </button>
            <button onClick={() => rejectPOById(po.id, po.po_number)}
              className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700" title="Reject">
              <X size={14} />
            </button>
          </>
        )}
        {po.approval_status === 'approved' && <span className="text-[10px] font-bold text-green-600">✓ Approved</span>}
        {po.approval_status === 'direct'   && <span className="text-[10px] font-bold text-orange-600">⚡ Direct</span>}
        {po.approval_status === 'rejected' && <span className="text-[10px] font-bold text-red-500">✗ Rejected</span>}
      </div>
    </div>
  );

  return (
    <div className="px-6 pb-2">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-purple-500" />
            <h3 className="font-bold text-gray-900 text-sm">Hub-Based POs (Today)</h3>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 text-purple-700">{hubPOs.length}</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <span className="flex items-center gap-1"><Sun size={11} className="text-blue-500" /> Shift 1 → Ops Manager</span>
            <span className="flex items-center gap-1"><Moon size={11} className="text-orange-500" /> Shift 2 → Direct</span>
          </div>
        </div>
        {shift1POs.length > 0 && (
          <div>
            <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
              <p className="text-[11px] font-bold text-blue-700 flex items-center gap-1.5">
                <Sun size={11} /> Shift 1 — Operations Manager Approval Required
              </p>
            </div>
            {shift1POs.map(renderPORow)}
          </div>
        )}
        {shift2POs.length > 0 && (
          <div>
            <div className="px-4 py-2 bg-orange-50 border-b border-orange-100">
              <p className="text-[11px] font-bold text-orange-700 flex items-center gap-1.5">
                <Moon size={11} /> Shift 2 — Directly to Purchase Executive
              </p>
            </div>
            {shift2POs.map(renderPORow)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AutoPOPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // ── Load REAL orders from Supabase ──────────────────────────────────────────
  const { data: orders = [], isLoading: ordersLoading, refetch: refetchOrders } = useQuery({
    queryKey: ['auto-po-real-orders'],
    queryFn: async (): Promise<CustomerOrder[]> => {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          id, customer_name, order_date, delivery_date, status,
          customers(shop_name, first_name, last_name, phone, mobile, address),
          sales_order_items(product_name, quantity, unit, unit_price)
        `)
        .in('status', ['confirmed', 'pending', 'processing'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((o: any): CustomerOrder => ({
        id: o.id,
        shopName: o.customers?.shop_name || o.customer_name || 'Shop',
        customerName: o.customer_name || '',
        address: o.customers?.address || '',
        phone: o.customers?.phone || o.customers?.mobile || '',
        products: (o.sales_order_items || [])
          .filter((item: any) => item.product_name)
          .map((item: any) => ({
            name: String(item.product_name).trim(),
            qty:  Number(item.quantity) || 0,
            unit: item.unit || 'kg',
            price: Number(item.unit_price) || 0,
          })),
        orderDate:    o.order_date    || '',
        deliveryDate: o.delivery_date || '',
        status:       o.status        || 'Pending',
      }));
    },
    staleTime: 60_000, // re-fetch at most once per minute
  });

  const [aggregated, setAggregated] = useState<AggregatedProduct[]>([]);
  const [pos, setPOs] = useState<StoredPO[]>([]);
  const [pendingPOs, setPendingPOs] = useState<StoredPO[]>([]);
  const [tab, setTab] = useState<'summary' | 'orders' | 'approvals'>('orders');
  const [search, setSearch]     = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');

  // ── Bought quantities map (fetched from Supabase) ──
  const [boughtMap, setBoughtMap] = useState<Record<string, number>>({});

  const refreshBoughtMap = useCallback(async (agg: AggregatedProduct[]) => {
    const map: Record<string, number> = {};
    await Promise.all(agg.map(async p => {
      map[p.productName] = await fetchBoughtQty(p.productName);
    }));
    setBoughtMap(map);
  }, []);

  // Modals
  const [createPOOpen, setCreatePOOpen] = useState(false);
  const [prefillItems, setPrefillItems] = useState<Array<{ product: string; qty: number; unit: string; rate: number }>>([]);
  const [linkedOrders, setLinkedOrders] = useState<CustomerOrder[]>([]);
  const [editingPO, setEditingPO] = useState<StoredPO | null>(null);
  const [viewPO, setViewPO] = useState<StoredPO | null>(null);
  const [verifyPO, setVerifyPO] = useState<StoredPO | null>(null);
  const [rejectPO, setRejectPO] = useState<StoredPO | null>(null);
  const [viewOrders, setViewOrders] = useState<string | null>(null);

  // Re-aggregate whenever real orders load/change
  useEffect(() => {
    if (!orders.length) return;
    const agg = aggregateProducts(orders);
    setAggregated(agg);
    refreshBoughtMap(agg);
    fetchAllPOs().then(all => {
      setPOs(all.filter(p => p.status !== 'pending_approval'));
    });
    fetchPendingApprovalPOs().then(setPendingPOs);
  }, [orders, refreshBoughtMap]);

  const refresh = useCallback(() => {
    refetchOrders();
    fetchAllPOs().then(all => setPOs(all.filter(p => p.status !== 'pending_approval')));
    fetchPendingApprovalPOs().then(setPendingPOs);
    refreshBoughtMap(aggregated);
  }, [refetchOrders, aggregated, refreshBoughtMap]);

  // Re-read bought quantities when window regains focus (user returns from Buy page)
  useEffect(() => {
    const onFocus   = () => refreshBoughtMap(aggregated);
    const onStorage = () => refreshBoughtMap(aggregated);
    window.addEventListener('focus',   onFocus);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('focus',   onFocus);
      window.removeEventListener('storage', onStorage);
    };
  }, [aggregated, refreshBoughtMap]);

  // Re-read when switching to summary tab
  useEffect(() => {
    if (tab === 'summary') refreshBoughtMap(aggregated);
  }, [tab, aggregated, refreshBoughtMap]);

  // Excel export (customer-order level detail)
  const exportExcel = useCallback(() => {
    const rows = orders.map(order => ({
      'Shop Name': order.shopName,
      'Customer Name': order.customerName,
      'Address': order.address,
      'Phone Number': order.phone,
      'Product List': order.products.map(p => p.name).join(', '),
      'Quantity per Product': order.products.map(p => `${p.name}: ${p.qty}${p.unit}`).join(', '),
      'Total Products': order.products.length,
      'Total Quantity': order.products.reduce((s, p) => s + p.qty, 0),
      'Unit': order.products[0]?.unit ?? 'kg',
      'Order Date': order.orderDate,
      'Delivery Date': order.deliveryDate || '—',
      'Status': order.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 18 }, { wch: 18 }, { wch: 28 }, { wch: 14 },
      { wch: 25 }, { wch: 35 }, { wch: 14 }, { wch: 14 },
      { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Auto PO Orders');
    XLSX.writeFile(wb, `AutoPO_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Excel file downloaded!');
  }, [orders]);

  const openCreatePO = (product?: AggregatedProduct) => {
    if (product) {
      const costRate = PRODUCT_COST_MAP[product.productName] ?? Math.round(product.avgPrice * 0.75);
      setPrefillItems([{ product: product.productName, qty: product.totalQty, unit: product.unit, rate: costRate }]);
      setLinkedOrders(orders.filter(o => o.products.some(p => p.name === product.productName)));
    } else {
      setPrefillItems(aggregated.map(p => ({
        product: p.productName,
        qty: p.totalQty,
        unit: p.unit,
        rate: PRODUCT_COST_MAP[p.productName] ?? Math.round(p.avgPrice * 0.75),
      })));
      setLinkedOrders([...orders]);
    }
    setEditingPO(null);
    setCreatePOOpen(true);
  };

  const handleVerify = async (po: StoredPO, shift: string, shiftDate: string, notes: string) => {
    const updated = { ...po, status: 'open' as const, notes: `Shift: ${shift} | Date: ${shiftDate}${notes ? ' | ' + notes : ''}` };
    await savePOToStore(updated);
    toast.success(`✓ PO ${po.poNumber} verified — assigned to ${shift} shift`);
    refresh();
  };

  const handleApprove = async (po: StoredPO) => {
    const updated: StoredPO = {
      ...po,
      status: 'open',
      approvedBy: 'FF Operations Manager',
      approvedAt: new Date().toISOString(),
    };
    await savePOToStore(updated);
    toast.success(`✅ PO ${po.poNumber} approved successfully`);
    refresh();
  };

  const handleReject = async (po: StoredPO, reason: string) => {
    const updated: StoredPO = { ...po, status: 'rejected', rejectionReason: reason };
    await savePOToStore(updated);
    toast.error(`PO ${po.poNumber} rejected`);
    refresh();
  };

  const handleDelete = async (po: StoredPO) => {
    if (!confirm(`Delete ${po.poNumber}?`)) return;
    await deletePOFromStore(po.poNumber);
    toast.success('PO deleted');
    refresh();
  };

  const filteredAggregated = aggregated.filter(p =>
    p.productName.toLowerCase().includes(search.toLowerCase()) ||
    p.suggestedVendor.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPOs = pos.filter(p => {
    const matchSearch = p.poNumber.toLowerCase().includes(search.toLowerCase()) ||
      p.items.some(i => i.itemName.toLowerCase().includes(search.toLowerCase()));
    const matchFrom = !dateFrom || p.date >= dateFrom;
    const matchTo   = !dateTo   || p.date <= dateTo;
    return matchSearch && matchFrom && matchTo;
  });

  const totalOrders   = orders.length;
  const totalProducts = aggregated.length;
  const totalValue    = aggregated.reduce((s, p) => s + p.totalValue, 0);
  const poCount       = pos.length;
  const pendingCount  = pendingPOs.length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Auto Purchase Orders</h1>
            <p className="text-sm text-gray-500 mt-0.5">Aggregated orders by product — ready for PO creation</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={exportExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors">
              <Download size={16} /> Download Excel
            </button>
            <button onClick={() => openCreatePO()}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
              <Plus size={16} /> Create Auto PO
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 py-5 grid grid-cols-5 gap-4">
        {[
          { label: 'Total Orders', value: totalOrders, icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Products', value: totalProducts, icon: Package, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Total Value', value: `₹${fmt(totalValue)}`, icon: ClipboardList, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'POs Created', value: poCount, icon: FileText, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Pending Approval', value: pendingCount, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4 shadow-sm">
            <div className={`p-3 rounded-xl ${s.bg}`}><s.icon size={20} className={s.color} /></div>
            <div>
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Hub POs from Sales Dashboard (Supabase) */}
      <HubPOPanel />

      {/* Tabs + Search */}
      <div className="px-6 pb-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-0 border-b border-gray-100">
            <div className="flex gap-0">
              {([
                ['orders', 'Purchase Orders', pos.length > 0 ? { count: pos.length, cls: 'bg-blue-100 text-blue-700' } : null],
                ['summary', 'Order Summary', null],
                ['approvals', 'Approvals', pendingCount > 0 ? { count: pendingCount, cls: 'bg-amber-100 text-amber-700' } : null],
              ] as const).map(([key, label, badge]) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${tab === key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {label}
                  {badge && (
                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${badge.cls}`}>{badge.count}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 pb-3 flex-wrap">
              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search PO / product…"
                  className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-44" />
              </div>
              {/* Date From */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400 font-medium whitespace-nowrap">From</span>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700" />
              </div>
              {/* Date To */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400 font-medium whitespace-nowrap">To</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700" />
              </div>
              {/* Clear filters */}
              {(dateFrom || dateTo || search) && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); setSearch(''); }}
                  className="text-xs text-red-500 hover:text-red-700 font-semibold px-2 py-2 hover:bg-red-50 rounded-lg transition-colors whitespace-nowrap">
                  ✕ Clear
                </button>
              )}
              <button onClick={refresh} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg ml-auto">
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* Order Summary Table */}
          {tab === 'summary' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Product Name</th>
                    <th className="px-4 py-3 text-right font-semibold">Required Qty</th>
                    <th className="px-4 py-3 text-center font-semibold">Unit</th>
                    <th className="px-4 py-3 text-right font-semibold">Sale Price (₹)</th>
                    <th className="px-4 py-3 text-right font-semibold">Cost Price (₹)</th>
                    <th className="px-4 py-3 text-center font-semibold">Margin</th>
                    <th className="px-4 py-3 text-right font-semibold">Total Value (₹)</th>
                    <th className="px-4 py-3 text-center font-semibold">Purchase Status</th>
                    <th className="px-4 py-3 text-center font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ordersLoading && (
                    <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-400">
                      <RefreshCw size={18} className="inline animate-spin mr-2" />Loading live orders from Supabase…
                    </td></tr>
                  )}
                  {!ordersLoading && filteredAggregated.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">No products found in confirmed orders.</td></tr>
                  )}
                  {!ordersLoading && filteredAggregated.map(p => (
                    <tr key={p.productName} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-base">
                            {p.productName === 'Onion' ? '🧅' : p.productName === 'Tomato' ? '🍅' : p.productName === 'Potato' ? '🥔' : p.productName === 'Carrot' ? '🥕' : '🥦'}
                          </div>
                          <span className="font-semibold text-gray-900">{p.productName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-gray-800">{p.totalQty}</td>
                      <td className="px-4 py-3.5 text-center text-gray-500">{p.unit}</td>
                      <td className="px-4 py-3.5 text-right text-gray-700">₹{p.avgPrice}</td>
                      <td className="px-4 py-3.5 text-right text-blue-600 font-semibold">
                        ₹{PRODUCT_COST_MAP[p.productName] ?? Math.round(p.avgPrice * 0.75)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {(() => {
                          const cost = PRODUCT_COST_MAP[p.productName] ?? Math.round(p.avgPrice * 0.75);
                          const margin = Math.round(((p.avgPrice - cost) / p.avgPrice) * 100);
                          return (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${margin >= 20 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              {margin}%
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-gray-900">₹{fmt(p.totalValue)}</td>
                      <td className="px-4 py-3.5 text-center">
                        {(() => {
                          const bought = boughtMap[p.productName] ?? 0;
                          const balance = p.totalQty - bought;
                          if (bought === 0) return <StatusBadge status="Pending" />;
                          if (balance > 0) return (
                            <span className="inline-flex flex-col items-center gap-0.5">
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-amber-100 text-amber-700 border-amber-200">Partial</span>
                              <span className="text-[10px] text-amber-600 font-semibold">Balance: {balance} {p.unit}</span>
                            </span>
                          );
                          return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-green-100 text-green-700 border-green-200">Completed</span>;
                        })()}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {(boughtMap[p.productName] ?? 0) >= p.totalQty ? (
                          <span className="flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg mx-auto w-fit">
                            <CheckCircle2 size={13} /> Done
                          </span>
                        ) : (
                          <button
                            onClick={() => navigate('/purchase/buy', { state: { product: p.productName, qty: p.totalQty, unit: p.unit } })}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors mx-auto">
                            <ShoppingBag size={13} /> Buy
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {/* empty state handled above */}
                </tbody>
              </table>
            </div>
          )}

          {/* PO List Table */}
          {tab === 'orders' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">PO Number</th>
                    <th className="px-4 py-3 text-left font-semibold">Products</th>
                    <th className="px-4 py-3 text-right font-semibold">Total Qty</th>
                    <th className="px-4 py-3 text-right font-semibold">Amount (₹)</th>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-center font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredPOs.map(po => (
                    <tr key={po.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => setViewPO(po)}
                          className="font-mono text-sm font-bold text-blue-600 hover:text-blue-800 hover:underline underline-offset-2 transition-colors text-left">
                          {po.poNumber}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-gray-600 text-xs">
                        {po.items.map(i => i.itemName).join(', ')}
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-gray-800">
                        {po.items.reduce((s, i) => s + i.quantity, 0)} kg
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-gray-900">₹{fmt(Math.round(po.total))}</td>
                      <td className="px-4 py-3.5 text-gray-500 text-xs">{po.date}</td>
                      <td className="px-4 py-3.5 text-center"><StatusBadge status={po.status} /></td>
                    </tr>
                  ))}
                  {filteredPOs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center gap-3 text-gray-400">
                          <FileText size={32} className="text-gray-300" />
                          <p className="text-sm">No purchase orders yet.</p>
                          <button onClick={() => openCreatePO()}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg font-semibold">
                            <Plus size={12} /> Create First PO
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Approvals Tab */}
          {tab === 'approvals' && (
            <div className="overflow-x-auto">
              {pendingPOs.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-gray-400">
                  <CheckCircle2 size={40} className="text-green-300" />
                  <p className="text-sm font-medium text-gray-500">All caught up! No pending approvals.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-amber-50 text-gray-600 text-xs">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">PO Number</th>
                      <th className="px-4 py-3 text-left font-semibold">Products</th>
                      <th className="px-4 py-3 text-right font-semibold">Qty</th>
                      <th className="px-4 py-3 text-right font-semibold">Amount (₹)</th>
                      <th className="px-4 py-3 text-left font-semibold">Submitted</th>
                      <th className="px-4 py-3 text-center font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pendingPOs.filter(p =>
                      p.poNumber.toLowerCase().includes(search.toLowerCase()) ||
                      p.vendorName.toLowerCase().includes(search.toLowerCase())
                    ).map(po => (
                      <tr key={po.id} className="hover:bg-amber-50/40 transition-colors">
                        <td className="px-4 py-3.5">
                          <span className="font-mono text-sm font-bold text-amber-600">{po.poNumber}</span>
                        </td>
                        <td className="px-4 py-3.5 text-gray-600 text-xs">
                          {po.items.map(i => i.itemName).join(', ')}
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-gray-800">
                          {po.items.reduce((s, i) => s + i.quantity, 0)} kg
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-gray-900">₹{fmt(Math.round(po.total))}</td>
                        <td className="px-4 py-3.5 text-gray-500 text-xs">{po.date}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => setViewPO(po)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="View Details">
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => handleApprove(po)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg">
                              <ThumbsUp size={12} /> Approve
                            </button>
                            <button
                              onClick={() => setRejectPO(po)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg">
                              <ThumbsDown size={12} /> Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreatePOModal
        open={createPOOpen}
        onClose={() => { setCreatePOOpen(false); setEditingPO(null); }}
        prefillItems={prefillItems}
        linkedOrders={linkedOrders}
        editPO={editingPO}
        onSave={refresh}
      />
      {viewPO && <ViewPOModal po={viewPO} onClose={() => setViewPO(null)} />}
      {verifyPO && <VerifyModal po={verifyPO} onClose={() => setVerifyPO(null)} onVerify={handleVerify} />}
      {rejectPO && <RejectModal po={rejectPO} onClose={() => setRejectPO(null)} onReject={handleReject} />}
      {viewOrders && <ViewOrdersModal product={viewOrders} orders={orders} onClose={() => setViewOrders(null)} />}
    </div>
  );
}
