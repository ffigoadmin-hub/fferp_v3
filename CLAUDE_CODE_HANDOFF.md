# FFERPv2 — Claude Code Handoff

> Paste this whole file as your opening prompt in Claude Code, or keep it at repo root
> and let Claude Code read it. It contains full project context, the four FFERPv2 skills,
> everything done so far in the Cowork session, and the open work queue.

---

## PART 0 — OPENING PROMPT (paste this to Claude Code)

```
You are taking over the FFERPv2 project (Farmers Factory ERP + IGO Chain ERP, IGO Group).

Repo root: D:\Gokulraaj Data\FFerp
Remote:    https://github.com/ffigoadmin-hub/fferp_v3.git  (branch: main)

Read CLAUDE_CODE_HANDOFF.md at repo root before doing anything. It contains:
  - full project architecture and the 8-stage FF supply chain
  - the complete database schema, payment status machine, and RLS templates
  - the four FFERPv2 skill documents (workflow / database / feature-builder / db-fix)
  - a log of everything changed in the prior session
  - the current open work queue

Rules: follow "Agent Rules — Non-Negotiable" in Section 3.8 exactly. Never paste large
SQL files into context. Always filter by hub_id for purchase exec and hub manager queries.
Never invent payment status strings.

Start by confirming the project builds: npm install && npm run dev
```

---

## PART 1 — ENVIRONMENT & HOW TO RUN

### Stack

| Field | Value |
|---|---|
| Project | FFERPv2 (Farmers Factory ERP + IGO Chain ERP) |
| Org | IGO Group / IGO Precision Farming Pvt. Ltd. |
| Frontend | React 18.3 + TypeScript 5.8 + Vite 5.4 + TailwindCSS + shadcn/ui |
| Data | `@supabase/supabase-js` ^2.89 + `@tanstack/react-query` ^5.83 |
| Backend | Supabase PostgreSQL — project ref `qwiumswrbddwmlraktvy` |
| Mobile | React Native (Expo) — same Supabase DB |
| Scanner | Separate app — same Supabase DB, live inventory updates |
| Hosting | Vercel (web) + Expo EAS (mobile) |
| Local root | `D:\Gokulraaj Data\FFerp` (OneDrive-synced) |
| Entry | `src/App.tsx` — all routes + role guards (~82KB) |
| Pages | 50 module folders under `src/pages/` |

### Run locally (Windows PowerShell)

```powershell
cd "D:\Gokulraaj Data\FFerp"
Remove-Item -Recurse -Force node_modules   # existing one is a broken Linux install
npm install
npm run dev                                 # → http://localhost:8080
```

Scripts: `dev` · `build` · `build:dev` · `lint` · `preview`

### Environment variables

`.env` already exists at repo root with **real, working credentials** and is gitignored
(`.gitignore` line 37). Do not overwrite it.

```
VITE_SUPABASE_URL=https://qwiumswrbddwmlraktvy.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   ← this is the one the code reads
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJI...
VITE_APP_BASE_URL=http://localhost:8080
```

⚠️ **Known trap:** `.env.example` documents `VITE_SUPABASE_ANON_KEY`, but
`src/integrations/supabase/client.ts` and `LoginPage.tsx` read
`VITE_SUPABASE_PUBLISHABLE_KEY`. Copying `.env.example` → `.env` literally produces a
dead DB connection. Fix `.env.example` or leave `.env` alone.

### Gotchas found while setting up

- `node_modules` currently in the folder is a partial **Linux** install (missing rollup
  native binary). Must be deleted and reinstalled on Windows — native packages
  (`@swc/core`, `rollup`) are platform-specific.
- `npm install` on a OneDrive-synced folder is slow and OneDrive can lock files
  mid-write. Pause syncing during install if it errors.
- `src/contexts/AuthContext.tsx` has **duplicate object keys** (`l1_manager`,
  `hub_manager`, `data_team`) — esbuild warns on every build. Not fatal; should be deduped.

---

## PART 2 — WHAT WAS DONE IN THE PRIOR SESSION

### 1. Cloned and verified the repo
- Cloned `https://github.com/ffigoadmin-hub/fferp_v3.git`
- `npm install` → 409 packages. Hit a corrupted `@swc/core-linux-x64-gnu` native binary
  causing a Bus error on `npm run dev`; reinstalling that single package fixed it.
- Dev server booted clean: Vite v5.4.21, port 8080, HTTP 200.
- Verified `ProtectedRoute` genuinely enforces `allowedRoles` (not cosmetic hiding).

### 2. Moved the repo to `D:\Gokulraaj Data\FFerp`
- Full source + `.git` history synced (1,111 files, 59MB), `node_modules` excluded.
- Latest commit: `a9cc7ac Merge pull request #1 from igobackend2-bit/main`
- Harmless leftovers you can delete: stray rsync temp files
  (`.ProjectDetailsDialog.tsx.7Mqhr4`, `.AuditorPaymentAuditPage.tsx.cPLuXG`) and a Vite
  temp config. None are git-tracked.
- `git status` shows permission-bit noise from the OneDrive mount (no content changed)
  plus a `package-lock.json` normalization. Safe to ignore or `git checkout -- package-lock.json`.

### 3. Role-guard hardening on daily-workflow routes (`src/App.tsx`)

Added at line ~379:
```typescript
const DAILY_WORKFLOW_ROLES = ALL_STAFF_ROLES.filter(
  (r) => !DAILY_WORKFLOW_EXCLUDED_ROLES.includes(r)
);
```
Excluded: `field_executive`, `tele_caller`, `bde`, `ff_operations_manager`.

Applied as `allowedRoles` on 5 routes that previously had **zero** role restriction —
any logged-in account could reach them:

| Line | Route | Component |
|---|---|---|
| 502 | `/employee-dashboard` | `EmployeeDashboardPage` |
| 503 | `/day-start` | `DayStartPage` |
| 504 | `/day-plan` | `DayPlanPage` |
| 505 | `/hourly-report` | `HourlyReportPage` |
| 506 | `/eod-summary` | `EODSummaryPage` |

`hub_manager` and `shift_employee` (purchase exec) deliberately **untouched**.

Effect: Sales Team (Priyanka, Indhurekha, Arun, Akash, Parasa Jagadeesh, Yazhini,
Anusiya) and the FF Ops Manager now get bounced by `ProtectedRoute` → `/redirect` →
their real dashboard (`/sales`, `/ff-operations`).

**✅ VERIFIED END-TO-END 2026-07-22.** Logged in as `ops.manager@ffactory.com`
(`ff_operations_manager`) and `anusiya@farmersfactory.in` (`field_executive`) — both
correctly bounced off Daily Workflow routes. Also found and fixed a related bug: the
*sidebar* nav config (`Sidebar.tsx`/`MobileSidebar.tsx`) still listed these excluded
roles in the full "Daily Workflow" group, so they saw dead links to routes that would
bounce them. Per explicit product direction, that section is now fully removed (not
trimmed) for `field_executive`, `tele_caller`, `bde`, `ff_operations_manager`.

### 4. Doc drift discovered
The four FFERPv2 skills are **stale relative to this codebase**. They list `/l1/payments`
and `/hub/dashboard` as "new pages to build" — but `/l1/payments` (`FFPaymentApprovals`)
already exists and `hub_manager` is already wired into most routes. `AGENT_CHANGELOG.md`
and commit history show active governance/workflow fixes dated into 2026.

Skills also say root is `D:\fferpv2 app\` — actual root is `D:\Gokulraaj Data\FFerp`.

**Verify current state in code before trusting any "to build" item below.**

---

## PART 3 — SKILL: fferpv2-workflow (master context)

> Load first for ANY work on this project.

### 3.1 The two ERPs in one codebase

**IGO Chain ERP — Governance & Operations**
Construction, agriculture, site visits, rentals, HR, payroll, escalations, employee daily workflow.
Roles: `employee`, `hr`, `admin`, `ceo`, `gm`, `gmo`, `smo`, `boi`, `auditor`, `director`, `rsh`, `nsm`

**Farmers Factory (FF) ERP — Fresh Produce Supply Chain**
Procurement, warehouse, sales, logistics, tele-caller, hub management, collection.
Roles: `shift_employee` (purchase exec), `ff_operations_manager`, `l1_manager`, `hub_manager`,
`warehouse_manager`, `qc_manager`, `tele_caller`, `driver`, `field_executive`, `collection_executive`

Both share ONE centralized Supabase DB — no separation.

### 3.2 The 8-stage FF supply chain cycle

```
[1] ORDERS IN
    App → Supabase direct
    Website → Supabase direct
    Manual → ERP sales module
    Bulk upload → CSV/Excel/PDF (DMart, TAJ, static customers)
        ↓
[2] AUTO-PROCESSING (on order insert trigger)
    Auto-create order details from customer + items
    Auto-generate invoice → invoiceHelper.ts
    Format: INV-YYYYMMDD-XXXXXX (first 6 chars of order UUID)
        ↓
[3] EOD PO ENGINE (cron: 23:50 daily)
    Collects all orders of the day
    Groups by product + hub
    Checks inventory → calculates shortfall (required − stock)
    Creates purchase_orders split by item AND hub
    DB trigger → auto-creates box labels in boxes table
    Assigns PO to hub's purchase executive
    Sends notification to exec
        ↓
[4] PURCHASE EXECUTIVE (1 per hub)
    HUB-1 Palikarani  → purchase.pali@ffactory.com
    HUB-2 Vanagaram   → purchase.vana@ffactory.com
    HUB-3 Hyderabad   → purchase.hyd@ffactory.com

    Downloads hub-filtered box labels → prints → goes to market
    Fills vendor form:
      Static vendor → search by name → all fields auto-fill
      Dynamic vendor → fill all fields manually → saved to vendor_master
    Submits vendor payment → ff_vendor_payments
    Submits transport/porter payment → ff_transport_payments
        ↓
[5] PAYMENT APPROVAL CHAIN (all payments go to CEO)
    Purchase Exec → FF Ops Manager → L1 Manager → Auditor → CEO → Accounts

    Status machine (exact strings):
    pending_ff_ops → pending_l1 → pending_auditor → pending_ceo → approved → rejected
        ↓
[6] DELIVERY TO HUB
    Goods arrive → scanner app scans box labels during unloading
    Each scan → live update in inventory table → ERP shows live
        ↓
[7] WASTAGE / DAMAGE ENTRY
    Hub manager fills during unloading AND at EOD
    Both entries → immediate live inventory deduction
        ↓
[8] CYCLE REPEATS
    Next EOD engine reads updated inventory for next day's PO
```

### 3.3 Hub system (critical for all queries)

All purchase exec and hub manager queries MUST filter by `hub_id`:

| Hub | Code | Location | Manager | Purchase Exec |
|---|---|---|---|---|
| Palikarani Hub | HUB-1 | Chennai | Arun Karthick | purchase.pali@ffactory.com |
| Vanagaram Hub | HUB-2 | Chennai | Prakash | purchase.vana@ffactory.com |
| Hyderabad Hub | HUB-3 | Hyderabad | Hari | purchase.hyd@ffactory.com |

Hub routing: `customer.pincode` → `hub_pincodes` table → `hub_id` on order
⚠️ Hubs currently hardcoded in `HubManagementPage.tsx` — must migrate to `hubs` DB table.

### 3.4 Role → dashboard → route map

| Role | Dashboard Route | Key Modules |
|---|---|---|
| `employee` (sales) | `/employee-dashboard` | Daily workflow + sales + purchase + app/website orders |
| `shift_employee` (purchase exec) | `/shift/dashboard` | Shift flow + hub-filtered PO + box labels + vendor form |
| `ff_operations_manager` | `/ff-operations` | All modules — purchase, sales, WH/QC, inventory, payment approval (1st) |
| `gm` | `/gm/dashboard` | Payment approvals (vendor + transport) |
| `l1_manager` | `/l1/payments` | Payment dashboard ONLY — no daily workflow |
| `auditor` | `/auditor/dashboard` | Payment audit |
| `ceo` | `/ceo-dashboard` | Final approver all payments + FF overview panel |
| `hub_manager` | `/hub/dashboard` | Hub-filtered: inventory, QC, wastage, inbound POs |
| `admin` | `/admin-dashboard` | Full system control |
| `hr` | `/hr-dashboard` | Attendance, LOP, payroll |
| `accounts` | `/accounts-execution` | Payment execution, salary |

### 3.5 Key file locations

| Need | File |
|---|---|
| All routes + role guards | `src/App.tsx` |
| Auth + user role | `src/contexts/AuthContext.tsx` |
| Supabase client | `src/integrations/supabase/client.ts` |
| DB types (generated) | `src/integrations/supabase/types.ts` |
| Invoice auto-gen | `src/lib/invoiceHelper.ts` |
| PO store | `src/lib/purchaseStore.ts` |
| Vendor hook | `src/hooks/useVendorMaster.ts` |
| Payment hook | `src/hooks/usePaymentRequests.ts` |
| EOD PO UI | `src/pages/ff-operations/po-engine/EODPOEngine.tsx` |
| Box label generator | `src/pages/ff-operations/labels/BoxLabelGenerator.tsx` |
| App/website orders | `src/pages/sales/AppOrdersDashboard.tsx` |
| Bulk order upload | `src/pages/sales/BulkOrderPage.tsx` |
| FF Ops home | `src/pages/ff-operations/FFOperationsHomePage.tsx` |
| Hub management | `src/pages/admin/HubManagementPage.tsx` |
| Migration run order | `RUN_ORDER.md` |

### 3.6 IGO Chain core workflow (non-FF modules)

- Daily employee loop: Day Start → Day Plan → 9 Hourly Slots → Payment/Material Requests → EOD
- Discipline score: 33% punctuality + 33% compliance + 34% integrity (proof URLs)
- Escalation: L1 (2hr) → L2 GM (8hr) → L3 CEO (24hr)
- Payment chain: Employee → Admin Queue → CEO/Director → Accounts → Auditor audit

### 3.7 Agent rules — NON-NEGOTIABLE

1. Always filter by `hub_id` for purchase exec and hub manager queries
2. Every new table needs RLS before use — see `FIX_RLS_ALL_ROLES.sql` for pattern
3. After any schema change, regenerate types:
   `supabase gen types typescript --project-id qwiumswrbddwmlraktvy > src/integrations/supabase/types.ts`
4. Never delete rows — use `status` fields
5. Every admin action → write diff to `audit_logs`
6. Payment status strings are exact — never invent new values
7. Never create a second Supabase client — only use the one in `client.ts`
8. Follow 3-layer architecture: Directive (`directives/`) → Agent decision → Execution (`execution/*.py`)

---

## PART 4 — SKILL: fferpv2-database

### 4.1 Connection

```
Project ref:  qwiumswrbddwmlraktvy
URL:          https://qwiumswrbddwmlraktvy.supabase.co
Client file:  src/integrations/supabase/client.ts   ← only instance, never create another
Types file:   src/integrations/supabase/types.ts    ← auto-generated, never edit manually
```

Regenerate types after any schema change:
```bash
supabase gen types typescript --project-id qwiumswrbddwmlraktvy > src/integrations/supabase/types.ts
```

### 4.2 Migration status

**Already applied — DO NOT re-run:**
`COMPLETE_SCHEMA_MIGRATION.sql` · `HUB_SEED.sql` · `FIX_ROLES.sql` · `FIX_RLS_ALL_ROLES.sql` · `CREATE_MISSING_TABLES.sql`

**Run in this order (if not yet applied):**

| Step | File | What it does |
|---|---|---|
| 1 | `SCHEMA_PART1_FROM_MASTER.sql` | Creates 72 core tables |
| 2 | `SCHEMA_PART2_REMAINING.sql` | 60+ more tables + box trigger + PE notification trigger + payment approval trigger. **CRITICAL: fixes `purchase_entry_id` on `ff_vendor_payments`** |
| 3 | `EOD_PO_ENGINE.sql` | Creates `run_eod_po_engine(date)` PostgreSQL function |
| 4 | Deploy edge function | `supabase functions deploy eod-po-engine --project-ref qwiumswrbddwmlraktvy` then set cron `50 23 * * *` |

Test after step 3: `SELECT public.run_eod_po_engine(CURRENT_DATE);`

### 4.3 Core tables — key columns

**sales_orders**
```
id, order_number, customer_id, customer_name,
hub_id (from pincode lookup),
source: 'app' | 'website' | 'manual' | 'bulk_upload',
status: 'pending'|'confirmed'|'processing'|'delivered'|'cancelled',
net_amount, order_date, created_at
```

**invoices** (auto-generated — never create manually)
```
id, invoice_number (INV-YYYYMMDD-XXXXXX), order_id,
customer_id, total_amount, status: 'unpaid'|'paid', due_date
```
Use `createInvoiceForOrder()` from `src/lib/invoiceHelper.ts`. Idempotent — safe to call repeatedly.

**purchase_orders** (FF)
```
id, po_number, hub_id, hub_name,
assigned_executive_id (profiles.id of purchase exec),
vendor_id, vendor_name, status, total_amount,
items (JSONB array), delivery_date, created_at
```

**boxes** (auto-generated via DB trigger on `purchase_order_items` insert)
```
id, box_code (FF-{HUB_PREFIX}-{YYYYMMDD}-{SEQ}),
qr_data, product_name, product_id,
hub_id, hub_name, weight_kg, po_ref,
scanned (BOOLEAN default FALSE),
scanned_at (set when scanner scans on arrival)
```

**inventory**
```
id, product_id, product_name, hub_id, quantity, min_threshold, unit, updated_at
```
Updated live by scanner app on box scan, and by wastage/damage entries.

**ff_vendor_payments**
```
id, purchase_entry_id, vendor_id, vendor_name,
vendor_bank_details (JSONB),
hub_id, items (JSONB: [{item_name, quantity, unit, unit_price, total}]),
total_amount, submitted_by,
status,                  ← see status machine
ff_ops_approved_by, ff_ops_approved_at,
l1_approved_by, l1_approved_at,
auditor_approved_by, auditor_approved_at,
ceo_approved_by, ceo_approved_at,
rejection_reason, created_at
```

**ff_transport_payments** — same approval chain, same status machine, separate table.

**vendor_master**
```
id, vendor_code, company_name, contact_person, phone, email,
state, city, address, work_types (TEXT[]),
gst_number, pan_number, bank_name, account_number, ifsc_code,
is_verified (FALSE for dynamic, TRUE for bulk-loaded static),
status: 'active'|'inactive'|'blacklisted',
sourced_by (profiles.id), rating, total_orders
```

**profiles** (core user table)
```
id (= auth.uid()), name, email, role, department,
hub_id (for purchase execs + hub managers),
phone, status, created_at
```

**hubs** — ✅ Already exists in production, confirmed live 2026-07-22 (3 rows: Palikarani, Vanagaram, Hyderabad). `HubManagementPage.tsx` may still read from a hardcoded array in parallel — not re-verified this pass. Schema below kept for reference:
```sql
CREATE TABLE IF NOT EXISTS public.hubs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,      -- 'HUB-1', 'HUB-2', 'HUB-3'
  name TEXT NOT NULL,
  location TEXT, city TEXT, state TEXT,
  manager_name TEXT,
  channels TEXT[] DEFAULT '{}',   -- ['FF','DMART','ZEPTO']
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO public.hubs (code, name, location, city, state, manager_name, channels) VALUES
  ('HUB-1','Palikarani Hub','Palikarani, Chennai','Chennai','Tamil Nadu','Arun Karthick',ARRAY['FF','DMART']),
  ('HUB-2','Vanagaram Hub','Vanagaram, Chennai','Chennai','Tamil Nadu','Prakash',ARRAY['FF','DMART','BLINKIT','ZEPTO']),
  ('HUB-3','Hyderabad Hub','Hyderabad, Telangana','Hyderabad','Telangana','Hari',ARRAY['FF','DMART','ZEPTO']);
ALTER TABLE public.hubs ENABLE ROW LEVEL SECURITY;
```

**hub_pincodes** — ✅ Already exists in production, confirmed live 2026-07-22 (103 rows). Order→hub routing is implemented as a Postgres trigger (see `COMPLETE_SCHEMA_MIGRATION.sql` ~line 660: exact pincode match, then 4-digit-prefix fallback), **not** frontend code — grepping `src/` for `hub_pincodes` correctly finds nothing. ⚠️ Live data check found only 1 of 17 recent `sales_orders` rows has `hub_id` populated — the trigger may not be firing reliably; needs investigation (check customer pincode data quality and confirm the trigger is actually attached to `sales_orders` in production, not just defined in the migration file). Schema below kept for reference:
```sql
CREATE TABLE IF NOT EXISTS public.hub_pincodes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hub_id UUID REFERENCES public.hubs(id) ON DELETE CASCADE,
  pincode TEXT NOT NULL UNIQUE,
  area_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.hub_pincodes ENABLE ROW LEVEL SECURITY;
```

### 4.4 Payment status machine (exact strings only)

```
pending_ff_ops → pending_l1 → pending_auditor → pending_ceo → approved
                                                            → rejected (any stage)
```
Never use other status strings. `rejection_reason` must be filled when status = `rejected`.

### 4.5 Hub-aware query patterns (mandatory)

```typescript
// Purchase exec — sees only their hub + their assignments
const { data } = await supabase
  .from('purchase_orders')
  .select('*, purchase_order_items(*)')
  .eq('hub_id', user.hub_id)
  .eq('assigned_executive_id', user.id)
  .order('created_at', { ascending: false });

// Hub manager — sees only their hub inventory
const { data } = await supabase
  .from('inventory')
  .select('*')
  .eq('hub_id', user.hub_id);

// Box labels for purchase exec
const { data } = await supabase
  .from('boxes')
  .select('*')
  .eq('hub_id', user.hub_id)
  .eq('scanned', false);

// FF Ops Manager — sees all hubs (no hub_id filter)
const { data } = await supabase
  .from('purchase_orders')
  .select('*, hubs(name)')
  .order('created_at', { ascending: false });
```

### 4.6 RLS template (every new table needs this)

```sql
ALTER TABLE public.your_table ENABLE ROW LEVEL SECURITY;

-- Admin / CEO full access
DROP POLICY IF EXISTS "admin_full_access" ON public.your_table;
CREATE POLICY "admin_full_access" ON public.your_table FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()
          AND role IN ('admin','ceo','director','Director'))
);

-- FF Ops Manager — all hubs
DROP POLICY IF EXISTS "ff_ops_all" ON public.your_table;
CREATE POLICY "ff_ops_all" ON public.your_table FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()
          AND role = 'ff_operations_manager')
);

-- Hub Manager — own hub only
DROP POLICY IF EXISTS "hub_manager_own" ON public.your_table;
CREATE POLICY "hub_manager_own" ON public.your_table FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
          AND p.role = 'hub_manager' AND p.hub_id = your_table.hub_id)
);

-- Purchase Exec — own hub only
DROP POLICY IF EXISTS "purchase_exec_own" ON public.your_table;
CREATE POLICY "purchase_exec_own" ON public.your_table FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
          AND p.role = 'shift_employee' AND p.hub_id = your_table.hub_id)
);
```

### 4.7 Realtime pattern (live inventory, payment status)

```typescript
supabase
  .channel('inventory-live')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'inventory',
    filter: `hub_id=eq.${user.hub_id}`
  }, (payload) => {
    // update local state with payload.new
  })
  .subscribe();
```

### 4.8 Diagnostic queries (run in Supabase SQL Editor)

```sql
-- Tables that exist
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Triggers that exist
SELECT trigger_name, event_object_table FROM information_schema.triggers
WHERE trigger_schema = 'public' ORDER BY event_object_table;

-- Tables WITHOUT RLS (security gaps — fix immediately)
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = FALSE;

-- Today's orders
SELECT id, order_number, source, hub_id, status, net_amount
FROM sales_orders WHERE order_date = CURRENT_DATE;

-- POs generated today
SELECT po_number, hub_id, hub_name, total_amount, status
FROM purchase_orders WHERE created_at::date = CURRENT_DATE;

-- Pending payments per stage
SELECT status, COUNT(*) FROM ff_vendor_payments GROUP BY status;

-- Low stock alert
SELECT product_name, hub_name, quantity, min_threshold
FROM inventory WHERE quantity <= min_threshold;

-- Test EOD PO Engine manually
SELECT public.run_eod_po_engine(CURRENT_DATE);
```

---

## PART 5 — SKILL: fferpv2-feature-builder

### 5.1 Before writing any code — checklist

- [ ] Which role(s) access this feature? → check `App.tsx` for `allowedRoles`
- [ ] Does it need a proof URL? → yes if financial or work evidence
- [ ] Does it need audit logging? → yes if admin/ceo changes data
- [ ] Does it need realtime? → yes if multiple users see it simultaneously
- [ ] Does it need `hub_id` filtering? → yes for purchase exec and hub manager
- [ ] Is the hook already in `src/hooks/`? → check before writing a new one
- [ ] Is the page already in `src/pages/`? → it might just need DB wiring

### 5.2 New route pattern (App.tsx)

```typescript
// Add import at top of App.tsx with other lazy imports
const MyNewPage = lazy(() => import('@/pages/module/MyNewPage'));

// Add route in AppRoutes component
<Route
  path="/my-route"
  element={
    <ProtectedRoute allowedRoles={['role1', 'role2']}>
      <MyNewPage />
    </ProtectedRoute>
  }
/>
```

### 5.3 New page template

```typescript
// src/pages/module/MyNewPage.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function MyNewPage() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['my-data', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('table_name')
        .select('*')
        .eq('hub_id', user?.hub_id)  // always filter by hub_id if hub-scoped
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  if (isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6 p-6">
      {/* page content */}
    </div>
  );
}
```

### 5.4 Reusable hook pattern

```typescript
// src/hooks/useFFVendorPayments.ts
export function useFFVendorPayments(status?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['ff-vendor-payments', status, user?.hub_id],
    queryFn: async () => {
      let query = supabase
        .from('ff_vendor_payments')
        .select('*, vendor_master(company_name, bank_name, account_number, ifsc_code)')
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);
      if (user?.role === 'shift_employee' || user?.role === 'hub_manager') {
        query = query.eq('hub_id', user.hub_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}
```

### 5.5 Payment approve / reject actions

```typescript
// Approve (L1 stage → auditor)
await supabase.from('ff_vendor_payments').update({
  status: 'pending_auditor',
  l1_approved_by: user.id,
  l1_approved_at: new Date().toISOString(),
}).eq('id', paymentId);

// Reject
await supabase.from('ff_vendor_payments').update({
  status: 'rejected',
  rejection_reason: reason,
}).eq('id', paymentId);
```

### 5.6 Pages the skill lists as "needs DB wiring"

**Re-audited 2026-07-22 — this list was stale.** Real status:

| Page | Status |
|---|---|
| `AppOrdersDashboard` | ✅ Already wired — `.eq('source', sourceFilter)` present |
| `BulkOrderPage` | ✅ Already wired — inserts into `sales_orders`, `sales_order_items`, `invoices` |
| `BoxLabelGenerator` | ⚠️ This page only *creates* box labels (inserts into `boxes`); it has no listing/filter view, so the `hub_id`/`scanned=false` filter described here doesn't apply to it — that filter belongs on a purchase-exec pickup queue, which doesn't exist as a page yet |
| `FFOperationsHomePage` | ✅ Fixed 2026-07-22 — was 100% static/hardcoded (no supabase import at all). Now wires Total Receivables (unpaid `invoices`) and Total Payables (non-rejected `ff_vendor_payments` + `ff_transport_payments`) to live data, and Recent Activity to real `purchase_orders`/`sales_orders`. Cash on Hand, Net Profit (MTD), and the Cash Flow chart are intentionally left as "not available" — there is no cash-ledger/payments-received table anywhere in the schema, and no invoice has ever been marked `paid`, so those figures cannot be computed honestly. Adding a real ledger table is a separate, larger task. |
| `SmartInventoryPage` | ✅ Already wired — Stock/Movements/Boxes tabs all query live tables |
| `CEOFFOverview` | ✅ Already wired — 5 live queries (sales, POs, vendor payments, transport payments, tasks) |
| `TaskToday` | ✅ Already wired — live query + mutation |
| `HubManagementPage` | ⚠️ Not re-verified this pass — still flagged as using a hardcoded hubs array per the original note; the `hubs` table itself exists and is populated (see §4.3) |

⚠️ **Column-name correction:** the snippets below in earlier drafts of this doc used `status` and `total_amount` on `ff_vendor_payments`/`invoices` — the real column names are different (see corrected snippets):

```typescript
// FFOperationsHomePage KPI wiring — CORRECTED column names (verified live 2026-07-22)
const { data: receivables } = await supabase.from('invoices')
  .select('total_amount').eq('payment_status', 'unpaid');   // NOT 'status'

// ff_vendor_payments has no total_amount column — net payable = gross_amount - deduction_amount
const { data: payables } = await supabase.from('ff_vendor_payments')
  .select('gross_amount, deduction_amount').neq('payment_status', 'rejected');  // NOT 'status'/'approved'

// ff_transport_payments has no total_amount column either — total = base_amount + toll_charges + other_charges

const { count } = await supabase.from('sales_orders')
  .select('*', { count: 'exact', head: true })
  .eq('order_date', new Date().toISOString().split('T')[0]);

// HubManagementPage — replace hardcoded HUBS array
const { data: hubs } = await supabase.from('hubs')
  .select('*').eq('status', 'active').order('code');

// CEOFFOverview
const { data: ordersBySource } = await supabase.from('sales_orders')
  .select('source, net_amount').eq('order_date', today);

const { count: pendingPayments } = await supabase.from('ff_vendor_payments')
  .select('*', { count: 'exact', head: true }).eq('status', 'pending_ceo');
```

### 5.7 Adding a new role to the system

1. Add to `ALL_STAFF_ROLES` array in `App.tsx` (line ~359)
2. Add `allowedRoles` to relevant route guards in `App.tsx`
3. Add role to RLS policies for tables they need
4. Add redirect case in `RedirectPage.tsx`
5. Apply `FIX_RLS_ALL_ROLES.sql` pattern for the new role on existing tables

### 5.8 Audit logging (required for admin actions)

```typescript
await supabase.from('audit_logs').insert({
  table_name: 'ff_vendor_payments',
  record_id: paymentId,
  action: 'status_update',
  before_state: { status: oldStatus },
  after_state: { status: newStatus, approved_by: user.id },
  performed_by: user.id,
  performed_at: new Date().toISOString(),
});
```

### 5.9 Component library — use what's there, never install new UI libs

From `shadcn/ui` via `@/components/ui/`:
`Button`, `Card`, `CardContent`, `CardHeader`, `Dialog`, `Input`, `Select`,
`Table`, `TableBody`, `TableCell`, `TableHead`, `TableRow`, `Badge`,
`Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`, `Toast`

Icons: `lucide-react`. Charts: `recharts` (used in CEODashboard and FF Ops Home).

---

## PART 6 — SKILL: fferpv2-db-fix

### 6.1 The two core problems

**Problem A — object already exists**
```
ERROR: 42710: trigger "profiles_updated_at" for relation "profiles" already exists
ERROR: 42P07: relation "profiles" already exists
ERROR: 42723: function "run_eod_po_engine" already exists
```
Cause: re-running a schema file on a DB that already has some objects.

**Problem B — token/context limit**
```
API Error: Usage credits required for 1M context
```
Cause: pasting a large SQL file into the chat. Never do this.

### 6.2 Idempotency fix rules — apply to every migration

| Object | Pattern |
|---|---|
| Tables | `CREATE TABLE IF NOT EXISTS public.table_name (...);` |
| Triggers | `DROP TRIGGER IF EXISTS t ON public.tbl;` then `CREATE TRIGGER ...` |
| Functions | `CREATE OR REPLACE FUNCTION public.fn() ...;` |
| Indexes | `CREATE INDEX IF NOT EXISTS idx ON public.tbl(col);` |
| Columns | `ALTER TABLE public.tbl ADD COLUMN IF NOT EXISTS col TYPE;` |
| Policies | `DROP POLICY IF EXISTS "p" ON public.tbl;` then `CREATE POLICY ...` |

### 6.3 Run this first before any schema re-run

```sql
-- Enable extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS moddatetime;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Drop all known duplicate triggers
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS vendors_updated_at ON public.vendors;
DROP TRIGGER IF EXISTS vendor_master_updated_at ON public.vendor_master;
DROP TRIGGER IF EXISTS purchase_orders_updated_at ON public.purchase_orders;
DROP TRIGGER IF EXISTS sales_orders_updated_at ON public.sales_orders;
DROP TRIGGER IF EXISTS inventory_updated_at ON public.inventory;
DROP TRIGGER IF EXISTS boxes_updated_at ON public.boxes;
DROP TRIGGER IF EXISTS ff_vendor_payments_updated_at ON public.ff_vendor_payments;
DROP TRIGGER IF EXISTS ff_transport_payments_updated_at ON public.ff_transport_payments;
DROP TRIGGER IF EXISTS customers_updated_at ON public.customers;
DROP TRIGGER IF EXISTS products_updated_at ON public.products;
DROP TRIGGER IF EXISTS hubs_updated_at ON public.hubs;
DROP TRIGGER IF EXISTS invoices_updated_at ON public.invoices;
DROP TRIGGER IF EXISTS notifications_updated_at ON public.notifications;
DROP TRIGGER IF EXISTS payment_requests_updated_at ON public.payment_requests;
DROP TRIGGER IF EXISTS projects_updated_at ON public.projects;
DROP TRIGGER IF EXISTS work_orders_updated_at ON public.work_orders;
DROP TRIGGER IF EXISTS client_escalations_updated_at ON public.client_escalations;
DROP TRIGGER IF EXISTS shift_sessions_updated_at ON public.shift_sessions;
DROP TRIGGER IF EXISTS salary_batches_updated_at ON public.salary_batches;
DROP TRIGGER IF EXISTS cafe_orders_updated_at ON public.cafe_orders;

-- Now re-run your schema file from the failing point
```

### 6.4 Handling large SQL files

**Never paste full SQL files into Claude.** `MASTER_SCHEMA_V1.sql` is 87k+ lines and will
always blow the context limit.

Correct workflow:
1. Open Supabase SQL Editor: `https://supabase.com/dashboard/project/qwiumswrbddwmlraktvy/sql/new`
2. Paste sections — max ~200 lines per run
3. On error, paste ONLY the 10–20 lines around the failure into Claude

```
✅ "I got this error: [error text]. Here's the failing SQL: [10-20 lines]"
❌ "Here is my full schema [500 lines]... now write a query"
```

Claude already knows all FFERPv2 table structures — describe what you need, don't re-paste schema.

> **Note for Claude Code specifically:** this constraint is much looser than in Cowork —
> Claude Code reads files directly from disk with Read/Grep and can target specific line
> ranges, so it can work with large SQL files without pasting them into chat. Still avoid
> dumping whole files into the prompt.

### 6.5 Fix-by-error-type reference

| Error message | Fix |
|---|---|
| `trigger "X" for relation "Y" already exists` | `DROP TRIGGER IF EXISTS X ON public.Y;` then recreate |
| `relation "X" already exists` | Add `IF NOT EXISTS` to `CREATE TABLE` |
| `function "X" already exists` | Change to `CREATE OR REPLACE FUNCTION` |
| `policy "X" for table "Y" already exists` | `DROP POLICY IF EXISTS "X" ON public.Y;` then recreate |
| `column "X" of relation "Y" already exists` | Add `IF NOT EXISTS` to `ALTER TABLE ... ADD COLUMN` |
| `column "purchase_entry_id" does not exist` | Run `SCHEMA_PART2_REMAINING.sql` |
| `permission denied for table X` | Missing RLS policy for this role — add from template |
| `new row violates row-level security policy` | User's `role` or `hub_id` doesn't match policy — check `profiles` row |
| `relation "hubs" does not exist` | Create `hubs` table — Section 4.3 |
| `relation "hub_pincodes" does not exist` | Create `hub_pincodes` table — Section 4.3 |

Rule: if a step fails, apply the fix and **continue from the failing line**. Do NOT restart
the file from the top.

---

## PART 7 — OPEN WORK QUEUE

**Last updated 2026-07-22 — most of this queue is now stale. Re-audited item by item below.**

### ✅ Done & verified
1. `npm run dev` confirmed working (node_modules was already a valid Windows install, no reinstall needed)
2. Role-guard change verified end-to-end for `ff_operations_manager` and `field_executive` logins (item 2 in the original queue — also uncovered and fixed a matching sidebar bug, see Section 3.4 note)
3. `.env.example` key-name mismatch — fixed (also fixed a stale project ref)
4. Duplicate object keys in `AuthContext.tsx` — fixed
5. Stray temp files — none found (already clean); one leftover Vite temp config file deleted
6. `hubs` table — already exists in production (not a gap, doc was stale)
7. `hub_pincodes` table — already exists in production, 103 rows, routing implemented via a Postgres trigger (see §4.3 correction). **New finding**: only 1/17 recent orders have `hub_id` populated — trigger reliability needs investigation
8. DB wiring for `AppOrdersDashboard`, `BulkOrderPage`, `SmartInventoryPage`, `CEOFFOverview`, `TaskToday` — all already correctly wired, no changes needed
9. `FFOperationsHomePage` — was 100% static/fake data, now wired to real Receivables/Payables/Recent Activity; Cash on Hand/Net Profit/Cash Flow honestly marked unavailable (no ledger table exists — see §5.6)
10. Second Supabase client (`src/modules/hr-payroll/integrations/supabase/client.ts`) — confirmed unused dead code repo-wide, marked deprecated in a comment. **Actual file deletion needs your go-ahead** — a shell `rm` was blocked by the permission classifier as a destructive action.

### ❌ Still open
11. Re-audit the four FFERPv2 skill docs (this file) — partially done this pass (Sections 4.3, 5.6, and the role-guard note corrected); a full pass line-by-line hasn't been done
12. RLS audit (`SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity=FALSE`) — **blocked**: the connected Supabase MCP tool has no access to this project (`qwiumswrbddwmlraktvy`); only unrelated projects were visible when checked. Needs either reconnecting that MCP to the right account, or running the query manually in the Supabase SQL Editor
13. EOD PO Engine edge function deployment — **not just unconfirmed, doesn't exist**: there is no `supabase/functions/` directory anywhere in this repo. Only the Postgres function (`EOD_PO_ENGINE.sql`) exists; the edge function + cron wrapper described in this doc was never built. Deploying/testing it is a real feature-build task, and actually invoking `run_eod_po_engine()` creates real purchase orders — do not run it against production without explicit sign-off
14. `HubManagementPage.tsx` — not re-verified whether it still reads from a hardcoded array instead of the (now-confirmed-existing) `hubs` table
15. `BoxLabelGenerator` hub/scanned filter — doesn't apply as originally worded; that page only creates labels, it has no listing view. A hub-filtered "unscanned boxes" queue for purchase execs doesn't exist as a page yet, if one is wanted
16. Payment approval chain (FF Ops → L1 → GM → Auditor → CEO) has not been tested end-to-end with a real submitted payment — `ff_vendor_payments`/`ff_transport_payments` are currently empty tables in production

---

## PART 8 — CONNECTED TOOLING NOTE

The prior Cowork session had a Supabase MCP connector available (`list_tables`,
`execute_sql`, `apply_migration`, `get_advisors`, `get_logs`, `generate_typescript_types`,
`deploy_edge_function`, etc.). If you want the same in Claude Code, configure the Supabase
MCP server there — it makes the schema-drift audit in item 3 far faster than reading SQL
files by hand.

`get_advisors` in particular will surface the missing-RLS tables from item 9 automatically.
