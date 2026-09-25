-- ADD_ACCOUNTS_AUTO_POSTING.sql
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- FFERP Accounts — auto-posting from operations into the ledger (needs ADD_ACCOUNTS_LEDGER_CORE.sql).
--
-- Source → voucher (columns verified live 2026-09-24):
--   sales_orders           status confirmed/processing/dispatched/delivered
--                            SALE  Dr Sundry Debtors (customer)    net_amount + delivery_charges
--                                  Cr Sales - Fresh Produce          net_amount   (= total − discount)
--                                  Cr Delivery Charges Collected     delivery_charges
--                            date = delivery_date, else order_date · hub = sales_orders.hub_id
--                          cancelled / back to pending → reversed
--     (invoices are NOT posted: live data has 2–3 duplicate invoices per order.)
--   ff_vendor_payments     fully approved (pending_accounts / approved / paid)
--                            PURCHASE  Dr Purchases (hub)  Cr Sundry Creditors (vendor)  net_amount
--                            date = created_at (IST)
--                          paid
--                            PAYMENT   Dr Sundry Creditors (vendor)  Cr Kotak Bank  net_amount
--                            date = paid_at (IST), reference = UTR
--                          rejected / un-paid / deleted → the matching voucher is reversed
--   ff_transport_payments  same two steps with Freight Inward & Transport / Transporters Payable,
--                          amount = total_amount (base + toll + other), party = driver
--   wastage_entries        amount > 0: Dr Wastage & Spoilage  Cr Purchases (moves the cost of
--                          spoiled stock out of purchases so it shows separately in the P&L)
--
-- Any change to amount / date / party / hub on an already-posted document reverses the old
-- voucher and posts a fresh one, so the ledger always mirrors the document. Nothing here can
-- block an operational save: failures land in acct_posting_errors (Vouchers → Posting problems).
--
-- The file ends by back-posting every existing document dated on/after the books start
-- (2026-04-01) in date order. Re-running is safe: already-posted documents are skipped.
--
-- Run on:  qwiumswrbddwmlraktvy → Supabase SQL Editor.  ADDITIVE + IDEMPOTENT.
-- Adds AFTER triggers to sales_orders, ff_vendor_payments, ff_transport_payments,
-- wastage_entries (no change to their columns or data).
-- ─────────────────────────────────────────────────────────────────────────────────────────────

-- ── 1. Internal reversal (no role check) + public wrapper refactor ─────────────────────────────
CREATE OR REPLACE FUNCTION public.acct__reverse(p_id uuid, p_reason text, p_date date, p_user uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.acct_vouchers; v_new uuid; v_lines jsonb;
BEGIN
  SELECT * INTO v FROM public.acct_vouchers WHERE id = p_id FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Voucher not found'; END IF;
  IF v.status <> 'posted' THEN RAISE EXCEPTION 'Only posted vouchers can be reversed'; END IF;
  IF v.reversed_by IS NOT NULL THEN RAISE EXCEPTION 'Voucher % is already reversed', v.voucher_no; END IF;
  IF v.voucher_type = 'reversal' THEN RAISE EXCEPTION 'A reversal cannot itself be reversed'; END IF;

  SELECT jsonb_agg(jsonb_build_object('account_id', account_id, 'debit', credit, 'credit', debit,
           'hub_id', hub_id, 'party_type', party_type, 'party_id', party_id, 'party_name', party_name,
           'remarks', remarks, 'gst_rate', gst_rate,
           'taxable_value', CASE WHEN taxable_value IS NULL THEN NULL ELSE -taxable_value END,
           'hsn_code', hsn_code) ORDER BY line_no)
  INTO v_lines FROM public.acct_voucher_lines WHERE voucher_id = p_id;

  v_new := public.acct__insert_voucher(jsonb_build_object(
    'voucher_type', 'reversal', 'posting_date', p_date,
    'hub_id', v.hub_id, 'party_type', v.party_type, 'party_id', v.party_id, 'party_name', v.party_name,
    'reference_no', v.voucher_no, 'narration', 'Reversal of ' || v.voucher_no || ': ' || p_reason,
    'reversal_of', v.id, 'is_auto', v.is_auto, 'lines', v_lines), p_user);
  UPDATE public.acct_vouchers SET approved_by = p_user, approved_at = now() WHERE id = v_new;
  PERFORM public.acct__post(v_new, p_user);
  UPDATE public.acct_vouchers SET reversed_by = v_new WHERE id = p_id;
  RETURN v_new;
END $$;

CREATE OR REPLACE FUNCTION public.acct_reverse_voucher(p_id uuid, p_reason text, p_date date DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.acct_can_approve() THEN RAISE EXCEPTION 'Only Admin or CEO can reverse posted vouchers'; END IF;
  IF coalesce(trim(p_reason), '') = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  RETURN public.acct__reverse(p_id, p_reason, coalesce(p_date, current_date), auth.uid());
END $$;

-- ── 2. Sync engine: make the ledger match one source document ──────────────────────────────────
-- Business dates are Indian dates.
CREATE OR REPLACE FUNCTION public.acct__ist(p_ts timestamptz) RETURNS date
LANGUAGE sql IMMUTABLE AS $$ SELECT (p_ts AT TIME ZONE 'Asia/Kolkata')::date $$;

-- Date an automatic reversal is posted on: the original date if that period is still open,
-- otherwise the first open day (today at the earliest).
CREATE OR REPLACE FUNCTION public.acct__auto_reversal_date(p_original date) RETURNS date
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN s.lock_date IS NOT NULL AND p_original <= s.lock_date THEN greatest(current_date, s.lock_date + 1)
    WHEN EXISTS (SELECT 1 FROM public.acct_fiscal_years f
                 WHERE p_original BETWEEN f.start_date AND f.end_date AND f.is_closed) THEN current_date
    ELSE p_original END
  FROM public.acct_settings s WHERE s.id = 1;
$$;

-- p_payload = the voucher the document should have right now, or NULL if it should have none.
-- Compares with the live voucher; reverses and/or posts as needed. Never raises.
CREATE OR REPLACE FUNCTION public.acct__sync(p_source_table text, p_source_id uuid, p_voucher_type text,
                                             p_payload jsonb, p_reason text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v public.acct_vouchers; v_total numeric; v_hub uuid; v_party uuid; v_new uuid;
BEGIN
  SELECT * INTO v FROM public.acct_vouchers
  WHERE source_table = p_source_table AND source_id = p_source_id AND voucher_type = p_voucher_type
    AND reversal_of IS NULL AND reversed_by IS NULL AND status = 'posted'
  LIMIT 1;

  IF p_payload IS NULL THEN
    IF v.id IS NULL THEN RETURN 'none'; END IF;
    PERFORM public.acct__reverse(v.id, p_reason, public.acct__auto_reversal_date(v.posting_date), auth.uid());
    RETURN 'reversed';
  END IF;

  IF v.id IS NOT NULL THEN
    SELECT round(sum(coalesce((l->>'debit')::numeric, 0)), 2) INTO v_total
    FROM jsonb_array_elements(p_payload->'lines') l;
    v_hub   := nullif(p_payload->>'hub_id','')::uuid;
    v_party := nullif(p_payload->>'party_id','')::uuid;
    IF v.total_debit = v_total AND v.posting_date = (p_payload->>'posting_date')::date
       AND v.hub_id IS NOT DISTINCT FROM v_hub AND v.party_id IS NOT DISTINCT FROM v_party
       AND v.party_name IS NOT DISTINCT FROM (p_payload->>'party_name') THEN
      RETURN 'unchanged';
    END IF;
    PERFORM public.acct__reverse(v.id, 'Document changed — re-posted',
                                 public.acct__auto_reversal_date(v.posting_date), auth.uid());
  END IF;

  v_new := public.acct_auto_post(p_payload || jsonb_build_object(
    'source_table', p_source_table, 'source_id', p_source_id, 'voucher_type', p_voucher_type));
  RETURN CASE WHEN v_new IS NULL THEN 'failed' WHEN v.id IS NULL THEN 'posted' ELSE 'reposted' END;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.acct_posting_errors (source_table, source_id, voucher_type, error_message, payload)
  VALUES (p_source_table, p_source_id, p_voucher_type, SQLERRM, p_payload);
  RETURN 'failed';
END $$;

-- ── 3. Per-document posting rules ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.acct_sync_sales_order(p_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.sales_orders; v_net numeric; v_del numeric; v_date date; v_payload jsonb; v_start date;
BEGIN
  SELECT * INTO r FROM public.sales_orders WHERE id = p_id;
  SELECT books_start_date INTO v_start FROM public.acct_settings WHERE id = 1;
  v_net  := round(coalesce(r.net_amount, 0), 2);
  v_del  := round(coalesce(r.delivery_charges, 0), 2);
  v_date := coalesce(r.delivery_date, r.order_date);

  IF r.id IS NOT NULL AND r.status IN ('confirmed','processing','dispatched','delivered')
     AND v_net + v_del > 0 AND v_date >= v_start THEN
    v_payload := jsonb_build_object(
      'posting_date', v_date, 'hub_id', r.hub_id,
      'party_type', 'customer', 'party_id', r.customer_id, 'party_name', r.customer_name,
      'reference_no', r.order_number,
      'narration', 'Sale ' || coalesce(r.order_number, '') || ' · ' || coalesce(r.customer_name, '')
                   || coalesce(' · ' || r.channel, ''),
      'lines', jsonb_build_array(
        jsonb_build_object('system_key','debtors', 'debit', v_net + v_del,
                           'party_type','customer', 'party_id', r.customer_id, 'party_name', r.customer_name),
        jsonb_build_object('system_key','sales', 'credit', v_net),
        jsonb_build_object('system_key','delivery_income', 'credit', v_del)));
  END IF;
  RETURN public.acct__sync('sales_orders', p_id, 'sales_invoice', v_payload,
                           'Order ' || coalesce(r.status, 'deleted'));
END $$;

CREATE OR REPLACE FUNCTION public.acct_sync_ff_vendor_payment(p_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.ff_vendor_payments; v_name text; v_amt numeric; v_start date;
  v_purchase jsonb; v_payment jsonb; a text; b text;
BEGIN
  SELECT * INTO r FROM public.ff_vendor_payments WHERE id = p_id;
  SELECT books_start_date INTO v_start FROM public.acct_settings WHERE id = 1;
  SELECT name INTO v_name FROM public.vendors WHERE id = r.vendor_id;
  v_amt := round(coalesce(r.net_amount, 0), 2);

  IF r.id IS NOT NULL AND r.payment_status IN ('pending_accounts','approved','paid') AND v_amt > 0
     AND public.acct__ist(r.created_at) >= v_start THEN
    v_purchase := jsonb_build_object(
      'posting_date', public.acct__ist(r.created_at), 'hub_id', r.hub_id,
      'party_type', 'vendor', 'party_id', r.vendor_id, 'party_name', v_name,
      'narration', 'Market purchase · ' || coalesce(v_name, 'vendor')
                   || CASE WHEN coalesce(r.deduction_amount,0) > 0
                           THEN ' (gross ' || r.gross_amount || ' less deduction ' || r.deduction_amount || ')' ELSE '' END,
      'lines', jsonb_build_array(
        jsonb_build_object('system_key','purchases', 'debit', v_amt),
        jsonb_build_object('system_key','creditors', 'credit', v_amt,
                           'party_type','vendor', 'party_id', r.vendor_id, 'party_name', v_name)));
  END IF;

  IF r.id IS NOT NULL AND r.payment_status = 'paid' AND v_amt > 0
     AND public.acct__ist(coalesce(r.paid_at, r.updated_at, r.created_at)) >= v_start THEN
    v_payment := jsonb_build_object(
      'posting_date', public.acct__ist(coalesce(r.paid_at, r.updated_at, r.created_at)), 'hub_id', r.hub_id,
      'party_type', 'vendor', 'party_id', r.vendor_id, 'party_name', v_name, 'reference_no', r.utr_number,
      'narration', 'Paid ' || coalesce(v_name, 'vendor') || coalesce(' · UTR ' || r.utr_number, ''),
      'lines', jsonb_build_array(
        jsonb_build_object('system_key','creditors', 'debit', v_amt,
                           'party_type','vendor', 'party_id', r.vendor_id, 'party_name', v_name),
        jsonb_build_object('system_key','bank_default', 'credit', v_amt)));
  END IF;

  -- payment first when undoing, purchase first when posting (keeps vouchers in a sensible order)
  IF v_payment IS NULL THEN
    b := public.acct__sync('ff_vendor_payments', p_id, 'payment', NULL, 'Payment ' || coalesce(r.payment_status, 'deleted'));
    a := public.acct__sync('ff_vendor_payments', p_id, 'purchase', v_purchase, 'Payment ' || coalesce(r.payment_status, 'deleted'));
  ELSE
    a := public.acct__sync('ff_vendor_payments', p_id, 'purchase', v_purchase, 'Payment ' || r.payment_status);
    b := public.acct__sync('ff_vendor_payments', p_id, 'payment', v_payment, 'Payment ' || r.payment_status);
  END IF;
  RETURN a || '/' || b;
END $$;

CREATE OR REPLACE FUNCTION public.acct_sync_ff_transport_payment(p_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.ff_transport_payments; v_name text; v_amt numeric; v_start date;
  v_bill jsonb; v_payment jsonb; a text; b text;
BEGIN
  SELECT * INTO r FROM public.ff_transport_payments WHERE id = p_id;
  SELECT books_start_date INTO v_start FROM public.acct_settings WHERE id = 1;
  SELECT name INTO v_name FROM public.profiles WHERE id = r.driver_id;
  v_name := coalesce(v_name, r.vehicle_number, 'Transporter');
  v_amt := round(coalesce(r.total_amount, 0), 2);

  IF r.id IS NOT NULL AND r.payment_status IN ('pending_accounts','approved','paid') AND v_amt > 0
     AND coalesce(r.trip_date, public.acct__ist(r.created_at)) >= v_start THEN
    v_bill := jsonb_build_object(
      'posting_date', coalesce(r.trip_date, public.acct__ist(r.created_at)), 'hub_id', r.hub_id,
      'party_type', 'driver', 'party_id', r.driver_id, 'party_name', v_name,
      'narration', 'Transport ' || coalesce(r.origin, '') || ' → ' || coalesce(r.destination, '')
                   || coalesce(' · ' || r.vehicle_number, ''),
      'lines', jsonb_build_array(
        jsonb_build_object('system_key','freight', 'debit', v_amt),
        jsonb_build_object('system_key','transport_payable', 'credit', v_amt,
                           'party_type','driver', 'party_id', r.driver_id, 'party_name', v_name)));
  END IF;

  IF r.id IS NOT NULL AND r.payment_status = 'paid' AND v_amt > 0
     AND public.acct__ist(coalesce(r.paid_at, r.updated_at, r.created_at)) >= v_start THEN
    v_payment := jsonb_build_object(
      'posting_date', public.acct__ist(coalesce(r.paid_at, r.updated_at, r.created_at)), 'hub_id', r.hub_id,
      'party_type', 'driver', 'party_id', r.driver_id, 'party_name', v_name, 'reference_no', r.utr_number,
      'narration', 'Paid transporter ' || v_name || coalesce(' · UTR ' || r.utr_number, ''),
      'lines', jsonb_build_array(
        jsonb_build_object('system_key','transport_payable', 'debit', v_amt,
                           'party_type','driver', 'party_id', r.driver_id, 'party_name', v_name),
        jsonb_build_object('system_key','bank_default', 'credit', v_amt)));
  END IF;

  IF v_payment IS NULL THEN
    b := public.acct__sync('ff_transport_payments', p_id, 'payment', NULL, 'Payment ' || coalesce(r.payment_status, 'deleted'));
    a := public.acct__sync('ff_transport_payments', p_id, 'purchase', v_bill, 'Payment ' || coalesce(r.payment_status, 'deleted'));
  ELSE
    a := public.acct__sync('ff_transport_payments', p_id, 'purchase', v_bill, 'Payment ' || r.payment_status);
    b := public.acct__sync('ff_transport_payments', p_id, 'payment', v_payment, 'Payment ' || r.payment_status);
  END IF;
  RETURN a || '/' || b;
END $$;

CREATE OR REPLACE FUNCTION public.acct_sync_wastage(p_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.wastage_entries; v_amt numeric; v_payload jsonb; v_start date;
BEGIN
  SELECT * INTO r FROM public.wastage_entries WHERE id = p_id;
  SELECT books_start_date INTO v_start FROM public.acct_settings WHERE id = 1;
  v_amt := round(coalesce(r.amount, 0)::numeric, 2);
  IF r.id IS NOT NULL AND v_amt > 0 AND r.entry_date >= v_start THEN
    v_payload := jsonb_build_object(
      'posting_date', r.entry_date, 'hub_id', r.hub_id,
      'narration', 'Wastage · ' || r.item_name || ' ' || r.quantity_kg || ' kg' || coalesce(' · ' || r.reason, ''),
      'lines', jsonb_build_array(
        jsonb_build_object('system_key','wastage', 'debit', v_amt),
        jsonb_build_object('system_key','purchases', 'credit', v_amt)));
  END IF;
  RETURN public.acct__sync('wastage_entries', p_id, 'wastage', v_payload, 'Wastage entry changed or removed');
END $$;

-- ── 4. Triggers (AFTER, row level; they never raise, so operations are never blocked) ─────────
CREATE OR REPLACE FUNCTION public.acct_trg_sales_orders() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.acct_sync_sales_order(CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.acct_trg_ff_vendor_payments() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.acct_sync_ff_vendor_payment(CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.acct_trg_ff_transport_payments() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.acct_sync_ff_transport_payment(CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.acct_trg_wastage_entries() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.acct_sync_wastage(CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS acct_autopost_trg ON public.sales_orders;
CREATE TRIGGER acct_autopost_trg AFTER INSERT OR UPDATE OR DELETE ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.acct_trg_sales_orders();

DROP TRIGGER IF EXISTS acct_autopost_trg ON public.ff_vendor_payments;
CREATE TRIGGER acct_autopost_trg AFTER INSERT OR UPDATE OR DELETE ON public.ff_vendor_payments
  FOR EACH ROW EXECUTE FUNCTION public.acct_trg_ff_vendor_payments();

DROP TRIGGER IF EXISTS acct_autopost_trg ON public.ff_transport_payments;
CREATE TRIGGER acct_autopost_trg AFTER INSERT OR UPDATE OR DELETE ON public.ff_transport_payments
  FOR EACH ROW EXECUTE FUNCTION public.acct_trg_ff_transport_payments();

DROP TRIGGER IF EXISTS acct_autopost_trg ON public.wastage_entries;
CREATE TRIGGER acct_autopost_trg AFTER INSERT OR UPDATE OR DELETE ON public.wastage_entries
  FOR EACH ROW EXECUTE FUNCTION public.acct_trg_wastage_entries();

-- ── 5. Back-posting (admin / ceo / accounts can re-run it from SQL or the app) ─────────────────
CREATE OR REPLACE FUNCTION public.acct_backpost_all() RETURNS TABLE (source text, result text, documents bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.acct_can_write() OR public.acct_can_approve()) THEN
    RAISE EXCEPTION 'Only Accounts, Admin or CEO can back-post';
  END IF;
  CREATE TEMP TABLE IF NOT EXISTS _acct_bp (source text, result text) ON COMMIT DROP;
  TRUNCATE _acct_bp;
  -- oldest first so voucher numbers run in date order
  INSERT INTO _acct_bp SELECT 'sales_orders', public.acct_sync_sales_order(id)
    FROM public.sales_orders ORDER BY coalesce(delivery_date, order_date), created_at;
  INSERT INTO _acct_bp SELECT 'ff_vendor_payments', public.acct_sync_ff_vendor_payment(id)
    FROM public.ff_vendor_payments ORDER BY created_at;
  INSERT INTO _acct_bp SELECT 'ff_transport_payments', public.acct_sync_ff_transport_payment(id)
    FROM public.ff_transport_payments ORDER BY created_at;
  INSERT INTO _acct_bp SELECT 'wastage_entries', public.acct_sync_wastage(id)
    FROM public.wastage_entries ORDER BY entry_date, created_at;
  RETURN QUERY SELECT b.source, b.result, count(*) FROM _acct_bp b GROUP BY 1, 2 ORDER BY 1, 2;
END $$;

REVOKE EXECUTE ON FUNCTION public.acct__reverse(uuid, text, date, uuid)          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.acct__sync(text, uuid, text, jsonb, text)       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.acct__auto_reversal_date(date)                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.acct_sync_sales_order(uuid)                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.acct_sync_ff_vendor_payment(uuid)               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.acct_sync_ff_transport_payment(uuid)            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.acct_sync_wastage(uuid)                         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.acct_trg_sales_orders()                         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.acct_trg_ff_vendor_payments()                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.acct_trg_ff_transport_payments()                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.acct_trg_wastage_entries()                      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.acct_backpost_all()                             FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.acct_backpost_all()                             TO authenticated;

-- ── 6. Back-post existing documents now, then verify (paste both results back) ────────────────
SELECT * FROM public.acct_backpost_all();

SELECT 'vouchers by type' AS what, voucher_type || ' · ' || status AS detail, count(*) AS n, sum(total_debit) AS amount
FROM public.acct_vouchers GROUP BY voucher_type, status
UNION ALL
SELECT 'trial balance check', 'debit − credit (must be 0)', count(*), sum(debit) - sum(credit) FROM public.acct_gl
UNION ALL
SELECT 'open posting problems', left(error_message, 80), count(*), NULL FROM public.acct_posting_errors
WHERE NOT resolved GROUP BY error_message
UNION ALL
SELECT 'triggers', tgrelid::regclass::text, 1, NULL FROM pg_trigger WHERE tgname = 'acct_autopost_trg'
ORDER BY 1, 2;
