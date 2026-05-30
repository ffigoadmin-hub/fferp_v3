-- ============================================================
--  FFERPv2 — Chat & Communication System
--  Migration: 20260529_001_chat_system.sql
--
--  FIX: All tables are created first (Phase 1), then all RLS
--  policies are applied (Phase 2).  This avoids the forward-
--  reference error where chat_conversations' SELECT policy
--  referenced chat_participants before that table existed.
-- ============================================================

-- ════════════════════════════════════════════════════════════
--  PHASE 1 — CREATE ALL TABLES
-- ════════════════════════════════════════════════════════════

-- ── 1. CHAT CONVERSATIONS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text,
  type            text NOT NULL DEFAULT 'direct' CHECK (type IN ('direct','group')),
  avatar_url      text,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_message_at timestamptz DEFAULT now(),
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ── 2. CHAT PARTICIPANTS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_participants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at    timestamptz DEFAULT now(),
  is_admin        boolean DEFAULT false,
  joined_at       timestamptz DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_chat_participants_conversation ON public.chat_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user        ON public.chat_participants(user_id);

-- ── 3. CHAT MESSAGES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content         text,
  type            text NOT NULL DEFAULT 'text' CHECK (type IN ('text','image','audio','file','video','system')),
  media_url       text,
  metadata        jsonb DEFAULT '{}',
  reply_to_id     uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  is_deleted      boolean DEFAULT false,
  is_edited       boolean DEFAULT false,
  is_pinned       boolean DEFAULT false,
  edited_at       timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON public.chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender       ON public.chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created      ON public.chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_reply        ON public.chat_messages(reply_to_id);

-- ── 4. CHAT MESSAGE REACTIONS ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_message_reactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji       text NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS idx_chat_reactions_message ON public.chat_message_reactions(message_id);

-- ── 5. CHAT CALLS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_calls (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid REFERENCES public.chat_conversations(id) ON DELETE SET NULL,
  caller_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  type             text NOT NULL DEFAULT 'voice' CHECK (type IN ('voice','video')),
  status           text NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing','ongoing','ended','declined','missed')),
  started_at       timestamptz,
  ended_at         timestamptz,
  duration_seconds integer DEFAULT 0,
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_calls_caller       ON public.chat_calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_chat_calls_receiver     ON public.chat_calls(receiver_id);
CREATE INDEX IF NOT EXISTS idx_chat_calls_conversation ON public.chat_calls(conversation_id);

-- ── 6. CHAT CALL SIGNALS (WebRTC signaling) ──────────────────
CREATE TABLE IF NOT EXISTS public.chat_call_signals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id     uuid NOT NULL REFERENCES public.chat_calls(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('offer','answer','ice-candidate','hangup','reject')),
  payload     jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_signals_call     ON public.chat_call_signals(call_id);
CREATE INDEX IF NOT EXISTS idx_chat_signals_receiver ON public.chat_call_signals(receiver_id);


-- ════════════════════════════════════════════════════════════
--  PHASE 2 — ENABLE RLS & CREATE ALL POLICIES
--  (all tables now exist, so cross-table references are safe)
-- ════════════════════════════════════════════════════════════

-- ── chat_conversations policies ──────────────────────────────
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view conversations" ON public.chat_conversations;
CREATE POLICY "Participants can view conversations" ON public.chat_conversations
  FOR SELECT USING (
    id IN (
      SELECT conversation_id FROM public.chat_participants WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated can create conversations" ON public.chat_conversations;
CREATE POLICY "Authenticated can create conversations" ON public.chat_conversations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Creator can update conversation" ON public.chat_conversations;
CREATE POLICY "Creator can update conversation" ON public.chat_conversations
  FOR UPDATE USING (
    created_by = auth.uid() OR get_my_role() IN ('admin','ceo')
  );

DROP POLICY IF EXISTS "Admin can delete conversations" ON public.chat_conversations;
CREATE POLICY "Admin can delete conversations" ON public.chat_conversations
  FOR DELETE USING (
    created_by = auth.uid() OR get_my_role() IN ('admin','ceo')
  );

-- ── chat_participants policies ───────────────────────────────
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own participations" ON public.chat_participants;
CREATE POLICY "Users can view own participations" ON public.chat_participants
  FOR SELECT USING (
    user_id = auth.uid()
    OR conversation_id IN (
      SELECT conversation_id FROM public.chat_participants WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated can join conversations" ON public.chat_participants;
CREATE POLICY "Authenticated can join conversations" ON public.chat_participants
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own participation" ON public.chat_participants;
CREATE POLICY "Users can update own participation" ON public.chat_participants
  FOR UPDATE USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo'));

DROP POLICY IF EXISTS "Users can leave conversations" ON public.chat_participants;
CREATE POLICY "Users can leave conversations" ON public.chat_participants
  FOR DELETE USING (user_id = auth.uid() OR get_my_role() IN ('admin','ceo'));

-- ── chat_messages policies ───────────────────────────────────
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view messages" ON public.chat_messages;
CREATE POLICY "Participants can view messages" ON public.chat_messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT conversation_id FROM public.chat_participants WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Participants can send messages" ON public.chat_messages;
CREATE POLICY "Participants can send messages" ON public.chat_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (
      SELECT conversation_id FROM public.chat_participants WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sender can edit own message" ON public.chat_messages;
CREATE POLICY "Sender can edit own message" ON public.chat_messages
  FOR UPDATE USING (sender_id = auth.uid() OR get_my_role() IN ('admin','ceo'));

DROP POLICY IF EXISTS "Sender or admin can delete message" ON public.chat_messages;
CREATE POLICY "Sender or admin can delete message" ON public.chat_messages
  FOR DELETE USING (sender_id = auth.uid() OR get_my_role() IN ('admin','ceo'));

-- ── chat_message_reactions policies ─────────────────────────
ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view reactions" ON public.chat_message_reactions;
CREATE POLICY "Authenticated can view reactions" ON public.chat_message_reactions
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can react" ON public.chat_message_reactions;
CREATE POLICY "Users can react" ON public.chat_message_reactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can remove own reaction" ON public.chat_message_reactions;
CREATE POLICY "Users can remove own reaction" ON public.chat_message_reactions
  FOR DELETE USING (user_id = auth.uid());

-- ── chat_calls policies ──────────────────────────────────────
ALTER TABLE public.chat_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view calls" ON public.chat_calls;
CREATE POLICY "Participants can view calls" ON public.chat_calls
  FOR SELECT USING (
    caller_id = auth.uid() OR receiver_id = auth.uid() OR get_my_role() IN ('admin','ceo')
  );

DROP POLICY IF EXISTS "Authenticated can create calls" ON public.chat_calls;
CREATE POLICY "Authenticated can create calls" ON public.chat_calls
  FOR INSERT WITH CHECK (caller_id = auth.uid());

DROP POLICY IF EXISTS "Call participants can update" ON public.chat_calls;
CREATE POLICY "Call participants can update" ON public.chat_calls
  FOR UPDATE USING (
    caller_id = auth.uid() OR receiver_id = auth.uid() OR get_my_role() IN ('admin','ceo')
  );

-- ── chat_call_signals policies ───────────────────────────────
ALTER TABLE public.chat_call_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Signal participants can view" ON public.chat_call_signals;
CREATE POLICY "Signal participants can view" ON public.chat_call_signals
  FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated can send signals" ON public.chat_call_signals;
CREATE POLICY "Authenticated can send signals" ON public.chat_call_signals
  FOR INSERT WITH CHECK (sender_id = auth.uid());


-- ════════════════════════════════════════════════════════════
--  PHASE 3 — TRIGGER & REALTIME
-- ════════════════════════════════════════════════════════════

-- ── Trigger: keep last_message_at in sync ────────────────────
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.chat_conversations
  SET last_message_at = NEW.created_at,
      updated_at      = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_conversation_last_message ON public.chat_messages;
CREATE TRIGGER trg_update_conversation_last_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();

-- ── Enable Realtime ──────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_call_signals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_calls;
