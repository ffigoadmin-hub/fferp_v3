-- ADD_PAYROLL_LEDGER_POSTING.sql
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- P1 #3 / "Phase E": Payroll → Accounts posting. Deliberately deferred until now per the CEO's
-- own instruction ("need accept the A grade solid" when we get to it).
--
-- Investigation found the payroll system has TWO parallel table sets, both with 0 rows ever
-- (payroll/payroll_records/payroll_runs/payroll_summary vs. salary_batches/salary_batch_employees).
-- Confirmed by grep which one the live pages actually use: salary_batches / salary_batch_employees
-- (AccountsSalarySheetPage, AuditorSalaryApprovalPage, HRDashboardPage, and the hr-payroll module's
-- own workflow service) — an 8-stage approval pipeline (Draft → HR Verified → Auditor Approved →
-- CEO Pending/Approved/Rejected/Hold → Accounts Processing → Paid/Paid Already), already fully
-- built and functional, just never connected to the books.
--
-- Ledger design, mirroring the exact "recognize at raise, not at final approval" accrual decision
-- the CEO already made for vendor/transport payments (a4356f8):
--   EXPENSE (posts once a batch leaves Draft and isn't rejected — status <> 'Draft','Auditor
--   Rejected','CEO Rejected'):
--     Dr Salaries & Wages     sum(final_salary + pf_amount + esi_amount + tds_amount)
--     Cr PF Payable           sum(pf_amount)
--     Cr ESI Payable          sum(esi_amount)
--     Cr TDS Payable          sum(tds_amount)
--     Cr Salaries Payable     sum(final_salary)
--   PAYMENT (posts once salary_batches.paid_at is set — the actual bank disbursement):
--     Dr Salaries Payable     sum(final_salary)
--     Cr Bank
--
-- NOTE on other_deduction: salary_batch_employees.other_deduction is deliberately NOT modelled
-- here — it's ambiguous (could be an advance recovery, a fixed charge, etc.) and no employee-
-- advances ledger account exists yet. final_salary is assumed to already net it out correctly;
-- if that's wrong once real payroll runs happen, this needs a follow-up, not a guess now.
--
-- New accounts: 2170 PF Payable, 2180 ESI Payable.
--
-- Run on:  qwiumswrbddwmlraktvy → Supabase SQL Editor.  ADDITIVE + IDEMPOTENT.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

INSERT INTO public.acct_accounts (code, name, parent_id, is_group, root_type, account_type, system_key)
SELECT '2170', 'PF Payable', id, false, 'liability', 'payable', 'pf_payable'
FROM public.acct_accounts WHERE code = '2100'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.acct_accounts (code, name, parent_id, is_group, root_type, account_type, system_key)
SELECT '2180', 'ESI Payable', id, false, 'liability', 'payable', 'esi_payable'
FROM public.acct_accounts WHERE code = '2100'
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.acct_sync_salary_batch(p_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b public.salary_batches; v_start date;
  v_gross numeric; v_pf numeric; v_esi numeric; v_tds numeric; v_net numeric;
  v_expense jsonb; v_payment jsonb; a text; c text;
BEGIN
  SELECT * INTO b FROM public.salary_batches WHERE id = p_id;
  SELECT books_start_date INTO v_start FROM public.acct_settings WHERE id = 1;

  -- final_salary is nullable (only locked in at a later stage); net_pay is always populated
  -- from creation, so it's the reliable figure whenever final_salary hasn't been set yet.
  SELECT coalesce(sum(pf_amount), 0), coalesce(sum(esi_amount), 0), coalesce(sum(tds_amount), 0),
         coalesce(sum(coalesce(final_salary, net_pay)), 0)
  INTO v_pf, v_esi, v_tds, v_net
  FROM public.salary_batch_employees WHERE batch_id = p_id;
  v_gross := round(v_net + v_pf + v_esi + v_tds, 2);

  IF b.id IS NOT NULL AND b.status NOT IN ('Draft', 'Auditor Rejected', 'CEO Rejected') AND v_gross > 0
     AND coalesce(b.created_at::date, current_date) >= v_start THEN
    v_expense := jsonb_build_object(
      'posting_date', coalesce(b.processed_at::date, b.created_at::date),
      'narration', 'Salary batch ' || coalesce(b.batch_name, '') || ' · ' || b.month || '/' || b.year
                   || ' · ' || coalesce(b.total_employees, 0) || ' employee(s)',
      'lines', jsonb_build_array(
        jsonb_build_object('system_key','salaries', 'debit', v_gross),
        jsonb_build_object('system_key','pf_payable', 'credit', round(v_pf,2)),
        jsonb_build_object('system_key','esi_payable', 'credit', round(v_esi,2)),
        jsonb_build_object('system_key','tds_payable', 'credit', round(v_tds,2)),
        jsonb_build_object('system_key','salaries_payable', 'credit', round(v_net,2))));
  END IF;

  IF b.id IS NOT NULL AND b.paid_at IS NOT NULL AND v_net > 0
     AND b.paid_at::date >= v_start THEN
    v_payment := jsonb_build_object(
      'posting_date', b.paid_at::date,
      'narration', 'Salaries paid · ' || coalesce(b.batch_name, '') || ' · ' || b.month || '/' || b.year,
      'lines', jsonb_build_array(
        jsonb_build_object('system_key','salaries_payable', 'debit', round(v_net,2)),
        jsonb_build_object('system_key','bank_default', 'credit', round(v_net,2))));
  END IF;

  IF v_payment IS NULL THEN
    c := public.acct__sync('salary_batches', p_id, 'payment', NULL, 'Batch ' || coalesce(b.status, 'deleted'));
    a := public.acct__sync('salary_batches', p_id, 'purchase', v_expense, 'Batch ' || coalesce(b.status, 'deleted'));
  ELSE
    a := public.acct__sync('salary_batches', p_id, 'purchase', v_expense, 'Batch ' || b.status);
    c := public.acct__sync('salary_batches', p_id, 'payment', v_payment, 'Batch ' || b.status);
  END IF;
  RETURN a || '/' || c;
END $$;

CREATE OR REPLACE FUNCTION public.acct_trg_salary_batches() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.acct_sync_salary_batch(CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS acct_autopost_trg ON public.salary_batches;
CREATE TRIGGER acct_autopost_trg AFTER INSERT OR UPDATE OR DELETE ON public.salary_batches
  FOR EACH ROW EXECUTE FUNCTION public.acct_trg_salary_batches();

-- Employee-level edits (e.g. HR correcting a figure before approval) change the batch total —
-- resync the batch's voucher whenever its employee rows change.
CREATE OR REPLACE FUNCTION public.acct_trg_salary_batch_employees() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.acct_sync_salary_batch(CASE WHEN TG_OP = 'DELETE' THEN OLD.batch_id ELSE NEW.batch_id END);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS acct_autopost_trg ON public.salary_batch_employees;
CREATE TRIGGER acct_autopost_trg AFTER INSERT OR UPDATE OR DELETE ON public.salary_batch_employees
  FOR EACH ROW EXECUTE FUNCTION public.acct_trg_salary_batch_employees();

REVOKE EXECUTE ON FUNCTION public.acct_sync_salary_batch(uuid)         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.acct_trg_salary_batches()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.acct_trg_salary_batch_employees()    FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.acct_backpost_all() RETURNS TABLE (source text, result text, documents bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.acct_can_write() OR public.acct_can_approve()) THEN
    RAISE EXCEPTION 'Only Accounts, Admin or CEO can back-post';
  END IF;
  CREATE TEMP TABLE IF NOT EXISTS _acct_bp (source text, result text) ON COMMIT DROP;
  TRUNCATE _acct_bp;
  INSERT INTO _acct_bp SELECT 'sales_orders', public.acct_sync_sales_order(id)
    FROM public.sales_orders ORDER BY coalesce(delivery_date, order_date), created_at;
  INSERT INTO _acct_bp SELECT 'ff_vendor_payments', public.acct_sync_ff_vendor_payment(id)
    FROM public.ff_vendor_payments ORDER BY created_at;
  INSERT INTO _acct_bp SELECT 'ff_transport_payments', public.acct_sync_ff_transport_payment(id)
    FROM public.ff_transport_payments ORDER BY created_at;
  INSERT INTO _acct_bp SELECT 'wastage_entries', public.acct_sync_wastage(id)
    FROM public.wastage_entries ORDER BY entry_date, created_at;
  INSERT INTO _acct_bp SELECT 'credit_notes', public.acct_sync_credit_note(id)
    FROM public.credit_notes ORDER BY coalesce(issued_date, created_at::date), created_at;
  INSERT INTO _acct_bp SELECT 'debit_notes', public.acct_sync_debit_note(id)
    FROM public.debit_notes ORDER BY coalesce(issued_date, created_at::date), created_at;
  INSERT INTO _acct_bp SELECT 'payments_received', public.acct_sync_payment_received(id)
    FROM public.payments_received ORDER BY coalesce(received_date, created_at::date), created_at;
  INSERT INTO _acct_bp SELECT 'cash_collections', public.acct_sync_cash_collection(id)
    FROM public.cash_collections ORDER BY coalesce(collection_date, created_at::date), created_at;
  INSERT INTO _acct_bp SELECT 'salary_batches', public.acct_sync_salary_batch(id)
    FROM public.salary_batches ORDER BY created_at;
  RETURN QUERY SELECT b.source, b.result, count(*) FROM _acct_bp b GROUP BY 1, 2 ORDER BY 1, 2;
END $$;
