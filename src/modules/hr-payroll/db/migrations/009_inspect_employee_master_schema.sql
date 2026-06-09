-- Inspect current employee_master schema
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'employee_master' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if table exists at all
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE  table_schema = 'public'
   AND    table_name   = 'employee_master'
) AS table_exists;
