-- ============================================================
--  FIX — EOD PO Engine double-insert bug
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  run_eod_po_engine() (EOD_PO_ENGINE.sql) inserts into
--  purchase_order_items with `ON CONFLICT DO NOTHING` but NO conflict
--  target — Postgres only suppresses an insert when a matching
--  unique/exclusion constraint actually exists. purchase_order_items
--  only has a PRIMARY KEY on `id`, so this clause is currently a
--  silent no-op: re-running the engine for the same date (a manual
--  re-run, a duplicate trigger, anyone re-clicking "Run" to be sure)
--  inserts a SECOND line item for the same po_id + product_id,
--  doubling total_estimated/items_count and instructing the hub to
--  buy double the real shortfall.
--
--  This adds the missing unique constraint AND updates the engine's
--  ON CONFLICT clause to actually target it, so a re-run for the same
--  date becomes a true no-op like it was always meant to be.
-- ============================================================

-- ── STEP 0: Check for existing duplicates first ──────────────────────
-- If this returns any rows, the bug has already produced duplicates in
-- production — DO NOT proceed to STEP 1 until these are reviewed and
-- resolved (see STEP 0b for a safe merge), or the ADD CONSTRAINT below
-- will fail with a "could not create unique index" error.
SELECT po_id, product_id, COUNT(*) AS dup_count, SUM(required_qty) AS total_required_qty_across_dupes
FROM purchase_order_items
WHERE product_id IS NOT NULL
GROUP BY po_id, product_id
HAVING COUNT(*) > 1;

-- ── STEP 0b (only if STEP 0 found rows): merge duplicates safely ─────
-- Keeps the earliest row per (po_id, product_id), sums the quantities
-- into it, deletes the rest. Review the STEP 0 output first — this is
-- commented out on purpose, uncomment only after you've confirmed this
-- is the right resolution (e.g. not a case where two genuinely
-- different real orders should stay separate for some other reason).
--
-- WITH ranked AS (
--   SELECT id, po_id, product_id, required_qty,
--          ROW_NUMBER() OVER (PARTITION BY po_id, product_id ORDER BY id) AS rn
--   FROM purchase_order_items
--   WHERE product_id IS NOT NULL
-- ),
-- totals AS (
--   SELECT po_id, product_id, SUM(required_qty) AS summed_qty
--   FROM purchase_order_items
--   WHERE product_id IS NOT NULL
--   GROUP BY po_id, product_id
--   HAVING COUNT(*) > 1
-- )
-- UPDATE purchase_order_items poi
-- SET required_qty = t.summed_qty, ordered_qty = t.summed_qty, quantity = t.summed_qty,
--     total_price = ROUND((t.summed_qty * poi.estimated_price)::NUMERIC, 2)
-- FROM ranked r, totals t
-- WHERE poi.id = r.id AND r.rn = 1 AND r.po_id = t.po_id AND r.product_id = t.product_id;
--
-- DELETE FROM purchase_order_items poi
-- USING ranked r
-- WHERE poi.id = r.id AND r.rn > 1;

-- ── STEP 1: Add the missing unique constraint ─────────────────────────
ALTER TABLE purchase_order_items
  ADD CONSTRAINT purchase_order_items_po_product_uniq UNIQUE (po_id, product_id);

-- ── STEP 2: Fix the engine to actually target that constraint ────────
CREATE OR REPLACE FUNCTION public.run_eod_po_engine(p_date date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_po_id            UUID;
  v_po_item_id       UUID;
  v_po_count         INT := 0;
  v_item_count       INT := 0;
  r                  RECORD;
BEGIN
  FOR r IN
    SELECT
      so.hub_id,
      h.name                                         AS hub_name,
      soi.product_id,
      COALESCE(p.name, soi.product_name, 'Unknown')  AS product_name,
      COALESCE(p.unit, soi.unit, 'kg')               AS unit,
      SUM(COALESCE(soi.qty_kg, soi.quantity, 0))     AS total_required,
      COALESCE(MAX(inv.quantity), 0)                 AS current_stock,
      GREATEST(0,
        SUM(COALESCE(soi.qty_kg, soi.quantity, 0)) - COALESCE(MAX(inv.quantity), 0)
      )                                              AS shortfall,
      COALESCE(AVG(NULLIF(soi.unit_price, 0)), 0)   AS avg_price
    FROM sales_orders so
    JOIN  sales_order_items soi ON soi.order_id = so.id
    LEFT JOIN products      p   ON p.id  = soi.product_id
    LEFT JOIN hubs          h   ON h.id  = so.hub_id
    LEFT JOIN inventory     inv ON inv.hub_id = so.hub_id
                                AND inv.product_id = soi.product_id
    WHERE so.order_date = p_date
      AND UPPER(so.status) NOT IN ('CANCELLED')
      AND so.hub_id IS NOT NULL
    GROUP BY so.hub_id, h.name, soi.product_id, p.name, p.unit, soi.product_name, soi.unit
    HAVING GREATEST(0,
      SUM(COALESCE(soi.qty_kg, soi.quantity, 0)) - COALESCE(MAX(inv.quantity), 0)
    ) > 0
    ORDER BY so.hub_id, p.name
  LOOP
    SELECT id INTO v_po_id FROM purchase_orders
    WHERE hub_id = r.hub_id AND eod_date = p_date AND status = 'pending' LIMIT 1;

    IF v_po_id IS NULL THEN
      INSERT INTO purchase_orders (hub_id, hub_name, eod_date, status, total_estimated, total_amount, order_date)
      VALUES (r.hub_id, r.hub_name, p_date, 'pending', 0, 0, p_date)
      RETURNING id INTO v_po_id;
      v_po_count := v_po_count + 1;
    END IF;

    INSERT INTO purchase_order_items (
      po_id, product_id, product_name, hub_id,
      required_qty, ordered_qty, quantity, unit,
      estimated_price, unit_price, total_price, item_name, status
    ) VALUES (
      v_po_id, r.product_id, r.product_name, r.hub_id,
      r.shortfall, r.shortfall, r.shortfall, r.unit,
      r.avg_price, r.avg_price,
      ROUND((r.shortfall * r.avg_price)::NUMERIC, 2),
      r.product_name, 'pending'
    )
    ON CONFLICT ON CONSTRAINT purchase_order_items_po_product_uniq DO NOTHING
    RETURNING id INTO v_po_item_id;

    IF v_po_item_id IS NOT NULL THEN
      v_item_count := v_item_count + 1;
    END IF;
  END LOOP;

  UPDATE purchase_orders po SET
    total_estimated = COALESCE((SELECT SUM(required_qty * estimated_price) FROM purchase_order_items WHERE po_id = po.id), 0),
    total_amount    = COALESCE((SELECT SUM(required_qty * estimated_price) FROM purchase_order_items WHERE po_id = po.id), 0),
    items_count     = COALESCE((SELECT COUNT(*) FROM purchase_order_items WHERE po_id = po.id), 0)
  WHERE eod_date = p_date AND status = 'pending';

  RETURN JSONB_BUILD_OBJECT(
    'date', p_date::text,
    'pos_created', v_po_count,
    'items_created', v_item_count,
    'message', CASE WHEN v_po_count = 0 THEN 'No shortfall - stock sufficient' ELSE v_po_count::text || ' PO(s) created' END
  );
END;
$function$;

-- ── Verify ───────────────────────────────────────────────────
-- Constraint exists:
SELECT conname, contype FROM pg_constraint WHERE conname = 'purchase_order_items_po_product_uniq';
-- Function updated (should show ON CONFLICT ON CONSTRAINT in the body):
SELECT pg_get_functiondef(oid) AS definition
FROM pg_proc WHERE proname = 'run_eod_po_engine' AND pronamespace = 'public'::regnamespace;

-- ── Test: run the engine twice for today, confirm no duplication ─────
-- SELECT run_eod_po_engine();
-- SELECT run_eod_po_engine();  -- second call for the SAME date should create 0 new items
-- SELECT po_id, product_id, COUNT(*) FROM purchase_order_items GROUP BY po_id, product_id HAVING COUNT(*) > 1;  -- should return 0 rows
