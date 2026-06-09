import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import {
  ArrowLeft, Truck, MapPin, Phone,
  CheckCircle2, Clock, AlertCircle, Loader2, Navigation,
  RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';

const DELIVERY_STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  pending:   { bg: 'bg-gray-100',   text: 'text-gray-600',  icon: <Clock className="h-3.5 w-3.5" /> },
  delivered: { bg: 'bg-green-100',  text: 'text-green-700', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  returned:  { bg: 'bg-red-100',    text: 'text-red-700',   icon: <RotateCcw className="h-3.5 w-3.5" /> },
  partial:   { bg: 'bg-amber-100',  text: 'text-amber-700', icon: <AlertCircle className="h-3.5 w-3.5" /> },
};

export default function TripDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: trip, isLoading } = useQuery({
    queryKey: ['trip-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('logistics_trips')
        .select(`
          *,
          trip_orders(
            id, sequence_no, delivery_status, delivered_at, driver_notes,
            sales_orders(
              id, order_number, total_amount, payment_mode, payment_status,
              customers(id, shop_name, name, phone, address)
            )
          )
        `)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const updateTripStatus = useMutation({
    mutationFn: async (status: string) => {
      const update: any = { status };
      if (status === 'in_progress') update.started_at = new Date().toISOString();
      if (status === 'completed') update.completed_at = new Date().toISOString();
      const { error } = await supabase.from('logistics_trips').update(update).eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Trip status updated');
      qc.invalidateQueries({ queryKey: ['trip-detail', id] });
      qc.invalidateQueries({ queryKey: ['trips-today'] });
    },
    onError: () => toast.error('Failed to update trip'),
  });

  const updateStop = useMutation({
    mutationFn: async ({ stopId, status, notes }: { stopId: string; status: string; notes?: string }) => {
      const { error } = await supabase
        .from('trip_orders')
        .update({ delivery_status: status, delivered_at: new Date().toISOString(), driver_notes: notes || null })
        .eq('id', stopId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Delivery stop updated');
      qc.invalidateQueries({ queryKey: ['trip-detail', id] });
    },
    onError: () => toast.error('Failed to update stop'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-green-600" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p className="text-gray-600 font-medium">Trip not found</p>
        <button onClick={() => navigate(-1)} className="text-green-600 underline text-sm">Go back</button>
      </div>
    );
  }

  const stops = ((trip as any).trip_orders || []).sort((a: any, b: any) => (a.sequence_no || 0) - (b.sequence_no || 0));
  const delivered = stops.filter((s: any) => s.delivery_status === 'delivered').length;
  const pct = stops.length > 0 ? Math.round((delivered / stops.length) * 100) : 0;

  const tripTotalCollection = stops
    .filter((s: any) => s.delivery_status === 'delivered')
    .reduce((sum: number, s: any) => sum + ((s.sales_orders?.total_amount) || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="bg-white border-b px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Trip #{(trip as any).trip_number || id?.slice(0, 8)}</h1>
            <p className="text-sm text-gray-500">
              {(trip as any).vehicle_number} · {(trip as any).driver_name || 'Driver'}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
            (trip as any).status === 'completed' ? 'bg-green-100 text-green-700' :
            (trip as any).status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {(trip as any).status}
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>{delivered}/{stops.length} delivered</span>
            <span>{pct}% complete</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-0 border-b bg-white">
        {[
          { label: 'Stops', value: stops.length },
          { label: 'Delivered', value: delivered },
          { label: 'Collected', value: `₹${tripTotalCollection.toLocaleString()}` },
        ].map((stat, i) => (
          <div key={i} className={`text-center py-3 ${i < 2 ? 'border-r' : ''}`}>
            <div className="text-lg font-bold text-gray-900">{stat.value}</div>
            <div className="text-xs text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="p-4 space-y-3">
        <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Delivery Stops</div>

        {stops.map((stop: any, idx: number) => {
          const order = stop.sales_orders;
          const customer = order?.customers;
          const stopStyle = DELIVERY_STATUS_STYLES[stop.delivery_status] || DELIVERY_STATUS_STYLES['pending'];

          return (
            <div key={stop.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                      {stop.stop_order || idx + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">
                        {customer?.shop_name || customer?.name}
                      </div>
                      <div className="text-xs text-gray-400">{order?.order_number}</div>
                    </div>
                  </div>
                  <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${stopStyle.bg} ${stopStyle.text}`}>
                    {stopStyle.icon}
                    {stop.delivery_status.charAt(0).toUpperCase() + stop.delivery_status.slice(1)}
                  </span>
                </div>

                {customer?.address && (
                  <div className="flex items-start gap-1 text-xs text-gray-500 mb-2">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-red-400" />
                    {customer.address}
                  </div>
                )}

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">₹{(order?.total_amount || 0).toLocaleString()} · {order?.payment_mode?.toUpperCase()}</span>
                  <div className="flex gap-2">
                    {customer?.phone && (
                      <a href={`tel:${customer.phone}`} className="p-1.5 bg-gray-100 rounded-lg text-gray-600">
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(customer?.address || '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 bg-blue-50 rounded-lg text-blue-600"
                    >
                      <Navigation className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>

                {stop.delivery_status === 'pending' && (trip as any).status === 'in_progress' && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => updateStop.mutate({ stopId: stop.id, status: 'delivered' })}
                      className="flex-1 flex items-center justify-center gap-1 bg-green-600 text-white py-2 rounded-lg text-xs font-semibold"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Delivered
                    </button>
                    <button
                      onClick={() => updateStop.mutate({ stopId: stop.id, status: 'returned', notes: 'Customer unavailable' })}
                      className="flex-1 flex items-center justify-center gap-1 bg-red-50 text-red-600 border border-red-200 py-2 rounded-lg text-xs font-semibold"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Return
                    </button>
                  </div>
                )}

                {stop.driver_notes && (
                  <div className="mt-2 text-xs text-gray-500 italic">{stop.driver_notes}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {(trip as any).status === 'planned' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-3">
          <button
            onClick={() => updateTripStatus.mutate('in_progress')}
            disabled={updateTripStatus.isPending}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-semibold"
          >
            {updateTripStatus.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Truck className="h-5 w-5" />}
            Start Trip
          </button>
        </div>
      )}

      {(trip as any).status === 'in_progress' && delivered === stops.length && stops.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-3">
          <button
            onClick={() => updateTripStatus.mutate('completed')}
            disabled={updateTripStatus.isPending}
            className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl font-semibold"
          >
            {updateTripStatus.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
            Complete Trip
          </button>
        </div>
      )}
    </div>
  );
}
