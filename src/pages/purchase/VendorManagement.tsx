import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Search, Plus, X, Check, MoreVertical,
  Eye, Edit2, Trash2, Phone, MapPin,
  Building2, CreditCard, AlertTriangle,
} from 'lucide-react';

interface VendorForm {
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  gst_number: string;
  bank_name: string;
  bank_account: string;
  bank_ifsc: string;
  notes: string;
}

const EMPTY: VendorForm = {
  name: '', contact_person: '', phone: '', email: '', address: '', city: '',
  gst_number: '', bank_name: '', bank_account: '', bank_ifsc: '', notes: '',
};

/* ── Three-dot dropdown (fixed position to escape table overflow) ── */
function ActionMenu({ onEdit, onView, onDelete }: {
  onEdit: () => void;
  onView: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const openMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = btnRef.current!.getBoundingClientRect();
    setPos({
      top: rect.bottom + window.scrollY + 4,
      right: window.innerWidth - rect.right,
    });
    setOpen(o => !o);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    // small delay so the current click doesn't immediately re-close
    const id = setTimeout(() => document.addEventListener('mousedown', close), 10);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', close);
    };
  }, [open]);

  const handle = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
    fn();
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={openMenu}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
          className="w-44 bg-white border border-gray-200 rounded-xl shadow-xl py-1"
        >
          <button
            onClick={handle(onView)}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
          >
            <Eye className="h-4 w-4 text-gray-500" /> View Details
          </button>
          <button
            onClick={handle(onEdit)}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
          >
            <Edit2 className="h-4 w-4 text-gray-500" /> Edit Vendor
          </button>
          <div className="border-t border-gray-100 my-1" />
          <button
            onClick={handle(onDelete)}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
          >
            <Trash2 className="h-4 w-4" /> Delete Vendor
          </button>
        </div>
      )}
    </>
  );
}

/* ── View Details Modal ───────────────────────────────────────── */
function VendorDetailsModal({ vendor, onClose, onEdit }: {
  vendor: any; onClose: () => void; onEdit: () => void;
}) {
  const row = (label: string, value: string | undefined) =>
    value ? (
      <div key={label} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
        <span className="text-xs text-gray-500 font-medium">{label}</span>
        <span className="text-xs text-gray-800 font-semibold text-right max-w-[55%]">{value}</span>
      </div>
    ) : null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">{vendor.name}</h2>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${vendor.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                {vendor.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Contact</p>
          <div className="bg-gray-50 rounded-xl px-4 py-2">
            {row('Contact Person', vendor.contact_person)}
            {row('Phone', vendor.phone)}
            {row('Email', vendor.email)}
            {row('City', vendor.city)}
            {row('Address', vendor.address)}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Business</p>
          <div className="bg-gray-50 rounded-xl px-4 py-2">
            {row('GST Number', vendor.gst_number)}
            {row('Notes', vendor.notes)}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Bank Details</p>
          <div className="bg-gray-50 rounded-xl px-4 py-2">
            {row('Bank Name', vendor.bank_name)}
            {row('Account Number', vendor.bank_account)}
            {row('IFSC Code', vendor.bank_ifsc)}
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 btn-zoho-secondary justify-center py-2.5">Close</button>
          <button
            onClick={() => { onClose(); onEdit(); }}
            className="flex-1 btn-zoho-primary justify-center py-2.5"
          >
            <Edit2 className="h-4 w-4" /> Edit Vendor
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Delete Confirm Modal ─────────────────────────────────────── */
function DeleteConfirmModal({ vendor, onClose, onConfirm, isPending }: {
  vendor: any; onClose: () => void; onConfirm: () => void; isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <h2 className="font-bold text-gray-900">Delete Vendor?</h2>
        </div>
        <p className="text-sm text-gray-500">
          Are you sure you want to delete <span className="font-semibold text-gray-800">{vendor.name}</span>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 btn-zoho-secondary justify-center py-2.5">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            {isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Vendor Form Modal ────────────────────────────────────────── */
function VendorFormModal({ editId, form, setForm, onClose, onSave, isPending }: {
  editId: string | null;
  form: VendorForm;
  setForm: React.Dispatch<React.SetStateAction<VendorForm>>;
  onClose: () => void;
  onSave: () => void;
  isPending: boolean;
}) {
  const f = (key: keyof VendorForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const fields: { key: keyof VendorForm; label: string; placeholder: string; span?: boolean }[] = [
    { key: 'name',           label: 'Vendor Name *',  placeholder: 'e.g. Ravi Farms',     span: true },
    { key: 'contact_person', label: 'Contact Person', placeholder: 'Full name' },
    { key: 'phone',          label: 'Phone',           placeholder: '+91 9876543210' },
    { key: 'email',          label: 'Email',           placeholder: 'vendor@email.com' },
    { key: 'city',           label: 'City',            placeholder: 'e.g. Chennai' },
    { key: 'gst_number',     label: 'GST Number',      placeholder: 'Optional' },
    { key: 'bank_name',      label: 'Bank Name',       placeholder: 'e.g. SBI' },
    { key: 'bank_account',   label: 'Account Number',  placeholder: '' },
    { key: 'bank_ifsc',      label: 'IFSC Code',       placeholder: 'e.g. SBIN0001234' },
    { key: 'address',        label: 'Address',         placeholder: 'Full address',        span: true },
    { key: 'notes',          label: 'Notes',           placeholder: 'Optional remarks',    span: true },
  ];

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900">{editId ? 'Edit Vendor' : 'Add Vendor'}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {fields.map(field => (
            <div key={field.key} className={field.span ? 'col-span-2' : ''}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
              <input
                type="text"
                value={(form as any)[field.key]}
                onChange={f(field.key)}
                placeholder={field.placeholder}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 btn-zoho-secondary justify-center py-2.5">Cancel</button>
          <button onClick={onSave} disabled={isPending} className="flex-1 btn-zoho-primary justify-center py-2.5">
            <Check className="h-4 w-4" /> {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────── */
export default function VendorManagement() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<VendorForm>(EMPTY);
  const [viewVendor, setViewVendor] = useState<any | null>(null);
  const [deleteVendor, setDeleteVendor] = useState<any | null>(null);

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ['vendors-all'],
    queryFn: async () => {
      const { data } = await supabase.from('vendors').select('*').order('name');
      return data ?? [];
    },
  });

  const saveVendor = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('Vendor name required');
      if (editId) {
        const { error } = await supabase.from('vendors').update(form).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('vendors').insert({ ...form, is_active: true });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? 'Vendor updated!' : 'Vendor added!');
      setShowForm(false); setEditId(null); setForm(EMPTY);
      qc.invalidateQueries({ queryKey: ['vendors-all'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('vendors').update({ is_active: !active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendors-all'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vendors').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Vendor deleted');
      setDeleteVendor(null);
      qc.invalidateQueries({ queryKey: ['vendors-all'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (vendors as any[]).filter(v =>
    !search ||
    v.name?.toLowerCase().includes(search.toLowerCase()) ||
    v.contact_person?.toLowerCase().includes(search.toLowerCase()) ||
    v.phone?.includes(search) ||
    v.city?.toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (v: any) => {
    setForm({
      name: v.name ?? '',
      contact_person: v.contact_person ?? '',
      phone: v.phone ?? '',
      email: v.email ?? '',
      address: v.address ?? '',
      city: v.city ?? '',
      gst_number: v.gst_number ?? '',
      bank_name: v.bank_name ?? '',
      bank_account: v.bank_account ?? '',
      bank_ifsc: v.bank_ifsc ?? '',
      notes: v.notes ?? '',
    });
    setEditId(v.id);
    setShowForm(true);
  };

  const activeCount = (vendors as any[]).filter(v => v.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Vendor Management</h1>
          <p className="text-sm text-gray-500">{activeCount} active suppliers</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY); }}
          className="btn-zoho-primary"
        >
          <Plus className="h-4 w-4" /> Add Vendor
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search vendors…"
          className="w-full rounded-xl border border-gray-200 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Modals */}
      {showForm && (
        <VendorFormModal
          editId={editId}
          form={form}
          setForm={setForm}
          onClose={() => { setShowForm(false); setEditId(null); }}
          onSave={() => saveVendor.mutate()}
          isPending={saveVendor.isPending}
        />
      )}

      {viewVendor && (
        <VendorDetailsModal
          vendor={viewVendor}
          onClose={() => setViewVendor(null)}
          onEdit={() => { setViewVendor(null); startEdit(viewVendor); }}
        />
      )}

      {deleteVendor && (
        <DeleteConfirmModal
          vendor={deleteVendor}
          onClose={() => setDeleteVendor(null)}
          onConfirm={() => deleteMutation.mutate(deleteVendor.id)}
          isPending={deleteMutation.isPending}
        />
      )}

      {/* Table */}
      <div className="zoho-card">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading vendors…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No vendors found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Vendor</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Contact</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Location</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">GST No.</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((v: any) => (
                  <tr key={v.id} className={`hover:bg-gray-50 transition-colors ${!v.is_active ? 'opacity-60' : ''}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {v.name?.charAt(0)?.toUpperCase() ?? 'V'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">{v.name}</p>
                          {v.bank_name && (
                            <p className="text-xs text-gray-400 flex items-center gap-1">
                              <CreditCard className="h-3 w-3" /> {v.bank_name}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm text-gray-700">{v.contact_person || '—'}</p>
                      {v.phone && (
                        <a href={`tel:${v.phone}`} className="text-xs text-blue-600 flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3" /> {v.phone}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {v.city || v.address ? (
                        <span className="text-sm text-gray-600 flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                          {v.city || v.address}
                        </span>
                      ) : <span className="text-sm text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      {v.gst_number
                        ? <p className="text-xs font-mono text-gray-600">{v.gst_number}</p>
                        : <span className="text-sm text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => toggleActive.mutate({ id: v.id, active: v.is_active })}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors
                          ${v.is_active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                      >
                        {v.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <ActionMenu
                        onView={() => setViewVendor(v)}
                        onEdit={() => startEdit(v)}
                        onDelete={() => setDeleteVendor(v)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-gray-400 text-center">
          {filtered.length} vendor{filtered.length !== 1 ? 's' : ''} shown
        </p>
      )}
    </div>
  );
}
