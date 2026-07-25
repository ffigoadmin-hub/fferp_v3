CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA cron;

-- Verify it's now installed
SELECT extname, extnamespace::regnamespace AS schema
FROM pg_extension
WHERE extname = 'pg_cron';
