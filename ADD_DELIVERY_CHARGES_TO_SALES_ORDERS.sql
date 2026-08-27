-- Add delivery_charges to sales_orders so it can be set at order-creation
-- time (NewOrder.tsx), not just later on the invoice (SalesInvoicesPage.tsx
-- keeps its own editable delivery_charges on the invoices table, unchanged —
-- this is a separate column on a separate table, pre-filled from this one
-- when the invoice is auto-created).
ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS delivery_charges numeric(12,2) DEFAULT 0;

-- ── Verify the column landed ────────────────────────────────
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'sales_orders' AND column_name = 'delivery_charges';

-- ── Diagnostic: does sales_orders.net_amount include total_amount? ──
-- Many pages read `net_amount ?? total_amount`, preferring net_amount when
-- it's set. If net_amount is a GENERATED column derived only from subtotal
-- (not total_amount), it would silently exclude delivery_charges from
-- anywhere that reads net_amount first. Worth confirming once.
SELECT column_name, is_generated, generation_expression
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'sales_orders' AND column_name = 'net_amount';
