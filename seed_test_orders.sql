-- =====================================================================
-- FF ERP — Test Data Seed (v5 — clean VALUES approach)
-- Hubs:
--   46a6d58b-854e-4333-b840-80f45acb42d5  Hyderabad Hub  (HYD)
--   b9758168-da7b-4047-ba6d-5a8b43a51b91  Palikarani Hub (PALI)
--   ee223bb8-0daa-4bdd-a887-50bdb0ec3b47  Vanagaram Hub  (VANA)
-- =====================================================================

-- ── Step 1: Orders ────────────────────────────────────────────────────
INSERT INTO sales_orders
  (id, order_number, customer_name, order_date, delivery_date,
   status, hub_id, hub_name, total_amount, net_amount,
   payment_mode, payment_status, channel)
VALUES
  ('aaaaaaaa-0001-0000-0000-000000000001','FF-HYD-0001','Rajesh Enterprises',    '2026-05-27','2026-05-27','confirmed','46a6d58b-854e-4333-b840-80f45acb42d5','Hyderabad Hub', 4250,4250,'upi','paid','b2b'),
  ('aaaaaaaa-0001-0000-0000-000000000002','FF-HYD-0002','Lakshmi Fresh Stores',  '2026-05-27','2026-05-27','pending',  '46a6d58b-854e-4333-b840-80f45acb42d5','Hyderabad Hub', 3100,3100,'cash','pending','retail'),
  ('aaaaaaaa-0001-0000-0000-000000000003','FF-HYD-0003','Sree Venkata Traders',  '2026-05-27','2026-05-27','confirmed','46a6d58b-854e-4333-b840-80f45acb42d5','Hyderabad Hub', 5800,5800,'upi','paid','b2b'),
  ('aaaaaaaa-0001-0000-0000-000000000004','FF-HYD-0004','City Vegetables Mart',  '2026-05-27','2026-05-27','draft',    '46a6d58b-854e-4333-b840-80f45acb42d5','Hyderabad Hub', 2200,2200,'cash','pending','retail'),
  ('bbbbbbbb-0002-0000-0000-000000000001','FF-PALI-0001','Palikarani Traders',   '2026-05-27','2026-05-27','confirmed','b9758168-da7b-4047-ba6d-5a8b43a51b91','Palikarani Hub',5500,5500,'upi','paid','b2b'),
  ('bbbbbbbb-0002-0000-0000-000000000002','FF-PALI-0002','South Chennai Fresh',  '2026-05-27','2026-05-27','pending',  'b9758168-da7b-4047-ba6d-5a8b43a51b91','Palikarani Hub',3800,3800,'cash','pending','retail'),
  ('bbbbbbbb-0002-0000-0000-000000000003','FF-PALI-0003','Velachery Vegmart',    '2026-05-27','2026-05-27','confirmed','b9758168-da7b-4047-ba6d-5a8b43a51b91','Palikarani Hub',7200,7200,'bank','paid','b2b'),
  ('bbbbbbbb-0002-0000-0000-000000000004','FF-PALI-0004','Medavakkam Stores',    '2026-05-27','2026-05-27','draft',    'b9758168-da7b-4047-ba6d-5a8b43a51b91','Palikarani Hub',2600,2600,'upi','pending','retail'),
  ('cccccccc-0003-0000-0000-000000000001','FF-VANA-0001','Vanagaram Wholesale',  '2026-05-27','2026-05-27','confirmed','ee223bb8-0daa-4bdd-a887-50bdb0ec3b47','Vanagaram Hub', 6100,6100,'upi','paid','b2b'),
  ('cccccccc-0003-0000-0000-000000000002','FF-VANA-0002','Ambattur Fresh Mart',  '2026-05-27','2026-05-27','pending',  'ee223bb8-0daa-4bdd-a887-50bdb0ec3b47','Vanagaram Hub', 4200,4200,'cash','pending','retail'),
  ('cccccccc-0003-0000-0000-000000000003','FF-VANA-0003','Mogappair Vegetables', '2026-05-27','2026-05-27','confirmed','ee223bb8-0daa-4bdd-a887-50bdb0ec3b47','Vanagaram Hub', 5300,5300,'upi','paid','b2b'),
  ('cccccccc-0003-0000-0000-000000000004','FF-VANA-0004','Anna Nagar Sabzi',     '2026-05-27','2026-05-27','draft',    'ee223bb8-0daa-4bdd-a887-50bdb0ec3b47','Vanagaram Hub', 3100,3100,'cash','pending','retail')
ON CONFLICT (id) DO NOTHING;


-- ── Step 2: Items (single INSERT SELECT FROM VALUES — no FK issues) ───
INSERT INTO sales_order_items
  (id, order_id, product_id, product_name, qty_kg, quantity, unit, unit_price, total_price)
SELECT
  gen_random_uuid(),
  v.oid::uuid,
  v.pid::uuid,
  v.pname,
  v.qty::numeric,
  v.qty::numeric,
  v.unit,
  v.uprice::numeric,
  v.tprice::numeric
FROM (VALUES
  -- HYD-0001
  ('aaaaaaaa-0001-0000-0000-000000000001','54229b6b-5586-4f72-b136-6774a47bfd1d','Tomato',      '45','KG', '30', '1350'),
  ('aaaaaaaa-0001-0000-0000-000000000001','10f5f942-9e2d-4204-87c8-82d42a29881b','Onion',       '60','KG', '25', '1500'),
  ('aaaaaaaa-0001-0000-0000-000000000001','da17561d-a9ce-406e-b9ac-af06407a3e28','Potato',      '40','KG', '22',  '880'),
  ('aaaaaaaa-0001-0000-0000-000000000001','47bffee9-2562-417a-a01a-aa986f203f15','Carrot',      '20','KG', '26',  '520'),
  -- HYD-0002
  ('aaaaaaaa-0001-0000-0000-000000000002','c8f27603-7b36-4ca1-854e-925cffd899f6','Cabbage',     '35','KG', '18',  '630'),
  ('aaaaaaaa-0001-0000-0000-000000000002','48dc65b6-a9d7-4931-81bb-46c10d3c12e1','Green Chilli','15','KG', '80', '1200'),
  ('aaaaaaaa-0001-0000-0000-000000000002','55234e09-069f-441d-8620-9b45b73b9e66','Ginger',       '8','KG','130', '1040'),
  ('aaaaaaaa-0001-0000-0000-000000000002','da17561d-a9ce-406e-b9ac-af06407a3e28','Potato',      '10','KG', '22',  '220'),
  -- HYD-0003
  ('aaaaaaaa-0001-0000-0000-000000000003','62cd4f34-8f82-46aa-8cbe-9440ff5ee0b9','Rice',        '80','KG', '45', '3600'),
  ('aaaaaaaa-0001-0000-0000-000000000003','10f5f942-9e2d-4204-87c8-82d42a29881b','Onion',       '50','KG', '25', '1250'),
  ('aaaaaaaa-0001-0000-0000-000000000003','54229b6b-5586-4f72-b136-6774a47bfd1d','Tomato',      '30','KG', '30',  '900'),
  ('aaaaaaaa-0001-0000-0000-000000000003','f00c1687-47df-4cb9-a16d-daae4b055ab8','Garlic',       '5','KG','200', '1000'),
  -- HYD-0004
  ('aaaaaaaa-0001-0000-0000-000000000004','edd1d317-45bb-45e9-b721-3fcffb6fec24','Banana',      '30','KG', '35', '1050'),
  ('aaaaaaaa-0001-0000-0000-000000000004','47bffee9-2562-417a-a01a-aa986f203f15','Carrot',      '25','KG', '26',  '650'),
  ('aaaaaaaa-0001-0000-0000-000000000004','a984902f-62b9-450e-901d-485de6f1a3de','Coriander',    '6','KG', '80',  '480'),
  -- PALI-0001
  ('bbbbbbbb-0002-0000-0000-000000000001','54229b6b-5586-4f72-b136-6774a47bfd1d','Tomato',      '80','KG', '30', '2400'),
  ('bbbbbbbb-0002-0000-0000-000000000001','10f5f942-9e2d-4204-87c8-82d42a29881b','Onion',       '70','KG', '25', '1750'),
  ('bbbbbbbb-0002-0000-0000-000000000001','da17561d-a9ce-406e-b9ac-af06407a3e28','Potato',      '60','KG', '22', '1320'),
  ('bbbbbbbb-0002-0000-0000-000000000001','e0bc1ee4-b11c-4337-b559-2b54fae4749a','Beetroot',    '25','KG', '35',  '875'),
  -- PALI-0002
  ('bbbbbbbb-0002-0000-0000-000000000002','76ea85eb-c7e6-445d-980b-c072f90f7af1','Capsicum',    '20','KG', '80', '1600'),
  ('bbbbbbbb-0002-0000-0000-000000000002','48dc65b6-a9d7-4931-81bb-46c10d3c12e1','Green Chilli','12','KG', '80',  '960'),
  ('bbbbbbbb-0002-0000-0000-000000000002','47bffee9-2562-417a-a01a-aa986f203f15','Carrot',      '15','KG', '26',  '390'),
  ('bbbbbbbb-0002-0000-0000-000000000002','c8f27603-7b36-4ca1-854e-925cffd899f6','Cabbage',     '25','KG', '18',  '450'),
  -- PALI-0003
  ('bbbbbbbb-0002-0000-0000-000000000003','62cd4f34-8f82-46aa-8cbe-9440ff5ee0b9','Rice',       '100','KG', '45', '4500'),
  ('bbbbbbbb-0002-0000-0000-000000000003','1803b6c0-a5e1-4e83-a226-873520ce1f9f','Toor Dal',    '40','KG', '90', '3600'),
  ('bbbbbbbb-0002-0000-0000-000000000003','54229b6b-5586-4f72-b136-6774a47bfd1d','Tomato',      '35','KG', '30', '1050'),
  -- PALI-0004
  ('bbbbbbbb-0002-0000-0000-000000000004','55234e09-069f-441d-8620-9b45b73b9e66','Ginger',       '8','KG','130', '1040'),
  ('bbbbbbbb-0002-0000-0000-000000000004','f00c1687-47df-4cb9-a16d-daae4b055ab8','Garlic',      '10','KG','200', '2000'),
  ('bbbbbbbb-0002-0000-0000-000000000004','1cb595b2-f04c-4d14-b023-8497bffaaf68','Cumin',        '4','KG','280', '1120'),
  -- VANA-0001
  ('cccccccc-0003-0000-0000-000000000001','10f5f942-9e2d-4204-87c8-82d42a29881b','Onion',       '90','KG', '25', '2250'),
  ('cccccccc-0003-0000-0000-000000000001','54229b6b-5586-4f72-b136-6774a47bfd1d','Tomato',      '55','KG', '30', '1650'),
  ('cccccccc-0003-0000-0000-000000000001','da17561d-a9ce-406e-b9ac-af06407a3e28','Potato',      '60','KG', '22', '1320'),
  ('cccccccc-0003-0000-0000-000000000001','edd1d317-45bb-45e9-b721-3fcffb6fec24','Banana',       '8','KG', '35',  '280'),
  -- VANA-0002
  ('cccccccc-0003-0000-0000-000000000002','c8f27603-7b36-4ca1-854e-925cffd899f6','Cabbage',     '40','KG', '18',  '720'),
  ('cccccccc-0003-0000-0000-000000000002','48dc65b6-a9d7-4931-81bb-46c10d3c12e1','Green Chilli','18','KG', '80', '1440'),
  ('cccccccc-0003-0000-0000-000000000002','47bffee9-2562-417a-a01a-aa986f203f15','Carrot',      '30','KG', '26',  '780'),
  ('cccccccc-0003-0000-0000-000000000002','76ea85eb-c7e6-445d-980b-c072f90f7af1','Capsicum',    '10','KG', '80',  '800'),
  -- VANA-0003
  ('cccccccc-0003-0000-0000-000000000003','62cd4f34-8f82-46aa-8cbe-9440ff5ee0b9','Rice',        '70','KG', '45', '3150'),
  ('cccccccc-0003-0000-0000-000000000003','24b0f42f-6160-4e05-8486-bafcf4ed7988','Moong Dal',   '20','KG', '90', '1800'),
  ('cccccccc-0003-0000-0000-000000000003','10f5f942-9e2d-4204-87c8-82d42a29881b','Onion',       '40','KG', '25', '1000'),
  -- VANA-0004
  ('cccccccc-0003-0000-0000-000000000004','6cfa68ce-5c41-49e3-91ed-52ee2bb1ca97','Turmeric',     '5','KG','280', '1400'),
  ('cccccccc-0003-0000-0000-000000000004','55234e09-069f-441d-8620-9b45b73b9e66','Ginger',      '10','KG','130', '1300'),
  ('cccccccc-0003-0000-0000-000000000004','f00c1687-47df-4cb9-a16d-daae4b055ab8','Garlic',       '8','KG','200', '1600')
) AS v(oid, pid, pname, qty, unit, uprice, tprice)
WHERE EXISTS (SELECT 1 FROM sales_orders WHERE id = v.oid::uuid);


-- ── Verify ────────────────────────────────────────────────────────────
SELECT
  h.name               AS hub,
  COUNT(DISTINCT o.id) AS orders,
  COUNT(i.id)          AS items,
  SUM(i.qty_kg)        AS total_kg
FROM sales_orders o
JOIN hubs h ON h.id = o.hub_id
JOIN sales_order_items i ON i.order_id = o.id
WHERE o.order_date = '2026-05-27'
GROUP BY h.name
ORDER BY h.name;
