---
name: fferp-database
description: >
  Database skill for the Farmers Factory ERP (Supabase project qwiumswrbddwmlraktvy). Load it for ANY
  SQL, schema, table, column, RLS policy, CHECK constraint, migration, "add a column", "create table",
  "write a query", "rls", "permission denied", "row-level security", "column does not exist",
  "already exists", "schema cache", "generated column", types.ts regeneration, or when deciding whether a
  column the code references actually exists live. It carries the verified live-schema facts (which
  columns really exist vs. which only appear in stale migration files), the RLS helper functions, the
  migration file conventions, and the verify-before-use protocol. Use it even for "just a quick query"
  — quick queries against wrong column names are the #1 cause of silent empty pages in this ERP.
---

# FFERP — Database

## The one rule: the live database is the truth, not the files

This repo contains ~130 SQL files spanning several rewrites. Many describe columns or tables that were
**never applied** to production. The generated `src/integrations/supabase/types.ts` is also stale: it
has 157 tables but is missing 59 tables the app actually queries (every FF table: `sales_orders`,
`ff_vendor_payments`, `hubs`, `vendors`, `inventory`, `qc_inspections`, `boxes`, …). That is why 63
FF pages start with `// @ts-nocheck` and use `(supabase as any)` — there is no compile-time safety net.

So before you write a column name into code or SQL:

1. Check `references/live-schema-facts.md` — columns listed there were confirmed via
   `information_schema` or a live insert during real sessions (with the date).
2. If the column is not there, write a `CHECK_<TOPIC>.sql` (template below), ask the user to run it in
   the SQL Editor and paste the result. Do not guess from migration files.
3. Record what you learn: add the confirmed fact to `references/live-schema-facts.md` in the same
   change, so the next session does not re-pay the cost.

```sql
-- CHECK_<TOPIC>.sql — Run on: qwiumswrbddwmlraktvy → SQL Editor. Read-only.
SELECT column_name, data_type, is_nullable, column_default, is_generated
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = '<table>'
ORDER BY ordinal_position;

-- constraints (CHECK lists, FKs)
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'public.<table>'::regclass;
```

## Known live facts that bite (details in references/live-schema-facts.md)

| Table | Fact |
|---|---|
| `vendors` | GST column is `gst_number` (no `gstin`, no `pan`). Bank details exist in TWO pairs: `bank_name/bank_account/bank_ifsc` AND `account_number/ifsc_code` — different pages read different pairs, so writes go to both. |
| `profiles` | Name column is `name` (no `full_name`). Has `role, department, hub_id, ff_ops_access, ff_payment_access, is_active`. |
| `hubs` | `id, code, name, address, city, state, manager_name, channels[], status` — **no `location`**. |
| `sales_orders` | `net_amount` is GENERATED ALWAYS — never insert it. Has `delivery_charges`, `discount`, `total_amount`, `source`, `hub_id`, `hub_name`, `order_date`, `delivery_date`, `payment_mode`, `shift`. |
| `sales_order_items` | `product_name` text is what imports populate (join on `product_id` alone loses names). Has `discount_pct`, `qty`/`quantity`/`qty_kg` variants. |
| `ff_vendor_payments` | Status column is **`payment_status`** (not `status`). Amounts: `gross_amount`, `deduction_amount`, `net_amount` (generated) — no `total_amount`. Rejection: only `rejection_reason` exists (no `rejected_by/at/level`). Stage columns: `ff_ops_/l1_/gm_/auditor_/ceo_/admin_/accounts_` `_approved_by/_at`, `admin_remarks`, `accounts_remarks`. Proof: `payment_proof_url` + `payment_proof_urls[]`. Links: `vendor_id`, `purchase_order_id`, `hub_id`, `batch_id`, `created_by`, `utr_number`, `paid_at`. |
| `ff_transport_payments` | Same chain columns; amount = `base_amount + toll_charges + other_charges`. |
| `ff_payment_batches` | `batch_ref, payment_type, status(created/verified/processed), total_amount, payment_count, kotak_file_generated_at, statement_uploaded_at, processed_at, processed_by, created_by`. |
| `purchase_orders` | `status` CHECK = pending/assigned/purchasing/purchased/received/cancelled. Business date = `eod_date` (mirrored to `delivery_date`); `created_at` is insert time. Has `items` JSONB AND relational `purchase_order_items` — keep both in sync via `savePOToStore()`. `assigned_executive_id` nullable. |
| `vendor_payments` (older IGO table) | `created_by` has **no FK** to profiles → no PostgREST embed. Has `payment_deduction_lines` child (FK confirmed). No `admin_approved_at/director_approved_at`. |
| `shift_sessions`, `lop_entries` | Column names drifted from types.ts; see reference file before touching. |
| `hub_pincodes` | `hub_id, pincode, area_name`; routing trigger on `sales_orders` insert. |

## RLS — helper functions and policy templates

Security-definer helpers already live in the DB (use them; do not re-implement role checks inline):

```sql
public.get_my_role()               -- text, role of auth.uid()
public.has_ff_payment_access()     -- profiles.ff_payment_access
public.is_ff_payment_approver()    -- role IN (ff_operations_manager, gm, l1_manager, auditor, ceo, accounts, admin) OR flag
public.is_ff_payment_submitter()   -- role IN (hub_manager, shift_employee, purchase_manager, purchase_head, ff_operations_manager, admin) OR flag
public.has_elevated_role(), is_management_role(), is_executive()
```

Template for a new hub-scoped table (copy, rename, keep all four; each `DROP POLICY IF EXISTS` makes
re-runs safe):

```sql
ALTER TABLE public.<t> ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "<t>_admin_full" ON public.<t>;
CREATE POLICY "<t>_admin_full" ON public.<t> FOR ALL
  USING (public.get_my_role() IN ('admin','ceo','director'))
  WITH CHECK (public.get_my_role() IN ('admin','ceo','director'));

DROP POLICY IF EXISTS "<t>_ops_all_hubs" ON public.<t>;
CREATE POLICY "<t>_ops_all_hubs" ON public.<t> FOR ALL
  USING (public.get_my_role() = 'ff_operations_manager')
  WITH CHECK (public.get_my_role() = 'ff_operations_manager');

DROP POLICY IF EXISTS "<t>_hub_roles_own_hub" ON public.<t>;
CREATE POLICY "<t>_hub_roles_own_hub" ON public.<t> FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
                 AND p.role IN ('hub_manager','shift_employee') AND p.hub_id = <t>.hub_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
                 AND p.role IN ('hub_manager','shift_employee') AND p.hub_id = <t>.hub_id));

-- read-only for approvers / reporting roles, if relevant
DROP POLICY IF EXISTS "<t>_approvers_read" ON public.<t>;
CREATE POLICY "<t>_approvers_read" ON public.<t> FOR SELECT USING (public.is_ff_payment_approver());
```

Why `WITH CHECK` too: a `FOR ALL … USING` without `WITH CHECK` lets a hub user read but their
inserts fail with "new row violates row-level security policy" — a bug we have shipped.

Why not `USING (true)`: blanket policies were removed in `FIX_RLS_CLEANUP_BLANKET_POLICIES.sql`; the
security advisor flags them, and one hardening pass in Feb 2026 froze production because it dropped
INSERT/UPDATE policies while adding SELECT ones. Always cover every verb the app uses.

## Migration file conventions (this is how the user runs them)

- One purpose per file at repo root: `ADD_<what>.sql`, `FIX_<what>.sql`, `REFINE_<what>.sql`,
  `CHECK_<what>.sql`. Header comment: what/why, "Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor",
  and whether it is additive/destructive.
- Idempotent everywhere: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`,
  `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS` + `CREATE
  TRIGGER`, `DROP POLICY IF EXISTS` + `CREATE POLICY`.
- CHECK constraints: `DROP CONSTRAINT IF EXISTS` then re-add with the **superset** of values. Never
  remove a value a historical row might hold (see `REFINE_PAYMENT_APPROVAL_CHAIN.sql`).
- Data repairs: `UPDATE … WHERE` with the narrowest predicate; prefer `is_active = false` over
  `DELETE`; when many tables FK a row with mixed `ON DELETE` rules (vendors!), never automate a merge.
- End with a **verify block** (`SELECT column_name … information_schema` or a `GROUP BY status`
  count) so the user can paste back proof it applied.
- After the user confirms it ran, the commit body names the file and says it was applied.
- Never paste large schema files into chat; read them from disk with offsets.

## Error → fix reference

| Error | Cause / fix |
|---|---|
| `column X does not exist` / `Could not find the 'X' column … schema cache` | Column exists only in a migration file. Confirm live; either add it (`ADD COLUMN IF NOT EXISTS`) or change the code to the real column. |
| `cannot insert a non-DEFAULT value into column net_amount` | Generated column — remove it from the insert payload. |
| `violates check constraint <t>_status_check` | Value not in CHECK list — use an allowed value or extend the constraint additively. |
| `new row violates row-level security policy` | Policy lacks `WITH CHECK`, or user's `role`/`hub_id` on `profiles` doesn't match. Check the profile row first. |
| `permission denied for table` | No policy for this role/verb, or RLS enabled with zero policies (`FIX_RLS_NO_POLICY_TABLES.sql` pattern). |
| `PGRST200 … could not find a relationship` | Embed on a column with no FK. Add the FK (if data is clean) or fetch + merge client-side. |
| `PGRST205` / `42P01` relation does not exist | IGO-Chain table absent in this project — guard with `isMissingTable()`; do not toast. |
| `trigger/function/policy already exists` | Re-run of non-idempotent script — add the IF EXISTS/OR REPLACE guard, continue from the failing line, don't restart. |
| Query returns exactly 1000 rows | PostgREST cap — page with `.range()` (see `purchaseStore.fetchAllRows`). |
| Query silently returns `[]` | Almost always an error swallowed by `if (error) return []` — log it, then check the column list. |

## Diagnostic queries (paste-ready)

```sql
-- tables without RLS (security gap)
SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity=false ORDER BY 1;
-- policies on a table
SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename='<t>';
-- triggers on a table
SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid='public.<t>'::regclass AND NOT tgisinternal;
-- live definition of a function (sync EOD_PO_ENGINE.sql from this, never the other way)
SELECT pg_get_functiondef('public.run_eod_po_engine(date)'::regprocedure);
-- payments per stage
SELECT payment_status, count(*), sum(gross_amount) FROM ff_vendor_payments GROUP BY 1 ORDER BY 1;
-- POs per hub per business date
SELECT hub_name, eod_date, count(*) FROM purchase_orders GROUP BY 1,2 ORDER BY 2 DESC, 1;
-- cron jobs
SELECT jobid, schedule, command FROM cron.job;
```

## Regenerating types (when the user can run the Supabase CLI logged into the right account)

```bash
npx supabase gen types typescript --project-id qwiumswrbddwmlraktvy > src/integrations/supabase/types.ts
```

Until that happens, do not "fix" `@ts-nocheck` files by inventing types; keep `(supabase as any)`
and rely on live verification. When types are regenerated, expect many FF pages to surface real type
errors — fix them page by page, not with blanket casts.

See also: `references/live-schema-facts.md` (per-table verified columns), `fferp-backend` (functions,
triggers, cron), `fferp-debug` (symptom → cause protocol).
