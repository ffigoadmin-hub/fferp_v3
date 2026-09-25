// @ts-nocheck — inventory / inventory_log / wastage_entries / hubs are not in the stale types.ts
// ─────────────────────────────────────────────────────────────
//  Inventory & Wastage data layer. Columns verified live 2026-09-24:
//    inventory      id, hub_id, product_id, quantity (kg), min_threshold, product_name, unit, updated_at
//    inventory_log  hub_id, product_id, event_type, qty_delta, ref_type, ref_id, notes, created_by, created_at
//    wastage_entries + product_id, reason_category, rate_per_kg, unit, inventory_applied_qty
//                     (ADD_WAREHOUSE_INVENTORY_WASTAGE.sql)
//  Stock only changes through the DB (inv_adjust_stock RPC, wastage trigger, box scans) so every
//  change leaves an inventory_log row.
// ─────────────────────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const HUB_SCOPED_ROLES = ['hub_manager', 'shift_employee', 'warehouse_manager', 'qc_manager'];

export const WASTAGE_REASONS: { key: string; label: string; color: string }[] = [
  { key: 'rotten',          label: 'Rotten / spoiled',   color: '#B45309' },
  { key: 'damaged',         label: 'Damaged in handling', color: '#DC2626' },
  { key: 'transit_damage',  label: 'Transit damage',     color: '#EA580C' },
  { key: 'expired',         label: 'Expired / aged',     color: '#7C3AED' },
  { key: 'qc_reject',       label: 'QC reject',          color: '#0891B2' },
  { key: 'pest',            label: 'Pest / contamination', color: '#65A30D' },
  { key: 'customer_return', label: 'Customer return',    color: '#2563EB' },
  { key: 'pilferage',       label: 'Pilferage / missing', color: '#475569' },
  { key: 'other',           label: 'Other',              color: '#94A3B8' },
];
export const reasonLabel = (k?: string | null, fallback?: string | null) =>
  WASTAGE_REASONS.find((r) => r.key === k)?.label || fallback || 'Unspecified';

export const EVENT_STYLE: Record<string, { label: string; cls: string }> = {
  receive:    { label: 'Received',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  dispatch:   { label: 'Dispatched', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  wastage:    { label: 'Wastage',    cls: 'bg-red-50 text-red-700 border-red-200' },
  qc_reject:  { label: 'QC reject',  cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  return:     { label: 'Return',     cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  adjustment: { label: 'Count / adjust', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
};

export const kg = (n: number | null | undefined, d = 1) =>
  `${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: d })} kg`;
export const rupees = (n: number | null | undefined) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

/** Stock status for one inventory row. */
export function stockStatus(qty: number, min: number | null) {
  if (qty <= 0) return { key: 'out', label: 'Out of stock', cls: 'bg-red-50 text-red-700 border-red-200' };
  if (min != null && qty <= Number(min)) return { key: 'low', label: 'Low', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { key: 'ok', label: 'In stock', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
}

/** Warehouse scope for the signed-in user: hub staff are locked to their own warehouse. */
export function useWarehouseScope() {
  const { user } = useAuth();
  const role = (user?.role || '').toLowerCase();
  const locked = HUB_SCOPED_ROLES.includes(role);
  return {
    locked,
    ownHubId: (user?.hub_id as string) || null,
    canManage: ['admin', 'ceo', 'gm', 'ff_operations_manager', 'hub_manager', 'warehouse_manager', 'qc_manager'].includes(role),
    canDeleteWastage: ['admin', 'ceo', 'gm', 'ff_operations_manager', 'hub_manager'].includes(role),
    userId: user?.id,
  };
}

async function fetchAll<T>(build: (from: number, to: number) => any, pageSize = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return out;
}

export function useWarehouses() {
  return useQuery({
    queryKey: ['inv-warehouses'],
    queryFn: async () => {
      const { data, error } = await supabase.from('hubs')
        .select('id, code, name, display_name, city, is_active').order('code');
      if (error) throw error;
      return (data ?? []).map((h: any) => ({ ...h, label: h.display_name || h.name }));
    },
    staleTime: 5 * 60_000,
  });
}

export function useStock(hubId: string | null) {
  return useQuery({
    queryKey: ['inv-stock', hubId || 'all'],
    queryFn: async () => fetchAll<any>((a, b) => {
      let q = supabase.from('inventory')
        .select('id, hub_id, product_id, quantity, min_threshold, product_name, unit, updated_at, products(name, unit, category), hubs(code, name)')
        .order('product_name', { ascending: true }).order('id', { ascending: true });
      if (hubId) q = q.eq('hub_id', hubId);
      return q.range(a, b);
    }),
  });
}

export function useMovements(f: { hubId: string | null; from: string; to: string; event?: string }) {
  return useQuery({
    queryKey: ['inv-movements', f],
    queryFn: async () => {
      const rows = await fetchAll<any>((a, b) => {
        let q = supabase.from('inventory_log')
          .select('id, hub_id, product_id, event_type, qty_delta, ref_type, ref_id, notes, created_by, created_at, products(name, unit), hubs(code, name)')
          .gte('created_at', `${f.from}T00:00:00+05:30`).lte('created_at', `${f.to}T23:59:59+05:30`)
          .order('created_at', { ascending: false }).order('id', { ascending: true });
        if (f.hubId) q = q.eq('hub_id', f.hubId);
        if (f.event) q = q.eq('event_type', f.event);
        return q.range(a, b);
      });
      // created_by → auth.users has no FK to profiles, so names are merged client-side
      const ids = [...new Set(rows.map((r) => r.created_by).filter(Boolean))];
      if (ids.length) {
        const { data: people, error } = await supabase.from('profiles').select('id, name').in('id', ids);
        if (error) console.error('[inventory] profile names:', error.message);
        const byId = new Map((people ?? []).map((p: any) => [p.id, p.name]));
        rows.forEach((r) => { r.by_name = byId.get(r.created_by) || null; });
      }
      return rows;
    },
  });
}

export function useWastage(f: { hubId: string | null; from: string; to: string }) {
  return useQuery({
    queryKey: ['inv-wastage', f],
    queryFn: async () => {
      const rows = await fetchAll<any>((a, b) => {
        let q = supabase.from('wastage_entries')
          .select('*, products(name, unit, category), hubs(code, name)')
          .gte('entry_date', f.from).lte('entry_date', f.to)
          .order('entry_date', { ascending: false }).order('created_at', { ascending: false });
        if (f.hubId) q = q.eq('hub_id', f.hubId);
        return q.range(a, b);
      });
      const ids = [...new Set(rows.map((r) => r.submitted_by).filter(Boolean))];
      if (ids.length) {
        const { data: people } = await supabase.from('profiles').select('id, name').in('id', ids);
        const byId = new Map((people ?? []).map((p: any) => [p.id, p.name]));
        rows.forEach((r) => { r.by_name = byId.get(r.submitted_by) || null; });
      }
      return rows;
    },
  });
}

export async function searchProducts(term: string) {
  let q = supabase.from('products').select('id, name, unit, category').eq('is_active', true).order('name').limit(25);
  if (term.trim()) q = q.ilike('name', `%${term.trim()}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function currentStock(hubId: string, productId: string) {
  const { data, error } = await supabase.from('inventory').select('quantity')
    .eq('hub_id', hubId).eq('product_id', productId).maybeSingle();
  if (error) throw error;
  return data ? Number(data.quantity) : 0;
}

function useInvMutation<T>(fn: (v: T) => Promise<any>, ok: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success(ok);
      ['inv-stock', 'inv-movements', 'inv-wastage'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e: any) => {
      console.error('[inventory]', e);
      toast.error(e?.message || 'Could not save');
    },
  });
}

export const useAdjustStock = () => useInvMutation(async (v: { hubId: string; productId: string; qty: number; reason: string }) => {
  const { data, error } = await supabase.rpc('inv_adjust_stock', { p_hub: v.hubId, p_product: v.productId, p_new_qty: v.qty, p_reason: v.reason });
  if (error) throw error;
  return data;
}, 'Stock count saved');

export const useSetMinLevel = () => useInvMutation(async (v: { hubId: string; productId: string; min: number | null }) => {
  const { error } = await supabase.rpc('inv_set_min_threshold', { p_hub: v.hubId, p_product: v.productId, p_min: v.min });
  if (error) throw error;
}, 'Minimum level saved');

export const useRecordWastage = () => useInvMutation(async (row: any) => {
  const { data, error } = await supabase.from('wastage_entries').insert(row).select('id, inventory_applied_qty, quantity_kg').single();
  if (error) throw error;
  return data;
}, 'Wastage recorded — stock updated');

export const useDeleteWastage = () => useInvMutation(async (id: string) => {
  const { error, count } = await supabase.from('wastage_entries').delete({ count: 'exact' }).eq('id', id);
  if (error) throw error;
  if (!count) throw new Error('Not deleted — you may not have permission for this warehouse');
}, 'Wastage entry deleted — stock returned');

export async function uploadWastagePhoto(file: File, hubId: string) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${hubId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { data, error } = await supabase.storage.from('wastage-photos').upload(path, file, { upsert: false });
  if (error) throw error;
  return supabase.storage.from('wastage-photos').getPublicUrl(data.path).data.publicUrl;
}
