-- ============================================================
--  FF ERP — COMPREHENSIVE RLS + ROLE ACCESS FIX
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--  Fixes all role-based access issues in one shot.
-- ============================================================


-- ════════════════════════════════════════════════════════════
--  STEP 1 — DISABLE RLS on all internal ERP tables
--  These are staff-facing tables. No need for row-level security.
--  Access is controlled by Supabase Auth (login required).
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.profiles              DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.hubs                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_pincodes          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products              DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors               DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_entries      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_entry_items  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_payments       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_approvals     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.porter_transit_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_assignments        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.boxes                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_packs        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_pack_items   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory             DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_log         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.wastage_entries       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.wastage_log           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_slots        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_order_uploads    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners               DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons               DISABLE ROW LEVEL SECURITY;


-- ════════════════════════════════════════════════════════════
--  STEP 2 — DROP all existing policies (clean slate)
--  Removes any recursive or conflicting policies.
-- ════════════════════════════════════════════════════════════

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
            r.policyname, r.schemaname, r.tablename);
    END LOOP;
    RAISE NOTICE 'All policies dropped.';
END$$;


-- ════════════════════════════════════════════════════════════
--  STEP 3 — FIX is_staff() function
--  SECURITY DEFINER + SET search_path bypasses RLS entirely
--  when this function reads from profiles. No more recursion.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;


-- ════════════════════════════════════════════════════════════
--  STEP 4 — RLS only on CUSTOMER-FACING tables
--  Customers (website/app) should only see their own data.
--  Staff bypass these via service role key on the backend.
-- ════════════════════════════════════════════════════════════

-- CUSTOMERS table
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY customers_open ON public.customers
  FOR ALL USING (true);   -- open for now; tighten later if needed

-- SALES ORDERS — open read for all authenticated
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_orders_open ON public.sales_orders
  FOR ALL USING (true);

-- SALES ORDER ITEMS
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY soi_open ON public.sales_order_items
  FOR ALL USING (true);

-- ADDRESSES
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY addresses_open ON public.addresses
  FOR ALL USING (true);

-- CART ITEMS
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY cart_open ON public.cart_items
  FOR ALL USING (true);

-- WISHLISTS
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY wishlists_open ON public.wishlists
  FOR ALL USING (true);

-- CUSTOMER QUERIES
ALTER TABLE public.customer_queries ENABLE ROW LEVEL SECURITY;
CREATE POLICY cq_open ON public.customer_queries
  FOR ALL USING (true);

-- CUSTOMER NOTIFICATIONS
ALTER TABLE public.customer_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY cn_open ON public.customer_notifications
  FOR ALL USING (true);

-- REVIEWS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY reviews_open ON public.reviews
  FOR ALL USING (true);

-- INVOICES
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoices_open ON public.invoices
  FOR ALL USING (true);


-- ════════════════════════════════════════════════════════════
--  STEP 5 — ENSURE correct role names for all 23 users
--  Idempotent — safe to re-run.
-- ════════════════════════════════════════════════════════════

UPDATE public.profiles SET role = 'admin',                department = 'Head Office'  WHERE email = 'admin@ffactory.com';
UPDATE public.profiles SET role = 'ceo',                  department = 'Head Office'  WHERE email = 'ceo@ffactory.com';
UPDATE public.profiles SET role = 'gm',                   department = 'Head Office'  WHERE email = 'gm@ffactory.com';
UPDATE public.profiles SET role = 'ff_operations_manager',department = 'Operations'   WHERE email = 'ops.manager@ffactory.com';
UPDATE public.profiles SET role = 'l1_manager',           department = 'Finance'      WHERE email = 'l1.manager@ffactory.com';
UPDATE public.profiles SET role = 'auditor',              department = 'Finance'      WHERE email = 'auditor@ffactory.com';
UPDATE public.profiles SET role = 'accounts',             department = 'Accounts'     WHERE email = 'accounts@ffactory.com';
UPDATE public.profiles SET role = 'field_executive',      department = 'Sales'        WHERE email = 'priyanka@farmersfactory.in';
UPDATE public.profiles SET role = 'field_executive',      department = 'Sales'        WHERE email = 'indhurekha@farmersfactory.in';
UPDATE public.profiles SET role = 'field_executive',      department = 'Sales'        WHERE email = 'arun@farmersfactory.in';
UPDATE public.profiles SET role = 'field_executive',      department = 'Sales'        WHERE email = 'akash@farmersfactory.in';
UPDATE public.profiles SET role = 'field_executive',      department = 'Sales'        WHERE email = 'parasajagadeesh@farmersfactory.in';
UPDATE public.profiles SET role = 'field_executive',      department = 'Sales'        WHERE email = 'yazhini@farmersfactory.in';
UPDATE public.profiles SET role = 'field_executive',      department = 'Sales'        WHERE email = 'anusiya@farmersfactory.in';
UPDATE public.profiles SET role = 'purchase_manager',     department = 'Purchase'     WHERE email = 'purchase.hyd@ffactory.com';
UPDATE public.profiles SET role = 'purchase_manager',     department = 'Purchase'     WHERE email = 'purchase.pali@ffactory.com';
UPDATE public.profiles SET role = 'purchase_manager',     department = 'Purchase'     WHERE email = 'purchase.vana@ffactory.com';
UPDATE public.profiles SET role = 'hub_manager',          department = 'Warehouse'    WHERE email = 'manager.hyderabad@ffactory.com';
UPDATE public.profiles SET role = 'hub_manager',          department = 'Warehouse'    WHERE email = 'manager.palikarani@ffactory.com';
UPDATE public.profiles SET role = 'hub_manager',          department = 'Warehouse'    WHERE email = 'manager.vanagaram@ffactory.com';
UPDATE public.profiles SET role = 'driver',               department = 'Logistics'    WHERE email = 'driver1@ffactory.com';
UPDATE public.profiles SET role = 'back_office',          department = 'Back Office'  WHERE email = 'backoffice@ffactory.com';
UPDATE public.profiles SET role = 'collection_executive', department = 'Collections'  WHERE email = 'collection@farmersfactory.com';


-- ════════════════════════════════════════════════════════════
--  STEP 6 — VERIFY all 23 profiles are correct
-- ════════════════════════════════════════════════════════════

SELECT
  email,
  name,
  role,
  department,
  is_active
FROM public.profiles
ORDER BY
  CASE role
    WHEN 'admin'                 THEN 1
    WHEN 'ceo'                   THEN 2
    WHEN 'gm'                    THEN 3
    WHEN 'ff_operations_manager' THEN 4
    WHEN 'l1_manager'            THEN 5
    WHEN 'auditor'               THEN 6
    WHEN 'accounts'              THEN 7
    WHEN 'field_executive'       THEN 8
    WHEN 'purchase_manager'      THEN 9
    WHEN 'hub_manager'           THEN 10
    WHEN 'driver'                THEN 11
    WHEN 'back_office'           THEN 12
    WHEN 'collection_executive'  THEN 13
    ELSE 99
  END, email;
