-- ============================================================
--  FIX — backfill total_estimated/items_count for POs created
--  via EODPOEngine.tsx before today's poToPayload() fix.
--  The line items themselves (purchase_order_items) already have
--  correct required_qty/estimated_price — only the PO-level
--  rollup was ever missing.
-- ============================================================

UPDATE purchase_orders po SET
  total_estimated = COALESCE((SELECT SUM(required_qty * estimated_price) FROM purchase_order_items WHERE po_id = po.id), 0),
  total_amount    = COALESCE((SELECT SUM(required_qty * estimated_price) FROM purchase_order_items WHERE po_id = po.id), 0),
  items_count     = COALESCE((SELECT COUNT(*) FROM purchase_order_items WHERE po_id = po.id), 0)
WHERE po_number IN ('PO-00002', 'PO-00003', 'PO-00004');

-- ── Verify ───────────────────────────────────────────────────
SELECT po_number, hub_name, total_estimated, items_count, assigned_executive_id
FROM purchase_orders
WHERE po_number IN ('PO-00002', 'PO-00003', 'PO-00004');
