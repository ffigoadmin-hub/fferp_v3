---
name: fferp-module-builder
description: >
  Build-a-new-module skill for the Farmers Factory ERP — the end-to-end checklist and templates for
  adding a brand-new page, feature, table, or role to this codebase, from data model through route
  through sidebar through migration. Load it whenever the request is "build the X dashboard", "create
  a new page for", "add a new module", "we need a screen for", "build a feature that", "add a new
  role", "create the component", or any request to add something that doesn't exist yet (as opposed
  to fixing or changing something that does — for that, load fferp-refinement instead). Always load
  fferp-core first for project context, then the domain skill matching what you're building
  (fferp-sales / fferp-purchase / fferp-payments / fferp-warehouse), and fferp-database for the
  table/RLS you'll need. This skill is the assembly instructions; those are the parts catalogue.
---

# FFERP — Building a New Module

## Before writing any code — checklist

- [ ] **Does it already exist?** Grep `src/pages/` and `src/hooks/` first. This codebase has shipped
      the same feature twice more than once (`PurchaseVendorsPage.tsx` vs `VendorManagement.tsx` —
      see `VENDOR_PAGE_LOCALSTORAGE_BUG.md`) because "build X" was done without checking. If a hook
      or page already exists but isn't wired to live data, that's a `fferp-refinement` task, not this one.
- [ ] **Which role(s) use it?** Name them exactly (e.g. `hub_manager`, not "hub staff") — this decides
      the route guard, the sidebar `roles` array, and the RLS policy.
- [ ] **Is it hub-scoped?** If a hub manager or purchase executive touches it, every query filters by
      `hub_id` and the RLS policy restricts to `profiles.hub_id`.
- [ ] **Does it need photo/proof evidence?** Yes if it's financial (payment, purchase) or work
      evidence (QC, delivery). Decide the storage bucket now (`payment-proofs`, `qc-photos`, or a new one).
- [ ] **Does it need audit logging?** Yes if an admin/approver role changes another user's data —
      write before/after state to `audit_logs`.
- [ ] **Does it need realtime?** Yes only if multiple users genuinely need to see the same row change
      live (inventory, payment queues). Otherwise a `useQuery` + `invalidateQueries` on mutation is
      simpler and this codebase already had a double-notification bug from over-using realtime.
- [ ] **Does the table already exist?** Check `fferp-database`'s `live-schema-facts.md` before
      assuming you need a new one — this repo has near-duplicate tables from past rebuilds
      (`vendors` vs `vendor_master`, `ff_vendor_payments` vs the legacy `vendor_payments`).

## Build order

### 1. Data model (if a new table is genuinely needed)

Write one `ADD_<feature>.sql` at repo root (see `fferp-database` for the exact idempotent template
and RLS policy pattern). Every new table needs, in the same file:
- `CREATE TABLE IF NOT EXISTS` with an `id uuid default gen_random_uuid() primary key`, `created_at`,
  and `hub_id` if it's hub-scoped.
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` plus a policy per role that touches it (admin/CEO full,
  the owning role's own-hub-or-own-row policy, any approver read policy) — copy the template in
  `fferp-database`, don't write RLS from scratch.
- A verify `SELECT` at the end so the user can paste back proof it applied.

Give the file to the user to run in the Supabase SQL Editor and get the verify output back before
writing code against it — do not assume it applied.

### 2. Backend automation (only if the feature needs something to happen "by itself")

If a status change should notify someone, a row should auto-populate something, or work runs on a
schedule, that's a trigger, function, or `pg_cron` job — see `fferp-backend` for the pattern
(`SECURITY DEFINER`, `SET search_path = public`, `REVOKE EXECUTE` if it's trigger-only). Add it to
the same migration file as step 1 where practical.

### 3. The page

```tsx
// src/pages/<module>/<PageName>.tsx
// @ts-nocheck   ← only because types.ts is missing this table; remove once types are regenerated
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, RefreshCw } from 'lucide-react';

export default function PageName() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const hubScoped = user?.role === 'hub_manager' || user?.role === 'shift_employee';

  const { data: rows = [], isLoading, error, refetch } = useQuery({
    queryKey: ['<feature>', user?.id, user?.hub_id],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from('<table>').select('*').order('created_at', { ascending: false });
      if (hubScoped) q = q.eq('hub_id', user.hub_id);
      const { data, error } = await q;
      if (error) throw error;              // never swallow — see fferp-frontend
      return data ?? [];
    },
  });

  if (isLoading) return <div className="p-8 text-center text-sm text-gray-400">Loading…</div>;
  if (error) return <div className="p-8 text-sm text-red-600">Failed to load: {(error as any).message}</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-12 pt-2">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold text-slate-800 tracking-tight">Page Title</h1>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
      </div>
      {rows.length === 0 ? <div className="p-10 text-center text-sm text-gray-400">Nothing here yet.</div> : /* table / cards */ null}
    </div>
  );
}
```

Full rationale for every convention here (error surfacing, query keys, hub scoping, visual style) is
in `fferp-frontend` — this is just the skeleton to start from.

### 4. Reusable hook (if more than one page will need this data)

```ts
// src/hooks/use<Feature>.ts
export function use<Feature>(filter?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['<feature>', filter, user?.hub_id],
    queryFn: async () => {
      let q = supabase.from('<table>').select('*, hubs(name)').order('created_at', { ascending: false });
      if (filter) q = q.eq('status', filter);
      if (user?.role === 'shift_employee' || user?.role === 'hub_manager') q = q.eq('hub_id', user.hub_id);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
}
```

### 5. Route + guard

```tsx
// src/App.tsx — lazy import near the other lazy imports
const PageName = lazy(() => import('@/pages/<module>/PageName'));

// inside <AppRoutes>
<Route path="/<module>/<page>" element={
  <ProtectedRoute allowedRoles={['hub_manager', 'ff_operations_manager']}>
    <PageName />
  </ProtectedRoute>
} />
```

If this is the role's landing page, add it to `roleRoutes` in `RedirectPage.tsx` too.

### 6. Sidebar (desktop AND mobile — one config, both surfaces)

Add the item to the matching `roles`-gated group in `src/components/layout/Sidebar.tsx`'s
`navigationConfig`. **Never edit `MobileSidebar.tsx` for nav content** — it imports
`navigationConfig` from `Sidebar.tsx` directly; the two were unified in September 2026 after drifting
apart for months. If the feature needs a pending-count badge, add a `badgeKey` and a matching entry
in `useFFPaymentCount.ts` (or the equivalent counting hook for non-payment badges).

### 7. Audit logging (if an approver/admin action changes another user's data)

```ts
await supabase.from('audit_logs').insert({
  action: 'status_update', record_type: '<table>', record_id: rowId,
  before_state: { status: oldStatus }, after_state: { status: newStatus, approved_by: user.id },
  performed_by: user.id, performed_by_name: user.name, performed_by_role: user.role,
});
```

### 8. Adding a brand-new role (only if the feature introduces one)

1. Add the exact lowercase-underscore string to `ALL_STAFF_ROLES` (or the narrower array that fits)
   in `App.tsx`.
2. Add it to `mapRole()` in `AuthContext.tsx` (both the plain and any underscore-variant key).
3. Add a landing route to `roleRoutes` in `RedirectPage.tsx`.
4. Add its `navigationConfig` group in `Sidebar.tsx`.
5. Add RLS policies for every table it needs (copy the template in `fferp-database`).
6. Add it to `ROLES`/department dropdown in `src/constants/departments.ts` so admin can assign it —
   use the same lowercase-underscore spelling as everywhere else; this file has a pre-existing case
   inconsistency (`'CEO'` vs `'l1_manager'`) that does **not** match what `profiles.role` actually
   stores — copying the capitalized style silently breaks routing and RLS for the new role.

## Component library — use what's already here, never install a new one

`shadcn/ui` via `@/components/ui/` (`Button`, `Card`, `Dialog`, `Input`, `Select`, `Table`, `Badge`,
`Tabs`, `Toast`, …), `lucide-react` for icons, `recharts` for charts, `sonner` for toasts (not
`use-toast` — legacy). FF pages often build their own lightweight modals instead of `Dialog`; match
whichever convention the surrounding module already uses.

## Definition of done

Same as any change in this repo — see `fferp-release`: `npx vite build` passes, tested as every role
the route allows, sidebar present on desktop and mobile, errors surfaced not swallowed, hub scoping
verified, migration file committed with its verify output pasted into the commit body. Before calling
it finished, run it through `fferp-testing`'s checklist, especially if it touches money or another
role's data.
