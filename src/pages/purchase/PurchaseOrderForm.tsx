import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ArrowLeft, Plus, Trash2, Save, Loader2 } from 'lucide-react';

interface LineItem {
  product_id: string;
  product_name: string;
  quantity_kg: number;
  unit_price: number;
}

export default function PurchaseOrderForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const hubId = (user as any)?.hub_id ?? null;

  const [vendorId, setVendorId] = useState('');
  const [orderDate, setOrderDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([{ product_id: '', product_name: '', quantity_kg: 1, unit_price: 0 }]);

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors-list'],
    queryFn: async () => {
      const { data } = await supabase.from('vendors').select('id, name').eq('is_active', true).order('name');
      return data ?? [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products-active'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id, name, grade_a_price').eq('is_active', true).order('name');
      return data ?? [];
    },
  });

  const totalAmount = items.reduce((s, i) => s + i.quantity_kg * i.unit_price, 0);

  const addItem = () => setItems(prev => [...prev, { product_id: '', product_name: '', quantity_kg: 1, unit_price: 0 }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof LineItem, value: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      if (field === 'product_id') {
        const product = (products as any[]).find(p => p.id === value);
        updated.product_name = product?.name ?? '';
        updated.unit_price = product?.grade_a_price ?? 0;
      }
      return updated;
    }));
  };

  const savePO = useMutation({
    mutationFn: async () => {
      if (!vendorId) throw new Error('Select a vendor');
      if (items.some(i => !i.product_id)) throw new Error('Select products for all line items');

      const poNumber = `PO-${Date.now().toString().slice(-8)}`;
      const { data: po, error: poErr } = await supabase
        .from('purchase_orders')
        .insert({
          po_number: poNumber,
          vendor_id: vendorId,
          hub_id: hubId,
          order_date: orderDate,
          expected_delivery_date: expectedDate || null,
          total_amount: totalAmount,
          status: 'pending',
          created_by: user!.id,
          notes: notes || null,
        })
        .select('id')
        .single();
      if (poErr) throw poErr;

      const lineItems = items.map(i => ({
        po_id: po.id,
        product_id: i.product_id,
        ordered_qty: i.quantity_kg,
        unit_price: i.unit_price,
        total_price: i.quantity_kg * i.unit_price,
      }));
      const { error: itemErr } = await supabase.from('purchase_order_items').insert(lineItems);
      if (itemErr) throw itemErr;

      return po.id;
    },
    onSuccess: () => {
      toast.success('Purchase Order created!');
      qc.invalidateQueries({ queryKey: ['ff-purchase-today'] });
      navigate('/purchase/produce');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Purchase Order</h1>
          <p className="text-sm text-gray-500">Fresh Produce Procurement</p>
        </div>
      </div>

      {/* Header fields */}
      <div className="zoho-card p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="zoho-label">Vendor *</label>
            <select value={vendorId} onChange={e => setVendorId(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select vendor</option>
              {(vendors as any[]).map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="zoho-label">Order Date</label>
            <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="zoho-label">Expected Delivery</label>
            <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="zoho-label">Notes</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes"
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="zoho-card">
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Line Items</h2>
          <button onClick={addItem} className="btn-zoho-secondary text-xs px-3 py-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Item
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="zoho-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty (kg)</th>
                <th>Rate (₹/kg)</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td>
                    <select value={item.product_id} onChange={e => updateItem(idx, 'product_id', e.target.value)}
                      className="w-full rounded border border-[#E2E8F0] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                      <option value="">Select product</option>
                      {(products as any[]).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <input type="number" value={item.quantity_kg} min="0.5" step="0.5"
                      onChange={e => updateItem(idx, 'quantity_kg', parseFloat(e.target.value) || 0)}
                      className="w-24 rounded border border-[#E2E8F0] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </td>
                  <td>
                    <input type="number" value={item.unit_price} min="0" step="0.5"
                      onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                      className="w-24 rounded border border-[#E2E8F0] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </td>
                  <td className="font-semibold text-slate-800">₹{(item.quantity_kg * item.unit_price).toFixed(0)}</td>
                  <td>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-[#E2E8F0] flex justify-end">
          <p className="font-bold text-lg text-slate-800">Total: ₹{totalAmount.toLocaleString('en-IN')}</p>
        </div>
      </div>

      <div className="flex gap-3 justify-end">
        <button onClick={() => navigate(-1)} className="btn-zoho-secondary">Cancel</button>
        <button onClick={() => savePO.mutate()} disabled={savePO.isPending} className="btn-zoho-primary">
          {savePO.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {savePO.isPending ? 'Saving...' : 'Create PO'}
        </button>
      </div>
    </div>
  );
}
