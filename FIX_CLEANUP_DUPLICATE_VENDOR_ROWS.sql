-- ============================================================
--  Clean up duplicate vendor rows from batch PO imports
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  Root cause (now fixed in code — see PurchaseOrdersPage.tsx's
--  ImportPODialog): a batch import repeating the same vendor name
--  across many PO rows created a separate "new vendor" row per PO
--  row instead of reusing the one an earlier row in that same batch
--  had just created. Only one of those duplicates usually ended up
--  with bank details filled in — the report's vendor lookup was
--  landing on an arbitrary (often empty) duplicate instead.
--
--  This script does NOT delete anything — many other tables have
--  foreign keys to vendors.id with inconsistent ON DELETE rules
--  across this project's schema history (some CASCADE, some SET
--  NULL, some RESTRICT), so a blind delete risks silently removing
--  real linked records. Instead it deactivates (is_active = false)
--  every duplicate EXCEPT the one to keep per name group, which is
--  fully reversible and doesn't touch any foreign key.
-- ============================================================

-- ── 1. Preview — what would be deactivated, and why that row was
--       picked as the keeper. Review this before running step 2. ──
WITH ranked AS (
  SELECT
    id, name, bank_account, created_at,
    ROW_NUMBER() OVER (
      PARTITION BY lower(regexp_replace(regexp_replace(name, '^ms\.?\s*', '', 'i'), '[^a-zA-Z0-9]', '', 'g'))
      ORDER BY
        (bank_account IS NOT NULL AND bank_account <> '') DESC,  -- keeper = has bank details
        created_at ASC                                            -- tie-break = oldest
    ) AS rn,
    count(*) OVER (
      PARTITION BY lower(regexp_replace(regexp_replace(name, '^ms\.?\s*', '', 'i'), '[^a-zA-Z0-9]', '', 'g'))
    ) AS group_size
  FROM public.vendors
  WHERE is_active = true
)
SELECT id, name, bank_account, created_at,
       CASE WHEN rn = 1 THEN 'KEEP (active)' ELSE 'deactivate' END AS action
FROM ranked
WHERE group_size > 1
ORDER BY name, rn;

-- ── 2. Apply — deactivate every duplicate except the keeper ─────
-- Uncomment and run once you've reviewed step 1's output above.
--
-- WITH ranked AS (
--   SELECT
--     id,
--     ROW_NUMBER() OVER (
--       PARTITION BY lower(regexp_replace(regexp_replace(name, '^ms\.?\s*', '', 'i'), '[^a-zA-Z0-9]', '', 'g'))
--       ORDER BY
--         (bank_account IS NOT NULL AND bank_account <> '') DESC,
--         created_at ASC
--     ) AS rn
--   FROM public.vendors
--   WHERE is_active = true
-- )
-- UPDATE public.vendors
-- SET is_active = false
-- WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ── Verify (run after step 2) ────────────────────────────────
-- SELECT name, count(*) FILTER (WHERE is_active) AS active_count
-- FROM public.vendors
-- GROUP BY name
-- HAVING count(*) FILTER (WHERE is_active) > 1
-- ORDER BY name;
