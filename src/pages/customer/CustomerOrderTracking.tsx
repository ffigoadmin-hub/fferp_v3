import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import {
  ArrowLeft, CheckCircle2, Clock, Truck, Package,
  MapPin, Phone, Loader2, AlertCircle
} from 'lucide-react';

interface TrackStep {
  id: string;
  label: string;
  sublabel: string;
  done: boolean;
  active: boolean;
  time?: string;
}

export default function CustomerOrderTracking() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const { data: order, isLoading } = useQuery({
    queryKey: ['customer-track', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          customers!inner(name, phone, address, shop_name),
          sales_order_items!inner(
            quantity_kg, grade, unit_price, subtotal,
            products!inner(name, unit)
          )
        `)
        .eq('id', orderId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
    refetchInterval: (query) => {
      const currentOrder = query.state.data as any;
      return currentOrder && ['confirmed', 'dispatched'].includes(currentOrder.status) ? 30000 : false;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-green-600" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 px-6 text-center">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p className="font-medium text-gray-700">Order not found</p>
        <button onClick={() => navigate(-1)} className="text-green-600 underline text-sm">Go back</button>
      </div>
    );
  }

  const STATUS_STEPS = ['confirmed', 'dispatched', 'delivered'];
  const currentIdx = STATUS_STEPS.indexOf(order.status);

  const steps: TrackStep[] = [
    {
      id: 'confirmed',
      label: 'Order Confirmed',
      sublabel: 'We have received your order',
      done: currentIdx >= 0,
      active: currentIdx === 0,
      time: currentIdx >= 0 ? format(new Date(order.created_at), 'hh:mm a') : undefined,
    },
    {
      id: 'dispatched',
      label: 'Out for Delivery',
      sublabel: 'Driver is on the way',
      done: currentIdx >= 1,
      active: currentIdx === 1,
    },
    {
      id: 'delivered',
      label: 'Delivered',
      sublabel: 'Order delivered to your shop',
      done: currentIdx >= 2,
      active: currentIdx === 2,
    },
  ];

  const items = (order as any).sales_order_items || [];
  const customer = (order as any).customers;

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="bg-white border-b px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Track Order</h1>
          <p className="text-sm text-gray-500">{order.order_number}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className={`rounded-xl p-4 text-white ${
          order.status === 'delivered' ? 'bg-green-600' :
          order.status === 'dispatched' ? 'bg-blue-600' :
          order.status === 'cancelled' ? 'bg-red-600' :
          'bg-amber-500'
        }`}>
          <div className="flex items-center gap-3">
            {order.status === 'delivered' ? <CheckCircle2 className="h-8 w-8" /> :
             order.status === 'dispatched' ? <Truck className="h-8 w-8" /> :
             <Package className="h-8 w-8" />}
            <div>
              <div className="text-lg font-bold capitalize">{order.status}</div>
              <div className="text-sm opacity-80">
                {order.status === 'delivered' ? 'Delivered successfully!' :
                 order.status === 'dispatched' ? 'Driver is on the way' :
                 order.status === 'cancelled' ? 'Order was cancelled' :
                 'Preparing your order'}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="font-semibold text-gray-800 text-sm mb-4">Order Progress</div>
          <div className="space-y-4">
            {steps.map((step, idx) => (
              <div key={step.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    step.done ? 'bg-green-500 text-white' :
                    step.active ? 'bg-green-100 border-2 border-green-500' :
                    'bg-gray-100 text-gray-300'
                  }`}>
                    {step.done ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4 text-gray-400" />}
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={`w-0.5 h-8 mt-1 ${step.done ? 'bg-green-300' : 'bg-gray-200'}`} />
                  )}
                </div>
                <div className="pt-1">
                  <div className={`font-medium text-sm ${step.done ? 'text-gray-900' : 'text-gray-400'}`}>
                    {step.label}
                  </div>
                  <div className={`text-xs ${step.done ? 'text-gray-500' : 'text-gray-300'}`}>
                    {step.sublabel}
                    {step.time && <span className="ml-2 text-green-500">{step.time}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b">
            <span className="font-semibold text-sm text-gray-900">Items ({items.length})</span>
          </div>
          <div className="divide-y">
            {items.map((item: any, i: number) => (
              <div key={i} className="px-4 py-3 flex justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">{item.products?.name}</div>
                  <div className="text-xs text-gray-500">Grade {item.grade} · {item.quantity_kg} {item.products?.unit || 'kg'}</div>
                </div>
                <div className="font-semibold text-sm text-gray-900">₹{(item.subtotal || 0).toFixed(0)}</div>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t bg-gray-50 flex justify-between">
            <span className="font-bold text-sm">Total</span>
            <span className="font-bold text-green-600">₹{((order as any).total_amount || 0).toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 flex justify-between items-center">
          <div>
            <div className="text-sm font-medium text-gray-800">Payment Mode</div>
            <div className="text-sm text-gray-500 capitalize">{(order as any).payment_mode || 'COD'}</div>
          </div>
          <div className={`text-sm font-semibold capitalize px-3 py-1 rounded-full ${
            (order as any).payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {(order as any).payment_status || 'Pending'}
          </div>
        </div>

        {((order as any).delivery_address || customer?.address) && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-gray-800 mb-0.5">Delivery Address</div>
                <div className="text-sm text-gray-500">{(order as any).delivery_address || customer?.address}</div>
              </div>
            </div>
          </div>
        )}

        <div className="text-center py-2">
          <p className="text-xs text-gray-400 mb-2">Need help with your order?</p>
          <a
            href="tel:+91XXXXXXXXXX"
            className="inline-flex items-center gap-2 text-green-600 text-sm font-medium"
          >
            <Phone className="h-4 w-4" /> Call Farmers Factory Support
          </a>
        </div>
      </div>
    </div>
  );
}
