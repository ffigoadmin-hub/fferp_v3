-- ============================================================
--  FIX — auto_vendor_payment() trigger inserts an invalid status
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  Root cause: the trigger (defined in COMPLETE_SCHEMA_MIGRATION.sql,
--  fired AFTER INSERT ON purchase_entries) inserts a vendor_payments
--  row with status = 'pending_ops_approval'. That value belongs to a
--  different, FF-specific status vocabulary — the ACTUAL live
--  vendor_payments_status_check constraint only allows:
--    'pending_admin', 'pending_director', 'approved', 'rejected',
--    'processed', 'paid'
--  (confirmed via pg_get_constraintdef on the live table 2026-07-22)
--
--  This is why every purchase-exec "Buy" action (BuyPage.tsx →
--  purchase_entries insert) has been failing in production — the
--  trigger's own insert violates the check constraint and the whole
--  transaction rolls back.
--
--  Fix: use 'pending_admin' (confirmed as step 1 / "Admin Review" in
--  PaymentApprovalQueue.tsx's own STATUS_CONFIG) instead.
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_vendor_payment()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.vendor_payments (purchase_entry_id, vendor_id, amount, status)
  VALUES (NEW.id, NEW.vendor_id, NEW.total_amount, 'pending_admin');
  RETURN NEW;
END;
$$;

-- Trigger itself doesn't need recreating (CREATE OR REPLACE FUNCTION
-- updates the body in place, trigger binding is unaffected) — but
-- included for completeness/idempotency in case it was ever dropped.
DROP TRIGGER IF EXISTS trg_auto_vendor_payment ON public.purchase_entries;
CREATE TRIGGER trg_auto_vendor_payment
  AFTER INSERT ON public.purchase_entries
  FOR EACH ROW EXECUTE FUNCTION public.auto_vendor_payment();
