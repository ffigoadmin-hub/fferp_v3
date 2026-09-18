---
name: fferp-debug
description: >
  Root-cause debugging protocol for the Farmers Factory ERP. Load it the moment the user reports
  something wrong in the app — "not showing", "empty", "no data", "not loading", "blank", "missing
  from report", "wrong date", "wrong total", "can't see the button", "403", "permission denied",
  "column does not exist", "schema cache", "violates check constraint", "cannot insert non-DEFAULT",
  "duplicate", "stuck", "not saving", "shows Custom item", "shows Unknown", or pastes a screenshot /
  console error. It maps each symptom to the causes that have actually produced it in this codebase,
  gives the verification step (usually a CHECK_*.sql for the user to run), and insists on fixing the
  root cause and the class of bug, not the one instance.
---

# FFERP — Debugging protocol

## The stance

Most bugs reported in this ERP are **silent failures**: a query errored (wrong column, missing FK,
RLS) and the page rendered its empty state. The screen lies; the network tab and the database don't.
Assume that first, prove it second, and fix the *class* of bug (every place with the same pattern),
not just the reported instance — that's how the last 60 commits were made.

## Step 1 — get the real error

In order of speed:
1. The user's screenshot / toast text — it usually names the column or table verbatim.
2. Browser console + Network tab: look for `/rest/v1/<table>?select=…` responses with 4xx and read
   `message`, `code`, `hint`. (`PGRST` codes = PostgREST; `42xxx` = Postgres.)
3. Grep the page for `if (error)` — if it returns `[]`/`null`, add a `console.error('[Page] fn:',
   error.message)` and a visible error state *before* investigating further; that alone often ends
   the investigation.
4. Ask the user to run a `CHECK_*.sql` (see `fferp-database`) and paste the output.

## Step 2 — match the symptom

| Symptom | Real cause seen in this repo | Verify | Fix |
|---|---|---|---|
| List/report empty; "No X found" while rows exist | Query selected a non-existent column (`vendors.gstin`, `profiles.full_name`, `hubs.location`) or an embed without FK; error swallowed | Network 400; `CHECK` columns | Use the live column; throw on error; add error state |
| Only some days/rows appear in a report | Either (a) an unpaginated query hitting PostgREST's 1000-row cap, or — even on an already-paginated query — (b) `fetchAllRows` sorting only by `created_at`, which isn't unique for rows inserted in one transaction (EOD engine, batch imports), so a tied group at a page boundary can silently drop out. (b) confirmed live 2026-09-17, see `PURCHASE_ORDERS_PAGINATION_TIEBREAKER_BUG.md` | count(*) vs rows received; `GROUP BY created_at HAVING count(*)>1` for ties | `fetchAllRows` paging; add `.order('id', {ascending:true})` as a tiebreaker after `created_at` |
| PO/report "date" wrong; POs missing from a date range | Reading `created_at` (insert time) instead of `eod_date` (business date) | `CHECK_PO_DATE_VS_CREATED_AT.sql` | Read `eod_date ?? delivery_date ?? created_at` |
| Insert fails "cannot insert a non-DEFAULT value into column net_amount" | Generated column in payload | column `is_generated` | Remove from payload |
| "violates check constraint …_status_check" | UI offers a status the DB doesn't allow (`ordered`, `partial`, `approved`) | `pg_get_constraintdef` | Offer only CHECK values or extend constraint additively |
| "Could not find the 'rejected_at' column … schema cache" | Column exists only in migration files | `CHECK_FF_VENDOR_PAYMENTS_COLUMNS.sql` | Use `rejection_reason`; or add the column via migration |
| "new row violates row-level security policy" | Policy has `USING` but no `WITH CHECK`, or user's `profiles.role/hub_id` wrong, or role not in helper (`is_ff_payment_submitter`) | `pg_policies`; the user's profile row | Fix policy / profile; mirror in UI |
| 403 / "permission denied for table" | RLS enabled with no policy for that role/verb (a hardening pass once dropped INSERT/UPDATE) | `pg_policies` for the table | Add policy for every verb the app uses |
| "Could not find a relationship between X and Y" (PGRST200) | Embed on a column with no FK (`vendor_payments.created_by`) | `CHECK_VENDOR_PAYMENTS_FKS.sql` | Fetch + merge client-side, or add FK if data is clean |
| Item shows "Custom item" / requester "Unknown" | Select joined by FK only; the text column (`product_name`, `customer_name`, `name`) wasn't selected or alias mismatched | read the select | Select the text column; use the correct relationship alias |
| Vendor bank details blank though saved | Three known causes: (1) payment points at an empty duplicate vendor row; (2) only one of the two bank column pairs written; (3) **confirmed 2026-09-17** — the details were entered on `/purchase/vendors` (`PurchaseVendorsPage.tsx`), which saves to `localStorage` only and never touches Supabase at all (see `VENDOR_PAGE_LOCALSTORAGE_BUG.md`) | `CHECK_HYDERABAD_VENDOR_BANK_AUDIT.sql`; for (3) check whether the vendor row exists in `vendors` at all | (1)/(2): write both pairs; prefer vendor with bank details; `FIX_REPOINT_PAYMENT_VENDOR_IDS.sql`. (3): use the Purchase Report's inline Bank/IFSC cell instead (it is genuinely wired to Supabase) until `PurchaseVendorsPage.tsx` is fixed or `VendorManagement.tsx` is routed |
| Duplicate vendors/customers after import | Importer created a row per line for the same name | `GROUP BY name HAVING count(*)>1` | In-batch cache; deactivate duplicates (never delete) |
| Qty = 2023 / numbers inside item names | Zoho "2023-" group prefix parsed as qty | `WHERE quantity = 2023` | Parser: two-decimal numbers = qty/rate/amount; repair SQL validated against all rows |
| Customer name = "Order Date : …" | PDF two-column header interleaving | sample PDF | Walk past date/label lines; blank stays blank |
| User lands on wrong dashboard / bounced | Role spelling not in `mapRole` (falls back to `employee`); `ff_ops_access` on a non-sales role; route lacks the role; `SHIFT_ELIGIBLE_ROLES` | console "UNKNOWN ROLE"; `profiles.role` | Add mapping/role; fix flag; add role to route + sidebar |
| Sidebar link missing on phone but present on desktop | (Historic) separate mobile config — now unified | `MobileSidebar` imports `navigationConfig` | Add to `navigationConfig` only |
| Double notifications | Extra realtime listeners on payment tables | `useNotifications.ts` | Only listen on `notifications` |
| Approvals badge count ≠ list | Count and list computed from different filters/stages | compare `useFFPaymentCount` vs page filter | Derive both from the same status map and filter |
| Trigger/function "already exists" when running SQL | Non-idempotent script re-run | — | Add IF EXISTS / OR REPLACE; continue from failing line |
| Build fails: bare `import … from 'pdfjs-dist'` in dist | Package marked `external` in Rollup | `vite.config.ts` | Only `optimizeDeps.exclude`, never `rollupOptions.external` |
| Dev server "port in use" / wrong port | Another project on 8080/8081 | `netstat -ano \| findstr :8081` | Use 8081 (config + launch.json agree) |
| Login "Connection issue / network error" | `.env` missing or wrong key name (`VITE_SUPABASE_PUBLISHABLE_KEY`) or server not restarted after `.env` change | `.env`; process start time | Fix `.env`, restart `npm run dev` |
| Edge function "not found" | Never deployed to this project | Dashboard → Edge Functions | Deploy or don't build UI on it |
| Hub selector blank | `hubs` query errored (`location` column) and the error was discarded | Network 400 | Real columns + loading/error/empty states |

## Step 3 — fix the class, then the instance

Before writing the fix, grep for every other occurrence of the same pattern:

```bash
rg -n "gstin|full_name|\.location\b" src            # wrong-column class
rg -n "if \(error\) return \[\]|if \(error\) return null" src   # swallowed-error class
rg -n "\.from\('purchase_orders'\)" src | rg -v range          # unpaginated growth tables
rg -n "'approved'|'ordered'|'partial'" src/pages/reports src/pages/ff-operations   # illegal status literals
```

Fix all of them in the same commit when they are the same bug; note in the commit body which ones
were latent. Add a `CHECK_*.sql` that proves the live state and a `FIX_*.sql` if data must be
repaired. Prefer data repairs that are reversible (`is_active=false`, `UPDATE` with narrow `WHERE`).

## Step 4 — prove it

- Rebuild (`npx vite build`) and reproduce in the app as the affected role.
- For SQL fixes, the verify block's output pasted by the user is the proof (e.g. "0 rows at
  quantity = 2023").
- For "missing rows" bugs, compare `count(*)` in SQL with the count the page shows.

## Step 5 — write it down

Commit body: what the user saw → what was actually wrong → why it was wrong → the fix → what else
was affected → which SQL the user must run (see `fferp-release`). If the finding changes a schema
fact, add it to `fferp-database/references/live-schema-facts.md`.

## Don'ts (each has cost real time)

- Don't patch a symptom in one page when the same column/pattern exists in five.
- Don't add a column because a migration file says it should exist — confirm live first.
- Don't "fix" empty results by loosening RLS to `true`.
- Don't run `run_eod_po_engine`, batch marks, or bulk deletes against production as a test.
- Don't trust `types.ts` for FF tables; it doesn't contain them.
