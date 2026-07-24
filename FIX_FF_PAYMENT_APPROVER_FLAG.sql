-- ============================================================
--  FIX — let ff_payment_access flag holders approve FF payments
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  Anusiya (and anyone else granted ff_payment_access) can already
--  SUBMIT vendor/transport payments — is_ff_payment_submitter()
--  already checks has_ff_payment_access(). But is_ff_payment_approver()
--  never did, so the frontend "Approve" button I just added for her
--  would have been rejected at the database level.
--
--  This adds the same OR has_ff_payment_access() check to the
--  approver function, matching what is_ff_payment_submitter() already
--  does. This lets her act as an approver at the FF Ops stage
--  (alongside the real ff_operations_manager, not replacing them),
--  including approving her own submissions — both explicitly
--  requested. Note this mirrors the existing looseness already
--  present for every other approver role: the database's approve
--  check isn't itself stage-aware (any approver role can technically
--  update a payment at any stage via a direct API call) — the
--  frontend is what restricts each role to acting only on the stage
--  that's actually theirs to approve. Extending has_ff_payment_access()
--  into this function keeps her at that same pre-existing level of
--  trust, not a new or wider gap.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_ff_payment_approver()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.get_my_role() IN (
    'ff_operations_manager','gm','l1_manager','auditor','ceo','accounts','admin'
  ) OR public.has_ff_payment_access();
$function$;

-- ── Verify ───────────────────────────────────────────────────
SELECT pg_get_functiondef(oid) AS definition
FROM pg_proc
WHERE proname = 'is_ff_payment_approver' AND pronamespace = 'public'::regnamespace;
