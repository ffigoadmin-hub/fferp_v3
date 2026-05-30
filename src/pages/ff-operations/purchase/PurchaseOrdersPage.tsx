import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Plus, X, Search, ChevronDown, Settings, Upload, Tag,
  Calendar, MoreVertical, Edit2, Trash2, Eye, Copy,
  FileText, Truck, DollarSign, CheckCircle2, Clock,
  AlertCircle, GripVertical, HelpCircle, ArrowRight,
  Package, Receipt, CreditCard, ShoppingCart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  fetchAllPOs, savePOToStore, deletePOFromStore, fetchMaxPOSerial,
  type StoredPO,
} from '@/lib/purchaseStore';
import { fetchVendorNames } from '@/lib/vendorStore';

// ─── Types ────────────────────────────────────────────────
interface LineItem {
  id: number;
  itemName: string;
  account: string;
  quantity: number;
  rate: number;
}

interface PurchaseOrder {
  id: number;
  poNumber: string;
  vendorName: string;
  date: string;
  deliveryDate: string;
  status: 'draft' | 'open' | 'billed' | 'cancelled';
  total: number;
  currency: string;
}

// ─── Constants ────────────────────────────────────────────
// VENDORS loaded dynamically from vendor store — see useVendorNames() hook below
const CUSTOMERS = ['Acme Corp', 'Beta Industries', 'Gamma Solutions', 'Delta Retail'];
const PAYMENT_TERMS = ['Due on Receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Custom'];
const SHIPMENT_PREFS = ['Standard Shipping', 'Express Delivery', 'Same Day', 'Freight', 'Pickup'];
const TAX_OPTIONS = ['GST 5%', 'GST 12%', 'GST 18%', 'GST 28%', 'No Tax'];
const ACCOUNTS = [
  'Cost of Goods Sold', 'Office Supplies', 'Inventory Asset',
  'Advertising & Marketing', 'Utilities', 'Repairs & Maintenance',
];
const ITEMS = [
  { name: 'Rice Bags (50kg)',      rate: 2200, unit: 'Bag',   account: 'Cost of Goods Sold' },
  { name: 'Wheat Flour (25kg)',    rate: 850,  unit: 'Bag',   account: 'Cost of Goods Sold' },
  { name: 'Sunflower Oil (15L)',   rate: 1650, unit: 'Can',   account: 'Cost of Goods Sold' },
  { name: 'Sugar (50kg)',          rate: 1900, unit: 'Bag',   account: 'Cost of Goods Sold' },
  { name: 'Salt (25kg)',           rate: 350,  unit: 'Bag',   account: 'Cost of Goods Sold' },
  { name: 'Fertilizer (50kg)',     rate: 1200, unit: 'Bag',   account: 'Cost of Goods Sold' },
  { name: 'Pesticide (5L)',        rate: 780,  unit: 'Can',   account: 'Cost of Goods Sold' },
  { name: 'Tractor Fuel (200L)',   rate: 18000, unit: 'Drum', account: 'Utilities' },
  { name: 'Packaging Boxes (100)', rate: 450,  unit: 'Box',   account: 'Office Supplies' },
  { name: 'Seeds (10kg)',          rate: 620,  unit: 'Pack',  account: 'Cost of Goods Sold' },
  { name: 'Irrigation Pipes (m)',  rate: 95,   unit: 'Meter', account: 'Inventory Asset' },
  { name: 'Gloves (pair)',         rate: 45,   unit: 'Pair',  account: 'Office Supplies' },
];

function formatDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatCurrency(n: number, cur = 'INR') {
  return `${cur} ${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

// ─── useOutsideClick ──────────────────────────────────────
function useOutsideClick(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      handler();
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [ref, handler]);
}

// ─── ComboBox (typeable + dropdown) ──────────────────────
function ComboBox({ value, onChange, options, placeholder, className = '' }: {
  value: string; onChange: (v: string) => void;
  options: string[]; placeholder?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(value);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useOutsideClick(ref, () => { setOpen(false); setInput(value); });
  useEffect(() => { setInput(value); }, [value]);

  const filtered = options.filter(o => o.toLowerCase().includes(input.toLowerCase()));

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div className={`flex items-center h-10 border rounded-md bg-white transition-colors ${open ? 'border-blue-400 ring-2 ring-blue-500/10' : 'border-gray-300 hover:border-blue-300'}`}>
        <input ref={inputRef} value={input} placeholder={placeholder}
          onChange={e => { setInput(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="flex-1 h-full px-3 text-sm bg-transparent focus:outline-none text-gray-800 placeholder-gray-400" />
        <button type="button" tabIndex={-1}
          onMouseDown={e => { e.preventDefault(); setOpen(o => !o); inputRef.current?.focus(); }}
          className="pr-3 text-gray-400 hover:text-gray-600">
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden" style={{ minWidth: 200 }}>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0
              ? <p className="px-3 py-3 text-sm font-semibold text-gray-400">NO RESULTS FOUND</p>
              : filtered.map(o => (
                <button key={o} type="button" onMouseDown={e => e.preventDefault()}
                  onClick={() => { onChange(o); setInput(o); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${value === o ? 'bg-blue-500 text-white font-medium' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'}`}>
                  {o}
                </button>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ─── VendorField (dropdown + green search btn) ────────────
function VendorField({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(value);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => { setOpen(false); setInput(value); });
  useEffect(() => { setInput(value); }, [value]);
  const filtered = options.filter(o => o.toLowerCase().includes(input.toLowerCase()));

  return (
    <div ref={ref} className="relative flex gap-2">
      <div className={`flex-1 flex items-center h-10 border rounded-md bg-white transition-colors ${open ? 'border-blue-400 ring-2 ring-blue-500/10' : 'border-gray-300 hover:border-blue-300'}`}>
        <input value={input} placeholder={placeholder || 'Select a Vendor'}
          onChange={e => { setInput(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="flex-1 h-full px-3 text-sm bg-transparent focus:outline-none text-gray-800 placeholder-gray-400" />
        <button type="button" tabIndex={-1} onMouseDown={e => { e.preventDefault(); setOpen(o => !o); }}
          className="pr-3 text-gray-400"><ChevronDown className="w-4 h-4" /></button>
      </div>
      <button type="button"
        className="w-10 h-10 flex items-center justify-center bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors shrink-0">
        <Search className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden" style={{ minWidth: 280 }}>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0
              ? <p className="px-3 py-3 text-sm font-semibold text-gray-400">NO RESULTS FOUND</p>
              : filtered.map(o => (
                <button key={o} type="button" onMouseDown={e => e.preventDefault()}
                  onClick={() => { onChange(o); setInput(o); setOpen(false); }}
                  className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${value === o ? 'bg-blue-500 text-white font-medium' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'}`}>
                  {o}
                </button>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Life Cycle Banner ────────────────────────────────────
function LifeCycleBanner() {
  const steps = [
    { label: 'RAISE PURCHASE ORDER', icon: <ShoppingCart className="w-5 h-5 text-blue-500" /> },
    { label: 'RECEIVE GOODS',        icon: <Package className="w-5 h-5 text-green-500" /> },
    { label: 'CONVERT TO BILL',      icon: <Receipt className="w-5 h-5 text-purple-500" /> },
    { label: 'RECORD PAYMENT',       icon: <CreditCard className="w-5 h-5 text-blue-400" /> },
  ];
  const connectors = ['CONVERT TO OPEN', '', ''];

  return (
    <div className="bg-white border-b border-gray-100 px-8 py-8">
      <p className="text-center text-base font-semibold text-gray-700 mb-8">Life cycle of a Purchase Order</p>
      <div className="flex items-center justify-center gap-0 flex-wrap">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center">
            {/* Step box */}
            <div className="flex items-center gap-2.5 px-5 py-3 border-2 border-blue-200 rounded-xl bg-white shadow-sm min-w-[160px]">
              {step.icon}
              <span className="text-xs font-bold text-gray-700 tracking-wide leading-tight">{step.label}</span>
            </div>
            {/* Connector */}
            {i < steps.length - 1 && (
              <div className="flex flex-col items-center mx-1">
                {connectors[i] && (
                  <span className="text-[9px] text-gray-400 font-semibold tracking-widest uppercase mb-0.5 whitespace-nowrap">
                    {connectors[i]}
                  </span>
                )}
                <div className="flex items-center gap-0.5">
                  {[1,2,3,4,5].map(d => (
                    <div key={d} className="w-2 h-0.5 bg-blue-300 rounded-full" />
                  ))}
                  <ArrowRight className="w-3 h-3 text-blue-400 -ml-0.5" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Item Row ─────────────────────────────────────────────
function ItemRow({ row, onChange, onRemove }: {
  row: LineItem;
  onChange: (id: number, k: keyof LineItem, v: string | number) => void;
  onRemove: (id: number) => void;
}) {
  const [itemOpen, setItemOpen] = useState(false);
  const [itemInput, setItemInput] = useState(row.itemName);
  const itemRef = useRef<HTMLDivElement>(null);
  useOutsideClick(itemRef, () => { setItemOpen(false); setItemInput(row.itemName); });

  const filteredItems = ITEMS.filter(i => i.name.toLowerCase().includes(itemInput.toLowerCase()));

  const selectItem = (item: { name: string; rate: number }) => {
    onChange(row.id, 'itemName', item.name);
    onChange(row.id, 'rate', item.rate);
    setItemInput(item.name);
    setItemOpen(false);
  };

  const amount = (row.quantity * row.rate).toFixed(2);

  return (
    <tr className="group border-b border-gray-100 hover:bg-blue-50/20 transition-colors">
      {/* Drag handle */}
      <td className="w-8 pl-3 py-2">
        <GripVertical className="w-4 h-4 text-gray-300 group-hover:text-gray-400 cursor-grab" />
      </td>
      {/* Item image placeholder */}
      <td className="w-12 py-2">
        <div className="w-8 h-8 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50">
          <FileText className="w-3.5 h-3.5 text-gray-300" />
        </div>
      </td>
      {/* Item Details */}
      <td className="py-2 pr-2" style={{ minWidth: 260 }}>
        <div ref={itemRef} className="relative">
          <input value={itemInput} placeholder="Type or click to select an item."
            onChange={e => { setItemInput(e.target.value); setItemOpen(true); }}
            onFocus={() => setItemOpen(true)}
            className="w-full h-9 px-2 text-sm border border-transparent hover:border-gray-200 rounded-md focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 bg-transparent text-gray-700 placeholder-gray-400" />
          {itemOpen && (
            <div className="absolute z-50 left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden w-72">
              <div className="max-h-48 overflow-y-auto">
                {filteredItems.length === 0
                  ? <p className="px-3 py-3 text-sm text-gray-400 font-semibold">NO RESULTS FOUND</p>
                  : filteredItems.map(item => (
                    <button key={item.name} type="button" onMouseDown={e => e.preventDefault()}
                      onClick={() => selectItem(item)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700">
                      <span>{item.name}</span>
                      <span className="text-xs text-gray-400">₹{item.rate.toLocaleString()}</span>
                    </button>
                  ))
                }
              </div>
            </div>
          )}
        </div>
      </td>
      {/* Account */}
      <td className="py-2 pr-2" style={{ minWidth: 180 }}>
        <select value={row.account} onChange={e => onChange(row.id, 'account', e.target.value)}
          className="w-full h-9 px-2 text-sm border border-transparent hover:border-gray-200 rounded-md focus:outline-none focus:border-blue-400 bg-transparent text-gray-700 appearance-none">
          <option value="">Select an account</option>
          {ACCOUNTS.map(a => <option key={a}>{a}</option>)}
        </select>
      </td>
      {/* Quantity */}
      <td className="py-2 pr-2 text-right" style={{ minWidth: 90 }}>
        <input type="number" min="0" step="0.01" value={row.quantity}
          onChange={e => onChange(row.id, 'quantity', parseFloat(e.target.value) || 0)}
          className="w-full h-9 px-2 text-sm border border-transparent hover:border-gray-200 rounded-md focus:outline-none focus:border-blue-400 bg-transparent text-gray-700 text-right" />
      </td>
      {/* Rate */}
      <td className="py-2 pr-2 text-right" style={{ minWidth: 100 }}>
        <input type="number" min="0" step="0.01" value={row.rate}
          onChange={e => onChange(row.id, 'rate', parseFloat(e.target.value) || 0)}
          className="w-full h-9 px-2 text-sm border border-transparent hover:border-gray-200 rounded-md focus:outline-none focus:border-blue-400 bg-transparent text-gray-700 text-right" />
      </td>
      {/* Amount */}
      <td className="py-2 pr-3 text-right" style={{ minWidth: 90 }}>
        <span className="text-sm font-semibold text-gray-800">{amount}</span>
      </td>
      {/* Remove */}
      <td className="py-2 pr-2 w-8">
        <button type="button" onClick={() => onRemove(row.id)}
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all">
          <X className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}

// ─── Bulk Items Modal ─────────────────────────────────────
interface BulkSelection {
  item: typeof ITEMS[number];
  quantity: number;
  selected: boolean;
}

function BulkItemsModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (selected: { name: string; rate: number; quantity: number; account: string }[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<BulkSelection[]>(
    ITEMS.map(item => ({ item, quantity: 1, selected: false }))
  );

  const filtered = rows.filter(r =>
    r.item.name.toLowerCase().includes(search.toLowerCase()) ||
    r.item.unit.toLowerCase().includes(search.toLowerCase())
  );

  const selectedCount = rows.filter(r => r.selected).length;
  const allChecked = filtered.length > 0 && filtered.every(r => r.selected);

  const toggleAll = () => {
    const ids = new Set(filtered.map(r => r.item.name));
    setRows(p => p.map(r => ids.has(r.item.name) ? { ...r, selected: !allChecked } : r));
  };

  const toggle = (name: string) =>
    setRows(p => p.map(r => r.item.name === name ? { ...r, selected: !r.selected } : r));

  const setQty = (name: string, qty: number) =>
    setRows(p => p.map(r => r.item.name === name ? { ...r, quantity: Math.max(1, qty) } : r));

  const handleAdd = () => {
    const sel = rows.filter(r => r.selected).map(r => ({
      name: r.item.name, rate: r.item.rate,
      quantity: r.quantity, account: r.item.account,
    }));
    if (sel.length === 0) { toast.error('Select at least one item'); return; }
    onAdd(sel);
    onClose();
    toast.success(`${sel.length} item${sel.length > 1 ? 's' : ''} added`);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col overflow-hidden" style={{ maxHeight: '80vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Add Items in Bulk</h2>
            <p className="text-xs text-gray-400 mt-0.5">Select items and set quantities, then click Add</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-100 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search items by name or unit…"
              className="w-full h-9 pl-9 pr-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={allChecked}
                    onChange={toggleAll}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded cursor-pointer" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Item Name</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Unit</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Rate (INR)</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Quantity</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400 font-semibold">
                    NO RESULTS FOUND
                  </td>
                </tr>
              ) : filtered.map(r => (
                <tr key={r.item.name}
                  onClick={() => toggle(r.item.name)}
                  className={`cursor-pointer transition-colors ${r.selected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-4 py-3 text-center">
                    <input type="checkbox" checked={r.selected}
                      onChange={() => toggle(r.item.name)}
                      onClick={e => e.stopPropagation()}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded cursor-pointer" />
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-sm font-medium ${r.selected ? 'text-blue-700' : 'text-gray-800'}`}>
                      {r.item.name}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-500">{r.item.unit}</td>
                  <td className="px-3 py-3 text-sm text-gray-700 text-right">
                    ₹{r.item.rate.toLocaleString('en-IN')}
                  </td>
                  <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <button type="button"
                        onClick={() => setQty(r.item.name, r.quantity - 1)}
                        className="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors font-bold text-sm leading-none">
                        −
                      </button>
                      <input type="number" min="1" value={r.quantity}
                        onChange={e => setQty(r.item.name, parseInt(e.target.value) || 1)}
                        className="w-14 h-7 text-center text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 bg-white text-gray-800 font-medium" />
                      <button type="button"
                        onClick={() => setQty(r.item.name, r.quantity + 1)}
                        className="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors font-bold text-sm leading-none">
                        +
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className={`text-sm font-semibold ${r.selected ? 'text-blue-700' : 'text-gray-700'}`}>
                      ₹{(r.item.rate * r.quantity).toLocaleString('en-IN')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2">
            {selectedCount > 0 ? (
              <span className="text-sm text-blue-600 font-semibold">
                {selectedCount} item{selectedCount > 1 ? 's' : ''} selected
                {' '}·{' '}
                ₹{rows.filter(r => r.selected).reduce((s, r) => s + r.item.rate * r.quantity, 0).toLocaleString('en-IN')} total
              </span>
            ) : (
              <span className="text-sm text-gray-400">No items selected</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose}
              className="h-9 px-4 text-sm border-gray-300 text-gray-600">Cancel</Button>
            <Button onClick={handleAdd} disabled={selectedCount === 0}
              className="h-9 px-5 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
              Add {selectedCount > 0 ? `(${selectedCount})` : ''} to Order
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── New PO Form ──────────────────────────────────────────
// ─── Project Dropdown ─────────────────────────────────────
const PROJECTS = [
  'Harvest 2025', 'Warehouse Expansion', 'Marketing Campaign',
  'Project Alpha', 'Infrastructure Upgrade', 'Seasonal Procurement',
];

function ProjectDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false));
  const filtered = PROJECTS.filter(p => p.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
          value
            ? 'border-blue-300 bg-blue-50 text-blue-700'
            : 'border-gray-200 bg-white text-gray-500 hover:border-blue-300 hover:text-blue-600'
        }`}
      >
        <ChevronDown className="w-3.5 h-3.5 shrink-0" />
        <span>{value || 'Select a project'}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden w-64">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                autoFocus value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search projects…"
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-blue-400 rounded-md focus:outline-none bg-white"
              />
            </div>
          </div>
          <div className="max-h-44 overflow-y-auto">
            {filtered.length === 0
              ? <p className="px-3 py-3 text-xs font-semibold text-gray-400">NO RESULTS FOUND</p>
              : filtered.map(p => (
                <button key={p} type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => { onChange(p); setOpen(false); setSearch(''); }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    value === p ? 'bg-blue-500 text-white font-medium' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                  }`}>{p}</button>
              ))
            }
          </div>
          {value && (
            <div className="border-t border-gray-100 p-1.5">
              <button type="button" onMouseDown={e => e.preventDefault()}
                onClick={() => { onChange(''); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg font-medium">
                <X className="w-3 h-3" /> Remove project
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Reporting Tags Dropdown ──────────────────────────────
const REPORTING_TAGS = [
  'Q1-2026', 'Q2-2026', 'Operations', 'Finance', 'Procurement',
  'Warehouse', 'Logistics', 'Capital Expense', 'Revenue',
];

function ReportingTagsDropdown({ selected, onChange }: {
  selected: string[]; onChange: (tags: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false));
  const filtered = REPORTING_TAGS.filter(t => t.toLowerCase().includes(search.toLowerCase()));

  const toggle = (tag: string) => {
    onChange(selected.includes(tag) ? selected.filter(t => t !== tag) : [...selected, tag]);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
          selected.length > 0
            ? 'border-blue-300 bg-blue-50 text-blue-700'
            : 'border-gray-200 bg-white text-gray-500 hover:border-blue-300 hover:text-blue-600'
        }`}
      >
        <Tag className="w-3.5 h-3.5 shrink-0" />
        <span>
          {selected.length === 0
            ? 'Reporting Tags'
            : selected.length === 1
              ? selected[0]
              : `${selected.length} Tags`}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden w-64">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                autoFocus value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search tags…"
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-blue-400 rounded-md focus:outline-none bg-white"
              />
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0
              ? <p className="px-3 py-3 text-xs font-semibold text-gray-400">NO RESULTS FOUND</p>
              : filtered.map(tag => {
                const checked = selected.includes(tag);
                return (
                  <button key={tag} type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => toggle(tag)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                      checked ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      checked ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                    }`}>
                      {checked && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                          <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span className={`font-medium ${checked ? 'text-blue-700' : ''}`}>{tag}</span>
                  </button>
                );
              })
            }
          </div>

          {selected.length > 0 && (
            <>
              <div className="px-3 py-2 border-t border-gray-100 flex flex-wrap gap-1.5">
                {selected.map(t => (
                  <span key={t}
                    className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                    {t}
                    <button type="button" onMouseDown={e => e.preventDefault()}
                      onClick={() => toggle(t)}
                      className="hover:bg-blue-200 rounded-full p-0.5">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="border-t border-gray-100 p-1.5">
                <button type="button" onMouseDown={e => e.preventDefault()}
                  onClick={() => { onChange([]); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg font-medium">
                  <X className="w-3 h-3" /> Clear all tags
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function NewPOForm({ onClose, onSave, editData }: {
  onClose: () => void;
  onSave: (po: Omit<PurchaseOrder, 'id'>, items: { id: number; itemName: string; account: string; quantity: number; rate: number }[]) => void;
  editData?: PurchaseOrder | null;
}) {
  const today = new Date().toISOString().split('T')[0];
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: VENDORS = [] } = useQuery<string[]>({ queryKey: ['vendor-names'], queryFn: fetchVendorNames });
  const [nextSerial, setNextSerial] = useState(0);
  useEffect(() => { fetchMaxPOSerial().then(s => setNextSerial(s + 1)); }, []);

  const [form, setForm] = useState({
    vendorName:         editData?.vendorName ?? '',
    deliveryAddressType: 'organization' as 'organization' | 'customer',
    customerForDelivery: '',
    poNumber:           editData?.poNumber   ?? `PO-${String(nextSerial).padStart(5, '0')}`,
    reference:          '',
    date:               editData?.date       ?? today,
    deliveryDate:       editData?.deliveryDate ?? '',
    paymentTerms:       'Due on Receipt',
    shipmentPref:       '',
    taxLevel:           'transaction',
    taxType:            'tds' as 'tds' | 'tcs',
    selectedTax:        '',
    discount:           '0',
    adjustment:         '',
    notes:              '',
    termsAndConditions: '',
  });

  const [items, setItems] = useState<LineItem[]>([
    { id: 1, itemName: '', account: '', quantity: 1, rate: 0 },
  ]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showBulkItems, setShowBulkItems] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const handleBulkAdd = (selected: { name: string; rate: number; quantity: number; account: string }[]) => {
    const newRows: LineItem[] = selected.map(s => ({
      id: Date.now() + Math.random(),
      itemName: s.name,
      account: s.account,
      quantity: s.quantity,
      rate: s.rate,
    }));
    setItems(prev => {
      // Replace any empty first row
      const hasEmpty = prev.length === 1 && !prev[0].itemName;
      return hasEmpty ? newRows : [...prev, ...newRows];
    });
  };

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const addRow = () => setItems(p => [
    ...p, { id: Date.now(), itemName: '', account: '', quantity: 1, rate: 0 }
  ]);

  const removeRow = (id: number) => {
    if (items.length <= 1) return;
    setItems(p => p.filter(r => r.id !== id));
  };

  const changeItem = useCallback((id: number, k: keyof LineItem, v: string | number) => {
    setItems(p => p.map(r => r.id === id ? { ...r, [k]: v } : r));
  }, []);

  const subTotal = items.reduce((s, r) => s + r.quantity * r.rate, 0);
  const discountAmt = subTotal * (parseFloat(form.discount) || 0) / 100;
  const adjustmentAmt = parseFloat(form.adjustment) || 0;
  const total = subTotal - discountAmt + adjustmentAmt;

  const handleSave = (asDraft = false) => {
    if (!form.vendorName) { toast.error('Vendor Name is required'); return; }

    const status: PurchaseOrder['status'] = asDraft ? 'draft' : 'open';

    // ── Persist full PO (with items) to shared store ───────────
    const storedPO: StoredPO = {
      id:           editData?.id ? String(editData.id) : `po-${Date.now()}`,
      poNumber:     form.poNumber,
      vendorName:   form.vendorName,
      date:         form.date,
      deliveryDate: form.deliveryDate,
      paymentTerms: form.paymentTerms,
      status,
      items: items.map(i => ({
        id:              i.id,
        itemName:        i.itemName,
        account:         i.account,
        quantity:        i.quantity,
        rate:            i.rate,
        tax:             'GST 5%',   // PO form doesn't have per-row tax → default
        discount:        0,
        customerDetails: '',
      })),
      subTotal,
      total,
      notes: form.notes,
    };
    savePOToStore(storedPO).catch(console.error);

    onSave(
      {
        poNumber:     form.poNumber,
        vendorName:   form.vendorName,
        date:         form.date,
        deliveryDate: form.deliveryDate,
        status,
        total,
        currency:     'INR',
      },
      items,
    );
    toast.success(asDraft ? 'Saved as draft' : 'Purchase order created');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden">
      {/* Bulk Items Modal */}
      {showBulkItems && (
        <BulkItemsModal
          onClose={() => setShowBulkItems(false)}
          onAdd={handleBulkAdd}
        />
      )}
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <ShoppingCart className="w-6 h-6 text-gray-600" />
          <h2 className="text-xl font-bold text-gray-900">
            {editData ? `Edit Purchase Order` : 'New Purchase Order'}
          </h2>
        </div>
        <button onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-8 space-y-7">

          {/* ── Section 1: Header fields ── */}
          <div className="space-y-6">

            {/* Vendor Name */}
            <div className="grid grid-cols-[220px_1fr] gap-6 items-start">
              <p className="text-sm text-red-500 font-medium pt-2.5">Vendor Name*</p>
              <VendorField value={form.vendorName} onChange={v => set('vendorName', v)} options={VENDORS} />
            </div>

            {/* Delivery Address */}
            <div className="grid grid-cols-[220px_1fr] gap-6 items-start">
              <p className="text-sm text-red-500 font-medium pt-1">Delivery Address*</p>
              <div className="space-y-3">
                {/* Radio buttons */}
                <div className="flex items-center gap-6">
                  {(['organization', 'customer'] as const).map(t => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="deliveryType" value={t}
                        checked={form.deliveryAddressType === t}
                        onChange={() => set('deliveryAddressType', t)}
                        className="text-blue-600 w-4 h-4" />
                      <span className="text-sm text-gray-700 capitalize">{t}</span>
                    </label>
                  ))}
                </div>

                {form.deliveryAddressType === 'organization' ? (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-800">FARMERS FACTORY</span>
                      <button type="button" className="text-blue-500 hover:text-blue-600">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      Tamil Nadu<br />India
                    </p>
                    <button type="button" className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
                      Change destination to deliver
                    </button>
                  </div>
                ) : (
                  <ComboBox value={form.customerForDelivery}
                    onChange={v => set('customerForDelivery', v)}
                    options={CUSTOMERS} placeholder="Select a customer" />
                )}
              </div>
            </div>

            {/* PO Number */}
            <div className="grid grid-cols-[220px_1fr] gap-6 items-start">
              <p className="text-sm text-red-500 font-medium pt-2.5">Purchase Order#*</p>
              <div className="relative max-w-xs">
                <Input value={form.poNumber} onChange={e => set('poNumber', e.target.value)}
                  className="h-10 text-sm border-gray-300 focus:border-blue-500 bg-white pr-10" />
                <button type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500">
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Reference */}
            <div className="grid grid-cols-[220px_1fr] gap-6 items-start">
              <p className="text-sm text-gray-600 font-medium pt-2.5">Reference#</p>
              <Input value={form.reference} onChange={e => set('reference', e.target.value)}
                className="h-10 text-sm border-gray-300 focus:border-blue-500 bg-white max-w-xs" />
            </div>

            {/* Date */}
            <div className="grid grid-cols-[220px_1fr] gap-6 items-start">
              <p className="text-sm text-gray-600 font-medium pt-2.5">Date</p>
              <Input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                className="h-10 text-sm border-gray-300 focus:border-blue-500 bg-white max-w-xs" />
            </div>

            {/* Delivery Date + Payment Terms */}
            <div className="grid grid-cols-[220px_1fr] gap-6 items-start">
              <p className="text-sm text-gray-600 font-medium pt-2.5">Delivery Date</p>
              <div className="flex items-center gap-8">
                <Input type="date" value={form.deliveryDate} onChange={e => set('deliveryDate', e.target.value)}
                  className="h-10 text-sm border-gray-300 focus:border-blue-500 bg-white w-52" />
                <div className="flex items-center gap-3">
                  <p className="text-sm text-gray-600 font-medium whitespace-nowrap">Payment Terms</p>
                  <div className="relative">
                    <select value={form.paymentTerms} onChange={e => set('paymentTerms', e.target.value)}
                      className="h-10 pl-3 pr-8 border border-gray-300 rounded-md bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 appearance-none">
                      {PAYMENT_TERMS.map(t => <option key={t}>{t}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Shipment Preference */}
            <div className="grid grid-cols-[220px_1fr] gap-6 items-start">
              <p className="text-sm text-gray-600 font-medium pt-2.5">Shipment Preference</p>
              <ComboBox value={form.shipmentPref} onChange={v => set('shipmentPref', v)}
                options={SHIPMENT_PREFS}
                placeholder="Choose the shipment preference or type to add…"
                className="max-w-sm" />
            </div>
          </div>

          {/* ── Section 2: Tax level + Item table ── */}
          <div className="border border-gray-200 rounded-2xl overflow-visible">

            {/* Tax level header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/50">
              <div className="relative">
                <select value={form.taxLevel} onChange={e => set('taxLevel', e.target.value)}
                  className="pl-3 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none appearance-none font-medium">
                  <option value="transaction">At Transaction Level</option>
                  <option value="item">At Item Level</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Item Table header */}
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-gray-800">Item Table</p>
              <button type="button"
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-semibold border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors">
                <Settings className="w-3.5 h-3.5" /> Bulk Actions
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="w-8" />
                    <th className="w-12" />
                    <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Item Details</th>
                    <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Account</th>
                    <th className="px-2 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Quantity</th>
                    <th className="px-2 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <span className="flex items-center justify-end gap-1">
                        Rate
                        <button type="button" className="w-4 h-4 rounded-full border border-gray-400 flex items-center justify-center text-gray-400 hover:text-blue-500">
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    </th>
                    <th className="px-2 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide pr-3">Amount</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {items.map(row => (
                    <ItemRow key={row.id} row={row} onChange={changeItem} onRemove={removeRow} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Project + Tags below table */}
            <div className="flex items-center gap-3 px-5 py-3 border-t border-gray-100 flex-wrap">
              <ProjectDropdown
                value={selectedProject}
                onChange={setSelectedProject}
              />
              <ReportingTagsDropdown
                selected={selectedTags}
                onChange={setSelectedTags}
              />
            </div>

            {/* Add row / bulk buttons */}
            <div className="px-5 pb-5 flex items-center gap-3">
              <div className="flex rounded-lg overflow-hidden border border-blue-200">
                <button type="button" onClick={addRow}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 font-semibold transition-colors bg-white">
                  <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                    <Plus className="w-2.5 h-2.5 text-white" />
                  </div>
                  Add New Row
                </button>
                <div className="w-px bg-blue-200" />
                <button type="button"
                  className="px-2 py-2 text-blue-500 hover:bg-blue-50 transition-colors bg-white">
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              <button type="button"
                onClick={() => setShowBulkItems(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 font-semibold transition-colors bg-white border border-blue-200 rounded-lg active:bg-blue-100">
                <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                  <Plus className="w-2.5 h-2.5 text-white" />
                </div>
                Add Items in Bulk
              </button>
            </div>
          </div>

          {/* ── Section 3: Totals + Notes (side by side) ── */}
          <div className="flex gap-8 items-start">

            {/* Left — Notes + Terms + Attachments */}
            <div className="flex-1 space-y-6">
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Notes</p>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                  rows={4} placeholder="Will be displayed on purchase order"
                  className="w-full resize-y px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder-gray-400" />
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Terms &amp; Conditions</p>
                <textarea value={form.termsAndConditions}
                  onChange={e => set('termsAndConditions', e.target.value)}
                  rows={5} placeholder="Enter the terms and conditions of your business to be displayed in your transaction"
                  className="w-full resize-y px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder-gray-400" />
              </div>

              {/* Attach files */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Attach File(s) to Purchase Order</p>
                <div className="flex items-center gap-3">
                  <div className="flex rounded-lg overflow-hidden border border-gray-200">
                    <button type="button" onClick={() => fileRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 font-medium bg-white">
                      <Upload className="w-4 h-4 text-gray-500" /> Upload File
                    </button>
                    <div className="w-px bg-gray-200" />
                    <button type="button" className="px-2 py-2 text-gray-500 hover:bg-gray-50 bg-white">
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  <input ref={fileRef} type="file" multiple className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.xlsx,.csv"
                    onChange={e => { if (e.target.files) setAttachments(p => [...p, ...Array.from(e.target.files!)]); }} />
                </div>
                <p className="mt-1.5 text-xs text-gray-400">You can upload a maximum of 10 files, 10MB each</p>
                {attachments.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {attachments.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-gray-600">
                        <FileText className="w-3.5 h-3.5 text-blue-400" />
                        <span className="truncate flex-1">{f.name}</span>
                        <button type="button" onClick={() => setAttachments(p => p.filter((_, j) => j !== i))}
                          className="text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Additional Fields note */}
              <p className="text-xs text-gray-500">
                <span className="font-semibold text-gray-700">Additional Fields:</span>{' '}
                Start adding custom fields for your purchase orders by going to{' '}
                <em>Settings ➡ Purchases ➡ Purchase Orders.</em>
              </p>
            </div>

            {/* Right — Totals */}
            <div className="w-80 shrink-0 space-y-0">
              <div className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
                {/* Sub Total */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                  <span className="text-sm font-semibold text-gray-700">Sub Total</span>
                  <span className="text-sm font-bold text-gray-800">{subTotal.toFixed(2)}</span>
                </div>

                {/* Discount */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Discount</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-gray-300 rounded-md overflow-hidden h-8 bg-white">
                      <input type="number" min="0" max="100" value={form.discount}
                        onChange={e => set('discount', e.target.value)}
                        className="w-14 px-2 text-sm text-right focus:outline-none bg-transparent" />
                      <span className="px-2 text-sm text-gray-500 bg-gray-50 border-l border-gray-200 h-full flex items-center">%</span>
                    </div>
                    <span className="text-sm text-gray-700 w-16 text-right">{discountAmt.toFixed(2)}</span>
                  </div>
                </div>

                {/* TDS / TCS */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    {(['tds', 'tcs'] as const).map(t => (
                      <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" name="taxType" value={t}
                          checked={form.taxType === t} onChange={() => set('taxType', t)}
                          className="text-blue-600 w-3.5 h-3.5" />
                        <span className="text-sm text-gray-700 uppercase font-medium">{t}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <select value={form.selectedTax} onChange={e => set('selectedTax', e.target.value)}
                        className="h-8 pl-2 pr-7 text-xs border border-gray-300 rounded-md bg-white text-gray-700 focus:outline-none appearance-none">
                        <option value="">Select a Tax</option>
                        {TAX_OPTIONS.map(t => <option key={t}>{t}</option>)}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                    </div>
                    <span className="text-sm text-gray-700 w-16 text-right">- 0.00</span>
                  </div>
                </div>

                {/* Adjustment */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="border border-gray-200 rounded-md px-2 h-8 flex items-center bg-white">
                      <span className="text-sm text-gray-600">Adjustment</span>
                    </div>
                    <button type="button" className="text-gray-400 hover:text-gray-600">
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input type="number" value={form.adjustment}
                      onChange={e => set('adjustment', e.target.value)}
                      className="h-8 w-24 text-sm text-right border-gray-300 bg-white" />
                    <span className="text-sm text-gray-700 w-16 text-right">{adjustmentAmt.toFixed(2)}</span>
                  </div>
                </div>

                {/* Total */}
                <div className="flex items-center justify-between px-5 py-4 bg-white">
                  <span className="text-base font-bold text-gray-900">Total</span>
                  <span className="text-base font-bold text-gray-900">{total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <div className="px-8 py-4 border-t border-gray-200 flex items-center gap-3 shrink-0 bg-white">
        <Button onClick={() => handleSave(false)}
          className="h-9 px-6 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold">
          Save
        </Button>
        <Button variant="outline" onClick={() => handleSave(true)}
          className="h-9 px-5 text-sm border-gray-300 text-gray-600 hover:bg-gray-50">
          Save as Draft
        </Button>
        <Button variant="ghost" onClick={onClose}
          className="h-9 px-4 text-sm text-gray-500 hover:text-gray-700">
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────
function StatusBadge({ status }: { status: PurchaseOrder['status'] }) {
  const map = {
    draft:     { label: 'Draft',     cls: 'bg-gray-100 text-gray-600' },
    open:      { label: 'Open',      cls: 'bg-blue-100 text-blue-700' },
    billed:    { label: 'Billed',    cls: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-600' },
  };
  const s = map[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}

// ─── Row Kebab ────────────────────────────────────────────
function RowMenu({ onEdit, onDuplicate, onDelete }: {
  onEdit: () => void; onDuplicate: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100">
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-36 z-50">
          <button type="button" onClick={() => { onEdit(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700">
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </button>
          <button type="button" onClick={() => { onDuplicate(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700">
            <Copy className="w-3.5 h-3.5" /> Duplicate
          </button>
          <div className="border-t border-gray-100 my-1" />
          <button type="button" onClick={() => { onDelete(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default function PurchaseOrdersPage() {
  const qc = useQueryClient();
  const { data: storedPOs = [] } = useQuery({ queryKey: ['all-pos'], queryFn: fetchAllPOs });
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);

  // Sync Supabase POs into local display list
  useEffect(() => {
    setOrders(storedPOs.map((s, i) => ({
      id:           i + 1,
      poNumber:     s.poNumber,
      vendorName:   s.vendorName,
      date:         s.date,
      deliveryDate: s.deliveryDate,
      status:       s.status,
      total:        s.total,
      currency:     'INR',
    })));
  }, [storedPOs]);
  const [showForm, setShowForm] = useState(false);
  const [editOrder, setEditOrder] = useState<PurchaseOrder | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | PurchaseOrder['status']>('all');
  const [search, setSearch] = useState('');
  const [showLifeCycle, setShowLifeCycle] = useState(true);

  // ── Merge Supabase POs with localStorage POs ──────────────────────────────
  useQuery({
    queryKey: ['purchase-orders-db'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('purchase_orders')
        .select('id, po_number, vendor_name, created_at, delivery_date, status, total_amount')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) return [];
      const dbPOs: PurchaseOrder[] = (data ?? []).map((row: any, i: number) => ({
        id:           Date.now() + i,
        poNumber:     row.po_number,
        vendorName:   row.vendor_name || '—',
        date:         row.created_at?.slice(0, 10) ?? '',
        deliveryDate: row.delivery_date ?? '',
        status:       (row.status === 'approved' ? 'open' : row.status) as PurchaseOrder['status'],
        total:        Number(row.total_amount || 0),
        currency:     'INR',
      }));
      // Merge: DB POs take precedence over localStorage (dedup by poNumber)
      setOrders(prev => {
        const localOnly = prev.filter(p => !dbPOs.some(d => d.poNumber === p.poNumber));
        return [...dbPOs, ...localOnly];
      });
      return dbPOs;
    },
    refetchInterval: 30_000,
  });

  const filtered = orders.filter(o => {
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    const matchSearch = o.poNumber.toLowerCase().includes(search.toLowerCase()) ||
                        o.vendorName.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  // onSave now receives items as second arg (store save already done inside NewPOForm)
  const handleSave = (data: Omit<PurchaseOrder, 'id'>, _items: unknown) => {
    if (editOrder) {
      setOrders(p => p.map(o => o.id === editOrder.id ? { ...o, ...data } : o));
    } else {
      setOrders(p => [{ ...data, id: Date.now() }, ...p]);
    }
  };

  const handleDuplicate = async (o: PurchaseOrder) => {
    const serial = await fetchMaxPOSerial();
    const newNum = `PO-${String(serial + 1).padStart(5, '0')}`;
    await savePOToStore({
      id: '', poNumber: newNum, vendorName: o.vendorName,
      date: o.date, deliveryDate: o.deliveryDate, paymentTerms: 'Net 30',
      status: 'draft', items: [], subTotal: 0, total: 0, notes: '',
    });
    qc.invalidateQueries({ queryKey: ['all-pos'] });
    toast.success('Purchase order duplicated');
  };

  const handleDelete = async (id: number) => {
    const po = orders.find(o => o.id === id);
    if (po) await deletePOFromStore(po.poNumber);
    qc.invalidateQueries({ queryKey: ['all-pos'] });
    toast.success('Purchase order deleted');
  };

  const openNew   = () => { setEditOrder(null); setShowForm(true); };
  const openEdit  = (o: PurchaseOrder) => { setEditOrder(o); setShowForm(true); };

  const counts = {
    all:       orders.length,
    draft:     orders.filter(o => o.status === 'draft').length,
    open:      orders.filter(o => o.status === 'open').length,
    billed:    orders.filter(o => o.status === 'billed').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  };

  const totalOpen   = orders.filter(o => o.status === 'open').reduce((s, o) => s + o.total, 0);
  const totalBilled = orders.filter(o => o.status === 'billed').reduce((s, o) => s + o.total, 0);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Full-screen PO Form */}
      {showForm && (
        <NewPOForm
          onClose={() => setShowForm(false)}
          onSave={handleSave}
          editData={editOrder}
        />
      )}

      {/* Life Cycle banner (collapsible) */}
      {showLifeCycle && (
        <div className="relative">
          <LifeCycleBanner />
          <button onClick={() => setShowLifeCycle(false)}
            className="absolute top-3 right-4 text-xs text-gray-400 hover:text-gray-600 font-medium">
            Hide
          </button>
        </div>
      )}

      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Purchase Orders</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage your purchase orders and vendor procurement</p>
          </div>
          <div className="flex items-center gap-3">
            {!showLifeCycle && (
              <button onClick={() => setShowLifeCycle(true)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50">
                Show Lifecycle
              </button>
            )}
            <Button onClick={openNew}
              className="h-9 px-4 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold">
              <Plus className="w-4 h-4 mr-1.5" /> New Purchase Order
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4">

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Orders', value: counts.all,   color: 'text-blue-600',  bg: 'bg-blue-50'  },
              { label: 'Open Value',   value: formatCurrency(totalOpen),   color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Billed Value', value: formatCurrency(totalBilled), color: 'text-green-600', bg: 'bg-green-50' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-xl border border-gray-200 px-5 py-4`}>
                <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Table card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Filter + search */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 gap-4">
              <div className="flex gap-1">
                {(['all', 'draft', 'open', 'billed', 'cancelled'] as const).map(s => (
                  <button key={s} type="button" onClick={() => setFilterStatus(s)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                      filterStatus === s ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                    }`}>
                    {s === 'all' ? `All (${counts.all})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${counts[s as keyof typeof counts]})`}
                  </button>
                ))}
              </div>
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search orders…"
                  className="w-full h-8 pl-9 pr-3 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400" />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['PO Number', 'Vendor Name', 'Date', 'Delivery Date', 'Status', 'Total', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <ShoppingCart className="w-10 h-10 text-gray-200" />
                        <p className="text-sm text-gray-400 font-medium">No purchase orders found</p>
                        <Button onClick={openNew} size="sm"
                          className="h-8 px-4 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                          <Plus className="w-3.5 h-3.5 mr-1" /> Create First PO
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map(o => (
                  <tr key={o.id} className="group hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => openEdit(o)}
                        className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline">
                        {o.poNumber}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{o.vendorName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(o.date)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{o.deliveryDate ? formatDate(o.deliveryDate) : '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800">
                      {o.total > 0 ? formatCurrency(o.total, o.currency) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RowMenu
                        onEdit={() => openEdit(o)}
                        onDuplicate={() => handleDuplicate(o)}
                        onDelete={() => handleDelete(o.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
