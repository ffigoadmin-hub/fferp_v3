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
--  This pulls the three numbers back out of the name and puts
--  them where they belong. total_price / subtotal are re-set from
--  the name too, but they already matched, so order totals do
--  not change.
--
--  Run the PREVIEW first. Then run the UPDATE(s).
-- ─────────────────────────────────────────────────────────────

-- ── 1. PREVIEW: what will change ─────────────────────────────
select
  s.id, s.order_id,
  s.product_name                           as old_name,
  trim(m[1])                               as new_name,
  s.quantity                               as old_qty,
  m[2]::numeric                            as new_qty,
  s.unit_price                             as old_rate,
  m[3]::numeric                            as new_rate,
  s.total_price                            as old_amount,
  m[4]::numeric                            as new_amount,
  s.unit                                   as old_unit,
  coalesce(upper(m[5]), s.unit)            as new_unit
from sales_order_items s
cross join lateral regexp_match(
  s.product_name,
  '^(.*?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)(?:\s+([A-Za-z]+))?\s*$'
) as m
where s.quantity = 2023
  and m is not null
order by s.order_id, s.id;

-- ── 2. FIX sales_order_items ─────────────────────────────────
with parsed as (
  select
    s.id,
    trim(m[1])                    as name,
    m[2]::numeric                 as qty,
    m[3]::numeric                 as rate,
    m[4]::numeric                 as amount,
    coalesce(upper(m[5]), s.unit) as unit
  from sales_order_items s
  cross join lateral regexp_match(
    s.product_name,
    '^(.*?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)(?:\s+([A-Za-z]+))?\s*$'
  ) as m
  where s.quantity = 2023
    and m is not null
    -- only rows whose numbers are internally consistent (qty × rate = amount)
    and abs(m[2]::numeric * m[3]::numeric - m[4]::numeric) < 0.05
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
where p.id = s.id;

-- ── 3. FIX purchase_order_items (same parser, same bug) ──────
with parsed as (
  select
    s.id,
    trim(m[1])    as name,
    m[2]::numeric as qty,
    m[3]::numeric as rate,
    m[4]::numeric as amount
  from purchase_order_items s
  cross join lateral regexp_match(
    s.product_name,
    '^(.*?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)(?:\s+([A-Za-z]+))?\s*$'
  ) as m
  where s.quantity = 2023
    and m is not null
    and abs(m[2]::numeric * m[3]::numeric - m[4]::numeric) < 0.05
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
where p.id = s.id;

-- ── 4. VERIFY: nothing left with the bogus quantity ──────────
select 'sales_order_items' as tbl, count(*) from sales_order_items where quantity = 2023
union all
select 'purchase_order_items', count(*) from purchase_order_items where quantity = 2023;
