-- ============================================================
--  RLS FIX — BATCH 3: Payroll & salary tables
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  Investigated live: all 7 tables below are currently EMPTY in
--  production (zero payroll runs have happened yet) — zero risk of
--  breaking real data either way, but policies still written
--  correctly per actual code usage (checked via grep across
--  src/modules/hr-payroll/ before writing this):
--
--  - payroll, payroll_runs, payroll_records, payslips: only used by
--    payrollService.ts / payslipService.ts, which are only imported
--    by src/modules/hr-payroll/ui/pages/* — NOT wired into any route
--    in App.tsx (confirmed via grep). Dead code today. Simple HR-only
--    default applied to all four (also avoids guessing at column
--    names on tables nothing live actually queries — payroll_records
--    in particular has no employee/user reference column at all,
--    only payroll_id; payslips uses user_id, not employee_id, which
--    is what caused the original 42703 error on this migration).
--
--  - salary_batch_employees: read with a row-owner filter in
--    EmployeeMyPayslipsPage.tsx
--    (.or(`profile_id.eq.${user.id},employee_id.eq.${user.id}`)) —
--    reachable at /my-payslips for ALL_STAFF_ROLES, and confirmed to
--    have both columns live. Real row-level policy needed: own row
--    OR HR/finance staff role.
--
--  - salary_batches: EmployeeMyPayslipsPage.tsx also reads batch
--    metadata (month/year/status) for batches the employee has a
--    row in — SELECT needs "HR staff OR I have a
--    salary_batch_employees row in this batch"; writes HR-only.
--
--  - salary_approvals: multi-stage approval workflow table
--    (uploader → auditor → director → CEO → accounts execution, per
--    salaryApprovalService.ts column names) — HR/finance-governance
--    roles only, no personal-employee read need found in code.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_hr_finance_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT public.get_my_role() IN ('hr','admin','accounts','ceo','auditor','director','Director');
$$;

-- ── payroll / payroll_runs — dead code today, HR-only default ──
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payroll_hr_access ON public.payroll;
CREATE POLICY payroll_hr_access ON public.payroll
  FOR ALL USING (public.is_hr_finance_staff()) WITH CHECK (public.is_hr_finance_staff());

ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payroll_runs_hr_access ON public.payroll_runs;
CREATE POLICY payroll_runs_hr_access ON public.payroll_runs
  FOR ALL USING (public.is_hr_finance_staff()) WITH CHECK (public.is_hr_finance_staff());

-- ── payroll_records — dead code today, HR-only default ──────
-- No employee/user reference column exists on this table (only
-- payroll_id) — confirmed via information_schema.columns.
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payroll_records_hr_access ON public.payroll_records;
CREATE POLICY payroll_records_hr_access ON public.payroll_records
  FOR ALL USING (public.is_hr_finance_staff()) WITH CHECK (public.is_hr_finance_staff());

-- ── payslips — dead code today, HR-only default ─────────────
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payslips_hr_access ON public.payslips;
CREATE POLICY payslips_hr_access ON public.payslips
  FOR ALL USING (public.is_hr_finance_staff()) WITH CHECK (public.is_hr_finance_staff());

-- ── salary_batch_employees — own row (profile_id OR employee_id) OR HR ──
ALTER TABLE public.salary_batch_employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS salary_batch_employees_select ON public.salary_batch_employees;
CREATE POLICY salary_batch_employees_select ON public.salary_batch_employees
  FOR SELECT USING (
    public.is_hr_finance_staff()
    OR profile_id = auth.uid()
    OR employee_id = auth.uid()
  );

DROP POLICY IF EXISTS salary_batch_employees_write ON public.salary_batch_employees;
CREATE POLICY salary_batch_employees_write ON public.salary_batch_employees
  FOR ALL USING (public.is_hr_finance_staff()) WITH CHECK (public.is_hr_finance_staff());

-- ── salary_batches — HR full access; staff can read batches they're in ──
ALTER TABLE public.salary_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS salary_batches_select ON public.salary_batches;
CREATE POLICY salary_batches_select ON public.salary_batches
  FOR SELECT USING (
    public.is_hr_finance_staff()
    OR EXISTS (
      SELECT 1 FROM public.salary_batch_employees sbe
      WHERE sbe.batch_id = salary_batches.id
        AND (sbe.profile_id = auth.uid() OR sbe.employee_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS salary_batches_write ON public.salary_batches;
CREATE POLICY salary_batches_write ON public.salary_batches
  FOR ALL USING (public.is_hr_finance_staff()) WITH CHECK (public.is_hr_finance_staff());

-- ── salary_approvals — HR/finance governance only ───────────
ALTER TABLE public.salary_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS salary_approvals_access ON public.salary_approvals;
CREATE POLICY salary_approvals_access ON public.salary_approvals
  FOR ALL USING (public.is_hr_finance_staff()) WITH CHECK (public.is_hr_finance_staff());

-- ── Verify ───────────────────────────────────────────────────
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename IN (
  'payroll','payroll_runs','payroll_records','payslips',
  'salary_batch_employees','salary_batches','salary_approvals'
)
ORDER BY tablename;
