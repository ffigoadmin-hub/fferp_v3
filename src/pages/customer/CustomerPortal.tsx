import { useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { ShoppingCart, Package, Home, User } from 'lucide-react';
import CustomerHome from './CustomerHome';
import CustomerCart from './CustomerCart';
import CustomerOrderHistory from './CustomerOrderHistory';
import CustomerOrderTracking from './CustomerOrderTracking';
import CustomerLogin from './CustomerLogin';

export interface CartItem {
  product_id: string;
  product_name: string;
  grade: 'A' | 'B' | 'C';
  unit_price: number;
  qty: number;
  unit: string;
}

import { createContext, useContext } from 'react';

interface CartContextType {
  cart: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (product_id: string, grade: string) => void;
  updateQty: (product_id: string, grade: string, qty: number) => void;
  clearCart: () => void;
  total: number;
}

export const CartContext = createContext<CartContextType>({
  cart: [],
  addItem: () => {},
  removeItem: () => {},
  updateQty: () => {},
  clearCart: () => {},
  total: 0,
});

export function useCart() {
  return useContext(CartContext);
}

export default function CustomerPortal() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const location = useLocation();

  const addItem = (item: CartItem) => {
    setCart(prev => {
      const existing = prev.findIndex(c => c.product_id === item.product_id && c.grade === item.grade);
      if (existing >= 0) {
        return prev.map((c, i) => i === existing ? { ...c, qty: c.qty + item.qty } : c);
      }
      return [...prev, item];
    });
  };

  const removeItem = (product_id: string, grade: string) =>
    setCart(prev => prev.filter(c => !(c.product_id === product_id && c.grade === grade)));

  const updateQty = (product_id: string, grade: string, qty: number) =>
    setCart(prev =>
      qty <= 0
        ? prev.filter(c => !(c.product_id === product_id && c.grade === grade))
        : prev.map(c => c.product_id === product_id && c.grade === grade ? { ...c, qty } : c)
    );

  const clearCart = () => setCart([]);
  const total = cart.reduce((s, c) => s + c.unit_price * c.qty, 0);
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);

  const navItems = [
    { to: '/customer',        icon: Home,         label: 'Shop' },
    { to: '/customer/cart',   icon: ShoppingCart, label: 'Cart', badge: cartCount > 0 ? cartCount : undefined },
    { to: '/customer/orders', icon: Package,      label: 'Orders' },
    { to: '/customer/login',  icon: User,         label: 'Account' },
  ];

  return (
    <CartContext.Provider value={{ cart, addItem, removeItem, updateQty, clearCart, total }}>
      <div className="min-h-screen bg-gray-50">
        <div className="sticky top-0 z-50 bg-green-700 text-white px-4 py-3 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">🌿 Farmers Factory</span>
          </div>
          <div className="text-xs opacity-75">Fresh from farm to your shop</div>
        </div>

        <div className="pb-20">
          <Routes>
            <Route index element={<CustomerHome />} />
            <Route path="cart" element={<CustomerCart />} />
            <Route path="orders" element={<CustomerOrderHistory />} />
            <Route path="track/:orderId" element={<CustomerOrderTracking />} />
            <Route path="login" element={<CustomerLogin />} />
          </Routes>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t flex">
          {navItems.map(({ to, icon: Icon, label, badge }) => {
            const active = location.pathname === to || (to !== '/customer' && location.pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={`flex-1 flex flex-col items-center py-2 relative ${active ? 'text-green-600' : 'text-gray-400'}`}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {badge !== undefined && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </div>
                <span className="text-xs mt-0.5">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </CartContext.Provider>
  );
}
