import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Truck, CheckCircle2, Clock, Plus, AlertCircle,
  ChevronRight, Navigation, RefreshCw
} from 'lucide-react';

const STATUS_COLOR: Record<string, string> = {
  planned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
};

export default function LogisticsDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [showNewTrip, setShowNewTrip] = useState(false);
  const [tripNumber, setTripNumber] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [driverNote, setDriverNote] = useState('');

  const { data: trips = [], isLoading, refetch } = useQuery({
    queryKey: ['trips-today', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('logistics_trips')
        .select('*')
        .eq('trip_date', today)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60000,
  });

  const { data: pendingOrders } = useQuery({
    queryKey: ['unassigned-orders', today],
    queryFn: async () => {
      const { count } = await supabase
        .from('sales_orders')
        .select('*', { count: 'exact', head: true })
        .eq('order_date', today)
        .eq('status', 'confirmed');
      return count ?? 0;
    },
  });

  const createTrip = useMutation({
    mutationFn: async () => {
      if (!vehicle.trim()) throw new Error('Vehicle number required');
      const { error } = await supabase.from('logistics_trips').insert({
        trip_number: tripNumber || `TRIP-${Date.now()}`,
        trip_date: today,
        vehicle_number: vehicle.trim(),
        status: 'scheduled',
        created_by: user!.id,
        notes: driverNote.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Trip created!');
      setShowNewTrip(false);
      setVehicle(''); setTripNumber(''); setDriverNote('');
      qc.invalidateQueries({ queryKey: ['trips-today'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateTripStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('logistics_trips').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trips-today'] });
    },
  });

  const active = (trips as any[]).filter(t => t.status === 'in_progress').length;
  const completed = (trips as any[]).filter(t => t.status === 'completed').length;
  const planned = (trips as any[]).filter(t => t.status === 'scheduled').length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 pt-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 tracking-tight">Logistics Dashboard</h1>
          <p className="text-[13px] text-slate-500">Today — {format(new Date(), 'd MMMM yyyy')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => refetch()}
            className="flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={() => setShowNewTrip(v => !v)}
            className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
            <Plus className="h-4 w-4" /> New Trip
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Active Trips', value: active, icon: Navigation, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Completed', value: completed, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Planned', value: planned, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Unassigned Orders', value: pendingOrders ?? 0, icon: AlertCircle, color: (pendingOrders ?? 0) > 0 ? 'text-red-600' : 'text-slate-600', bg: (pendingOrders ?? 0) > 0 ? 'bg-red-50' : 'bg-slate-50' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 pt-5 pb-4 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <div className={`p-2 ${card.bg} rounded-lg`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
              </div>
              <p className="text-[13px] text-slate-500 font-medium mb-1">{card.label}</p>
              <p className="text-[24px] font-bold text-slate-800 tracking-tight">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {showNewTrip && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h2 className="font-semibold text-gray-800">Create New Trip</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Trip Number</label>
              <input type="text" value={tripNumber} onChange={e => setTripNumber(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Auto-generated if empty" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle Number *</label>
              <input type="text" value={vehicle} onChange={e => setVehicle(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="e.g. TN09AB1234" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <input type="text" value={driverNote} onChange={e => setDriverNote(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Driver instructions..." />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowNewTrip(false)}
              className="flex-1 rounded-xl border border-gray-300 py-2 text-sm font-medium text-gray-700">Cancel</button>
            <button onClick={() => createTrip.mutate()} disabled={createTrip.isPending}
              className="flex-1 rounded-xl bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {createTrip.isPending ? 'Creating...' : 'Create Trip'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-8 text-sm text-gray-400">Loading trips...</div>
        ) : trips.length === 0 ? (
          <div className="text-center py-12">
            <Truck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No trips today yet</p>
            <button onClick={() => setShowNewTrip(true)}
              className="mt-3 text-sm text-green-600 hover:underline">Create first trip →</button>
          </div>
        ) : (
          (trips as any[]).map((trip: any) => {
            const totalStops = trip.trip_orders?.length ?? 0;
            const delivered = trip.trip_orders?.filter((o: any) => o.delivery_status === 'delivered').length ?? 0;
            const pct = totalStops > 0 ? Math.round((delivered / totalStops) * 100) : 0;

            return (
              <div key={trip.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-gray-500" />
                        <p className="font-semibold text-gray-800">{trip.trip_number}</p>
                        <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${STATUS_COLOR[trip.status]}`}>
                          {trip.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {trip.vehicle_number} · {totalStops} stops
                      </p>
                    </div>
                    <Link to={`/logistics/trip/${trip.id}`}
                      className="flex items-center gap-1 text-xs text-green-600 hover:underline font-medium">
                      View <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>

                  {totalStops > 0 && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{delivered}/{totalStops} delivered</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100">
                        <div className="h-2 rounded-full bg-green-500 transition-all"
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {trip.status === 'planned' && (
                      <button
                        onClick={() => updateTripStatus.mutate({ id: trip.id, status: 'in_progress' })}
                        className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600">
                        <Navigation className="h-3.5 w-3.5" /> Start Trip
                      </button>
                    )}
                    {trip.status === 'in_progress' && (
                      <button
                        onClick={() => updateTripStatus.mutate({ id: trip.id, status: 'completed' })}
                        className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Complete Trip
                      </button>
                    )}
                    {trip.notes && (
                      <span className="text-xs text-gray-500 flex items-center gap-1 ml-1">
                        <AlertCircle className="h-3.5 w-3.5" /> {trip.notes}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
