// @ts-nocheck
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Truck, ChevronLeft, Save, CheckCircle2, MapPin,
  Calculator, Calendar, Upload, User, X,
} from 'lucide-react';
import { format } from 'date-fns';

export default function FFTransportPaymentForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    driver_id:      '',
    hub_id:         (user as any)?.hub_id ?? '',
    trip_date:      format(new Date(), 'yyyy-MM-dd'),
    vehicle_number: '',
    origin:         '',
    destination:    '',
    km_covered:     '',
    base_amount:    '',
    toll_charges:   '',
    other_charges:  '',
  });
  const [step, setStep] = useState<'form' | 'done'>('form');
  const [createdId, setCreatedId] = useState('');
  const [billFile, setBillFile] = useState<File | null>(null);
  const [billPreview, setBillPreview] = useState('');
  const [tripProofFile, setTripProofFile] = useState<File | null>(null);
  const [tripProofPreview, setTripProofPreview] = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const uploadPhoto = async (file: File, path: string): Promise<string> => {
    const { error } = await supabase.storage.from('app-images').upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('app-images').getPublicUrl(path);
    return publicUrl;
  };

  // Drivers in the system
  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('profiles')
        .select('id, name')
        .eq('role', 'driver')
        .order('name');
      return data || [];
    },
  });

  const { data: hubs = [] } = useQuery({
    queryKey: ['hubs-list'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('hubs').select('id, name').order('name');
      return data || [];
    },
  });

  const base    = parseFloat(form.base_amount)    || 0;
  const toll    = parseFloat(form.toll_charges)   || 0;
  const other   = parseFloat(form.other_charges)  || 0;
  const total   = base + toll + other;

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!form.trip_date)    throw new Error('Trip date is required');
      if (total <= 0)          throw new Error('Total amount must be > ₹0');
      if (!billFile)           throw new Error('Please upload the bill / receipt photo');

      const ts = Date.now();
      const [billUrl, tripProofUrl] = await Promise.all([
        uploadPhoto(billFile, `purchase-receipts/transport/${ts}-bill.jpg`),
        tripProofFile ? uploadPhoto(tripProofFile, `purchase-receipts/transport/${ts}-trip-proof.jpg`) : Promise.resolve(null),
      ]);

      const { data, error } = await (supabase as any)
        .from('ff_transport_payments')
        .insert({
          driver_id:      form.driver_id || null,
          hub_id:         form.hub_id    || null,
          trip_date:      form.trip_date,
          vehicle_number: form.vehicle_number || null,
          origin:         form.origin         || null,
          destination:    form.destination    || null,
          km_covered:     parseFloat(form.km_covered) || null,
          base_amount:    base,
          toll_charges:   toll,
          other_charges:  other,
          bill_url:       billUrl,
          trip_proof_url: tripProofUrl,
          payment_status: 'pending_ff_ops',
          created_by:     user?.id,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      setCreatedId(id);
      setStep('done');
      qc.invalidateQueries({ queryKey: ['ff-transport-payments'] });
      toast.success('Transport payment submitted for approval ✓');
    },
    onError: (e: any) => toast.error(e.message || 'Submission failed'),
  });

  if (step === 'done') {
    return (
      <div className="max-w-lg mx-auto pt-16 flex flex-col items-center text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-9 h-9 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Transport Payment Submitted</h2>
        <p className="text-sm text-gray-500">Sent to FF Operations Manager for Level 1 review.</p>
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-6 py-4 w-full text-left">
          <p className="text-xs text-gray-400">Total Amount</p>
          <p className="text-2xl font-bold text-gray-900">₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-gray-400 mt-1">Ref: {createdId?.slice(0, 8).toUpperCase()}</p>
        </div>
        <div className="flex gap-3 w-full">
          <button
            onClick={() => { setStep('form'); setForm(f => ({ ...f, driver_id:'', vehicle_number:'', origin:'', destination:'', km_covered:'', base_amount:'', toll_charges:'', other_charges:'' })); }}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            New Request
          </button>
          <button
            onClick={() => navigate('/l1/transport-payments')}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            View All Payments
          </button>
        </div>
      </div>
    );
  }

  const Field = ({ label, required, children }: any) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );

  const Input = ({ field, type = 'text', placeholder = '', ...rest }: any) => (
    <input
      type={type}
      value={form[field]}
      onChange={e => set(field, e.target.value)}
      placeholder={placeholder}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
      {...rest}
    />
  );

  const PhotoField = ({ label, required, preview, onFile, onRemove }: any) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {preview ? (
        <div className="relative w-full h-28 rounded-xl overflow-hidden border-2 border-green-200">
          <img src={preview} alt={label} className="w-full h-full object-cover" />
          <button onClick={onRemove} className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-full hover:bg-red-600">
            <X size={10} />
          </button>
        </div>
      ) : (
        <label className={`flex flex-col items-center justify-center gap-1 w-full h-28 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
          required ? 'border-amber-300 bg-amber-50 hover:bg-amber-100' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
        }`}>
          <Upload size={16} className={required ? 'text-amber-400' : 'text-gray-400'} />
          <span className="text-xs text-gray-500">Click to upload</span>
          <input
            type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
          />
        </label>
      )}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto pb-12 pt-2 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Transport Payment</h1>
          <p className="text-xs text-gray-500 mt-0.5">Submit driver / logistics payment for 5-level approval</p>
        </div>
      </div>

      {/* Trip Details */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Truck className="w-4 h-4 text-orange-500" /> Trip Details
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Trip Date" required>
            <Input field="trip_date" type="date" />
          </Field>
          <Field label="Vehicle Number">
            <Input field="vehicle_number" placeholder="TN 01 AB 1234" />
          </Field>
          <Field label="Driver">
            <select
              value={form.driver_id}
              onChange={e => set('driver_id', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">— Select Driver —</option>
              {drivers.map((d: any) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Hub">
            <select
              value={form.hub_id}
              onChange={e => set('hub_id', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">— Select Hub —</option>
              {hubs.map((h: any) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Origin">
            <Input field="origin" placeholder="From location" />
          </Field>
          <Field label="Destination">
            <Input field="destination" placeholder="To location" />
          </Field>
          <Field label="KM Covered">
            <Input field="km_covered" type="number" placeholder="0" min="0" />
          </Field>
        </div>
      </div>

      {/* Amounts */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-purple-500" /> Payment Breakdown
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Base Amount (₹)" required>
            <Input field="base_amount" type="number" placeholder="0.00" min="0" />
          </Field>
          <Field label="Toll Charges (₹)">
            <Input field="toll_charges" type="number" placeholder="0.00" min="0" />
          </Field>
          <Field label="Other Charges (₹)">
            <Input field="other_charges" type="number" placeholder="0.00" min="0" />
          </Field>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between text-gray-600"><span>Base</span><span>₹{base.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></div>
          <div className="flex justify-between text-gray-600"><span>Toll</span><span>₹{toll.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></div>
          <div className="flex justify-between text-gray-600"><span>Other</span><span>₹{other.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></div>
          <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2 text-base">
            <span>Total</span>
            <span>₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Supporting docs */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Upload className="w-4 h-4 text-gray-400" /> Supporting Photos
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <PhotoField
            label="Bill / Receipt" required
            preview={billPreview}
            onFile={f => { setBillFile(f); setBillPreview(URL.createObjectURL(f)); }}
            onRemove={() => { setBillFile(null); setBillPreview(''); }}
          />
          <PhotoField
            label="Trip Proof"
            preview={tripProofPreview}
            onFile={f => { setTripProofFile(f); setTripProofPreview(URL.createObjectURL(f)); }}
            onRemove={() => { setTripProofFile(null); setTripProofPreview(''); }}
          />
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={() => submitMutation.mutate()}
        disabled={submitMutation.isPending || total <= 0 || !billFile}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-600 text-white font-medium hover:bg-orange-700 disabled:opacity-50 transition text-sm"
      >
        <Save className="w-4 h-4" />
        {submitMutation.isPending ? 'Submitting...' : 'Submit Transport Payment'}
      </button>
    </div>
  );
}
