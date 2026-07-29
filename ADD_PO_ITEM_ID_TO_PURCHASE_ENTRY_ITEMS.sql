-- ============================================================
--  FIX — add po_item_id to purchase_entry_items
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  purchase_entry_items had no relational link back to the specific
--  purchase_order_items row it was bought against — only an informal
--  po_item_id field buried inside ff_vendor_payments.items jsonb.
--  Needed for the new vendor-cart multi-item Buy flow so each line
--  item in a cart submission can be traced back to its PO item.
--  Additive + nullable — nothing existing breaks.
-- ============================================================

ALTER TABLE purchase_entry_items
  ADD COLUMN IF NOT EXISTS po_item_id uuid REFERENCES purchase_order_items(id);

-- ── Verify ───────────────────────────────────────────────────
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'purchase_entry_items'
ORDER BY ordinal_position;
