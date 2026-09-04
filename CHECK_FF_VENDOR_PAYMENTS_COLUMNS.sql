-- Definitive live column list for ff_vendor_payments — same drift risk
-- as every other table this session, confirming before guessing again.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'ff_vendor_payments'
ORDER BY ordinal_position;
