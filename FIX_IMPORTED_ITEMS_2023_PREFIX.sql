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
--  v1/v2 (already run — see git history) fixed every row whose name
--  held exactly THREE clean two-decimal numbers (qty, rate, amount),
--  including thousands separators and trailing junk after amount.
--
--  v3 adds the two shapes v2's regex didn't match (55 rows found via
--  section 4's "what's left" query):
--
--   1. Purchase rows (Zoho PO template) — the RATE is printed with
--      1-7 decimal digits, not 2 (it's a derived per-kg price, e.g.
--      "APPLE SIMLA MEDIUM 18.00 211.1111 3,800.00 kg 11"). Only qty
--      and amount are still clean two-decimal numbers.
--   2. Sales rows (Zoho SO template) — there's a Disc% column between
--      rate and amount, printed with or without a trailing "%"
--      ("ASH GOURD 100.00 25.00 5.00% 2,375.00", or
--      "ONION BIG NAISK 270.00 52.00 0.00 14,040.00 kg" with 0%
--      disc). The printed amount is already net of the discount.
--      sales_order_items has a real discount_pct numeric(5,2) column
--      (confirmed in schema + used by OrderListPage.tsx), so the
--      recovered discount is stored there — unit_price stays the
--      gross per-unit rate, total_price/subtotal stay the net amount.
--
--  Both patterns validated against all 55 currently-broken rows in a
--  standalone script before writing this (0 failures, arithmetic
--  checks out for every row) — see chat for the validation output.
--
--  Safe to re-run: only rows still at quantity = 2023 are touched,
--  and only when the arithmetic checks out.
--
--  Run 1 (preview), then 2 and 3 (fixes), then 4 (what's left).
-- ─────────────────────────────────────────────────────────────

-- ── 1. PREVIEW ───────────────────────────────────────────────
select 'purchase (variable-decimal rate)' as shape,
  s.id, s.po_id as ref_id,
  s.product_name                                            as old_name,
  regexp_replace(trim(m[1]), '^\d{4}\s*-\s*', '')           as new_name,
  s.quantity                                                as old_qty,
  replace(m[2], ',', '')::numeric                           as new_qty,
  s.unit_price                                              as old_rate,
  replace(m[3], ',', '')::numeric                           as new_rate,
  s.total_price                                             as old_amount,
  replace(m[4], ',', '')::numeric                           as new_amount,
  null::numeric                                             as new_disc_pct,
  abs(replace(m[2], ',', '')::numeric * replace(m[3], ',', '')::numeric - replace(m[4], ',', '')::numeric) < 1 as consistent
from purchase_order_items s
cross join lateral regexp_match(
  s.product_name,
  '^(.*?)\s+(\d[\d,]*\.\d{2})\s+(\d[\d,]*\.\d{1,7})\s+(\d[\d,]*\.\d{2})(?:\s+(.*))?$'
) as m
where s.quantity = 2023
  and m is not null

union all

select 'sales (discount column)' as shape,
  s.id, s.order_id as ref_id,
  s.product_name,
  regexp_replace(trim(m[1]), '^\d{4}\s*-\s*', ''),
  s.quantity,
  replace(m[2], ',', '')::numeric,
  s.unit_price,
  replace(m[3], ',', '')::numeric,
  s.total_price,
  replace(m[5], ',', '')::numeric,
  m[4]::numeric,
  abs(replace(m[2], ',', '')::numeric * replace(m[3], ',', '')::numeric * (1 - m[4]::numeric / 100.0) - replace(m[5], ',', '')::numeric) < 0.5
from sales_order_items s
cross join lateral regexp_match(
  s.product_name,
  '^(.*?)\s+(\d[\d,]*\.\d{2})\s+(\d[\d,]*\.\d{2})\s+(\d+\.\d{2})%?\s+(\d[\d,]*\.\d{2})(?:\s+(.*))?$'
) as m
where s.quantity = 2023
  and m is not null
order by 1, consistent, ref_id, id;

-- ── 2. FIX sales_order_items (discount-column shape) ─────────
with parsed as (
  select
    s.id,
    regexp_replace(trim(m[1]), '^\d{4}\s*-\s*', '') as name,
    replace(m[2], ',', '')::numeric                 as qty,
    replace(m[3], ',', '')::numeric                 as rate,
    m[4]::numeric                                   as disc_pct,
    replace(m[5], ',', '')::numeric                 as amount,
    coalesce(upper((regexp_match(coalesce(m[6], ''), '\m(kg|pcs|box|ltr|litre|dozen|batch)\M', 'i'))[1]), s.unit) as unit
  from sales_order_items s
  cross join lateral regexp_match(
    s.product_name,
    '^(.*?)\s+(\d[\d,]*\.\d{2})\s+(\d[\d,]*\.\d{2})\s+(\d+\.\d{2})%?\s+(\d[\d,]*\.\d{2})(?:\s+(.*))?$'
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
    discount_pct = p.disc_pct,
    total_price  = p.amount,
    subtotal     = p.amount
from parsed p
where p.id = s.id
  and p.name <> ''
  and p.qty > 0
  and abs(p.qty * p.rate * (1 - p.disc_pct / 100.0) - p.amount) < 0.5;

-- ── 3. FIX purchase_order_items (variable-decimal-rate shape) ──
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
    '^(.*?)\s+(\d[\d,]*\.\d{2})\s+(\d[\d,]*\.\d{1,7})\s+(\d[\d,]*\.\d{2})(?:\s+(.*))?$'
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
  and abs(p.qty * p.rate - p.amount) < 1;

-- ── 4. WHAT'S LEFT (should be empty; if not, send me this output) ──
select 'sales_order_items' as tbl, id, product_name, quantity, unit_price, total_price
from sales_order_items where quantity = 2023
union all
select 'purchase_order_items', id, product_name, quantity, unit_price, total_price
from purchase_order_items where quantity = 2023
order by 1, 3;
