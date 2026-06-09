# FF ERP — Master Database Connection Plan
**Core Database:** `qwiumswrbddwmlraktvy` (Supabase)  
**Generated:** 2026-06-01  
**Status:** Architecture Plan — No changes made yet

---

## 1. The Single Core Database Principle

Every system — website, customer app, scanner app, ERP — connects to ONE database: `qwiumswrbddwmlraktvy`.

No syncing. No bridges. No duplication.  
When a customer places an order on the website, the ERP sees it in real time. When a hub manager scans a box, inventory updates instantly everywhere.

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   Customer Website  ──────────────────────────────────┐    │
│   Customer App (Expo/React Native)  ──────────────┐   │    │
│   ERP Web App (fferpv2)  ─────────────────────┐   │   │    │
│   Scanner App (already connected)  ────────┐  │   │   │    │
│                                            ▼  ▼   ▼   ▼    │
│              NEW CORE DB: qwiumswrbddwmlraktvy              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Database Status — What Exists vs What's Needed

### Already in New DB (10 tables — scanner schema)

| Table | Status | Connected to |
|-------|--------|-------------|
| `hubs` | ✅ exists | Scanner, ERP |
| `products` | ✅ exists (simple) | Scanner, ERP, Website, App |
| `boxes` | ✅ exists | Scanner App |
| `delivery_packs` | ✅ exists | Scanner App |
| `delivery_pack_items` | ✅ exists | Scanner App |
| `inventory` | ✅ exists | Scanner App, ERP |
| `inventory_log` | ✅ exists | Scanner App, ERP |
| `wastage_entries` | ✅ exists | Scanner App, ERP |
| `wastage_log` | ✅ exists | Scanner App |
| `profiles` | ✅ exists (hub staff) | Scanner App, ERP |

### Needs to be Added (grouped by workflow stage)

**Customer & Order Layer**

| Table | Purpose |
|-------|---------|
| `customers` | Dynamic + Static customers (Dmart, TAJ, etc.) |
| `hub_pincodes` | Pincode → Hub mapping for auto-assignment |
| `sales_orders` | All orders from website, app, manual, file upload |
| `sales_order_items` | Line items per order |
| `bulk_order_uploads` | File uploads (Excel/CSV/PDF) from static customers |
| `invoices` | Auto-generated customer bill per order |
| `delivery_slots` | Time slots (Morning/Evening) per date per hub |
| `customer_notifications` | Order status updates back to customer |

**Purchase & Vendor Layer**

| Table | Purpose |
|-------|---------|
| `vendors` | Static (auto-fill) + Dynamic (manual) vendors |
| `purchase_orders` | EOD auto-generated PO, grouped by hub + product |
| `purchase_order_items` | Line items per PO (po_item_id links to boxes) |
| `purchase_entries` | What PE actually bought, from which vendor |
| `purchase_entry_items` | Items in purchase entry |

**Payment & Approval Layer**

| Table | Purpose |
|-------|---------|
| `vendor_payments` | Auto-created from purchase entry |
| `payment_approvals` | Multi-step: ops_manager → L1 → auditor → CEO |
| `porter_transit_payments` | Labour + vehicle payments per hub/trip |

**Notifications & Assignment Layer**

| Table | Purpose |
|-------|---------|
| `po_assignments` | Which PE is assigned which PO |
| `notifications` | System-wide notifications for all roles |

---

## 3. The 5 Systems — What Each One Reads & Writes

### System 1: Customer Website
**Current DB:** `rwasfuhrvqscqnpwqooq`  
**After plan:** Points at `qwiumswrbddwmlraktvy`

| Action | Table | Operation |
|--------|-------|-----------|
| Browse products | `products` | READ (published only) |
| View delivery slots | `delivery_slots` | READ |
| Register / login | `customers` | READ / WRITE |
| Place order | `sales_orders` | WRITE |
| Place order items | `sales_order_items` | WRITE |
| View own orders | `sales_orders` | READ (own only) |
| View invoice | `invoices` | READ (own only) |
| Raise support ticket | `customer_queries` | WRITE |
| View notifications | `customer_notifications` | READ (own only) |

---

### System 2: Customer App (React Native / Expo)
**Current DB:** Unknown / to be updated  
**After plan:** Points at `qwiumswrbddwmlraktvy`

Same as website. Identical read/write access.  
Channel field = `'app'` (website uses `'website'`).

---

### System 3: ERP Web App (fferpv2)
**Current DB:** `bvbfnguqpuctdvfztuda`  
**After plan:** Points at `qwiumswrbddwmlraktvy`

Full access. Role-based visibility.

| Role | What they see |
|------|--------------|
| Admin / CEO | Everything |
| FF Operations Manager | All orders, POs, purchase entries, payments, inventory |
| Purchase Executive | Their hub's POs, box labels, purchase entry form |
| L1 (Team Head) | Payment approvals for their team |
| Auditor | Payment approval queue |
| Hub Manager | Their hub's inventory, wastage, delivery packs |

**Key ERP operations:**

| Action | Table | Operation |
|--------|-------|-----------|
| View all orders | `sales_orders` | READ |
| Manual order entry | `sales_orders`, `sales_order_items` | WRITE |
| Upload bulk order file (Dmart/TAJ) | `bulk_order_uploads` | WRITE |
| View/manage customers | `customers` | READ / WRITE |
| View all POs | `purchase_orders`, `purchase_order_items` | READ |
| Fill purchase entry (PE) | `purchase_entries`, `purchase_entry_items` | WRITE |
| Select vendor | `vendors` | READ / WRITE |
| View/approve payments | `vendor_payments`, `payment_approvals` | READ / WRITE |
| Download box labels | `boxes` | READ |
| View inventory | `inventory`, `inventory_log` | READ |
| View wastage | `wastage_entries`, `wastage_log` | READ |
| Manage delivery slots | `delivery_slots` | WRITE |
| View delivery packs | `delivery_packs`, `delivery_pack_items` | READ |

---

### System 4: Scanner App
**Current DB:** `qwiumswrbddwmlraktvy` ✅ Already connected. No change needed.

| Action | Table | Operation |
|--------|-------|-----------|
| Scan box on unloading | `boxes` (status → 'received') | WRITE |
| Auto inventory update | `inventory` | WRITE (trigger) |
| Log inventory event | `inventory_log` | WRITE (trigger) |
| Log wastage | `wastage_entries`, `wastage_log` | WRITE |
| View delivery packs | `delivery_packs`, `delivery_pack_items` | READ |
| View hub info | `hubs` | READ |
| View box labels | `boxes` | READ |

---

### System 5: Old Internal IGO ERP (`slfxozmbwogpisxeltty`)
**Status:** Stays completely separate. Not connected to new DB.  
This handles internal HR, payroll, projects, farms, cafe — none of that is part of this workflow.

---

## 4. Full Workflow → Database Operations

### Stage 1: Order Arrives (11:00 AM – 11:30 PM)

```
Customer on website/app places order
        ↓
INSERT into sales_orders (channel='website'/'app', status='pending')
INSERT into sales_order_items
        ↓
TRIGGER: auto-assign hub_id based on customer pincode
         (lookup: customers.pincode → hub_pincodes.pincode → hubs.id)
        ↓
TRIGGER: auto-create invoice record
         INSERT into invoices (status='draft')
```

**For Manual Entry (ERP staff):**
```
ERP user fills order form
        ↓
INSERT into sales_orders (channel='manual')
INSERT into sales_order_items
        ↓
Same triggers as above
```

**For Static Customer File Upload (Dmart, TAJ):**
```
Staff uploads Excel/CSV/PDF on orders page
        ↓
INSERT into bulk_order_uploads (file_url, customer_id, status='processing')
        ↓
Edge Function: parse file → extract line items
        ↓
INSERT into sales_orders (channel='file_upload', customer_id=static_customer)
INSERT into sales_order_items
        ↓
Same triggers as above
```

---

### Stage 2: EOD PO Generation (11:50 PM daily — Scheduled)

```
Supabase Cron Job fires at 23:50
        ↓
Edge Function: EOD PO Engine
  1. Read all sales_orders WHERE DATE = today AND status != 'cancelled'
  2. Group by: product_id + hub_id
  3. For each group: required_qty = SUM(order items qty)
  4. Read current inventory: SELECT quantity FROM inventory WHERE hub_id + product_id
  5. net_qty = required_qty - current_inventory (minimum 0)
  6. If net_qty > 0: create PO line
        ↓
INSERT into purchase_orders (po_number=auto, hub_id, eod_date, status='pending')
INSERT into purchase_order_items (po_id, product_id, required_qty, ordered_qty=net_qty, hub_id)
        ↓
TRIGGER: auto-generate box labels
  INSERT into boxes (box_code=auto, po_item_id, product_id, hub_id, status='created')
  (one box per unit/batch as per PO qty)
        ↓
INSERT into po_assignments (po_id, hub_id, purchase_executive_id)
        ↓
INSERT into notifications (user_id=PE, title='New PO Ready', ref_id=po_id)
        ↓
PO appears live on Purchase Executive dashboard
```

---

### Stage 3: Purchase Executive Downloads Box Labels

```
PE opens their dashboard → sees their hub's PO
        ↓
READ boxes WHERE po_item_id IN (this PO's items) AND hub_id = PE's hub
        ↓
Generate PDF label: [PO Number | Barcode | Weight | Hub Name]
        ↓
PE prints labels → takes to market
```

---

### Stage 4: PE Purchases at Market

```
PE buys items → fills purchase entry form in ERP
        ↓
SELECT vendors (type='static' → auto-fill bank/details)
        or
INSERT into vendors (type='dynamic', fill all fields manually)
        ↓
INSERT into purchase_entries (po_id, vendor_id, purchased_by=PE, total_amount)
INSERT into purchase_entry_items (entry_id, product_id, quantity, unit_price, total)
        ↓
TRIGGER: auto-create vendor payment
INSERT into vendor_payments (
  purchase_entry_id,
  vendor_id,
  amount,
  status = 'pending_ops_approval',
  items_detail = jsonb snapshot
)
        ↓
INSERT into notifications (user_id=ops_manager, title='Payment Awaiting Approval')
```

---

### Stage 5: Payment Approval Chain

```
Level 1 — FF Operations Manager
  READ vendor_payments WHERE status='pending_ops_approval'
  APPROVE → UPDATE status='pending_l1_approval'
             INSERT into payment_approvals (level='ops_manager', approved_by, approved_at)
             INSERT into notifications (user_id=l1_head)
        ↓
Level 2 — L1 (Team Head)
  READ vendor_payments WHERE status='pending_l1_approval'
  APPROVE → UPDATE status='pending_auditor_approval'
             INSERT into payment_approvals (level='l1', ...)
             INSERT into notifications (user_id=auditor)
        ↓
Level 3 — Auditor
  READ vendor_payments WHERE status='pending_auditor_approval'
  APPROVE → UPDATE status='pending_ceo_approval'
             INSERT into payment_approvals (level='auditor', ...)
             INSERT into notifications (user_id=ceo)
        ↓
Level 4 — CEO
  READ vendor_payments WHERE status='pending_ceo_approval'
  APPROVE → UPDATE status='approved'
             INSERT into payment_approvals (level='ceo', ...)
             Payment released
```

**Porter & Transit Payment follows same chain:**
```
INSERT into porter_transit_payments (hub_id, delivery_pack_id, type='porter'/'transit',
                                     amount, payee_name, status='pending_ops_approval')
→ Same 4-level approval chain
```

---

### Stage 6: Hub Unloading + Scanner

```
PE arrives at hub with goods + printed box labels
        ↓
Hub Manager opens Scanner App
        ↓
Scans each box label (barcode)
        ↓
UPDATE boxes SET status='received', updated_at=now()
        ↓
TRIGGER: inventory update
  UPDATE inventory SET quantity = quantity + box.weight_kg
         WHERE hub_id = box.hub_id AND product_id = box.product_id
  INSERT into inventory_log (event_type='box_received', qty_delta=+weight_kg, ref_id=box_id)
        ↓
ERP inventory dashboard refreshes live (Supabase Realtime)
```

---

### Stage 7: Wastage & Damage Entry

```
Hub Manager finds damaged/wastage items
        ↓
Fills wastage form in Scanner App (during unloading or EOD)
        ↓
INSERT into wastage_entries (hub_id, item_name, quantity_kg, reason, photo_url, entry_date)
INSERT into wastage_log (box_id, hub_id, product_id, reason, weight_kg, photo_url)
        ↓
TRIGGER: deduct from inventory
  UPDATE inventory SET quantity = quantity - wastage_log.weight_kg
  INSERT into inventory_log (event_type='wastage', qty_delta=-weight_kg, ref_id=wastage_id)
        ↓
ERP shows wastage report + inventory adjusts live
```

---

### Stage 8: Inventory ↔ PO Feedback Loop

```
Every time inventory changes (scan in or wastage out):
        ↓
inventory table updates
        ↓
Next EOD Engine at 11:50 PM reads CURRENT inventory
  net_qty = orders_needed - current_inventory
        ↓
If a PO was already created for this product+hub:
  UPDATE purchase_order_items SET ordered_qty = new_net_qty
If net_qty = 0: mark PO item as 'fulfilled_by_stock' (no purchase needed)
If net_qty > 0 and new: add to PO
```

---

## 5. Table Foreign Key Map (Full Relationship)

```
customers
  └── hub_id → hubs.id
  └── source_pincodes → hub_pincodes.hub_id → hubs.id

sales_orders
  └── customer_id → customers.id
  └── hub_id → hubs.id

sales_order_items
  └── order_id → sales_orders.id
  └── product_id → products.id

invoices
  └── order_id → sales_orders.id
  └── customer_id → customers.id

bulk_order_uploads
  └── customer_id → customers.id

purchase_orders
  └── hub_id → hubs.id

purchase_order_items
  └── po_id → purchase_orders.id
  └── product_id → products.id
  └── hub_id → hubs.id

boxes  [ALREADY EXISTS]
  └── po_item_id → purchase_order_items.id  ← CURRENTLY MISSING PARENT TABLE
  └── product_id → products.id
  └── hub_id → hubs.id

delivery_pack_items  [ALREADY EXISTS]
  └── order_id → sales_orders.id  ← CURRENTLY MISSING PARENT TABLE
  └── box_id → boxes.id
  └── pack_id → delivery_packs.id

vendors
  └── (no FK — standalone)

purchase_entries
  └── po_id → purchase_orders.id
  └── vendor_id → vendors.id
  └── purchased_by → profiles.id

purchase_entry_items
  └── entry_id → purchase_entries.id
  └── product_id → products.id

vendor_payments
  └── purchase_entry_id → purchase_entries.id
  └── vendor_id → vendors.id

payment_approvals
  └── payment_id → vendor_payments.id
  └── approved_by → profiles.id

porter_transit_payments
  └── hub_id → hubs.id
  └── delivery_pack_id → delivery_packs.id

po_assignments
  └── po_id → purchase_orders.id
  └── purchase_executive_id → profiles.id
  └── hub_id → hubs.id

inventory  [ALREADY EXISTS]
  └── hub_id → hubs.id
  └── product_id → products.id

inventory_log  [ALREADY EXISTS]
  └── inventory_id → inventory.id
  └── hub_id → hubs.id
  └── product_id → products.id

wastage_entries  [ALREADY EXISTS]
  └── hub_id → hubs.id
  └── submitted_by → profiles.id

wastage_log  [ALREADY EXISTS]
  └── box_id → boxes.id
  └── hub_id → hubs.id
  └── product_id → products.id
```

---

## 6. Automation Triggers & Scheduled Jobs

| Trigger | When | What it does |
|---------|------|-------------|
| `auto_assign_hub` | sales_orders INSERT | Looks up customer pincode → hub_pincodes → sets hub_id |
| `auto_create_invoice` | sales_orders INSERT | Creates draft invoice record |
| `auto_box_labels` | purchase_order_items INSERT | Creates boxes records with auto barcode |
| `auto_vendor_payment` | purchase_entries INSERT | Creates vendor_payments at pending_ops_approval |
| `notify_pe_new_po` | po_assignments INSERT | Sends notification to PE |
| `notify_approver` | vendor_payments UPDATE | Notifies next approver in chain |
| `inventory_on_scan` | boxes UPDATE (status=received) | Updates inventory + inventory_log |
| `inventory_on_wastage` | wastage_log INSERT | Deducts from inventory + inventory_log |
| **EOD PO Engine** | CRON 23:50 daily | Groups orders → checks inventory → creates POs |
| **File Parse Engine** | bulk_order_uploads INSERT | Parses Excel/CSV/PDF → creates orders |

---

## 7. Credential Changes Required Per System

| System | Current DB | Change to |
|--------|-----------|-----------|
| Customer Website | `rwasfuhrvqscqnpwqooq` | `qwiumswrbddwmlraktvy` |
| Customer App (Expo) | Unknown | `qwiumswrbddwmlraktvy` |
| ERP (fferpv2) | `bvbfnguqpuctdvfztuda` | `qwiumswrbddwmlraktvy` |
| Scanner App | `qwiumswrbddwmlraktvy` | ✅ No change |
| Old Internal ERP | `slfxozmbwogpisxeltty` | ✅ Stays separate — not connected |

**New DB credentials to use in all systems:**
```
URL:          https://qwiumswrbddwmlraktvy.supabase.co
ANON KEY:     eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...AsY045N7wHqMF_2P0-D2Ouzrkphjfkb4CP6ImhSm-tc
SERVICE KEY:  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...9MBa2APApHe1pKgHqjCbhdK-lAobYrPGoFlMoRdCFiU
```

---

## 8. Tables to Extend (Existing Tables Need New Columns)

### `products` — add pricing + website fields
```
+ grade_a_price     numeric
+ grade_b_price     numeric
+ grade_c_price     numeric
+ original_price    numeric
+ website_price     numeric
+ description       text
+ category          text
+ badge             text
+ stock_left        integer
+ weight_options    jsonb
+ is_published      boolean
+ image_url         text  (already exists)
```

### `profiles` — add ERP role system
```
+ role       (expand beyond 'hub_manager' to all ERP roles)
+ department text
+ phone      text
+ employee_id text
```

### `hubs` — add capacity fields (already has most)
```
+ city       text
+ state      text
+ display_name text
```

---

## 9. What's Already Built vs Needs Building

| Component | Status |
|-----------|--------|
| Scanner App + hub schema | ✅ Built, connected to new DB |
| ERP web app (fferpv2) | ✅ Built — needs DB credential update |
| Customer website | ✅ Built — needs DB credential update |
| Customer app (Expo) | ✅ Built — needs DB credential update |
| Schema extensions (new tables) | ⏳ To build (SQL migration) |
| EOD PO Engine (Edge Function) | ⏳ To build |
| File parser (Excel/CSV/PDF) | ⏳ To build |
| Box label PDF generator | ⏳ To build |
| Payment approval chain logic | ⏳ To build |
| Hub pincode assignment trigger | ⏳ To build |
| Inventory ↔ PO feedback loop | ⏳ To build |

---

## 10. Build Order (What to Execute First)

```
Step 1  →  Run schema migration on qwiumswrbddwmlraktvy
           (extend existing tables + add all new tables)

Step 2  →  Add hub_pincodes data (map pincodes to hubs)

Step 3  →  Update ERP (fferpv2) .env → point at new DB
           Test: can ERP log in and see tables?

Step 4  →  Update website .env → point at new DB
           Test: can customer browse, register, place order?

Step 5  →  Update customer app Supabase config → point at new DB
           Test: can customer place order from app?

Step 6  →  Deploy EOD PO Edge Function (cron 23:50)
           Test: place test orders → trigger manually → check POs created

Step 7  →  Deploy file parser Edge Function
           Test: upload sample Excel → check orders created

Step 8  →  Deploy box label PDF generator
           Test: PO created → labels downloadable

Step 9  →  Test full payment approval chain
           Test order → PO → purchase entry → payment → all 4 approvals

Step 10 →  Scanner integration test
           Scan test box → check inventory updates live in ERP
```

---

*This is the architecture plan. No database changes have been made yet.*  
*Next: Confirm this plan, then execute the schema migration SQL.*
