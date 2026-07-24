-- ============================================================
--  RLS FIX — Auth tokens part 2: User, Session (missed in the
--  first pass — same NextAuth-style schema as Account/accounts/
--  sessions/VerificationToken/verification_tokens)
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  Same treatment as FIX_RLS_CRITICAL_AUTH_TOKENS.sql: deny-all
--  stopgap (RLS enabled, no policies). service_role/backend access
--  is unaffected; any client-side flow using these breaks until
--  whichever app owns them adds a real policy.
-- ============================================================

ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Session" ENABLE ROW LEVEL SECURITY;

-- ── customer_notifications, customer_queries, addresses, wishlists ──
-- Already have deliberate "open" policies (addresses_open, wishlists_open,
-- cq_open, cn_open — FOR ALL USING (true)) from FIX_RLS_ALL_ROLES.sql,
-- matching this app's customer-facing design. Just needs RLS switched on.
ALTER TABLE public.customer_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('User', 'Session', 'customer_notifications', 'customer_queries', 'addresses', 'wishlists');
