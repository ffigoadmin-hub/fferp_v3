-- ============================================================
--  RLS FIX — URGENT follow-up: more leftover policies found on
--  ff_vendor_payments / ff_transport_payments after the first fix
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  Found via a full pg_policies dump after applying
--  FIX_RLS_URGENT_FF_PAYMENTS.sql: two OLDER, previously-unknown
--  policies remained active, OR'd with my new ones:
--
--  - fftp_submitter / ffvp_submitter: FOR ALL USING (created_by =
--    auth.uid()), NO role check at all. This is worse than the
--    blanket-access bug — "FOR ALL" includes UPDATE, meaning ANY
--    authenticated user who submits a payment (created_by = their
--    own id) can then also UPDATE that same row themselves —
--    including its payment_status column. A purchase exec (or
--    literally anyone) could submit a payment and immediately
--    self-approve it, completely bypassing the FF Ops → L1 →
--    Auditor → CEO approval chain.
--
--  - fftp_approvers / ffvp_approvers, fftp_approver_update /
--    ffvp_approver_update, fftp_hub_insert / ffvp_hub_insert: these
--    use a different pre-existing function (auth_role(), not
--    get_my_role()) but with the same role list as my new policies —
--    redundant, not independently harmful, but consolidating
--    everything under one set of named policies so a future audit
--    doesn't have to reconcile two parallel systems.
-- ============================================================

DROP POLICY IF EXISTS fftp_submitter        ON public.ff_transport_payments;
DROP POLICY IF EXISTS fftp_approvers        ON public.ff_transport_payments;
DROP POLICY IF EXISTS fftp_approver_update  ON public.ff_transport_payments;
DROP POLICY IF EXISTS fftp_hub_insert       ON public.ff_transport_payments;

DROP POLICY IF EXISTS ffvp_submitter        ON public.ff_vendor_payments;
DROP POLICY IF EXISTS ffvp_approvers        ON public.ff_vendor_payments;
DROP POLICY IF EXISTS ffvp_approver_update  ON public.ff_vendor_payments;
DROP POLICY IF EXISTS ffvp_hub_insert       ON public.ff_vendor_payments;

-- ── Verify: should now show ONLY the 4 policies I created
--    (select/insert/update/delete) per table, nothing else ──
SELECT tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('ff_vendor_payments', 'ff_transport_payments')
ORDER BY tablename, policyname;
