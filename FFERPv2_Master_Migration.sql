-- ============================================================
-- FFERPv2 MASTER SCHEMA MIGRATION (v2 — uuid fixed)
-- Target: ERP Supabase (bvbfnguqpuctdvfztuda)
-- Run date: 2026-05-23
-- ============================================================

-- ── STEP 1: EXTEND EXISTING TABLES ───────────────────────────

ALTER TABLE hubs
  ADD COLUMN IF NOT EXISTS lat float8,
  ADD COLUMN IF NOT EXISTS lng float8,
  ADD COLUMN IF NOT EXISTS radius_km integer DEFAULT 50,
  ADD COLUMN IF NOT EXISTS pincode text,
  ADD COLUMN IF NOT EXISTS capacity_kg numeric;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS lat float8,
  ADD COLUMN IF NOT EXISTS lng float8,
  ADD COLUMN IF NOT EXISTS whatsapp_id text,
  ADD COLUMN IF NOT EXISTS loyalty_points integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS is_b2c boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS referred_by text;

ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS hub_id uuid REFERENCES hubs(id),
  ADD COLUMN IF NOT EXISTS min_threshold numeric DEFAULT 0;

ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS channel text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS address_id uuid,
  ADD COLUMN IF NOT EXISTS razorpay_order_id text,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id text,
  ADD COLUMN IF NOT EXISTS delivery_fee numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_id uuid,
  ADD COLUMN IF NOT EXISTS lat float8,
  ADD COLUMN IF NOT EXISTS lng float8,
  ADD COLUMN IF NOT EXISTS whatsapp_message_id text;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS category_id uuid,
  ADD COLUMN IF NOT EXISTS brand_id uuid,
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS mrp numeric,
  ADD COLUMN IF NOT EXISTS stock integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS image_urls jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS in_stock boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS average_rating numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_count integer DEFAULT 0;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS link text,
  ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;

-- ── STEP 2: CREATE WEBSITE TABLES ────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  slug             text NOT NULL UNIQUE,
  description      text,
  image_url        text NOT NULL DEFAULT '',
  icon_url         text,
  parent_id        uuid REFERENCES categories(id),
  sort_order       integer DEFAULT 0,
  is_active        boolean DEFAULT true,
  meta_title       text,
  meta_description text,
  og_image_url     text,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brands (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text NOT NULL UNIQUE,
  logo_url   text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS addresses (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  label      text,
  line1      text,
  line2      text,
  landmark   text,
  city       text,
  state      text,
  pincode    text,
  lat        float8,
  lng        float8,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cart (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity   integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS banners (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text,
  subtitle      text,
  media_url     text,
  media_type    text DEFAULT 'image',
  cta_text      text,
  cta_link      text,
  display_order integer DEFAULT 0,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  user_name   text,
  rating      integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     text,
  is_verified boolean DEFAULT false,
  likes       integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coupons (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  text NOT NULL UNIQUE,
  discount_type         text NOT NULL CHECK (discount_type IN ('percentage','fixed')),
  discount_value        numeric NOT NULL,
  min_spend             numeric DEFAULT 0,
  expiry_date           timestamptz,
  is_active             boolean DEFAULT true,
  applicable_product_id uuid REFERENCES products(id),
  created_at            timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_settings (
  key   text PRIMARY KEY,
  value text
);

CREATE TABLE IF NOT EXISTS farmers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  location   text,
  bio        text,
  image_url  text,
  verified   boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS farm_stories (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id     uuid REFERENCES farmers(id),
  farmer        text,
  title         text,
  image_url     text,
  video_url     text,
  is_live       boolean DEFAULT false,
  display_order integer DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS farm_streams (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text,
  location      text,
  video_url     text,
  thumbnail_url text,
  temp          text,
  humidity      text,
  wind          text,
  viewers       integer DEFAULT 0,
  is_active     boolean DEFAULT false,
  display_order integer DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS harvest_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id    uuid REFERENCES farmers(id),
  farmer_name  text,
  product_name text,
  location     text,
  quantity     text,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wishlist (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- ── STEP 3: NEW ERP OPERATION TABLES ─────────────────────────

CREATE TABLE IF NOT EXISTS boxes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  box_code    text NOT NULL UNIQUE,
  po_item_id  uuid REFERENCES purchase_order_items(id),
  product_id  uuid REFERENCES products(id),
  hub_id      uuid REFERENCES hubs(id),
  weight_kg   numeric,
  qr_url      text,
  barcode_url text,
  status      text DEFAULT 'created'
    CHECK (status IN ('created','received','qc_passed','qc_failed','packed','dispatched','delivered','wasted')),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS delivery_packs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_code     text NOT NULL UNIQUE,
  hub_id        uuid REFERENCES hubs(id),
  driver_id     uuid REFERENCES profiles(id),
  route_date    date NOT NULL,
  status        text DEFAULT 'packing'
    CHECK (status IN ('packing','ready','dispatched','delivered','partial_delivered')),
  dispatched_at timestamptz,
  delivered_at  timestamptz,
  notes         text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS delivery_pack_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id    uuid NOT NULL REFERENCES delivery_packs(id) ON DELETE CASCADE,
  box_id     uuid NOT NULL REFERENCES boxes(id),
  order_id   uuid REFERENCES sales_orders(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(pack_id, box_id)
);

CREATE TABLE IF NOT EXISTS inventory_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id uuid REFERENCES inventory(id),
  hub_id       uuid REFERENCES hubs(id),
  product_id   uuid REFERENCES products(id),
  event_type   text NOT NULL
    CHECK (event_type IN ('receive','dispatch','wastage','qc_reject','return','adjustment')),
  qty_delta    numeric NOT NULL,
  ref_id       text,
  ref_type     text CHECK (ref_type IN ('box','pack','order','adjustment')),
  notes        text,
  created_by   uuid REFERENCES profiles(id),
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wastage_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id     uuid REFERENCES boxes(id),
  hub_id     uuid REFERENCES hubs(id),
  product_id uuid REFERENCES products(id),
  reason     text NOT NULL
    CHECK (reason IN ('damaged','expired','contaminated','qc_fail','other')),
  weight_kg  numeric NOT NULL,
  photo_url  text,
  logged_by  uuid REFERENCES profiles(id),
  logged_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS po_bills (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number        text NOT NULL UNIQUE,
  po_id              uuid NOT NULL REFERENCES purchase_orders(id),
  amount             numeric NOT NULL,
  bill_date          date NOT NULL DEFAULT CURRENT_DATE,
  vendor_invoice_ref text,
  approval_tier      text NOT NULL DEFAULT 'gm_only'
    CHECK (approval_tier IN ('gm_only','gm_admin','gm_admin_ceo')),
  gm_status          text DEFAULT 'pending' CHECK (gm_status IN ('pending','approved','rejected')),
  gm_approved_by     uuid REFERENCES profiles(id),
  gm_approved_at     timestamptz,
  gm_comment         text,
  admin_status       text DEFAULT 'not_required' CHECK (admin_status IN ('pending','approved','rejected','not_required')),
  admin_approved_by  uuid REFERENCES profiles(id),
  admin_approved_at  timestamptz,
  admin_comment      text,
  ceo_status         text DEFAULT 'not_required' CHECK (ceo_status IN ('pending','approved','rejected','not_required')),
  ceo_approved_by    uuid REFERENCES profiles(id),
  ceo_approved_at    timestamptz,
  ceo_comment        text,
  vendor_paid        boolean DEFAULT false,
  vendor_paid_at     timestamptz,
  payment_ref        text,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

-- ── STEP 4: INDEXES ──────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sales_orders_channel    ON sales_orders(channel);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status     ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_created_at ON sales_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_hub_id        ON inventory(hub_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product_id    ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_log_hub_id    ON inventory_log(hub_id);
CREATE INDEX IF NOT EXISTS idx_inventory_log_event     ON inventory_log(event_type);
CREATE INDEX IF NOT EXISTS idx_inventory_log_created   ON inventory_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_boxes_hub_id            ON boxes(hub_id);
CREATE INDEX IF NOT EXISTS idx_boxes_status            ON boxes(status);
CREATE INDEX IF NOT EXISTS idx_boxes_box_code          ON boxes(box_code);
CREATE INDEX IF NOT EXISTS idx_delivery_packs_hub_id   ON delivery_packs(hub_id);
CREATE INDEX IF NOT EXISTS idx_delivery_packs_date     ON delivery_packs(route_date DESC);
CREATE INDEX IF NOT EXISTS idx_addresses_user_id       ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_user_id            ON cart(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_user_id        ON wishlist(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product_id      ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_po_bills_po_id          ON po_bills(po_id);
CREATE INDEX IF NOT EXISTS idx_hubs_is_active          ON hubs(is_active);

-- ── STEP 5: BILL APPROVAL TIER TRIGGER ───────────────────────

CREATE OR REPLACE FUNCTION set_bill_approval_tier()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.amount < 10000 THEN
    NEW.approval_tier := 'gm_only';
    NEW.admin_status  := 'not_required';
    NEW.ceo_status    := 'not_required';
  ELSIF NEW.amount < 50000 THEN
    NEW.approval_tier := 'gm_admin';
    NEW.ceo_status    := 'not_required';
  ELSE
    NEW.approval_tier := 'gm_admin_ceo';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bill_approval_tier_trigger ON po_bills;
CREATE TRIGGER bill_approval_tier_trigger
  BEFORE INSERT ON po_bills
  FOR EACH ROW EXECUTE FUNCTION set_bill_approval_tier();

-- ── STEP 6: INVENTORY AUTO-UPDATE TRIGGER ────────────────────

ALTER TABLE inventory
  DROP CONSTRAINT IF EXISTS inventory_hub_product_unique;
ALTER TABLE inventory
  ADD CONSTRAINT inventory_hub_product_unique UNIQUE (hub_id, product_id);

CREATE OR REPLACE FUNCTION update_inventory_on_log()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO inventory (hub_id, product_id, quantity, updated_at)
  VALUES (NEW.hub_id, NEW.product_id, NEW.qty_delta, now())
  ON CONFLICT ON CONSTRAINT inventory_hub_product_unique
  DO UPDATE SET
    quantity   = inventory.quantity + NEW.qty_delta,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS inventory_log_update_trigger ON inventory_log;
CREATE TRIGGER inventory_log_update_trigger
  AFTER INSERT ON inventory_log
  FOR EACH ROW EXECUTE FUNCTION update_inventory_on_log();

-- ── DONE ─────────────────────────────────────────────────────
SELECT 'FFERPv2 Migration complete — ' || count(*) || ' tables in public schema' as status
FROM information_schema.tables WHERE table_schema = 'public';
