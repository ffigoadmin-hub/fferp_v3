-- ============================================================
--  RLS FIX — CRITICAL: exposed auth token tables
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  Confirmed via Supabase's own Security Advisor
--  (sensitive_columns_exposed lint): these 5 tables have ZERO RLS
--  and contain literal live authentication tokens, exposed via the
--  public PostgREST API to anyone holding the anon/publishable key
--  (which is embedded in every client bundle):
--    - Account / accounts:            access_token, refresh_token
--    - sessions:                      session_token
--    - VerificationToken / verification_tokens:  token
--
--  None of these tables are referenced anywhere in this FFERPv2
--  repo (confirmed via grep) — they belong to a different app
--  sharing this Supabase project (likely the Scanner app or
--  website, per the architecture doc), so the correct access
--  pattern is unknown here.
--
--  This applies a DENY-ALL stopgap: RLS enabled, no policies. This
--  blocks all access via anon/authenticated API roles immediately.
--  The service_role key (used by trusted backend/server code)
--  bypasses RLS entirely and is UNAFFECTED — so any legitimate
--  server-side auth flow using service_role keeps working.
--  A client-side (anon/authenticated key) flow that legitimately
--  needs these tables WILL break until whichever team owns that
--  app adds a real, scoped policy — that trade-off was chosen
--  deliberately given the severity of raw token exposure.
-- ============================================================

ALTER TABLE public."Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."VerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_tokens ENABLE ROW LEVEL SECURITY;

-- ── Verify ───────────────────────────────────────────────────
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('Account', 'accounts', 'sessions', 'VerificationToken', 'verification_tokens')
ORDER BY tablename;

-- Confirm no leftover policies exist that would undermine the deny-all
-- (should return 0 rows — if it doesn't, those policies need dropping too)
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('Account', 'accounts', 'sessions', 'VerificationToken', 'verification_tokens');
