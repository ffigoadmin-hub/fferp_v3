-- ============================================================
--  FIX — SECURITY DEFINER views bypass querying-user RLS
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  public.users, public.dark_stores, public.website_products are
--  compatibility views (aliasing customers/hubs/products with
--  renamed columns, presumably for a separate website/app that
--  expects those names). By default a Postgres view runs with its
--  OWNER's permissions, not the querying user's — silently
--  bypassing RLS on the underlying table. public.users is the most
--  concerning: it returns every customer's email/phone, unfiltered,
--  to anyone who queries it.
--
--  This switches all three to security_invoker = true, so they now
--  respect the querying user's own RLS on the underlying table
--  instead of bypassing it.
--
--  ⚠️ If the customer-facing website/app relies on the current
--  bypass to let anonymous (non-logged-in) visitors browse store
--  locations or the product catalog, this may break that until the
--  underlying customers/hubs/products tables have an RLS policy
--  that explicitly allows anonymous SELECT for the public-safe
--  columns these views expose. Test the live website's store
--  locator and product catalog after applying this.
-- ============================================================

ALTER VIEW public.users SET (security_invoker = true);
ALTER VIEW public.dark_stores SET (security_invoker = true);
ALTER VIEW public.website_products SET (security_invoker = true);

-- ── Check current RLS state on the underlying tables, since the
--    views will now actually be constrained by it ──
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('customers', 'hubs', 'products');

SELECT tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('customers', 'hubs', 'products')
ORDER BY tablename, policyname;
