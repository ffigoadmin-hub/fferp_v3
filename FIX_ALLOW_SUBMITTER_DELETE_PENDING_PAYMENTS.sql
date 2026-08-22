-- ============================================================
--  FIX — let a submitter delete their OWN payment request, but
--  only while it's still pending_ff_ops (before anyone has acted on it)
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  FIX_RLS_URGENT_FF_PAYMENTS.sql locked DELETE down to admin-only,
--  which was correct at the time (no delete UI existed). Now that
--  MySubmittedPayments.tsx has a "delete if you made a mistake" button
--  scoped to the same two conditions, the DB policy needs to match —
--  otherwise the delete silently 403s for everyone except admin.
-- ============================================================

DROP POLICY IF EXISTS ff_vendor_payments_delete ON public.ff_vendor_payments;
CREATE POLICY ff_vendor_payments_delete ON public.ff_vendor_payments
  FOR DELETE USING (
    public.get_my_role() = 'admin'
    OR (created_by = auth.uid() AND payment_status = 'pending_ff_ops')
  );

DROP POLICY IF EXISTS ff_transport_payments_delete ON public.ff_transport_payments;
CREATE POLICY ff_transport_payments_delete ON public.ff_transport_payments
  FOR DELETE USING (
    public.get_my_role() = 'admin'
    OR (created_by = auth.uid() AND payment_status = 'pending_ff_ops')
  );

-- ── Verify ───────────────────────────────────────────────────
SELECT tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('ff_vendor_payments', 'ff_transport_payments') AND cmd = 'DELETE'
ORDER BY tablename;
