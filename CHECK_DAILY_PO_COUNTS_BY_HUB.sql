-- ============================================================
--  How many POs actually exist per day for Pallikaranai Hub
--  (or any hub) between 25-29 Aug 2026 — confirms whether the
--  26/27/28 entries genuinely exist in the database at all, or
--  whether they're just further down the sorted list, or truly
--  missing.
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
-- ============================================================
SELECT
  h.name AS hub_name,
  po.created_at::date AS po_date,
  count(*) AS po_count,
  sum(po.total_estimated) AS total_value
FROM public.purchase_orders po
LEFT JOIN public.hubs h ON h.id = po.hub_id
WHERE po.created_at::date BETWEEN '2026-08-25' AND '2026-08-29'
GROUP BY h.name, po.created_at::date
ORDER BY h.name, po_date;

-- If a hub+date combination you expect is simply missing from these
-- results, no PO was ever created for that hub on that day — that's
-- a data gap (upload never happened / went to the wrong hub / wrong
-- date), not a report bug. If it IS present here but wasn't visible
-- on the report page, that's a display bug worth chasing further.
