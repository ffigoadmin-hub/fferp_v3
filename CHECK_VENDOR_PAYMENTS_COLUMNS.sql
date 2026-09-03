-- ============================================================
--  Definitive live column list for vendor_payments — this table has
--  two conflicting definitions across this repo's migration history
--  (different column sets entirely), so guessing from the SQL files
--  isn't safe here. Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
-- ============================================================
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'vendor_payments'
ORDER BY ordinal_position;
