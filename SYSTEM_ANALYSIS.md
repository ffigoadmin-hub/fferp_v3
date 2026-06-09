# FFERPv2 — Complete 4-System Database Analysis
Generated: 2026-05-30

## THE 4 SYSTEMS & THEIR CURRENT DATABASES

| System | Current Supabase URL | Tables Used | Status |
|--------|---------------------|-------------|--------|
| **ERP** (web) | bvbfnguqpuctdvfztuda | 100+ tables | ✅ Working |
| **Scanner App** | bvbfnguqpuctdvfztuda | boxes, inventory_log, wastage_log, delivery_packs, delivery_pack_items, products, hubs, inventory | ✅ Same as ERP — already connected |
| **Employee Mobile App** | slfxozmbwogpisxeltty | 50+ tables (HR, attendance, chat, leave, transport claims) | ⚠️ SEPARATE DB — not connected to ERP |
| **Customer Website** | rwasfuhrvqscqnpwqooq | sales_orders, customers, products | ❌ SEPARATE DB — orders never reach ERP |

## WHY ORDERS DON'T APPEAR IN ERP

Customer places order on website → goes to `rwasfuhrvqscqnpwqooq`
ERP reads orders from `bvbfnguqpuctdvfztuda`
→ They are DIFFERENT databases → ERP sees NOTHING

## THE FIX: ONE DATABASE FOR ALL

New target database: `rwasfuhrvqscqnpwqooq` (website DB becomes the unified DB)

All 4 systems point to: `https://rwasfuhrvqscqnpwqooq.supabase.co`

## TABLES TO ADD TO NEW DATABASE (missing from website DB)

### From ERP (bvbfnguqpuctdvfztuda) — 100 tables
Full list in MASTER_SCHEMA_V1.sql

### From Scanner App — unique tables not in ERP
- boxes (box_code, po_item_id, product_id, hub_id, weight_kg, qr_url, barcode_url, status)
- inventory_log (hub_id, product_id, event_type, qty_delta, ref_id, ref_type, notes)
- wastage_log (box_id, hub_id, product_id, reason, weight_kg, photo_url, logged_by)
- delivery_packs (pack_code, hub_id, driver_id, route_date, status, dispatched_at, delivered_at)
- delivery_pack_items (pack_id, box_id, order_id)
- products needs: ADD COLUMN sku text

### From Employee Mobile App (slfxozmbwogpisxeltty) — extra tables
- company_calendar
- announcement_reads
- announcement_comments
- push_tokens
- transport_claims
- transport_bookings
- payslips (already → employee_payslips in ERP, add alias)
- lop_reversal_requests
- leave_balances
- leave_types

### From Website (rwasfuhrvqscqnpwqooq) — already there
- sales_orders, customers, products (basic versions)

## WHAT I STILL NEED FROM YOU

1. Database password for `rwasfuhrvqscqnpwqooq` (new unified DB)
   → So I can verify what tables are already there
   
2. Employee Mobile App credentials (`slfxozmbwogpisxeltty`)
   → URL + anon key + database password
   → So I can read exact schema before migration

3. Confirm: Is `rwasfuhrvqscqnpwqooq` the NEW database or the current website DB?
