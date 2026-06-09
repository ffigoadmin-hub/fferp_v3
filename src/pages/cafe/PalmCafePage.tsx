// @ts-nocheck
import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCafeMenu, CafeMenuItem } from '@/hooks/useCafeMenu';
import { useCafeCart, CartItem } from '@/hooks/useCafeCart';
import { useCafeOrders, CafeOrder } from '@/hooks/useCafeOrders';
import { useCafeAds } from '@/hooks/useCafeAds';
import { useCafeSettings } from '@/hooks/useCafeSettings';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  Coffee,
  UtensilsCrossed,
  Cookie,
  GlassWater,
  Moon,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Upload,
  Clock,
  CheckCircle2,
  XCircle,
  ChefHat,
  Package,
  Star,
  AlertTriangle,
  ArrowLeft,
  CreditCard,
  Loader2,
  Leaf,
  Drumstick,
  Flame,
  History,
  QrCode,
  Copy,
  Check,
  X,
  MessageSquare,
  FileText,
  Sparkles,
  Search,
  Ban,
} from 'lucide-react';

// Category metadata
const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Coffee; gradient: string; time: string }> = {
  breakfast: {
    label: 'Breakfast',
    icon: Coffee,
    gradient: 'from-amber-500/30 to-orange-500/30',
    time: '8:00 AM - 10:00 AM',
  },
  lunch: {
    label: 'Lunch',
    icon: UtensilsCrossed,
    gradient: 'from-emerald-500/30 to-teal-500/30',
    time: '12:00 PM - 2:00 PM',
  },
  cool_drinks: {
    label: 'Cool Drinks',
    icon: GlassWater,
    gradient: 'from-cyan-400/30 to-blue-500/30',
    time: 'All Day',
  },
  hot_drinks: {
    label: 'Hot Drinks',
    icon: Coffee,
    gradient: 'from-orange-500/30 to-red-500/30',
    time: 'All Day',
  },
  fresh_drinks: {
    label: 'Fresh Drinks',
    icon: Leaf,
    gradient: 'from-green-500/30 to-emerald-500/30',
    time: 'All Day',
  },
  smoothies: {
    label: 'Smoothies',
    icon: GlassWater,
    gradient: 'from-pink-400/30 to-rose-500/30',
    time: 'All Day',
  },
  hydrants: {
    label: 'Hydrants',
    icon: GlassWater,
    gradient: 'from-sky-400/30 to-blue-400/30',
    time: 'All Day',
  },
  dinner: {
    label: 'Dinner',
    icon: Moon,
    gradient: 'from-indigo-500/30 to-violet-500/30',
    time: '6:00 PM - 8:00 PM',
  },
  snack: {
    label: 'Snacks',
    icon: Cookie,
    gradient: 'from-orange-500/30 to-amber-500/30',
    time: 'All Day',
  },
};

const CATEGORY_ORDER = [
  'breakfast',
  'lunch',
  'snack',
  'cool_drinks',
  'hot_drinks',
  'fresh_drinks',
  'dinner'
];

const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending_payment: { label: 'Awaiting Payment', color: 'text-yellow-400', icon: CreditCard },
  pending_verification: { label: 'Verifying Payment', color: 'text-blue-400', icon: Clock },
  verified: { label: 'Payment Verified', color: 'text-emerald-400', icon: CheckCircle2 },
  preparing: { label: 'Preparing', color: 'text-orange-400', icon: ChefHat },
  ready: { label: 'Ready for Pickup', color: 'text-green-400', icon: Package },
  collected: { label: 'Collected', color: 'text-gray-400', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'text-red-400', icon: XCircle },
};

type ViewMode = 'menu' | 'cart' | 'payment' | 'orders';

export function PalmCafePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { settings: cafeSettings } = useCafeSettings();
  const { menuItems, menuByCategory, isLoading: menuLoading } = useCafeMenu();
  const cart = useCafeCart();
  const {
    myOrders,
    ordersLoading,
    placeOrder,
    uploadPaymentProof,
    cancelOrder,
    rateOrder,
    paymentInfo,
  } = useCafeOrders();

  const [searchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>('menu');

  useEffect(() => {
    const view = searchParams.get('view');
    if (view === 'orders') {
      setViewMode('orders');
    }
  }, [searchParams]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentOrder, setCurrentOrder] = useState<CafeOrder | null>(null);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);
  const [copiedUPI, setCopiedUPI] = useState(false);
  const [ratingOrder, setRatingOrder] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [viewDetailsId, setViewDetailsId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter menu items
  const filteredItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.item_description && item.item_description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Categories that have items
  const activeCategories = Object.keys(menuByCategory);

  // Auto-reset category filter if selected category no longer has items
  useEffect(() => {
    if (selectedCategory !== 'all' && !activeCategories.includes(selectedCategory)) {
      setSelectedCategory('all');
    }
  }, [activeCategories, selectedCategory]);

  const handlePlaceOrder = async () => {
    if (cart.items.length === 0) return;

    try {
      const order = await placeOrder.mutateAsync({
        cartItems: cart.items,
        specialInstructions: specialInstructions || undefined,
      });
      
      setCurrentOrder(order);
      cart.clearCart();
      setSpecialInstructions('');
      setViewMode('payment');
      
      toast({
        title: '🎉 Order Placed!',
        description: `Order #${order.order_number} created. Please complete payment.`,
      });
    } catch (error: any) {
      toast({
        title: 'Order Failed',
        description: error.message || 'Could not place order. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleUploadProof = async (file: File) => {
    if (!currentOrder) return;
    setUploadingProof(true);

    try {
      const updatedOrder = await uploadPaymentProof.mutateAsync({
        orderId: currentOrder.id,
        file,
      });
      setCurrentOrder(updatedOrder);
      toast({
        title: '✅ Payment Proof Uploaded',
        description: 'Your payment proof has been submitted for verification.',
      });
    } catch (error: any) {
      toast({
        title: 'Upload Failed',
        description: error.message || 'Could not upload payment proof.',
        variant: 'destructive',
      });
    } finally {
      setUploadingProof(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      await cancelOrder.mutateAsync({ orderId, reason: 'Cancelled by customer' });
      setCurrentOrder(null);
      setViewMode('orders');
      toast({ title: 'Order Cancelled', description: 'Your order has been cancelled.' });
    } catch (error: any) {
      toast({
        title: 'Cancel Failed',
        description: error.message || 'Could not cancel order.',
        variant: 'destructive',
      });
    }
  };

  const handleRateOrder = async (orderId: string) => {
    if (ratingValue === 0) return;
    try {
      await rateOrder.mutateAsync({
        orderId,
        rating: ratingValue,
        feedback: feedbackText || undefined,
      });
      setRatingOrder(null);
      setRatingValue(0);
      setFeedbackText('');
      toast({ title: '⭐ Thanks for your feedback!' });
    } catch (error: any) {
      toast({ title: 'Rating Failed', description: error.message, variant: 'destructive' });
    }
  };

  const copyUPI = () => {
    if (paymentInfo?.upi_id) {
      navigator.clipboard.writeText(paymentInfo.upi_id);
      setCopiedUPI(true);
      setTimeout(() => setCopiedUPI(false), 2000);
    }
  };

  // Active orders (not collected/cancelled)
  const activeOrders = myOrders.filter(
    o => !['collected', 'cancelled'].includes(o.order_status)
  );

  // Canteen closed screen
  if (cafeSettings !== undefined && cafeSettings?.is_open === false) {
    return (
      <div className="min-h-screen bg-background/50 flex flex-col items-center justify-center p-8 text-center">
        <div className="relative">
          <div className="absolute -inset-8 bg-red-500/10 blur-3xl rounded-full" />
          <div className="relative w-24 h-24 rounded-3xl bg-red-500/10 border-2 border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <Ban className="w-12 h-12 text-red-500/60" />
          </div>
        </div>
        <h2 className="text-2xl font-black text-foreground uppercase tracking-tight mb-2">Canteen Closed</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          PALM CAFE is currently closed. Please check back later when it opens.
        </p>
        <div className="mt-6 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20">
          <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Currently Unavailable</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32 bg-background/50">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl mx-4 mt-6 mb-8 shadow-2xl" style={{
        background: 'linear-gradient(135deg, hsl(var(--primary)/0.15) 0%, hsl(var(--primary)/0.05) 50%, hsl(20 80% 50%/0.1) 100%)',
        border: '1px solid hsl(var(--primary)/0.2)',
      }}>
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 20% 80%, hsl(var(--primary)/0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, hsl(20 80% 50%/0.3) 0%, transparent 50%)',
        }} />
        <div className="relative px-8 py-10">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-4 mb-3">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center transform hover:scale-105 transition-transform shadow-lg" style={{
                  background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.8) 100%)',
                }}>
                  <Coffee className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-black text-foreground tracking-tight uppercase italic drop-shadow-sm">PALM CAFE</h1>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.3em] opacity-60">Mission Refreshment</p>
                </div>
              </div>
            </div>
            {/* View Toggle */}
            <div className="flex bg-muted/50 p-1.5 rounded-2xl border border-white/5 shadow-inner">
               <button 
                 onClick={() => setViewMode('menu')}
                 className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'menu' ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}
               >
                 Menu
               </button>
               <button 
                 onClick={() => setViewMode('orders')}
                 className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'orders' ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}
               >
                 Orders
               </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 px-4 mb-6 overflow-x-auto scrollbar-hide">
        {[
          { id: 'menu' as const, label: 'Menu', icon: UtensilsCrossed },
          { id: 'cart' as const, label: `Cart (${cart.totalItems})`, icon: ShoppingCart },
          { id: 'orders' as const, label: 'Orders', icon: History },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setViewMode(tab.id)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-300"
            style={{
              background: viewMode === tab.id
                ? 'hsl(var(--primary)/0.15)'
                : 'hsl(var(--muted)/0.5)',
              border: `1px solid ${viewMode === tab.id ? 'hsl(var(--primary)/0.3)' : 'transparent'}`,
              color: viewMode === tab.id ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
              boxShadow: viewMode === tab.id ? '0 0 15px hsl(var(--primary)/0.15)' : 'none',
            }}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-[600px]">
        {/* ==================== MENU VIEW ==================== */}
        {viewMode === 'menu' && (
          <div className="px-4 space-y-6 pb-20">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search menu..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl text-sm bg-card border border-border focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all"
            />
          </div>

          {/* Menu Items */}
          {menuLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-20">
              <UtensilsCrossed className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Items Available</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? 'No items match your search. Try a different keyword.'
                  : "Today's menu hasn't been updated yet. Check back soon!"}
              </p>
            </div>
          ) : (
            // Show all items in one grid
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map(item => (
                <div key={item.id} className="p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-all group">
                  {item.item_image_url && (
                    <img
                      src={item.item_image_url}
                      alt={item.item_name}
                      className="w-full h-40 object-cover rounded-lg mb-3 group-hover:scale-105 transition-transform"
                    />
                  )}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-foreground">{item.item_name}</h4>
                      <span className="text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary font-bold">{item.category}</span>
                    </div>
                    {item.item_description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{item.item_description}</p>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <p className="font-bold text-primary">₹{item.price}</p>
                      <button
                        onClick={() => cart.addToCart(item)}
                        className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== CART VIEW ==================== */}
      {viewMode === 'cart' && (
        <div className="px-4 space-y-4">
          {cart.items.length === 0 ? (
            <div className="text-center py-20">
              <ShoppingCart className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Your Cart is Empty</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Browse the menu and add items to get started.
              </p>
              <button
                onClick={() => setViewMode('menu')}
                className="px-6 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: 'hsl(var(--primary)/0.15)',
                  border: '1px solid hsl(var(--primary)/0.3)',
                  color: 'hsl(var(--primary))',
                }}
              >
                Browse Menu
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {cart.items.map(item => (
                  <CartItemCard
                    key={item.menuItem.id}
                    item={item}
                    onUpdateQuantity={(qty) => cart.updateQuantity(item.menuItem.id, qty)}
                    onRemove={() => cart.removeFromCart(item.menuItem.id)}
                    onUpdateRequest={(req) => cart.updateSpecialRequest(item.menuItem.id, req)}
                  />
                ))}
              </div>

              {/* Special Instructions */}
              <div className="p-4 rounded-xl border border-border bg-card">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  Special Instructions
                </label>
                <textarea
                  value={specialInstructions}
                  onChange={e => setSpecialInstructions(e.target.value)}
                  placeholder="Any special requests? (e.g., less spicy, no onions)"
                  className="w-full px-3 py-2 rounded-lg text-sm bg-background border border-border focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none resize-none"
                  rows={2}
                />
              </div>

              {/* Order Summary */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <h3 className="font-semibold text-foreground">Order Summary</h3>
                <div className="space-y-2 text-sm">
                  {cart.items.map(item => (
                    <div key={item.menuItem.id} className="flex justify-between text-muted-foreground">
                      <span>{item.menuItem.item_name} × {item.quantity}</span>
                      <span>₹{(item.menuItem.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="border-t border-border pt-2 flex justify-between font-bold text-foreground">
                    <span>Total</span>
                    <span className="text-primary">₹{cart.totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Place Order Button */}
              <button
                onClick={handlePlaceOrder}
                disabled={placeOrder.isPending}
                className="w-full py-4 rounded-xl text-base font-semibold text-white transition-all duration-300 disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.8) 100%)',
                  boxShadow: '0 4px 20px hsl(var(--primary)/0.4)',
                }}
              >
                {placeOrder.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Placing Order...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Place Order — ₹{cart.totalAmount.toFixed(2)}
                  </span>
                )}
              </button>
            </>
          )}
        </div>
      )}

      {/* ==================== PAYMENT VIEW ==================== */}
      {viewMode === 'payment' && currentOrder && (
        <div className="px-4 space-y-4">
          <button
            onClick={() => { setCurrentOrder(null); setViewMode('orders'); }}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Orders
          </button>

          {/* Order Confirmation */}
          <div className="p-5 rounded-xl border border-border bg-card text-center">
            <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3" style={{
              background: 'hsl(var(--primary)/0.15)',
            }}>
              <FileText className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-1">Order Placed!</h2>
            <p className="text-2xl font-bold text-primary">{currentOrder.order_number}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Total: <span className="font-semibold text-foreground">₹{currentOrder.total_amount}</span>
            </p>
          </div>

          {/* Payment Details */}
          <div className="p-5 rounded-xl border border-border bg-card space-y-5">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Complete Payment
            </h3>

            {/* UPI Info */}
            <div className="p-4 rounded-xl" style={{
              background: 'linear-gradient(135deg, hsl(var(--primary)/0.08) 0%, hsl(var(--primary)/0.03) 100%)',
              border: '1px solid hsl(var(--primary)/0.15)',
            }}>
              {paymentInfo?.qr_code_url && (
                <div className="flex justify-center mb-4">
                  <img
                    src={paymentInfo.qr_code_url}
                    alt="Payment QR Code"
                    className="w-48 h-48 rounded-lg border border-border"
                  />
                </div>
              )}

              <div className="text-center space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">UPI ID</p>
                <div className="flex items-center justify-center gap-2">
                  <code className="text-lg font-mono font-bold text-foreground">
                    {paymentInfo?.upi_id || 'palmcafe@paytm'}
                  </code>
                  <button
                    onClick={copyUPI}
                    className="p-1.5 rounded-lg transition-all hover:bg-primary/10"
                  >
                    {copiedUPI ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {paymentInfo?.merchant_name || 'PALM CAFE'}
                </p>
              </div>
            </div>

            {/* Amount to Pay */}
            <div className="p-4 rounded-xl bg-background border border-border text-center">
              <p className="text-sm text-muted-foreground">Amount to Pay</p>
              <p className="text-3xl font-bold text-primary mt-1">₹{currentOrder.total_amount}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ref: {currentOrder.order_number}
              </p>
            </div>

            {/* Steps */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Steps:</p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">1</span>
                  Open any UPI app (PhonePe, GPay, Paytm)
                </p>
                <p className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">2</span>
                  Pay ₹{currentOrder.total_amount} to{' '}
                  <span className="font-medium text-foreground">{paymentInfo?.upi_id || 'palmcafe@paytm'}</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">3</span>
                  Take a screenshot of the payment confirmation
                </p>
                <p className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">4</span>
                  Upload the screenshot below
                </p>
              </div>
            </div>

            {/* Upload Proof */}
            {currentOrder.payment_status === 'pending_proof' && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadProof(file);
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingProof}
                  className="w-full py-4 rounded-xl text-sm font-semibold text-white transition-all duration-300 disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, hsl(142 70% 45%) 0%, hsl(142 60% 38%) 100%)',
                    boxShadow: '0 4px 20px hsl(142 70% 45%/0.3)',
                  }}
                >
                  {uploadingProof ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Uploading...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Upload className="w-5 h-5" />
                      Upload Payment Screenshot
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* Proof Uploaded Status */}
            {currentOrder.payment_status === 'proof_uploaded' && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-emerald-400">Payment Proof Submitted</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Waiting for cafe manager to verify your payment.
                </p>
              </div>
            )}

            {/* Cancel Option */}
            {currentOrder.can_cancel && currentOrder.order_status !== 'cancelled' && (
              <button
                onClick={() => handleCancelOrder(currentOrder.id)}
                className="w-full py-3 rounded-xl text-sm font-medium text-red-400 border border-red-400/20 hover:bg-red-400/10 transition-all"
              >
                Cancel Order
              </button>
            )}
          </div>
        </div>
      )}

      {/* ==================== ORDERS VIEW ==================== */}
      {viewMode === 'orders' && (
        <div className="px-4 space-y-4">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            My Orders
          </h2>

          {ordersLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : myOrders.length === 0 ? (
            <div className="text-center py-20">
              <Package className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Orders Yet</h3>
              <p className="text-sm text-muted-foreground">
                Your order history will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {myOrders.map(order => {
                const statusConfig = ORDER_STATUS_CONFIG[order.order_status] || ORDER_STATUS_CONFIG.pending_payment;
                const StatusIcon = statusConfig.icon;

                return (
                  <div
                    key={order.id}
                    className="p-4 rounded-xl border border-border bg-card transition-all hover:border-primary/20"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <p className="text-sm font-bold text-foreground">{order.order_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(order.created_at), 'MMM d, yyyy • h:mm a')}
                        </p>
                      </div>
                      <button
                        onClick={() => setViewDetailsId(order.id)}
                        className="ml-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/20 hover:bg-blue-500/25 transition-all whitespace-nowrap"
                      >
                        Details
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-lg font-bold text-foreground">₹{order.total_amount}</p>

                      <div className="flex items-center gap-1.5">
                        <div className={`flex items-center gap-1.5 text-xs font-medium ${statusConfig.color}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusConfig.label}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                        {/* Upload proof if not yet */}
                        {order.payment_status === 'pending_proof' && (
                          <button
                            onClick={() => {
                              setCurrentOrder(order);
                              setViewMode('payment');
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/15 text-primary border border-primary/20 hover:bg-primary/25 transition-all"
                          >
                            <Upload className="w-3.5 h-3.5 inline mr-1" />
                            Pay Now
                          </button>
                        )}

                        {/* Rate if collected */}
                        {order.order_status === 'collected' && !order.rating && (
                          <button
                            onClick={() => {
                              setRatingOrder(order.id);
                              setRatingValue(0);
                              setFeedbackText('');
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/25 transition-all"
                          >
                            <Star className="w-3.5 h-3.5 inline mr-1" />
                            Rate
                          </button>
                        )}

                        {/* Show rating */}
                        {order.rating && (
                          <div className="flex items-center gap-1">
                            {Array.from({ length: order.rating }).map((_, i) => (
                              <Star key={i} className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                            ))}
                          </div>
                        )}

                        {/* Cancel */}
                        {order.can_cancel && !['collected', 'cancelled', 'preparing', 'ready'].includes(order.order_status) && (
                          <button
                            onClick={() => handleCancelOrder(order.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 border border-red-400/20 hover:bg-red-400/10 transition-all"
                          >
                            Cancel
                          </button>
                        )}
                      </div>

                    {/* Payment rejection reason */}
                    {order.payment_status === 'rejected' && order.payment_rejection_reason && (
                      <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                        <p className="text-xs text-red-400 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {order.payment_rejection_reason}
                        </p>
                      </div>
                    )}

                    {/* Rating Dialog */}
                    {ratingOrder === order.id && (
                      <div className="mt-4 p-4 rounded-xl border border-border bg-background space-y-3">
                        <p className="text-sm font-medium text-foreground">Rate your order</p>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map(star => (
                            <button
                              key={star}
                              onClick={() => setRatingValue(star)}
                              className="p-0.5 transition-transform hover:scale-110"
                            >
                              <Star
                                className={`w-8 h-8 transition-colors ${
                                  star <= ratingValue
                                    ? 'text-yellow-400 fill-yellow-400'
                                    : 'text-muted-foreground/30'
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                        <textarea
                          value={feedbackText}
                          onChange={e => setFeedbackText(e.target.value)}
                          placeholder="Any feedback? (optional)"
                          className="w-full px-3 py-2 rounded-lg text-sm bg-card border border-border outline-none resize-none"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRateOrder(order.id)}
                            disabled={ratingValue === 0}
                            className="px-4 py-2 rounded-lg text-xs font-medium bg-primary text-white disabled:opacity-40 transition-all"
                          >
                            Submit
                          </button>
                          <button
                            onClick={() => setRatingOrder(null)}
                            className="px-4 py-2 rounded-lg text-xs font-medium text-muted-foreground border border-border hover:bg-muted/50 transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Order Details Modal */}
              {viewDetailsId && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="bg-card border border-border rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto shadow-xl">
                  <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
                    <h3 className="font-bold text-foreground">Order Details</h3>
                    <button
                      onClick={() => setViewDetailsId(null)}
                      className="p-1 hover:bg-muted rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {myOrders.find(o => o.id === viewDetailsId) && (
                    <div className="p-4 space-y-4">
                      {(() => {
                        const order = myOrders.find(o => o.id === viewDetailsId);
                        if (!order) return null;

                        return (
                          <>
                            {/* Order Header */}
                            <div className="p-3 rounded-lg bg-muted/50 border border-border">
                              <p className="text-xs text-muted-foreground">Order Number</p>
                              <p className="text-lg font-bold text-foreground">{order.order_number}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {format(new Date(order.created_at), 'MMM d, yyyy • h:mm a')}
                              </p>
                            </div>

                            {/* Order Items */}
                            <div className="space-y-2">
                              <p className="text-sm font-semibold text-foreground">Items</p>
                              {order.cafe_order_items && order.cafe_order_items.length > 0 ? (
                                <div className="space-y-2">
                                  {order.cafe_order_items.map((item: any, idx: number) => (
                                    <div key={idx} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                                      <div className="flex justify-between items-start mb-1">
                                        <p className="font-medium text-foreground">{item.item_name}</p>
                                        <p className="text-sm text-muted-foreground">×{item.quantity}</p>
                                      </div>
                                      <p className="text-xs text-muted-foreground">₹{item.item_price} each</p>
                                      {item.special_request && (
                                        <p className="text-xs text-yellow-400 mt-1">📝 {item.special_request}</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">No items in order</p>
                              )}
                            </div>

                            {/* Special Instructions */}
                            {order.special_instructions && (
                              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <p className="text-xs font-semibold text-blue-400 mb-1 flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3" />
                                  Special Instructions
                                </p>
                                <p className="text-sm text-foreground">{order.special_instructions}</p>
                              </div>
                            )}

                            {/* Amount */}
                            <div className="p-3 rounded-lg bg-muted/50 border border-border">
                              <div className="flex justify-between mb-2">
                                <span className="text-sm text-muted-foreground">Subtotal</span>
                                <span className="text-sm font-medium text-foreground">₹{(order.total_amount - (order.tax_amount || 0)).toFixed(2)}</span>
                              </div>
                              {order.tax_amount && (
                                <div className="flex justify-between mb-2">
                                  <span className="text-sm text-muted-foreground">Tax</span>
                                  <span className="text-sm font-medium text-foreground">₹{order.tax_amount.toFixed(2)}</span>
                                </div>
                              )}
                              <div className="flex justify-between border-t border-border pt-2">
                                <span className="font-semibold text-foreground">Total</span>
                                <span className="text-lg font-bold text-primary">₹{order.total_amount}</span>
                              </div>
                            </div>

                            {/* Status */}
                            <div className="p-3 rounded-lg bg-muted/50 border border-border">
                              <p className="text-xs text-muted-foreground mb-1">Status</p>
                              <div className="flex items-center gap-2">
                                {(() => {
                                  const statusConfig = ORDER_STATUS_CONFIG[order.order_status] || ORDER_STATUS_CONFIG.pending_payment;
                                  const StatusIcon = statusConfig.icon;
                                  return (
                                    <>
                                      <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
                                      <span className={`text-sm font-medium ${statusConfig.color}`}>{statusConfig.label}</span>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )}

      </div>

      {/* Floating Cart Button */}
      {viewMode === 'menu' && cart.totalItems > 0 && (
        <div className="fixed bottom-6 left-4 right-4 z-50">
          <button
            onClick={() => setViewMode('cart')}
            className="w-full py-4 rounded-2xl text-base font-semibold text-white flex items-center justify-between px-6 transition-all duration-300"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.85) 100%)',
              boxShadow: '0 8px 30px hsl(var(--primary)/0.4), 0 2px 8px hsl(0 0% 0%/0.2)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <span>{cart.totalItems} item{cart.totalItems > 1 ? 's' : ''}</span>
            </div>
            <span className="text-lg">₹{cart.totalAmount.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* Real-time Flash Ad Overlay */}
      <FlashAdOverlay />
    </div>
  );
}

// Persist ad dismissal for the session to prevent re-fetch flickering
const viewedAds = new Set<string>();

function FlashAdOverlay() {
  const { activeAds } = useCafeAds();
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (activeAds && activeAds.length > 0) {
      // Find the first ad that hasn't been viewed this session
      const unviewedAdIndex = activeAds.findIndex(ad => !viewedAds.has(ad.id));
      if (unviewedAdIndex !== -1) {
        setCurrentAdIndex(unviewedAdIndex);
        setIsVisible(true);
      } else {
        setIsVisible(false); // All ads viewed, keep hidden
      }
    } else {
      setIsVisible(false); // No active ads
    }
  }, [activeAds]);

  if (!activeAds || activeAds.length === 0 || !isVisible) return null;

  const ad = activeAds[currentAdIndex];

  const handleDismiss = () => {
    viewedAds.add(ad.id);
    const nextUnviewed = activeAds.findIndex((a, idx) => !viewedAds.has(a.id));
    if (nextUnviewed !== -1) {
      setCurrentAdIndex(nextUnviewed);
    } else {
      setIsVisible(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-3xl animate-in fade-in duration-700">
      <div className="relative w-full max-w-xl bg-card border border-white/10 rounded-[2.5rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,1)] animate-in zoom-in-95 slide-in-from-bottom-5 duration-700">
        <button
          onClick={handleDismiss}
          className="absolute top-6 right-6 z-20 p-3 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-3xl border border-white/5 transition-all active:scale-90"
        >
          <X className="w-5 h-5 font-black" />
        </button>

        <div className="relative aspect-[3/4] sm:aspect-square w-full">
          <img src={ad.image_url} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
          
          <div className="absolute bottom-0 left-0 right-0 p-10 space-y-6">
             <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-2xl bg-primary shadow-[0_0_30px_rgba(var(--primary),0.5)] border border-white/20">
                <Sparkles className="w-4 h-4 text-white animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Live Special</span>
             </div>
             <h2 className="text-3xl sm:text-4xl font-black text-white leading-none drop-shadow-2xl uppercase italic italic tracking-tighter">
                {ad.message}
             </h2>
             <button
               onClick={handleDismiss}
               className="w-full py-5 rounded-2xl bg-white text-black font-black uppercase tracking-[0.2em] text-sm shadow-2xl transition-all hover:bg-primary hover:text-white transform active:scale-95"
             >
               Confirm & Dismiss
             </button>
          </div>
        </div>

        {activeAds.length > 1 && (
          <div className="absolute top-8 left-0 right-0 flex justify-center gap-1.5 px-10">
            {activeAds.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all duration-500 ${i === currentAdIndex ? 'bg-primary' : 'bg-white/10'}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== SUB-COMPONENTS ====================

function CategorySection({
  category,
  items,
  cart,
}: {
  category: string;
  items: CafeMenuItem[];
  cart: ReturnType<typeof useCafeCart>;
}) {
  const config = CATEGORY_CONFIG[category];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center bg-gradient-to-br ${config.gradient}`}
        >
          <Icon className="w-5 h-5 text-foreground drop-shadow-sm" />
        </div>
        <div>
          <h2 className="text-base font-bold text-foreground">{config.label}</h2>
          <p className="text-xs text-muted-foreground">{config.time}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map(item => (
          <MenuItemCard key={item.id} item={item} cart={cart} />
        ))}
      </div>
    </div>
  );
}

function MenuItemCard({
  item,
  cart,
}: {
  item: CafeMenuItem;
  cart: ReturnType<typeof useCafeCart>;
}) {
  const cartItem = cart.items.find(i => i.menuItem.id === item.id);
  const quantity = cartItem?.quantity || 0;

  return (
    <div
      className="p-4 rounded-xl border border-border bg-card transition-all duration-300 hover:border-primary/20 hover:shadow-lg"
      style={{
        boxShadow: quantity > 0 ? '0 0 20px hsl(var(--primary)/0.1)' : undefined,
        borderColor: quantity > 0 ? 'hsl(var(--primary)/0.3)' : undefined,
      }}
    >
      <div className="flex gap-3">
        {/* Image */}
        <div className="w-16 h-16 rounded-lg bg-muted/30 border border-border flex items-center justify-center shrink-0 overflow-hidden">
          {item.item_image_url ? (
            <img src={item.item_image_url} alt={item.item_name} className="w-full h-full object-cover rounded-lg" />
          ) : (
            <UtensilsCrossed className="w-6 h-6 text-muted-foreground/30" />
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                {/* Veg/Non-veg indicator */}
                {item.is_veg && (
                  <span className="w-3.5 h-3.5 rounded-sm border-[1.5px] border-green-500 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  </span>
                )}
                {item.is_non_veg && (
                  <span className="w-3.5 h-3.5 rounded-sm border-[1.5px] border-red-500 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  </span>
                )}
                <h3 className="text-[13px] font-bold text-foreground truncate leading-tight">{item.item_name}</h3>
              </div>
              {item.item_description && (
                <p className="text-[10px] text-muted-foreground line-clamp-1 leading-normal">{item.item_description}</p>
              )}
            </div>
          </div>

          {/* Tags row */}
          <div className="flex items-center gap-2 mt-1.5">
            {item.spice_level && (
              <span className="flex items-center gap-0.5 text-[10px] text-orange-400">
                <Flame className="w-3 h-3" />
                {item.spice_level}
              </span>
            )}
            {item.prep_time_minutes && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Clock className="w-3 h-3" />
                {item.prep_time_minutes}m
              </span>
            )}
          </div>

          {/* Price + Add Button */}
          <div className="flex items-center justify-between mt-1">
            <p className="text-sm font-black text-foreground">₹{item.price}</p>
            
            {quantity === 0 ? (
              <button
                onClick={() => cart.addToCart(item)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                style={{
                  background: 'hsl(var(--primary)/0.12)',
                  color: 'hsl(var(--primary))',
                  border: '1px solid hsl(var(--primary)/0.25)',
                }}
              >
                ADD
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => cart.updateQuantity(item.id, Math.max(0, quantity - 1))}
                  className="w-6 h-6 rounded-lg flex items-center justify-center transition-all bg-muted/20 border border-border"
                  style={{
                    color: 'hsl(var(--primary))',
                  }}
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-6 text-center text-xs font-black text-primary">{quantity}</span>
                <button
                  onClick={() => cart.addToCart(item)}
                  className="w-6 h-6 rounded-lg flex items-center justify-center transition-all"
                  style={{
                    background: 'hsl(var(--primary))',
                    color: 'white',
                  }}
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CartItemCard({
  item,
  onUpdateQuantity,
  onRemove,
  onUpdateRequest,
}: {
  item: CartItem;
  onUpdateQuantity: (qty: number) => void;
  onRemove: () => void;
  onUpdateRequest: (req: string) => void;
}) {
  return (
    <div className="p-4 rounded-xl border border-border bg-card">
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 rounded-lg bg-muted/30 border border-border flex items-center justify-center shrink-0 overflow-hidden">
          {item.menuItem.item_image_url ? (
            <img src={item.menuItem.item_image_url} alt={item.menuItem.item_name} className="w-full h-full object-cover rounded-lg" />
          ) : (
            <UtensilsCrossed className="w-6 h-6 text-muted-foreground/30" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{item.menuItem.item_name}</h3>
              <p className="text-sm text-primary font-bold">₹{item.menuItem.price}</p>
            </div>
            <button onClick={onRemove} className="p-1 text-red-400 hover:bg-red-400/10 rounded-lg transition-all">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => onUpdateQuantity(item.quantity - 1)}
                className="w-7 h-7 rounded-lg flex items-center justify-center border border-border hover:bg-muted/50 transition-all"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-7 text-center text-sm font-bold">{item.quantity}</span>
              <button
                onClick={() => onUpdateQuantity(item.quantity + 1)}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-primary text-white transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-sm font-bold text-foreground">₹{(item.menuItem.price * item.quantity).toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PalmCafePage;
