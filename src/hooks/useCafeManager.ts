import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CafeOrder, CafeOrderItem } from './useCafeOrders';
import { CafeMenuItem } from './useCafeMenu';
import { format } from 'date-fns';
import { toast } from 'sonner';
export type CafeMasterItem = {
  id: string;
  item_name: string;
  category: string;
  item_description: string | null;
  price: number;
  item_image_url: string | null;
  spice_level: string | null;
  prep_time_minutes: number | null;
  allergens: string | null;
  is_veg: boolean;
  is_non_veg: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  average_rating?: number;
  review_count?: number;
  total_orders?: number;
};

export function useCafeManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { role } = user || {};

  // Subscribe to real-time updates for menu, master catalog, settings, and ads
  useEffect(() => {
    const normalizedRole = role?.toLowerCase();
    const isManagerRole = ['cafe_manager', 'palm_cafe_manager', 'admin', 'ceo', 'canteen_smo', 'cafe_delivery'].includes(normalizedRole || '');
    
    if (!user || !isManagerRole) return;

    console.log('[useCafeManager] Setting up real-time subscriptions for catalog and settings');
    
    const channel = supabase.channel('cafe-manager-catalog-sync')
      // 1. Menu Item updates (Today's menu changes)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cafe_menu_items' },
        (payload) => {
          console.log('[useCafeManager] Real-time menu change:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['cafe-manager-menu'] });
          queryClient.invalidateQueries({ queryKey: ['cafe-menu'] });
        }
      )
      // 2. Master Catalog updates
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cafe_master_menu' },
        (payload) => {
          console.log('[useCafeManager] Real-time master catalog change:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['cafe-master-menu'] });
        }
      )
      // 3. Settings updates (UPI, QR Code, etc.)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cafe_settings' },
        (payload) => {
          console.log('[useCafeManager] Real-time settings change:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['cafe-settings'] });
          queryClient.invalidateQueries({ queryKey: ['cafe-payment-info'] });
        }
      )
      // 4. Ads/Flash updates
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cafe_ads' },
        (payload) => {
          console.log('[useCafeManager] Real-time ads change:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['cafe-ads-active'] });
          queryClient.invalidateQueries({ queryKey: ['cafe-ads-all'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, role, queryClient]);

  // Fetch all orders (for manager view)
  const { data: allOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ['cafe-manager-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cafe_orders')
        .select('*, cafe_order_items(*)')
        .order('created_at', { ascending: false })
        .limit(300); // Increased limit for better coverage

      if (error) throw error;
      return data as CafeOrder[];
    },
    refetchInterval: 15000,
  });

  // Fetch orders by date range (for historical reports)
  const fetchOrdersByRange = async (startDate: string, endDate: string): Promise<CafeOrder[]> => {
    console.log(`[useCafeManager] Fetching orders from ${startDate} to ${endDate}`);
    const { data, error } = await supabase
      .from('cafe_orders')
      .select('*, cafe_order_items(*)')
      .gte('order_date', startDate)
      .lte('order_date', endDate)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as CafeOrder[];
  };

  // Fetch order items for a specific order
  const fetchOrderItems = async (orderId: string): Promise<CafeOrderItem[]> => {
    const { data, error } = await supabase
      .from('cafe_order_items')
      .select('*')
      .eq('order_id', orderId);

    if (error) throw error;
    return data as CafeOrderItem[];
  };

  // Verify payment and move to preparing
  const verifyAndPrepare = useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase
        .from('cafe_orders')
        .update({
          payment_status: 'verified',
          payment_verified_by: user!.id,
          payment_verified_at: new Date().toISOString(),
          order_status: 'preparing',
          preparation_started_at: new Date().toISOString(),
          can_cancel: false,
          status_updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;

      // Notify customer
      const order = data as CafeOrder;
      await supabase.from('notifications').insert({
        user_id: order.customer_id,
        title: '✅ Payment Verified',
        message: `Your order ${order.order_number} payment has been verified. Preparing now!`,
        type: 'cafe_order',
        role: 'employee',
        link: '/palm-cafe?view=orders',
      });

      return data as CafeOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cafe-manager-orders'] });
    },
  });

  // Reject payment
  const rejectPayment = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      const { data, error } = await supabase
        .from('cafe_orders')
        .update({
          payment_status: 'rejected',
          payment_rejection_reason: reason,
          order_status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: user!.id,
          status_updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;

      const order = data as CafeOrder;
      await supabase.from('notifications').insert({
        user_id: order.customer_id,
        title: '❌ Payment Rejected',
        message: `Your order ${order.order_number} payment was rejected: ${reason}`,
        type: 'cafe_order',
        role: 'employee',
        link: '/palm-cafe?view=orders',
      });

      return data as CafeOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cafe-manager-orders'] });
    },
  });

  // Trust and prepare (bypass verification)
  const trustAndPrepare = useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase
        .from('cafe_orders')
        .update({
          trusted_order: true,
          order_status: 'preparing',
          preparation_started_at: new Date().toISOString(),
          can_cancel: false,
          status_updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;

      const order = data as CafeOrder;
      await supabase.from('notifications').insert({
        user_id: order.customer_id,
        title: '🍳 Order Being Prepared',
        message: `Your order ${order.order_number} is now being prepared!`,
        type: 'cafe_order',
        role: 'employee',
        link: '/palm-cafe?view=orders',
      });

      return data as CafeOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cafe-manager-orders'] });
    },
  });

  // Mark as ready
  const markReady = useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase
        .from('cafe_orders')
        .update({
          order_status: 'ready',
          ready_at: new Date().toISOString(),
          preparation_completed_at: new Date().toISOString(),
          status_updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;

      const order = data as CafeOrder;
      await supabase.from('notifications').insert({
        user_id: order.customer_id,
        title: '🎉 Order Ready!',
        message: `Your order ${order.order_number} (₹${order.total_amount}) is ready for pickup from PALM CAFE!`,
        type: 'cafe_order',
        role: 'employee',
        link: '/palm-cafe?view=orders',
      });

      return data as CafeOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cafe-manager-orders'] });
    },
  });

  // Mark as collected
  const markCollected = useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase
        .from('cafe_orders')
        .update({
          order_status: 'collected',
          collected_at: new Date().toISOString(),
          marked_collected_by: user!.id,
          status_updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;
      return data as CafeOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cafe-manager-orders'] });
    },
  });

  // Add menu item
  const addMenuItem = useMutation({
    mutationFn: async (itemData: {
      item_name: string;
      item_description?: string;
      category: string;
      price: number;
      available_date: string;
      available_from?: string;
      available_to?: string;
      is_veg?: boolean;
      is_non_veg?: boolean;
      stock_quantity?: number;
      unlimited_stock?: boolean;
      prep_time_minutes?: number;
      spice_level?: string;
      allergens?: string;
      item_image_url?: string;
      master_item_id?: string;
    }) => {
      const { data, error } = await supabase
        .from('cafe_menu_items')
        .insert({
          ...itemData,
          is_available: true,
          created_by: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as CafeMenuItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cafe-menu'] });
      queryClient.invalidateQueries({ queryKey: ['cafe-manager-menu'] });
    },
  });

  // Fetch all menu items (including unavailable)
  const { data: allMenuItems, isLoading: menuLoading } = useQuery({
    queryKey: ['cafe-manager-menu'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cafe_menu_items')
        .select('*')
        .order('available_date', { ascending: false })
        .order('category')
        .limit(500);

      if (error) throw error;
      return data as CafeMenuItem[];
    },
  });

  // Toggle menu item availability
  const toggleItemAvailability = useMutation({
    mutationFn: async ({ itemId, isAvailable }: { itemId: string; isAvailable: boolean }) => {
      const { data, error } = await supabase
        .from('cafe_menu_items')
        .update({ is_available: isAvailable })
        .eq('id', itemId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cafe-menu'] });
      queryClient.invalidateQueries({ queryKey: ['cafe-manager-menu'] });
    },
  });

  // Master Menu Operations
  const { data: masterMenuItems, isLoading: masterLoading } = useQuery({
    queryKey: ['cafe-master-menu'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cafe_master_menu' as any)
        .select('*')
        .order('is_active', { ascending: false })
        .order('category')
        .order('item_name');

      if (error) throw error;
      return (data as unknown) as CafeMasterItem[];
    },
  });

  const addMasterItem = useMutation({
    mutationFn: async (itemData: Omit<CafeMasterItem, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      console.log('[useCafeManager] Attempting to add Master Item:', itemData.item_name);
      const { data, error } = await supabase
        .from('cafe_master_menu' as any)
        .insert({
          ...itemData,
          created_by: user!.id
        })
        .select()
        .single();

      if (error) {
        console.error('[useCafeManager] Error adding Master Item:', error);
        throw error;
      }
      return (data as unknown) as CafeMasterItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cafe-master-menu'] });
    },
  });

  const updateMasterItem = useMutation({
    mutationFn: async ({ id, ...itemData }: Partial<CafeMasterItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('cafe_master_menu' as any)
        .update({
          ...itemData,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return (data as unknown) as CafeMasterItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cafe-master-menu'] });
    },
  });

  const deleteMasterItem = useMutation({
    mutationFn: async (itemId: string) => {
      // Unlink any cafe_menu_items referencing this master item to avoid FK constraint
      const { error: unlinkError } = await supabase
        .from('cafe_menu_items')
        .update({ master_item_id: null })
        .eq('master_item_id', itemId);

      if (unlinkError) throw unlinkError;

      const { error } = await supabase
        .from('cafe_master_menu' as any)
        .delete()
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cafe-master-menu'] });
      queryClient.invalidateQueries({ queryKey: ['cafe-manager-menu'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to delete item: ${error?.message || 'Unknown error'}`);
    },
  });

  const toggleMasterItemActive = useMutation({
    mutationFn: async ({ itemId, isActive }: { itemId: string; isActive: boolean }) => {
      const { data, error } = await supabase
        .from('cafe_master_menu' as any)
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', itemId)
        .select()
        .single();

      if (error) throw error;
      return (data as unknown) as CafeMasterItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cafe-master-menu'] });
    },
  });

  // Toggle master item or legacy item ON/OFF for today's menu
  const toggleMasterItemForToday = useMutation({
    mutationFn: async ({ 
      masterItem, 
      enable, 
      isLegacy = false 
    }: { 
      masterItem: any; 
      enable: boolean; 
      isLegacy?: boolean 
    }) => {
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      if (enable) {
        // Find one existing row to avoid duplicates — use limit(1) instead of maybeSingle()
        const enableQuery = supabase
          .from('cafe_menu_items')
          .select('id, is_available')
          .eq('available_date', todayStr)
          .limit(1);

        if (isLegacy) {
          enableQuery.eq('item_name', masterItem.item_name).is('master_item_id', null);
        } else {
          enableQuery.eq('master_item_id', masterItem.id);
        }

        const { data: rows } = await enableQuery;
        const existing = rows?.[0] || null;

        if (existing) {
          const { error } = await supabase
            .from('cafe_menu_items')
            .update({ is_available: true })
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('cafe_menu_items')
            .insert({
              item_name: masterItem.item_name,
              item_description: masterItem.item_description,
              category: masterItem.category,
              price: masterItem.price,
              available_date: todayStr,
              is_veg: masterItem.is_veg,
              is_non_veg: masterItem.is_non_veg,
              prep_time_minutes: masterItem.prep_time_minutes,
              spice_level: masterItem.spice_level,
              allergens: masterItem.allergens,
              item_image_url: masterItem.item_image_url,
              is_available: true,
              unlimited_stock: true,
              master_item_id: isLegacy ? null : masterItem.id,
              created_by: user!.id,
            } as any);
          if (error) throw error;
        }
      } else {
        // Disable ALL matching rows for today — handles duplicate rows (e.g. MUSHROOM BIRIYANI)
        if (isLegacy) {
          const { error } = await supabase
            .from('cafe_menu_items')
            .update({ is_available: false })
            .eq('available_date', todayStr)
            .eq('item_name', masterItem.item_name)
            .is('master_item_id', null);
          if (error) throw error;
        } else {
          // Disable master-linked rows
          const { error } = await supabase
            .from('cafe_menu_items')
            .update({ is_available: false })
            .eq('available_date', todayStr)
            .eq('master_item_id', masterItem.id);
          if (error) throw error;
          // Also disable any legacy rows created before master catalog linkage (same name, no master_item_id)
          await supabase
            .from('cafe_menu_items')
            .update({ is_available: false })
            .eq('available_date', todayStr)
            .eq('item_name', masterItem.item_name)
            .is('master_item_id', null);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cafe-menu'] });
      queryClient.invalidateQueries({ queryKey: ['cafe-manager-menu'] });
    },
  });

  // Delete menu item
  const deleteMenuItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('cafe_menu_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cafe-manager-menu'] });
    },
  });

  // Close Daily Sales
  const closeDailySales = useMutation({
    mutationFn: async ({ date, notes }: { date: string; notes?: string }) => {
      const stats = todayOrders
        .filter(o => o.order_status === 'collected')
        .reduce((acc, o) => ({
          orders: acc.orders + 1,
          revenue: acc.revenue + o.total_amount,
        }), { orders: 0, revenue: 0 });

      const { data, error } = await supabase
        .from('cafe_daily_closings' as any)
        .insert({
          closing_date: date,
          total_orders: stats.orders,
          total_revenue: stats.revenue,
          closing_manager_id: user!.id,
          closing_notes: notes,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cafe-daily-closings'] });
    },
  });

  // Fetch all rated orders for global and per-dish stats
  const { data: ratingData } = useQuery({
    queryKey: ['cafe-master-ratings'],
    queryFn: async () => {
      const { data: orders, error } = await supabase
        .from('cafe_orders')
        .select('rating, cafe_order_items(menu_item_id)')
        .not('rating', 'is', null);
      
      if (error) throw error;

      // Fetch master_item_id mapping for all menu_item_ids found in rated orders
      const menuIds = Array.from(new Set(orders.flatMap(o => (o.cafe_order_items as any[]).map((oi: any) => oi.menu_item_id))));
      
      if (menuIds.length === 0) {
        return { masterStats: new Map(), totalReviews: 0, overallAvg: '0.0' };
      }

      const { data: mappings } = await supabase
        .from('cafe_menu_items')
        .select('id, master_item_id')
        .in('id', menuIds);

      const menuToMaster = new Map(mappings?.map(m => [m.id, m.master_item_id]) || []);

      const masterStatsMap = new Map<string, { sum: number; count: number }>();
      let totalReviewCount = 0;
      let totalRatingSum = 0;

      orders.forEach(order => {
        totalReviewCount++;
        totalRatingSum += order.rating || 0;

        const masterIdsInOrder = new Set((order.cafe_order_items as any[]).map((oi: any) => menuToMaster.get(oi.menu_item_id)).filter(Boolean));
        masterIdsInOrder.forEach(mId => {
          const current = masterStatsMap.get(mId!) || { sum: 0, count: 0 };
          masterStatsMap.set(mId!, { sum: current.sum + (order.rating || 0), count: current.count + 1 });
        });
      });

      return { 
        masterStats: masterStatsMap, 
        totalReviews: totalReviewCount, 
        overallAvg: totalReviewCount ? (totalRatingSum / totalReviewCount).toFixed(1) : '0.0' 
      };
    },
    refetchInterval: 30000,
  });

  // Daily stats + Active orders (anything not finalized)
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayOrders = allOrders?.filter(o => {
    const isToday = o.order_date === todayStr;
    // Active if not yet collected or cancelled
    const isActive = !['collected', 'cancelled'].includes(o.order_status);
    return isToday || isActive;
  }) || [];

  const stats = {
    totalToday: todayOrders.length,
    pendingVerification: todayOrders.filter(o => o.payment_status === 'proof_uploaded' || o.payment_status === 'pending_proof').length,
    preparing: todayOrders.filter(o => o.order_status === 'preparing').length,
    ready: todayOrders.filter(o => o.order_status === 'ready').length,
    collected: todayOrders.filter(o => o.order_status === 'collected').length,
    cancelled: todayOrders.filter(o => o.order_status === 'cancelled').length,
    totalRevenue: todayOrders
      .filter(o => o.order_status === 'collected')
      .reduce((sum, o) => sum + o.total_amount, 0),
    pendingPayment: todayOrders.filter(o => o.payment_status === 'pending_proof').length,
    totalMenuItems: allMenuItems?.length || 0,
    totalMasterItems: masterMenuItems?.length || 0,
    totalReviews: ratingData?.totalReviews || 0,
    averageRating: ratingData?.overallAvg || '0.0',
  };

  // Enhance master menu items with computed ratings
  const enhancedMasterMenuItems = masterMenuItems?.map(item => {
    const mStats = ratingData?.masterStats?.get(item.id);
    return {
      ...item,
      review_count: mStats?.count || 0,
      average_rating: mStats?.count ? mStats.sum / mStats.count : 0,
    };
  });

  return {
    allOrders,
    todayOrders,
    ordersLoading,
    stats,
    fetchOrderItems,
    verifyAndPrepare,
    rejectPayment,
    trustAndPrepare,
    markReady,
    markCollected,
    addMenuItem,
    allMenuItems,
    menuLoading,
    toggleItemAvailability,
    deleteMenuItem,
    closeDailySales,
    // Master Menu
    masterMenuItems: enhancedMasterMenuItems,
    masterLoading,
    addMasterItem,
    updateMasterItem,
    deleteMasterItem,
    toggleMasterItemActive,
    toggleMasterItemForToday,
    fetchOrdersByRange,
  };
}
