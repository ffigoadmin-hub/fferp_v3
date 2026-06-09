--  PHASE 4 â€” REALTIME PUBLICATIONS
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_call_signals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hourly_criticals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.escalations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_escalations;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
--  PHASE 5 â€” SEED DATA
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- â”€â”€ Hubs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO public.hubs (name, location, city, state, code, is_active) VALUES
  ('Palikarani Hub', 'Palikarani', 'Chennai',   'Tamil Nadu',    'PALI', true),
  ('Vanagaram Hub',  'Vanagaram',  'Chennai',   'Tamil Nadu',    'VANA', true),
  ('Hyderabad Hub',  'Hyderabad',  'Hyderabad', 'Telangana',     'HYD',  true)
ON CONFLICT (name) DO UPDATE
  SET code = EXCLUDED.code, is_active = EXCLUDED.is_active;

UPDATE public.hubs SET display_name = name WHERE display_name IS NULL;

-- â”€â”€ Transport Categories â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ Products (34 grocery items) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO public.products (name, category, unit, grade_a_price, grade_b_price, grade_c_price, is_active)
SELECT name, category, unit, grade_a_price, grade_b_price, grade_c_price, true
FROM (VALUES
  ('Onion',        'Vegetables','KG', 28,  24,  20),
  ('Tomato',       'Vegetables','KG', 45,  38,  30),
  ('Potato',       'Vegetables','KG', 35,  30,  25),
  ('Carrot',       'Vegetables','KG', 40,  34,  28),
  ('Cabbage',      'Vegetables','KG', 22,  18,  14),
  ('Beetroot',     'Vegetables','KG', 30,  26,  20),
  ('Coriander',    'Vegetables','KG', 70,  60,  50),
  ('Drumstick',    'Vegetables','KG', 50,  42,  35),
  ('Beans',        'Vegetables','KG', 60,  52,  44),
  ('Brinjal',      'Vegetables','KG', 32,  28,  22),
  ('Capsicum',     'Vegetables','KG', 55,  48,  40),
  ('Lady Finger',  'Vegetables','KG', 45,  38,  30),
  ('Raw Banana',   'Vegetables','KG', 35,  30,  24),
  ('Bitter Gourd', 'Vegetables','KG', 40,  34,  28),
  ('Green Chilli', 'Vegetables','KG', 60,  50,  40),
  ('Garlic',       'Vegetables','KG',120, 100,  80),
  ('Ginger',       'Vegetables','KG',100,  85,  70),
  ('Spinach',      'Vegetables','KG', 30,  25,  20),
  ('Mango',        'Fruits',    'KG', 80,  65,  50),
  ('Banana',       'Fruits',    'KG', 40,  34,  28),
  ('Apple',        'Fruits',    'KG',150, 120,  90),
  ('Papaya',       'Fruits',    'KG', 35,  28,  22),
  ('Watermelon',   'Fruits',    'KG', 18,  14,  10),
  ('Rice',         'Grains',    'KG', 65,  55,  45),
  ('Wheat',        'Grains',    'KG', 38,  32,  26),
  ('Toor Dal',     'Pulses',    'KG',130, 115, 100),
  ('Moong Dal',    'Pulses',    'KG',120, 105,  90),
  ('Coconut Oil',  'Oils',      'LTR',180,160, 140),
  ('Sunflower Oil','Oils',      'LTR',140,125, 110),
  ('Milk',         'Dairy',     'LTR', 60,  55,  50),
  ('Paneer',       'Dairy',     'KG', 320,290, 260),
  ('Turmeric',     'Spices',    'KG', 140,120, 100),
  ('Red Chilli',   'Spices',    'KG', 180,155, 130),
  ('Cumin',        'Spices',    'KG', 350,300, 250)
) AS v(name, category, unit, grade_a_price, grade_b_price, grade_c_price)
WHERE NOT EXISTS (SELECT 1 FROM public.products LIMIT 1);

-- â”€â”€ Vendors (6 default) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO public.vendors (name, contact_person, phone, city, is_active)
SELECT name, contact_person, phone, city, true
FROM (VALUES
  ('Ravi Farms',          'Ravi Kumar',  '9444111222', 'Chennai'),
  ('AK Traders',          'Arjun K',     '9555222333', 'Chennai'),
  ('Fresh Vendors Co.',   'Suresh M',    '9666333444', 'Chennai'),
  ('Green Valley Agro',   'Priya G',     '9777444555', 'Coimbatore'),
  ('Tamil Nadu Produce',  'Karthik R',   '9888555666', 'Chennai'),
  ('Sri Murugan Traders', 'Murugan S',   '9999666777', 'Chennai')
) AS v(name, contact_person, phone, city)
WHERE NOT EXISTS (SELECT 1 FROM public.vendors LIMIT 1);

-- Final schema reload
NOTIFY pgrst, 'reload schema';

-- ============================================================
--  MASTER SCHEMA V1 â€” COMPLETE
--  Tables: 102  |  Run time: ~15 seconds on blank DB
-- ============================================================


