import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft, Search, Plus, Minus, Trash2, ShoppingCart,
  User, Phone, Loader2, CheckCircle2, Package
} from 'lucide-react';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  grade_a_price: number;
  grade_b_discount: number;
  grade_c_discount: number;
}

interface CartItem {
  product: Product;
  grade: 'A' | 'B' | 'C';
  qty: number;
  unit_price: number;
}

const GRADE_COLORS = { A: 'bg-green-100 text-green-700', B: 'bg-blue-100 text-blue-700', C: 'bg-amber-100 text-amber-700' };

export default function TakeOrder() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [productSearch, setProductSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMode, setPaymentMode] = useState<'cod' | 'credit' | 'upi'>('cod');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { data: customer } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, category, unit, grade_a_price, grade_b_discount, grade_c_discount')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.category.toLowerCase().includes(productSearch.toLowerCase())
  );

  const addToCart = (product: Product, grade: 'A' | 'B' | 'C') => {
    const discount = grade === 'A' ? 0 : grade === 'B' ? product.grade_b_discount : product.grade_c_discount;
    const unit_price = parseFloat((product.grade_a_price * (1 - discount / 100)).toFixed(2));
    const existing = cart.findIndex(c => c.product.id === product.id && c.grade === grade);
    if (existing >= 0) {
      setCart(cart.map((c, i) => i === existing ? { ...c, qty: c.qty + 1 } : c));
    } else {
      setCart([...cart, { product, grade, qty: 1, unit_price }]);
    }
    setProductSearch('');
    toast.success(`${product.name} (Grade ${grade}) added to cart`);
  };

  const adjustQty = (idx: number, delta: number) => {
    setCart(prev => {
      const updated = prev.map((c, i) => i === idx ? { ...c, qty: c.qty + delta } : c);
      return updated.filter(c => c.qty > 0);
    });
  };

  const total = cart.reduce((sum, c) => sum + c.unit_price * c.qty, 0);

  const placeOrder = useMutation({
    mutationFn: async () => {
      const now = new Date().getTime();
      const orderNum = `FF-${now.toString().slice(-6)}`;
      const { data: order, error: oErr } = await supabase
        .from('sales_orders')
        .insert({
          customer_id: customerId,
          created_by: user?.id,
          order_number: orderNum,
          total_amount: total,
          payment_mode: paymentMode,
          payment_status: 'pending',
          status: 'confirmed',
          notes,
          channel: 'tele_caller',
        })
        .select('id')
        .single();
      if (oErr) throw oErr;

      const items = cart.map(c => ({
        order_id: order.id,
        product_id: c.product.id,
        quantity_kg: c.qty,
        unit_price: c.unit_price,
        grade: c.grade,
        subtotal: c.unit_price * c.qty,
      }));
      const { error: iErr } = await supabase.from('sales_order_items').insert(items);
      if (iErr) throw iErr;

      return order.id;
    },
    onSuccess: () => {
      setSubmitted(true);
      toast.success('Order placed successfully!');
    },
    onError: () => toast.error('Failed to place order'),
  });

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="p-4 bg-green-100 rounded-full">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Order Placed!</h2>
        <p className="text-gray-500 text-sm">The order has been confirmed for {(customer as any)?.shop_name || (customer as any)?.name}</p>
        <div className="flex gap-3 mt-2">
          <button
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700"
          >
            Back to Shop
          </button>
          <button
            onClick={() => { setCart([]); setSubmitted(false); }}
            className="px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium"
          >
            New Order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <div className="bg-white border-b px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Take Order</h1>
            <p className="text-sm text-gray-500">Place order for customer</p>
          </div>
        </div>

        {customer && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
            <div className="p-2 bg-white rounded-lg">
              <User className="h-4 w-4 text-green-600" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900 text-sm">{(customer as any).shop_name || (customer as any).name}</div>
              {(customer as any).phone && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Phone className="h-3 w-3" /> {(customer as any).phone}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="text-sm font-semibold text-gray-700 mb-2">Search & Add Products</div>
          <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-gray-50">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search product name or category..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="bg-transparent text-sm outline-none flex-1"
            />
          </div>

          {productSearch.length > 1 && (
            <div className="mt-2 border rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              {filteredProducts.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-400 text-center">No products found</div>
              ) : (
                filteredProducts.slice(0, 10).map((p) => (
                  <div key={p.id} className="px-4 py-3 border-b last:border-0 bg-white">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-medium text-sm text-gray-900">{p.name}</div>
                        <div className="text-xs text-gray-400">{p.category} · ₹{p.grade_a_price}/{p.unit}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {(['A', 'B', 'C'] as const).map((grade) => {
                        const disc = grade === 'A' ? 0 : grade === 'B' ? p.grade_b_discount : p.grade_c_discount;
                        const price = parseFloat((p.grade_a_price * (1 - disc / 100)).toFixed(2));
                        return (
                          <button
                            key={grade}
                            onClick={() => addToCart(p, grade)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-medium ${GRADE_COLORS[grade]} hover:opacity-80`}
                          >
                            <div>Grade {grade}</div>
                            <div className="font-bold">₹{price}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-green-600" />
              <span className="font-semibold text-gray-900">Cart ({cart.length} items)</span>
            </div>
            <div className="divide-y">
              {cart.map((item, idx) => (
                <div key={idx} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900">{item.product.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${GRADE_COLORS[item.grade]}`}>
                        Grade {item.grade}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">₹{item.unit_price}/kg</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => adjustQty(idx, -1)}
                      className="p-1 bg-gray-100 rounded-full hover:bg-gray-200"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold">{item.qty}</span>
                    <button
                      onClick={() => adjustQty(idx, 1)}
                      className="p-1 bg-green-100 text-green-700 rounded-full hover:bg-green-200"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="text-right min-w-[60px]">
                    <div className="font-semibold text-sm">₹{(item.unit_price * item.qty).toFixed(0)}</div>
                  </div>
                  <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="p-1 text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {cart.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="text-sm font-semibold text-gray-700 mb-3">Payment Mode</div>
            <div className="grid grid-cols-3 gap-2">
              {(['cod', 'credit', 'upi'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setPaymentMode(mode)}
                  className={`py-2.5 rounded-xl border-2 text-sm font-semibold uppercase transition-all ${
                    paymentMode === mode
                      ? 'border-green-600 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-500'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <textarea
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-3 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400 resize-none"
            />
          </div>
        )}
      </div>

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-3 flex items-center gap-3">
          <div>
            <div className="text-xs text-gray-500">Total</div>
            <div className="text-lg font-bold text-green-600">₹{total.toFixed(0)}</div>
          </div>
          <button
            onClick={() => placeOrder.mutate()}
            disabled={placeOrder.isPending || cart.length === 0}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl text-base font-semibold disabled:opacity-60"
          >
            {placeOrder.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShoppingCart className="h-5 w-5" />}
            Confirm Order
          </button>
        </div>
      )}

      {cart.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Cart is empty</p>
          <p className="text-sm">Search for products to add</p>
        </div>
      )}
    </div>
  );
}
