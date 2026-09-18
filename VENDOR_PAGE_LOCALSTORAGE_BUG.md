# Vendor bank details silently don't save — `/purchase/vendors` is disconnected from the database

**Found**: 2026-09-17, during a diagnostic test run of the new `fferp-*` project skills against a
disposable sandbox copy of this repo. Verified against the live repo (`D:\FF ERP`) before writing
this up — nothing below is speculative.

**Severity**: High. Anyone entering vendor bank details from `/purchase/vendors` believes they
succeeded (the form closes, the vendor appears in the list) but the data never reaches the
database, so it is invisible everywhere else in the app (Purchase Report, payment forms, Execution
Desk) and is lost the moment the browser's storage is cleared.

---

## Root cause

`src/pages/ff-operations/purchase/PurchaseVendorsPage.tsx` (route `/purchase/vendors`, reachable by
`hub_manager`, `purchase_manager`, `purchase_head`, `ff_operations_manager`, `admin` — it's inside
`OPS_ROLES` in `src/App.tsx`) is a full vendor-management UI (list, "New Vendor" modal with Other
Details / Address / Contact Persons / **Bank Details** tabs, an import wizard) that **never imports
`supabase`** (`grep -c supabase` on the file returns `0`). It persists everything to the browser's
`localStorage` instead:

```ts
// src/pages/ff-operations/purchase/PurchaseVendorsPage.tsx
const VENDOR_STORE_KEY = 'ff_erp_vendors_v1';                          // line 1678

function loadVendors(): any[] {                                        // line 1755
  try {
    const raw = localStorage.getItem(VENDOR_STORE_KEY);
    if (!raw) {
      localStorage.setItem(VENDOR_STORE_KEY, JSON.stringify(DEMO_VENDORS));
      return [...DEMO_VENDORS];
    }
    return JSON.parse(raw);
  } catch { return [...DEMO_VENDORS]; }
}

function persistVendors(list: any[]): void {                           // line 1766
  localStorage.setItem(VENDOR_STORE_KEY, JSON.stringify(list));
}

const handleSave = (v: any) => {                                       // line 1791
  const newVendor = { ...v, id: crypto.randomUUID() };
  setVendors(prev => {
    const updated = [...prev, newVendor];
    persistVendors(updated);   // <- browser localStorage only, nothing else
    return updated;
  });
  setShowForm(false);
};
```

The list even seeds itself from a hard-coded `DEMO_VENDORS` array the first time
`localStorage['ff_erp_vendors_v1']` is empty, so on a fresh browser the page shows plausible-looking
demo vendors that don't exist in the database either.

Meanwhile every other screen that reads vendor bank details — the Purchase Report's Bank/IFSC
column, the vendor payment forms, the Execution Desk's payability check — reads the real `vendors`
table via `src/lib/vendorStore.ts`'s `fetchStoredVendors()`. Since the vendor "saved" on
`/purchase/vendors` only ever existed in one browser's `localStorage`, none of those screens can
ever see it. This is the underlying cause of "I entered the bank details and they still show blank
everywhere" reports.

## Compounding factor: the correct page already exists, but is unrouted

`src/pages/purchase/VendorManagement.tsx` is a **correctly Supabase-backed** vendor CRUD page —
confirmed real reads/writes:

```ts
// src/pages/purchase/VendorManagement.tsx
const { data } = await supabase.from('vendors').select('*').order('name');           // line 290
const { error } = await supabase.from('vendors').update(form).eq('id', editId);      // line 299
const { error } = await supabase.from('vendors').insert({ ...form, is_active: true });// line 302
const { error } = await supabase.from('vendors').update({ is_active: !active })...   // line 316
const { error } = await supabase.from('vendors').delete().eq('id', id);              // line 324
```

It is imported in `src/App.tsx` (`const VendorManagement = lazy(() => import('./pages/purchase/VendorManagement'));`,
line 25) but **no `<Route>` in the file ever renders it** — confirmed by grepping every occurrence
of `VendorManagement` in `App.tsx`; the import is the only hit. It is dead code today, unreachable
from the UI.

So right now there is no reachable page in the app that both (a) looks like "the" vendor
management screen and (b) actually persists to the database — except editing a vendor's bank
details inline via the pencil icon on the Purchase Report page (`BankDetailsCell` in
`src/pages/reports/PurchaseReportPage.tsx`), which **does** write correctly to both bank-column
pairs.

## Immediate workaround (no code change, works today)

Re-enter the vendor's bank details directly on the Purchase Report page (`/reports/purchase`) using
the pencil icon in the Bank/IFSC column for that vendor's row. That path is genuinely wired to
Supabase.

## Recommended fix

Pick **one** real vendor management page and delete the other — don't leave two competing
implementations. Two options:

**Option A — wire `PurchaseVendorsPage.tsx` to Supabase** (keeps its nicer multi-tab UI):

```diff
+ import { supabase } from '@/integrations/supabase/client';
+ import { toast } from 'sonner';

- function loadVendors(): any[] { ... }
- function persistVendors(list: any[]): void { ... }
+ async function loadVendorsFromDB(): Promise<any[]> {
+   const { data, error } = await supabase
+     .from('vendors')
+     .select('id, name, email, phone, gst_number, bank_name, bank_account, bank_ifsc, is_active')
+     .order('name');
+   if (error) { console.error('[PurchaseVendorsPage] load vendors:', error.message); return []; }
+   return data ?? [];
+ }

  export default function PurchaseVendorsPage() {
-   const [vendors, setVendors] = useState<any[]>(() => loadVendors());
+   const [vendors, setVendors] = useState<any[]>([]);
+   useEffect(() => { loadVendorsFromDB().then(setVendors); }, []);
    ...
-   const handleSave = (v: any) => {
-     const newVendor = { ...v, id: crypto.randomUUID() };
-     setVendors(prev => {
-       const updated = [...prev, newVendor];
-       persistVendors(updated);
-       return updated;
-     });
-     setShowForm(false);
-   };
+   const handleSave = async (v: any) => {
+     const bank = v.banks?.[0] ?? {};
+     const payload = {
+       name:           v.companyName?.trim() || `${v.firstName ?? ''} ${v.lastName ?? ''}`.trim(),
+       email:          v.email || null,
+       phone:          v.mobile || v.workPhone || null,
+       gst_number:     v.gstin || null,
+       bank_name:      bank.bankName || null,
+       bank_account:   bank.accountNumber || null,
+       bank_ifsc:      bank.ifscCode || null,
+       account_number: bank.accountNumber || null,   // dual pair — vendorStore.ts / BuyPage read this one
+       ifsc_code:      bank.ifscCode || null,
+       type:           'dynamic',
+       is_active:      true,
+     };
+     const { data, error } = await supabase.from('vendors').insert(payload).select().single();
+     if (error) { toast.error(error.message); return; }
+     setVendors(prev => [...prev, data]);
+     setShowForm(false);
+   };
```

Also: do an exact-name lookup and `update` an existing vendor instead of always `insert`, or every
re-save from this page creates a duplicate `vendors` row — the exact problem
`FIX_CLEANUP_DUPLICATE_VENDOR_ROWS.sql` already had to clean up once from batch imports. Delete
`DEMO_VENDORS` once this lands.

**Option B — retire `PurchaseVendorsPage.tsx` and route `VendorManagement.tsx` instead.** Less UI
work (the DB wiring already exists there), but loses the multi-tab "New Vendor" UX and the import
wizard, which would need to be ported over or dropped.

Either way, no database migration is required — both options only touch existing `vendors` columns.

## Suggested verification after the fix

1. As a hub manager, enter a new vendor's bank details on the fixed page.
2. Confirm the row appears in Supabase's `vendors` table (`select * from vendors order by created_at desc limit 1;`).
3. Confirm the same vendor's bank details now show correctly on the Purchase Report page for any PO
   matched to that vendor name.

## Files involved

- `src/pages/ff-operations/purchase/PurchaseVendorsPage.tsx` — bug location (Option A fix target).
- `src/pages/purchase/VendorManagement.tsx` — the correctly-wired but unrouted alternative (Option B).
- `src/lib/vendorStore.ts` — the real read path everything else uses (`fetchStoredVendors`).
- `src/pages/reports/PurchaseReportPage.tsx` — `BankDetailsCell`, the one path that works today.
- `src/App.tsx` — `OPS_ROLES` (route guard) and the dead `VendorManagement` import.
