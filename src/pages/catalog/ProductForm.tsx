import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowLeft, Save, Loader2, Package,
  DollarSign, Percent, Trash2
} from 'lucide-react';
import { toast } from 'sonner';

interface ProductFormData {
  name: string;
  category: string;
  unit: string;
  grade_a_price: number;
  grade_b_discount: number;
  grade_c_discount: number;
  min_stock_kg: number;
  description: string;
  is_active: boolean;
}

const CATEGORIES = [
  'Vegetables', 'Fruits', 'Leafy Greens', 'Root Vegetables',
  'Exotic Vegetables', 'Herbs & Spices', 'Dry Goods', 'Other'
];

const UNITS = ['kg', 'gm', 'piece', 'bunch', 'box', 'crate'];

const EMPTY_FORM: ProductFormData = {
  name: '',
  category: 'Vegetables',
  unit: 'kg',
  grade_a_price: 0,
  grade_b_discount: 10,
  grade_c_discount: 20,
  min_stock_kg: 10,
  description: '',
  is_active: true,
};

export default function ProductForm() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = !!id;
  const [form, setForm] = useState<ProductFormData>(EMPTY_FORM);

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing && form.name === '') {
      setForm({
        name: existing.name || '',
        category: existing.category || 'Vegetables',
        unit: existing.unit || 'kg',
        grade_a_price: existing.grade_a_price || 0,
        grade_b_discount: existing.grade_b_discount || 10,
        grade_c_discount: existing.grade_c_discount || 20,
        min_stock_kg: existing.min_stock_kg || 10,
        description: existing.description || '',
        is_active: existing.is_active !== false,
      });
    }
  }, [existing, form.name]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('Product name is required');
      if (form.grade_a_price <= 0) throw new Error('Grade A price must be greater than 0');

      if (isEdit) {
        const { error } = await supabase.from('products').update(form).eq('id', id!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('products').insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Product updated successfully' : 'Product created successfully');
      qc.invalidateQueries({ queryKey: ['products'] });
      navigate('/catalog');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save product'),
  });

  const deleteProduct = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('products').delete().eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Product deleted');
      qc.invalidateQueries({ queryKey: ['products'] });
      navigate('/catalog');
    },
    onError: () => toast.error('Failed to delete product'),
  });

  const gradeB_price = form.grade_a_price * (1 - form.grade_b_discount / 100);
  const gradeC_price = form.grade_a_price * (1 - form.grade_c_discount / 100);

  const set = (key: keyof ProductFormData, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }));

  if (loadingExisting) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">
              {isEdit ? 'Edit Product' : 'New Product'}
            </h1>
            <p className="text-sm text-gray-500">
              {isEdit ? `Editing: ${existing?.name}` : 'Add to product catalog'}
            </p>
          </div>
          {isEdit && (
            <button
              onClick={() => {
                if (confirm('Delete this product? This cannot be undone.')) deleteProduct.mutate();
              }}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 border-b pb-2">
            <Package className="h-4 w-4 text-green-600" />
            Basic Information
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1 font-medium">Product Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Tomato (Cherry)"
              className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1 font-medium">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Product description (optional)"
              rows={2}
              className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-400 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Category</label>
              <select
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-400 bg-white"
              >
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Unit</label>
              <select
                value={form.unit}
                onChange={(e) => set('unit', e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-400 bg-white"
              >
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1 font-medium">Min Stock Alert (kg)</label>
            <input
              type="number"
              min="0"
              value={form.min_stock_kg}
              onChange={(e) => set('min_stock_kg', parseFloat(e.target.value) || 0)}
              className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 border-b pb-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            Grade Pricing
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1 font-medium">Grade A Price (₹/kg) *</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400 text-sm">₹</span>
              <input
                type="number"
                min="0"
                step="0.5"
                value={form.grade_a_price}
                onChange={(e) => set('grade_a_price', parseFloat(e.target.value) || 0)}
                className="w-full border rounded-lg pl-7 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Grade B Discount (%)</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.grade_b_discount}
                  onChange={(e) => set('grade_b_discount', parseFloat(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 pr-7 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                />
                <Percent className="absolute right-2 top-3 h-3.5 w-3.5 text-gray-400" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Grade C Discount (%)</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.grade_c_discount}
                  onChange={(e) => set('grade_c_discount', parseFloat(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 pr-7 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-400"
                />
                <Percent className="absolute right-2 top-3 h-3.5 w-3.5 text-gray-400" />
              </div>
            </div>
          </div>

          {form.grade_a_price > 0 && (
            <div className="grid grid-cols-3 gap-2 bg-gray-50 rounded-xl p-3">
              {[
                { grade: 'A', price: form.grade_a_price, color: 'text-green-700', bg: 'bg-green-100' },
                { grade: 'B', price: gradeB_price, color: 'text-blue-700', bg: 'bg-blue-100' },
                { grade: 'C', price: gradeC_price, color: 'text-amber-700', bg: 'bg-amber-100' },
              ].map(({ grade, price, color, bg }) => (
                <div key={grade} className={`${bg} rounded-lg px-2 py-2 text-center`}>
                  <div className={`text-xs font-medium ${color}`}>Grade {grade}</div>
                  <div className={`text-sm font-bold ${color}`}>₹{price.toFixed(1)}/kg</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900 text-sm">Active Status</div>
              <div className="text-xs text-gray-500">Inactive products won't appear in order forms</div>
            </div>
            <button
              onClick={() => set('is_active', !form.is_active)}
              className={`relative w-12 h-6 rounded-full transition-colors ${form.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-3">
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending || !form.name.trim() || form.grade_a_price <= 0}
          className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl font-semibold disabled:opacity-60"
        >
          {save.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {isEdit ? 'Save Changes' : 'Create Product'}
        </button>
      </div>
    </div>
  );
}
