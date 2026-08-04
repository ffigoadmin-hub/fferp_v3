import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from './CustomerPortal';
import {
  ShoppingCart, Plus, Minus, Trash2, Loader2,
  MapPin, CreditCard, CheckCircle2, Package
} from 'lucide-react';
import { toast } from 'sonner';

const PAYMENT_MODES = [
  { value: 'cod',    label: 'Cash on Delivery', icon: '💵' },
  { value: 'credit', label: 'Credit (Post-paid)', icon: '📋' },
  { value: 'upi',    label: 'UPI / Online',       icon: '📱' },
];

export default function CustomerCart() {
  const { cart, updateQty, removeItem, clearCart, total } = useCart();
  const navigate = useNavigate();
  const [paymentMode, setPaymentMode] = useState<'cod' | 'credit' | 'upi'>('cod');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [orderId, setOrderId] = useState<string | null>(null);

  const placeOrder = useMutation({
    mutationFn: async () => {
      if (!phone) throw new Error('Phone number is required for delivery');

      // 1. Upsert customer — use name derived from phone, pass all required columns
      const { data: customer, error: custErr } = await supabase
        .from('customers')
        .upsert(
          {
            phone,
            mobile: phone,
            name: `Customer ${phone.slice(-4)}`,
            shop_name: `Customer ${phone.slice(-4)}`,
            address: address || null,
            channel: 'web_portal',
            customer_type: 'individual',
          },
          { onConflict: 'phone' }
        )
        .select('id, hub_id')
        .single();
      if (custErr) throw custErr;

      // 2. Place sales order — include all columns that exist in fresh DB
      const orderNum = `FF-WEB-${Date.now().toString().slice(-6)}`;
      const { data: order, error: orderErr } = await supabase
        .from('sales_orders')
        .insert({
          customer_id:      customer.id,
          customer_name:    `Customer ${phone.slice(-4)}`,
          order_number:     orderNum,
          total_amount:     total,
          subtotal:         total,
          payment_mode:     paymentMode,
          payment_status:   'pending',
          status:           'pending',
          channel:          'customer_portal',
          source:           'website',
          order_source:     'website',
          hub_id:           customer.hub_id || null,
          notes:            notes || null,
          delivery_address: address || null,
        })
        .select('id')
        .single();
      if (orderErr) throw orderErr;

      // 3. Insert order items — use correct column names
      const items = cart.map(c => ({
        order_id:     order.id,
        product_id:   c.product_id,
        product_name: c.product_name,
        quantity:     c.qty,
        unit:         c.unit || 'kg',
        unit_price:   c.unit_price,
        total_price:  c.unit_price * c.qty,
        grade:        c.grade,
      }));
      const { error: itemsErr } = await supabase.from('sales_order_items').insert(items);
      if (itemsErr) throw itemsErr;

      if (phone) {
        await supabase.functions.invoke('whatsapp-notify', {
          body: {
            to: phone,
            type: 'order_confirmation',
            payload: { customer_name: 'Valued Customer', order_id: orderNum, total, status: 'Confirmed' },
          },
        });
      }

      return order.id;
    },
    onSuccess: (id) => {
      setOrderId(id);
      clearCart();
      toast.success('Order placed! You will receive a WhatsApp confirmation.');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to place order'),
  });

  const handleCheckout = () => {
    if (!phone) {
      toast.error('Please enter a phone number');
      return;
    }

    if (paymentMode === 'upi') {
      toast.loading('Initializing Secure Payment...', { id: 'razorpay' });
      setTimeout(() => {
        toast.dismiss('razorpay');
        const confirmed = window.confirm(`[Mock Razorpay] Pay ₹${total} to Farmers Factory?\n\nClick OK to simulate successful payment.`);
        if (confirmed) {
          placeOrder.mutate();
        } else {
          toast.error('Payment cancelled');
        }
      }, 1000);
    } else {
      placeOrder.mutate();
    }
  };

  if (orderId) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="p-5 bg-green-100 rounded-full mb-4">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Confirmed! 🎉</h2>
        <p className="text-gray-500 mb-6 text-sm">
          Your order has been placed. We'll dispatch it soon and notify you on WhatsApp.
        </p>
        <div className="flex gap-3">
          <button onClick={() => navigate('/customer/orders')} className="px-6 py-2.5 bg-green-600 text-white rounded-xl font-semibold">
            Track Orders
          </button>
          <button onClick={() => navigate('/customer')} className="px-6 py-2.5 border border-gray-300 rounded-xl font-semibold text-gray-700">
            Shop More
          </button>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <ShoppingCart className="h-16 w-16 text-gray-200 mb-4" />
        <h2 className="text-xl font-bold text-gray-700 mb-2">Cart is empty</h2>
        <p className="text-gray-400 mb-6">Add products to get started</p>
        <button onClick={() => navigate('/customer')} className="px-6 py-2.5 bg-green-600 text-white rounded-xl font-semibold">
          Browse Products
        </button>
      </div>
    );
  }

  return (
    <div className="pb-4">
      <div className="bg-white border-b px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">Your Cart</h1>
        <p className="text-sm text-gray-500">{cart.length} items</p>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {cart.map((item, idx) => (
            <div key={`${item.product_id}-${item.grade}`} className={`px-4 py-3 flex items-center gap-3 ${idx < cart.length - 1 ? 'border-b' : ''}`}>
              <div className="flex-1">
                <div className="font-medium text-sm text-gray-900">{item.product_name}</div>
                <div className="text-xs text-gray-500">Grade {item.grade} · ₹{item.unit_price}/{item.unit}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => updateQty(item.product_id, item.grade, item.qty - 1)} className="p-1 bg-gray-100 rounded-full">
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-6 text-center text-sm font-bold">{item.qty}</span>
                <button onClick={() => updateQty(item.product_id, item.grade, item.qty + 1)} className="p-1 bg-green-100 text-green-700 rounded-full">
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <div className="w-16 text-right">
                <div className="font-semibold text-sm text-gray-900">₹{(item.unit_price * item.qty).toFixed(0)}</div>
              </div>
              <button onClick={() => removeItem(item.product_id, item.grade)} className="text-red-400">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <div className="font-semibold text-gray-800 text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4 text-green-600" /> Delivery Details
          </div>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="WhatsApp number (+91...)"
            className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-400"
          />
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Delivery address (shop name + street)"
            rows={2}
            className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-400 resize-none"
          />
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Special instructions (optional)"
            className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
          <div className="font-semibold text-gray-800 text-sm flex items-center gap-2 mb-3">
            <CreditCard className="h-4 w-4 text-green-600" /> Payment Mode
          </div>
          {PAYMENT_MODES.map((mode) => (
            <button
              key={mode.value}
              onClick={() => setPaymentMode(mode.value as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-colors ${
                paymentMode === mode.value ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'
              }`}
            >
              <span className="text-lg">{mode.icon}</span>
              <span className="text-sm font-medium text-gray-800">{mode.label}</span>
              {paymentMode === mode.value && <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
          <div className="font-semibold text-gray-800 text-sm mb-2">Order Summary</div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal ({cart.length} items)</span>
            <span>₹{total.toFixed(0)}</span>
          </div>
          <div className="flex justify-between text-sm text-green-600">
            <span>Delivery</span>
            <span>Free</span>
          </div>
          <div className="flex justify-between font-bold text-base border-t pt-2">
            <span>Total</span>
            <span className="text-green-600">₹{total.toFixed(0)}</span>
          </div>
        </div>

        <button
          onClick={handleCheckout}
          disabled={placeOrder.isPending || !phone}
          className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-4 rounded-xl text-base font-semibold disabled:opacity-60 active:scale-[0.98] transition-transform"
        >
          {placeOrder.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Package className="h-5 w-5" />}
          Place Order · ₹{total.toFixed(0)}
        </button>
      </div>
    </div>
  );
}
