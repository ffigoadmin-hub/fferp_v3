-- ============================================================
--  FIX — hub_id backfill, take 2: extract directly from
--  sales_orders.delivery_address (no join needed)
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  The first backfill only covered rows whose source `orders` row
--  still exists (joined on source_order_id). 11 rows were missed:
--  - 7 "website" orders whose source_order_id no longer matches any
--    row in `orders` (deleted/reset after sync)
--  - 4 "app" orders that have source_order_id = NULL entirely (never
--    linked to the `orders` table in the first place)
--  All 11 still have their delivery_address text copied onto the
--  sales_orders row itself from sync time — the pincode is sitting
--  right there, no join required.
-- ============================================================

UPDATE public.sales_orders
SET pincode = COALESCE(pincode, substring(delivery_address FROM '(\d{6})\D*$'))
WHERE pincode IS NULL AND delivery_address IS NOT NULL;

UPDATE public.sales_orders so
SET hub_id = COALESCE(
  (SELECT hp.hub_id FROM public.hub_pincodes hp WHERE hp.pincode = so.pincode LIMIT 1),
  (SELECT hp.hub_id FROM public.hub_pincodes hp WHERE LEFT(hp.pincode, 4) = LEFT(so.pincode, 4) LIMIT 1)
)
WHERE so.hub_id IS NULL AND so.pincode IS NOT NULL;

-- ── Verify ───────────────────────────────────────────────────
SELECT order_number, pincode, hub_id, source
FROM public.sales_orders
ORDER BY created_at DESC;
