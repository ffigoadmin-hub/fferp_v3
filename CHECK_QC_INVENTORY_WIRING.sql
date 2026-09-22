-- CHECK_QC_INVENTORY_WIRING.sql — Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor. Read-only.
-- Purpose: QCInspection.tsx calls supabase.rpc('increment_inventory', {...}) on every completed
-- QC check, but no migration file in the repo defines that function. Confirm whether it exists
-- live, and whether QC has ever actually been used in production.

-- 1. Does increment_inventory exist, and what's its real signature/definition?
SELECT proname, pg_get_function_identity_arguments(oid) AS args, prosrc
FROM pg_proc
WHERE proname = 'increment_inventory';

-- 2. Does next_grn_number exist? (also called by QCInspection.tsx)
SELECT proname, pg_get_function_identity_arguments(oid) AS args
FROM pg_proc
WHERE proname = 'next_grn_number';

-- 3. Has QC Inspection ever actually been used?
SELECT count(*) AS total_inspections, min(created_at) AS earliest, max(created_at) AS latest
FROM qc_inspections;

-- 4. Inventory table: does it have a unique constraint on (hub_id, product_id)? An upsert-based
-- increment function needs one.
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.inventory'::regclass;

-- 5. Full inventory column list, in case an increment function needs to be written from scratch
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'inventory'
ORDER BY ordinal_position;
