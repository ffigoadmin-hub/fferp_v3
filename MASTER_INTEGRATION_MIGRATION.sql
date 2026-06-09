-- ============================================================
--  FF ERP — MASTER INTEGRATION MIGRATION
--  Extends new ERP (bvbfnguqpuctdvfztuda) to accept orders
--  from: Website (rwasfuhrvqscqnpwqooq)
--        Customer App (slfxozmbwogpisxeltty)
--  Run this ONCE on the new ERP database.
--  Generated: 2026-06-01
-- ============================================================


-- ════════════════════════════════════════════════════════════
--  STEP 1 — EXTEND customers TABLE
--  Website profiles have pincode. Add to ERP customers.
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS pincode          text,
  ADD COLUMN IF NOT EXISTS avatar_url       text,
  ADD COLUMN IF NOT EXISTS password_hash    text,          -- for customer login
  ADD COLUMN IF NOT EXISTS last_login       timestamptz,
  ADD COLUMN IF NOT EXISTS source           text DEFAULT 'erp';  -- 'website' | 'app' | 'erp'

-- Index for fast lookup by email (website login)
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_source ON public.customers(source);


-- ════════════════════════════════════════════════════════════
--  STEP 2 — EXTEND sales_orders TABLE
--  Website orders have delivery_slot, billing_address,
--  payment_method text, and a reference to source order id.
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS billing_address    text,
  ADD COLUMN IF NOT EXISTS pincode            text,
  ADD COLUMN IF NOT EXISTS delivery_slot      text,        -- e.g. "Morning 9AM-12PM"
  ADD COLUMN IF NOT EXISTS source_order_id    text,        -- original ID from website/app DB
  ADD COLUMN IF NOT EXISTS source_db          text,        -- 'website' | 'customer_app'
  ADD COLUMN IF NOT EXISTS customer_email     text,
  ADD COLUMN IF NOT EXISTS customer_phone     text,
  ADD COLUMN IF NOT EXISTS delivered_at       timestamptz;

-- Index for tracing back to source
CREATE INDEX IF NOT EXISTS idx_sales_orders_source_order ON public.sales_orders(source_order_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_source_db    ON public.sales_orders(source_db);
CREATE INDEX IF NOT EXISTS idx_sales_orders_cust_email   ON public.sales_orders(customer_email);


-- ════════════════════════════════════════════════════════════
--  STEP 3 — EXTEND products TABLE
--  Website products have original_price, stock_left,
--  weight_options (jsonb), badge, image.
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS original_price   numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_left       integer DEFAULT 50,
  ADD COLUMN IF NOT EXISTS weight_options   jsonb,         -- e.g. [{"label":"500g","value":0.5}]
  ADD COLUMN IF NOT EXISTS badge            text,          -- e.g. "Fresh", "Bestseller"
  ADD COLUMN IF NOT EXISTS website_price    numeric(10,2), -- price shown on website
  ADD COLUMN IF NOT EXISTS is_published     boolean DEFAULT false; -- visible on website/app


-- ════════════════════════════════════════════════════════════
--  STEP 4 — CREATE delivery_slots TABLE
--  Controls which time slots are available per date.
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.delivery_slots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date          date NOT NULL,
  slot_type     text NOT NULL,                             -- 'morning' | 'evening' | 'express'
  slot_label    text,                                      -- "Morning 9AM–12PM"
  start_time    time NOT NULL,
  end_time      time NOT NULL,
  max_capacity  integer DEFAULT 20,
  current_usage integer DEFAULT 0,
  hub_id        uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_slots_date   ON public.delivery_slots(date);
CREATE INDEX IF NOT EXISTS idx_delivery_slots_hub    ON public.delivery_slots(hub_id);
CREATE INDEX IF NOT EXISTS idx_delivery_slots_active ON public.delivery_slots(is_active);


-- ════════════════════════════════════════════════════════════
--  STEP 5 — CREATE customer_queries TABLE
--  Website support tickets from customers.
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.customer_queries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_email text,
  subject       text NOT NULL,
  message       text NOT NULL,
  status        text DEFAULT 'open'
                  CHECK (status IN ('open','in_progress','resolved','closed')),
  admin_reply   text,
  replied_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  replied_at    timestamptz,
  channel       text DEFAULT 'website',                    -- 'website' | 'app' | 'whatsapp'
  source_db     text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_queries_customer ON public.customer_queries(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_queries_status   ON public.customer_queries(status);


-- ════════════════════════════════════════════════════════════
--  STEP 6 — CREATE customer_notifications TABLE
--  Replaces website inbox_messages. Sends order updates
--  back to customers (website/app).
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.customer_notifications (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  customer_email text,
  title          text NOT NULL,
  message        text NOT NULL,
  type           text DEFAULT 'order_update'
                   CHECK (type IN ('order_update','promotion','info','alert')),
  order_id       uuid REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  is_read        boolean DEFAULT false,
  channel        text DEFAULT 'website',
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cust_notif_customer ON public.customer_notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_cust_notif_email    ON public.customer_notifications(customer_email);
CREATE INDEX IF NOT EXISTS idx_cust_notif_read     ON public.customer_notifications(is_read);


-- ════════════════════════════════════════════════════════════
--  STEP 7 — CREATE website_products VIEW
--  A clean view that the website/app can query directly
--  without seeing internal ERP fields.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.website_products AS
SELECT
  id,
  name,
  description,
  COALESCE(website_price, grade_a_price, 0) AS price,
  COALESCE(original_price, grade_a_price, 0) AS original_price,
  category,
  image_url AS image,
  unit,
  badge,
  COALESCE(stock_left, 50) AS stock_left,
  weight_options,
  is_published AS is_active,
  created_at,
  updated_at
FROM public.products
WHERE is_published = true AND is_active = true;


-- ════════════════════════════════════════════════════════════
--  STEP 8 — TRIGGER: auto-decrement stock on order
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.decrement_product_stock()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.products
  SET stock_left = GREATEST(0, stock_left - NEW.quantity::integer)
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_stock ON public.sales_order_items;
CREATE TRIGGER trg_decrement_stock
  AFTER INSERT ON public.sales_order_items
  FOR EACH ROW EXECUTE FUNCTION public.decrement_product_stock();


-- ════════════════════════════════════════════════════════════
--  STEP 9 — TRIGGER: auto-increment delivery_slot usage
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.increment_slot_usage()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.delivery_slot IS NOT NULL THEN
    UPDATE public.delivery_slots
    SET current_usage = current_usage + 1
    WHERE slot_label = NEW.delivery_slot
      AND date = COALESCE(NEW.delivery_date, CURRENT_DATE);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_increment_slot ON public.sales_orders;
CREATE TRIGGER trg_increment_slot
  AFTER INSERT ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.increment_slot_usage();


-- ════════════════════════════════════════════════════════════
--  STEP 10 — RLS POLICIES FOR CUSTOMER ACCESS
--  Customers (anon + authenticated) can only see/touch
--  their own records. ERP staff see everything.
-- ════════════════════════════════════════════════════════════

-- Enable RLS on customer-facing tables
ALTER TABLE public.customers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_queries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_slots       ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS customers_own_record        ON public.customers;
DROP POLICY IF EXISTS customers_erp_all           ON public.customers;
DROP POLICY IF EXISTS sales_orders_own            ON public.sales_orders;
DROP POLICY IF EXISTS sales_orders_erp_all        ON public.sales_orders;
DROP POLICY IF EXISTS sales_order_items_own       ON public.sales_order_items;
DROP POLICY IF EXISTS sales_order_items_erp_all   ON public.sales_order_items;
DROP POLICY IF EXISTS cust_queries_own            ON public.customer_queries;
DROP POLICY IF EXISTS cust_queries_erp_all        ON public.customer_queries;
DROP POLICY IF EXISTS cust_notif_own              ON public.customer_notifications;
DROP POLICY IF EXISTS cust_notif_erp_all          ON public.customer_notifications;
DROP POLICY IF EXISTS delivery_slots_read         ON public.delivery_slots;
DROP POLICY IF EXISTS delivery_slots_erp_all      ON public.delivery_slots;

-- CUSTOMERS table
CREATE POLICY customers_erp_all ON public.customers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin','gm','purchase_executive','erp_user','employee')
    )
  );

CREATE POLICY customers_own_record ON public.customers
  FOR ALL TO authenticated
  USING (email = (SELECT email FROM public.profiles WHERE id = auth.uid()));

-- SALES_ORDERS table — customer sees only their orders
CREATE POLICY sales_orders_erp_all ON public.sales_orders
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin','gm','purchase_executive','erp_user','employee')
    )
  );

CREATE POLICY sales_orders_own ON public.sales_orders
  FOR ALL TO authenticated
  USING (customer_email = (SELECT email FROM public.profiles WHERE id = auth.uid()));

-- SALES_ORDER_ITEMS — customer sees items for their orders
CREATE POLICY sales_order_items_erp_all ON public.sales_order_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin','gm','purchase_executive','erp_user','employee')
    )
  );

CREATE POLICY sales_order_items_own ON public.sales_order_items
  FOR SELECT TO authenticated
  USING (
    order_id IN (
      SELECT id FROM public.sales_orders
      WHERE customer_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    )
  );

-- CUSTOMER_QUERIES
CREATE POLICY cust_queries_erp_all ON public.customer_queries
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin','gm','purchase_executive','erp_user','employee')
    )
  );

CREATE POLICY cust_queries_own ON public.customer_queries
  FOR ALL TO authenticated
  USING (customer_email = (SELECT email FROM public.profiles WHERE id = auth.uid()));

-- CUSTOMER_NOTIFICATIONS
CREATE POLICY cust_notif_erp_all ON public.customer_notifications
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin','gm','purchase_executive','erp_user','employee')
    )
  );

CREATE POLICY cust_notif_own ON public.customer_notifications
  FOR ALL TO authenticated
  USING (customer_email = (SELECT email FROM public.profiles WHERE id = auth.uid()));

-- DELIVERY_SLOTS — anyone can read, only ERP can write
CREATE POLICY delivery_slots_read ON public.delivery_slots
  FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY delivery_slots_erp_all ON public.delivery_slots
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin','gm','purchase_executive','erp_user','employee')
    )
  );

-- PRODUCTS — anyone can read published products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS products_public_read ON public.products;
DROP POLICY IF EXISTS products_erp_all     ON public.products;

CREATE POLICY products_public_read ON public.products
  FOR SELECT TO anon, authenticated USING (is_published = true AND is_active = true);

CREATE POLICY products_erp_all ON public.products
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin','gm','purchase_executive','erp_user','employee')
    )
  );


-- ════════════════════════════════════════════════════════════
--  DONE — Schema extension complete.
--  Next: Run MASTER_DATA_MIGRATION.sql to copy existing data.
-- ════════════════════════════════════════════════════════════
