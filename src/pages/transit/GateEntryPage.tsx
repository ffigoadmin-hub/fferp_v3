import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Truck, QrCode, ChevronLeft, CheckCircle2,
  Package, ArrowRight, RefreshCw,
} from 'lucide-react';

interface GateEntryForm {
  po_id:          string;
  vehicle_type:   'own' | 'hired';
  driver_name:    string;
  vehicle_number: string;
  transit_cost:   number;
  notes:          string;
}

// Simple QR/manual PO scanner section
function POScanSection({ onSelect }: { onSelect: (po: any) => void }) {
  const [search, setSearch] = useState('');

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['po-search', search],
    enabled: search.length >= 3,
    queryFn: async () => {
      const { data } = await supabase
        .from('purchase_orders')
        .select('id, po_number, total_amount, vendor:vendors(name), status')
        .ilike('po_number', `%${search}%`)
        .in('status', ['ordered', 'approved'])
        .limit(8);
      return data ?? [];
    },
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="p-2 bg-blue-50 rounded-lg">
          <QrCode className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800 text-sm">Scan / Search PO</h3>
          <p className="text-xs text-slate-400">Type PO number or scan QR code</p>
        </div>
      </div>
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Type PO number (e.g. PO-2026-…)"
        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        autoFocus
      />
      {isFetching && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <RefreshCw className="h-3 w-3 animate-spin" /> Searching…
        </div>
      )}
      {(results as any[]).length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
          {(results as any[]).map((po: any) => (
            <button
              key={po.id}
              type="button"
              onClick={() => { onSelect(po); setSearch(''); }}
              className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-semibold text-slate-800">{po.po_number}</p>
                <p className="text-xs text-slate-400">{po.vendor?.name} · ₹{Number(po.total_amount || 0).toLocaleString('en-IN')}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                po.status === 'ordered' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
              }`}>{po.status}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GateEntryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [submitted, setSubmitted] = useState(false);
  const [createdRecord, setCreatedRecord] = useState<any>(null);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<GateEntryForm>({
    defaultValues: {
      vehicle_type: 'own',
      transit_cost: 0,
    },
  });

  const vehicleType = watch('vehicle_type');

  // Pre-select PO from URL param
  const preselectedPoId = searchParams.get('po_id');
  const { data: preselectedPO } = useQuery({
    queryKey: ['po-preselect', preselectedPoId],
    enabled: !!preselectedPoId && !selectedPO,
    queryFn: async () => {
      const { data } = await supabase
        .from('purchase_orders')
        .select('id, po_number, total_amount, vendor:vendors(name), status')
        .eq('id', preselectedPoId!)
        .single();
      return data;
    },
  });

  useEffect(() => {
    if (preselectedPO && !selectedPO) {
      setSelectedPO(preselectedPO);
      setValue('po_id', preselectedPO.id);
    }
  }, [preselectedPO]);

  const handlePOSelect = (po: any) => {
    setSelectedPO(po);
    setValue('po_id', po.id);
  };

  const createTransit = useMutation({
    mutationFn: async (data: GateEntryForm) => {
      const hubId = (user as any)?.hub_id ?? null;

      // Create transit record
      const { data: record, error } = await supabase
        .from('transit_records')
        .insert({
          po_id:          data.po_id || null,
          hub_id:         hubId,
          vehicle_type:   data.vehicle_type,
          driver_name:    data.driver_name || null,
          vehicle_number: data.vehicle_number || null,
          transit_cost:   data.transit_cost || 0,
          notes:          data.notes || null,
          status:         'arrived',
          created_by:     user!.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Update PO status to 'arrived'
      if (data.po_id) {
        await supabase
          .from('purchase_orders')
          .update({ status: 'received' })
          .eq('id', data.po_id)
          .eq('status', 'ordered'); // only if still 'ordered'
      }

      return record;
    },
    onSuccess: (record) => {
      toast.success('Arrival logged successfully!');
      queryClient.invalidateQueries({ queryKey: ['transit-today'] });
      queryClient.invalidateQueries({ queryKey: ['expected-arrivals'] });
      setCreatedRecord(record);
      setSubmitted(true);
      reset();
    },
    onError: (err: Error) => {
      toast.error(`Failed: ${err.message}`);
    },
  });

  const onSubmit = (data: GateEntryForm) => {
    if (!data.po_id && !selectedPO) {
      toast.error('Please select a Purchase Order first');
      return;
    }
    createTransit.mutate(data);
  };

  // ── Success Screen ────────────────────────────────────────
  if (submitted && createdRecord) {
    return (
      <div className="max-w-lg mx-auto pt-8">
        <div className="bg-white rounded-2xl border-2 border-green-200 p-8 text-center">
          <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-9 w-9 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-1">Arrival Logged</h2>
          {selectedPO && (
            <p className="text-sm text-slate-500 mb-6">
              {selectedPO.po_number} · {selectedPO.vendor?.name}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 mb-6 text-left">
            {[
              { label: 'Vehicle',  value: createdRecord.vehicle_number || '—' },
              { label: 'Driver',   value: createdRecord.driver_name || '—' },
              { label: 'Type',     value: createdRecord.vehicle_type === 'own' ? 'Own Vehicle' : 'Hired Vehicle' },
              { label: 'Cost',     value: `₹${Number(createdRecord.transit_cost || 0).toLocaleString('en-IN')}` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400">{label}</p>
                <p className="font-semibold text-slate-800 text-sm">{value}</p>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <Link
              to="/warehouse/qc"
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              <ArrowRight className="h-4 w-4" /> Start QC Inspection
            </Link>
            <button
              onClick={() => { setSubmitted(false); setCreatedRecord(null); setSelectedPO(null); }}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-gray-50 transition-colors"
            >
              Log Another Arrival
            </button>
            <Link
              to="/transit"
              className="block text-sm text-blue-600 hover:underline"
            >
              ← Back to Transit Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Entry Form ────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12 pt-4">

      {/* Page Header */}
      <div className="flex items-center gap-3 mb-2">
        <Link to="/transit" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft className="h-5 w-5 text-slate-500" />
        </Link>
        <div>
          <h1 className="text-[20px] font-bold text-slate-800">Gate Entry</h1>
          <p className="text-[13px] text-slate-400">Log a vendor vehicle arrival</p>
        </div>
      </div>

      {/* PO Scanner */}
      <POScanSection onSelect={handlePOSelect} />

      {/* Selected PO Card */}
      {selectedPO && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-blue-500 uppercase tracking-wide mb-0.5">Selected PO</p>
            <p className="font-bold text-slate-800">{selectedPO.po_number}</p>
            <p className="text-sm text-slate-500">{selectedPO.vendor?.name} · ₹{Number(selectedPO.total_amount || 0).toLocaleString('en-IN')}</p>
          </div>
          <button
            type="button"
            onClick={() => { setSelectedPO(null); setValue('po_id', ''); }}
            className="text-xs text-blue-600 hover:underline"
          >
            Change
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <input type="hidden" {...register('po_id')} />

        {/* Vehicle Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Truck className="h-4 w-4 text-slate-500" />
            <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">Vehicle Details</h3>
          </div>

          {/* Vehicle Type Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Type *</label>
            <div className="grid grid-cols-2 gap-3">
              {(['own', 'hired'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setValue('vehicle_type', type)}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${
                    vehicleType === type
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Truck className={`h-5 w-5 mb-1 ${vehicleType === type ? 'text-blue-600' : 'text-gray-400'}`} />
                  <p className="font-semibold text-sm capitalize">{type === 'own' ? 'Own Vehicle' : 'Hired Vehicle'}</p>
                  <p className={`text-xs mt-0.5 ${vehicleType === type ? 'text-blue-500' : 'text-gray-400'}`}>
                    {type === 'own' ? 'Company-owned fleet' : 'Third-party transport'}
                  </p>
                </button>
              ))}
            </div>
            <input type="hidden" {...register('vehicle_type')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Number</label>
              <input
                {...register('vehicle_number')}
                placeholder="TN-XX-XXXX"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Driver Name</label>
              <input
                {...register('driver_name')}
                placeholder="Driver name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {vehicleType === 'hired' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transit Cost (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                {...register('transit_cost', { valueAsNumber: true })}
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
          <textarea
            {...register('notes')}
            rows={2}
            placeholder="Any remarks about the arrival…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={createTransit.isPending}
          className="w-full rounded-xl bg-blue-600 px-6 py-3.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {createTransit.isPending
            ? <><RefreshCw className="h-4 w-4 animate-spin" /> Logging…</>
            : <><CheckCircle2 className="h-4 w-4" /> Log Arrival</>}
        </button>
      </form>
    </div>
  );
}
