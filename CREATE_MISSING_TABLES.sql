-- ============================================================
--  FF ERP — CREATE ALL MISSING TABLES
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--  All use CREATE TABLE IF NOT EXISTS — safe to re-run.
--  Generated: 2026-06-01
-- ============================================================


-- ════════════════════════════════════════════════════════════
--  DAILY WORKFLOW TABLES (all roles use these)
-- ════════════════════════════════════════════════════════════

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

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_type       text NOT NULL DEFAULT 'casual',
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

CREATE TABLE IF NOT EXISTS public.payment_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  purpose             text NOT NULL,
  vendor_name         text NOT NULL,
  vendor_bank_details text,
  amount              numeric(15,2) NOT NULL,
  bill_url            text,
  work_proof_url      text,
  urgency             text NOT NULL DEFAULT 'normal',
  status              text NOT NULL DEFAULT 'pending',
  project_id          uuid,
  approved_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at         timestamptz,
  rejection_reason    text,
  notes               text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_calendar (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  event_date  date NOT NULL,
  event_type  text DEFAULT 'general',
  is_holiday  boolean DEFAULT false,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.system_settings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text UNIQUE NOT NULL,
  value      text,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
--  SHIFT TABLES (purchase_manager, hub_manager)
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.shift_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  hub_id      uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  date        date NOT NULL,
  login_time  timestamptz,
  logout_time timestamptz,
  total_hours numeric DEFAULT 0,
  status      text DEFAULT 'active',
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS public.shift_hourly_slots (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.shift_sessions(id) ON DELETE CASCADE,
  slot_hour  integer NOT NULL,
  task       text,
  report     text,
  status     text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
--  TASK & TARGET TABLES (ff_operations_manager, field_executive)
-- ════════════════════════════════════════════════════════════

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

CREATE TABLE IF NOT EXISTS public.ff_task_assignments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  description  text,
  assigned_to  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  hub_id       uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  due_date     date,
  priority     text DEFAULT 'medium',
  status       text DEFAULT 'pending',
  target_value numeric(12,2),
  target_unit  text,
  notes        text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS public.sales_targets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id         uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  user_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
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

-- ════════════════════════════════════════════════════════════
--  PURCHASE TABLES (purchase_manager, ff_operations_manager)
-- ════════════════════════════════════════════════════════════

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

CREATE TABLE IF NOT EXISTS public.po_bills (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name   text NOT NULL,
  required_qty   numeric(10,2) DEFAULT 0,
  unit           text DEFAULT 'kg',
  bill_date      date NOT NULL DEFAULT CURRENT_DATE,
  hub_id         uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  vendor_entries jsonb DEFAULT '[]',
  total_amount   numeric(12,2) DEFAULT 0,
  status         text DEFAULT 'draft'
                   CHECK (status IN ('draft','billed','cancelled')),
  bill_created   boolean DEFAULT false,
  created_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
--  FF PAYMENT TABLES (payment approval chain)
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ff_vendor_payments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id         uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  hub_id            uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  items             jsonb DEFAULT '[]',
  gross_amount      numeric(12,2) NOT NULL DEFAULT 0,
  deduction_amount  numeric(12,2) DEFAULT 0,
  net_amount        numeric(12,2) GENERATED ALWAYS AS (gross_amount - COALESCE(deduction_amount,0)) STORED,
  payment_status    text NOT NULL DEFAULT 'pending_ff_ops'
                      CHECK (payment_status IN (
                        'pending_ff_ops','pending_gm','pending_l1',
                        'pending_auditor','pending_ceo','approved','paid','rejected'
                      )),
  ff_ops_approved_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ff_ops_approved_at  timestamptz,
  gm_approved_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  gm_approved_at      timestamptz,
  l1_approved_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  l1_approved_at      timestamptz,
  auditor_approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  auditor_approved_at timestamptz,
  ceo_approved_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ceo_approved_at     timestamptz,
  rejection_reason    text,
  created_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ff_transport_payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  hub_id          uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  trip_date       date NOT NULL DEFAULT CURRENT_DATE,
  vehicle_number  text,
  origin          text,
  destination     text,
  km_covered      numeric(8,2),
  base_amount     numeric(12,2) DEFAULT 0,
  toll_charges    numeric(12,2) DEFAULT 0,
  other_charges   numeric(12,2) DEFAULT 0,
  total_amount    numeric(12,2) GENERATED ALWAYS AS (
                    COALESCE(base_amount,0) + COALESCE(toll_charges,0) + COALESCE(other_charges,0)
                  ) STORED,
  bill_url        text,
  trip_proof_url  text,
  payment_status  text NOT NULL DEFAULT 'pending_ff_ops'
                    CHECK (payment_status IN (
                      'pending_ff_ops','pending_gm','pending_l1',
                      'pending_auditor','pending_ceo','approved','paid','rejected'
                    )),
  ff_ops_approved_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ff_ops_approved_at  timestamptz,
  gm_approved_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  gm_approved_at      timestamptz,
  l1_approved_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  l1_approved_at      timestamptz,
  auditor_approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  auditor_approved_at timestamptz,
  ceo_approved_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ceo_approved_at     timestamptz,
  rejection_reason    text,
  created_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
--  INDEXES
-- ════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_day_starts_user_date    ON public.day_starts(user_id, date);
CREATE INDEX IF NOT EXISTS idx_day_plans_user_date     ON public.day_plans(user_id, date);
CREATE INDEX IF NOT EXISTS idx_hourly_reports_user     ON public.hourly_reports(user_id, date);
CREATE INDEX IF NOT EXISTS idx_eod_user_date           ON public.eod_reports(user_id, date);
CREATE INDEX IF NOT EXISTS idx_shift_sessions_user     ON public.shift_sessions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_task_assigned_to        ON public.task_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_ff_tasks_assigned_to    ON public.ff_task_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_ff_vp_status            ON public.ff_vendor_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_ff_tp_status            ON public.ff_transport_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_leave_user              ON public.leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_req_user        ON public.payment_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_market_rates_date       ON public.market_rates(date);
CREATE INDEX IF NOT EXISTS idx_po_bills_hub            ON public.po_bills(hub_id);
CREATE INDEX IF NOT EXISTS idx_weekly_targets_user     ON public.weekly_targets(user_id);

-- ════════════════════════════════════════════════════════════
--  UPDATED_AT TRIGGERS
-- ════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS leave_requests_updated_at     ON public.leave_requests;
DROP TRIGGER IF EXISTS payment_requests_updated_at   ON public.payment_requests;
DROP TRIGGER IF EXISTS task_assignments_updated_at   ON public.task_assignments;
DROP TRIGGER IF EXISTS ff_task_assignments_updated_at ON public.ff_task_assignments;
DROP TRIGGER IF EXISTS ff_vendor_payments_updated_at ON public.ff_vendor_payments;
DROP TRIGGER IF EXISTS ff_transport_payments_updated_at ON public.ff_transport_payments;
DROP TRIGGER IF EXISTS po_bills_updated_at           ON public.po_bills;

CREATE TRIGGER leave_requests_updated_at     BEFORE UPDATE ON public.leave_requests     FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER payment_requests_updated_at   BEFORE UPDATE ON public.payment_requests   FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER task_assignments_updated_at   BEFORE UPDATE ON public.task_assignments   FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER ff_task_assignments_updated_at BEFORE UPDATE ON public.ff_task_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER ff_vendor_payments_updated_at BEFORE UPDATE ON public.ff_vendor_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER ff_transport_payments_updated_at BEFORE UPDATE ON public.ff_transport_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER po_bills_updated_at           BEFORE UPDATE ON public.po_bills           FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ════════════════════════════════════════════════════════════
--  VERIFY — list all newly created tables
-- ════════════════════════════════════════════════════════════

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'day_starts','day_plans','hourly_plans','hourly_reports','eod_reports',
    'leave_requests','payment_requests','company_calendar','system_settings',
    'shift_sessions','shift_hourly_slots','task_assignments','ff_task_assignments',
    'weekly_targets','weekly_achievements','sales_targets','market_rates',
    'po_bills','ff_vendor_payments','ff_transport_payments'
  )
ORDER BY table_name;
