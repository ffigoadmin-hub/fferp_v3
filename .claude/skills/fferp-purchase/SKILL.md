---
name: fferp-purchase
description: >
  Domain skill for procurement in the Farmers Factory ERP — the EOD PO Engine, purchase orders and
  their status lifecycle, purchaseStore (rowToPO / poToPayload / fetchAllRows / savePOToStore), hub
  manager PO Assignment, the purchase executive Buy flow (vendor cart, partial buys, photos, purchase
  entries), vendors (dual bank columns, fuzzy matching, duplicate cleanup), PO import from Zoho-style
  PDF / CSV / XLSX, box labels, and the Purchase Report page. Load it whenever the request mentions
  PO, purchase order, EOD, shortfall, assign PO, purchase executive, buy page, vendor cart, vendor
  bank details, PO import, Zoho, purchase report, eod_date, "PO date wrong", "PO missing from
  report", "duplicate vendors", box labels, or purchase_orders / purchase_order_items /
  purchase_entries / vendors tables.
---

# FFERP — Purchase domain

## PO lifecycle

```
sales_orders (day D, per hub) ─EOD engine─▶ purchase_orders {status:'pending', eod_date:D, assigned_executive_id:NULL}
                                             └ purchase_order_items {required_qty = shortfall, status:'pending'}
hub manager assigns ─▶ assigned_executive_id + po_assignments row (+ notification)     (PO status 'assigned')
purchase exec Buys  ─▶ purchase_entries(+items), PO items ordered_qty/unit_price/status, ff_vendor_payments @ pending_ff_ops
goods arrive        ─▶ transit_records / QC / inventory                                  (PO status 'received')
```

`purchase_orders.status` CHECK: `pending | assigned | purchasing | purchased | received | cancelled`.
`purchase_order_items.status` CHECK: `pending | fulfilled_by_stock | purchased | received` — there is
**no `partial`**; "partial" is derived in UI from `ordered_qty < required_qty`. Status dropdowns
must offer only these values (a wider list shipped once and every save failed the constraint).

Dates: `eod_date` is the business date (the day's orders it was generated for); `delivery_date`
mirrors it on write; `created_at` is insert time and clusters on catch-up import days. Reports,
filters, and batch date filters use `eod_date` (`purchaseStore.rowToPO()` maps `date = eod_date ??
delivery_date ?? created_at`).

## EOD PO Engine — what the live function actually does

`public.run_eod_po_engine(p_date date)` (snapshot: `EOD_PO_ENGINE.sql`, synced 2026-07-24):

1. For `sales_orders` on `p_date`, not cancelled, with `hub_id IS NOT NULL`, join items, products,
   hubs, and `inventory` on (hub_id, product_id).
2. Group by hub + product: `total_required = SUM(COALESCE(qty_kg, quantity))`, `current_stock =
   MAX(inventory.quantity)`, `shortfall = GREATEST(0, required − stock)`, `avg_price = AVG(unit_price)`.
3. For each row with shortfall > 0: find-or-create one `purchase_orders` row per hub for that
   `eod_date` with status `pending`; insert a `purchase_order_items` row (`ON CONFLICT DO NOTHING` —
   dedup constraint from `FIX_EOD_ENGINE_DEDUP_CONSTRAINT.sql`).
4. Recompute `total_estimated`, `total_amount`, `items_count` on the day's pending POs.
5. Returns `{date, pos_created, items_created, message}`. **No auto-assignment** (removed 2026-07-24).

Consequences you must respect:
- Orders with `hub_id = NULL` are invisible to the engine → hub routing correctness is a purchasing
  problem, not just a sales one. `FIX_HUB_ID_BACKFILL_2.sql` shows the backfill pattern.
- Running it creates real POs. Never run against production for testing without sign-off; use a
  past date only if you are sure no POs exist for it.
- The UI page (`EODPOEngine.tsx`) previews demand and can also build POs client-side via
  `purchaseStore.createPOsFromSalesOrders()`; defaults to **yesterday** because EOD processes the
  prior day's orders (`POBatchLabels` too).
- The nightly cron may or may not be scheduled — verify with `SELECT * FROM cron.job` before
  promising automation.

## purchaseStore.ts — the only way to read/write POs from React

- `fetchAllRows(table, extra)` pages in 1000s; use it (or copy it) for anything unbounded.
  ⚠️ **Latent gap confirmed 2026-09-17**: it sorts only by `created_at`, which is not unique — rows
  inserted in the same transaction (e.g. `run_eod_po_engine`'s one-insert-per-hub loop, or a batch
  import) share one identical timestamp. Offset pagination has no guaranteed stable order across a
  tied group, so a tied batch landing on a `PAGE_SIZE` boundary can silently drop out of the combined
  result — the exact "some POs from one day are missing from the report but a direct SQL query sees
  them" symptom. Fix is a one-line secondary sort key: `.order('id', { ascending: true })` after the
  `created_at` order. See `PURCHASE_ORDERS_PAGINATION_TIEBREAKER_BUG.md` at repo root.
- `rowToPO(row)` → `StoredPO` (camelCase view model); `poToPayload(po)` → DB row (writes `eod_date`
  and `delivery_date`, skips `hub_id` when it is the sentinel `'unassigned'` — a UUID column rejects it).
- `savePOToStore(po)` upserts `purchase_orders` **and** rewrites `purchase_order_items` so the JSONB
  `items` and the relational rows stay in sync. Manual PO create/edit, PO import, and status edits all
  go through it. Do not update `items` JSONB alone.
- `fetchOpenPOs()` / `fetchPendingApprovalPOs()` filter on statuses the CHECK doesn't allow
  (`approved`, `pending_approval`) — legacy dead paths; don't build on them.
- `fetchMaxPOSerial()` for `po_number` sequencing on manual creation.

## PO Assignment (hub manager)

`src/pages/warehouse/POAssignment.tsx`: lists POs where `assigned_executive_id IS NULL AND status <>
'cancelled'` for the manager's hub(s), with items via
`items:purchase_order_items(id, product_name, item_name, required_qty, unit, estimated_price)`.
Assign = `update purchase_orders set assigned_executive_id` + insert `po_assignments {po_id, hub_id,
purchase_executive_id, status:'assigned'}` (fires `trg_notify_pe`).

Chennai group rule: Anto (`anto@ffactory.com`) manages both Chennai hubs; the page hardcodes the two
hub UUIDs in `CHENNAI_GROUP_HUB_IDS` and offers the combined Chennai executive pool. This is a
deliberate code-level mapping — if hubs or the manager change, update the constants, don't add a
schema column.

`POAssignmentHistory.tsx` shows assigned/pending by day. `POBuysReview.tsx` (Ops Manager) audits
what was bought per PO with photos.

## Buy flow (purchase executive)

`src/pages/ff-operations/purchase/BuyPage.tsx` (+ `src/lib/buyStore.ts`):

- Shows POs assigned to `user.id` (hub name on cards for multi-hub executives) with `required_qty`
  vs `ordered_qty` per item.
- One **vendor cart** per save: vendor (existing → bank auto-fill; or new inline), multiple items
  with qty + rate + item photo (`item_photo_url`, optional `scale_photo_url`), one shared payment slip
  (`receipt_url`) into `payment-proofs`.
- On save, in order: upload photos → insert `purchase_entries` + `purchase_entry_items`
  (`po_item_id` link) → for each cart line update `purchase_order_items` (`ordered_qty += qty`,
  `unit_price`, `total_price`, `status = ordered >= required ? 'purchased' : 'pending'`) → insert
  `ff_vendor_payments` at `pending_ff_ops` with the cart as `items` JSONB and `purchase_order_id`.
  Any step's error aborts with a message naming the product.
- Partial quantities across several vendors are normal: multiple carts per PO, each its own payment.
- Ops Manager must have write access to `purchase_order_items` (fixed by
  `FIX_PURCHASE_ORDER_ITEMS_RLS_GAP.sql`) — if a save fails with RLS for a non-executive, that's why.

## Vendors

- ⚠️ **`/purchase/vendors` (`PurchaseVendorsPage.tsx`) does not persist to the database.** Confirmed
  2026-09-17: it has no `supabase` import at all — `loadVendors()`/`persistVendors()` read and write
  `localStorage['ff_erp_vendors_v1']` only, seeded from a hard-coded `DEMO_VENDORS` array. Anyone
  entering bank details there believes it saved (the form closes, the row appears) but nothing
  reaches `vendors`, so it's invisible on the Purchase Report, payment forms, and Execution Desk.
  `src/pages/purchase/VendorManagement.tsx` is a correctly Supabase-backed vendor CRUD page but is
  imported in `App.tsx` with **no `<Route>`** rendering it — dead code today. Until one of these is
  fixed/routed, the only vendor-bank-detail path that actually works is the Purchase Report's own
  inline **Bank/IFSC** cell (`BankDetailsCell`). See `VENDOR_PAGE_LOCALSTORAGE_BUG.md` at repo root
  for the full diagnosis and a ready-to-apply fix for either page.
- Table `vendors`: `gst_number` (no gstin/pan), **two bank pairs** — `bank_account/bank_ifsc`
  (vendorStore, PO pages, Purchase Report) and `account_number/ifsc_code` (BuyPage, Execution Desk).
  Every write sets both; every read falls back across both.
- Matching free-text PO vendor names ("MS. KRP TRADERS") uses `matchVendor(raw, vendors)` from
  `poImportParsers.ts` (normalised via `normName`) — never exact string equality. Among same-named
  rows prefer the one that has bank details.
- Batch imports used to create one vendor per row of the same name; the importers now keep an
  in-batch cache. Existing duplicates: `FIX_CLEANUP_DUPLICATE_VENDOR_ROWS.sql` sets `is_active=false`
  on all but the row with bank details; `FIX_REPOINT_PAYMENT_VENDOR_IDS.sql` re-points payments to
  it. Never merge/delete vendor rows automatically — FK `ON DELETE` rules are inconsistent.
- Static (pre-loaded, verified) vs dynamic (created in the field) vendors are both just `vendors`
  rows; `is_verified` lives on the IGO `vendor_master`, not here.

## PO import (Ops / hub manager) — `PurchaseOrdersPage.tsx` → `poImportParsers.ts`

- Hub must be chosen **before** the file input enables; parsed rows default to it.
- PDF (Zoho export): `extractPageLines` (pdfjs, Y-sorted), `parseItemRows`. Row shapes learned the
  hard way: Zoho item names carry an integer group prefix (`2023-TOMATO`) so "first number = qty" is
  wrong; qty/rate/amount are the **two-decimal** numbers; a Disc% column may sit between rate and
  amount (4-number shape → validate `qty × rate × (1 − disc/100) = amount`); amounts may contain
  commas; rate may be multi-decimal. The rate is trusted only when `qty × rate = amount`.
- CSV/XLSX via papaparse/xlsx → same `ParsedPO` shape. `parsePOFile` dispatches by extension.
- Review screen: vendor/hub fuzzy match, editable items, total-mismatch warning, in-batch vendor
  cache; commit via `savePOToStore`.
- Repairs for rows imported before a parser fix live in `FIX_IMPORTED_ITEMS_2023_PREFIX.sql` (v3):
  regex-pull the numbers back out of the stored name. Validate any such regex against all affected
  rows (`SELECT … WHERE quantity = 2023`) before writing the UPDATE.
- Build note: `pdfjs-dist` must not be in `rollupOptions.external` (removed 2026-08-27) — it is only
  in `optimizeDeps.exclude`.

## Purchase Report (`/reports/purchase`, `PurchaseReportPage.tsx`)

Features and the rule behind each:
- Filters: PO date range on `eod_date`, hub, status. Data via `fetchAllPOs()` (paged).
- Columns: "PO / Delivery Date" (`PO: … / Del: …`), hub, vendor, editable **Bank / IFSC** cell
  (`BankDetailsCell` — writes both bank pairs, creates the vendor if none matches, patches the vendor
  cache synchronously so the row updates instantly), click-to-edit **Status** (`StatusCell`, CHECK
  values only), sticky **Approval** column (`ApprovalCell` — reads the linked `ff_vendor_payments`
  stage; inline Approve when it is the viewer's stage; **Raise & Approve** for Ops Manager when no
  payment exists; Accounts stage links to the full page).
- Select-and-delete (admin/gm/ceo/ff_operations_manager): confirm with count + value; paid POs are
  unselectable; deletes line items and any **unpaid** payment raised against the PO.
- Excel export includes hub.

## Box labels

`POBatchLabels.tsx`: select hub + delivery date (defaults to yesterday) → aggregates the hub's orders
(3-pass hub match: `hub_id`, then fuzzy hub name for null-hub orders) → box counts → inserts `boxes`
rows then renders one PDF of QR labels (`box_code FF-{HUB}-{YYYYMMDD}-{SEQ}`). The scanner app reads
`parsed.box_code` for pre-printed QR. `BoxLabelGenerator.tsx` is behind `ComingSoonOverlay`.

## Diagnostics

```sql
SELECT hub_name, eod_date, count(*), sum(total_amount) FROM purchase_orders GROUP BY 1,2 ORDER BY 2 DESC;  -- CHECK_DAILY_PO_COUNTS_BY_HUB.sql
SELECT id, po_number, eod_date, created_at::date FROM purchase_orders WHERE eod_date <> created_at::date;  -- CHECK_PO_DATE_VS_CREATED_AT.sql
SELECT name, count(*) FROM vendors WHERE is_active GROUP BY 1 HAVING count(*) > 1;                          -- duplicates
SELECT * FROM purchase_orders WHERE assigned_executive_id IS NULL AND status = 'pending' ORDER BY eod_date;  -- awaiting assignment
```

See also: `fferp-payments` (the payment a Buy creates), `fferp-warehouse` (receiving),
`fferp-database` (columns/constraints), `fferp-backend` (engine function sync rule).
