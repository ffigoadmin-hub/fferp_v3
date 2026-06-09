# FFERPv2 — Fresh Database & Vercel Deployment Master Plan

**Goal**: Move to a clean Supabase project, consolidate all 19 migrations into one
error-free master schema, fix the website→ERP order flow, and deploy to Vercel.

---

## THE PROBLEM SUMMARY

| # | Problem | Impact |
|---|---------|--------|
| 1 | 19 migrations applied in sequence — each patching the last | Database state is fragile, hard to reproduce |
| 2 | `sales_orders` missing `channel`, `source`, `hub_id` on fresh DB | Customer website orders fail with DB error |
| 3 | `customers` missing `shop_name`, `channel`, `hub_id` on fresh DB | Customer portal upsert fails |
| 4 | Cross-migration FK forward references (projects, customers) | Migration 003 fails if 002 not run first |
| 5 | `verify_jwt = false` on 12+ edge functions | Security risk on production |
| 6 | No single clean master SQL to recreate DB from scratch | Cannot onboard new environments |

---

## THE PLAN — 6 PHASES

---

### PHASE 1 — Create Fresh Supabase Project (Day 1, 30 min)

**Steps:**
1. Go to [supabase.com](https://supabase.com) → New Project
2. Name: `fferpv2-production`
3. Region: `ap-south-1` (Mumbai — closest to India)
4. Password: generate strong password, save to password manager
5. Copy the new project's `URL`, `anon key`, and `service_role key`
6. Keep the old project running until switchover is complete

**Deliverable:** New project credentials ready

---

### PHASE 2 — Build the Single Master Migration SQL (Day 1–2, 3–4 hours)

This is the core work. Consolidate all 19 migrations into **one clean file** with
this exact table creation order (respects all FK dependencies):

```
Dependency Order (create in this sequence):
──────────────────────────────────────────
Layer 0 — Extensions & Helper Functions
  └─ uuid-ossp, pgcrypto, pg_trgm
  └─ get_my_role(), update_updated_at()

Layer 1 — No Foreign Keys
  └─ profiles, hubs, products, vendors, rental_categories
  └─ transport_categories, transport_vehicles, transport_drivers
  └─ geofences, announcements

Layer 2 — Depends on Layer 1
  └─ customers (→ profiles, hubs)
  └─ sales_orders (→ customers, profiles, hubs)   ← FIX: add channel, source, order_source
  └─ purchase_orders (→ vendors, profiles)
  └─ projects (→ profiles)
  └─ inventory (→ products, hubs)
  └─ market_rates (→ products, hubs)

Layer 3 — Depends on Layer 2
  └─ sales_order_items (→ sales_orders, products)
  └─ purchase_order_items (→ purchase_orders, products)
  └─ project_phases (→ projects)
  └─ project_boq (→ projects, project_phases)
  └─ qc_inspections (→ sales_orders)
  └─ logistics_trips (→ sales_orders, profiles)

Layer 4 — Depends on Layer 3
  └─ project_inventory (→ projects, project_phases)
  └─ project_timeline (→ projects)
  └─ project_variations (→ projects)
  └─ client_collections (→ projects, profiles)
  └─ client_escalations (→ projects, profiles)
  └─ work_orders (→ projects, vendors, profiles)

Layer 5 — HR & Workforce
  └─ leave_requests, lop_entries, lop_audit_logs
  └─ day_starts, day_plans, hourly_plans, hourly_reports, eod_reports
  └─ selfie_records, salary_batches, salary_batch_employees
  └─ employee_achievements, employee_history, employee_lop

Layer 6 — Chat System (all tables first, policies after)
  └─ chat_conversations → chat_participants → chat_messages
  └─ chat_message_reactions, chat_calls, chat_call_signals

Layer 7 — Everything Else
  └─ All remaining tables from the 19 migrations

Layer 8 — RLS Policies (all at end, no forward-reference errors)

Layer 9 — Triggers & Functions

Layer 10 — Realtime Publications

Layer 11 — Seed Data (hubs, transport categories, grocery items)
```

**Key fixes to apply while consolidating:**

```sql
-- FIX 1: sales_orders — add columns the customer portal needs
ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS channel      text DEFAULT 'erp',
  ADD COLUMN IF NOT EXISTS source       text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS hub_id       uuid REFERENCES public.hubs(id),
  ADD COLUMN IF NOT EXISTS net_amount   numeric(12,2),
  ADD COLUMN IF NOT EXISTS qty_kg       numeric(10,3);

-- FIX 2: customers — add columns the customer portal needs
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS shop_name    text,
  ADD COLUMN IF NOT EXISTS channel      text DEFAULT 'erp',
  ADD COLUMN IF NOT EXISTS hub_id       uuid REFERENCES public.hubs(id),
  ADD COLUMN IF NOT EXISTS mobile       text;

-- FIX 3: sales_order_items — qty_kg alias
-- (use generated column so it's always in sync)
ADD COLUMN qty_kg numeric GENERATED ALWAYS AS (quantity) STORED;
```

**Deliverable:** `MASTER_SCHEMA_V1.sql` — one file, runs clean on blank DB

---

### PHASE 3 — Fix Website → ERP Order Flow (Day 2, 2 hours)

**Root Cause of the order error:**
The customer portal calls `supabase.from('customers').upsert({ channel: 'web_portal' })`
but on a fresh DB the `customers` table may lack the `channel` column, causing a 400 error.
Similarly `sales_orders` insert fails if `hub_id` or `net_amount` columns don't exist.

**Fix in the master schema:**

```sql
-- customers must have:
channel         text DEFAULT 'erp'   -- 'web_portal' | 'erp' | 'mobile'
hub_id          uuid                  -- which hub serves this customer
mobile          text                  -- phone alias used by portal

-- sales_orders must have:
channel         text DEFAULT 'erp'   -- 'customer_portal' | 'erp' | 'mobile'
source          text DEFAULT 'manual'
hub_id          uuid                  -- fulfilled by which hub
net_amount      numeric(12,2)        -- used by reports
order_source    text                  -- 'website' | 'app' | 'field'
```

**Fix in the customer portal code (CustomerCart.tsx):**

```typescript
// Add hub_id when placing orders — pick from customer's assigned hub
const { data: order } = await supabase.from('sales_orders').insert({
  customer_id:    customer.id,
  customer_name:  customer.name || customer.shop_name,
  hub_id:         customer.hub_id,          // ← was missing
  channel:        'customer_portal',         // ← was missing
  order_source:   'website',                 // ← was missing
  net_amount:     total,
  total_amount:   total,
  ...
});
```

**ERP side — ensure orders from portal appear in the right queue:**
The `AdminOrdersQueuePage` and warehouse pages filter by `status = 'pending'`.
Portal orders set `status = 'pending'` already — so they WILL appear once
the column errors are fixed.

**Deliverable:** Orders from website flow into ERP without errors

---

### PHASE 4 — Edge Function Security Hardening (Day 2, 1 hour)

Fix the `verify_jwt = false` issue in `supabase/config.toml` before production:

```toml
# BEFORE (insecure):
[functions.create-onboarding-user]
verify_jwt = false

# AFTER (secure):
[functions.create-onboarding-user]
verify_jwt = true
# Then inside the function, check for service-role header or admin JWT
```

Functions that legitimately need public access (e.g. vendor portal):
- Keep `verify_jwt = false` only for those
- Add rate limiting via a custom header check

**Deliverable:** Only truly-public functions are unauthenticated

---

### PHASE 5 — Vercel Deployment Setup (Day 3, 1 hour)

**Environment Variables to set in Vercel dashboard:**

```
VITE_SUPABASE_URL        = https://<new-project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY = eyJ...  (anon key — safe to expose)
```

**Never put in Vercel env vars:**
- Service role key (only used in edge functions server-side)

**vercel.json** — already correct, no changes needed.

**Build settings in Vercel:**
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Node version: 18.x

**Domain setup:**
- Add custom domain in Vercel → Project Settings → Domains
- Update Supabase Auth → URL Configuration:
  - Site URL: `https://yourdomain.com`
  - Redirect URLs: `https://yourdomain.com/**`

**Deliverable:** ERP live on Vercel, pointing to fresh DB

---

### PHASE 6 — Data Migration from Old DB (Day 3–4, 2 hours)

If you need to carry over existing data (employees, products, hubs):

**Order of data export/import:**
```
1. profiles          (employees first — everything references them)
2. hubs              (hub definitions)
3. products          (product catalog)
4. vendors           (vendor list)
5. customers         (customer base)
6. sales_orders + sales_order_items  (order history)
7. payment_requests  (payment history)
8. leave_requests    (HR records)
```

**Method:**
```bash
# Export from old DB via Supabase Dashboard → Table Editor → Export CSV
# OR use pg_dump with the connection string:
pg_dump "postgresql://postgres:[password]@db.[old-ref].supabase.co:5432/postgres" \
  --data-only --table=profiles --table=hubs --table=products \
  -f old_data_export.sql

# Import into new DB:
psql "postgresql://postgres:[password]@db.[new-ref].supabase.co:5432/postgres" \
  -f old_data_export.sql
```

**Deliverable:** All live data preserved in new clean database

---

## EXECUTION CHECKLIST

```
PHASE 1 — New Supabase project
[ ] Create new project in ap-south-1
[ ] Save URL, anon key, service role key
[ ] Note new project ref ID

PHASE 2 — Master Schema SQL
[ ] Consolidate all 19 migrations into MASTER_SCHEMA_V1.sql
[ ] Test on blank DB (run, verify zero errors)
[ ] Confirm all 102 tables created
[ ] Confirm all RLS policies applied
[ ] Confirm triggers working
[ ] Run seed data (hubs, transport categories)

PHASE 3 — Order Flow Fix
[ ] Add channel, source, hub_id, net_amount to sales_orders in master schema
[ ] Add channel, hub_id, mobile to customers in master schema
[ ] Update CustomerCart.tsx to pass hub_id and channel on order insert
[ ] Test: place order from customer portal → appears in ERP queue

PHASE 4 — Security
[ ] Audit supabase/config.toml — set verify_jwt = true on all non-public functions
[ ] List which functions stay public and document why

PHASE 5 — Vercel Deploy
[ ] Set VITE_SUPABASE_URL in Vercel env vars
[ ] Set VITE_SUPABASE_PUBLISHABLE_KEY in Vercel env vars
[ ] Set build command: npm run build, output: dist
[ ] Set Supabase Auth redirect URL to Vercel domain
[ ] Deploy and test login

PHASE 6 — Data Migration
[ ] Export critical tables from old DB
[ ] Import into new DB
[ ] Verify employee logins work
[ ] Verify products/hubs visible
[ ] Verify customer orders flow end-to-end

FINAL VERIFICATION
[ ] Customer can place order on website → shows in ERP admin queue
[ ] Employee can log in → sees correct dashboard
[ ] Admin can manage users, payments, projects
[ ] All 33 edge functions deployed and responding
[ ] No RLS errors in Supabase logs
```

---

## FILE DELIVERABLES TO CREATE

| File | Purpose |
|------|---------|
| `MASTER_SCHEMA_V1.sql` | Single clean migration — runs on blank DB |
| `MASTER_SEED_V1.sql` | Essential seed data (hubs, categories, admin user) |
| `DATA_EXPORT_SCRIPT.sql` | Extracts live data from old DB for import |
| `CustomerCart.tsx` (updated) | Fixes hub_id + channel on order insert |
| `vercel.json` (verified) | Already correct |
| `supabase/config.toml` (updated) | JWT verification hardened |

---

## ESTIMATED TIMELINE

| Phase | Time | Who |
|-------|------|-----|
| Phase 1: New project | 30 min | You (Supabase dashboard) |
| Phase 2: Master schema | 3–4 hrs | Claude builds it |
| Phase 3: Order flow fix | 1–2 hrs | Claude fixes code |
| Phase 4: Security | 1 hr | Claude + you review |
| Phase 5: Vercel deploy | 1 hr | You (Vercel dashboard) |
| Phase 6: Data migration | 2 hrs | Both |
| **Total** | **~10 hrs** | |

---

## WHAT TO DO RIGHT NOW

**Step 1 (you do):** Create the new Supabase project and share the new project URL.

**Step 2 (Claude builds):** I will generate `MASTER_SCHEMA_V1.sql` —
a single, ordered, error-free SQL file that creates all 102 tables,
all RLS policies, all triggers, and seeds essential data.

**Step 3 (you run):** Paste the master SQL into the new project's SQL Editor.
One run. Zero errors.

**Step 4 (Claude fixes):** I will update `CustomerCart.tsx` and any other
customer portal files so orders land in the ERP without errors.

**Step 5 (you deploy):** Set env vars in Vercel, deploy, done.
