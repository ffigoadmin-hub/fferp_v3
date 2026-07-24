-- ============================================================
--  FIX — restrict dangerous SECURITY DEFINER function EXECUTE grants
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  decrement_stock(product_id, quantity) / restore_stock(...): no
--  validation against any real order at all — currently callable by
--  anyone, logged in or not, with arbitrary product_id/quantity, to
--  directly manipulate any product's stock count. Not referenced
--  anywhere in this FFERP repo — likely used by the customer
--  checkout flow in the other app. Restricting to authenticated only
--  (per decision) — stops anonymous abuse while preserving checkout
--  for any customer with a session.
--
--  trigger_eod_po_now(): just calls run_eod_po_engine(CURRENT_DATE)
--  directly — no legitimate reason for a customer or anonymous
--  visitor to manually fire your internal EOD Purchase Order engine
--  on demand (duplicate/premature POs). Not referenced anywhere in
--  this FFERP repo either. Restricting to staff/service-role only.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.decrement_stock(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.restore_stock(uuid, integer) FROM anon;

REVOKE EXECUTE ON FUNCTION public.trigger_eod_po_now() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trigger_eod_po_now() FROM authenticated;

-- ── Verify ───────────────────────────────────────────────────
SELECT
  p.proname,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
WHERE p.proname IN ('decrement_stock', 'restore_stock', 'trigger_eod_po_now')
  AND p.pronamespace = 'public'::regnamespace;
