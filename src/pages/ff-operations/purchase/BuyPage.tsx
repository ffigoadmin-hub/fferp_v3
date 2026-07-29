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

interface CartItem {
  itemId: string;
  productName: string;
  unit: string;
  requiredQty: number;
  alreadyBought: number;
  remainingQty: number;
  qty: string;   // editable "buy now" qty
  rate: string;  // editable rate
  // each item is weighed/photographed separately, even when bought from
  // the same vendor as other items in this cart
  itemPhotoFile: File | null;
  itemPhotoUrl: string;
  scalePhotoFile: File | null;
  scalePhotoUrl: string;
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
  // cart — one row per item being bought from this vendor in this trip
  cart: CartItem[];
  // one shared payment slip covers the whole vendor purchase, uploaded once
  // at the end after all items are added
  proofPhotoFile: File | null;
  proofPhotoUrl: string;
  notes: string;
}

function makeCartRow(item: POItem): CartItem {
  const alreadyBought = Number((item as any).ordered_qty ?? 0);
  const requiredQty = Number(item.required_qty ?? 0);
  const remainingQty = Math.max(0, requiredQty - alreadyBought);
  return {
    itemId: item.id,
    productName: item.product_name || item.item_name || 'Item',
    unit: item.unit || 'kg',
    requiredQty,
    alreadyBought,
    remainingQty,
    qty: remainingQty > 0 ? String(remainingQty) : '',
    rate: item.estimated_price ? String(item.estimated_price) : '',
    itemPhotoFile: null, itemPhotoUrl: '',
    scalePhotoFile: null, scalePhotoUrl: '',
  };
}

const EMPTY_FORM_BASE = {
  vendorType: 'static' as const,
  selectedVendor: null as Vendor | null,
  dynName: '', dynPhone: '', dynBank: '', dynAccount: '', dynIfsc: '', dynUpi: '', dynGst: '',
  proofPhotoFile: null as File | null, proofPhotoUrl: '',
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
  open, onClose, po, onSuccess,
}: {
  open: boolean; onClose: () => void;
  po: PurchaseOrder;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState<BuyFormState>(() => ({
    ...EMPTY_FORM_BASE,
    cart: [],
  }));
  const [vendorSearch, setVendorSearch] = useState('');
  const [showVendorList, setShowVendorList] = useState(false);
  const [addItemPicker, setAddItemPicker] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k: keyof BuyFormState, v: any) => setForm(f => ({ ...f, [k]: v }));

  const availableToAdd = po.items.filter(i =>
    !form.cart.some(c => c.itemId === i.id) && makeCartRow(i).remainingQty > 0
  );

  const addItemToCart = (poItemId: string) => {
    const poItem = po.items.find(i => i.id === poItemId);
    if (!poItem) return;
    setForm(f => ({ ...f, cart: [...f.cart, makeCartRow(poItem)] }));
    setAddItemPicker('');
  };

  const removeCartRow = (itemId: string) => {
    setForm(f => ({ ...f, cart: f.cart.filter(c => c.itemId !== itemId) }));
  };

  const updateCartRow = (itemId: string, patch: Partial<Pick<CartItem, 'qty' | 'rate'>>) => {
    setForm(f => ({ ...f, cart: f.cart.map(c => c.itemId === itemId ? { ...c, ...patch } : c) }));
  };

  const cartTotal = form.cart.reduce((s, c) => s + (Number(c.qty) || 0) * (Number(c.rate) || 0), 0);

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

  // Shared payment-proof photo (form-level, one for the whole cart)
  const handleProofFile = (file: File) => {
    const url = URL.createObjectURL(file);
    setForm(f => ({ ...f, proofPhotoFile: file, proofPhotoUrl: url }));
  };
  const removeProofPhoto = () => {
    setForm(f => {
      if (f.proofPhotoUrl) URL.revokeObjectURL(f.proofPhotoUrl);
      return { ...f, proofPhotoFile: null, proofPhotoUrl: '' };
    });
  };

  // Per-item photos (item photo + weight scale photo), each item weighed separately
  const handleCartPhotoFile = (itemId: string, key: 'itemPhotoFile' | 'scalePhotoFile', urlKey: 'itemPhotoUrl' | 'scalePhotoUrl', file: File) => {
    const url = URL.createObjectURL(file);
    setForm(f => ({ ...f, cart: f.cart.map(c => c.itemId === itemId ? { ...c, [key]: file, [urlKey]: url } : c) }));
  };
  const removeCartPhoto = (itemId: string, key: 'itemPhotoFile' | 'scalePhotoFile', urlKey: 'itemPhotoUrl' | 'scalePhotoUrl') => {
    setForm(f => ({
      ...f,
      cart: f.cart.map(c => {
        if (c.itemId !== itemId) return c;
        if (c[urlKey]) URL.revokeObjectURL(c[urlKey] as string);
        return { ...c, [key]: null, [urlKey]: '' };
      }),
    }));
  };

  const canSave =
    (form.vendorType === 'static' ? !!form.selectedVendor : !!form.dynName.trim()) &&
    form.cart.length > 0 &&
    form.cart.every(c => (Number(c.qty) || 0) > 0 && (Number(c.rate) || 0) > 0 && !!c.itemPhotoUrl && !!c.scalePhotoUrl) &&
    !!form.proofPhotoUrl;

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
      // 1. Ensure vendor exists (once for the whole cart)
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

      // 2. Upload photos — each item's photo + weight-scale photo separately
      // (they're weighed one at a time even when bought from one vendor),
      // plus one shared payment-slip photo for the whole cart.
      const ts = Date.now();
      const proofPhotoPath = `purchase-receipts/${po.id}/cart-${ts}-proof.jpg`;

      const [proofPhotoPublic, cartPhotoUrls] = await Promise.all([
        uploadPhoto(form.proofPhotoFile!, proofPhotoPath),
        Promise.all(form.cart.map(async c => {
          const [itemUrl, scaleUrl] = await Promise.all([
            uploadPhoto(c.itemPhotoFile!, `purchase-receipts/${po.id}/cart-${ts}-${c.itemId}-item.jpg`),
            uploadPhoto(c.scalePhotoFile!, `purchase-receipts/${po.id}/cart-${ts}-${c.itemId}-scale.jpg`),
          ]);
          return { itemId: c.itemId, itemUrl, scaleUrl };
        })),
      ]);
      const photosByItemId = Object.fromEntries(cartPhotoUrls.map(p => [p.itemId, p]));

      // 3. One purchase_entries row for the whole cart
      const { data: entry, error: entryErr } = await supabase
        .from('purchase_entries')
        .insert({
          po_id: po.id,
          vendor_id: vendorId,
          purchased_by: user?.id,
          total_amount: cartTotal,
          receipt_url: proofPhotoPublic,
          notes: form.notes.trim() || null,
        })
        .select('id')
        .single();
      if (entryErr) throw entryErr;

      // 4. One purchase_entry_items row per cart item, each traced back to
      // its purchase_order_items row via po_item_id.
      const entryItemRows = form.cart.map(c => ({
        entry_id: entry.id,
        po_item_id: c.itemId,
        product_name: c.productName,
        quantity: Number(c.qty),
        unit: c.unit,
        unit_price: Number(c.rate),
        total: Number(c.qty) * Number(c.rate),
      }));
      const { error: entryItemsErr } = await supabase.from('purchase_entry_items').insert(entryItemRows);
      if (entryItemsErr) throw entryItemsErr;

      // 5. One ff_vendor_payments row → triggers payment chain, items array
      // holds one element per cart item, each with its own item/scale photo
      // but sharing the one payment-slip photo for the whole purchase.
      const paymentItems = form.cart.map(c => ({
        po_item_id: c.itemId,
        product_name: c.productName,
        quantity: Number(c.qty),
        unit: c.unit,
        unit_price: Number(c.rate),
        total: Number(c.qty) * Number(c.rate),
        item_photo_url: photosByItemId[c.itemId]?.itemUrl,
        scale_photo_url: photosByItemId[c.itemId]?.scaleUrl,
        payment_proof_url: proofPhotoPublic,
      }));

      const { error: payErr } = await supabase
        .from('ff_vendor_payments')
        .insert({
          vendor_id: vendorId,
          purchase_order_id: po.id,
          hub_id: po.hub_id,
          items: paymentItems,
          gross_amount: cartTotal,
          deduction_amount: 0,
          // net_amount is a DB-generated column (gross_amount - deduction_amount) —
          // must not be set explicitly, Postgres rejects any value for it.
          payment_status: 'pending_ff_ops',
          created_by: user?.id,
          purchase_entry_id: entry.id,
        });
      if (payErr) throw payErr;

      // 6. Per cart item: accumulate ordered_qty → set partial or ordered.
      // Both the read and the write are checked for errors — this step was
      // previously silent-failing (RLS or otherwise) while still showing a
      // success toast, leaving ordered_qty/status stuck at their old values.
      for (const c of form.cart) {
        const { data: currentPOItem, error: fetchErr } = await supabase
          .from('purchase_order_items')
          .select('ordered_qty, required_qty')
          .eq('id', c.itemId)
          .single();
        if (fetchErr) throw new Error(`Couldn't read current progress for ${c.productName}: ${fetchErr.message}`);

        const prevOrdered   = Number(currentPOItem?.ordered_qty ?? 0);
        const buyQty        = Number(c.qty);
        const newOrdered    = prevOrdered + buyQty;
        const requiredQty   = Number(currentPOItem?.required_qty ?? c.requiredQty ?? 0);
        // purchase_order_items_status_check only allows
        // 'pending'|'fulfilled_by_stock'|'purchased'|'received' — there is no
        // 'partial' status. A partial buy stays 'pending'; the UI derives
        // "partial" purely from ordered_qty vs required_qty, not this string.
        const newItemStatus = newOrdered >= requiredQty ? 'purchased' : 'pending';

        const { error: updateErr } = await supabase
          .from('purchase_order_items')
          .update({ status: newItemStatus, ordered_qty: newOrdered, unit_price: Number(c.rate), total_price: buyQty * Number(c.rate) })
          .eq('id', c.itemId);
        if (updateErr) throw new Error(`Couldn't update progress for ${c.productName}: ${updateErr.message}`);
      }

      toast.success(`✅ Purchase recorded for ${form.cart.length} item${form.cart.length > 1 ? 's' : ''} — payment sent to FF Ops for approval`);
      onSuccess();
      onClose();

      // Cleanup object URLs
      if (form.proofPhotoUrl) URL.revokeObjectURL(form.proofPhotoUrl);
      form.cart.forEach(c => {
        if (c.itemPhotoUrl)  URL.revokeObjectURL(c.itemPhotoUrl);
        if (c.scalePhotoUrl) URL.revokeObjectURL(c.scalePhotoUrl);
      });

    } catch (err: any) {
      toast.error(err.message || 'Failed to save purchase');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (form.proofPhotoUrl) URL.revokeObjectURL(form.proofPhotoUrl);
    form.cart.forEach(c => {
      if (c.itemPhotoUrl)  URL.revokeObjectURL(c.itemPhotoUrl);
      if (c.scalePhotoUrl) URL.revokeObjectURL(c.scalePhotoUrl);
    });
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
            Buy from Vendor
            <span className="text-sm text-gray-400 font-normal ml-1">({po.po_number} · {po.hub_name})</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Cart — one row per item being bought from this vendor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide">
                Items in this purchase ({form.cart.length})
              </label>
              {availableToAdd.length > 0 && (
                <select
                  value={addItemPicker}
                  onChange={e => { if (e.target.value) addItemToCart(e.target.value); }}
                  className="text-xs border border-dashed border-blue-300 text-blue-600 font-semibold rounded-lg px-2 py-1.5 bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">+ Add item from this PO…</option>
                  {availableToAdd.map(i => (
                    <option key={i.id} value={i.id}>{i.product_name || i.item_name}</option>
                  ))}
                </select>
              )}
            </div>

            {form.cart.length === 0 && (
              <div className="border border-dashed border-gray-200 rounded-xl py-6 text-center text-sm text-gray-400">
                No items added yet — use "+ Add item from this PO…" above to start.
              </div>
            )}

            <div className="space-y-2">
              {form.cart.map(c => {
                const rowTotal = (Number(c.qty) || 0) * (Number(c.rate) || 0);
                return (
                  <div key={c.itemId} className="border border-gray-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate">{c.productName}</p>
                        <p className="text-[11px] text-gray-500">
                          Required: {c.requiredQty.toFixed(1)} {c.unit}
                          {c.alreadyBought > 0 && (
                            <span className="text-orange-600 font-semibold"> · {c.alreadyBought.toFixed(1)} {c.unit} already bought · {c.remainingQty.toFixed(1)} {c.unit} remaining</span>
                          )}
                        </p>
                      </div>
                      {form.cart.length > 1 && (
                        <button onClick={() => removeCartRow(c.itemId)}
                          className="shrink-0 p-1 text-gray-300 hover:text-red-500 rounded-lg transition-colors">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Buy Qty ({c.unit})</label>
                        <input
                          type="number" min="0" step="0.1"
                          value={c.qty}
                          onChange={e => updateCartRow(c.itemId, { qty: e.target.value })}
                          placeholder="0.0"
                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-green-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Rate (₹/{c.unit})</label>
                        <input
                          type="number" min="0"
                          value={c.rate}
                          onChange={e => updateCartRow(c.itemId, { rate: e.target.value })}
                          placeholder="0"
                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-green-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Total</label>
                        <div className="w-full px-2.5 py-1.5 border border-green-200 bg-green-50 rounded-lg text-sm font-bold text-green-800">
                          ₹{rowTotal.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <PhotoBox
                        label="Item Photo" icon={ImageIcon} required
                        url={c.itemPhotoUrl}
                        onFile={f => handleCartPhotoFile(c.itemId, 'itemPhotoFile', 'itemPhotoUrl', f)}
                        onRemove={() => removeCartPhoto(c.itemId, 'itemPhotoFile', 'itemPhotoUrl')}
                      />
                      <PhotoBox
                        label="Weight Scale Photo" icon={Scale} required
                        url={c.scalePhotoUrl}
                        onFile={f => handleCartPhotoFile(c.itemId, 'scalePhotoFile', 'scalePhotoUrl', f)}
                        onRemove={() => removeCartPhoto(c.itemId, 'scalePhotoFile', 'scalePhotoUrl')}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {form.cart.length > 0 && (
              <div className="flex items-center justify-between bg-slate-800 text-white rounded-xl px-4 py-2.5">
                <span className="text-xs font-medium text-slate-300">Cart Total ({form.cart.length} item{form.cart.length > 1 ? 's' : ''})</span>
                <span className="text-lg font-black">₹{cartTotal.toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>

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

          {/* Shared payment-slip photo — one for the whole cart, uploaded last
              after all items and their own photos are added above */}
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">
              Finish the purchase
            </label>
            <div className="max-w-[180px]">
              <PhotoBox
                label="Payment Proof / Slip" icon={Banknote} required
                url={form.proofPhotoUrl}
                onFile={handleProofFile}
                onRemove={removeProofPhoto}
              />
            </div>
          </div>
          {form.cart.some(c => !c.itemPhotoUrl || !c.scalePhotoUrl) && (
            <p className="text-[11px] text-red-500 font-semibold flex items-center gap-1">
              <AlertCircle size={11} />
              Every item needs its own Item Photo and Weight Scale Photo before you can save.
            </p>
          )}
          {form.cart.every(c => c.itemPhotoUrl && c.scalePhotoUrl) && !form.proofPhotoUrl && (
            <p className="text-[11px] text-red-500 font-semibold flex items-center gap-1">
              <AlertCircle size={11} />
              Vendor payment proof / slip photo is mandatory
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
  onBuy: (po: PurchaseOrder) => void;
}) {
  const [open, setOpen] = useState(true); // default open so exec sees items immediately

  const itemsDone  = po.items.filter(i => ['purchased', 'received'].includes(i.status)).length;
  const itemsPartial = po.items.filter(i => !['purchased', 'received'].includes(i.status) && Number((i as any).ordered_qty ?? 0) > 0).length;
  const itemsTotal = po.items.length;
  const allDone = itemsTotal > 0 && itemsDone === itemsTotal;

  // Progress bar reflects actual quantity bought, not just fully-completed
  // item count — otherwise buying half of everything still shows 0%.
  const totalRequired = po.items.reduce((s, i) => s + Number(i.required_qty ?? 0), 0);
  const totalOrdered  = po.items.reduce((s, i) => s + Math.min(Number((i as any).ordered_qty ?? 0), Number(i.required_qty ?? 0)), 0);
  const pct = totalRequired > 0 ? Math.round((totalOrdered / totalRequired) * 100) : 0;

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm bg-white">
      {/* PO header */}
      <div className="w-full flex items-center gap-3 px-5 py-4 bg-white hover:bg-slate-50 transition-colors">
        <button onClick={() => setOpen(v => !v)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
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

        {/* One overall Buy button for the whole PO — opens the cart to pick items */}
        <button
          onClick={() => onBuy(po)}
          disabled={allDone}
          className={cn(
            'shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all',
            allDone
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 text-white shadow-sm hover:shadow-md'
          )}
        >
          <ShoppingBag size={13} />
          {allDone ? 'Done' : 'Buy'}
        </button>
      </div>

      {/* Item rows */}
      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {po.items.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-400">No items in this PO.</p>
          ) : po.items.map(item => {
            const done    = item.status === 'received' || item.status === 'purchased';
            const alreadyBought = Number(item.ordered_qty ?? 0);
            const partial = !done && alreadyBought > 0;
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

  const handleBuy = (po: PurchaseOrder) => {
    setActivePO(po);
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
  const boughtItems  = orders.reduce((s, po) => s + po.items.filter(i => ['purchased','received'].includes(i.status)).length, 0);
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
      {activePO && (
        <BuyDialog
          open={!!activePO}
          onClose={() => setActivePO(null)}
          po={activePO}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
