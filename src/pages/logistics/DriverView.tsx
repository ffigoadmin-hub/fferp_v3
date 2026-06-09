import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  MapPin, CheckCircle2, XCircle, Camera, DollarSign,
  Navigation, Package, Phone, AlertCircle
} from 'lucide-react';

type DeliveryStatus = 'pending' | 'delivered' | 'partial' | 'rejected' | 'returned';

const STATUS_CONFIG: Record<DeliveryStatus, { label: string; color: string; icon: React.ComponentType<any> }> = {
  pending:   { label: 'Pending',   color: 'bg-gray-100 text-gray-600',     icon: Package },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-700',   icon: CheckCircle2 },
  partial:   { label: 'Partial',   color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
  rejected:  { label: 'Rejected',  color: 'bg-red-100 text-red-600',       icon: XCircle },
  returned:  { label: 'Returned',  color: 'bg-orange-100 text-orange-700', icon: XCircle },
};

interface DeliveryStop {
  id: string;
  order_id: string;
  sequence_no: number;
  delivery_status: DeliveryStatus;
  order: {
    order_number: string;
    customer: { shop_name: string; phone: string; address: string };
    net_amount: number;
    payment_mode: string;
    items: { product: { name: string }; qty_kg: number }[];
  };
}

export default function DriverView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [activeStop, setActiveStop] = useState<DeliveryStop | null>(null);
  const [cashInput, setCashInput] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');

  const { data: trip } = useQuery({
    queryKey: ['driver-trip', user?.id, today],
    queryFn: async () => {
      const { data } = await supabase
        .from('logistics_trips')
        .select('*')
        .eq('driver_id', user!.id)
        .eq('trip_date', today)
        .in('status', ['planned', 'in_progress'])
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { data: stops = [] } = useQuery({
    queryKey: ['trip-stops', (trip as any)?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('trip_orders')
        .select(`
          *,
          order:sales_orders(
            order_number, net_amount, payment_mode,
            customer:customers(shop_name, phone, address),
            items:sales_order_items(qty_kg, product:products(name))
          )
        `)
        .eq('trip_id', (trip as any)!.id)
        .order('sequence_no');
      return (data ?? []) as DeliveryStop[];
    },
    enabled: !!(trip as any)?.id,
  });

  const markDelivery = useMutation({
    mutationFn: async ({
      stopId, status, cash, notes
    }: { stopId: string; status: DeliveryStatus; cash: number; notes: string }) => {
      const { error } = await supabase
        .from('trip_orders')
        .update({
          delivery_status: status,
          delivered_at: new Date().toISOString(),
          cash_collected: cash,
          driver_notes: notes,
        })
        .eq('id', stopId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Delivery status updated!');
      setActiveStop(null);
      setCashInput('');
      setDeliveryNote('');
      qc.invalidateQueries({ queryKey: ['trip-stops'] });
      qc.invalidateQueries({ queryKey: ['driver-trip'] });
    },
    onError: () => toast.error('Failed to update delivery'),
  });

  const delivered = stops.filter(s => s.delivery_status === 'delivered').length;
  const pending   = stops.filter(s => s.delivery_status === 'pending').length;
  const cashCollected = stops.reduce((sum, s) => sum + (Number((s as any).cash_collected) || 0), 0);

  if (!trip) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Package className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700">No active trip today</h2>
        <p className="text-sm text-gray-500 mt-1">Your trip will appear here once assigned by the warehouse manager</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="bg-green-600 rounded-xl p-4 text-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-green-100">Trip</p>
            <p className="text-lg font-bold">{(trip as any).trip_number}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-green-100">Status</p>
            <p className="text-sm font-semibold capitalize">{(trip as any).status.replace('_', ' ')}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-white/10 rounded-lg p-2">
            <p className="text-lg font-bold">{stops.length}</p>
            <p className="text-xs text-green-100">Total Stops</p>
          </div>
          <div className="bg-white/10 rounded-lg p-2">
            <p className="text-lg font-bold">{delivered}</p>
            <p className="text-xs text-green-100">Delivered</p>
          </div>
          <div className="bg-white/10 rounded-lg p-2">
            <p className="text-lg font-bold">₹{cashCollected.toLocaleString('en-IN')}</p>
            <p className="text-xs text-green-100">Cash Collected</p>
          </div>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{delivered} of {stops.length} delivered</span>
          <span>{pending} remaining</span>
        </div>
        <div className="h-2 rounded-full bg-gray-200">
          <div
            className="h-2 rounded-full bg-green-500 transition-all"
            style={{ width: `${stops.length > 0 ? (delivered / stops.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {stops.map((stop, idx) => {
          const cfg = STATUS_CONFIG[stop.delivery_status];
          const StatusIcon = cfg.icon;
          const isCOD = stop.order?.payment_mode === 'cod';

          return (
            <div
              key={stop.id}
              className={`bg-white rounded-xl border-2 transition-all ${
                stop.delivery_status === 'delivered'
                  ? 'border-green-200 opacity-75'
                  : stop.delivery_status === 'pending'
                  ? 'border-gray-200'
                  : 'border-orange-200'
              }`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{stop.order?.customer?.shop_name}</p>
                      <p className="text-xs text-gray-500">{stop.order?.order_number}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                  <MapPin className="h-3 w-3" />
                  <span>{stop.order?.customer?.address}</span>
                </div>

                <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2 mb-3">
                  {stop.order?.items?.slice(0, 3).map((item: any, i: number) => (
                    <span key={i}>{item.product?.name} ({item.qty_kg}kg){i < stop.order.items.length - 1 ? ', ' : ''}</span>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <span className={`text-sm font-bold ${isCOD ? 'text-green-700' : 'text-gray-700'}`}>
                    ₹{stop.order?.net_amount?.toLocaleString('en-IN')}
                    {isCOD ? ' COD' : ' CREDIT'}
                  </span>

                  <div className="flex gap-2">
                    <a
                      href={`tel:${stop.order?.customer?.phone}`}
                      className="flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1.5 text-xs font-medium text-blue-700"
                    >
                      <Phone className="h-3 w-3" /> Call
                    </a>
                    {stop.delivery_status === 'pending' && (
                      <button
                        onClick={() => setActiveStop(stop)}
                        className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                      >
                        <Navigation className="h-3 w-3" /> Update
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {activeStop && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50">
          <div className="w-full bg-white rounded-t-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">{activeStop.order?.customer?.shop_name}</h3>
              <button onClick={() => setActiveStop(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <p className="text-sm text-gray-600">{activeStop.order?.order_number} · ₹{activeStop.order?.net_amount}</p>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Delivery Status</p>
              <div className="grid grid-cols-2 gap-2">
                {(['delivered', 'partial', 'rejected', 'returned'] as DeliveryStatus[]).map(status => {
                  const cfg = STATUS_CONFIG[status];
                  return (
                    <button
                      key={status}
                      onClick={() => markDelivery.mutate({
                        stopId: activeStop.id,
                        status,
                        cash: parseFloat(cashInput) || 0,
                        notes: deliveryNote,
                      })}
                      disabled={markDelivery.isPending}
                      className={`rounded-xl border-2 p-3 text-center transition-all hover:opacity-90 ${cfg.color} border-current disabled:opacity-50`}
                    >
                      <p className="font-semibold text-sm">{cfg.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {activeStop.order?.payment_mode === 'cod' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <DollarSign className="inline h-3 w-3" /> Cash Collected (₹)
                </label>
                <input
                  type="number"
                  value={cashInput}
                  onChange={e => setCashInput(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder={`Expected: ₹${activeStop.order?.net_amount}`}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea
                value={deliveryNote}
                onChange={e => setDeliveryNote(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                placeholder="Any issues, special notes..."
              />
            </div>

            <button className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 p-3 text-sm text-gray-500 hover:border-green-400">
              <Camera className="h-4 w-4" /> Take Delivery Photo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
