-- ============================================================
--  FIX — function search_path hardening + restrict trigger-only
--  functions from direct RPC access
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  Part 1: SET search_path = public on 23 pre-existing functions
--  flagged by the Advisor as "search path mutable" (a function
--  without a fixed search_path can be tricked into resolving
--  unqualified table/function names to attacker-controlled objects
--  if the caller manipulates their session search_path first).
--  Mechanical fix — does not change any function's logic. Uses a
--  dynamic block so it works regardless of each function's exact
--  argument signature.
--
--  Part 2: revoke direct RPC (PUBLIC EXECUTE) on functions that are
--  meant to fire only via database triggers, not be called directly
--  by a client — same reasoning as trigger_eod_po_now earlier.
--  Doesn't affect trigger firing (triggers execute via the trigger
--  mechanism, not a role-based EXECUTE call) — only blocks someone
--  hitting /rest/v1/rpc/<function_name> directly.
--  update_inventory_on_box_scan restricted per explicit instruction,
--  accepting the (unverified) risk that the Scanner app might call
--  it directly rather than purely via a trigger — quick to revert
--  (GRANT EXECUTE ... TO anon, authenticated;) if box scanning
--  breaks live.
-- ============================================================

-- ── Part 1: search_path hardening ───────────────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN (
        'auto_create_invoice','inventory_on_box_receive','inventory_on_wastage',
        'auto_vendor_payment','generate_po_number','generate_invoice_number',
        'sync_inventory_product_name','get_shift_for_time','update_conversation_last_message',
        'sync_vendor_bank_cols','handle_new_user','auto_assign_hub','update_updated_at',
        'generate_order_number','next_grn_number','auto_create_box_on_po_item',
        'notify_pe_on_po_assignment','notify_next_payment_approver','sync_product_to_website',
        'run_eod_po_engine','sync_order_item_to_erp','update_inventory_on_box_scan','is_admin'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public', r.proname, r.args);
  END LOOP;
END $$;

-- ── Part 2: restrict trigger-only functions from direct RPC ──
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_order_item_to_erp() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_order_to_sales_orders() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_inventory_on_box_scan() FROM PUBLIC;

-- ── Verify ───────────────────────────────────────────────────
SELECT p.proname, p.proconfig,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN (
    'auto_create_invoice','inventory_on_box_receive','inventory_on_wastage',
    'auto_vendor_payment','generate_po_number','generate_invoice_number',
    'sync_inventory_product_name','get_shift_for_time','update_conversation_last_message',
    'sync_vendor_bank_cols','handle_new_user','auto_assign_hub','update_updated_at',
    'generate_order_number','next_grn_number','auto_create_box_on_po_item',
    'notify_pe_on_po_assignment','notify_next_payment_approver','sync_product_to_website',
    'run_eod_po_engine','sync_order_item_to_erp','sync_order_to_sales_orders',
    'update_inventory_on_box_scan','is_admin'
  )
ORDER BY p.proname;
