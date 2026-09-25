-- FIX_ACCOUNTS_PURCHASE_RECOGNITION_TIMING.sql
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- Needs: ADD_ACCOUNTS_LEDGER_CORE.sql + ADD_ACCOUNTS_AUTO_POSTING.sql already applied.
--
-- Problem: acct_sync_ff_vendor_payment / acct_sync_ff_transport_payment only recognised the
-- Purchase (Dr Purchases, Cr Creditors) once payment_status reached 'pending_accounts' -- the
-- LAST stage of a 5-stage approval chain (raise -> pending_ff_ops -> pending_l1 -> pending_admin
-- -> pending_ceo -> pending_accounts -> paid). Goods are received (and the payment row created)
-- at pending_ff_ops, the very first stage -- a purchase can sit for days working through
-- approval before the old rule ever recorded it. During that window the books understated both
-- what was owed to the vendor and the cost of goods already bought, even though inventory had
-- already moved.
--
-- Fix: recognise the Purchase the moment the payment is raised -- any status except 'rejected'
-- -- matching the accrual principle (expense when goods are received, not when internal
-- approval finishes). If a payment is later rejected, acct__sync already reverses the voucher
-- automatically; this needed no change.
--
-- Additive: CREATE OR REPLACE only, no schema change. Ends by re-running acct_backpost_all()
-- so every payment currently sitting in pending_l1/pending_admin/pending_ceo (previously
-- unposted) gets its Purchase voucher posted retroactively, dated at its original raise time.
--
-- Run on:  qwiumswrbddwmlraktvy → Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

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

  -- Recognise on raise (any non-rejected status), not only once payment work is almost done.
  IF r.id IS NOT NULL AND coalesce(r.payment_status, '') <> 'rejected' AND v_amt > 0
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

  IF r.id IS NOT NULL AND coalesce(r.payment_status, '') <> 'rejected' AND v_amt > 0
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

-- Re-run so every payment currently sitting pre-pending_accounts (previously unposted under
-- the old rule) gets its Purchase voucher posted now, retroactively, at its real raise date.
SELECT * FROM public.acct_backpost_all();

-- verify: should now show far fewer/no vendor or transport payments with a "none" purchase
-- result outside of genuinely rejected/zero-amount/pre-books-start rows
SELECT source, result, count(*) FROM (
  SELECT 'ff_vendor_payments' AS source, public.acct_sync_ff_vendor_payment(id) AS result FROM public.ff_vendor_payments
  UNION ALL
  SELECT 'ff_transport_payments', public.acct_sync_ff_transport_payment(id) FROM public.ff_transport_payments
) x GROUP BY source, result ORDER BY 1, 2;
