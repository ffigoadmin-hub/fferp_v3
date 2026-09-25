-- ADD_ACCOUNTS_PAYMENTS_RECEIVED.sql
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- Found while fixing the Finance Dashboard (2026-09-25): once real numbers were wired in,
-- "Cash on Hand" came out at -₹16,13,985.30. Root cause: sales_orders posts the SALE
-- (Dr Debtors / Cr Sales) but nothing has ever posted the RECEIPT (Dr Bank / Cr Debtors) when a
-- customer actually pays — vendor/transport payments post both halves (bill + payment), sales
-- only ever posted the first half. PaymentsReceivedPage.tsx looks like the intended UI for this,
-- but it inserts customer_name/invoice_reference/payment_mode/utr_number/received_date/status/
-- recorded_by into payments_received — none of which existed (real columns: payer, method,
-- reference, order_id, received_by, received_at). Same missing-column bug as credit_notes;
-- table has 0 rows.
--
-- Fix: add the columns the page expects, plus customer_id/hub_id for proper ledger linkage, and
-- auto-post Dr Bank/Cash · Cr Debtors once accounts marks a receipt 'verified' (not on 'pending'
-- or 'bounced' — matches the real workflow of confirming against a bank statement before it
-- hits the books).
--
-- Run on:  qwiumswrbddwmlraktvy → Supabase SQL Editor.  ADDITIVE + IDEMPOTENT.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.payments_received
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id),
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS invoice_reference text,
  ADD COLUMN IF NOT EXISTS payment_mode text,
  ADD COLUMN IF NOT EXISTS utr_number text,
  ADD COLUMN IF NOT EXISTS received_date date DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS hub_id uuid REFERENCES public.hubs(id),
  ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES auth.users(id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_received_status_check') THEN
    ALTER TABLE public.payments_received
      ADD CONSTRAINT payments_received_status_check CHECK (status IN ('pending','verified','bounced'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.acct_sync_payment_received(p_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.payments_received; v_amt numeric; v_start date; v_payload jsonb; v_bank_key text;
BEGIN
  SELECT * INTO r FROM public.payments_received WHERE id = p_id;
  SELECT books_start_date INTO v_start FROM public.acct_settings WHERE id = 1;
  v_amt := round(coalesce(r.amount, 0), 2);
  v_bank_key := CASE WHEN lower(coalesce(r.payment_mode,'')) LIKE '%cash%' THEN 'cash' ELSE 'bank_default' END;

  IF r.id IS NOT NULL AND r.status = 'verified' AND v_amt > 0
     AND coalesce(r.received_date, r.created_at::date) >= v_start THEN
    v_payload := jsonb_build_object(
      'posting_date', coalesce(r.received_date, r.created_at::date), 'hub_id', r.hub_id,
      'party_type', 'customer', 'party_id', r.customer_id, 'party_name', r.customer_name,
      'reference_no', r.utr_number,
      'narration', 'Received from ' || coalesce(r.customer_name,'') || coalesce(' · UTR ' || r.utr_number, ''),
      'lines', jsonb_build_array(
        jsonb_build_object('system_key', v_bank_key, 'debit', v_amt),
        jsonb_build_object('system_key','debtors', 'credit', v_amt,
                           'party_type','customer', 'party_id', r.customer_id, 'party_name', r.customer_name)));
  END IF;
  RETURN public.acct__sync('payments_received', p_id, 'receipt', v_payload, 'Receipt ' || coalesce(r.status,'deleted'));
END $$;

CREATE OR REPLACE FUNCTION public.acct_trg_payments_received() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.acct_sync_payment_received(CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS acct_autopost_trg ON public.payments_received;
CREATE TRIGGER acct_autopost_trg AFTER INSERT OR UPDATE OR DELETE ON public.payments_received
  FOR EACH ROW EXECUTE FUNCTION public.acct_trg_payments_received();

REVOKE EXECUTE ON FUNCTION public.acct_sync_payment_received(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.acct_trg_payments_received()    FROM PUBLIC, anon, authenticated;

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
  RETURN QUERY SELECT b.source, b.result, count(*) FROM _acct_bp b GROUP BY 1, 2 ORDER BY 1, 2;
END $$;
