-- ─────────────────────────────────────────────────────────────
--  Repair sales/purchase order items imported from Zoho PDFs
--  before the parser fix in src/lib/poImportParsers.ts.
--
--  Symptom: Zoho item names carry a "2023-" item-group prefix
--  ("2023-TOMATO(BANGALORE)"). The old parser read that 2023 as
--  the quantity and pushed the real qty / rate / amount into the
--  item name, so rows look like:
--
--      product_name = 'AVARAKKA 3.00 85.00 255.00 kg'
--      quantity     = 2023
--      unit_price   = 0.126   (= 255 / 2023)
--      total_price  = 255     (this one was right)
--
--  Zoho prints qty / rate / amount with exactly two decimals, so
--  the FIRST three consecutive "1,234.56"-shaped numbers in the
--  name are those columns; anything after them (unit, stray
--  tokens like "0.5 box") is ignored except for the unit word.
--
--  v2: amounts with thousands separators ("1,200.00") and rows
--  with trailing tokens after the amount are now handled — the
--  v1 regex missed both.
--
--  Safe to re-run: only rows with quantity = 2023 are touched,
--  and only when qty × rate = amount.
--
--  Run 1 (preview), then 2 and 3 (fixes), then 4 (what's left).
-- ─────────────────────────────────────────────────────────────

-- ── 1. PREVIEW ───────────────────────────────────────────────
select
  s.id, s.order_id,
  s.product_name                                            as old_name,
  regexp_replace(trim(m[1]), '^\d{4}\s*-\s*', '')           as new_name,
  s.quantity                                                as old_qty,
  replace(m[2], ',', '')::numeric                           as new_qty,
  s.unit_price                                              as old_rate,
  replace(m[3], ',', '')::numeric                           as new_rate,
  s.total_price                                             as old_amount,
  replace(m[4], ',', '')::numeric                           as new_amount,
  s.unit                                                    as old_unit,
  coalesce(upper((regexp_match(coalesce(m[5], ''), '\m(kg|pcs|box|ltr|litre|dozen|batch)\M', 'i'))[1]), s.unit) as new_unit,
  abs(replace(m[2], ',', '')::numeric * replace(m[3], ',', '')::numeric - replace(m[4], ',', '')::numeric) < 0.05 as consistent
from sales_order_items s
cross join lateral regexp_match(
  s.product_name,
  '^(.*?)\s+(\d[\d,]*\.\d{2})\s+(\d[\d,]*\.\d{2})\s+(\d[\d,]*\.\d{2})(?:\s+(.*))?$'
) as m
where s.quantity = 2023
  and m is not null
order by consistent, s.order_id, s.id;

-- ── 2. FIX sales_order_items ─────────────────────────────────
with parsed as (
  select
    s.id,
    regexp_replace(trim(m[1]), '^\d{4}\s*-\s*', '') as name,
    replace(m[2], ',', '')::numeric                 as qty,
    replace(m[3], ',', '')::numeric                 as rate,
    replace(m[4], ',', '')::numeric                 as amount,
    coalesce(upper((regexp_match(coalesce(m[5], ''), '\m(kg|pcs|box|ltr|litre|dozen|batch)\M', 'i'))[1]), s.unit) as unit
  from sales_order_items s
  cross join lateral regexp_match(
    s.product_name,
    '^(.*?)\s+(\d[\d,]*\.\d{2})\s+(\d[\d,]*\.\d{2})\s+(\d[\d,]*\.\d{2})(?:\s+(.*))?$'
  ) as m
  where s.quantity = 2023
    and m is not null
)
update sales_order_items s
set product_name = p.name,
    quantity     = p.qty,
    qty_kg       = p.qty,
    quantity_kg  = p.qty,
    unit         = p.unit,
    unit_price   = p.rate,
    total_price  = p.amount,
    subtotal     = p.amount
from parsed p
where p.id = s.id
  and p.name <> ''
  and p.qty > 0
  and abs(p.qty * p.rate - p.amount) < 0.05;

-- ── 3. FIX purchase_order_items (same parser, same bug) ──────
with parsed as (
  select
    s.id,
    regexp_replace(trim(m[1]), '^\d{4}\s*-\s*', '') as name,
    replace(m[2], ',', '')::numeric                 as qty,
    replace(m[3], ',', '')::numeric                 as rate,
    replace(m[4], ',', '')::numeric                 as amount
  from purchase_order_items s
  cross join lateral regexp_match(
    s.product_name,
    '^(.*?)\s+(\d[\d,]*\.\d{2})\s+(\d[\d,]*\.\d{2})\s+(\d[\d,]*\.\d{2})(?:\s+(.*))?$'
  ) as m
  where s.quantity = 2023
    and m is not null
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
  and abs(p.qty * p.rate - p.amount) < 0.05;

-- ── 4. WHAT'S LEFT (should be empty; if not, send me this output) ──
select 'sales_order_items' as tbl, id, product_name, quantity, unit_price, total_price
from sales_order_items where quantity = 2023
union all
select 'purchase_order_items', id, product_name, quantity, unit_price, total_price
from purchase_order_items where quantity = 2023
order by 1, 3;
