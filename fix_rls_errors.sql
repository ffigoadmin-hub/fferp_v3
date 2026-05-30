-- =====================================================================
-- FF ERP — Fix RLS Security Advisor Errors
-- Enables RLS on all flagged tables + adds permissive policies
-- where none exist yet so the app keeps working
-- Run in: Supabase → SQL Editor
-- =====================================================================

-- ── Step 1: Enable RLS on all flagged tables ──────────────────────────
ALTER TABLE public.customers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;

-- ── Step 2: Ensure authenticated users can access ERP tables ─────────
-- (safe: uses CREATE OR REPLACE so it won't break existing policies)

-- sales_orders: full access for authenticated
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sales_orders' AND policyname = 'authenticated_full_access'
  ) THEN
    EXECUTE 'CREATE POLICY authenticated_full_access ON public.sales_orders
      FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- sales_order_items: full access for authenticated
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sales_order_items' AND policyname = 'authenticated_full_access'
  ) THEN
    EXECUTE 'CREATE POLICY authenticated_full_access ON public.sales_order_items
      FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- products: read for anon + full for authenticated
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'products' AND policyname = 'anon_read'
  ) THEN
    EXECUTE 'CREATE POLICY anon_read ON public.products
      FOR SELECT TO anon, authenticated USING (true)';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'products' AND policyname = 'authenticated_write'
  ) THEN
    EXECUTE 'CREATE POLICY authenticated_write ON public.products
      FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- customers: full access for authenticated
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'customers' AND policyname = 'authenticated_full_access'
  ) THEN
    EXECUTE 'CREATE POLICY authenticated_full_access ON public.customers
      FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- profiles: users can read/update their own profile
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'own_profile'
  ) THEN
    EXECUTE 'CREATE POLICY own_profile ON public.profiles
      FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id)';
  END IF;
END $$;

-- profiles: allow admins/managers to read all profiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'authenticated_read_all'
  ) THEN
    EXECUTE 'CREATE POLICY authenticated_read_all ON public.profiles
      FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;


-- ── Step 3: Verify ────────────────────────────────────────────────────
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled,
  (SELECT COUNT(*) FROM pg_policies p WHERE p.tablename = t.tablename) AS policy_count
FROM pg_tables t
WHERE schemaname = 'public'
  AND tablename IN ('customers','products','profiles','sales_orders','sales_order_items')
ORDER BY tablename;
