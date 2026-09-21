-- CHECK_PO_INSERT_FAILURE.sql — Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor. Read-only.
-- Purpose: both the manual "Create PO" dialog and the bulk PDF import are failing on
-- every single row with a generic "Save failed" — find the systemic cause of the
-- purchase_orders upsert() itself failing (not row-specific data).

-- 1. Does purchase_orders actually have a UNIQUE constraint on po_number?
-- (the app code does .upsert(payload, { onConflict: 'po_number' }) — if this
-- constraint doesn't exist live, EVERY upsert fails with the same Postgres error
-- regardless of row content.)
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.purchase_orders'::regclass
ORDER BY 1;

-- 2. Full column list with NOT NULL / defaults (catches a required column the
-- app never sends, e.g. order_date)
SELECT column_name, data_type, is_nullable, column_default, is_generated
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'purchase_orders'
ORDER BY ordinal_position;

-- 3. RLS policies covering INSERT on purchase_orders
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'purchase_orders'
ORDER BY cmd, policyname;

-- 4. Is RLS even enabled, and with at least one policy? (enabled + zero policies
-- means every insert is silently denied)
SELECT relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE oid = 'public.purchase_orders'::regclass;

-- 5. Same three checks for purchase_order_items, since savePOToStore() also
-- inserts there right after the purchase_orders row
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.purchase_order_items'::regclass
ORDER BY 1;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'purchase_order_items'
ORDER BY ordinal_position;

SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'purchase_order_items'
ORDER BY cmd, policyname;
