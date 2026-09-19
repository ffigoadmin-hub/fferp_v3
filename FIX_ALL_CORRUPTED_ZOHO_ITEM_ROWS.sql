-- ─────────────────────────────────────────────────────────────
--  Generalized repair for the Zoho "item-group-prefix" import bug —
--  supersedes FIX_IMPORTED_ITEMS_2023_PREFIX.sql and
--  FIX_PO_ITEMS_JSONB_RESYNC.sql.
--
--  Why a new script: those two were gated on `WHERE quantity = 2023`,
--  which only catches rows where the OLD parser happened to misread a
--  "2023-" catalog prefix specifically. PO-00969 ("GUAVA 10.00 125.00
--  1,250.00 kg", quantity showing 2023) is still broken live — either
--  those scripts were never actually run against the database yet (only
--  committed to the repo), or this exact row wasn't in the batch they
--  were validated against. Either way, gating on a specific prefix
--  number is fragile: Zoho's item-group codes aren't necessarily always
--  "2023", so this script detects corruption from the SHAPE of the
--  stored name instead (still holds the un-split "name qty rate amount"
--  text), regardless of what ended up in the quantity column.
--
--  The current src/lib/poImportParsers.ts (PDF path, shared by both PO
--  and Sales Order import) already parses this correctly — confirmed by
--  reading the code, it strips the "NNNN-" prefix and derives qty/rate/
--  amount from decimal-shaped tokens, not "first number = qty". So this
--  is a one-time historical-data repair, not a live bug in new imports.
--
--  Covers, in one pass:
--   1. purchase_order_items — "name qty.dd rate.d(1-7) amount.dd [unit]"
--   2. sales_order_items    — "name qty.dd rate.dd disc.dd% amount.dd [unit]"
--   3. purchase_orders.items (JSONB) — resynced from the now-fixed
--      purchase_order_items rows (this is a SEPARATE denormalized copy
--      read by VendorBulkPaymentPage.tsx / PurchaseReportPage.tsx via
--      purchaseStore.rowToPO() — fixing the relational table alone,
--      like the original script did, never touches this copy).
--
--  Safe to re-run: every fix only touches rows whose stored name still
--  matches the corrupted shape AND whose arithmetic checks out
--  (qty × rate ≈ amount, or qty × rate × (1 − disc%) ≈ amount).
--
--  Run 1 (preview) first, then 2/3/4 (fixes), then 5 (what's left).
-- ─────────────────────────────────────────────────────────────

-- ── 1. PREVIEW ───────────────────────────────────────────────
select 'purchase_order_items' as tbl,
  s.id, s.po_id as ref_id, s.product_name as old_name,
  regexp_replace(trim(m[1]), '^\d+\s*-\s*', '')   as new_name,
  s.quantity                                      as old_qty,
  replace(m[2], ',', '')::numeric                 as new_qty,
  s.unit_price                                    as old_rate,
  replace(m[3], ',', '')::numeric                 as new_rate,
  s.total_price                                   as old_amount,
  replace(m[4], ',', '')::numeric                 as new_amount
from purchase_order_items s
cross join lateral regexp_match(
  s.product_name,
  '^(.*?)\s+(\d[\d,]*\.\d{2})\s+(\d[\d,]*\.\d{1,7})\s+(\d[\d,]*\.\d{2})(?:\s+(.*))?$'
) as m
where m is not null
  and abs(replace(m[2], ',', '')::numeric * replace(m[3], ',', '')::numeric - replace(m[4], ',', '')::numeric) < 1

union all

select 'sales_order_items', s.id, s.order_id, s.product_name,
  regexp_replace(trim(m[1]), '^\d+\s*-\s*', ''),
  s.quantity,
  replace(m[2], ',', '')::numeric,
  s.unit_price,
  replace(m[3], ',', '')::numeric,
  s.total_price,
  replace(m[5], ',', '')::numeric
from sales_order_items s
cross join lateral regexp_match(
  s.product_name,
  '^(.*?)\s+(\d[\d,]*\.\d{2})\s+(\d[\d,]*\.\d{2})\s+(\d+\.\d{2})%?\s+(\d[\d,]*\.\d{2})(?:\s+(.*))?$'
) as m
where m is not null
  and abs(replace(m[2], ',', '')::numeric * replace(m[3], ',', '')::numeric * (1 - m[4]::numeric / 100.0) - replace(m[5], ',', '')::numeric) < 0.5
order by 1, 3;

-- ── 2. FIX purchase_order_items ───────────────────────────────
with parsed as (
  select
    s.id,
    regexp_replace(trim(m[1]), '^\d+\s*-\s*', '') as name,
    replace(m[2], ',', '')::numeric                as qty,
    replace(m[3], ',', '')::numeric                as rate,
    replace(m[4], ',', '')::numeric                as amount
  from purchase_order_items s
  cross join lateral regexp_match(
    s.product_name,
    '^(.*?)\s+(\d[\d,]*\.\d{2})\s+(\d[\d,]*\.\d{1,7})\s+(\d[\d,]*\.\d{2})(?:\s+(.*))?$'
  ) as m
  where m is not null
)
update purchase_order_items s
set product_name    = p.name,
    item_name       = p.name,
    quantity        = p.qty,
    required_qty    = p.qty,
    unit_price      = p.rate,
    estimated_price = p.rate,
    total_price     = p.amount
from parsed p
where p.id = s.id
  and p.name <> ''
  and p.qty > 0
  and abs(p.qty * p.rate - p.amount) < 1;

-- ── 3. FIX sales_order_items ───────────────────────────────────
with parsed as (
  select
    s.id,
    regexp_replace(trim(m[1]), '^\d+\s*-\s*', '') as name,
    replace(m[2], ',', '')::numeric                as qty,
    replace(m[3], ',', '')::numeric                as rate,
    m[4]::numeric                                   as disc_pct,
    replace(m[5], ',', '')::numeric                as amount,
    coalesce(upper((regexp_match(coalesce(m[6], ''), '\m(kg|pcs|box|ltr|litre|dozen|batch)\M', 'i'))[1]), s.unit) as unit
  from sales_order_items s
  cross join lateral regexp_match(
    s.product_name,
    '^(.*?)\s+(\d[\d,]*\.\d{2})\s+(\d[\d,]*\.\d{2})\s+(\d+\.\d{2})%?\s+(\d[\d,]*\.\d{2})(?:\s+(.*))?$'
  ) as m
  where m is not null
)
update sales_order_items s
set product_name = p.name,
    quantity     = p.qty,
    qty_kg       = p.qty,
    quantity_kg  = p.qty,
    unit         = p.unit,
    unit_price   = p.rate,
    discount_pct = p.disc_pct,
    total_price  = p.amount,
    subtotal     = p.amount
from parsed p
where p.id = s.id
  and p.name <> ''
  and p.qty > 0
  and abs(p.qty * p.rate * (1 - p.disc_pct / 100.0) - p.amount) < 0.5;

-- ── 4. RESYNC purchase_orders.items (JSONB) from the now-fixed
--       purchase_order_items rows, for every PO whose JSONB still shows
--       the old corrupted shape ──
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
      where (el->>'itemName') ~ '\d[\d,]*\.\d{2}\s+\d[\d,]*\.\d{1,7}\s+\d[\d,]*\.\d{2}'
    )
) sub
where sub.id = po.id
  and sub.new_items is not null;

-- ── 5. WHAT'S LEFT (should be empty for all four) ─────────────
select 'purchase_order_items' as tbl, count(*) from purchase_order_items s
where regexp_match(s.product_name, '^(.*?)\s+(\d[\d,]*\.\d{2})\s+(\d[\d,]*\.\d{1,7})\s+(\d[\d,]*\.\d{2})(?:\s+(.*))?$') is not null
union all
select 'sales_order_items', count(*) from sales_order_items s
where regexp_match(s.product_name, '^(.*?)\s+(\d[\d,]*\.\d{2})\s+(\d[\d,]*\.\d{2})\s+(\d+\.\d{2})%?\s+(\d[\d,]*\.\d{2})(?:\s+(.*))?$') is not null
union all
select 'purchase_orders.items (jsonb)', count(*) from purchase_orders po
where po.items is not null and jsonb_typeof(po.items) = 'array'
  and exists (
    select 1 from jsonb_array_elements(po.items) el
    where (el->>'itemName') ~ '\d[\d,]*\.\d{2}\s+\d[\d,]*\.\d{1,7}\s+\d[\d,]*\.\d{2}'
  );
