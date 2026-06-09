# FF ERP — Full Integration Connection Plan
**Generated:** 2026-06-01  
**Target:** Unify Website + Customer App + ERP into one database

---

## 1. Current State (The Problem)

| System | Database | Problem |
|--------|----------|---------|
| ERP (fferpv2 web) | `bvbfnguqpuctdvfztuda` | Orders never arrive here |
| Scanner App | `bvbfnguqpuctdvfztuda` | ✅ Already connected — no change needed |
| Customer Website | `rwasfuhrvqscqnpwqooq` | Orders go here, ERP never sees them |
| Old Internal ERP / App | `slfxozmbwogpisxeltty` | 204-table internal system — no external customer orders found |

**Root cause:** The website and old app each write to their own separate database. The new ERP database never receives those orders.

---

## 2. Target State (The Solution)

```
Customer Website  ──┐
                    ├──► NEW ERP DB (bvbfnguqpuctdvfztuda) ◄── ERP Staff
Customer Mobile App─┘         │
                               ▼
                        Scanner App (already here)
```

**One database. All orders in one place. ERP sees everything in real time.**

---

## 3. Important Finding — Customer App DB

The database you shared for the "customer app" (`slfxozmbwogpisxeltty`) is actually the **old internal IGO ERP** — 204 tables for employees, HR, payroll, projects, farms, and a cafe ordering module for internal staff.

There are **no external customer product ordering tables** in that database.

**Action required before proceeding with the app:**  
You need to confirm: Is there a separate customer mobile app codebase? If yes, share the repo/folder so we can change its Supabase credentials to point at the new ERP DB.

---

## 4. The Integration Strategy

### Strategy: Direct Connection (Recommended)

Instead of building a sync bridge between two databases, we **point the website (and app) directly at the new ERP database.** No duplication, no sync lag, no extra infrastructure.

How it works:
- The website changes its `.env` Supabase URL from `rwasfuhrvqscqnpwqooq` → `bvbfnguqpuctdvfztuda`
- When a customer places an order on the website, it writes directly into `sales_orders` in the ERP DB
- ERP staff see the order immediately, in real time
- No webhooks, no sync jobs, no duplication

---

## 5. Step-by-Step Execution Plan

### Phase 1 — Extend ERP Schema (Run once)
**File:** `MASTER_INTEGRATION_MIGRATION.sql`

Run this on the new ERP database (`bvbfnguqpuctdvfztuda`). It adds:

- `pincode`, `avatar_url`, `source` columns to `customers`
- `billing_address`, `pincode`, `delivery_slot`, `source_order_id`, `customer_email`, `delivered_at` to `sales_orders`
- `original_price`, `stock_left`, `weight_options`, `badge`, `website_price`, `is_published` to `products`
- New table: `delivery_slots` (time slot management)
- New table: `customer_queries` (support tickets)
- New table: `customer_notifications` (replaces website inbox_messages)
- View: `website_products` (clean product view for website/app)
- Triggers: auto-decrement stock, auto-increment slot usage
- RLS policies: customers only see their own orders, ERP staff see everything

**How to run:**
1. Go to Supabase Dashboard → `bvbfnguqpuctdvfztuda` project
2. Open SQL Editor
3. Paste and run `MASTER_INTEGRATION_MIGRATION.sql`

---

### Phase 2 — Migrate Existing Data (Run once)
**File:** `MASTER_DATA_MIGRATION.sql`

Copies all existing data from the website DB into the ERP DB:

| From (Website) | To (ERP) | Count |
|---------------|----------|-------|
| `profiles` | `customers` | All customer accounts |
| `products` | `products` | All products |
| `delivery_slots` | `delivery_slots` | All time slots |
| `orders` | `sales_orders` + `sales_order_items` | All past orders |
| `customer_queries` | `customer_queries` | All support tickets |
| `inbox_messages` | `customer_notifications` | All notifications |

**How to run:**
1. This uses PostgreSQL's `postgres_fdw` to connect from ERP DB → website DB
2. Go to Supabase Dashboard → `bvbfnguqpuctdvfztuda` → SQL Editor
3. Run `MASTER_DATA_MIGRATION.sql`
4. Check the verification query at the bottom — counts should match

---

### Phase 3 — Update Website to Point at ERP DB

After migration is confirmed, update the **website's** Supabase credentials:

**Old website `.env`:**
```
VITE_SUPABASE_URL=https://rwasfuhrvqscqnpwqooq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...old key...
```

**New website `.env` (point at ERP):**
```
VITE_SUPABASE_URL=https://bvbfnguqpuctdvfztuda.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2YmZuZ3VxcHVjdGR2Znp0dWRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0ODk4MzcsImV4cCI6MjA5NDA2NTgzN30.jzR-WLetaXpOOCbSY9e-Cf9Alm9aQogIhNBKM7dZJVA
```

**Website code changes needed:**

The website currently queries these tables by exact name:
- `orders` → rename queries to `sales_orders`
- `profiles` → rename queries to `customers`
- `products` → use the `website_products` view (already filters published only)
- `inbox_messages` → rename to `customer_notifications`
- `customer_queries` → same name, no change
- `delivery_slots` → same name, no change

**Status field mapping** (website uses different values):
| Website status | ERP status |
|---------------|-----------|
| `Processing` | `pending` |
| `Confirmed` | `confirmed` |
| `Dispatched` | `dispatched` |
| `Delivered` | `delivered` |
| `Cancelled` | `cancelled` |

---

### Phase 4 — Customer Mobile App

**First, confirm:** Where is the customer mobile app code? (Share the folder/repo)

Once confirmed, the same process applies:
- Update the app's Supabase URL and anon key to `bvbfnguqpuctdvfztuda`
- The app will automatically start writing orders into the ERP

If the customer mobile app was using `slfxozmbwogpisxeltty`, we need to check what tables it was reading/writing and map those to the ERP schema.

---

### Phase 5 — Real-Time Order Notifications in ERP

Once website orders land in `sales_orders`, set up Supabase Realtime in the ERP dashboard:

1. Go to Supabase Dashboard → `bvbfnguqpuctdvfztuda` → Database → Replication
2. Enable replication for: `sales_orders`, `customers`, `sales_order_items`
3. The ERP front-end will automatically show new orders in real time (already subscribed in fferpv2 code)

---

## 6. Field Mapping Reference

### Website `orders` → ERP `sales_orders`

| Website field | ERP field | Notes |
|--------------|-----------|-------|
| `id` | `source_order_id` | Kept for traceability |
| `customer_email` | `customer_email` + lookup `customer_id` | |
| `customer_name` | `customer_name` | |
| `customer_phone` | `customer_phone` | |
| `amount` | `total_amount` | |
| `status` | `status` | Mapped (see table above) |
| `items` (jsonb) | `sales_order_items` rows | Normalized |
| `delivery_address` | `delivery_address` | |
| `billing_address` | `billing_address` | New column added |
| `pincode` | `pincode` | New column added |
| `payment_method` | `payment_mode` | |
| `delivery_slot` | `delivery_slot` | New column added |
| `delivery_date` | `delivery_date` | |
| `created_at` | `created_at` | |
| `delivered_at` | `delivered_at` | New column added |
| `channel` | `channel` = `'website'` | Fixed value |

### Website `profiles` → ERP `customers`

| Website field | ERP field | Notes |
|--------------|-----------|-------|
| `id` | `id` | Same UUID |
| `email` | `email` | |
| `name` | `name` | |
| `phone` | `phone` | |
| `address` | `address` | |
| `pincode` | `pincode` | New column added |
| `role` | `customer_type = 'individual'` | |
| `last_login` | `last_login` | New column added |

---

## 7. What Stays in Old Databases

| Database | Keep? | Why |
|----------|-------|-----|
| `rwasfuhrvqscqnpwqooq` (website) | Archive | Keep as backup. Stop writing to it once Phase 3 is done. |
| `slfxozmbwogpisxeltty` (old ERP) | Yes, separate | Still needed for 204-table internal operations (HR, payroll, projects, farms). This is your internal operations system — it runs separately. |

---

## 8. Files Delivered

| File | Purpose | Run on |
|------|---------|--------|
| `MASTER_INTEGRATION_MIGRATION.sql` | Schema extensions + RLS policies | New ERP DB (`bvbfnguqpuctdvfztuda`) |
| `MASTER_DATA_MIGRATION.sql` | Copy all existing data from website | New ERP DB (`bvbfnguqpuctdvfztuda`) |
| `INTEGRATION_CONNECTION_PLAN.md` | This document | Reference |

---

## 9. Quick Start Order

```
Step 1  →  Run MASTER_INTEGRATION_MIGRATION.sql on new ERP DB
Step 2  →  Run MASTER_DATA_MIGRATION.sql on new ERP DB
Step 3  →  Verify counts match (last query in data migration file)
Step 4  →  Update website .env → point at new ERP DB
Step 5  →  Test: place a test order on website → confirm it appears in ERP
Step 6  →  Share customer mobile app code → update its credentials too
Step 7  →  Enable Supabase Realtime on sales_orders table
Step 8  →  Archive old website DB (stop writing to it)
```

---

*Questions? The one open item is the customer mobile app — share the repo and we can complete Phase 4.*
