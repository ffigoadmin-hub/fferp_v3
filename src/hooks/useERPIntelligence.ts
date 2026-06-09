import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type ChatPurpose = 'general' | 'auditor' | 'operations' | 'projects';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

export interface Conversation {
  id: string;
  title: string;
  purpose: ChatPurpose;
  messages: Message[];
  createdAt: number;
}

const STORAGE_KEY = 'erp-intelligence-conversations';
const ACTIVE_ID_KEY = 'erp-intelligence-active-id';
const MAX_HISTORY_MESSAGES = 50;

function loadConversations(): Conversation[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch { /* ignore */ }
  return [];
}

function saveConversations(conversations: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch { /* ignore */ }
}

export type LoadingStage = 'idle' | 'connecting' | 'analyzing' | 'fetching' | 'generating';

export function useERPIntelligence() {
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations());
  const [activeId, setActiveId] = useState<string | null>(() => localStorage.getItem(ACTIVE_ID_KEY));
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('idle');
  const { session } = useAuth();

  // Derived current conversation
  const currentConversation = conversations.find(c => c.id === activeId);
  const messages = currentConversation?.messages || [];

  // Sync to localStorage
  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    if (activeId) {
      localStorage.setItem(ACTIVE_ID_KEY, activeId);
    } else {
      localStorage.removeItem(ACTIVE_ID_KEY);
    }
  }, [activeId]);

  const createConversation = (purpose: ChatPurpose, title: string) => {
    const newChat: Conversation = {
      id: crypto.randomUUID(),
      title,
      purpose,
      messages: [],
      createdAt: Date.now()
    };
    setConversations(prev => [newChat, ...prev]);
    setActiveId(newChat.id);
    return newChat.id;
  };

  const deleteConversation = (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeId === id) {
      setActiveId(null);
    }
  };

  const sendMessage = useCallback(async (userMessage: string) => {
    if (!userMessage.trim() || isLoading || !activeId || !currentConversation) return;

    const userMsg: Message = {
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    };

    // Update local state immediately
    setConversations(prev => prev.map(c =>
      c.id === activeId
        ? { ...c, messages: [...c.messages, userMsg] }
        : c
    ));

    setIsLoading(true);
    setLoadingStage('connecting');

    let assistantContent = '';
    let hasStartedReceiving = false;

    const updateAssistant = (chunk: string) => {
      if (!hasStartedReceiving) {
        hasStartedReceiving = true;
        setLoadingStage('generating');
      }
      assistantContent += chunk;
      setConversations(prev => prev.map(c => {
        if (c.id !== activeId) return c;
        const msgs = [...c.messages];
        const last = msgs[msgs.length - 1];
        if (last?.role === 'assistant') {
          msgs[msgs.length - 1] = { ...last, content: assistantContent };
        } else {
          msgs.push({ role: 'assistant', content: assistantContent, timestamp: Date.now() });
        }
        return { ...c, messages: msgs };
      }));
    };

    try {
      const recentMessages = [...messages, userMsg].slice(-10);
      setLoadingStage('analyzing');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/erp-intelligence`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            purpose: currentConversation.purpose,
            messages: recentMessages.map(m => ({
              role: m.role,
              content: m.content
            }))
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || 'Failed to get response');
        setIsLoading(false);
        setLoadingStage('idle');
        return;
      }

      if (!response.body) throw new Error('No response body');
      setLoadingStage('fetching');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') break;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) updateAssistant(content);
            } catch { /* skip incomplete */ }
          }
        }
      }
    } catch (error) {
      console.error('ERP Intelligence error:', error);
      toast.error('Failed to communicate with AI assistant');
    } finally {
      setIsLoading(false);
      setLoadingStage('idle');
    }
  }, [activeId, currentConversation, messages, session, isLoading]);

  return {
    conversations,
    activeId,
    currentConversation,
    messages,
    isLoading,
    loadingStage,
    setActiveId,
    createConversation,
    deleteConversation,
    sendMessage
  };
}

