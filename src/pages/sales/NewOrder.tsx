import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { createInvoiceForOrder } from '@/lib/invoiceHelper';
import {
  Search, Plus, Trash2, ShoppingBag, Repeat,
  Store, User, X, Check, RefreshCw, ChevronDown,
  Phone, MapPin, CreditCard, AlertTriangle,
  Package, IndianRupee, FileText, Building2, Clock,
} from 'lucide-react';

/* ─── Types ───────────────────────────────────────────────────────────────── */
type Unit = 'kg' | 'piece' | 'box' | 'litre' | 'dozen';
const UNITS: Unit[] = ['kg', 'piece', 'box', 'litre', 'dozen'];

interface CartItem {
  key: string;               // unique row key
  is_custom: boolean;        // free-text item not from catalog
  product_id: string | null;
  product_name: string;
  unit: Unit;
  qty: number;
  unit_price: number;
  discount_pct: number;      // 0–100
  notes: string;
  grade: 'A' | 'B' | 'C' | null;
}

function newCartItem(): CartItem {
  return {
    key: Math.random().toString(36).slice(2),
    is_custom: false,
    product_id: null,
    product_name: '',
    unit: 'kg',
    qty: 1,
    unit_price: 0,
    discount_pct: 0,
    notes: '',
    grade: 'A',
  };
}

const lineTotal = (item: CartItem) =>
  item.qty * item.unit_price * (1 - item.discount_pct / 100);

/* ─── Inline New-Customer mini-form ──────────────────────────────────────── */
function InlineNewCustomer({
  onSaved,
  onCancel,
}: {
  onSaved: (c: any) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<'shop' | 'individual'>('shop');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || !phone.trim()) { toast.error('Name and phone are required'); return; }
    setSaving(true);
    const payload: any = {
      customer_type: type,
      phone: phone.trim(),
      area: area.trim() || null,
      is_active: true,
    };
    if (type === 'shop') {
      payload.shop_name = name.trim();
      payload.name = name.trim();
    } else {
      payload.first_name = name.trim();
      payload.shop_name = name.trim();
      payload.name = name.trim();
    }
    const { data, error } = await supabase.from('customers').insert(payload).select().single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Customer created');
    onSaved(data);
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-blue-800">Quick Add Customer</p>
        <button onClick={onCancel}><X className="h-4 w-4 text-blue-400" /></button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setType('shop')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 text-xs font-semibold ${type === 'shop' ? 'border-blue-500 bg-white text-blue-700' : 'border-transparent bg-white/60 text-slate-500'}`}>
          <Store className="h-3.5 w-3.5" /> Shop
        </button>
        <button onClick={() => setType('individual')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 text-xs font-semibold ${type === 'individual' ? 'border-blue-500 bg-white text-blue-700' : 'border-transparent bg-white/60 text-slate-500'}`}>
          <User className="h-3.5 w-3.5" /> Individual
        </button>
      </div>
      <input value={name} onChange={e => setName(e.target.value)}
        className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder={type === 'shop' ? 'Shop name *' : 'Full name *'} />
      <div className="grid grid-cols-2 gap-2">
        <input value={phone} onChange={e => setPhone(e.target.value)}
          className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Phone *" type="tel" />
        <input value={area} onChange={e => setArea(e.target.value)}
          className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Area (optional)" />
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 rounded-lg border border-blue-200 bg-white py-2 text-xs font-semibold text-slate-600">Cancel</button>
        <button onClick={save} disabled={saving}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white disabled:opacity-50">
          {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {saving ? 'Saving…' : 'Save & Select'}
        </button>
      </div>
    </div>
  );
}

/* ─── Cart Line Item Row ──────────────────────────────────────────────────── */
function CartRow({
  item,
  onChange,
  onRemove,
  products,
}: {
  item: CartItem;
  onChange: (key: string, patch: Partial<CartItem>) => void;
  onRemove: (key: string) => void;
  products: any[];
}) {
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [productQ, setProductQ] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);

  const filteredProducts = products.filter(p =>
    !productQ || p.name.toLowerCase().includes(productQ.toLowerCase())
  ).slice(0, 8);

  const total = lineTotal(item);

  const inp = 'rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-500 w-full bg-white';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2.5">
      {/* Row 1: Product name + type toggle */}
      <div className="flex items-start gap-2">
        <div className="flex-1">
          {item.is_custom ? (
            <input
              value={item.product_name}
              onChange={e => onChange(item.key, { product_name: e.target.value })}
              className={inp}
              placeholder="Item name (free text)"
            />
          ) : (
            <div className="relative" ref={searchRef}>
              <div
                className="flex items-center gap-2 cursor-pointer rounded-lg border border-gray-200 px-2.5 py-1.5 bg-white"
                onClick={() => setShowProductSearch(true)}
              >
                <Package className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                <span className={`text-xs flex-1 ${item.product_name ? 'text-slate-800 font-medium' : 'text-gray-400'}`}>
                  {item.product_name || 'Search product…'}
                </span>
                <ChevronDown className="h-3 w-3 text-gray-400" />
              </div>
              {showProductSearch && (
                <div className="absolute top-full left-0 right-0 z-20 bg-white border border-gray-200 rounded-xl shadow-lg mt-1">
                  <div className="p-2 border-b border-gray-100">
                    <input autoFocus value={productQ} onChange={e => setProductQ(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-green-500"
                      placeholder="Search products…" />
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
                    {filteredProducts.map(p => (
                      <button key={p.id} onMouseDown={() => {
                        onChange(item.key, {
                          product_id: p.id,
                          product_name: p.name,
                          unit_price: p.grade_a_price ?? 0,
                          unit: p.unit?.toLowerCase() === 'piece' ? 'piece' : 'kg',
                        });
                        setShowProductSearch(false);
                        setProductQ('');
                      }}
                        className="w-full text-left px-3 py-2 hover:bg-green-50">
                        <p className="text-xs font-medium text-slate-800">{p.name}</p>
                        <p className="text-[10px] text-slate-400">₹{p.grade_a_price}/kg · {p.category}</p>
                      </button>
                    ))}
                    {productQ.length > 0 && (
                      <button onMouseDown={() => {
                        onChange(item.key, { is_custom: true, product_id: null, product_name: productQ });
                        setShowProductSearch(false);
                        setProductQ('');
                      }}
                        className="w-full text-left px-3 py-2 hover:bg-amber-50 border-t border-gray-100 flex items-center gap-2">
                        <span className="text-[10px] font-bold text-amber-600 uppercase">Use manually:</span>
                        <span className="text-xs font-semibold text-slate-700">"{productQ}"</span>
                      </button>
                    )}
                    {filteredProducts.length === 0 && !productQ && (
                      <p className="px-3 py-2 text-xs text-slate-400 text-center">Type a product name to search</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Custom toggle */}
        <button
          onClick={() => onChange(item.key, { is_custom: !item.is_custom, product_id: null, product_name: '' })}
          className={`flex-shrink-0 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${item.is_custom ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          title="Toggle custom item"
        >
          {item.is_custom ? 'CUSTOM' : 'CATALOG'}
        </button>
        <button onClick={() => onRemove(item.key)} className="flex-shrink-0 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Row 2: Unit, Qty, Price, Discount */}
      <div className="grid grid-cols-4 gap-2">
        <div>
          <label className="block text-[10px] text-gray-400 mb-0.5">Unit</label>
          <select value={item.unit} onChange={e => onChange(item.key, { unit: e.target.value as Unit })} className={inp}>
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-400 mb-0.5">Qty</label>
          <input type="number" min="0.1" step="0.5" value={item.qty}
            onChange={e => onChange(item.key, { qty: Number(e.target.value) || 0 })} className={inp} />
        </div>
        <div>
          <label className="block text-[10px] text-gray-400 mb-0.5">Price (₹)</label>
          <input type="number" min="0" step="0.5" value={item.unit_price}
            onChange={e => onChange(item.key, { unit_price: Number(e.target.value) || 0 })} className={inp} />
        </div>
        <div>
          <label className="block text-[10px] text-gray-400 mb-0.5">Disc %</label>
          <input type="number" min="0" max="100" step="1" value={item.discount_pct}
            onChange={e => onChange(item.key, { discount_pct: Math.min(100, Number(e.target.value) || 0) })} className={inp} />
        </div>
      </div>

      {/* Row 3: Grade (catalog only) + Notes + Line total */}
      <div className="flex items-center gap-2">
        {!item.is_custom && (
          <div className="flex gap-1">
            {(['A', 'B', 'C'] as const).map(g => (
              <button key={g} onClick={() => onChange(item.key, { grade: g })}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                  item.grade === g
                    ? g === 'A' ? 'bg-green-600 text-white' : g === 'B' ? 'bg-yellow-500 text-white' : 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}>
                {g}
              </button>
            ))}
          </div>
        )}
        <input value={item.notes} onChange={e => onChange(item.key, { notes: e.target.value })}
          className={`flex-1 ${inp}`} placeholder="Note for this item…" />
        <div className="text-right flex-shrink-0 w-20">
          <p className="text-xs font-bold text-slate-800">₹{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          {item.discount_pct > 0 && (
            <p className="text-[10px] text-green-600">-{item.discount_pct}%</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */
export default function NewOrder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedCustomerId = searchParams.get('customer_id');
  const repeatOrderId = searchParams.get('repeat_order_id');

  /* Customer state */
  const [customerSearch, setCustomerSearch]   = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [isSubmitting, setIsSubmitting]       = useState(false);

  /* Hub & Shift */
  const [selectedHubId, setSelectedHubId] = useState<string>('');
  const [selectedHubName, setSelectedHubName] = useState<string>('');
  const [deliveryDate, setDeliveryDate]   = useState('');

  /* Shift detection based on current time */
  const currentHour = new Date().getHours();
  const currentMin  = new Date().getMinutes();
  const minutesNow  = currentHour * 60 + currentMin;
  const shift1Start = 10 * 60;        // 10:00 AM
  const shift1End   = 19 * 60 + 30;   // 7:30 PM
  const shift2End   = 23 * 60;        // 11:00 PM
  const currentShift: 1 | 2 | null =
    minutesNow >= shift1Start && minutesNow < shift1End ? 1 :
    minutesNow >= shift1End   && minutesNow <= shift2End ? 2 : null;

  /* Cart */
  const [cart, setCart]           = useState<CartItem[]>([newCartItem()]);
  const [paymentMode, setPaymentMode] = useState<'cod' | 'credit' | 'upi'>('cod');
  const [notes, setNotes]         = useState('');

  /* Prefill customer from URL param */
  useEffect(() => {
    if (!preselectedCustomerId) return;
    supabase.from('customers').select('*').eq('id', preselectedCustomerId).single()
      .then(({ data }) => { if (data) setSelectedCustomer(data); });
  }, [preselectedCustomerId]);

  /* Prefill cart from repeat order */
  useEffect(() => {
    if (!repeatOrderId) return;
    supabase.from('sales_orders')
      .select('*, customer:customers(*), items:sales_order_items(*, product:products(id, name, unit, grade_a_price))')
      .eq('id', repeatOrderId).single()
      .then(({ data }) => {
        if (!data) return;
        setSelectedCustomer(data.customer);
        setPaymentMode(data.payment_mode ?? 'cod');
        const items: CartItem[] = (data.items ?? []).map((it: any) => ({
          key: Math.random().toString(36).slice(2),
          is_custom: false,
          product_id: it.product?.id ?? null,
          product_name: it.product?.name ?? '',
          unit: (it.product?.unit ?? 'kg').toLowerCase() as Unit,
          qty: it.qty_kg ?? it.quantity_kg ?? 1,
          unit_price: it.unit_price ?? 0,
          discount_pct: 0,
          notes: '',
          grade: it.qc_grade ?? it.grade ?? 'A',
        }));
        setCart(items.length ? items : [newCartItem()]);
        toast.success('Order items pre-filled — adjust and confirm');
      });
  }, [repeatOrderId]);

  /* Customer search */
  const { data: customers = [] } = useQuery({
    queryKey: ['customers-search', customerSearch],
    queryFn: async () => {
      if (customerSearch.length < 2) return [];
      const { data } = await supabase.from('customers')
        .select('id, shop_name, first_name, last_name, customer_type, phone, mobile, area, credit_limit, outstanding_balance, gst_number, owner_name')
        .or(`shop_name.ilike.%${customerSearch}%,phone.ilike.%${customerSearch}%,first_name.ilike.%${customerSearch}%,mobile.ilike.%${customerSearch}%`)
        .eq('is_active', true).limit(10);
      return data ?? [];
    },
    enabled: customerSearch.length >= 2,
  });

  /* Hubs */
  const { data: hubs = [] } = useQuery({
    queryKey: ['hubs-active'],
    queryFn: async () => {
      const { data } = await supabase.from('hubs').select('id, name, location, city').eq('is_active', true).order('name');
      return data ?? [];
    },
  });

  /* Products */
  const { data: products = [] } = useQuery({
    queryKey: ['products-active'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id, name, unit, grade_a_price, grade_b_price, grade_c_price, category').order('name');
      return data ?? [];
    },
  });

  /* Cart helpers */
  const updateItem = (key: string, patch: Partial<CartItem>) =>
    setCart(prev => prev.map(c => c.key === key ? { ...c, ...patch } : c));
  const removeItem = (key: string) =>
    setCart(prev => prev.filter(c => c.key !== key));
  const addItem = () => setCart(prev => [...prev, newCartItem()]);

  const subtotal  = cart.reduce((s, c) => s + lineTotal(c), 0);
  const netAmount = subtotal;

  /* Place order */
  const placeOrder = useMutation({
    mutationFn: async () => {
      if (isSubmitting) return;
      setIsSubmitting(true);
      if (!selectedCustomer) throw new Error('Select a customer');
      if (!selectedHubId) throw new Error('Please select a delivery hub for this order');
      const validItems = cart.filter(c => c.product_name.trim() && c.qty > 0 && c.unit_price > 0);
      if (!validItems.length) throw new Error('Add at least one item with name, qty and price');

      try {
        const isRealUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user?.id ?? '');
        const { data: order, error: orderErr } = await supabase
          .from('sales_orders')
          .insert({
            customer_id:   selectedCustomer.id,
            customer_name: selectedCustomer.shop_name || selectedCustomer.name || '',
            order_date:    format(new Date(), 'yyyy-MM-dd'),
            delivery_date: deliveryDate || null,
            status:        'confirmed',
            payment_mode:  paymentMode,
            subtotal,
            net_amount:    netAmount,
            total_amount:  netAmount,
            notes:         notes.trim() || null,
            hub_id:        selectedHubId || null,
            hub_name:      selectedHubName || null,
            shift:         currentShift,
            ...(isRealUuid ? { created_by: user!.id } : {}),
          })
          .select().single();
        if (orderErr) throw orderErr;

        const { error: itemsErr } = await supabase.from('sales_order_items').insert(
          validItems.map(item => ({
            order_id:     order.id,
            product_id:   item.product_id || null,
            product_name: item.product_name,
            quantity:     item.qty,
            qty_kg:       item.qty,
            quantity_kg:  item.qty,
            unit_price:   item.unit_price,
            total_price:  lineTotal(item),
            subtotal:     lineTotal(item),
            qc_grade:     item.grade,
            grade:        item.grade,
            notes:        item.notes || null,
            unit:         item.unit,
            discount_pct: item.discount_pct,
          }))
        );
        if (itemsErr) throw itemsErr;

        // Auto-create invoice
        await createInvoiceForOrder({
          orderId:         order.id,
          customerId:      selectedCustomer.id,
          customerName:    selectedCustomer.shop_name || selectedCustomer.name || '',
          customerPhone:   selectedCustomer.mobile || selectedCustomer.phone || null,
          customerAddress: selectedCustomer.address || null,
          subtotal,
          totalAmount:     netAmount,
          paymentMode:     paymentMode,
          notes:           notes.trim() || null,
        });

        return order;
      } catch (err) {
        setIsSubmitting(false);
        throw err;
      }
    },
    onSuccess: (order) => {
      toast.success(`Order ${order?.order_number} placed!`);
      navigate(`/sales/orders/${order?.id}`);
    },
    onError: (e: Error) => { setIsSubmitting(false); toast.error(e.message); },
  });

  const displayName = (c: any) =>
    c?.shop_name || `${c?.first_name ?? ''} ${c?.last_name ?? ''}`.trim() || '—';

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-12 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 tracking-tight">New Sales Order</h1>
          <p className="text-[13px] text-slate-500">{format(new Date(), 'd MMMM yyyy · h:mm a')}</p>
        </div>
        <Link to="/sales/bulk-order" className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg px-3 py-2 hover:bg-blue-50">
          <FileText className="h-3.5 w-3.5" /> Bulk Entry
        </Link>
      </div>

      {/* ── Customer Section ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <User className="h-4 w-4 text-blue-500" /> Customer
          </h2>
          {!selectedCustomer && !showNewCustomer && (
            <button
              onClick={() => setShowNewCustomer(true)}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              <Plus className="h-3.5 w-3.5" /> New Customer
            </button>
          )}
        </div>

        {showNewCustomer ? (
          <InlineNewCustomer
            onSaved={(c) => { setSelectedCustomer(c); setShowNewCustomer(false); }}
            onCancel={() => setShowNewCustomer(false)}
          />
        ) : selectedCustomer ? (
          /* Full customer detail card */
          <div className="rounded-xl bg-green-50 border border-green-200 p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-green-800 text-base">{displayName(selectedCustomer)}</p>
                {selectedCustomer.owner_name && (
                  <p className="text-xs text-green-700">{selectedCustomer.owner_name}</p>
                )}
              </div>
              <button onClick={() => setSelectedCustomer(null)}
                className="text-xs text-gray-500 border border-gray-300 rounded px-2 py-1 hover:bg-gray-50">
                Change
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {(selectedCustomer.phone || selectedCustomer.mobile) && (
                <div className="flex items-center gap-1.5 text-green-700">
                  <Phone className="h-3 w-3" />
                  <a href={`tel:${selectedCustomer.mobile || selectedCustomer.phone}`} className="hover:underline">
                    {selectedCustomer.mobile || selectedCustomer.phone}
                  </a>
                </div>
              )}
              {selectedCustomer.area && (
                <div className="flex items-center gap-1.5 text-green-700">
                  <MapPin className="h-3 w-3" /> {selectedCustomer.area}
                </div>
              )}
              {Number(selectedCustomer.credit_limit) > 0 && (
                <div className="flex items-center gap-1.5 text-slate-600">
                  <CreditCard className="h-3 w-3" />
                  Limit ₹{Number(selectedCustomer.credit_limit).toLocaleString()}
                </div>
              )}
              {selectedCustomer.gst_number && (
                <div className="flex items-center gap-1.5 text-slate-600">
                  <FileText className="h-3 w-3" /> {selectedCustomer.gst_number}
                </div>
              )}
            </div>
            {Number(selectedCustomer.outstanding_balance) > 0 && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                <span className="text-xs font-semibold text-red-700">
                  Outstanding: ₹{Number(selectedCustomer.outstanding_balance).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        ) : (
          /* Customer search */
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Search by shop name or phone…" autoFocus />
            {(customers as any[]).length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-200 rounded-xl mt-1 shadow-lg max-h-52 overflow-y-auto">
                {(customers as any[]).map((c: any) => (
                  <button key={c.id}
                    onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); }}
                    className="w-full text-left px-4 py-3 hover:bg-green-50 border-b border-gray-50 last:border-0">
                    <p className="text-sm font-semibold text-gray-800">{displayName(c)}</p>
                    <p className="text-xs text-gray-500">{c.area} · {c.mobile || c.phone}</p>
                    {Number(c.outstanding_balance) > 0 && (
                      <p className="text-xs text-red-500 font-medium">Dues: ₹{Number(c.outstanding_balance).toLocaleString()}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Hub & Shift Section ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-purple-500" /> Hub & Delivery
        </h2>

        {/* Shift Indicator */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${
          currentShift === 1
            ? 'bg-blue-50 border border-blue-200 text-blue-700'
            : currentShift === 2
            ? 'bg-orange-50 border border-orange-200 text-orange-700'
            : 'bg-slate-50 border border-slate-200 text-slate-500'
        }`}>
          <Clock className="h-3.5 w-3.5" />
          {currentShift === 1
            ? '🌅 Shift 1 (10 AM – 7:30 PM) — PO will go to Operations Manager for approval'
            : currentShift === 2
            ? '🌙 Shift 2 (7:30 PM – 11 PM) — PO will go directly to Purchase Executive'
            : '⏰ Outside order hours (10 AM – 11 PM)'}
        </div>

        {/* Hub Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-2">
            Delivery Hub <span className="text-red-500">*</span>
            <span className="text-[10px] font-normal text-slate-400 ml-1">— Select based on customer location</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(hubs as any[]).map((hub: any) => (
              <button
                key={hub.id}
                onClick={() => { setSelectedHubId(hub.id); setSelectedHubName(hub.name); }}
                className={`rounded-xl border-2 p-3 text-left transition-all ${
                  selectedHubId === hub.id
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <p className={`text-xs font-bold ${selectedHubId === hub.id ? 'text-purple-700' : 'text-slate-700'}`}>
                  {hub.name}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">{hub.location}, {hub.city}</p>
              </button>
            ))}
          </div>
          {!selectedHubId && (
            <p className="text-[10px] text-amber-600 mt-1.5 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Hub selection is required to generate Purchase Order
            </p>
          )}
        </div>

        {/* Delivery Date */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Delivery Date <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            type="date"
            value={deliveryDate}
            onChange={e => setDeliveryDate(e.target.value)}
            min={format(new Date(), 'yyyy-MM-dd')}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* ── Items Section ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Package className="h-4 w-4 text-green-600" /> Items ({cart.length})
          </h2>
        </div>

        {cart.map(item => (
          <CartRow
            key={item.key}
            item={item}
            onChange={updateItem}
            onRemove={removeItem}
            products={products as any[]}
          />
        ))}

        <button
          onClick={addItem}
          className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-3 text-sm font-semibold text-gray-400 hover:border-green-400 hover:text-green-600 hover:bg-green-50/30 transition-all"
        >
          <Plus className="h-4 w-4" /> Add Item
        </button>
      </div>

      {/* ── Order Summary + Payment ── */}
      {cart.some(c => c.product_name && c.qty > 0 && c.unit_price > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          {/* Summary */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <IndianRupee className="h-4 w-4 text-slate-500" />
              <p className="text-sm font-bold text-slate-700">Order Summary</p>
            </div>
            {cart.filter(c => c.product_name && c.qty > 0 && c.unit_price > 0).map(item => (
              <div key={item.key} className="flex justify-between text-xs text-slate-600">
                <span>{item.product_name} × {item.qty} {item.unit}{item.discount_pct > 0 ? ` (-${item.discount_pct}%)` : ''}</span>
                <span className="font-semibold">₹{lineTotal(item).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold text-slate-800 border-t border-slate-200 pt-2 mt-2">
              <span>Net Total</span>
              <span className="text-green-700 text-lg">₹{netAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>
          </div>

          {/* Payment mode */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Payment Mode</p>
            <div className="grid grid-cols-3 gap-2">
              {(['cod', 'credit', 'upi'] as const).map(mode => (
                <button key={mode} onClick={() => setPaymentMode(mode)}
                  className={`rounded-xl border-2 py-2.5 text-sm font-semibold transition-all ${paymentMode === mode ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {mode === 'cod' ? '💵 COD' : mode === 'credit' ? '📋 Credit' : '📱 UPI'}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Order Notes</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Special instructions…" />
          </div>
        </div>
      )}

      {/* ── Place Order button ── */}
      {selectedCustomer && cart.some(c => c.product_name && c.qty > 0 && c.unit_price > 0) && (
        <button
          onClick={() => placeOrder.mutate()}
          disabled={placeOrder.isPending || isSubmitting}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-green-600 py-4 font-bold text-white hover:bg-green-700 disabled:opacity-50 shadow-lg shadow-green-200 text-base"
        >
          {(placeOrder.isPending || isSubmitting)
            ? <><RefreshCw className="h-5 w-5 animate-spin" /> Placing Order…</>
            : <><ShoppingBag className="h-5 w-5" /> Place Order · ₹{netAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</>}
        </button>
      )}
    </div>
  );
}
