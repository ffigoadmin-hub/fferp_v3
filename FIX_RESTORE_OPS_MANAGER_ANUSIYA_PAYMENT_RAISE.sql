-- ============================================================
--  FIX — reverse the maker-checker restriction from
--  FIX_PAYMENT_RAISE_REFINEMENT.sql
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  Requested change: Ops Manager (ff_operations_manager) and
--  Anusiya/Arun (has_ff_payment_access() flag) go back to being able
--  to raise vendor/transport payments themselves, not just approve.
--  hub_manager / shift_employee / purchase_manager / purchase_head
--  keep raising as before — this only adds the two groups back.
--
--  is_ff_payment_approver() is untouched — it already includes both
--  ff_operations_manager and has_ff_payment_access().
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_ff_payment_submitter()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.get_my_role() IN (
    'hub_manager','shift_employee','purchase_manager','purchase_head','ff_operations_manager','admin'
  ) OR public.has_ff_payment_access();
$function$;

-- ── Verify ───────────────────────────────────────────────────
SELECT pg_get_functiondef(oid) AS definition
FROM pg_proc
WHERE proname = 'is_ff_payment_submitter' AND pronamespace = 'public'::regnamespace;
