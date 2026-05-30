-- ============================================================
-- Add code & is_active to hubs, seed the 3 FF hubs
-- ============================================================

ALTER TABLE public.hubs
  ADD COLUMN IF NOT EXISTS code      text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Set short codes for each hub
UPDATE public.hubs SET code = 'PALI' WHERE name = 'Palikarani Hub';
UPDATE public.hubs SET code = 'VANA' WHERE name = 'Vanagaram Hub';
UPDATE public.hubs SET code = 'HYD'  WHERE name = 'Hyderabad Hub';

-- Make sure all three hubs are active
UPDATE public.hubs SET is_active = true
WHERE name IN ('Palikarani Hub', 'Vanagaram Hub', 'Hyderabad Hub');

-- Re-insert if they were somehow missing (idempotent)
INSERT INTO public.hubs (name, location, city, code, is_active) VALUES
  ('Palikarani Hub', 'Palikarani', 'Chennai',   'PALI', true),
  ('Vanagaram Hub',  'Vanagaram',  'Chennai',   'VANA', true),
  ('Hyderabad Hub',  'Hyderabad',  'Hyderabad', 'HYD',  true)
ON CONFLICT (name) DO UPDATE
  SET code      = EXCLUDED.code,
      is_active = EXCLUDED.is_active;
