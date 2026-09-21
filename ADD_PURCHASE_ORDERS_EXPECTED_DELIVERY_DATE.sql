-- ADD_PURCHASE_ORDERS_EXPECTED_DELIVERY_DATE.sql
-- Run on: qwiumswrbddwmlraktvy -> Supabase SQL Editor. Additive, idempotent.
--
-- purchaseStore.ts's poToPayload() has been writing purchase_orders.expected_delivery_date
-- (so VendorPerformance.tsx can compute on-time-delivery rate against actual_delivery_date)
-- but the column was never actually created live. Every savePOToStore() call that sets a
-- delivery date -- the manual "Create PO" dialog, the bulk PDF import, all of it -- has been
-- failing with:
--   Could not find the 'expected_delivery_date' column of 'purchase_orders' in the schema cache
--
-- BuyPage.tsx separately stamps purchase_orders.actual_delivery_date once every item on a PO
-- is fully bought (also missing live) -- but that update's error was never even checked, so
-- it has been failing completely silently. Both columns are needed by the same on-time-delivery
-- feature (VendorPerformance.tsx compares actual_delivery_date <= expected_delivery_date).
--
-- This adds both missing columns instead of removing the code that needs them.

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS expected_delivery_date date,
  ADD COLUMN IF NOT EXISTS actual_delivery_date date;

-- verify
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'purchase_orders'
  AND column_name IN ('expected_delivery_date', 'actual_delivery_date')
ORDER BY column_name;
