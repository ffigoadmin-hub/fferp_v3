SELECT n.nspname AS schema, p.proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname IN ('schedule', 'unschedule')
ORDER BY n.nspname, p.proname;
