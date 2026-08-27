-- Order-level manual discount, entered on New Order (in addition to the
-- existing per-item Disc % already on each cart row). Docs schema lists
-- sales_orders.discount as already existing — this ALTER is a safe no-op
-- if so, and the real fix if the live table drifted from that.
ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS discount numeric(12,2) DEFAULT 0;

-- ── Verify ───────────────────────────────────────────────────
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'sales_orders' AND column_name = 'discount';
