import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ChevronDown, Upload, X, Plus, Trash2, Search,
  Settings, ReceiptText, Car, LayoutGrid, Calendar,
  FileText, DollarSign, Tag, AlertCircle, CheckCircle2,
  Info, Save, HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────
type ExpenseTab = 'record' | 'mileage' | 'bulk';

interface BulkRow {
  id: number;
  date: string;
  expenseAccount: string;
  currency: string;
  amount: string;
  paidThrough: string;
  vendor: string;
  customerName: string;
  projects: string;
  billable: boolean;
  reportingTags: string;
}

// ─── Grouped Account Data ─────────────────────────────────
const GROUPED_EXPENSE_ACCOUNTS = [
  {
    group: 'Cost Of Goods Sold',
    items: ['Cost of Goods Sold', 'Job Costing', 'Labor', 'Materials', 'Subcontractor'],
  },
  {
    group: 'Expense',
    items: [
      'Advertising & Marketing', 'Bank Charges', 'Cleaning',
      'Consulting & Professional Services', 'Depreciation', 'Entertainment',
      'Fuel', 'Insurance', 'Meals & Entertainment', 'Office Supplies',
      'Rent', 'Repairs & Maintenance', 'Salaries & Employee Wages',
      'Shipping & Delivery', 'Software & Technology', 'Travel', 'Utilities',
    ],
  },
  {
    group: 'Other Expense',
    items: ['Extraordinary Items', 'Income Tax Expense', 'Loss on Discontinued Operations'],
  },
];

const ALL_EXPENSE_ACCOUNTS = GROUPED_EXPENSE_ACCOUNTS.flatMap(g => g.items);

const GROUPED_PAID_THROUGH = [
  {
    group: 'Cash',
    items: ['Petty Cash', 'Owner Funds Invested'],
  },
  {
    group: 'Bank',
    items: ['Bank – Current Account', 'Bank – Savings Account'],
  },
  {
    group: 'Credit Card',
    items: ['Company Credit Card'],
  },
];

const ALL_PAID_THROUGH = GROUPED_PAID_THROUGH.flatMap(g => g.items);

const VENDORS = ['ABC Suppliers', 'XYZ Traders', 'Global Imports', 'Local Mart', 'Tech Vendors Ltd'];
const CUSTOMERS = ['Acme Corp', 'Beta Industries', 'Gamma Solutions', 'Delta Retail', 'Epsilon Farms'];
const PROJECTS = ['Project Alpha', 'Project Beta', 'Harvest 2025', 'Warehouse Expansion', 'Marketing Campaign'];
const MILEAGE_CATEGORIES = ['Business Travel', 'Client Visit', 'Site Inspection', 'Delivery', 'Other'];
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED'];

const ACCOUNT_TYPES = [
  'Fixed Asset', 'Other Asset', 'Other Current Asset', 'Cash', 'Bank',
  'Credit Card', 'Long Term Liability', 'Other Current Liability',
  'Equity', 'Income', 'Other Income', 'Cost of Goods Sold', 'Expense', 'Other Expense',
];

const ACCOUNT_TYPE_TIPS: Record<string, { title: string; desc: string; bullets: string[] }> = {
  'Fixed Asset': {
    title: 'Fixed Asset',
    desc: 'Any long term investment that cannot easily be converted into cash.',
    bullets: ['Land and Buildings', 'Plant, Machinery and Equipment', 'Computers', 'Furniture'],
  },
  'Expense': {
    title: 'Expense',
    desc: 'Money spent or cost incurred in an organization\'s efforts to generate revenue.',
    bullets: ['Advertising', 'Rent', 'Salaries', 'Utilities'],
  },
  'Bank': {
    title: 'Bank',
    desc: 'A bank account that you have set up with a financial institution.',
    bullets: ['Current Account', 'Savings Account', 'Overdraft Account'],
  },
};

const EMPTY_BULK_ROW = (id: number): BulkRow => ({
  id, date: '', expenseAccount: '', currency: 'INR', amount: '',
  paidThrough: '', vendor: '', customerName: '', projects: '',
  billable: false, reportingTags: '',
});

// ─── useOutsideClick ──────────────────────────────────────
function useOutsideClick(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      handler();
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}

// ─── Create Account Modal ─────────────────────────────────
function CreateAccountModal({
  onClose, onSave,
}: { onClose: () => void; onSave: (name: string) => void }) {
  const [type, setType] = useState('Fixed Asset');
  const [name, setName] = useState('');
  const [isSub, setIsSub] = useState(false);
  const [code, setCode] = useState('');
  const [desc, setDesc] = useState('');
  const [showTip, setShowTip] = useState(false);
  const tip = ACCOUNT_TYPE_TIPS[type];

  const handleSave = () => {
    if (!name.trim()) { toast.error('Account Name is required'); return; }
    onSave(name.trim());
    toast.success(`Account "${name.trim()}" created`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-visible">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">Create Account</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Account Type */}
          <div className="relative flex items-start gap-4">
            <div className="flex-1">
              <Label className="text-sm font-medium text-red-500 mb-1 block">Account Type<span className="ml-0.5">*</span></Label>
              <div className="relative">
                <select
                  value={type}
                  onChange={e => setType(e.target.value)}
                  className="w-full h-10 px-3 pr-9 border border-gray-300 rounded-md bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none"
                >
                  {ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            {/* Tooltip */}
            {tip && (
              <button
                type="button"
                onClick={() => setShowTip(s => !s)}
                className="mt-7 text-gray-400 hover:text-gray-600 shrink-0"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            )}
            {showTip && tip && (
              <div className="absolute left-full top-0 ml-2 z-50 w-64 bg-[#1a2d42] text-white rounded-xl p-4 shadow-2xl">
                <p className="text-sm font-bold mb-1">{tip.title}</p>
                <p className="text-xs text-gray-300 mb-3 leading-relaxed">{tip.desc}</p>
                <ul className="space-y-1">
                  {tip.bullets.map(b => (
                    <li key={b} className="text-xs text-blue-300 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />{b}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Account Name */}
          <div>
            <Label className="text-sm font-medium text-red-500 mb-1 block">Account Name<span className="ml-0.5">*</span></Label>
            <Input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="Enter account name"
              className="h-10 text-sm border-gray-300 focus:border-blue-500 bg-white"
            />
          </div>

          {/* Sub-account */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={isSub} onChange={e => setIsSub(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded" />
            <span className="text-sm text-gray-700">Make this a sub-account</span>
            <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
          </label>

          {/* Account Code */}
          <div>
            <Label className="text-sm font-medium text-gray-500 mb-1 block border-b border-dashed border-gray-300 inline-block pb-0.5">Account Code</Label>
            <Input
              value={code} onChange={e => setCode(e.target.value)}
              placeholder=""
              className="h-10 text-sm border-gray-300 focus:border-blue-500 bg-white mt-1"
            />
          </div>

          {/* Description */}
          <div>
            <Label className="text-sm font-medium text-gray-500 mb-1 block">Description</Label>
            <textarea
              value={desc} onChange={e => setDesc(e.target.value)}
              maxLength={500} rows={3}
              placeholder="Max. 500 characters"
              className="w-full resize-none px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder-gray-400"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center gap-3">
          <Button
            onClick={handleSave}
            className="h-9 px-5 text-sm bg-green-600 hover:bg-green-700 text-white font-semibold"
          >Save and Select</Button>
          <Button variant="outline" onClick={onClose}
            className="h-9 px-4 text-sm border-gray-300 text-gray-600">Cancel</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Create Vendor Modal ──────────────────────────────────
function CreateVendorModal({ onClose, onSave }: { onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const handleSave = () => {
    if (!name.trim()) { toast.error('Vendor name is required'); return; }
    onSave(name.trim());
    toast.success(`Vendor "${name.trim()}" created`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">New Vendor</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <Label className="text-xs font-medium text-red-500 mb-1 block">Vendor Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Enter vendor name"
              className="h-9 text-sm border-gray-300 focus:border-blue-500 bg-white" />
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600 mb-1 block">Email</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="vendor@example.com" type="email"
              className="h-9 text-sm border-gray-300 focus:border-blue-500 bg-white" />
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600 mb-1 block">Phone</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 XXXXX XXXXX"
              className="h-9 text-sm border-gray-300 focus:border-blue-500 bg-white" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex items-center gap-3">
          <Button onClick={handleSave} className="h-9 px-5 text-sm bg-green-600 hover:bg-green-700 text-white font-semibold">
            Save and Select
          </Button>
          <Button variant="outline" onClick={onClose} className="h-9 px-4 text-sm border-gray-300 text-gray-600">Cancel</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Create Customer Modal ────────────────────────────────
function CreateCustomerModal({ onClose, onSave }: { onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const handleSave = () => {
    if (!name.trim()) { toast.error('Customer name is required'); return; }
    onSave(name.trim());
    toast.success(`Customer "${name.trim()}" created`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">New Customer</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <Label className="text-xs font-medium text-red-500 mb-1 block">Customer Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Enter customer name"
              className="h-9 text-sm border-gray-300 focus:border-blue-500 bg-white" />
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600 mb-1 block">Email</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="customer@example.com" type="email"
              className="h-9 text-sm border-gray-300 focus:border-blue-500 bg-white" />
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600 mb-1 block">Phone</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 XXXXX XXXXX"
              className="h-9 text-sm border-gray-300 focus:border-blue-500 bg-white" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex items-center gap-3">
          <Button onClick={handleSave} className="h-9 px-5 text-sm bg-green-600 hover:bg-green-700 text-white font-semibold">
            Save and Select
          </Button>
          <Button variant="outline" onClick={onClose} className="h-9 px-4 text-sm border-gray-300 text-gray-600">Cancel</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Grouped Account Select ───────────────────────────────
// Used for Expense Account and Paid Through — with grouped headers, search, + New Account
interface GroupedOption { group: string; items: string[] }

function GroupedSelect({
  label, groups, value, onChange, placeholder = 'Select an account',
  required = false, createNewLabel, onCreateNew,
}: {
  label?: string;
  groups: GroupedOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  createNewLabel?: string;
  onCreateNew?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false));

  const filteredGroups = groups.map(g => ({
    ...g,
    items: g.items.filter(i => i.toLowerCase().includes(search.toLowerCase())),
  })).filter(g => g.items.length > 0);

  const hasResults = filteredGroups.some(g => g.items.length > 0);

  return (
    <div ref={ref} className="relative">
      {label && (
        <Label className="text-xs font-medium text-gray-600 mb-1 block">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </Label>
      )}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full h-9 px-3 flex items-center justify-between border border-gray-300 rounded-md bg-white text-sm hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>{value || placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden" style={{ minWidth: 240 }}>
          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                autoFocus value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search"
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-blue-400 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-52 overflow-y-auto">
            {!hasResults ? (
              <p className="px-4 py-3 text-sm font-semibold text-gray-500 tracking-wide">NO RESULTS FOUND</p>
            ) : (
              filteredGroups.map(g => (
                <div key={g.group}>
                  <p className="px-3 pt-2.5 pb-1 text-xs font-bold text-gray-800 uppercase tracking-wider">{g.group}</p>
                  {g.items.map(item => (
                    <button
                      key={item} type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => { onChange(item); setOpen(false); setSearch(''); }}
                      className={`w-full text-left pl-5 pr-3 py-2 text-sm transition-colors ${
                        value === item
                          ? 'bg-blue-500 text-white font-medium'
                          : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                      }`}
                    >{item}</button>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Create New */}
          {createNewLabel && onCreateNew && (
            <div className="border-t border-gray-100 p-2">
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => { setOpen(false); setSearch(''); onCreateNew(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg font-medium transition-colors"
              >
                <div className="w-5 h-5 rounded-full border-2 border-blue-500 flex items-center justify-center shrink-0">
                  <Plus className="w-3 h-3" />
                </div>
                {createNewLabel}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Simple Searchable Select (with + New button) ─────────
function SearchableSelect({
  label, options, value, onChange, placeholder = 'Select…',
  required = false, createNewLabel, onCreateNew,
}: {
  label?: string; options: string[]; value: string;
  onChange: (v: string) => void; placeholder?: string; required?: boolean;
  createNewLabel?: string; onCreateNew?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false));
  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={ref} className="relative">
      {label && (
        <Label className="text-xs font-medium text-gray-600 mb-1 block">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </Label>
      )}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full h-9 px-3 flex items-center justify-between border border-gray-300 rounded-md bg-white text-sm hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>{value || placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden" style={{ minWidth: 220 }}>
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                autoFocus value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search"
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-blue-400 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
              />
            </div>
          </div>
          <div className="max-h-44 overflow-y-auto">
            {filtered.length === 0
              ? <p className="px-4 py-3 text-sm font-semibold text-gray-500 tracking-wide">NO RESULTS FOUND</p>
              : filtered.map(o => (
                <button
                  key={o} type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => { onChange(o); setOpen(false); setSearch(''); }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    value === o ? 'bg-blue-500 text-white font-medium' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >{o}</button>
              ))
            }
          </div>
          {/* Clear */}
          {value && (
            <div className="border-t border-gray-100 px-2 pt-1">
              <button type="button" onMouseDown={e => e.preventDefault()}
                onClick={() => { onChange(''); setOpen(false); setSearch(''); }}
                className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded">
                Clear selection
              </button>
            </div>
          )}
          {/* Create New */}
          {createNewLabel && onCreateNew && (
            <div className={`${value ? '' : 'border-t border-gray-100'} p-2`}>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => { setOpen(false); setSearch(''); onCreateNew(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg font-medium transition-colors"
              >
                <div className="w-5 h-5 rounded-full border-2 border-blue-500 flex items-center justify-center shrink-0">
                  <Plus className="w-3 h-3" />
                </div>
                {createNewLabel}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ReceiptDropZone ──────────────────────────────────────
function ReceiptDropZone() {
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
  };
  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
  };
  const removeFile = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        <ReceiptText className="w-4 h-4 text-blue-500" /> Receipts
      </h3>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50'}`}
      >
        <Upload className={`w-8 h-8 mx-auto mb-3 ${dragging ? 'text-blue-500' : 'text-gray-400'}`} />
        <p className="text-sm font-medium text-gray-600 mb-1">
          {dragging ? 'Drop files here' : 'Drag or Drop your Receipts'}
        </p>
        <p className="text-xs text-gray-400 mb-4">Supports: JPG, PNG, PDF, XLSX up to 5MB</p>
        <button type="button" onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-blue-300 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-50 transition-colors shadow-sm">
          <Upload className="w-3.5 h-3.5" /> Upload your Files
        </button>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFiles}
          accept=".jpg,.jpeg,.png,.pdf,.xlsx,.xls,.csv" />
      </div>
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
              <FileText className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="text-xs text-gray-700 flex-1 truncate">{f.name}</span>
              <span className="text-xs text-gray-400 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
              <button type="button" onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500 shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Tab 1 — Record Expense ───────────────────────────────
function RecordExpenseTab({ onSave, onSaveNew, onCancel }: {
  onSave: () => void; onSaveNew: () => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    expenseAccount: '', amount: '', currency: 'INR',
    paidThrough: '', vendor: '', invoice: '',
    notes: '', customer: '', itemize: false,
  });
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [showCreateVendor, setShowCreateVendor] = useState(false);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [extraAccounts, setExtraAccounts] = useState<string[]>([]);
  const [extraVendors, setExtraVendors] = useState<string[]>([]);
  const [extraCustomers, setExtraCustomers] = useState<string[]>([]);

  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  const allVendors = [...VENDORS, ...extraVendors];
  const allCustomers = [...CUSTOMERS, ...extraCustomers];
  const groupedAccounts = [
    ...GROUPED_EXPENSE_ACCOUNTS.map(g => ({
      ...g,
      items: g.group === 'Expense' ? [...g.items, ...extraAccounts] : g.items,
    })),
  ];

  return (
    <>
      {showCreateAccount && (
        <CreateAccountModal
          onClose={() => setShowCreateAccount(false)}
          onSave={name => { setExtraAccounts(p => [...p, name]); set('expenseAccount', name); }}
        />
      )}
      {showCreateVendor && (
        <CreateVendorModal
          onClose={() => setShowCreateVendor(false)}
          onSave={name => { setExtraVendors(p => [...p, name]); set('vendor', name); }}
        />
      )}
      {showCreateCustomer && (
        <CreateCustomerModal
          onClose={() => setShowCreateCustomer(false)}
          onSave={name => { setExtraCustomers(p => [...p, name]); set('customer', name); }}
        />
      )}

      <div className="flex gap-6">
        <div className="flex-1 min-w-0 flex flex-col gap-5">

          {/* Date */}
          <div>
            <Label className="text-xs font-medium text-gray-600 mb-1 block">
              Date<span className="text-red-500 ml-0.5">*</span>
            </Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <Input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                className="h-9 pl-9 text-sm border-gray-300 focus:border-blue-500 bg-white" />
            </div>
          </div>

          {/* Expense Account */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs font-medium text-gray-600">
                Expense Account<span className="text-red-500 ml-0.5">*</span>
              </Label>
              <button type="button" onClick={() => set('itemize', !form.itemize)}
                className={`text-xs font-medium transition-colors ${form.itemize ? 'text-blue-600' : 'text-gray-400 hover:text-blue-500'}`}>
                {form.itemize ? '✓ Itemized' : '+ Itemize'}
              </button>
            </div>
            <GroupedSelect
              groups={groupedAccounts}
              value={form.expenseAccount}
              onChange={v => set('expenseAccount', v)}
              placeholder="Select an account"
              createNewLabel="New Account"
              onCreateNew={() => setShowCreateAccount(true)}
            />
            {form.itemize && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-600 font-medium mb-2">Itemized Expenses</p>
                <div className="space-y-2">
                  {[1, 2].map(i => (
                    <div key={i} className="flex gap-2">
                      <select className="flex-1 h-8 text-xs border border-gray-300 rounded px-2 bg-white">
                        <option value="">Select account</option>
                        {ALL_EXPENSE_ACCOUNTS.map(a => <option key={a}>{a}</option>)}
                      </select>
                      <Input type="number" placeholder="Amount" className="w-28 h-8 text-xs" />
                      <button type="button" className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button type="button" className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                    <Plus className="w-3 h-3" /> Add Line
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Amount */}
          <div>
            <Label className="text-xs font-medium text-gray-600 mb-1 block">
              Amount<span className="text-red-500 ml-0.5">*</span>
            </Label>
            <div className="flex gap-0 border border-gray-300 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500">
              <select value={form.currency} onChange={e => set('currency', e.target.value)}
                className="h-9 px-3 bg-gray-50 border-r border-gray-300 text-sm text-gray-700 focus:outline-none shrink-0 appearance-none pr-6"
                style={{ minWidth: 64 }}>
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <input type="number" min="0" step="0.01" value={form.amount}
                onChange={e => set('amount', e.target.value)}
                placeholder="0.00"
                className="flex-1 h-9 px-3 text-sm bg-white focus:outline-none" />
            </div>
          </div>

          {/* Paid Through */}
          <GroupedSelect
            label="Paid Through" required
            groups={GROUPED_PAID_THROUGH}
            value={form.paidThrough} onChange={v => set('paidThrough', v)}
            placeholder="Select an account"
          />

          {/* Vendor */}
          <SearchableSelect
            label="Vendor"
            options={allVendors} value={form.vendor}
            onChange={v => set('vendor', v)}
            placeholder="Select vendor (optional)"
            createNewLabel="New Vendor"
            onCreateNew={() => setShowCreateVendor(true)}
          />

          {/* Invoice # */}
          <div>
            <Label className="text-xs font-medium text-gray-600 mb-1 block">Invoice #</Label>
            <Input value={form.invoice} onChange={e => set('invoice', e.target.value)}
              placeholder="Enter invoice number"
              className="h-9 text-sm border-gray-300 focus:border-blue-500 bg-white" />
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs font-medium text-gray-600 mb-1 block">Notes</Label>
            <div className="relative">
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                maxLength={500} rows={3} placeholder="Add any notes for this expense…"
                className="w-full resize-none px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
              <span className="absolute bottom-2 right-3 text-xs text-gray-400">{form.notes.length}/500</span>
            </div>
          </div>

          {/* Customer Name */}
          <SearchableSelect
            label="Customer Name"
            options={allCustomers} value={form.customer}
            onChange={v => set('customer', v)}
            placeholder="Select customer (optional)"
            createNewLabel="New Customer"
            onCreateNew={() => setShowCreateCustomer(true)}
          />

          {/* Footer */}
          <div className="flex items-center gap-3 pt-2 border-t border-gray-200 mt-2">
            <Button type="button" className="bg-blue-600 hover:bg-blue-700 text-white h-9 px-5 text-sm font-semibold" onClick={onSave}>
              Save <span className="ml-1 text-xs opacity-60 font-normal">Alt+S</span>
            </Button>
            <Button type="button" variant="outline"
              className="h-9 px-5 text-sm font-medium border-gray-300 text-gray-700 hover:bg-gray-50" onClick={onSaveNew}>
              Save and New <span className="ml-1 text-xs opacity-50 font-normal">Alt+N</span>
            </Button>
            <Button type="button" variant="ghost"
              className="h-9 px-4 text-sm text-gray-500 hover:text-gray-700" onClick={onCancel}>Cancel</Button>
          </div>
        </div>

        {/* Right — Receipts */}
        <div className="w-72 shrink-0"><ReceiptDropZone /></div>
      </div>
    </>
  );
}

// ─── Mileage Preferences Modal ────────────────────────────
function MileagePrefsModal({ onClose }: { onClose: () => void }) {
  const [assocEmployee, setAssocEmployee] = useState(false);
  const [defaultCategory, setDefaultCategory] = useState('');
  const [defaultUnit, setDefaultUnit] = useState<'km' | 'mile'>('km');
  const [rates, setRates] = useState([{ id: 1, startDate: '2025-01-01', rate: '' }]);

  const addRate = () => setRates(p => [...p, { id: Date.now(), startDate: '', rate: '' }]);
  const removeRate = (id: number) => setRates(p => p.filter(r => r.id !== id));
  const updateRate = (id: number, k: 'startDate' | 'rate', v: string) =>
    setRates(p => p.map(r => r.id === id ? { ...r, [k]: v } : r));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-gray-900">Mileage Preferences</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={assocEmployee} onChange={e => setAssocEmployee(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded" />
            <div>
              <p className="text-sm font-medium text-gray-800">Associate employees to mileage expenses</p>
              <p className="text-xs text-gray-500 mt-0.5">Track mileage by individual employees</p>
            </div>
          </label>
          <div>
            <Label className="text-xs font-medium text-gray-600 mb-1 block">Default Mileage Category</Label>
            <select value={defaultCategory} onChange={e => setDefaultCategory(e.target.value)}
              className="w-full h-9 px-3 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">Select category</option>
              {MILEAGE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600 mb-2 block">Default Unit</Label>
            <div className="flex gap-4">
              {(['km', 'mile'] as const).map(u => (
                <label key={u} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="mileage_unit" value={u} checked={defaultUnit === u}
                    onChange={() => setDefaultUnit(u)} className="text-blue-600" />
                  <span className="text-sm text-gray-700">{u === 'km' ? 'Kilometer (km)' : 'Mile (mi)'}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600 mb-2 block">Mileage Rates</Label>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Start Date</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Mileage Rate ({defaultUnit === 'km' ? 'INR/km' : 'INR/mi'})
                    </th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {rates.map(r => (
                    <tr key={r.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-2 py-1.5">
                        <Input type="date" value={r.startDate} onChange={e => updateRate(r.id, 'startDate', e.target.value)}
                          className="h-8 text-xs border-gray-200" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input type="number" value={r.rate} placeholder="0.00" onChange={e => updateRate(r.id, 'rate', e.target.value)}
                          className="h-8 text-xs border-gray-200" />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {rates.length > 1 && (
                          <button type="button" onClick={() => removeRate(r.id)} className="text-gray-400 hover:text-red-500">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-3 py-2 border-t border-gray-100">
                <button type="button" onClick={addRate}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium">
                  <Plus className="w-3.5 h-3.5" /> Add Mileage Rate
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose} className="h-9 px-4 text-sm border-gray-300 text-gray-600">Cancel</Button>
          <Button onClick={() => { toast.success('Mileage preferences saved'); onClose(); }}
            className="h-9 px-5 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold">
            Save Preferences
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 2 — Record Mileage ───────────────────────────────
function RecordMileageTab({ onSave, onSaveNew, onCancel }: {
  onSave: () => void; onSaveNew: () => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    employee: '', calcMethod: 'manual',
    distance: '', unit: 'km', amount: '',
    paidThrough: '', vendor: '', invoice: '', notes: '',
  });
  const [showPrefs, setShowPrefs] = useState(false);
  const [showCreateVendor, setShowCreateVendor] = useState(false);
  const [extraVendors, setExtraVendors] = useState<string[]>([]);
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const allVendors = [...VENDORS, ...extraVendors];

  return (
    <>
      {showPrefs && <MileagePrefsModal onClose={() => setShowPrefs(false)} />}
      {showCreateVendor && (
        <CreateVendorModal
          onClose={() => setShowCreateVendor(false)}
          onSave={name => { setExtraVendors(p => [...p, name]); set('vendor', name); }}
        />
      )}
      <div className="flex gap-6">
        <div className="flex-1 min-w-0 flex flex-col gap-5">
          <div className="flex items-center justify-end">
            <button type="button" onClick={() => setShowPrefs(true)}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium">
              <Settings className="w-3.5 h-3.5" /> Set your mileage preferences
            </button>
          </div>

          <div>
            <Label className="text-xs font-medium text-gray-600 mb-1 block">
              Date<span className="text-red-500 ml-0.5">*</span>
            </Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <Input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                className="h-9 pl-9 text-sm border-gray-300 focus:border-blue-500 bg-white" />
            </div>
          </div>

          <SearchableSelect
            label="Employee"
            options={['Rajan Kumar', 'Priya Sharma', 'Arun Patel', 'Deepa Nair', 'Vijay Menon']}
            value={form.employee} onChange={v => set('employee', v)}
            placeholder="Select employee (optional)"
          />

          <div>
            <Label className="text-xs font-medium text-gray-600 mb-1 block">
              Calculate Mileage Using<span className="text-red-500 ml-0.5">*</span>
            </Label>
            <div className="flex gap-2">
              {['manual', 'google_maps'].map(m => (
                <label key={m} className={`flex-1 flex items-center justify-center gap-2 h-9 border rounded-md text-sm cursor-pointer transition-colors ${
                  form.calcMethod === m ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-300 bg-white text-gray-600 hover:border-blue-300'
                }`}>
                  <input type="radio" name="calcMethod" value={m} checked={form.calcMethod === m}
                    onChange={() => set('calcMethod', m)} className="sr-only" />
                  {m === 'manual' ? 'Enter Manually' : 'Google Maps'}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium text-gray-600 mb-1 block">
              Distance<span className="text-red-500 ml-0.5">*</span>
            </Label>
            <div className="flex gap-2">
              <Input type="number" min="0" step="0.1" value={form.distance} onChange={e => set('distance', e.target.value)}
                placeholder="0.0" className="flex-1 h-9 text-sm border-gray-300 focus:border-blue-500 bg-white" />
              <div className="flex border border-gray-300 rounded-md overflow-hidden bg-white">
                {['km', 'mile'].map(u => (
                  <button key={u} type="button" onClick={() => set('unit', u)}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${form.unit === u ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium text-gray-600 mb-1 block">
              Amount<span className="text-red-500 ml-0.5">*</span>
            </Label>
            <div className="flex gap-0 border border-gray-300 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500">
              <span className="h-9 px-3 flex items-center bg-gray-50 border-r border-gray-300 text-sm text-gray-600 font-medium shrink-0">INR</span>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)}
                placeholder="0.00" className="flex-1 h-9 px-3 text-sm bg-white focus:outline-none" />
            </div>
          </div>

          <GroupedSelect
            label="Paid Through" required
            groups={GROUPED_PAID_THROUGH}
            value={form.paidThrough} onChange={v => set('paidThrough', v)}
            placeholder="Select an account"
          />

          <SearchableSelect
            label="Vendor"
            options={allVendors} value={form.vendor}
            onChange={v => set('vendor', v)}
            placeholder="Select vendor (optional)"
            createNewLabel="New Vendor"
            onCreateNew={() => setShowCreateVendor(true)}
          />

          <div>
            <Label className="text-xs font-medium text-gray-600 mb-1 block">Invoice #</Label>
            <Input value={form.invoice} onChange={e => set('invoice', e.target.value)}
              placeholder="Enter invoice number"
              className="h-9 text-sm border-gray-300 focus:border-blue-500 bg-white" />
          </div>

          <div>
            <Label className="text-xs font-medium text-gray-600 mb-1 block">Notes</Label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              maxLength={500} rows={3} placeholder="Add notes for this mileage expense…"
              className="w-full resize-none px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
            <Button type="button" className="bg-blue-600 hover:bg-blue-700 text-white h-9 px-5 text-sm font-semibold" onClick={onSave}>
              Save <span className="ml-1 text-xs opacity-60 font-normal">Alt+S</span>
            </Button>
            <Button type="button" variant="outline"
              className="h-9 px-5 text-sm font-medium border-gray-300 text-gray-700 hover:bg-gray-50" onClick={onSaveNew}>
              Save and New <span className="ml-1 text-xs opacity-50 font-normal">Alt+N</span>
            </Button>
            <Button type="button" variant="ghost"
              className="h-9 px-4 text-sm text-gray-500 hover:text-gray-700" onClick={onCancel}>Cancel</Button>
          </div>
        </div>
        <div className="w-72 shrink-0"><ReceiptDropZone /></div>
      </div>
    </>
  );
}

// ─── Bulk Row Account Cell (typeable combobox — grouped) ──
function BulkAccountCell({ value, onChange, groups, onCreateNew }: {
  value: string; onChange: (v: string) => void;
  groups: GroupedOption[]; onCreateNew: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Sync inputVal when value changes from outside
  useEffect(() => { setInputVal(value); }, [value]);

  useOutsideClick(ref, () => {
    setOpen(false);
    // If typed text doesn't match any item, revert to last committed value
    setInputVal(value);
  });

  const query = inputVal.toLowerCase();
  const filteredGroups = groups.map(g => ({
    ...g,
    items: g.items.filter(i => i.toLowerCase().includes(query)),
  })).filter(g => g.items.length > 0);
  const hasResults = filteredGroups.some(g => g.items.length > 0);

  const selectItem = (item: string) => {
    onChange(item);
    setInputVal(item);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      {/* Typeable input trigger */}
      <div className={`flex items-center h-8 border rounded-md bg-white transition-colors ${open ? 'border-blue-400 ring-1 ring-blue-400/30' : 'border-gray-200 hover:border-blue-300'}`}>
        <input
          ref={inputRef}
          value={inputVal}
          placeholder="Select an account"
          onChange={e => { setInputVal(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="flex-1 h-full px-2 text-xs bg-transparent focus:outline-none placeholder-gray-400 text-gray-800 min-w-0"
        />
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={e => { e.preventDefault(); setOpen(o => !o); inputRef.current?.focus(); }}
          className="pr-2 text-gray-400 hover:text-gray-600 shrink-0"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="absolute z-[110] left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden" style={{ minWidth: 260 }}>
          <div className="max-h-52 overflow-y-auto">
            {!hasResults
              ? <p className="px-3 py-3 text-xs font-semibold text-gray-500 tracking-wide">NO RESULTS FOUND</p>
              : filteredGroups.map(g => (
                <div key={g.group}>
                  <p className="px-3 pt-2 pb-1 text-xs font-bold text-gray-800 uppercase tracking-wider">{g.group}</p>
                  {g.items.map(item => (
                    <button key={item} type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => selectItem(item)}
                      className={`w-full text-left pl-5 pr-3 py-1.5 text-xs transition-colors ${
                        value === item ? 'bg-blue-500 text-white font-medium' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                      }`}>{item}</button>
                  ))}
                </div>
              ))
            }
          </div>
          <div className="border-t border-gray-100 p-1.5">
            <button type="button" onMouseDown={e => e.preventDefault()}
              onClick={() => { setOpen(false); onCreateNew(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-lg font-medium">
              <div className="w-4 h-4 rounded-full border-2 border-blue-500 flex items-center justify-center shrink-0">
                <Plus className="w-2.5 h-2.5" />
              </div>
              New Account
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Bulk Simple Cell (typeable combobox — flat list) ─────
function BulkSimpleCell({ value, onChange, options, placeholder, createNewLabel, onCreateNew }: {
  value: string; onChange: (v: string) => void; options: string[];
  placeholder: string; createNewLabel?: string; onCreateNew?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setInputVal(value); }, [value]);

  useOutsideClick(ref, () => {
    setOpen(false);
    setInputVal(value);
  });

  const query = inputVal.toLowerCase();
  const filtered = options.filter(o => o.toLowerCase().includes(query));

  const selectItem = (item: string) => {
    onChange(item);
    setInputVal(item);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <div className={`flex items-center h-8 border rounded-md bg-white transition-colors ${open ? 'border-blue-400 ring-1 ring-blue-400/30' : 'border-gray-200 hover:border-blue-300'}`}>
        <input
          ref={inputRef}
          value={inputVal}
          placeholder={placeholder}
          onChange={e => { setInputVal(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="flex-1 h-full px-2 text-xs bg-transparent focus:outline-none placeholder-gray-400 text-gray-800 min-w-0"
        />
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={e => { e.preventDefault(); setOpen(o => !o); inputRef.current?.focus(); }}
          className="pr-2 text-gray-400 hover:text-gray-600 shrink-0"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="absolute z-[110] left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden" style={{ minWidth: 200 }}>
          <div className="max-h-44 overflow-y-auto">
            {filtered.length === 0
              ? <p className="px-3 py-2.5 text-xs font-semibold text-gray-500 tracking-wide">NO RESULTS FOUND</p>
              : filtered.map(o => (
                <button key={o} type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => selectItem(o)}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                    value === o ? 'bg-blue-500 text-white font-medium' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                  }`}>{o}</button>
              ))
            }
          </div>
          {createNewLabel && onCreateNew && (
            <div className="border-t border-gray-100 p-1.5">
              <button type="button" onMouseDown={e => e.preventDefault()}
                onClick={() => { setOpen(false); onCreateNew(); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-lg font-medium">
                <div className="w-4 h-4 rounded-full border-2 border-blue-500 flex items-center justify-center shrink-0">
                  <Plus className="w-2.5 h-2.5" />
                </div>
                {createNewLabel}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab 3 — Bulk Add Expenses ────────────────────────────
function BulkAddExpensesTab({ onSave, onCancel }: {
  onSave: () => void; onCancel: () => void;
}) {
  const [rows, setRows] = useState<BulkRow[]>(
    Array.from({ length: 10 }, (_, i) => EMPTY_BULK_ROW(i + 1))
  );
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [showCreateVendor, setShowCreateVendor] = useState(false);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [pendingCreateRowId, setPendingCreateRowId] = useState<number | null>(null);
  const [pendingCreateField, setPendingCreateField] = useState<string>('');
  const [extraAccounts, setExtraAccounts] = useState<string[]>([]);
  const [extraVendors, setExtraVendors] = useState<string[]>([]);
  const [extraCustomers, setExtraCustomers] = useState<string[]>([]);

  const setCell = useCallback((id: number, k: keyof BulkRow, v: string | boolean) => {
    setRows(p => p.map(r => r.id === id ? { ...r, [k]: v } : r));
  }, []);

  const addRows = () => {
    const maxId = Math.max(...rows.map(r => r.id), 0);
    setRows(p => [...p, ...Array.from({ length: 5 }, (_, i) => EMPTY_BULK_ROW(maxId + i + 1))]);
  };

  const removeRow = (id: number) => {
    if (rows.length <= 1) return;
    setRows(p => p.filter(r => r.id !== id));
  };

  const filledRows = rows.filter(r => r.date || r.expenseAccount || r.amount);

  const groupedAccounts = GROUPED_EXPENSE_ACCOUNTS.map(g => ({
    ...g,
    items: g.group === 'Expense' ? [...g.items, ...extraAccounts] : g.items,
  }));
  const allVendors = [...VENDORS, ...extraVendors];
  const allCustomers = [...CUSTOMERS, ...extraCustomers];

  return (
    <>
      {showCreateAccount && (
        <CreateAccountModal
          onClose={() => setShowCreateAccount(false)}
          onSave={name => {
            setExtraAccounts(p => [...p, name]);
            if (pendingCreateRowId) setCell(pendingCreateRowId, 'expenseAccount', name);
            setPendingCreateRowId(null);
          }}
        />
      )}
      {showCreateVendor && (
        <CreateVendorModal
          onClose={() => setShowCreateVendor(false)}
          onSave={name => {
            setExtraVendors(p => [...p, name]);
            if (pendingCreateRowId) setCell(pendingCreateRowId, 'vendor', name);
            setPendingCreateRowId(null);
          }}
        />
      )}
      {showCreateCustomer && (
        <CreateCustomerModal
          onClose={() => setShowCreateCustomer(false)}
          onSave={name => {
            setExtraCustomers(p => [...p, name]);
            if (pendingCreateRowId) setCell(pendingCreateRowId, 'customerName', name);
            setPendingCreateRowId(null);
          }}
        />
      )}

      <div className="flex flex-col gap-4">
        {/* Info banner */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700">
            Fill in multiple expenses at once. Fields marked <span className="text-red-500 font-semibold">*</span> are required per row. Unfilled rows are ignored on save.
          </p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="border-collapse w-full" style={{ minWidth: 1440 }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {[
                  { label: 'Date', req: true, w: 160 },
                  { label: 'Expense Account', req: true, w: 240 },
                  { label: 'Amount', req: true, w: 170 },
                  { label: 'Paid Through', req: true, w: 200 },
                  { label: 'Vendor', req: false, w: 180 },
                  { label: 'Customer Name', req: false, w: 180 },
                  { label: 'Projects', req: false, w: 160 },
                  { label: 'Billable', req: false, w: 90 },
                  { label: 'Reporting Tags', req: false, w: 170 },
                ].map(col => (
                  <th key={col.label} style={{ minWidth: col.w, width: col.w }}
                    className="px-3 py-3 text-left text-xs font-semibold text-red-500 uppercase tracking-wide">
                    {col.label}{col.req && ' *'}
                  </th>
                ))}
                <th style={{ width: 44 }} />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {rows.map((row, idx) => (
                <tr key={row.id}
                  className={`group transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} hover:bg-blue-50/30`}>

                  {/* DATE */}
                  <td className="px-2 py-1.5" style={{ minWidth: 160 }}>
                    <Input type="date" value={row.date} onChange={e => setCell(row.id, 'date', e.target.value)}
                      className="h-8 text-xs border-gray-200 focus:border-blue-400 bg-transparent w-full" />
                  </td>

                  {/* EXPENSE ACCOUNT */}
                  <td className="px-2 py-1.5 overflow-visible" style={{ minWidth: 240 }}>
                    <BulkAccountCell
                      value={row.expenseAccount}
                      onChange={v => setCell(row.id, 'expenseAccount', v)}
                      groups={groupedAccounts}
                      onCreateNew={() => { setPendingCreateRowId(row.id); setShowCreateAccount(true); }}
                    />
                  </td>

                  {/* AMOUNT — currency selector + input */}
                  <td className="px-2 py-1.5" style={{ minWidth: 170 }}>
                    <div className="flex gap-0 border border-gray-200 rounded-md overflow-hidden h-8 focus-within:border-blue-400">
                      <select value={row.currency} onChange={e => setCell(row.id, 'currency', e.target.value)}
                        className="h-full px-2 bg-gray-50 border-r border-gray-200 text-xs text-gray-600 focus:outline-none appearance-none font-medium"
                        style={{ minWidth: 56 }}>
                        {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                      <input type="number" min="0" step="0.01" value={row.amount} placeholder="0.00"
                        onChange={e => setCell(row.id, 'amount', e.target.value)}
                        className="flex-1 h-full px-2 text-xs bg-transparent focus:outline-none min-w-0" />
                    </div>
                  </td>

                  {/* PAID THROUGH */}
                  <td className="px-2 py-1.5 overflow-visible" style={{ minWidth: 200 }}>
                    <BulkAccountCell
                      value={row.paidThrough}
                      onChange={v => setCell(row.id, 'paidThrough', v)}
                      groups={GROUPED_PAID_THROUGH}
                      onCreateNew={() => { }}
                    />
                  </td>

                  {/* VENDOR */}
                  <td className="px-2 py-1.5 overflow-visible" style={{ minWidth: 180 }}>
                    <BulkSimpleCell
                      value={row.vendor} onChange={v => setCell(row.id, 'vendor', v)}
                      options={allVendors} placeholder="Select vendor"
                      createNewLabel="New Vendor"
                      onCreateNew={() => { setPendingCreateRowId(row.id); setShowCreateVendor(true); }}
                    />
                  </td>

                  {/* CUSTOMER NAME */}
                  <td className="px-2 py-1.5 overflow-visible" style={{ minWidth: 180 }}>
                    <BulkSimpleCell
                      value={row.customerName} onChange={v => setCell(row.id, 'customerName', v)}
                      options={allCustomers} placeholder="Select customer"
                      createNewLabel="New Customer"
                      onCreateNew={() => { setPendingCreateRowId(row.id); setShowCreateCustomer(true); }}
                    />
                  </td>

                  {/* PROJECTS */}
                  <td className="px-2 py-1.5 overflow-visible" style={{ minWidth: 160 }}>
                    <BulkSimpleCell
                      value={row.projects} onChange={v => setCell(row.id, 'projects', v)}
                      options={PROJECTS} placeholder="Select project"
                    />
                  </td>

                  {/* BILLABLE */}
                  <td className="px-2 py-1.5 text-center" style={{ minWidth: 90 }}>
                    <input type="checkbox" checked={row.billable}
                      onChange={e => setCell(row.id, 'billable', e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded cursor-pointer" />
                  </td>

                  {/* REPORTING TAGS */}
                  <td className="px-2 py-1.5" style={{ minWidth: 170 }}>
                    <button type="button"
                      className="w-full h-8 px-2 flex items-center gap-1.5 border border-gray-200 rounded-md bg-transparent text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
                      <Tag className="w-3 h-3" />
                      {row.reportingTags || 'Associate Tags'}
                    </button>
                  </td>

                  {/* REMOVE */}
                  <td className="px-2 py-1.5 text-center" style={{ width: 44 }}>
                    <button type="button" onClick={() => removeRow(row.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add rows */}
        <button type="button" onClick={addRows}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium self-start">
          <Plus className="w-4 h-4" /> Add 5 More Rows
        </button>

        {/* Summary */}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            {filledRows.length} row{filledRows.length !== 1 ? 's' : ''} filled
          </span>
          <span className="flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-gray-400" />
            {rows.length - filledRows.length} empty
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 pt-3 border-t border-gray-200">
          <Button type="button"
            className="bg-blue-600 hover:bg-blue-700 text-white h-9 px-5 text-sm font-semibold"
            onClick={onSave}>
            <Save className="w-4 h-4 mr-2" />
            Save {filledRows.length > 0 ? `(${filledRows.length})` : ''}
          </Button>
          <Button type="button" variant="ghost"
            className="h-9 px-4 text-sm text-gray-500 hover:text-gray-700"
            onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </>
  );
}

// ─── Main Page ─────────────────────────────────────────────
export default function PurchaseExpensesPage() {
  const [activeTab, setActiveTab] = useState<ExpenseTab>('record');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 's') { e.preventDefault(); handleSave(); }
      if (e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); handleSaveNew(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleSave = () => toast.success('Expense saved successfully');
  const handleSaveNew = () => toast.success('Expense saved. Opening new form…');
  const handleCancel = () => toast.info('Cancelled');

  const TABS: { id: ExpenseTab; label: string; icon: React.ReactNode }[] = [
    { id: 'record',  label: 'Record Expense',    icon: <ReceiptText className="w-4 h-4" /> },
    { id: 'mileage', label: 'Record Mileage',    icon: <Car className="w-4 h-4" /> },
    { id: 'bulk',    label: 'Bulk Add Expenses', icon: <LayoutGrid className="w-4 h-4" /> },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">New Expense</h1>
            <p className="text-xs text-gray-500 mt-0.5">Record, track and manage your business expenses</p>
          </div>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-md font-mono">
            EXP-{new Date().getFullYear()}-####
          </span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-6 shrink-0">
        <div className="flex">
          {TABS.map(tab => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'bulk' ? (
          <BulkAddExpensesTab onSave={handleSave} onCancel={handleCancel} />
        ) : (
          <div className="max-w-5xl mx-auto">
            {activeTab === 'record'  && <RecordExpenseTab  onSave={handleSave} onSaveNew={handleSaveNew} onCancel={handleCancel} />}
            {activeTab === 'mileage' && <RecordMileageTab  onSave={handleSave} onSaveNew={handleSaveNew} onCancel={handleCancel} />}
          </div>
        )}
      </div>
    </div>
  );
}
