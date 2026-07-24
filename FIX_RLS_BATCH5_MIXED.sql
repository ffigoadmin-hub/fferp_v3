-- ============================================================
--  RLS FIX — BATCH 5: notifications, deduction_memos,
--  payment_deduction_lines, banners/coupons/farm_stories/
--  farm_streams, orders/order_items
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
-- ============================================================

-- ── Ensure RLS is actually enabled on all of these first — dropping
--    a policy on a table where RLS is off has zero effect.
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deduction_memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_deduction_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- ── notifications — used heavily in FFERP (13 files). Real fix:
--    own-row read/update, staff-only insert (staff routinely create
--    notifications targeting OTHER users — e.g. task assignment —
--    so INSERT can't be "own row only", but should require at least
--    being a logged-in staff member, not literally anonymous).
DROP POLICY IF EXISTS "Allow notification inserts" ON public.notifications;
DROP POLICY IF EXISTS "System inserts notifications" ON public.notifications;
DROP POLICY IF EXISTS anon_insert_notifications ON public.notifications;
DROP POLICY IF EXISTS anon_select_notifications ON public.notifications;
DROP POLICY IF EXISTS anon_update_notifications ON public.notifications;

DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_update ON public.notifications;
CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_insert ON public.notifications;
CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT WITH CHECK (public.is_staff());

-- ── deduction_memos — only reached via QCRejections.tsx
--    (/warehouse/qc-rejections). DeductionMemos.tsx exists but is
--    never routed in App.tsx (dead code).
DROP POLICY IF EXISTS ops_deductions_all ON public.deduction_memos;

CREATE OR REPLACE FUNCTION public.is_qc_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT public.get_my_role() IN (
    'ceo','director','Director','gm','gmo','smo','boi','nsm','admin',
    'hr','accounts','back_office',
    'purchase_manager','purchase_head','warehouse_manager','qc_manager',
    'field_executive','tele_caller','bde','ff_operations_manager',
    'hub_manager','l1_manager','shift_employee'
  );
$$;

CREATE POLICY deduction_memos_access ON public.deduction_memos
  FOR ALL USING (public.is_qc_staff()) WITH CHECK (public.is_qc_staff());

-- ── payment_deduction_lines — used by VendorPaymentForm.tsx
--    (/purchase/payment-form, OPS_ROLES).
DROP POLICY IF EXISTS ops_deduction_lines_all ON public.payment_deduction_lines;
CREATE POLICY payment_deduction_lines_access ON public.payment_deduction_lines
  FOR ALL USING (public.is_ops_staff()) WITH CHECK (public.is_ops_staff());

-- ── banners, coupons, farm_stories, farm_streams — NOT used
--    anywhere in this FFERP repo (confirmed via grep); belong to a
--    separate customer-facing site. Their public-read policies are
--    clearly intentional (marketing/catalog content) and left alone.
--    Only dropping the write-blanket that currently lets anonymous
--    visitors edit them — no replacement write policy added since
--    the real admin model for that other app is unknown here; that
--    app's own backend should use its service_role key for writes,
--    or add a proper policy once someone with visibility into it
--    defines the real admin role.
DROP POLICY IF EXISTS authenticated_full_banners ON public.banners;
DROP POLICY IF EXISTS banners_admin_all ON public.banners;

DROP POLICY IF EXISTS authenticated_full_coupons ON public.coupons;
DROP POLICY IF EXISTS coupons_admin_all ON public.coupons;

DROP POLICY IF EXISTS farm_stories_admin_all ON public.farm_stories;

DROP POLICY IF EXISTS auth_full_farm_streams ON public.farm_streams;
DROP POLICY IF EXISTS farm_streams_admin_all ON public.farm_streams;

-- ── orders, order_items — NOT used anywhere in this FFERP repo
--    (confirmed via grep; FFERP uses sales_orders/sales_order_items
--    instead). Both existing policies are wide open despite one
--    being misleadingly named "user_own_*" — it's USING (true), not
--    actually scoped. Right now any anonymous visitor can read or
--    modify any customer's order. Same treatment as the exposed auth
--    tokens: deny-all stopgap, since the real customer-auth model
--    for this other app is unknown here.
DROP POLICY IF EXISTS anon_all_order_items ON public.order_items;
DROP POLICY IF EXISTS user_own_items ON public.order_items;

DROP POLICY IF EXISTS anon_all_orders ON public.orders;
DROP POLICY IF EXISTS user_own_orders ON public.orders;

-- ── Verify ───────────────────────────────────────────────────
SELECT tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'notifications','deduction_memos','payment_deduction_lines',
    'banners','coupons','farm_stories','farm_streams','orders','order_items'
  )
ORDER BY tablename, policyname;
