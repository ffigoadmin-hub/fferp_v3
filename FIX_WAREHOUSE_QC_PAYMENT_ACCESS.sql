-- ============================================================
--  FIX — let ff_payment_access flag holders act on QC tables
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  Anusiya's warehouse access was just opened up in the frontend
--  (route + sidebar), but the actual write rules on qc_inspections
--  and qc_rejections only allow a fixed role list that doesn't
--  include her real role (field_executive) or any flag check —
--  so her QC grading / rejection clicks would have silently failed
--  at the database level, the same class of gap just fixed for
--  payment approvals. Adding OR has_ff_payment_access() to both,
--  same approach as is_ff_payment_approver().
--
--  order_returns needed no change — it already uses is_staff(),
--  which only checks that the caller is an active internal staff
--  member with no role restriction at all, so it already covers her.
--
--  Note (not fixed here, out of scope): neither policy's original
--  role list includes ff_operations_manager or hub_manager either —
--  a pre-existing gap unrelated to today's request. Flagging for
--  awareness, not touching it since it wasn't asked for.
-- ============================================================

DROP POLICY IF EXISTS "QC manage inspections" ON public.qc_inspections;
CREATE POLICY "QC manage inspections" ON public.qc_inspections
  FOR ALL USING (
    get_my_role() = ANY (ARRAY['admin'::text, 'ceo'::text, 'gm'::text, 'warehouse_manager'::text, 'qc_manager'::text, 'back_office'::text])
    OR public.has_ff_payment_access()
  );

DROP POLICY IF EXISTS "QC manage rejections" ON public.qc_rejections;
CREATE POLICY "QC manage rejections" ON public.qc_rejections
  FOR ALL USING (
    get_my_role() = ANY (ARRAY['admin'::text, 'ceo'::text, 'gm'::text, 'warehouse'::text, 'logistics'::text, 'datateam'::text])
    OR public.has_ff_payment_access()
  );

-- ── Verify ───────────────────────────────────────────────────
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('qc_inspections', 'qc_rejections')
  AND cmd = 'ALL'
ORDER BY tablename;
