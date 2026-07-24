-- ============================================================
--  RLS FIX — BATCH 1: vendor_payments, payment_approvals
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  Context: FIX_RLS_ALL_ROLES.sql previously DISABLED RLS on these
--  tables entirely (comment: "Access is controlled by Supabase Auth
--  (login required)"). That is not equivalent security — with RLS
--  off, ANY authenticated user (any role) can read/write ALL rows
--  via a direct API call, bypassing the app's UI-level role checks.
--
--  This migration re-enables RLS using the is_staff()/get_my_role()
--  SECURITY DEFINER functions already defined in FIX_RLS_ALL_ROLES.sql
--  (built specifically to avoid the RLS-recursion bug that caused RLS
--  to be disabled in the first place).
--
--  Policy scope mirrors the app's own access model exactly:
--  both /purchase/vendor-payments and /purchase/payment-approvals
--  routes are gated by OPS_ROLES in src/App.tsx, with no per-user or
--  per-hub filtering in the queries themselves — so the policy below
--  is role-gated only, matching current real-world behavior 1:1.
--  This should not change what any legitimate user can already do.
-- ============================================================

-- Reusable helper — avoids repeating the 20-role OPS_ROLES list per policy.
-- Mirrors OPS_ROLES in src/App.tsx exactly (keep these in sync if that list changes).
CREATE OR REPLACE FUNCTION public.is_ops_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT public.get_my_role() IN (
    'ceo','director','Director','gm','gmo','smo','boi','nsm','admin',
    'hr','accounts','back_office',
    'purchase_manager','purchase_head','warehouse_manager','qc_manager',
    'field_executive','tele_caller','bde',
    'ff_operations_manager',
    'hub_manager','l1_manager','shift_employee'
  );
$$;

-- ── vendor_payments ─────────────────────────────────────────
ALTER TABLE public.vendor_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_payments_ops_access ON public.vendor_payments;
CREATE POLICY vendor_payments_ops_access ON public.vendor_payments
  FOR ALL
  USING (public.is_ops_staff())
  WITH CHECK (public.is_ops_staff());

-- ── payment_approvals ───────────────────────────────────────
-- Note: confirmed unused by the frontend today (no queries found anywhere
-- in src/), so this cannot break any current feature. Policy still applied
-- correctly since it matches the table's evident purpose (payment approval
-- audit trail, payment_type IN ('vendor','porter','transit')).
ALTER TABLE public.payment_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_approvals_ops_access ON public.payment_approvals;
CREATE POLICY payment_approvals_ops_access ON public.payment_approvals
  FOR ALL
  USING (public.is_ops_staff())
  WITH CHECK (public.is_ops_staff());

-- ── Verify ───────────────────────────────────────────────────
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('vendor_payments', 'payment_approvals');
