-- ============================================================
--  FF ERP — PART 2: REMAINING TABLES + COLUMN FIXES
--  Tables NOT in MASTER_SCHEMA_V1.sql + DB column mismatches
--  Run AFTER SCHEMA_PART1_FROM_MASTER.sql
--  Generated: 2026-06-01
-- ============================================================


-- ════════════════════════════════════════════════════════════
--  COLUMN FIXES ON EXISTING TABLES
-- ════════════════════════════════════════════════════════════

-- Fix 1: vendors — code uses bank_account/bank_ifsc, DB has account_number/ifsc_code
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS bank_ifsc    text;

-- Keep both sets in sync via triggers
CREATE OR REPLACE FUNCTION public.sync_vendor_bank_cols()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.bank_account IS NOT NULL AND NEW.account_number IS NULL THEN
    NEW.account_number := NEW.bank_account;
  END IF;
  IF NEW.account_number IS NOT NULL AND NEW.bank_account IS NULL THEN
    NEW.bank_account := NEW.account_number;
  END IF;
  IF NEW.bank_ifsc IS NOT NULL AND NEW.ifsc_code IS NULL THEN
    NEW.ifsc_code := NEW.bank_ifsc;
  END IF;
  IF NEW.ifsc_code IS NOT NULL AND NEW.bank_ifsc IS NULL THEN
    NEW.bank_ifsc := NEW.ifsc_code;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_vendor_bank ON public.vendors;
CREATE TRIGGER trg_sync_vendor_bank
  BEFORE INSERT OR UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.sync_vendor_bank_cols();

-- Fix 2: profiles — code uses office_number for employee ID display
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS office_number text;

-- Fix 3: profiles — code uses account_activated, onboarding fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_activated   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_status   text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS login_credential_password text,
  ADD COLUMN IF NOT EXISTS password            text,
  ADD COLUMN IF NOT EXISTS username            text,
  ADD COLUMN IF NOT EXISTS verified_at         timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by         text;

-- Fix 4: purchase_orders — code uses vendor_id column
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL;

-- Fix 4b: ff_vendor_payments — missing purchase_entry_id (critical workflow link)
ALTER TABLE public.ff_vendor_payments
  ADD COLUMN IF NOT EXISTS purchase_entry_id uuid
    REFERENCES public.purchase_entries(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ff_vp_entry ON public.ff_vendor_payments(purchase_entry_id);

-- Fix 5: sales_orders — code uses dark_store_id (alias for hub_id)
ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS dark_store_id text;

-- Fix 6: products — code uses average_rating, review_count, sort_order
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS average_rating numeric(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_count   integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sort_order     integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tags           text DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS attributes     jsonb,
  ADD COLUMN IF NOT EXISTS blur_data_urls text DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS category_slug  text,
  ADD COLUMN IF NOT EXISTS brand_id       uuid,
  ADD COLUMN IF NOT EXISTS barcode        text,
  ADD COLUMN IF NOT EXISTS in_stock       boolean DEFAULT true;


-- ════════════════════════════════════════════════════════════
--  PAYSLIPS (code uses 'payslips', MASTER has 'employee_payslips')
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.payslips (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  month          integer NOT NULL,
  year           integer NOT NULL,
  basic_salary   numeric(12,2) DEFAULT 0,
  allowances     numeric(12,2) DEFAULT 0,
  deductions     numeric(12,2) DEFAULT 0,
  net_salary     numeric(12,2) DEFAULT 0,
  status         text DEFAULT 'draft',
  pdf_url        text,
  generated_at   timestamptz,
  created_at     timestamptz DEFAULT now(),
  UNIQUE(user_id, month, year)
);

-- ════════════════════════════════════════════════════════════
--  SOPs (My SOPs module)
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.sops (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  content     text,
  category    text,
  target_roles text[] DEFAULT '{}',
  is_active   boolean DEFAULT true,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
--  DEPARTMENTS
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.departments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text UNIQUE NOT NULL,
  code       text,
  head_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active  boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
--  EMPLOYEES (extended employee info)
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.employees (
  id            uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_code text UNIQUE,
  department    text,
  designation   text,
  date_of_birth date,
  gender        text,
  address       text,
  bank_name     text,
  account_number text,
  ifsc_code     text,
  pan_number    text,
  aadhar_number text,
  basic_salary  numeric(12,2) DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_master (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  designation     text,
  salary          numeric(12,2) DEFAULT 0,
  bank_name       text,
  account_number  text,
  ifsc_code       text,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_memos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       text NOT NULL,
  content     text NOT NULL,
  type        text DEFAULT 'general',
  issued_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_ratings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  rated_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  rating      integer CHECK (rating BETWEEN 1 AND 5),
  feedback    text,
  period      text,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_onboarding_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  email        text,
  phone        text,
  role         text,
  department   text,
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status       text DEFAULT 'pending',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
--  ESCALATION TIMELINE
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.escalation_timeline (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escalation_id uuid REFERENCES public.escalations(id) ON DELETE CASCADE,
  action        text NOT NULL,
  performed_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes         text,
  created_at    timestamptz DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
--  INVENTORY SUPPLEMENTS
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id      uuid REFERENCES public.hubs(id) ON DELETE CASCADE,
  product_id  uuid REFERENCES public.products(id) ON DELETE CASCADE,
  quantity    numeric(10,2) DEFAULT 0,
  unit        text DEFAULT 'kg',
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(hub_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.inventory_usage_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id     uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity   numeric(10,2),
  usage_type text,
  ref_id     uuid,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_consumption_summary (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id     uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  date       date NOT NULL DEFAULT CURRENT_DATE,
  consumed   numeric(10,2) DEFAULT 0,
  wasted     numeric(10,2) DEFAULT 0,
  net        numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
--  PAYMENT SUPPLEMENTS
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.payment_audit_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid,
  action     text NOT NULL,
  actor_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  details    jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_deduplication_registry (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hash        text UNIQUE NOT NULL,
  payment_id  uuid,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_tags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid,
  tag        text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments_made (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount       numeric(12,2) NOT NULL,
  payee        text,
  method       text DEFAULT 'bank_transfer',
  reference    text,
  hub_id       uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  made_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  made_at      timestamptz DEFAULT now(),
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments_received (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount       numeric(12,2) NOT NULL,
  payer        text,
  method       text,
  reference    text,
  order_id     uuid REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  received_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  received_at  timestamptz DEFAULT now(),
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.split_payments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id   uuid,
  payee_name   text,
  amount       numeric(12,2),
  method       text,
  account_number text,
  ifsc_code    text,
  status       text DEFAULT 'pending',
  created_at   timestamptz DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
--  PAYROLL
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.payroll (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  month        integer NOT NULL,
  year         integer NOT NULL,
  gross        numeric(12,2) DEFAULT 0,
  deductions   numeric(12,2) DEFAULT 0,
  net          numeric(12,2) DEFAULT 0,
  status       text DEFAULT 'draft',
  created_at   timestamptz DEFAULT now(),
  UNIQUE(employee_id, month, year)
);

CREATE TABLE IF NOT EXISTS public.payroll_records (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id   uuid REFERENCES public.payroll(id) ON DELETE CASCADE,
  type         text,
  description  text,
  amount       numeric(12,2),
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month      integer NOT NULL,
  year       integer NOT NULL,
  status     text DEFAULT 'draft',
  run_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(month, year)
);

CREATE TABLE IF NOT EXISTS public.payroll_summary (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       uuid REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  total_gross  numeric(15,2) DEFAULT 0,
  total_net    numeric(15,2) DEFAULT 0,
  headcount    integer DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.salary_approvals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       uuid REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  level        text,
  approved_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at  timestamptz,
  status       text DEFAULT 'pending',
  remarks      text,
  created_at   timestamptz DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
--  PETTY CASH
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.petty_cash_ledger (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id      uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  date        date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  debit       numeric(10,2) DEFAULT 0,
  credit      numeric(10,2) DEFAULT 0,
  balance     numeric(10,2) DEFAULT 0,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.petty_cash_reports (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id     uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  period     text,
  total_in   numeric(10,2) DEFAULT 0,
  total_out  numeric(10,2) DEFAULT 0,
  closing_balance numeric(10,2) DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.petty_cash_refill_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id      uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  amount      numeric(10,2) NOT NULL,
  reason      text,
  status      text DEFAULT 'pending',
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
--  PROJECT SUPPLEMENTS
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.project_documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  file_url    text,
  type        text,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_milestones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  title       text NOT NULL,
  due_date    date,
  status      text DEFAULT 'pending',
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_escalation_stats (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  total       integer DEFAULT 0,
  resolved    integer DEFAULT 0,
  pending     integer DEFAULT 0,
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_execution_proofs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  photo_url   text,
  description text,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_verticals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
--  SITE VISITS
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.site_visit_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  site_name    text NOT NULL,
  location     text,
  visit_date   date,
  purpose      text,
  status       text DEFAULT 'pending',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_visit_assignments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   uuid REFERENCES public.site_visit_requests(id) ON DELETE CASCADE,
  assigned_to  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_visit_timeline (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.site_visit_requests(id) ON DELETE CASCADE,
  action     text,
  actor_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_visit_daily_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   uuid REFERENCES public.site_visit_requests(id) ON DELETE CASCADE,
  report_date  date DEFAULT CURRENT_DATE,
  summary      text,
  photos       text[],
  submitted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_visit_daily_reports_public (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date DEFAULT CURRENT_DATE,
  summary     text,
  photos      text[],
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_visit_session_reports (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.site_visit_requests(id) ON DELETE CASCADE,
  summary    text,
  outcome    text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_visit_sla_tracking (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      uuid REFERENCES public.site_visit_requests(id) ON DELETE CASCADE,
  sla_breach      boolean DEFAULT false,
  breach_reason   text,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_visit_travel_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   uuid REFERENCES public.site_visit_requests(id) ON DELETE CASCADE,
  travel_mode  text,
  distance_km  numeric(8,2),
  amount       numeric(10,2),
  logged_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
--  VENDOR SUPPLEMENTS
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.vendor_master (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id    uuid REFERENCES public.vendors(id) ON DELETE CASCADE,
  category     text,
  rating       numeric(3,2) DEFAULT 0,
  notes        text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vendor_ratings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   uuid REFERENCES public.vendors(id) ON DELETE CASCADE,
  rating      integer CHECK (rating BETWEEN 1 AND 5),
  review      text,
  rated_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vendor_quotes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id    uuid REFERENCES public.vendors(id) ON DELETE CASCADE,
  product_id   uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text,
  rate         numeric(10,2),
  valid_until  date,
  notes        text,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vendor_credits (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id    uuid REFERENCES public.vendors(id) ON DELETE CASCADE,
  amount       numeric(12,2),
  reason       text,
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vendor_sourcing_queue (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid REFERENCES public.products(id) ON DELETE SET NULL,
  hub_id      uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  quantity    numeric(10,2),
  status      text DEFAULT 'pending',
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vendor_sourcing_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id    uuid REFERENCES public.vendor_sourcing_queue(id) ON DELETE CASCADE,
  vendor_id   uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  action      text,
  notes       text,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vendor_work_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   uuid REFERENCES public.vendors(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  status      text DEFAULT 'pending',
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
--  RENTAL SUPPLEMENTS
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.rental_additions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.rental_properties(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount      numeric(10,2),
  date        date DEFAULT CURRENT_DATE,
  added_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rental_deductions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.rental_properties(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount      numeric(10,2),
  date        date DEFAULT CURRENT_DATE,
  added_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
--  LEAVE TYPES
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.leave_types (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text UNIQUE NOT NULL,
  code       text UNIQUE,
  days_limit integer DEFAULT 0,
  is_paid    boolean DEFAULT true,
  is_active  boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Default leave types
INSERT INTO public.leave_types (name, code, days_limit, is_paid) VALUES
  ('Casual Leave',  'CL', 12, true),
  ('Sick Leave',    'SL', 7,  true),
  ('Earned Leave',  'EL', 15, true),
  ('Loss of Pay',   'LOP', 0, false),
  ('Holiday',       'HOL', 0, true)
ON CONFLICT (name) DO NOTHING;

-- ════════════════════════════════════════════════════════════
--  WORK ORDER SUPPLEMENTS
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.work_order_payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE CASCADE,
  amount        numeric(12,2),
  paid_at       timestamptz,
  method        text,
  ref           text,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.work_order_final_audits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE CASCADE,
  audited_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  remarks       text,
  status        text DEFAULT 'pending',
  created_at    timestamptz DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
--  MISC MISSING TABLES
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.daily_tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_date   date NOT NULL DEFAULT CURRENT_DATE,
  title       text NOT NULL,
  description text,
  status      text DEFAULT 'pending',
  priority    text DEFAULT 'medium',
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.daily_site_updates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     uuid,
  update_text text NOT NULL,
  photos      text[],
  submitted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.daily_farm_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id     uuid,
  log_date    date DEFAULT CURRENT_DATE,
  activity    text,
  notes       text,
  logged_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.farm_manager_remarks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id     uuid,
  remark      text NOT NULL,
  remarked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.harvest_records (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id     uuid,
  crop        text,
  quantity_kg numeric(10,2),
  harvest_date date DEFAULT CURRENT_DATE,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cultivation_cycles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id     uuid,
  crop        text,
  start_date  date,
  end_date    date,
  status      text DEFAULT 'active',
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fraud_pattern_alerts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type  text NOT NULL,
  description text,
  ref_id      uuid,
  ref_type    text,
  severity    text DEFAULT 'low',
  is_resolved boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        text NOT NULL,
  email       boolean DEFAULT true,
  push        boolean DEFAULT true,
  in_app      boolean DEFAULT true,
  UNIQUE(user_id, type)
);

CREATE TABLE IF NOT EXISTS public.order_returns (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  reason      text,
  quantity    numeric(10,2),
  status      text DEFAULT 'pending',
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recurring_bills (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  amount      numeric(12,2),
  frequency   text DEFAULT 'monthly',
  next_due    date,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recurring_invoices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  amount      numeric(12,2),
  frequency   text DEFAULT 'monthly',
  next_due    date,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.credit_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  amount      numeric(12,2),
  reason      text,
  status      text DEFAULT 'pending',
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.milestone_deviation_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid REFERENCES public.project_milestones(id) ON DELETE CASCADE,
  reason       text NOT NULL,
  new_date     date,
  status       text DEFAULT 'pending',
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_progress_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id       uuid REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  status      text,
  notes       text,
  logged_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_achievements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     uuid REFERENCES public.task_assignments(id) ON DELETE CASCADE,
  description text,
  value       numeric(12,2),
  achieved_at timestamptz DEFAULT now(),
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.ticket_views (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  uuid,
  viewed_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  viewed_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trip_orders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     uuid,
  order_id    uuid REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  status      text DEFAULT 'pending',
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.daily_expense_sheet (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  date        date DEFAULT CURRENT_DATE,
  category    text,
  description text NOT NULL,
  amount      numeric(10,2) NOT NULL,
  receipt_url text,
  status      text DEFAULT 'pending',
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_challans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  challan_no  text,
  issued_at   timestamptz DEFAULT now(),
  hub_id      uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  driver_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status      text DEFAULT 'pending',
  created_at  timestamptz DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
--  CAFE TABLES (Palm Cafe module)
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.cafe_menu_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name     text NOT NULL,
  category      text,
  price         numeric(8,2) NOT NULL,
  is_available  boolean DEFAULT true,
  is_veg        boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cafe_master_menu (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id      uuid REFERENCES public.cafe_menu_items(id) ON DELETE CASCADE,
  available_days text[] DEFAULT '{}',
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cafe_orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number  text,
  customer_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_name text,
  customer_department text,
  total_amount  numeric(10,2) DEFAULT 0,
  payment_status text DEFAULT 'pending_payment',
  order_status  text DEFAULT 'pending_payment',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cafe_order_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid REFERENCES public.cafe_orders(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES public.cafe_menu_items(id) ON DELETE SET NULL,
  item_name   text NOT NULL,
  item_price  numeric(8,2),
  quantity    integer DEFAULT 1,
  subtotal    numeric(10,2),
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cafe_settings (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key      text UNIQUE NOT NULL,
  value    text,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cafe_ads (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text,
  image_url  text,
  is_active  boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cafe_daily_closings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date         date DEFAULT CURRENT_DATE,
  total_sales  numeric(10,2) DEFAULT 0,
  total_orders integer DEFAULT 0,
  closed_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(date)
);

-- ════════════════════════════════════════════════════════════
--  CHAT ACTIVITY + CONNECTIONS
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.chat_activity (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_seen   timestamptz DEFAULT now(),
  is_online   boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_connections (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  connected_to uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(user_id, connected_to)
);

-- ════════════════════════════════════════════════════════════
--  BOX AUTO-GENERATION TRIGGER
--  When a purchase_order_item is created → auto-create a box
--  with QR payload for the scanner app.
-- ════════════════════════════════════════════════════════════

CREATE SEQUENCE IF NOT EXISTS box_seq START 1;

CREATE OR REPLACE FUNCTION public.auto_create_box_on_po_item()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_hub_id     uuid;
  v_hub_name   text;
  v_prod_name  text;
  v_box_code   text;
  v_qr_payload jsonb;
  v_po_number  text;
BEGIN
  -- Get hub info
  SELECT h.id, h.name INTO v_hub_id, v_hub_name
  FROM public.purchase_orders po
  JOIN public.hubs h ON h.id = po.hub_id
  WHERE po.id = NEW.po_id LIMIT 1;

  -- Get product name
  SELECT name INTO v_prod_name
  FROM public.products WHERE id = NEW.product_id LIMIT 1;

  -- Get PO number
  SELECT po_number INTO v_po_number
  FROM public.purchase_orders WHERE id = NEW.po_id LIMIT 1;

  -- Generate box code
  v_box_code := 'BOX-' || TO_CHAR(now(),'YYYYMMDD') || '-' || LPAD(nextval('box_seq')::text, 5, '0');

  -- Build QR payload (scanner app reads this)
  v_qr_payload := jsonb_build_object(
    'box_id',    gen_random_uuid(),
    'box_code',  v_box_code,
    'product',   COALESCE(v_prod_name, 'Unknown'),
    'weight_kg', NEW.ordered_qty,
    'hub',       COALESCE(v_hub_name, 'Unknown'),
    'po_id',     NEW.po_id,
    'date',      CURRENT_DATE::text
  );

  INSERT INTO public.boxes (
    box_code, po_item_id, product_id, hub_id,
    weight_kg, qr_url, status
  ) VALUES (
    v_box_code,
    NEW.id,
    NEW.product_id,
    COALESCE(NEW.hub_id, v_hub_id),
    NEW.ordered_qty,
    v_qr_payload::text,
    'created'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_box ON public.purchase_order_items;
CREATE TRIGGER trg_auto_create_box
  AFTER INSERT ON public.purchase_order_items
  FOR EACH ROW
  WHEN (NEW.ordered_qty > 0 AND NEW.status != 'fulfilled_by_stock')
  EXECUTE FUNCTION public.auto_create_box_on_po_item();


-- ════════════════════════════════════════════════════════════
--  PE NOTIFICATION TRIGGER
--  When po_assignments is created → notify the PE
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_pe_on_po_assignment()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_po_number text;
  v_hub_name  text;
BEGIN
  SELECT po.po_number, h.name
  INTO v_po_number, v_hub_name
  FROM public.purchase_orders po
  JOIN public.hubs h ON h.id = po.hub_id
  WHERE po.id = NEW.po_id LIMIT 1;

  INSERT INTO public.notifications (
    user_id, title, body, type, ref_id, ref_type
  ) VALUES (
    NEW.purchase_executive_id,
    '📦 New PO Ready — ' || COALESCE(v_hub_name, 'Your Hub'),
    'PO ' || COALESCE(v_po_number, '') || ' is ready for purchase. Download box labels and proceed.',
    'po_assigned',
    NEW.po_id,
    'purchase_order'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_pe ON public.po_assignments;
CREATE TRIGGER trg_notify_pe
  AFTER INSERT ON public.po_assignments
  FOR EACH ROW EXECUTE FUNCTION public.notify_pe_on_po_assignment();


-- ════════════════════════════════════════════════════════════
--  PAYMENT APPROVAL NOTIFICATION TRIGGER
--  When ff_vendor_payments status changes → notify next approver
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_next_payment_approver()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_approver_id uuid;
  v_level_name  text;
BEGIN
  IF NEW.payment_status = OLD.payment_status THEN RETURN NEW; END IF;

  -- Find who to notify based on new status
  CASE NEW.payment_status
    WHEN 'pending_gm' THEN
      SELECT id INTO v_approver_id FROM public.profiles WHERE role = 'gm' AND is_active = true LIMIT 1;
      v_level_name := 'GM';
    WHEN 'pending_l1' THEN
      SELECT id INTO v_approver_id FROM public.profiles WHERE role = 'l1_manager' AND is_active = true LIMIT 1;
      v_level_name := 'L1 Manager';
    WHEN 'pending_auditor' THEN
      SELECT id INTO v_approver_id FROM public.profiles WHERE role = 'auditor' AND is_active = true LIMIT 1;
      v_level_name := 'Auditor';
    WHEN 'pending_ceo' THEN
      SELECT id INTO v_approver_id FROM public.profiles WHERE role = 'ceo' AND is_active = true LIMIT 1;
      v_level_name := 'CEO';
    ELSE
      RETURN NEW;
  END CASE;

  IF v_approver_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type, ref_id, ref_type)
    VALUES (
      v_approver_id,
      '💰 Payment Approval Required',
      'A vendor payment of ₹' || NEW.gross_amount || ' is awaiting your approval.',
      'payment_approval',
      NEW.id,
      'ff_vendor_payment'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_approval_notify ON public.ff_vendor_payments;
CREATE TRIGGER trg_payment_approval_notify
  AFTER UPDATE ON public.ff_vendor_payments
  FOR EACH ROW EXECUTE FUNCTION public.notify_next_payment_approver();


-- ════════════════════════════════════════════════════════════
--  FINAL VERIFICATION COUNT
-- ════════════════════════════════════════════════════════════

SELECT COUNT(*) AS total_tables
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
