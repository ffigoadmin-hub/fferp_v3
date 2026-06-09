// @ts-nocheck
import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Plus, Search, SlidersHorizontal, MoreHorizontal, X,
  Package, ImagePlus, ChevronDown, ChevronRight, ChevronUp, Info,
  ArrowUpDown, Download, Upload, Settings2, RefreshCw,
  Maximize2, ArrowUp, ArrowDown, Check, Star, Columns, AlignLeft,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface Item {
  id: string;
  name: string;
  type: 'Goods' | 'Service';
  unit: string;
  selling_price: number | null;
  cost_price: number | null;
  website_price: number | null;
  sales_account: string;
  purchase_account: string;
  purchase_description: string;
  sales_description: string;
  preferred_vendor: string;
  is_published: boolean;
  image_url: string | null;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const fmt = (v: number | null) =>
  v == null ? '—' : `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const UNIT_OPTIONS = [
  'box', 'cm', 'dz', 'ft', 'g', 'in', 'kg', 'km', 'lb',
  'mg', 'ml', 'mt', 'nos', 'oz', 'pcs', 'sqft', 'sqmt', 'sqyd',
];

const SALES_ACCOUNTS = ['Sales', 'Discount', 'Other Income', 'Freight & Shipping'];
const PURCHASE_ACCOUNTS = ['Cost of Goods Sold', 'Purchases', 'Direct Expenses', 'Other Expenses'];

const emptyForm = () => ({
  name: '',
  type: 'Goods' as 'Goods' | 'Service',
  unit: '',
  selling_price: '',
  cost_price: '',
  sales_account: 'Sales',
  purchase_account: 'Cost of Goods Sold',
  sales_description: '',
  purchase_description: '',
  preferred_vendor: '',
  has_sales: true,
  has_purchase: true,
});

/* ─── New Item Drawer ────────────────────────────────────────────────────── */
function NewItemDrawer({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (item: Omit<Item, 'id'>) => void }) {
  const [form, setForm] = useState(emptyForm());
  const [images, setImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleImageFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).slice(0, 5).forEach(file => {
      const reader = new FileReader();
      reader.onload = e => setImages(prev => [...prev, e.target?.result as string]);
      reader.readAsDataURL(file);
    });
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave({
      name: form.name.trim(),
      type: form.type,
      unit: form.unit,
      selling_price: form.has_sales && form.selling_price !== '' ? Number(form.selling_price) : null,
      cost_price: form.has_purchase && form.cost_price !== '' ? Number(form.cost_price) : null,
      sales_account: form.sales_account,
      purchase_account: form.purchase_account,
      sales_description: form.sales_description,
      purchase_description: form.purchase_description,
      preferred_vendor: form.preferred_vendor,
    });
    setForm(emptyForm());
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      {/* Overlay — only covers left side, doesn't intercept drawer clicks */}
      <div className="flex-1 bg-black/20" onClick={onClose} />

      {/* Drawer — stop propagation so clicks inside never hit overlay */}
      <div className="w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl overflow-hidden"
        style={{ borderLeft: '1px solid #E5E7EB' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5"
          style={{ borderBottom: '1px solid #E5E7EB' }}>
          <h2 className="text-[20px] font-bold" style={{ color: '#111827' }}>New Item</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" style={{ color: '#6B7280' }} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Info banner */}
          <div className="mx-8 mt-5 flex items-start gap-3 p-4 rounded-xl"
            style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
            <Info className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#2563EB' }} />
            <p className="text-[13px]" style={{ color: '#1E40AF' }}>
              Do you want to keep track of this item?{' '}
              <span className="font-semibold underline cursor-pointer">Enable Inventory</span>
              {' '}to view its stock based on the sales and purchase transactions you record for it. Go to{' '}
              <b>Settings → Preferences → Items</b> and enable inventory.
            </p>
          </div>

          {/* Form grid */}
          <div className="px-8 pt-6 pb-4 flex gap-8">
            {/* Left fields */}
            <div className="flex-1 space-y-5">

              {/* Name */}
              <div>
                <label className="block text-[13px] font-semibold mb-1.5" style={{ color: '#DC2626' }}>
                  Name <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  className="w-full px-3 py-2 text-[13px] rounded-lg transition-all"
                  style={{ border: '1.5px solid #BFDBFE', background: '#FFFFFF', outline: 'none' }}
                  onFocus={e => (e.target.style.borderColor = '#2563EB')}
                  onBlur={e => (e.target.style.borderColor = '#BFDBFE')}
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-[13px] font-medium mb-2" style={{ color: '#374151' }}>Type</label>
                <div className="flex items-center gap-6">
                  {(['Goods', 'Service'] as const).map(t => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer">
                      <div
                        onClick={() => set('type', t)}
                        className="w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all"
                        style={{
                          borderColor: form.type === t ? '#2563EB' : '#D1D5DB',
                          background: form.type === t ? '#2563EB' : 'white',
                        }}>
                        {form.type === t && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <span className="text-[13px]" style={{ color: '#374151' }}>{t}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Unit */}
              <div>
                <label className="block text-[13px] font-medium mb-1.5" style={{ color: '#374151' }}>Unit</label>
                <div className="relative">
                  <select
                    value={form.unit}
                    onChange={e => set('unit', e.target.value)}
                    className="w-full px-3 py-2 text-[13px] rounded-lg appearance-none outline-none"
                    style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA', color: form.unit ? '#111827' : '#9CA3AF' }}>
                    <option value="">Select or type to add</option>
                    {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 pointer-events-none" style={{ color: '#9CA3AF' }} />
                </div>
              </div>
            </div>

            {/* Image upload */}
            <div className="w-48 shrink-0">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => handleImageFiles(e.target.files)}
              />

              {images.length > 0 ? (
                <div className="h-44 rounded-xl border-2 border-dashed overflow-hidden relative group"
                  style={{ borderColor: '#BFDBFE' }}>
                  <img src={images[0]} alt="item" className="w-full h-full object-cover" />
                  {images.length > 1 && (
                    <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">
                      +{images.length - 1} more
                    </div>
                  )}
                  <button
                    onClick={() => { setImages([]); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div
                  className="h-44 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
                  style={{ borderColor: '#D1D5DB' }}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = '#2563EB'; (e.currentTarget as HTMLElement).style.background = '#EFF6FF'; }}
                  onDragLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#D1D5DB'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  onDrop={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = '#D1D5DB'; (e.currentTarget as HTMLElement).style.background = 'transparent'; handleImageFiles(e.dataTransfer.files); }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F9FAFB'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <ImagePlus className="w-8 h-8" style={{ color: '#9CA3AF' }} />
                  <p className="text-[12px] text-center px-2" style={{ color: '#6B7280' }}>
                    Drag image(s) here or{' '}
                    <span className="font-semibold" style={{ color: '#2563EB' }}>Browse images</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mx-8" style={{ borderTop: '1px solid #F3F4F6' }} />

          {/* Sales Information */}
          <div className="px-8 py-5">
            <label className="flex items-center gap-2 mb-5 cursor-pointer">
              <div
                onClick={() => set('has_sales', !form.has_sales)}
                className="w-4 h-4 rounded flex items-center justify-center transition-all"
                style={{ background: form.has_sales ? '#2563EB' : 'white', border: `2px solid ${form.has_sales ? '#2563EB' : '#D1D5DB'}` }}>
                {form.has_sales && (
                  <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-white">
                    <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  </svg>
                )}
              </div>
              <span className="text-[15px] font-bold" style={{ color: '#111827' }}>Sales Information</span>
            </label>

            {form.has_sales && (
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#DC2626' }}>Selling Price *</label>
                  <div className="flex rounded-lg overflow-hidden" style={{ border: '1.5px solid #E5E7EB' }}>
                    <span className="px-3 py-2 text-[13px] font-medium" style={{ background: '#F9FAFB', color: '#6B7280', borderRight: '1px solid #E5E7EB' }}>INR</span>
                    <input type="number" value={form.selling_price} onChange={e => set('selling_price', e.target.value)}
                      className="flex-1 px-3 py-2 text-[13px] outline-none" style={{ background: '#FAFAFA' }} placeholder="0.00" />
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#DC2626' }}>Account *</label>
                  <div className="relative">
                    <select value={form.sales_account} onChange={e => set('sales_account', e.target.value)}
                      className="w-full px-3 py-2 text-[13px] rounded-lg appearance-none outline-none"
                      style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA' }}>
                      {SALES_ACCOUNTS.map(a => <option key={a}>{a}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 pointer-events-none" style={{ color: '#9CA3AF' }} />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-[12px] font-medium mb-1.5" style={{ color: '#374151' }}>Description</label>
                  <textarea rows={3} value={form.sales_description} onChange={e => set('sales_description', e.target.value)}
                    className="w-full px-3 py-2 text-[13px] rounded-lg resize-none outline-none"
                    style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA' }} />
                </div>
              </div>
            )}
          </div>

          <div className="mx-8" style={{ borderTop: '1px solid #F3F4F6' }} />

          {/* Purchase Information */}
          <div className="px-8 py-5">
            <label className="flex items-center gap-2 mb-5 cursor-pointer">
              <div
                onClick={() => set('has_purchase', !form.has_purchase)}
                className="w-4 h-4 rounded flex items-center justify-center transition-all"
                style={{ background: form.has_purchase ? '#2563EB' : 'white', border: `2px solid ${form.has_purchase ? '#2563EB' : '#D1D5DB'}` }}>
                {form.has_purchase && (
                  <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-white">
                    <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  </svg>
                )}
              </div>
              <span className="text-[15px] font-bold" style={{ color: '#111827' }}>Purchase Information</span>
            </label>

            {form.has_purchase && (
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#DC2626' }}>Cost Price *</label>
                  <div className="flex rounded-lg overflow-hidden" style={{ border: '1.5px solid #E5E7EB' }}>
                    <span className="px-3 py-2 text-[13px] font-medium" style={{ background: '#F9FAFB', color: '#6B7280', borderRight: '1px solid #E5E7EB' }}>INR</span>
                    <input type="number" value={form.cost_price} onChange={e => set('cost_price', e.target.value)}
                      className="flex-1 px-3 py-2 text-[13px] outline-none" style={{ background: '#FAFAFA' }} placeholder="0.00" />
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#DC2626' }}>Account *</label>
                  <div className="relative">
                    <select value={form.purchase_account} onChange={e => set('purchase_account', e.target.value)}
                      className="w-full px-3 py-2 text-[13px] rounded-lg appearance-none outline-none"
                      style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA' }}>
                      {PURCHASE_ACCOUNTS.map(a => <option key={a}>{a}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 pointer-events-none" style={{ color: '#9CA3AF' }} />
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-medium mb-1.5" style={{ color: '#374151' }}>Description</label>
                  <textarea rows={3} value={form.purchase_description} onChange={e => set('purchase_description', e.target.value)}
                    className="w-full px-3 py-2 text-[13px] rounded-lg resize-none outline-none"
                    style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA' }} />
                </div>
                <div>
                  <label className="block text-[12px] font-medium mb-1.5" style={{ color: '#374151' }}>Preferred Vendor</label>
                  <div className="relative">
                    <select value={form.preferred_vendor} onChange={e => set('preferred_vendor', e.target.value)}
                      className="w-full px-3 py-2 text-[13px] rounded-lg appearance-none outline-none"
                      style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA', color: form.preferred_vendor ? '#111827' : '#9CA3AF' }}>
                      <option value=""></option>
                      <option>Vendor A</option>
                      <option>Vendor B</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 pointer-events-none" style={{ color: '#9CA3AF' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* bottom padding */}
          <div className="h-6" />
        </div>

        {/* Footer */}
        <div className="px-8 py-4 flex items-center gap-3"
          style={{ borderTop: '1px solid #E5E7EB', background: '#FAFAFA' }}>
          <button
            onClick={handleSave}
            className="px-6 py-2 rounded-lg text-[13px] font-semibold text-white transition-colors"
            style={{ background: '#16A34A' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#15803D')}
            onMouseLeave={e => (e.currentTarget.style.background = '#16A34A')}>
            Save
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-[13px] font-medium transition-colors"
            style={{ border: '1px solid #E5E7EB', color: '#374151', background: '#FFFFFF' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Advanced Search Popup ──────────────────────────────────────────────── */
const emptySearch = () => ({
  searchIn: 'Items',
  filter: 'All',
  itemName: '',
  description: '',
  rate: '',
  purchaseRate: '',
  status: 'All',
  taxExemption: '',
  salesAccount: '',
  purchaseAccount: '',
});

function AdvancedSearchPopup({ open, onClose, onSearch }: {
  open: boolean;
  onClose: () => void;
  onSearch: (q: typeof emptySearch extends () => infer R ? R : never) => void;
}) {
  const [form, setForm] = useState(emptySearch());
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-16"
      style={{ background: 'rgba(0,0,0,0.35)' }}
      onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}
        onClick={e => e.stopPropagation()}>

        {/* Header bar */}
        <div className="flex items-center gap-4 px-6 py-4"
          style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
          {/* Search in */}
          <div className="flex items-center gap-3 flex-1">
            <span className="text-[13px] font-semibold shrink-0" style={{ color: '#374151' }}>Search</span>
            <div className="relative">
              <select
                value={form.searchIn}
                onChange={e => set('searchIn', e.target.value)}
                className="appearance-none px-3 py-1.5 pr-8 text-[13px] rounded-lg outline-none"
                style={{ border: '1px solid #D1D5DB', background: '#FFFFFF', color: '#111827', minWidth: '120px' }}>
                <option>Items</option>
                <option>Items & Contacts</option>
              </select>
              <ChevronDown className="absolute right-2 top-2 w-4 h-4 pointer-events-none" style={{ color: '#6B7280' }} />
            </div>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-semibold shrink-0" style={{ color: '#374151' }}>Filter</span>
            <div className="relative">
              <select
                value={form.filter}
                onChange={e => set('filter', e.target.value)}
                className="appearance-none px-3 py-1.5 pr-8 text-[13px] rounded-lg outline-none"
                style={{ border: '1px solid #D1D5DB', background: '#FFFFFF', color: '#111827', minWidth: '100px' }}>
                <option>All</option>
                <option>Active</option>
                <option>Inactive</option>
              </select>
              <ChevronDown className="absolute right-2 top-2 w-4 h-4 pointer-events-none" style={{ color: '#6B7280' }} />
            </div>
          </div>

          {/* Close */}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
            <X className="w-4 h-4" style={{ color: '#6B7280' }} />
          </button>
        </div>

        {/* Form body */}
        <div className="px-8 py-6 grid grid-cols-2 gap-x-10 gap-y-5">
          {/* Item Name */}
          <div className="flex items-center gap-4">
            <label className="text-[13px] font-medium shrink-0 w-32 text-right" style={{ color: '#374151' }}>Item Name</label>
            <input
              autoFocus
              value={form.itemName}
              onChange={e => set('itemName', e.target.value)}
              className="flex-1 px-3 py-1.5 text-[13px] rounded-lg outline-none"
              style={{ border: '1.5px solid #BFDBFE', background: '#FFFFFF' }}
              onFocus={e => (e.target.style.borderColor = '#2563EB')}
              onBlur={e => (e.target.style.borderColor = '#BFDBFE')}
            />
          </div>

          {/* Description */}
          <div className="flex items-center gap-4">
            <label className="text-[13px] font-medium shrink-0 w-32 text-right" style={{ color: '#374151' }}>Description</label>
            <input
              value={form.description}
              onChange={e => set('description', e.target.value)}
              className="flex-1 px-3 py-1.5 text-[13px] rounded-lg outline-none"
              style={{ border: '1.5px solid #E5E7EB', background: '#FFFFFF' }}
              onFocus={e => (e.target.style.borderColor = '#2563EB')}
              onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
            />
          </div>

          {/* Rate */}
          <div className="flex items-center gap-4">
            <label className="text-[13px] font-medium shrink-0 w-32 text-right" style={{ color: '#374151' }}>Rate</label>
            <input
              type="number"
              value={form.rate}
              onChange={e => set('rate', e.target.value)}
              className="flex-1 px-3 py-1.5 text-[13px] rounded-lg outline-none"
              style={{ border: '1.5px solid #E5E7EB', background: '#FFFFFF' }}
              onFocus={e => (e.target.style.borderColor = '#2563EB')}
              onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
            />
          </div>

          {/* Purchase Rate */}
          <div className="flex items-center gap-4">
            <label className="text-[13px] font-medium shrink-0 w-32 text-right" style={{ color: '#374151' }}>Purchase Rate</label>
            <input
              type="number"
              value={form.purchaseRate}
              onChange={e => set('purchaseRate', e.target.value)}
              className="flex-1 px-3 py-1.5 text-[13px] rounded-lg outline-none"
              style={{ border: '1.5px solid #E5E7EB', background: '#FFFFFF' }}
              onFocus={e => (e.target.style.borderColor = '#2563EB')}
              onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
            />
          </div>

          {/* Status */}
          <div className="flex items-center gap-4">
            <label className="text-[13px] font-medium shrink-0 w-32 text-right" style={{ color: '#374151' }}>Status</label>
            <div className="relative flex-1">
              <select
                value={form.status}
                onChange={e => set('status', e.target.value)}
                className="w-full appearance-none px-3 py-1.5 pr-8 text-[13px] rounded-lg outline-none"
                style={{ border: '1.5px solid #E5E7EB', background: '#FFFFFF', color: '#111827' }}>
                <option>All</option>
                <option>Active</option>
                <option>Inactive</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-2 w-4 h-4 pointer-events-none" style={{ color: '#6B7280' }} />
            </div>
          </div>

          {/* Tax Exemptions */}
          <div className="flex items-center gap-4">
            <label className="text-[13px] font-medium shrink-0 w-32 text-right" style={{ color: '#374151' }}>Tax Exemptions</label>
            <div className="relative flex-1">
              <select
                value={form.taxExemption}
                onChange={e => set('taxExemption', e.target.value)}
                className="w-full appearance-none px-3 py-1.5 pr-8 text-[13px] rounded-lg outline-none"
                style={{ border: '1.5px solid #E5E7EB', background: '#FFFFFF', color: form.taxExemption ? '#111827' : '#9CA3AF' }}>
                <option value="">Select a Tax Exemption</option>
                <option>GST Exempt</option>
                <option>Zero Rated</option>
                <option>Exempt</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-2 w-4 h-4 pointer-events-none" style={{ color: '#6B7280' }} />
            </div>
          </div>

          {/* Sales Account */}
          <div className="flex items-center gap-4">
            <label className="text-[13px] font-medium shrink-0 w-32 text-right" style={{ color: '#374151' }}>Sales Account</label>
            <div className="relative flex-1">
              <select
                value={form.salesAccount}
                onChange={e => set('salesAccount', e.target.value)}
                className="w-full appearance-none px-3 py-1.5 pr-8 text-[13px] rounded-lg outline-none"
                style={{ border: '1.5px solid #E5E7EB', background: '#FFFFFF', color: form.salesAccount ? '#111827' : '#9CA3AF' }}>
                <option value=""></option>
                {SALES_ACCOUNTS.map(a => <option key={a}>{a}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-2 w-4 h-4 pointer-events-none" style={{ color: '#6B7280' }} />
            </div>
          </div>

          {/* Purchase Account */}
          <div className="flex items-center gap-4">
            <label className="text-[13px] font-medium shrink-0 w-32 text-right" style={{ color: '#374151' }}>Purchase Account</label>
            <div className="relative flex-1">
              <select
                value={form.purchaseAccount}
                onChange={e => set('purchaseAccount', e.target.value)}
                className="w-full appearance-none px-3 py-1.5 pr-8 text-[13px] rounded-lg outline-none"
                style={{ border: '1.5px solid #BFDBFE', background: '#FFFFFF', color: form.purchaseAccount ? '#111827' : '#9CA3AF' }}
                onFocus={e => (e.target.style.borderColor = '#2563EB')}
                onBlur={e => (e.target.style.borderColor = '#BFDBFE')}>
                <option value=""></option>
                {PURCHASE_ACCOUNTS.map(a => <option key={a}>{a}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-2 w-4 h-4 pointer-events-none" style={{ color: '#6B7280' }} />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid #E5E7EB' }} />

        {/* Footer */}
        <div className="flex items-center justify-center gap-3 px-8 py-5">
          <button
            onClick={() => { onSearch(form); onClose(); }}
            className="px-8 py-2 rounded-lg text-[13px] font-semibold text-white transition-colors"
            style={{ background: '#16A34A' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#15803D')}
            onMouseLeave={e => (e.currentTarget.style.background = '#16A34A')}>
            Search
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg text-[13px] font-medium transition-colors"
            style={{ border: '1px solid #E5E7EB', color: '#374151', background: '#FFFFFF' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Dropdown Menu ──────────────────────────────────────────────────────── */
type SortField = 'name' | 'purchase_rate' | 'rate' | 'modified' | 'created';
type SortDir = 'asc' | 'desc';

function useOutsideClick(ref: React.RefObject<HTMLElement>, cb: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cb(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [cb]);
}

type ViewFilter = 'All' | 'Active' | 'Inactive' | 'Sales' | 'Purchases' | 'Services';

const VIEW_FILTERS: { key: ViewFilter; label: string }[] = [
  { key: 'All',       label: 'All' },
  { key: 'Active',    label: 'Active' },
  { key: 'Inactive',  label: 'Inactive' },
  { key: 'Sales',     label: 'Sales' },
  { key: 'Purchases', label: 'Purchases' },
  { key: 'Services',  label: 'Services' },
];

/* ─── Demo grocery seed (selling > cost for profit) ────────────────────── */
const DEMO_GROCERY_ITEMS = [
  { name: 'Onion',        category: 'Vegetables', unit: 'kg',  grade_a_price: 35,  grade_b_price: 28,  grade_c_price: 22,  is_active: true },
  { name: 'Tomato',       category: 'Vegetables', unit: 'kg',  grade_a_price: 50,  grade_b_price: 42,  grade_c_price: 32,  is_active: true },
  { name: 'Potato',       category: 'Vegetables', unit: 'kg',  grade_a_price: 40,  grade_b_price: 34,  grade_c_price: 26,  is_active: true },
  { name: 'Carrot',       category: 'Vegetables', unit: 'kg',  grade_a_price: 48,  grade_b_price: 40,  grade_c_price: 30,  is_active: true },
  { name: 'Green Chilli', category: 'Vegetables', unit: 'kg',  grade_a_price: 70,  grade_b_price: 58,  grade_c_price: 44,  is_active: true },
  { name: 'Garlic',       category: 'Vegetables', unit: 'kg',  grade_a_price: 140, grade_b_price: 115, grade_c_price: 90,  is_active: true },
  { name: 'Ginger',       category: 'Vegetables', unit: 'kg',  grade_a_price: 120, grade_b_price: 100, grade_c_price: 75,  is_active: true },
  { name: 'Banana',       category: 'Fruits',     unit: 'kg',  grade_a_price: 50,  grade_b_price: 40,  grade_c_price: 30,  is_active: true },
  { name: 'Rice',         category: 'Grains',     unit: 'kg',  grade_a_price: 80,  grade_b_price: 68,  grade_c_price: 52,  is_active: true },
  { name: 'Toor Dal',     category: 'Pulses',     unit: 'kg',  grade_a_price: 150, grade_b_price: 130, grade_c_price: 105, is_active: true },
  { name: 'Sunflower Oil',category: 'Oils',       unit: 'ltr', grade_a_price: 165, grade_b_price: 145, grade_c_price: 120, is_active: true },
  { name: 'Milk',         category: 'Dairy',      unit: 'ltr', grade_a_price: 68,  grade_b_price: 62,  grade_c_price: 52,  is_active: true },
];

/* maps a products row → Item interface */
function rowToItem(row: any): Item {
  return {
    id: row.id,
    name: row.name,
    type: 'Goods',
    unit: row.unit ?? 'kg',
    selling_price: row.grade_a_price ?? null,   // our selling price (higher)
    cost_price: row.grade_c_price ?? null,       // avg purchase price (lower → profit)
    sales_account: 'Sales',
    purchase_account: 'Cost of Goods Sold',
    sales_description: row.category ?? '',
    purchase_description: row.category ?? '',
    preferred_vendor: '',
    website_price: row.website_price ?? row.price ?? null,
    is_published: row.is_published ?? false,
    image_url: row.image_url ?? null,
  };
}

/* ─── Items List Page ────────────────────────────────────────────────────── */
export default function ItemsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [clipText, setClipText] = useState(true);
  const [starredFilters, setStarredFilters] = useState<Set<ViewFilter>>(new Set(['Active']));

  /* ── Fetch from Supabase products table ── */
  const { data: rawProducts = [], isLoading, refetch } = useQuery({
    queryKey: ['items-products'],
    queryFn: async () => {
      // Try to load; if empty, seed demo data first
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');
      if (error) throw error;

      if (!data || data.length === 0) {
        // Seed demo grocery items
        const { error: seedErr } = await supabase
          .from('products')
          .insert(DEMO_GROCERY_ITEMS);
        if (seedErr) console.error('Seed error:', seedErr);
        const { data: seeded } = await supabase
          .from('products').select('*').order('name');
        return seeded ?? [];
      }
      return data;
    },
  });

  const items: Item[] = rawProducts.map(rowToItem);

  /* ── Save new item to Supabase ── */
  const saveItem = useMutation({
    mutationFn: async (item: Omit<Item, 'id'>) => {
      const midPrice = Math.round(((item.selling_price ?? 0) + (item.cost_price ?? 0)) / 2);
      const { error } = await supabase.from('products').insert({
        name: item.name,
        unit: item.unit,
        category: item.sales_description || item.purchase_description || 'General',
        grade_a_price: item.selling_price ?? 0,   // selling price
        grade_b_price: midPrice,                  // mid grade
        grade_c_price: item.cost_price ?? 0,      // cost / purchase price
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Item saved!');
      qc.invalidateQueries({ queryKey: ['items-products'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // View filter (All Items dropdown)
  const [viewFilter, setViewFilter] = useState<ViewFilter>('Active');
  const [showViewMenu, setShowViewMenu] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  useOutsideClick(viewMenuRef, () => setShowViewMenu(false));

  // Sort state
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Advanced search popup
  const [showAdvSearch, setShowAdvSearch] = useState(false);
  const [advSearchQuery, setAdvSearchQuery] = useState<ReturnType<typeof emptySearch> | null>(null);

  // Menus
  const [showKebab, setShowKebab] = useState(false);
  const [kebabSub, setKebabSub] = useState<'sort' | 'export' | null>(null);
  const kebabRef = useRef<HTMLDivElement>(null);
  useOutsideClick(kebabRef, () => { setShowKebab(false); setKebabSub(null); });

  // Sliders (columns) menu
  const [showColMenu, setShowColMenu] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);
  useOutsideClick(colMenuRef, () => setShowColMenu(false));

  // NAME column sort dropdown
  const [showNameSort, setShowNameSort] = useState(false);
  const nameSortRef = useRef<HTMLDivElement>(null);
  useOutsideClick(nameSortRef, () => setShowNameSort(false));

  const toggleStar = (key: ViewFilter) => {
    setStarredFilters(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  };

  // Sort helpers
  const SORT_OPTIONS: { key: SortField; label: string }[] = [
    { key: 'name',          label: 'Name' },
    { key: 'purchase_rate', label: 'Purchase Rate' },
    { key: 'rate',          label: 'Rate' },
    { key: 'modified',      label: 'Last Modified Time' },
    { key: 'created',       label: 'Created Time' },
  ];

  const handleSort = (field: SortField, closeAll = false) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    if (closeAll) { setShowKebab(false); setKebabSub(null); }
    setShowNameSort(false);
  };

  const handleExport = (type: 'all' | 'view') => {
    const data = type === 'view' ? filtered : items;
    const csv = ['Name,Type,Unit,Selling Price,Cost Price',
      ...data.map(i => `${i.name},${i.type},${i.unit},${i.selling_price ?? ''},${i.cost_price ?? ''}`)
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'items.csv'; a.click();
    URL.revokeObjectURL(url);
    setShowKebab(false); setKebabSub(null);
  };

  const getSortValue = (item: Item, field: SortField) => {
    if (field === 'name') return item.name.toLowerCase();
    if (field === 'purchase_rate') return item.cost_price ?? -Infinity;
    if (field === 'rate') return item.selling_price ?? -Infinity;
    return item.name.toLowerCase();
  };

  const filtered = items
    .filter(it => {
      const matchSearch = it.name.toLowerCase().includes(search.toLowerCase());
      let matchView = true;
      if (viewFilter === 'Services') matchView = it.type === 'Service';
      if (viewFilter === 'Sales') matchView = it.selling_price != null;
      if (viewFilter === 'Purchases') matchView = it.cost_price != null;

      // Advanced search filters
      let matchAdv = true;
      if (advSearchQuery) {
        const q = advSearchQuery;
        if (q.itemName) matchAdv = matchAdv && it.name.toLowerCase().includes(q.itemName.toLowerCase());
        if (q.description) matchAdv = matchAdv && (
          it.sales_description.toLowerCase().includes(q.description.toLowerCase()) ||
          it.purchase_description.toLowerCase().includes(q.description.toLowerCase())
        );
        if (q.rate) matchAdv = matchAdv && it.selling_price != null && it.selling_price === Number(q.rate);
        if (q.purchaseRate) matchAdv = matchAdv && it.cost_price != null && it.cost_price === Number(q.purchaseRate);
        if (q.salesAccount) matchAdv = matchAdv && it.sales_account === q.salesAccount;
        if (q.purchaseAccount) matchAdv = matchAdv && it.purchase_account === q.purchaseAccount;
      }

      return matchSearch && matchView && matchAdv;
    })
    .sort((a, b) => {
      const av = getSortValue(a, sortField), bv = getSortValue(b, sortField);
      return sortDir === 'asc' ? (av < bv ? -1 : av > bv ? 1 : 0) : (av > bv ? -1 : av < bv ? 1 : 0);
    });

  const toggleSelect = (id: string) => {
    setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const handleSave = (item: Omit<Item, 'id'>) => {
    saveItem.mutate(item);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: '#F9FAFB', minHeight: '100vh' }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3.5"
        style={{ background: '#FFFFFF', borderBottom: '1px solid #E5E7EB' }}>

        {/* Left: "All Items ▼" dropdown */}
        <div className="relative" ref={viewMenuRef}>
          <button
            onClick={() => setShowViewMenu(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[15px] font-bold transition-colors"
            style={{ color: '#111827', background: showViewMenu ? '#F9FAFB' : 'transparent' }}>
            {viewFilter === 'Active' ? 'All Items' : viewFilter}
            {showViewMenu
              ? <ChevronUp className="w-4 h-4" style={{ color: '#2563EB' }} />
              : <ChevronDown className="w-4 h-4" style={{ color: '#2563EB' }} />}
          </button>

          {showViewMenu && (
            <div className="absolute left-0 top-[calc(100%+4px)] z-50 rounded-xl shadow-xl w-52 overflow-hidden"
              style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
              {VIEW_FILTERS.map(vf => (
                <button key={vf.key}
                  onClick={() => { setViewFilter(vf.key); setShowViewMenu(false); }}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-[13px] transition-colors"
                  style={{
                    background: viewFilter === vf.key ? '#2563EB' : 'transparent',
                    color: viewFilter === vf.key ? '#FFFFFF' : '#374151',
                  }}
                  onMouseEnter={e => { if (viewFilter !== vf.key) (e.currentTarget as HTMLElement).style.background = '#F9FAFB'; }}
                  onMouseLeave={e => { if (viewFilter !== vf.key) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  <span>{vf.label}</span>
                  <Star
                    className="w-4 h-4 cursor-pointer transition-colors"
                    style={{ color: starredFilters.has(vf.key) ? '#FBBF24' : (viewFilter === vf.key ? 'rgba(255,255,255,0.6)' : '#D1D5DB') }}
                    onClick={e => { e.stopPropagation(); toggleStar(vf.key); }}
                    fill={starredFilters.has(vf.key) ? '#FBBF24' : 'none'}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">

          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: '#9CA3AF' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search items..." className="text-[13px] outline-none bg-transparent w-40"
              style={{ color: '#111827' }} />
          </div>

          {/* Sliders → Customize Columns / Clip Text */}
          <div className="relative" ref={colMenuRef}>
            <button
              onClick={() => setShowColMenu(v => !v)}
              className="p-2 rounded-lg transition-colors"
              style={{
                border: '1px solid #E5E7EB',
                background: showColMenu ? '#EFF6FF' : '#FFFFFF',
                color: showColMenu ? '#2563EB' : '#6B7280',
              }}>
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            {showColMenu && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-50 rounded-xl shadow-xl overflow-hidden w-48"
                style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-[13px] transition-colors hover:bg-gray-50"
                  style={{ color: '#374151' }}
                  onClick={() => setShowColMenu(false)}>
                  <Columns className="w-4 h-4" style={{ color: '#2563EB' }} />
                  Customize Columns
                </button>
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-semibold transition-colors"
                  style={{ background: '#2563EB', color: '#FFFFFF' }}
                  onClick={() => { setClipText(v => !v); setShowColMenu(false); }}>
                  <AlignLeft className="w-4 h-4" />
                  {clipText ? 'Clip Text' : 'Wrap Text'}
                </button>
              </div>
            )}
          </div>

          {/* Kebab (...) */}
          <div className="relative" ref={kebabRef}>
            <button
              onClick={() => { setShowKebab(v => !v); setKebabSub(null); }}
              className="p-2 rounded-lg transition-colors"
              style={{
                border: '1px solid #E5E7EB',
                background: showKebab ? '#EFF6FF' : '#FFFFFF',
                color: showKebab ? '#2563EB' : '#6B7280',
              }}>
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showKebab && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-50 flex"
                style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.12))' }}>

                {/* Sort sub-panel (left of main when open) */}
                {kebabSub === 'sort' && (
                  <div className="rounded-xl overflow-hidden mr-1 w-48"
                    style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
                    {SORT_OPTIONS.map(opt => (
                      <button key={opt.key} onClick={() => handleSort(opt.key, true)}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-[13px] transition-colors hover:bg-gray-50"
                        style={{ color: '#374151' }}>
                        <span style={{ color: sortField === opt.key ? '#2563EB' : '#374151', fontWeight: sortField === opt.key ? 600 : 400 }}>
                          {opt.label}
                        </span>
                        {sortField === opt.key && (
                          sortDir === 'asc'
                            ? <ArrowUp className="w-3.5 h-3.5" style={{ color: '#2563EB' }} />
                            : <ArrowDown className="w-3.5 h-3.5" style={{ color: '#2563EB' }} />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Export sub-panel */}
                {kebabSub === 'export' && (
                  <div className="rounded-xl overflow-hidden mr-1 w-44"
                    style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
                    <button onClick={() => handleExport('all')}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] text-left hover:bg-gray-50 transition-colors"
                      style={{ color: '#374151' }}>
                      <Download className="w-3.5 h-3.5" style={{ color: '#2563EB' }} /> Export Items
                    </button>
                    <button onClick={() => handleExport('view')}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] text-left hover:bg-gray-50 transition-colors"
                      style={{ color: '#374151' }}>
                      <Download className="w-3.5 h-3.5" style={{ color: '#2563EB' }} /> Export Current View
                    </button>
                  </div>
                )}

                {/* Main kebab menu */}
                <div className="rounded-xl overflow-hidden w-52"
                  style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
                  {/* Sort by */}
                  <button
                    onClick={() => setKebabSub(v => v === 'sort' ? null : 'sort')}
                    className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-[13px] transition-colors hover:bg-gray-50"
                    style={{ color: '#374151', background: kebabSub === 'sort' ? '#EFF6FF' : 'transparent' }}>
                    <div className="flex items-center gap-2">
                      <ArrowUpDown className="w-3.5 h-3.5" style={{ color: '#6B7280' }} />
                      <span style={{ color: kebabSub === 'sort' ? '#2563EB' : '#374151' }}>Sort by</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} />
                  </button>

                  <div style={{ borderTop: '1px solid #F3F4F6' }} />

                  {/* Import */}
                  <button className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] transition-colors hover:bg-gray-50" style={{ color: '#374151' }}>
                    <Upload className="w-3.5 h-3.5" style={{ color: '#6B7280' }} />
                    Import Items
                  </button>

                  {/* Export */}
                  <button
                    onClick={() => setKebabSub(v => v === 'export' ? null : 'export')}
                    className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-[13px] transition-colors hover:bg-gray-50"
                    style={{ color: '#374151', background: kebabSub === 'export' ? '#EFF6FF' : 'transparent' }}>
                    <div className="flex items-center gap-2">
                      <Download className="w-3.5 h-3.5" style={{ color: '#6B7280' }} />
                      <span style={{ color: kebabSub === 'export' ? '#2563EB' : '#374151' }}>Export</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} />
                  </button>

                  <div style={{ borderTop: '1px solid #F3F4F6' }} />

                  {/* Preferences */}
                  <button className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] transition-colors hover:bg-gray-50" style={{ color: '#374151' }}>
                    <Settings2 className="w-3.5 h-3.5" style={{ color: '#6B7280' }} />
                    Preferences
                  </button>

                  {/* Refresh */}
                  <button onClick={() => { refetch(); setShowKebab(false); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] transition-colors hover:bg-gray-50" style={{ color: '#374151' }}>
                    <RefreshCw className="w-3.5 h-3.5" style={{ color: '#6B7280' }} />
                    Refresh List
                  </button>

                  {/* Reset Column Width */}
                  <button onClick={() => setShowKebab(false)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] transition-colors hover:bg-gray-50" style={{ color: '#374151' }}>
                    <Maximize2 className="w-3.5 h-3.5" style={{ color: '#6B7280' }} />
                    Reset Column Width
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* + New */}
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold text-white transition-colors"
            style={{ background: '#16A34A' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#15803D')}
            onMouseLeave={e => (e.currentTarget.style.background = '#16A34A')}>
            <Plus className="w-4 h-4" /> New
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-sm text-gray-400 gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Loading items from database…
          </div>
        ) : (
        <table className="w-full">
          <thead>
            <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E5E7EB' }}>
              <th className="w-10 px-4 py-3">
                <input type="checkbox" className="w-3.5 h-3.5 rounded accent-blue-600"
                  onChange={e => setSelected(e.target.checked ? new Set(items.map(i => i.id)) : new Set())}
                  checked={items.length > 0 && selected.size === items.length}
                />
              </th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#6B7280', position: 'relative' }}>
                <div className="relative" ref={nameSortRef}>
                  <button
                    onClick={() => setShowNameSort(v => !v)}
                    className="flex items-center gap-1 rounded px-1 py-0.5 transition-colors"
                    style={{
                      color: showNameSort ? '#2563EB' : '#6B7280',
                      background: showNameSort ? '#EFF6FF' : 'transparent',
                      fontWeight: 600,
                      fontSize: '11px',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                    }}>
                    NAME
                    {sortDir === 'asc'
                      ? <ArrowUp className="w-3 h-3" style={{ color: '#2563EB' }} />
                      : <ArrowDown className="w-3 h-3" style={{ color: '#2563EB' }} />}
                  </button>

                  {showNameSort && (
                    <div
                      className="absolute left-0 top-[calc(100%+4px)] z-50 rounded-xl shadow-xl overflow-hidden"
                      style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', minWidth: '180px' }}>
                      {SORT_OPTIONS.map(opt => (
                        <button
                          key={opt.key}
                          onClick={() => handleSort(opt.key)}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-[13px] transition-colors hover:bg-gray-50"
                          style={{ color: sortField === opt.key ? '#2563EB' : '#374151' }}>
                          <span style={{ fontWeight: sortField === opt.key ? 600 : 400 }}>
                            {opt.label}
                          </span>
                          {sortField === opt.key && (
                            sortDir === 'asc'
                              ? <ArrowUp className="w-3.5 h-3.5" style={{ color: '#2563EB' }} />
                              : <ArrowDown className="w-3.5 h-3.5" style={{ color: '#2563EB' }} />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>PURCHASE DESCRIPTION</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>PURCHASE RATE</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>DESCRIPTION</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>RATE</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>USAGE UNIT</th>
              <th className="text-center px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>ONLINE</th>
              <th className="w-10 px-4 py-3">
                <button
                  onClick={() => setShowAdvSearch(true)}
                  className="p-1 rounded-lg transition-colors relative"
                  title="Advanced Search"
                  style={{ background: advSearchQuery ? '#EFF6FF' : 'transparent' }}>
                  <Search className="w-3.5 h-3.5" style={{ color: advSearchQuery ? '#2563EB' : '#9CA3AF' }} />
                  {advSearchQuery && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: '#2563EB' }} />
                  )}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item, idx) => (
              <tr key={item.id}
                className="transition-colors cursor-pointer"
                style={{ background: selected.has(item.id) ? '#EFF6FF' : idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA', borderBottom: '1px solid #F3F4F6' }}
                onMouseEnter={e => { if (!selected.has(item.id)) (e.currentTarget as HTMLElement).style.background = '#F8FAFF'; }}
                onMouseLeave={e => { if (!selected.has(item.id)) (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA'; }}>
                <td className="px-4 py-3.5">
                  <input type="checkbox" className="w-3.5 h-3.5 rounded accent-blue-600"
                    checked={selected.has(item.id)}
                    onChange={() => toggleSelect(item.id)} />
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: '#EFF6FF' }}>
                      <Package className="w-3.5 h-3.5" style={{ color: '#2563EB' }} />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold" style={{ color: '#111827' }}>{item.name}</p>
                      <p className="text-[11px]" style={{ color: '#9CA3AF' }}>{item.type}</p>
                    </div>
                  </div>
                </td>
                <td className={`px-4 py-3.5 text-[13px] max-w-[160px] ${clipText ? 'truncate' : 'whitespace-normal'}`} style={{ color: '#6B7280' }}>
                  {item.purchase_description || '—'}
                </td>
                <td className="px-4 py-3.5 text-right text-[13px] font-mono" style={{ color: '#374151' }}>
                  {fmt(item.cost_price)}
                </td>
                <td className={`px-4 py-3.5 text-[13px] max-w-[160px] ${clipText ? 'truncate' : 'whitespace-normal'}`} style={{ color: '#6B7280' }}>
                  {item.sales_description || '—'}
                </td>
                <td className="px-4 py-3.5 text-right text-[13px] font-mono font-semibold" style={{ color: '#111827' }}>
                  {fmt(item.selling_price)}
                </td>
                <td className="px-4 py-3.5 text-[13px]" style={{ color: '#6B7280' }}>
                  {item.unit || '—'}
                </td>
                <td className="px-4 py-3.5 text-center">
                  {item.is_published ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: '#DCFCE7', color: '#16A34A' }}>● Live</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: '#F3F4F6', color: '#9CA3AF' }}>○ Draft</span>
                  )}
                </td>
                <td className="px-4 py-3.5" />
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9}>
                  <div className="flex flex-col items-center justify-center py-28 px-6">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                      style={{ background: '#EFF6FF' }}>
                      <Package className="w-8 h-8" style={{ color: '#2563EB' }} />
                    </div>
                    <p className="text-[16px] font-semibold mb-2" style={{ color: '#374151' }}>
                      {search ? 'No items match your search' : 'Goods and Services, if they have a price tag, put them here.'}
                    </p>
                    {!search && (
                      <button
                        onClick={() => setShowNew(true)}
                        className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white"
                        style={{ background: '#16A34A' }}>
                        <Plus className="w-4 h-4" /> New Item
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        )}
      </div>

      {/* New Item Drawer */}
      <NewItemDrawer open={showNew} onClose={() => setShowNew(false)} onSave={handleSave} />

      {/* Advanced Search Popup */}
      <AdvancedSearchPopup
        open={showAdvSearch}
        onClose={() => setShowAdvSearch(false)}
        onSearch={q => setAdvSearchQuery(q)}
      />
    </div>
  );
}
