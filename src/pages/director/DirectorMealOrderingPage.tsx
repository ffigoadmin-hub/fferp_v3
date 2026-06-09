import { useState } from 'react';
import { useCafeMenu, CafeMenuItem } from '@/hooks/useCafeMenu';
import { useCafeOrders } from '@/hooks/useCafeOrders';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  Coffee,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Upload,
  CheckCircle2,
  Loader2,
  MessageSquare,
  FileText,
  Clock,
  Star,
  History,
} from 'lucide-react';

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Coffee }> = {
  breakfast: { label: 'Breakfast', icon: Coffee },
  lunch: { label: 'Lunch', icon: Coffee },
  cool_drinks: { label: 'Cool Drinks', icon: Coffee },
  hot_drinks: { label: 'Hot Drinks', icon: Coffee },
  fresh_drinks: { label: 'Fresh Drinks', icon: Coffee },
  smoothies: { label: 'Smoothies', icon: Coffee },
  hydrants: { label: 'Hydrants', icon: Coffee },
  dinner: { label: 'Dinner', icon: Coffee },
  snack: { label: 'Snacks', icon: Coffee },
};

interface CartItem {
  menuItem: CafeMenuItem;
  quantity: number;
  specialRequest?: string;
}

export function DirectorMealOrderingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { menuItems, menuByCategory, isLoading: menuLoading } = useCafeMenu();
  const { myOrders, ordersLoading, placeOrder } = useCafeOrders();

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'menu' | 'cart' | 'orders'>('menu');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = !searchQuery ||
      item.item_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const totalAmount = cartItems.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleAddToCart = (item: CafeMenuItem) => {
    const existing = cartItems.find(ci => ci.menuItem.id === item.id);
    if (existing) {
      setCartItems(cartItems.map(ci =>
        ci.menuItem.id === item.id
          ? { ...ci, quantity: ci.quantity + 1 }
          : ci
      ));
    } else {
      setCartItems([...cartItems, { menuItem: item, quantity: 1 }]);
    }
  };

  const handleUpdateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      setCartItems(cartItems.filter(ci => ci.menuItem.id !== itemId));
    } else {
      setCartItems(cartItems.map(ci =>
        ci.menuItem.id === itemId ? { ...ci, quantity } : ci
      ));
    }
  };

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) {
      toast({ title: 'Empty Cart', description: 'Please add items before placing order' });
      return;
    }

    setIsSubmitting(true);
    try {
      await placeOrder.mutateAsync({
        cartItems,
        specialInstructions: specialInstructions || undefined,
      });

      setCartItems([]);
      setSpecialInstructions('');
      setViewMode('orders');
      toast({
        title: 'Order Placed Successfully!',
        description: 'Your meal order has been submitted.',
      });
    } catch (error: any) {
      toast({
        title: 'Order Failed',
        description: error.message || 'Failed to place order',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-background/50">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Coffee className="w-6 h-6 text-primary" />
              PALM CAFE - Meal Ordering
            </h1>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('menu')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'menu'
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Menu
            </button>
            <button
              onClick={() => setViewMode('cart')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'cart'
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Cart ({totalItems})
            </button>
            <button
              onClick={() => setViewMode('orders')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'orders'
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Orders
            </button>
          </div>
        </div>
      </div>

      {/* Menu View */}
      {viewMode === 'menu' && (
        <div className="px-4 py-6 space-y-6">
          {/* Search */}
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-card border border-border focus:border-primary outline-none transition-colors"
          />

          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              All
            </button>
            {Object.entries(menuByCategory).map(([category]) => {
              const config = CATEGORY_CONFIG[category] || { label: category, icon: Coffee };
              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    selectedCategory === category
                      ? 'bg-primary text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {config.label}
                </button>
              );
            })}
          </div>

          {/* Menu Items */}
          {menuLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No items available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredItems.map(item => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-all"
                >
                  {item.item_image_url && (
                    <img
                      src={item.item_image_url}
                      alt={item.item_name}
                      className="w-full h-32 object-cover rounded-lg mb-3"
                    />
                  )}
                  <div className="space-y-2">
                    <p className="font-semibold text-foreground">{item.item_name}</p>
                    {item.item_description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{item.item_description}</p>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <p className="font-bold text-primary">₹{item.price}</p>
                      <button
                        onClick={() => handleAddToCart(item)}
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

      {/* Cart View */}
      {viewMode === 'cart' && (
        <div className="px-4 py-6 space-y-4">
          {cartItems.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Your cart is empty</p>
            </div>
          ) : (
            <>
              {/* Cart Items */}
              <div className="space-y-3">
                {cartItems.map(item => (
                  <div key={item.menuItem.id} className="p-4 rounded-lg border border-border bg-card">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-semibold text-foreground">{item.menuItem.item_name}</p>
                      <p className="text-primary font-bold">₹{item.menuItem.price}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdateQuantity(item.menuItem.id, item.quantity - 1)}
                          className="p-1 rounded hover:bg-muted"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateQuantity(item.menuItem.id, item.quantity + 1)}
                          className="p-1 rounded hover:bg-muted"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <button
                        onClick={() => handleUpdateQuantity(item.menuItem.id, 0)}
                        className="p-1 rounded hover:bg-red-500/10 text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Special Instructions */}
              <div className="p-4 rounded-lg border border-border bg-card">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                  <MessageSquare className="w-4 h-4" />
                  Special Instructions
                </label>
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="Any special requests?"
                  className="w-full px-3 py-2 rounded-lg text-sm bg-background border border-border focus:border-primary outline-none resize-none"
                  rows={2}
                />
              </div>

              {/* Summary */}
              <div className="p-4 rounded-lg border border-border bg-card">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Subtotal</span>
                  <span className="font-medium">₹{totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="text-lg font-bold text-primary">₹{totalAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Place Order Button */}
              <button
                onClick={handlePlaceOrder}
                disabled={isSubmitting || cartItems.length === 0}
                className="w-full py-4 rounded-lg bg-primary text-white font-semibold disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Placing Order...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-5 h-5" />
                    Place Order
                  </>
                )}
              </button>
            </>
          )}
        </div>
      )}

      {/* Orders View */}
      {viewMode === 'orders' && (
        <div className="px-4 py-6 space-y-4">
          {ordersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : myOrders.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No orders yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myOrders.map(order => (
                <div
                  key={order.id}
                  className="p-4 rounded-lg border border-border bg-card cursor-pointer hover:border-primary/50 transition-all"
                  onClick={() => setSelectedOrder(order)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-bold text-foreground">{order.order_number}</p>
                    <p className="text-sm text-primary font-semibold">₹{order.total_amount}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(order.created_at), 'MMM d, yyyy • h:mm a')}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Order Detail Modal */}
          {selectedOrder && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-card border border-border rounded-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
                <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
                  <h3 className="font-bold text-foreground">Order Details</h3>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Order Number</p>
                    <p className="text-lg font-bold text-foreground">{selectedOrder.order_number}</p>
                  </div>

                  {selectedOrder.cafe_order_items && selectedOrder.cafe_order_items.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-2">Items</p>
                      <div className="space-y-2">
                        {selectedOrder.cafe_order_items.map((item: any, idx: number) => (
                          <div key={idx} className="text-sm p-2 rounded bg-muted/30">
                            <p className="text-foreground">{item.item_name}</p>
                            <p className="text-xs text-muted-foreground">×{item.quantity} @ ₹{item.item_price}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedOrder.special_instructions && (
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <p className="text-xs font-semibold text-blue-400 mb-1">Special Instructions</p>
                      <p className="text-sm text-foreground">{selectedOrder.special_instructions}</p>
                    </div>
                  )}

                  <div className="p-3 rounded-lg bg-muted/50 border-t border-border">
                    <p className="text-sm font-bold text-foreground">Total: ₹{selectedOrder.total_amount}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
