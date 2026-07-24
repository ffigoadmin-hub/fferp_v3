-- ============================================================
--  RLS FIX — BATCH 4: Employee/HR personal records + audit/device
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  Column names verified against live information_schema.columns
--  before writing this (not trusted from application code — we've
--  hit real schema drift twice already in this project). Notably:
--  employee_history/employee_issues/employee_lop use `user_id`, NOT
--  `employee_id` like their calling service (employeeHistoryService.ts)
--  assumes — that's a separate pre-existing app bug, unrelated to
--  RLS, not fixed here. Policies below use the REAL column.
--
--  Two shapes:
--  (A) Own-record (employee can see/manage their own row) OR HR
--      staff full access — for tables reached from /profile (no
--      role restriction — confirmed in App.tsx) via
--      employeeHistoryService.ts / employeeMemosService.ts /
--      employeeRatingsService.ts, and from the attendance-lock
--      check in useRouteGuardStatus.ts (selfie_records).
--  (B) HR/admin-only — for tables with no personal-ownership column
--      at all, or only reachable from HR-gated routes
--      (/hr/employee-master, /hr/salary-calculation).
-- ============================================================

-- Reuses is_hr_finance_staff() from FIX_RLS_BATCH3_PAYROLL.sql —
-- recreated here too in case batches are run out of order.
CREATE OR REPLACE FUNCTION public.is_hr_finance_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT public.get_my_role() IN ('hr','admin','accounts','ceo','auditor','director','Director');
$$;

-- ── (A) selfie_records — own row (user_id OR employee_id) OR HR/admin/auditor ──
-- Note: SelfieViewingPage.tsx route is gated to exactly ['hr','admin','auditor'],
-- narrower than is_hr_finance_staff() — matched here intentionally.
ALTER TABLE public.selfie_records ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_selfie_viewer_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT public.get_my_role() IN ('hr','admin','auditor');
$$;

DROP POLICY IF EXISTS selfie_records_select ON public.selfie_records;
CREATE POLICY selfie_records_select ON public.selfie_records
  FOR SELECT USING (
    public.is_selfie_viewer_staff() OR user_id = auth.uid() OR employee_id = auth.uid()
  );

DROP POLICY IF EXISTS selfie_records_insert ON public.selfie_records;
CREATE POLICY selfie_records_insert ON public.selfie_records
  FOR INSERT WITH CHECK (
    public.is_selfie_viewer_staff() OR user_id = auth.uid()
  );
-- No UPDATE/DELETE policy — matches current app behavior (nothing in
-- src/ ever updates or deletes a selfie record; it's an immutable
-- attendance proof). RLS defaults to deny when no policy matches.

-- ── (A) employee_history — own row (user_id) OR HR staff ────
ALTER TABLE public.employee_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_history_select ON public.employee_history;
CREATE POLICY employee_history_select ON public.employee_history
  FOR SELECT USING (public.is_hr_finance_staff() OR user_id = auth.uid());

DROP POLICY IF EXISTS employee_history_write ON public.employee_history;
CREATE POLICY employee_history_write ON public.employee_history
  FOR ALL USING (public.is_hr_finance_staff()) WITH CHECK (public.is_hr_finance_staff());

-- ── (A) employee_issues — own row (user_id) OR HR staff ──────
ALTER TABLE public.employee_issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_issues_select ON public.employee_issues;
CREATE POLICY employee_issues_select ON public.employee_issues
  FOR SELECT USING (public.is_hr_finance_staff() OR user_id = auth.uid());

DROP POLICY IF EXISTS employee_issues_write ON public.employee_issues;
CREATE POLICY employee_issues_write ON public.employee_issues
  FOR ALL USING (public.is_hr_finance_staff()) WITH CHECK (public.is_hr_finance_staff());

-- ── (A) employee_lop — own row (user_id) OR HR staff ─────────
ALTER TABLE public.employee_lop ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_lop_select ON public.employee_lop;
CREATE POLICY employee_lop_select ON public.employee_lop
  FOR SELECT USING (public.is_hr_finance_staff() OR user_id = auth.uid());

DROP POLICY IF EXISTS employee_lop_write ON public.employee_lop;
CREATE POLICY employee_lop_write ON public.employee_lop
  FOR ALL USING (public.is_hr_finance_staff()) WITH CHECK (public.is_hr_finance_staff());

-- ── (A) employee_memos — own row (employee_id) OR HR staff ──
-- Employee can UPDATE their own memo only to acknowledge it
-- (acknowledgeMemo() sets acknowledged_by_employee/acknowledged_at) —
-- allowed via the same own-row check on UPDATE.
ALTER TABLE public.employee_memos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_memos_select ON public.employee_memos;
CREATE POLICY employee_memos_select ON public.employee_memos
  FOR SELECT USING (public.is_hr_finance_staff() OR employee_id = auth.uid());

DROP POLICY IF EXISTS employee_memos_update ON public.employee_memos;
CREATE POLICY employee_memos_update ON public.employee_memos
  FOR UPDATE USING (public.is_hr_finance_staff() OR employee_id = auth.uid())
  WITH CHECK (public.is_hr_finance_staff() OR employee_id = auth.uid());

DROP POLICY IF EXISTS employee_memos_insert ON public.employee_memos;
CREATE POLICY employee_memos_insert ON public.employee_memos
  FOR INSERT WITH CHECK (public.is_hr_finance_staff());

DROP POLICY IF EXISTS employee_memos_delete ON public.employee_memos;
CREATE POLICY employee_memos_delete ON public.employee_memos
  FOR DELETE USING (public.is_hr_finance_staff());

-- ── (A) employee_payslips — own row (employee_id) OR HR staff ──
ALTER TABLE public.employee_payslips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_payslips_select ON public.employee_payslips;
CREATE POLICY employee_payslips_select ON public.employee_payslips
  FOR SELECT USING (public.is_hr_finance_staff() OR employee_id = auth.uid());

DROP POLICY IF EXISTS employee_payslips_write ON public.employee_payslips;
CREATE POLICY employee_payslips_write ON public.employee_payslips
  FOR ALL USING (public.is_hr_finance_staff()) WITH CHECK (public.is_hr_finance_staff());

-- ── (A) employee_ratings — own row (employee_id) OR HR staff ──
ALTER TABLE public.employee_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_ratings_select ON public.employee_ratings;
CREATE POLICY employee_ratings_select ON public.employee_ratings
  FOR SELECT USING (public.is_hr_finance_staff() OR employee_id = auth.uid());

DROP POLICY IF EXISTS employee_ratings_write ON public.employee_ratings;
CREATE POLICY employee_ratings_write ON public.employee_ratings
  FOR ALL USING (public.is_hr_finance_staff()) WITH CHECK (public.is_hr_finance_staff());

-- ── (B) employees / employee_master — HR-only, no personal-row column ──
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS employees_hr_access ON public.employees;
CREATE POLICY employees_hr_access ON public.employees
  FOR ALL USING (public.is_hr_finance_staff()) WITH CHECK (public.is_hr_finance_staff());

ALTER TABLE public.employee_master ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS employee_master_hr_access ON public.employee_master;
CREATE POLICY employee_master_hr_access ON public.employee_master
  FOR ALL USING (public.is_hr_finance_staff()) WITH CHECK (public.is_hr_finance_staff());

-- ── (B) employee_onboarding_requests — HR-only ───────────────
-- The onboarding subject has no account yet (requested_by is the
-- HR/admin requester, not the new hire) — no personal-row concept.
ALTER TABLE public.employee_onboarding_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS employee_onboarding_requests_hr_access ON public.employee_onboarding_requests;
CREATE POLICY employee_onboarding_requests_hr_access ON public.employee_onboarding_requests
  FOR ALL USING (public.is_hr_finance_staff()) WITH CHECK (public.is_hr_finance_staff());

-- ── (B) hr_attestations — HR-only ────────────────────────────
-- No caller found reading this for a personal "my attestations" view
-- — treated as an HR-generated document, not employee-visible.
ALTER TABLE public.hr_attestations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hr_attestations_hr_access ON public.hr_attestations;
CREATE POLICY hr_attestations_hr_access ON public.hr_attestations
  FOR ALL USING (public.is_hr_finance_staff()) WITH CHECK (public.is_hr_finance_staff());

-- ── (B) audit_logs — oversight roles only ────────────────────
-- System-wide audit trail (admin actions, price changes, etc per
-- project convention) — not HR-specific, broadened to oversight roles.
CREATE OR REPLACE FUNCTION public.is_audit_viewer_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT public.get_my_role() IN ('admin','ceo','director','Director','auditor','gm');
$$;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_access ON public.audit_logs;
CREATE POLICY audit_logs_access ON public.audit_logs
  FOR ALL USING (public.is_audit_viewer_staff()) WITH CHECK (public.is_audit_viewer_staff());

-- ── (B) device_tokens — customer push-notification tokens ───
-- customer_id column, NOT staff-owned — matches the "customer-facing,
-- open" precedent already applied to other customer tables
-- (customers, addresses, customer_queries, etc in FIX_RLS_ALL_ROLES.sql).
-- Not independently verified against a customer-facing app (outside
-- this repo) — flagged for you to confirm this is the right call
-- rather than a staff-only restriction.
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS device_tokens_open ON public.device_tokens;
CREATE POLICY device_tokens_open ON public.device_tokens
  FOR ALL USING (true) WITH CHECK (true);

-- ── Verify ───────────────────────────────────────────────────
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename IN (
  'selfie_records','employee_history','employee_issues','employee_lop',
  'employee_memos','employee_payslips','employee_ratings',
  'employees','employee_master','employee_onboarding_requests',
  'hr_attestations','audit_logs','device_tokens'
)
ORDER BY tablename;
