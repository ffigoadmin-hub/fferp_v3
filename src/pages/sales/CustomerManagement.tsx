import { useState, useRef, useCallback, useEffect, lazy, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { createInvoiceForOrder } from '@/lib/invoiceHelper';
import {
  Phone, MapPin, Plus, Edit2, X, Check, Search, Users,
  AlertTriangle, Upload, Store, User, ChevronDown, RefreshCw,
  FileText, CheckCircle2, ShoppingCart, LayoutList, Loader2,
  Package, Trash2, ShoppingBag, Building2, Clock, Sun, Moon,
} from 'lucide-react';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { useNavigate } from 'react-router-dom';

const BulkOrderPage = lazy(() => import('./BulkOrderPage'));

/* ─── Demo grocery product catalogue (fallback when Supabase is empty) ───── */
const DEMO_PRODUCTS = [
  // Vegetables
  { id: 'demo-veg-01', name: 'Onion',        category: 'Vegetables', unit: 'KG', grade_a_price: 28,  grade_b_price: 24,  grade_c_price: 20  },
  { id: 'demo-veg-02', name: 'Tomato',        category: 'Vegetables', unit: 'KG', grade_a_price: 45,  grade_b_price: 38,  grade_c_price: 30  },
  { id: 'demo-veg-03', name: 'Potato',        category: 'Vegetables', unit: 'KG', grade_a_price: 35,  grade_b_price: 30,  grade_c_price: 25  },
  { id: 'demo-veg-04', name: 'Carrot',        category: 'Vegetables', unit: 'KG', grade_a_price: 40,  grade_b_price: 34,  grade_c_price: 28  },
  { id: 'demo-veg-05', name: 'Cabbage',       category: 'Vegetables', unit: 'KG', grade_a_price: 22,  grade_b_price: 18,  grade_c_price: 14  },
  { id: 'demo-veg-06', name: 'Beetroot',      category: 'Vegetables', unit: 'KG', grade_a_price: 30,  grade_b_price: 26,  grade_c_price: 20  },
  { id: 'demo-veg-07', name: 'Coriander',     category: 'Vegetables', unit: 'KG', grade_a_price: 70,  grade_b_price: 60,  grade_c_price: 50  },
  { id: 'demo-veg-08', name: 'Drumstick',     category: 'Vegetables', unit: 'KG', grade_a_price: 50,  grade_b_price: 42,  grade_c_price: 35  },
  { id: 'demo-veg-09', name: 'Beans',         category: 'Vegetables', unit: 'KG', grade_a_price: 60,  grade_b_price: 52,  grade_c_price: 44  },
  { id: 'demo-veg-10', name: 'Brinjal',       category: 'Vegetables', unit: 'KG', grade_a_price: 32,  grade_b_price: 28,  grade_c_price: 22  },
  { id: 'demo-veg-11', name: 'Capsicum',      category: 'Vegetables', unit: 'KG', grade_a_price: 55,  grade_b_price: 48,  grade_c_price: 40  },
  { id: 'demo-veg-12', name: 'Lady Finger',   category: 'Vegetables', unit: 'KG', grade_a_price: 45,  grade_b_price: 38,  grade_c_price: 30  },
  { id: 'demo-veg-13', name: 'Raw Banana',    category: 'Vegetables', unit: 'KG', grade_a_price: 35,  grade_b_price: 30,  grade_c_price: 24  },
  { id: 'demo-veg-14', name: 'Bitter Gourd',  category: 'Vegetables', unit: 'KG', grade_a_price: 40,  grade_b_price: 34,  grade_c_price: 28  },
  { id: 'demo-veg-15', name: 'Ridge Gourd',   category: 'Vegetables', unit: 'KG', grade_a_price: 36,  grade_b_price: 30,  grade_c_price: 24  },
  { id: 'demo-veg-16', name: 'Pumpkin',       category: 'Vegetables', unit: 'KG', grade_a_price: 20,  grade_b_price: 16,  grade_c_price: 12  },
  { id: 'demo-veg-17', name: 'Spinach',       category: 'Vegetables', unit: 'KG', grade_a_price: 30,  grade_b_price: 25,  grade_c_price: 20  },
  { id: 'demo-veg-18', name: 'Garlic',        category: 'Vegetables', unit: 'KG', grade_a_price: 120, grade_b_price: 100, grade_c_price: 80  },
  { id: 'demo-veg-19', name: 'Ginger',        category: 'Vegetables', unit: 'KG', grade_a_price: 100, grade_b_price: 85,  grade_c_price: 70  },
  { id: 'demo-veg-20', name: 'Green Chilli',  category: 'Vegetables', unit: 'KG', grade_a_price: 60,  grade_b_price: 50,  grade_c_price: 40  },
  // Fruits
  { id: 'demo-frt-01', name: 'Mango',         category: 'Fruits',     unit: 'KG', grade_a_price: 80,  grade_b_price: 65,  grade_c_price: 50  },
  { id: 'demo-frt-02', name: 'Banana',        category: 'Fruits',     unit: 'KG', grade_a_price: 40,  grade_b_price: 34,  grade_c_price: 28  },
  { id: 'demo-frt-03', name: 'Apple',         category: 'Fruits',     unit: 'KG', grade_a_price: 150, grade_b_price: 120, grade_c_price: 90  },
  { id: 'demo-frt-04', name: 'Grapes',        category: 'Fruits',     unit: 'KG', grade_a_price: 90,  grade_b_price: 75,  grade_c_price: 60  },
  { id: 'demo-frt-05', name: 'Papaya',        category: 'Fruits',     unit: 'KG', grade_a_price: 35,  grade_b_price: 28,  grade_c_price: 22  },
  { id: 'demo-frt-06', name: 'Watermelon',    category: 'Fruits',     unit: 'KG', grade_a_price: 18,  grade_b_price: 14,  grade_c_price: 10  },
  { id: 'demo-frt-07', name: 'Pomegranate',   category: 'Fruits',     unit: 'KG', grade_a_price: 130, grade_b_price: 110, grade_c_price: 90  },
  { id: 'demo-frt-08', name: 'Guava',         category: 'Fruits',     unit: 'KG', grade_a_price: 50,  grade_b_price: 42,  grade_c_price: 35  },
  // Grains & Pulses
  { id: 'demo-grn-01', name: 'Rice',          category: 'Grains',     unit: 'KG', grade_a_price: 65,  grade_b_price: 55,  grade_c_price: 45  },
  { id: 'demo-grn-02', name: 'Wheat',         category: 'Grains',     unit: 'KG', grade_a_price: 38,  grade_b_price: 32,  grade_c_price: 26  },
  { id: 'demo-grn-03', name: 'Toor Dal',      category: 'Pulses',     unit: 'KG', grade_a_price: 130, grade_b_price: 115, grade_c_price: 100 },
  { id: 'demo-grn-04', name: 'Moong Dal',     category: 'Pulses',     unit: 'KG', grade_a_price: 120, grade_b_price: 105, grade_c_price: 90  },
  { id: 'demo-grn-05', name: 'Urad Dal',      category: 'Pulses',     unit: 'KG', grade_a_price: 110, grade_b_price: 95,  grade_c_price: 80  },
  { id: 'demo-grn-06', name: 'Chana Dal',     category: 'Pulses',     unit: 'KG', grade_a_price: 90,  grade_b_price: 78,  grade_c_price: 65  },
  // Oils & Condiments
  { id: 'demo-oil-01', name: 'Coconut Oil',   category: 'Oils',       unit: 'LTR', grade_a_price: 180, grade_b_price: 160, grade_c_price: 140 },
  { id: 'demo-oil-02', name: 'Sunflower Oil', category: 'Oils',       unit: 'LTR', grade_a_price: 140, grade_b_price: 125, grade_c_price: 110 },
  { id: 'demo-oil-03', name: 'Mustard Oil',   category: 'Oils',       unit: 'LTR', grade_a_price: 155, grade_b_price: 138, grade_c_price: 120 },
  // Dairy
  { id: 'demo-dry-01', name: 'Milk',          category: 'Dairy',      unit: 'LTR', grade_a_price: 60,  grade_b_price: 55,  grade_c_price: 50  },
  { id: 'demo-dry-02', name: 'Curd',          category: 'Dairy',      unit: 'KG',  grade_a_price: 70,  grade_b_price: 62,  grade_c_price: 55  },
  { id: 'demo-dry-03', name: 'Paneer',        category: 'Dairy',      unit: 'KG',  grade_a_price: 320, grade_b_price: 290, grade_c_price: 260 },
  // Spices
  { id: 'demo-spc-01', name: 'Turmeric',      category: 'Spices',     unit: 'KG', grade_a_price: 140, grade_b_price: 120, grade_c_price: 100 },
  { id: 'demo-spc-02', name: 'Red Chilli',    category: 'Spices',     unit: 'KG', grade_a_price: 180, grade_b_price: 155, grade_c_price: 130 },
  { id: 'demo-spc-03', name: 'Coriander Powder', category: 'Spices', unit: 'KG', grade_a_price: 130, grade_b_price: 110, grade_c_price: 90  },
  { id: 'demo-spc-04', name: 'Cumin',         category: 'Spices',     unit: 'KG', grade_a_price: 350, grade_b_price: 300, grade_c_price: 250 },
  { id: 'demo-spc-05', name: 'Pepper',        category: 'Spices',     unit: 'KG', grade_a_price: 600, grade_b_price: 520, grade_c_price: 450 },
];

const CATEGORY_ICON: Record<string, string> = {
  Vegetables: '🥦', Fruits: '🍎', Grains: '🌾', Pulses: '🫘',
  Oils: '🫙', Dairy: '🥛', Spices: '🌶️',
};

/* ─── Types ──────────────────────────────────────────────────────────────── */
type CustomerType = 'shop' | 'individual';

interface ShopForm {
  customer_type: 'shop';
  shop_name: string;
  owner_name: string;
  phone: string;
  gst_number: string;
  area: string;
  city: string;
  address: string;
  credit_limit: string;
  credit_days: string;
}

interface IndividualForm {
  customer_type: 'individual';
  salutation: string;
  first_name: string;
  last_name: string;
  mobile: string;
  email: string;
  area: string;
  city: string;
  address: string;
}

type CustomerForm = ShopForm | IndividualForm;

const EMPTY_SHOP: ShopForm = {
  customer_type: 'shop',
  shop_name: '', owner_name: '', phone: '',
  gst_number: '', area: '', city: '', address: '',
  credit_limit: '0', credit_days: '0',
};

const EMPTY_INDIVIDUAL: IndividualForm = {
  customer_type: 'individual',
  salutation: 'Mr.', first_name: '', last_name: '',
  mobile: '', email: '', area: '', city: '', address: '',
};

const SALUTATIONS = ['Mr.', 'Mrs.', 'Ms.', 'Miss.', 'Dr.'];

/* ─── CSV Import types ────────────────────────────────────────────────────── */
interface ImportRow {
  customer_type?: string;
  shop_name?: string;
  owner_name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  gst_number?: string;
  area?: string;
  city?: string;
  address?: string;
  credit_limit?: string;
  credit_days?: string;
}

/* ─── NameSuggest hook ────────────────────────────────────────────────────── */
function useNameSuggest(query: string, type: CustomerType) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      const nameCol = type === 'shop' ? 'shop_name' : 'first_name';
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('customer_type', type)
        .ilike(nameCol, `%${query}%`)
        .limit(6);
      setSuggestions(data ?? []);
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, type]);

  return { suggestions, loading, clear: () => setSuggestions([]) };
}

/* ─── CSV Import Modal ────────────────────────────────────────────────────── */
function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setFileName(file.name);
    Papa.parse<ImportRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_'),
      complete: result => setRows(result.data),
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    if (!rows.length) return;
    setImporting(true);
    const payload = rows.map(r => {
      const type = (r.customer_type?.toLowerCase() === 'individual') ? 'individual' : 'shop';
      return {
        customer_type: type,
        shop_name:    type === 'shop' ? (r.shop_name?.trim() || r.owner_name?.trim() || '') : null,
        owner_name:   r.owner_name?.trim() || null,
        first_name:   r.first_name?.trim() || null,
        last_name:    r.last_name?.trim() || null,
        phone:        (r.phone ?? r.mobile ?? '').trim(),
        mobile:       r.mobile?.trim() || null,
        email:        r.email?.trim() || null,
        gst_number:   r.gst_number?.trim() || null,
        area:         r.area?.trim() || null,
        city:         r.city?.trim() || null,
        address:      r.address?.trim() || null,
        credit_limit: Number(r.credit_limit) || 0,
        credit_days:  Number(r.credit_days) || 0,
        is_active:    true,
        name:         r.shop_name?.trim() || `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim(),
      };
    }).filter(r => r.name || r.shop_name || r.first_name);

    const { error } = await supabase.from('customers').upsert(payload, { ignoreDuplicates: false });
    setImporting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${payload.length} customers imported`);
    setDone(true);
    onDone();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Import Customers</h3>
            <p className="text-xs text-slate-400">Upload a CSV file with customer data</p>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {done ? (
            <div className="text-center py-10">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="font-semibold text-slate-800">Import Complete!</p>
              <p className="text-sm text-slate-400 mt-1">{rows.length} customers imported successfully</p>
              <button onClick={onClose} className="mt-4 px-6 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700">Done</button>
            </div>
          ) : (
            <>
              {/* Drop zone */}
              {!rows.length && (
                <div
                  onDrop={handleDrop}
                  onDragOver={e => e.preventDefault()}
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center cursor-pointer hover:border-green-400 hover:bg-green-50/30 transition-colors"
                >
                  <Upload className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-600">Drop your CSV file here, or click to browse</p>
                  <p className="text-xs text-slate-400 mt-1">Supports .csv files</p>
                  <input ref={fileRef} type="file" accept=".csv" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                </div>
              )}

              {/* Column guide */}
              {!rows.length && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Expected CSV columns</p>
                  <div className="grid grid-cols-2 gap-1 text-xs text-slate-500 font-mono">
                    {['customer_type (shop/individual)', 'shop_name', 'owner_name / first_name', 'last_name', 'phone / mobile', 'email', 'gst_number', 'area', 'city', 'address', 'credit_limit', 'credit_days'].map(col => (
                      <span key={col} className="bg-white border border-gray-200 rounded px-2 py-0.5">{col}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview */}
              {rows.length > 0 && (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-semibold text-slate-700">{fileName}</span>
                    <span className="text-xs text-slate-400">· {rows.length} rows</span>
                    <button onClick={() => { setRows([]); setFileName(''); }} className="ml-auto text-xs text-red-500 hover:text-red-700">Remove</button>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          {Object.keys(rows[0]).slice(0, 7).map(k => (
                            <th key={k} className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-wide">{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rows.slice(0, 5).map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            {Object.values(row).slice(0, 7).map((val, j) => (
                              <td key={j} className="px-3 py-2 text-slate-600 max-w-[120px] truncate">{String(val ?? '—')}</td>
                            ))}
                          </tr>
                        ))}
                        {rows.length > 5 && (
                          <tr><td colSpan={7} className="px-3 py-2 text-slate-400 text-center">…and {rows.length - 5} more rows</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!done && rows.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
            <button onClick={onClose} className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm font-semibold text-slate-600 hover:bg-gray-50">Cancel</button>
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
            >
              {importing
                ? <><RefreshCw className="h-4 w-4 animate-spin" /> Importing…</>
                : <><Upload className="h-4 w-4" /> Import {rows.length} Customers</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Order item type used inside the modal ──────────────────────────────── */
interface ModalOrderItem {
  key: string;
  product_id: string;
  product_name: string;
  product_search: string;
  unit: string;
  qty: number;
  unit_price: number;
  grade: 'A' | 'B' | 'C';
  grade_a_price: number;
  grade_b_price: number;
  grade_c_price: number;
  showDrop: boolean;
}

function newModalItem(): ModalOrderItem {
  return { key: Math.random().toString(36).slice(2), product_id: '', product_name: '', product_search: '', unit: 'KG', qty: 1, unit_price: 0, grade: 'A', grade_a_price: 0, grade_b_price: 0, grade_c_price: 0, showDrop: false };
}

/* ─── Add / Edit Customer Form Modal ─────────────────────────────────────── */
function CustomerFormModal({
  editingCustomer,
  onClose,
  onDone,
}: {
  editingCustomer: any | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const initForm = (): CustomerForm => {
    if (editingCustomer) {
      if ((editingCustomer.customer_type ?? 'shop') === 'individual') {
        return {
          customer_type: 'individual',
          salutation:  editingCustomer.salutation  ?? 'Mr.',
          first_name:  editingCustomer.first_name  ?? '',
          last_name:   editingCustomer.last_name   ?? '',
          mobile:      editingCustomer.mobile ?? editingCustomer.phone ?? '',
          email:       editingCustomer.email       ?? '',
          area:        editingCustomer.area        ?? '',
          city:        editingCustomer.city        ?? '',
          address:     editingCustomer.address     ?? '',
        };
      }
      return {
        customer_type: 'shop',
        shop_name:    editingCustomer.shop_name    ?? '',
        owner_name:   editingCustomer.owner_name   ?? '',
        phone:        editingCustomer.phone        ?? '',
        gst_number:   editingCustomer.gst_number   ?? '',
        area:         editingCustomer.area         ?? '',
        city:         editingCustomer.city         ?? '',
        address:      editingCustomer.address      ?? '',
        credit_limit: String(editingCustomer.credit_limit ?? 0),
        credit_days:  String(editingCustomer.credit_days  ?? 0),
      };
    }
    return EMPTY_SHOP;
  };

  const [form, setForm]         = useState<CustomerForm>(initForm);
  const [saving, setSaving]     = useState(false);
  const [orderItems, setOrderItems] = useState<ModalOrderItem[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [payMode, setPayMode]   = useState<'cod' | 'credit' | 'upi'>('cod');

  /* Hub & shift */
  const [selectedHubId, setSelectedHubId]     = useState('');
  const [selectedHubName, setSelectedHubName] = useState('');

  /* Current shift detection */
  const _now = new Date();
  const _mins = _now.getHours() * 60 + _now.getMinutes();
  const currentShift: 1 | 2 | null =
    _mins >= 600 && _mins < 1170 ? 1 :
    _mins >= 1170 && _mins <= 1380 ? 2 : null;

  /* Hubs from Supabase */
  const { data: hubs = [] } = useQuery({
    queryKey: ['hubs-active-modal'],
    queryFn: async () => {
      const { data } = await supabase.from('hubs').select('id, name, location, city').eq('is_active', true).order('name');
      return data ?? [];
    },
  });

  /* product search — merges Supabase live data with demo grocery catalogue */
  const { data: productResults = [] } = useQuery({
    queryKey: ['modal-product-search', productQuery],
    queryFn: async () => {
      const q = productQuery.toLowerCase().trim();

      // Filter demo products (all when empty, or by query)
      const demoMatches = q.length === 0
        ? DEMO_PRODUCTS.slice(0, 10)
        : DEMO_PRODUCTS.filter(p => p.name.toLowerCase().includes(q));

      // Try Supabase (may be empty in demo)
      const { data: dbData } = await supabase.from('products')
        .select('id, name, category, unit, grade_a_price, grade_b_price, grade_c_price')
        .ilike('name', q.length > 0 ? `%${productQuery}%` : '%')
        .order('name')
        .limit(8);

      const dbProducts = dbData ?? [];
      // Merge: real DB results first, then demo ones not already covered
      const dbNames = new Set(dbProducts.map((p: any) => p.name.toLowerCase()));
      const filteredDemo = demoMatches.filter(p => !dbNames.has(p.name.toLowerCase()));
      return [...dbProducts, ...filteredDemo].slice(0, 10);
    },
    enabled: true,
  });

  /* ── name-suggest state ── */
  const nameQuery = form.customer_type === 'shop'
    ? (form as ShopForm).shop_name
    : (form as IndividualForm).first_name;
  const { suggestions, clear } = useNameSuggest(editingCustomer ? '' : nameQuery, form.customer_type);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const setType = (t: CustomerType) => {
    setForm(t === 'shop' ? EMPTY_SHOP : EMPTY_INDIVIDUAL);
    clear();
  };

  const applySuggestion = (c: any) => {
    if (form.customer_type === 'shop') {
      setForm({
        customer_type: 'shop',
        shop_name:    c.shop_name    ?? '',
        owner_name:   c.owner_name   ?? '',
        phone:        c.phone        ?? '',
        gst_number:   c.gst_number   ?? '',
        area:         c.area         ?? '',
        city:         c.city         ?? '',
        address:      c.address      ?? '',
        credit_limit: String(c.credit_limit ?? 0),
        credit_days:  String(c.credit_days  ?? 0),
      });
    } else {
      setForm({
        customer_type: 'individual',
        salutation:  c.salutation  ?? 'Mr.',
        first_name:  c.first_name  ?? '',
        last_name:   c.last_name   ?? '',
        mobile:      c.mobile ?? c.phone ?? '',
        email:       c.email       ?? '',
        area:        c.area        ?? '',
        city:        c.city        ?? '',
        address:     c.address     ?? '',
      });
    }
    clear();
    setShowSuggestions(false);
  };

  const setF = useCallback(<K extends keyof typeof form>(key: K, val: string) => {
    setForm(f => ({ ...f, [key]: val } as CustomerForm));
    if (key === 'shop_name' || key === 'first_name') setShowSuggestions(true);
  }, []);

  /* order item helpers */
  const updateItem = (key: string, patch: Partial<ModalOrderItem>) =>
    setOrderItems(items => items.map(it => it.key === key ? { ...it, ...patch } : it));
  const removeItem = (key: string) =>
    setOrderItems(items => items.filter(it => it.key !== key));
  const selectProduct = (itemKey: string, prod: any, currentGrade: 'A' | 'B' | 'C' = 'A') => {
    const gradePrice = currentGrade === 'A' ? (prod.grade_a_price || 0) : currentGrade === 'B' ? (prod.grade_b_price || 0) : (prod.grade_c_price || 0);
    updateItem(itemKey, {
      product_id:    prod.id,
      product_name:  prod.name,
      product_search: prod.name,
      unit:          prod.unit || 'KG',
      unit_price:    gradePrice,
      grade_a_price: prod.grade_a_price || 0,
      grade_b_price: prod.grade_b_price || 0,
      grade_c_price: prod.grade_c_price || 0,
      showDrop:      false,
    });
    setProductQuery('');
  };

  const lineTotal = (it: ModalOrderItem) => it.qty * it.unit_price;
  const grandTotal = orderItems.reduce((s, it) => s + lineTotal(it), 0);
  const hasItems = orderItems.length > 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      let payload: Record<string, any> = { is_active: true };

      if (form.customer_type === 'shop') {
        const f = form as ShopForm;
        if (!f.shop_name.trim()) throw new Error('Shop name is required');
        if (!f.phone.trim())     throw new Error('Phone number is required');
        payload = {
          ...payload,
          customer_type: 'shop',
          shop_name:    f.shop_name.trim(),
          name:         f.shop_name.trim(),
          owner_name:   f.owner_name.trim() || null,
          phone:        f.phone.trim(),
          gst_number:   f.gst_number.trim() || null,
          area:         f.area.trim() || null,
          city:         f.city.trim() || null,
          address:      f.address.trim() || null,
          credit_limit: Number(f.credit_limit) || 0,
          credit_days:  Number(f.credit_days)  || 0,
        };
      } else {
        const f = form as IndividualForm;
        if (!f.first_name.trim()) throw new Error('First name is required');
        if (!f.mobile.trim())     throw new Error('Mobile number is required');
        const fullName = `${f.salutation} ${f.first_name.trim()} ${f.last_name.trim()}`.trim();
        payload = {
          ...payload,
          customer_type: 'individual',
          salutation:  f.salutation,
          first_name:  f.first_name.trim(),
          last_name:   f.last_name.trim() || null,
          name:        fullName,
          shop_name:   fullName,
          mobile:      f.mobile.trim(),
          phone:       f.mobile.trim(),
          email:       f.email.trim() || null,
          area:        f.area.trim() || null,
          city:        f.city.trim() || null,
          address:     f.address.trim() || null,
          credit_limit: 0,
          credit_days:  0,
        };
      }

      let customerId = editingCustomer?.id;
      if (editingCustomer) {
        const { error } = await supabase.from('customers').update(payload).eq('id', editingCustomer.id);
        if (error) throw error;
        toast.success('Customer updated');
      } else {
        const { data: inserted, error } = await supabase.from('customers').insert(payload).select().single();
        if (error) throw error;
        customerId = inserted.id;
        toast.success('Customer added');
      }

      /* ── Create sales order if items were added ── */
      if (hasItems && customerId) {
        const filledItems = orderItems.filter(it => (it.product_id || it.product_name || it.product_search) && it.qty > 0);
        if (filledItems.length === 0) throw new Error('Please select a product and qty for each item');

        const today = new Date().toISOString().split('T')[0];
        // Only pass created_by if it looks like a real UUID (demo users have non-UUID ids)
        const isRealUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user?.id ?? '');
        const orderTotal = filledItems.reduce((s, it) => s + lineTotal(it), 0);
        const customerName = form.customer_type === 'shop'
          ? (form as ShopForm).shop_name
          : `${(form as IndividualForm).first_name} ${(form as IndividualForm).last_name}`.trim();
        const { data: order, error: oErr } = await supabase.from('sales_orders').insert({
          customer_id:   customerId,
          customer_name: customerName,
          order_date:    today,
          status:        'confirmed',
          payment_mode:  payMode,
          subtotal:      orderTotal,
          net_amount:    orderTotal,
          total_amount:  orderTotal,
          hub_id:        selectedHubId || null,
          hub_name:      selectedHubName || null,
          shift:         currentShift,
          ...(isRealUuid ? { created_by: user!.id } : {}),
        }).select().single();
        if (oErr) throw oErr;

        const itemRows = filledItems.map(it => ({
          order_id:     order.id,
          product_id:   it.product_id || null,   // empty string → null (UUID column)
          product_name: it.product_name || it.product_search,
          quantity:     it.qty,
          qty_kg:       it.qty,
          quantity_kg:  it.qty,
          unit:         it.unit,
          unit_price:   it.unit_price,
          total_price:  lineTotal(it),
          subtotal:     lineTotal(it),
          qc_grade:     it.grade,
          grade:        it.grade,
        }));
        const { error: itemErr } = await supabase.from('sales_order_items').insert(itemRows);
        if (itemErr) throw itemErr;

        // Auto-create invoice
        const customerPhone = form.customer_type === 'shop'
          ? (form as ShopForm).phone
          : (form as IndividualForm).mobile;
        const customerAddress = form.customer_type === 'shop'
          ? (form as ShopForm).address
          : (form as IndividualForm).address;
        await createInvoiceForOrder({
          orderId:         order.id,
          customerId,
          customerName,
          customerPhone:   customerPhone || null,
          customerAddress: customerAddress || null,
          subtotal:        orderTotal,
          totalAmount:     orderTotal,
          paymentMode:     payMode,
        });

        toast.success(`Order created with ${filledItems.length} item${filledItems.length > 1 ? 's' : ''}!`);
        onDone();
        onClose();
        navigate(`/sales/orders/${order.id}`);
        return;
      }

      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-slate-800">{editingCustomer ? 'Edit Customer' : 'Add Customer'}</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Type toggle */}
          {!editingCustomer && (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('shop')}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                  form.customer_type === 'shop'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 text-slate-500 hover:border-gray-300'
                }`}
              >
                <Store className="h-4 w-4" /> Shop / Business
              </button>
              <button
                type="button"
                onClick={() => setType('individual')}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                  form.customer_type === 'individual'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-slate-500 hover:border-gray-300'
                }`}
              >
                <User className="h-4 w-4" /> Individual
              </button>
            </div>
          )}

          {/* ── SHOP FIELDS ── */}
          {form.customer_type === 'shop' && (
            <div className="space-y-3">
              <div className="relative">
                <label className={labelCls}>Shop Name *</label>
                <input
                  type="text"
                  value={(form as ShopForm).shop_name}
                  onChange={e => setF('shop_name', e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 180)}
                  className={inputCls}
                  placeholder="e.g. Sri Ram Provisions"
                  autoComplete="off"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-20 mt-1 overflow-hidden">
                    {suggestions.map((s: any) => (
                      <button key={s.id} type="button" onMouseDown={() => applySuggestion(s)}
                        className="w-full text-left px-4 py-2.5 hover:bg-green-50 flex items-center justify-between group">
                        <span className="text-sm font-medium text-slate-700">{s.shop_name}</span>
                        <span className="text-xs text-slate-400 group-hover:text-green-600">{s.area || s.city || ''}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Owner Name</label><input type="text" value={(form as ShopForm).owner_name} onChange={e => setF('owner_name', e.target.value)} className={inputCls} placeholder="Owner full name" /></div>
                <div><label className={labelCls}>Phone *</label><input type="tel" value={(form as ShopForm).phone} onChange={e => setF('phone', e.target.value)} className={inputCls} placeholder="+91 XXXXX XXXXX" /></div>
                <div><label className={labelCls}>GST Number</label><input type="text" value={(form as ShopForm).gst_number} onChange={e => setF('gst_number', e.target.value)} className={inputCls} placeholder="22ABCDE1234F1Z5" /></div>
                <div><label className={labelCls}>Area</label><input type="text" value={(form as ShopForm).area} onChange={e => setF('area', e.target.value)} className={inputCls} placeholder="e.g. Anna Nagar" /></div>
                <div><label className={labelCls}>City</label><input type="text" value={(form as ShopForm).city} onChange={e => setF('city', e.target.value)} className={inputCls} placeholder="e.g. Chennai" /></div>
              </div>
              <div><label className={labelCls}>Address</label><input type="text" value={(form as ShopForm).address} onChange={e => setF('address', e.target.value)} className={inputCls} placeholder="Full delivery address" /></div>
            </div>
          )}

          {/* ── INDIVIDUAL FIELDS ── */}
          {form.customer_type === 'individual' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Salutation</label>
                  <select value={(form as IndividualForm).salutation} onChange={e => setF('salutation', e.target.value)} className={inputCls}>
                    {SALUTATIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="col-span-2 relative">
                  <label className={labelCls}>First Name *</label>
                  <input
                    type="text"
                    value={(form as IndividualForm).first_name}
                    onChange={e => setF('first_name', e.target.value)}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 180)}
                    className={inputCls} placeholder="First name" autoComplete="off"
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-20 mt-1 overflow-hidden">
                      {suggestions.map((s: any) => (
                        <button key={s.id} type="button" onMouseDown={() => applySuggestion(s)}
                          className="w-full text-left px-4 py-2.5 hover:bg-blue-50 flex items-center justify-between group">
                          <span className="text-sm font-medium text-slate-700">{s.salutation} {s.first_name} {s.last_name}</span>
                          <span className="text-xs text-slate-400 group-hover:text-blue-600">{s.mobile || s.phone || ''}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Last Name</label><input type="text" value={(form as IndividualForm).last_name} onChange={e => setF('last_name', e.target.value)} className={inputCls} placeholder="Last name" /></div>
                <div><label className={labelCls}>Mobile *</label><input type="tel" value={(form as IndividualForm).mobile} onChange={e => setF('mobile', e.target.value)} className={inputCls} placeholder="+91 XXXXX XXXXX" /></div>
                <div><label className={labelCls}>Email</label><input type="email" value={(form as IndividualForm).email} onChange={e => setF('email', e.target.value)} className={inputCls} placeholder="email@example.com" /></div>
                <div><label className={labelCls}>Area</label><input type="text" value={(form as IndividualForm).area} onChange={e => setF('area', e.target.value)} className={inputCls} placeholder="e.g. Velachery" /></div>
                <div><label className={labelCls}>City</label><input type="text" value={(form as IndividualForm).city} onChange={e => setF('city', e.target.value)} className={inputCls} placeholder="e.g. Chennai" /></div>
              </div>
              <div><label className={labelCls}>Address</label><input type="text" value={(form as IndividualForm).address} onChange={e => setF('address', e.target.value)} className={inputCls} placeholder="Full address" /></div>
            </div>
          )}

          {/* ════════════════════════════════════════════
              HUB & SHIFT SECTION
          ════════════════════════════════════════════ */}
          <div className="border-t border-dashed border-gray-200 pt-5 space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-bold text-slate-700">Delivery Hub</span>
              <span className="text-xs text-slate-400">(required for order & PO generation)</span>
            </div>

            {/* Shift indicator */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${
              currentShift === 1 ? 'bg-blue-50 border border-blue-200 text-blue-700' :
              currentShift === 2 ? 'bg-orange-50 border border-orange-200 text-orange-700' :
              'bg-slate-50 border border-slate-200 text-slate-500'
            }`}>
              <Clock className="h-3.5 w-3.5" />
              {currentShift === 1 ? '🌅 Shift 1 — PO will go to Operations Manager for approval' :
               currentShift === 2 ? '🌙 Shift 2 — PO will go directly to Purchase Executive' :
               '⏰ Outside order hours (10 AM – 11 PM)'}
            </div>

            {/* Hub cards */}
            <div className="grid grid-cols-3 gap-2">
              {(hubs as any[]).map((hub: any) => (
                <button
                  key={hub.id}
                  type="button"
                  onClick={() => { setSelectedHubId(hub.id); setSelectedHubName(hub.name); }}
                  className={`rounded-xl border-2 p-2.5 text-left transition-all ${
                    selectedHubId === hub.id
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300 bg-white'
                  }`}
                >
                  <p className={`text-xs font-bold ${selectedHubId === hub.id ? 'text-purple-700' : 'text-slate-700'}`}>{hub.name}</p>
                  <p className="text-[10px] text-slate-400">{hub.location}</p>
                </button>
              ))}
            </div>
            {!selectedHubId && (
              <p className="text-[10px] text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Select a hub to include this order in the shift PO
              </p>
            )}
          </div>

          {/* ════════════════════════════════════════════
              ORDER ITEMS SECTION
          ════════════════════════════════════════════ */}
          <div className="border-t border-dashed border-gray-200 pt-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-bold text-slate-700">Order Items</span>
                <span className="text-xs text-slate-400">(optional — add items to place an order immediately)</span>
              </div>
              <button
                type="button"
                onClick={() => setOrderItems(prev => [...prev, newModalItem()])}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-100"
              >
                <Plus className="h-3.5 w-3.5" /> Add Item
              </button>
            </div>

            {orderItems.length === 0 ? (
              <button
                type="button"
                onClick={() => setOrderItems([newModalItem()])}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl py-5 text-xs text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
              >
                <Package className="h-4 w-4" /> Click to add items to this order
              </button>
            ) : (
              <div className="space-y-2">
                {/* column headers */}
                <div className="grid grid-cols-12 gap-1 px-1 text-[10px] font-bold text-slate-400 uppercase">
                  <div className="col-span-4">Product</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-1 text-center">Unit</div>
                  <div className="col-span-2 text-center">Price/Unit</div>
                  <div className="col-span-1 text-center">Grade</div>
                  <div className="col-span-2 text-right">Total</div>
                </div>

                {orderItems.map(item => (
                  <div key={item.key} className="grid grid-cols-12 gap-1 items-center bg-gray-50 rounded-lg p-2">
                    {/* Product search */}
                    <div className="col-span-4 relative">
                      <input
                        type="text"
                        value={item.product_search}
                        onChange={e => {
                          updateItem(item.key, { product_search: e.target.value, product_id: '', product_name: '', showDrop: true });
                          setProductQuery(e.target.value);
                        }}
                        onFocus={() => updateItem(item.key, { showDrop: true })}
                        onBlur={() => setTimeout(() => {
                          setOrderItems(prev => prev.map(it => it.key === item.key ? {
                            ...it,
                            showDrop: false,
                            // commit typed text as manual product name if nothing selected
                            product_name: it.product_name || it.product_search || '',
                            product_search: it.product_name || it.product_search || '',
                          } : it));
                        }, 180)}
                        placeholder="Search product…"
                        className="w-full text-xs rounded border border-gray-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                      />
                      {item.showDrop && (
                        <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-30 mt-0.5 overflow-hidden max-h-52 overflow-y-auto">
                          {productResults.length > 0 && (
                            <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                {item.product_search.length === 0 ? 'Popular Products' : 'Products'}
                              </span>
                              <span className="text-[10px] text-gray-300">{productResults.length} found</span>
                            </div>
                          )}
                          {productResults.map((p: any) => (
                            <button key={p.id} type="button"
                              onMouseDown={() => selectProduct(item.key, p, item.grade)}
                              className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-50 last:border-0 transition-colors">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                                  <span>{CATEGORY_ICON[p.category] ?? '📦'}</span>
                                  {p.name}
                                </span>
                                <span className="text-[10px] text-slate-400 bg-gray-100 px-1.5 py-0.5 rounded">{p.unit}</span>
                              </div>
                              <div className="flex gap-2 mt-0.5 ml-5">
                                <span className="text-[10px] text-emerald-600 font-medium">A: ₹{p.grade_a_price ?? 0}</span>
                                <span className="text-[10px] text-amber-600 font-medium">B: ₹{p.grade_b_price ?? 0}</span>
                                <span className="text-[10px] text-orange-600 font-medium">C: ₹{p.grade_c_price ?? 0}</span>
                              </div>
                            </button>
                          ))}
                          {/* Manual entry — only show when user has typed something not in list */}
                          {item.product_search.length > 0 && (
                            <button type="button"
                              onMouseDown={() => setOrderItems(prev => prev.map(it => it.key === item.key ? {
                                ...it, product_name: item.product_search, product_search: item.product_search, product_id: '', showDrop: false,
                              } : it))}
                              className="w-full text-left px-3 py-2 hover:bg-amber-50 border-t border-gray-200 flex items-center gap-2 transition-colors">
                              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Use:</span>
                              <span className="text-xs font-semibold text-slate-700">"{item.product_search}"</span>
                              <span className="text-[10px] text-gray-400 ml-auto">custom</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Qty */}
                    <div className="col-span-2">
                      <input type="number" min="0" step="0.5" value={item.qty}
                        onChange={e => updateItem(item.key, { qty: parseFloat(e.target.value) || 0 })}
                        className="w-full text-xs text-center rounded border border-gray-200 px-1 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                      />
                    </div>

                    {/* Unit */}
                    <div className="col-span-1">
                      <select value={item.unit} onChange={e => updateItem(item.key, { unit: e.target.value })}
                        className="w-full text-[10px] rounded border border-gray-200 px-1 py-1.5 focus:outline-none bg-white">
                        {['KG', 'G', 'L', 'ML', 'PCS', 'BOX', 'BAG'].map(u => <option key={u}>{u}</option>)}
                      </select>
                    </div>

                    {/* Price/Unit */}
                    <div className="col-span-2">
                      <input type="number" min="0" step="0.5" value={item.unit_price}
                        onChange={e => updateItem(item.key, { unit_price: parseFloat(e.target.value) || 0 })}
                        className="w-full text-xs text-center rounded border border-gray-200 px-1 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                        placeholder="₹"
                      />
                    </div>

                    {/* Grade — auto-updates price */}
                    <div className="col-span-1 flex gap-0.5 justify-center">
                      {(['A', 'B', 'C'] as const).map(g => (
                        <button key={g} type="button"
                          onClick={() => {
                            const gradePrice = g === 'A' ? item.grade_a_price : g === 'B' ? item.grade_b_price : item.grade_c_price;
                            updateItem(item.key, { grade: g, ...(gradePrice > 0 ? { unit_price: gradePrice } : {}) });
                          }}
                          className={`text-[9px] font-bold w-5 h-5 rounded transition-colors ${
                            item.grade === g
                              ? g === 'A' ? 'bg-emerald-500 text-white' : g === 'B' ? 'bg-amber-500 text-white' : 'bg-orange-500 text-white'
                              : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                          }`}>{g}</button>
                      ))}
                    </div>

                    {/* Total + delete */}
                    <div className="col-span-2 flex items-center justify-end gap-1">
                      <span className="text-xs font-bold text-slate-700">₹{lineTotal(item).toLocaleString()}</span>
                      <button type="button" onClick={() => removeItem(item.key)} className="text-gray-300 hover:text-red-400 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Payment mode + grand total */}
                <div className="flex items-center justify-between pt-2 px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">Payment:</span>
                    {(['cod', 'credit', 'upi'] as const).map(m => (
                      <button key={m} type="button" onClick={() => setPayMode(m)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${
                          payMode === m ? 'bg-slate-800 text-white' : 'bg-gray-100 text-slate-500 hover:bg-gray-200'
                        }`}>{m}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 bg-blue-50 rounded-lg px-3 py-1.5">
                    <span className="text-xs text-blue-400">₹</span>
                    <span className="text-sm font-black text-blue-700">{grandTotal.toLocaleString()}</span>
                    <span className="text-[10px] text-blue-400 ml-1">Total</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white">
          <button onClick={onClose} className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
              hasItems ? 'bg-blue-600 hover:bg-blue-700' : form.customer_type === 'shop' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {saving
              ? <><RefreshCw className="h-4 w-4 animate-spin" /> Saving…</>
              : hasItems
                ? <><ShoppingBag className="h-4 w-4" /> Save & Create Order</>
                : <><Check className="h-4 w-4" /> Save Customer</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */
export default function CustomerManagement() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch]               = useState('');
  const [typeFilter, setTypeFilter]       = useState<'all' | 'shop' | 'individual'>('all');
  const [activeTab, setActiveTab]         = useState<'customers' | 'bulk'>('customers');
  const [showForm, setShowForm]           = useState(false);
  const [showImport, setShowImport]       = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers-all'],
    queryFn: async () => {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .order('shop_name');
      return data ?? [];
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('customers').update({ is_active: !active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers-all'] }),
    onError: () => toast.error('Failed to update'),
  });

  const openAdd  = () => { setEditingCustomer(null); setShowForm(true); };
  const openEdit = (c: any) => { setEditingCustomer(c); setShowForm(true); };
  const onSaved  = () => qc.invalidateQueries({ queryKey: ['customers-all'] });

  const allCustomers = customers as any[];
  const filtered = allCustomers.filter(c => {
    if (typeFilter !== 'all' && (c.customer_type ?? 'shop') !== typeFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.shop_name ?? '').toLowerCase().includes(q) ||
           (c.first_name ?? '').toLowerCase().includes(q) ||
           (c.name ?? '').toLowerCase().includes(q) ||
           (c.phone ?? '').includes(q) ||
           (c.mobile ?? '').includes(q) ||
           (c.area ?? '').toLowerCase().includes(q);
  });

  const shopCount       = allCustomers.filter(c => (c.customer_type ?? 'shop') === 'shop').length;
  const individualCount = allCustomers.filter(c => c.customer_type === 'individual').length;
  const withOutstanding = allCustomers.filter(c => Number(c.outstanding_balance) > 0).length;
  const totalOutstanding = allCustomers.reduce((s, c) => s + Number(c.outstanding_balance || 0), 0);

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-10">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Sales Order</h1>
          <p className="text-sm text-gray-500">{shopCount} shops · {individualCount} individuals</p>
        </div>
        {activeTab === 'customers' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-gray-50"
            >
              <Upload className="h-4 w-4" /> Import CSV
            </button>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              <Plus className="h-4 w-4" /> Add Customer
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('customers')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === 'customers' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="h-4 w-4" /> Customers
        </button>
        <button
          onClick={() => setActiveTab('bulk')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === 'bulk' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <LayoutList className="h-4 w-4" /> Bulk Order Entry
        </button>
      </div>

      {/* Bulk Order Tab */}
      {activeTab === 'bulk' && (
        <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>}>
          <BulkOrderPage />
        </Suspense>
      )}

      {activeTab === 'customers' && (<>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="p-2 bg-green-50 rounded-lg"><Store className="h-4 w-4 text-green-600" /></div>
          <div><p className="text-xl font-bold text-slate-800">{shopCount}</p><p className="text-xs text-gray-500">Shops</p></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg"><User className="h-4 w-4 text-blue-600" /></div>
          <div><p className="text-xl font-bold text-slate-800">{individualCount}</p><p className="text-xs text-gray-500">Individuals</p></div>
        </div>
        <div className={`rounded-xl border p-4 flex items-center gap-3 ${withOutstanding > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
          <div className={`p-2 rounded-lg ${withOutstanding > 0 ? 'bg-amber-100' : 'bg-gray-50'}`}>
            <AlertTriangle className={`h-4 w-4 ${withOutstanding > 0 ? 'text-amber-600' : 'text-gray-300'}`} />
          </div>
          <div>
            <p className={`text-xl font-bold ${withOutstanding > 0 ? 'text-amber-800' : 'text-slate-800'}`}>₹{(totalOutstanding / 1000).toFixed(1)}k</p>
            <p className="text-xs text-gray-500">Outstanding</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 flex-1">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, or area…"
            className="text-sm outline-none flex-1 bg-transparent"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'shop', 'individual'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                typeFilter === t ? 'bg-slate-800 text-white' : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
              }`}
            >
              {t === 'all' ? 'All' : t === 'shop' ? 'Shops' : 'Individuals'}
            </button>
          ))}
        </div>
      </div>

      {/* Customer list */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading customers…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          <Users className="h-10 w-10 mx-auto mb-2 text-gray-200" />
          {search ? 'No customers match your search' : 'No customers yet — add your first one!'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c: any) => {
            const isIndividual = c.customer_type === 'individual';
            const outstanding  = Number(c.outstanding_balance || 0);
            const overLimit    = outstanding > Number(c.credit_limit || 0) && Number(c.credit_limit || 0) > 0;
            const displayName  = isIndividual
              ? `${c.salutation ?? ''} ${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()
              : c.shop_name ?? c.name ?? '—';
            const subLabel     = isIndividual ? (c.email ?? '') : (c.owner_name ?? '');

            return (
              <div key={c.id} className={`bg-white rounded-xl border-2 p-4 ${overLimit ? 'border-red-200' : c.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-2.5">
                    <div className={`p-1.5 rounded-lg mt-0.5 ${isIndividual ? 'bg-blue-50' : 'bg-green-50'}`}>
                      {isIndividual
                        ? <User className="h-4 w-4 text-blue-500" />
                        : <Store className="h-4 w-4 text-green-500" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800 text-sm">{displayName}</h3>
                      {subLabel && <p className="text-xs text-gray-400">{subLabel}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/sales/new-order?customer_id=${c.id}`)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold transition-colors"
                      title="Create sales order for this customer"
                    >
                      <ShoppingCart className="h-3.5 w-3.5" /> New Order
                    </button>
                    <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => toggleActive.mutate({ id: c.id, active: c.is_active })}
                      className={`px-2 py-0.5 text-xs font-medium rounded-lg ${c.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {c.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                </div>

                <div className="space-y-1 text-sm text-gray-600 ml-9">
                  {(c.phone || c.mobile) && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-gray-400" />
                      <a href={`tel:${c.mobile || c.phone}`} className="text-blue-600 hover:underline text-xs">{c.mobile || c.phone}</a>
                    </div>
                  )}
                  {(c.area || c.city) && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-xs">{[c.area, c.city].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                </div>

                {!isIndividual && (
                  <div className="mt-3 flex items-center justify-between flex-wrap gap-2 ml-9">
                    <div className="flex items-center gap-2 text-xs">
                      {Number(c.credit_days) > 0 && <span className="bg-blue-50 text-blue-700 rounded px-2 py-0.5">{c.credit_days}d credit</span>}
                      {Number(c.credit_limit) > 0 && <span className="bg-gray-100 text-gray-600 rounded px-2 py-0.5">Limit ₹{Number(c.credit_limit).toLocaleString()}</span>}
                      {c.gst_number && <span className="bg-purple-50 text-purple-700 rounded px-2 py-0.5 font-mono">{c.gst_number}</span>}
                    </div>
                    {outstanding > 0 && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${overLimit ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        Due: ₹{outstanding.toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <CustomerFormModal
          editingCustomer={editingCustomer}
          onClose={() => { setShowForm(false); setEditingCustomer(null); }}
          onDone={onSaved}
        />
      )}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onDone={() => { qc.invalidateQueries({ queryKey: ['customers-all'] }); setShowImport(false); }}
        />
      )}
      </>)}
    </div>
  );
}
