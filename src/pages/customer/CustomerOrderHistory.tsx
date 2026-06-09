import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Package, ChevronRight, Truck, CheckCircle2,
  Clock, XCircle, Search, Phone, Loader2
} from 'lucide-react';

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  confirmed:  { bg: 'bg-blue-100',   text: 'text-blue-700',   icon: <Clock className="h-3.5 w-3.5" /> },
  dispatched: { bg: 'bg-purple-100', text: 'text-purple-700', icon: <Truck className="h-3.5 w-3.5" /> },
  delivered:  { bg: 'bg-green-100',  text: 'text-green-700',  icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  cancelled:  { bg: 'bg-red-100',    text: 'text-red-700',    icon: <XCircle className="h-3.5 w-3.5" /> },
  pending:    { bg: 'bg-amber-100',  text: 'text-amber-700',  icon: <Clock className="h-3.5 w-3.5" /> },
};

export default function CustomerOrderHistory() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [submittedPhone, setSubmittedPhone] = useState('');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['customer-orders', submittedPhone],
    queryFn: async () => {
      if (!submittedPhone) return [];
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', submittedPhone)
        .single();
      if (!customer) return [];

      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          id, order_number, total_amount, status,
          payment_mode, payment_status, created_at,
          sales_order_items!inner(
            quantity_kg, grade,
            products!inner(name)
          )
        `)
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!submittedPhone,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">My Orders</h1>
        <p className="text-sm text-gray-500">Enter your phone number to view orders</p>
      </div>

      <div className="p-4">
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <div className="font-medium text-sm text-gray-700 flex items-center gap-2">
            <Phone className="h-4 w-4 text-green-600" /> Your WhatsApp Number
          </div>
          <div className="flex gap-2">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 9876543210"
              className="flex-1 border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-400"
            />
            <button
              onClick={() => setSubmittedPhone(phone)}
              disabled={!phone}
              className="px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-60 flex items-center gap-1"
            >
              <Search className="h-4 w-4" />
              Find
            </button>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-green-600" />
        </div>
      )}

      {!isLoading && submittedPhone && orders.length === 0 && (
        <div className="text-center py-16 text-gray-400 px-4">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No orders found</p>
          <p className="text-sm">No orders linked to {submittedPhone}</p>
        </div>
      )}

      {orders.length > 0 && (
        <div className="px-4 space-y-3 pb-6">
          <div className="text-sm font-medium text-gray-500">{orders.length} orders found</div>
          {orders.map((order: any) => {
            const st = STATUS_STYLES[order.status] || STATUS_STYLES['pending'];
            const itemSummary = order.sales_order_items
              ?.slice(0, 2)
              .map((i: any) => `${i.products?.name} (${i.quantity_kg}kg)`)
              .join(', ');
            const moreItems = (order.sales_order_items?.length || 0) - 2;

            return (
              <button
                key={order.id}
                onClick={() => navigate(`/customer/track/${order.id}`)}
                className="w-full bg-white rounded-xl shadow-sm p-4 text-left flex items-start gap-3 active:scale-[0.98] transition-transform"
              >
                <div className="p-2 bg-green-50 rounded-lg mt-0.5">
                  <Package className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm text-gray-900">{order.order_number}</span>
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${st.bg} ${st.text}`}>
                      {st.icon} {order.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mb-1">
                    {format(new Date(order.created_at), 'dd MMM yyyy')}
                  </div>
                  <div className="text-xs text-gray-600 truncate">
                    {itemSummary}{moreItems > 0 ? ` +${moreItems} more` : ''}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold text-green-600">₹{(order.total_amount || 0).toLocaleString()}</span>
                    <span className={`text-xs capitalize font-medium ${order.payment_status === 'paid' ? 'text-green-600' : 'text-amber-600'}`}>
                      {order.payment_status || 'Pending'}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 mt-1" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
