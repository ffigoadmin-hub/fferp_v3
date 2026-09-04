-- ============================================================
--  Step 1: list every batch so you can identify the accidental one
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
-- ============================================================
SELECT id, batch_ref, status, total_amount, payment_count, created_at
FROM public.ff_payment_batches
ORDER BY created_at DESC;

-- ============================================================
--  Step 2: revoke it — safe as long as its status is 'created' or
--  'verified' (NOT 'processed' — a processed batch already marked its
--  payments paid, which is a different, bigger thing to undo).
--
--  Replace 'PASTE_BATCH_REF_HERE' below with the batch_ref from step 1,
--  then run this block. It unlinks the payments back to the Batch
--  Creation pool (their payment_status stays pending_accounts,
--  untouched) and deletes the batch row.
-- ============================================================
-- UPDATE public.ff_vendor_payments SET batch_id = NULL
-- WHERE batch_id = (SELECT id FROM public.ff_payment_batches WHERE batch_ref = 'PASTE_BATCH_REF_HERE');
--
-- DELETE FROM public.ff_payment_batches WHERE batch_ref = 'PASTE_BATCH_REF_HERE';
