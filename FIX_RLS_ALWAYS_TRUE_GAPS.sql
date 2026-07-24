-- ============================================================
--  FIX — real gaps found in the "RLS Policy Always True" warnings
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  Of the 18 "Always True" warnings, most are accepted tradeoffs
--  already decided this session (customer tables with no real login
--  system). These 4 are different — checked against the actual FFERP
--  source code before fixing:
--
--  audit_logs — policy "System inserts logs" let ANYONE (even a
--  logged-out visitor) insert a fake audit trail entry. Checked:
--  every real insert in the codebase (LoginPage.tsx, useSiteVisit*
--  hooks) happens after a real Supabase Auth login and always sets
--  performed_by to the caller's own user id. Fix: only signed-in
--  users can insert, and only as themselves.
--
--  wishlist_items — policy let ANY signed-in user edit/delete ANY
--  customer's wishlist rows. Grepped the FFERP codebase: zero
--  references anywhere (unlike `wishlists`, which today's earlier fix
--  intentionally left open for the customer app). Since nothing here
--  confirms a legitimate open use case, defaulting to staff-only
--  (same cautious default already used for other unconfirmed tables
--  today) instead of guessing.
--
--  device_tokens — had TWO overlapping wide-open policies stacked on
--  top of each other (one for signed-in users, one for literally
--  anyone). Also zero references in FFERP code — belongs to the other
--  (customer) app's push-notification feature. Since customers in
--  that app don't have real login sessions (same reason addresses/
--  wishlists/customer_notifications were left open earlier today),
--  keeping this open is consistent — just removing the redundant
--  duplicate policy so there's one clear rule instead of two stacked
--  ones.
--
--  push_tokens — single open policy, same reasoning as device_tokens
--  (customer app, no real login). Left as-is, no change needed —
--  included here only for completeness/verification.
-- ============================================================

-- ── audit_logs — restrict insert to signed-in users, only as themselves ──
DROP POLICY IF EXISTS "System inserts logs" ON public.audit_logs;
CREATE POLICY audit_logs_self_insert ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (performed_by = auth.uid());

-- ── wishlist_items — no confirmed use case for open access, default to staff-only ──
DROP POLICY IF EXISTS auth_full_wishlist_items ON public.wishlist_items;
CREATE POLICY wishlist_items_staff_only ON public.wishlist_items
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ── device_tokens — remove the redundant duplicate, keep one open policy ──
DROP POLICY IF EXISTS auth_full_device_tokens ON public.device_tokens;
DROP POLICY IF EXISTS device_tokens_open ON public.device_tokens;
CREATE POLICY device_tokens_open ON public.device_tokens
  FOR ALL USING (true) WITH CHECK (true);

-- ── Verify ───────────────────────────────────────────────────
SELECT tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('audit_logs','wishlist_items','device_tokens','push_tokens')
ORDER BY tablename, policyname;
