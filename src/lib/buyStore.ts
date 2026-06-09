// ─────────────────────────────────────────────────────────────
//  Buy Orders store — Supabase only (no localStorage)
//  Writes to `po_bills` table; vendor entries stored as JSONB
// ─────────────────────────────────────────────────────────────

import { supabase } from '@/integrations/supabase/client';

export interface BuyVendorEntry {
  id: string;
  type: 'static' | 'dynamic';
  vendorName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  itemName: string;
  buyQty: number;
  price: number;
  hasItemImage: boolean;
  hasWeightScaleImage: boolean;
  itemImageUrl?: string;
  weightScaleImageUrl?: string;
}

export interface BuyOrder {
  id: string;
  product: string;
  requiredQty: number;
  unit: string;
  date: string;
  vendors: BuyVendorEntry[];
  billCreated: boolean;
  po_id?: string;
  hub_id?: string;
}

// ── DB row → BuyOrder ─────────────────────────────────────────
function rowToBuyOrder(row: any): BuyOrder {
  return {
    id:          row.id,
    product:     row.product_name ?? '',
    requiredQty: Number(row.required_qty ?? 0),
    unit:        row.unit ?? 'kg',
    date:        row.bill_date ?? row.created_at?.split('T')[0] ?? '',
    vendors:     Array.isArray(row.vendor_entries) ? row.vendor_entries : [],
    billCreated: row.status === 'billed' || row.status === 'paid',
    po_id:       row.po_id ?? undefined,
    hub_id:      row.hub_id ?? undefined,
  };
}

// ── Async read helpers ────────────────────────────────────────

export async function fetchBuyOrders(hubId?: string): Promise<BuyOrder[]> {
  let q = supabase
    .from('po_bills')
    .select('*')
    .order('created_at', { ascending: false });
  if (hubId) q = q.eq('hub_id', hubId);
  const { data, error } = await q;
  if (error) { console.error('[buyStore] fetchBuyOrders:', error.message); return []; }
  return (data ?? []).map(rowToBuyOrder);
}

export async function fetchBuyOrderByProduct(product: string, hubId?: string): Promise<BuyOrder | null> {
  let q = supabase
    .from('po_bills')
    .select('*')
    .eq('product_name', product)
    .order('created_at', { ascending: false })
    .limit(1);
  if (hubId) q = q.eq('hub_id', hubId);
  const { data, error } = await q;
  if (error) { console.error('[buyStore] fetchBuyOrderByProduct:', error.message); return null; }
  return data?.[0] ? rowToBuyOrder(data[0]) : null;
}

export async function fetchBoughtQty(product: string, hubId?: string): Promise<number> {
  const order = await fetchBuyOrderByProduct(product, hubId);
  if (!order) return 0;
  return order.vendors.reduce((s, v) => s + v.buyQty, 0);
}

// ── Sync write helpers ────────────────────────────────────────

export async function saveBuyOrder(order: BuyOrder): Promise<string | null> {
  const totalAmount = order.vendors.reduce((s, v) => s + v.buyQty * v.price, 0);
  const payload: Record<string, any> = {
    product_name:   order.product,
    required_qty:   order.requiredQty,
    unit:           order.unit,
    bill_date:      order.date,
    vendor_entries: order.vendors,
    status:         order.billCreated ? 'billed' : 'draft',
    total_amount:   totalAmount,
  };
  if (order.po_id)  payload.po_id  = order.po_id;
  if (order.hub_id) payload.hub_id = order.hub_id;

  if (order.id && !order.id.startsWith('new-')) {
    // update existing
    const { error } = await supabase
      .from('po_bills')
      .update(payload)
      .eq('id', order.id);
    if (error) { console.error('[buyStore] saveBuyOrder update:', error.message); return null; }
    return order.id;
  }

  // insert new
  const { data, error } = await supabase
    .from('po_bills')
    .insert(payload)
    .select('id')
    .single();
  if (error) { console.error('[buyStore] saveBuyOrder insert:', error.message); return null; }
  return data?.id ?? null;
}

export async function markBuyOrderBillCreated(id: string): Promise<void> {
  const { error } = await supabase
    .from('po_bills')
    .update({ status: 'billed' })
    .eq('id', id);
  if (error) console.error('[buyStore] markBuyOrderBillCreated:', error.message);
}

// ── Legacy sync shims ─────────────────────────────────────────
/** @deprecated use fetchBuyOrders() in useQuery instead */
export function getBuyOrders(): BuyOrder[] {
  console.warn('[buyStore] getBuyOrders() is deprecated — use fetchBuyOrders() in useQuery');
  return [];
}
/** @deprecated use fetchBuyOrderByProduct() in useQuery instead */
export function getBuyOrderByProduct(_product: string): BuyOrder | null {
  console.warn('[buyStore] getBuyOrderByProduct() is deprecated — use fetchBuyOrderByProduct()');
  return null;
}
/** @deprecated use fetchBoughtQty() instead */
export function getBoughtQty(_product: string): number {
  console.warn('[buyStore] getBoughtQty() is deprecated — use fetchBoughtQty()');
  return 0;
}
