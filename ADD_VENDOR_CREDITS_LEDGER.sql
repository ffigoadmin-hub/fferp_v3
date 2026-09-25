-- ADD_VENDOR_CREDITS_LEDGER.sql
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- Follow-up fix found during the cash-collections investigation: vendor_credits has the same
-- missing-column bug as everything else (page inserts credit_note_number/vendor_name/
-- bill_reference/credit_amount/expiry_date/status — none existed live), PLUS RLS was enabled with
-- zero policies (deny-all — nobody, not even staff, could read or write it at all). 0 rows ever.
--
-- Conceptually different from debit_notes (added earlier this session): a vendor_credit is an
-- open credit balance held with a vendor (e.g. a goods-return credit) to be applied against a
-- FUTURE bill, not an immediate net-off against an existing payable. Modelled as:
--   'open'    (issued):  Dr Vendor Advances / Cr Purchase Returns
--   'applied'/'expired': status-only — there is no bill_id linking a credit to what it was
--     applied against, so the offsetting entry against that specific bill can't be posted
--     correctly here. Flagged, not guessed: if this table starts seeing real use, that linkage
--     needs to be added before 'applied' can post anything.
--
-- Run on:  qwiumswrbddwmlraktvy → Supabase SQL Editor.  ADDITIVE + IDEMPOTENT.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.vendor_credits
  ADD COLUMN IF NOT EXISTS credit_note_number text,
  ADD COLUMN IF NOT EXISTS vendor_name text,
  ADD COLUMN IF NOT EXISTS bill_reference text,
  ADD COLUMN IF NOT EXISTS credit_amount numeric,
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','applied','expired'));

DROP POLICY IF EXISTS vendor_credits_staff_access ON public.vendor_credits;
CREATE POLICY vendor_credits_staff_access ON public.vendor_credits FOR ALL USING (is_staff()) WITH CHECK (is_staff());

CREATE OR REPLACE FUNCTION public.acct_sync_vendor_credit(p_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.vendor_credits; v_amt numeric; v_start date; v_payload jsonb;
BEGIN
  SELECT * INTO r FROM public.vendor_credits WHERE id = p_id;
  SELECT books_start_date INTO v_start FROM public.acct_settings WHERE id = 1;
  v_amt := round(coalesce(r.credit_amount, 0), 2);

  IF r.id IS NOT NULL AND r.status = 'open' AND v_amt > 0
     AND coalesce(r.created_at::date, current_date) >= v_start THEN
    v_payload := jsonb_build_object(
      'posting_date', r.created_at::date,
      'party_type', 'vendor', 'party_id', r.vendor_id, 'party_name', r.vendor_name,
      'reference_no', r.credit_note_number,
      'narration', 'Vendor credit ' || coalesce(r.credit_note_number,'') || ' · ' || coalesce(r.vendor_name,'')
                   || coalesce(' · ' || r.reason, ''),
      'lines', jsonb_build_array(
        jsonb_build_object('system_key','vendor_advances', 'debit', v_amt,
                           'party_type','vendor', 'party_id', r.vendor_id, 'party_name', r.vendor_name),
        jsonb_build_object('system_key','purchase_returns', 'credit', v_amt)));
  END IF;
  RETURN public.acct__sync('vendor_credits', p_id, 'debit_note', v_payload, 'Vendor credit ' || coalesce(r.status,'deleted'));
END $$;

CREATE OR REPLACE FUNCTION public.acct_trg_vendor_credits() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.acct_sync_vendor_credit(CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS acct_autopost_trg ON public.vendor_credits;
CREATE TRIGGER acct_autopost_trg AFTER INSERT OR UPDATE OR DELETE ON public.vendor_credits
  FOR EACH ROW EXECUTE FUNCTION public.acct_trg_vendor_credits();

REVOKE EXECUTE ON FUNCTION public.acct_sync_vendor_credit(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.acct_trg_vendor_credits()     FROM PUBLIC, anon, authenticated;

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
  INSERT INTO _acct_bp SELECT 'vendor_credits', public.acct_sync_vendor_credit(id)
    FROM public.vendor_credits ORDER BY created_at;
  RETURN QUERY SELECT b.source, b.result, count(*) FROM _acct_bp b GROUP BY 1, 2 ORDER BY 1, 2;
END $$;
