-- ============================================================
--  Re-point ff_vendor_payments.vendor_id away from empty duplicate
--  vendor rows, to the same-named sibling that has bank details.
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  Payment Approvals (FFPaymentApprovals.tsx) joins vendor bank
--  details via the payment's own vendor_id — a hard foreign key set
--  once when the payment was created, not a name lookup. If that
--  payment was raised while a vendor name had several duplicate rows
--  (see FIX_CLEANUP_DUPLICATE_VENDOR_ROWS.sql for why), vendor_id may
--  point at one of the empty duplicates instead of the one with real
--  bank details — so the approver sees blank bank info no matter what
--  the report page shows. This updates vendor_id itself, which fixes
--  it everywhere that joins on it, not just one page.
--
--  Safe: only ever re-points to another EXISTING, active vendor row
--  (same name, has bank details) — never deletes or creates anything.
-- ============================================================

-- ── 1. Preview — which payments would be re-pointed, from which
--       vendor row to which ──────────────────────────────────
WITH candidates AS (
  SELECT
    v.id AS empty_id,
    v.name,
    (SELECT v2.id FROM public.vendors v2
     WHERE v2.is_active = true
       AND v2.bank_account IS NOT NULL AND v2.bank_account <> ''
       AND lower(regexp_replace(regexp_replace(v2.name, '^ms\.?\s*', '', 'i'), '[^a-zA-Z0-9]', '', 'g'))
         = lower(regexp_replace(regexp_replace(v.name,  '^ms\.?\s*', '', 'i'), '[^a-zA-Z0-9]', '', 'g'))
     ORDER BY v2.created_at ASC
     LIMIT 1) AS good_id
  FROM public.vendors v
  WHERE v.bank_account IS NULL OR v.bank_account = ''
)
SELECT p.id AS payment_id, p.payment_status, p.gross_amount,
       c.name AS vendor_name, c.empty_id AS currently_linked_to, c.good_id AS would_repoint_to
FROM public.ff_vendor_payments p
JOIN candidates c ON p.vendor_id = c.empty_id
WHERE c.good_id IS NOT NULL
ORDER BY c.name;

-- ── 2. Apply — uncomment and run once step 1 looks right ────────
--
-- WITH candidates AS (
--   SELECT
--     v.id AS empty_id,
--     (SELECT v2.id FROM public.vendors v2
--      WHERE v2.is_active = true
--        AND v2.bank_account IS NOT NULL AND v2.bank_account <> ''
--        AND lower(regexp_replace(regexp_replace(v2.name, '^ms\.?\s*', '', 'i'), '[^a-zA-Z0-9]', '', 'g'))
--          = lower(regexp_replace(regexp_replace(v.name,  '^ms\.?\s*', '', 'i'), '[^a-zA-Z0-9]', '', 'g'))
--      ORDER BY v2.created_at ASC
--      LIMIT 1) AS good_id
--   FROM public.vendors v
--   WHERE v.bank_account IS NULL OR v.bank_account = ''
-- )
-- UPDATE public.ff_vendor_payments p
-- SET vendor_id = c.good_id
-- FROM candidates c
-- WHERE p.vendor_id = c.empty_id
--   AND c.good_id IS NOT NULL;

-- ── Verify (run after step 2) ────────────────────────────────
-- SELECT p.id, v.name, v.bank_account, v.bank_ifsc
-- FROM public.ff_vendor_payments p
-- JOIN public.vendors v ON v.id = p.vendor_id
-- WHERE p.payment_status LIKE 'pending%'
-- ORDER BY p.created_at DESC;
