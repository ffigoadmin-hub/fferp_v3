---
name: fferp-core
description: >
  Master context for the Farmers Factory ERP (FFERPv2 / fferp_v3 repo, IGO Group). Load this FIRST for
  ANY work in this repository — bug fixes, new pages, SQL, reports, questions about how a module works,
  "continue the erp", "fix the fferp", "farmers factory", "hub manager", "purchase executive",
  "ops manager", "EOD PO", "vendor payment", "execution desk", "purchase report", "bulk order",
  or any mention of D:\FF ERP, fferp_v3, Supabase project qwiumswrbddwmlraktvy. It gives the
  architecture, the three hubs, every role, the daily supply-chain cycle, the module → file map, the
  non-negotiable engineering rules, and which specialised fferp-* skill to load next. Use it even when
  the request looks small — small changes in this codebase have broken production before because the
  agent did not know the rules here.
---

# FFERP — Core Project Context

You are working as a senior ERP engineer on the Farmers Factory ERP. This skill is the map; the
other `fferp-*` skills are the detailed manuals. Read this once per session, then load the skill(s)
for the area you are touching:

| You are about to… | Load |
|---|---|
| Write or change SQL, RLS, tables, columns, migrations, fix a DB error | `fferp-database` |
| Touch Postgres functions, triggers, pg_cron, edge functions, storage, notifications | `fferp-backend` |
| Build or change a page, route, sidebar entry, hook, query in React | `fferp-frontend` |
| Anything about vendor / transport payments, approval chain, Accounts payout, batches | `fferp-payments` |
| EOD PO engine, purchase orders, PO assignment, Buy flow, vendors, PO import, Purchase Report | `fferp-purchase` |
| Sales orders, invoices, customers, bulk / PDF order import, tele-caller, collections | `fferp-sales` |
| Warehouse, QC, transit, inventory, boxes, scanner, returns, hub manager screens | `fferp-warehouse` |
| Debug "data not showing", "column does not exist", 403, silent failures, wrong numbers | `fferp-debug` |
| Build a brand-new page/module/role that doesn't exist yet | `fferp-module-builder` |
| Change or extend something that already exists (add a stage, modify a chain, insert a step) | `fferp-refinement` |
| Verify a change works before shipping it, especially anything that writes data | `fferp-testing` |
| Commit, build, deploy, env, types regen, hand-off notes | `fferp-release` |

## 1. What this system is

One React codebase + one Supabase database hosting **two ERPs**:

- **Farmers Factory (FF) ERP** — fresh-produce supply chain: orders → EOD purchase orders → market
  buying by hub → vendor payment approval chain → receiving/QC → live inventory → payout/reports.
  This is where almost all active development happens.
- **IGO Chain ERP** — governance (daily workflow, escalations, HR/payroll, projects, rentals, site
  visits, cafe). Mostly stable; FF hub roles share its trimmed daily-workflow items, LOP and payslips.

Three clients hit the same database: the **web ERP** (this repo), a **React Native mobile app**, and
the **FF Scanner App** (scans box labels at the hub → creates `boxes` rows, updates `inventory`).

## 2. Stack and environment (facts, not defaults)

| Item | Value |
|---|---|
| Frontend | React 18.3, TypeScript 5.8, Vite 5.4, TailwindCSS, shadcn/ui, TanStack Query 5, react-router 7 |
| Data | `@supabase/supabase-js` 2.89 — the ONLY client is `src/integrations/supabase/client.ts` |
| DB | Supabase Postgres, project ref `qwiumswrbddwmlraktvy`, RLS on every table |
| Hosting | Vercel (`vercel.json`: `npm install --legacy-peer-deps`, `vite build`, SPA rewrite) |
| Dev | `npm run dev` → http://localhost:8081 (port set in `vite.config.ts` and `.claude/launch.json`) |
| Env | `.env` (gitignored): `VITE_SUPABASE_URL`, **`VITE_SUPABASE_PUBLISHABLE_KEY`** (the key the code reads), `VITE_SUPABASE_ANON_KEY`, `VITE_APP_BASE_URL` |
| Build check | `npx vite build` (≈75 s). Do not use `tsc --noEmit` as a gate — it runs >10 min on this repo |
| Types | `src/integrations/supabase/types.ts` is **stale**: 59 tables the app uses (all FF tables) are missing from it — see `fferp-database` |
| Repo | https://github.com/ffigoadmin-hub/fferp_v3.git, branch `main` |

## 3. Hubs — every FF row belongs to one

| Code | Hub | City | Channels |
|---|---|---|---|
| HUB-1 | Palikarani Hub (also spelled Pallikaranai in data) | Chennai | FF, DMart |
| HUB-2 | Vanagaram Hub | Chennai | FF, DMart, Blinkit, Zepto |
| HUB-3 | Hyderabad Hub | Hyderabad | FF, DMart, Zepto |

- Source of truth is the `hubs` table (`id, code, name, address, city, state, manager_name, channels, status`).
  There is **no `location` column** — that bug has shipped before.
- Orders get `hub_id` from customer pincode via a trigger on `sales_orders` (`hub_pincodes`, exact
  match then prefix fallback). Some historical rows have `hub_id = NULL`; code that lists orders must
  tolerate that (fuzzy hub-name matching exists in `POBatchLabels.tsx` and `POAssignment.tsx`).
- One hub manager (Anto) covers both Chennai hubs even though his profile has one `hub_id` — this is a
  code-level mapping in `POAssignment.tsx`, not a schema feature.

## 4. Roles (exact strings as stored in `profiles.role`)

FF roles: `ff_operations_manager`, `hub_manager`, `shift_employee` (= Purchase Executive),
`warehouse_manager`, `qc_manager`, `field_executive`, `bde`, `tele_caller`, `driver`, `back_office`,
`collection_executive`, `l1_manager`, `purchase_manager`, `purchase_head`.
Shared / IGO roles that matter to FF: `admin`, `ceo`, `accounts`, `gm`, `auditor`, `hr`, `director`.

Landing pages live in `src/pages/RedirectPage.tsx`; role guards in `src/App.tsx` (`ALL_STAFF_ROLES`,
`OPS_ROLES`, `DAILY_WORKFLOW_ROLES`); nav in `src/components/layout/Sidebar.tsx` (single source for
desktop AND mobile). `AuthContext.mapRole()` normalises role spelling; an unknown role logs an error and
falls back to `employee` — which is how "user sees the wrong dashboard" bugs usually start.

Profile flags that change access without changing role:
- `ff_ops_access` — sales-side users (`field_executive`/`bde`/`tele_caller` only) get the Ops-Manager UI.
- `ff_payment_access` — named individuals may raise/approve FF payments (routes in `FF_PAYMENT_ACCESS_ROUTES`).
- `hub_id` — required on hub managers and purchase executives; drives every hub filter and RLS policy.

## 5. The daily cycle (know this before touching any FF module)

```
[1] Orders in  (app / website / NewOrder / BulkOrder CSV-XLSX-PDF)          → sales_orders + items
[2] Trigger routes hub by pincode; invoiceHelper creates INV-YYYYMMDD-XXXXXX → invoices
[3] EOD PO Engine  run_eod_po_engine(date)  (DB function, nightly 23:50 / manual)
      demand per hub+product − inventory = shortfall → purchase_orders (status pending, eod_date) + items
[4] Hub manager assigns PO → purchase exec  (POAssignment.tsx, po_assignments, notification)
[5] Purchase exec Buys  (BuyPage.tsx vendor cart, photos, slip)
      → purchase_entries(+items), PO items updated, ff_vendor_payments row at pending_ff_ops
[6] Approval chain  Manager → L1 → Admin → CEO → Accounts → paid   (reject at any stage)
[7] Goods arrive: transit_records (gate entry) → qc_inspections A/B/C/D → qc_rejections/returns
      scanner app → boxes + inventory; wastage entries deduct inventory
[8] Accounts pays (Mark Paid w/ UTR, or Execution Desk batch → Kotak file → statement → paid)
      Reports: Purchase, FF Payments, Sales, Inventory, P&L, Delivery, Collection
```

## 6. Module → file map (start here, don't grep blindly)

| Module | Pages | Logic |
|---|---|---|
| Routes / guards | `src/App.tsx` (1006 lines, lazy imports) | `ProtectedRoute`, role arrays |
| Sales | `src/pages/sales/{NewOrder,BulkOrderPage,OrderListPage,OrderDetail,SalesDashboard,CustomerManagement,AppOrdersDashboard,TaskToday}.tsx` | `src/lib/invoiceHelper.ts`, `src/lib/salesOrderImportParser.ts` |
| Tele-caller | `src/pages/tele-caller/*` | tables `call_logs`, `followup_reminders` |
| EOD / PO | `src/pages/ff-operations/po-engine/EODPOEngine.tsx`, `src/pages/ff-operations/purchase/PurchaseOrdersPage.tsx` | `src/lib/purchaseStore.ts`, `EOD_PO_ENGINE.sql` |
| PO assignment | `src/pages/warehouse/{POAssignment,POAssignmentHistory}.tsx` | `po_assignments` |
| Buy | `src/pages/ff-operations/purchase/{BuyPage,POBuysReview}.tsx` | `src/lib/buyStore.ts` |
| Vendors | `src/pages/ff-operations/purchase/PurchaseVendorsPage.tsx`, `src/pages/purchase/VendorManagement.tsx` | `src/lib/vendorStore.ts`, `src/lib/poImportParsers.ts` (`matchVendor`, `normName`) |
| Payments raise | `src/pages/ff-operations/{FFVendorPaymentForm,FFTransportPaymentForm,MySubmittedPayments}.tsx` | |
| Payments approve | `src/pages/ff-operations/FFPaymentApprovals.tsx` (chain constants exported here) | `src/hooks/useFFPaymentCount.ts` |
| Accounts payout | `src/pages/accounts/{ExecutionDeskPage,BatchHistoryPage}.tsx` | `src/lib/ffPaymentBatchExport.ts` |
| Reports | `src/pages/reports/{PurchaseReportPage,FFPaymentsReport,…}.tsx` | |
| Warehouse/QC | `src/pages/warehouse/*`, `src/pages/transit/*` | buckets `qc-photos`, `payment-proofs` |
| Ops command | `src/pages/ff-operations/{FFOperationsHomePage,TaskAssign}.tsx`, `gm/GMOperationsDashboard.tsx` | |
| Admin | `src/pages/admin/{UserManagementPage,HubManagementPage,AdminShiftUserManagementPage,AdminShiftAttendancePage}.tsx` | `supabase/functions/{create-user,delete-user,reset-user-password}` |
| Auth | `src/contexts/AuthContext.tsx`, `src/pages/RedirectPage.tsx`, `src/pages/LoginPage.tsx` | |

Root-level `*.sql` files are one-off scripts the user runs in the Supabase SQL Editor:
`CHECK_*.sql` = diagnostics, `FIX_*.sql` = repairs, `ADD_*.sql` / `REFINE_*.sql` = additive migrations.
`CLAUDE_CODE_HANDOFF.md` = architecture hand-off (its work queue is stale; its sections 3–6 are still right).
The root `README.md` is a stray Supabase-CLI readme — ignore it.

## 7. Non-negotiable engineering rules (each one exists because of a real incident)

1. **Verify columns against the live DB before using them.** Migration files in this repo have
   repeatedly described columns that never existed live (`rejected_at`, `admin_approved_at` on
   `vendor_payments`, `vendors.gstin/pan`, `hubs.location`, `profiles.full_name`). A wrong column makes
   PostgREST error, and most pages swallow that error and show "No data". Write a `CHECK_*.sql` and ask
   the user to run it, or read an existing verified fact in `fferp-database`.
2. **Never swallow query errors.** `if (error) return []` is how 7 real payments sat invisible for
   days. Surface errors (toast + console) unless the table legitimately may not exist (`isMissingTable`).
3. **Hub scoping.** Every purchase-exec and hub-manager query filters by `hub_id`; every new table
   with hub data gets hub-scoped RLS.
4. **Status strings are exact.** Payment: `pending_ff_ops → pending_l1 → pending_admin → pending_ceo →
   pending_accounts → paid | rejected`. PO: `pending, assigned, purchasing, purchased, received,
   cancelled` (DB CHECK constraint). Never invent values; extend constraints additively.
5. **Never hard-delete business rows.** Use `status` / `is_active`. The only deletes that exist are
   deliberate (submitter deleting their own `pending_ff_ops` payment; admin bulk-deleting unpaid POs).
6. **Generated columns are read-only.** `sales_orders.net_amount`, `ff_vendor_payments.net_amount`
   are `GENERATED ALWAYS` — inserting them fails the whole insert.
7. **PostgREST caps unpaginated queries at 1000 rows silently.** Use `fetchAllRows`-style paging
   (`purchaseStore.ts`) for anything that can grow.
8. **Embeds need real FKs.** `vendor_payments.created_by` has no FK to `profiles`, so
   `creator:profiles(...)` can never work — fetch and merge client-side.
9. **One Supabase client.** `src/modules/hr-payroll/integrations/supabase/client.ts` is deprecated dead code.
10. **RLS before use.** New table → policies in the same script (template in `fferp-database`).
11. **Migrations are idempotent and additive** (`IF NOT EXISTS`, `DROP POLICY IF EXISTS` + `CREATE`,
    `CREATE OR REPLACE FUNCTION`, extend CHECK lists never shrink them) and end with a verify `SELECT`.
12. **Audit.** Admin/approver actions stamp `<stage>_approved_by/_at` and, for admin data changes,
    write `audit_logs` with before/after.
13. **Write it down.** Commit bodies explain root cause + fix (see `fferp-release`). SQL that the user
    must run is named in the commit and its file is committed.

## 8. How the user works with you

- The user runs SQL for you in the Supabase SQL Editor and pastes results back; the Supabase MCP in
  this environment is usually connected to a different account, so do not assume you can query live.
- They test in the real app on port 8081 and paste screenshots. Read the screenshot carefully: the
  error text usually names the exact column/table.
- They prefer root-cause fixes over patches, minimal blast radius, and detailed commit messages.
- Dates in docs/commits are absolute (e.g. 2026-09-15), matching the repo's own history.
