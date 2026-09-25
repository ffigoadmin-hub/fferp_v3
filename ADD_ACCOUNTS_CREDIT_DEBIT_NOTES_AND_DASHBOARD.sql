-- ADD_ACCOUNTS_CREDIT_DEBIT_NOTES_AND_DASHBOARD.sql
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- P0 fixes from the Finance-module audit (2026-09-25):
--
-- 1. credit_notes: CreditNotesPage.tsx inserts credit_note_number/customer_name/invoice_reference/
--    issued_date/created_by — none of these columns existed live, so every "Create" click failed
--    outright (table has 0 rows). Adds the missing columns and auto-posts a voucher on issue.
-- 2. debit_notes: didn't exist at all (vendor-side mirror of credit notes). New table + page wiring.
-- 3. recurring_invoices / recurring_bills: same missing-column bug (customer_name/vendor_name/
--    start_date/description/status vs. the live customer_id/vendor_id/next_due/is_active columns).
--    Fixed so the pages stop erroring. NOTE: this does NOT add an occurrence-generation engine —
--    these remain schedule definitions only; nothing auto-creates or auto-posts an invoice/bill
--    when next_due arrives. That's a separate feature to design (auto vs. review-before-post).
-- 4. New contra accounts (4110 Sales Returns & Credit Notes, 5120 Purchase Returns & Debit Notes)
--    so returns show as a deduction from gross revenue/COGS instead of touching Sales/Purchases
--    directly.
-- 5. acct_finance_summary(): FinanceDashboard.tsx was 100% hardcoded ("₹0.00" literals, an
--    all-zero chart array) — fabricated data presented as live. Replaced with a real RPC reading
--    acct_gl.
--
-- Run on:  qwiumswrbddwmlraktvy → Supabase SQL Editor.  ADDITIVE + IDEMPOTENT.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

-- ── 1. credit_notes: add the columns the UI already expects ────────────────────────────────────
ALTER TABLE public.credit_notes
  ADD COLUMN IF NOT EXISTS credit_note_number text,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS invoice_reference text,
  ADD COLUMN IF NOT EXISTS issued_date date,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS hub_id uuid REFERENCES public.hubs(id);

-- ── 2. debit_notes: new table, mirrors credit_notes on the vendor side ──────────────────────────
CREATE TABLE IF NOT EXISTS public.debit_notes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debit_note_number  text,
  vendor_id          uuid REFERENCES public.vendors(id),
  vendor_name        text,
  invoice_reference  text,
  amount             numeric NOT NULL DEFAULT 0,
  reason             text,
  status             text NOT NULL DEFAULT 'issued' CHECK (status IN ('draft','issued','applied','cancelled')),
  issued_date        date DEFAULT current_date,
  hub_id             uuid REFERENCES public.hubs(id),
  created_by         uuid REFERENCES auth.users(id),
  created_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.debit_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS debit_notes_staff_access ON public.debit_notes;
CREATE POLICY debit_notes_staff_access ON public.debit_notes FOR ALL USING (is_staff()) WITH CHECK (is_staff());

-- ── 3. recurring_invoices / recurring_bills: fix the same missing-column bug ────────────────────
ALTER TABLE public.recurring_invoices
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

ALTER TABLE public.recurring_bills
  ADD COLUMN IF NOT EXISTS vendor_name text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- ── 4. New contra accounts for returns (additive; ON CONFLICT (code) DO NOTHING is idempotent) ──
INSERT INTO public.acct_accounts (code, name, parent_id, is_group, root_type, account_type, system_key)
SELECT '4110', 'Sales Returns & Credit Notes', id, false, 'income', 'direct_income', 'sales_returns'
FROM public.acct_accounts WHERE code = '4000'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.acct_accounts (code, name, parent_id, is_group, root_type, account_type, system_key)
SELECT '5130', 'Purchase Returns & Debit Notes', id, false, 'expense', 'cost_of_goods', 'purchase_returns'
FROM public.acct_accounts WHERE code = '5100'
ON CONFLICT (code) DO NOTHING;

-- ── 5. Auto-posting: credit notes ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.acct_sync_credit_note(p_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.credit_notes; v_amt numeric; v_start date; v_payload jsonb; v_hub uuid;
BEGIN
  SELECT * INTO r FROM public.credit_notes WHERE id = p_id;
  SELECT books_start_date INTO v_start FROM public.acct_settings WHERE id = 1;
  v_amt := round(coalesce(r.amount, 0), 2);
  v_hub := coalesce(r.hub_id, (SELECT hub_id FROM public.customers WHERE id = r.customer_id));

  IF r.id IS NOT NULL AND r.status IN ('issued','applied') AND v_amt > 0
     AND coalesce(r.issued_date, r.created_at::date) >= v_start THEN
    v_payload := jsonb_build_object(
      'posting_date', coalesce(r.issued_date, r.created_at::date), 'hub_id', v_hub,
      'party_type', 'customer', 'party_id', r.customer_id, 'party_name', r.customer_name,
      'reference_no', r.credit_note_number,
      'narration', 'Credit note ' || coalesce(r.credit_note_number,'') || ' · ' || coalesce(r.customer_name,'')
                   || coalesce(' · ' || r.reason, ''),
      'lines', jsonb_build_array(
        jsonb_build_object('system_key','sales_returns', 'debit', v_amt),
        jsonb_build_object('system_key','debtors', 'credit', v_amt,
                           'party_type','customer', 'party_id', r.customer_id, 'party_name', r.customer_name)));
  END IF;
  RETURN public.acct__sync('credit_notes', p_id, 'credit_note', v_payload, 'Credit note ' || coalesce(r.status,'deleted'));
END $$;

CREATE OR REPLACE FUNCTION public.acct_trg_credit_notes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.acct_sync_credit_note(CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS acct_autopost_trg ON public.credit_notes;
CREATE TRIGGER acct_autopost_trg AFTER INSERT OR UPDATE OR DELETE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.acct_trg_credit_notes();

-- ── 6. Auto-posting: debit notes ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.acct_sync_debit_note(p_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.debit_notes; v_amt numeric; v_start date; v_payload jsonb;
BEGIN
  SELECT * INTO r FROM public.debit_notes WHERE id = p_id;
  SELECT books_start_date INTO v_start FROM public.acct_settings WHERE id = 1;
  v_amt := round(coalesce(r.amount, 0), 2);

  IF r.id IS NOT NULL AND r.status IN ('issued','applied') AND v_amt > 0
     AND coalesce(r.issued_date, r.created_at::date) >= v_start THEN
    v_payload := jsonb_build_object(
      'posting_date', coalesce(r.issued_date, r.created_at::date), 'hub_id', r.hub_id,
      'party_type', 'vendor', 'party_id', r.vendor_id, 'party_name', r.vendor_name,
      'reference_no', r.debit_note_number,
      'narration', 'Debit note ' || coalesce(r.debit_note_number,'') || ' · ' || coalesce(r.vendor_name,'')
                   || coalesce(' · ' || r.reason, ''),
      'lines', jsonb_build_array(
        jsonb_build_object('system_key','creditors', 'debit', v_amt,
                           'party_type','vendor', 'party_id', r.vendor_id, 'party_name', r.vendor_name),
        jsonb_build_object('system_key','purchase_returns', 'credit', v_amt)));
  END IF;
  RETURN public.acct__sync('debit_notes', p_id, 'debit_note', v_payload, 'Debit note ' || coalesce(r.status,'deleted'));
END $$;

CREATE OR REPLACE FUNCTION public.acct_trg_debit_notes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.acct_sync_debit_note(CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS acct_autopost_trg ON public.debit_notes;
CREATE TRIGGER acct_autopost_trg AFTER INSERT OR UPDATE OR DELETE ON public.debit_notes
  FOR EACH ROW EXECUTE FUNCTION public.acct_trg_debit_notes();

REVOKE EXECUTE ON FUNCTION public.acct_sync_credit_note(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.acct_trg_credit_notes()     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.acct_sync_debit_note(uuid)  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.acct_trg_debit_notes()      FROM PUBLIC, anon, authenticated;

-- ── 7. Extend back-posting to cover the two new sources ─────────────────────────────────────────
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
  RETURN QUERY SELECT b.source, b.result, count(*) FROM _acct_bp b GROUP BY 1, 2 ORDER BY 1, 2;
END $$;

-- ── 8. Real Finance Dashboard numbers (replaces the hardcoded "₹0.00" page) ─────────────────────
CREATE OR REPLACE FUNCTION public.acct_finance_summary() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_receivables numeric; v_payables numeric; v_cash numeric; v_income numeric; v_expense numeric;
  v_fy_start date; v_fy_end date;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.acct_can_read() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT start_date, end_date INTO v_fy_start, v_fy_end
  FROM public.acct_fiscal_years WHERE current_date BETWEEN start_date AND end_date LIMIT 1;
  v_fy_start := coalesce(v_fy_start, date_trunc('year', current_date)::date);
  v_fy_end   := coalesce(v_fy_end, (date_trunc('year', current_date) + interval '1 year - 1 day')::date);

  SELECT coalesce(sum(debit - credit), 0) INTO v_receivables
  FROM public.acct_gl WHERE account_type = 'receivable';

  SELECT coalesce(sum(credit - debit), 0) INTO v_payables
  FROM public.acct_gl WHERE account_type = 'payable';

  SELECT coalesce(sum(debit - credit), 0) INTO v_cash
  FROM public.acct_gl WHERE account_type IN ('cash','bank');

  SELECT coalesce(sum(credit - debit), 0) INTO v_income
  FROM public.acct_gl WHERE root_type = 'income' AND posting_date BETWEEN v_fy_start AND v_fy_end;

  SELECT coalesce(sum(debit - credit), 0) INTO v_expense
  FROM public.acct_gl WHERE root_type IN ('expense') AND posting_date BETWEEN v_fy_start AND v_fy_end;

  RETURN jsonb_build_object(
    'total_receivables', round(v_receivables, 2),
    'total_payables',    round(v_payables, 2),
    'cash_on_hand',      round(v_cash, 2),
    'net_profit',        round(v_income - v_expense, 2),
    'total_income',      round(v_income, 2),
    'total_expense',     round(v_expense, 2),
    'fiscal_year_start', v_fy_start,
    'fiscal_year_end',   v_fy_end
  );
END $$;
REVOKE EXECUTE ON FUNCTION public.acct_finance_summary() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.acct_finance_summary() TO authenticated;

-- Monthly income/expense + cash movement, for the dashboard's two charts
CREATE OR REPLACE FUNCTION public.acct_finance_monthly_trend() RETURNS TABLE (
  month_start date, income numeric, expense numeric, cash_in numeric, cash_out numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.acct_can_read() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT
    date_trunc('month', g.posting_date)::date AS month_start,
    sum(CASE WHEN g.root_type = 'income' THEN g.credit - g.debit ELSE 0 END) AS income,
    sum(CASE WHEN g.root_type = 'expense' THEN g.debit - g.credit ELSE 0 END) AS expense,
    sum(CASE WHEN g.account_type IN ('cash','bank') THEN g.debit ELSE 0 END) AS cash_in,
    sum(CASE WHEN g.account_type IN ('cash','bank') THEN g.credit ELSE 0 END) AS cash_out
  FROM public.acct_gl g
  WHERE g.posting_date >= (SELECT coalesce(min(start_date), date_trunc('year', current_date)::date)
                            FROM public.acct_fiscal_years WHERE current_date BETWEEN start_date AND end_date)
  GROUP BY 1 ORDER BY 1;
END $$;
REVOKE EXECUTE ON FUNCTION public.acct_finance_monthly_trend() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.acct_finance_monthly_trend() TO authenticated;

-- ── 9. Re-run back-posting (no-op today: both tables have 0 rows) + verify ──────────────────────
SELECT * FROM public.acct_backpost_all();
SELECT count(*), round(sum(debit) - sum(credit), 2) AS diff FROM public.acct_gl;
SELECT public.acct_finance_summary();
