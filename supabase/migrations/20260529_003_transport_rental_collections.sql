-- ============================================================
--  FFERPv2 — Transport, Rental & Collections Tables
--  Migration: 20260529_003_transport_rental_collections.sql
--
--  FIXES applied:
--  1. All CREATE TABLE uses IF NOT EXISTS. For tables that may
--     already exist with missing columns, ALTER TABLE ...
--     ADD COLUMN IF NOT EXISTS guards are run immediately after
--     each CREATE TABLE so re-running is always safe.
--  2. FK references to public.projects are made conditional via
--     a DO $$ block so the migration works even if migration
--     002 has not yet been applied.
-- ============================================================

-- ════════════════════════════════════════════════════════════
--  TRANSPORT MODULE
-- ════════════════════════════════════════════════════════════

-- ── 1. TRANSPORT CATEGORIES ──────────────────────────────────
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
ALTER TABLE public.transport_categories
  ADD COLUMN IF NOT EXISTS category_description text,
  ADD COLUMN IF NOT EXISTS icon_name            text,
  ADD COLUMN IF NOT EXISTS color_code           text DEFAULT '#6b7280',
  ADD COLUMN IF NOT EXISTS is_active            boolean DEFAULT true;

ALTER TABLE public.transport_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view transport_categories" ON public.transport_categories;
CREATE POLICY "All staff view transport_categories" ON public.transport_categories
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admin manage transport_categories" ON public.transport_categories;
CREATE POLICY "Admin manage transport_categories" ON public.transport_categories
  FOR ALL USING (get_my_role() IN ('admin','ceo','gm','accounts'));

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

-- ── 2. TRANSPORT VEHICLES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transport_vehicles (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_number text UNIQUE NOT NULL,
  vehicle_type   text,
  vehicle_make   text,
  vehicle_model  text,
  ownership_type text NOT NULL DEFAULT 'own' CHECK (ownership_type IN ('own','hired')),
  is_active      boolean DEFAULT true,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
ALTER TABLE public.transport_vehicles
  ADD COLUMN IF NOT EXISTS vehicle_type   text,
  ADD COLUMN IF NOT EXISTS vehicle_make   text,
  ADD COLUMN IF NOT EXISTS vehicle_model  text,
  ADD COLUMN IF NOT EXISTS ownership_type text DEFAULT 'own',
  ADD COLUMN IF NOT EXISTS is_active      boolean DEFAULT true;

ALTER TABLE public.transport_vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view transport_vehicles" ON public.transport_vehicles;
CREATE POLICY "All staff view transport_vehicles" ON public.transport_vehicles
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admin manage transport_vehicles" ON public.transport_vehicles;
CREATE POLICY "Admin manage transport_vehicles" ON public.transport_vehicles
  FOR ALL USING (get_my_role() IN ('admin','ceo','gm','accounts','logistics'));

-- ── 3. TRANSPORT DRIVERS ─────────────────────────────────────
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
ALTER TABLE public.transport_drivers
  ADD COLUMN IF NOT EXISTS driver_phone   text,
  ADD COLUMN IF NOT EXISTS vendor_company text,
  ADD COLUMN IF NOT EXISTS license_number text,
  ADD COLUMN IF NOT EXISTS is_active      boolean DEFAULT true;

ALTER TABLE public.transport_drivers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view transport_drivers" ON public.transport_drivers;
CREATE POLICY "All staff view transport_drivers" ON public.transport_drivers
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admin manage transport_drivers" ON public.transport_drivers;
CREATE POLICY "Admin manage transport_drivers" ON public.transport_drivers
  FOR ALL USING (get_my_role() IN ('admin','ceo','gm','accounts','logistics'));

-- ── 4. TRANSPORT EXPENSES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transport_expenses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_date        date NOT NULL,
  from_location    text NOT NULL,
  to_location      text NOT NULL,
  total_km         numeric(8,2)  NOT NULL DEFAULT 0,
  rate_per_km      numeric(8,2)  NOT NULL DEFAULT 0,
  total_amount     numeric(12,2) NOT NULL DEFAULT 0,
  category_code    text,
  purpose          text NOT NULL,
  vendor_name      text,
  driver_id        uuid,
  driver_name      text,
  vehicle_id       uuid,
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
-- Patch any existing table that's missing columns
ALTER TABLE public.transport_expenses
  ADD COLUMN IF NOT EXISTS category_code    text,
  ADD COLUMN IF NOT EXISTS vendor_name      text,
  ADD COLUMN IF NOT EXISTS driver_id        uuid,
  ADD COLUMN IF NOT EXISTS driver_name      text,
  ADD COLUMN IF NOT EXISTS vehicle_id       uuid,
  ADD COLUMN IF NOT EXISTS vehicle_number   text,
  ADD COLUMN IF NOT EXISTS proof_file_url   text DEFAULT '',
  ADD COLUMN IF NOT EXISTS proof_file_name  text,
  ADD COLUMN IF NOT EXISTS proof_file_type  text,
  ADD COLUMN IF NOT EXISTS department       text,
  ADD COLUMN IF NOT EXISTS batch_id         uuid,
  ADD COLUMN IF NOT EXISTS is_batch_entry   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS utr_number       text,
  ADD COLUMN IF NOT EXISTS payment_date     date,
  ADD COLUMN IF NOT EXISTS payment_mode     text,
  ADD COLUMN IF NOT EXISTS payment_remarks  text,
  ADD COLUMN IF NOT EXISTS payment_status   text DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_transport_expenses_date       ON public.transport_expenses(trip_date);
CREATE INDEX IF NOT EXISTS idx_transport_expenses_status     ON public.transport_expenses(status);
CREATE INDEX IF NOT EXISTS idx_transport_expenses_created_by ON public.transport_expenses(created_by);

ALTER TABLE public.transport_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own transport_expenses"    ON public.transport_expenses;
DROP POLICY IF EXISTS "Users create transport_expenses"      ON public.transport_expenses;
DROP POLICY IF EXISTS "Approvers manage transport_expenses"  ON public.transport_expenses;
CREATE POLICY "Users view own transport_expenses" ON public.transport_expenses
  FOR SELECT USING (created_by = auth.uid() OR get_my_role() IN ('admin','ceo','gm','accounts','logistics','director'));
CREATE POLICY "Users create transport_expenses" ON public.transport_expenses
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Approvers manage transport_expenses" ON public.transport_expenses
  FOR UPDATE USING (created_by = auth.uid() OR get_my_role() IN ('admin','ceo','gm','accounts','logistics','director'));

DROP TRIGGER IF EXISTS transport_expenses_updated_at ON public.transport_expenses;
CREATE TRIGGER transport_expenses_updated_at
  BEFORE UPDATE ON public.transport_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 5. TRANSPORT BATCH ENTRIES ───────────────────────────────
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
ALTER TABLE public.transport_batch_entries
  ADD COLUMN IF NOT EXISTS total_amount numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS entry_count  integer DEFAULT 0;

ALTER TABLE public.transport_batch_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view transport_batch_entries"     ON public.transport_batch_entries;
DROP POLICY IF EXISTS "Authenticated manage transport_batch_entries" ON public.transport_batch_entries;
CREATE POLICY "All staff view transport_batch_entries" ON public.transport_batch_entries
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated manage transport_batch_entries" ON public.transport_batch_entries
  FOR ALL USING (get_my_role() IN ('admin','ceo','gm','accounts','logistics'));

-- ── 6. TRANSPORT SPLIT PAYMENTS ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.transport_split_payments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.transport_expenses(id) ON DELETE CASCADE,
  payee_name text NOT NULL,
  amount     numeric(12,2) NOT NULL DEFAULT 0,
  utr_number text,
  paid_at    timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.transport_split_payments
  ADD COLUMN IF NOT EXISTS utr_number text,
  ADD COLUMN IF NOT EXISTS paid_at    timestamptz;

CREATE INDEX IF NOT EXISTS idx_transport_split_expense ON public.transport_split_payments(expense_id);

ALTER TABLE public.transport_split_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view transport_split"  ON public.transport_split_payments;
DROP POLICY IF EXISTS "Accounts manage transport_split" ON public.transport_split_payments;
CREATE POLICY "All staff view transport_split" ON public.transport_split_payments
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Accounts manage transport_split" ON public.transport_split_payments
  FOR ALL USING (get_my_role() IN ('admin','ceo','accounts'));


-- ════════════════════════════════════════════════════════════
--  RENTAL MODULE
-- ════════════════════════════════════════════════════════════

-- ── 7. RENTAL CATEGORIES ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rental_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text UNIQUE NOT NULL,
  description text,
  status      text NOT NULL DEFAULT 'Active',
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
ALTER TABLE public.rental_categories
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS status      text DEFAULT 'Active';

ALTER TABLE public.rental_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view rental_categories" ON public.rental_categories;
DROP POLICY IF EXISTS "Admin manage rental_categories"   ON public.rental_categories;
CREATE POLICY "All staff view rental_categories" ON public.rental_categories
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin manage rental_categories" ON public.rental_categories
  FOR ALL USING (get_my_role() IN ('admin','ceo','gm','hr','director'));

-- ── 8. RENTAL PROPERTIES ─────────────────────────────────────
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
ALTER TABLE public.rental_properties
  ADD COLUMN IF NOT EXISTS category_id              uuid,
  ADD COLUMN IF NOT EXISTS address                  text,
  ADD COLUMN IF NOT EXISTS city                     text,
  ADD COLUMN IF NOT EXISTS state                    text,
  ADD COLUMN IF NOT EXISTS landlord_name            text,
  ADD COLUMN IF NOT EXISTS landlord_phone           text,
  ADD COLUMN IF NOT EXISTS landlord_bank_account    text,
  ADD COLUMN IF NOT EXISTS landlord_bank_ifsc       text,
  ADD COLUMN IF NOT EXISTS landlord_bank_name       text,
  ADD COLUMN IF NOT EXISTS advance_amount           numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quotation_amount         numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deduction_percentage     numeric(5,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS moratorium_period        integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rent_due_day             integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rent_hike_enabled        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS rent_hike_percentage     numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rent_hike_interval_years integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS advance_paid_on          date,
  ADD COLUMN IF NOT EXISTS rent_starts_from         date,
  ADD COLUMN IF NOT EXISTS agreement_sign_date      date,
  ADD COLUMN IF NOT EXISTS agreement_end_date       date,
  ADD COLUMN IF NOT EXISTS partner_details          jsonb DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_rental_properties_status ON public.rental_properties(status);

ALTER TABLE public.rental_properties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view rental_properties"    ON public.rental_properties;
DROP POLICY IF EXISTS "Authorized manage rental_properties" ON public.rental_properties;
CREATE POLICY "All staff view rental_properties" ON public.rental_properties
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authorized manage rental_properties" ON public.rental_properties
  FOR ALL USING (get_my_role() IN ('admin','ceo','gm','hr','director','rsh','accounts'));

DROP TRIGGER IF EXISTS rental_properties_updated_at ON public.rental_properties;
CREATE TRIGGER rental_properties_updated_at
  BEFORE UPDATE ON public.rental_properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 9. RENTAL MONTHLY RECORDS ────────────────────────────────
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
ALTER TABLE public.rental_monthly_records
  ADD COLUMN IF NOT EXISTS deductions  numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_payable numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at     timestamptz,
  ADD COLUMN IF NOT EXISTS utr_number  text,
  ADD COLUMN IF NOT EXISTS notes       text;

CREATE INDEX IF NOT EXISTS idx_rental_monthly_property ON public.rental_monthly_records(property_id);

ALTER TABLE public.rental_monthly_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view rental_monthly"    ON public.rental_monthly_records;
DROP POLICY IF EXISTS "Authorized manage rental_monthly" ON public.rental_monthly_records;
CREATE POLICY "All staff view rental_monthly" ON public.rental_monthly_records
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authorized manage rental_monthly" ON public.rental_monthly_records
  FOR ALL USING (get_my_role() IN ('admin','ceo','gm','hr','director','rsh','accounts'));

-- ── 10. RENTAL EXPENSES ──────────────────────────────────────
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
ALTER TABLE public.rental_expenses
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS proof_url   text;

CREATE INDEX IF NOT EXISTS idx_rental_expenses_property ON public.rental_expenses(property_id);

ALTER TABLE public.rental_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view rental_expenses"    ON public.rental_expenses;
DROP POLICY IF EXISTS "Authorized manage rental_expenses" ON public.rental_expenses;
CREATE POLICY "All staff view rental_expenses" ON public.rental_expenses
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authorized manage rental_expenses" ON public.rental_expenses
  FOR ALL USING (get_my_role() IN ('admin','ceo','gm','hr','director','rsh','accounts'));

-- ── 11. RENTAL DISCUSSIONS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rental_discussions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.rental_properties(id) ON DELETE CASCADE,
  message     text NOT NULL,
  author_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rental_discussions_property ON public.rental_discussions(property_id);

ALTER TABLE public.rental_discussions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view rental_discussions"     ON public.rental_discussions;
DROP POLICY IF EXISTS "Authenticated post rental_discussions" ON public.rental_discussions;
CREATE POLICY "All staff view rental_discussions" ON public.rental_discussions
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated post rental_discussions" ON public.rental_discussions
  FOR INSERT WITH CHECK (author_id = auth.uid());

-- ── 12. RENTAL PROPERTY REMARKS ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.rental_property_remarks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.rental_properties(id) ON DELETE CASCADE,
  remark      text NOT NULL,
  author_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.rental_property_remarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view rental_remarks"     ON public.rental_property_remarks;
DROP POLICY IF EXISTS "Authenticated post rental_remarks" ON public.rental_property_remarks;
CREATE POLICY "All staff view rental_remarks" ON public.rental_property_remarks
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated post rental_remarks" ON public.rental_property_remarks
  FOR INSERT WITH CHECK (author_id = auth.uid());


-- ════════════════════════════════════════════════════════════
--  COLLECTIONS MODULE
-- ════════════════════════════════════════════════════════════

-- ── 13. CLIENT COLLECTIONS ───────────────────────────────────
-- project_id stored as plain uuid; FK to projects added
-- conditionally below so this migration runs independently
-- of migration 002.
CREATE TABLE IF NOT EXISTS public.client_collections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid,           -- FK added conditionally below
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
ALTER TABLE public.client_collections
  ADD COLUMN IF NOT EXISTS project_id      uuid,
  ADD COLUMN IF NOT EXISTS utr_number      text,
  ADD COLUMN IF NOT EXISTS remarks         text,
  ADD COLUMN IF NOT EXISTS proof_url       text,
  ADD COLUMN IF NOT EXISTS verified_by     uuid,
  ADD COLUMN IF NOT EXISTS verified_at     timestamptz;

CREATE INDEX IF NOT EXISTS idx_client_collections_project ON public.client_collections(project_id);

ALTER TABLE public.client_collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view client_collections"      ON public.client_collections;
DROP POLICY IF EXISTS "Authenticated manage client_collections" ON public.client_collections;
CREATE POLICY "All staff view client_collections" ON public.client_collections
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated manage client_collections" ON public.client_collections
  FOR ALL USING (auth.uid() IS NOT NULL);

DROP TRIGGER IF EXISTS client_collections_updated_at ON public.client_collections;
CREATE TRIGGER client_collections_updated_at
  BEFORE UPDATE ON public.client_collections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 14. CASH COLLECTIONS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cash_collections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collector_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_id     uuid,           -- FK to customers added conditionally below
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
-- Patch columns that may be missing if this table already existed
ALTER TABLE public.cash_collections
  ADD COLUMN IF NOT EXISTS collector_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_id     uuid,
  ADD COLUMN IF NOT EXISTS payment_mode    text DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS receipt_number  text,
  ADD COLUMN IF NOT EXISTS notes           text,
  ADD COLUMN IF NOT EXISTS proof_url       text,
  ADD COLUMN IF NOT EXISTS verified_by     uuid,
  ADD COLUMN IF NOT EXISTS verified_at     timestamptz,
  ADD COLUMN IF NOT EXISTS deposited_at    timestamptz;

CREATE INDEX IF NOT EXISTS idx_cash_collections_collector ON public.cash_collections(collector_id);
CREATE INDEX IF NOT EXISTS idx_cash_collections_date      ON public.cash_collections(collection_date);

ALTER TABLE public.cash_collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own cash_collections"    ON public.cash_collections;
DROP POLICY IF EXISTS "Authenticated create cash_collections" ON public.cash_collections;
DROP POLICY IF EXISTS "Approvers update cash_collections"  ON public.cash_collections;
CREATE POLICY "Users view own cash_collections" ON public.cash_collections
  FOR SELECT USING (collector_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','accounts','director'));
CREATE POLICY "Authenticated create cash_collections" ON public.cash_collections
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Approvers update cash_collections" ON public.cash_collections
  FOR UPDATE USING (get_my_role() IN ('admin','ceo','gm','accounts'));

DROP TRIGGER IF EXISTS cash_collections_updated_at ON public.cash_collections;
CREATE TRIGGER cash_collections_updated_at
  BEFORE UPDATE ON public.cash_collections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 15. CLIENT ESCALATIONS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_escalations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number     text UNIQUE NOT NULL DEFAULT ('TKT-' || to_char(now(),'YYYYMMDD') || '-' || substr(gen_random_uuid()::text,1,6)),
  project_id        uuid,         -- FK to projects added conditionally below
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
ALTER TABLE public.client_escalations
  ADD COLUMN IF NOT EXISTS project_id       uuid,
  ADD COLUMN IF NOT EXISTS issue_description text,
  ADD COLUMN IF NOT EXISTS category         text,
  ADD COLUMN IF NOT EXISTS ack_late         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sla_hours        integer DEFAULT 24,
  ADD COLUMN IF NOT EXISTS sla_deadline     timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledged_by  uuid,
  ADD COLUMN IF NOT EXISTS acknowledged_at  timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by      uuid,
  ADD COLUMN IF NOT EXISTS resolved_at      timestamptz,
  ADD COLUMN IF NOT EXISTS gm_id            uuid,
  ADD COLUMN IF NOT EXISTS resolution_notes text;

CREATE INDEX IF NOT EXISTS idx_client_escalations_status  ON public.client_escalations(status);
CREATE INDEX IF NOT EXISTS idx_client_escalations_project ON public.client_escalations(project_id);

ALTER TABLE public.client_escalations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view client_escalations"      ON public.client_escalations;
DROP POLICY IF EXISTS "Authenticated create client_escalations" ON public.client_escalations;
DROP POLICY IF EXISTS "Admin manage client_escalations"        ON public.client_escalations;
CREATE POLICY "All staff view client_escalations" ON public.client_escalations
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated create client_escalations" ON public.client_escalations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admin manage client_escalations" ON public.client_escalations
  FOR UPDATE USING (get_my_role() IN ('admin','ceo','gm','gmo','smo','director') OR created_by = auth.uid());

DROP TRIGGER IF EXISTS client_escalations_updated_at ON public.client_escalations;
CREATE TRIGGER client_escalations_updated_at
  BEFORE UPDATE ON public.client_escalations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 16. CLIENT ESCALATION TIMELINE ──────────────────────────
CREATE TABLE IF NOT EXISTS public.client_escalation_timeline (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escalation_id uuid NOT NULL REFERENCES public.client_escalations(id) ON DELETE CASCADE,
  event_type    text NOT NULL,
  message       text NOT NULL,
  actor_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE public.client_escalation_timeline
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_client_escalation_tl ON public.client_escalation_timeline(escalation_id);

ALTER TABLE public.client_escalation_timeline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All staff view escalation_timeline"  ON public.client_escalation_timeline;
DROP POLICY IF EXISTS "Authenticated add timeline entry"    ON public.client_escalation_timeline;
CREATE POLICY "All staff view escalation_timeline" ON public.client_escalation_timeline
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated add timeline entry" ON public.client_escalation_timeline
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);


-- ════════════════════════════════════════════════════════════
--  CONDITIONAL FK CONSTRAINTS
--  Added after all tables exist; each block checks whether the
--  referenced parent table is present before adding the FK so
--  this migration is safe to run before migration 002.
-- ════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- FK: client_collections.project_id → projects
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects')
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'client_collections_project_id_fkey'
    AND table_name = 'client_collections'
  ) THEN
    ALTER TABLE public.client_collections
      ADD CONSTRAINT client_collections_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
  END IF;

  -- FK: client_escalations.project_id → projects
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects')
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'client_escalations_project_id_fkey'
    AND table_name = 'client_escalations'
  ) THEN
    ALTER TABLE public.client_escalations
      ADD CONSTRAINT client_escalations_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;
  END IF;

  -- FK: cash_collections.customer_id → customers
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers')
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'cash_collections_customer_id_fkey'
    AND table_name = 'cash_collections'
  ) THEN
    ALTER TABLE public.cash_collections
      ADD CONSTRAINT cash_collections_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
  END IF;
END $$;
