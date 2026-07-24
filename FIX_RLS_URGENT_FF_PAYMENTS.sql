-- ============================================================
--  RLS FIX — URGENT: ff_vendor_payments, ff_transport_payments
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  These two tables were NOT in the original 208-table "no RLS"
--  audit (rowsecurity = FALSE) because RLS IS technically enabled —
--  but the only policy attached is the Lovable-scaffolded
--  "authenticated_full_*" blanket (any logged-in user, full access),
--  same pattern found across ~100+ other tables. This directly
--  affects the ff_payment_access feature built earlier today for
--  Anusiya/Arun — right now ANY authenticated account of ANY role
--  can read/write every vendor/transport payment via direct API,
--  bypassing both that flag and every route guard.
--
--  Access model (verified via code — FFPaymentApprovals.tsx,
--  MySubmittedPayments.tsx, FFVendorPaymentForm.tsx, App.tsx routes):
--  - Submit (INSERT): hub_manager, purchase_manager, purchase_head,
--    shift_employee, ff_operations_manager, admin (matches
--    /ff/vendor-payment/new and /ff/transport-payment/new route
--    guards) OR anyone with the ff_payment_access flag.
--  - Approve/view-all (the FF Ops → GM → L1 → Auditor → CEO →
--    Accounts chain): ff_operations_manager, gm, l1_manager, auditor,
--    ceo, accounts, admin (union of every FFPaymentApprovals mount
--    point's allowedRoles in App.tsx).
--  - Own submissions (SELECT only, /my-submitted-payments): anyone,
--    scoped to created_by = auth.uid() — this covers ff_payment_access
--    holders automatically without needing a separate check, since
--    their own rows already match on created_by.
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_ff_payment_access()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT COALESCE((SELECT ff_payment_access FROM public.profiles WHERE id = auth.uid()), false);
$$;

CREATE OR REPLACE FUNCTION public.is_ff_payment_submitter()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT public.get_my_role() IN (
    'hub_manager','purchase_manager','purchase_head','shift_employee','ff_operations_manager','admin'
  ) OR public.has_ff_payment_access();
$$;

CREATE OR REPLACE FUNCTION public.is_ff_payment_approver()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT public.get_my_role() IN (
    'ff_operations_manager','gm','l1_manager','auditor','ceo','accounts','admin'
  );
$$;

-- ── ff_vendor_payments ───────────────────────────────────────
DROP POLICY IF EXISTS authenticated_full_ff_vendor_payments ON public.ff_vendor_payments;

ALTER TABLE public.ff_vendor_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ff_vendor_payments_select ON public.ff_vendor_payments;
CREATE POLICY ff_vendor_payments_select ON public.ff_vendor_payments
  FOR SELECT USING (
    public.is_ff_payment_approver() OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS ff_vendor_payments_insert ON public.ff_vendor_payments;
CREATE POLICY ff_vendor_payments_insert ON public.ff_vendor_payments
  FOR INSERT WITH CHECK (public.is_ff_payment_submitter());

DROP POLICY IF EXISTS ff_vendor_payments_update ON public.ff_vendor_payments;
CREATE POLICY ff_vendor_payments_update ON public.ff_vendor_payments
  FOR UPDATE USING (public.is_ff_payment_approver()) WITH CHECK (public.is_ff_payment_approver());

DROP POLICY IF EXISTS ff_vendor_payments_delete ON public.ff_vendor_payments;
CREATE POLICY ff_vendor_payments_delete ON public.ff_vendor_payments
  FOR DELETE USING (public.get_my_role() = 'admin');

-- ── ff_transport_payments ────────────────────────────────────
DROP POLICY IF EXISTS authenticated_full_ff_transport_payments ON public.ff_transport_payments;

ALTER TABLE public.ff_transport_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ff_transport_payments_select ON public.ff_transport_payments;
CREATE POLICY ff_transport_payments_select ON public.ff_transport_payments
  FOR SELECT USING (
    public.is_ff_payment_approver() OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS ff_transport_payments_insert ON public.ff_transport_payments;
CREATE POLICY ff_transport_payments_insert ON public.ff_transport_payments
  FOR INSERT WITH CHECK (public.is_ff_payment_submitter());

DROP POLICY IF EXISTS ff_transport_payments_update ON public.ff_transport_payments;
CREATE POLICY ff_transport_payments_update ON public.ff_transport_payments
  FOR UPDATE USING (public.is_ff_payment_approver()) WITH CHECK (public.is_ff_payment_approver());

DROP POLICY IF EXISTS ff_transport_payments_delete ON public.ff_transport_payments;
CREATE POLICY ff_transport_payments_delete ON public.ff_transport_payments
  FOR DELETE USING (public.get_my_role() = 'admin');

-- ── Verify ───────────────────────────────────────────────────
SELECT tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('ff_vendor_payments', 'ff_transport_payments')
ORDER BY tablename, policyname;
