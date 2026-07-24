-- ============================================================
--  RLS CLEANUP — drop leftover blanket "authenticated_full_*" policies
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  Root cause: nearly every table in Batches 1-4 already had a
--  pre-existing policy (likely Lovable-scaffolded — see
--  .lovable/plan.md) granting `roles={authenticated}, USING true,
--  WITH CHECK true` — i.e. "any logged-in user, full access,"
--  regardless of role. Postgres RLS policies are OR'd together, so
--  my restrictive role-based policies from Batches 1-4 were sitting
--  ALONGSIDE these, not replacing them — meaning most of those
--  "fixed" tables were still effectively wide open the whole time.
--
--  Confirmed via a full pg_policies dump across every table touched
--  so far (2026-07-22). This drops exactly the leftover blanket
--  policies found — nothing else. Tables that already had correctly
--  restrictive policies from before (hr_attestations, employee_lop,
--  employee_issues, employee_history, employee_payslips,
--  salary_batch_employees, salary_batches's other policies,
--  vendor_payments, vendors) are untouched — they were never the
--  problem.
-- ============================================================

DROP POLICY IF EXISTS authenticated_full_employee_master              ON public.employee_master;
DROP POLICY IF EXISTS authenticated_full_employee_memos               ON public.employee_memos;
DROP POLICY IF EXISTS authenticated_full_employee_onboarding_requests ON public.employee_onboarding_requests;
DROP POLICY IF EXISTS authenticated_full_employee_ratings             ON public.employee_ratings;
DROP POLICY IF EXISTS authenticated_full_employees                    ON public.employees;
DROP POLICY IF EXISTS authenticated_full_invoices                     ON public.invoices;
DROP POLICY IF EXISTS authenticated_full_payment_approvals            ON public.payment_approvals;
DROP POLICY IF EXISTS authenticated_full_payroll                      ON public.payroll;
DROP POLICY IF EXISTS authenticated_full_payroll_records              ON public.payroll_records;
DROP POLICY IF EXISTS authenticated_full_payroll_runs                 ON public.payroll_runs;
DROP POLICY IF EXISTS authenticated_full_payslips                     ON public.payslips;
DROP POLICY IF EXISTS authenticated_full_petty_cash_ledger            ON public.petty_cash_ledger;
DROP POLICY IF EXISTS authenticated_full_petty_cash_refill_requests   ON public.petty_cash_refill_requests;
DROP POLICY IF EXISTS authenticated_full_petty_cash_reports           ON public.petty_cash_reports;
DROP POLICY IF EXISTS authenticated_full_po_bills                     ON public.po_bills;
DROP POLICY IF EXISTS authenticated_full_porter_transit_payments      ON public.porter_transit_payments;
DROP POLICY IF EXISTS authenticated_full_purchase_entries             ON public.purchase_entries;
DROP POLICY IF EXISTS authenticated_full_purchase_entry_items         ON public.purchase_entry_items;
DROP POLICY IF EXISTS auth_full_refunds                               ON public.refunds;
DROP POLICY IF EXISTS authenticated_full_salary_approvals             ON public.salary_approvals;
DROP POLICY IF EXISTS authenticated_read_salary_batches               ON public.salary_batches;
DROP POLICY IF EXISTS authenticated_all_selfie                        ON public.selfie_records;
DROP POLICY IF EXISTS authenticated_full_vendor_master                ON public.vendor_master;

-- device_tokens: NOT dropped — "auth_full_device_tokens" is redundant
-- with my own intentionally-open "device_tokens_open" policy (both
-- permissive, matches intent for customer push-token registration).
-- Leaving both is harmless; not worth touching.

-- ── Verify: re-list all policies on these tables — should now show
--    ONLY the role-scoped ones from Batches 1-4, no more "true/true" ──
SELECT tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'employee_master','employee_memos','employee_onboarding_requests',
    'employee_ratings','employees','invoices','payment_approvals',
    'payroll','payroll_records','payroll_runs','payslips',
    'petty_cash_ledger','petty_cash_refill_requests','petty_cash_reports',
    'po_bills','porter_transit_payments','purchase_entries',
    'purchase_entry_items','refunds','salary_approvals','salary_batches',
    'selfie_records','vendor_master'
  )
ORDER BY tablename, policyname;
