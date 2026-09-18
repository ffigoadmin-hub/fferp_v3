---
name: fferp-warehouse
description: >
  Domain skill for receiving and stock in the Farmers Factory ERP — hub manager screens, gate entry
  and transit records, QC inspection (A/B/C/D grading, GRN, weight reconciliation, photos), QC
  rejections and vendor returns, deduction memos, inventory dashboards, boxes and the FF Scanner App,
  wastage / damage entries, low-stock alerts, and the inventory the EOD PO engine reads. Load it
  whenever the request mentions warehouse, QC, quality, grade, GRN, gate entry, transit, arrival,
  unloading, inventory, stock, box label, scanner, scan, wastage, damage, returns, rejection,
  min threshold, or the transit_records / qc_inspections / qc_rejections / inventory / boxes tables.
---

# FFERP — Warehouse, QC & Inventory

## Receiving flow (what happens at the hub)

```
vehicle arrives ─▶ Gate Entry (transit_records: status 'arrived', PO status → 'received')
                ─▶ QC Inspection per PO item (qc_inspections, GRN, grades, photos; transit → 'in_qc')
                     ├─ grade D > 0 ─▶ qc_rejections (return_status 'pending') ─▶ Returns / deduction memo against vendor
                     └─ accepted qty ─▶ inventory (trigger on receive) ; scanner app scans box labels ─▶ boxes.scanned + inventory
wastage / damage (during unloading and at EOD) ─▶ immediate inventory deduction (trg_inventory_wastage)
next EOD engine run reads inventory.quantity per hub/product
```

Roles: `hub_manager` ("My Hub" sidebar group: Warehouse Dashboard, Purchase Orders, PO Assignment,
PO History, QC Inspection, QC Rejections, Returns; plus Inventory group and Payments group),
`warehouse_manager` (lands on `/warehouse`), `qc_manager` (lands on `/warehouse/qc`),
`ff_operations_manager` (all hubs). Hub roles must be hub-scoped in every query.

## Gate entry / transit (`src/pages/transit/*`)

- `GateEntryPage.tsx` inserts `transit_records { po_id, hub_id, vehicle_number, vehicle_type,
  driver_name, transit_cost, notes, status:'arrived', created_by }` and updates the PO to
  `received` only if it is still in its earlier state (guarded `.eq('status', …)` so re-entry
  doesn't regress a PO).
- `TransitDashboard.tsx` KPIs count `arrived`, `in_qc`, `completed` for today; other observed
  values: `scheduled`, `received`, `in_progress`, `returned`. Treat the set as open — read the
  CHECK constraint before adding a value.

## QC inspection (`src/pages/warehouse/QCInspection.tsx`)

- Inputs: PO item (from `purchase_order_items` pending QC), vendor, product, gross/tare → net
  weight, grade split `grade_a_kg` (Premium) / `grade_b_kg` (Standard) / `grade_c_kg` (Fair) /
  `grade_d_kg` (Rejected), `overall_grade`, checklist, defect notes, photos (bucket `qc-photos`,
  public URLs stored in `photo_urls[]`).
- Hard rule enforced client-side: **graded total must equal net weight** (toast + block otherwise).
  Keep it — the acceptance %, rejection kg and vendor deductions all derive from it.
- GRN: `supabase.rpc('next_grn_number')`; fall back to `GRN-<timestamp>` only if the RPC fails
  (log it — a missing function means the sequence isn't deployed).
- Result `status`: `rejected` if only grade D, `partial` if some D, else `accepted`;
  `review_status: 'submitted'`. `acceptance_pct = (A+B+C)/net`.
- Side effects in the same submit: transit record `arrived → in_qc`; if D > 0 insert
  `qc_rejections { qc_inspection_id, vendor_id, product_id, rejected_kg, rejection_reason,
  return_status:'pending' }`.
- Warehouse Dashboard reads: pending QC (PO items without inspection), QC done today, stock
  products, low-stock alerts, and the day's A/B/C/D split.

## Rejections, returns, deductions

- `QCRejections.tsx` lists `qc_rejections` with vendor/product and lets the hub update
  `return_status` (pending → returned / credited…) — check the constraint before adding values.
- `ReturnsDashboard.tsx` covers customer-side `order_returns`.
- `DeductionMemos.tsx` → `deduction_memos` against a vendor; deductions show up as
  `deduction_amount` on the vendor's `ff_vendor_payments` (net = gross − deduction) — the link is
  by vendor/PO, not a FK to the memo; keep amounts consistent manually.

## Inventory — read this before touching it

Column naming is **unverified and inconsistent** in code: the live EOD engine reads
`inventory.quantity` (with `hub_id`, `product_id`), `WarehouseDashboard.tsx` reads `quantity,
min_threshold`, but `InventoryDashboard.tsx` reads `current_stock, min_stock_level` with
`product:products(...)`/`hub:hubs(...)` embeds. At most one pair can be right. Run:

```sql
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'inventory' ORDER BY ordinal_position;
SELECT hub_id, count(*), sum(quantity) FROM inventory GROUP BY 1;   -- adjust to the real column
```

and fix the page that is wrong; then record the truth in
`fferp-database/references/live-schema-facts.md`. Until then, don't add a third variant.

Inventory changes only through: scanner scans (boxes → inventory), the receive trigger, wastage
entries (`SmartInventoryPage`/`GMOperationsDashboard`), and explicit adjustments — never by
editing rows from a report. Every change should leave an `inventory_log` row where the table
exists.

## Boxes and the scanner app

- Labels are generated per hub + delivery date by `POBatchLabels.tsx` (`box_code
  FF-{HUB}-{YYYYMMDD}-{SEQ}`, `qr_data`, `product_name`, `hub_id`, `weight_kg`, `po_ref`,
  `status`, `pre_printed`); rows are inserted **before** the PDF is rendered so the scanner can find
  them.
- The FF Scanner App (separate codebase, same DB) reads `parsed.box_code` from the QR, marks
  `scanned=true, scanned_at`, and updates inventory. If scans "don't show", check the boxes rows
  exist with the exact code the label printed, and that realtime/publication includes `boxes` and
  `inventory`.
- `BoxLabelGenerator.tsx` (ad-hoc labels) and `SmartInventoryPage.tsx` are behind
  `ComingSoonOverlay` — coordinate before enabling.

## Hub manager extras that live here

- PO Assignment + PO History (see `fferp-purchase`): Chennai group manager covers both Chennai hubs.
- Discipline automation: hub-manager shift login after 07:15 IST → 0.10 pending LOP; no shift →
  1.0 pending LOP (see `fferp-backend`). If a hub manager complains about LOP, check
  `shift_sessions` for that date first.
- Hub managers can raise vendor/transport payments and create/edit POs (Aug 2026), and see a
  trimmed daily-workflow group (EOD summary, calendar, LOP, escalations, leave, payslip, requests).

## Diagnostics

```sql
SELECT status, count(*) FROM transit_records WHERE created_at::date = CURRENT_DATE GROUP BY 1;
SELECT grn_number, status, grade_a_kg+grade_b_kg+grade_c_kg+grade_d_kg AS graded, gross_weight_kg - tare_weight_kg AS net FROM qc_inspections ORDER BY created_at DESC LIMIT 20;
SELECT return_status, count(*) FROM qc_rejections GROUP BY 1;
SELECT hub_id, count(*) FILTER (WHERE scanned) AS scanned, count(*) FROM boxes WHERE created_at::date >= CURRENT_DATE - 1 GROUP BY 1;
```

See also: `fferp-purchase` (PO statuses, assignment), `fferp-backend` (receive/wastage triggers,
realtime), `fferp-database`.
