-- ============================================================
--  FIX — Set hub_id for the 13 real accounts imported via
--  BULK_IMPORT_REMAINING_13_USERS.csv
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--  Run this AFTER the CSV import succeeds (the bulk importer
--  has no hub column, so this fills the gap).
--
--  field_executive rows (Indu, Meenacthi, Soundarya, Arthi) are
--  intentionally left with no hub_id — Sales Team isn't hub-scoped
--  in this app today. Remove them from the WHERE below if that's wrong.
-- ============================================================

-- Pallikaranai hub_manager
UPDATE profiles SET hub_id = (SELECT id FROM hubs WHERE name ILIKE '%pallikaranai%' AND is_active = true LIMIT 1)
WHERE email = 'arunkarthick@ffactory.com';

-- Vanagaram hub_manager
UPDATE profiles SET hub_id = (SELECT id FROM hubs WHERE name ILIKE '%vanagaram%' AND is_active = true LIMIT 1)
WHERE email IN ('manoj@ffactory.com', 'dhanush@ffactory.com');

-- Hyderabad hub_manager + shift_employee
UPDATE profiles SET hub_id = (SELECT id FROM hubs WHERE name ILIKE '%hyderabad%' AND is_active = true LIMIT 1)
WHERE email IN ('guna@ffactory.com', 'nagaraj@ffactory.com');

-- Chennai group shift_employee (Pallikaranai + Vanagaram coverage — primary
-- hub_id set to Pallikaranai; CHENNAI_GROUP_HUB_IDS in POAssignment.tsx
-- already handles their dual-hub coverage in code, not via this column)
UPDATE profiles SET hub_id = (SELECT id FROM hubs WHERE name ILIKE '%pallikaranai%' AND is_active = true LIMIT 1)
WHERE email IN ('sathish@ffactory.com', 'sujrith@ffactory.com', 'jorome@ffactory.com');

-- Anto — nightshift hub_manager covering both Pallikaranai & Vanagaram;
-- primary hub_id set to Pallikaranai, same dual-hub handling as above.
UPDATE profiles SET hub_id = (SELECT id FROM hubs WHERE name ILIKE '%pallikaranai%' AND is_active = true LIMIT 1)
WHERE email = 'anto@ffactory.com';

-- ── Verify ───────────────────────────────────────────────────
SELECT name, email, role, hub_id, department, is_active
FROM profiles
WHERE email IN (
  'indu@ffactory.com','meenacthi@ffactory.com','soundarya@ffactory.com','arthi@ffactory.com',
  'arunkarthick@ffactory.com','manoj@ffactory.com','dhanush@ffactory.com','guna@ffactory.com',
  'nagaraj@ffactory.com','sathish@ffactory.com','sujrith@ffactory.com','jorome@ffactory.com',
  'anto@ffactory.com'
)
ORDER BY name;
