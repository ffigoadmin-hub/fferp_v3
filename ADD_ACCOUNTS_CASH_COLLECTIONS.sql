-- ADD_ACCOUNTS_CASH_COLLECTIONS.sql
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- P1 (Daily Branch Cash Closing) prerequisite, found while investigating: cash_collections is the
-- real field-collection mechanism (collector_id, proof_url, verified_by/at, deposited_at — matches
-- how field executives actually collect COD cash/UPI from customers, confirmed with the business
-- owner), but CollectionEntryPage.tsx inserts customer_name/shop_name/area/phone/order_number/
-- order_amount/collected_amount/upi_reference/cheque_number/hub_id/collected_by — none of which
-- existed live (0 rows ever saved). Same missing-column bug as every P0 fix.
--
-- Also found: the page queries/filters by a `collected_by` column that was never real, while RLS's
-- "Users view own cash_collections" policy checks the real `collector_id` column instead — even
-- with columns added, a field exec would never see their own entries. Fixed by giving collector_id
-- a DEFAULT of auth.uid() (page never sets it, so every insert lands the real value automatically)
-- and pointing the page's query at collector_id instead of a new redundant column.
--
-- Ledger design: a collection auto-posts (Dr Cash-or-Bank by payment_mode / Cr Debtors) only once
-- an approver (admin/ceo/gm/accounts — matches the existing "Approvers update cash_collections" RLS
-- policy) marks it verified (verified_by/verified_at) — collected_amount may be less than
-- order_amount (shortfall), which is posted correctly since only what was actually collected
-- reduces the customer's receivable.
--
-- Run on:  qwiumswrbddwmlraktvy → Supabase SQL Editor.  ADDITIVE + IDEMPOTENT.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cash_collections
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.sales_orders(id),
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS shop_name text,
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS order_number text,
  ADD COLUMN IF NOT EXISTS order_amount numeric,
  ADD COLUMN IF NOT EXISTS collected_amount numeric,
  ADD COLUMN IF NOT EXISTS upi_reference text,
  ADD COLUMN IF NOT EXISTS cheque_number text,
  ADD COLUMN IF NOT EXISTS hub_id uuid REFERENCES public.hubs(id);

ALTER TABLE public.cash_collections ALTER COLUMN collector_id SET DEFAULT auth.uid();

CREATE OR REPLACE FUNCTION public.acct_sync_cash_collection(p_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.cash_collections; v_amt numeric; v_start date; v_payload jsonb; v_bank_key text; v_party_name text;
BEGIN
  SELECT * INTO r FROM public.cash_collections WHERE id = p_id;
  SELECT books_start_date INTO v_start FROM public.acct_settings WHERE id = 1;
  v_amt := round(coalesce(r.collected_amount, 0), 2);
  v_bank_key := CASE WHEN lower(coalesce(r.payment_mode,'')) = 'cash' THEN 'cash' ELSE 'bank_default' END;
  v_party_name := coalesce(r.customer_name, r.shop_name);

  IF r.id IS NOT NULL AND r.verified_at IS NOT NULL AND v_amt > 0
     AND coalesce(r.collection_date, r.created_at::date) >= v_start THEN
    v_payload := jsonb_build_object(
      'posting_date', coalesce(r.collection_date, r.created_at::date), 'hub_id', r.hub_id,
      'party_type', 'customer', 'party_id', r.customer_id, 'party_name', v_party_name,
      'reference_no', coalesce(r.order_number, r.upi_reference, r.cheque_number),
      'narration', 'Field collection from ' || coalesce(v_party_name,'customer')
                   || coalesce(' · Order ' || r.order_number, '') || ' · ' || upper(coalesce(r.payment_mode,'')),
      'lines', jsonb_build_array(
        jsonb_build_object('system_key', v_bank_key, 'debit', v_amt),
        jsonb_build_object('system_key','debtors', 'credit', v_amt,
                           'party_type','customer', 'party_id', r.customer_id, 'party_name', v_party_name)));
  END IF;
  RETURN public.acct__sync('cash_collections', p_id, 'receipt', v_payload,
                           CASE WHEN r.verified_at IS NOT NULL THEN 'Collection verified' ELSE 'Collection unverified/deleted' END);
END $$;

CREATE OR REPLACE FUNCTION public.acct_trg_cash_collections() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.acct_sync_cash_collection(CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS acct_autopost_trg ON public.cash_collections;
CREATE TRIGGER acct_autopost_trg AFTER INSERT OR UPDATE OR DELETE ON public.cash_collections
  FOR EACH ROW EXECUTE FUNCTION public.acct_trg_cash_collections();

REVOKE EXECUTE ON FUNCTION public.acct_sync_cash_collection(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.acct_trg_cash_collections()    FROM PUBLIC, anon, authenticated;

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
  RETURN QUERY SELECT b.source, b.result, count(*) FROM _acct_bp b GROUP BY 1, 2 ORDER BY 1, 2;
END $$;
