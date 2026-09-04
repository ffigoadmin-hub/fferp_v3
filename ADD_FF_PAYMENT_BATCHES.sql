-- ============================================================
--  Accounts Execution Desk — batch creation for bulk vendor payouts
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  A "batch" groups several ff_vendor_payments (all sitting at
--  pending_accounts) that Accounts wants to pay together in one Kotak
--  bulk-transfer file. The batch tracks its own lifecycle
--  (created -> verified -> processed) separately from each payment's
--  own payment_status, which only flips to 'paid' once the batch is
--  marked Processed (after the bank statement's UTRs are matched in).
--
--  Additive only — new table + nullable FK columns, nothing existing
--  is altered or removed.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ff_payment_batches (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_ref                text UNIQUE NOT NULL,
  payment_type             text NOT NULL DEFAULT 'vendor' CHECK (payment_type IN ('vendor', 'transport')),
  status                   text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'verified', 'processed')),
  total_amount             numeric(14,2) NOT NULL DEFAULT 0,
  payment_count            integer NOT NULL DEFAULT 0,
  kotak_file_generated_at  timestamptz,
  statement_uploaded_at    timestamptz,
  processed_at             timestamptz,
  processed_by             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by               uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ff_vendor_payments
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.ff_payment_batches(id) ON DELETE SET NULL;

ALTER TABLE public.ff_transport_payments
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.ff_payment_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ff_vendor_payments_batch    ON public.ff_vendor_payments(batch_id);
CREATE INDEX IF NOT EXISTS idx_ff_transport_payments_batch ON public.ff_transport_payments(batch_id);

-- ── RLS — same role set as the rest of the FF payment chain ──────
ALTER TABLE public.ff_payment_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ff_payment_batches_access ON public.ff_payment_batches;
CREATE POLICY ff_payment_batches_access ON public.ff_payment_batches
  FOR ALL USING (public.is_ff_payment_approver()) WITH CHECK (public.is_ff_payment_approver());

-- ── Verify ───────────────────────────────────────────────────
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'ff_payment_batches'
ORDER BY ordinal_position;
