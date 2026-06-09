import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import {
  ArrowLeft, Package, User, MapPin, Phone, Truck,
  CheckCircle2, Clock, XCircle, Loader2, MessageCircle,
  Printer, IndianRupee, Building2, ChevronRight, Share2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  draft:      { label: 'Draft',      className: 'bg-slate-100 text-slate-600',    icon: <Clock className="h-3 w-3" /> },
  pending:    { label: 'Pending',    className: 'bg-amber-100 text-amber-700',    icon: <Clock className="h-3 w-3" /> },
  confirmed:  { label: 'Confirmed',  className: 'bg-blue-100 text-blue-700',      icon: <CheckCircle2 className="h-3 w-3" /> },
  dispatched: { label: 'Dispatched', className: 'bg-purple-100 text-purple-700',  icon: <Truck className="h-3 w-3" /> },
  delivered:  { label: 'Delivered',  className: 'bg-green-100 text-green-700',    icon: <CheckCircle2 className="h-3 w-3" /> },
  cancelled:  { label: 'Cancelled',  className: 'bg-red-100 text-red-600',        icon: <XCircle className="h-3 w-3" /> },
  partial:    { label: 'Partial',    className: 'bg-orange-100 text-orange-700',  icon: <Clock className="h-3 w-3" /> },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: 'bg-slate-100 text-slate-600', icon: <Clock className="h-3 w-3" /> };
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider', cfg.className)}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const qc = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ['order-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          customers(id, name, phone, address, shop_name, area),
          sales_order_items(id, product_name, qty_kg, quantity, quantity_kg, unit_price, qc_grade, grade, total_price, subtotal, unit,
            products(id, name, category, unit)
          )
        `)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase.from('sales_orders').update({ status: newStatus }).eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Order status updated');
      qc.invalidateQueries({ queryKey: ['order-detail', id] });
      qc.invalidateQueries({ queryKey: ['sales-orders'] });
    },
    onError: () => toast.error('Failed to update status'),
  });

  const sendWhatsApp = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('whatsapp-notify', {
        body: { to: order?.customers?.phone, type: 'order_confirmation', payload: { customer_name: order?.customers?.name, order_id: order?.order_number, total: order?.net_amount ?? order?.total_amount, status: order?.status } },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => toast.success('WhatsApp notification sent'),
    onError: () => toast.error('WhatsApp send failed'),
  });

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  if (!order) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3 bg-slate-50">
      <XCircle className="h-12 w-12 text-slate-300" />
      <p className="text-slate-600 font-bold">Order not found</p>
      <button onClick={() => navigate(-1)} className="px-4 py-2 border rounded-lg text-sm">Go back</button>
    </div>
  );

  const status = order.status || 'pending';
  const items = order.sales_order_items || [];
  const customer = order.customers;
  const GRADE_LABEL: Record<string, string> = { A: 'Grade A', B: 'Grade B', C: 'Grade C' };
  const nextStatusMap: Record<string, string> = { pending: 'confirmed', confirmed: 'dispatched', dispatched: 'delivered' };
  const nextStatus = nextStatusMap[status];

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 shadow-sm">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-800">{order.order_number || `Order #${id?.slice(0, 8)}`}</h1>
              <StatusBadge status={status} />
            </div>
            <p className="text-xs text-slate-500 font-medium">Created on {format(new Date(order.created_at), 'dd MMM yyyy, hh:mm a')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 border rounded-lg"><Printer className="h-4 w-4" /></button>
          <button className="p-2 border rounded-lg"><Share2 className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2"><Package className="h-5 w-5 text-blue-600" /><h2 className="font-bold text-slate-800">Order Items</h2></div>
              <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">{items.length} Items</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Product</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Grade</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Qty</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Rate</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((item: any) => (
                    <tr key={item.id}>
                      <td className="px-5 py-3">
                        <div className="font-bold text-slate-800">{item.products?.name || item.product_name || '—'}</div>
                        <div className="text-[10px] text-slate-400 uppercase">{item.products?.category || 'Custom'}</div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold',
                          (item.qc_grade ?? item.grade) === 'A' ? 'bg-emerald-50 text-emerald-700' : (item.qc_grade ?? item.grade) === 'B' ? 'bg-amber-50 text-amber-700' : 'bg-orange-50 text-orange-700')}>
                          {GRADE_LABEL[item.qc_grade ?? item.grade] ?? (item.qc_grade ?? item.grade ?? '—')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-slate-800">{item.qty_kg ?? item.quantity ?? item.quantity_kg} <span className="text-[10px] text-slate-400">{item.unit || item.products?.unit || 'KG'}</span></td>
                      <td className="px-5 py-3 text-right text-slate-500">₹{item.unit_price}</td>
                      <td className="px-5 py-3 text-right font-bold text-slate-800">₹{(item.total_price ?? item.subtotal ?? 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-6"><IndianRupee className="h-5 w-5 text-emerald-600" /><h2 className="font-bold text-slate-800">Payment Summary</h2></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex justify-between pb-3 border-b">
                  <span className="text-xs font-bold text-slate-400 uppercase">Payment Mode</span>
                  <span className="text-sm font-bold text-slate-800 uppercase">{order.payment_mode || 'COD'}</span>
                </div>
                <div className="flex justify-between pb-3 border-b">
                  <span className="text-xs font-bold text-slate-400 uppercase">Payment Status</span>
                  <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded-full', order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
                    {order.payment_status || 'Pending'}
                  </span>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-5 space-y-3">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-slate-500 font-bold uppercase">Subtotal</span>
                  <span>₹{(order.subtotal || order.net_amount || order.total_amount || 0).toLocaleString()}</span>
                </div>
                {(order.discount_amount ?? 0) > 0 && (
                  <div className="flex justify-between text-xs text-emerald-600">
                    <span className="font-bold uppercase">Discount</span>
                    <span className="font-bold">-₹{order.discount_amount.toLocaleString()}</span>
                  </div>
                )}
                <div className="pt-3 border-t flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-800 uppercase">Total Amount</span>
                  <span className="text-xl font-black text-slate-900">₹{(order.net_amount || order.total_amount || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-6"><User className="h-5 w-5 text-blue-600" /><h2 className="font-bold text-slate-800">Customer Details</h2></div>
            <div className="space-y-5">
              <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Shop Name</p><p className="text-sm font-bold text-slate-800">{customer?.shop_name || 'N/A'}</p></div>
              <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Contact</p><p className="text-sm font-medium text-slate-700">{customer?.name}</p></div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Phone</p>
                <a href={`tel:${customer?.phone}`} className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:underline"><Phone className="h-3.5 w-3.5" />{customer?.phone}</a>
              </div>
              <div className="pt-4 border-t">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2"><MapPin className="h-3 w-3 inline mr-1" />Delivery Address</p>
                <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">{customer?.address || 'No address provided'}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4"><Truck className="h-5 w-5 text-blue-600" /><h2 className="font-bold text-slate-800">Logistics Info</h2></div>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Hub</span>
                <span className="font-bold flex items-center gap-1"><Building2 className="h-3 w-3 text-slate-400" />{order.hub_id ? `Hub ${order.hub_id.slice(0, 4)}` : 'Auto'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Delivery Date</span>
                <span className="font-bold">{format(new Date(order.order_date || order.created_at), 'dd MMM yyyy')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {status !== 'delivered' && status !== 'cancelled' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-2xl bg-slate-900 text-white rounded-2xl shadow-2xl p-4 flex items-center justify-between gap-4 border border-white/10">
          <div className="flex items-center gap-3">
            <button onClick={() => sendWhatsApp.mutate()} disabled={sendWhatsApp.isPending}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-bold disabled:opacity-50">
              <MessageCircle className="h-4 w-4" /> Notify Customer
            </button>
            <button onClick={() => updateStatus.mutate('cancelled')} disabled={updateStatus.isPending}
              className="px-4 py-2.5 bg-slate-800 hover:bg-red-900 rounded-xl text-xs font-bold text-slate-400 hover:text-white">
              Cancel Order
            </button>
          </div>
          {nextStatus && (
            <button onClick={() => updateStatus.mutate(nextStatus)} disabled={updateStatus.isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 py-2.5 rounded-xl text-xs font-bold">
              {updateStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Mark as {STATUS_CONFIG[nextStatus]?.label || nextStatus}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
