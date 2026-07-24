// @ts-nocheck
import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  ShoppingBag, ChevronDown, ChevronRight, Package, Building2,
  Plus, Upload, X, CheckCircle2, AlertCircle, Scale, Image as ImageIcon,
  Loader2, RefreshCw, Search, Calendar, Banknote,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────
interface POItem {
  id: string;
  product_name: string;
  item_name: string | null;
  required_qty: number;
  unit: string;
  estimated_price: number | null;
  status: string;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  eod_date: string;
  status: string;
  hub_id: string;
  hub_name: string | null;
  items: POItem[];
}

interface Vendor {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  bank_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  upi_id: string | null;
  gst_number: string | null;
  type: string | null;
}

interface BuyFormState {
  vendorType: 'static' | 'dynamic';
  selectedVendor: Vendor | null;
  // dynamic vendor fields
  dynName: string;
  dynPhone: string;
  dynBank: string;
  dynAccount: string;
  dynIfsc: string;
  dynUpi: string;
  dynGst: string;
  // purchase details
  buyQty: string;
  rate: string;
  amount: string;            // manual entry
  itemPhotoFile: File | null;
  itemPhotoUrl: string;
  scalePhotoFile: File | null;
  scalePhotoUrl: string;
  proofPhotoFile: File | null;   // vendor payment proof / handwritten slip
  proofPhotoUrl: string;
  notes: string;
}

const EMPTY_FORM: BuyFormState = {
  vendorType: 'static',
  selectedVendor: null,
  dynName: '', dynPhone: '', dynBank: '', dynAccount: '', dynIfsc: '', dynUpi: '', dynGst: '',
  buyQty: '', rate: '', amount: '',
  itemPhotoFile: null, itemPhotoUrl: '',
  scalePhotoFile: null, scalePhotoUrl: '',
  proofPhotoFile: null, proofPhotoUrl: '',
  notes: '',
};

// ── Image Upload Box ───────────────────────────────────────────────────────────
function PhotoBox({
  label, icon: Icon, required, url, onFile, onRemove,
}: {
  label: string; icon: React.ElementType; required?: boolean;
  url: string; onFile: (f: File) => void; onRemove: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-xs font-semibold text-gray-600">
        <Icon size={12} />{label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {url
          ? <CheckCircle2 size={12} className="text-green-500 ml-auto" />
          : required && <AlertCircle size={12} className="text-amber-400 ml-auto" />}
      </div>
      {url ? (
        <div className="relative w-full h-28 rounded-xl overflow-hidden border-2 border-green-200">
          <img src={url} alt={label} className="w-full h-full object-cover" />
          <button onClick={onRemove}
            className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-full hover:bg-red-600">
            <X size={10} />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()}
          className={cn(
            'w-full h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-colors',
            required ? 'border-amber-300 bg-amber-50 hover:bg-amber-100' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
          )}>
          <Upload size={18} className={required ? 'text-amber-400' : 'text-gray-400'} />
          <span className="text-xs text-gray-500">Click to upload</span>
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
    </div>
  );
}

// ── Buy Dialog ─────────────────────────────────────────────────────────────────
function BuyDialog({
  open, onClose, po, item, onSuccess,
}: {
  open: boolean; onClose: () => void;
  po: PurchaseOrder; item: POItem;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState<BuyFormState>(EMPTY_FORM);
  const [vendorSearch, setVendorSearch] = useState('');
  const [showVendorList, setShowVendorList] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof BuyFormState, v: any) => setForm(f => ({ ...f, [k]: v }));

  // Fetch static vendors
  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('vendors')
        .select('id,name,contact_person,phone,bank_name,account_number,ifsc_code,upi_id,gst_number,type')
        .eq('is_active', true)
        .order('name');
      return (data ?? []) as Vendor[];
    },
  });

  const filteredVendors = vendors.filter(v =>
    v.name.toLowerCase().includes(vendorSearch.toLowerCase())
  );

  const handlePhotoFile = (key: 'itemPhotoFile' | 'scalePhotoFile' | 'proofPhotoFile', urlKey: 'itemPhotoUrl' | 'scalePhotoUrl' | 'proofPhotoUrl', file: File) => {
    const url = URL.createObjectURL(file);
    setForm(f => ({ ...f, [key]: file, [urlKey]: url }));
  };

  const removePhoto = (key: 'itemPhotoFile' | 'scalePhotoFile' | 'proofPhotoFile', urlKey: 'itemPhotoUrl' | 'scalePhotoUrl' | 'proofPhotoUrl') => {
    setForm(f => {
      if (f[urlKey]) URL.revokeObjectURL(f[urlKey] as string);
      return { ...f, [key]: null, [urlKey]: '' };
    });
  };

  const buyQty = Number(form.buyQty) || 0;
  const rate = Number(form.rate) || 0;
  const amount = Number(form.amount) || 0;

  const canSave =
    (form.vendorType === 'static' ? !!form.selectedVendor : !!form.dynName.trim()) &&
    buyQty > 0 && rate > 0 && amount > 0 &&
    !!form.itemPhotoUrl && !!form.scalePhotoUrl && !!form.proofPhotoUrl;

  // ── Upload helper ──
  const uploadPhoto = async (file: File, path: string): Promise<string> => {
    const { error } = await supabase.storage
      .from('app-images')
      .upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage
      .from('app-images')
      .getPublicUrl(path);
    return publicUrl;
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      // 1. Ensure vendor exists
      let vendorId: string;
      if (form.vendorType === 'static' && form.selectedVendor) {
        vendorId = form.selectedVendor.id;
      } else {
        // Insert dynamic vendor
        const { data: newVendor, error: vErr } = await supabase
          .from('vendors')
          .insert({
            name: form.dynName.trim(),
            phone: form.dynPhone.trim() || null,
            bank_name: form.dynBank.trim() || null,
            account_number: form.dynAccount.trim() || null,
            ifsc_code: form.dynIfsc.trim() || null,
            upi_id: form.dynUpi.trim() || null,
            gst_number: form.dynGst.trim() || null,
            type: 'dynamic',
            is_active: true,
          })
          .select('id')
          .single();
        if (vErr) throw vErr;
        vendorId = newVendor.id;
      }

      // 2. Upload photos
      const ts = Date.now();
      const itemPhotoPath  = `purchase-receipts/${po.id}/${item.id}-item-${ts}.jpg`;
      const scalePhotoPath = `purchase-receipts/${po.id}/${item.id}-scale-${ts}.jpg`;
      const proofPhotoPath = `purchase-receipts/${po.id}/${item.id}-proof-${ts}.jpg`;

      const [itemPhotoPublic, scalePhotoPublic, proofPhotoPublic] = await Promise.all([
        uploadPhoto(form.itemPhotoFile!, itemPhotoPath),
        uploadPhoto(form.scalePhotoFile!, scalePhotoPath),
        uploadPhoto(form.proofPhotoFile!, proofPhotoPath),
      ]);

      // 3. Insert purchase_entries
      const { data: entry, error: entryErr } = await supabase
        .from('purchase_entries')
        .insert({
          po_id: po.id,
          vendor_id: vendorId,
          purchased_by: user?.id,
          total_amount: amount,
          receipt_url: itemPhotoPublic,
          notes: form.notes.trim() || null,
        })
        .select('id')
        .single();
      if (entryErr) throw entryErr;

      // 4. Insert purchase_entry_items
      await supabase.from('purchase_entry_items').insert({
        entry_id: entry.id,
        product_name: item.product_name || item.item_name || 'Item',
        quantity: buyQty,
        unit: item.unit || 'kg',
        unit_price: rate,
        total: amount,
      });

      // 5. Insert ff_vendor_payments → triggers payment chain
      const paymentItems = [{
        po_item_id: item.id,
        product_name: item.product_name || item.item_name,
        quantity: buyQty,
        unit: item.unit || 'kg',
        unit_price: rate,
        total: amount,
        item_photo_url: itemPhotoPublic,
        scale_photo_url: scalePhotoPublic,
        payment_proof_url: proofPhotoPublic,
      }];

      const { error: payErr } = await supabase
        .from('ff_vendor_payments')
        .insert({
          vendor_id: vendorId,
          purchase_order_id: po.id,
          hub_id: po.hub_id,
          items: paymentItems,
          gross_amount: amount,
          deduction_amount: 0,
          net_amount: amount,
          payment_status: 'pending_ff_ops',
          created_by: user?.id,
          purchase_entry_id: entry.id,
        });
      if (payErr) throw payErr;

      // 6. Accumulate ordered_qty → set partial or ordered
      const { data: currentPOItem } = await supabase
        .from('purchase_order_items')
        .select('ordered_qty, required_qty')
        .eq('id', item.id)
        .single();
      const prevOrdered  = Number(currentPOItem?.ordered_qty ?? 0);
      const newOrdered   = prevOrdered + buyQty;
      const requiredQty  = Number(currentPOItem?.required_qty ?? item.required_qty ?? 0);
      const newItemStatus = newOrdered >= requiredQty ? 'ordered' : 'partial';

      await supabase
        .from('purchase_order_items')
        .update({ status: newItemStatus, ordered_qty: newOrdered, unit_price: rate, total_price: amount })
        .eq('id', item.id);

      toast.success(`✅ Purchase recorded — payment sent to FF Ops for approval`);
      onSuccess();
      onClose();

      // Cleanup object URLs
      if (form.itemPhotoUrl)  URL.revokeObjectURL(form.itemPhotoUrl);
      if (form.scalePhotoUrl) URL.revokeObjectURL(form.scalePhotoUrl);
      if (form.proofPhotoUrl) URL.revokeObjectURL(form.proofPhotoUrl);
      setForm(EMPTY_FORM);

    } catch (err: any) {
      toast.error(err.message || 'Failed to save purchase');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (form.itemPhotoUrl)  URL.revokeObjectURL(form.itemPhotoUrl);
    if (form.scalePhotoUrl) URL.revokeObjectURL(form.scalePhotoUrl);
    if (form.proofPhotoUrl) URL.revokeObjectURL(form.proofPhotoUrl);
    setForm(EMPTY_FORM);
    setVendorSearch('');
    setShowVendorList(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-green-600" />
            Buy — {item?.product_name || item?.item_name}
            <span className="text-sm text-gray-400 font-normal ml-1">({po.po_number})</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Required qty banner */}
          <div className="bg-blue-50 rounded-xl px-4 py-3 flex items-center gap-4">
            <Package className="h-5 w-5 text-blue-500 shrink-0" />
            <div>
              <p className="text-xs text-blue-500 font-medium">PO Required</p>
              <p className="text-lg font-black text-blue-800">
                {Number(item?.required_qty || 0).toFixed(1)} {item?.unit || 'kg'}
              </p>
            </div>
            {item?.estimated_price && (
              <div className="ml-auto text-right">
                <p className="text-xs text-blue-500 font-medium">Est. Rate</p>
                <p className="text-base font-bold text-blue-700">
                  ₹{Number(item.estimated_price).toLocaleString('en-IN')}
                </p>
              </div>
            )}
          </div>

          {/* Already bought (split vendor) banner */}
          {(item?.ordered_qty ?? 0) > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-orange-500 shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-orange-600 font-semibold">Split Buy — Already Purchased</p>
                <p className="text-sm font-bold text-orange-800">
                  {Number(item.ordered_qty).toFixed(1)} {item?.unit || 'kg'} bought from previous vendor
                  {' '}&bull;{' '}
                  <span className="text-orange-600">
                    Still need {Math.max(0, Number(item.required_qty) - Number(item.ordered_qty)).toFixed(1)} {item?.unit || 'kg'} more
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Vendor type toggle */}
          <div className="flex gap-3">
            {(['static', 'dynamic'] as const).map(t => (
              <button key={t} onClick={() => set('vendorType', t)}
                className={cn(
                  'flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors',
                  form.vendorType === t
                    ? t === 'static'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                )}>
                {t === 'static' ? '⭐ Regular Vendor' : '➕ New / Dynamic Vendor'}
              </button>
            ))}
          </div>

          {/* Vendor section */}
          {form.vendorType === 'static' ? (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide">
                Select Vendor *
              </label>
              {form.selectedVendor ? (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                  <div>
                    <p className="font-bold text-gray-900">{form.selectedVendor.name}</p>
                    {form.selectedVendor.phone && (
                      <p className="text-xs text-gray-500">{form.selectedVendor.phone}</p>
                    )}
                    {form.selectedVendor.bank_name && (
                      <p className="text-xs text-gray-500">
                        {form.selectedVendor.bank_name} · {form.selectedVendor.account_number}
                      </p>
                    )}
                  </div>
                  <button onClick={() => set('selectedVendor', null)}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={vendorSearch}
                      onChange={e => { setVendorSearch(e.target.value); setShowVendorList(true); }}
                      onFocus={() => setShowVendorList(true)}
                      placeholder="Search vendors…"
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  {showVendorList && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 max-h-52 overflow-y-auto">
                      {filteredVendors.length === 0 ? (
                        <p className="px-4 py-4 text-sm text-gray-400 text-center">No vendors found</p>
                      ) : filteredVendors.map(v => (
                        <button key={v.id}
                          onClick={() => { set('selectedVendor', v); setShowVendorList(false); setVendorSearch(''); }}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0">
                          <p className="text-sm font-semibold text-gray-800">{v.name}</p>
                          {v.bank_name && (
                            <p className="text-xs text-gray-400">{v.bank_name} · {v.ifsc_code}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 bg-purple-50 rounded-xl p-4">
              <h4 className="col-span-2 text-xs font-bold text-purple-700 uppercase tracking-wide flex items-center gap-1.5">
                <Building2 size={11} /> New Vendor Details
              </h4>
              {[
                { label: 'Vendor Name *', key: 'dynName', placeholder: 'Enter vendor name' },
                { label: 'Phone',         key: 'dynPhone', placeholder: 'Mobile number' },
                { label: 'GST Number',    key: 'dynGst',   placeholder: 'GST number' },
                { label: 'UPI ID',        key: 'dynUpi',   placeholder: 'UPI ID / number' },
                { label: 'Bank Name',     key: 'dynBank',  placeholder: 'Bank name' },
                { label: 'Account No.',   key: 'dynAccount', placeholder: 'Account number' },
                { label: 'IFSC Code',     key: 'dynIfsc',  placeholder: 'IFSC code' },
              ].map(f => (
                <div key={f.key} className={f.key === 'dynName' ? 'col-span-2' : ''}>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">{f.label}</label>
                  <input
                    value={form[f.key] || ''}
                    onChange={e => set(f.key as keyof BuyFormState, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Purchase details */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">
                Qty ({item?.unit || 'kg'}) *
              </label>
              <input
                type="number" min="0" step="0.1"
                value={form.buyQty}
                onChange={e => set('buyQty', e.target.value)}
                placeholder="0.0"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">
                Rate (₹/{item?.unit || 'kg'}) *
              </label>
              <input
                type="number" min="0"
                value={form.rate}
                onChange={e => set('rate', e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">
                Amount (₹) *
              </label>
              <input
                type="number" min="0"
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
                placeholder="Enter amount"
                className="w-full px-3 py-2.5 border border-green-300 bg-green-50 rounded-xl text-sm font-bold text-green-800 focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
          </div>

          {/* Photo uploads */}
          <div className="grid grid-cols-3 gap-3">
            <PhotoBox
              label="Item Photo" icon={ImageIcon} required
              url={form.itemPhotoUrl}
              onFile={f => handlePhotoFile('itemPhotoFile', 'itemPhotoUrl', f)}
              onRemove={() => removePhoto('itemPhotoFile', 'itemPhotoUrl')}
            />
            <PhotoBox
              label="Weight Scale Photo" icon={Scale} required
              url={form.scalePhotoUrl}
              onFile={f => handlePhotoFile('scalePhotoFile', 'scalePhotoUrl', f)}
              onRemove={() => removePhoto('scalePhotoFile', 'scalePhotoUrl')}
            />
            <PhotoBox
              label="Payment Proof / Slip" icon={Banknote} required
              url={form.proofPhotoUrl}
              onFile={f => handlePhotoFile('proofPhotoFile', 'proofPhotoUrl', f)}
              onRemove={() => removePhoto('proofPhotoFile', 'proofPhotoUrl')}
            />
          </div>
          {(!form.scalePhotoUrl || !form.proofPhotoUrl) && (
            <p className="text-[11px] text-red-500 font-semibold flex items-center gap-1">
              <AlertCircle size={11} />
              {!form.proofPhotoUrl ? 'Vendor payment proof / slip photo is mandatory' : 'Weight scale photo is mandatory'}
            </p>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">
              Notes (optional)
            </label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={2}
              placeholder="Any notes about this purchase…"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Payment flow note */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
            <Banknote className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              On save, a <strong>vendor payment request</strong> will be submitted to FF Operations Manager
              for approval → L1 → Auditor → CEO → Accounts.
            </p>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className={cn(
              'w-full py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2',
              canSave && !saving
                ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            )}
          >
            {saving
              ? <><Loader2 size={16} className="animate-spin" /> Saving…</>
              : <><CheckCircle2 size={16} /> Save Purchase & Submit Payment</>}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── PO Card (expandable) ───────────────────────────────────────────────────────
function POCard({
  po, onBuy,
}: {
  po: PurchaseOrder;
  onBuy: (po: PurchaseOrder, item: POItem) => void;
}) {
  const [open, setOpen] = useState(true); // default open so exec sees items immediately

  const itemsDone  = po.items.filter(i => ['ordered', 'received'].includes(i.status)).length;
  const itemsPartial = po.items.filter(i => i.status === 'partial').length;
  const itemsTotal = po.items.length;
  const pct = itemsTotal > 0 ? Math.round((itemsDone / itemsTotal) * 100) : 0;

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm bg-white">
      {/* PO header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 bg-white hover:bg-slate-50 transition-colors text-left"
      >
        {open
          ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
          : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}

        <div className="flex-1 flex flex-wrap items-center gap-4">
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide">PO</p>
            <p className="text-sm font-bold text-blue-700">{po.po_number}</p>
          </div>
          {po.hub_name && (
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wide">Hub</p>
              <p className="text-sm font-semibold text-gray-700">{po.hub_name}</p>
            </div>
          )}
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide">EOD Date</p>
            <p className="text-sm font-semibold text-gray-700 flex items-center gap-1">
              <Calendar size={11} className="text-gray-400" />
              {po.eod_date ? format(new Date(po.eod_date), 'd MMM yyyy') : '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide">Progress</p>
            <p className="text-sm font-semibold text-gray-700">
              {itemsDone}/{itemsTotal} done
              {itemsPartial > 0 && <span className="ml-1 text-orange-500">· {itemsPartial} partial</span>}
            </p>
          </div>
          {/* progress bar */}
          <div className="flex-1 max-w-32">
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-green-500' : 'bg-blue-500')}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5 text-right">{pct}%</p>
          </div>
        </div>
      </button>

      {/* Item rows */}
      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {po.items.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-400">No items in this PO.</p>
          ) : po.items.map(item => {
            const done    = item.status === 'received' || item.status === 'ordered';
            const partial = item.status === 'partial';
            const alreadyBought = Number(item.ordered_qty ?? 0);
            const stillNeed = Math.max(0, Number(item.required_qty) - alreadyBought);
            return (
              <div key={item.id}
                className={cn(
                  'flex items-center gap-4 px-5 py-3.5 transition-colors',
                  done    ? 'bg-green-50'  :
                  partial ? 'bg-orange-50' : 'hover:bg-gray-50'
                )}>
                {/* Product */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Package className={cn('h-4 w-4 shrink-0',
                      done ? 'text-green-500' : partial ? 'text-orange-400' : 'text-gray-400')} />
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {item.product_name || item.item_name || '—'}
                    </p>
                    {done && (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">
                        <CheckCircle2 size={9} /> Fully Bought
                      </span>
                    )}
                    {partial && (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-[10px] font-bold">
                        <Package size={9} /> {alreadyBought.toFixed(1)}/{Number(item.required_qty).toFixed(1)} {item.unit || 'kg'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 ml-6">
                    Required: <span className="font-semibold">{Number(item.required_qty).toFixed(1)} {item.unit || 'kg'}</span>
                    {partial && (
                      <span className="ml-2 text-orange-600 font-semibold">· {stillNeed.toFixed(1)} {item.unit || 'kg'} still needed</span>
                    )}
                    {item.estimated_price && !partial && (
                      <span className="ml-2">Est. ₹{Number(item.estimated_price).toLocaleString('en-IN')}</span>
                    )}
                  </p>
                </div>

                {/* Buy button */}
                <button
                  onClick={() => onBuy(po, item)}
                  disabled={done}
                  className={cn(
                    'shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all',
                    done
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : partial
                        ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-sm hover:shadow-md'
                        : 'bg-green-600 hover:bg-green-700 text-white shadow-sm hover:shadow-md'
                  )}
                >
                  <ShoppingBag size={13} />
                  {done ? 'Done' : partial ? 'Buy More' : 'Buy'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function BuyPage() {
  const { user } = useAuth();
  const hubId = (user as any)?.hub_id ?? null;
  const isManagement = ['ceo', 'gm', 'admin', 'director', 'ff_operations_manager'].includes(user?.role ?? '');
  const queryClient = useQueryClient();

  const [activePO, setActivePO] = useState<PurchaseOrder | null>(null);
  const [activeItem, setActiveItem] = useState<POItem | null>(null);
  const [showAll, setShowAll] = useState(false);

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['buy-page-pos', hubId],
    queryFn: async () => {
      let q = supabase
        .from('purchase_orders')
        .select('*, items:purchase_order_items(*)')
        .in('status', ['pending', 'approved', 'ordered'])
        .order('eod_date', { ascending: false });

      // Purchase Executives only see/can-buy POs actually assigned to them by
      // their hub manager — not every PO for their hub.
      if (user?.role === 'shift_employee') {
        q = q.eq('assigned_executive_id', user.id);
      } else if (!isManagement && hubId) {
        q = q.eq('hub_id', hubId);
      }
      if (!showAll) q = q.limit(10);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PurchaseOrder[];
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const handleBuy = (po: PurchaseOrder, item: POItem) => {
    setActivePO(po);
    setActiveItem(item);
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['buy-page-pos'] });
    queryClient.invalidateQueries({ queryKey: ['purchase-orders-exec'] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-green-500" />
      </div>
    );
  }

  const totalItems   = orders.reduce((s, po) => s + po.items.length, 0);
  const boughtItems  = orders.reduce((s, po) => s + po.items.filter(i => ['ordered','received'].includes(i.status)).length, 0);
  const pendingItems = totalItems - boughtItems;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 pt-4 px-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-green-600" />
            Buy — Go Purchase
          </h1>
          <p className="text-[13px] text-slate-500">
            Click <strong>Buy</strong> on each item to record vendor purchase and submit payment
          </p>
        </div>
        <button onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Items',  value: totalItems,   color: 'text-blue-700',  bg: 'bg-blue-50'  },
          { label: 'Pending Buy',  value: pendingItems, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Bought',       value: boughtItems,  color: 'text-green-700', bg: 'bg-green-50' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl border border-gray-100 px-4 py-4 shadow-sm', s.bg)}>
            <p className="text-[12px] font-medium text-slate-500 mb-1">{s.label}</p>
            <p className={cn('text-2xl font-black', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* PO list */}
      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <ShoppingBag className="h-12 w-12 mb-3 opacity-30" />
          <p className="font-medium">No pending POs to buy</p>
          <p className="text-sm">EOD-generated POs will appear here after the nightly run</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(po => (
            <POCard key={po.id} po={po} onBuy={handleBuy} />
          ))}

          {!showAll && orders.length === 10 && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full py-3 text-sm text-blue-600 font-semibold hover:underline"
            >
              Load more POs...
            </button>
          )}
        </div>
      )}

      {/* Buy dialog */}
      {activePO && activeItem && (
        <BuyDialog
          open={!!(activePO && activeItem)}
          onClose={() => { setActivePO(null); setActiveItem(null); }}
          po={activePO}
          item={activeItem}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
