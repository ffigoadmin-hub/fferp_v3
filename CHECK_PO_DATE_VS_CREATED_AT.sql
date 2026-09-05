-- ============================================================
--  Is purchase_orders.eod_date (the PO's own business date) actually
--  different from created_at (when the row was inserted)? If bulk
--  imports insert many days' worth of POs in one sitting, eod_date
--  might correctly hold 25/26/27/28/29 while created_at clusters
--  around whenever the import actually ran — which would mean the
--  Purchase Report is filtering/displaying the WRONG date column.
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
-- ============================================================
SELECT
  h.name AS hub_name,
  po.eod_date,
  po.created_at::date AS created_date,
  count(*) AS po_count
FROM public.purchase_orders po
LEFT JOIN public.hubs h ON h.id = po.hub_id
WHERE h.name IN ('Pallikaranai Hub', 'Vanagaram Hub')
  AND (po.eod_date BETWEEN '2026-08-25' AND '2026-08-29'
       OR po.created_at::date BETWEEN '2026-08-25' AND '2026-08-29')
GROUP BY h.name, po.eod_date, po.created_at::date
ORDER BY h.name, po.eod_date, created_date;
