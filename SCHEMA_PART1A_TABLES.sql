-- ============================================================
--  FFERPv2 â€” MASTER SCHEMA V1
--  Single clean migration for fresh Supabase project
--  All 102 tables in dependency order. Run once on blank DB.
--  Generated: 2026-05-30
-- ============================================================

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
--  PHASE 0 â€” EXTENSIONS & HELPER FUNCTIONS
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
--  PHASE 1 â€” LAYER 1: NO FOREIGN KEYS
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- â”€â”€ PROFILES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- â”€â”€ HUBS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- â”€â”€ PRODUCTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- â”€â”€ VENDORS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE TRIGGER vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- â”€â”€ ANNOUNCEMENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- â”€â”€ RENTAL CATEGORIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.rental_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text UNIQUE NOT NULL,
  description text,
  status      text NOT NULL DEFAULT 'Active',
  created_by  uuid,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- â”€â”€ TRANSPORT CATEGORIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ TRANSPORT VEHICLES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ TRANSPORT DRIVERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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


-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
--  LAYER 2 â€” DEPENDS ON profiles + hubs
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- â”€â”€ CUSTOMERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE INDEX IF NOT EXISTS customers_shop_name_trgm  ON public.customers USING gin (shop_name  gin_trgm_ops);
CREATE INDEX IF NOT EXISTS customers_name_trgm       ON public.customers USING gin (name       gin_trgm_ops);
CREATE INDEX IF NOT EXISTS customers_first_name_trgm ON public.customers USING gin (first_name gin_trgm_ops);
CREATE OR REPLACE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- â”€â”€ MARKET RATES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- â”€â”€ INVENTORY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE TRIGGER inventory_updated_at BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- â”€â”€ SALARY BATCHES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ PURCHASE ORDERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ AUDIT LOGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ NOTIFICATIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- â”€â”€ GEOFENCES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ CORE HEADS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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


-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
--  LAYER 3 â€” SALES, PURCHASE ITEMS, PROJECTS, LOGISTICS
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- â”€â”€ SALES ORDERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ SALES ORDER ITEMS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE INDEX IF NOT EXISTS idx_sales_order_items_order ON public.sales_order_items(order_id);

-- â”€â”€ PURCHASE ORDER ITEMS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- â”€â”€ PO â†’ SALES ORDER LINKS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.po_sales_order_links (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id          uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  sales_order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  created_at     timestamptz DEFAULT now(),
  UNIQUE(po_id, sales_order_id)
);

-- â”€â”€ INVOICES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE TRIGGER invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- â”€â”€ QC INSPECTIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ TRANSIT RECORDS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ LOGISTICS TRIPS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ VENDOR PAYMENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE INDEX IF NOT EXISTS idx_payment_status ON public.vendor_payments(status);
CREATE INDEX IF NOT EXISTS idx_payment_po     ON public.vendor_payments(po_id);

-- â”€â”€ PAYMENT REQUESTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE TRIGGER payment_requests_updated_at BEFORE UPDATE ON public.payment_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- â”€â”€ DEDUCTION MEMOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ PAYMENT DEDUCTION LINES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ CRM LEADS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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


-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
--  LAYER 4 â€” HR, DAILY WORKFLOW, PAYROLL
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- â”€â”€ DAILY WORKFLOW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


CREATE INDEX IF NOT EXISTS idx_hourly_plans_user_date ON public.hourly_plans(user_id, date);



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

-- â”€â”€ LEAVE & ATTENDANCE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ LOP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ PAYROLL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ EMPLOYEE PROFILE EXTRAS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ SHIFT SYSTEM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

CREATE INDEX IF NOT EXISTS idx_shift_sessions_user_id ON public.shift_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_shift_sessions_date    ON public.shift_sessions(date);


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

-- â”€â”€ TASK & SOP ASSIGNMENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ ESCALATIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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


-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
--  LAYER 5 â€” PROJECTS & ENGINEERING
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

-- â”€â”€ CLIENT COLLECTIONS & ESCALATIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ HOURLY CRITICALS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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


-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
--  LAYER 6 â€” TRANSPORT, RENTAL, COLLECTIONS, SALES TOOLS
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- â”€â”€ TRANSPORT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ RENTAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ CASH COLLECTIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ SALES & DEMAND TOOLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE INDEX IF NOT EXISTS idx_sales_targets_hub_date ON public.sales_targets(hub_id, target_date);



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

-- â”€â”€ AI & SYSTEM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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


-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
--  LAYER 7 â€” CHAT SYSTEM (tables first, policies in Phase 2)
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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


