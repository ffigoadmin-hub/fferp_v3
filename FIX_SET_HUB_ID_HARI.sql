-- ============================================================
--  FIX — Set hub_id for Hari's replacement account
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--  Run AFTER importing BULK_IMPORT_HARI_REPLACEMENT.csv and
--  AFTER deleting the old manager.hyd@ffactory.com /
--  manager.pali@ffactory.com duplicate accounts.
--
--  Hyderabad hub_id confirmed as 214f30db-c0cd-432b-85fb-596ce9b58745
--  from the earlier verify query result (Guna's row).
-- ============================================================

UPDATE profiles SET hub_id = '214f30db-c0cd-432b-85fb-596ce9b58745'
WHERE email = 'hari@ffactory.com';

-- ── Verify ───────────────────────────────────────────────────
SELECT name, email, role, hub_id, department, is_active
FROM profiles
WHERE email IN ('hari@ffactory.com', 'arunkarthick@ffactory.com', 'manager.hyd@ffactory.com', 'manager.pali@ffactory.com');
