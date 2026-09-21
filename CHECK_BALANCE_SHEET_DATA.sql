-- CHECK_BALANCE_SHEET_DATA.sql — Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor. Read-only.
-- Purpose: verify whether the Balance Sheet's ₹0 Inventory Value / Accounts Receivable
-- reflect real (empty) data, or whether the report's queries are missing rows that exist.

-- 1. Inventory: total rows, total quantity, and how many have a priced product joined
SELECT
  count(*)                                            AS inventory_rows,
  sum(quantity)                                        AS total_quantity,
  count(*) FILTER (WHERE quantity > 0)                 AS rows_with_stock,
  sum(quantity) FILTER (WHERE quantity > 0)             AS qty_with_stock
FROM inventory;

-- 2. Inventory value, same formula the report uses, joined to products
SELECT
  sum(i.quantity * COALESCE(p.grade_a_price, 0)) AS inventory_value,
  count(*) FILTER (WHERE p.id IS NULL)           AS inventory_rows_missing_product_join
FROM inventory i
LEFT JOIN products p ON p.id = i.product_id;

-- 3. Sales orders: breakdown by payment_mode and payment_status
SELECT payment_mode, payment_status, status, count(*), sum(COALESCE(net_amount, total_amount))
FROM sales_orders
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;

-- 4. What the report's exact receivables query returns
SELECT count(*), sum(COALESCE(net_amount, total_amount))
FROM sales_orders
WHERE payment_mode = 'credit' AND payment_status <> 'paid' AND status <> 'cancelled';

-- 5. Vendor payables breakdown (sanity check against the ₹2,80,017 already showing)
SELECT payment_status, count(*), sum(net_amount)
FROM ff_vendor_payments
GROUP BY 1
ORDER BY 1;

-- 6. Transport payables breakdown
SELECT payment_status, count(*), sum(base_amount + toll_charges + other_charges)
FROM ff_transport_payments
GROUP BY 1
ORDER BY 1;
