-- ============================================================
--  FFERPv2 — MASTER SEED V1
--  Run AFTER MASTER_SCHEMA_V1.sql on a fresh database.
--  Creates one admin user placeholder + all reference data.
--  Safe to re-run (all inserts use ON CONFLICT DO NOTHING).
-- ============================================================

-- ── Rental Categories ────────────────────────────────────────
INSERT INTO public.rental_categories (name, status) VALUES
  ('Office Space',    'Active'),
  ('Warehouse',       'Active'),
  ('Cold Storage',    'Active'),
  ('Farm Land',       'Active'),
  ('JV Polyhouse',    'Active'),
  ('Retail Outlet',   'Active'),
  ('Staff Housing',   'Active')
ON CONFLICT (name) DO NOTHING;

-- ── Market Reference Data (sample rates) ─────────────────────
-- Rates are updated daily by the purchase team; these are opening seeds.
INSERT INTO public.market_rates (product_name, market, rate, grade, date)
SELECT product_name, market, rate, grade, CURRENT_DATE
FROM (VALUES
  ('Onion',   'Koyambedu', 26.00, 'A'),
  ('Tomato',  'Koyambedu', 42.00, 'A'),
  ('Potato',  'Koyambedu', 32.00, 'A'),
  ('Onion',   'Koyambedu', 22.00, 'B'),
  ('Tomato',  'Koyambedu', 36.00, 'B')
) AS v(product_name, market, rate, grade)
WHERE NOT EXISTS (SELECT 1 FROM public.market_rates LIMIT 1);

-- ── Hubs (already in MASTER_SCHEMA but idempotent here) ──────
INSERT INTO public.hubs (name, location, city, state, code, is_active) VALUES
  ('Palikarani Hub', 'Palikarani', 'Chennai',   'Tamil Nadu', 'PALI', true),
  ('Vanagaram Hub',  'Vanagaram',  'Chennai',   'Tamil Nadu', 'VANA', true),
  ('Hyderabad Hub',  'Hyderabad',  'Hyderabad', 'Telangana',  'HYD',  true)
ON CONFLICT (name) DO NOTHING;

-- ── Transport Category Colors (ensure all present) ───────────
INSERT INTO public.transport_categories (category_code, category_name, color_code) VALUES
  ('ff',          'Farmers Factory', '#22c55e'),
  ('blinkit',     'Blinkit',         '#ff6b6b'),
  ('zepto',       'Zepto',           '#8b5cf6'),
  ('dmart',       'D-Mart',          '#3b82f6'),
  ('bigbasket',   'BigBasket',       '#f59e0b'),
  ('farm_harvest','Farm Harvest',    '#10b981'),
  ('office_work', 'Office Work',     '#6366f1'),
  ('other',       'Other',           '#6b7280')
ON CONFLICT (category_code) DO NOTHING;

-- ── ⚠️  ADMIN USER SETUP INSTRUCTIONS ────────────────────────
-- After running this seed, create your admin user via the
-- Supabase Dashboard → Authentication → Add User, then run:
--
--   INSERT INTO public.profiles (
--     id, email, name, role, department,
--     is_active, account_activated, onboarding_completed
--   ) VALUES (
--     '<paste-user-uuid-from-auth>',
--     'admin@yourcompany.com',
--     'System Admin',
--     'admin',
--     'Management',
--     true, true, true
--   );
--
-- Replace <paste-user-uuid-from-auth> with the UUID shown
-- in Supabase Dashboard → Authentication → Users.
-- ============================================================

NOTIFY pgrst, 'reload schema';
