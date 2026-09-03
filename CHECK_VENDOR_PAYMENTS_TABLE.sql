-- ============================================================
--  Does the (older, separate) `vendor_payments` table backing
--  /purchase/payment-approvals have any rows at all, and if so
--  what statuses are they in?
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
-- ============================================================
SELECT status, count(*)
FROM public.vendor_payments
GROUP BY status
ORDER BY status;

-- If that returns zero rows total, nothing has ever been submitted
-- through this queue's "New Payment" button — "No payments found" is
-- correct, not a bug. If it shows rows at pending_admin that aren't
-- appearing on screen, that's a real bug (RLS or query) to chase next.
