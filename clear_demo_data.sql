-- ============================================================
-- FFERPv2 — CLEAR ALL DEMO DATA (safe version)
-- Run this in Supabase SQL Editor (bvbfnguqpuctdvfztuda)
-- Skips any table that doesn't exist yet.
-- KEEPS: hubs (your 3 real hubs stay untouched)
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    -- child tables first (FK order)
    'payment_deduction_lines',
    'po_sales_order_links',
    'qc_rejections',
    'qc_inspections',
    'deduction_memos',
    'purchase_order_items',
    'boxes',
    'invoices',
    'sales_order_items',
    'order_returns',
    'b2b_subscriptions',
    'trip_orders',
    'delivery_packs',
    'inventory_log',
    'wastage_entries',
    -- mid-level
    'logistics_trips',
    'transit_records',
    'sales_orders',
    'purchase_orders',
    'vendor_payments',
    -- master / reference data
    'inventory_items',
    'inventory',
    'demand_forecasts',
    'market_rates',
    'sales_targets',
    'customers',
    'vendors',
    'products'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('DELETE FROM %I', tbl);
      RAISE NOTICE 'Cleared: %', tbl;
    ELSE
      RAISE NOTICE 'Skipped (does not exist): %', tbl;
    END IF;
  END LOOP;
END $$;

-- ── Verify: all cleared counts should be 0, hubs should be 3 ──
SELECT tbl, cnt FROM (
  SELECT 'sales_orders'         AS tbl, COUNT(*)::int AS cnt FROM sales_orders
  UNION ALL SELECT 'sales_order_items',    COUNT(*) FROM sales_order_items
  UNION ALL SELECT 'purchase_orders',      COUNT(*) FROM purchase_orders
  UNION ALL SELECT 'purchase_order_items', COUNT(*) FROM purchase_order_items
  UNION ALL SELECT 'invoices',             COUNT(*) FROM invoices
  UNION ALL SELECT 'boxes',                COUNT(*) FROM boxes
  UNION ALL SELECT 'products',             COUNT(*) FROM products
  UNION ALL SELECT 'customers',            COUNT(*) FROM customers
  UNION ALL SELECT 'vendors',              COUNT(*) FROM vendors
  UNION ALL SELECT 'hubs  ← KEEP',        COUNT(*) FROM hubs
) x;
