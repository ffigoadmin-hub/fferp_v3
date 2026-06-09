// @ts-nocheck
import { useState, useRef, useEffect } from 'react';
import {
  Plus, MoreHorizontal, ChevronDown, ChevronUp, Upload,
  UserPlus, Download, Star, Info, X, Search, Mail,
  Check, FileText, Phone,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface Customer {
  id: string;
  type: 'Business' | 'Individual';
  salutation: string;
  first_name: string;
  last_name: string;
  company: string;
  display_name: string;
  email: string;
  work_phone: string;
  mobile: string;
  language: string;
  pan: string;
  currency: string;
  payment_terms: string;
  opening_balance: string;
  portal_access: boolean;
  billing: AddressBlock;
  shipping: AddressBlock;
}

interface AddressBlock {
  attention: string;
  country: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  fax: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function useOutsideClick(ref: React.RefObject<HTMLElement>, cb: () => void) {
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cb(); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [cb]);
}

const emptyAddress = (): AddressBlock => ({
  attention: '', country: '', street1: '', street2: '',
  city: '', state: '', pincode: '', phone: '', fax: '',
});

const emptyCustomer = () => ({
  type: 'Business' as 'Business' | 'Individual',
  salutation: '',
  first_name: '', last_name: '',
  company: '', display_name: '', email: '',
  work_phone: '', mobile: '',
  language: 'English',
  pan: '', currency: 'INR- Indian Rupee',
  payment_terms: 'Due on Receipt',
  opening_balance: '',
  portal_access: false,
  billing: emptyAddress(),
  shipping: emptyAddress(),
});

const SALUTATIONS = ['Mr.', 'Mrs.', 'Ms.', 'Miss.', 'Dr.'];
const LANGUAGES = ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam'];
const PAYMENT_TERMS_OPTIONS = ['Due on Receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60'];
const CURRENCIES = ['INR- Indian Rupee', 'USD- US Dollar', 'EUR- Euro', 'GBP- British Pound'];
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

type Tab = 'Other Details' | 'Address' | 'Contact Persons' | 'Custom Fields' | 'Reporting Tags' | 'Remarks';
const TABS: Tab[] = ['Other Details', 'Address', 'Contact Persons', 'Custom Fields', 'Reporting Tags', 'Remarks'];

/* ─── Field helpers ─────────────────────────────────────────────────────── */
const inputCls = "w-full px-3 py-2 text-[13px] rounded-lg outline-none transition-colors";
const inputStyle = { border: '1px solid #D1D5DB', background: '#FFFFFF' };
const labelCls = "block text-[13px] text-gray-600 mb-1.5";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-44 shrink-0 pt-2.5">
        <span className="text-[13px]" style={{ color: required ? '#DC2626' : '#374151' }}>
          {label}{required && ' *'}
        </span>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function SelectField({ value, onChange, options, placeholder }: any) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className={inputCls + ' appearance-none pr-8'}
        style={{ ...inputStyle, color: value ? '#111827' : '#9CA3AF' }}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 pointer-events-none" style={{ color: '#9CA3AF' }} />
    </div>
  );
}

/* ─── Address Tab ────────────────────────────────────────────────────────── */
function AddressSection({ billing, shipping, onChange }:
  { billing: AddressBlock; shipping: AddressBlock; onChange: (side: 'billing' | 'shipping', key: keyof AddressBlock, val: string) => void }) {

  const copyBilling = () => {
    (Object.keys(billing) as (keyof AddressBlock)[]).forEach(k => onChange('shipping', k, billing[k]));
  };

  const AddrCol = ({ side, data }: { side: 'billing' | 'shipping'; data: AddressBlock }) => (
    <div className="flex-1 space-y-4">
      {/* Attention */}
      <div>
        <p className={labelCls}>Attention</p>
        <input className={inputCls} style={inputStyle} value={data.attention}
          onChange={e => onChange(side, 'attention', e.target.value)} />
      </div>
      {/* Country */}
      <div>
        <p className={labelCls}>Country/Region</p>
        <div className="relative">
          <select className={inputCls + ' appearance-none pr-8'} style={{ ...inputStyle, color: data.country ? '#111827' : '#9CA3AF' }}
            value={data.country} onChange={e => onChange(side, 'country', e.target.value)}>
            <option value="">Select</option>
            <option value="India">India</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 pointer-events-none" style={{ color: '#9CA3AF' }} />
        </div>
      </div>
      {/* Address */}
      <div>
        <p className={labelCls}>Address</p>
        <textarea rows={2} placeholder="Street 1" value={data.street1}
          onChange={e => onChange(side, 'street1', e.target.value)}
          className={inputCls + ' resize-none mb-2'} style={inputStyle} />
        <textarea rows={2} placeholder="Street 2" value={data.street2}
          onChange={e => onChange(side, 'street2', e.target.value)}
          className={inputCls + ' resize-none'} style={inputStyle} />
      </div>
      {/* City */}
      <div>
        <p className={labelCls}>City</p>
        <input className={inputCls} style={inputStyle} value={data.city}
          onChange={e => onChange(side, 'city', e.target.value)} />
      </div>
      {/* State */}
      <div>
        <p className={labelCls}>State</p>
        <div className="relative">
          <select className={inputCls + ' appearance-none pr-8'} style={{ ...inputStyle, color: data.state ? '#111827' : '#9CA3AF' }}
            value={data.state} onChange={e => onChange(side, 'state', e.target.value)}>
            <option value="">Select or type to add</option>
            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 pointer-events-none" style={{ color: '#9CA3AF' }} />
        </div>
      </div>
      {/* Pin Code */}
      <div>
        <p className={labelCls}>Pin Code</p>
        <input className={inputCls} style={inputStyle} value={data.pincode}
          onChange={e => onChange(side, 'pincode', e.target.value)} />
      </div>
      {/* Phone */}
      <div>
        <p className={labelCls}>Phone</p>
        <div className="flex gap-2">
          <div className="relative w-20 shrink-0">
            <select className={inputCls + ' appearance-none pr-6 text-center'} style={inputStyle}>
              <option>+91</option><option>+1</option><option>+44</option>
            </select>
            <ChevronDown className="absolute right-1.5 top-2.5 w-3 h-3 pointer-events-none" style={{ color: '#9CA3AF' }} />
          </div>
          <input className={inputCls + ' flex-1'} style={inputStyle} value={data.phone}
            onChange={e => onChange(side, 'phone', e.target.value)} />
        </div>
      </div>
      {/* Fax */}
      <div>
        <p className={labelCls}>Fax Number</p>
        <input className={inputCls} style={inputStyle} value={data.fax}
          onChange={e => onChange(side, 'fax', e.target.value)} />
      </div>
    </div>
  );

  return (
    <div className="flex gap-10">
      <div className="flex-1">
        <h3 className="text-[15px] font-bold mb-5" style={{ color: '#111827' }}>Billing Address</h3>
        <AddrCol side="billing" data={billing} />
      </div>
      <div className="flex-1">
        <h3 className="text-[15px] font-bold mb-5 flex items-center gap-2" style={{ color: '#111827' }}>
          Shipping Address
          <span className="text-[13px] font-normal" style={{ color: '#374151' }}>(
            <button onClick={copyBilling} className="font-medium mx-1" style={{ color: '#2563EB' }}>
              ↓ Copy billing address
            </button>)
          </span>
        </h3>
        <AddrCol side="shipping" data={shipping} />
      </div>
    </div>
  );
}

/* ─── Contact Persons Tab ────────────────────────────────────────────────── */
interface ContactPerson {
  id: string;
  salutation: string;
  first_name: string;
  last_name: string;
  email: string;
  work_phone: string;
  mobile: string;
}

const emptyContact = (): ContactPerson => ({
  id: crypto.randomUUID(),
  salutation: '', first_name: '', last_name: '', email: '', work_phone: '', mobile: '',
});

function ContactPersonsTab() {
  const [contacts, setContacts] = useState<ContactPerson[]>([emptyContact()]);

  const update = (id: string, key: keyof ContactPerson, val: string) =>
    setContacts(prev => prev.map(c => c.id === id ? { ...c, [key]: val } : c));

  const remove = (id: string) =>
    setContacts(prev => prev.filter(c => c.id !== id));

  const addRow = () => setContacts(prev => [...prev, emptyContact()]);

  const colHd = "px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider";
  const cell  = "px-2 py-1";
  const inp   = "w-full px-2 py-1.5 text-[12px] rounded outline-none border focus:border-blue-400 transition-colors";

  return (
    <div className="py-5">
      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #E5E7EB' }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              <th className={colHd} style={{ color: '#6B7280', width: 110 }}>SALUTATION</th>
              <th className={colHd} style={{ color: '#6B7280' }}>FIRST NAME</th>
              <th className={colHd} style={{ color: '#6B7280' }}>LAST NAME</th>
              <th className={colHd} style={{ color: '#6B7280' }}>EMAIL ADDRESS</th>
              <th className={colHd} style={{ color: '#6B7280', width: 160 }}>WORK PHONE</th>
              <th className={colHd} style={{ color: '#6B7280', width: 160 }}>MOBILE</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {contacts.map((c, idx) => (
              <tr key={c.id} style={{ borderBottom: idx < contacts.length - 1 ? '1px solid #F3F4F6' : 'none', background: '#FFFFFF' }}>
                {/* Salutation */}
                <td className={cell}>
                  <div className="relative">
                    <select value={c.salutation} onChange={e => update(c.id, 'salutation', e.target.value)}
                      className={inp + ' appearance-none pr-6'} style={{ borderColor: '#E5E7EB', color: c.salutation ? '#111827' : '#9CA3AF' }}>
                      <option value=""></option>
                      {SALUTATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="absolute right-1.5 top-2 w-3.5 h-3.5 pointer-events-none" style={{ color: '#9CA3AF' }} />
                  </div>
                </td>
                {/* First Name */}
                <td className={cell}>
                  <input value={c.first_name} onChange={e => update(c.id, 'first_name', e.target.value)}
                    className={inp} style={{ borderColor: '#BFDBFE', borderWidth: '1.5px' }} autoFocus={idx === contacts.length - 1} />
                </td>
                {/* Last Name */}
                <td className={cell}>
                  <input value={c.last_name} onChange={e => update(c.id, 'last_name', e.target.value)}
                    className={inp} style={{ borderColor: '#E5E7EB' }} />
                </td>
                {/* Email */}
                <td className={cell}>
                  <input type="email" value={c.email} onChange={e => update(c.id, 'email', e.target.value)}
                    className={inp} style={{ borderColor: '#E5E7EB' }} />
                </td>
                {/* Work Phone */}
                <td className={cell}>
                  <div className="flex gap-1">
                    <div className="relative w-14 shrink-0">
                      <select className={inp + ' appearance-none pr-4 text-center text-[11px]'} style={{ borderColor: '#E5E7EB' }}>
                        <option>+91</option><option>+1</option>
                      </select>
                      <ChevronDown className="absolute right-1 top-2 w-3 h-3 pointer-events-none" style={{ color: '#9CA3AF' }} />
                    </div>
                    <input value={c.work_phone} onChange={e => update(c.id, 'work_phone', e.target.value)}
                      className={inp + ' flex-1'} style={{ borderColor: '#E5E7EB' }} />
                  </div>
                </td>
                {/* Mobile */}
                <td className={cell}>
                  <div className="flex gap-1">
                    <div className="relative w-14 shrink-0">
                      <select className={inp + ' appearance-none pr-4 text-center text-[11px]'} style={{ borderColor: '#E5E7EB' }}>
                        <option>+91</option><option>+1</option>
                      </select>
                      <ChevronDown className="absolute right-1 top-2 w-3 h-3 pointer-events-none" style={{ color: '#9CA3AF' }} />
                    </div>
                    <input value={c.mobile} onChange={e => update(c.id, 'mobile', e.target.value)}
                      className={inp + ' flex-1'} style={{ borderColor: '#E5E7EB' }} />
                  </div>
                </td>
                {/* Actions */}
                <td className="px-2 py-1">
                  <div className="flex items-center gap-1">
                    <button className="p-1 rounded hover:bg-gray-100 transition-colors" style={{ color: '#9CA3AF' }}>
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => remove(c.id)}
                      className="p-1 rounded-full hover:bg-red-50 transition-colors flex items-center justify-center"
                      style={{ color: '#EF4444' }}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add row button */}
      <button onClick={addRow}
        className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-colors"
        style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#DBEAFE')}
        onMouseLeave={e => (e.currentTarget.style.background = '#EFF6FF')}>
        <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#2563EB' }}>
          <Plus className="w-2.5 h-2.5 text-white" />
        </div>
        Add Contact Person
      </button>
    </div>
  );
}

/* ─── New Customer Form ──────────────────────────────────────────────────── */
function NewCustomerForm({ onClose, onSave }: { onClose: () => void; onSave: (c: Customer) => void }) {
  const [form, setForm] = useState(emptyCustomer());
  const [activeTab, setActiveTab] = useState<Tab>('Other Details');
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const setAddr = (side: 'billing' | 'shipping', key: keyof AddressBlock, val: string) =>
    setForm(f => ({ ...f, [side]: { ...f[side], [key]: val } }));

  const handleSave = () => {
    if (!form.display_name.trim()) return;
    onSave({ ...form, id: crypto.randomUUID() } as Customer);
    onClose();
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#FFFFFF' }}>
      {/* Page header */}
      <div className="px-8 pt-6 pb-4" style={{ borderBottom: '1px solid #E5E7EB' }}>
        <h1 className="text-[20px] font-bold" style={{ color: '#111827' }}>New Customer</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* GST prefill banner */}
        <div className="mx-8 mt-5 px-4 py-3 rounded-xl flex items-center gap-3"
          style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
          <FileText className="w-4 h-4 shrink-0" style={{ color: '#2563EB' }} />
          <p className="text-[13px]" style={{ color: '#1E40AF' }}>
            Prefill Customer details from the GST portal using the Customer's GSTIN.{' '}
            <span className="font-semibold" style={{ color: '#2563EB', cursor: 'pointer' }}>Prefill ›</span>
          </p>
        </div>

        {/* Main fields */}
        <div className="px-8 py-6 space-y-5 max-w-3xl">

          {/* Customer Type */}
          <Field label="Customer Type">
            <div className="flex items-center gap-6 mt-0.5">
              {(['Business', 'Individual'] as const).map(t => (
                <label key={t} className="flex items-center gap-2 cursor-pointer" onClick={() => set('type', t)}>
                  <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all"
                    style={{ borderColor: form.type === t ? '#2563EB' : '#D1D5DB', background: form.type === t ? '#2563EB' : 'white' }}>
                    {form.type === t && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span className="text-[13px]" style={{ color: '#374151' }}>{t}</span>
                </label>
              ))}
            </div>
          </Field>

          {/* Primary Contact */}
          <Field label="Primary Contact">
            <div className="flex gap-2">
              <div className="relative w-32 shrink-0">
                <select className={inputCls + ' appearance-none pr-7'} style={{ ...inputStyle, color: form.salutation ? '#111827' : '#9CA3AF' }}
                  value={form.salutation} onChange={e => set('salutation', e.target.value)}>
                  <option value="">Salutation</option>
                  {SALUTATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 pointer-events-none" style={{ color: '#9CA3AF' }} />
              </div>
              <input placeholder="First Name" value={form.first_name} onChange={e => set('first_name', e.target.value)}
                className={inputCls + ' flex-1'} style={{ ...inputStyle, borderColor: '#BFDBFE' }}
                onFocus={e => (e.target.style.borderColor = '#2563EB')} onBlur={e => (e.target.style.borderColor = '#BFDBFE')} />
              <input placeholder="Last Name" value={form.last_name} onChange={e => set('last_name', e.target.value)}
                className={inputCls + ' flex-1'} style={inputStyle} />
            </div>
          </Field>

          {/* Company Name */}
          <Field label="Company Name">
            <input className={inputCls} style={inputStyle} value={form.company}
              onChange={e => set('company', e.target.value)} />
          </Field>

          {/* Display Name */}
          <Field label="Display Name" required>
            <div className="relative">
              <input
                className={inputCls + ' pr-8'}
                style={{ ...inputStyle, borderColor: '#D1D5DB' }}
                placeholder="Select or type to add"
                value={form.display_name}
                onChange={e => set('display_name', e.target.value)}
              />
              <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 pointer-events-none" style={{ color: '#9CA3AF' }} />
            </div>
          </Field>

          {/* Email */}
          <Field label="Email Address">
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 w-4 h-4" style={{ color: '#9CA3AF' }} />
              <input type="email" className={inputCls + ' pl-9'} style={inputStyle} value={form.email}
                onChange={e => set('email', e.target.value)} />
            </div>
          </Field>

          {/* Phone */}
          <Field label="Phone">
            <div className="flex gap-3">
              <div className="flex gap-1 flex-1">
                <div className="relative w-20 shrink-0">
                  <select className={inputCls + ' appearance-none pr-6 text-center'} style={inputStyle}>
                    <option>+91</option><option>+1</option><option>+44</option>
                  </select>
                  <ChevronDown className="absolute right-1.5 top-2.5 w-3 h-3 pointer-events-none" style={{ color: '#9CA3AF' }} />
                </div>
                <input placeholder="Work Phone" className={inputCls + ' flex-1'} style={inputStyle}
                  value={form.work_phone} onChange={e => set('work_phone', e.target.value)} />
              </div>
              <div className="flex gap-1 flex-1">
                <div className="relative w-20 shrink-0">
                  <select className={inputCls + ' appearance-none pr-6 text-center'} style={inputStyle}>
                    <option>+91</option><option>+1</option><option>+44</option>
                  </select>
                  <ChevronDown className="absolute right-1.5 top-2.5 w-3 h-3 pointer-events-none" style={{ color: '#9CA3AF' }} />
                </div>
                <input placeholder="Mobile" className={inputCls + ' flex-1'} style={inputStyle}
                  value={form.mobile} onChange={e => set('mobile', e.target.value)} />
              </div>
            </div>
          </Field>

          {/* Language */}
          <Field label="Customer Language">
            <SelectField value={form.language} onChange={(v: string) => set('language', v)} options={LANGUAGES} />
          </Field>
        </div>

        {/* Divider */}
        <div className="mx-8" style={{ borderTop: '1px solid #E5E7EB' }} />

        {/* Tabs */}
        <div className="px-8">
          <div className="flex gap-0" style={{ borderBottom: '1px solid #E5E7EB' }}>
            {TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="px-4 py-3 text-[13px] font-medium transition-all relative"
                style={{ color: activeTab === tab ? '#111827' : '#6B7280' }}>
                {tab}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t" style={{ background: '#2563EB' }} />
                )}
              </button>
            ))}
          </div>

          {/* Tab: Other Details */}
          {activeTab === 'Other Details' && (
            <div className="py-6 space-y-5 max-w-xl">
              <Field label="PAN">
                <input className={inputCls} style={inputStyle} value={form.pan}
                  onChange={e => set('pan', e.target.value)} />
              </Field>
              <Field label="Currency">
                <SelectField value={form.currency} onChange={(v: string) => set('currency', v)} options={CURRENCIES} />
              </Field>
              <Field label="Accounts Receivable">
                <SelectField value="" onChange={() => {}} options={[]} placeholder="Select an account" />
              </Field>
              <Field label="Opening Balance">
                <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #D1D5DB' }}>
                  <span className="px-3 py-2 text-[13px] font-medium" style={{ background: '#F9FAFB', color: '#6B7280', borderRight: '1px solid #D1D5DB' }}>INR</span>
                  <input type="number" placeholder="0.00" className="flex-1 px-3 py-2 text-[13px] outline-none"
                    value={form.opening_balance} onChange={e => set('opening_balance', e.target.value)} />
                </div>
              </Field>
              <Field label="Payment Terms">
                <SelectField value={form.payment_terms} onChange={(v: string) => set('payment_terms', v)} options={PAYMENT_TERMS_OPTIONS} />
              </Field>
              <Field label="Enable Portal?">
                <label className="flex items-center gap-2 cursor-pointer mt-1">
                  <div
                    onClick={() => set('portal_access', !form.portal_access)}
                    className="w-4 h-4 rounded flex items-center justify-center transition-all"
                    style={{ background: form.portal_access ? '#2563EB' : 'white', border: `2px solid ${form.portal_access ? '#2563EB' : '#D1D5DB'}` }}>
                    {form.portal_access && (
                      <svg viewBox="0 0 10 8" className="w-2.5 h-2.5"><path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
                    )}
                  </div>
                  <span className="text-[13px]" style={{ color: '#374151' }}>Allow portal access for this customer</span>
                </label>
              </Field>
              <Field label="Documents">
                <div>
                  <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors"
                    style={{ border: '1px solid #D1D5DB', color: '#374151' }}>
                    <Upload className="w-4 h-4" /> Upload File
                    <ChevronDown className="w-3.5 h-3.5 ml-1" style={{ color: '#9CA3AF' }} />
                  </button>
                  <p className="text-[11px] mt-1.5" style={{ color: '#9CA3AF' }}>You can upload a maximum of 10 files, 10MB each</p>
                </div>
              </Field>
              <div className="pl-48 pt-2">
                <button className="text-[13px] font-medium" style={{ color: '#2563EB' }}>Add more details</button>
              </div>
              <div className="pl-0 pt-4" style={{ borderTop: '1px solid #F3F4F6' }}>
                <p className="text-[13px]" style={{ color: '#6B7280' }}>
                  <span className="font-semibold" style={{ color: '#374151' }}>Customer Owner:</span>{' '}
                  Assign a user as the customer owner to provide access only to the data of this customer.{' '}
                  <span className="font-medium" style={{ color: '#2563EB', cursor: 'pointer' }}>Learn More</span>
                </p>
              </div>
            </div>
          )}

          {/* Tab: Address */}
          {activeTab === 'Address' && (
            <div className="py-6">
              <AddressSection billing={form.billing} shipping={form.shipping} onChange={setAddr} />
            </div>
          )}

          {/* Tab: Contact Persons */}
          {activeTab === 'Contact Persons' && (
            <ContactPersonsTab />
          )}

          {/* Tab: Custom Fields */}
          {activeTab === 'Custom Fields' && (
            <div className="py-10 px-2">
              <p className="text-[13px] text-center" style={{ color: '#2563EB' }}>
                Start adding custom fields for your Customers and Vendors by going to{' '}
                <span className="italic font-medium" style={{ color: '#374151' }}>Settings</span>
                {' '}➔{' '}
                <span className="italic font-medium" style={{ color: '#374151' }}>Preferences</span>
                {' '}➔{' '}
                <span className="italic font-medium" style={{ color: '#374151' }}>Customers and Vendors</span>.
                {' '}You can also refine the address format of your Customers and Vendors from there.
              </p>
            </div>
          )}

          {/* Tab: Reporting Tags */}
          {activeTab === 'Reporting Tags' && (
            <div className="py-10 text-center space-y-1.5">
              <p className="text-[13px] font-medium" style={{ color: '#2563EB' }}>You've not created any Reporting Tags.</p>
              <p className="text-[13px]" style={{ color: '#6B7280' }}>
                Start creating reporting tags by going to{' '}
                <span className="italic font-medium" style={{ color: '#374151' }}>More Settings</span>
                {' '}➔{' '}
                <span className="italic font-medium" style={{ color: '#374151' }}>Reporting Tags</span>
              </p>
            </div>
          )}

          {/* Tab: Remarks */}
          {activeTab === 'Remarks' && (
            <div className="py-6">
              <p className="text-[13px] mb-2" style={{ color: '#374151' }}>
                Remarks{' '}
                <span className="text-[12px]" style={{ color: '#9CA3AF' }}>(For Internal Use)</span>
              </p>
              <textarea rows={7}
                className="w-full px-3 py-2.5 text-[13px] rounded-lg outline-none resize-y"
                style={{ border: '1px solid #D1D5DB', background: '#FFFFFF', minHeight: '120px' }} />
            </div>
          )}
        </div>

        <div className="h-8" />
      </div>

      {/* Footer */}
      <div className="px-8 py-4 flex items-center gap-3 sticky bottom-0"
        style={{ borderTop: '1px solid #E5E7EB', background: '#FFFFFF' }}>
        <button onClick={handleSave}
          className="px-6 py-2 rounded-lg text-[13px] font-semibold text-white"
          style={{ background: '#16A34A' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#15803D')}
          onMouseLeave={e => (e.currentTarget.style.background = '#16A34A')}>
          Save
        </button>
        <button onClick={onClose}
          className="px-5 py-2 rounded-lg text-[13px] font-medium"
          style={{ border: '1px solid #D1D5DB', color: '#374151', background: '#FFFFFF' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
          onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ─── Customers List Page ────────────────────────────────────────────────── */
type ViewFilter = 'All' | 'Active' | 'Inactive';
const VIEW_FILTERS: { key: ViewFilter; label: string }[] = [
  { key: 'All', label: 'All' },
  { key: 'Active', label: 'Active' },
  { key: 'Inactive', label: 'Inactive' },
];

export default function SalesCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('All');
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [starred, setStarred] = useState<Set<ViewFilter>>(new Set(['Active']));
  const viewRef = useRef<HTMLDivElement>(null);
  useOutsideClick(viewRef, () => setShowViewMenu(false));

  const [showKebab, setShowKebab] = useState(false);
  const kebabRef = useRef<HTMLDivElement>(null);
  useOutsideClick(kebabRef, () => setShowKebab(false));

  const handleSave = (c: Customer) => setCustomers(prev => [...prev, c]);

  const filtered = customers.filter(c =>
    [c.display_name, c.company, c.email].some(v => v.toLowerCase().includes(search.toLowerCase()))
  );

  if (showForm) {
    return <NewCustomerForm onClose={() => setShowForm(false)} onSave={handleSave} />;
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#F9FAFB', minHeight: '100vh' }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3.5"
        style={{ background: '#FFFFFF', borderBottom: '1px solid #E5E7EB' }}>

        {/* All Customers ▼ */}
        <div className="relative" ref={viewRef}>
          <button onClick={() => setShowViewMenu(v => !v)}
            className="flex items-center gap-1.5 text-[15px] font-bold transition-colors px-2 py-1.5 rounded-lg"
            style={{ color: '#111827' }}>
            All Customers
            {showViewMenu ? <ChevronUp className="w-4 h-4" style={{ color: '#2563EB' }} /> : <ChevronDown className="w-4 h-4" style={{ color: '#2563EB' }} />}
          </button>
          {showViewMenu && (
            <div className="absolute left-0 top-[calc(100%+4px)] z-50 rounded-xl shadow-xl w-52 overflow-hidden"
              style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
              {VIEW_FILTERS.map(vf => (
                <button key={vf.key} onClick={() => { setViewFilter(vf.key); setShowViewMenu(false); }}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-[13px] transition-colors"
                  style={{ background: viewFilter === vf.key ? '#2563EB' : 'transparent', color: viewFilter === vf.key ? '#FFFFFF' : '#374151' }}
                  onMouseEnter={e => { if (viewFilter !== vf.key) (e.currentTarget as HTMLElement).style.background = '#F9FAFB'; }}
                  onMouseLeave={e => { if (viewFilter !== vf.key) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  <span>{vf.label}</span>
                  <Star className="w-4 h-4 cursor-pointer" fill={starred.has(vf.key) ? '#FBBF24' : 'none'}
                    style={{ color: starred.has(vf.key) ? '#FBBF24' : (viewFilter === vf.key ? 'rgba(255,255,255,0.5)' : '#D1D5DB') }}
                    onClick={e => { e.stopPropagation(); setStarred(s => { const n = new Set(s); n.has(vf.key) ? n.delete(vf.key) : n.add(vf.key); return n; }); }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: '#9CA3AF' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers..."
              className="text-[13px] outline-none bg-transparent w-44" style={{ color: '#111827' }} />
          </div>

          {/* Kebab */}
          <div className="relative" ref={kebabRef}>
            <button onClick={() => setShowKebab(v => !v)}
              className="p-2 rounded-lg transition-colors"
              style={{ border: '1px solid #E5E7EB', background: showKebab ? '#EFF6FF' : '#FFFFFF', color: showKebab ? '#2563EB' : '#6B7280' }}>
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {showKebab && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-50 rounded-xl shadow-xl overflow-hidden w-48"
                style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
                {[
                  { label: 'Import Customers', icon: Download },
                  { label: 'Export Customers', icon: Upload },
                  { label: 'Refresh List', icon: Search },
                ].map(({ label, icon: Icon }) => (
                  <button key={label} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors hover:bg-gray-50" style={{ color: '#374151' }}
                    onClick={() => setShowKebab(false)}>
                    <Icon className="w-3.5 h-3.5" style={{ color: '#6B7280' }} />{label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* + New */}
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold text-white"
            style={{ background: '#16A34A' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#15803D')}
            onMouseLeave={e => (e.currentTarget.style.background = '#16A34A')}>
            <Plus className="w-4 h-4" /> New
          </button>
        </div>
      </div>

      {/* Empty state / table */}
      <div className="flex-1 overflow-auto" style={{ background: '#FFFFFF' }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6">
            {/* Avatar icon */}
            <div className="relative mb-6">
              <div className="w-28 h-28 rounded-full flex items-center justify-center"
                style={{ background: '#E5E7EB' }}>
                <svg viewBox="0 0 80 80" className="w-20 h-20" fill="none">
                  <circle cx="40" cy="28" r="16" fill="#9CA3AF" />
                  <ellipse cx="40" cy="68" rx="28" ry="18" fill="#9CA3AF" />
                </svg>
              </div>
              <div className="absolute bottom-1 right-1 w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: '#2563EB', border: '3px solid white' }}>
                <Plus className="w-5 h-5 text-white" />
              </div>
            </div>

            <h2 className="text-[17px] font-bold mb-2" style={{ color: '#111827' }}>
              Every sales starts with a customer
            </h2>
            <p className="text-[13px] mb-7 text-center" style={{ color: '#6B7280' }}>
              Create and manage your customers and their contact persons, all in one place.
            </p>

            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white"
                style={{ background: '#16A34A' }}>
                <Plus className="w-4 h-4" /> Create New Customer
              </button>
              <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-medium"
                style={{ border: '1px solid #D1D5DB', color: '#374151', background: '#FFFFFF' }}>
                <Download className="w-4 h-4" style={{ color: '#6B7280' }} /> Import File
              </button>
            </div>

            <div className="flex items-center gap-3 mb-8">
              <div className="h-px w-16" style={{ background: '#E5E7EB' }} />
              <span className="text-[12px]" style={{ color: '#9CA3AF' }}>- or -</span>
              <div className="h-px w-16" style={{ background: '#E5E7EB' }} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[13px]" style={{ color: '#6B7280' }}>Import using</span>
              {['G', 'Z', 'M'].map((letter, i) => (
                <div key={i} className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
                  style={{ background: i === 0 ? '#EA4335' : i === 1 ? '#4F46E5' : '#0078D4', color: 'white' }}>
                  {letter}
                </div>
              ))}
            </div>

            {/* Key Benefits */}
            <div className="mt-10 rounded-2xl p-6 max-w-2xl w-full"
              style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">🤝</span>
                <h3 className="text-[14px] font-bold" style={{ color: '#111827' }}>Key Benefits</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  'Stay connected with multiple contact persons',
                  'Provide portal access to customers',
                  'Handle multiple addresses effortlessly',
                  'Create multi-currency transactions for contacts',
                ].map((benefit, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#2563EB' }} />
                    <span className="text-[13px]" style={{ color: i < 2 ? '#2563EB' : '#374151' }}>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB', background: '#F9FAFB' }}>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>NAME</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>COMPANY</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>EMAIL</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>PHONE</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>TYPE</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, idx) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #F3F4F6', background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFF')}
                  onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA')}>
                  <td className="px-4 py-3.5 text-[13px] font-semibold" style={{ color: '#2563EB' }}>{c.display_name}</td>
                  <td className="px-4 py-3.5 text-[13px]" style={{ color: '#374151' }}>{c.company || '—'}</td>
                  <td className="px-4 py-3.5 text-[13px]" style={{ color: '#6B7280' }}>{c.email || '—'}</td>
                  <td className="px-4 py-3.5 text-[13px]" style={{ color: '#6B7280' }}>{c.mobile || c.work_phone || '—'}</td>
                  <td className="px-4 py-3.5">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium"
                      style={{ background: c.type === 'Business' ? '#EFF6FF' : '#F0FDF4', color: c.type === 'Business' ? '#2563EB' : '#16A34A' }}>
                      {c.type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
