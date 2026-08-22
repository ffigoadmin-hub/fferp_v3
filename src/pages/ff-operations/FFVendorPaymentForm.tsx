// @ts-nocheck
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Banknote, Plus, Trash2, Save, ChevronLeft, CheckCircle2,
  Package, AlertCircle, Calculator, Building2, FileText,
  Upload, X, Receipt,
} from 'lucide-react';

interface LineItem {
  product_name:     string;
  qty:              number;
  unit:             string;
  rate:             number;
  amount:           number;
  qc_grade:         string;
  deduction_reason: string;
}

const EMPTY_ITEM: LineItem = {
  product_name: '', qty: 0, unit: 'kg', rate: 0, amount: 0, qc_grade: 'A', deduction_reason: '',
};

const QC_GRADES = ['A', 'B', 'C', 'Reject'];

export default function FFVendorPaymentForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [vendorId, setVendorId]   = useState('');
  const [vendorMode, setVendorMode] = useState<'existing' | 'new'>('existing');
  const [newVendor, setNewVendor] = useState({ name: '', phone: '', gst_number: '', bank_name: '', bank_account: '', bank_ifsc: '' });
  const [poId, setPoId]           = useState('');
  const [hubId, setHubId]         = useState((user as any)?.hub_id ?? '');
  const [items, setItems]         = useState<LineItem[]>([{ ...EMPTY_ITEM }]);
  const [notes, setNotes]         = useState('');
  const [step, setStep]           = useState<'form' | 'confirm' | 'done'>('form');
  const [createdId, setCreatedId] = useState('');
  const [proofPhotos, setProofPhotos] = useState<{ file: File; url: string }[]>([]);

  const addProofFiles = (files: FileList) => {
    const added = Array.from(files).map(file => ({ file, url: URL.createObjectURL(file) }));
    setProofPhotos(prev => [...prev, ...added]);
  };
  const removeProofPhoto = (idx: number) => {
    setProofPhotos(prev => {
      const target = prev[idx];
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== idx);
    });
  };
  const clearProofPhotos = () => {
    proofPhotos.forEach(p => URL.revokeObjectURL(p.url));
    setProofPhotos([]);
  };

  // Fetch vendors (with bank details)
  const { data: vendors = [] } = useQuery({
    queryKey: ['ff-vendors'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('vendors')
        .select('id, name, bank_name, bank_account, bank_ifsc, account_number, ifsc_code, phone')
        .order('name');
      return data || [];
    },
  });

  // Selected vendor bank info
  const selectedVendor = vendors.find((v: any) => v.id === vendorId);

  // Fetch hubs (for admin/ops manager who may change hub)
  const { data: hubs = [] } = useQuery({
    queryKey: ['hubs-list'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('hubs').select('id, name').order('name');
      return data || [];
    },
  });

  // Fetch POs for selected vendor (exclude cancelled only — avoids dependency on phase4 payment_status column)
  const { data: openPOs = [] } = useQuery({
    queryKey: ['open-pos', vendorId],
    queryFn: async () => {
      if (!vendorId) return [];
      const { data } = await (supabase as any)
        .from('purchase_orders')
        .select('id, created_at, total_amount, status')
        .eq('vendor_id', vendorId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!vendorId,
  });

  // Auto-populate items from selected PO
  const { data: poItems } = useQuery({
    queryKey: ['po-items', poId],
    queryFn: async () => {
      if (!poId) return [];
      const { data } = await (supabase as any)
        .from('purchase_order_items')
        .select('*, products(name)')
        .eq('purchase_order_id', poId);
      return data || [];
    },
    enabled: !!poId,
  });

  useEffect(() => {
    if (poItems && poItems.length > 0) {
      setItems(poItems.map((pi: any) => ({
        product_name:     pi.products?.name || pi.product_name || 'Unknown',
        qty:              pi.quantity || 0,
        unit:             pi.unit || 'kg',
        rate:             pi.unit_price || 0,
        amount:           (pi.quantity || 0) * (pi.unit_price || 0),
        qc_grade:         'A',
        deduction_reason: '',
      })));
    }
  }, [poItems]);

  // Calculated totals
  const grossAmount   = items.reduce((s, i) => s + Number(i.amount || 0), 0);
  const deductedItems = items.filter(i => i.qc_grade !== 'A' || i.deduction_reason);
  const deduction     = items.reduce((s, i) => {
    if (i.qc_grade === 'Reject') return s + Number(i.amount || 0);
    if (i.qc_grade === 'C')      return s + Number(i.amount || 0) * 0.1;
    if (i.qc_grade === 'B')      return s + Number(i.amount || 0) * 0.05;
    return s;
  }, 0);
  const netAmount = grossAmount - deduction;

  const updateItem = (idx: number, field: keyof LineItem, val: any) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      if (field === 'qty' || field === 'rate') {
        next[idx].amount = next[idx].qty * next[idx].rate;
      }
      return next;
    });
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (vendorMode === 'existing' && !vendorId) throw new Error('Please select a vendor');
      if (vendorMode === 'new' && !newVendor.name.trim()) throw new Error('Please enter the new vendor\'s name');
      if (items.length === 0) throw new Error('Add at least one item');
      if (netAmount <= 0)    throw new Error('Net amount must be greater than ₹0');
      if (proofPhotos.length === 0) throw new Error('Please upload at least one payment slip photo');

      let finalVendorId = vendorId;
      if (vendorMode === 'new') {
        const { data: vendorRow, error: vErr } = await (supabase as any)
          .from('vendors')
          .insert({
            name:           newVendor.name.trim(),
            phone:          newVendor.phone.trim() || null,
            gst_number:     newVendor.gst_number.trim() || null,
            bank_name:      newVendor.bank_name.trim() || null,
            // Written under BOTH column-naming conventions seen in this
            // codebase (bank_account/bank_ifsc used by VendorManagement.tsx
            // + this form's own vendor list; account_number/ifsc_code used
            // by BuyPage.tsx + FFPaymentApprovals.tsx's approval-card query)
            // until CHECK_VENDORS_BANK_COLUMNS.sql confirms which is real —
            // this guarantees a vendor created here shows correctly in both.
            bank_account:   newVendor.bank_account.trim() || null,
            bank_ifsc:      newVendor.bank_ifsc.trim() || null,
            account_number: newVendor.bank_account.trim() || null,
            ifsc_code:      newVendor.bank_ifsc.trim() || null,
            is_active:      true,
          })
          .select('id')
          .single();
        if (vErr) throw vErr;
        finalVendorId = vendorRow.id;
      }

      const ts = Date.now();
      const publicUrls = await Promise.all(proofPhotos.map(async (p, idx) => {
        const path = `purchase-receipts/manual/${ts}-${finalVendorId}-proof-${idx}.jpg`;
        const { error: upErr } = await supabase.storage.from('app-images').upload(path, p.file, { upsert: true });
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from('app-images').getPublicUrl(path);
        return publicUrl;
      }));

      const { data, error } = await (supabase as any)
        .from('ff_vendor_payments')
        .insert({
          vendor_id:        finalVendorId,
          purchase_order_id: poId || null,
          hub_id:           hubId || null,
          // payment_proof_url kept as the first slip for older readers that
          // expect a single URL; payment_proof_urls carries the full set.
          items:            items.map(i => ({ ...i, payment_proof_url: publicUrls[0], payment_proof_urls: publicUrls })),
          gross_amount:     grossAmount,
          deduction_amount: deduction,
          payment_status:   'pending_ff_ops',
          created_by:       user?.id,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      setCreatedId(id);
      setStep('done');
      qc.invalidateQueries({ queryKey: ['ff-vendor-payments'] });
      qc.invalidateQueries({ queryKey: ['ff-vendors'] });
      toast.success('Payment request submitted to FF Ops Manager ✓');
    },
    onError: (e: any) => toast.error(e.message || 'Submission failed'),
  });

  if (step === 'done') {
    return (
      <div className="max-w-lg mx-auto pt-16 flex flex-col items-center text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-9 h-9 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Payment Request Submitted</h2>
        <p className="text-sm text-gray-500">
          Your request is now with the FF Operations Manager for review.<br />
          You will be notified as it moves through the approval chain.
        </p>
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-6 py-4 w-full text-left space-y-1">
          <p className="text-xs text-gray-400">Net Amount</p>
          <p className="text-2xl font-bold text-gray-900">
            ₹{netAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-400 mt-1">Reference ID: {createdId?.slice(0, 8).toUpperCase()}</p>
        </div>
        <div className="flex gap-3 w-full">
          <button
            onClick={() => { setStep('form'); setItems([{ ...EMPTY_ITEM }]); setVendorId(''); setVendorMode('existing'); setNewVendor({ name: '', phone: '', gst_number: '', bank_name: '', bank_account: '', bank_ifsc: '' }); setPoId(''); clearProofPhotos(); }}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            New Request
          </button>
          <button
            onClick={() => navigate('/ff-operations/payment-approvals')}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            View All Payments
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-12 pt-2 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Vendor Payment Request</h1>
          <p className="text-xs text-gray-500 mt-0.5">Submit a vendor payment for approval · goes to FF Ops → L1 → GM → Auditor → CEO</p>
        </div>
      </div>

      {/* Vendor + PO + Hub */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-500" /> Vendor & Purchase Order
        </h2>

        <div className="flex gap-2">
          {(['existing', 'new'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setVendorMode(m)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold border-2 transition-colors ${
                vendorMode === m
                  ? m === 'existing' ? 'bg-blue-600 text-white border-blue-600' : 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {m === 'existing' ? '⭐ Existing Vendor' : '➕ New Vendor'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {vendorMode === 'existing' ? (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vendor <span className="text-red-500">*</span></label>
              <select
                value={vendorId}
                onChange={e => { setVendorId(e.target.value); setPoId(''); setItems([{ ...EMPTY_ITEM }]); }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="">— Select Vendor —</option>
                {vendors.map((v: any) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="col-span-2 grid grid-cols-2 gap-3 bg-purple-50 rounded-xl p-4">
              <h4 className="col-span-2 text-xs font-bold text-purple-700 uppercase tracking-wide">New Vendor Details</h4>
              {[
                { label: 'Vendor Name *', key: 'name', placeholder: 'Enter vendor name', span: true },
                { label: 'Phone', key: 'phone', placeholder: 'Mobile number' },
                { label: 'GST Number', key: 'gst_number', placeholder: 'GST number' },
                { label: 'Bank Name', key: 'bank_name', placeholder: 'Bank name' },
                { label: 'Account No.', key: 'bank_account', placeholder: 'Account number' },
                { label: 'IFSC Code', key: 'bank_ifsc', placeholder: 'IFSC code' },
              ].map(f => (
                <div key={f.key} className={f.span ? 'col-span-2' : ''}>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">{f.label}</label>
                  <input
                    value={(newVendor as any)[f.key]}
                    onChange={e => setNewVendor(v => ({ ...v, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>
              ))}
              <p className="col-span-2 text-[10px] text-purple-600">Saved once you submit — it'll appear under "Existing Vendor" for future payments.</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Hub</label>
            <select
              value={hubId}
              onChange={e => setHubId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">— Select Hub —</option>
              {hubs.map((h: any) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>

          {/* Vendor bank details autofill — falls back across both column
              naming conventions in play (see comment on the new-vendor insert) */}
          {selectedVendor && (() => {
            const acct = selectedVendor.bank_account || selectedVendor.account_number;
            const ifsc = selectedVendor.bank_ifsc || selectedVendor.ifsc_code;
            if (!selectedVendor.bank_name && !acct) return null;
            return (
              <div className="col-span-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-start gap-3">
                <Banknote className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <div className="text-xs space-y-0.5">
                  <p className="font-semibold text-blue-800">Bank Details — {selectedVendor.name}</p>
                  {selectedVendor.bank_name && <p className="text-blue-700">Bank: {selectedVendor.bank_name}</p>}
                  {acct && <p className="text-blue-700">Account: {acct}</p>}
                  {ifsc && <p className="text-blue-700">IFSC: {ifsc}</p>}
                  {selectedVendor.phone && <p className="text-blue-600">Phone: {selectedVendor.phone}</p>}
                </div>
              </div>
            );
          })()}

          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Purchase Order (optional — auto-fills items)
            </label>
            <select
              value={poId}
              onChange={e => setPoId(e.target.value)}
              disabled={!vendorId}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50"
            >
              <option value="">— No PO / Manual entry —</option>
              {openPOs.map((po: any) => (
                <option key={po.id} value={po.id}>
                  #{po.id.slice(0,8)} · ₹{Number(po.total_amount || 0).toLocaleString('en-IN')} · {po.status}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Package className="w-4 h-4 text-green-500" /> Items & QC Grades
          </h2>
          <button
            onClick={() => setItems(prev => [...prev, { ...EMPTY_ITEM }])}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus className="w-3.5 h-3.5" /> Add Item
          </button>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-12 gap-1 text-xs font-medium text-gray-400 px-1">
          <span className="col-span-3">Product</span>
          <span className="col-span-1">Qty</span>
          <span className="col-span-1">Unit</span>
          <span className="col-span-2">Rate (₹)</span>
          <span className="col-span-2">Amount (₹)</span>
          <span className="col-span-1">Grade</span>
          <span className="col-span-2">Deduction Note</span>
        </div>

        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-1 items-center">
              <input
                className="col-span-3 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-200"
                placeholder="Product name"
                value={item.product_name}
                onChange={e => updateItem(idx, 'product_name', e.target.value)}
              />
              <input
                type="number" min={0}
                className="col-span-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-200"
                placeholder="0"
                value={item.qty || ''}
                onChange={e => updateItem(idx, 'qty', parseFloat(e.target.value) || 0)}
              />
              <select
                className="col-span-1 border border-gray-200 rounded-lg px-1 py-1.5 text-xs focus:outline-none"
                value={item.unit}
                onChange={e => updateItem(idx, 'unit', e.target.value)}
              >
                {['kg','g','pcs','box','crate','ltr'].map(u => <option key={u}>{u}</option>)}
              </select>
              <input
                type="number" min={0}
                className="col-span-2 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-200"
                placeholder="0.00"
                value={item.rate || ''}
                onChange={e => updateItem(idx, 'rate', parseFloat(e.target.value) || 0)}
              />
              <div className="col-span-2 px-2 py-1.5 text-xs font-semibold text-gray-700 bg-gray-50 rounded-lg">
                ₹{Number(item.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
              <select
                className={`col-span-1 border rounded-lg px-1 py-1.5 text-xs focus:outline-none ${
                  item.qc_grade === 'A' ? 'border-green-200 bg-green-50 text-green-700' :
                  item.qc_grade === 'B' ? 'border-yellow-200 bg-yellow-50 text-yellow-700' :
                  item.qc_grade === 'C' ? 'border-orange-200 bg-orange-50 text-orange-700' :
                  'border-red-200 bg-red-50 text-red-700'
                }`}
                value={item.qc_grade}
                onChange={e => updateItem(idx, 'qc_grade', e.target.value)}
              >
                {QC_GRADES.map(g => <option key={g}>{g}</option>)}
              </select>
              <div className="col-span-2 flex items-center gap-1">
                <input
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                  placeholder="Reason..."
                  value={item.deduction_reason}
                  onChange={e => updateItem(idx, 'deduction_reason', e.target.value)}
                />
                {items.length > 1 && (
                  <button
                    onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                    className="p-1 rounded hover:bg-red-50 text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* QC legend */}
        <div className="flex items-center gap-3 pt-1 text-xs text-gray-400">
          <span className="text-green-600 font-medium">A = Full payment</span>
          <span className="text-yellow-600 font-medium">B = −5%</span>
          <span className="text-orange-600 font-medium">C = −10%</span>
          <span className="text-red-600 font-medium">Reject = No payment</span>
        </div>
      </div>

      {/* Payment Slip(s) */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <label className="block text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
          <Receipt className="w-3.5 h-3.5" /> Payment Slip Photo{proofPhotos.length > 1 ? 's' : ''} <span className="text-red-500">*</span>
        </label>
        <div className="flex flex-wrap gap-3">
          {proofPhotos.map((p, idx) => (
            <div key={idx} className="relative w-28 h-28 rounded-xl overflow-hidden border-2 border-green-200">
              <img src={p.url} alt={`Payment slip ${idx + 1}`} className="w-full h-full object-cover" />
              <button onClick={() => removeProofPhoto(idx)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600">
                <X size={12} />
              </button>
            </div>
          ))}
          <label className="flex flex-col items-center justify-center gap-1 w-28 h-28 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 hover:bg-amber-100 cursor-pointer transition-colors">
            <Upload size={18} className="text-amber-400" />
            <span className="text-[10px] text-gray-500 text-center px-1">
              {proofPhotos.length === 0 ? 'Upload slip' : 'Add another'}
            </span>
            <input
              type="file" accept="image/*" multiple className="hidden"
              onChange={e => { if (e.target.files?.length) addProofFiles(e.target.files); e.target.value = ''; }}
            />
          </label>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <label className="block text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
          <FileText className="w-3.5 h-3.5" /> Notes / Additional Remarks
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Any notes for the approver..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      {/* Summary + Submit */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
          <Calculator className="w-4 h-4 text-purple-500" /> Payment Summary
        </h2>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Gross Amount</span>
            <span>₹{grossAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
          </div>
          {deduction > 0 && (
            <div className="flex justify-between text-red-500">
              <span>QC Deductions</span>
              <span>− ₹{deduction.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-gray-900 border-t border-gray-100 pt-2 text-base">
            <span>Net Payable</span>
            <span>₹{netAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Approval chain visual */}
        <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-400 flex-wrap">
          <span className="font-medium text-gray-600">Approval path:</span>
          {['You','FF Ops','L1','GM','Auditor','CEO','✓ Paid'].map((s, i) => (
            <span key={s} className="flex items-center gap-1">
              <span className={`px-2 py-0.5 rounded-full ${i === 0 ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-gray-100 text-gray-500'}`}>{s}</span>
              {i < 6 && <span className="text-gray-300">→</span>}
            </span>
          ))}
        </div>

        <button
          onClick={() => submitMutation.mutate()}
          disabled={submitMutation.isPending || (vendorMode === 'existing' ? !vendorId : !newVendor.name.trim()) || items.every(i => !i.product_name) || proofPhotos.length === 0}
          className="mt-5 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition text-sm"
        >
          <Save className="w-4 h-4" />
          {submitMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
        </button>
      </div>
    </div>
  );
}
