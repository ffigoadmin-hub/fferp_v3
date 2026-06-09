/**
 * ChatNotificationService
 * Sends in-app chat messages between users as part of workflow notifications.
 * Finds or creates a direct conversation, then posts a message.
 */

import { supabase } from '@/integrations/supabase/client';

async function getOrCreateDirectConversation(
  fromUserId: string,
  toUserId: string
): Promise<string | null> {
  try {
    // 1. Find conversations where fromUser is a participant and type = 'direct'
    const { data: myConversations } = await supabase
      .from('chat_participants')
      .select('conversation_id, chat_conversations!inner(type)')
      .eq('user_id', fromUserId)
      .eq('chat_conversations.type', 'direct');

    if (myConversations && myConversations.length > 0) {
      const conversationIds = myConversations.map((c: any) => c.conversation_id);

      // 2. Check if toUser is also in one of those conversations
      const { data: match } = await supabase
        .from('chat_participants')
        .select('conversation_id')
        .in('conversation_id', conversationIds)
        .eq('user_id', toUserId)
        .limit(1);

      if (match && match.length > 0) {
        return match[0].conversation_id;
      }
    }

    // 3. No existing conversation — create one
    const { data: newConv, error: convError } = await supabase
      .from('chat_conversations')
      .insert({ type: 'direct', created_by: fromUserId })
      .select()
      .single();

    if (convError || !newConv) {
      console.error('[ChatNotificationService] Failed to create conversation:', convError);
      return null;
    }

    // Add both participants (creator and receiver)
    await supabase.from('chat_participants').insert([
      { conversation_id: newConv.id, user_id: toUserId, role: 'member' },
    ]);

    return newConv.id;
  } catch (err) {
    console.error('[ChatNotificationService] getOrCreateDirectConversation error:', err);
    return null;
  }
}

async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string
): Promise<void> {
  try {
    await supabase.from('chat_messages').insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      type: 'text',
    });
  } catch (err) {
    console.error('[ChatNotificationService] sendMessage error:', err);
  }
}

/**
 * Notify a single user via direct chat message.
 * Creates the conversation if it doesn't already exist.
 */
async function notifyUser(
  fromUserId: string,
  toUserId: string,
  message: string
): Promise<void> {
  if (!fromUserId || !toUserId || fromUserId === toUserId) return;

  const convId = await getOrCreateDirectConversation(fromUserId, toUserId);
  if (!convId) return;

  await sendMessage(convId, fromUserId, message);
}

export const ChatNotificationService = {
  getOrCreateDirectConversation,
  sendMessage,
  notifyUser,
};
