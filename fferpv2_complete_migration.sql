-- ================================================================
-- FFERPv2 — COMPLETE MIGRATION (Phase 2 + Phase 4 combined)
-- Project : bvbfnguqpuctdvfztuda.supabase.co
-- Run in  : Supabase SQL Editor  →  Run All
-- Safe    : Every statement uses IF NOT EXISTS / DROP … IF EXISTS
--           Re-running is safe — existing rows / tables are skipped
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- STEP 1 — ALTER EXISTING TABLES
-- ────────────────────────────────────────────────────────────────

-- 1a. sales_orders → add source column (where each order came from)
ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
  CHECK (source IN ('manual','app','website','bulk_upload'));

-- 1b. profiles → add hub_id so hub-scoped users are linked to a hub
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hub_id UUID REFERENCES public.hubs(id) ON DELETE SET NULL;

-- 1c. purchase_orders → columns needed for payment automation
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','pending','paid')),
  ADD COLUMN IF NOT EXISTS paid_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hub_id     UUID REFERENCES public.hubs(id),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id);


-- ────────────────────────────────────────────────────────────────
-- STEP 2 — SHARED TRIGGER HELPER: set_updated_at()
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


-- ────────────────────────────────────────────────────────────────
-- STEP 3 — NEW TABLES
-- ────────────────────────────────────────────────────────────────

-- ── 3a. ff_vendor_payments ───────────────────────────────────────
-- 5-level approval chain: FF Ops → GM → L1 → Auditor → CEO

CREATE TABLE IF NOT EXISTS public.ff_vendor_payments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id    UUID REFERENCES public.purchase_orders(id) ON DELETE RESTRICT,
  vendor_id            UUID REFERENCES public.vendors(id) ON DELETE RESTRICT,
  hub_id               UUID REFERENCES public.hubs(id) ON DELETE RESTRICT,

  -- Line items snapshot
  items                JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Amounts (net_amount is auto-computed)
  gross_amount         NUMERIC(14,2) NOT NULL DEFAULT 0,
  deduction_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_amount           NUMERIC(14,2) GENERATED ALWAYS AS (gross_amount - deduction_amount) STORED,

  -- Approval status
  payment_status       TEXT NOT NULL DEFAULT 'pending_ff_ops'
    CHECK (payment_status IN (
      'pending_ff_ops','pending_gm','pending_l1',
      'pending_auditor','pending_ceo',
      'approved','paid','rejected'
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

  -- Meta
  created_by           UUID REFERENCES public.profiles(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ff_vendor_payments_status  ON public.ff_vendor_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_ff_vendor_payments_hub     ON public.ff_vendor_payments(hub_id);
CREATE INDEX IF NOT EXISTS idx_ff_vendor_payments_vendor  ON public.ff_vendor_payments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_ff_vendor_payments_po      ON public.ff_vendor_payments(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_ff_vendor_payments_created ON public.ff_vendor_payments(created_by);

DROP TRIGGER IF EXISTS trg_ff_vendor_payments_updated_at ON public.ff_vendor_payments;
CREATE TRIGGER trg_ff_vendor_payments_updated_at
  BEFORE UPDATE ON public.ff_vendor_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 3b. ff_transport_payments ────────────────────────────────────
-- Same 5-level chain for driver/logistics payments

CREATE TABLE IF NOT EXISTS public.ff_transport_payments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id              UUID,
  driver_id            UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  hub_id               UUID REFERENCES public.hubs(id) ON DELETE RESTRICT,

  -- Trip details
  trip_date            DATE NOT NULL,
  origin               TEXT,
  destination          TEXT,
  vehicle_number       TEXT,
  km_covered           NUMERIC(8,2),

  -- Amounts (total_amount is auto-computed)
  base_amount          NUMERIC(14,2) NOT NULL DEFAULT 0,
  toll_charges         NUMERIC(14,2) NOT NULL DEFAULT 0,
  other_charges        NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount         NUMERIC(14,2) GENERATED ALWAYS AS (base_amount + toll_charges + other_charges) STORED,

  -- Same approval chain
  payment_status       TEXT NOT NULL DEFAULT 'pending_ff_ops'
    CHECK (payment_status IN (
      'pending_ff_ops','pending_gm','pending_l1',
      'pending_auditor','pending_ceo',
      'approved','paid','rejected'
    )),

  ff_ops_approved_by   UUID REFERENCES public.profiles(id),
  ff_ops_approved_at   TIMESTAMPTZ,
  ff_ops_remarks       TEXT,
  gm_approved_by       UUID REFERENCES public.profiles(id),
  gm_approved_at       TIMESTAMPTZ,
  gm_remarks           TEXT,
  l1_approved_by       UUID REFERENCES public.profiles(id),
  l1_approved_at       TIMESTAMPTZ,
  l1_remarks           TEXT,
  auditor_approved_by  UUID REFERENCES public.profiles(id),
  auditor_approved_at  TIMESTAMPTZ,
  auditor_remarks      TEXT,
  ceo_approved_by      UUID REFERENCES public.profiles(id),
  ceo_approved_at      TIMESTAMPTZ,
  ceo_remarks          TEXT,

  rejected_by          UUID REFERENCES public.profiles(id),
  rejected_at          TIMESTAMPTZ,
  rejection_reason     TEXT,
  rejection_level      TEXT,

  utr_number           TEXT,
  paid_by              UUID REFERENCES public.profiles(id),
  paid_at              TIMESTAMPTZ,
  payment_proof_url    TEXT,

  -- Supporting docs
  bill_url             TEXT,
  trip_proof_url       TEXT,

  created_by           UUID REFERENCES public.profiles(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ff_transport_payments_status  ON public.ff_transport_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_ff_transport_payments_hub     ON public.ff_transport_payments(hub_id);
CREATE INDEX IF NOT EXISTS idx_ff_transport_payments_driver  ON public.ff_transport_payments(driver_id);
CREATE INDEX IF NOT EXISTS idx_ff_transport_payments_created ON public.ff_transport_payments(created_by);

DROP TRIGGER IF EXISTS trg_ff_transport_payments_updated_at ON public.ff_transport_payments;
CREATE TRIGGER trg_ff_transport_payments_updated_at
  BEFORE UPDATE ON public.ff_transport_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 3c. ff_task_assignments ──────────────────────────────────────
-- Daily targets assigned by FF Ops Manager to field team

CREATE TABLE IF NOT EXISTS public.ff_task_assignments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assigned_by          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_to          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  hub_id               UUID REFERENCES public.hubs(id) ON DELETE SET NULL,

  order_target         INTEGER NOT NULL DEFAULT 0,
  amount_target        NUMERIC(14,2) NOT NULL DEFAULT 0,
  task_notes           TEXT,
  area_assigned        TEXT,

  completed_orders     INTEGER NOT NULL DEFAULT 0,
  completed_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,

  status               TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','missed')),

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (assigned_to, task_date)
);

CREATE INDEX IF NOT EXISTS idx_ff_task_assignments_date     ON public.ff_task_assignments(task_date);
CREATE INDEX IF NOT EXISTS idx_ff_task_assignments_assignee ON public.ff_task_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_ff_task_assignments_hub      ON public.ff_task_assignments(hub_id);

DROP TRIGGER IF EXISTS trg_ff_task_assignments_updated_at ON public.ff_task_assignments;
CREATE TRIGGER trg_ff_task_assignments_updated_at
  BEFORE UPDATE ON public.ff_task_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 3d. ff_payment_audit_trail ───────────────────────────────────
-- Auto-logs every payment status change (via triggers below)

CREATE TABLE IF NOT EXISTS public.ff_payment_audit_trail (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_type   TEXT NOT NULL CHECK (payment_type IN ('vendor','transport')),
  payment_id     UUID NOT NULL,
  from_status    TEXT,
  to_status      TEXT NOT NULL,
  changed_by     UUID REFERENCES public.profiles(id),
  remarks        TEXT,
  changed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ff_payment_audit_payment ON public.ff_payment_audit_trail(payment_id);
CREATE INDEX IF NOT EXISTS idx_ff_payment_audit_at      ON public.ff_payment_audit_trail(changed_at DESC);


-- ────────────────────────────────────────────────────────────────
-- STEP 4 — RLS HELPER FUNCTIONS
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(role, 'employee')
  FROM public.profiles
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_hub()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT hub_id FROM public.profiles WHERE id = auth.uid();
$$;


-- ────────────────────────────────────────────────────────────────
-- STEP 5 — ENABLE RLS ON NEW TABLES
-- ────────────────────────────────────────────────────────────────

ALTER TABLE public.ff_vendor_payments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ff_transport_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ff_task_assignments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ff_payment_audit_trail ENABLE ROW LEVEL SECURITY;


-- ────────────────────────────────────────────────────────────────
-- STEP 6 — RLS POLICIES  (DROP first so re-runs don't error)
-- ────────────────────────────────────────────────────────────────

-- ── ff_vendor_payments ───────────────────────────────────────────

DROP POLICY IF EXISTS "hub_manager sees own hub vendor payments"  ON public.ff_vendor_payments;
DROP POLICY IF EXISTS "ff_ops sees all vendor payments"           ON public.ff_vendor_payments;
DROP POLICY IF EXISTS "approvers see all vendor payments"         ON public.ff_vendor_payments;
DROP POLICY IF EXISTS "purchase creates vendor payment"           ON public.ff_vendor_payments;
DROP POLICY IF EXISTS "approvers update vendor payments"          ON public.ff_vendor_payments;
DROP POLICY IF EXISTS "accounts sees vendor payments"             ON public.ff_vendor_payments;

CREATE POLICY "hub_manager sees own hub vendor payments"
  ON public.ff_vendor_payments FOR SELECT
  USING (
    current_user_role() IN ('hub_manager','purchase_manager','purchase_head')
    AND hub_id = current_user_hub()
  );

CREATE POLICY "ff_ops sees all vendor payments"
  ON public.ff_vendor_payments FOR SELECT
  USING (current_user_role() = 'ff_operations_manager');

CREATE POLICY "approvers see all vendor payments"
  ON public.ff_vendor_payments FOR SELECT
  USING (current_user_role() IN ('gm','l1_manager','auditor','ceo','admin','accounts'));

CREATE POLICY "purchase creates vendor payment"
  ON public.ff_vendor_payments FOR INSERT
  WITH CHECK (current_user_role() IN (
    'purchase_manager','purchase_head','hub_manager','ff_operations_manager','admin'
  ));

CREATE POLICY "approvers update vendor payments"
  ON public.ff_vendor_payments FOR UPDATE
  USING (current_user_role() IN (
    'ff_operations_manager','gm','l1_manager','auditor','ceo','admin','accounts'
  ));


-- ── ff_transport_payments ────────────────────────────────────────

DROP POLICY IF EXISTS "hub_manager sees own hub transport payments" ON public.ff_transport_payments;
DROP POLICY IF EXISTS "ff_ops sees all transport payments"          ON public.ff_transport_payments;
DROP POLICY IF EXISTS "approvers see all transport payments"        ON public.ff_transport_payments;
DROP POLICY IF EXISTS "hub_manager creates transport payment"       ON public.ff_transport_payments;
DROP POLICY IF EXISTS "approvers update transport payments"         ON public.ff_transport_payments;

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
  USING (current_user_role() IN ('gm','l1_manager','auditor','ceo','admin','accounts'));

CREATE POLICY "hub_manager creates transport payment"
  ON public.ff_transport_payments FOR INSERT
  WITH CHECK (current_user_role() IN ('hub_manager','ff_operations_manager','admin'));

CREATE POLICY "approvers update transport payments"
  ON public.ff_transport_payments FOR UPDATE
  USING (current_user_role() IN (
    'ff_operations_manager','gm','l1_manager','auditor','ceo','admin','accounts'
  ));


-- ── ff_task_assignments ──────────────────────────────────────────

DROP POLICY IF EXISTS "ff_ops manages task assignments" ON public.ff_task_assignments;
DROP POLICY IF EXISTS "assignee sees own tasks"         ON public.ff_task_assignments;
DROP POLICY IF EXISTS "assignee updates own task"       ON public.ff_task_assignments;
DROP POLICY IF EXISTS "management views all tasks"      ON public.ff_task_assignments;

CREATE POLICY "ff_ops manages task assignments"
  ON public.ff_task_assignments FOR ALL
  USING (current_user_role() IN ('ff_operations_manager','admin'));

CREATE POLICY "assignee sees own tasks"
  ON public.ff_task_assignments FOR SELECT
  USING (assigned_to = auth.uid());

CREATE POLICY "assignee updates own task"
  ON public.ff_task_assignments FOR UPDATE
  USING (assigned_to = auth.uid());

CREATE POLICY "management views all tasks"
  ON public.ff_task_assignments FOR SELECT
  USING (current_user_role() IN ('gm','l1_manager','ceo','admin','ff_operations_manager'));


-- ── ff_payment_audit_trail ───────────────────────────────────────

DROP POLICY IF EXISTS "management reads audit trail" ON public.ff_payment_audit_trail;

CREATE POLICY "management reads audit trail"
  ON public.ff_payment_audit_trail FOR SELECT
  USING (current_user_role() IN (
    'ff_operations_manager','gm','l1_manager','auditor','ceo','admin'
  ));


-- ────────────────────────────────────────────────────────────────
-- STEP 7 — AUTOMATION TRIGGERS
-- ────────────────────────────────────────────────────────────────

-- ── 7a. Audit trail: log every status change ─────────────────────

CREATE OR REPLACE FUNCTION public.trg_vendor_payment_audit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
    INSERT INTO public.ff_payment_audit_trail
      (payment_type, payment_id, from_status, to_status, changed_by, remarks)
    VALUES (
      'vendor', NEW.id, OLD.payment_status, NEW.payment_status,
      COALESCE(
        NEW.ff_ops_approved_by, NEW.gm_approved_by, NEW.l1_approved_by,
        NEW.auditor_approved_by, NEW.ceo_approved_by, NEW.rejected_by, NEW.paid_by
      ),
      CASE NEW.payment_status
        WHEN 'pending_gm'      THEN 'Approved by FF Ops · ' || COALESCE(NEW.ff_ops_remarks,'')
        WHEN 'pending_l1'      THEN 'Approved by GM · '     || COALESCE(NEW.gm_remarks,'')
        WHEN 'pending_auditor' THEN 'Approved by L1 · '     || COALESCE(NEW.l1_remarks,'')
        WHEN 'pending_ceo'     THEN 'Approved by Auditor · '|| COALESCE(NEW.auditor_remarks,'')
        WHEN 'approved'        THEN 'CEO Approved · '        || COALESCE(NEW.ceo_remarks,'')
        WHEN 'paid'            THEN 'Paid · UTR: '           || COALESCE(NEW.utr_number,'—')
        WHEN 'rejected'        THEN 'Rejected · '            || COALESCE(NEW.rejection_reason,'—')
        ELSE NULL
      END
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendor_payment_audit ON public.ff_vendor_payments;
CREATE TRIGGER trg_vendor_payment_audit
  AFTER UPDATE ON public.ff_vendor_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_vendor_payment_audit();


CREATE OR REPLACE FUNCTION public.trg_transport_payment_audit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
    INSERT INTO public.ff_payment_audit_trail
      (payment_type, payment_id, from_status, to_status, changed_by, remarks)
    VALUES (
      'transport', NEW.id, OLD.payment_status, NEW.payment_status,
      COALESCE(
        NEW.ff_ops_approved_by, NEW.gm_approved_by, NEW.l1_approved_by,
        NEW.auditor_approved_by, NEW.ceo_approved_by, NEW.rejected_by, NEW.paid_by
      ),
      CASE NEW.payment_status
        WHEN 'approved' THEN 'CEO Approved · ' || COALESCE(NEW.ceo_remarks,'')
        WHEN 'paid'     THEN 'Paid · UTR: '    || COALESCE(NEW.utr_number,'—')
        WHEN 'rejected' THEN 'Rejected · '     || COALESCE(NEW.rejection_reason,'—')
        ELSE NULL
      END
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transport_payment_audit ON public.ff_transport_payments;
CREATE TRIGGER trg_transport_payment_audit
  AFTER UPDATE ON public.ff_transport_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_transport_payment_audit();


-- ── 7b. Auto-create vendor payment when PO status → 'received' ───

CREATE OR REPLACE FUNCTION public.trg_po_received_create_payment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_items JSONB;
  v_gross NUMERIC;
BEGIN
  IF NEW.status = 'received' AND (OLD.status IS DISTINCT FROM 'received') THEN
    IF EXISTS (
      SELECT 1 FROM public.ff_vendor_payments WHERE purchase_order_id = NEW.id
    ) THEN RETURN NEW; END IF;

    SELECT COALESCE(
      jsonb_agg(jsonb_build_object(
        'product_name', COALESCE(p.name, poi.product_name, 'Unknown'),
        'qty',   poi.quantity,  'unit', COALESCE(poi.unit, 'kg'),
        'rate',  poi.unit_price,'amount', poi.quantity * poi.unit_price,
        'qc_grade', NULL, 'deduction_reason', NULL
      )), '[]'::jsonb)
    INTO v_items
    FROM public.purchase_order_items poi
    LEFT JOIN public.products p ON p.id = poi.product_id
    WHERE poi.purchase_order_id = NEW.id;

    SELECT COALESCE(SUM(quantity * unit_price), 0)
    INTO v_gross
    FROM public.purchase_order_items WHERE purchase_order_id = NEW.id;

    IF v_gross = 0 THEN v_gross := COALESCE(NEW.total_amount, 0); END IF;

    INSERT INTO public.ff_vendor_payments
      (purchase_order_id, vendor_id, hub_id, items, gross_amount,
       deduction_amount, payment_status, created_by)
    VALUES
      (NEW.id, NEW.vendor_id, NEW.hub_id, v_items, v_gross,
       0, 'pending_ff_ops', NEW.created_by);

    RAISE NOTICE 'Auto-created vendor payment for PO %', NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchase_orders'
      AND column_name = 'status'
  ) THEN
    DROP TRIGGER IF EXISTS trg_po_received_create_payment ON public.purchase_orders;
    CREATE TRIGGER trg_po_received_create_payment
      AFTER UPDATE OF status ON public.purchase_orders
      FOR EACH ROW EXECUTE FUNCTION public.trg_po_received_create_payment();
    RAISE NOTICE 'Trigger trg_po_received_create_payment attached';
  ELSE
    RAISE NOTICE 'Skipped trigger — purchase_orders.status not found';
  END IF;
END $$;


-- ── 7c. When vendor payment marked 'paid' → sync PO payment_status

CREATE OR REPLACE FUNCTION public.trg_vendor_payment_paid_sync_po()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.payment_status = 'paid' AND OLD.payment_status <> 'paid'
     AND NEW.purchase_order_id IS NOT NULL THEN
    UPDATE public.purchase_orders
    SET payment_status = 'paid', paid_at = now()
    WHERE id = NEW.purchase_order_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendor_payment_paid_sync_po ON public.ff_vendor_payments;
CREATE TRIGGER trg_vendor_payment_paid_sync_po
  AFTER UPDATE OF payment_status ON public.ff_vendor_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_vendor_payment_paid_sync_po();


-- ── 7d. Auto-miss overdue tasks (call daily via Edge Function / pg_cron)

CREATE OR REPLACE FUNCTION public.auto_miss_overdue_tasks()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE public.ff_task_assignments
  SET status = 'missed'
  WHERE task_date < CURRENT_DATE AND status IN ('pending','in_progress');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Marked % tasks as missed', v_count;
  RETURN v_count;
END;
$$;


-- ────────────────────────────────────────────────────────────────
-- STEP 8 — HELPER VIEW: PAYMENT PIPELINE SUMMARY
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_ff_payment_pipeline AS
SELECT 'vendor' AS payment_type, payment_status,
       COUNT(*) AS count, SUM(net_amount) AS total_amount, MIN(created_at) AS oldest_pending
FROM public.ff_vendor_payments GROUP BY payment_status
UNION ALL
SELECT 'transport', payment_status,
       COUNT(*), SUM(total_amount), MIN(created_at)
FROM public.ff_transport_payments GROUP BY payment_status;


-- ────────────────────────────────────────────────────────────────
-- STEP 9 — DEFAULT USER CREDENTIALS
-- All users: FFerp@2025  |  Sales team: individual passwords
-- Re-running is safe — skips users that already exist
-- ────────────────────────────────────────────────────────────────

DO $$
DECLARE
  users_data     RECORD;
  v_uid          UUID;
  v_hub_id       UUID;
  v_encrypted_pw TEXT;
  v_now          TIMESTAMPTZ := now();
  v_instance_id  UUID;
BEGIN
  SELECT instance_id INTO v_instance_id FROM auth.users LIMIT 1;
  IF v_instance_id IS NULL THEN
    v_instance_id := '00000000-0000-0000-0000-000000000000'::UUID;
  END IF;

  FOR users_data IN (
    SELECT * FROM (VALUES
      -- Management & Head Office  (password: FFerp@2025)
      ('admin@ffactory.com',              'Admin User',               'admin',                'Head Office', NULL::TEXT, 'FFerp@2025'),
      ('ceo@ffactory.com',                'CEO',                      'ceo',                  'Head Office', NULL,       'FFerp@2025'),
      ('l1.manager@ffactory.com',         'L1 Manager',               'l1_manager',           'Finance',     NULL,       'FFerp@2025'),
      ('gm@ffactory.com',                 'General Manager',          'gm',                   'Operations',  NULL,       'FFerp@2025'),
      ('auditor@ffactory.com',            'Internal Auditor',         'auditor',              'Audit',       NULL,       'FFerp@2025'),
      ('ops.manager@ffactory.com',        'FF Operations Manager',    'ff_operations_manager','Operations',  NULL,       'FFerp@2025'),
      ('accounts@ffactory.com',           'Accounts Executive',       'accounts',             'Accounts',    NULL,       'FFerp@2025'),
      -- Sales Team (individual passwords)
      ('priyanka@farmersfactory.in',      'Priyanka',                 'field_executive',      'Sales',       NULL,       'Priya@2026'),
      ('indhurekha@farmersfactory.in',    'Indhurekha',               'field_executive',      'Sales',       NULL,       'Indhu@2026'),
      ('arun@farmersfactory.in',          'Arun',                     'field_executive',      'Sales',       NULL,       'Arun@2026'),
      ('akash@farmersfactory.in',         'Akash',                    'field_executive',      'Sales',       NULL,       'Akash@2026'),
      ('parasajagadeesh@farmersfactory.in','Parasa Jagadeesh',        'field_executive',      'Sales',       NULL,       'Parasa@2026'),
      ('yazhini@farmersfactory.in',       'Yazhini',                  'field_executive',      'Sales',       NULL,       'Yazhi@2026'),
      ('anusiya@farmersfactory.in',       'Anusiya',                  'field_executive',      'Sales',       NULL,       'Anusi@2026'),
      -- Purchase Team (per hub)
      ('purchase.hyd@ffactory.com',       'Purchase Exe - Hyderabad', 'purchase_manager',     'Purchase',    'Hyderabad','FFerp@2025'),
      ('purchase.pali@ffactory.com',      'Purchase Exe - Palikarani','purchase_manager',     'Purchase',    'Palikarani','FFerp@2025'),
      ('purchase.vana@ffactory.com',      'Purchase Exe - Vanagaram', 'purchase_manager',     'Purchase',    'Vanagaram','FFerp@2025'),
      -- Hub Managers
      ('manager.hyderabad@ffactory.com',  'Hub Manager - Hyderabad',  'hub_manager',          'Warehouse',   'Hyderabad','FFerp@2025'),
      ('manager.palikarani@ffactory.com', 'Hub Manager - Palikarani', 'hub_manager',          'Warehouse',   'Palikarani','FFerp@2025'),
      ('manager.vanagaram@ffactory.com',  'Hub Manager - Vanagaram',  'hub_manager',          'Warehouse',   'Vanagaram','FFerp@2025'),
      -- Logistics
      ('driver1@ffactory.com',            'Driver 1',                 'driver',               'Logistics',   'Hyderabad','FFerp@2025'),
      -- Back Office
      ('backoffice@ffactory.com',         'Back Office',              'back_office',          'Admin',       NULL,       'FFerp@2025')
    ) AS t(email, full_name, role_name, dept, hub_name, password)
  ) LOOP

    IF EXISTS (SELECT 1 FROM auth.users WHERE email = users_data.email) THEN
      RAISE NOTICE 'Skipping (already exists): %', users_data.email;
      CONTINUE;
    END IF;

    v_uid          := gen_random_uuid();
    v_encrypted_pw := crypt(users_data.password, gen_salt('bf', 10));
    v_hub_id       := NULL;

    IF users_data.hub_name IS NOT NULL THEN
      SELECT id INTO v_hub_id FROM public.hubs
      WHERE name ILIKE '%' || users_data.hub_name || '%' LIMIT 1;
    END IF;

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      v_instance_id, v_uid, 'authenticated', 'authenticated',
      users_data.email, v_encrypted_pw, v_now,
      jsonb_build_object('provider','email','providers',ARRAY['email']),
      jsonb_build_object('name', users_data.full_name),
      v_now, v_now, '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', users_data.email),
      'email', users_data.email, v_now, v_now, v_now
    );

    INSERT INTO public.profiles (id, email, name, role, department, hub_id, created_at)
    VALUES (v_uid, users_data.email, users_data.full_name,
            users_data.role_name, users_data.dept, v_hub_id, v_now)
    ON CONFLICT (id) DO UPDATE SET
      role       = EXCLUDED.role,
      name       = EXCLUDED.name,
      department = EXCLUDED.department,
      hub_id     = EXCLUDED.hub_id;

    RAISE NOTICE 'Created: % (%) hub=%',
      users_data.email, users_data.role_name,
      COALESCE(users_data.hub_name, 'head-office');
  END LOOP;
END $$;


-- ────────────────────────────────────────────────────────────────
-- STEP 10 — VERIFY  (results appear in the Results panel)
-- ────────────────────────────────────────────────────────────────

-- New tables created?
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'ff_vendor_payments','ff_transport_payments',
    'ff_task_assignments','ff_payment_audit_trail'
  )
ORDER BY table_name;

-- New columns on existing tables?
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'sales_orders'     AND column_name = 'source') OR
    (table_name = 'profiles'         AND column_name = 'hub_id') OR
    (table_name = 'purchase_orders'  AND column_name IN ('payment_status','paid_at','hub_id','created_by'))
  )
ORDER BY table_name, column_name;

-- Triggers created?
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE 'trg_%ff%' OR trigger_name LIKE 'trg_%vendor%'
     OR trigger_name LIKE 'trg_%transport%' OR trigger_name LIKE 'trg_%po_%'
     OR trigger_name LIKE 'trg_%task%'
ORDER BY event_object_table, trigger_name;

-- Users created?
SELECT p.email, p.role, p.department, h.name AS hub
FROM public.profiles p
LEFT JOIN public.hubs h ON h.id = p.hub_id
WHERE p.email LIKE '%@ffactory.com' OR p.email LIKE '%@farmersfactory.in'
ORDER BY p.role, p.email;
