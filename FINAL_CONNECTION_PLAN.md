# FF ERP — Final Database Connection Plan
**Core Database:** `qwiumswrbddwmlraktvy`
**Generated:** 2026-06-01
**Based on:** Full codebase audit of all 4 systems

---

## 1. What I Found In Each Codebase

### Scanner App (ff-scanner-v2) — React Native / Expo
| Item | Finding |
|------|---------|
| DB it uses | `qwiumswrbddwmlraktvy` ✅ **Already correct** |
| Framework | React Native + Expo |
| Tables it reads/writes | `boxes`, `delivery_packs`, `delivery_pack_items`, `wastage_entries`, `inventory`, `inventory_log`, `products`, `profiles`, `hubs` |
| Box QR payload | Encodes: `box_id`, `box_code`, `product`, `weight_kg`, `hub`, `po_id`, `date` |
| Box status flow | `created → received → qc_passed/qc_failed → packed → dispatched → delivered / wasted` |
| **Action needed** | **None. Already working on correct DB.** |

---

### Customer App (ff-app) — Next.js + Capacitor
| Item | Finding |
|------|---------|
| Framework | Next.js 15, wrapped in Capacitor for mobile |
| Backend | **Prisma ORM + SQLite** for all API routes — NOT Supabase |
| Supabase usage | Only the old HTML/JS files use Supabase → pointing at `slfxozmbwogpisxeltty` (wrong) |
| .env | **Missing entirely** — app has no live DB connected for Next.js part |
| Tables (Prisma models) | `User`, `Order`, `OrderItem`, `Address`, `DarkStore`, `Product`, `Category`, `Cart`, `CartItem`, `WishlistItem`, `Review`, `Coupon`, `Banner`, `Inventory` |
| Payment | Razorpay (razorpay_order_id, razorpay_payment_id, razorpay_signature) |
| Key naming difference | Uses `User` not `Customer`, `Order` not `SalesOrder`, `DarkStore` not `Hub` |
| **Action needed** | **Replace Prisma+SQLite with Supabase. Point at new DB. Map table names.** |

---

### Website (ffwebsite) — Next.js
| Item | Finding |
|------|---------|
| Framework | Next.js + Supabase JS client |
| DB in code | Hardcoded to `celsdwfmogpejwzbkxad.supabase.co` |
| **Live DB (confirmed by user)** | `rwasfuhrvqscqnpwqooq` |
| Tables it uses | `products`, `profiles`, `orders`, `order_items`, `addresses`, `users`, `banners`, `notifications`, `reviews`, `wishlists`, `delivery_slots`, `customer_queries`, `farm_stories`, `leads`, `coupons` |
| Also has | `mobile/` subfolder — React Native app, same DB |
| **Action needed** | **Change Supabase URL in code to new DB. Update table names.** |

---

### ERP Web App (fferpv2) — React + Vite
| Item | Finding |
|------|---------|
| DB in .env | `bvbfnguqpuctdvfztuda` (old ERP — wrong) |
| Should point at | `qwiumswrbddwmlraktvy` (new DB) |
| Tables (from MASTER_SCHEMA_V1.sql) | `customers`, `sales_orders`, `sales_order_items`, `products`, `vendors`, `purchase_orders`, `purchase_order_items`, `hubs`, `profiles`, `inventory`, and 90+ more |
| **Action needed** | **Update .env to new DB. Run schema migration on new DB.** |

---

## 2. The 5 Databases — Final Status

| Database | What it is | Action |
|----------|-----------|--------|
| `qwiumswrbddwmlraktvy` | ✅ **NEW CORE DB** — Scanner schema (10 tables) | **Extend with all missing tables** |
| `bvbfnguqpuctdvfztuda` | Old ERP (102 tables, fferpv2 app) | Archive — stop using |
| `rwasfuhrvqscqnpwqooq` | Live website DB (6 tables) | Migrate data → archive |
| `celsdwfmogpejwzbkxad` | Old website DB (in code but not live) | Ignore — already stale |
| `slfxozmbwogpisxeltty` | Old internal IGO ERP (204 tables) | Keep separate — HR/payroll/ops |

---

## 3. Table Naming Conflicts & Resolution

The 3 systems use different names for the same things. Here's how we resolve it:

| Concept | Scanner uses | Customer App uses | Website uses | ERP uses | **New DB name** |
|---------|-------------|------------------|-------------|---------|----------------|
| Customer/User | — | `User` (Prisma) | `profiles` / `users` | `customers` | **`customers`** |
| Order | — | `Order` (Prisma) | `orders` | `sales_orders` | **`sales_orders`** |
| Order line | — | `OrderItem` | `order_items` | `sales_order_items` | **`sales_order_items`** |
| Hub / Store | `hubs` ✅ | `DarkStore` | — | `hubs` | **`hubs`** (already exists) |
| Staff profile | `profiles` ✅ | — | — | `profiles` | **`profiles`** (staff only) |
| Product | `products` ✅ | `Product` | `products` | `products` | **`products`** (extend existing) |
| Inventory | `inventory` ✅ | `Inventory` | — | `inventory` | **`inventory`** (already exists) |

**To avoid rewriting all app code:** Create compatibility views in the new DB:
```sql
CREATE VIEW public.orders       AS SELECT * FROM public.sales_orders;
CREATE VIEW public.order_items  AS SELECT * FROM public.sales_order_items;
CREATE VIEW public.users        AS SELECT * FROM public.customers;
```
Website and app continue to work without any code changes to their query calls.

---

## 4. Complete Table Map — New DB (`qwiumswrbddwmlraktvy`)

### Already Exists (10 tables — scanner schema)
| Table | Used by | Notes |
|-------|---------|-------|
| `hubs` | Scanner, ERP | Add: `city`, `state`, `display_name` |
| `products` | Scanner, ERP, Website, App | Add: `slug`, `price`, `mrp`, `category_id`, `image_urls`, `description`, `is_published`, `weight_options`, `badge`, `stock_left` |
| `profiles` | Scanner, ERP | Add: ERP roles beyond `hub_manager/driver` |
| `boxes` | Scanner | ✅ Complete — `po_item_id` will link to `purchase_order_items` |
| `delivery_packs` | Scanner | ✅ Complete |
| `delivery_pack_items` | Scanner | ✅ `order_id` will link to `sales_orders` |
| `inventory` | Scanner, ERP | ✅ Complete |
| `inventory_log` | Scanner, ERP | ✅ Complete |
| `wastage_entries` | Scanner, ERP | ✅ Complete |
| `wastage_log` | Scanner | ✅ Complete |

---

### Must Add — Customer & Order Layer
| Table | Used by | Key columns |
|-------|---------|-------------|
| `customers` | Website, App, ERP | id, name, email, phone, address, pincode, hub_id, customer_type (static/dynamic/individual), channel, source, loyalty_points, referral_code |
| `addresses` | App, Website | id, customer_id, label, line1, city, state, pincode, lat, lng, is_default |
| `hub_pincodes` | ERP (auto-assign) | id, hub_id, pincode, area_name |
| `sales_orders` | Website, App, ERP | id, order_number, customer_id, hub_id, status, payment_method, payment_status, subtotal, delivery_fee, discount, total, delivery_address, delivery_slot, delivery_date, channel, source, razorpay fields, created_at |
| `sales_order_items` | Website, App, ERP | id, order_id, product_id, product_name, quantity, unit, unit_price, discount_pct, total_price |
| `invoices` | ERP, App | id, order_id, customer_id, invoice_number, amount, status, issued_at |
| `cart_items` | App | id, customer_id, product_id, quantity, added_at |
| `delivery_slots` | Website, App | id, date, slot_type, slot_label, start_time, end_time, max_capacity, current_usage, hub_id, is_active |
| `categories` | App, Website, ERP | id, name, slug, image_url, parent_id, sort_order, is_active |
| `wishlists` | App, Website | id, customer_id, product_id, created_at |
| `reviews` | App, Website | id, customer_id, product_id, rating, comment, is_visible |
| `banners` | App, Website, ERP | id, title, image_url, link, is_active, sort_order |
| `coupons` | App, Website | id, code, discount_type, discount_value, min_order, max_uses, used_count, expires_at |
| `bulk_order_uploads` | ERP | id, customer_id, file_url, file_type, status, parsed_orders, uploaded_by |
| `customer_queries` | Website, App | id, customer_id, customer_email, subject, message, status, admin_reply |
| `customer_notifications` | Website, App | id, customer_id, title, message, type, order_id, is_read, channel |
| `notifications` | ERP, Scanner | id, user_id (profile), title, body, type, is_read, ref_id, ref_type |

---

### Must Add — Purchase & Vendor Layer
| Table | Used by | Key columns |
|-------|---------|-------------|
| `vendors` | ERP | id, name, type (static/dynamic), phone, address, bank_name, account_number, ifsc_code, upi_id, gst_number, is_active |
| `purchase_orders` | ERP, Scanner (via boxes) | id, po_number, hub_id, eod_date, status, total_estimated, created_at |
| `purchase_order_items` | ERP, Scanner (boxes.po_item_id) | id, po_id, product_id, hub_id, required_qty, ordered_qty, unit, estimated_price |
| `purchase_entries` | ERP | id, po_id, vendor_id, purchased_by (profile_id), total_amount, notes, created_at |
| `purchase_entry_items` | ERP | id, entry_id, product_id, quantity, unit_price, total |

---

### Must Add — Payment Approval Layer
| Table | Used by | Key columns |
|-------|---------|-------------|
| `vendor_payments` | ERP | id, purchase_entry_id, vendor_id, amount, status (pending_ops → pending_l1 → pending_auditor → pending_ceo → approved), items_snapshot jsonb |
| `payment_approvals` | ERP | id, payment_id, payment_type (vendor/porter/transit), level (ops_manager/l1/auditor/ceo), approved_by, approved_at, remarks |
| `porter_transit_payments` | ERP | id, hub_id, delivery_pack_id, type (porter/transit), amount, payee_name, payee_phone, status |

---

### Must Add — PO Assignment & Scheduling
| Table | Used by | Key columns |
|-------|---------|-------------|
| `po_assignments` | ERP | id, po_id, hub_id, purchase_executive_id (profile_id), assigned_at, status |

---

## 5. All 4 Systems — Exact Read/Write Per Table

### Scanner App
| Operation | Table | R/W |
|-----------|-------|-----|
| Login | `profiles` | R |
| Load hub info | `hubs` | R |
| Scan box | `boxes` | R/W |
| Receive box → inventory | `inventory`, `inventory_log` | W |
| QC check | `boxes` | W |
| Pack boxes | `delivery_packs`, `delivery_pack_items` | R/W |
| Dispatch pack | `delivery_packs` | W |
| Log wastage | `wastage_entries`, `wastage_log` | W |
| View products | `products` | R |

### Customer App (after migration from Prisma → Supabase)
| Operation | Table | R/W |
|-----------|-------|-----|
| Register/login | `customers` | R/W |
| Browse products | `products`, `categories` | R |
| Add to cart | `cart_items` | R/W |
| View/add address | `addresses` | R/W |
| Place order | `sales_orders`, `sales_order_items` | W |
| Razorpay callback | `sales_orders` (update payment fields) | W |
| View my orders | `sales_orders`, `sales_order_items` | R |
| Track order | `sales_orders`, `delivery_packs` | R |
| Wishlist | `wishlists` | R/W |
| Reviews | `reviews` | R/W |
| Notifications | `customer_notifications` | R |
| Support ticket | `customer_queries` | W |
| View banners | `banners` | R |
| Apply coupon | `coupons` | R/W |

### Website (after credential update)
| Operation | Table | R/W |
|-----------|-------|-----|
| Browse products | `products`, `categories` | R |
| View delivery slots | `delivery_slots` | R |
| Register/login | `customers` | R/W |
| Place order | `sales_orders`, `sales_order_items` | W |
| View my orders | `sales_orders` | R |
| View invoice | `invoices` | R |
| Support ticket | `customer_queries` | W |
| View notifications | `customer_notifications` | R |
| Farm stories/streams | `farm_stories`, `farm_streams` | R (keep in website or migrate) |

### ERP Web App (after credential update + full schema deployed)
| Operation | Table | R/W |
|-----------|-------|-----|
| View all orders | `sales_orders`, `sales_order_items` | R |
| Manage customers | `customers` | R/W |
| Upload bulk order file | `bulk_order_uploads` | W |
| View EOD POs | `purchase_orders`, `purchase_order_items` | R |
| PE: fill purchase entry | `purchase_entries`, `purchase_entry_items` | W |
| PE: select vendor | `vendors` | R/W |
| Download box labels | `boxes`, `purchase_order_items` | R |
| Approve vendor payment | `vendor_payments`, `payment_approvals` | R/W |
| Approve porter/transit | `porter_transit_payments`, `payment_approvals` | R/W |
| View inventory | `inventory`, `inventory_log` | R |
| View wastage | `wastage_entries`, `wastage_log` | R |
| Manage delivery slots | `delivery_slots` | W |
| Manage hubs | `hubs`, `hub_pincodes` | R/W |
| Notifications | `notifications` | R/W |

---

## 6. Automations Required (Edge Functions + Triggers)

| # | Trigger | What fires | Output |
|---|---------|-----------|--------|
| 1 | `sales_orders` INSERT | DB Trigger: `auto_assign_hub` | Looks up `customers.pincode → hub_pincodes → hubs.id`, sets `sales_orders.hub_id` |
| 2 | `sales_orders` INSERT | DB Trigger: `auto_create_invoice` | Inserts into `invoices` (status=draft) |
| 3 | `bulk_order_uploads` INSERT | Edge Function: `parse-order-file` | Parses Excel/CSV/PDF → inserts `sales_orders` + `sales_order_items` |
| 4 | Cron: every day 23:50 | Edge Function: `eod-po-engine` | Groups orders by product+hub, checks inventory, creates `purchase_orders` + `purchase_order_items`, creates `boxes`, assigns to PEs |
| 5 | `purchase_order_items` INSERT | DB Trigger: `auto_create_boxes` | Generates box label records in `boxes` (with barcode, QR payload, po_item_id) |
| 6 | `purchase_entries` INSERT | DB Trigger: `auto_vendor_payment` | Creates `vendor_payments` at `pending_ops_approval` |
| 7 | `vendor_payments` UPDATE (status change) | DB Trigger: `notify_next_approver` | Inserts into `notifications` for next person in chain |
| 8 | `boxes` UPDATE status=`received` | DB Trigger: `inventory_on_receive` | Updates `inventory` qty +, inserts `inventory_log` |
| 9 | `wastage_log` INSERT | DB Trigger: `inventory_on_wastage` | Updates `inventory` qty -, inserts `inventory_log` |
| 10 | `boxes` UPDATE status=`dispatched` | DB Trigger: `inventory_on_dispatch` | Updates `inventory` qty -, inserts `inventory_log` |

---

## 7. Credential Changes Per System

### ERP Web App (`D:\fferpv2 app\.env`)
```
# Change FROM:
VITE_SUPABASE_URL=https://bvbfnguqpuctdvfztuda.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...old...

# Change TO:
VITE_SUPABASE_URL=https://qwiumswrbddwmlraktvy.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...AsY045N7...
```

### Customer App (`D:\ff-app\.env.local` — create this file)
```
# Create new file .env.local:
NEXT_PUBLIC_SUPABASE_URL=https://qwiumswrbddwmlraktvy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...AsY045N7...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...9MBa2AP...
# Remove DATABASE_URL (Prisma/SQLite — no longer needed)
```

### Website (`ffwebsite` repo — update `src/lib/supabase.ts`)
```
# Change the hardcoded URL from:
const DEFAULT_SUPABASE_URL = 'https://celsdwfmogpejwzbkxad.supabase.co';

# Change to:
const DEFAULT_SUPABASE_URL = 'https://qwiumswrbddwmlraktvy.supabase.co';
```
Also update `.env` / Vercel environment variables.

### Scanner App — No change needed ✅
```
# Already correct in .env:
EXPO_PUBLIC_SUPABASE_URL=https://qwiumswrbddwmlraktvy.supabase.co
```

---

## 8. Customer App Code Changes (Prisma → Supabase)

The customer app's API routes currently use `prisma.order.findMany()` etc.
These need to be replaced with Supabase calls. Key files to update:

| File | Change |
|------|--------|
| `app/api/orders/route.ts` | Replace `prisma.order` → `supabase.from('sales_orders')` |
| `app/api/orders/[id]/route.ts` | Same |
| `app/api/user/addresses/route.ts` | Replace `prisma.address` → `supabase.from('addresses')` |
| `app/api/admin/orders/route.ts` | Replace Prisma → Supabase |
| `app/api/admin/products/route.ts` | Replace Prisma → Supabase |
| `lib/db.ts` | Remove Prisma client, use Supabase client from `lib/supabase.ts` |
| `prisma/schema.prisma` | No longer needed (keep as reference only) |

**Compatibility views to avoid changing query table names:**
```sql
-- Run on new DB — lets app code keep using 'orders', 'users' etc.
CREATE VIEW public.orders      AS SELECT * FROM public.sales_orders;
CREATE VIEW public.order_items AS SELECT * FROM public.sales_order_items;
CREATE VIEW public.users       AS SELECT * FROM public.customers;
CREATE VIEW public.dark_stores AS SELECT id, name, city, pincode, lat, lng,
                                         radius_km, is_active FROM public.hubs;
```

---

## 9. Execution Order

```
PHASE 1 — Database (new DB only)
  Step 1 → Run MASTER_INTEGRATION_MIGRATION.sql on qwiumswrbddwmlraktvy
            (extends existing 10 tables + adds all new tables)
  Step 2 → Add hub_pincodes data (map each hub's service pincodes)
  Step 3 → Create compatibility views (orders, users, order_items, dark_stores)
  Step 4 → Verify: all 10 scanner tables still intact, new tables created

PHASE 2 — ERP Web App
  Step 5 → Update .env: VITE_SUPABASE_URL → qwiumswrbddwmlraktvy
  Step 6 → Test: ERP login works, dashboards load

PHASE 3 — Website
  Step 7 → Update Supabase URL in src/lib/supabase.ts
  Step 8 → Migrate existing website data (customers, orders, products)
  Step 9 → Test: browse, login, place test order → appears in ERP instantly

PHASE 4 — Customer App
  Step 10 → Create .env.local with new DB credentials
  Step 11 → Replace Prisma calls with Supabase in API routes
  Step 12 → Test: login, browse, add to cart, checkout → order appears in ERP

PHASE 5 — Automations
  Step 13 → Deploy EOD PO Edge Function (cron 23:50)
  Step 14 → Deploy file parser Edge Function (Excel/CSV/PDF)
  Step 15 → Add box label PDF generator
  Step 16 → Test full cycle: order → EOD → PO → PE dashboard → purchase → scan → inventory

PHASE 6 — Verification
  Step 17 → Enable Supabase Realtime on: sales_orders, inventory, purchase_orders
  Step 18 → Full end-to-end test with real order
  Step 19 → Archive old databases (stop writing to them)
```

---

## 10. What's Already Done vs Still To Build

| Component | Status | Notes |
|-----------|--------|-------|
| Scanner App | ✅ Done | On correct DB, fully working |
| Scanner DB schema (10 tables) | ✅ Done | Already in new DB |
| ERP web app (fferpv2) | ✅ Built | Needs DB credential update only |
| Website frontend | ✅ Built | Needs DB credential + URL change |
| Customer app frontend | ✅ Built | Needs Prisma → Supabase migration |
| New DB schema (Phase 1) | ⏳ To run | SQL migration file ready |
| Hub pincode mapping | ⏳ To add | Need pincode data from you |
| Compatibility views | ⏳ To create | 4 simple views |
| EOD PO Engine | ⏳ To build | Edge Function + cron |
| File parser (Excel/CSV/PDF) | ⏳ To build | Edge Function |
| Box label PDF generator | ⏳ To build | Edge Function or ERP component |
| Payment approval chain | ⏳ To wire up | Tables ready, UI in ERP |
| Prisma → Supabase (app API routes) | ⏳ To migrate | ~6 files to update |

---

*No changes made to any database or codebase yet.*
*Awaiting your confirmation to begin Phase 1.*
