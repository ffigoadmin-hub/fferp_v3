-- ADD_RECURRING_INVOICES_BILLS_ENGINE.sql
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- Follow-up: recurring_invoices / recurring_bills (fixed in P0 so they at least save) were always
-- schedule definitions only — nothing ever generated an actual invoice/bill occurrence or posted
-- anything when next_due arrived. This adds the missing engine.
--
-- Design: each DUE occurrence gets its own row in a new *_occurrences table (unique on
-- (recurring_id, occurrence_date) so the same date can never generate twice) — that row's id is
-- the acct_auto_post source_id, giving every occurrence its own independently-reversible voucher
-- (the recurring_invoices/bills row itself can't be the source_id, since it repeats forever and
-- acct_auto_post's dedup is keyed on source_table+source_id+voucher_type, one voucher per key).
--
-- acct_process_recurring_invoices(asof) / acct_process_recurring_bills(asof): for every active
-- row whose next_due (falling back to start_date the first time) is on/before asof, generates and
-- posts every elapsed period up to asof (capped at 36 catch-up periods per row, so a long-dormant
-- schedule can't runaway-loop), advancing next_due each time.
--   Recurring invoice occurrence: Dr Debtors / Cr Sales — voucher_type 'sales_invoice'.
--   Recurring bill occurrence:    Dr Purchases / Cr Creditors — voucher_type 'purchase'.
-- Both use party_name only (party_id NULL) since neither page's UI captures a real customer_id/
-- vendor_id today — only free-text names. Flagged, not silently assumed correct for AR/AP ageing.
--
-- This is a MANUAL trigger (call the function when you want it to run), not a cron job — this
-- database has no scheduled-job infrastructure of its own. Wire it to a daily call (e.g. the
-- existing FF ERP Production Watch cloud routine, or a page button) if you want it automatic.
--
-- Run on:  qwiumswrbddwmlraktvy → Supabase SQL Editor.  ADDITIVE + IDEMPOTENT.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.recurring_invoice_occurrences (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_invoice_id  uuid NOT NULL REFERENCES public.recurring_invoices(id),
  occurrence_date       date NOT NULL,
  amount                numeric NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recurring_invoice_id, occurrence_date)
);
ALTER TABLE public.recurring_invoice_occurrences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS recurring_invoice_occurrences_staff_access ON public.recurring_invoice_occurrences;
CREATE POLICY recurring_invoice_occurrences_staff_access ON public.recurring_invoice_occurrences FOR SELECT USING (is_staff());

CREATE TABLE IF NOT EXISTS public.recurring_bill_occurrences (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_bill_id uuid NOT NULL REFERENCES public.recurring_bills(id),
  occurrence_date   date NOT NULL,
  amount            numeric NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recurring_bill_id, occurrence_date)
);
ALTER TABLE public.recurring_bill_occurrences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS recurring_bill_occurrences_staff_access ON public.recurring_bill_occurrences;
CREATE POLICY recurring_bill_occurrences_staff_access ON public.recurring_bill_occurrences FOR SELECT USING (is_staff());

CREATE OR REPLACE FUNCTION public._recurring_interval(p_frequency text) RETURNS interval
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE lower(coalesce(p_frequency,''))
    WHEN 'daily' THEN interval '1 day'
    WHEN 'weekly' THEN interval '7 days'
    WHEN 'monthly' THEN interval '1 month'
    WHEN 'quarterly' THEN interval '3 months'
    WHEN 'yearly' THEN interval '1 year'
    ELSE interval '1 month'
  END;
$$;

CREATE OR REPLACE FUNCTION public.acct_process_recurring_invoices(p_asof date DEFAULT current_date)
RETURNS TABLE (recurring_id uuid, occurrences_created int, total_posted numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.recurring_invoices; v_due date; v_occ_id uuid; v_voucher_id uuid;
  v_count int; v_total numeric; v_iterations int;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.acct_can_write() OR public.acct_can_approve()) THEN
    RAISE EXCEPTION 'Only Accounts, Admin or CEO can process recurring invoices';
  END IF;

  FOR r IN SELECT * FROM public.recurring_invoices WHERE status = 'active' AND coalesce(amount,0) > 0 LOOP
    v_due := coalesce(r.next_due, r.start_date);
    v_count := 0; v_total := 0; v_iterations := 0;
    WHILE v_due IS NOT NULL AND v_due <= p_asof AND v_iterations < 36 LOOP
      v_iterations := v_iterations + 1;
      INSERT INTO public.recurring_invoice_occurrences (recurring_invoice_id, occurrence_date, amount)
      VALUES (r.id, v_due, r.amount)
      ON CONFLICT (recurring_invoice_id, occurrence_date) DO NOTHING
      RETURNING id INTO v_occ_id;

      IF v_occ_id IS NOT NULL THEN
        v_voucher_id := public.acct_auto_post(jsonb_build_object(
          'source_table', 'recurring_invoice_occurrences', 'source_id', v_occ_id, 'voucher_type', 'sales_invoice',
          'posting_date', v_due, 'party_type', 'customer', 'party_name', r.customer_name,
          'narration', 'Recurring invoice · ' || coalesce(r.customer_name,'') || coalesce(' · ' || r.description, ''),
          'lines', jsonb_build_array(
            jsonb_build_object('system_key','debtors', 'debit', r.amount, 'party_type','customer', 'party_name', r.customer_name),
            jsonb_build_object('system_key','sales', 'credit', r.amount))));
        IF v_voucher_id IS NOT NULL THEN
          v_count := v_count + 1;
          v_total := v_total + r.amount;
        END IF;
      END IF;

      v_due := (v_due + public._recurring_interval(r.frequency))::date;
    END LOOP;

    IF v_iterations > 0 THEN
      UPDATE public.recurring_invoices SET next_due = v_due WHERE id = r.id;
    END IF;
    IF v_count > 0 THEN
      recurring_id := r.id; occurrences_created := v_count; total_posted := v_total;
      RETURN NEXT;
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.acct_process_recurring_bills(p_asof date DEFAULT current_date)
RETURNS TABLE (recurring_id uuid, occurrences_created int, total_posted numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.recurring_bills; v_due date; v_occ_id uuid; v_voucher_id uuid;
  v_count int; v_total numeric; v_iterations int;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.acct_can_write() OR public.acct_can_approve()) THEN
    RAISE EXCEPTION 'Only Accounts, Admin or CEO can process recurring bills';
  END IF;

  FOR r IN SELECT * FROM public.recurring_bills WHERE status = 'active' AND coalesce(amount,0) > 0 LOOP
    v_due := coalesce(r.next_due, r.start_date);
    v_count := 0; v_total := 0; v_iterations := 0;
    WHILE v_due IS NOT NULL AND v_due <= p_asof AND v_iterations < 36 LOOP
      v_iterations := v_iterations + 1;
      INSERT INTO public.recurring_bill_occurrences (recurring_bill_id, occurrence_date, amount)
      VALUES (r.id, v_due, r.amount)
      ON CONFLICT (recurring_bill_id, occurrence_date) DO NOTHING
      RETURNING id INTO v_occ_id;

      IF v_occ_id IS NOT NULL THEN
        v_voucher_id := public.acct_auto_post(jsonb_build_object(
          'source_table', 'recurring_bill_occurrences', 'source_id', v_occ_id, 'voucher_type', 'purchase',
          'posting_date', v_due, 'party_type', 'vendor', 'party_name', r.vendor_name,
          'narration', 'Recurring bill · ' || coalesce(r.vendor_name,'') || coalesce(' · ' || r.description, ''),
          'lines', jsonb_build_array(
            jsonb_build_object('system_key','purchases', 'debit', r.amount),
            jsonb_build_object('system_key','creditors', 'credit', r.amount, 'party_type','vendor', 'party_name', r.vendor_name))));
        IF v_voucher_id IS NOT NULL THEN
          v_count := v_count + 1;
          v_total := v_total + r.amount;
        END IF;
      END IF;

      v_due := (v_due + public._recurring_interval(r.frequency))::date;
    END LOOP;

    IF v_iterations > 0 THEN
      UPDATE public.recurring_bills SET next_due = v_due WHERE id = r.id;
    END IF;
    IF v_count > 0 THEN
      recurring_id := r.id; occurrences_created := v_count; total_posted := v_total;
      RETURN NEXT;
    END IF;
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.acct_process_recurring_invoices(date) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.acct_process_recurring_invoices(date) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.acct_process_recurring_bills(date) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.acct_process_recurring_bills(date) TO authenticated;
