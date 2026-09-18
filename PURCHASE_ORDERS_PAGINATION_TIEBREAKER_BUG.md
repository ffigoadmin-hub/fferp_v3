# Some purchase orders can silently disappear from the Purchase Report — missing pagination tiebreaker

**Found**: 2026-09-17, during a diagnostic test run of the new `fferp-*` project skills against a
disposable sandbox copy of this repo. This is a **latent** bug — it may or may not have caused a
specific incident yet, but the mechanism is real and confirmed in the live code.

**Severity**: Medium. Silent, partial data loss in a report — the kind of bug that erodes trust in
the numbers because it looks like random missing rows rather than an obvious error.

---

## Root cause

`src/lib/purchaseStore.ts`, function `fetchAllRows` (this is the helper added on 2026-09-05 to work
around PostgREST's silent 1000-row response cap — see `CHECK_DAILY_PO_COUNTS_BY_HUB.sql` and the
commit "Fix purchaseStore's unbounded queries silently capping at 1000 rows"):

```ts
async function fetchAllRows(table: string, extra?: (q: any) => any): Promise<any[]> {   // line 100
  const PAGE_SIZE = 1000;
  const rows: any[] = [];
  let page = 0;
  while (true) {
    let q = supabase.from(table).select('*').order('created_at', { ascending: false });
    if (extra) q = extra(q);
    const { data, error } = await q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) { console.error(`[purchaseStore] fetchAllRows(${table}):`, error.message); break; }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
    page++;
  }
  return rows;
}
```

This correctly pages past 1000 rows using `.range()`. But it sorts **only by `created_at`**, and
`purchase_orders.created_at` is `timestamptz DEFAULT now()` — in Postgres, `now()` returns the
**transaction start time**, so every row inserted by the same statement/transaction gets an
identical `created_at`, down to the microsecond.

`run_eod_po_engine(p_date)` (the nightly/manual EOD job, `EOD_PO_ENGINE.sql`) inserts one
`purchase_orders` row per hub per run, inside a single function call — i.e. a single transaction.
Any POs created for the same business day in that one run share one exact `created_at`. The same is
true for POs created in a single batch import.

Offset pagination (`ORDER BY created_at DESC LIMIT 1000 OFFSET N`) is only guaranteed to return a
consistent combined result across separate page queries when the sort key is **unique**. When many
rows tie on `created_at`, Postgres does not guarantee the same relative order for that tied group
between two independently executed queries. If part of a tied group happens to sit right at a
`PAGE_SIZE` boundary, some of those tied rows can land in **neither** page — included in page N's
result under one query plan, and in page N+1's result under a slightly different one, or vice versa
— and vanish from the app's combined `allPOs` array entirely, while a plain
`SELECT * FROM purchase_orders` (e.g. run directly in the Supabase SQL editor) still returns every
row, because it has no `LIMIT`/`OFFSET` to fall through.

This matches a "some POs from one specific day are missing from the report, but I can see them in
a direct SQL query" symptom exactly — and would explain it if it is ever reported, since the table
is large enough (confirmed >1000 rows from bulk imports) that pagination is actively exercised on
every Purchase Report load.

## The fix

Add the primary key `id` as a secondary, unique sort key so `(created_at, id)` is a strict total
order that both page queries agree on:

```diff
   async function fetchAllRows(table: string, extra?: (q: any) => any): Promise<any[]> {
     const PAGE_SIZE = 1000;
     const rows: any[] = [];
     let page = 0;
     while (true) {
-      let q = supabase.from(table).select('*').order('created_at', { ascending: false });
+      // Secondary tiebreaker required: rows inserted by the same transaction (e.g.
+      // run_eod_po_engine() inserting one PO per hub in a single call, or a batch
+      // import) share an identical created_at down to the microsecond. Ordering by
+      // created_at alone makes that tied group's relative order unstable across
+      // separate page queries, so a tied batch landing on a PAGE_SIZE boundary can be
+      // silently dropped between pages. `id` is unique, so (created_at, id) gives
+      // every page query the same total order.
+      let q = supabase.from(table).select('*')
+        .order('created_at', { ascending: false })
+        .order('id', { ascending: true });
       if (extra) q = extra(q);
       const { data, error } = await q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
```

This is a one-line, additive change to the single shared helper, so it fixes the same latent risk
for every caller: `fetchAllPOs()`, `fetchOpenPOs()`, `fetchPendingApprovalPOs()` — not just the
Purchase Report.

## Suggested verification after the fix

```sql
-- Confirm the table is actually large enough to exercise pagination
SELECT count(*) FROM purchase_orders;

-- Find any exact created_at ties (these are the rows at risk before the fix)
SELECT created_at, count(*) FROM purchase_orders
GROUP BY created_at HAVING count(*) > 1 ORDER BY created_at DESC;
```

After applying the fix, reload the Purchase Report with all filters cleared and confirm the row
count for any spot-checked date matches `SELECT count(*) FROM purchase_orders WHERE eod_date = '<date>';`.

## Files involved

- `src/lib/purchaseStore.ts` — `fetchAllRows`, the fix location.
- `EOD_PO_ENGINE.sql` — `run_eod_po_engine`, the source of same-transaction tied `created_at` batches.
- `src/pages/reports/PurchaseReportPage.tsx` — the page that surfaces the symptom.
