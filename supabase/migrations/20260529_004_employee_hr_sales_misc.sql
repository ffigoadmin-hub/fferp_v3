-- ============================================================
--  FFERPv2 — Employee, HR, Sales & Miscellaneous Tables
--  Migration: 20260529_004_employee_hr_sales_misc.sql
-- ============================================================

-- ════════════════════════════════════════════════════════════
--  EMPLOYEE PROFILE EXTRAS
-- ════════════════════════════════════════════════════════════

-- ── 1. EMPLOYEE ACHIEVEMENTS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employee_achievements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text,
  category     text NOT NULL DEFAULT 'work' CHECK (category IN ('work','personal','award','certification')),
  proof_url    text,
  achieved_on  date,
  is_public    boolean DEFAULT false,
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employee_achievements_user ON public.employee_achievements(user_id);
ALTER TABLE public.employee_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own achievements" ON public.employee_achievements FOR SELECT USING (user_id = auth.uid() OR is_public = true OR get_my_role() IN ('admin','ceo','gm','hr','director'));
CREATE POLICY "Managers create achievements" ON public.employee_achievements FOR INSERT WITH CHECK (get_my_role() IN ('admin','ceo','gm','hr','director') OR user_id = auth.uid());
CREATE POLICY "Managers update achievements" ON public.employee_achievements FOR UPDATE USING (get_my_role() IN ('admin','ceo','gm','hr','director') OR user_id = auth.uid());
CREATE POLICY "Managers delete achievements" ON public.employee_achievements FOR DELETE USING (get_my_role() IN ('admin','ceo','hr'));
CREATE TRIGGER employee_achievements_updated_at BEFORE UPDATE ON public.employee_achievements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 2. EMPLOYEE HISTORY ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employee_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  change_type     text NOT NULL CHECK (change_type IN ('role_change','department_transfer','team_change','promotion','salary_change','onboarded','resigned','other')),
  old_value       text,
  new_value       text,
  description     text,
  effective_date  date NOT NULL,
  changed_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employee_history_user ON public.employee_history(user_id);
ALTER TABLE public.employee_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own history" ON public.employee_history FOR SELECT USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr','director'));
CREATE POLICY "Managers create history" ON public.employee_history FOR INSERT WITH CHECK (get_my_role() IN ('admin','ceo','gm','hr','director'));

-- ── 3. EMPLOYEE ISSUES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employee_issues (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  issue_type     text NOT NULL,
  title          text NOT NULL,
  description    text,
  severity       text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status         text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  resolved_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at    timestamptz,
  resolution     text,
  created_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employee_issues_user ON public.employee_issues(user_id);
ALTER TABLE public.employee_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own issues" ON public.employee_issues FOR SELECT USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr','director'));
CREATE POLICY "Managers manage issues" ON public.employee_issues FOR ALL USING (get_my_role() IN ('admin','ceo','gm','hr','director'));

-- ── 4. EMPLOYEE LOP ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employee_lop (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month        text NOT NULL,
  year         integer NOT NULL,
  lop_days     numeric(5,2) DEFAULT 0,
  lop_amount   numeric(12,2) DEFAULT 0,
  reason       text,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','reversed')),
  approved_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at  timestamptz,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE(user_id, month, year)
);
CREATE INDEX IF NOT EXISTS idx_employee_lop_user ON public.employee_lop(user_id);
ALTER TABLE public.employee_lop ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own lop" ON public.employee_lop FOR SELECT USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr','director','accounts'));
CREATE POLICY "HR manage lop" ON public.employee_lop FOR ALL USING (get_my_role() IN ('admin','ceo','gm','hr','director'));

-- ── 5. DEDUCTION MEMOS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deduction_memos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount       numeric(12,2) NOT NULL DEFAULT 0,
  reason       text NOT NULL,
  memo_type    text NOT NULL DEFAULT 'deduction' CHECK (memo_type IN ('deduction','advance','fine')),
  month        text,
  year         integer,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applied','cancelled')),
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deduction_memos_user ON public.deduction_memos(user_id);
ALTER TABLE public.deduction_memos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own deduction_memos" ON public.deduction_memos FOR SELECT USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','hr','accounts'));
CREATE POLICY "HR manage deduction_memos" ON public.deduction_memos FOR ALL USING (get_my_role() IN ('admin','ceo','hr','accounts'));

-- ── 6. PAYEES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payees (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  bank_name      text,
  account_number text,
  ifsc_code      text,
  phone          text,
  type           text DEFAULT 'individual' CHECK (type IN ('individual','vendor','employee')),
  is_active      boolean DEFAULT true,
  created_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
ALTER TABLE public.payees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authorized view payees" ON public.payees FOR SELECT USING (get_my_role() IN ('admin','ceo','gm','accounts','finance','director'));
CREATE POLICY "Accounts manage payees" ON public.payees FOR ALL USING (get_my_role() IN ('admin','ceo','accounts','finance'));

-- ── 7. PAYMENT DEDUCTION LINES ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_deduction_lines (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_request_id uuid REFERENCES public.payment_requests(id) ON DELETE CASCADE,
  description        text NOT NULL,
  amount             numeric(12,2) NOT NULL DEFAULT 0,
  deduction_type     text DEFAULT 'tds' CHECK (deduction_type IN ('tds','advance','fine','other')),
  created_at         timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_deduction_lines_pr ON public.payment_deduction_lines(payment_request_id);
ALTER TABLE public.payment_deduction_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authorized view deduction_lines" ON public.payment_deduction_lines FOR SELECT USING (get_my_role() IN ('admin','ceo','gm','accounts','finance'));
CREATE POLICY "Accounts manage deduction_lines" ON public.payment_deduction_lines FOR ALL USING (get_my_role() IN ('admin','ceo','accounts','finance'));

-- ── 8. SALARY BATCH EMPLOYEES ────────────────────────────────
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
  lop_days         numeric(5,2) NOT NULL DEFAULT 0,
  lop_amount       numeric(12,2) NOT NULL DEFAULT 0,
  lop_bucket       text NOT NULL DEFAULT '{}',
  increment        numeric(5,2) NOT NULL DEFAULT 0,
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
CREATE INDEX IF NOT EXISTS idx_salary_batch_emp_batch ON public.salary_batch_employees(batch_id);
CREATE INDEX IF NOT EXISTS idx_salary_batch_emp_employee ON public.salary_batch_employees(employee_id);
ALTER TABLE public.salary_batch_employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR view salary_batch_employees" ON public.salary_batch_employees FOR SELECT USING (get_my_role() IN ('admin','ceo','gm','hr','accounts','director') OR employee_id = auth.uid() OR profile_id = auth.uid());
CREATE POLICY "HR manage salary_batch_employees" ON public.salary_batch_employees FOR ALL USING (get_my_role() IN ('admin','ceo','hr','accounts'));
CREATE TRIGGER salary_batch_employees_updated_at BEFORE UPDATE ON public.salary_batch_employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ════════════════════════════════════════════════════════════
--  HR / ATTENDANCE
-- ════════════════════════════════════════════════════════════

-- ── 9. GEOFENCES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.geofences (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  latitude       numeric(10,7) NOT NULL,
  longitude      numeric(10,7) NOT NULL,
  radius_meters  integer NOT NULL DEFAULT 100,
  action_type    text NOT NULL DEFAULT 'office' CHECK (action_type IN ('office','site','hub','warehouse','other')),
  is_active      boolean DEFAULT true,
  created_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view geofences" ON public.geofences FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin manage geofences" ON public.geofences FOR ALL USING (get_my_role() IN ('admin','ceo','gm','hr'));

-- ── 10. ATTENDANCE LOCK OVERRIDES ────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance_lock_overrides (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date         date NOT NULL,
  override_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason       text NOT NULL,
  override_type text NOT NULL DEFAULT 'unlock' CHECK (override_type IN ('unlock','manual_present','manual_absent')),
  created_at   timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_lock_user ON public.attendance_lock_overrides(user_id);
ALTER TABLE public.attendance_lock_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own overrides" ON public.attendance_lock_overrides FOR SELECT USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr'));
CREATE POLICY "Admin manage overrides" ON public.attendance_lock_overrides FOR ALL USING (get_my_role() IN ('admin','ceo','hr'));

-- ── 11. WEEK OFF ASSIGNMENTS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.week_off_assignments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_off_date    date NOT NULL,
  assignment_type  text NOT NULL DEFAULT 'one_time' CHECK (assignment_type IN ('one_time','recurring_weekly')),
  recurring_day    integer CHECK (recurring_day BETWEEN 0 AND 6),
  reason           text,
  assigned_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active        boolean DEFAULT true,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_week_off_employee ON public.week_off_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_week_off_date ON public.week_off_assignments(week_off_date);
ALTER TABLE public.week_off_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own week_off" ON public.week_off_assignments FOR SELECT USING (employee_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr'));
CREATE POLICY "Admin manage week_off" ON public.week_off_assignments FOR ALL USING (get_my_role() IN ('admin','ceo','hr','gm'));
CREATE TRIGGER week_off_assignments_updated_at BEFORE UPDATE ON public.week_off_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 12. HR ATTESTATIONS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_attestations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date          date NOT NULL,
  attestation_type text NOT NULL DEFAULT 'daily' CHECK (attestation_type IN ('daily','weekly','monthly')),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','attested','discrepancy')),
  attested_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  attested_at   timestamptz,
  notes         text,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(employee_id, date, attestation_type)
);
CREATE INDEX IF NOT EXISTS idx_hr_attestations_employee ON public.hr_attestations(employee_id);
ALTER TABLE public.hr_attestations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR view attestations" ON public.hr_attestations FOR SELECT USING (get_my_role() IN ('admin','ceo','hr','gm') OR employee_id = auth.uid());
CREATE POLICY "HR manage attestations" ON public.hr_attestations FOR ALL USING (get_my_role() IN ('admin','ceo','hr'));

-- ── 13. ONBOARDING REQUESTS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.onboarding_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  email          text NOT NULL,
  phone          text,
  department     text,
  role           text NOT NULL DEFAULT 'employee',
  requested_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','completed')),
  approved_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at    timestamptz,
  rejection_reason text,
  notes          text,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
ALTER TABLE public.onboarding_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR view onboarding_requests" ON public.onboarding_requests FOR SELECT USING (get_my_role() IN ('admin','ceo','hr','gm'));
CREATE POLICY "HR manage onboarding_requests" ON public.onboarding_requests FOR ALL USING (get_my_role() IN ('admin','ceo','hr'));

-- ── 14. USER LOCATION LOGS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_location_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  latitude    numeric(10,7) NOT NULL,
  longitude   numeric(10,7) NOT NULL,
  accuracy    numeric(8,2),
  geofence_id uuid REFERENCES public.geofences(id) ON DELETE SET NULL,
  log_type    text DEFAULT 'tracking' CHECK (log_type IN ('day_start','tracking','check_in','check_out')),
  logged_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_location_user ON public.user_location_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_location_logged ON public.user_location_logs(logged_at);
ALTER TABLE public.user_location_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users log own location" ON public.user_location_logs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admin view location_logs" ON public.user_location_logs FOR SELECT USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr'));

-- ── 15. CORE HEADS ───────────────────────────────────────────
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
ALTER TABLE public.core_heads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view core_heads" ON public.core_heads FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin manage core_heads" ON public.core_heads FOR ALL USING (get_my_role() IN ('admin','ceo'));

-- ════════════════════════════════════════════════════════════
--  DAILY OPERATIONS EXTRAS
-- ════════════════════════════════════════════════════════════

-- ── 16. HOURLY PLANS ─────────────────────────────────────────
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
ALTER TABLE public.hourly_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own hourly_plans" ON public.hourly_plans FOR ALL USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr','datateam'));

-- ── 17. HOURLY CRITICALS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hourly_criticals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number    text UNIQUE DEFAULT ('CRT-' || to_char(now(),'YYYYMMDD') || '-' || substr(gen_random_uuid()::text,1,6)),
  issue_title      text NOT NULL,
  issue_description text,
  urgency          text NOT NULL DEFAULT 'high' CHECK (urgency IN ('medium','high','critical')),
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved','closed')),
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
ALTER TABLE public.hourly_criticals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view hourly_criticals" ON public.hourly_criticals FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated create hourly_criticals" ON public.hourly_criticals FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Managers update hourly_criticals" ON public.hourly_criticals FOR UPDATE USING (get_my_role() IN ('admin','ceo','gm','gmo','smo','datateam'));
CREATE TRIGGER hourly_criticals_updated_at BEFORE UPDATE ON public.hourly_criticals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 18. HOURLY CRITICAL TIMELINE ─────────────────────────────
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
ALTER TABLE public.hourly_critical_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view critical_timeline" ON public.hourly_critical_timeline FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated add critical_timeline" ON public.hourly_critical_timeline FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── 19. SHIFT BREAKS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shift_breaks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL REFERENCES public.shift_sessions(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  break_start  timestamptz NOT NULL DEFAULT now(),
  break_end    timestamptz,
  duration_min integer,
  break_type   text DEFAULT 'short' CHECK (break_type IN ('short','meal','emergency')),
  notes        text,
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shift_breaks_session ON public.shift_breaks(session_id);
CREATE INDEX IF NOT EXISTS idx_shift_breaks_user ON public.shift_breaks(user_id);
ALTER TABLE public.shift_breaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own shift_breaks" ON public.shift_breaks FOR ALL USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr'));

-- ── 20. QC REJECTIONS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qc_rejections (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qc_inspection_id uuid REFERENCES public.qc_inspections(id) ON DELETE CASCADE,
  sales_order_id uuid REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id     uuid REFERENCES public.products(id) ON DELETE SET NULL,
  rejection_reason text NOT NULL,
  quantity_rejected numeric(10,3) DEFAULT 0,
  unit           text DEFAULT 'kg',
  photos         text[],
  rejected_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved       boolean DEFAULT false,
  resolved_at    timestamptz,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qc_rejections_order ON public.qc_rejections(sales_order_id);
ALTER TABLE public.qc_rejections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view qc_rejections" ON public.qc_rejections FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "QC manage rejections" ON public.qc_rejections FOR ALL USING (get_my_role() IN ('admin','ceo','gm','warehouse','logistics','datateam'));

-- ════════════════════════════════════════════════════════════
--  SALES & TARGETS
-- ════════════════════════════════════════════════════════════

-- ── 21. SALES TARGETS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sales_targets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id         uuid REFERENCES public.hubs(id) ON DELETE SET NULL,
  target_date    date NOT NULL,
  target_type    text NOT NULL DEFAULT 'daily' CHECK (target_type IN ('daily','weekly','monthly')),
  target_revenue numeric(15,2) DEFAULT 0,
  target_orders  integer DEFAULT 0,
  target_qty_kg  numeric(10,2) DEFAULT 0,
  notes          text,
  created_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sales_targets_hub_date ON public.sales_targets(hub_id, target_date);
ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view sales_targets" ON public.sales_targets FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers manage sales_targets" ON public.sales_targets FOR ALL USING (get_my_role() IN ('admin','ceo','gm','nsm','smo','director'));

-- ── 22. WEEKLY TARGETS ───────────────────────────────────────
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
CREATE INDEX IF NOT EXISTS idx_weekly_targets_user ON public.weekly_targets(user_id);
ALTER TABLE public.weekly_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view weekly_targets" ON public.weekly_targets FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers manage weekly_targets" ON public.weekly_targets FOR ALL USING (get_my_role() IN ('admin','ceo','gm','nsm','smo','director'));

-- ── 23. WEEKLY ACHIEVEMENTS ──────────────────────────────────
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
CREATE INDEX IF NOT EXISTS idx_weekly_achievements_user ON public.weekly_achievements(user_id);
ALTER TABLE public.weekly_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view weekly_achievements" ON public.weekly_achievements FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers manage weekly_achievements" ON public.weekly_achievements FOR ALL USING (get_my_role() IN ('admin','ceo','gm','nsm','smo','director'));

-- ── 24. DEMAND FORECASTS ─────────────────────────────────────
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
CREATE INDEX IF NOT EXISTS idx_demand_forecasts_product ON public.demand_forecasts(product_id);
CREATE INDEX IF NOT EXISTS idx_demand_forecasts_date ON public.demand_forecasts(forecast_date);
ALTER TABLE public.demand_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All staff view demand_forecasts" ON public.demand_forecasts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers manage demand_forecasts" ON public.demand_forecasts FOR ALL USING (get_my_role() IN ('admin','ceo','gm','purchase_head','nsm','director'));

-- ── 25. FOLLOWUP REMINDERS ───────────────────────────────────
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
CREATE INDEX IF NOT EXISTS idx_followup_reminders_date ON public.followup_reminders(follow_up_date);
ALTER TABLE public.followup_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own reminders" ON public.followup_reminders FOR SELECT USING (assigned_to = auth.uid() OR get_my_role() IN ('admin','ceo','gm','nsm'));
CREATE POLICY "Authenticated manage reminders" ON public.followup_reminders FOR ALL USING (assigned_to = auth.uid() OR get_my_role() IN ('admin','ceo','gm','nsm'));

-- ── 26. CALL LOGS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.call_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  caller_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  call_type    text DEFAULT 'outbound' CHECK (call_type IN ('inbound','outbound')),
  duration_sec integer DEFAULT 0,
  outcome      text CHECK (outcome IN ('answered','no_answer','busy','voicemail','callback_requested')),
  notes        text,
  called_at    timestamptz DEFAULT now(),
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_call_logs_customer ON public.call_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_caller ON public.call_logs(caller_id);
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own call_logs" ON public.call_logs FOR SELECT USING (caller_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','nsm','smo'));
CREATE POLICY "Authenticated create call_logs" ON public.call_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ════════════════════════════════════════════════════════════
--  AI & SYSTEM
-- ════════════════════════════════════════════════════════════

-- ── 27. AI EMPLOYEE SCORES ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_employee_scores (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date                 date NOT NULL,
  ai_score             numeric(5,2) DEFAULT 0 CHECK (ai_score BETWEEN 0 AND 100),
  ai_status            text NOT NULL DEFAULT 'idle' CHECK (ai_status IN ('working_productively','idle','needs_attention')),
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
CREATE INDEX IF NOT EXISTS idx_ai_employee_scores_user ON public.ai_employee_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_employee_scores_date ON public.ai_employee_scores(date);
ALTER TABLE public.ai_employee_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own ai_scores" ON public.ai_employee_scores FOR SELECT USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo','gm','hr','datateam'));
CREATE POLICY "AI system manage scores" ON public.ai_employee_scores FOR ALL USING (get_my_role() IN ('admin','ceo','datateam'));

-- ── 28. SYSTEM EVENTS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.system_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  text NOT NULL,
  entity_type text,
  entity_id   uuid,
  payload     jsonb DEFAULT '{}',
  actor_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_system_events_type ON public.system_events(event_type);
CREATE INDEX IF NOT EXISTS idx_system_events_created ON public.system_events(created_at);
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin view system_events" ON public.system_events FOR SELECT USING (get_my_role() IN ('admin','ceo','datateam'));
CREATE POLICY "System insert events" ON public.system_events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── 29. BULK BATCHES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bulk_batches (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_type   text NOT NULL CHECK (batch_type IN ('payment','salary','transport','collection')),
  batch_label  text NOT NULL,
  total_amount numeric(15,2) DEFAULT 0,
  entry_count  integer DEFAULT 0,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  metadata     jsonb DEFAULT '{}',
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
ALTER TABLE public.bulk_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authorized view bulk_batches" ON public.bulk_batches FOR SELECT USING (get_my_role() IN ('admin','ceo','accounts','hr'));
CREATE POLICY "Authorized manage bulk_batches" ON public.bulk_batches FOR ALL USING (get_my_role() IN ('admin','ceo','accounts','hr'));
CREATE TRIGGER bulk_batches_updated_at BEFORE UPDATE ON public.bulk_batches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
