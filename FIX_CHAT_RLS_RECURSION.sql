-- ============================================================
--  FIX — infinite recursion in chat RLS policies
--  Run on: qwiumswrbddwmlraktvy → Supabase SQL Editor
--
--  Root cause: chat_participants' own SELECT policy
--  ("Users view own participations") subqueries chat_participants
--  itself to check "am I a participant in this row's conversation" —
--  evaluating that subquery re-triggers the same RLS policy,
--  recursing infinitely (Postgres error 42P17). Three other
--  policies (chat_conversations "Participants view conversations",
--  chat_messages "Participants view messages" and "Participants
--  send messages") use the identical subquery pattern against
--  chat_participants, so they inherited the same crash even though
--  they aren't self-referential — any query touching
--  chat_participants' RLS transitively hits the recursive policy.
--
--  This was dormant while RLS was disabled on these tables (Batch
--  bulk-enable earlier today just activated a pre-existing bug, not
--  something we introduced).
--
--  Fix: wrap the membership check in a SECURITY DEFINER function.
--  Its internal query bypasses RLS entirely, breaking the recursion.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_conversation_participant(conv_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE conversation_id = conv_id AND user_id = auth.uid()
  );
$$;

-- ── chat_participants: the recursive policy itself ──────────
DROP POLICY IF EXISTS "Users view own participations" ON public.chat_participants;
CREATE POLICY "Users view own participations" ON public.chat_participants
  FOR SELECT USING (
    user_id = auth.uid() OR public.is_conversation_participant(conversation_id)
  );

-- ── chat_conversations: same subquery pattern, fixed the same way ──
DROP POLICY IF EXISTS "Participants view conversations" ON public.chat_conversations;
CREATE POLICY "Participants view conversations" ON public.chat_conversations
  FOR SELECT USING (public.is_conversation_participant(id));

-- ── chat_messages: same subquery pattern, fixed the same way ──
DROP POLICY IF EXISTS "Participants view messages" ON public.chat_messages;
CREATE POLICY "Participants view messages" ON public.chat_messages
  FOR SELECT USING (public.is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "Participants send messages" ON public.chat_messages;
CREATE POLICY "Participants send messages" ON public.chat_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND public.is_conversation_participant(conversation_id)
  );

-- ── Verify: should return no rows if recursion is fixed ─────
-- (run as any authenticated user via the app afterward to confirm
-- chat loads without a 42P17 error — this SQL just confirms the
-- policies were replaced)
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('chat_participants', 'chat_conversations', 'chat_messages')
ORDER BY tablename, policyname;
