---
name: fferp-backend
description: >
  Backend skill for the Farmers Factory ERP — everything that runs inside Supabase rather than in
  React: Postgres functions (run_eod_po_engine and friends), triggers (hub routing, invoice/PO
  numbering, box creation, notifications), pg_cron jobs (EOD run, hub-manager no-show LOP), Supabase
  Edge Functions (create-user / delete-user / reset-user-password), storage buckets, the
  notifications table, RPC calls, and security hardening (search_path, SECURITY DEFINER, revoking RPC
  on trigger-only functions). Load it whenever the request mentions trigger, cron, schedule, nightly,
  automation, edge function, deno, service role, RPC, "runs at 23:50", "auto-create", notification,
  bucket, upload, or when a behaviour happens "by itself" and you need to find where. Pair it with
  fferp-database for schema facts.
---

# FFERP — Backend (Postgres functions, triggers, cron, edge functions, storage)

## Mental model

The web app is a thin client; the important automation lives in Postgres. When something "happens
by itself" (a PO appears, a payment moves, an LOP is flagged, a notification arrives) the cause is a
trigger, a cron job, or a DB function — not React. Find it in the DB first:

```sql
SELECT tgname, tgrelid::regclass, pg_get_triggerdef(oid) FROM pg_trigger WHERE NOT tgisinternal ORDER BY 2;
SELECT jobid, schedule, command, active FROM cron.job;
SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace ORDER BY 1;
SELECT pg_get_functiondef('public.<fn>(<argtypes>)'::regprocedure);
```

## The rule for DB functions in this repo: live → file, never file → live

`EOD_PO_ENGINE.sql` and the `FIX_*` function files are **snapshots of what is live**, pulled with
`pg_get_functiondef`. Editing the file changes nothing. The workflow is:

1. Write the new function body as a `CREATE OR REPLACE FUNCTION` in a `FIX_<name>.sql` (idempotent).
2. The user runs it in the SQL Editor and pastes the verify output.
3. Re-sync the canonical file (`EOD_PO_ENGINE.sql`) from `pg_get_functiondef` so the repo matches.
4. Commit both, saying in the body that it was applied.

Why: two sessions in 2026 lost time editing files that production never saw.

## Known automation inventory (what exists, where it is defined)

| Behaviour | Mechanism | Defined in |
|---|---|---|
| Order → hub by pincode | trigger `trg_auto_assign_hub` on `sales_orders` (exact → prefix fallback) | `COMPLETE_SCHEMA_MIGRATION.sql`, `FIX_HUB_ID_PINCODE_FALLBACK.sql` |
| Order/PO/invoice numbers | triggers `set_order_number`, `set_po_number`, `set_invoice_number` | `COMPLETE_SCHEMA_MIGRATION.sql` |
| Invoice on order (DB side) | `trg_auto_invoice` — but the app also calls `invoiceHelper.createInvoiceForOrder()`, which is idempotent; keep the helper as the source of truth for amounts/charges | both |
| EOD purchase orders | function `run_eod_po_engine(p_date date)` → `purchase_orders` + items; **no auto-assign** since 2026-07-24 | `EOD_PO_ENGINE.sql` (live snapshot), `FIX_EOD_ENGINE_REMOVE_AUTOASSIGN.sql`, `FIX_EOD_ENGINE_DEDUP_CONSTRAINT.sql` |
| Manual EOD run from UI | `EODPOEngine.tsx` calls the function via RPC / builds POs client-side through `purchaseStore.createPOsFromSalesOrders` | `src/pages/ff-operations/po-engine/EODPOEngine.tsx` |
| Nightly EOD schedule | intended `50 23 * * *` via pg_cron; **verify it exists** — there is no edge function for it (`supabase/functions/eod-po-engine` does not exist) | `CHECK_CRON_SCHEDULE_LOCATION.sql` |
| Box rows from PO items | `trg_auto_create_box` on `purchase_order_items` | `SCHEMA_PART2_REMAINING.sql` |
| Notify purchase exec on assignment | `trg_notify_pe` on `po_assignments` | `SCHEMA_PART2_REMAINING.sql` |
| Notify next approver | `trg_payment_approval_notify` → `notify_next_payment_approver()` on payment status change | `SCHEMA_PART2_REMAINING.sql` (~line 1067) |
| Vendor bank sync | `trg_sync_vendor_bank` | `SCHEMA_PART2_REMAINING.sql` |
| Inventory on receive / wastage | `trg_inventory_on_receive`, `trg_inventory_wastage` | `COMPLETE_SCHEMA_MIGRATION.sql` |
| Purchase entry → PO item status | trigger fixed by `FIX_PURCHASE_ENTRY_TRIGGER_STATUS.sql` | |
| Hub-manager late login → 0.10 LOP | trigger on `shift_sessions` (grace 07:15 IST) | `FIX_HUB_MANAGER_LATE_LOGIN_TRIGGER.sql` |
| Hub-manager no-show → 1.0 LOP | function `check_hub_manager_no_shift(date)` + `cron.schedule(...)` | `FIX_HUB_MANAGER_NO_SHOW_CRON.sql`, `ENABLE_PGCRON.sql` |
| IGO daily automations | `cron_auto_mark_absent`, `check_escalation_sla_breach`, `evaluate_reporting_compliance`, `mark_overdue_escalations` (typed functions) | `phase4_automation.sql` |
| Admin user lifecycle | edge functions `create-user`, `delete-user`, `reset-user-password` | `supabase/functions/*` |

⚠️ **`notify_next_payment_approver()` is stale relative to the current payment chain — confirmed
2026-09-17.** Its `CASE NEW.payment_status` only branches on `pending_gm`/`pending_l1`/
`pending_auditor`/`pending_ceo` (the *retired* chain) — there is **no branch for `pending_admin` or
`pending_accounts`**, so Admin and Accounts get zero DB-triggered notifications today even though
they're active stages. The trigger is also attached only to `ff_vendor_payments`, never
`ff_transport_payments`. If you're touching the payment chain (e.g. adding a stage — see
`fferp-payments`), replace this function in the same migration and add the missing branches; don't
assume it already covers the current chain just because it exists.

## Writing a trigger (pattern that survives re-runs and the security advisor)

```sql
CREATE OR REPLACE FUNCTION public.<fn>()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public          -- advisor: "search path mutable" otherwise
AS $$
BEGIN
  -- guard early; triggers that raise on edge cases block the whole insert
  IF NEW.hub_id IS NULL THEN RETURN NEW; END IF;
  ...
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS <trg> ON public.<table>;
CREATE TRIGGER <trg> AFTER INSERT ON public.<table>
FOR EACH ROW EXECUTE FUNCTION public.<fn>();

-- trigger-only functions must not be callable via /rest/v1/rpc
REVOKE EXECUTE ON FUNCTION public.<fn>() FROM PUBLIC, anon, authenticated;
```

Reasoning: `FIX_FUNCTION_SEARCH_PATH_AND_TRIGGERS.sql` hardened 23 functions after the advisor
flagged them; new functions should be born hardened. `FIX_FUNCTION_PERMISSIONS*.sql` restored
EXECUTE where the app legitimately calls RPC (e.g. `is_week_off_day`, `run_eod_po_engine` for
admins) — so decide explicitly: is this callable by clients or trigger-only?

## pg_cron jobs

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;                     -- ENABLE_PGCRON.sql
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = '<name>';  -- idempotent re-schedule
SELECT cron.schedule('<name>', '50 23 * * *', $$SELECT public.run_eod_po_engine(CURRENT_DATE);$$);
```

- pg_cron runs in **UTC**. 23:50 IST = `20 18 * * *`. Say which timezone you mean in the file header
  and the commit; the hub-manager no-show job documents its IST conversion.
- Anything that creates business rows (EOD engine) must not be scheduled or test-run against
  production without explicit sign-off — a manual `SELECT run_eod_po_engine(CURRENT_DATE)` creates
  real POs. The function is idempotent per (hub, eod_date, product) thanks to the dedup constraint,
  but re-running for a wrong date still creates wrong POs.

## Edge functions (Deno) — the only place the service-role key may exist

Pattern from `supabase/functions/create-user/index.ts`:

1. Handle `OPTIONS` with CORS headers.
2. Build a client with the caller's `Authorization` header + anon key; `auth.getUser()` → 401 if none.
3. Read the caller's `profiles.role` with a service-role client; refuse unless `admin` (403).
4. Only then use the service-role client for `auth.admin.*`.
5. Return JSON with the same CORS headers on every path, including errors.

Deploy: `supabase functions deploy <name> --project-ref qwiumswrbddwmlraktvy`. Secrets
(`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, …) are set in Dashboard → Edge Functions → Secrets,
never in `.env` for the web app. Client calls: `supabase.functions.invoke('<name>', { body })` —
check both `error` and `data.error`; edge functions return 200 with an error body more often than
you expect.

Existing client invocations you may reuse: `approve-leave`, `duplicate-payment-detector`,
`payment-pattern-analyzer` (IGO side). If an invoke returns "Function not found", the function was
never deployed to this project — do not build UI on top of it until it is.

## Notifications

Two paths exist; use the one matching the side you are on:
- FF: DB triggers insert into `notifications` (`user_id, title, message, type, link, is_read`).
- IGO: `src/services/NotificationService.ts` (`notifyRole(role, title, message, recordId, type)`,
  `notifyUser(userId, …)`) and `useNotifications.ts` listens only on `notifications` (the broad
  per-table realtime listeners were removed in Feb 2026 to stop double alerts — don't add them back).

Sidebar badges are **counts**, not notifications: `useFFPaymentCount.ts` counts rows at the
viewer's stage (`badgeKey` like `l1_vendor`, `l1_transport`).

## Storage

Buckets: `payment-proofs` (slips, Buy receipts), `qc-photos`, `app-images`, `rental-bills`,
`project-photos`, `voice-comments`. Upload pattern used across FF forms:

```ts
const path = `${user.id}/${Date.now()}-${file.name}`;
const { data, error } = await supabase.storage.from('payment-proofs').upload(path, file);
if (error) throw error;
const { data: pub } = supabase.storage.from('payment-proofs').getPublicUrl(data.path);
// store pub.publicUrl; for multi-photo keep an array (payment_proof_urls) and mirror [0] to payment_proof_url
```

Bucket listing needs the policy in `FIX_STORAGE_BUCKET_LISTING.sql`; if uploads work but listing
returns nothing, that is the cause.

## Realtime

Use it for genuinely shared live state (inventory by hub, payment queues), filtered by hub:

```ts
supabase.channel('inventory-live')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory', filter: `hub_id=eq.${user.hub_id}` },
      () => queryClient.invalidateQueries({ queryKey: ['inventory', user.hub_id] }))
  .subscribe();
```

Invalidate queries rather than patching local state; and remember tables must be in the realtime
publication (`SCHEMA_PART1C_REALTIME_SEED.sql`) or nothing arrives.

See also: `fferp-database` (columns, RLS), `fferp-purchase` (EOD engine semantics),
`fferp-payments` (approval trigger expectations).
