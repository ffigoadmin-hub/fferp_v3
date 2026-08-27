-- ============================================================
--  FIX — extend PO create/edit to every role that can view
--  /purchase/orders (PurchaseOrdersPage.tsx now shows New PO /
--  Edit buttons to all of them), plus ff_payment_access flag holders.
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  purchase_orders / purchase_order_items already allow write for:
--    admin, ceo, gm, ff_operations_manager, l1_manager,
--    purchase_manager, purchase_head, back_office, shift_employee,
--    hub_manager, auditor, accounts, smo, gmo
--  (see FIX_PURCHASE_ORDER_ITEMS_RLS_GAP.sql)
--
--  PurchaseOrdersPage.tsx's canEditPO now also includes roles NOT in
--  that list: director, boi, nsm, hr, warehouse_manager, qc_manager,
--  field_executive, tele_caller, bde — plus has_ff_payment_access().
--  Without this, those roles would see the New PO / Edit buttons but
--  get silently rejected by RLS on click. This ADDS a policy for the
--  missing roles rather than touching the existing ones (whose exact
--  live definition isn't in a tracked file), so nothing already
--  working can regress.
-- ============================================================

DROP POLICY IF EXISTS "PO extended write access" ON public.purchase_orders;
CREATE POLICY "PO extended write access" ON public.purchase_orders
FOR ALL
USING (
  get_my_role() = ANY (ARRAY[
    'director', 'boi', 'nsm', 'hr', 'warehouse_manager', 'qc_manager',
    'field_executive', 'tele_caller', 'bde'
  ]) OR public.has_ff_payment_access()
)
WITH CHECK (
  get_my_role() = ANY (ARRAY[
    'director', 'boi', 'nsm', 'hr', 'warehouse_manager', 'qc_manager',
    'field_executive', 'tele_caller', 'bde'
  ]) OR public.has_ff_payment_access()
);

DROP POLICY IF EXISTS "PO items extended write access" ON public.purchase_order_items;
CREATE POLICY "PO items extended write access" ON public.purchase_order_items
FOR ALL
USING (
  get_my_role() = ANY (ARRAY[
    'director', 'boi', 'nsm', 'hr', 'warehouse_manager', 'qc_manager',
    'field_executive', 'tele_caller', 'bde'
  ]) OR public.has_ff_payment_access()
)
WITH CHECK (
  get_my_role() = ANY (ARRAY[
    'director', 'boi', 'nsm', 'hr', 'warehouse_manager', 'qc_manager',
    'field_executive', 'tele_caller', 'bde'
  ]) OR public.has_ff_payment_access()
);

-- ── Verify ───────────────────────────────────────────────────
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('purchase_orders', 'purchase_order_items')
ORDER BY tablename, policyname;
