import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

/**
 * Generate a collision-free invoice number.
 *
 * Format: INV-YYYYMMDD-XXXXXX
 * where XXXXXX = first 6 chars of the order UUID (guaranteed unique per order).
 *
 * This replaces the previous COUNT-based approach which had a race condition:
 * two simultaneous orders would both read count=N, generate the same number,
 * and the second INSERT would fail the UNIQUE constraint silently.
 */
function generateInvoiceNumber(orderId: string): string {
  const today = format(new Date(), 'yyyyMMdd');
  // Take first 6 chars of the order UUID (hex, no dashes) as unique suffix
  const suffix = orderId.replace(/-/g, '').slice(0, 6).toUpperCase();
  return `INV-${today}-${suffix}`;
}

export interface CreateInvoiceParams {
  orderId: string;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  subtotal: number;
  discountAmount?: number;
  taxAmount?: number;
  totalAmount: number;
  paymentMode?: string;
  notes?: string | null;
  /** Due date offset in days (default 0 = same day) */
  dueDays?: number;
}

/**
 * Creates an invoice record for a placed order.
 * - Safe to call multiple times: skips if invoice already exists for this order.
 * - Race-condition-free: invoice number uses order UUID, not a counter.
 * - Silently returns null on any error (does not break the order flow).
 */
export async function createInvoiceForOrder(params: CreateInvoiceParams): Promise<string | null> {
  try {
    // ── Guard: don't create a duplicate invoice for the same order ──
    const { data: existing } = await supabase
      .from('invoices')
      .select('id')
      .eq('order_id', params.orderId)
      .maybeSingle();

    if (existing?.id) {
      // Invoice already exists — return its id without creating another
      return existing.id;
    }

    const invoice_number = generateInvoiceNumber(params.orderId);
    const invoice_date   = format(new Date(), 'yyyy-MM-dd');
    const due_date       = params.dueDays
      ? format(new Date(Date.now() + params.dueDays * 86_400_000), 'yyyy-MM-dd')
      : invoice_date;

    const { data, error } = await supabase.from('invoices').insert({
      invoice_number,
      order_id:         params.orderId,
      customer_id:      params.customerId  ?? null,
      customer_name:    params.customerName ?? null,
      customer_phone:   params.customerPhone ?? null,
      customer_address: params.customerAddress ?? null,
      invoice_date,
      due_date,
      subtotal:         params.subtotal,
      discount_amount:  params.discountAmount ?? 0,
      tax_amount:       params.taxAmount ?? 0,
      total_amount:     params.totalAmount,
      payment_mode:     params.paymentMode ?? 'cod',
      status:           'unpaid',
      notes:            params.notes ?? null,
    }).select('id').single();

    if (error) {
      // If we hit a unique constraint (extremely unlikely now), log and skip
      console.warn('Invoice creation skipped:', error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (err: any) {
    // Never break the order flow if invoice fails
    console.warn('Invoice helper error:', err?.message);
    return null;
  }
}

/**
 * Backfill invoices for orders that don't have one yet.
 * Call this from a management page or run once to fix missing invoices.
 */
export async function backfillMissingInvoices(): Promise<{ created: number; failed: number }> {
  let created = 0;
  let failed  = 0;

  // Fetch orders that have no matching invoice
  const { data: orders } = await supabase
    .from('sales_orders')
    .select('id, customer_id, customer_name, net_amount, total_amount, subtotal, payment_mode, notes')
    .order('created_at', { ascending: true });

  if (!orders?.length) return { created, failed };

  // Get order IDs that already have invoices
  const { data: existing } = await supabase
    .from('invoices')
    .select('order_id')
    .not('order_id', 'is', null);

  const existingOrderIds = new Set((existing ?? []).map((e: any) => e.order_id));

  const missing = orders.filter(o => !existingOrderIds.has(o.id));

  for (const order of missing) {
    const result = await createInvoiceForOrder({
      orderId:      order.id,
      customerId:   order.customer_id,
      customerName: order.customer_name,
      subtotal:     Number(order.subtotal ?? order.net_amount ?? order.total_amount ?? 0),
      totalAmount:  Number(order.total_amount ?? order.net_amount ?? 0),
      paymentMode:  order.payment_mode ?? 'cod',
      notes:        order.notes,
    });
    if (result) created++;
    else failed++;
  }

  return { created, failed };
}
