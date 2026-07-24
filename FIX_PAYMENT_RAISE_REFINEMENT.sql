-- ============================================================
--  FIX — Payment-raising refinement (maker-checker separation)
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  Requested change from management:
--   - Purchase Executives (shift_employee) go back to being able to
--     raise vendor AND transport payments for their hub (this reverts
--     the earlier restriction in FIX_REMOVE_SHIFT_EMPLOYEE_PAYMENT_SUBMIT.sql).
--   - Hub Managers keep raising POs/vendor/transport payments as before.
--   - Ops Manager (ff_operations_manager) and Anusiya/Arun
--     (has_ff_payment_access() flag) move to APPROVE-ONLY — they can
--     no longer raise a new vendor/transport payment themselves, only
--     review and approve what Purchase/Hub raise. This is a maker-
--     checker separation-of-duties change requested explicitly.
--
--  is_ff_payment_approver() is NOT touched by this file — Ops Manager
--  and the flag holders keep their existing approve ability there.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_ff_payment_submitter()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.get_my_role() IN (
    'hub_manager','shift_employee','purchase_manager','purchase_head','admin'
  );
$function$;

-- ── Verify ───────────────────────────────────────────────────
SELECT pg_get_functiondef(oid) AS definition
FROM pg_proc
WHERE proname = 'is_ff_payment_submitter' AND pronamespace = 'public'::regnamespace;

-- Confirm the approver function is untouched (should still list
-- ff_operations_manager and OR has_ff_payment_access()):
SELECT pg_get_functiondef(oid) AS definition
FROM pg_proc
WHERE proname = 'is_ff_payment_approver' AND pronamespace = 'public'::regnamespace;
