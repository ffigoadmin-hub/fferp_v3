-- ============================================================
--  RLS FIX — CRITICAL: customers, hubs, products leftover policies
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  Found while checking what the security_invoker fix on
--  public.users/dark_stores/website_products would now be
--  constrained by. All three underlying tables already had RLS
--  enabled with a MIX of reasonable, scoped policies AND dangerous
--  leftover blanket ones (different naming pattern than the
--  "authenticated_full_*" ones found earlier, which is why these
--  weren't caught in the earlier sweeps):
--
--  - customers_select_all (SELECT, qual=true, no role restriction)
--    — any anonymous visitor can read every customer's PII
--    (name, email, phone, address).
--  - customers_anon_update (UPDATE, qual=true, no role restriction)
--    — any anonymous visitor can modify ANY customer's row.
--  - authenticated_all_hubs (ALL, qual=true) — any logged-in user,
--    any role, full CRUD on hubs — redundant with the properly
--    scoped hubs_admin_write / hubs_authenticated_read already there.
--  - products_admin_all (ALL, qual=true, no role restriction) — any
--    anonymous visitor can fully modify products (price, stock,
--    anything) — redundant with the properly scoped "All staff view
--    products" / "Purchase managers manage products" /
--    public_read_products (anon, published-only SELECT) already there.
--
--  Dropping only the dangerous/redundant ones. The legitimate
--  policies already sitting alongside them (customers_anon_insert
--  for guest checkout, Staff/Sales-scoped policies, hubs_admin_write,
--  public_read_products) are left untouched — they already cover
--  every real access pattern.
-- ============================================================

DROP POLICY IF EXISTS customers_select_all ON public.customers;
DROP POLICY IF EXISTS customers_anon_update ON public.customers;

DROP POLICY IF EXISTS authenticated_all_hubs ON public.hubs;

DROP POLICY IF EXISTS products_admin_all ON public.products;

-- ── Verify ───────────────────────────────────────────────────
SELECT tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('customers', 'hubs', 'products')
ORDER BY tablename, policyname;
