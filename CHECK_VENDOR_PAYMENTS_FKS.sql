-- ============================================================
--  Does vendor_payments actually have foreign key CONSTRAINTS on
--  vendor_id, po_id, and created_by? The columns exist (confirmed),
--  but PostgREST's `table:related(...)` embed syntax needs a real FK
--  constraint to know how to join — a same-named uuid column with no
--  constraint isn't enough, and this table's column list looks like
--  columns were bolted on over time without one.
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
-- ============================================================
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name  AS references_table,
  ccu.column_name AS references_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'vendor_payments';
