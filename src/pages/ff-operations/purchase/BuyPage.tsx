// @ts-nocheck
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  ArrowLeft, Plus, X, Upload, CheckCircle2, AlertCircle,
  Scale, Package, Building2, CreditCard, User, Trash2,
  ShoppingBag, ChevronDown, Image, FileCheck, Banknote,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchStoredVendors, vendorDisplayName, type StoredVendor } from '@/lib/vendorStore';
import {
  saveBuyOrder, fetchBuyOrderByProduct, markBuyOrderBillCreated,
  type BuyVendorEntry, type BuyOrder,
} from '@/lib/buyStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VendorCard {
  id: string;
  type: 'static' | 'dynamic';
  vendorName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  gstin: string;
  phone: string;
  itemName: string;
  buyQty: number | '';
  price: number | '';
  itemImageFile: File | null;
  itemImageUrl: string;
  weightScaleFile: File | null;
  weightScaleUrl: string;
}

function emptyDynamic(): VendorCard {
  return {
    id: `dyn-${Date.now()}`,
    type: 'dynamic',
    vendorName: '', bankName: '', accountNumber: '', ifscCode: '',
    gstin: '', phone: '', itemName: '',
    buyQty: '', price: '',
    itemImageFile: null, itemImageUrl: '',
    weightScaleFile: null, weightScaleUrl: '',
  };
}

function staticFromVendor(v: StoredVendor): VendorCard {
  const bank = v.banks?.[0];
  return {
    id: `static-${v.id}-${Date.now()}`,
    type: 'static',
    vendorName: vendorDisplayName(v),
    bankName: bank?.bankName ?? '',
    accountNumber: bank?.accountNumber ?? '',
    ifscCode: bank?.ifscCode ?? '',
    gstin: v.gstin ?? '',
    phone: v.mobile ?? v.workPhone ?? '',
    itemName: '',
    buyQty: '', price: '',
    itemImageFile: null, itemImageUrl: '',
    weightScaleFile: null, weightScaleUrl: '',
  };
}

// ─── Image Upload Box ─────────────────────────────────────────────────────────

function ImageUploadBox({
  label, icon: Icon, required, imageUrl, onFile, onRemove,
}: {
  label: string; icon: React.ElementType; required?: boolean;
  imageUrl: string; onFile: (f: File) => void; onRemove: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-xs font-semibold text-gray-600">
        <Icon size={12} />
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {imageUrl && <CheckCircle2 size={12} className="text-green-500 ml-auto" />}
        {!imageUrl && required && <AlertCircle size={12} className="text-red-400 ml-auto" />}
      </div>
      {imageUrl ? (
        <div className="relative w-full h-28 rounded-xl overflow-hidden border-2 border-green-200 bg-green-50">
          <img src={imageUrl} alt={label} className="w-full h-full object-cover" />
          <button
            onClick={onRemove}
            className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-full hover:bg-red-600"
          >
            <X size={10} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className={`w-full h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-colors
            ${required ? 'border-amber-300 bg-amber-50 hover:bg-amber-100' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}
        >
          <Upload size={18} className={required ? 'text-amber-400' : 'text-gray-400'} />
          <span className="text-xs text-gray-500">Click to upload</span>
          {required && <span className="text-[10px] text-amber-600 font-semibold">Required</span>}
        </button>
      )}
      <input
        ref={ref} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
      />
    </div>
  );
}

// ─── Vendor Card ──────────────────────────────────────────────────────────────

function VendorBuyCard({
  card, onChange, onRemove, productName,
}: {
  card: VendorCard;
  onChange: (updated: VendorCard) => void;
  onRemove: () => void;
  productName: string;
}) {
  const set = (k: keyof VendorCard, v: any) => onChange({ ...card, [k]: v });

  const handleImage = (key: 'itemImageFile' | 'weightScaleFile', urlKey: 'itemImageUrl' | 'weightScaleUrl', file: File) => {
    const url = URL.createObjectURL(file);
    onChange({ ...card, [key]: file, [urlKey]: url });
  };

  const removeImage = (key: 'itemImageFile' | 'weightScaleFile', urlKey: 'itemImageUrl' | 'weightScaleUrl') => {
    if (card[urlKey]) URL.revokeObjectURL(card[urlKey]);
    onChange({ ...card, [key]: null, [urlKey]: '' });
  };

  const buyQtyNum = Number(card.buyQty) || 0;
  const priceNum = Number(card.price) || 0;
  const amount = buyQtyNum * priceNum;
  const isComplete = buyQtyNum > 0 && priceNum > 0 && card.itemImageUrl && card.weightScaleUrl;

  return (
    <div className={`rounded-2xl border-2 p-5 space-y-4 transition-all ${isComplete ? 'border-green-200 bg-green-50/30' : 'border-gray-100 bg-white'}`}>

      {/* Card Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={`px-2.5 py-1 rounded-full text-xs font-bold ${card.type === 'static' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
            {card.type === 'static' ? '⭐ Regular Vendor' : '➕ Dynamic Vendor'}
          </div>
          {isComplete && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
              <CheckCircle2 size={10} /> Done
            </span>
          )}
        </div>
        <button onClick={onRemove} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
          <Trash2 size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Left: Vendor Details */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <Building2 size={11} /> Vendor Details
          </h4>

          {card.type === 'static' ? (
            /* Static: read-only vendor info */
            <div className="space-y-2 bg-blue-50 rounded-xl p-3">
              <div>
                <p className="text-xs text-gray-500">Vendor Name</p>
                <p className="text-sm font-bold text-gray-900">{card.vendorName}</p>
              </div>
              {card.phone && <div><p className="text-xs text-gray-500">Phone</p><p className="text-sm text-gray-800">{card.phone}</p></div>}
              {card.gstin && <div><p className="text-xs text-gray-500">GSTIN</p><p className="text-xs font-mono text-gray-700">{card.gstin}</p></div>}
              {card.bankName && (
                <div className="pt-1 border-t border-blue-100">
                  <p className="text-xs text-gray-500">Bank</p>
                  <p className="text-sm text-gray-800">{card.bankName}</p>
                  <p className="text-xs font-mono text-gray-600">{card.accountNumber}</p>
                  <p className="text-xs font-mono text-gray-500">IFSC: {card.ifscCode}</p>
                </div>
              )}
            </div>
          ) : (
            /* Dynamic: editable fields */
            <div className="space-y-2">
              {[
                { label: 'Vendor Name *', key: 'vendorName', placeholder: 'Enter vendor name' },
                { label: 'Phone', key: 'phone', placeholder: 'Mobile number' },
                { label: 'GSTIN', key: 'gstin', placeholder: 'GST Number' },
                { label: 'Bank Name', key: 'bankName', placeholder: 'Bank name' },
                { label: 'Account No.', key: 'accountNumber', placeholder: 'Account number' },
                { label: 'IFSC Code', key: 'ifscCode', placeholder: 'IFSC code' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">{f.label}</label>
                  <input
                    value={card[f.key] || ''}
                    onChange={e => set(f.key as keyof VendorCard, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Purchase Details */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <Package size={11} /> Purchase Details
          </h4>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">Item Name *</label>
            <input
              value={card.itemName}
              onChange={e => set('itemName', e.target.value)}
              placeholder={productName}
              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">Qty (kg) *</label>
              <input
                type="number" min="0"
                value={card.buyQty}
                onChange={e => set('buyQty', e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="0"
                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">Rate (₹/kg) *</label>
              <input
                type="number" min="0"
                value={card.price}
                onChange={e => set('price', e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="0"
                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {amount > 0 && (
            <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
              <span className="text-xs text-gray-500">Amount</span>
              <span className="text-sm font-bold text-gray-900">₹{amount.toLocaleString('en-IN')}</span>
            </div>
          )}

          {/* Image Uploads */}
          <div className="pt-2 space-y-3">
            <ImageUploadBox
              label="Item Photo"
              icon={Image}
              required
              imageUrl={card.itemImageUrl}
              onFile={f => handleImage('itemImageFile', 'itemImageUrl', f)}
              onRemove={() => removeImage('itemImageFile', 'itemImageUrl')}
            />
            <ImageUploadBox
              label="Weight Scale Photo"
              icon={Scale}
              required
              imageUrl={card.weightScaleUrl}
              onFile={f => handleImage('weightScaleFile', 'weightScaleUrl', f)}
              onRemove={() => removeImage('weightScaleFile', 'weightScaleUrl')}
            />
            {!card.weightScaleUrl && (
              <p className="text-[10px] text-red-500 font-semibold flex items-center gap-1">
                <AlertCircle size={10} /> Weight scale photo is mandatory — purchase will not be accepted without it
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Bill Creation Helper ─────────────────────────────────────────────────────

function createBillsFromBuyOrder(
  cards: VendorCard[],
  product: string,
  date: string,
): void {
  const BILL_STORE_KEY = 'ff_erp_bills_v1';
  let bills: any[] = [];
  try { bills = JSON.parse(localStorage.getItem(BILL_STORE_KEY) ?? '[]'); } catch {}

  const maxSerial = bills.reduce((m: number, b: any) => {
    const n = parseInt((b.billNumber ?? '').replace('BILL-', ''), 10) || 0;
    return Math.max(m, n);
  }, 0);

  cards.forEach((card, idx) => {
    const qty = Number(card.buyQty) || 0;
    const price = Number(card.price) || 0;
    const subTotal = qty * price;
    const cgst = Math.round(subTotal * 0.025);
    const sgst = Math.round(subTotal * 0.025);
    const total = subTotal + cgst + sgst;

    const bill = {
      id: `buy-bill-${Date.now()}-${idx}`,
      billNumber: `BILL-${String(maxSerial + idx + 1).padStart(3, '0')}`,
      billDate: date,
      dueDate: '',
      poReference: '',
      vendor: {
        name: card.vendorName,
        phone: card.phone,
        email: '',
        address: '',
        gstin: card.gstin,
        pan: '',
      },
      bank: {
        bankName: card.bankName,
        accountNumber: card.accountNumber,
        ifscCode: card.ifscCode,
        branch: '',
        accountType: '',
      },
      lineItems: [{
        id: 1,
        product: card.itemName || product,
        qty,
        unit: 'kg',
        rate: price,
        discount: 0,
        tax: 5,
        amount: subTotal,
      }],
      notes: `Auto-generated from Buy order for ${product}`,
      paymentTerms: 'Due on Receipt',
      status: 'pending',
      subTotal,
      discountAmount: 0,
      taxableAmount: subTotal,
      cgst,
      sgst,
      total,
      autoGenerated: true,
      createdAt: new Date().toISOString(),
    };
    bills.unshift(bill);
  });

  localStorage.setItem(BILL_STORE_KEY, JSON.stringify(bills));
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BuyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as { product?: string; qty?: number; unit?: string };

  const product = state.product ?? '';
  const requiredQty = state.qty ?? 0;
  const unit = state.unit ?? 'kg';
  const today = format(new Date(), 'yyyy-MM-dd');

  // Redirect if no product
  useEffect(() => {
    if (!product) navigate('/purchase/auto-po', { replace: true });
  }, [product]);

  const [cards, setCards] = useState<VendorCard[]>([]);
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');
  const [billCreated, setBillCreated] = useState(false);

  const { data: allVendors = [] } = useQuery({
    queryKey: ['vendors-list'],
    queryFn: fetchStoredVendors,
  });
  const filteredVendors = allVendors.filter((v: StoredVendor) =>
    vendorDisplayName(v).toLowerCase().includes(vendorSearch.toLowerCase())
  );

  // Load existing buy order if any
  useEffect(() => {
    if (!product) return;
    fetchBuyOrderByProduct(product).then(existing => {
      if (existing) setBillCreated(existing.billCreated);
    });
  }, [product]);

  // ── Computed ────────────────────────────────────────────────
  const totalBought = cards.reduce((s, c) => s + (Number(c.buyQty) || 0), 0);
  const balance = Math.max(0, requiredQty - totalBought);
  const progressPct = requiredQty > 0 ? Math.min(100, Math.round((totalBought / requiredQty) * 100)) : 0;

  const allImagesOk = cards.length > 0 && cards.every(c => c.itemImageUrl && c.weightScaleUrl);
  const allQtyOk = cards.length > 0 && cards.every(c => Number(c.buyQty) > 0 && Number(c.price) > 0);
  const canCreateBill = totalBought >= requiredQty && allImagesOk && allQtyOk && !billCreated;

  // ── Handlers ────────────────────────────────────────────────
  const addStaticVendor = (v: StoredVendor) => {
    setCards(prev => [...prev, staticFromVendor(v)]);
    setShowVendorDropdown(false);
    setVendorSearch('');
  };

  const addDynamicVendor = () => {
    setCards(prev => [...prev, emptyDynamic()]);
  };

  const updateCard = (id: string, updated: VendorCard) => {
    setCards(prev => prev.map(c => c.id === id ? updated : c));
  };

  const removeCard = (id: string) => {
    setCards(prev => prev.filter(c => c.id !== id));
  };

  const handleCreateBill = () => {
    // Validate
    for (const card of cards) {
      if (!card.vendorName.trim()) { toast.error('Fill vendor name for all cards'); return; }
      if (!card.weightScaleUrl) { toast.error(`Weight scale photo required for ${card.vendorName}`); return; }
      if (!card.itemImageUrl) { toast.error(`Item photo required for ${card.vendorName}`); return; }
    }

    // Save buy order to store
    const buyOrder: BuyOrder = {
      id: `buy-${Date.now()}`,
      product,
      requiredQty,
      unit,
      date: today,
      vendors: cards.map(c => ({
        id: c.id,
        type: c.type,
        vendorName: c.vendorName,
        bankName: c.bankName,
        accountNumber: c.accountNumber,
        ifscCode: c.ifscCode,
        itemName: c.itemName || product,
        buyQty: Number(c.buyQty) || 0,
        price: Number(c.price) || 0,
        hasItemImage: !!c.itemImageUrl,
        hasWeightScaleImage: !!c.weightScaleUrl,
      })),
      billCreated: true,
    };
    saveBuyOrder(buyOrder).then(savedId => {
      if (savedId) markBuyOrderBillCreated(savedId).catch(console.error);
    });

    // Create bills
    createBillsFromBuyOrder(cards, product, today);
    setBillCreated(true);

    toast.success(`✅ ${cards.length} bill(s) created in Auto Bill`);
    setTimeout(() => navigate('/purchase/auto-bill'), 1200);
  };

  const productEmoji: Record<string, string> = {
    Onion: '🧅', Tomato: '🍅', Potato: '🥔', Carrot: '🥕',
    Cabbage: '🥬', Beetroot: '🥦', Coriander: '🌿',
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b px-6 py-4 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/purchase/auto-po')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{productEmoji[product] ?? '📦'}</span>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Buy {product}</h1>
              <p className="text-xs text-gray-500">Add vendors and record purchase with proof</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

        {/* Progress Bar */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-gray-500">Required</span>
                <p className="text-xl font-black text-gray-900">{requiredQty} {unit}</p>
              </div>
              <div>
                <span className="text-gray-500">Bought</span>
                <p className="text-xl font-black text-green-600">{totalBought} {unit}</p>
              </div>
              <div>
                <span className="text-gray-500">Balance</span>
                <p className={`text-xl font-black ${balance > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                  {balance > 0 ? `${balance} ${unit}` : '✅ Fulfilled'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-blue-600">{progressPct}%</span>
              <p className="text-xs text-gray-400">purchased</p>
            </div>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressPct >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Vendor Cards */}
        {cards.length > 0 && (
          <div className="space-y-4">
            {cards.map(card => (
              <VendorBuyCard
                key={card.id}
                card={card}
                productName={product}
                onChange={updated => updateCard(card.id, updated)}
                onRemove={() => removeCard(card.id)}
              />
            ))}
          </div>
        )}

        {/* Add Vendor Buttons */}
        <div className="grid grid-cols-2 gap-4">

          {/* Static Vendor */}
          <div className="relative">
            <button
              onClick={() => setShowVendorDropdown(v => !v)}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-sm transition-colors"
            >
              <Building2 size={16} /> Add Regular Vendor
              <ChevronDown size={14} className={`transition-transform ${showVendorDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showVendorDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl z-30 overflow-hidden">
                <div className="p-3 border-b">
                  <input
                    value={vendorSearch}
                    onChange={e => setVendorSearch(e.target.value)}
                    placeholder="Search vendors…"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                    autoFocus
                  />
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {filteredVendors.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-gray-400 text-center">No vendors found</p>
                  ) : filteredVendors.map(v => (
                    <button
                      key={v.id}
                      onClick={() => addStaticVendor(v)}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0"
                    >
                      <p className="text-sm font-semibold text-gray-800">{vendorDisplayName(v)}</p>
                      {v.banks?.[0]?.bankName && (
                        <p className="text-xs text-gray-400">{v.banks[0].bankName} · {v.banks[0].ifscCode}</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Dynamic Vendor */}
          <button
            onClick={addDynamicVendor}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold text-sm transition-colors"
          >
            <Plus size={16} /> Add New Vendor
          </button>
        </div>

        {/* Validation Summary */}
        {cards.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Checklist</h3>
            <div className="space-y-2">
              {[
                {
                  ok: totalBought >= requiredQty,
                  label: `Total qty purchased (${totalBought}/${requiredQty} ${unit})`,
                },
                {
                  ok: allQtyOk,
                  label: 'All vendors have qty and price filled',
                },
                {
                  ok: cards.every(c => !!c.itemImageUrl),
                  label: 'Item photos uploaded for all vendors',
                },
                {
                  ok: cards.every(c => !!c.weightScaleUrl),
                  label: 'Weight scale photos uploaded for all vendors ← Required',
                },
              ].map(({ ok, label }) => (
                <div key={label} className="flex items-center gap-2 text-sm">
                  {ok
                    ? <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                    : <AlertCircle size={14} className="text-amber-400 shrink-0" />}
                  <span className={ok ? 'text-gray-700' : 'text-gray-400'}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create Bill Button */}
        {billCreated ? (
          <div className="flex items-center justify-center gap-2 py-5 bg-green-50 rounded-2xl border border-green-200">
            <CheckCircle2 size={20} className="text-green-500" />
            <span className="text-green-700 font-bold">Bills created successfully — check Auto Bill</span>
          </div>
        ) : (
          <button
            onClick={handleCreateBill}
            disabled={!canCreateBill}
            className={`w-full py-4 rounded-2xl text-base font-bold transition-all flex items-center justify-center gap-2
              ${canCreateBill
                ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
          >
            <FileCheck size={18} />
            {canCreateBill
              ? `Create Bill — ${cards.length} vendor${cards.length > 1 ? 's' : ''}`
              : cards.length === 0
                ? 'Add at least one vendor to continue'
                : !allImagesOk
                  ? 'Upload all required photos first'
                  : balance > 0
                    ? `Balance ${balance} ${unit} remaining`
                    : 'Fill all vendor details'}
          </button>
        )}
      </div>
    </div>
  );
}
