-- ============================================================
--  FF ERP — COMPLETE SCHEMA MIGRATION
--  Target DB : qwiumswrbddwmlraktvy  (new core database)
--  Safe to run on the existing 10-table scanner schema.
--  Uses IF NOT EXISTS / IF NOT EXISTS everywhere — re-runnable.
--  Generated: 2026-06-01
--  Run order: THIS FILE first → then HUB_SEED.sql
-- ============================================================


-- ════════════════════════════════════════════════════════════
--  PHASE 0 — EXTENSIONS & HELPERS
-- ════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;


-- ════════════════════════════════════════════════════════════
--  PHASE 1 — EXTEND EXISTING SCANNER TABLES
--  Adds missing columns to hubs, products, profiles.
--  All use ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
-- ════════════════════════════════════════════════════════════

-- ── HUBS (already exists) ────────────────────────────────────
ALTER TABLE public.hubs
  ADD COLUMN IF NOT EXISTS city         text,
  ADD COLUMN IF NOT EXISTS state        text DEFAULT 'Tamil Nadu',
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS updated_at   timestamptz DEFAULT now();

-- ── PRODUCTS (already exists) ────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS description    text,
  ADD COLUMN IF NOT EXISTS category       text NOT NULL DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS category_id    uuid,
  ADD COLUMN IF NOT EXISTS slug           text,
  ADD COLUMN IF NOT EXISTS price          numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mrp            numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_price numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grade_a_price  numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grade_b_price  numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grade_c_price  numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS website_price  numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS badge          text,
  ADD COLUMN IF NOT EXISTS stock_left     integer DEFAULT 50,
  ADD COLUMN IF NOT EXISTS in_stock       boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS weight_options jsonb,
  ADD COLUMN IF NOT EXISTS image_urls     text DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS is_featured    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_published   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_order_kg   numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at     timestamptz DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS products_slug_unique ON public.products(slug)
  WHERE slug IS NOT NULL;

-- ── PROFILES (already exists) ────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone              text,
  ADD COLUMN IF NOT EXISTS employee_id        text,
  ADD COLUMN IF NOT EXISTS department         text DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS department_type    text,
  ADD COLUMN IF NOT EXISTS destination        text,
  ADD COLUMN IF NOT EXISTS is_active          boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS login_enabled      boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS joining_date       date,
  ADD COLUMN IF NOT EXISTS status             text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS updated_at         timestamptz DEFAULT now();

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS products_updated_at ON public.products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS hubs_updated_at ON public.hubs;
CREATE TRIGGER hubs_updated_at
  BEFORE UPDATE ON public.hubs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ════════════════════════════════════════════════════════════
--  PHASE 2 — NEW TABLES: LAYER 1 (no foreign keys)
-- ════════════════════════════════════════════════════════════

-- ── CATEGORIES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.categories (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  slug             text UNIQUE NOT NULL,
  description      text,
  image_url        text NOT NULL DEFAULT '',
  icon_url         text,
  parent_id        uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  sort_order       integer NOT NULL DEFAULT 0,
  is_active        boolean NOT NULL DEFAULT true,
  meta_title       text,
  meta_description text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── VENDORS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendors (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  type           text NOT NULL DEFAULT 'dynamic'
                   CHECK (type IN ('static','dynamic')),
  contact_person text,
  phone          text,
  email          text,
  address        text,
  city           text,
  bank_name      text,
  account_number text,
  ifsc_code      text,
  upi_id         text,
  beneficiary_name text,
  gst_number     text,
  is_active      boolean DEFAULT true,
  notes          text,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
CREATE TRIGGER vendors_updated_at BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── COUPONS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coupons (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text UNIQUE NOT NULL,
  discount_type  text NOT NULL DEFAULT 'percent'
                   CHECK (discount_type IN ('percent','flat')),
  discount_value numeric(10,2) NOT NULL,
  min_order      numeric(10,2) DEFAULT 0,
  max_uses       integer DEFAULT 0,
  used_count     integer DEFAULT 0,
  expires_at     timestamptz,
  is_active      boolean DEFAULT true,
  created_at     timestamptz DEFAULT now()
);

-- ── BANNERS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.banners (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text,
  image_url  text NOT NULL,
  link       text,
  sort_order integer DEFAULT 0,
  is_active  boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ── ANNOUNCEMENTS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  body         text NOT NULL,
  target_roles text[] DEFAULT '{}',
  created_by   uuid,
  is_active    boolean DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- ── DELIVERY SLOTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.delivery_slots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date          date NOT NULL,
  slot_type     text NOT NULL,
  slot_label    text,
  start_time    time NOT NULL,
  end_time      time NOT NULL,
  max_capacity  integer DEFAULT 20,
  current_usage integer DEFAULT 0,
  hub_id        uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_slots_date ON public.delivery_slots(date);
CREATE INDEX IF NOT EXISTS idx_delivery_slots_hub  ON public.delivery_slots(hub_id);


-- ════════════════════════════════════════════════════════════
--  PHASE 3 — NEW TABLES: LAYER 2 (reference hubs/profiles)
-- ════════════════════════════════════════════════════════════

-- ── CUSTOMERS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  first_name       text,
  last_name        text,
  email            text,
  phone            text,
  mobile           text,
  address          text,
  area             text,
  city             text,
  pincode          text,
  avatar_url       text,
  customer_type    text DEFAULT 'individual'
                     CHECK (customer_type IN ('individual','static','retail','shop')),
  channel          text DEFAULT 'website'
                     CHECK (channel IN ('website','app','erp','manual')),
  source           text DEFAULT 'website',
  hub_id           uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  credit_limit     numeric(12,2) DEFAULT 0,
  outstanding      numeric(12,2) DEFAULT 0,
  loyalty_points   integer DEFAULT 0,
  referral_code    text UNIQUE DEFAULT gen_random_uuid()::text,
  referred_by      text,
  is_active        boolean DEFAULT true,
  last_login       timestamptz,
  notes            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customers_email   ON public.customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone   ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_hub     ON public.customers(hub_id);
CREATE INDEX IF NOT EXISTS idx_customers_type    ON public.customers(customer_type);
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── ADDRESSES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.addresses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  label       text NOT NULL DEFAULT 'Home',
  line1       text NOT NULL,
  line2       text,
  landmark    text,
  city        text NOT NULL,
  state       text NOT NULL,
  pincode     text NOT NULL,
  lat         double precision DEFAULT 0,
  lng         double precision DEFAULT 0,
  is_default  boolean DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_addresses_customer ON public.addresses(customer_id);

-- ── HUB PINCODES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hub_pincodes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id     uuid NOT NULL REFERENCES public.hubs(id) ON DELETE CASCADE,
  pincode    text NOT NULL,
  area_name  text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT hub_pincodes_pincode_unique UNIQUE (pincode)
);
CREATE INDEX IF NOT EXISTS idx_hub_pincodes_pincode ON public.hub_pincodes(pincode);
CREATE INDEX IF NOT EXISTS idx_hub_pincodes_hub     ON public.hub_pincodes(hub_id);

-- ── PURCHASE ORDERS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number         text UNIQUE NOT NULL DEFAULT '',
  hub_id            uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  hub_name          text,
  eod_date          date NOT NULL DEFAULT CURRENT_DATE,
  status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','assigned','purchasing','purchased','received','cancelled')),
  total_estimated   numeric(12,2) DEFAULT 0,
  notes             text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);
CREATE SEQUENCE IF NOT EXISTS po_seq START 1;
CREATE OR REPLACE FUNCTION public.generate_po_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.po_number IS NULL OR NEW.po_number = '' THEN
    NEW.po_number := 'PO-' || TO_CHAR(now(),'YYYYMMDD') || '-' || LPAD(nextval('po_seq')::text,4,'0');
  END IF; RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS set_po_number ON public.purchase_orders;
CREATE TRIGGER set_po_number BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.generate_po_number();
CREATE TRIGGER purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE INDEX IF NOT EXISTS idx_po_hub    ON public.purchase_orders(hub_id);
CREATE INDEX IF NOT EXISTS idx_po_date   ON public.purchase_orders(eod_date);
CREATE INDEX IF NOT EXISTS idx_po_status ON public.purchase_orders(status);


-- ════════════════════════════════════════════════════════════
--  PHASE 4 — NEW TABLES: LAYER 3 (reference customers/POs)
-- ════════════════════════════════════════════════════════════

-- ── PURCHASE ORDER ITEMS ─────────────────────────────────────
-- NOTE: boxes.po_item_id references this table
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id          uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id     uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name   text NOT NULL,
  hub_id         uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  required_qty   numeric(10,2) NOT NULL DEFAULT 0,
  ordered_qty    numeric(10,2) NOT NULL DEFAULT 0,
  unit           text DEFAULT 'kg',
  estimated_price numeric(10,2) DEFAULT 0,
  status         text DEFAULT 'pending'
                   CHECK (status IN ('pending','fulfilled_by_stock','purchased','received')),
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_poi_po      ON public.purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_poi_product ON public.purchase_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_poi_hub     ON public.purchase_order_items(hub_id);

-- ── SALES ORDERS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sales_orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number     text UNIQUE DEFAULT '',
  customer_id      uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name    text NOT NULL,
  customer_email   text,
  customer_phone   text,
  order_date       date NOT NULL DEFAULT CURRENT_DATE,
  delivery_date    date,
  delivery_slot    text,
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','confirmed','processing','dispatched','delivered','cancelled')),
  payment_mode     text DEFAULT 'cod'
                     CHECK (payment_mode IN ('cod','razorpay','upi','bank')),
  payment_status   text DEFAULT 'unpaid'
                     CHECK (payment_status IN ('unpaid','partial','paid','refunded')),
  razorpay_order_id   text,
  razorpay_payment_id text,
  razorpay_signature  text,
  subtotal         numeric(12,2) DEFAULT 0,
  delivery_fee     numeric(12,2) DEFAULT 0,
  discount         numeric(12,2) DEFAULT 0,
  total_amount     numeric(12,2) DEFAULT 0,
  amount_paid      numeric(12,2) DEFAULT 0,
  delivery_address text,
  billing_address  text,
  pincode          text,
  hub_id           uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  hub_name         text,
  channel          text DEFAULT 'website'
                     CHECK (channel IN ('website','app','manual','file_upload','whatsapp')),
  source           text DEFAULT 'website',
  source_order_id  text,
  source_db        text,
  coupon_code      text,
  notes            text,
  delivered_at     timestamptz,
  created_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE SEQUENCE IF NOT EXISTS so_seq START 1;
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'SO-' || TO_CHAR(now(),'YYYYMMDD') || '-' || LPAD(nextval('so_seq')::text,4,'0');
  END IF; RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS set_order_number ON public.sales_orders;
CREATE TRIGGER set_order_number BEFORE INSERT ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();
CREATE TRIGGER sales_orders_updated_at BEFORE UPDATE ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE INDEX IF NOT EXISTS idx_so_customer ON public.sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_so_hub      ON public.sales_orders(hub_id);
CREATE INDEX IF NOT EXISTS idx_so_status   ON public.sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_so_channel  ON public.sales_orders(channel);
CREATE INDEX IF NOT EXISTS idx_so_date     ON public.sales_orders(order_date);


-- ════════════════════════════════════════════════════════════
--  PHASE 5 — NEW TABLES: LAYER 4 (reference sales_orders/POIs)
-- ════════════════════════════════════════════════════════════

-- ── SALES ORDER ITEMS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sales_order_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id   uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity     numeric(10,2) NOT NULL,
  unit         text NOT NULL DEFAULT 'kg',
  unit_price   numeric(10,2) NOT NULL,
  discount_pct numeric(5,2) DEFAULT 0,
  total_price  numeric(12,2) DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_soi_order   ON public.sales_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_soi_product ON public.sales_order_items(product_id);

-- ── INVOICES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE DEFAULT '',
  order_id       uuid REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  customer_id    uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  amount         numeric(12,2) NOT NULL DEFAULT 0,
  status         text DEFAULT 'draft'
                   CHECK (status IN ('draft','issued','paid','cancelled')),
  issued_at      timestamptz,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
CREATE SEQUENCE IF NOT EXISTS inv_seq START 1;
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'INV-' || TO_CHAR(now(),'YYYYMMDD') || '-' || LPAD(nextval('inv_seq')::text,4,'0');
  END IF; RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS set_invoice_number ON public.invoices;
CREATE TRIGGER set_invoice_number BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.generate_invoice_number();
CREATE INDEX IF NOT EXISTS idx_invoices_order    ON public.invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices(customer_id);

-- ── CART ITEMS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cart_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity    numeric(10,2) NOT NULL DEFAULT 1,
  added_at    timestamptz DEFAULT now(),
  UNIQUE(customer_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_cart_customer ON public.cart_items(customer_id);

-- ── WISHLISTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wishlists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(customer_id, product_id)
);

-- ── REVIEWS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  rating      integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     text,
  is_visible  boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(customer_id, product_id)
);

-- ── BULK ORDER UPLOADS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bulk_order_uploads (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  file_url       text NOT NULL,
  file_name      text,
  file_type      text CHECK (file_type IN ('excel','csv','pdf')),
  status         text DEFAULT 'pending'
                   CHECK (status IN ('pending','processing','done','failed')),
  parsed_orders  jsonb,
  error_log      text,
  uploaded_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- ── CUSTOMER QUERIES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_queries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_email text,
  subject        text NOT NULL,
  message        text NOT NULL,
  status         text DEFAULT 'open'
                   CHECK (status IN ('open','in_progress','resolved','closed')),
  admin_reply    text,
  replied_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  replied_at     timestamptz,
  channel        text DEFAULT 'website',
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- ── CUSTOMER NOTIFICATIONS ───────────────────────────────────
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
CREATE INDEX IF NOT EXISTS idx_cn_customer ON public.customer_notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_cn_email    ON public.customer_notifications(customer_email);
CREATE INDEX IF NOT EXISTS idx_cn_read     ON public.customer_notifications(is_read);

-- ── INTERNAL NOTIFICATIONS (staff) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  title      text NOT NULL,
  body       text NOT NULL,
  type       text DEFAULT 'info',
  is_read    boolean DEFAULT false,
  ref_id     uuid,
  ref_type   text,
  link       text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_read ON public.notifications(is_read);

-- ── PO ASSIGNMENTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.po_assignments (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id                  uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  hub_id                 uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  purchase_executive_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at            timestamptz DEFAULT now(),
  status                 text DEFAULT 'assigned'
                           CHECK (status IN ('assigned','acknowledged','completed'))
);
CREATE INDEX IF NOT EXISTS idx_pa_po  ON public.po_assignments(po_id);
CREATE INDEX IF NOT EXISTS idx_pa_pe  ON public.po_assignments(purchase_executive_id);

-- ── PURCHASE ENTRIES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id        uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  vendor_id    uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  purchased_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  receipt_url  text,
  notes        text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pe_po     ON public.purchase_entries(po_id);
CREATE INDEX IF NOT EXISTS idx_pe_vendor ON public.purchase_entries(vendor_id);

-- ── PURCHASE ENTRY ITEMS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_entry_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id   uuid NOT NULL REFERENCES public.purchase_entries(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity   numeric(10,2) NOT NULL,
  unit       text DEFAULT 'kg',
  unit_price numeric(10,2) NOT NULL,
  total      numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ── VENDOR PAYMENTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_entry_id   uuid REFERENCES public.purchase_entries(id) ON DELETE SET NULL,
  vendor_id           uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  amount              numeric(12,2) NOT NULL,
  status              text NOT NULL DEFAULT 'pending_ops_approval'
                        CHECK (status IN (
                          'pending_ops_approval','pending_l1_approval',
                          'pending_auditor_approval','pending_ceo_approval',
                          'approved','paid','rejected'
                        )),
  items_snapshot      jsonb,
  rejection_reason    text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vp_status ON public.vendor_payments(status);
CREATE TRIGGER vendor_payments_updated_at BEFORE UPDATE ON public.vendor_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── PORTER / TRANSIT PAYMENTS ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.porter_transit_payments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id           uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  delivery_pack_id uuid REFERENCES public.delivery_packs(id) ON DELETE SET NULL,
  type             text NOT NULL CHECK (type IN ('porter','transit')),
  amount           numeric(12,2) NOT NULL,
  payee_name       text,
  payee_phone      text,
  status           text NOT NULL DEFAULT 'pending_ops_approval'
                     CHECK (status IN (
                       'pending_ops_approval','pending_l1_approval',
                       'pending_auditor_approval','pending_ceo_approval',
                       'approved','paid','rejected'
                     )),
  notes            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ptp_status ON public.porter_transit_payments(status);
CREATE TRIGGER porter_transit_payments_updated_at BEFORE UPDATE ON public.porter_transit_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── PAYMENT APPROVALS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_approvals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id     uuid NOT NULL,
  payment_type   text NOT NULL CHECK (payment_type IN ('vendor','porter','transit')),
  level          text NOT NULL
                   CHECK (level IN ('ops_manager','l1','auditor','ceo')),
  status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','rejected')),
  approved_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at    timestamptz,
  remarks        text,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_approvals_payment ON public.payment_approvals(payment_id);
CREATE INDEX IF NOT EXISTS idx_approvals_level   ON public.payment_approvals(level);
CREATE INDEX IF NOT EXISTS idx_approvals_status  ON public.payment_approvals(status);


-- ════════════════════════════════════════════════════════════
--  PHASE 6 — AUTOMATION TRIGGERS
-- ════════════════════════════════════════════════════════════

-- ── Trigger 1: Auto-assign hub from customer pincode ─────────
CREATE OR REPLACE FUNCTION public.auto_assign_hub()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_pincode text;
  v_hub_id  uuid;
BEGIN
  v_pincode := COALESCE(
    NEW.pincode,
    (SELECT pincode FROM public.customers WHERE id = NEW.customer_id LIMIT 1)
  );
  IF v_pincode IS NOT NULL THEN
    SELECT hp.hub_id INTO v_hub_id
    FROM public.hub_pincodes hp WHERE hp.pincode = v_pincode LIMIT 1;
    IF v_hub_id IS NULL THEN
      SELECT hp.hub_id INTO v_hub_id
      FROM public.hub_pincodes hp
      WHERE LEFT(hp.pincode,4) = LEFT(v_pincode,4) LIMIT 1;
    END IF;
    IF v_hub_id IS NOT NULL THEN NEW.hub_id := v_hub_id; END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_auto_assign_hub ON public.sales_orders;
CREATE TRIGGER trg_auto_assign_hub
  BEFORE INSERT ON public.sales_orders
  FOR EACH ROW WHEN (NEW.hub_id IS NULL)
  EXECUTE FUNCTION public.auto_assign_hub();

-- ── Trigger 2: Auto-create draft invoice on new order ────────
CREATE OR REPLACE FUNCTION public.auto_create_invoice()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.invoices (order_id, customer_id, amount, status)
  VALUES (NEW.id, NEW.customer_id, NEW.total_amount, 'draft');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_auto_invoice ON public.sales_orders;
CREATE TRIGGER trg_auto_invoice
  AFTER INSERT ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_invoice();

-- ── Trigger 3: Auto-create vendor payment on purchase entry ──
CREATE OR REPLACE FUNCTION public.auto_vendor_payment()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.vendor_payments (purchase_entry_id, vendor_id, amount, status)
  VALUES (NEW.id, NEW.vendor_id, NEW.total_amount, 'pending_ops_approval');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_auto_vendor_payment ON public.purchase_entries;
CREATE TRIGGER trg_auto_vendor_payment
  AFTER INSERT ON public.purchase_entries
  FOR EACH ROW EXECUTE FUNCTION public.auto_vendor_payment();

-- ── Trigger 4: Inventory update on box received ──────────────
-- (Scanner already calls logInventoryEvent — this is a safety net)
CREATE OR REPLACE FUNCTION public.inventory_on_box_receive()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'received' AND OLD.status != 'received' AND NEW.product_id IS NOT NULL THEN
    INSERT INTO public.inventory (hub_id, product_id, quantity)
    VALUES (NEW.hub_id, NEW.product_id, COALESCE(NEW.weight_kg, 1))
    ON CONFLICT (hub_id, product_id)
    DO UPDATE SET quantity = public.inventory.quantity + COALESCE(NEW.weight_kg, 1),
                  updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_inventory_on_receive ON public.boxes;
CREATE TRIGGER trg_inventory_on_receive
  AFTER UPDATE ON public.boxes
  FOR EACH ROW EXECUTE FUNCTION public.inventory_on_box_receive();

-- ── Trigger 5: Inventory deduct on wastage ───────────────────
CREATE OR REPLACE FUNCTION public.inventory_on_wastage()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.product_id IS NOT NULL AND NEW.hub_id IS NOT NULL THEN
    UPDATE public.inventory
    SET quantity = GREATEST(0, quantity - NEW.weight_kg),
        updated_at = now()
    WHERE hub_id = NEW.hub_id AND product_id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_inventory_wastage ON public.wastage_log;
CREATE TRIGGER trg_inventory_wastage
  AFTER INSERT ON public.wastage_log
  FOR EACH ROW EXECUTE FUNCTION public.inventory_on_wastage();

-- ── Add unique constraint to inventory if not exists ─────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_hub_product_unique'
  ) THEN
    ALTER TABLE public.inventory
      ADD CONSTRAINT inventory_hub_product_unique UNIQUE (hub_id, product_id);
  END IF;
END$$;


-- ════════════════════════════════════════════════════════════
--  PHASE 7 — COMPATIBILITY VIEWS
--  Lets customer app keep using 'orders', 'users' etc.
--  without changing its query code.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.orders AS
  SELECT * FROM public.sales_orders;

CREATE OR REPLACE VIEW public.order_items AS
  SELECT * FROM public.sales_order_items;

CREATE OR REPLACE VIEW public.users AS
  SELECT
    id, name, email, phone AS phone,
    avatar_url, loyalty_points, referral_code,
    referred_by, created_at, updated_at
  FROM public.customers;

CREATE OR REPLACE VIEW public.dark_stores AS
  SELECT
    id, name, city, pincode,
    lat, lng, radius_km AS "radiusKm", is_active
  FROM public.hubs;

CREATE OR REPLACE VIEW public.website_products AS
  SELECT
    id, name, slug, description,
    COALESCE(website_price, price, grade_a_price, 0) AS price,
    COALESCE(mrp, original_price, grade_a_price, 0)  AS mrp,
    category, image_url AS image, image_urls,
    unit, badge, COALESCE(stock_left, 50) AS stock_left,
    in_stock, weight_options, is_featured,
    is_published AS is_active, created_at, updated_at
  FROM public.products
  WHERE is_published = true AND is_active = true;


-- ════════════════════════════════════════════════════════════
--  PHASE 8 — RLS POLICIES
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.customers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_queries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_slots        ENABLE ROW LEVEL SECURITY;

-- Staff full access helper
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin','gm','hub_manager','driver','purchase_executive','ops_manager','l1','auditor','ceo')
      AND is_active = true
  );
$$;

-- PRODUCTS: public can read published; staff can do anything
DROP POLICY IF EXISTS products_public_read ON public.products;
DROP POLICY IF EXISTS products_staff_all   ON public.products;
CREATE POLICY products_public_read ON public.products
  FOR SELECT USING (is_published = true AND is_active = true);
CREATE POLICY products_staff_all ON public.products
  FOR ALL USING (public.is_staff());

-- DELIVERY SLOTS: public read active; staff write
DROP POLICY IF EXISTS slots_public_read ON public.delivery_slots;
DROP POLICY IF EXISTS slots_staff_all   ON public.delivery_slots;
CREATE POLICY slots_public_read ON public.delivery_slots
  FOR SELECT USING (is_active = true);
CREATE POLICY slots_staff_all ON public.delivery_slots
  FOR ALL USING (public.is_staff());

-- CUSTOMERS: own record or staff
DROP POLICY IF EXISTS customers_own    ON public.customers;
DROP POLICY IF EXISTS customers_staff  ON public.customers;
CREATE POLICY customers_own ON public.customers
  FOR ALL USING (id = auth.uid() OR email = (SELECT email FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY customers_staff ON public.customers
  FOR ALL USING (public.is_staff());

-- SALES ORDERS: own orders or staff
DROP POLICY IF EXISTS so_own   ON public.sales_orders;
DROP POLICY IF EXISTS so_staff ON public.sales_orders;
CREATE POLICY so_own ON public.sales_orders
  FOR ALL USING (
    customer_id = auth.uid()
    OR customer_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY so_staff ON public.sales_orders FOR ALL USING (public.is_staff());

-- SALES ORDER ITEMS: linked to own orders or staff
DROP POLICY IF EXISTS soi_own   ON public.sales_order_items;
DROP POLICY IF EXISTS soi_staff ON public.sales_order_items;
CREATE POLICY soi_own ON public.sales_order_items
  FOR SELECT USING (
    order_id IN (SELECT id FROM public.sales_orders WHERE customer_id = auth.uid())
  );
CREATE POLICY soi_staff ON public.sales_order_items FOR ALL USING (public.is_staff());

-- CUSTOMER NOTIFICATIONS: own or staff
DROP POLICY IF EXISTS cn_own   ON public.customer_notifications;
DROP POLICY IF EXISTS cn_staff ON public.customer_notifications;
CREATE POLICY cn_own ON public.customer_notifications
  FOR ALL USING (customer_id = auth.uid());
CREATE POLICY cn_staff ON public.customer_notifications FOR ALL USING (public.is_staff());

-- CART ITEMS: own or staff
DROP POLICY IF EXISTS cart_own   ON public.cart_items;
DROP POLICY IF EXISTS cart_staff ON public.cart_items;
CREATE POLICY cart_own   ON public.cart_items FOR ALL USING (customer_id = auth.uid());
CREATE POLICY cart_staff ON public.cart_items FOR ALL USING (public.is_staff());

-- ADDRESSES: own or staff
DROP POLICY IF EXISTS addr_own   ON public.addresses;
DROP POLICY IF EXISTS addr_staff ON public.addresses;
CREATE POLICY addr_own   ON public.addresses FOR ALL USING (customer_id = auth.uid());
CREATE POLICY addr_staff ON public.addresses FOR ALL USING (public.is_staff());

-- WISHLISTS: own
DROP POLICY IF EXISTS wish_own ON public.wishlists;
CREATE POLICY wish_own ON public.wishlists FOR ALL USING (customer_id = auth.uid());

-- CUSTOMER QUERIES: own or staff
DROP POLICY IF EXISTS cq_own   ON public.customer_queries;
DROP POLICY IF EXISTS cq_staff ON public.customer_queries;
CREATE POLICY cq_own   ON public.customer_queries FOR ALL USING (customer_id = auth.uid());
CREATE POLICY cq_staff ON public.customer_queries FOR ALL USING (public.is_staff());


-- ════════════════════════════════════════════════════════════
--  FINAL VERIFICATION
-- ════════════════════════════════════════════════════════════

SELECT table_name, 'created' AS status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
