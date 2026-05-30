-- ============================================================
--  FF ERP — Fix all missing columns causing PostgREST 400 errors
--  Migration: 20260525_fix_missing_columns.sql
-- ============================================================

-- ── 1. sales_order_items: qty_kg (generated alias of quantity) ────────────────
--  Code across EODPOEngine, SalesInvoicesPage etc. uses qty_kg.
--  Adding as a generated column keeps it in sync with quantity automatically.
ALTER TABLE public.sales_order_items
  ADD COLUMN IF NOT EXISTS qty_kg numeric GENERATED ALWAYS AS (quantity) STORED;

-- ── 2. inventory: current_stock, max_stock_level, min_stock_level ─────────────
--  InventoryDashboard, WarehouseDashboard, Reports pages all reference these.
--  current_stock mirrors quantity via generated column.
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS current_stock  numeric GENERATED ALWAYS AS (quantity) STORED,
  ADD COLUMN IF NOT EXISTS max_stock_level numeric DEFAULT 500,
  ADD COLUMN IF NOT EXISTS min_stock_level numeric DEFAULT 50;

-- ── 3. hubs: display_name ─────────────────────────────────────────────────────
--  InventoryDashboard selects display_name; falls back to name in UI.
--  Adding the column and seeding it from name so both work.
ALTER TABLE public.hubs
  ADD COLUMN IF NOT EXISTS display_name text;
UPDATE public.hubs SET display_name = name WHERE display_name IS NULL;

-- ── 4. products: min_order_kg ─────────────────────────────────────────────────
--  InventoryDashboard join-selects this column; missing column breaks entire query.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS min_order_kg numeric DEFAULT 0;

-- ── 5. RLS on boxes ───────────────────────────────────────────────────────────
ALTER TABLE public.boxes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all_boxes" ON public.boxes;
CREATE POLICY "authenticated_all_boxes" ON public.boxes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 6. RLS on delivery_packs ──────────────────────────────────────────────────
ALTER TABLE public.delivery_packs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all_delivery_packs" ON public.delivery_packs;
CREATE POLICY "authenticated_all_delivery_packs" ON public.delivery_packs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 7. RLS on inventory_log ───────────────────────────────────────────────────
ALTER TABLE public.inventory_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all_inventory_log" ON public.inventory_log;
CREATE POLICY "authenticated_all_inventory_log" ON public.inventory_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
