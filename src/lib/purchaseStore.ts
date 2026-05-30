// ─────────────────────────────────────────────────────────────
//  Shared Purchase-Order store — Supabase only (no localStorage)
// ─────────────────────────────────────────────────────────────

import { supabase } from '@/integrations/supabase/client';

export interface StoredPOItem {
  id: number;
  itemName: string;
  account: string;
  quantity: number;
  rate: number;
  tax: string;
  discount: number;
  customerDetails: string;
}

export interface StoredPO {
  id: string;
  poNumber: string;
  vendorName: string;
  date: string;
  deliveryDate: string;
  paymentTerms: string;
  status: 'draft' | 'pending_approval' | 'open' | 'rejected' | 'billed' | 'cancelled';
  rejectionReason?: string;
  approvedBy?: string;
  approvedAt?: string;
  items: StoredPOItem[];
  subTotal: number;
  total: number;
  notes: string;
  hub_id?: string;
  hub_name?: string;
  vendor_id?: string;
}

// ── DB row → StoredPO ─────────────────────────────────────────
function rowToPO(row: any): StoredPO {
  return {
    id:           row.id,
    poNumber:     row.po_number,
    vendorName:   row.vendor_name ?? '',
    date:         row.created_at?.split('T')[0] ?? '',
    deliveryDate: row.delivery_date ?? '',
    paymentTerms: row.payment_terms ?? 'Due on Receipt',
    status:       row.status === 'approved' ? 'open' : (row.status ?? 'draft'),
    rejectionReason: row.rejection_reason ?? undefined,
    approvedBy:   row.approved_by ?? undefined,
    approvedAt:   row.approved_at ?? undefined,
    items:        Array.isArray(row.items) ? row.items : [],
    subTotal:     Number(row.sub_total ?? 0),
    total:        Number(row.total_amount ?? 0),
    notes:        row.notes ?? '',
    hub_id:       row.hub_id ?? undefined,
    hub_name:     row.hub_name ?? undefined,
    vendor_id:    row.vendor_id ?? undefined,
  };
}

// ── StoredPO → DB payload ─────────────────────────────────────
function poToPayload(po: StoredPO): Record<string, any> {
  const payload: Record<string, any> = {
    po_number:     po.poNumber,
    status:        po.status === 'open' ? 'approved' : po.status,
    sub_total:     po.subTotal,
    total_amount:  po.total,
    notes:         po.notes || null,
    items:         po.items,
    vendor_name:   po.vendorName || null,
    delivery_date: po.deliveryDate || null,
    payment_terms: po.paymentTerms || null,
  };
  if (po.hub_id)    payload.hub_id    = po.hub_id;
  if (po.hub_name)  payload.hub_name  = po.hub_name;
  if (po.vendor_id) payload.vendor_id = po.vendor_id;
  return payload;
}

// ── Async read helpers (used by pages via useQuery) ───────────

export async function fetchAllPOs(): Promise<StoredPO[]> {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('[purchaseStore] fetchAllPOs:', error.message); return []; }
  return (data ?? []).map(rowToPO);
}

export async function fetchOpenPOs(): Promise<StoredPO[]> {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: false });
  if (error) { console.error('[purchaseStore] fetchOpenPOs:', error.message); return []; }
  return (data ?? []).map(rowToPO);
}

export async function fetchPendingApprovalPOs(): Promise<StoredPO[]> {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*')
    .eq('status', 'pending_approval')
    .order('created_at', { ascending: false });
  if (error) { console.error('[purchaseStore] fetchPendingApprovalPOs:', error.message); return []; }
  return (data ?? []).map(rowToPO);
}

export async function fetchMaxPOSerial(): Promise<number> {
  const { data } = await supabase
    .from('purchase_orders')
    .select('po_number')
    .order('created_at', { ascending: false })
    .limit(100);
  if (!data) return 0;
  return data.reduce((max: number, row: any) => {
    const n = parseInt((row.po_number ?? '').replace('PO-', ''), 10) || 0;
    return Math.max(max, n);
  }, 0);
}

// ── Sync write helpers ────────────────────────────────────────

export async function savePOToStore(po: StoredPO): Promise<string | null> {
  const { data, error } = await supabase
    .from('purchase_orders')
    .upsert(poToPayload(po), { onConflict: 'po_number' })
    .select('id')
    .single();
  if (error) { console.error('[purchaseStore] savePOToStore:', error.message); return null; }
  return data?.id ?? null;
}

export async function markPOBilled(poNumber: string): Promise<void> {
  const { error } = await supabase
    .from('purchase_orders')
    .update({ status: 'billed' })
    .eq('po_number', poNumber);
  if (error) console.error('[purchaseStore] markPOBilled:', error.message);
}

export async function deletePOFromStore(poNumber: string): Promise<void> {
  const { error } = await supabase
    .from('purchase_orders')
    .update({ status: 'cancelled' })
    .eq('po_number', poNumber);
  if (error) console.error('[purchaseStore] deletePOFromStore:', error.message);
}

// ── Auto-generate POs from sales order aggregates ────────────

export async function createPOsFromSalesOrders(
  items: Array<{ productName: string; totalQty: number; unit: string; avgPrice: number; totalValue: number }>,
  hubId?: string,
  hubName?: string,
): Promise<StoredPO[]> {
  const serial = await fetchMaxPOSerial();
  const today  = new Date().toISOString().split('T')[0];
  const created: StoredPO[] = [];

  for (let i = 0; i < items.length; i++) {
    const item    = items[i];
    const poNumber = `PO-${String(serial + i + 1).padStart(5, '0')}`;
    const subTotal = Math.round(item.totalQty * item.avgPrice);
    const total    = Math.round(subTotal * 1.05);

    const po: StoredPO = {
      id:           '',   // filled after DB insert
      poNumber,
      vendorName:   '',
      date:         today,
      deliveryDate: '',
      paymentTerms: 'Due on Receipt',
      status:       'pending_approval',
      items: [{
        id: 1,
        itemName:        item.productName,
        account:         'Cost of Goods Sold',
        quantity:        item.totalQty,
        rate:            item.avgPrice,
        tax:             'GST 5%',
        discount:        0,
        customerDetails: '',
      }],
      subTotal,
      total,
      notes:    `Auto-generated from sales orders | Avg rate ₹${item.avgPrice}/${item.unit}`,
      hub_id:   hubId,
      hub_name: hubName,
    };

    const dbId = await savePOToStore(po);
    if (dbId) po.id = dbId;
    created.push(po);
  }

  return created;
}

// ── Legacy sync shims (for pages that haven't been updated yet) ─
// These keep the old synchronous call shape working by logging a warning.
/** @deprecated use fetchAllPOs() inside useQuery instead */
export function getStoredPOs(): StoredPO[] {
  console.warn('[purchaseStore] getStoredPOs() is deprecated — use fetchAllPOs() in useQuery');
  return [];
}
/** @deprecated use fetchOpenPOs() inside useQuery instead */
export function getOpenPOs(): StoredPO[] {
  console.warn('[purchaseStore] getOpenPOs() is deprecated — use fetchOpenPOs() in useQuery');
  return [];
}
/** @deprecated use fetchPendingApprovalPOs() inside useQuery instead */
export function getPendingApprovalPOs(): StoredPO[] {
  console.warn('[purchaseStore] getPendingApprovalPOs() is deprecated — use fetchPendingApprovalPOs() in useQuery');
  return [];
}
/** @deprecated use fetchMaxPOSerial() instead */
export function getMaxPOSerial(): number {
  console.warn('[purchaseStore] getMaxPOSerial() is deprecated — use fetchMaxPOSerial()');
  return 0;
}
/** @deprecated use savePOToStore() (now async) */
export function syncPOToSupabase(po: StoredPO): Promise<string | null> {
  return savePOToStore(po);
}
