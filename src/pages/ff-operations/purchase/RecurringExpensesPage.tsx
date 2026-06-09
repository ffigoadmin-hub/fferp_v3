import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus, X, Search, ChevronDown, ReceiptText, Tag,
  Calendar, RefreshCw, MoreVertical, Edit2, Trash2,
  Clock, CheckCircle2, PauseCircle, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────
interface RecurringProfile {
  id: number;
  profileName: string;
  repeatEvery: string;
  startDate: string;
  endsOn: string;
  neverExpires: boolean;
  expenseAccount: string;
  currency: string;
  amount: string;
  paidThrough: string;
  vendor: string;
  notes: string;
  customerName: string;
  reportingTags: string;
  status: 'active' | 'stopped' | 'expired';
  nextExpense: string;
}

// ─── Constants ────────────────────────────────────────────
const REPEAT_OPTIONS = [
  'Day', 'Week', '2 Weeks', 'Month', '2 Months', '3 Months',
  '6 Months', 'Year',
];

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

const GROUPED_PAID_THROUGH = [
  { group: 'Cash',        items: ['Petty Cash', 'Owner Funds Invested'] },
  { group: 'Bank',        items: ['Bank – Current Account', 'Bank – Savings Account'] },
  { group: 'Credit Card', items: ['Company Credit Card'] },
];

const CURRENCIES  = ['INR', 'USD', 'EUR', 'GBP', 'AED'];
const VENDORS     = ['ABC Suppliers', 'XYZ Traders', 'Global Imports', 'Local Mart', 'Tech Vendors Ltd'];
const CUSTOMERS   = ['Acme Corp', 'Beta Industries', 'Gamma Solutions', 'Delta Retail', 'Epsilon Farms'];

// ─── Helpers ──────────────────────────────────────────────
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function nextExpenseDate(startDate: string, repeat: string): string {
  const map: Record<string, number> = {
    'Day': 1, 'Week': 7, '2 Weeks': 14, 'Month': 30,
    '2 Months': 60, '3 Months': 90, '6 Months': 180, 'Year': 365,
  };
  return addDays(startDate, map[repeat] ?? 7);
}

function formatDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

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

// ─── GroupedSelect ─────────────────────────────────────────
interface GroupedOption { group: string; items: string[] }

function GroupedSelect({ label, groups, value, onChange, placeholder = 'Select an account', required = false }: {
  label?: string; groups: GroupedOption[]; value: string;
  onChange: (v: string) => void; placeholder?: string; required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false));

  const filtered = groups.map(g => ({
    ...g, items: g.items.filter(i => i.toLowerCase().includes(search.toLowerCase())),
  })).filter(g => g.items.length > 0);
  const hasResults = filtered.some(g => g.items.length > 0);

  return (
    <div ref={ref} className="relative">
      {label && (
        <p className={`text-sm mb-1 ${required ? 'text-red-500 font-medium' : 'text-gray-600 font-medium'}`}>
          {label}{required && '*'}
        </p>
      )}
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full h-10 px-3 flex items-center justify-between border border-gray-300 rounded-md bg-white text-sm hover:border-blue-400 focus:outline-none transition-colors">
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>{value || placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden" style={{ minWidth: 260 }}>
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search"
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-blue-400 rounded-md focus:outline-none bg-white" />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {!hasResults
              ? <p className="px-4 py-3 text-sm font-semibold text-gray-500 tracking-wide">NO RESULTS FOUND</p>
              : filtered.map(g => (
                <div key={g.group}>
                  <p className="px-3 pt-2.5 pb-1 text-xs font-bold text-gray-800 uppercase tracking-wider">{g.group}</p>
                  {g.items.map(item => (
                    <button key={item} type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => { onChange(item); setOpen(false); setSearch(''); }}
                      className={`w-full text-left pl-5 pr-3 py-2 text-sm transition-colors ${
                        value === item ? 'bg-blue-500 text-white font-medium' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                      }`}>{item}</button>
                  ))}
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ─── VendorSearchField ────────────────────────────────────
function VendorSearchField({ label, options, value, onChange, placeholder = '' }: {
  label: string; options: string[]; value: string;
  onChange: (v: string) => void; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => { setOpen(false); setSearch(value); });
  useEffect(() => { setSearch(value); }, [value]);

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={ref} className="relative flex gap-2">
      {/* Dropdown trigger */}
      <div className="flex-1 relative">
        <div className={`flex items-center h-10 border rounded-md bg-white transition-colors ${open ? 'border-blue-400' : 'border-gray-300 hover:border-blue-300'}`}>
          <input
            value={search}
            placeholder={placeholder}
            onChange={e => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            className="flex-1 h-full px-3 text-sm bg-transparent focus:outline-none text-gray-800 placeholder-gray-400"
          />
          <button type="button" tabIndex={-1}
            onMouseDown={e => { e.preventDefault(); setOpen(o => !o); }}
            className="px-2 text-gray-400 hover:text-gray-600 shrink-0">
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
        {open && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            <div className="max-h-44 overflow-y-auto">
              {filtered.length === 0
                ? <p className="px-3 py-3 text-sm font-semibold text-gray-500">NO RESULTS FOUND</p>
                : filtered.map(o => (
                  <button key={o} type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => { onChange(o); setSearch(o); setOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      value === o ? 'bg-blue-500 text-white font-medium' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                    }`}>{o}</button>
                ))
              }
            </div>
          </div>
        )}
      </div>
      {/* Green search icon button */}
      <button type="button"
        className="w-10 h-10 flex items-center justify-center bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors shrink-0">
        <Search className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── New Recurring Expense Drawer ─────────────────────────
function NewRecurringExpenseDrawer({
  onClose, onSave, editData,
}: {
  onClose: () => void;
  onSave: (data: Omit<RecurringProfile, 'id' | 'status' | 'nextExpense'>) => void;
  editData?: RecurringProfile | null;
}) {
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    profileName:    editData?.profileName    ?? '',
    repeatEvery:    editData?.repeatEvery    ?? 'Week',
    startDate:      editData?.startDate      ?? today,
    endsOn:         editData?.endsOn         ?? '',
    neverExpires:   editData?.neverExpires   ?? true,
    expenseAccount: editData?.expenseAccount ?? '',
    currency:       editData?.currency       ?? 'INR',
    amount:         editData?.amount         ?? '',
    paidThrough:    editData?.paidThrough    ?? '',
    vendor:         editData?.vendor         ?? '',
    notes:          editData?.notes          ?? '',
    customerName:   editData?.customerName   ?? '',
    reportingTags:  editData?.reportingTags  ?? '',
  });

  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  const nextDate = nextExpenseDate(form.startDate, form.repeatEvery);

  const handleSave = () => {
    if (!form.profileName.trim())    { toast.error('Profile Name is required'); return; }
    if (!form.expenseAccount)        { toast.error('Expense Account is required'); return; }
    if (!form.amount)                { toast.error('Amount is required'); return; }
    if (!form.paidThrough)           { toast.error('Paid Through is required'); return; }
    onSave(form);
    toast.success(editData ? 'Recurring expense updated' : 'Recurring expense profile created');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="w-full max-w-2xl bg-white shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <ReceiptText className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-bold text-gray-900">
              {editData ? 'Edit Recurring Expense' : 'New Recurring Expense'}
            </h2>
          </div>
          <button onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="space-y-6">

            {/* Profile Name */}
            <div className="flex items-start gap-4">
              <p className="text-sm text-red-500 font-medium w-36 shrink-0 pt-2.5">Profile Name*</p>
              <div className="flex-1">
                <input
                  autoFocus
                  value={form.profileName}
                  onChange={e => set('profileName', e.target.value)}
                  className="w-full h-10 px-3 border border-blue-400 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Repeat Every */}
            <div className="flex items-start gap-4">
              <p className="text-sm text-red-500 font-medium w-36 shrink-0 pt-2.5">Repeat Every*</p>
              <div className="flex-1 relative">
                <select value={form.repeatEvery} onChange={e => set('repeatEvery', e.target.value)}
                  className="w-full h-10 px-3 pr-8 border border-gray-300 rounded-md bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 appearance-none">
                  {REPEAT_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Start Date */}
            <div className="flex items-start gap-4">
              <p className="text-sm text-gray-600 font-medium w-36 shrink-0 pt-2.5">Start Date</p>
              <div className="flex-1">
                <input type="date" value={form.startDate}
                  onChange={e => set('startDate', e.target.value)}
                  className="w-full h-10 px-3 border border-gray-300 rounded-md bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                {form.startDate && (
                  <p className="mt-1.5 text-xs text-gray-400">
                    The recurring expense will be created on{' '}
                    <span className="text-gray-600 font-medium">{formatDate(nextDate)}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Ends On */}
            <div className="flex items-start gap-4">
              <p className="text-sm text-gray-600 font-medium w-36 shrink-0 pt-2.5">Ends On</p>
              <div className="flex-1 space-y-2">
                <input type="date" value={form.endsOn}
                  disabled={form.neverExpires}
                  onChange={e => set('endsOn', e.target.value)}
                  placeholder="dd/MM/yyyy"
                  className="w-full h-10 px-3 border border-gray-300 rounded-md bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 disabled:bg-gray-50 disabled:text-gray-400" />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.neverExpires}
                    onChange={e => set('neverExpires', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded" />
                  <span className="text-sm text-gray-700">Never Expires</span>
                </label>
              </div>
            </div>

            {/* Expense Account */}
            <div className="flex items-start gap-4">
              <p className="text-sm text-red-500 font-medium w-36 shrink-0 pt-2.5">Expense Account*</p>
              <div className="flex-1">
                <GroupedSelect
                  groups={GROUPED_EXPENSE_ACCOUNTS}
                  value={form.expenseAccount}
                  onChange={v => set('expenseAccount', v)}
                  placeholder="Select an account"
                />
              </div>
            </div>

            {/* Amount */}
            <div className="flex items-start gap-4">
              <p className="text-sm text-red-500 font-medium w-36 shrink-0 pt-2.5">Amount*</p>
              <div className="flex-1">
                <div className="flex h-10 border border-gray-300 rounded-md overflow-hidden focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/20 bg-white">
                  <div className="flex items-center px-2 border-r border-gray-300 bg-white gap-1 shrink-0">
                    <select value={form.currency} onChange={e => set('currency', e.target.value)}
                      className="text-sm text-gray-700 bg-transparent focus:outline-none appearance-none font-medium">
                      {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="w-3 h-3 text-gray-400 pointer-events-none" />
                  </div>
                  <input type="number" min="0" step="0.01" value={form.amount}
                    onChange={e => set('amount', e.target.value)}
                    placeholder=""
                    className="flex-1 px-3 text-sm bg-transparent focus:outline-none min-w-0" />
                </div>
              </div>
            </div>

            {/* Paid Through */}
            <div className="flex items-start gap-4">
              <p className="text-sm text-red-500 font-medium w-36 shrink-0 pt-2.5">Paid Through*</p>
              <div className="flex-1">
                <GroupedSelect
                  groups={GROUPED_PAID_THROUGH}
                  value={form.paidThrough}
                  onChange={v => set('paidThrough', v)}
                  placeholder="Select an account"
                />
              </div>
            </div>

            {/* Vendor */}
            <div className="flex items-start gap-4">
              <p className="text-sm text-gray-600 font-medium w-36 shrink-0 pt-2.5">Vendor</p>
              <div className="flex-1">
                <VendorSearchField
                  label="Vendor"
                  options={VENDORS}
                  value={form.vendor}
                  onChange={v => set('vendor', v)}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="flex items-start gap-4">
              <p className="text-sm text-gray-600 font-medium w-36 shrink-0 pt-2.5">Notes</p>
              <div className="flex-1">
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                  maxLength={500} rows={4}
                  placeholder="Max. 500 characters"
                  className="w-full resize-y px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder-gray-400" />
              </div>
            </div>

            {/* Customer Name */}
            <div className="flex items-start gap-4">
              <p className="text-sm text-gray-600 font-medium w-36 shrink-0 pt-2.5">Customer Name</p>
              <div className="flex-1">
                <VendorSearchField
                  label="Customer Name"
                  options={CUSTOMERS}
                  value={form.customerName}
                  onChange={v => set('customerName', v)}
                />
              </div>
            </div>

            {/* Reporting Tags */}
            <div className="flex items-start gap-4">
              <p className="text-sm text-gray-600 font-medium w-36 shrink-0 pt-2.5">Reporting Tags</p>
              <div className="flex-1">
                <button type="button"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
                  <Tag className="w-4 h-4" />
                  Associate Tags
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-gray-200 flex items-center gap-3 shrink-0 bg-white">
          <Button onClick={handleSave}
            className="h-9 px-6 text-sm bg-green-600 hover:bg-green-700 text-white font-semibold">
            Save
          </Button>
          <Button variant="outline" onClick={onClose}
            className="h-9 px-5 text-sm border-gray-300 text-gray-600 hover:bg-gray-50">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────
function StatusBadge({ status }: { status: RecurringProfile['status'] }) {
  const map = {
    active:  { label: 'Active',  cls: 'bg-green-100 text-green-700',  icon: <CheckCircle2 className="w-3 h-3" /> },
    stopped: { label: 'Stopped', cls: 'bg-gray-100 text-gray-600',    icon: <PauseCircle className="w-3 h-3" /> },
    expired: { label: 'Expired', cls: 'bg-red-100 text-red-600',      icon: <AlertCircle className="w-3 h-3" /> },
  };
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      {s.icon}{s.label}
    </span>
  );
}

// ─── Row Kebab Menu ───────────────────────────────────────
function RowMenu({ onEdit, onStop, onDelete }: {
  onEdit: () => void; onStop: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-36 z-50">
          <button type="button" onClick={() => { onEdit(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700">
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </button>
          <button type="button" onClick={() => { onStop(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-700">
            <PauseCircle className="w-3.5 h-3.5" /> Stop
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

// ─── Empty State ──────────────────────────────────────────
function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-blue-400" />
      </div>
      <div className="text-center">
        <p className="text-base font-semibold text-gray-700">No recurring expenses yet</p>
        <p className="text-sm text-gray-400 mt-1">Create a profile to auto-generate expenses on a schedule</p>
      </div>
      <Button onClick={onNew}
        className="h-9 px-5 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold mt-2">
        <Plus className="w-4 h-4 mr-1.5" /> New Recurring Expense
      </Button>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────
const DEMO_PROFILES: RecurringProfile[] = [
  {
    id: 1, profileName: 'Office Rent', repeatEvery: 'Month',
    startDate: '2025-01-01', endsOn: '', neverExpires: true,
    expenseAccount: 'Rent', currency: 'INR', amount: '45000',
    paidThrough: 'Bank – Current Account', vendor: 'ABC Suppliers',
    notes: 'Monthly office rent payment', customerName: '', reportingTags: '',
    status: 'active', nextExpense: '2026-06-01',
  },
  {
    id: 2, profileName: 'Internet Bill', repeatEvery: 'Month',
    startDate: '2025-03-01', endsOn: '', neverExpires: true,
    expenseAccount: 'Utilities', currency: 'INR', amount: '3500',
    paidThrough: 'Company Credit Card', vendor: '',
    notes: '', customerName: '', reportingTags: '',
    status: 'active', nextExpense: '2026-06-01',
  },
  {
    id: 3, profileName: 'Software Subscription', repeatEvery: 'Year',
    startDate: '2025-01-15', endsOn: '2027-01-15', neverExpires: false,
    expenseAccount: 'Software & Technology', currency: 'USD', amount: '299',
    paidThrough: 'Company Credit Card', vendor: 'Tech Vendors Ltd',
    notes: 'Annual SaaS subscription', customerName: '', reportingTags: '',
    status: 'stopped', nextExpense: '2026-01-15',
  },
];

export default function RecurringExpensesPage() {
  const [profiles, setProfiles] = useState<RecurringProfile[]>(DEMO_PROFILES);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editProfile, setEditProfile] = useState<RecurringProfile | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'stopped' | 'expired'>('all');
  const [search, setSearch] = useState('');

  const filtered = profiles.filter(p => {
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    const matchSearch = p.profileName.toLowerCase().includes(search.toLowerCase()) ||
                        p.expenseAccount.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const handleSave = (data: Omit<RecurringProfile, 'id' | 'status' | 'nextExpense'>) => {
    if (editProfile) {
      setProfiles(p => p.map(x => x.id === editProfile.id
        ? { ...x, ...data, nextExpense: nextExpenseDate(data.startDate, data.repeatEvery) }
        : x));
    } else {
      const newP: RecurringProfile = {
        ...data, id: Date.now(),
        status: 'active',
        nextExpense: nextExpenseDate(data.startDate, data.repeatEvery),
      };
      setProfiles(p => [newP, ...p]);
    }
  };

  const handleStop = (id: number) => {
    setProfiles(p => p.map(x => x.id === id ? { ...x, status: 'stopped' } : x));
    toast.success('Recurring profile stopped');
  };

  const handleDelete = (id: number) => {
    setProfiles(p => p.filter(x => x.id !== id));
    toast.success('Recurring profile deleted');
  };

  const openNew = () => { setEditProfile(null); setShowDrawer(true); };
  const openEdit = (p: RecurringProfile) => { setEditProfile(p); setShowDrawer(true); };

  const counts = {
    all:     profiles.length,
    active:  profiles.filter(p => p.status === 'active').length,
    stopped: profiles.filter(p => p.status === 'stopped').length,
    expired: profiles.filter(p => p.status === 'expired').length,
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Drawer */}
      {showDrawer && (
        <NewRecurringExpenseDrawer
          onClose={() => setShowDrawer(false)}
          onSave={handleSave}
          editData={editProfile}
        />
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Recurring Expenses</h1>
            <p className="text-xs text-gray-500 mt-0.5">Auto-generate expenses on a recurring schedule</p>
          </div>
          <Button onClick={openNew}
            className="h-9 px-4 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold">
            <Plus className="w-4 h-4 mr-1.5" /> New Recurring Expense
          </Button>
        </div>
      </div>

      {profiles.length === 0 ? (
        <EmptyState onNew={openNew} />
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

            {/* Stats bar */}
            <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-200">
              {[
                { label: 'Total Profiles', value: counts.all,    color: 'text-blue-600' },
                { label: 'Active',         value: counts.active,  color: 'text-green-600' },
                { label: 'Stopped',        value: counts.stopped, color: 'text-gray-500' },
              ].map(s => (
                <div key={s.label} className="px-6 py-4">
                  <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                  <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Filter + Search */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 gap-4">
              {/* Status tabs */}
              <div className="flex gap-1">
                {(['all', 'active', 'stopped', 'expired'] as const).map(s => (
                  <button key={s} type="button" onClick={() => setFilterStatus(s)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                      filterStatus === s
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                    }`}>
                    {s === 'all' ? `All (${counts.all})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${counts[s]})`}
                  </button>
                ))}
              </div>
              {/* Search */}
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search profiles…"
                  className="w-full h-8 pl-9 pr-3 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400" />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Profile Name', 'Repeat Every', 'Expense Account', 'Amount', 'Paid Through', 'Next Expense', 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">
                        No profiles match your filter
                      </td>
                    </tr>
                  ) : filtered.map(p => (
                    <tr key={p.id} className="group hover:bg-blue-50/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                            <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                          </div>
                          <span className="text-sm font-semibold text-gray-800">{p.profileName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-gray-400" /> Every {p.repeatEvery}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{p.expenseAccount}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-gray-800">
                          {p.currency} {Number(p.amount).toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{p.paidThrough}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          {formatDate(p.nextExpense)}
                        </span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <RowMenu
                          onEdit={() => openEdit(p)}
                          onStop={() => handleStop(p.id)}
                          onDelete={() => handleDelete(p.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
