// @ts-nocheck — hubs is missing from the stale generated types.ts
// Add / edit a warehouse (public.hubs). Writes are allowed by RLS for admin, ceo and
// ff_operations_manager (policy hubs_admin_write). Columns verified live 2026-09-24.
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export const WAREHOUSE_CHANNELS = ['FF', 'DMART', 'BLINKIT', 'ZEPTO'];

export interface WarehouseRow {
  id?: string; code: string; name: string; display_name?: string | null; city?: string | null; state?: string | null;
  address?: string | null; pincode?: string | null; manager_name?: string | null; channels?: string[] | null;
  capacity_kg?: number | null; is_active?: boolean | null;
}

const input = 'h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/40';

/** Next free code in the HUB-NN series used by the existing warehouses. */
export function nextWarehouseCode(codes: string[]) {
  const nums = codes.map((c) => parseInt((c || '').replace(/\D/g, ''), 10)).filter((n) => !isNaN(n));
  return `HUB-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(2, '0')}`;
}

export function WarehouseFormDialog({ initial, existingCodes, onClose, onSaved }:
  { initial: WarehouseRow; existingCodes: string[]; onClose: () => void; onSaved?: (row: any) => void }) {
  const qc = useQueryClient();
  const isEdit = !!initial.id;
  const [f, setF] = useState<WarehouseRow>({ channels: [], is_active: true, state: 'Tamil Nadu', ...initial });
  const set = (k: keyof WarehouseRow, v: any) => setF((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const code = f.code.trim().toUpperCase();
      if (!f.name.trim()) throw new Error('Enter the warehouse name');
      if (!code) throw new Error('Enter a warehouse code');
      if (!isEdit && existingCodes.map((c) => c.toUpperCase()).includes(code)) throw new Error(`Code ${code} is already used`);
      const row = {
        code, name: f.name.trim(), display_name: f.display_name?.trim() || null,
        city: f.city?.trim() || null, state: f.state?.trim() || null, address: f.address?.trim() || null,
        pincode: f.pincode?.trim() || null, manager_name: f.manager_name?.trim() || null,
        channels: f.channels ?? [], capacity_kg: f.capacity_kg ? Number(f.capacity_kg) : null,
        is_active: f.is_active !== false, status: f.is_active !== false ? 'active' : 'inactive',
      };
      const q = isEdit
        ? supabase.from('hubs').update(row).eq('id', f.id).select().single()
        : supabase.from('hubs').insert(row).select().single();
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    onSuccess: (row) => {
      toast.success(isEdit ? 'Warehouse updated' : `Warehouse ${row.code} added`);
      qc.invalidateQueries({ queryKey: ['admin-hubs'] });
      qc.invalidateQueries({ queryKey: ['inv-warehouses'] });
      onSaved?.(row);
      onClose();
    },
    onError: (e: any) => {
      console.error('[WarehouseForm] save failed:', e);
      toast.error(e?.message?.includes('row-level security') ? 'Only Admin, CEO or the Ops Manager can add or edit warehouses' : (e?.message || 'Could not save'));
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-xl space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{isEdit ? `Edit ${initial.name}` : 'Add a warehouse'}</h2>
            <p className="text-xs text-slate-500">{isEdit ? 'Changes apply everywhere this warehouse is used.' : 'It appears in every warehouse picker as soon as it is saved.'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <label className="text-xs font-medium text-gray-600 space-y-1">Code
            <input id="wh-code" className={input} value={f.code} onChange={(e) => set('code', e.target.value)} disabled={isEdit} required />
          </label>
          <label className="col-span-2 text-xs font-medium text-gray-600 space-y-1">Name
            <input id="wh-name" className={input} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Madhavaram Hub" required />
          </label>
          <label className="text-xs font-medium text-gray-600 space-y-1">City
            <input id="wh-city" className={input} value={f.city || ''} onChange={(e) => set('city', e.target.value)} />
          </label>
          <label className="text-xs font-medium text-gray-600 space-y-1">State
            <input id="wh-state" className={input} value={f.state || ''} onChange={(e) => set('state', e.target.value)} />
          </label>
          <label className="text-xs font-medium text-gray-600 space-y-1">Pincode
            <input id="wh-pincode" className={input} inputMode="numeric" value={f.pincode || ''} onChange={(e) => set('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))} />
          </label>
          <label className="col-span-3 text-xs font-medium text-gray-600 space-y-1">Address
            <input id="wh-address" className={input} value={f.address || ''} onChange={(e) => set('address', e.target.value)} />
          </label>
          <label className="col-span-2 text-xs font-medium text-gray-600 space-y-1">Warehouse manager
            <input id="wh-manager" className={input} value={f.manager_name || ''} onChange={(e) => set('manager_name', e.target.value)} />
          </label>
          <label className="text-xs font-medium text-gray-600 space-y-1">Capacity (kg)
            <input id="wh-capacity" className={input} inputMode="numeric" value={f.capacity_kg ?? ''} onChange={(e) => set('capacity_kg', e.target.value.replace(/[^\d.]/g, ''))} />
          </label>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-600 mb-1.5">Sales channels served</p>
          <div className="flex flex-wrap gap-2">
            {WAREHOUSE_CHANNELS.map((c) => {
              const on = (f.channels ?? []).includes(c);
              return (
                <button type="button" key={c} onClick={() => set('channels', on ? f.channels.filter((x) => x !== c) : [...(f.channels ?? []), c])}
                  className={cn('px-3 py-1.5 rounded-full text-xs font-semibold border', on ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-600 border-gray-200 hover:bg-gray-50')}>
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input id="wh-active" type="checkbox" checked={f.is_active !== false} onChange={(e) => set('is_active', e.target.checked)} />
          Active — can receive purchase orders, stock and orders
        </label>
        {!isEdit && (
          <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
            To route customer orders here automatically, add its pincodes to Hub Pincodes after saving. Staff need this warehouse set on their profile to see it.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={save.isPending} className="h-9 px-4 rounded-lg bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-50 inline-flex items-center gap-1.5">
            {save.isPending && <Loader2 className="w-4 h-4 animate-spin" />}{isEdit ? 'Save changes' : 'Add warehouse'}
          </button>
        </div>
      </form>
    </div>
  );
}
