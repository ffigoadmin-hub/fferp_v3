-- ============================================================
--  FIX — Purchase Executives (shift_employee) no longer raise
--  vendor/transport payments; their job is to purchase and
--  load/unload stock at the hub only.
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  The frontend button/route for "New FF Vendor Payment" and
--  "My Submitted Payments" has already been removed for
--  shift_employee. This closes the matching database gap —
--  is_ff_payment_submitter() still listed shift_employee as an
--  authorized submitter, meaning a direct API call could still
--  raise a payment even with the button gone. Removing it from
--  the role list here so the database itself enforces the rule,
--  not just the UI.
--
--  purchase_manager and purchase_head are untouched — they still
--  raise payments as before. has_ff_payment_access() flag holders
--  (Anusiya, Arun) are also untouched — unaffected by this change.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_ff_payment_submitter()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.get_my_role() IN (
    'hub_manager','purchase_manager','purchase_head','ff_operations_manager','admin'
  ) OR public.has_ff_payment_access();
$function$;

-- ── Verify ───────────────────────────────────────────────────
SELECT pg_get_functiondef(oid) AS definition
FROM pg_proc
WHERE proname = 'is_ff_payment_submitter' AND pronamespace = 'public'::regnamespace;
