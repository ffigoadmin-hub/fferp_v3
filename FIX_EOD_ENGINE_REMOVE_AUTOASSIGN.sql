-- ============================================================
--  FIX — remove auto-assign-to-purchase-executive from the EOD PO engine
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  Phase 4 of the org-restructure plan. Previously, this function
--  picked ONE shift_employee per hub and auto-assigned every new PO
--  to them directly — no hub manager involved at all. That doesn't
--  match how hubs actually work now: multiple purchase executives
--  per hub, some (the Chennai group) shared across two hubs, with
--  the hub manager deciding day-to-day who buys what.
--
--  This removes that whole auto-assign block. POs are still created
--  exactly as before (same shortfall calculation, same PO + PO-items
--  creation) — they just come out with assigned_executive_id = NULL,
--  waiting for a hub manager to review and assign via the new
--  POAssignment.tsx page (built separately, not a DB change).
--
--  Nothing else in this function changes — same shortfall math, same
--  PO/PO-item creation logic as confirmed live just now.
-- ============================================================

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
    ) ON CONFLICT DO NOTHING
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

  -- NOTE: the auto-assign-to-purchase-executive block that used to run here
  -- has been removed. POs now come out of this function with
  -- assigned_executive_id = NULL and wait for a hub manager to review and
  -- assign them via the new PO Assignment page.

  RETURN JSONB_BUILD_OBJECT(
    'date', p_date::text,
    'pos_created', v_po_count,
    'items_created', v_item_count,
    'message', CASE WHEN v_po_count = 0 THEN 'No shortfall - stock sufficient' ELSE v_po_count::text || ' PO(s) created' END
  );
END;
$function$;

-- ── Verify ───────────────────────────────────────────────────
SELECT pg_get_functiondef(oid) AS definition
FROM pg_proc
WHERE proname = 'run_eod_po_engine' AND pronamespace = 'public'::regnamespace;
