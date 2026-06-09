# FF ERP — Final Run Order
Everything you need to run, in exact sequence.

---

## What's Already Done (skip these)
- ✅ COMPLETE_SCHEMA_MIGRATION.sql
- ✅ HUB_SEED.sql
- ✅ FIX_ROLES.sql
- ✅ FIX_RLS_ALL_ROLES.sql
- ✅ CREATE_MISSING_TABLES.sql

---

## What to Run Now (in this order)

### ⚠️ STEP 0 — Run This First (NEW — fixes policy conflict)
**File: `STEP_0_SAFE_POLICY_DROP.sql`**
Drops all existing RLS policies before Part1 runs.
**Why:** Part1 has 201 CREATE POLICY statements without DROP guards.
Since FIX_RLS_ALL_ROLES.sql was already applied, every policy already
exists and Part1 will fail with "policy already exists" without this step.
Safe to run — only removes policy rules, no data deleted.

After running: the `remaining_policies` count should show 0.

---

### Step 1 → Supabase SQL Editor → `qwiumswrbddwmlraktvy`
**File: `SCHEMA_PART1_FROM_MASTER.sql`**
Creates 72 tables from the ERP master schema:
audit_logs, chat tables, deduction_memos, demand_forecasts,
employee tables, escalations, lop_entries, qc_inspections,
qc_rejections, selfie_records, shift_breaks, sop_assignments,
transport tables, work_orders + more.

---

### Step 2 → Supabase SQL Editor (same DB)
**File: `SCHEMA_PART2_REMAINING.sql`**
- Fixes `purchase_entry_id` on ff_vendor_payments ← critical
- Adds missing columns to vendors, profiles, products
- Creates 60+ remaining tables (payslips, sops, departments,
  payroll, petty_cash, site_visit, cafe, vendor_master, rental supplements)
- Creates box auto-generation trigger (PO item → box label)
- Creates PE notification trigger (po_assignment → notification)
- Creates payment approval notification trigger

---

### Step 3 → Supabase SQL Editor (same DB)
**File: `EOD_PO_ENGINE.sql`**
Creates the `run_eod_po_engine(date)` PostgreSQL function.
This is the engine that:
- Reads today's orders
- Groups by product + hub
- Checks current inventory
- Creates purchase_orders + purchase_order_items
- Auto-generates box labels (via trigger)
- Assigns PEs to POs
- Sends notifications

Test it manually after running:
```sql
SELECT public.run_eod_po_engine(CURRENT_DATE);
```

---

### Step 4 → Deploy Edge Function (one-time)
**File: `supabase/functions/eod-po-engine/index.ts`**

```bash
# In terminal from D:\fferpv2 app\
supabase functions deploy eod-po-engine --project-ref qwiumswrbddwmlraktvy
```

Then go to: Supabase Dashboard → Edge Functions → eod-po-engine → Schedule
Set cron: `50 23 * * *` (runs at 11:50 PM every night)

---

## After All Steps — Test the Full Workflow

1. Place a test order on the website or manually in the ERP
2. Run `SELECT public.run_eod_po_engine(CURRENT_DATE);` to simulate EOD
3. Check purchase_orders table — should have a new PO
4. Check boxes table — should have auto-generated box labels
5. Log in as `purchase.pali@ffactory.com` — should see the PO in their dashboard
6. Check notifications table — PE should have received a notification

---

## Complete Table Count After All Steps
Expected: ~180+ tables covering:
- Scanner operations (boxes, inventory, delivery packs)
- Customer orders (sales_orders, customers, products)
- Purchase workflow (purchase_orders, vendors, ff_vendor_payments)
- Payment approvals (ff_vendor_payments, ff_transport_payments)
- Daily workflow (day_starts, eod_reports, leave_requests)
- HR/payroll (payslips, payroll, salary_batches)
- Cafe (cafe_orders, cafe_menu_items)
- Projects, rentals, site visits
- Chat, notifications, documents
