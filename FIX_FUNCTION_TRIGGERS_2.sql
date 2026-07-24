-- ============================================================
--  FIX — trigger-only function RPC restriction, take 2
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  Revoking from PUBLIC alone didn't work — there must be an
--  explicit GRANT directly to anon/authenticated separate from the
--  PUBLIC default. Revoking from all three explicitly this time.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_order_item_to_erp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_order_to_sales_orders() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_inventory_on_box_scan() FROM PUBLIC, anon, authenticated;

-- ── Verify ───────────────────────────────────────────────────
SELECT
  p.proname,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN (
    'handle_new_user','sync_order_item_to_erp',
    'sync_order_to_sales_orders','update_inventory_on_box_scan'
  )
ORDER BY p.proname;
