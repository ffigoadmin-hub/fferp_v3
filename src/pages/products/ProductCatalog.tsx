import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Plus, Download, Upload, Search, Edit2, X, Check, Package } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Product {
  id?: string;
  name: string;
  category: string;
  unit: string;
  grade_a_price: number;
  grade_b_discount_pct: number;
  grade_c_discount_pct: number;
  min_order_kg: number;
  is_active: boolean;
}

const CATEGORIES = ['Vegetables', 'Fruits', 'Leafy Greens', 'Herbs', 'Exotics', 'Processed', 'Other'];
const EMPTY: Product = {
  name: '', category: 'Vegetables', unit: 'kg',
  grade_a_price: 0, grade_b_discount_pct: 10, grade_c_discount_pct: 20,
  min_order_kg: 1, is_active: true,
};

export default function ProductCatalog() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const canEdit = ['gm', 'ceo', 'purchase_manager', 'purchase_head', 'admin'].includes(role ?? '');
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Product>(EMPTY);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products-catalog'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*').order('category').order('name');
      return data ?? [];
    },
  });

  const saveProduct = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('Product name required');
      if (form.grade_a_price <= 0) throw new Error('Enter valid Grade A price');
      const payload = {
        name: form.name.trim(), category: form.category, unit: form.unit,
        grade_a_price: form.grade_a_price,
        grade_b_discount_pct: form.grade_b_discount_pct,
        grade_c_discount_pct: form.grade_c_discount_pct,
        min_order_kg: form.min_order_kg, is_active: form.is_active,
      };
      if (editId) {
        const { error } = await supabase.from('products').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('products').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? 'Product updated!' : 'Product added!');
      setShowForm(false); setEditId(null); setForm(EMPTY);
      qc.invalidateQueries({ queryKey: ['products-catalog'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('products').update({ is_active: !active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products-catalog'] }),
  });

  const exportCSV = () => {
    const rows = (products as any[]).map(p => ({
      Name: p.name, Category: p.category, Unit: p.unit,
      'Grade A Price (₹/kg)': p.grade_a_price,
      'Grade B Discount %': p.grade_b_discount_pct,
      'Grade C Discount %': p.grade_c_discount_pct,
      'Min Order (kg)': p.min_order_kg,
      Active: p.is_active ? 'Yes' : 'No',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, 'FF_Products.xlsx');
    toast.success('Exported!');
  };

  const importCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    const prods = rows.map(r => ({
      name: r['Name'] ?? r['name'],
      category: r['Category'] ?? 'Vegetables',
      unit: r['Unit'] ?? 'kg',
      grade_a_price: parseFloat(r['Grade A Price (₹/kg)'] ?? 0),
      grade_b_discount_pct: parseFloat(r['Grade B Discount %'] ?? 10),
      grade_c_discount_pct: parseFloat(r['Grade C Discount %'] ?? 20),
      min_order_kg: parseFloat(r['Min Order (kg)'] ?? 1),
      is_active: (r['Active'] ?? 'Yes') === 'Yes',
    })).filter(p => p.name);
    const { error } = await supabase.from('products').upsert(prods, { onConflict: 'name' });
    if (error) { toast.error(error.message); return; }
    toast.success(`${prods.length} products imported!`);
    qc.invalidateQueries({ queryKey: ['products-catalog'] });
    e.target.value = '';
  };

  const startEdit = (product: any) => {
    setForm({ ...product }); setEditId(product.id); setShowForm(true);
  };

  const filtered = (products as any[]).filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = !categoryFilter || p.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const categories = [...new Set((products as any[]).map(p => p.category))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Product Catalog</h1>
          <p className="text-sm text-gray-500">{(products as any[]).filter(p => p.is_active).length} active SKUs</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            <Download className="h-4 w-4" /> Export
          </button>
          {canEdit && (
            <>
              <button onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                <Upload className="h-4 w-4" /> Import CSV
              </button>
              <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={importCSV} />
              <button onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY); }}
                className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
                <Plus className="h-4 w-4" /> Add Product
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Search products..." />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setCategoryFilter('')}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${!categoryFilter ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}>All</button>
          {categories.map(cat => (
            <button key={cat} onClick={() => setCategoryFilter(cat)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${categoryFilter === cat ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{cat}</button>
          ))}
        </div>
      </div>

      {showForm && canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">{editId ? 'Edit Product' : 'Add Product'}</h2>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Product Name *</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g. Tomato" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    {['kg', 'piece', 'bunch', 'dozen'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Grade A Price (₹/kg) *</label>
                <input type="number" value={form.grade_a_price} onChange={e => setForm(f => ({ ...f, grade_a_price: parseFloat(e.target.value) || 0 }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" min="0" step="0.5" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Grade B Discount %</label>
                  <input type="number" value={form.grade_b_discount_pct} onChange={e => setForm(f => ({ ...f, grade_b_discount_pct: parseFloat(e.target.value) || 0 }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" min="0" max="50" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Grade C Discount %</label>
                  <input type="number" value={form.grade_c_discount_pct} onChange={e => setForm(f => ({ ...f, grade_c_discount_pct: parseFloat(e.target.value) || 0 }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" min="0" max="80" />
                </div>
              </div>
              <div className="bg-green-50 rounded-xl p-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <p className="font-bold text-green-700">₹{form.grade_a_price.toFixed(2)}</p>
                  <p className="text-gray-500">Grade A</p>
                </div>
                <div>
                  <p className="font-bold text-yellow-700">₹{(form.grade_a_price * (1 - form.grade_b_discount_pct / 100)).toFixed(2)}</p>
                  <p className="text-gray-500">Grade B (-{form.grade_b_discount_pct}%)</p>
                </div>
                <div>
                  <p className="font-bold text-orange-700">₹{(form.grade_a_price * (1 - form.grade_c_discount_pct / 100)).toFixed(2)}</p>
                  <p className="text-gray-500">Grade C (-{form.grade_c_discount_pct}%)</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)}
                className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700">Cancel</button>
              <button onClick={() => saveProduct.mutate()} disabled={saveProduct.isPending}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                <Check className="h-4 w-4" /> {saveProduct.isPending ? 'Saving...' : 'Save Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-6 gap-3 px-5 py-3 text-xs font-semibold text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
          <div className="col-span-2">Product</div>
          <div className="text-right">Grade A</div>
          <div className="text-right">Grade B</div>
          <div className="text-right">Grade C</div>
          <div className="text-center">Status</div>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading products...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center"><Package className="h-10 w-10 text-gray-300 mx-auto mb-2" /><p className="text-sm text-gray-400">No products found</p></div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map((product: any) => {
              const priceB = product.grade_a_price * (1 - (product.grade_b_discount_pct ?? 10) / 100);
              const priceC = product.grade_a_price * (1 - (product.grade_c_discount_pct ?? 20) / 100);
              return (
                <div key={product.id}
                  className={`grid grid-cols-6 gap-3 px-5 py-3 items-center hover:bg-gray-50/60 ${!product.is_active ? 'opacity-50' : ''}`}>
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-gray-800">{product.name}</p>
                    <p className="text-xs text-gray-400">{product.category} · {product.unit}</p>
                  </div>
                  <div className="text-right"><p className="text-sm font-semibold text-green-700">₹{product.grade_a_price}</p></div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-yellow-700">₹{priceB.toFixed(1)}</p>
                    <p className="text-xs text-gray-400">-{product.grade_b_discount_pct}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-orange-700">₹{priceC.toFixed(1)}</p>
                    <p className="text-xs text-gray-400">-{product.grade_c_discount_pct}%</p>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    {canEdit && <button onClick={() => startEdit(product)} className="text-gray-400 hover:text-gray-600"><Edit2 className="h-3.5 w-3.5" /></button>}
                    {canEdit && (
                      <button onClick={() => toggleActive.mutate({ id: product.id, active: product.is_active })}
                        className={`text-xs rounded-full px-2 py-0.5 font-medium ${product.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {product.is_active ? 'On' : 'Off'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
