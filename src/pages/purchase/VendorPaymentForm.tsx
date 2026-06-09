import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  CreditCard, ChevronLeft, CheckCircle2, RefreshCw,
  AlertTriangle, X, FileText, Plus,
} from 'lucide-react';

type PaymentType = 'advance' | 'partial' | 'full' | 'porter' | 'credit_note';

const PAYMENT_TYPE_CONFIG: Record<PaymentType, { label: string; description: string; color: string }> = {
  advance:     { label: 'Advance',             description: 'Payment before delivery',       color: 'border-blue-400 bg-blue-50 text-blue-700' },
  partial:     { label: 'Partial Payment',     description: 'Partial against invoice',       color: 'border-amber-400 bg-amber-50 text-amber-700' },
  full:        { label: 'Full Payment',        description: 'Full invoice settlement',       color: 'border-green-400 bg-green-50 text-green-700' },
  porter:      { label: 'Porter Payment',      description: 'Labour / unloading charges',    color: 'border-purple-400 bg-purple-50 text-purple-700' },
  credit_note: { label: 'Credit Note Adjust',  description: 'Deduction/credit note applied', color: 'border-red-400 bg-red-50 text-red-700' },
};

interface PaymentFormData {
  vendor_id:      string;
  po_id:          string;
  payment_type:   PaymentType;
  amount:         number;
  payment_method: string;
  payment_date:   string;
  reference_no:   string;
  notes:          string;
}

export default function VendorPaymentForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hubId = (user as any)?.hub_id ?? null;

  const [paymentType, setPaymentType] = useState<PaymentType>('full');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [selectedPoId, setSelectedPoId] = useState('');
  const [selectedDeductions, setSelectedDeductions] = useState<string[]>([]);
  const [step, setStep] = useState<'form' | 'confirm' | 'done'>('form');
  const [createdPaymentId, setCreatedPaymentId] = useState<string | null>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<PaymentFormData>({
    defaultValues: {
      payment_type:   'full',
      payment_method: 'bank_transfer',
      payment_date:   new Date().toISOString().split('T')[0],
    },
  });

  const grossAmount = watch('amount') || 0;

  // Vendors
  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors-active'],
    queryFn: async () => {
      const { data } = await supabase.from('vendors').select('id,name,bank_name,account_number').eq('is_active', true).order('name');
      return data ?? [];
    },
  });

  // POs for selected vendor
  const { data: vendorPOs = [] } = useQuery({
    queryKey: ['vendor-pos', selectedVendorId],
    enabled: !!selectedVendorId,
    queryFn: async () => {
      const { data } = await supabase
        .from('purchase_orders')
        .select('id, po_number, total_amount, status, order_date')
        .eq('vendor_id', selectedVendorId)
        .in('status', ['received', 'ordered', 'approved'])
        .order('order_date', { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  // Pending deduction memos for vendor
  const { data: pendingDeductions = [] } = useQuery({
    queryKey: ['pending-deductions', selectedVendorId],
    enabled: !!selectedVendorId,
    queryFn: async () => {
      const { data } = await supabase
        .from('deduction_memos')
        .select('id, deduction_type, deduction_amount, description, deduction_kg, created_at')
        .eq('vendor_id', selectedVendorId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const selectedDeductionTotal = (pendingDeductions as any[])
    .filter(d => selectedDeductions.includes(d.id))
    .reduce((s, d) => s + Number(d.deduction_amount || 0), 0);

  const netPayable = Math.max(0, grossAmount - selectedDeductionTotal);

  const toggleDeduction = (id: string) => {
    setSelectedDeductions(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const createPayment = useMutation({
    mutationFn: async (data: PaymentFormData) => {
      // Create payment record
      const { data: payment, error } = await supabase
        .from('vendor_payments')
        .insert({
          vendor_id:        data.vendor_id,
          po_id:            data.po_id || null,
          hub_id:           hubId,
          payment_type:     paymentType,
          amount:           grossAmount,
          deduction_total:  selectedDeductionTotal,
          net_amount:       netPayable,
          payment_method:   data.payment_method,
          payment_date:     data.payment_date,
          reference_no:     data.reference_no || null,
          notes:            data.notes || null,
          status:           'pending_admin',
          created_by:       user!.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Link selected deduction memos
      if (selectedDeductions.length > 0) {
        const lines = selectedDeductions.map(deductionId => {
          const memo = (pendingDeductions as any[]).find(d => d.id === deductionId);
          return {
            payment_id:        payment.id,
            deduction_memo_id: deductionId,
            amount:            memo?.deduction_amount ?? 0,
            description:       memo?.description ?? '',
          };
        });
        await supabase.from('payment_deduction_lines').insert(lines);

        // Mark deduction memos as applied
        await supabase
          .from('deduction_memos')
          .update({ status: 'applied', applied_to_payment: payment.id })
          .in('id', selectedDeductions);
      }

      return payment;
    },
    onSuccess: (payment) => {
      toast.success('Payment submitted for approval');
      queryClient.invalidateQueries({ queryKey: ['vendor-payments'] });
      queryClient.invalidateQueries({ queryKey: ['pending-deductions'] });
      setCreatedPaymentId(payment.id);
      setStep('done');
    },
    onError: (err: Error) => toast.error(`Failed: ${err.message}`),
  });

  const onSubmit = (data: PaymentFormData) => {
    if (!data.vendor_id) { toast.error('Select a vendor'); return; }
    createPayment.mutate(data);
  };

  const fmt = (n: number) => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  // ── DONE SCREEN ──────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="max-w-lg mx-auto pt-8">
        <div className="bg-white rounded-2xl border-2 border-blue-200 p-8 text-center">
          <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-9 w-9 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-1">Payment Submitted</h2>
          <p className="text-sm text-slate-500 mb-2">Sent to Admin for approval</p>

          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6 text-left">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-500">Gross Amount</span>
              <span className="font-semibold text-slate-800">{fmt(grossAmount)}</span>
            </div>
            {selectedDeductionTotal > 0 && (
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-500">Deductions</span>
                <span className="font-semibold text-red-600">- {fmt(selectedDeductionTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold border-t border-blue-200 pt-2 mt-2">
              <span className="text-slate-700">Net Payable</span>
              <span className="text-green-700">{fmt(netPayable)}</span>
            </div>
          </div>

          <div className="space-y-3">
            <Link
              to="/purchase/payment-approvals"
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700"
            >
              View Approval Queue
            </Link>
            <button
              onClick={() => { setStep('form'); setSelectedDeductions([]); }}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-medium text-slate-600 hover:bg-gray-50"
            >
              Create Another Payment
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── FORM ─────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12 pt-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100">
          <ChevronLeft className="h-5 w-5 text-slate-500" />
        </button>
        <div>
          <h1 className="text-[20px] font-bold text-slate-800">New Vendor Payment</h1>
          <p className="text-[13px] text-slate-400">Payments go through Admin → Director approval</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* Payment Type */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">Payment Type</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.keys(PAYMENT_TYPE_CONFIG) as PaymentType[]).map(type => {
              const cfg = PAYMENT_TYPE_CONFIG[type];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => { setPaymentType(type); setValue('payment_type', type); }}
                  className={`rounded-xl border-2 p-3 text-left transition-all ${
                    paymentType === type ? cfg.color : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <p className="font-semibold text-xs">{cfg.label}</p>
                  <p className={`text-[10px] mt-0.5 ${paymentType === type ? '' : 'text-gray-400'}`}>{cfg.description}</p>
                </button>
              );
            })}
          </div>
          <input type="hidden" {...register('payment_type')} />
        </div>

        {/* Vendor & PO */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">Vendor & Purchase Order</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor *</label>
            <select
              {...register('vendor_id', { required: true })}
              onChange={e => { setSelectedVendorId(e.target.value); setSelectedPoId(''); setSelectedDeductions([]); setValue('vendor_id', e.target.value); }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select vendor</option>
              {(vendors as any[]).map((v: any) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            {errors.vendor_id && <p className="text-xs text-red-500 mt-1">Required</p>}
          </div>

          {selectedVendorId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Order (optional)</label>
              <select
                {...register('po_id')}
                onChange={e => setSelectedPoId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— No PO reference —</option>
                {(vendorPOs as any[]).map((po: any) => (
                  <option key={po.id} value={po.id}>
                    {po.po_number} · ₹{Number(po.total_amount || 0).toLocaleString('en-IN')} ({po.status})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Deductions */}
        {(pendingDeductions as any[]).length > 0 && (
          <div className="bg-white rounded-xl border border-amber-200 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">
                Pending Deductions ({(pendingDeductions as any[]).length})
              </h3>
            </div>
            <p className="text-xs text-slate-500">Select deductions to apply against this payment:</p>
            <div className="space-y-2">
              {(pendingDeductions as any[]).map((d: any) => (
                <label
                  key={d.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedDeductions.includes(d.id)
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div
                    onClick={() => toggleDeduction(d.id)}
                    className={`h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
                      selectedDeductions.includes(d.id) ? 'bg-red-500 border-red-500' : 'border-gray-300'
                    }`}
                  >
                    {selectedDeductions.includes(d.id) && (
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0" onClick={() => toggleDeduction(d.id)}>
                    <p className="text-sm font-medium text-slate-700">{d.description || d.deduction_type}</p>
                    {d.deduction_kg > 0 && (
                      <p className="text-xs text-slate-400">{d.deduction_kg} kg</p>
                    )}
                  </div>
                  <span className="text-sm font-bold text-red-600">- {fmt(d.deduction_amount)}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Amount */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">Payment Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gross Amount (₹) *</label>
              <input
                type="number" step="0.01" min="0"
                {...register('amount', { required: true, valueAsNumber: true, min: 0.01 })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
              {errors.amount && <p className="text-xs text-red-500 mt-1">Required</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date *</label>
              <input
                type="date"
                {...register('payment_date', { required: true })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select
                {...register('payment_method')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="neft">NEFT</option>
                <option value="rtgs">RTGS</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference No.</label>
              <input
                {...register('reference_no')}
                placeholder="UTR / Cheque no."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              {...register('notes')}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Any additional notes…"
            />
          </div>

          {/* Net Payable Summary */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Gross Amount</span>
              <span className="font-semibold text-slate-800">{fmt(grossAmount)}</span>
            </div>
            {selectedDeductionTotal > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Total Deductions</span>
                <span className="font-semibold text-red-600">- {fmt(selectedDeductionTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-2 mt-1">
              <span className="text-slate-700">Net Payable</span>
              <span className="text-green-700 text-base">{fmt(netPayable)}</span>
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={createPayment.isPending}
          className="w-full rounded-xl bg-blue-600 px-6 py-3.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {createPayment.isPending
            ? <><RefreshCw className="h-4 w-4 animate-spin" /> Submitting…</>
            : <><CreditCard className="h-4 w-4" /> Submit for Approval</>}
        </button>
      </form>
    </div>
  );
}
