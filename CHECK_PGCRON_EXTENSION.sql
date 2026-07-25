-- Is pg_cron already installed (in any schema)?
SELECT extname, extnamespace::regnamespace AS schema
FROM pg_extension
WHERE extname = 'pg_cron';

-- Is it available to install on this project at all?
SELECT name, default_version, installed_version
FROM pg_available_extensions
WHERE name = 'pg_cron';
