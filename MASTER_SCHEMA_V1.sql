-- ============================================================
--  FFERPv2 — MASTER SCHEMA V1
--  Single clean migration for fresh Supabase project
--  All 102 tables in dependency order. Run once on blank DB.
--  Generated: 2026-05-30
-- ============================================================

-- ════════════════════════════════════════════════════════════
--  PHASE 0 — EXTENSIONS & HELPER FUNCTIONS
-- ════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ════════════════════════════════════════════════════════════
--  PHASE 1 — LAYER 1: NO FOREIGN KEYS
-- ════════════════════════════════════════════════════════════

-- ── PROFILES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                     text NOT NULL,
  name                      text NOT NULL DEFAULT 'New User',
  role                      text NOT NULL DEFAULT 'employee',
  department                text NOT NULL DEFAULT 'General',
  department_type           text,
  office_number             text,
  destination               text,
  is_active                 boolean NOT NULL DEFAULT true,
  login_enabled             boolean NOT NULL DEFAULT true,
  account_activated         boolean DEFAULT false,
  onboarding_completed      boolean DEFAULT false,
  onboarding_status         text DEFAULT 'pending',
  login_credential_password text,
  password                  text,
  username                  text,
  status                    text DEFAULT 'active',
  phone                     text,
  joining_date              date,
  employee_id               text,
  verified_at               timestamptz,
  verified_by               text,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);
CREATE OR REPLACE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── HUBS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hubs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  location     text,
  city         text,
  state        text DEFAULT 'Tamil Nadu',
  code         text,
  display_name text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  CONSTRAINT hubs_name_unique UNIQUE (name)
);

-- ── PRODUCTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.products (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  category         text NOT NULL,
  unit             text NOT NULL DEFAULT 'kg',
  description      text,
  grade_a_price    numeric(10,2) DEFAULT 0,
  grade_b_price    numeric(10,2) DEFAULT 0,
  grade_c_price    numeric(10,2) DEFAULT 0,
  grade_a_discount numeric(5,2)  DEFAULT 0,
  grade_b_discount numeric(5,2)  DEFAULT 0,
  grade_c_discount numeric(5,2)  DEFAULT 0,
  min_order_kg     numeric DEFAULT 0,
  is_active        boolean DEFAULT true,
  image_url        text,
  created_by       uuid,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE OR REPLACE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── VENDORS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendors (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  contact_person text,
  phone          text,
  email          text,
  address        text,
  city           text,
  bank_name      text,
  account_number text,
  ifsc_code      text,
  gst_number     text,
  is_active      boolean DEFAULT true,
  notes          text,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
CREATE OR REPLACE TRIGGER vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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

-- ── RENTAL CATEGORIES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rental_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text UNIQUE NOT NULL,
  description text,
  status      text NOT NULL DEFAULT 'Active',
  created_by  uuid,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ── TRANSPORT CATEGORIES ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transport_categories (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_code        text UNIQUE NOT NULL,
  category_name        text NOT NULL,
  category_description text,
  icon_name            text,
  color_code           text DEFAULT '#6b7280',
  is_active            boolean DEFAULT true,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- ── TRANSPORT VEHICLES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transport_vehicles (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_number text UNIQUE NOT NULL,
  vehicle_type   text,
  vehicle_make   text,
  vehicle_model  text,
  ownership_type text NOT NULL DEFAULT 'own',
  is_active      boolean DEFAULT true,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- ── TRANSPORT DRIVERS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transport_drivers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_name    text NOT NULL,
  driver_phone   text,
  vendor_company text,
  license_number text,
  is_active      boolean DEFAULT true,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);


-- ════════════════════════════════════════════════════════════
--  LAYER 2 — DEPENDS ON profiles + hubs
-- ════════════════════════════════════════════════════════════

-- ── CUSTOMERS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customers (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text NOT NULL,
  shop_name            text,
  owner_name           text,
  first_name           text,
  last_name            text,
  salutation           text,
  phone                text,
  mobile               text,
  email                text,
  address              text,
  area                 text,
  city                 text,
  gst_number           text,
  customer_type        text DEFAULT 'shop' CHECK (customer_type IN ('shop','individual','retail')),
  channel              text DEFAULT 'erp',
  credit_limit         numeric(12,2) DEFAULT 0,
  credit_days          integer DEFAULT 0,
  outstanding          numeric(12,2) DEFAULT 0,
  outstanding_balance  numeric(12,2) DEFAULT 0,
  hub_id               uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  is_active            boolean DEFAULT true,
  assigned_to          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes                text,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customers_shop_name_trgm  ON public.customers USING gin (shop_name  gin_trgm_ops);
CREATE INDEX IF NOT EXISTS customers_name_trgm       ON public.customers USING gin (name       gin_trgm_ops);
CREATE INDEX IF NOT EXISTS customers_first_name_trgm ON public.customers USING gin (first_name gin_trgm_ops);
CREATE OR REPLACE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── MARKET RATES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.market_rates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  market       text NOT NULL,
  rate         numeric(10,2) NOT NULL,
  grade        text DEFAULT 'A',
  date         date NOT NULL DEFAULT CURRENT_DATE,
  recorded_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now()
);

-- ── INVENTORY ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name     text NOT NULL,
  grade            text NOT NULL DEFAULT 'A',
  quantity         numeric(12,2) NOT NULL DEFAULT 0,
  current_stock    numeric GENERATED ALWAYS AS (quantity) STORED,
  max_stock_level  numeric DEFAULT 500,
  min_stock_level  numeric DEFAULT 50,
  unit             text NOT NULL DEFAULT 'kg',
  batch_number     text,
  received_date    date DEFAULT CURRENT_DATE,
  expiry_date      date,
  location         text DEFAULT 'Main Warehouse',
  hub_id           uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  status           text DEFAULT 'available',
  notes            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE OR REPLACE TRIGGER inventory_updated_at BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── SALARY BATCHES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.salary_batches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name      text NOT NULL,
  month           integer CHECK (month BETWEEN 1 AND 12),
  year            integer,
  status          text DEFAULT 'draft' CHECK (status IN ('draft','processing','approved','paid')),
  total_employees integer DEFAULT 0,
  total_amount    numeric(14,2) DEFAULT 0,
  processed_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  processed_at    timestamptz,
  paid_at         timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE OR REPLACE TRIGGER salary_batches_updated_at BEFORE UPDATE ON public.salary_batches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── PURCHASE ORDERS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number        text UNIQUE NOT NULL DEFAULT '',
  vendor_id        uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'draft',
  order_date       date NOT NULL DEFAULT CURRENT_DATE,
  expected_date    date,
  total_amount     numeric(12,2) DEFAULT 0,
  shift            integer CHECK (shift IN (1,2)),
  hub_id           uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  hub_name         text,
  approval_status  text DEFAULT 'pending',
  routed_to        text,
  approved_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at      timestamptz,
  rejection_reason text,
  requester_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes            text,
  vendor_access_token text,
  dispatch_status  text,
  dispatch_date    date,
  invoice_url      text,
  created_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE SEQUENCE IF NOT EXISTS po_seq START 1;
CREATE OR REPLACE FUNCTION public.generate_po_number() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.po_number IS NULL OR NEW.po_number = '' THEN
    NEW.po_number := 'PO-' || TO_CHAR(now(),'YYYYMMDD') || '-' || LPAD(nextval('po_seq')::text,4,'0');
  END IF; RETURN NEW;
END; $$;
CREATE OR REPLACE TRIGGER set_po_number BEFORE INSERT ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.generate_po_number();
CREATE OR REPLACE TRIGGER purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE INDEX IF NOT EXISTS idx_purchase_orders_hub ON public.purchase_orders(hub_id);

-- ── AUDIT LOGS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action            text NOT NULL,
  performed_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  performed_by_name text,
  performed_by_role text,
  record_type       text,
  record_id         text,
  before_state      jsonb,
  after_state       jsonb,
  remarks           text,
  created_at        timestamptz DEFAULT now()
);

-- ── NOTIFICATIONS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  title      text NOT NULL,
  body       text NOT NULL,
  type       text DEFAULT 'info',
  is_read    boolean DEFAULT false,
  link       text,
  created_at timestamptz DEFAULT now()
);

-- ── GEOFENCES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.geofences (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  latitude       numeric(10,7) NOT NULL,
  longitude      numeric(10,7) NOT NULL,
  radius_meters  integer NOT NULL DEFAULT 100,
  action_type    text NOT NULL DEFAULT 'office',
  is_active      boolean DEFAULT true,
  created_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- ── CORE HEADS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.core_heads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department  text NOT NULL,
  title       text,
  is_active   boolean DEFAULT true,
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz DEFAULT now(),
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, department)
);


-- ════════════════════════════════════════════════════════════
--  LAYER 3 — SALES, PURCHASE ITEMS, PROJECTS, LOGISTICS
-- ════════════════════════════════════════════════════════════

-- ── SALES ORDERS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sales_orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number     text UNIQUE DEFAULT '',
  customer_id      uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name    text NOT NULL,
  order_date       date NOT NULL DEFAULT CURRENT_DATE,
  delivery_date    date,
  status           text NOT NULL DEFAULT 'pending',
  payment_mode     text DEFAULT 'cod',
  payment_status   text DEFAULT 'unpaid',
  subtotal         numeric(12,2) DEFAULT 0,
  discount         numeric(12,2) DEFAULT 0,
  total_amount     numeric(12,2) DEFAULT 0,
  net_amount       numeric(12,2),
  amount_paid      numeric(12,2) DEFAULT 0,
  delivery_address text,
  hub_id           uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  hub_name         text,
  shift            integer CHECK (shift IN (1,2)),
  channel          text DEFAULT 'erp',
  source           text DEFAULT 'manual',
  order_source     text DEFAULT 'erp',
  notes            text,
  created_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE SEQUENCE IF NOT EXISTS so_seq START 1;
CREATE OR REPLACE FUNCTION public.generate_order_number() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'SO-' || TO_CHAR(now(),'YYYYMMDD') || '-' || LPAD(nextval('so_seq')::text,4,'0');
  END IF; RETURN NEW;
END; $$;
CREATE OR REPLACE TRIGGER set_order_number BEFORE INSERT ON public.sales_orders FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();
CREATE OR REPLACE TRIGGER sales_orders_updated_at BEFORE UPDATE ON public.sales_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE INDEX IF NOT EXISTS idx_sales_orders_shift  ON public.sales_orders(shift);
CREATE INDEX IF NOT EXISTS idx_sales_orders_hub_id ON public.sales_orders(hub_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON public.sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_channel ON public.sales_orders(channel);

-- ── SALES ORDER ITEMS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sales_order_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id   uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  grade        text DEFAULT 'A',
  quantity     numeric(10,2) NOT NULL,
  qty_kg       numeric GENERATED ALWAYS AS (quantity) STORED,
  unit         text NOT NULL DEFAULT 'kg',
  unit_price   numeric(10,2) NOT NULL,
  discount_pct numeric(5,2) DEFAULT 0,
  total_price  numeric(12,2) DEFAULT 0,
  delivery_date date,
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_order ON public.sales_order_items(order_id);

-- ── PURCHASE ORDER ITEMS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id        uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id   uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity     numeric(10,2) NOT NULL,
  unit         text NOT NULL,
  unit_price   numeric(10,2) NOT NULL,
  total_price  numeric(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  grade        text DEFAULT 'A',
  notes        text
);

-- ── PO → SALES ORDER LINKS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.po_sales_order_links (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id          uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  sales_order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  created_at     timestamptz DEFAULT now(),
  UNIQUE(po_id, sales_order_id)
);

-- ── INVOICES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number   text NOT NULL UNIQUE,
  order_id         uuid REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  customer_id      uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name    text,
  customer_phone   text,
  customer_address text,
  invoice_date     date NOT NULL DEFAULT CURRENT_DATE,
  due_date         date,
  subtotal         numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount  numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount       numeric(12,2) NOT NULL DEFAULT 0,
  total_amount     numeric(12,2) NOT NULL DEFAULT 0,
  payment_mode     text DEFAULT 'cod',
  status           text NOT NULL DEFAULT 'unpaid',
  notes            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE OR REPLACE TRIGGER invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── QC INSPECTIONS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qc_inspections (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id         uuid REFERENCES public.inventory(id) ON DELETE SET NULL,
  transit_record_id    uuid,
  product_name         text NOT NULL,
  batch_number         text,
  inspected_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  inspection_date      date DEFAULT CURRENT_DATE,
  grade_assigned       text,
  quantity_passed      numeric(12,2) DEFAULT 0,
  quantity_rejected    numeric(12,2) DEFAULT 0,
  rejection_reason     text,
  status               text DEFAULT 'passed',
  inspection_checklist jsonb DEFAULT '{}',
  photo_urls           text[] DEFAULT '{}',
  reviewed_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at          timestamptz,
  review_status        text DEFAULT 'submitted',
  notes                text,
  created_at           timestamptz DEFAULT now()
);

-- ── TRANSIT RECORDS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transit_records (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id          uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  hub_id         uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  vehicle_type   text NOT NULL DEFAULT 'own',
  driver_name    text,
  vehicle_number text,
  transit_cost   numeric NOT NULL DEFAULT 0,
  notes          text,
  arrived_at     timestamptz NOT NULL DEFAULT now(),
  status         text NOT NULL DEFAULT 'arrived',
  created_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE SEQUENCE IF NOT EXISTS grn_seq START 1;
CREATE OR REPLACE FUNCTION next_grn_number() RETURNS text LANGUAGE plpgsql AS $$
BEGIN RETURN 'GRN-' || to_char(now(),'YYYY') || '-' || LPAD(nextval('grn_seq')::text,4,'0'); END; $$;
CREATE INDEX IF NOT EXISTS idx_transit_po  ON public.transit_records(po_id);
CREATE INDEX IF NOT EXISTS idx_transit_hub ON public.transit_records(hub_id);

-- ── LOGISTICS TRIPS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.logistics_trips (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_number    text UNIQUE,
  driver_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  vehicle_number text,
  trip_date      date DEFAULT CURRENT_DATE,
  origin         text,
  destination    text,
  status         text DEFAULT 'scheduled',
  orders         uuid[] DEFAULT '{}',
  start_time     timestamptz,
  end_time       timestamptz,
  distance_km    numeric(8,2),
  fuel_cost      numeric(10,2),
  notes          text,
  created_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
CREATE OR REPLACE TRIGGER trips_updated_at BEFORE UPDATE ON public.logistics_trips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── VENDOR PAYMENTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_payments (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id                uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  po_id                    uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  amount                   numeric(12,2) NOT NULL,
  payment_date             date DEFAULT CURRENT_DATE,
  payment_mode             text DEFAULT 'bank_transfer',
  utr_number               text,
  payment_type             text DEFAULT 'full',
  status                   text DEFAULT 'pending_admin',
  deduction_total          numeric DEFAULT 0,
  net_amount               numeric,
  approved_by_admin        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_approved_at        timestamptz,
  approved_by_director     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  director_approved_at     timestamptz,
  rejection_reason         text,
  processed_by             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  utr_reference            text,
  processed_at             timestamptz,
  notes                    text,
  created_by               uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at               timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_status ON public.vendor_payments(status);
CREATE INDEX IF NOT EXISTS idx_payment_po     ON public.vendor_payments(po_id);

-- ── PAYMENT REQUESTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_requests (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  purpose                text NOT NULL,
  vendor_name            text NOT NULL,
  vendor_bank_details    text,
  amount                 numeric(15,2) NOT NULL,
  bill_url               text,
  work_proof_url         text,
  urgency                text NOT NULL DEFAULT 'normal',
  status                 text NOT NULL DEFAULT 'pending',
  project_id             uuid,
  smo_approved_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  smo_approved_at        timestamptz,
  gmo_approved_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  gmo_approved_at        timestamptz,
  gm_approved_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  gm_approved_at         timestamptz,
  admin_approved_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_approved_at      timestamptz,
  admin_rejection_reason text,
  ceo_approved_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ceo_approved_at        timestamptz,
  utr_number             text,
  payment_proof_url      text,
  paid_at                timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE TRIGGER payment_requests_updated_at BEFORE UPDATE ON public.payment_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── DEDUCTION MEMOS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deduction_memos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qc_inspection_id   uuid REFERENCES public.qc_inspections(id) ON DELETE SET NULL,
  vendor_id          uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  po_id              uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  user_id            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deduction_type     text NOT NULL DEFAULT 'quality',
  memo_type          text DEFAULT 'deduction',
  deduction_kg       numeric DEFAULT 0,
  deduction_amount   numeric NOT NULL DEFAULT 0,
  amount             numeric(12,2) DEFAULT 0,
  description        text,
  reason             text,
  month              text,
  year               integer,
  status             text NOT NULL DEFAULT 'pending',
  created_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);
CREATE OR REPLACE TRIGGER deduction_memos_updated_at BEFORE UPDATE ON public.deduction_memos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── PAYMENT DEDUCTION LINES ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_deduction_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id          uuid REFERENCES public.vendor_payments(id) ON DELETE CASCADE,
  payment_request_id  uuid REFERENCES public.payment_requests(id) ON DELETE CASCADE,
  deduction_memo_id   uuid REFERENCES public.deduction_memos(id) ON DELETE SET NULL,
  amount              numeric NOT NULL DEFAULT 0,
  description         text,
  deduction_type      text DEFAULT 'tds',
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ── CRM LEADS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  phone                 text NOT NULL,
  email                 text,
  business_type         text,
  city                  text,
  interest_level        text DEFAULT 'warm',
  status                text DEFAULT 'new',
  assigned_to           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_contacted        date,
  next_followup         date,
  notes                 text,
  converted_to_customer boolean DEFAULT false,
  customer_id           uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);
CREATE OR REPLACE TRIGGER crm_leads_updated_at BEFORE UPDATE ON public.crm_leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ════════════════════════════════════════════════════════════
--  LAYER 4 — HR, DAILY WORKFLOW, PAYROLL
-- ════════════════════════════════════════════════════════════

-- ── DAILY WORKFLOW ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.day_starts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date         date NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  location     text,
  notes        text,
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS public.day_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date            date NOT NULL,
  tasks           text[] NOT NULL DEFAULT '{}',
  expected_output text NOT NULL DEFAULT '',
  submitted_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS public.hourly_plans (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date         date NOT NULL,
  time_slot    integer NOT NULL CHECK (time_slot BETWEEN 1 AND 12),
  plan_text    text NOT NULL,
  submitted_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date, time_slot)
);
CREATE INDEX IF NOT EXISTS idx_hourly_plans_user_date ON public.hourly_plans(user_id, date);

CREATE TABLE IF NOT EXISTS public.hourly_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date         date NOT NULL,
  slot         integer NOT NULL,
  work_done    text NOT NULL,
  is_late      boolean DEFAULT false,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date, slot)
);

CREATE TABLE IF NOT EXISTS public.eod_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date          date NOT NULL,
  summary       text NOT NULL,
  tomorrow_plan text,
  mood          text,
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS public.selfie_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  employee_name text,
  date          date DEFAULT CURRENT_DATE,
  selfie_type   text DEFAULT 'check_in',
  selfie_url    text,
  captured_at   timestamptz DEFAULT now(),
  location      text,
  latitude      numeric(9,6),
  longitude     numeric(9,6),
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_location_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  latitude    numeric(10,7) NOT NULL,
  longitude   numeric(10,7) NOT NULL,
  accuracy    numeric(8,2),
  geofence_id uuid REFERENCES public.geofences(id) ON DELETE SET NULL,
  log_type    text DEFAULT 'tracking',
  logged_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_location_user   ON public.user_location_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_location_logged ON public.user_location_logs(logged_at);

-- ── LEAVE & ATTENDANCE ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_type       text NOT NULL,
  from_date        date NOT NULL,
  to_date          date NOT NULL,
  reason           text NOT NULL,
  status           text NOT NULL DEFAULT 'pending',
  approved_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at      timestamptz,
  rejection_reason text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE OR REPLACE TRIGGER leave_requests_updated_at BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.week_off_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_off_date   date NOT NULL,
  assignment_type text NOT NULL DEFAULT 'one_time',
  recurring_day   integer CHECK (recurring_day BETWEEN 0 AND 6),
  reason          text,
  assigned_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_week_off_employee ON public.week_off_assignments(employee_id);
CREATE OR REPLACE TRIGGER week_off_assignments_updated_at BEFORE UPDATE ON public.week_off_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.attendance_lock_overrides (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date          date NOT NULL,
  override_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason        text NOT NULL,
  override_type text NOT NULL DEFAULT 'unlock',
  created_at    timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS public.hr_attestations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date             date NOT NULL,
  attestation_type text NOT NULL DEFAULT 'daily',
  status           text NOT NULL DEFAULT 'pending',
  attested_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  attested_at      timestamptz,
  notes            text,
  created_at       timestamptz DEFAULT now(),
  UNIQUE(employee_id, date, attestation_type)
);
CREATE INDEX IF NOT EXISTS idx_hr_attestations_employee ON public.hr_attestations(employee_id);

CREATE TABLE IF NOT EXISTS public.onboarding_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  email            text NOT NULL,
  phone            text,
  department       text,
  role             text NOT NULL DEFAULT 'employee',
  requested_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'pending',
  approved_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at      timestamptz,
  rejection_reason text,
  notes            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- ── LOP ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lop_entries (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id                 uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lop_type                    text NOT NULL CHECK (lop_type IN ('1_day','0.5_day','0.25_day','0.1_day')),
  reason                      text,
  auto_reason                 text,
  evidence_url                text,
  lop_date                    date NOT NULL,
  created_by                  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status                      text NOT NULL DEFAULT 'pending_admin',
  source                      text DEFAULT 'manual',
  admin_verified_at           timestamptz,
  admin_verified_by           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ceo_approved_at             timestamptz,
  ceo_approved_by             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejection_reason            text,
  reversal_requested          boolean DEFAULT false,
  reversal_reason             text,
  reversal_proof_url          text,
  reversal_status             text,
  reversal_requested_at       timestamptz,
  reversal_admin_reviewed_at  timestamptz,
  reversal_admin_reviewed_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reversal_boi_reviewed_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reversal_ceo_reviewed_at    timestamptz,
  reversal_ceo_reviewed_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lop_entries_employee_id ON public.lop_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_lop_entries_lop_date    ON public.lop_entries(lop_date);
CREATE INDEX IF NOT EXISTS idx_lop_entries_status      ON public.lop_entries(status);
CREATE OR REPLACE TRIGGER lop_entries_updated_at BEFORE UPDATE ON public.lop_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.lop_audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lop_date        date NOT NULL,
  lop_days        numeric NOT NULL DEFAULT 0,
  reason          text,
  reversal_reason text,
  reversed_at     timestamptz DEFAULT now(),
  reversed_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lop_audit_employee_id ON public.lop_audit_logs(employee_id);

CREATE TABLE IF NOT EXISTS public.employee_lop (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month       text NOT NULL,
  year        integer NOT NULL,
  lop_days    numeric(5,2) DEFAULT 0,
  lop_amount  numeric(12,2) DEFAULT 0,
  reason      text,
  status      text NOT NULL DEFAULT 'pending',
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, month, year)
);

-- ── PAYROLL ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employee_payslips (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month         integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year          integer NOT NULL,
  basic_salary  numeric DEFAULT 0,
  gross_salary  numeric DEFAULT 0,
  net_salary    numeric DEFAULT 0,
  lop_days      numeric DEFAULT 0,
  lop_deduction numeric DEFAULT 0,
  allowances    jsonb DEFAULT '{}',
  deductions    jsonb DEFAULT '{}',
  status        text DEFAULT 'draft' CHECK (status IN ('draft','approved','paid')),
  paid_at       timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(employee_id, month, year)
);
CREATE INDEX IF NOT EXISTS idx_employee_payslips_employee_id ON public.employee_payslips(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_payslips_year_month  ON public.employee_payslips(year, month);
CREATE OR REPLACE TRIGGER employee_payslips_updated_at BEFORE UPDATE ON public.employee_payslips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.salary_batch_employees (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id         uuid NOT NULL REFERENCES public.salary_batches(id) ON DELETE CASCADE,
  employee_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  profile_id       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  employee_name    text NOT NULL DEFAULT '',
  department       text NOT NULL DEFAULT '',
  designation      text,
  basic_salary     numeric(12,2) NOT NULL DEFAULT 0,
  days_in_month    integer NOT NULL DEFAULT 30,
  selected_days    integer NOT NULL DEFAULT 30,
  per_day_salary   numeric(12,2) NOT NULL DEFAULT 0,
  earned_salary    numeric(12,2) NOT NULL DEFAULT 0,
  lop_days         numeric(5,2)  NOT NULL DEFAULT 0,
  lop_amount       numeric(12,2) NOT NULL DEFAULT 0,
  lop_bucket       text NOT NULL DEFAULT '{}',
  increment        numeric(5,2)  NOT NULL DEFAULT 0,
  increment_amount numeric(12,2) NOT NULL DEFAULT 0,
  incentive        numeric(12,2) NOT NULL DEFAULT 0,
  incentive_amount numeric(12,2) NOT NULL DEFAULT 0,
  other_earning    numeric(12,2) NOT NULL DEFAULT 0,
  pf_amount        numeric(12,2) NOT NULL DEFAULT 0,
  esi_amount       numeric(12,2) NOT NULL DEFAULT 0,
  tds              numeric(5,2)  NOT NULL DEFAULT 0,
  tds_amount       numeric(12,2) NOT NULL DEFAULT 0,
  other_deduction  numeric(12,2) NOT NULL DEFAULT 0,
  net_pay          numeric(12,2) NOT NULL DEFAULT 0,
  final_salary     numeric(12,2),
  bank_name        text,
  account_number   text,
  ifsc_code        text,
  slip_path        text,
  status           text NOT NULL DEFAULT 'pending',
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_salary_batch_emp_batch    ON public.salary_batch_employees(batch_id);
CREATE INDEX IF NOT EXISTS idx_salary_batch_emp_employee ON public.salary_batch_employees(employee_id);
CREATE OR REPLACE TRIGGER salary_batch_employees_updated_at BEFORE UPDATE ON public.salary_batch_employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── EMPLOYEE PROFILE EXTRAS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employee_achievements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  category    text NOT NULL DEFAULT 'work',
  proof_url   text,
  achieved_on date,
  is_public   boolean DEFAULT false,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_history (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  change_type    text NOT NULL,
  old_value      text,
  new_value      text,
  description    text,
  effective_date date NOT NULL,
  changed_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employee_history_user ON public.employee_history(user_id);

CREATE TABLE IF NOT EXISTS public.employee_issues (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  issue_type   text NOT NULL,
  title        text NOT NULL,
  description  text,
  severity     text NOT NULL DEFAULT 'medium',
  status       text NOT NULL DEFAULT 'open',
  resolved_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at  timestamptz,
  resolution   text,
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payees (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  bank_name      text,
  account_number text,
  ifsc_code      text,
  phone          text,
  type           text DEFAULT 'individual',
  is_active      boolean DEFAULT true,
  created_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- ── SHIFT SYSTEM ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shift_user_assignments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_hours numeric NOT NULL DEFAULT 8,
  max_hours    numeric NOT NULL DEFAULT 10,
  is_active    boolean NOT NULL DEFAULT true,
  assigned_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at  timestamptz DEFAULT now(),
  created_at   timestamptz DEFAULT now(),
  UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_shift_user_assignments_user_id ON public.shift_user_assignments(user_id);

CREATE TABLE IF NOT EXISTS public.shift_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date        date NOT NULL,
  login_time  timestamptz,
  logout_time timestamptz,
  total_hours numeric DEFAULT 0,
  status      text DEFAULT 'active',
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_shift_sessions_user_id ON public.shift_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_shift_sessions_date    ON public.shift_sessions(date);

CREATE TABLE IF NOT EXISTS public.shift_hourly_slots (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.shift_sessions(id) ON DELETE CASCADE,
  slot_hour  integer NOT NULL,
  task       text,
  status     text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shift_eod_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL REFERENCES public.shift_sessions(id) ON DELETE CASCADE,
  summary      text,
  highlights   text,
  challenges   text,
  submitted_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shift_assignment_history (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action     text NOT NULL,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at timestamptz DEFAULT now(),
  notes      text
);

CREATE TABLE IF NOT EXISTS public.shift_breaks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL REFERENCES public.shift_sessions(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  break_start  timestamptz NOT NULL DEFAULT now(),
  break_end    timestamptz,
  duration_min integer,
  break_type   text DEFAULT 'short',
  notes        text,
  created_at   timestamptz DEFAULT now()
);

-- ── TASK & SOP ASSIGNMENTS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  assigned_to uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date    date,
  priority    text DEFAULT 'medium',
  status      text DEFAULT 'pending',
  progress    integer DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  attachments text[],
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_assignments_assigned_to ON public.task_assignments(assigned_to);
CREATE OR REPLACE TRIGGER task_assignments_updated_at BEFORE UPDATE ON public.task_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.task_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    uuid NOT NULL REFERENCES public.task_assignments(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content    text,
  voice_url  text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments(task_id);

CREATE TABLE IF NOT EXISTS public.sop_assignments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sop_id       uuid,
  title        text NOT NULL,
  description  text,
  category     text,
  document_url text,
  status       text DEFAULT 'not_started',
  assigned_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date     date,
  completed_at timestamptz,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sop_assignments_user_id ON public.sop_assignments(user_id);

-- ── ESCALATIONS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.escalations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raised_by   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title       text NOT NULL,
  description text,
  category    text,
  priority    text DEFAULT 'medium',
  status      text DEFAULT 'open',
  resolution  text,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_escalations_raised_by   ON public.escalations(raised_by);
CREATE INDEX IF NOT EXISTS idx_escalations_assigned_to ON public.escalations(assigned_to);
CREATE OR REPLACE TRIGGER escalations_updated_at BEFORE UPDATE ON public.escalations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ════════════════════════════════════════════════════════════
--  LAYER 5 — PROJECTS & ENGINEERING
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.projects (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                    text UNIQUE NOT NULL DEFAULT ('PRJ-'||substr(gen_random_uuid()::text,1,8)),
  project_name                  text NOT NULL,
  client_name                   text NOT NULL,
  status                        text NOT NULL DEFAULT 'active',
  lifecycle_stage               text DEFAULT 'new_deal',
  intake_status                 text DEFAULT 'pending_admin_review',
  vertical                      text,
  department                    text,
  project_type                  text,
  project_category              text,
  project_category_tags         text[],
  location_city                 text,
  location_state                text,
  contract_value                numeric(15,2) DEFAULT 0,
  base_contract_value           numeric(15,2) DEFAULT 0,
  estimated_start_date          date,
  estimated_end_date            date,
  actual_start_date             date,
  actual_end_date               date,
  assigned_engineer_id          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_site_manager_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_manager_id           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_project_engineer_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by                    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_by_bd_data_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_reviewed_by             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_reviewed_at             timestamptz,
  onboarded_date                date,
  stage_new_deal_at             timestamptz,
  stage_engineering_assigned_at timestamptz,
  stage_boq_submitted_at        timestamptz,
  stage_boq_approved_at         timestamptz,
  stage_sourcing_at             timestamptz,
  stage_execution_at            timestamptz,
  stage_completed_at            timestamptz,
  boq_rejection_reason          text,
  notes                         text,
  created_at                    timestamptz DEFAULT now(),
  updated_at                    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_projects_status    ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_lifecycle ON public.projects(lifecycle_stage);
CREATE OR REPLACE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.project_phases (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_name            text NOT NULL,
  description           text,
  phase_order           integer NOT NULL DEFAULT 1,
  status                text NOT NULL DEFAULT 'pending',
  estimated_cost        numeric(15,2) DEFAULT 0,
  actual_cost           numeric(15,2) DEFAULT 0,
  completion_percentage integer DEFAULT 0 CHECK (completion_percentage BETWEEN 0 AND 100),
  started_at            timestamptz,
  completed_at          timestamptz,
  created_by            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_phases_project ON public.project_phases(project_id);
CREATE OR REPLACE TRIGGER project_phases_updated_at BEFORE UPDATE ON public.project_phases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.project_boq (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_id            uuid REFERENCES public.project_phases(id) ON DELETE SET NULL,
  line_number         integer NOT NULL DEFAULT 1,
  material_name       text NOT NULL,
  specification       text,
  quantity            numeric(12,3) NOT NULL DEFAULT 0,
  unit                text NOT NULL DEFAULT 'nos',
  estimated_unit_cost numeric(12,2),
  actual_unit_cost    numeric(12,2),
  actual_total        numeric(15,2) GENERATED ALWAYS AS (COALESCE(actual_unit_cost,0) * quantity) STORED,
  category            text NOT NULL DEFAULT 'material',
  sourced_via         text,
  linked_po_id        uuid,
  linked_wo_id        uuid,
  status              text NOT NULL DEFAULT 'pending',
  notes               text,
  created_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_boq_project ON public.project_boq(project_id);
CREATE OR REPLACE TRIGGER project_boq_updated_at BEFORE UPDATE ON public.project_boq FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.project_timeline (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title      text NOT NULL,
  description text,
  metadata   jsonb DEFAULT '{}',
  event_date timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_timeline_project ON public.project_timeline(project_id);

CREATE TABLE IF NOT EXISTS public.project_variations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type        text NOT NULL DEFAULT 'addition',
  amount      numeric(15,2) NOT NULL DEFAULT 0,
  category    text NOT NULL,
  description text NOT NULL,
  status      text NOT NULL DEFAULT 'pending',
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_variations_project ON public.project_variations(project_id);
CREATE OR REPLACE TRIGGER project_variations_updated_at BEFORE UPDATE ON public.project_variations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.project_inventory (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_id            uuid REFERENCES public.project_phases(id) ON DELETE SET NULL,
  material_request_id uuid,
  material_name       text NOT NULL,
  specification       text,
  unit                text NOT NULL DEFAULT 'nos',
  quantity_received   numeric(12,3) NOT NULL DEFAULT 0,
  quantity_used       numeric(12,3) NOT NULL DEFAULT 0,
  unit_price          numeric(12,2),
  audit_status        text NOT NULL DEFAULT 'pending',
  audited_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  audited_at          timestamptz,
  audit_notes         text,
  created_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_inventory_project ON public.project_inventory(project_id);
CREATE OR REPLACE TRIGGER project_inventory_updated_at BEFORE UPDATE ON public.project_inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.procurement_timeline (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id   uuid NOT NULL,
  stage       text NOT NULL,
  status      text NOT NULL DEFAULT 'pending',
  actor_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes       text,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_procurement_timeline_project ON public.procurement_timeline(project_id);

CREATE TABLE IF NOT EXISTS public.work_orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_number         text UNIQUE NOT NULL DEFAULT ('WO-'||to_char(now(),'YYYYMMDD')||'-'||substr(gen_random_uuid()::text,1,6)),
  project_id        uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  work_description  text NOT NULL,
  vendor_id         uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  requester_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount            numeric(15,2) DEFAULT 0,
  status            text NOT NULL DEFAULT 'pending',
  smo_approved_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  smo_approved_at   timestamptz,
  gmo_approved_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  gmo_approved_at   timestamptz,
  gm_approved_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  gm_approved_at    timestamptz,
  admin_approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_approved_at timestamptz,
  ceo_approved_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ceo_approved_at   timestamptz,
  rejection_reason  text,
  notes             text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_work_orders_project ON public.work_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status  ON public.work_orders(status);
CREATE OR REPLACE TRIGGER work_orders_updated_at BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── CLIENT COLLECTIONS & ESCALATIONS ────────────────────────
CREATE TABLE IF NOT EXISTS public.client_collections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  collection_date date NOT NULL,
  amount          numeric(15,2) NOT NULL DEFAULT 0,
  payment_mode    text DEFAULT 'bank_transfer',
  utr_number      text,
  remarks         text,
  proof_url       text,
  status          text NOT NULL DEFAULT 'pending',
  verified_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at     timestamptz,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_collections_project ON public.client_collections(project_id);
CREATE OR REPLACE TRIGGER client_collections_updated_at BEFORE UPDATE ON public.client_collections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.client_escalations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number     text UNIQUE NOT NULL DEFAULT ('TKT-'||to_char(now(),'YYYYMMDD')||'-'||substr(gen_random_uuid()::text,1,6)),
  project_id        uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  issue_title       text NOT NULL,
  issue_description text,
  category          text,
  priority          text NOT NULL DEFAULT 'medium',
  urgency           text NOT NULL DEFAULT 'medium',
  status            text NOT NULL DEFAULT 'open',
  ack_late          boolean DEFAULT false,
  sla_hours         integer DEFAULT 24,
  sla_deadline      timestamptz,
  created_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  acknowledged_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  acknowledged_at   timestamptz,
  resolved_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at       timestamptz,
  gm_id             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolution_notes  text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_escalations_status  ON public.client_escalations(status);
CREATE INDEX IF NOT EXISTS idx_client_escalations_project ON public.client_escalations(project_id);
CREATE OR REPLACE TRIGGER client_escalations_updated_at BEFORE UPDATE ON public.client_escalations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.client_escalation_timeline (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escalation_id uuid NOT NULL REFERENCES public.client_escalations(id) ON DELETE CASCADE,
  event_type    text NOT NULL,
  message       text NOT NULL,
  actor_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_escalation_tl ON public.client_escalation_timeline(escalation_id);

-- ── HOURLY CRITICALS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hourly_criticals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number    text UNIQUE DEFAULT ('CRT-'||to_char(now(),'YYYYMMDD')||'-'||substr(gen_random_uuid()::text,1,6)),
  issue_title      text NOT NULL,
  issue_description text,
  urgency          text NOT NULL DEFAULT 'high',
  status           text NOT NULL DEFAULT 'open',
  ack_deadline     timestamptz,
  resolve_deadline timestamptz,
  created_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  acknowledged_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  acknowledged_at  timestamptz,
  resolved_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at      timestamptz,
  metadata         jsonb DEFAULT '{}',
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hourly_criticals_status ON public.hourly_criticals(status);
CREATE OR REPLACE TRIGGER hourly_criticals_updated_at BEFORE UPDATE ON public.hourly_criticals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.hourly_critical_timeline (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  critical_id uuid NOT NULL REFERENCES public.hourly_criticals(id) ON DELETE CASCADE,
  event_type  text NOT NULL,
  message     text NOT NULL,
  actor_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hourly_critical_tl ON public.hourly_critical_timeline(critical_id);


-- ════════════════════════════════════════════════════════════
--  LAYER 6 — TRANSPORT, RENTAL, COLLECTIONS, SALES TOOLS
-- ════════════════════════════════════════════════════════════

-- ── TRANSPORT ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transport_expenses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_date        date NOT NULL,
  from_location    text NOT NULL,
  to_location      text NOT NULL,
  total_km         numeric(8,2)  NOT NULL DEFAULT 0,
  rate_per_km      numeric(8,2)  NOT NULL DEFAULT 0,
  total_amount     numeric(12,2) NOT NULL DEFAULT 0,
  category_code    text REFERENCES public.transport_categories(category_code) ON DELETE SET NULL,
  purpose          text NOT NULL,
  vendor_name      text,
  driver_id        uuid REFERENCES public.transport_drivers(id) ON DELETE SET NULL,
  driver_name      text,
  vehicle_id       uuid REFERENCES public.transport_vehicles(id) ON DELETE SET NULL,
  vehicle_number   text,
  proof_file_url   text NOT NULL DEFAULT '',
  proof_file_name  text,
  proof_file_type  text,
  department       text,
  status           text NOT NULL DEFAULT 'pending',
  payment_status   text NOT NULL DEFAULT 'pending',
  batch_id         uuid,
  is_batch_entry   boolean DEFAULT false,
  rejection_reason text,
  utr_number       text,
  payment_date     date,
  payment_mode     text,
  payment_remarks  text,
  created_by       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transport_expenses_date       ON public.transport_expenses(trip_date);
CREATE INDEX IF NOT EXISTS idx_transport_expenses_status     ON public.transport_expenses(status);
CREATE INDEX IF NOT EXISTS idx_transport_expenses_created_by ON public.transport_expenses(created_by);
CREATE OR REPLACE TRIGGER transport_expenses_updated_at BEFORE UPDATE ON public.transport_expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.transport_batch_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_label  text NOT NULL,
  total_amount numeric(15,2) DEFAULT 0,
  entry_count  integer DEFAULT 0,
  status       text NOT NULL DEFAULT 'pending',
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.transport_split_payments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.transport_expenses(id) ON DELETE CASCADE,
  payee_name text NOT NULL,
  amount     numeric(12,2) NOT NULL DEFAULT 0,
  utr_number text,
  paid_at    timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transport_split_expense ON public.transport_split_payments(expense_id);

-- ── RENTAL ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rental_properties (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                    text NOT NULL,
  category_id              uuid REFERENCES public.rental_categories(id) ON DELETE SET NULL,
  address                  text,
  city                     text,
  state                    text,
  landlord_name            text,
  landlord_phone           text,
  landlord_bank_account    text,
  landlord_bank_ifsc       text,
  landlord_bank_name       text,
  monthly_base_rent        numeric(12,2) NOT NULL DEFAULT 0,
  advance_amount           numeric(12,2) DEFAULT 0,
  quotation_amount         numeric(12,2) DEFAULT 0,
  deduction_percentage     numeric(5,2)  DEFAULT 0,
  moratorium_period        integer DEFAULT 0,
  rent_due_day             integer DEFAULT 1,
  rent_hike_enabled        boolean DEFAULT false,
  rent_hike_percentage     numeric(5,2) DEFAULT 0,
  rent_hike_interval_years integer DEFAULT 1,
  advance_paid_on          date,
  rent_starts_from         date,
  agreement_sign_date      date,
  agreement_end_date       date,
  partner_details          jsonb DEFAULT '[]',
  status                   text NOT NULL DEFAULT 'Active',
  created_by               uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rental_properties_status ON public.rental_properties(status);
CREATE OR REPLACE TRIGGER rental_properties_updated_at BEFORE UPDATE ON public.rental_properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.rental_monthly_records (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.rental_properties(id) ON DELETE CASCADE,
  month       text NOT NULL,
  year        integer NOT NULL,
  rent_amount numeric(12,2) NOT NULL DEFAULT 0,
  deductions  numeric(12,2) DEFAULT 0,
  net_payable numeric(12,2) DEFAULT 0,
  status      text NOT NULL DEFAULT 'pending',
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  paid_at     timestamptz,
  utr_number  text,
  notes       text,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rental_monthly_property ON public.rental_monthly_records(property_id);

CREATE TABLE IF NOT EXISTS public.rental_expenses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  uuid REFERENCES public.rental_properties(id) ON DELETE CASCADE,
  expense_type text NOT NULL,
  amount       numeric(12,2) NOT NULL DEFAULT 0,
  description  text,
  proof_url    text,
  status       text NOT NULL DEFAULT 'pending',
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rental_expenses_property ON public.rental_expenses(property_id);

CREATE TABLE IF NOT EXISTS public.rental_discussions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.rental_properties(id) ON DELETE CASCADE,
  message     text NOT NULL,
  author_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rental_discussions_property ON public.rental_discussions(property_id);

CREATE TABLE IF NOT EXISTS public.rental_property_remarks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.rental_properties(id) ON DELETE CASCADE,
  remark      text NOT NULL,
  author_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

-- ── CASH COLLECTIONS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cash_collections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collector_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_id     uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  collection_date date NOT NULL,
  amount          numeric(12,2) NOT NULL DEFAULT 0,
  payment_mode    text DEFAULT 'cash',
  receipt_number  text,
  notes           text,
  proof_url       text,
  status          text NOT NULL DEFAULT 'pending',
  verified_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at     timestamptz,
  deposited_at    timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cash_collections_collector ON public.cash_collections(collector_id);
CREATE INDEX IF NOT EXISTS idx_cash_collections_date      ON public.cash_collections(collection_date);
CREATE OR REPLACE TRIGGER cash_collections_updated_at BEFORE UPDATE ON public.cash_collections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── SALES & DEMAND TOOLS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sales_targets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id         uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  target_date    date NOT NULL,
  target_type    text NOT NULL DEFAULT 'daily',
  target_revenue numeric(15,2) DEFAULT 0,
  target_orders  integer DEFAULT 0,
  target_qty_kg  numeric(10,2) DEFAULT 0,
  notes          text,
  created_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sales_targets_hub_date ON public.sales_targets(hub_id, target_date);

CREATE TABLE IF NOT EXISTS public.weekly_targets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  hub_id         uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  week_start     date NOT NULL,
  week_end       date NOT NULL,
  target_revenue numeric(15,2) DEFAULT 0,
  target_orders  integer DEFAULT 0,
  target_qty_kg  numeric(10,2) DEFAULT 0,
  created_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.weekly_achievements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  hub_id          uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  week_start      date NOT NULL,
  week_end        date NOT NULL,
  total_revenue   numeric(15,2) DEFAULT 0,
  total_orders    integer DEFAULT 0,
  total_qty_kg    numeric(10,2) DEFAULT 0,
  achievement_pct numeric(5,2) DEFAULT 0,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.demand_forecasts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     uuid REFERENCES public.products(id) ON DELETE CASCADE,
  hub_id         uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  forecast_date  date NOT NULL,
  forecasted_qty numeric(12,3) NOT NULL DEFAULT 0,
  actual_qty     numeric(12,3),
  notes          text,
  created_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_demand_forecasts_date ON public.demand_forecasts(forecast_date);

CREATE TABLE IF NOT EXISTS public.followup_reminders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  assigned_to    uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  follow_up_date date NOT NULL,
  notes          text,
  is_done        boolean DEFAULT false,
  done_at        timestamptz,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_followup_reminders_user ON public.followup_reminders(assigned_to);

CREATE TABLE IF NOT EXISTS public.call_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  caller_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  call_type    text DEFAULT 'outbound',
  duration_sec integer DEFAULT 0,
  outcome      text,
  notes        text,
  called_at    timestamptz DEFAULT now(),
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_call_logs_customer ON public.call_logs(customer_id);

-- ── AI & SYSTEM ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_employee_scores (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date                 date NOT NULL,
  ai_score             numeric(5,2) DEFAULT 0,
  ai_status            text NOT NULL DEFAULT 'idle',
  ai_analysis          text,
  punctuality_score    numeric(5,2) DEFAULT 0,
  plan_quality_score   numeric(5,2) DEFAULT 0,
  report_quality_score numeric(5,2) DEFAULT 0,
  consistency_score    numeric(5,2) DEFAULT 0,
  model_version        text DEFAULT 'v1',
  analysis_timestamp   timestamptz DEFAULT now(),
  last_updated         timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_ai_employee_scores_date ON public.ai_employee_scores(date);

CREATE TABLE IF NOT EXISTS public.system_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  text NOT NULL,
  entity_type text,
  entity_id   uuid,
  payload     jsonb DEFAULT '{}',
  actor_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_system_events_type    ON public.system_events(event_type);
CREATE INDEX IF NOT EXISTS idx_system_events_created ON public.system_events(created_at);

CREATE TABLE IF NOT EXISTS public.bulk_batches (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_type   text NOT NULL,
  batch_label  text NOT NULL,
  total_amount numeric(15,2) DEFAULT 0,
  entry_count  integer DEFAULT 0,
  status       text NOT NULL DEFAULT 'pending',
  metadata     jsonb DEFAULT '{}',
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.qc_rejections (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qc_inspection_id uuid REFERENCES public.qc_inspections(id) ON DELETE CASCADE,
  sales_order_id   uuid REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id       uuid REFERENCES public.products(id) ON DELETE SET NULL,
  rejection_reason text NOT NULL,
  quantity_rejected numeric(10,3) DEFAULT 0,
  unit             text DEFAULT 'kg',
  photos           text[],
  rejected_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved         boolean DEFAULT false,
  resolved_at      timestamptz,
  created_at       timestamptz DEFAULT now()
);


-- ════════════════════════════════════════════════════════════
--  LAYER 7 — CHAT SYSTEM (tables first, policies in Phase 2)
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text,
  type            text NOT NULL DEFAULT 'direct' CHECK (type IN ('direct','group')),
  avatar_url      text,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_message_at timestamptz DEFAULT now(),
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_participants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at    timestamptz DEFAULT now(),
  is_admin        boolean DEFAULT false,
  joined_at       timestamptz DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_chat_participants_conversation ON public.chat_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user         ON public.chat_participants(user_id);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content         text,
  type            text NOT NULL DEFAULT 'text' CHECK (type IN ('text','image','audio','file','video','system')),
  media_url       text,
  metadata        jsonb DEFAULT '{}',
  reply_to_id     uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  is_deleted      boolean DEFAULT false,
  is_edited       boolean DEFAULT false,
  is_pinned       boolean DEFAULT false,
  edited_at       timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON public.chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender       ON public.chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created      ON public.chat_messages(created_at);

CREATE TABLE IF NOT EXISTS public.chat_message_reactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji       text NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS idx_chat_reactions_message ON public.chat_message_reactions(message_id);

CREATE TABLE IF NOT EXISTS public.chat_calls (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid REFERENCES public.chat_conversations(id) ON DELETE SET NULL,
  caller_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  type             text NOT NULL DEFAULT 'voice' CHECK (type IN ('voice','video')),
  status           text NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing','ongoing','ended','declined','missed')),
  started_at       timestamptz,
  ended_at         timestamptz,
  duration_seconds integer DEFAULT 0,
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_calls_caller   ON public.chat_calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_chat_calls_receiver ON public.chat_calls(receiver_id);

CREATE TABLE IF NOT EXISTS public.chat_call_signals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id     uuid NOT NULL REFERENCES public.chat_calls(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('offer','answer','ice-candidate','hangup','reject')),
  payload     jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_signals_call     ON public.chat_call_signals(call_id);
CREATE INDEX IF NOT EXISTS idx_chat_signals_receiver ON public.chat_call_signals(receiver_id);


-- ════════════════════════════════════════════════════════════
--  PHASE 2 — RLS POLICIES (all tables exist now)
-- ════════════════════════════════════════════════════════════

-- ── profiles ─────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile"     ON public.profiles FOR SELECT USING (id = auth.uid());
DROP POLICY IF EXISTS "Managers view all profiles" ON public.profiles;
CREATE POLICY "Managers view all profiles" ON public.profiles FOR SELECT USING (get_my_role() IN ('admin','ceo','gm','hr','director'));
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"   ON public.profiles FOR UPDATE USING (id = auth.uid());
DROP POLICY IF EXISTS "Admins insert profiles" ON public.profiles;
CREATE POLICY "Admins insert profiles"     ON public.profiles FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admins delete profiles" ON public.profiles;
CREATE POLICY "Admins delete profiles"     ON public.profiles FOR DELETE USING (get_my_role() IN ('admin','ceo'));

-- ── hubs ─────────────────────────────────────────────────────
ALTER TABLE public.hubs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all_hubs" ON public.hubs;
CREATE POLICY "authenticated_all_hubs" ON public.hubs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── products ─────────────────────────────────────────────────
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view products" ON public.products;
CREATE POLICY "All staff view products"       ON public.products FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Purchase managers manage products" ON public.products;
CREATE POLICY "Purchase managers manage products" ON public.products FOR ALL USING (get_my_role() IN ('admin','ceo','gm','purchase_manager','purchase_head','back_office'));

-- ── vendors ──────────────────────────────────────────────────
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view vendors" ON public.vendors;
CREATE POLICY "Staff view vendors"   ON public.vendors FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Purchase manage vendors" ON public.vendors;
CREATE POLICY "Purchase manage vendors" ON public.vendors FOR ALL USING (get_my_role() IN ('admin','ceo','gm','purchase_manager','purchase_head','back_office'));

-- ── announcements ────────────────────────────────────────────
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All view announcements" ON public.announcements;
CREATE POLICY "All view announcements"    ON public.announcements FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage announcements" ON public.announcements;
CREATE POLICY "Admins manage announcements" ON public.announcements FOR ALL USING (get_my_role() IN ('admin','ceo','gm'));

-- ── rental_categories ────────────────────────────────────────
ALTER TABLE public.rental_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view rental_categories" ON public.rental_categories;
CREATE POLICY "All staff view rental_categories"  ON public.rental_categories FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admin manage rental_categories" ON public.rental_categories;
CREATE POLICY "Admin manage rental_categories"    ON public.rental_categories FOR ALL USING (get_my_role() IN ('admin','ceo','gm','hr','director'));

-- ── transport_categories/vehicles/drivers ────────────────────
ALTER TABLE public.transport_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view transport_categories" ON public.transport_categories;
CREATE POLICY "All staff view transport_categories" ON public.transport_categories FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admin manage transport_categories" ON public.transport_categories;
CREATE POLICY "Admin manage transport_categories"   ON public.transport_categories FOR ALL USING (get_my_role() IN ('admin','ceo','gm','accounts'));
ALTER TABLE public.transport_vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view transport_vehicles" ON public.transport_vehicles;
CREATE POLICY "All staff view transport_vehicles" ON public.transport_vehicles FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admin manage transport_vehicles" ON public.transport_vehicles;
CREATE POLICY "Admin manage transport_vehicles"   ON public.transport_vehicles FOR ALL USING (get_my_role() IN ('admin','ceo','gm','accounts','logistics'));
ALTER TABLE public.transport_drivers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view transport_drivers" ON public.transport_drivers;
CREATE POLICY "All staff view transport_drivers" ON public.transport_drivers FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admin manage transport_drivers" ON public.transport_drivers;
CREATE POLICY "Admin manage transport_drivers"   ON public.transport_drivers FOR ALL USING (get_my_role() IN ('admin','ceo','gm','accounts','logistics'));

-- ── customers ────────────────────────────────────────────────
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view customers" ON public.customers;
CREATE POLICY "Staff view customers"   ON public.customers FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Sales manage customers" ON public.customers;
CREATE POLICY "Sales manage customers" ON public.customers FOR ALL USING (get_my_role() IN ('admin','ceo','gm','field_executive','tele_caller','back_office','warehouse_manager','bde','nsm','smo'));

-- ── market_rates ─────────────────────────────────────────────
ALTER TABLE public.market_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view market rates" ON public.market_rates;
CREATE POLICY "Staff view market rates"      ON public.market_rates FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Purchase manage rates" ON public.market_rates;
CREATE POLICY "Purchase manage rates"        ON public.market_rates FOR ALL USING (get_my_role() IN ('admin','ceo','gm','purchase_manager','purchase_head','back_office'));

-- ── inventory ────────────────────────────────────────────────
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view inventory" ON public.inventory;
CREATE POLICY "Staff view inventory"        ON public.inventory FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Warehouse manage inventory" ON public.inventory;
CREATE POLICY "Warehouse manage inventory"  ON public.inventory FOR ALL USING (get_my_role() IN ('admin','ceo','gm','warehouse_manager','qc_manager','back_office'));

-- ── salary_batches ───────────────────────────────────────────
ALTER TABLE public.salary_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "HR view salary batches" ON public.salary_batches;
CREATE POLICY "HR view salary batches"     ON public.salary_batches FOR SELECT USING (get_my_role() IN ('admin','ceo','gm','hr','accounts','director'));
DROP POLICY IF EXISTS "HR manage salary batches" ON public.salary_batches;
CREATE POLICY "HR manage salary batches"   ON public.salary_batches FOR ALL USING (get_my_role() IN ('admin','ceo','hr','accounts'));

-- ── purchase_orders ──────────────────────────────────────────
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view POs" ON public.purchase_orders;
CREATE POLICY "Staff view POs"          ON public.purchase_orders FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Purchase manage POs" ON public.purchase_orders;
CREATE POLICY "Purchase manage POs"     ON public.purchase_orders FOR ALL USING (get_my_role() IN ('admin','ceo','gm','purchase_manager','purchase_head','back_office','smo','gmo'));

-- ── audit_logs ───────────────────────────────────────────────
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins view audit logs" ON public.audit_logs;
CREATE POLICY "Admins view audit logs"  ON public.audit_logs FOR SELECT USING (get_my_role() IN ('admin','ceo','gm','hr'));
DROP POLICY IF EXISTS "System inserts logs" ON public.audit_logs;
CREATE POLICY "System inserts logs"     ON public.audit_logs FOR INSERT WITH CHECK (true);

-- ── notifications ────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own notifications" ON public.notifications;
CREATE POLICY "Users manage own notifications" ON public.notifications FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "System inserts notifications" ON public.notifications;
CREATE POLICY "System inserts notifications"   ON public.notifications FOR INSERT WITH CHECK (true);

-- ── geofences ────────────────────────────────────────────────
ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view geofences" ON public.geofences;
CREATE POLICY "All staff view geofences" ON public.geofences FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admin manage geofences" ON public.geofences;
CREATE POLICY "Admin manage geofences"   ON public.geofences FOR ALL USING (get_my_role() IN ('admin','ceo','gm','hr'));

-- ── core_heads ───────────────────────────────────────────────
ALTER TABLE public.core_heads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view core_heads" ON public.core_heads;
CREATE POLICY "All staff view core_heads" ON public.core_heads FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admin manage core_heads" ON public.core_heads;
CREATE POLICY "Admin manage core_heads"   ON public.core_heads FOR ALL USING (get_my_role() IN ('admin','ceo'));

-- ── sales_orders ─────────────────────────────────────────────
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view orders" ON public.sales_orders;
CREATE POLICY "Staff view orders"       ON public.sales_orders FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Sales manage orders" ON public.sales_orders;
CREATE POLICY "Sales manage orders"     ON public.sales_orders FOR ALL USING (get_my_role() IN ('admin','ceo','gm','field_executive','tele_caller','back_office','warehouse_manager','bde','nsm','smo','gmo'));

ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view order items" ON public.sales_order_items;
CREATE POLICY "Staff view order items"  ON public.sales_order_items FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Sales manage order items" ON public.sales_order_items;
CREATE POLICY "Sales manage order items" ON public.sales_order_items FOR ALL USING (get_my_role() IN ('admin','ceo','gm','field_executive','tele_caller','back_office','warehouse_manager','bde','nsm','smo'));

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view PO items" ON public.purchase_order_items;
CREATE POLICY "Staff view PO items"     ON public.purchase_order_items FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Purchase manage PO items" ON public.purchase_order_items;
CREATE POLICY "Purchase manage PO items" ON public.purchase_order_items FOR ALL USING (get_my_role() IN ('admin','ceo','gm','purchase_manager','purchase_head','back_office'));

ALTER TABLE public.po_sales_order_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_po_links" ON public.po_sales_order_links;
CREATE POLICY "authenticated_po_links"  ON public.po_sales_order_links FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.invoices TO anon, authenticated;

ALTER TABLE public.qc_inspections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view QC" ON public.qc_inspections;
CREATE POLICY "Staff view QC"          ON public.qc_inspections FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "QC manage inspections" ON public.qc_inspections;
CREATE POLICY "QC manage inspections"  ON public.qc_inspections FOR ALL USING (get_my_role() IN ('admin','ceo','gm','warehouse_manager','qc_manager','back_office'));

ALTER TABLE public.transit_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ops_transit_all" ON public.transit_records;
CREATE POLICY "ops_transit_all" ON public.transit_records FOR ALL USING (true);

ALTER TABLE public.logistics_trips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view trips" ON public.logistics_trips;
CREATE POLICY "Staff view trips"        ON public.logistics_trips FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Logistics manage trips" ON public.logistics_trips;
CREATE POLICY "Logistics manage trips"  ON public.logistics_trips FOR ALL USING (get_my_role() IN ('admin','ceo','gm','driver','warehouse_manager','back_office'));

ALTER TABLE public.vendor_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Finance manage vendor payments" ON public.vendor_payments;
CREATE POLICY "Finance manage vendor payments" ON public.vendor_payments FOR ALL USING (get_my_role() IN ('admin','ceo','gm','accounts','purchase_manager','purchase_head','back_office','director'));

ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own requests" ON public.payment_requests;
CREATE POLICY "Users view own requests"  ON public.payment_requests FOR SELECT USING (requester_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','accounts','smo','gmo','director'));
DROP POLICY IF EXISTS "Users create requests" ON public.payment_requests;
CREATE POLICY "Users create requests"    ON public.payment_requests FOR INSERT WITH CHECK (requester_id = auth.uid());
DROP POLICY IF EXISTS "Admins update requests" ON public.payment_requests;
CREATE POLICY "Admins update requests"   ON public.payment_requests FOR UPDATE USING (get_my_role() IN ('admin','ceo','accounts','gm','smo','gmo','director'));

ALTER TABLE public.deduction_memos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ops_deductions_all" ON public.deduction_memos;
CREATE POLICY "ops_deductions_all" ON public.deduction_memos FOR ALL USING (true);

ALTER TABLE public.payment_deduction_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ops_deduction_lines_all" ON public.payment_deduction_lines;
CREATE POLICY "ops_deduction_lines_all" ON public.payment_deduction_lines FOR ALL USING (true);

ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tele callers manage leads" ON public.crm_leads;
CREATE POLICY "Tele callers manage leads" ON public.crm_leads FOR ALL USING (get_my_role() IN ('admin','ceo','gm','tele_caller','field_executive','back_office','bde') OR assigned_to = auth.uid());

-- ── daily workflow ───────────────────────────────────────────
ALTER TABLE public.day_starts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own day starts" ON public.day_starts;
CREATE POLICY "Users manage own day starts" ON public.day_starts FOR ALL USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr','datateam','boi'));
ALTER TABLE public.day_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own day plans" ON public.day_plans;
CREATE POLICY "Users manage own day plans"  ON public.day_plans FOR ALL USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr','datateam','boi'));
ALTER TABLE public.hourly_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own hourly_plans" ON public.hourly_plans;
CREATE POLICY "Users manage own hourly_plans" ON public.hourly_plans FOR ALL USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr','datateam','boi'));
ALTER TABLE public.hourly_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own hourly reports" ON public.hourly_reports;
CREATE POLICY "Users manage own hourly reports" ON public.hourly_reports FOR ALL USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr','datateam','boi'));
ALTER TABLE public.eod_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own EOD reports" ON public.eod_reports;
CREATE POLICY "Users manage own EOD reports" ON public.eod_reports FOR ALL USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr','datateam','boi'));
ALTER TABLE public.selfie_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all_selfie" ON public.selfie_records;
CREATE POLICY "authenticated_all_selfie" ON public.selfie_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.user_location_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users log own location" ON public.user_location_logs;
CREATE POLICY "Users log own location" ON public.user_location_logs FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Admin view location_logs" ON public.user_location_logs;
CREATE POLICY "Admin view location_logs" ON public.user_location_logs FOR SELECT USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr'));

-- ── leave & HR ───────────────────────────────────────────────
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own leaves" ON public.leave_requests;
CREATE POLICY "Users manage own leaves" ON public.leave_requests FOR ALL USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr'));
ALTER TABLE public.week_off_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage week_off" ON public.week_off_assignments;
CREATE POLICY "Admin manage week_off" ON public.week_off_assignments FOR ALL USING (get_my_role() IN ('admin','ceo','hr','gm'));
DROP POLICY IF EXISTS "Users view own week_off" ON public.week_off_assignments;
CREATE POLICY "Users view own week_off" ON public.week_off_assignments FOR SELECT USING (employee_id = auth.uid());
ALTER TABLE public.attendance_lock_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage overrides" ON public.attendance_lock_overrides;
CREATE POLICY "Admin manage overrides" ON public.attendance_lock_overrides FOR ALL USING (get_my_role() IN ('admin','ceo','hr'));
DROP POLICY IF EXISTS "Users view own overrides" ON public.attendance_lock_overrides;
CREATE POLICY "Users view own overrides" ON public.attendance_lock_overrides FOR SELECT USING (user_id = auth.uid());
ALTER TABLE public.hr_attestations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "HR manage attestations" ON public.hr_attestations;
CREATE POLICY "HR manage attestations" ON public.hr_attestations FOR ALL USING (get_my_role() IN ('admin','ceo','hr'));
DROP POLICY IF EXISTS "HR view attestations" ON public.hr_attestations;
CREATE POLICY "HR view attestations"   ON public.hr_attestations FOR SELECT USING (get_my_role() IN ('admin','ceo','hr','gm') OR employee_id = auth.uid());
ALTER TABLE public.onboarding_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "HR manage onboarding_requests" ON public.onboarding_requests;
CREATE POLICY "HR manage onboarding_requests" ON public.onboarding_requests FOR ALL USING (get_my_role() IN ('admin','ceo','hr'));

-- ── LOP ──────────────────────────────────────────────────────
ALTER TABLE public.lop_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "HR Admin view all lop entries" ON public.lop_entries;
CREATE POLICY "HR Admin view all lop entries"  ON public.lop_entries FOR SELECT USING (get_my_role() IN ('admin','ceo','hr','gm','boi','director','accounts'));
DROP POLICY IF EXISTS "Employees view own lop entries" ON public.lop_entries;
CREATE POLICY "Employees view own lop entries" ON public.lop_entries FOR SELECT USING (employee_id = auth.uid());
DROP POLICY IF EXISTS "HR manage lop entries" ON public.lop_entries;
CREATE POLICY "HR manage lop entries"          ON public.lop_entries FOR ALL USING (get_my_role() IN ('admin','ceo','hr','gm','boi'));
ALTER TABLE public.lop_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "HR manage lop audit logs" ON public.lop_audit_logs;
CREATE POLICY "HR manage lop audit logs" ON public.lop_audit_logs FOR ALL USING (get_my_role() IN ('admin','ceo','hr','gm'));
ALTER TABLE public.employee_lop ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "HR manage employee_lop" ON public.employee_lop;
CREATE POLICY "HR manage employee_lop"  ON public.employee_lop FOR ALL USING (get_my_role() IN ('admin','ceo','gm','hr','director'));
DROP POLICY IF EXISTS "Users view own lop" ON public.employee_lop;
CREATE POLICY "Users view own lop"      ON public.employee_lop FOR SELECT USING (user_id = auth.uid());

-- ── payroll ──────────────────────────────────────────────────
ALTER TABLE public.employee_payslips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Employees view own payslips" ON public.employee_payslips;
CREATE POLICY "Employees view own payslips" ON public.employee_payslips FOR SELECT USING (employee_id = auth.uid());
DROP POLICY IF EXISTS "HR Admin manage payslips" ON public.employee_payslips;
CREATE POLICY "HR Admin manage payslips"    ON public.employee_payslips FOR ALL USING (get_my_role() IN ('admin','ceo','hr','accounts','director'));
ALTER TABLE public.salary_batch_employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "HR view salary_batch_employees" ON public.salary_batch_employees;
CREATE POLICY "HR view salary_batch_employees" ON public.salary_batch_employees FOR SELECT USING (get_my_role() IN ('admin','ceo','gm','hr','accounts','director') OR employee_id = auth.uid() OR profile_id = auth.uid());
DROP POLICY IF EXISTS "HR manage salary_batch_employees" ON public.salary_batch_employees;
CREATE POLICY "HR manage salary_batch_employees" ON public.salary_batch_employees FOR ALL USING (get_my_role() IN ('admin','ceo','hr','accounts'));

-- ── employee extras ──────────────────────────────────────────
ALTER TABLE public.employee_achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own achievements" ON public.employee_achievements;
CREATE POLICY "Users view own achievements" ON public.employee_achievements FOR SELECT USING (user_id = auth.uid() OR is_public = true OR get_my_role() IN ('admin','ceo','gm','hr','director'));
DROP POLICY IF EXISTS "Managers manage achievements" ON public.employee_achievements;
CREATE POLICY "Managers manage achievements" ON public.employee_achievements FOR ALL USING (get_my_role() IN ('admin','ceo','gm','hr','director'));
ALTER TABLE public.employee_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own history" ON public.employee_history;
CREATE POLICY "Users view own history" ON public.employee_history FOR SELECT USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr','director'));
DROP POLICY IF EXISTS "Managers create history" ON public.employee_history;
CREATE POLICY "Managers create history" ON public.employee_history FOR INSERT WITH CHECK (get_my_role() IN ('admin','ceo','gm','hr','director'));
ALTER TABLE public.employee_issues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Managers manage issues" ON public.employee_issues;
CREATE POLICY "Managers manage issues" ON public.employee_issues FOR ALL USING (get_my_role() IN ('admin','ceo','gm','hr','director'));
ALTER TABLE public.payees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authorized view payees" ON public.payees;
CREATE POLICY "Authorized view payees" ON public.payees FOR SELECT USING (get_my_role() IN ('admin','ceo','gm','accounts','finance','director'));
DROP POLICY IF EXISTS "Accounts manage payees" ON public.payees;
CREATE POLICY "Accounts manage payees" ON public.payees FOR ALL USING (get_my_role() IN ('admin','ceo','accounts','finance'));

-- ── shift system ─────────────────────────────────────────────
ALTER TABLE public.shift_user_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage shift assignments" ON public.shift_user_assignments;
CREATE POLICY "Admins manage shift assignments" ON public.shift_user_assignments FOR ALL USING (get_my_role() IN ('admin','ceo','hr','gm'));
DROP POLICY IF EXISTS "Users view own shift assignment" ON public.shift_user_assignments;
CREATE POLICY "Users view own shift assignment" ON public.shift_user_assignments FOR SELECT USING (user_id = auth.uid());
ALTER TABLE public.shift_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own shift sessions" ON public.shift_sessions;
CREATE POLICY "Users manage own shift sessions" ON public.shift_sessions FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins view all shift sessions" ON public.shift_sessions;
CREATE POLICY "Admins view all shift sessions"  ON public.shift_sessions FOR SELECT USING (get_my_role() IN ('admin','ceo','hr','gm'));
ALTER TABLE public.shift_hourly_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own hourly slots" ON public.shift_hourly_slots;
CREATE POLICY "Users manage own hourly slots"  ON public.shift_hourly_slots FOR ALL USING (EXISTS (SELECT 1 FROM public.shift_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()));
DROP POLICY IF EXISTS "Admins view all hourly slots" ON public.shift_hourly_slots;
CREATE POLICY "Admins view all hourly slots"   ON public.shift_hourly_slots FOR SELECT USING (get_my_role() IN ('admin','ceo','hr','gm'));
ALTER TABLE public.shift_eod_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own eod reports" ON public.shift_eod_reports;
CREATE POLICY "Users manage own eod reports"   ON public.shift_eod_reports FOR ALL USING (EXISTS (SELECT 1 FROM public.shift_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()));
DROP POLICY IF EXISTS "Admins view all eod reports" ON public.shift_eod_reports;
CREATE POLICY "Admins view all eod reports"    ON public.shift_eod_reports FOR SELECT USING (get_my_role() IN ('admin','ceo','hr','gm'));
ALTER TABLE public.shift_assignment_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage shift history" ON public.shift_assignment_history;
CREATE POLICY "Admins manage shift history" ON public.shift_assignment_history FOR ALL USING (get_my_role() IN ('admin','ceo','hr','gm'));
ALTER TABLE public.shift_breaks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own shift_breaks" ON public.shift_breaks;
CREATE POLICY "Users manage own shift_breaks" ON public.shift_breaks FOR ALL USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr'));

-- ── tasks & SOPs ─────────────────────────────────────────────
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own tasks" ON public.task_assignments;
CREATE POLICY "Users view own tasks"    ON public.task_assignments FOR SELECT USING (assigned_to = auth.uid() OR assigned_by = auth.uid());
DROP POLICY IF EXISTS "Admins view all tasks" ON public.task_assignments;
CREATE POLICY "Admins view all tasks"   ON public.task_assignments FOR SELECT USING (get_my_role() IN ('admin','ceo','gm','hr','boi','director'));
DROP POLICY IF EXISTS "Users update own tasks" ON public.task_assignments;
CREATE POLICY "Users update own tasks"  ON public.task_assignments FOR UPDATE USING (assigned_to = auth.uid());
DROP POLICY IF EXISTS "Admins manage all tasks" ON public.task_assignments;
CREATE POLICY "Admins manage all tasks" ON public.task_assignments FOR ALL USING (get_my_role() IN ('admin','ceo','gm','hr','boi','director'));
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Task members view comments" ON public.task_comments;
CREATE POLICY "Task members view comments" ON public.task_comments FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Task members add comments" ON public.task_comments;
CREATE POLICY "Task members add comments"  ON public.task_comments FOR INSERT WITH CHECK (user_id = auth.uid());
ALTER TABLE public.sop_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own sop assignments" ON public.sop_assignments;
CREATE POLICY "Users view own sop assignments"   ON public.sop_assignments FOR SELECT USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr','boi','director'));
DROP POLICY IF EXISTS "Users update own sop assignments" ON public.sop_assignments;
CREATE POLICY "Users update own sop assignments" ON public.sop_assignments FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins manage sop assignments" ON public.sop_assignments;
CREATE POLICY "Admins manage sop assignments"    ON public.sop_assignments FOR ALL USING (get_my_role() IN ('admin','ceo','gm','hr','boi','director'));

-- ── escalations ──────────────────────────────────────────────
ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own escalations" ON public.escalations;
CREATE POLICY "Users view own escalations"    ON public.escalations FOR SELECT USING (raised_by = auth.uid() OR assigned_to = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr','boi','smo','gmo','nsm','director'));
DROP POLICY IF EXISTS "Users create escalations" ON public.escalations;
CREATE POLICY "Users create escalations"      ON public.escalations FOR INSERT WITH CHECK (raised_by = auth.uid());
DROP POLICY IF EXISTS "Admins manage all escalations" ON public.escalations;
CREATE POLICY "Admins manage all escalations" ON public.escalations FOR ALL USING (get_my_role() IN ('admin','ceo','gm','hr','boi','smo','gmo','nsm','director'));

-- ── projects ─────────────────────────────────────────────────
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view projects" ON public.projects;
CREATE POLICY "All staff view projects"     ON public.projects FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated insert projects" ON public.projects;
CREATE POLICY "Authenticated insert projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Engineers update projects" ON public.projects;
CREATE POLICY "Engineers update projects"   ON public.projects FOR UPDATE USING (assigned_engineer_id = auth.uid() OR assigned_site_manager_id = auth.uid() OR assigned_manager_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','gmo','smo','director'));
ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view phases" ON public.project_phases;
CREATE POLICY "All staff view phases"    ON public.project_phases FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Engineers manage phases" ON public.project_phases;
CREATE POLICY "Engineers manage phases"  ON public.project_phases FOR ALL USING (get_my_role() IN ('admin','ceo','gm','gmo','smo','engineer','site_manager','director'));
ALTER TABLE public.project_boq ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view boq" ON public.project_boq;
CREATE POLICY "All staff view boq"    ON public.project_boq FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Engineers manage boq" ON public.project_boq;
CREATE POLICY "Engineers manage boq"  ON public.project_boq FOR ALL USING (get_my_role() IN ('admin','ceo','gm','gmo','smo','engineer','site_manager','director','purchase_head','purchase_manager'));
ALTER TABLE public.project_timeline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view timeline" ON public.project_timeline;
CREATE POLICY "All staff view timeline" ON public.project_timeline FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Staff create timeline" ON public.project_timeline;
CREATE POLICY "Staff create timeline"   ON public.project_timeline FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
ALTER TABLE public.project_variations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view variations" ON public.project_variations;
CREATE POLICY "All staff view variations"  ON public.project_variations FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admin manage variations" ON public.project_variations;
CREATE POLICY "Admin manage variations"    ON public.project_variations FOR ALL USING (get_my_role() IN ('admin','ceo','gm','gmo','director'));
ALTER TABLE public.project_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view project_inventory" ON public.project_inventory;
CREATE POLICY "All staff view project_inventory" ON public.project_inventory FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Engineers manage project_inventory" ON public.project_inventory;
CREATE POLICY "Engineers manage project_inventory" ON public.project_inventory FOR ALL USING (get_my_role() IN ('admin','ceo','gm','gmo','smo','engineer','site_manager','director'));
ALTER TABLE public.procurement_timeline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view procurement timeline" ON public.procurement_timeline;
CREATE POLICY "All staff view procurement timeline" ON public.procurement_timeline FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated add procurement event" ON public.procurement_timeline;
CREATE POLICY "Authenticated add procurement event" ON public.procurement_timeline FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view work_orders" ON public.work_orders;
CREATE POLICY "All staff view work_orders" ON public.work_orders FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated create work_orders" ON public.work_orders;
CREATE POLICY "Authenticated create work_orders" ON public.work_orders FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admin manage work_orders" ON public.work_orders;
CREATE POLICY "Admin manage work_orders" ON public.work_orders FOR UPDATE USING (get_my_role() IN ('admin','ceo','gm','gmo','smo','director') OR requester_id = auth.uid());

-- ── collections ──────────────────────────────────────────────
ALTER TABLE public.client_collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view client_collections" ON public.client_collections;
CREATE POLICY "All staff view client_collections"       ON public.client_collections FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated manage client_collections" ON public.client_collections;
CREATE POLICY "Authenticated manage client_collections" ON public.client_collections FOR ALL USING (auth.uid() IS NOT NULL);
ALTER TABLE public.client_escalations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view client_escalations" ON public.client_escalations;
CREATE POLICY "All staff view client_escalations"       ON public.client_escalations FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated create client_escalations" ON public.client_escalations;
CREATE POLICY "Authenticated create client_escalations" ON public.client_escalations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admin manage client_escalations" ON public.client_escalations;
CREATE POLICY "Admin manage client_escalations"         ON public.client_escalations FOR UPDATE USING (get_my_role() IN ('admin','ceo','gm','gmo','smo','director') OR created_by = auth.uid());
ALTER TABLE public.client_escalation_timeline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view escalation_timeline" ON public.client_escalation_timeline;
CREATE POLICY "All staff view escalation_timeline"  ON public.client_escalation_timeline FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated add timeline entry" ON public.client_escalation_timeline;
CREATE POLICY "Authenticated add timeline entry"    ON public.client_escalation_timeline FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
ALTER TABLE public.hourly_criticals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view hourly_criticals" ON public.hourly_criticals;
CREATE POLICY "All staff view hourly_criticals" ON public.hourly_criticals FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated create hourly_criticals" ON public.hourly_criticals;
CREATE POLICY "Authenticated create hourly_criticals" ON public.hourly_criticals FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Managers update hourly_criticals" ON public.hourly_criticals;
CREATE POLICY "Managers update hourly_criticals" ON public.hourly_criticals FOR UPDATE USING (get_my_role() IN ('admin','ceo','gm','gmo','smo','datateam'));
ALTER TABLE public.hourly_critical_timeline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view critical_timeline" ON public.hourly_critical_timeline;
CREATE POLICY "All staff view critical_timeline" ON public.hourly_critical_timeline FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated add critical_timeline" ON public.hourly_critical_timeline;
CREATE POLICY "Authenticated add critical_timeline" ON public.hourly_critical_timeline FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── transport ────────────────────────────────────────────────
ALTER TABLE public.transport_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own transport_expenses" ON public.transport_expenses;
CREATE POLICY "Users view own transport_expenses" ON public.transport_expenses FOR SELECT USING (created_by = auth.uid() OR get_my_role() IN ('admin','ceo','gm','accounts','logistics','director'));
DROP POLICY IF EXISTS "Users create transport_expenses" ON public.transport_expenses;
CREATE POLICY "Users create transport_expenses"   ON public.transport_expenses FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Approvers manage transport_expenses" ON public.transport_expenses;
CREATE POLICY "Approvers manage transport_expenses" ON public.transport_expenses FOR UPDATE USING (created_by = auth.uid() OR get_my_role() IN ('admin','ceo','gm','accounts','logistics','director'));
ALTER TABLE public.transport_batch_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view transport_batch_entries" ON public.transport_batch_entries;
CREATE POLICY "All staff view transport_batch_entries"      ON public.transport_batch_entries FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated manage transport_batch_entries" ON public.transport_batch_entries;
CREATE POLICY "Authenticated manage transport_batch_entries" ON public.transport_batch_entries FOR ALL USING (get_my_role() IN ('admin','ceo','gm','accounts','logistics'));
ALTER TABLE public.transport_split_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view transport_split" ON public.transport_split_payments;
CREATE POLICY "All staff view transport_split"  ON public.transport_split_payments FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Accounts manage transport_split" ON public.transport_split_payments;
CREATE POLICY "Accounts manage transport_split" ON public.transport_split_payments FOR ALL USING (get_my_role() IN ('admin','ceo','accounts'));

-- ── rental ───────────────────────────────────────────────────
ALTER TABLE public.rental_properties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view rental_properties" ON public.rental_properties;
CREATE POLICY "All staff view rental_properties"    ON public.rental_properties FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authorized manage rental_properties" ON public.rental_properties;
CREATE POLICY "Authorized manage rental_properties" ON public.rental_properties FOR ALL USING (get_my_role() IN ('admin','ceo','gm','hr','director','rsh','accounts'));
ALTER TABLE public.rental_monthly_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view rental_monthly" ON public.rental_monthly_records;
CREATE POLICY "All staff view rental_monthly"    ON public.rental_monthly_records FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authorized manage rental_monthly" ON public.rental_monthly_records;
CREATE POLICY "Authorized manage rental_monthly" ON public.rental_monthly_records FOR ALL USING (get_my_role() IN ('admin','ceo','gm','hr','director','rsh','accounts'));
ALTER TABLE public.rental_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view rental_expenses" ON public.rental_expenses;
CREATE POLICY "All staff view rental_expenses"    ON public.rental_expenses FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authorized manage rental_expenses" ON public.rental_expenses;
CREATE POLICY "Authorized manage rental_expenses" ON public.rental_expenses FOR ALL USING (get_my_role() IN ('admin','ceo','gm','hr','director','rsh','accounts'));
ALTER TABLE public.rental_discussions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view rental_discussions" ON public.rental_discussions;
CREATE POLICY "All staff view rental_discussions"     ON public.rental_discussions FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated post rental_discussions" ON public.rental_discussions;
CREATE POLICY "Authenticated post rental_discussions" ON public.rental_discussions FOR INSERT WITH CHECK (author_id = auth.uid());
ALTER TABLE public.rental_property_remarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view rental_remarks" ON public.rental_property_remarks;
CREATE POLICY "All staff view rental_remarks"     ON public.rental_property_remarks FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated post rental_remarks" ON public.rental_property_remarks;
CREATE POLICY "Authenticated post rental_remarks" ON public.rental_property_remarks FOR INSERT WITH CHECK (author_id = auth.uid());

-- ── cash collections ─────────────────────────────────────────
ALTER TABLE public.cash_collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own cash_collections" ON public.cash_collections;
CREATE POLICY "Users view own cash_collections"       ON public.cash_collections FOR SELECT USING (collector_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','accounts','director'));
DROP POLICY IF EXISTS "Authenticated create cash_collections" ON public.cash_collections;
CREATE POLICY "Authenticated create cash_collections" ON public.cash_collections FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Approvers update cash_collections" ON public.cash_collections;
CREATE POLICY "Approvers update cash_collections"     ON public.cash_collections FOR UPDATE USING (get_my_role() IN ('admin','ceo','gm','accounts'));

-- ── sales tools ──────────────────────────────────────────────
ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view sales_targets" ON public.sales_targets;
CREATE POLICY "All staff view sales_targets"    ON public.sales_targets FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Managers manage sales_targets" ON public.sales_targets;
CREATE POLICY "Managers manage sales_targets"   ON public.sales_targets FOR ALL USING (get_my_role() IN ('admin','ceo','gm','nsm','smo','director'));
ALTER TABLE public.weekly_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view weekly_targets" ON public.weekly_targets;
CREATE POLICY "All staff view weekly_targets"   ON public.weekly_targets FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Managers manage weekly_targets" ON public.weekly_targets;
CREATE POLICY "Managers manage weekly_targets"  ON public.weekly_targets FOR ALL USING (get_my_role() IN ('admin','ceo','gm','nsm','smo','director'));
ALTER TABLE public.weekly_achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view weekly_achievements" ON public.weekly_achievements;
CREATE POLICY "All staff view weekly_achievements" ON public.weekly_achievements FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Managers manage weekly_achievements" ON public.weekly_achievements;
CREATE POLICY "Managers manage weekly_achievements" ON public.weekly_achievements FOR ALL USING (get_my_role() IN ('admin','ceo','gm','nsm','smo','director'));
ALTER TABLE public.demand_forecasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view demand_forecasts" ON public.demand_forecasts;
CREATE POLICY "All staff view demand_forecasts"   ON public.demand_forecasts FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Managers manage demand_forecasts" ON public.demand_forecasts;
CREATE POLICY "Managers manage demand_forecasts"  ON public.demand_forecasts FOR ALL USING (get_my_role() IN ('admin','ceo','gm','purchase_head','nsm','director'));
ALTER TABLE public.followup_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own reminders" ON public.followup_reminders;
CREATE POLICY "Users manage own reminders"  ON public.followup_reminders FOR ALL USING (assigned_to = auth.uid() OR get_my_role() IN ('admin','ceo','gm','nsm'));
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own call_logs" ON public.call_logs;
CREATE POLICY "Users view own call_logs"       ON public.call_logs FOR SELECT USING (caller_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','nsm','smo'));
DROP POLICY IF EXISTS "Authenticated create call_logs" ON public.call_logs;
CREATE POLICY "Authenticated create call_logs" ON public.call_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── AI & system ──────────────────────────────────────────────
ALTER TABLE public.ai_employee_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own ai_scores" ON public.ai_employee_scores;
CREATE POLICY "Users view own ai_scores" ON public.ai_employee_scores FOR SELECT USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr','datateam'));
DROP POLICY IF EXISTS "AI system manage scores" ON public.ai_employee_scores;
CREATE POLICY "AI system manage scores"  ON public.ai_employee_scores FOR ALL USING (get_my_role() IN ('admin','ceo','datateam'));
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin view system_events" ON public.system_events;
CREATE POLICY "Admin view system_events" ON public.system_events FOR SELECT USING (get_my_role() IN ('admin','ceo','datateam'));
DROP POLICY IF EXISTS "System insert events" ON public.system_events;
CREATE POLICY "System insert events"     ON public.system_events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
ALTER TABLE public.bulk_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authorized view bulk_batches" ON public.bulk_batches;
CREATE POLICY "Authorized view bulk_batches"   ON public.bulk_batches FOR SELECT USING (get_my_role() IN ('admin','ceo','accounts','hr'));
DROP POLICY IF EXISTS "Authorized manage bulk_batches" ON public.bulk_batches;
CREATE POLICY "Authorized manage bulk_batches" ON public.bulk_batches FOR ALL USING (get_my_role() IN ('admin','ceo','accounts','hr'));
ALTER TABLE public.qc_rejections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view qc_rejections" ON public.qc_rejections;
CREATE POLICY "All staff view qc_rejections" ON public.qc_rejections FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "QC manage rejections" ON public.qc_rejections;
CREATE POLICY "QC manage rejections" ON public.qc_rejections FOR ALL USING (get_my_role() IN ('admin','ceo','gm','warehouse','logistics','datateam'));
ALTER TABLE public.deduction_memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_achievements ENABLE ROW LEVEL SECURITY;

-- ── chat (all tables exist, safe to add cross-table policies) ─
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Participants view conversations" ON public.chat_conversations;
CREATE POLICY "Participants view conversations"     ON public.chat_conversations FOR SELECT USING (id IN (SELECT conversation_id FROM public.chat_participants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Authenticated create conversations" ON public.chat_conversations;
CREATE POLICY "Authenticated create conversations"  ON public.chat_conversations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Creator update conversation" ON public.chat_conversations;
CREATE POLICY "Creator update conversation"         ON public.chat_conversations FOR UPDATE USING (created_by = auth.uid() OR get_my_role() IN ('admin','ceo'));
DROP POLICY IF EXISTS "Admin delete conversations" ON public.chat_conversations;
CREATE POLICY "Admin delete conversations"          ON public.chat_conversations FOR DELETE USING (created_by = auth.uid() OR get_my_role() IN ('admin','ceo'));

ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own participations" ON public.chat_participants;
CREATE POLICY "Users view own participations"      ON public.chat_participants FOR SELECT USING (user_id = auth.uid() OR conversation_id IN (SELECT conversation_id FROM public.chat_participants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Authenticated join conversations" ON public.chat_participants;
CREATE POLICY "Authenticated join conversations"   ON public.chat_participants FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Users update own participation" ON public.chat_participants;
CREATE POLICY "Users update own participation"     ON public.chat_participants FOR UPDATE USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo'));
DROP POLICY IF EXISTS "Users leave conversations" ON public.chat_participants;
CREATE POLICY "Users leave conversations"          ON public.chat_participants FOR DELETE USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo'));

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Participants view messages" ON public.chat_messages;
CREATE POLICY "Participants view messages"   ON public.chat_messages FOR SELECT USING (conversation_id IN (SELECT conversation_id FROM public.chat_participants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Participants send messages" ON public.chat_messages;
CREATE POLICY "Participants send messages"   ON public.chat_messages FOR INSERT WITH CHECK (sender_id = auth.uid() AND conversation_id IN (SELECT conversation_id FROM public.chat_participants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Sender edit own message" ON public.chat_messages;
CREATE POLICY "Sender edit own message"      ON public.chat_messages FOR UPDATE USING (sender_id = auth.uid() OR get_my_role() IN ('admin','ceo'));
DROP POLICY IF EXISTS "Sender or admin delete msg" ON public.chat_messages;
CREATE POLICY "Sender or admin delete msg"   ON public.chat_messages FOR DELETE USING (sender_id = auth.uid() OR get_my_role() IN ('admin','ceo'));

ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated view reactions" ON public.chat_message_reactions;
CREATE POLICY "Authenticated view reactions" ON public.chat_message_reactions FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Users react" ON public.chat_message_reactions;
CREATE POLICY "Users react"                  ON public.chat_message_reactions FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users remove own reaction" ON public.chat_message_reactions;
CREATE POLICY "Users remove own reaction"    ON public.chat_message_reactions FOR DELETE USING (user_id = auth.uid());

ALTER TABLE public.chat_calls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Participants view calls" ON public.chat_calls;
CREATE POLICY "Participants view calls"   ON public.chat_calls FOR SELECT USING (caller_id = auth.uid() OR receiver_id = auth.uid() OR get_my_role() IN ('admin','ceo'));
DROP POLICY IF EXISTS "Authenticated create calls" ON public.chat_calls;
CREATE POLICY "Authenticated create calls" ON public.chat_calls FOR INSERT WITH CHECK (caller_id = auth.uid());
DROP POLICY IF EXISTS "Call participants update" ON public.chat_calls;
CREATE POLICY "Call participants update"  ON public.chat_calls FOR UPDATE USING (caller_id = auth.uid() OR receiver_id = auth.uid() OR get_my_role() IN ('admin','ceo'));

ALTER TABLE public.chat_call_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Signal participants view" ON public.chat_call_signals;
CREATE POLICY "Signal participants view"  ON public.chat_call_signals FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());
DROP POLICY IF EXISTS "Authenticated send signals" ON public.chat_call_signals;
CREATE POLICY "Authenticated send signals" ON public.chat_call_signals FOR INSERT WITH CHECK (sender_id = auth.uid());


-- ════════════════════════════════════════════════════════════
--  PHASE 3 — TRIGGERS, FUNCTIONS & HELPERS
-- ════════════════════════════════════════════════════════════

-- Shift time helper
CREATE OR REPLACE FUNCTION public.get_shift_for_time(t time)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN t >= '10:00' AND t < '19:30' THEN 1
    WHEN t >= '19:30' AND t <= '23:00' THEN 2
    ELSE NULL
  END;
$$;

-- Chat: keep last_message_at in sync
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.chat_conversations
  SET last_message_at = NEW.created_at, updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE TRIGGER trg_update_conversation_last_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();

-- Notify PostgREST of schema changes
NOTIFY pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════
--  PHASE 4 — REALTIME PUBLICATIONS
-- ════════════════════════════════════════════════════════════

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_call_signals; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_calls; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.hourly_criticals; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.escalations; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.client_escalations; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ════════════════════════════════════════════════════════════
--  PHASE 5 — SEED DATA
-- ════════════════════════════════════════════════════════════

-- ── Hubs ─────────────────────────────────────────────────────
INSERT INTO public.hubs (name, location, city, state, code, is_active) VALUES
  ('Palikarani Hub', 'Palikarani', 'Chennai',   'Tamil Nadu',    'PALI', true),
  ('Vanagaram Hub',  'Vanagaram',  'Chennai',   'Tamil Nadu',    'VANA', true),
  ('Hyderabad Hub',  'Hyderabad',  'Hyderabad', 'Telangana',     'HYD',  true)
ON CONFLICT (name) DO UPDATE
  SET code = EXCLUDED.code, is_active = EXCLUDED.is_active;

UPDATE public.hubs SET display_name = name WHERE display_name IS NULL;

-- ── Transport Categories ──────────────────────────────────────
INSERT INTO public.transport_categories (category_code, category_name, color_code) VALUES
  ('ff',          'Farmers Factory', '#22c55e'),
  ('blinkit',     'Blinkit',         '#ff6b6b'),
  ('zepto',       'Zepto',           '#8b5cf6'),
  ('dmart',       'D-Mart',          '#3b82f6'),
  ('bigbasket',   'BigBasket',       '#f59e0b'),
  ('farm_harvest','Farm Harvest',    '#10b981'),
  ('office_work', 'Office Work',     '#6366f1'),
  ('other',       'Other',           '#6b7280')
ON CONFLICT (category_code) DO NOTHING;

-- ── Products (34 grocery items) ──────────────────────────────
INSERT INTO public.products (name, category, unit, grade_a_price, grade_b_price, grade_c_price, is_active)
SELECT name, category, unit, grade_a_price, grade_b_price, grade_c_price, true
FROM (VALUES
  ('Onion',        'Vegetables','KG', 28,  24,  20),
  ('Tomato',       'Vegetables','KG', 45,  38,  30),
  ('Potato',       'Vegetables','KG', 35,  30,  25),
  ('Carrot',       'Vegetables','KG', 40,  34,  28),
  ('Cabbage',      'Vegetables','KG', 22,  18,  14),
  ('Beetroot',     'Vegetables','KG', 30,  26,  20),
  ('Coriander',    'Vegetables','KG', 70,  60,  50),
  ('Drumstick',    'Vegetables','KG', 50,  42,  35),
  ('Beans',        'Vegetables','KG', 60,  52,  44),
  ('Brinjal',      'Vegetables','KG', 32,  28,  22),
  ('Capsicum',     'Vegetables','KG', 55,  48,  40),
  ('Lady Finger',  'Vegetables','KG', 45,  38,  30),
  ('Raw Banana',   'Vegetables','KG', 35,  30,  24),
  ('Bitter Gourd', 'Vegetables','KG', 40,  34,  28),
  ('Green Chilli', 'Vegetables','KG', 60,  50,  40),
  ('Garlic',       'Vegetables','KG',120, 100,  80),
  ('Ginger',       'Vegetables','KG',100,  85,  70),
  ('Spinach',      'Vegetables','KG', 30,  25,  20),
  ('Mango',        'Fruits',    'KG', 80,  65,  50),
  ('Banana',       'Fruits',    'KG', 40,  34,  28),
  ('Apple',        'Fruits',    'KG',150, 120,  90),
  ('Papaya',       'Fruits',    'KG', 35,  28,  22),
  ('Watermelon',   'Fruits',    'KG', 18,  14,  10),
  ('Rice',         'Grains',    'KG', 65,  55,  45),
  ('Wheat',        'Grains',    'KG', 38,  32,  26),
  ('Toor Dal',     'Pulses',    'KG',130, 115, 100),
  ('Moong Dal',    'Pulses',    'KG',120, 105,  90),
  ('Coconut Oil',  'Oils',      'LTR',180,160, 140),
  ('Sunflower Oil','Oils',      'LTR',140,125, 110),
  ('Milk',         'Dairy',     'LTR', 60,  55,  50),
  ('Paneer',       'Dairy',     'KG', 320,290, 260),
  ('Turmeric',     'Spices',    'KG', 140,120, 100),
  ('Red Chilli',   'Spices',    'KG', 180,155, 130),
  ('Cumin',        'Spices',    'KG', 350,300, 250)
) AS v(name, category, unit, grade_a_price, grade_b_price, grade_c_price)
WHERE NOT EXISTS (SELECT 1 FROM public.products LIMIT 1);

-- ── Vendors (6 default) ───────────────────────────────────────
INSERT INTO public.vendors (name, contact_person, phone, city, is_active)
SELECT name, contact_person, phone, city, true
FROM (VALUES
  ('Ravi Farms',          'Ravi Kumar',  '9444111222', 'Chennai'),
  ('AK Traders',          'Arjun K',     '9555222333', 'Chennai'),
  ('Fresh Vendors Co.',   'Suresh M',    '9666333444', 'Chennai'),
  ('Green Valley Agro',   'Priya G',     '9777444555', 'Coimbatore'),
  ('Tamil Nadu Produce',  'Karthik R',   '9888555666', 'Chennai'),
  ('Sri Murugan Traders', 'Murugan S',   '9999666777', 'Chennai')
) AS v(name, contact_person, phone, city)
WHERE NOT EXISTS (SELECT 1 FROM public.vendors LIMIT 1);

-- Final schema reload
NOTIFY pgrst, 'reload schema';

-- ============================================================
--  MASTER SCHEMA V1 — COMPLETE
--  Tables: 102  |  Run time: ~15 seconds on blank DB
-- ============================================================
