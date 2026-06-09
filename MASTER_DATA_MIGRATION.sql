-- ============================================================
--  FF ERP — MASTER DATA MIGRATION
--  Copies existing data FROM website (rwasfuhrvqscqnpwqooq)
--  INTO new ERP (bvbfnguqpuctdvfztuda).
--
--  HOW TO RUN:
--  This uses postgres_fdw (Foreign Data Wrapper) to connect
--  directly from the ERP DB to the website DB.
--
--  Run all steps IN ORDER on the NEW ERP database.
--  Generated: 2026-06-01
-- ============================================================


-- ════════════════════════════════════════════════════════════
--  PRE-STEP: Enable postgres_fdw extension
-- ════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS postgres_fdw;


-- ════════════════════════════════════════════════════════════
--  STEP 1 — Connect to Website DB via Foreign Data Wrapper
--  Replace <DB_PASSWORD> with: FFwebsite2026@
-- ════════════════════════════════════════════════════════════

-- Create foreign server pointing at website DB
CREATE SERVER IF NOT EXISTS website_db
  FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (
    host     'db.rwasfuhrvqscqnpwqooq.supabase.co',
    port     '5432',
    dbname   'postgres'
  );

-- Map the current ERP user to the website DB user
CREATE USER MAPPING IF NOT EXISTS FOR CURRENT_USER
  SERVER website_db
  OPTIONS (
    user     'postgres',
    password 'FFwebsite2026@'
  );

-- Import the website's public schema into a local schema
CREATE SCHEMA IF NOT EXISTS website_import;

IMPORT FOREIGN SCHEMA public
  LIMIT TO (orders, profiles, products, delivery_slots, customer_queries, inbox_messages)
  FROM SERVER website_db
  INTO website_import;


-- ════════════════════════════════════════════════════════════
--  STEP 2 — MIGRATE CUSTOMERS
--  website.profiles → ERP.customers
--  Skip if email already exists (avoid duplicates on re-run)
-- ════════════════════════════════════════════════════════════

INSERT INTO public.customers (
  id,
  name,
  email,
  phone,
  address,
  pincode,
  customer_type,
  channel,
  source,
  is_active,
  created_at,
  updated_at
)
SELECT
  wp.id,
  COALESCE(wp.name, wp.email),
  wp.email,
  wp.phone,
  wp.address,
  wp.pincode,
  'individual'                   AS customer_type,
  'website'                      AS channel,
  'website'                      AS source,
  true                           AS is_active,
  wp.created_at,
  wp.updated_at
FROM website_import.profiles wp
WHERE wp.email IS NOT NULL
  AND wp.role = 'customer'
ON CONFLICT (id) DO UPDATE SET
  phone      = EXCLUDED.phone,
  address    = EXCLUDED.address,
  pincode    = EXCLUDED.pincode,
  updated_at = EXCLUDED.updated_at;


-- ════════════════════════════════════════════════════════════
--  STEP 3 — MIGRATE PRODUCTS
--  website.products → ERP.products
--  ERP products use uuid PK; website uses integer PK.
--  We create a mapping table first, then migrate.
-- ════════════════════════════════════════════════════════════

-- Mapping table: website int id → ERP uuid
CREATE TABLE IF NOT EXISTS public._website_product_id_map (
  website_id   integer PRIMARY KEY,
  erp_id       uuid NOT NULL DEFAULT gen_random_uuid()
);

-- Populate mapping for all website products not yet mapped
INSERT INTO public._website_product_id_map (website_id)
SELECT id FROM website_import.products
ON CONFLICT (website_id) DO NOTHING;

-- Now insert products into ERP using the mapped UUIDs
INSERT INTO public.products (
  id,
  name,
  description,
  category,
  unit,
  grade_a_price,
  original_price,
  website_price,
  image_url,
  badge,
  stock_left,
  weight_options,
  is_published,
  is_active,
  created_at,
  updated_at
)
SELECT
  m.erp_id,
  wp.name,
  wp.description,
  COALESCE(wp.category, 'General'),
  COALESCE(wp.unit, 'kg'),
  wp.price,
  wp.original_price,
  wp.price                       AS website_price,
  wp.image,
  wp.badge,
  COALESCE(wp.stock_left, 50),
  wp.weight_options,
  wp.is_active                   AS is_published,
  wp.is_active,
  wp.created_at,
  wp.updated_at
FROM website_import.products wp
JOIN public._website_product_id_map m ON m.website_id = wp.id
ON CONFLICT (id) DO UPDATE SET
  stock_left    = EXCLUDED.stock_left,
  website_price = EXCLUDED.website_price,
  is_published  = EXCLUDED.is_published,
  updated_at    = EXCLUDED.updated_at;


-- ════════════════════════════════════════════════════════════
--  STEP 4 — MIGRATE DELIVERY SLOTS
--  website.delivery_slots → ERP.delivery_slots
-- ════════════════════════════════════════════════════════════

INSERT INTO public.delivery_slots (
  id,
  date,
  slot_type,
  slot_label,
  start_time,
  end_time,
  max_capacity,
  current_usage,
  is_active
)
SELECT
  wds.id,
  wds.date,
  wds.slot_type,
  wds.slot_type                  AS slot_label,
  wds.start_time,
  wds.end_time,
  COALESCE(wds.max_capacity, 20),
  COALESCE(wds.current_usage, 0),
  wds.is_active
FROM website_import.delivery_slots wds
ON CONFLICT (id) DO NOTHING;


-- ════════════════════════════════════════════════════════════
--  STEP 5 — MIGRATE ORDERS
--  website.orders → ERP.sales_orders + sales_order_items
--
--  website.orders.items is a jsonb array like:
--  [{"id": 5, "name": "Tomato", "qty": 2, "price": 40}]
-- ════════════════════════════════════════════════════════════

-- 5a. Insert into sales_orders
INSERT INTO public.sales_orders (
  order_number,
  customer_id,
  customer_name,
  customer_email,
  customer_phone,
  order_date,
  delivery_date,
  status,
  payment_mode,
  payment_status,
  total_amount,
  delivery_address,
  billing_address,
  pincode,
  delivery_slot,
  channel,
  source,
  order_source,
  source_order_id,
  source_db,
  delivered_at,
  created_at,
  updated_at
)
SELECT
  -- Generate ERP order number if not exists
  'WEB-' || wo.id                  AS order_number,
  -- Look up customer by email
  (SELECT id FROM public.customers WHERE email = wo.customer_email LIMIT 1) AS customer_id,
  wo.customer_name,
  wo.customer_email,
  wo.customer_phone,
  wo.delivery_date                 AS order_date,
  wo.delivery_date,
  -- Map website status to ERP status
  CASE wo.status
    WHEN 'Processing'  THEN 'pending'
    WHEN 'Confirmed'   THEN 'confirmed'
    WHEN 'Dispatched'  THEN 'dispatched'
    WHEN 'Delivered'   THEN 'delivered'
    WHEN 'Cancelled'   THEN 'cancelled'
    ELSE 'pending'
  END                              AS status,
  LOWER(COALESCE(wo.payment_method, 'cod')) AS payment_mode,
  CASE WHEN wo.status = 'Delivered' THEN 'paid' ELSE 'unpaid' END AS payment_status,
  wo.amount                        AS total_amount,
  wo.delivery_address,
  wo.billing_address,
  wo.pincode,
  wo.delivery_slot,
  'website'                        AS channel,
  'website'                        AS source,
  'website'                        AS order_source,
  wo.id                            AS source_order_id,
  'rwasfuhrvqscqnpwqooq'           AS source_db,
  wo.delivered_at,
  wo.created_at,
  wo.updated_at
FROM website_import.orders wo
WHERE wo.customer_email IS NOT NULL
ON CONFLICT (order_number) DO UPDATE SET
  status     = EXCLUDED.status,
  updated_at = EXCLUDED.updated_at;


-- 5b. Insert sales_order_items from jsonb items array
-- website items format: [{"id":5,"name":"Tomato","qty":2,"price":40,"unit":"kg"}]
INSERT INTO public.sales_order_items (
  order_id,
  product_id,
  product_name,
  quantity,
  unit,
  unit_price,
  total_price
)
SELECT
  so.id                            AS order_id,
  m.erp_id                         AS product_id,
  item->>'name'                    AS product_name,
  (item->>'qty')::numeric          AS quantity,
  COALESCE(item->>'unit', 'kg')    AS unit,
  (item->>'price')::numeric        AS unit_price,
  (item->>'qty')::numeric * (item->>'price')::numeric AS total_price
FROM website_import.orders wo
JOIN public.sales_orders so
  ON so.source_order_id = wo.id AND so.source_db = 'rwasfuhrvqscqnpwqooq'
CROSS JOIN LATERAL jsonb_array_elements(wo.items) AS item
LEFT JOIN public._website_product_id_map m
  ON m.website_id = (item->>'id')::integer
WHERE wo.items IS NOT NULL
  AND jsonb_typeof(wo.items) = 'array';


-- ════════════════════════════════════════════════════════════
--  STEP 6 — MIGRATE CUSTOMER QUERIES (support tickets)
-- ════════════════════════════════════════════════════════════

INSERT INTO public.customer_queries (
  id,
  customer_id,
  customer_email,
  subject,
  message,
  status,
  admin_reply,
  channel,
  source_db,
  created_at,
  updated_at
)
SELECT
  wq.id,
  (SELECT id FROM public.customers WHERE email = wq.customer_email LIMIT 1),
  wq.customer_email,
  wq.subject,
  wq.message,
  CASE wq.status
    WHEN 'open'     THEN 'open'
    WHEN 'resolved' THEN 'resolved'
    ELSE 'open'
  END,
  wq.admin_reply,
  'website',
  'rwasfuhrvqscqnpwqooq',
  wq.created_at,
  wq.updated_at
FROM website_import.customer_queries wq
ON CONFLICT (id) DO NOTHING;


-- ════════════════════════════════════════════════════════════
--  STEP 7 — MIGRATE INBOX MESSAGES → customer_notifications
-- ════════════════════════════════════════════════════════════

INSERT INTO public.customer_notifications (
  id,
  customer_id,
  customer_email,
  title,
  message,
  type,
  is_read,
  channel,
  created_at
)
SELECT
  wm.id,
  (SELECT id FROM public.customers WHERE email = wm.customer_email LIMIT 1),
  wm.customer_email,
  wm.title,
  wm.message,
  COALESCE(wm.type, 'order_update'),
  wm.is_read,
  'website',
  wm.created_at
FROM website_import.inbox_messages wm
ON CONFLICT (id) DO NOTHING;


-- ════════════════════════════════════════════════════════════
--  STEP 8 — VERIFICATION QUERIES
--  Run these after migration to confirm counts match.
-- ════════════════════════════════════════════════════════════

-- Compare counts
SELECT 'customers_migrated'   AS check_name, COUNT(*) AS erp_count FROM public.customers WHERE source = 'website'
UNION ALL
SELECT 'orders_migrated',   COUNT(*) FROM public.sales_orders WHERE source_db = 'rwasfuhrvqscqnpwqooq'
UNION ALL
SELECT 'products_migrated', COUNT(*) FROM public.products WHERE is_published = true
UNION ALL
SELECT 'queries_migrated',  COUNT(*) FROM public.customer_queries WHERE source_db = 'rwasfuhrvqscqnpwqooq'
UNION ALL
SELECT 'notifs_migrated',   COUNT(*) FROM public.customer_notifications WHERE channel = 'website';


-- ════════════════════════════════════════════════════════════
--  CLEANUP (optional — run after confirming migration worked)
-- ════════════════════════════════════════════════════════════
-- DROP SCHEMA website_import CASCADE;
-- DROP SERVER website_db CASCADE;
-- DROP TABLE public._website_product_id_map;

-- ════════════════════════════════════════════════════════════
--  DONE — Data migration complete.
--  Next: Update website .env to point at ERP DB.
-- ════════════════════════════════════════════════════════════
