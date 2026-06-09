import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CartItem } from './useCafeCart';

export interface CafeOrder {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  customer_department: string | null;
  order_date: string;
  order_time: string;
  pickup_type: string;
  scheduled_pickup_time: string | null;
  total_amount: number;
  payment_status: string;
  payment_proof_url: string | null;
  payment_proof_uploaded_at: string | null;
  payment_verified_at: string | null;
  payment_rejection_reason: string | null;
  trusted_order: boolean;
  order_status: string;
  status_updated_at: string;
  ready_at: string | null;
  collected_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  can_cancel: boolean;
  rating: number | null;
  feedback: string | null;
  special_instructions: string | null;
  created_at: string;
  updated_at: string;
  cafe_order_items?: CafeOrderItem[];
}

export interface CafeOrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  item_name: string;
  item_price: number;
  quantity: number;
  subtotal: number;
  special_request: string | null;
}

export function useCafeOrders() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch employee's orders
  const { data: myOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ['cafe-my-orders', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('cafe_orders') as any)
        .select('*, cafe_order_items(*)')
        .eq('customer_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as CafeOrder[];
    },
    enabled: !!user,
  });

  // Fetch order items for a specific order
  const fetchOrderItems = async (orderId: string): Promise<CafeOrderItem[]> => {
    const { data, error } = await (supabase
      .from('cafe_order_items') as any)
      .select('*')
      .eq('order_id', orderId);

    if (error) throw error;
    return data as CafeOrderItem[];
  };

  // Place a new order
  const placeOrder = useMutation({
    mutationFn: async ({
      cartItems,
      specialInstructions,
      pickupType = 'instant',
      scheduledPickupTime,
    }: {
      cartItems: CartItem[];
      specialInstructions?: string;
      pickupType?: string;
      scheduledPickupTime?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const totalAmount = cartItems.reduce(
        (sum, item) => sum + item.menuItem.price * item.quantity,
        0
      );

      // Create the order
      const { data: order, error: orderError } = await (supabase
        .from('cafe_orders') as any)
        .insert({
          customer_id: user.id,
          customer_name: user.name,
          customer_department: user.department || null,
          total_amount: totalAmount,
          pickup_type: pickupType,
          scheduled_pickup_time: scheduledPickupTime || null,
          special_instructions: specialInstructions || null,
          payment_status: 'pending_proof',
          order_status: 'pending_payment',
          can_cancel: true,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = cartItems.map(item => ({
        order_id: order.id,
        menu_item_id: item.menuItem.id,
        item_name: item.menuItem.item_name,
        item_price: item.menuItem.price,
        quantity: item.quantity,
        subtotal: item.menuItem.price * item.quantity,
        special_request: item.specialRequest || null,
      }));

      const { error: itemsError } = await (supabase
        .from('cafe_order_items') as any)
        .insert(orderItems);

      if (itemsError) throw itemsError;

      return order as CafeOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cafe-my-orders'] });
    },
  });

  // Upload payment proof
  const uploadPaymentProof = useMutation({
    mutationFn: async ({
      orderId,
      file,
    }: {
      orderId: string;
      file: File;
    }) => {
      const fileName = `payment-proofs/${orderId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('cafe-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('cafe-images')
        .getPublicUrl(fileName);

      const { data, error } = await (supabase
        .from('cafe_orders') as any)
        .update({
          payment_proof_url: urlData.publicUrl,
          payment_proof_uploaded_at: new Date().toISOString(),
          payment_status: 'proof_uploaded',
          order_status: 'pending_verification',
        })
        .eq('id', orderId)
        .eq('customer_id', user!.id)
        .select()
        .single();

      if (error) throw error;
      return data as CafeOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cafe-my-orders'] });
    },
  });

  // Cancel an order
  const cancelOrder = useMutation({
    mutationFn: async ({
      orderId,
      reason,
    }: {
      orderId: string;
      reason: string;
    }) => {
      const { data, error } = await (supabase
        .from('cafe_orders') as any)
        .update({
          order_status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: user!.id,
          cancellation_reason: reason,
          can_cancel: false,
        })
        .eq('id', orderId)
        .eq('customer_id', user!.id)
        .select()
        .single();

      if (error) throw error;
      return data as CafeOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cafe-my-orders'] });
    },
  });

  // Rate an order
  const rateOrder = useMutation({
    mutationFn: async ({
      orderId,
      rating,
      feedback,
    }: {
      orderId: string;
      rating: number;
      feedback?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await (supabase
        .from('cafe_orders') as any)
        .update({
          rating,
          feedback: feedback || null,
          rated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('customer_id', user!.id)
        .select()
        .single();

      if (error) throw error;
      return data as CafeOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cafe-my-orders'] });
    },
  });

  // Fetch payment info from cafe_settings
  const { data: paymentInfo } = useQuery({
    queryKey: ['cafe-payment-info'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('cafe_settings') as any)
        .select('*')
        .limit(1)
        .single();

      if (error) return null;
      return data;
    },
  });

  return {
    myOrders: myOrders || [],
    ordersLoading,
    placeOrder,
    uploadPaymentProof,
    cancelOrder,
    rateOrder,
    fetchOrderItems,
    paymentInfo,
  };
}
