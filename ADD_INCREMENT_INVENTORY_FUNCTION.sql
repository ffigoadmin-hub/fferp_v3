-- ADD_INCREMENT_INVENTORY_FUNCTION.sql
-- Run on: qwiumswrbddwmlraktvy -> Supabase SQL Editor. Additive, idempotent.
--
-- QCInspection.tsx has called supabase.rpc('increment_inventory', {...}) on every
-- completed QC check since this page was built, but the function was never actually
-- created live (confirmed via CHECK_QC_INVENTORY_WIRING.sql -- 0 rows in pg_proc).
-- Every QC completion with any accepted quantity has been failing with
-- "function increment_inventory does not exist" -- qc_inspections has 0 rows ever,
-- confirming this flow has never been successfully used once in production.

CREATE OR REPLACE FUNCTION public.increment_inventory(
  p_hub_id     uuid,
  p_product_id uuid,
  p_grade_a    numeric,
  p_grade_b    numeric,
  p_grade_c    numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total        numeric := COALESCE(p_grade_a, 0) + COALESCE(p_grade_b, 0) + COALESCE(p_grade_c, 0);
  v_product_name text;
  v_unit         text;
BEGIN
  SELECT name, unit INTO v_product_name, v_unit FROM public.products WHERE id = p_product_id;

  INSERT INTO public.inventory (hub_id, product_id, quantity, product_name, unit, updated_at)
  VALUES (p_hub_id, p_product_id, v_total, v_product_name, COALESCE(v_unit, 'kg'), now())
  ON CONFLICT (hub_id, product_id)
  DO UPDATE SET
    quantity   = public.inventory.quantity + v_total,
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_inventory(uuid, uuid, numeric, numeric, numeric) TO authenticated;

-- verify
SELECT proname, pg_get_function_identity_arguments(oid) AS args
FROM pg_proc WHERE proname = 'increment_inventory';
