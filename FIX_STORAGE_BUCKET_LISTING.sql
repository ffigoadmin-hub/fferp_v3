-- ============================================================
--  FIX — storage bucket listing exposure: employee-selfies,
--  transport-proofs
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  employee-selfies: "auth users can read selfies" let ANY
--  authenticated user (any role) list/read every employee's selfie,
--  not just their own — the UPDATE policy on the same bucket is
--  already correctly scoped to own folder
--  (storage.foldername(name)[1] = auth.uid()::text), the SELECT
--  policy just wasn't. Fix: own folder OR hr/admin/auditor (matches
--  the /selfie-attendance review page's route guard exactly).
--
--  transport-proofs: "Public read transport proofs" required no
--  login at all. Confirmed via grep this data is read across the
--  whole payment-approval chain (employee submitter, FF ops,
--  auditor, HR, admin, accounts) — broad legitimate staff access is
--  correct, but "public"/anonymous is not. Restricting to any
--  logged-in staff member (is_staff()).
-- ============================================================

DROP POLICY IF EXISTS "auth users can read selfies" ON storage.objects;
CREATE POLICY "auth users can read selfies" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'employee-selfies'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.get_my_role() IN ('hr', 'admin', 'auditor')
    )
  );

DROP POLICY IF EXISTS "Public read transport proofs" ON storage.objects;
CREATE POLICY "Staff read transport proofs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'transport-proofs' AND public.is_staff()
  );

-- ── Verify ───────────────────────────────────────────────────
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND (qual::text LIKE '%employee-selfies%' OR qual::text LIKE '%transport-proofs%')
ORDER BY policyname;
