-- Is RLS actually enabled on hubs right now, and how many rows exist?
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname = 'hubs';

SELECT count(*) AS total_hubs, count(*) FILTER (WHERE is_active) AS active_hubs
FROM public.hubs;

-- What policies (if any) currently exist on it, and which roles do they cover?
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'hubs';

-- Confirm the exact columns the app selects (id, name, location, city) actually exist.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'hubs'
ORDER BY ordinal_position;
