// @ts-nocheck
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import {
  Search, CheckCircle2, IndianRupee, Plus, X, Loader2,
  Building2, Phone, MapPin, ShoppingBag, CreditCard,
  Banknote, Smartphone, Receipt, User, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const PAYMENT_MODES = [
  { value: 'cash',   label: 'Cash',   icon: Banknote },
  { value: 'upi',    label: 'UPI',    icon: Smartphone },
  { value: 'cheque', label: 'Cheque', icon: Receipt },
  { value: 'neft',   label: 'NEFT',   icon: CreditCard },
];

const EMPTY_MANUAL = {
  customerName: '', shopName: '', area: '', phone: '',
  orderNumber: '', orderAmount: '', collectedAmount: '',
  paymentMode: 'cash', upiRef: '', chequeNo: '', notes: '',
};

export default function CollectionEntryPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [manual, setManual] = useState(EMPTY_MANUAL);

  // From-order flow
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [collectedAmount, setCollectedAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [upiRef, setUpiRef] = useState('');
  const [chequeNo, setChequeNo] = useState('');
  const [notes, setNotes] = useState('');

  // Pending orders
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['pending-collection-orders'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sales_orders')
        .select(`id, order_number, net_amount, payment_mode, status, order_date, hub_id,
          customer:customers(id, shop_name, owner_name, area, phone)`)
        .in('status', ['confirmed', 'dispatched', 'delivered'])
        .in('payment_mode', ['cod', 'credit', 'partial'])
        .order('order_date', { ascending: false })
        .limit(300);
      return (data ?? []).map((o: any) => ({
        ...o,
        shopName:   o.customer?.shop_name || o.customer?.owner_name || 'Unknown',
        area:       o.customer?.area || '—',
        phone:      o.customer?.phone || '—',
        customerId: o.customer?.id,
        netAmount:  Number(o.net_amount || 0),
      }));
    },
  });

  // Today's entries
  const { data: myToday = [] } = useQuery({
    queryKey: ['my-collections-today', user?.id, today],
    queryFn: async () => {
      const { data } = await supabase
        .from('cash_collections')
        .select('*')
        .eq('collected_by', user?.id)
        .eq('collection_date', today)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter((o: any) =>
      o.shopName.toLowerCase().includes(q) ||
      o.area.toLowerCase().includes(q) ||
      (o.order_number || '').toLowerCase().includes(q) ||
      (o.phone || '').includes(q)
    );
  }, [orders, search]);

  const todayTotal = (myToday as any[]).reduce((s, c) => s + Number(c.collected_amount || 0), 0);

  // Save from-order collection
  const saveFromOrder = useMutation({
    mutationFn: async () => {
      if (!selectedOrder) throw new Error('Select an order first');
      const amt = parseFloat(collectedAmount);
      if (isNaN(amt) || amt < 0) throw new Error('Enter a valid amount');
      const { error } = await supabase.from('cash_collections').insert({
        order_id:         selectedOrder.id,
        customer_id:      selectedOrder.customerId,
        customer_name:    selectedOrder.customer?.owner_name || selectedOrder.shopName,
        shop_name:        selectedOrder.shopName,
        area:             selectedOrder.area,
        phone:            selectedOrder.phone,
        order_number:     selectedOrder.order_number,
        order_amount:     selectedOrder.netAmount,
        collected_amount: amt,
        payment_mode:     paymentMode,
        upi_reference:    paymentMode === 'upi' ? upiRef : null,
        cheque_number:    paymentMode === 'cheque' ? chequeNo : null,
        collection_date:  today,
        hub_id:           selectedOrder.hub_id || null,
        collected_by:     user?.id,
        notes:            notes || null,
        status:           amt >= selectedOrder.netAmount ? 'collected' : 'shortfall',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Collection recorded!');
      setSelectedOrder(null); setCollectedAmount(''); setUpiRef(''); setChequeNo(''); setNotes(''); setPaymentMode('cash');
      qc.invalidateQueries({ queryKey: ['my-collections-today'] });
      qc.invalidateQueries({ queryKey: ['pending-collection-orders'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Save manual collection
  const saveManual = useMutation({
    mutationFn: async () => {
      if (!manual.customerName && !manual.shopName) throw new Error('Enter customer name or shop name');
      const collected = parseFloat(manual.collectedAmount);
      if (isNaN(collected) || collected <= 0) throw new Error('Enter a valid collected amount');
      const orderAmt = parseFloat(manual.orderAmount) || 0;
      const { error } = await supabase.from('cash_collections').insert({
        customer_name:    manual.customerName || manual.shopName,
        shop_name:        manual.shopName || manual.customerName,
        area:             manual.area || null,
        phone:            manual.phone || null,
        order_number:     manual.orderNumber || null,
        order_amount:     orderAmt,
        collected_amount: collected,
        payment_mode:     manual.paymentMode,
        upi_reference:    manual.paymentMode === 'upi' ? manual.upiRef : null,
        cheque_number:    manual.paymentMode === 'cheque' ? manual.chequeNo : null,
        collection_date:  today,
        collected_by:     user?.id,
        notes:            manual.notes || null,
        status:           collected >= orderAmt ? 'collected' : 'shortfall',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Collection recorded!');
      setShowModal(false);
      setManual(EMPTY_MANUAL);
      qc.invalidateQueries({ queryKey: ['my-collections-today'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const orderDiff = selectedOrder ? selectedOrder.netAmount - parseFloat(collectedAmount || '0') : 0;
  const manualDiff = parseFloat(manual.orderAmount || '0') - parseFloat(manual.collectedAmount || '0');

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900">Collection Entry</h1>
          <p className="text-sm text-gray-500">Record cash / UPI / cheque collected from customers</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Today</p>
            <p className="text-xl font-black text-green-700">₹{todayTotal.toLocaleString('en-IN')}</p>
            <p className="text-xs text-gray-400">{(myToday as any[]).length} entries</p>
          </div>
          {/* NEW COLLECTION BUTTON */}
          <button
            onClick={() => { setShowModal(true); setManual(EMPTY_MANUAL); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4" /> New Collection
          </button>
        </div>
      </div>

      {/* Main: Search from orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* LEFT — Order search */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-blue-500" /> From Existing Order
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search shop name, area, order #, phone..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
          ) : (
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {filtered.length === 0 && <p className="text-center text-sm text-gray-400 py-8">No pending orders found</p>}
              {filtered.map((order: any) => (
                <button key={order.id} onClick={() => { setSelectedOrder(order); setCollectedAmount(order.netAmount.toString()); }}
                  className={cn('w-full text-left p-3 rounded-xl border-2 transition-all',
                    selectedOrder?.id === order.id ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-blue-200 hover:bg-blue-50/40')}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-sm truncate">{order.shopName}</p>
                      <div className="flex gap-3 mt-0.5 text-[11px] text-gray-500">
                        <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{order.area}</span>
                        <span className="flex items-center gap-0.5"><Phone className="h-3 w-3" />{order.phone}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-sm text-gray-900">₹{order.netAmount.toLocaleString('en-IN')}</p>
                      <span className={cn('text-[10px] font-bold',
                        order.status === 'delivered' ? 'text-green-600' : order.status === 'dispatched' ? 'text-purple-600' : 'text-amber-600')}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT — Entry form for selected order */}
        <div className="space-y-4">
          {selectedOrder ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-800 flex items-center gap-2"><CreditCard className="h-4 w-4 text-green-600" /> Record Payment</h2>
                <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 space-y-1">
                <p className="font-bold text-blue-900 text-sm">{selectedOrder.shopName}</p>
                <div className="flex gap-3 text-xs text-blue-700">
                  <span><MapPin className="h-3 w-3 inline mr-0.5" />{selectedOrder.area}</span>
                  <span><Phone className="h-3 w-3 inline mr-0.5" />{selectedOrder.phone}</span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-blue-100">
                  <span className="text-blue-600 font-semibold">Order Amount</span>
                  <span className="font-black text-blue-900">₹{selectedOrder.netAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>
              {/* Payment mode */}
              <div className="grid grid-cols-4 gap-2">
                {PAYMENT_MODES.map(pm => { const Icon = pm.icon; return (
                  <button key={pm.value} onClick={() => setPaymentMode(pm.value)}
                    className={cn('flex flex-col items-center gap-1 py-2 rounded-xl border-2 text-[11px] font-bold transition-all',
                      paymentMode === pm.value ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-100 text-gray-500 hover:border-gray-300')}>
                    <Icon className="h-4 w-4" />{pm.label}
                  </button>
                ); })}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Collected Amount (₹)</label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input type="number" min="0" value={collectedAmount} onChange={e => setCollectedAmount(e.target.value)}
                    className="w-full pl-9 py-3 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="0.00" />
                </div>
                {collectedAmount && (
                  <div className={cn('mt-2 flex justify-between text-xs font-bold px-3 py-2 rounded-lg',
                    orderDiff === 0 ? 'bg-green-50 text-green-700' : orderDiff > 0 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700')}>
                    <span>{orderDiff === 0 ? '✅ Exact' : orderDiff > 0 ? '⚠️ Shortfall' : '💰 Excess'}</span>
                    <span>₹{Math.abs(orderDiff).toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>
              {paymentMode === 'upi' && <input value={upiRef} onChange={e => setUpiRef(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="UPI Reference / UTR..." />}
              {paymentMode === 'cheque' && <input value={chequeNo} onChange={e => setChequeNo(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Cheque Number..." />}
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" placeholder="Notes (optional)..." />
              <button onClick={() => saveFromOrder.mutate()} disabled={saveFromOrder.isPending || !collectedAmount}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                {saveFromOrder.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><CheckCircle2 className="h-4 w-4" /> Record Collection</>}
              </button>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
              <ShoppingBag className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-400">Select an order from the left</p>
              <p className="text-xs text-gray-300 mt-1">Or click <strong>New Collection</strong> for manual entry</p>
            </div>
          )}

          {/* Today's entries */}
          {(myToday as any[]).length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm font-black text-gray-900 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Today's Entries</p>
                <span className="text-xs text-gray-400">{(myToday as any[]).length}</span>
              </div>
              <div className="divide-y divide-gray-50 max-h-56 overflow-y-auto">
                {(myToday as any[]).map((c: any) => (
                  <div key={c.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{c.shop_name || c.customer_name}</p>
                      <p className="text-[11px] text-gray-400">{c.area} · {c.payment_mode?.toUpperCase()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-green-700 text-sm">₹{Number(c.collected_amount).toLocaleString('en-IN')}</p>
                      <span className={cn('text-[10px] font-bold', c.status === 'shortfall' ? 'text-red-500' : 'text-green-600')}>{c.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MANUAL COLLECTION MODAL ─────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-green-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-green-600 flex items-center justify-center">
                  <Plus className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h2 className="font-black text-gray-900">New Collection Entry</h2>
                  <p className="text-xs text-gray-500">Fill customer details & amount collected</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Customer Details */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> Customer Details
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block">Customer Name *</label>
                    <input value={manual.customerName} onChange={e => setManual(p => ({ ...p, customerName: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Owner / Customer name" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block">Shop Name</label>
                    <input value={manual.shopName} onChange={e => setManual(p => ({ ...p, shopName: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Shop / business name" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block flex items-center gap-1"><MapPin className="h-3 w-3" /> Location / Area</label>
                    <input value={manual.area} onChange={e => setManual(p => ({ ...p, area: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Area, locality..." />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</label>
                    <input value={manual.phone} onChange={e => setManual(p => ({ ...p, phone: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Mobile number" />
                  </div>
                </div>
              </div>

              {/* Order Details */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Order Details
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block">Order # (optional)</label>
                    <input value={manual.orderNumber} onChange={e => setManual(p => ({ ...p, orderNumber: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="ORD-XXXXX" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block">Order / Bill Amount (₹)</label>
                    <input type="number" min="0" value={manual.orderAmount} onChange={e => setManual(p => ({ ...p, orderAmount: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="0.00" />
                  </div>
                </div>
              </div>

              {/* Payment Mode */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Payment Mode</p>
                <div className="grid grid-cols-4 gap-2">
                  {PAYMENT_MODES.map(pm => { const Icon = pm.icon; return (
                    <button key={pm.value} onClick={() => setManual(p => ({ ...p, paymentMode: pm.value }))}
                      className={cn('flex flex-col items-center gap-1 py-2 rounded-xl border-2 text-[11px] font-bold transition-all',
                        manual.paymentMode === pm.value ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-100 text-gray-500 hover:border-gray-300')}>
                      <Icon className="h-4 w-4" />{pm.label}
                    </button>
                  ); })}
                </div>
              </div>

              {/* Collected Amount */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Collected Amount (₹) *</label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input type="number" min="0" value={manual.collectedAmount} onChange={e => setManual(p => ({ ...p, collectedAmount: e.target.value }))}
                    className="w-full pl-9 py-3 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="0.00" />
                </div>
                {manual.collectedAmount && manual.orderAmount && (
                  <div className={cn('mt-2 flex justify-between text-xs font-bold px-3 py-2 rounded-lg',
                    manualDiff === 0 ? 'bg-green-50 text-green-700' : manualDiff > 0 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700')}>
                    <span>{manualDiff === 0 ? '✅ Exact' : manualDiff > 0 ? '⚠️ Shortfall' : '💰 Excess'}</span>
                    <span>₹{Math.abs(manualDiff).toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>

              {/* UPI / Cheque ref */}
              {manual.paymentMode === 'upi' && (
                <input value={manual.upiRef} onChange={e => setManual(p => ({ ...p, upiRef: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="UPI Reference / UTR number..." />
              )}
              {manual.paymentMode === 'cheque' && (
                <input value={manual.chequeNo} onChange={e => setManual(p => ({ ...p, chequeNo: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Cheque number..." />
              )}

              {/* Notes */}
              <textarea value={manual.notes} onChange={e => setManual(p => ({ ...p, notes: e.target.value }))} rows={2}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" placeholder="Remarks (optional)..." />
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={() => saveManual.mutate()} disabled={saveManual.isPending || (!manual.customerName && !manual.shopName) || !manual.collectedAmount}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed">
                {saveManual.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><CheckCircle2 className="h-4 w-4" /> Save Collection</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
