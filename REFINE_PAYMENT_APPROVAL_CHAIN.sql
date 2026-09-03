-- ============================================================
--  Refine the FF payment approval chain
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  OLD chain (5 stages): FF Ops Manager → L1 → GM → Auditor → CEO → (approved) → Paid
--  NEW chain (5 stages): Manager → L1 → Admin → CEO → Accounts → Paid
--
--  - "FF Ops Manager" is kept as the underlying status value/columns
--    (pending_ff_ops, ff_ops_approved_*) — just relabelled "Manager" in
--    the UI — to avoid touching every file that reads that literal string.
--  - GM and Auditor are retired from the active chain (their columns and
--    status values stay in the table for historical rows; new payments
--    never enter those stages again).
--  - Admin and Accounts become real stages instead of "admin can approve
--    anything at any time" — Admin sits after L1, Accounts is the final
--    stage and its approval directly marks the payment Paid (disbursement
--    and approval are the same action for Accounts).
--  - Every payment currently mid-flow is auto-advanced into the
--    equivalent new stage (never left stuck on a retired stage), applied
--    the same way to both ff_vendor_payments and ff_transport_payments.
-- ============================================================

-- ── 1. New columns for the two new stages ───────────────────────
ALTER TABLE public.ff_vendor_payments
  ADD COLUMN IF NOT EXISTS admin_approved_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_approved_at    timestamptz,
  ADD COLUMN IF NOT EXISTS admin_remarks        text,
  ADD COLUMN IF NOT EXISTS accounts_approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accounts_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS accounts_remarks     text;

ALTER TABLE public.ff_transport_payments
  ADD COLUMN IF NOT EXISTS admin_approved_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_approved_at    timestamptz,
  ADD COLUMN IF NOT EXISTS admin_remarks        text,
  ADD COLUMN IF NOT EXISTS accounts_approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accounts_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS accounts_remarks     text;

-- ── 2. Extend the status CHECK constraints ──────────────────────
-- Adds the two new stage values; every previously-valid value stays
-- valid too (never remove values a historical row might already hold).
ALTER TABLE public.ff_vendor_payments   DROP CONSTRAINT IF EXISTS ff_vendor_payments_payment_status_check;
ALTER TABLE public.ff_vendor_payments
  ADD CONSTRAINT ff_vendor_payments_payment_status_check
  CHECK (payment_status IN (
    'pending_ff_ops','pending_gm','pending_l1','pending_auditor','pending_ceo',
    'pending_admin','pending_accounts',
    'approved','paid','rejected'
  ));

ALTER TABLE public.ff_transport_payments DROP CONSTRAINT IF EXISTS ff_transport_payments_payment_status_check;
ALTER TABLE public.ff_transport_payments
  ADD CONSTRAINT ff_transport_payments_payment_status_check
  CHECK (payment_status IN (
    'pending_ff_ops','pending_gm','pending_l1','pending_auditor','pending_ceo',
    'pending_admin','pending_accounts',
    'approved','paid','rejected'
  ));

-- ── 3. Auto-advance every in-flight payment into the new chain ──
-- A payment's status means "waiting on this stage, every prior stage
-- already passed" — so a payment waiting on a now-retired stage moves
-- to whichever new stage comes next after the last stage it actually
-- cleared. pending_ff_ops, pending_l1, pending_ceo, paid and rejected
-- mean the same thing in both chains, so those are left untouched.

-- Cleared Manager + L1, was waiting on GM (retired) → now waits on Admin
UPDATE public.ff_vendor_payments    SET payment_status = 'pending_admin'    WHERE payment_status = 'pending_gm';
UPDATE public.ff_transport_payments SET payment_status = 'pending_admin'    WHERE payment_status = 'pending_gm';

-- Cleared Manager + L1 + GM, was waiting on Auditor (retired) → now waits on CEO
UPDATE public.ff_vendor_payments    SET payment_status = 'pending_ceo'      WHERE payment_status = 'pending_auditor';
UPDATE public.ff_transport_payments SET payment_status = 'pending_ceo'      WHERE payment_status = 'pending_auditor';

-- Fully approved by the old chain, waiting on a manual "mark paid" → now waits on Accounts
UPDATE public.ff_vendor_payments    SET payment_status = 'pending_accounts' WHERE payment_status = 'approved';
UPDATE public.ff_transport_payments SET payment_status = 'pending_accounts' WHERE payment_status = 'approved';

-- ── Verify ───────────────────────────────────────────────────
SELECT 'ff_vendor_payments' AS table_name, payment_status, count(*) FROM public.ff_vendor_payments GROUP BY payment_status
UNION ALL
SELECT 'ff_transport_payments', payment_status, count(*) FROM public.ff_transport_payments GROUP BY payment_status
ORDER BY 1, 2;
