-- ============================================================
--  Vendor Bulk Payment — combine several days' worth of one
--  vendor's purchase orders into ONE ff_vendor_payments row
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  Today, "Raise & Approve" on the Purchase Report raises one
--  ff_vendor_payments row per PO (purchase_order_id, singular).
--  For a vendor supplying the same hub every day, that means one
--  bank-payable line per day instead of one per vendor. This adds
--  the ability to raise ONE payment covering several days' POs
--  for the same vendor+hub, selected by a date range on the new
--  Vendor Bulk Payment page — while leaving every existing
--  single-PO payment, and every existing reader of
--  purchase_order_id, completely unchanged.
--
--  Additive only, nothing existing is altered or removed:
--   - purchase_order_id (existing column) is left NULL on new
--     multi-PO bulk rows; every current single-PO payment and
--     every place that reads this column keeps working exactly
--     as before. A bulk payment covering exactly one PO still
--     populates this column too, for backward compatibility with
--     any reader that hasn't been updated to check
--     purchase_order_ids yet.
--   - purchase_order_ids: the full set of POs a bulk payment
--     covers.
--   - po_breakdown: one entry per covered PO (number, date, item
--     count, subtotal) so approvers see the day-by-day makeup
--     without an extra join back to purchase_orders.
--   - is_bulk: explicit flag rather than inferring bulk-ness from
--     array nullability.
--
--  Same shape added to ff_transport_payments too, even though the
--  Vendor Bulk Payment page only writes ff_vendor_payments today
--  (transport bulk-raising is out of scope for this pass) — so
--  the two payment tables' schemas don't drift apart the way
--  several status/column additions have in the past.
-- ============================================================

ALTER TABLE public.ff_vendor_payments
  ADD COLUMN IF NOT EXISTS is_bulk boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS purchase_order_ids uuid[],
  ADD COLUMN IF NOT EXISTS po_breakdown jsonb;

ALTER TABLE public.ff_transport_payments
  ADD COLUMN IF NOT EXISTS is_bulk boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS purchase_order_ids uuid[],
  ADD COLUMN IF NOT EXISTS po_breakdown jsonb;

-- GIN index so "which payment covers PO X" (purchase_order_ids @> ARRAY[x])
-- stays fast as the table grows — the same lookup PurchaseReportPage.tsx's
-- Approval column and the bulk-delete guard both need.
CREATE INDEX IF NOT EXISTS idx_ff_vendor_payments_po_ids_gin
  ON public.ff_vendor_payments USING gin (purchase_order_ids);

-- ── Verify ───────────────────────────────────────────────────
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('ff_vendor_payments', 'ff_transport_payments')
  AND column_name IN ('is_bulk', 'purchase_order_ids', 'po_breakdown')
ORDER BY table_name, column_name;
