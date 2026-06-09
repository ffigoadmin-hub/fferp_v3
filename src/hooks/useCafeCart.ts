import { useState, useCallback, useMemo } from 'react';
import { CafeMenuItem } from './useCafeMenu';

export interface CartItem {
  menuItem: CafeMenuItem;
  quantity: number;
  specialRequest?: string;
}

export function useCafeCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  const addToCart = useCallback((menuItem: CafeMenuItem, quantity: number = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.menuItem.id === menuItem.id);
      if (existing) {
        return prev.map(i =>
          i.menuItem.id === menuItem.id
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      return [...prev, { menuItem, quantity }];
    });
  }, []);

  const removeFromCart = useCallback((menuItemId: string) => {
    setItems(prev => prev.filter(i => i.menuItem.id !== menuItemId));
  }, []);

  const updateQuantity = useCallback((menuItemId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems(prev => prev.filter(i => i.menuItem.id !== menuItemId));
      return;
    }
    setItems(prev =>
      prev.map(i =>
        i.menuItem.id === menuItemId ? { ...i, quantity } : i
      )
    );
  }, []);

  const updateSpecialRequest = useCallback((menuItemId: string, specialRequest: string) => {
    setItems(prev =>
      prev.map(i =>
        i.menuItem.id === menuItemId ? { ...i, specialRequest } : i
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0);
  }, [items]);

  const totalItems = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  return {
    items,
    addToCart,
    removeFromCart,
    updateQuantity,
    updateSpecialRequest,
    clearCart,
    totalAmount,
    totalItems,
  };
}
