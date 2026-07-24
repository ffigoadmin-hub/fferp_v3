-- ============================================================
--  FIX — function permissions, take 2: revoke from PUBLIC directly
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  Postgres grants EXECUTE to the PUBLIC pseudo-role by default on
--  function creation. Revoking from the named role `anon` alone
--  doesn't help if PUBLIC still grants it — every role implicitly
--  inherits PUBLIC privileges. Revoking from PUBLIC first, then
--  re-granting only to the roles that should keep access.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.decrement_stock(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.restore_stock(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrement_stock(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_stock(uuid, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.trigger_eod_po_now() FROM PUBLIC;
-- No re-grant — staff/service-role only (service_role bypasses grants entirely).

-- ── Verify ───────────────────────────────────────────────────
SELECT
  p.proname,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
WHERE p.proname IN ('decrement_stock', 'restore_stock', 'trigger_eod_po_now')
  AND p.pronamespace = 'public'::regnamespace;
