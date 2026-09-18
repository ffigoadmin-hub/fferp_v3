---
name: fferp-frontend
description: >
  Frontend skill for the Farmers Factory ERP React app (src/). Load it whenever you add or change a
  page, route, role guard, sidebar/mobile nav entry, hook, TanStack Query, mutation, form, modal, table,
  filter, badge count, export button, or UI style in this repo — including "build the page", "add a
  button", "wire it to the database", "make it show live data", "add a filter", "the list is empty",
  "add to sidebar", "only ops manager should see", "make it match the FF payments page". It encodes
  how App.tsx routing and ProtectedRoute work, the single navigationConfig for desktop + mobile,
  the query/mutation/error-surfacing conventions, hub scoping, 1000-row paging, the @ts-nocheck reality,
  and the light-theme visual conventions the user expects.
---

# FFERP — Frontend conventions

## Where things go

| Concern | Location |
|---|---|
| Route + role guard | `src/App.tsx`: lazy import near the top, `<Route>` inside `AppRoutes` wrapped in `<ProtectedRoute allowedRoles={[...]}>` |
| Sidebar entry (desktop AND mobile) | `src/components/layout/Sidebar.tsx` → `navigationConfig` (MobileSidebar imports it; never edit MobileSidebar for nav content) |
| Landing page after login | `src/pages/RedirectPage.tsx` → `roleRoutes` |
| Page | `src/pages/<module>/<PageName>.tsx`, default export, one page per file |
| Shared data access | `src/lib/*Store.ts` (purchase, vendor, buy), `src/lib/*Helper.ts`, `src/hooks/use*.ts` |
| Chain constants | import from the owning page (`NEXT_STATUS`, `APPROVED_BY_COL`, `MY_PENDING_STATUS` from `FFPaymentApprovals.tsx`) — never duplicate a status map |
| Parsers / exports | `src/lib/poImportParsers.ts`, `salesOrderImportParser.ts`, `ffPaymentBatchExport.ts`, `exportUtils.ts` |

## Adding a route (the exact checklist)

1. `const MyPage = lazy(() => import('@/pages/module/MyPage'));`
2. `<Route path="/module/thing" element={<ProtectedRoute allowedRoles={['ff_operations_manager','admin']}><MyPage /></ProtectedRoute>} />`
   - Use the role arrays already defined (`ALL_STAFF_ROLES`, `OPS_ROLES`, `DAILY_WORKFLOW_ROLES`)
     when the intent matches; list roles explicitly for FF-specific screens.
   - Routes reachable by `ff_payment_access` holders must be added to `FF_PAYMENT_ACCESS_ROUTES`.
   - `ff_ops_access` holders automatically get any route that allows `ff_operations_manager`.
3. Add the nav item to the right `navigationConfig` group(s) — one group per role family; the same
   page may appear in several groups (e.g. Purchase Orders for ops manager, hub manager, purchase exec).
4. If it is a landing page for a role, update `roleRoutes` in `RedirectPage.tsx`.
5. Build (`npx vite build`) and test as that role. `ProtectedRoute` really redirects — it is not
   cosmetic — so a missing role means a bounce to `/redirect`.

Why the sidebar rule matters: desktop and mobile configs drifted for months (mobile lacked 22 groups,
including the entire payment pipeline) until 2026-09-04 unified them. Keep them unified.

## Page skeleton (what a new FF page looks like here)

```tsx
// @ts-nocheck   ← acceptable only because types.ts lacks FF tables; remove when types are regenerated
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, RefreshCw } from 'lucide-react';

export default function MyPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const hubScoped = user?.role === 'hub_manager' || user?.role === 'shift_employee';

  const { data: rows = [], isLoading, error, refetch } = useQuery({
    queryKey: ['my-rows', user?.id, user?.hub_id],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from('some_table')
        .select('id, hub_id, status, created_at, hubs(name), vendors(name, bank_account, bank_ifsc)')
        .order('created_at', { ascending: false });
      if (hubScoped) q = q.eq('hub_id', user.hub_id);
      const { data, error } = await q;
      if (error) throw error;              // surface it — never `return []`
      return data ?? [];
    },
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('some_table').update({ status: 'next', approved_by: user.id, approved_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Approved'); qc.invalidateQueries({ queryKey: ['my-rows'] }); },
    onError: (e: any) => toast.error(e.message || 'Failed'),
  });

  if (isLoading) return <div className="p-8 text-center text-sm text-gray-400">Loading…</div>;
  if (error) return <div className="p-8 text-sm text-red-600">Failed to load: {(error as any).message} <button onClick={() => refetch()} className="underline ml-2">Retry</button></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-12 pt-2">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold text-slate-800 tracking-tight">My Page</h1>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
      </div>
      {rows.length === 0 ? <div className="p-10 text-center text-sm text-gray-400">Nothing here yet.</div> : /* table / cards */ null}
    </div>
  );
}
```

Conventions embedded above, and why:

- **Throw on error; render error state with the message.** A query that fails because of a wrong
  column name must be visible on screen. "No payments found" hid 7 real payments once; blank hub
  selectors hid a `hubs.location` bug for days. The only silence allowed is `isMissingTable(error)`
  from `src/lib/supabase-error-guard.ts` for IGO tables that may not exist here.
- **Hub scoping in the query, not after.** Filtering client-side leaks other hubs' rows to the
  network and makes counts wrong. RLS is the second line of defence, not the first.
- **Query keys include the things that change the result** (`user.id`, `hub_id`, filters). Stale
  keys → stale data after switching hub filter.
- **Invalidate rather than mutate cache** — except where the user must see their own write instantly
  (the Purchase Report's Bank/IFSC cell patches the cache synchronously, then invalidates). Do that
  only when a refetch would visibly lag.
- **Loading / error / empty are three different states.** Blank space is not an empty state.
- **`toast` from `sonner`** (152 pages use it; `use-toast` is legacy). Success messages say what
  happened and what's next ("payment sent to Manager for approval").

## Filters, bulk actions, big tables

- Any query on a table that grows (POs, payments, orders) must page: copy `fetchAllRows` from
  `src/lib/purchaseStore.ts` (loops `.range()` in 1000s until a short page). PostgREST silently
  truncates at 1000 — the report showed missing days for a week before this was found.
- Filter bars: hub (`hubs` list query, `'all'` default), date range on the **business date**
  (`eod_date`, `order_date`), status. Apply hub/date filters client-side only when a selection
  must survive a filter change (Execution Desk does this deliberately, and says so in a comment).
- Bulk actions ("Approve All", bulk delete): confirm with count + total, run in chunks of ~10
  concurrent requests (not one giant `Promise.all`), report succeeded/failed counts, invalidate once.
- Sticky action column + `min-w` on wide tables so the last column is never cut off
  (`PurchaseReportPage.tsx` pattern).
- Click-to-edit cells (status dropdown, Bank/IFSC): only offer values the DB CHECK allows; write
  through the same store/helper the rest of the app uses.

## Forms and uploads

- Photos are required proof on FF forms: upload to the right bucket (`payment-proofs`, `qc-photos`)
  first, store URLs; support multiple photos with an array column plus the first URL mirrored to the
  legacy single column.
- Vendor entry inline: search existing (fuzzy `matchVendor` from `poImportParsers.ts`), else create —
  writing **both** bank column pairs (`bank_account/bank_ifsc` and `account_number/ifsc_code`).
- Customer quick-add: on duplicate phone, look up and select the existing customer instead of
  surfacing the constraint error.
- Never put generated columns (`net_amount`) in insert payloads.
- Amount math is explicit and shown to the user before submit (gross − deductions; base + toll + other).

## Roles in UI logic

- Read `user.role` (already normalised by `AuthContext.mapRole`), `user.hub_id`, and the flags
  `(user as any).ff_ops_access / ff_payment_access`.
- When a page serves several roles, derive the "can act" condition once at the top
  (`canApprove = role === 'l1_manager' && row.payment_status === 'pending_l1'`) and reuse it for
  buttons, counts, and bulk actions so they never disagree.
- Approval-role fallback for flag holders: `const approvalRole = user.ff_payment_access && !(role in NEXT_STATUS) ? 'ff_operations_manager' : role;` (from FFPaymentApprovals) — reuse, don't reinvent.

## Visual conventions (what "matches the app" means)

- Light theme: white/gray-50 surfaces, `text-slate-800` titles at ~22px, `rounded-xl/2xl` cards,
  `border-gray-200`, subtle shadows. Dark glassmorphism was explicitly removed in June 2026 — do not
  reintroduce dark hardcoded colours.
- Status badges: colour map per exact status string (see `STATUS_COLORS` in FFPaymentApprovals);
  a status without a mapping renders gray — add the mapping rather than accept gray.
- Stage progress dots (Manager→L1→Admin→CEO→Accounts) via `ApprovalProgress` — reuse it.
- Icons: `lucide-react`. Charts: `recharts`. Confirmations: native modal components in the page
  (the FF pages use their own lightweight modals rather than shadcn Dialog); either is fine, be consistent within a page.
- Not-yet-ready features ship behind `ComingSoonOverlay` (`src/components/ComingSoonOverlay.tsx`)
  rather than half-working.
- Mobile: the same nav renders in `MobileSidebar`; pages must work at phone width (stack filters,
  horizontal-scroll tables).

## Things that look like bugs but are deliberate

- 63 files carry `// @ts-nocheck` and `(supabase as any)` — because `types.ts` has none of the FF
  tables. Don't "fix" by hand-writing types; regenerate types when possible (see `fferp-database`).
- `FF_OPS_ACCESS_ELIGIBLE_ROLES` is duplicated in `App.tsx` and `RedirectPage.tsx` on purpose (the
  comment says keep in sync).
- Some order rows have `hub_id = NULL`; list pages include them (`.or('hub_id.eq.X,hub_id.is.null')`
  style) so app orders are not hidden.
- `BoxLabelGenerator` and `SmartInventoryPage` are wrapped in `ComingSoonOverlay`.

## Definition of done for a frontend change

1. `npx vite build` passes (≈75 s). 2. Tested as every role the route allows (log in as each; the
user has test accounts per role). 3. Sidebar entry present on desktop and mobile. 4. Errors are
visible, not swallowed. 5. Hub scoping verified with a hub-scoped account. 6. Commit body explains
the why (see `fferp-release`).

See also: `fferp-payments`, `fferp-purchase`, `fferp-sales`, `fferp-warehouse` for module-specific
rules; `fferp-debug` when a page is "empty" or "not loading".
