-- Does payment_deduction_lines.payment_id actually have a foreign key
-- constraint to vendor_payments.id? (Table confirmed to exist; this
-- confirms the relationship PostgREST needs to embed it.)
SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS references_table, ccu.column_name AS references_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'payment_deduction_lines';
