-- ============================================================
--  FIX — tables left with RLS enabled but zero policies (deny-all)
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  Surfaced by the Advisor's "RLS Enabled No Policy" (Info tier).
--  Root cause: earlier fixes assumed addresses/wishlists/
--  customer_notifications/customer_queries already had the "open"
--  policies described in FIX_RLS_ALL_ROLES.sql (addresses_open,
--  wishlists_open, cq_open, cn_open) — turns out those were never
--  actually applied to this live database (same doc-vs-reality drift
--  found repeatedly today), so enabling RLS on them left them fully
--  locked instead of appropriately scoped.
--
--  categories/product_categories/coupons: no owner column at all,
--  clearly public catalog/checkout data — public read, staff write.
--
--  addresses/wishlists/customer_notifications: customer_id-based,
--  but this business's customer flows are largely non-authenticated
--  (phone-based lookup, no real auth.uid()) — same situation already
--  resolved for customers/sales_orders today, where the decision was
--  to restore the original open design rather than break real
--  checkout/tracking functionality. Applying the same precedent.
--
--  customer_queries: same category, but has admin_reply/status
--  fields a support team manages — read/insert open, update
--  restricted to staff only so a customer/anon caller can't tamper
--  with another customer's ticket or forge an admin reply.
--
--  coupon_usage: no confirmed legitimate client-side need found —
--  staff-only, to avoid guessing at a customer-facing policy for
--  data I can't verify is actually read/written from the client.
--
--  NOTE: rewritten with DROP POLICY IF EXISTS guards ahead of every
--  CREATE POLICY so this file is safe to re-run in full regardless
--  of how far a previous partial run got (Supabase's SQL editor does
--  not roll back earlier statements when a later one errors, so a
--  prior run can leave some policies already created).
-- ============================================================

-- ── categories / product_categories — public catalog, no owner ──
DROP POLICY IF EXISTS categories_public_read ON public.categories;
CREATE POLICY categories_public_read ON public.categories
  FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS categories_staff_write ON public.categories;
CREATE POLICY categories_staff_write ON public.categories
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS product_categories_public_read ON public.product_categories;
CREATE POLICY product_categories_public_read ON public.product_categories
  FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS product_categories_staff_write ON public.product_categories;
CREATE POLICY product_categories_staff_write ON public.product_categories
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ── coupons — needed for checkout to validate a code ─────────
DROP POLICY IF EXISTS coupons_public_read ON public.coupons;
CREATE POLICY coupons_public_read ON public.coupons
  FOR SELECT USING (true);
DROP POLICY IF EXISTS coupons_staff_write ON public.coupons;
CREATE POLICY coupons_staff_write ON public.coupons
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ── addresses / wishlists / customer_notifications — restore
--    original open design (matches today's customers/sales_orders
--    precedent) ──
DROP POLICY IF EXISTS addresses_open ON public.addresses;
CREATE POLICY addresses_open ON public.addresses FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS wishlists_open ON public.wishlists;
CREATE POLICY wishlists_open ON public.wishlists FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS customer_notifications_open ON public.customer_notifications;
CREATE POLICY customer_notifications_open ON public.customer_notifications FOR ALL USING (true) WITH CHECK (true);

-- ── customer_queries — open read/insert, staff-only update/delete ──
DROP POLICY IF EXISTS customer_queries_select ON public.customer_queries;
CREATE POLICY customer_queries_select ON public.customer_queries FOR SELECT USING (true);
DROP POLICY IF EXISTS customer_queries_insert ON public.customer_queries;
CREATE POLICY customer_queries_insert ON public.customer_queries FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS customer_queries_staff_update ON public.customer_queries;
CREATE POLICY customer_queries_staff_update ON public.customer_queries
  FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS customer_queries_staff_delete ON public.customer_queries;
CREATE POLICY customer_queries_staff_delete ON public.customer_queries
  FOR DELETE USING (public.is_staff());

-- ── coupon_usage — staff-only, no confirmed client-side need ──
DROP POLICY IF EXISTS coupon_usage_staff_access ON public.coupon_usage;
CREATE POLICY coupon_usage_staff_access ON public.coupon_usage
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ── Verify ───────────────────────────────────────────────────
SELECT tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'categories','product_categories','coupons','coupon_usage',
    'addresses','wishlists','customer_notifications','customer_queries'
  )
ORDER BY tablename, policyname;
