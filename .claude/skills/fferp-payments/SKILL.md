---
name: fferp-payments
description: >
  Domain skill for FF vendor and transport payments in the Farmers Factory ERP — raising payments
  (forms, Buy auto-create, Raise & Approve), the five-stage approval chain (Manager → L1 → Admin →
  CEO → Accounts → paid), rejection, Approve All, hub filters, sidebar badge counts, My Submitted
  Payments, Accounts payout (Mark Paid with UTR, Execution Desk batches, Kotak CMS bulk file, bank
  statement UTR matching, Revoke, Batch History), and the RLS helpers behind them. Load it whenever the
  request mentions payment, approval, approve, reject, pending_l1, pending_accounts, UTR, Kotak, batch,
  payout, disburse, "mark paid", "who approves", "payment not showing", "payment stuck", transport
  payment, porter payment, or ff_vendor_payments / ff_transport_payments / ff_payment_batches. This is
  the most-changed area of the ERP and the one where a wrong status string or column silently breaks
  money flow.
---

# FFERP — Payments domain

## The chain (since 2026-09-03, `REFINE_PAYMENT_APPROVAL_CHAIN.sql`)

```
raise ──▶ pending_ff_ops ──▶ pending_l1 ──▶ pending_admin ──▶ pending_ceo ──▶ pending_accounts ──▶ paid
            Manager            L1 Mgr          Admin             CEO            Accounts
          (ff_operations_manager)                                              (approval = disbursement)
   any stage ──▶ rejected  (rejection_reason required; who/role/when are stamped INTO the reason text)
```

- A status means "waiting on this stage; all earlier stages approved".
- "Manager" **reuses** `pending_ff_ops` and `ff_ops_approved_by/_at` — only the label changed, so
  every reader of that literal string still works. Do not rename the status.
- Retired stages `pending_gm`, `pending_auditor`, and `approved` stay valid in the CHECK constraint
  for historical rows; nothing routes into them. In-flight rows were auto-advanced by the migration.
- Both `ff_vendor_payments` and `ff_transport_payments` use the same statuses and stage columns.

The chain is defined **once**, in `src/pages/ff-operations/FFPaymentApprovals.tsx`, and exported:

```ts
NEXT_STATUS       = { ff_operations_manager:'pending_l1', l1_manager:'pending_admin', admin:'pending_ceo', ceo:'pending_accounts' }
APPROVED_BY_COL   = { ff_operations_manager:'ff_ops', l1_manager:'l1', admin:'admin', ceo:'ceo' }
MY_PENDING_STATUS = { ff_operations_manager:'pending_ff_ops', l1_manager:'pending_l1', admin:'pending_admin', ceo:'pending_ceo', accounts:'pending_accounts' }
```

`useFFPaymentCount.ts` (badges), `MySubmittedPayments.tsx` (submitter view), and
`PurchaseReportPage.tsx` (inline Approve) import these. If you change the chain, change it there and
run a migration that extends the CHECK constraint and adds `<stage>_approved_by/_at` columns.

## Writes — exact payloads (copy these, they match live columns)

```ts
// Approve (role = approvalRole; col = APPROVED_BY_COL[role])
{ payment_status: NEXT_STATUS[role], [`${col}_approved_by`]: user.id, [`${col}_approved_at`]: now }

// Reject — only rejection_reason exists live (no rejected_by/at/level)
{ payment_status: 'rejected', rejection_reason: `[Rejected by ${role} · ${new Date().toLocaleString('en-IN')}] ${reason}` }

// Accounts Mark Paid (single payment) — Accounts' approval IS the payment
{ payment_status: 'paid', utr_number, payment_proof_url: proofUrl || null, paid_by: user.id, paid_at: now,
  accounts_approved_by: user.id, accounts_approved_at: now }

// Raise (vendor) — from FFVendorPaymentForm / BuyPage / Purchase Report "Raise & Approve"
{ vendor_id, purchase_order_id, hub_id, items: [{ item_name, quantity, unit, unit_price, total }],
  gross_amount, deduction_amount, payment_status: 'pending_ff_ops', created_by: user.id,
  payment_proof_urls: [...], payment_proof_url: urls[0] }        // net_amount is generated — never send it

// Raise (transport)
{ driver_id, hub_id, trip_date, vehicle_number, origin, destination, km_covered,
  base_amount, toll_charges, other_charges, bill_url, trip_proof_url, payment_status: 'pending_ff_ops', created_by }
```

Approval-role fallback for flag holders (Anusiya/Arun with `ff_payment_access`):
`approvalRole = user.ff_payment_access && !(role in NEXT_STATUS) ? 'ff_operations_manager' : role`.

## Who may do what (enforced by RLS — mirror it in the UI, don't exceed it)

| Action | Roles | DB gate |
|---|---|---|
| Raise vendor/transport payment | `shift_employee`, `hub_manager`, `purchase_manager`, `purchase_head`, `ff_operations_manager`, `admin`, flag holders | `is_ff_payment_submitter()` |
| Approve at own stage | the role for that stage (see chain); flag holders act as Manager | `is_ff_payment_approver()` (also allows gm/auditor for history reads) |
| Delete a payment | creator, only while `pending_ff_ops` | `FIX_ALLOW_SUBMITTER_DELETE_PENDING_PAYMENTS.sql` |
| Mark Paid / batches | `accounts` (+ `admin` for Execution Desk) — **not** CEO (removed 2026-07-29) | `is_ff_payment_approver()` on `ff_payment_batches` |
| Approve All | any stage except Accounts (Accounts needs a UTR per payment) | — |

History: shift_employee raising was removed on 2026-07-24 and restored on 2026-08-04; the Ops
Manager can both raise and approve. If someone "can't see the button", check `profiles.role`,
`ff_payment_access`, and whether the route is in `FF_PAYMENT_ACCESS_ROUTES` (App.tsx).

## Reading payments — the queries that work

```ts
supabase.from('ff_vendor_payments')
  .select('*, vendors(id, name, gst_number, bank_name, bank_account, bank_ifsc, account_number, ifsc_code), hubs(name), purchase_orders(po_number, eod_date)')
  .in('payment_status', ['pending_ff_ops','pending_l1','pending_admin','pending_ceo','pending_accounts'])
  .order('created_at', { ascending: false })
```

- Vendor bank details: read **both** pairs and fall back (`account_number ?? bank_account`).
- Items JSONB from the Buy cart uses slightly different keys than the form; normalise when rendering
  (FFPaymentApprovals already does — copy its mapper).
- Submitter name: `created_by` → `profiles.name` (embed works here because the FK exists on
  `ff_vendor_payments`; on the legacy `vendor_payments` table it does not).
- Approvals page polls (`refetchInterval: 30000`); after any mutation invalidate both
  `['ff-vendor-payments']` and `['ff-transport-payments']`.
- "My Queue" = rows at `MY_PENDING_STATUS[approvalRole]`; the Approve All target is exactly that
  set within the current tab and hub filter — count, list, and button must be computed from the same
  filtered array so they never disagree.

## Where payments come from

1. **Buy flow** (`BuyPage.tsx`): saving a vendor cart writes purchase entries, updates PO items, and
   inserts one `ff_vendor_payments` at `pending_ff_ops` — the executive never fills a second form.
2. **FFVendorPaymentForm / FFTransportPaymentForm**: manual raise with required slip photo(s) into
   `payment-proofs`; inline "New Vendor" writes both bank column pairs.
3. **Purchase Report "Raise & Approve"** (Ops Manager only): creates the payment from the PO's own
   vendor/hub/items/total and immediately sets `pending_l1` + `ff_ops_approved_by/_at`. Requires a
   matched vendor with bank details and PO line items; otherwise the button is disabled with a tooltip.

`purchase_order_id` links payment ↔ PO; the Purchase Report's Approval column reads it to show each
PO's payment stage. Keep it populated on every raise path.

## Accounts payout

**Single**: Mark Paid modal (UTR required, proof URL optional) → payload above.

**Bulk — Execution Desk** (`/accounts/execution-desk`, `ExecutionDeskPage.tsx`, `ffPaymentBatchExport.ts`):

1. *Batch Creation*: lists `ff_vendor_payments` at `pending_accounts` with `batch_id IS NULL`; hub and
   PO-date (`purchase_orders.eod_date`) filters are applied client-side so a checked row never
   disappears under a filter change; rows whose vendor lacks `account_number/ifsc_code` are flagged
   and block batch creation.
2. Create Batch → insert `ff_payment_batches { batch_ref: 'FFPAY-yyyyMMdd-HHmmss', payment_type:'vendor',
   total_amount, payment_count, created_by, kotak_file_generated_at }`, set `batch_id` on the payments,
   download the Kotak CMS file. Debit account defaults to IGO Group's shared Kotak CMS account
   (`IGO_GROUP_KOTAK_DEBIT_ACCOUNT` in the page; confirmed by the user), editable, remembered in
   localStorage.
3. Kotak line format (tilde-delimited, from the bank's sample):
   `IGONET~RPAY~<MODE>~~<DDMMYYYY>~~<DEBIT_ACCT>~<AMOUNT>~M~~<BENEFICIARY>~~<IFSC>~<ACCT>` + 36 trailing `~`.
   Do not "clean up" the trailing tildes — the bank's parser needs the fixed column count.
4. *Batch Processing*: upload the bank statement (xls/csv) → `parseFFBankStatement` →
   `matchFFPayments` (amount equality + fuzzy vendor name) → confirm writes `utr_number` on each
   payment and sets batch `verified` + `statement_uploaded_at`.
5. *Mark Processed*: every linked payment → `paid` (same fields as single Mark Paid, `paid_by` =
   accounts user), batch → `processed`, `processed_at/by`.
6. *Revoke* (batch still created/verified): payments `batch_id = NULL` (back to pending_accounts
   list), batch row deleted. Never touches `paid` rows.
7. *Batch History* (`/accounts/batch-history`): processed batches with the same filters.

Transport payments are not batched yet (`payment_type` allows it; UI is vendor-only).

## Notifications and badges

- Stage change → DB trigger `trg_payment_approval_notify` inserts a `notifications` row for the next
  approver's role. Don't add client-side realtime listeners on payment tables (double-notification bug).
  ⚠️ This trigger's function (`notify_next_payment_approver()`) is stale — it only has branches for
  the retired GM/L1/Auditor/CEO chain, not the current Admin/Accounts stages, and only fires on
  `ff_vendor_payments`. If you're adding or reordering a stage, update this function in the same
  migration rather than assuming it already notifies correctly — see `fferp-backend`.
- Sidebar badges come from `useFFPaymentCount` keyed `<stage>_vendor` / `<stage>_transport`;
  new nav items use `badgeKey`.

## Diagnostics the user can run

```sql
SELECT payment_status, count(*), sum(gross_amount - coalesce(deduction_amount,0)) FROM ff_vendor_payments GROUP BY 1 ORDER BY 1;
SELECT p.id, p.payment_status, p.created_at, v.name, p.hub_id FROM ff_vendor_payments p LEFT JOIN vendors v ON v.id = p.vendor_id WHERE p.batch_id IS NULL AND p.payment_status = 'pending_accounts';
SELECT * FROM ff_payment_batches ORDER BY created_at DESC LIMIT 10;          -- CHECK_AND_REVOKE_BATCH.sql has the revoke SQL
SELECT public.is_ff_payment_approver(), public.is_ff_payment_submitter();   -- run as the affected user via impersonation
```

## Common failures and their real causes

| Symptom | Cause |
|---|---|
| Reject fails "Could not find the 'rejected_at' column" | Migration-only columns; use `rejection_reason` only |
| Payment page shows nothing for an approver | query error swallowed (wrong column), or role not in `MY_PENDING_STATUS`, or hub filter |
| Vendor bank details blank on approval card | vendor row is an empty duplicate → `FIX_REPOINT_PAYMENT_VENDOR_IDS.sql`; or only one bank pair populated |
| Payment stuck at `pending_gm`/`pending_auditor` | created before the chain refinement and the migration wasn't run → run `REFINE_PAYMENT_APPROVAL_CHAIN.sql` |
| Accounts can't see Execution Desk | role isn't `accounts`/`admin`, or batches table missing (`ADD_FF_PAYMENT_BATCHES.sql`) |
| Insert fails on `net_amount` | generated column in payload |

See also: `fferp-database` (columns, RLS), `fferp-purchase` (PO ↔ payment link), `fferp-frontend`.
