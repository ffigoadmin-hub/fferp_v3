-- ============================================================
--  RLS FIX — customers (restore phone-lookup) + sales_orders/
--  sales_order_items (drop unnecessary anyone-can-update-any-order)
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  1. customers: restoring anon SELECT per explicit decision — the
--     customer-facing "track my order by phone" pages
--     (CustomerOrderHistory.tsx, CustomerOrderTracking.tsx) use no
--     real auth, just a phone-number lookup. Table currently has 0
--     rows in production so nothing was exposed by the earlier drop,
--     but restoring this keeps that feature working once customers
--     exist. Known tradeoff (not newly introduced): anyone who
--     knows/guesses a phone number can look up that customer's
--     record — inherent to the feature's current design, not
--     something fixable via RLS alone without real customer auth.
--
--  2. sales_orders / sales_order_items: keeping the anon SELECT/
--     INSERT policies (order placement + tracking need them, same
--     reasoning as customers), but dropping the anon/authenticated
--     UPDATE-any-row policies — confirmed via grep that no
--     customer-facing code ever updates these tables, and staff
--     already have proper role-scoped UPDATE access via "Sales
--     manage orders"/"Sales manage order items"/so_field_exec/
--     so_ops_all. The dropped policies let literally anyone modify
--     any order's status/amount/anything, serving no real feature.
-- ============================================================

CREATE POLICY customers_anon_read ON public.customers
  FOR SELECT USING (true);

DROP POLICY IF EXISTS sales_orders_update_all ON public.sales_orders;
DROP POLICY IF EXISTS soi_update_all ON public.sales_order_items;

-- ── Verify ───────────────────────────────────────────────────
SELECT tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('customers', 'sales_orders', 'sales_order_items')
ORDER BY tablename, policyname;
