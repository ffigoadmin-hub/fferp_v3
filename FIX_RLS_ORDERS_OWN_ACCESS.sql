-- ============================================================
--  FIX — restore customer's own-order access on `orders`
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  After dropping the wide-open anon_all_orders/user_own_orders
--  policies, `orders` was left with only admin_all_orders (staff-only
--  ALL). That's correct for closing the anonymous-tampering exposure,
--  but it also means a regular authenticated customer can no longer
--  see or create their own order — order_items already has the
--  correct pattern for this (ff_order_items_own_read checks
--  o.user_id = auth.uid()::text); `orders` itself needs the same.
-- ============================================================

CREATE POLICY orders_own_read ON public.orders
  FOR SELECT USING (user_id = (auth.uid())::text);

CREATE POLICY orders_own_insert ON public.orders
  FOR INSERT WITH CHECK (user_id = (auth.uid())::text);

-- ── Verify ───────────────────────────────────────────────────
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'orders'
ORDER BY policyname;
