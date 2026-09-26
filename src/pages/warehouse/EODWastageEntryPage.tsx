import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { AlertTriangle, Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const REASONS = [
  'EOD reconciliation',
  'Spoiled / rotten',
  'Handling damage',
  'Damaged in transit',
  'Expired',
  'Other',
];

interface Row {
  key: string;
  product_id: string;
  quantity_kg: string;
  reason: string;
  notes: string;
}

const emptyRow = (): Row => ({ key: crypto.randomUUID(), product_id: '', quantity_kg: '', reason: 'EOD reconciliation', notes: '' });

export default function EODWastageEntryPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [hubId, setHubId] = useState('');
  const [entryDate, setEntryDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [rows, setRows] = useState<Row[]>([emptyRow()]);

  const { data: hubs = [] } = useQuery({
    queryKey: ['hubs-active'],
    queryFn: async () => {
      const { data } = await supabase.from('hubs').select('id, name').eq('is_active', true).order('name');
      return data ?? [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('id, name, unit').eq('is_active', true).order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const hubName = hubs.find((h: any) => h.id === hubId)?.name ?? '';

  const updateRow = (key: string, patch: Partial<Row>) =>
    setRows(rs => rs.map(r => r.key === key ? { ...r, ...patch } : r));

  const addRow = () => setRows(rs => [...rs, emptyRow()]);
  const removeRow = (key: string) => setRows(rs => rs.length > 1 ? rs.filter(r => r.key !== key) : rs);

  const validRows = rows.filter(r => r.product_id && Number(r.quantity_kg) > 0);

  const submit = useMutation({
    mutationFn: async () => {
      if (!hubId) throw new Error('Select a hub');
      if (!validRows.length) throw new Error('Add at least one product with a quantity');

      const payload = validRows.map(r => {
        const product = (products as any[]).find(p => p.id === r.product_id);
        return {
          hub_id: hubId,
          hub_name: hubName,
          product_id: r.product_id,
          item_name: product?.name ?? '',
          quantity_kg: Number(r.quantity_kg),
          reason: r.reason,
          notes: r.notes || null,
          entry_date: entryDate,
          submitted_by: user!.id,
        };
      });

      // Same wastage_entries insert DamageEntryPage.tsx uses, one row per
      // product -- the DB's inv_wastage_before_trg trigger deducts each row
      // from inventory automatically (single source of truth, never called
      // directly here). This page exists because logging wastage for a whole
      // day's worth of bulk products one form-submit at a time (the existing
      // Damage Entry flow) isn't practical -- this is that same flow, batched.
      const { error } = await supabase.from('wastage_entries').insert(payload);
      if (error) throw error;
      return payload.length;
    },
    onSuccess: (count) => {
      toast.success(`Recorded wastage for ${count} product${count === 1 ? '' : 's'} — inventory updated`);
      setRows([emptyRow()]);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (e: any) => toast.error(`Failed: ${e.message}`),
  });

  const totalKg = validRows.reduce((s, r) => s + (Number(r.quantity_kg) || 0), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12 pt-2 px-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-red-500" />
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 tracking-tight">EOD Wastage Entry</h1>
          <p className="text-[13px] text-slate-500">Log wastage for a whole day's worth of products at once — for bulk items that skip per-vendor QC. Deducted from inventory immediately.</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Batch Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Hub *</label>
            <select value={hubId} onChange={e => setHubId(e.target.value)} className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm">
              <option value="">Select hub…</option>
              {(hubs as any[]).map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Date</label>
            <Input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Products</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {rows.map(row => (
            <div key={row.key} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1.2fr_2fr_auto] gap-2 items-start">
              <select value={row.product_id} onChange={e => updateRow(row.key, { product_id: e.target.value })}
                className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm">
                <option value="">Select product…</option>
                {(products as any[]).map(p => <option key={p.id} value={p.id}>{p.name}{p.unit ? ` (${p.unit})` : ''}</option>)}
              </select>
              <Input type="number" step="0.1" min="0" placeholder="Qty (kg)" value={row.quantity_kg}
                onChange={e => updateRow(row.key, { quantity_kg: e.target.value })} />
              <select value={row.reason} onChange={e => updateRow(row.key, { reason: e.target.value })}
                className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm">
                {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <Input placeholder="Notes (optional)" value={row.notes} onChange={e => updateRow(row.key, { notes: e.target.value })} />
              <Button type="button" variant="ghost" size="sm" className="h-9 px-2 text-slate-400 hover:text-red-600"
                onClick={() => removeRow(row.key)} disabled={rows.length === 1}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-4 w-4 mr-2" /> Add Product
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-5 py-4">
        <div className="text-sm text-slate-500">
          {validRows.length} product{validRows.length === 1 ? '' : 's'} · <span className="font-semibold text-slate-800">{totalKg.toLocaleString()} kg total</span>
        </div>
        <Button onClick={() => submit.mutate()} disabled={submit.isPending} className="bg-red-600 hover:bg-red-700">
          {submit.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
          {submit.isPending ? 'Saving…' : 'Record Wastage — Deduct from Inventory'}
        </Button>
      </div>
    </div>
  );
}
