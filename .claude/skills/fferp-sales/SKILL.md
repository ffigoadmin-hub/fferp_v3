---
name: fferp-sales
description: >
  Domain skill for sales in the Farmers Factory ERP — sales orders from every channel (New Order,
  Bulk Order CSV/XLSX, Zoho-style sales-order PDF import, mobile app, website, tele-caller Take
  Order), customers (quick-add, duplicate phone handling), products/custom items, invoices
  (invoiceHelper, INV numbers, delivery charges, discount), hub routing by pincode, order status,
  App & Web Orders view, sales targets, tele-caller CRM, and cash collections. Load it whenever the
  request mentions order, sales order, invoice, customer, bulk upload, PDF import, "Custom item",
  "order missing hub", delivery charge, discount, net_amount, tele-caller, follow-up, collection,
  or the sales_orders / sales_order_items / customers / invoices / products tables.
---

# FFERP — Sales domain

## Order sources and what each writes

| Source | Entry | `sales_orders.source` | Notes |
|---|---|---|---|
| Sales rep in ERP | `NewOrder.tsx` | `manual` | Hub chosen first; customer; catalogue or custom items; charges |
| Bulk file | `BulkOrderPage.tsx` CSV/XLSX | `bulk_upload` | One row per order; headers normalised via `normalizeHeader` |
| Bulk PDF | `BulkOrderPage.tsx` → `salesOrderImportParser.ts` | `bulk_upload` | Zoho doc template; multi-item orders; review dialog |
| Mobile app / website | direct inserts (other clients) | `app` / `website` | May arrive with `hub_id NULL`; never hide them |
| Tele-caller | `tele-caller/TakeOrder.tsx` | `manual` | Standard order for the shop |
| Customer web cart | `customer/CustomerCart.tsx` (public route, no AppLayout) | `website` | |

All of them end in the same place: `sales_orders` + `sales_order_items` (+ an invoice). Downstream
(EOD engine, labels, reports) does not care about the source — but it does care about `hub_id` and
`order_date`.

## Creating an order correctly (NewOrder sequence — reuse it)

1. Hub: `hubs` list (`select('id, code, name, address')` — no `location`), surface
   loading / error(+retry) / empty states; a blank hub grid was a real bug.
2. Customer: search `customers`; Quick Add inserts `{ customer_type:'shop', shop_name, name, phone,
   … , is_active:true }`. On a duplicate-phone conflict, look up the existing row by phone and select
   it — never surface the Postgres constraint text to a sales rep.
3. Items: catalogue `products (id, name, unit, grade_a_price, grade_b_price, grade_c_price,
   category)`; "+ Add New Item" always visible in the picker for custom items with an inline
   category (search existing or type new). On submit, custom items are inserted into `products` so
   they become catalogue entries.
4. Charges: order-level `delivery_charges` and `discount` (columns added by
   `ADD_DELIVERY_CHARGES_TO_SALES_ORDERS.sql` / `ADD_DISCOUNT_TO_SALES_ORDERS.sql`).
5. Insert `sales_orders` **without `net_amount`** (GENERATED ALWAYS): `customer_id, customer_name,
   order_date, delivery_date, status:'pending', payment_mode, delivery_charges, discount, total_amount,
   notes, hub_id, hub_name, shift, source`. `order_number` comes from the `set_order_number` trigger.
6. Insert `sales_order_items` with `product_id` (nullable), **`product_name`** (always), `qty`,
   `unit`, `unit_price`, `discount_pct`, `total`, `grade`, `category`, `is_custom`, `notes`. Check
   the error — BulkOrder once failed silently here.
7. `createInvoiceForOrder({ orderId, customerId, items, deliveryCharges, discountAmount, … })` from
   `src/lib/invoiceHelper.ts` — idempotent (checks for an existing invoice for the order), generates
   `INV-YYYYMMDD-<first 6 of order UUID>`, stores `subtotal, discount_amount, tax_amount,
   delivery_charges, total_amount, payment_mode, status, payment_status:'unpaid'`. Optionally
   auto-open the print view. `finalizeInvoice()` adjusts charges later; `backfillMissingInvoices()`
   and `fixZeroAmountInvoices()` are the repair tools (APK orders once produced zero-amount invoices —
   totals must be computed from items when the order total is missing).
8. Toast with the order number.

Never create `invoices` rows anywhere else.

## Hub routing

Trigger on `sales_orders` insert sets `hub_id` from `customers.pincode` → `hub_pincodes` (exact,
then 4-digit prefix). When a client already knows the hub (NewOrder), send `hub_id`/`hub_name`
explicitly. Historical rows with `hub_id NULL` exist; list pages use an OR filter to include them
and downstream pages fall back to fuzzy hub-name matching. Spelling drift ("Palikarani" vs
"Pallikaranai") is real — match normalised names, not raw strings.

## Bulk import

**CSV/XLSX** (`parse` via papaparse / xlsx): one order per row; required `customer_name`; product
columns per template; hub selected in the dialog first and applied to every row (overridable).
Unmatched customer names create customers — with an **in-batch cache** so one name repeated across
rows yields one customer row (507 order rows + 174 duplicate customers were cleaned up after the
opposite behaviour).

**PDF** (`parseSalesOrdersFromPDF`): same Zoho document family as the PO import; rules that came
from a 46-page production export:
- The header is two columns; Y-sorted extraction interleaves "Order Date : …" between the *Bill To*
  label and the customer name → walk forward past date/label lines to the real name; a genuinely
  blank block must surface as blank ("No customer name" check), never as junk.
- Continuation pages repeat the item table but not the Bill To block → merge a label-less page's
  items into the previous order instead of creating a phantom customer-less order.
- Item rows: qty/rate/amount are the two-decimal numbers; a Disc% column may appear between rate
  and amount — validate `qty × rate × (1 − disc/100) = amount` and store `discount_pct`.
- After parsing, the review dialog shows per-order items and totals before committing through the
  same insert path as NewOrder (items with `product_name`, invoice via helper).

When a parser bug has already imported bad data, write a repair SQL that reconstructs from the
stored text (see `FIX_IMPORTED_ITEMS_2023_PREFIX.sql` for the regex approach) and validate it
against every affected row before running.

## Reading orders

- `OrderListPage.tsx`: list select includes `customer_name` from the order row (not just the
  customer join — app orders may lack the FK), `source`, `payment_status`, `hub_id`; detail select
  embeds `customer:customers(...)` and `items:sales_order_items(id, product_name, qty_kg, unit_price,
  total_price, qc_grade, unit, notes, product:products(name, category, unit))`. Always select
  `product_name` on items or imported items render as "Custom item".
- `AppOrdersDashboard.tsx`: `.eq('source', sourceFilter)` with `SOURCE_CONFIG` badges; includes
  null-hub orders.
- Order status: `pending → confirmed → processing → delivered | cancelled`. Confirmed orders are
  what logistics attaches to trips.

## Customers, targets, collections, CRM

- `CustomerManagement.tsx`: full customer master (shop_name, owner, phone/mobile, area, city,
  gst_number, credit_limit, outstanding_balance, is_active) with an inline order form that follows
  the same insert rules (no `net_amount`).
- `SalesTargets.tsx` → `sales_targets`; `TaskToday.tsx` shows the day's tasks from
  `ff_task_assignments` (assigned by Ops Manager; a locked plan auto-fills the rep's Day Plan).
- Collections (`collections/CollectionEntryPage.tsx`): `cash_collections {order_id, customer_id,
  customer_name, shop_name, area, phone, order_number, order_amount, collected_amount,
  payment_mode}` against delivered orders; reported on `/reports/collection`.
- Tele-caller (`tele-caller/*`): `call_logs`, `followup_reminders`, shop profile from `customers`,
  Take Order → standard order.
- Sidebar for sales roles (`field_executive`, `bde`, `tele_caller`, `back_office`): Sales group,
  Today's Tasks, Purchase (PO list, EOD engine, vendors — read-mostly), Reports (daily sales,
  collection). Sales roles are excluded from the IGO daily-workflow routes by design
  (`DAILY_WORKFLOW_EXCLUDED_ROLES`).

## Diagnostics

```sql
SELECT source, count(*) FROM sales_orders WHERE order_date >= CURRENT_DATE - 7 GROUP BY 1;
SELECT count(*) FILTER (WHERE hub_id IS NULL) AS no_hub, count(*) FROM sales_orders WHERE order_date >= CURRENT_DATE - 7;
SELECT o.order_number FROM sales_orders o LEFT JOIN invoices i ON i.order_id = o.id WHERE i.id IS NULL AND o.status <> 'cancelled';  -- missing invoices
SELECT name, phone, count(*) FROM customers GROUP BY 1,2 HAVING count(*) > 1;                                                        -- duplicate customers
```

See also: `fferp-purchase` (what the EOD engine needs from orders), `fferp-database`
(columns; generated `net_amount`), `fferp-frontend`.
