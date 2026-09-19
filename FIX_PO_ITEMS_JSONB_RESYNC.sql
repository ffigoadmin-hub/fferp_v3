-- ─────────────────────────────────────────────────────────────
--  Resync purchase_orders.items (JSONB) from the now-correct
--  purchase_order_items rows, for POs FIX_IMPORTED_ITEMS_2023_PREFIX.sql
--  already repaired.
--
--  Root cause: purchase_orders.items is a SEPARATE denormalized copy of
--  each PO's line items, read by VendorBulkPaymentPage.tsx and
--  PurchaseReportPage.tsx via purchaseStore.fetchAllPOs() -> rowToPO()
--  (row.items straight from this JSONB column) — NOT from the relational
--  purchase_order_items table that BuyPage.tsx queries directly.
--
--  FIX_IMPORTED_ITEMS_2023_PREFIX.sql corrected purchase_order_items
--  (product_name/item_name, quantity, unit_price) but only ever UPDATEd
--  that relational table directly — it never touched purchase_orders.items,
--  so any page reading the JSONB still shows the old garbled shape:
--      itemName = 'COCONUT 230.00 59.00 13,570.00 kg'
--      quantity = 2023
--  even though purchase_order_items for the same PO is already correct.
--
--  This script rebuilds purchase_orders.items from purchase_order_items,
--  in the {itemName, account, quantity, rate, tax, discount,
--  customerDetails} shape PurchaseOrdersPage.tsx's importer normally
--  writes (see poToPayload/StoredPOItem in src/lib/purchaseStore.ts).
--
--  Safe to re-run: only touches POs whose items JSONB still has an
--  element at quantity = 2023 (the same signature the original fix
--  targeted), and only when purchase_order_items has rows to rebuild from.
--
--  Run 1 (preview) first, then 2 (fix), then 3 (what's left).
-- ─────────────────────────────────────────────────────────────

-- ── 1. PREVIEW ───────────────────────────────────────────────
select
  po.id, po.po_number,
  po.items as old_items,
  (
    select jsonb_agg(jsonb_build_object(
        'itemName', poi.item_name,
        'account', 'Cost of Goods Sold',
        'quantity', poi.quantity,
        'rate', poi.unit_price,
        'tax', 'GST 5%',
        'discount', 0,
        'customerDetails', ''
      ) order by poi.created_at, poi.id)
    from purchase_order_items poi
    where poi.po_id = po.id
  ) as new_items
from purchase_orders po
where po.items is not null
  and jsonb_typeof(po.items) = 'array'
  and exists (
    select 1 from jsonb_array_elements(po.items) el
    where (el->>'quantity')::numeric = 2023
  )
order by po.po_number;

-- ── 2. FIX ───────────────────────────────────────────────────
update purchase_orders po
set items = sub.new_items
from (
  select
    po2.id,
    (
      select jsonb_agg(jsonb_build_object(
          'itemName', poi.item_name,
          'account', 'Cost of Goods Sold',
          'quantity', poi.quantity,
          'rate', poi.unit_price,
          'tax', 'GST 5%',
          'discount', 0,
          'customerDetails', ''
        ) order by poi.created_at, poi.id)
      from purchase_order_items poi
      where poi.po_id = po2.id
    ) as new_items
  from purchase_orders po2
  where po2.items is not null
    and jsonb_typeof(po2.items) = 'array'
    and exists (
      select 1 from jsonb_array_elements(po2.items) el
      where (el->>'quantity')::numeric = 2023
    )
) sub
where sub.id = po.id
  and sub.new_items is not null;

-- ── 3. WHAT'S LEFT (should be empty; if not, purchase_order_items itself
--       is still broken for that PO — re-run FIX_IMPORTED_ITEMS_2023_PREFIX.sql's
--       "what's left" query (section 4) to check) ──
select po.id, po.po_number, po.items
from purchase_orders po
where po.items is not null
  and jsonb_typeof(po.items) = 'array'
  and exists (
    select 1 from jsonb_array_elements(po.items) el
    where (el->>'quantity')::numeric = 2023
  );
