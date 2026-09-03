-- ============================================================
--  Audit: which vendors from the Hyderabad Hub batch actually have
--  bank details saved in the `vendors` table, and whether any two
--  different-looking vendor names are resolving to the SAME row
--  (which would explain identical bank details showing on two
--  different POs).
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
-- ============================================================

-- ── 1. Every vendor whose name loosely matches one of the names
--       visible in the report, with their bank fields ─────────
SELECT id, name, is_active, type,
       bank_name, bank_account, bank_ifsc,
       account_number, ifsc_code,
       created_at, updated_at
FROM public.vendors
WHERE name ILIKE '%fruits%mallampet%'
   OR name ILIKE '%insta%fresh%'
   OR name ILIKE '%barcode%label%'
   OR name ILIKE '%narendar%reddy%'
   OR name ILIKE '%sekar%'
   OR name ILIKE '%mint%corien%'
   OR name ILIKE '%ramya%'
   OR name ILIKE '%yadhagiri%'
ORDER BY name;

-- ── 2. Same account number / IFSC used by more than one vendor —
--       if INSTA FRESH and BARCODE LABLES are two different rows
--       that happen to share real details, they'll show up together
--       here; if they're actually the SAME row being matched twice,
--       row 1's query above will only return ONE of the two names. ─
SELECT bank_account, bank_ifsc, array_agg(name) AS vendors_sharing_this_account, count(*)
FROM public.vendors
WHERE bank_account IS NOT NULL AND bank_account <> ''
GROUP BY bank_account, bank_ifsc
HAVING count(*) > 1
ORDER BY count(*) DESC;

-- ── 3. Every PO from the Hyderabad Hub batch and its raw vendor_name
--       text exactly as stored — compare this spelling against what
--       query 1 found, to see whether a "filled and saved" vendor
--       simply never got created at all (name has no row in query 1) ─
SELECT po.po_number, po.vendor_name, po.created_at
FROM public.purchase_orders po
JOIN public.hubs h ON h.id = po.hub_id
WHERE h.name ILIKE '%hyderabad%'
ORDER BY po.created_at DESC
LIMIT 30;
