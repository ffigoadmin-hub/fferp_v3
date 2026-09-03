-- ============================================================
--  Does payment_deduction_lines actually exist as a live table,
--  and does it have real rows? (It's in the SQL migration files but
--  that hasn't been reliable for this project — confirming before
--  wiring it back into the Payment Approval Queue's deduction
--  breakdown display.)
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
-- ============================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'payment_deduction_lines'
ORDER BY ordinal_position;

-- If that returns rows, also run this to see if it's actually used:
-- SELECT count(*) FROM public.payment_deduction_lines;
