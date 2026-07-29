-- ============================================================
--  FIX — purchase_order_items RLS write policy was narrower than
--  purchase_orders', silently blocking line-item inserts for
--  several roles that ARE allowed to create the PO itself.
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  purchase_orders write roles (from "Purchase team manages POs" +
--  "po_ops_all", confirmed live via pg_policies 2026-07-29):
--    admin, ceo, gm, ff_operations_manager, l1_manager,
--    purchase_manager, purchase_head, back_office, shift_employee,
--    hub_manager, auditor, accounts, smo, gmo
--
--  purchase_order_items write role ("Purchase manage PO items") was
--  only: admin, ceo, gm, purchase_manager, purchase_head, back_office
--  — missing ff_operations_manager, l1_manager, shift_employee,
--  hub_manager, auditor, accounts, smo, gmo. Any of those roles
--  creating a PO (e.g. via EODPOEngine.tsx) got a PO shell with zero
--  line items, silently, no error shown anywhere.
--
--  This replaces the policy with the same role set purchase_orders
--  already uses, so the two tables can't drift out of sync again.
-- ============================================================

DROP POLICY IF EXISTS "Purchase manage PO items" ON public.purchase_order_items;

CREATE POLICY "Purchase manage PO items" ON public.purchase_order_items
FOR ALL
USING (
  get_my_role() = ANY (ARRAY[
    'admin', 'ceo', 'gm', 'ff_operations_manager', 'l1_manager',
    'purchase_manager', 'purchase_head', 'back_office', 'shift_employee',
    'hub_manager', 'auditor', 'accounts', 'smo', 'gmo'
  ])
)
WITH CHECK (
  get_my_role() = ANY (ARRAY[
    'admin', 'ceo', 'gm', 'ff_operations_manager', 'l1_manager',
    'purchase_manager', 'purchase_head', 'back_office', 'shift_employee',
    'hub_manager', 'auditor', 'accounts', 'smo', 'gmo'
  ])
);

-- ── Verify ───────────────────────────────────────────────────
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'purchase_order_items';
