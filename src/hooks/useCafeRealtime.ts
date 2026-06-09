import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { CafeOrder } from './useCafeOrders';

export function useCafeRealtime() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { role } = user || {};

  useEffect(() => {
    const normalizedRole = role?.toLowerCase();
    const isManagerRole = ['cafe_manager', 'palm_cafe_manager', 'admin', 'ceo', 'canteen_smo', 'cafe_delivery'].includes(normalizedRole || '');

    const channel = supabase
      .channel('cafe-global-sync')
      // 1. Menu Item updates (For flash ads and menu sync)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cafe_menu_items',
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['cafe-menu'] });
          queryClient.invalidateQueries({ queryKey: ['cafe-manager-menu'] });

          const newItem = payload.new as any;
          const oldItem = payload.old as any;

          const isLive = newItem.is_available && (!oldItem || !oldItem.is_available);

          if (isLive && !newItem.out_of_stock) {
            const event = new CustomEvent('cafe-dish-live', { 
              detail: {
                id: newItem.id,
                name: newItem.item_name,
                image: newItem.item_image_url,
                category: newItem.category,
                price: newItem.price
              } 
            });
            window.dispatchEvent(event);
            
            toast.success(`Delicious News! ${newItem.item_name} is now LIVE at PALM CAFE! ☕`, {
              description: `Grab your ${newItem.category} now.`,
              duration: 5000,
            });
          }
        }
      )
      // 2. Order updates (For manager notifications)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cafe_orders' },
        (payload) => {
          if (!isManagerRole) return;

          console.log('[useCafeRealtime] Global order change:', payload.eventType);
          
          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as CafeOrder;
            toast.success(`New order from ${newOrder.customer_name}! 🍔`, {
              description: `Order #${newOrder.order_number} for ₹${newOrder.total_amount}.`,
              duration: 8000,
            });
          }

          if (payload.eventType === 'UPDATE') {
            const newOrder = payload.new as CafeOrder;
            const oldOrder = payload.old as CafeOrder;
            
            if (newOrder.payment_status === 'proof_uploaded' && oldOrder.payment_status !== 'proof_uploaded') {
                toast.info(`Payment proof uploaded for #${newOrder.order_number}! 💳`, {
                  description: `Please verify the receipt from ${newOrder.customer_name}.`,
                  duration: 6000,
                });
            }
          }

          queryClient.invalidateQueries({ queryKey: ['cafe-manager-orders'] });
          queryClient.invalidateQueries({ queryKey: ['cafe-stats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [role, queryClient, user]);
}
