-- ============================================================
-- FFERPv2 — PHASE 2: SCHEMA MIGRATIONS + DEFAULT CREDENTIALS
-- Project: bvbfnguqpuctdvfztuda.supabase.co
-- Run in Supabase SQL Editor (Admin / Service-role key)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- SECTION 1 — SCHEMA CHANGES TO EXISTING TABLES
-- ────────────────────────────────────────────────────────────

-- 1a. sales_orders — add source column
ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
  CHECK (source IN ('manual','app','website','bulk_upload'));

COMMENT ON COLUMN public.sales_orders.source IS
  'Origin of the order: manual=office entry, app=field-exec mobile, website=customer portal, bulk_upload=CSV import';

-- 1b. profiles — add hub_id foreign key (hub-scoped roles: hub_manager, field_executive, driver, etc.)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hub_id UUID REFERENCES public.hubs(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.hub_id IS
  'Assigned hub for hub-scoped roles (hub_manager, field_executive, driver). NULL for head-office roles.';

-- ────────────────────────────────────────────────────────────
-- SECTION 2 — NEW TABLES
-- ────────────────────────────────────────────────────────────

-- ── 2a. ff_vendor_payments ───────────────────────────────────
-- Tracks vendor payment requests through the 5-level approval chain:
-- FF Ops Manager → GM → L1 Manager → Auditor → CEO

CREATE TABLE IF NOT EXISTS public.ff_vendor_payments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id    UUID REFERENCES public.purchase_orders(id) ON DELETE RESTRICT,
  vendor_id            UUID REFERENCES public.vendors(id) ON DELETE RESTRICT,
  hub_id               UUID REFERENCES public.hubs(id) ON DELETE RESTRICT,

  -- Line items snapshot (jsonb so no separate child table needed)
  items                JSONB NOT NULL DEFAULT '[]'::jsonb,
  /*
    items shape:
    [
      { "product_name": "Tomato", "qty": 100, "unit": "kg",
        "rate": 25.00, "amount": 2500.00,
        "qc_grade": "A", "deduction_reason": null }
    ]
  */

  -- Amounts
  gross_amount         NUMERIC(14,2) NOT NULL DEFAULT 0,
  deduction_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_amount           NUMERIC(14,2) GENERATED ALWAYS AS (gross_amount - deduction_amount) STORED,

  -- Approval status
  payment_status       TEXT NOT NULL DEFAULT 'pending_ff_ops'
    CHECK (payment_status IN (
      'pending_ff_ops',
      'pending_gm',
      'pending_l1',
      'pending_auditor',
      'pending_ceo',
      'approved',
      'paid',
      'rejected'
    )),

  -- Level 1 — FF Ops Manager
  ff_ops_approved_by   UUID REFERENCES public.profiles(id),
  ff_ops_approved_at   TIMESTAMPTZ,
  ff_ops_remarks       TEXT,

  -- Level 2 — GM
  gm_approved_by       UUID REFERENCES public.profiles(id),
  gm_approved_at       TIMESTAMPTZ,
  gm_remarks           TEXT,

  -- Level 3 — L1 Manager
  l1_approved_by       UUID REFERENCES public.profiles(id),
  l1_approved_at       TIMESTAMPTZ,
  l1_remarks           TEXT,

  -- Level 4 — Auditor
  auditor_approved_by  UUID REFERENCES public.profiles(id),
  auditor_approved_at  TIMESTAMPTZ,
  auditor_remarks      TEXT,

  -- Level 5 — CEO
  ceo_approved_by      UUID REFERENCES public.profiles(id),
  ceo_approved_at      TIMESTAMPTZ,
  ceo_remarks          TEXT,

  -- Rejection
  rejected_by          UUID REFERENCES public.profiles(id),
  rejected_at          TIMESTAMPTZ,
  rejection_reason     TEXT,
  rejection_level      TEXT,   -- which level rejected

  -- Payment confirmation
  utr_number           TEXT,
  paid_by              UUID REFERENCES public.profiles(id),
  paid_at              TIMESTAMPTZ,
  payment_proof_url    TEXT,

  -- Meta
  created_by           UUID REFERENCES public.profiles(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ff_vendor_payments_status   ON public.ff_vendor_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_ff_vendor_payments_hub      ON public.ff_vendor_payments(hub_id);
CREATE INDEX IF NOT EXISTS idx_ff_vendor_payments_vendor   ON public.ff_vendor_payments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_ff_vendor_payments_po       ON public.ff_vendor_payments(purchase_order_id);

-- auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_ff_vendor_payments_updated_at ON public.ff_vendor_payments;
CREATE TRIGGER trg_ff_vendor_payments_updated_at
  BEFORE UPDATE ON public.ff_vendor_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 2b. ff_transport_payments ────────────────────────────────
-- Same 5-level chain but for driver/logistics payments

CREATE TABLE IF NOT EXISTS public.ff_transport_payments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id              UUID,   -- optional ref to logistics_trips if that table exists
  driver_id            UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  hub_id               UUID REFERENCES public.hubs(id) ON DELETE RESTRICT,

  -- Trip details
  trip_date            DATE NOT NULL,
  origin               TEXT,
  destination          TEXT,
  vehicle_number       TEXT,
  km_covered           NUMERIC(8,2),

  -- Amounts
  base_amount          NUMERIC(14,2) NOT NULL DEFAULT 0,
  toll_charges         NUMERIC(14,2) NOT NULL DEFAULT 0,
  other_charges        NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount         NUMERIC(14,2) GENERATED ALWAYS AS (base_amount + toll_charges + other_charges) STORED,

  -- Approval status (same chain as vendor payments)
  payment_status       TEXT NOT NULL DEFAULT 'pending_ff_ops'
    CHECK (payment_status IN (
      'pending_ff_ops',
      'pending_gm',
      'pending_l1',
      'pending_auditor',
      'pending_ceo',
      'approved',
      'paid',
      'rejected'
    )),

  -- Level 1 — FF Ops Manager
  ff_ops_approved_by   UUID REFERENCES public.profiles(id),
  ff_ops_approved_at   TIMESTAMPTZ,
  ff_ops_remarks       TEXT,

  -- Level 2 — GM
  gm_approved_by       UUID REFERENCES public.profiles(id),
  gm_approved_at       TIMESTAMPTZ,
  gm_remarks           TEXT,

  -- Level 3 — L1 Manager
  l1_approved_by       UUID REFERENCES public.profiles(id),
  l1_approved_at       TIMESTAMPTZ,
  l1_remarks           TEXT,

  -- Level 4 — Auditor
  auditor_approved_by  UUID REFERENCES public.profiles(id),
  auditor_approved_at  TIMESTAMPTZ,
  auditor_remarks      TEXT,

  -- Level 5 — CEO
  ceo_approved_by      UUID REFERENCES public.profiles(id),
  ceo_approved_at      TIMESTAMPTZ,
  ceo_remarks          TEXT,

  -- Rejection
  rejected_by          UUID REFERENCES public.profiles(id),
  rejected_at          TIMESTAMPTZ,
  rejection_reason     TEXT,
  rejection_level      TEXT,

  -- Payment confirmation
  utr_number           TEXT,
  paid_by              UUID REFERENCES public.profiles(id),
  paid_at              TIMESTAMPTZ,
  payment_proof_url    TEXT,

  -- Supporting docs
  bill_url             TEXT,
  trip_proof_url       TEXT,

  -- Meta
  created_by           UUID REFERENCES public.profiles(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ff_transport_payments_status ON public.ff_transport_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_ff_transport_payments_hub    ON public.ff_transport_payments(hub_id);
CREATE INDEX IF NOT EXISTS idx_ff_transport_payments_driver ON public.ff_transport_payments(driver_id);

DROP TRIGGER IF EXISTS trg_ff_transport_payments_updated_at ON public.ff_transport_payments;
CREATE TRIGGER trg_ff_transport_payments_updated_at
  BEFORE UPDATE ON public.ff_transport_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 2c. ff_task_assignments ──────────────────────────────────
-- FF Ops Manager assigns daily targets to field executives & tele-callers

CREATE TABLE IF NOT EXISTS public.ff_task_assignments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assigned_by          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_to          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  hub_id               UUID REFERENCES public.hubs(id) ON DELETE SET NULL,

  -- Targets
  order_target         INTEGER NOT NULL DEFAULT 0,   -- number of orders
  amount_target        NUMERIC(14,2) NOT NULL DEFAULT 0, -- ₹ target

  -- Task details
  task_notes           TEXT,
  area_assigned        TEXT,   -- geographic area / locality

  -- End-of-day actuals
  completed_orders     INTEGER NOT NULL DEFAULT 0,
  completed_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,

  -- Status
  status               TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','missed')),

  -- Meta
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (assigned_to, task_date)  -- one assignment per person per day
);

CREATE INDEX IF NOT EXISTS idx_ff_task_assignments_date    ON public.ff_task_assignments(task_date);
CREATE INDEX IF NOT EXISTS idx_ff_task_assignments_assignee ON public.ff_task_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_ff_task_assignments_hub     ON public.ff_task_assignments(hub_id);

DROP TRIGGER IF EXISTS trg_ff_task_assignments_updated_at ON public.ff_task_assignments;
CREATE TRIGGER trg_ff_task_assignments_updated_at
  BEFORE UPDATE ON public.ff_task_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- SECTION 3 — ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.ff_vendor_payments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ff_transport_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ff_task_assignments   ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's role from profiles
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(role, 'employee')
  FROM public.profiles
  WHERE id = auth.uid();
$$;

-- Helper: get current user's hub_id from profiles
CREATE OR REPLACE FUNCTION public.current_user_hub()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT hub_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ── ff_vendor_payments policies ──────────────────────────────

-- Hub manager & purchase_manager: see own hub only
CREATE POLICY "hub_manager sees own hub vendor payments"
  ON public.ff_vendor_payments FOR SELECT
  USING (
    current_user_role() IN ('hub_manager','purchase_manager','purchase_head')
    AND hub_id = current_user_hub()
  );

-- FF Ops Manager: see all pending_ff_ops + their own approvals
CREATE POLICY "ff_ops sees all vendor payments"
  ON public.ff_vendor_payments FOR SELECT
  USING (current_user_role() = 'ff_operations_manager');

-- GM, L1, Auditor, CEO, Admin see all
CREATE POLICY "approvers see all vendor payments"
  ON public.ff_vendor_payments FOR SELECT
  USING (current_user_role() IN ('gm','l1_manager','auditor','ceo','admin'));

-- Insert: purchase manager or hub manager creates payments
CREATE POLICY "purchase creates vendor payment"
  ON public.ff_vendor_payments FOR INSERT
  WITH CHECK (current_user_role() IN ('purchase_manager','purchase_head','hub_manager','admin'));

-- Update: approval chain roles can update (to move status forward)
CREATE POLICY "approvers update vendor payments"
  ON public.ff_vendor_payments FOR UPDATE
  USING (current_user_role() IN ('ff_operations_manager','gm','l1_manager','auditor','ceo','admin'));

-- ── ff_transport_payments policies ───────────────────────────

CREATE POLICY "hub_manager sees own hub transport payments"
  ON public.ff_transport_payments FOR SELECT
  USING (
    current_user_role() IN ('hub_manager')
    AND hub_id = current_user_hub()
  );

CREATE POLICY "ff_ops sees all transport payments"
  ON public.ff_transport_payments FOR SELECT
  USING (current_user_role() = 'ff_operations_manager');

CREATE POLICY "approvers see all transport payments"
  ON public.ff_transport_payments FOR SELECT
  USING (current_user_role() IN ('gm','l1_manager','auditor','ceo','admin'));

CREATE POLICY "hub_manager creates transport payment"
  ON public.ff_transport_payments FOR INSERT
  WITH CHECK (current_user_role() IN ('hub_manager','ff_operations_manager','admin'));

CREATE POLICY "approvers update transport payments"
  ON public.ff_transport_payments FOR UPDATE
  USING (current_user_role() IN ('ff_operations_manager','gm','l1_manager','auditor','ceo','admin'));

-- ── ff_task_assignments policies ─────────────────────────────

-- FF Ops Manager creates & manages assignments
CREATE POLICY "ff_ops manages task assignments"
  ON public.ff_task_assignments FOR ALL
  USING (current_user_role() IN ('ff_operations_manager','admin'));

-- Assigned person sees their own tasks
CREATE POLICY "assignee sees own tasks"
  ON public.ff_task_assignments FOR SELECT
  USING (assigned_to = auth.uid());

-- Assignee can update own task (mark completed, update actuals)
CREATE POLICY "assignee updates own task"
  ON public.ff_task_assignments FOR UPDATE
  USING (assigned_to = auth.uid());

-- GM / L1 / CEO can view all assignments
CREATE POLICY "management views all tasks"
  ON public.ff_task_assignments FOR SELECT
  USING (current_user_role() IN ('gm','l1_manager','ceo','admin'));

-- ────────────────────────────────────────────────────────────
-- SECTION 4 — DEFAULT USER CREDENTIALS
-- ────────────────────────────────────────────────────────────
-- Creates auth.users + profiles for every role.
-- Default password for ALL users: FFerp@2025
-- (Supabase hashes passwords — we use the pgcrypto approach)
--
-- NOTE: Run this block ONCE. Re-running is safe (ON CONFLICT DO NOTHING).
-- ────────────────────────────────────────────────────────────

DO $$
DECLARE
  -- ── USER SEED DATA ──────────────────────────────────────────
  -- Format: (email, name, role, department, hub_name_or_null, password)
  users_data RECORD;

  v_uid          UUID;
  v_hub_id       UUID;
  v_encrypted_pw TEXT;
  v_now          TIMESTAMPTZ := now();
  v_instance_id  UUID;

BEGIN
  -- Get the instance_id from an existing auth user (required field)
  SELECT instance_id INTO v_instance_id FROM auth.users LIMIT 1;
  IF v_instance_id IS NULL THEN
    v_instance_id := '00000000-0000-0000-0000-000000000000'::UUID;
  END IF;

  FOR users_data IN (
    SELECT * FROM (VALUES
      -- ── Head-Office / Management  (password: FFerp@2025) ─────
      ('admin@ffactory.com',          'Admin User',              'admin',                'Head Office', NULL::TEXT,  'FFerp@2025'),
      ('ceo@ffactory.com',            'CEO',                     'ceo',                  'Head Office', NULL,        'FFerp@2025'),
      ('l1.manager@ffactory.com',     'L1 Manager',              'l1_manager',           'Finance',     NULL,        'FFerp@2025'),
      ('gm@ffactory.com',             'General Manager',         'gm',                   'Operations',  NULL,        'FFerp@2025'),
      ('auditor@ffactory.com',        'Internal Auditor',        'auditor',              'Audit',       NULL,        'FFerp@2025'),
      ('ops.manager@ffactory.com',    'FF Operations Manager',   'ff_operations_manager','Operations',  NULL,        'FFerp@2025'),
      -- ── Sales Team (individual passwords) ───────────────────
      ('priyanka@farmersfactory.in',      'Priyanka',            'field_executive',      'Sales',       NULL,        'Priya@2026'),
      ('indhurekha@farmersfactory.in',    'Indhurekha',          'field_executive',      'Sales',       NULL,        'Indhu@2026'),
      ('arun@farmersfactory.in',          'Arun',                'field_executive',      'Sales',       NULL,        'Arun@2026'),
      ('akash@farmersfactory.in',         'Akash',               'field_executive',      'Sales',       NULL,        'Akash@2026'),
      ('parasajagadeesh@farmersfactory.in','Parasa Jagadeesh',   'field_executive',      'Sales',       NULL,        'Parasa@2026'),
      ('yazhini@farmersfactory.in',       'Yazhini',             'field_executive',      'Sales',       NULL,        'Yazhi@2026'),
      ('anusiya@farmersfactory.in',       'Anusiya',             'field_executive',      'Sales',       NULL,        'Anusi@2026'),
      -- ── Purchase Team (per hub) ──────────────────────────────
      ('purchase.hyd@ffactory.com',   'Purchase Exe - Hyderabad', 'purchase_manager',   'Purchase',    'Hyderabad', 'FFerp@2025'),
      ('purchase.pali@ffactory.com',  'Purchase Exe - Palikarani','purchase_manager',   'Purchase',    'Palikarani','FFerp@2025'),
      ('purchase.vana@ffactory.com',  'Purchase Exe - Vanagaram', 'purchase_manager',   'Purchase',    'Vanagaram', 'FFerp@2025'),
      -- ── Hub Managers (also used for scanner app) ─────────────
      ('manager.hyderabad@ffactory.com',   'Hub Manager - Hyderabad',  'hub_manager',   'Warehouse',   'Hyderabad', 'FFerp@2025'),
      ('manager.palikarani@ffactory.com',  'Hub Manager - Palikarani', 'hub_manager',   'Warehouse',   'Palikarani','FFerp@2025'),
      ('manager.vanagaram@ffactory.com',   'Hub Manager - Vanagaram',  'hub_manager',   'Warehouse',   'Vanagaram', 'FFerp@2025'),
      -- ── Logistics ────────────────────────────────────────────
      ('driver1@ffactory.com',        'Driver 1',                'driver',               'Logistics',   'Hyderabad', 'FFerp@2025'),
      -- ── Back Office / Reports ────────────────────────────────
      ('backoffice@ffactory.com',     'Back Office',             'back_office',          'Admin',       NULL,        'FFerp@2025')
    ) AS t(email, full_name, role_name, dept, hub_name, password)
  ) LOOP

    -- Skip if user already exists
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = users_data.email) THEN
      RAISE NOTICE 'Skipping existing user: %', users_data.email;
      CONTINUE;
    END IF;

    -- Generate a new UUID for this user
    v_uid := gen_random_uuid();

    -- Hash this user's individual password
    v_encrypted_pw := crypt(users_data.password, gen_salt('bf', 10));

    -- Resolve hub_id if a hub name is provided
    v_hub_id := NULL;
    IF users_data.hub_name IS NOT NULL THEN
      SELECT id INTO v_hub_id
      FROM public.hubs
      WHERE name ILIKE '%' || users_data.hub_name || '%'
      LIMIT 1;
    END IF;

    -- Insert into auth.users
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      v_instance_id,
      v_uid,
      'authenticated',
      'authenticated',
      users_data.email,
      v_encrypted_pw,
      v_now,
      jsonb_build_object('provider','email','providers',ARRAY['email']),
      jsonb_build_object('name', users_data.full_name),
      v_now,
      v_now,
      '', '', '', ''
    );

    -- Insert into auth.identities (required for email login in Supabase)
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', users_data.email),
      'email',
      users_data.email,
      v_now,
      v_now,
      v_now
    );

    -- Insert into profiles
    INSERT INTO public.profiles (
      id,
      email,
      name,
      role,
      department,
      hub_id,
      created_at
    ) VALUES (
      v_uid,
      users_data.email,
      users_data.full_name,
      users_data.role_name,
      users_data.dept,
      v_hub_id,
      v_now
    ) ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Created user: % (%) → hub: %',
      users_data.email, users_data.role_name,
      COALESCE(users_data.hub_name, 'head-office');

  END LOOP;

END $$;

-- ────────────────────────────────────────────────────────────
-- SECTION 5 — VERIFY
-- ────────────────────────────────────────────────────────────

-- Show all created demo/default users
SELECT
  p.email,
  p.name,
  p.role,
  p.department,
  h.name AS hub
FROM public.profiles p
LEFT JOIN public.hubs h ON h.id = p.hub_id
WHERE p.email LIKE '%@ffactory.com' OR p.email LIKE '%@farmersfactory.in'
ORDER BY p.role, p.email;

-- Confirm new tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('ff_vendor_payments','ff_transport_payments','ff_task_assignments')
ORDER BY table_name;

-- Confirm new columns on existing tables
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('sales_orders','profiles')
  AND column_name IN ('source','hub_id')
ORDER BY table_name, column_name;
