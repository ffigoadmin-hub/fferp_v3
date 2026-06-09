import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ArrowLeft, Download, Search, RefreshCw, Truck, CheckCircle2, ChevronDown, ChevronUp, IndianRupee } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

const DELIVERY_COLORS: Record<string, string> = {
  delivered:  'bg-green-100 text-green-700',
  pending:    'bg-amber-100 text-amber-700',
  failed:     'bg-red-100 text-red-600',
  partial:    'bg-orange-100 text-orange-700',
  returned:   'bg-purple-100 text-purple-700',
};

const TRIP_COLORS: Record<string, string> = {
  pending:    'bg-amber-100 text-amber-700',
  active:     'bg-blue-100 text-blue-700',
  completed:  'bg-green-100 text-green-700',
  cancelled:  'bg-red-100 text-red-600',
};

export default function DeliveryReportPage() {
  const navigate = useNavigate();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedTrip, setExpandedTrip] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const { data: trips = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['delivery-report', date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('logistics_trips')
        .select(`
          id, trip_number, status, vehicle_number, trip_date,
          orders:trip_orders(
            id, delivery_status, cash_collected, driver_notes,
            order:sales_orders(order_number, net_amount, customer:customers(shop_name, area))
          )
        `)
        .eq('trip_date', date)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return trips.filter((t: any) => {
      const matchSearch = !q ||
        (t.trip_number || '').toLowerCase().includes(q) ||
        (t.vehicle_number || '').toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [trips, search, statusFilter]);

  const summary = useMemo(() => {
    const allStops = filtered.flatMap((t: any) => t.orders ?? []);
    return {
      trips:      filtered.length,
      stops:      allStops.length,
      delivered:  allStops.filter((s: any) => s.delivery_status === 'delivered').length,
      cashTotal:  allStops.reduce((sum: number, s: any) => sum + (Number(s.cash_collected) || 0), 0),
    };
  }, [filtered]);

  const downloadXLSX = async () => {
    if (!filtered.length) { toast.error('No data to download'); return; }
    setDownloading(true);
    try {
      const rows: any[] = [];
      filtered.forEach((trip: any) => {
        (trip.orders ?? []).forEach((stop: any, idx: number) => {
          rows.push({
            'Trip #':           idx === 0 ? trip.trip_number : '',
            'Vehicle':          idx === 0 ? trip.vehicle_number : '',
            'Trip Status':      idx === 0 ? trip.status : '',
            'Customer':         stop.order?.customer?.shop_name || '—',
            'Area':             stop.order?.customer?.area || '—',
            'Order #':          stop.order?.order_number || '—',
            'Bill Amount (₹)': stop.order?.net_amount || 0,
            'Delivery Status':  stop.delivery_status,
            'Cash Collected (₹)': stop.cash_collected ?? 0,
            'Notes':            stop.driver_notes || '',
          });
        });
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [12,12,12,20,14,12,14,14,16,20].map(w => ({ wch: w }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Deliveries');
      XLSX.writeFile(wb, `FF_Delivery_Report_${date}.xlsx`);
      toast.success('Delivery report downloaded!');
    } catch (e: any) { toast.error(e.message); }
    finally { setDownloading(false); }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/reports')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 font-medium">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <div>
            <h1 className="text-xl font-black text-gray-900">Delivery Report</h1>
            <p className="text-xs text-gray-400 mt-0.5">Trip-wise delivery status · cash collected · returns</p>
          </div>
        </div>
        <button onClick={downloadXLSX} disabled={downloading || !filtered.length}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-bold shadow-sm disabled:opacity-50">
          {downloading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Download Excel
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50" />
          </div>
          <div className="flex-1 min-w-[180px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search trip # or vehicle..."
              className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50">
            <option value="all">All Status</option>
            {['pending','active','completed','cancelled'].map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>
            ))}
          </select>
          <button onClick={() => refetch()} disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Trips',   value: summary.trips,                          icon: Truck,        color: 'bg-purple-50 text-purple-600' },
          { label: 'Total Stops',   value: summary.stops,                          icon: Truck,        color: 'bg-blue-50 text-blue-600' },
          { label: 'Delivered',     value: summary.delivered,                      icon: CheckCircle2, color: 'bg-green-50 text-green-600' },
          { label: 'Cash Collected',value: `₹${summary.cashTotal.toLocaleString()}`,icon: IndianRupee, color: 'bg-amber-50 text-amber-600' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.color}`}>
              <c.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xl font-black text-gray-900">{c.value}</p>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-black text-gray-900">Trips — {format(new Date(date + 'T00:00:00'), 'dd MMMM yyyy')}</p>
          <p className="text-xs text-gray-400">{filtered.length} trips</p>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><RefreshCw className="w-6 h-6 animate-spin text-purple-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Truck className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-semibold">No trips found</p>
            <p className="text-xs mt-1">Try a different date</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-[11px] font-black uppercase tracking-wider text-gray-400 w-8"></th>
                  {['Trip #','Vehicle','Stops','Delivered','Cash Collected','Status'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-[11px] font-black uppercase tracking-wider text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((trip: any) => {
                  const stops = trip.orders ?? [];
                  const tripCash = stops.reduce((s: number, o: any) => s + (Number(o.cash_collected) || 0), 0);
                  const delivered = stops.filter((o: any) => o.delivery_status === 'delivered').length;
                  const isExpanded = expandedTrip === trip.id;
                  return (
                    <>
                      <tr key={trip.id} className={`hover:bg-gray-50 cursor-pointer transition-colors ${isExpanded ? 'bg-purple-50/40' : ''}`}
                        onClick={() => setExpandedTrip(isExpanded ? null : trip.id)}>
                        <td className="py-3 px-4 text-gray-400">
                          {stops.length > 0 ? isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" /> : null}
                        </td>
                        <td className="py-3 px-4 font-black font-mono text-gray-900">{trip.trip_number}</td>
                        <td className="py-3 px-4 text-gray-600">{trip.vehicle_number || '—'}</td>
                        <td className="py-3 px-4 text-gray-600">{stops.length}</td>
                        <td className="py-3 px-4 text-gray-600">{delivered}/{stops.length}</td>
                        <td className="py-3 px-4 font-black text-gray-900">₹{tripCash.toLocaleString()}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${TRIP_COLORS[trip.status] || 'bg-gray-100 text-gray-500'}`}>
                            {trip.status}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && stops.length > 0 && (
                        <tr key={`${trip.id}-exp`}>
                          <td colSpan={7} className="px-4 pb-4 pt-0 bg-purple-50/20">
                            <div className="ml-8 mt-2 rounded-xl border border-purple-100 overflow-hidden">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-purple-50 border-b border-purple-100">
                                    {['Customer','Area','Order #','Bill (₹)','Status','Cash (₹)','Notes'].map(h => (
                                      <th key={h} className="text-left py-2 px-3 font-black uppercase tracking-wider text-purple-700">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-purple-50">
                                  {stops.map((stop: any) => (
                                    <tr key={stop.id} className="bg-white">
                                      <td className="py-2 px-3 font-semibold text-gray-800">{stop.order?.customer?.shop_name || '—'}</td>
                                      <td className="py-2 px-3 text-gray-500">{stop.order?.customer?.area || '—'}</td>
                                      <td className="py-2 px-3 font-mono text-gray-700">{stop.order?.order_number || '—'}</td>
                                      <td className="py-2 px-3 font-bold text-gray-900">₹{Number(stop.order?.net_amount || 0).toLocaleString()}</td>
                                      <td className="py-2 px-3">
                                        <span className={`px-1.5 py-0.5 rounded-full font-bold capitalize ${DELIVERY_COLORS[stop.delivery_status] || 'bg-gray-100 text-gray-500'}`}>
                                          {stop.delivery_status}
                                        </span>
                                      </td>
                                      <td className="py-2 px-3 font-bold text-gray-900">₹{Number(stop.cash_collected || 0).toLocaleString()}</td>
                                      <td className="py-2 px-3 text-gray-400">{stop.driver_notes || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
