import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  ChevronLeft, Truck, ClipboardCheck, CheckCircle2,
  Package, ArrowRight, RefreshCw,
} from 'lucide-react';

const STATUS_COLOR: Record<string, string> = {
  arrived:   'bg-amber-100 text-amber-700',
  in_qc:     'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
};

export default function TransitRecordDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: transit, isLoading } = useQuery({
    queryKey: ['transit-record', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transit_records')
        .select(`
          id, vehicle_type, driver_name, vehicle_number,
          transit_cost, status, arrived_at, notes, created_at,
          po:purchase_orders(
            id, po_number, total_amount, status,
            vendor:vendors(name, phone, contact_person),
            items:purchase_order_items(id, item_name, quantity, unit, unit_price, total_price)
          ),
          creator:profiles(full_name)
        `)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase
        .from('transit_records')
        .update({ status: newStatus })
        .eq('id', id!);
      if (error) throw error;
    },
    onSuccess: (_, newStatus) => {
      toast.success(`Status updated to ${newStatus}`);
      queryClient.invalidateQueries({ queryKey: ['transit-record', id] });
      queryClient.invalidateQueries({ queryKey: ['transit-today'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!transit) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Transit record not found</p>
        <Link to="/transit" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  const po = (transit as any).po;
  const creator = (transit as any).creator;
  const items: any[] = po?.items ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-12 pt-4">

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft className="h-5 w-5 text-slate-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-[20px] font-bold text-slate-800">Transit Record</h1>
          <p className="text-[13px] text-slate-400">
            Logged {transit.arrived_at ? format(new Date(transit.arrived_at), 'd MMM yyyy · hh:mm a') : '—'}
          </p>
        </div>
        <span className={`text-xs px-3 py-1 rounded-full font-semibold capitalize ${STATUS_COLOR[(transit as any).status] ?? 'bg-gray-100 text-gray-600'}`}>
          {(transit as any).status === 'in_qc' ? 'In QC' : (transit as any).status}
        </span>
      </div>

      {/* PO Info Card */}
      {po && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Purchase Order</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-400">PO Number</p>
              <p className="font-bold text-blue-700">{po.po_number}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Vendor</p>
              <p className="font-semibold text-slate-800">{po.vendor?.name ?? '—'}</p>
              {po.vendor?.phone && <p className="text-xs text-slate-400">{po.vendor.phone}</p>}
            </div>
            <div>
              <p className="text-xs text-slate-400">PO Amount</p>
              <p className="font-bold text-slate-800">₹{Number(po.total_amount || 0).toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">PO Status</p>
              <span className="text-xs font-semibold capitalize text-slate-700 bg-gray-100 px-2 py-0.5 rounded-full">
                {po.status}
              </span>
            </div>
          </div>

          {/* PO Items */}
          {items.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Items</p>
              <div className="space-y-2">
                {items.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">{item.item_name}</span>
                    <span className="text-sm font-semibold text-slate-800">
                      {Number(item.quantity)} {item.unit} · ₹{Number(item.total_price || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Vehicle Details */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Truck className="h-4 w-4 text-slate-400" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Vehicle Details</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Vehicle Type',   value: (transit as any).vehicle_type === 'own' ? 'Own Vehicle' : 'Hired Vehicle' },
            { label: 'Vehicle Number', value: (transit as any).vehicle_number || '—' },
            { label: 'Driver',         value: (transit as any).driver_name || '—' },
            { label: 'Transit Cost',   value: `₹${Number((transit as any).transit_cost || 0).toLocaleString('en-IN')}` },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-slate-400">{label}</p>
              <p className="font-semibold text-slate-800 text-sm">{value}</p>
            </div>
          ))}
        </div>
        {(transit as any).notes && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-slate-400">Notes</p>
            <p className="text-sm text-slate-700 mt-0.5">{(transit as any).notes}</p>
          </div>
        )}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-slate-400">Logged By</p>
          <p className="text-sm text-slate-700">{creator?.full_name ?? 'System'}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Actions</p>

        {(transit as any).status === 'arrived' && (
          <Link
            to={`/warehouse/qc?transit_id=${id}&po_id=${po?.id ?? ''}`}
            onClick={() => updateStatus.mutate('in_qc')}
            className="flex items-center justify-between w-full bg-blue-600 text-white rounded-xl px-5 py-3.5 font-semibold hover:bg-blue-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Start QC Inspection
            </div>
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}

        {(transit as any).status === 'in_qc' && (
          <button
            onClick={() => updateStatus.mutate('completed')}
            disabled={updateStatus.isPending}
            className="flex items-center justify-between w-full bg-green-600 text-white rounded-xl px-5 py-3.5 font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Mark Completed
            </div>
            {updateStatus.isPending && <RefreshCw className="h-4 w-4 animate-spin" />}
          </button>
        )}

        {(transit as any).status === 'completed' && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-5 py-3.5">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-semibold text-green-700 text-sm">Transit Completed</p>
              <p className="text-xs text-green-500">All steps done for this arrival</p>
            </div>
          </div>
        )}

        <Link
          to="/warehouse/inventory"
          className="flex items-center gap-2 w-full border border-gray-200 rounded-xl px-5 py-3 text-sm font-medium text-slate-600 hover:bg-gray-50 transition-colors"
        >
          <Package className="h-4 w-4 text-slate-400" />
          View Inventory
        </Link>
      </div>

      <div className="text-center">
        <Link to="/transit" className="text-sm text-blue-600 hover:underline">
          ← Back to Transit Dashboard
        </Link>
      </div>
    </div>
  );
}
