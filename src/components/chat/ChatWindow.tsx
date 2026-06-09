import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useOutletContext, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Phone, Video, MoreVertical, FileIcon, Check, MessageSquare, X, Clock, Trash2, Eraser, Search, Pin, ChevronDown, ChevronUp } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { ChatInput } from "./ChatInput";
import { CallMessageBubble } from "./CallMessageBubble";
import { MessageContextMenu } from "./MessageContextMenu";
import { MessageReactions } from "./MessageReactions";
import { VoiceMessagePlayer } from "./VoiceMessagePlayer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { NewChatDialog } from "./NewChatDialog";

type Reaction = {
    id: string;
    emoji: string;
    user_id: string;
    profiles?: { name: string };
};

type ReplyInfo = {
    id: string;
    content: string | null;
    type: string;
    profiles?: { name: string | null } | null;
};

type Message = {
    id: string;
    content: string | null;
    sender_id: string;
    created_at: string;
    type: 'text' | 'image' | 'audio' | 'file' | 'system';
    media_url: string | null;
    metadata: any;
    is_deleted?: boolean;
    is_edited?: boolean | null;
    is_pinned?: boolean | null;
    edited_at?: string | null;
    reply_to_id?: string | null;
    reply_to?: ReplyInfo | null;
    profiles: {
        name: string | null;
        role: string | null;
        department: string | null;
    } | null;
};

export const ChatWindow = () => {
    const { conversationId } = useParams();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const navigate = useNavigate();
    const { onlineUsers } = useOutletContext<{ onlineUsers: Set<string> }>();
    const [messages, setMessages] = useState<Message[]>([]);
    const [conversation, setConversation] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isTyping, setIsTyping] = useState<Record<string, boolean>>({});
    const [participants, setParticipants] = useState<any[]>([]);
    const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});

    // Reply state
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);

    // Edit state
    const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);

    // Pin panel state
    const [showPinnedPanel, setShowPinnedPanel] = useState(false);

    // Search state
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<string[]>([]);
    const [searchIndex, setSearchIndex] = useState(0);

    const typingTimeoutRef = useRef<NodeJS.Timeout>();
    const presenceChannelRef = useRef<any>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const markAsReadTimeoutRef = useRef<NodeJS.Timeout>();
    const subscriptionRef = useRef<any>(null);
    const messagesRef = useRef<Message[]>([]);

    // Derive pinned messages from loaded state — no extra query needed
    const pinnedMessages = messages.filter(m => m.is_pinned && !m.is_deleted);

    // Sync messagesRef with current messages state to avoid stale closures in subscriptions
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        if (!conversationId || !user) return;

        fetchConversationDetails();
        fetchMessages();
        fetchParticipants();
        markAsRead();

        const unsubscribe = subscribeToMessages();
        const unsubscribePresence = subscribeToPresence();
        const unsubscribeParticipants = subscribeToParticipants();

        return () => {
            unsubscribe();
            unsubscribePresence();
            unsubscribeParticipants();
        };
    }, [conversationId, user]);

    useEffect(() => {
        if (scrollRef.current && messages.length > 0) {
            scrollRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
        }
    }, [messages.length]);

    // Mark as read when messages change (debounced to prevent excessive calls)
    useEffect(() => {
        if (conversationId && messages.length > 0) {
            // Clear existing timeout
            if (markAsReadTimeoutRef.current) {
                clearTimeout(markAsReadTimeoutRef.current);
            }
            // Debounce markAsRead by 1 second
            markAsReadTimeoutRef.current = setTimeout(() => {
                markAsRead();
            }, 1000);
        }
        return () => {
            if (markAsReadTimeoutRef.current) {
                clearTimeout(markAsReadTimeoutRef.current);
            }
        };
    }, [messages.length, conversationId]);

    // Clear search when leaving conversation
    useEffect(() => {
        setShowSearch(false);
        setSearchQuery('');
        setSearchResults([]);
        setSearchIndex(0);
        setReplyingTo(null);
        setEditingMessage(null);
    }, [conversationId]);

    const scrollToMessage = (id: string) => {
        const el = document.getElementById(`msg-${id}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Flash highlight
            el.classList.add('ring-2', 'ring-primary/60', 'ring-offset-1');
            setTimeout(() => el.classList.remove('ring-2', 'ring-primary/60', 'ring-offset-1'), 1500);
        }
    };

    const handleSearch = (query: string) => {
        setSearchQuery(query);
        if (!query.trim()) {
            setSearchResults([]);
            setSearchIndex(0);
            return;
        }
        const lower = query.toLowerCase();
        const found = messages
            .filter(m => !m.is_deleted && m.content?.toLowerCase().includes(lower))
            .map(m => m.id);
        setSearchResults(found);
        setSearchIndex(0);
        if (found.length > 0) scrollToMessage(found[0]);
    };

    const navigateSearch = (dir: 1 | -1) => {
        if (searchResults.length === 0) return;
        const newIdx = (searchIndex + dir + searchResults.length) % searchResults.length;
        setSearchIndex(newIdx);
        scrollToMessage(searchResults[newIdx]);
    };

    const getOtherParticipant = () => {
        if (!conversation || conversation.type === 'group') return null;
        return participants.find(p => p.user_id !== user?.id)?.profiles;
    };

    const getChatName = () => {
        return conversation?.type === 'group'
            ? conversation.name
            : getOtherParticipant()?.name || 'Chat';
    };

    const handleCall = async (type: 'voice' | 'video') => {
        if (!conversation || !user) return;

        const otherParticipants = participants.filter(p => p.user_id !== user.id);
        if (otherParticipants.length === 0) {
            toast.error("No one to call");
            return;
        }

        try {
            const allParticipantIds = participants.map(p => p.user_id);
            const primaryReceiver = otherParticipants[0];

            const { data, error } = await (supabase
                .from('chat_calls' as any) as any)
                .insert({
                    conversation_id: conversationId,
                    caller_id: user.id,
                    receiver_id: primaryReceiver.user_id,
                    type: type,
                    status: 'ringing',
                    metadata: conversation.type === 'group' ? {
                        is_group_call: true,
                        is_primary: true,
                        group_name: conversation.name,
                        participant_ids: allParticipantIds
                    } : undefined
                })
                .select()
                .single();

            if (error) throw error;
            const callData = data as any;

            if (otherParticipants.length > 1) {
                const additionalCalls = otherParticipants.slice(1).map((p: any) => ({
                    conversation_id: conversationId,
                    caller_id: user.id,
                    receiver_id: p.user_id,
                    type: type,
                    status: 'ringing',
                    metadata: {
                        is_group_call: true,
                        group_name: conversation.name,
                        primary_call_id: callData.id,
                        participant_ids: allParticipantIds
                    }
                }));
                await (supabase.from('chat_calls' as any) as any).insert(additionalCalls);
            }

            window.dispatchEvent(new CustomEvent('igo-call-start', {
                detail: {
                    id: callData.id,
                    type: type,
                    callerName: getChatName() || 'Unknown',
                    isInitiator: true,
                    receiverIds: otherParticipants.map((p: any) => p.user_id)
                }
            }));

            setTimeout(async () => {
                const { data: currentCall } = await (supabase
                    .from('chat_calls' as any) as any)
                    .select('status')
                    .eq('id', callData.id)
                    .single();

                if (currentCall?.status === 'ringing') {
                    await (supabase
                        .from('chat_calls' as any) as any)
                        .update({ status: 'missed' })
                        .eq('id', callData.id);
                    toast.error("Call missed - No answer");
                }
            }, 30000);
        } catch (error) {
            console.error('Failed to start call:', error);
            toast.error("Call failed to connect");
        }
    };

    const fetchConversationDetails = async () => {
        const { data } = await supabase
            .from('chat_conversations')
            .select('*')
            .eq('id', conversationId)
            .single();
        setConversation(data);
    };

    const fetchParticipants = async () => {
        const { data } = await supabase
            .from('chat_participants')
            .select(`
                *,
                profiles (
                    name,
                    role,
                    department
                )
            `)
            .eq('conversation_id', conversationId);

        if (data) setParticipants(data);
    };

    const subscribeToParticipants = () => {
        const channel = supabase
            .channel(`participants:${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'chat_participants',
                    filter: `conversation_id=eq.${conversationId}`
                },
                (payload) => {
                    setParticipants(prev => {
                        const index = prev.findIndex(p => p.user_id === payload.new.user_id);
                        if (index >= 0) {
                            const newParticipants = [...prev];
                            newParticipants[index] = { ...newParticipants[index], ...payload.new };
                            return newParticipants;
                        }
                        return [...prev, payload.new];
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    };

    const markAsRead = async () => {
        if (!user || !conversationId) return;

        const now = new Date().toISOString();
        await Promise.all([
            supabase
                .from('chat_participants')
                .update({ last_read_at: now })
                .eq('conversation_id', conversationId)
                .eq('user_id', user.id),
            supabase
                .from('chat_activity')
                .update({ is_read: true } as any)
                .eq('entity_id', conversationId)
                .eq('user_id', user.id)
                .eq('type', 'message')
        ]);
    };

    const getMessageStatus = (message: Message) => {
        if (message.sender_id !== user?.id) return null;

        const otherParticipants = participants.filter(p => p.user_id !== user.id);
        if (otherParticipants.length === 0) return 'sent';

        const allRead = otherParticipants.every(p => {
            return p.last_read_at && new Date(p.last_read_at) >= new Date(message.created_at);
        });

        return allRead ? 'read' : 'sent';
    };

    const MESSAGE_SELECT = `
        id,
        content,
        sender_id,
        created_at,
        type,
        media_url,
        metadata,
        is_deleted,
        is_edited,
        is_pinned,
        edited_at,
        reply_to_id,
        reply_to:chat_messages!chat_messages_reply_to_id_fkey (
            id,
            content,
            type,
            profiles ( name )
        ),
        profiles (
            name,
            role,
            department
        )
    `;

    const fetchMessages = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('chat_messages')
            .select(MESSAGE_SELECT)
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (!error && data) {
            setMessages(data as any);
            const msgIds = (data as any[]).map((m: any) => m.id);
            if (msgIds.length > 0) {
                const { data: rxData } = await (supabase
                    .from('chat_message_reactions') as any)
                    .select('id, emoji, user_id, message_id, profiles(name)')
                    .in('message_id', msgIds);
                if (rxData) {
                    const grouped: Record<string, Reaction[]> = {};
                    (rxData as any[]).forEach((r: any) => {
                        if (!grouped[r.message_id]) grouped[r.message_id] = [];
                        grouped[r.message_id].push(r);
                    });
                    setReactions(grouped);
                }
            }
        }
        setIsLoading(false);
    };

    const subscribeToMessages = () => {
        const channel = supabase
            .channel(`chat:${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: `conversation_id=eq.${conversationId}`
                },
                async (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newMessage = payload.new as any;
                        // Use messagesRef.current to check for duplicates with latest state
                        if (messagesRef.current.some(m => m.id === newMessage.id)) return;
                        fetchNewMessage(newMessage.id);
                        // Trigger debounced markAsRead via state change
                        // This ensures we don't call markAsRead multiple times
                    } else if (payload.eventType === 'UPDATE') {
                        const updated = payload.new as any;
                        setMessages(prev => prev.map(m =>
                            m.id === updated.id
                                ? { ...m, ...updated }
                                : m
                        ));
                    } else if (payload.eventType === 'DELETE') {
                        const deleted = payload.old as any;
                        if (deleted?.id) {
                            setMessages(prev => prev.filter(m => m.id !== deleted.id));
                        }
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR') {
                    console.error('RT Channel Error - attempting reconnection');
                    toast.error("Real-time connection lost. Reconnecting...");
                    // Attempt to reconnect after 2 seconds
                    setTimeout(() => {
                        supabase.removeChannel(channel);
                        subscriptionRef.current = subscribeToMessages();
                    }, 2000);
                }
            });

        subscriptionRef.current = channel;
        return () => {
            supabase.removeChannel(channel);
        };
    };

    const subscribeToPresence = () => {
        const channel = supabase.channel(`presence:${conversationId}`, {
            config: {
                presence: {
                    key: user?.id,
                },
            },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const typing: Record<string, boolean> = {};

                Object.entries(state).forEach(([key, presences]: [string, any]) => {
                    if (key !== user?.id) {
                        const isUserTyping = presences.some((p: any) => p.isTyping);
                        if (isUserTyping) typing[key] = true;
                    }
                });

                setIsTyping(typing);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ isTyping: false });
                }
            });

        presenceChannelRef.current = channel;

        return () => {
            // Ensure typing is cleared on unmount
            if (presenceChannelRef.current) {
                presenceChannelRef.current.track({ isTyping: false }).catch(() => {});
            }
            supabase.removeChannel(channel);
        };
    };

    const handleTyping = async () => {
        if (!presenceChannelRef.current || !user) return;

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        } else {
            await presenceChannelRef.current.track({ isTyping: true });
        }

        typingTimeoutRef.current = setTimeout(async () => {
            if (presenceChannelRef.current) {
                await presenceChannelRef.current.track({ isTyping: false });
            }
            typingTimeoutRef.current = undefined;
        }, 3000);
    };

    const fetchNewMessage = async (messageId: string) => {
        const { data, error } = await (supabase
            .from('chat_messages')
            .select(MESSAGE_SELECT)
            .eq('id', messageId)
            .single() as any);

        const fetchedMessage = data as any;

        if (fetchedMessage && !error) {
            setMessages(prev => {
                const filtered = prev.filter(m =>
                    !(m as any).isOptimistic ||
                    m.content !== fetchedMessage.content ||
                    m.sender_id !== fetchedMessage.sender_id
                );
                if (filtered.some(m => m.id === fetchedMessage.id)) return filtered;
                return [...filtered, fetchedMessage];
            });
        }
    };

    const handleSendMessageOptimistically = (content?: string, type?: string, mediaUrl?: string) => {
        if (!content || !user) return;

        const optimisticMessage: Message & { isOptimistic: boolean } = {
            id: `opt-${Date.now()}`,
            content: content,
            sender_id: user.id,
            created_at: new Date().toISOString(),
            type: (type as any) || 'text',
            media_url: mediaUrl || null,
            metadata: {},
            is_deleted: false,
            is_edited: false,
            is_pinned: false,
            reply_to_id: null,
            reply_to: null,
            isOptimistic: true,
            profiles: {
                name: user.name || 'Me',
                role: user.role || 'employee',
                department: null
            }
        };

        setMessages(prev => [...prev, optimisticMessage]);
    };

    const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
        if (!user) return;
        // Check if we already reacted with this emoji (including optimistic adds)
        const existing = reactions[messageId]?.find(r => r.user_id === user.id && r.emoji === emoji);
        if (existing) {
            // Remove reaction
            try {
                await (supabase.from('chat_message_reactions') as any).delete().eq('id', existing.id);
                setReactions(prev => ({
                    ...prev,
                    [messageId]: (prev[messageId] || []).filter(r => r.id !== existing.id),
                }));
            } catch (error) {
                console.error('Error removing reaction:', error);
                toast.error('Failed to remove reaction');
            }
        } else {
            // Add reaction with optimistic update
            const tempId = `temp-${Date.now()}`;
            setReactions(prev => ({
                ...prev,
                [messageId]: [...(prev[messageId] || []), {
                    id: tempId,
                    emoji,
                    user_id: user.id,
                    profiles: { name: user.name || 'Me' }
                } as Reaction],
            }));

            try {
                const { data } = await (supabase.from('chat_message_reactions') as any)
                    .insert({ message_id: messageId, user_id: user.id, emoji })
                    .select('id, emoji, user_id, message_id, profiles(name)')
                    .single();
                if (data) {
                    // Replace temp ID with real ID
                    setReactions(prev => ({
                        ...prev,
                        [messageId]: (prev[messageId] || []).map(r =>
                            r.id === tempId ? (data as Reaction) : r
                        ),
                    }));
                }
            } catch (error) {
                console.error('Error adding reaction:', error);
                // Remove optimistic reaction on error
                setReactions(prev => ({
                    ...prev,
                    [messageId]: (prev[messageId] || []).filter(r => r.id !== tempId),
                }));
                toast.error('Failed to add reaction');
            }
        }
    }, [user, reactions]);

    const handleTogglePin = async (messageId: string, currentlyPinned: boolean) => {
        await supabase
            .from('chat_messages')
            .update({ is_pinned: !currentlyPinned } as any)
            .eq('id', messageId);
        // Real-time UPDATE subscription will sync the state change automatically
    };

    const handleSubmitEdit = async (id: string, newContent: string) => {
        const original = messages.find(m => m.id === id);
        await supabase
            .from('chat_messages')
            .update({
                content: newContent,
                is_edited: true,
                edited_at: new Date().toISOString(),
                edited_content: original?.content ?? null,
            } as any)
            .eq('id', id);
        // Real-time UPDATE subscription handles UI update
    };
    const canDeleteConversation = isAdmin;

    const handleDeleteChat = async () => {
        if (!conversationId || !user) return;

        try {
            if (canDeleteConversation) {
                const chatNameStr = conversation?.type === 'group' ? conversation.name : 'this chat';
                const shouldDelete = confirm(`Delete "${chatNameStr}" for all members? This cannot be undone.`);
                if (!shouldDelete) return;

                const { error } = await supabase
                    .from('chat_conversations')
                    .delete()
                    .eq('id', conversationId);

                if (error) throw error;
                toast.success(conversation?.type === 'group' ? 'Group deleted' : 'Chat deleted');
                navigate('/chat');
                return;
            }

            if (conversation?.type === 'group') {
                const shouldLeave = confirm(`Leave "${conversation?.name || 'this group'}"?`);
                if (!shouldLeave) return;

                const { error } = await supabase
                    .from('chat_participants')
                    .delete()
                    .eq('conversation_id', conversationId)
                    .eq('user_id', user.id);

                if (error) throw error;

                toast.success('You left the group');
                navigate('/chat');
            }
        } catch (error) {
            console.error('Failed to process chat action:', error);
            toast.error('Failed to process chat action');
        }
    };

    const otherUserId = participants.find(p => p.user_id !== user?.id)?.user_id;
    const isOtherOnline = otherUserId ? onlineUsers.has(otherUserId) : false;

    const typingUsers = Object.keys(isTyping).filter(id => isTyping[id]);
    const typingMessage = typingUsers.length > 0
        ? (() => {
            const names = typingUsers.map(id => {
                const p = participants.find(pt => pt.user_id === id);
                return p?.profiles?.name?.split(' ')[0] || 'Someone';
            });
            if (names.length === 1) return `${names[0]} is typing...`;
            if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
            return `${names[0]} and ${names.length - 1} others are typing...`;
        })()
        : '';

    const chatName = getChatName();

    if (!conversationId) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-muted/20 text-muted-foreground p-8 text-center">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                    <MessageSquare className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-2">IGO Connect</h3>
                <p className="max-w-md text-sm leading-relaxed">
                    Select a conversation or start a new one to collaborate with your team across IGO Group.
                </p>
                <div className="mt-8 flex gap-3">
                    <NewChatDialog>
                        <Button className="bg-primary hover:bg-primary/90">New Chat</Button>
                    </NewChatDialog>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background relative shadow-2xl">
            {/* Header */}
            <div className="h-16 border-b border-border/50 bg-background/80 backdrop-blur-md flex items-center justify-between px-6 z-10 shadow-sm sticky top-0">
                {showSearch ? (
                    /* Search mode header */
                    <div className="flex items-center gap-2 flex-1">
                        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                        <Input
                            autoFocus
                            placeholder="Search messages..."
                            value={searchQuery}
                            onChange={e => handleSearch(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') navigateSearch(1);
                                if (e.key === 'Escape') { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }
                            }}
                            className="flex-1 h-8 text-sm border-0 bg-transparent focus-visible:ring-0 px-0"
                        />
                        {searchQuery && (
                            <div className="flex items-center gap-1 shrink-0">
                                <span className="text-xs text-muted-foreground min-w-[40px] text-right">
                                    {searchResults.length > 0 ? `${searchIndex + 1}/${searchResults.length}` : '0'}
                                </span>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigateSearch(-1)}>
                                    <ChevronUp className="w-3 h-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigateSearch(1)}>
                                    <ChevronDown className="w-3 h-3" />
                                </Button>
                            </div>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}>
                            <X className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                ) : (
                    /* Normal header */
                    <>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Avatar className="h-10 w-10 border border-primary/20 shadow-sm">
                                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                        {conversation?.type === 'group' ? 'GP' : chatName?.charAt(0)}
                                    </AvatarFallback>
                                </Avatar>
                                {isOtherOnline && (
                                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
                                )}
                            </div>
                            <div>
                                <h3 className="font-bold text-foreground text-base tracking-tight leading-tight">{chatName}</h3>
                                <div className="flex items-center gap-2">
                                    {Object.keys(isTyping).length > 0 ? (
                                        <span className="text-[10px] text-primary font-bold animate-pulse uppercase tracking-wider">
                                            {typingMessage}
                                        </span>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                                                {conversation?.type === 'group'
                                                    ? `${participants.length} members`
                                                    : isOtherOnline ? (
                                                        <span className="text-emerald-500">Online</span>
                                                    ) : (
                                                        <span className="text-muted-foreground">Offline</span>
                                                    )
                                                }
                                            </p>
                                            {!isOtherOnline && conversation?.type !== 'group' && conversation?.last_message_at && (
                                                <span className="text-[9px] text-muted-foreground/60 font-medium">
                                                    • Last seen {format(new Date(conversation.last_message_at), 'hh:mm a')}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/5" onClick={() => setShowSearch(true)}>
                                <Search className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/5" onClick={() => handleCall('voice')}>
                                <Phone className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/5" onClick={() => handleCall('video')}>
                                <Video className="w-4 h-4" />
                            </Button>
                            <div className="w-[1px] h-4 bg-border/50 mx-1" />
                            {(isAdmin || conversation?.type === 'group') && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/5">
                                            <MoreVertical className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                        {isAdmin && (
                                            <>
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive gap-2 cursor-pointer"
                                                    onClick={async () => {
                                                        if (!confirm('Clear all messages in this chat?')) return;
                                                        await supabase.from('chat_messages').delete().eq('conversation_id', conversationId);
                                                        setMessages([]);
                                                        toast.success('Chat cleared');
                                                    }}
                                                >
                                                    <Eraser className="w-4 h-4" /> Clear Chat
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                            </>
                                        )}
                                        {(isAdmin || conversation?.type === 'group') && (
                                            <DropdownMenuItem
                                                className="text-destructive focus:text-destructive gap-2 cursor-pointer"
                                                onClick={handleDeleteChat}
                                            >
                                                <Trash2 className="w-4 h-4" /> {isAdmin ? (conversation?.type === 'group' ? 'Delete Group' : 'Delete Chat') : 'Leave Group'}
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Pinned messages bar */}
            {pinnedMessages.length > 0 && (
                <div
                    className="border-b border-primary/20 bg-primary/5 cursor-pointer"
                    onClick={() => setShowPinnedPanel(prev => !prev)}
                >
                    <div className="flex items-center gap-2 px-6 py-2">
                        <Pin className="w-3 h-3 text-primary shrink-0" />
                        <span className="text-xs font-bold text-primary flex-1 truncate">
                            {pinnedMessages.length === 1
                                ? pinnedMessages[0].content?.slice(0, 60) || 'Pinned message'
                                : `${pinnedMessages.length} pinned messages`}
                        </span>
                        {showPinnedPanel
                            ? <ChevronUp className="w-3 h-3 text-muted-foreground" />
                            : <ChevronDown className="w-3 h-3 text-muted-foreground" />
                        }
                    </div>
                    {showPinnedPanel && (
                        <div className="px-6 pb-3 space-y-1.5 max-h-40 overflow-y-auto">
                            {pinnedMessages.map(pm => (
                                <div
                                    key={pm.id}
                                    className="flex items-start justify-between gap-2 bg-background/60 rounded-lg px-3 py-2 group"
                                    onClick={e => { e.stopPropagation(); scrollToMessage(pm.id); setShowPinnedPanel(false); }}
                                >
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[10px] font-bold text-primary">{pm.profiles?.name}</span>
                                        <p className="text-xs text-muted-foreground truncate">{pm.content}</p>
                                    </div>
                                    {(pm.sender_id === user?.id || isAdmin) && (
                                        <button
                                            aria-label="Unpin message"
                                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                            onClick={e => { e.stopPropagation(); handleTogglePin(pm.id, true); }}
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Messages */}
            <ScrollArea className="flex-1 p-6">
                <div className="space-y-8 max-w-5xl mx-auto">
                    {messages.map((msg, index) => {
                        const isMe = msg.sender_id === user?.id;
                        const showAvatar = !isMe && (index === 0 || messages[index - 1].sender_id !== msg.sender_id);
                        const isSearchMatch = searchResults.includes(msg.id);
                        const isCurrentSearchResult = searchResults[searchIndex] === msg.id;

                        // System messages (call bubbles)
                        if (msg.type === 'system') {
                            return (
                                <div key={msg.id} id={`msg-${msg.id}`} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
                                    <CallMessageBubble
                                        content={msg.content}
                                        createdAt={msg.created_at}
                                        isMe={isMe}
                                        onCallBack={conversation?.type !== 'group'
                                            ? () => handleCall(msg.content?.toLowerCase().includes('video') ? 'video' : 'voice')
                                            : undefined}
                                    />
                                </div>
                            );
                        }

                        // Soft-deleted messages
                        if (msg.is_deleted) {
                            return (
                                <div key={msg.id} id={`msg-${msg.id}`} className={cn(
                                    "flex animate-in fade-in duration-200",
                                    isMe ? "justify-end" : "justify-start"
                                )}>
                                    <div className="px-4 py-2 rounded-xl bg-muted/20 border border-border/30 max-w-[70%]">
                                        <p className="text-xs text-muted-foreground italic flex items-center gap-1.5">
                                            <Trash2 className="w-3 h-3" />
                                            {msg.metadata?.deleted_by_name
                                                ? `Removed by ${msg.metadata.deleted_by_name}${msg.metadata.delete_reason ? ` · ${msg.metadata.delete_reason}` : ''}`
                                                : 'This message was removed'
                                            }
                                        </p>
                                        <span className="text-[9px] text-muted-foreground/50">{format(new Date(msg.created_at), 'hh:mm a')}</span>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div
                                key={msg.id}
                                id={`msg-${msg.id}`}
                                className={cn(
                                    "flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300 rounded-lg transition-all",
                                    isMe ? "items-end" : "items-start",
                                    isCurrentSearchResult && "ring-2 ring-primary/60 ring-offset-1",
                                    isSearchMatch && !isCurrentSearchResult && "ring-1 ring-primary/25"
                                )}
                            >
                                {!isMe && showAvatar && (
                                    <div className="flex items-center gap-2 mb-1 px-1">
                                        <span className="text-xs font-bold text-foreground/80">{msg.profiles?.name}</span>
                                        <span className="text-[10px] text-muted-foreground font-medium">• {format(new Date(msg.created_at), 'hh:mm a')}</span>
                                    </div>
                                )}

                                <MessageContextMenu
                                    messageId={msg.id}
                                    messageContent={msg.content || ''}
                                    messageSenderId={msg.sender_id}
                                    messageCreatedAt={msg.created_at}
                                    messageType={msg.type}
                                    conversationId={conversationId || ''}
                                    isPinned={msg.is_pinned ?? false}
                                    onReact={(emoji) => toggleReaction(msg.id, emoji)}
                                    onDeleted={fetchMessages}
                                    onReply={() => setReplyingTo(msg)}
                                    onEdit={() => setEditingMessage({ id: msg.id, content: msg.content || '' })}
                                    onPin={() => handleTogglePin(msg.id, msg.is_pinned ?? false)}
                                >
                                    <div className={cn(
                                        "flex gap-3 max-w-[85%] group",
                                        isMe ? "flex-row-reverse" : "flex-row"
                                    )}>
                                        {!isMe && (
                                            <div className="w-8 flex-shrink-0">
                                                {showAvatar ? (
                                                    <Avatar className="w-8 h-8 border border-primary/10 shadow-sm">
                                                        <AvatarFallback className="text-[10px] font-bold bg-primary/5 text-primary">
                                                            {msg.profiles?.name?.[0]}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                ) : <div className="w-8" />}
                                            </div>
                                        )}

                                        <div className="flex flex-col gap-1">
                                            <div
                                                className={cn(
                                                    "relative px-4 py-3 rounded-xl shadow-sm transition-all duration-200 border",
                                                    isMe
                                                        ? "bg-primary text-primary-foreground border-primary rounded-tr-none"
                                                        : "bg-muted/40 border-border/50 text-foreground rounded-tl-none group-hover:bg-muted/60"
                                                )}
                                                onDoubleClick={() => toggleReaction(msg.id, '👍')}
                                            >
                                                {/* Pin indicator */}
                                                {msg.is_pinned && (
                                                    <Pin className={cn(
                                                        "w-2.5 h-2.5 absolute top-1.5 right-1.5",
                                                        isMe ? "text-primary-foreground/50" : "text-primary/50"
                                                    )} />
                                                )}

                                                {/* Reply quote bubble */}
                                                {msg.reply_to && (
                                                    <div
                                                        className={cn(
                                                            "mb-2 px-3 py-2 rounded-lg border-l-2 cursor-pointer",
                                                            isMe
                                                                ? "border-primary-foreground/40 bg-white/10"
                                                                : "border-primary/60 bg-primary/5"
                                                        )}
                                                        onClick={() => scrollToMessage(msg.reply_to!.id)}
                                                    >
                                                        <p className={cn(
                                                            "text-[10px] font-bold",
                                                            isMe ? "text-primary-foreground/80" : "text-primary"
                                                        )}>
                                                            {(msg.reply_to as any).profiles?.name || 'Unknown'}
                                                        </p>
                                                        <p className={cn(
                                                            "text-xs truncate",
                                                            isMe ? "text-primary-foreground/60" : "text-muted-foreground"
                                                        )}>
                                                            {msg.reply_to.content || '📎 Attachment'}
                                                        </p>
                                                    </div>
                                                )}

                                                {msg.type === 'text' && (
                                                    <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">{msg.content}</p>
                                                )}

                                                {msg.type === 'image' && msg.media_url && (
                                                    <div className="mb-1 rounded-lg overflow-hidden border border-border/50 shadow-inner">
                                                        <img
                                                            src={msg.media_url}
                                                            alt="Image"
                                                            className="max-w-full max-h-[400px] object-cover hover:scale-[1.01] transition-transform cursor-pointer"
                                                            onClick={() => window.open(msg.media_url!, '_blank')}
                                                        />
                                                    </div>
                                                )}

                                                {msg.type === 'audio' && msg.media_url && (
                                                    <VoiceMessagePlayer
                                                        mediaUrl={msg.media_url}
                                                        duration={msg.metadata?.duration || 0}
                                                        isMe={isMe}
                                                    />
                                                )}

                                                {msg.type === 'file' && (
                                                    <a
                                                        href={msg.media_url || '#'}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={cn(
                                                            "flex items-center gap-3 p-3 rounded-lg border transition-all",
                                                            isMe
                                                                ? "bg-white/10 border-white/20 hover:bg-white/20"
                                                                : "bg-background border-border hover:border-primary/30"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "p-2 rounded-md shadow-sm",
                                                            isMe ? "bg-white/20" : "bg-primary/10 text-primary"
                                                        )}>
                                                            <FileIcon className="w-5 h-5" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-bold truncate">{msg.content}</p>
                                                            <p className={cn(
                                                                "text-[9px] font-bold uppercase mt-0.5",
                                                                isMe ? "text-white/60" : "text-muted-foreground"
                                                            )}>
                                                                {msg.metadata?.mime_type?.split('/').pop() || 'DOCUMENT'}
                                                            </p>
                                                        </div>
                                                    </a>
                                                )}
                                            </div>

                                            {/* Reactions */}
                                            <MessageReactions
                                                messageId={msg.id}
                                                reactions={reactions[msg.id] || []}
                                                onToggleReaction={(emoji) => toggleReaction(msg.id, emoji)}
                                            />

                                            <div className={cn(
                                                "flex items-center gap-1.5 px-1",
                                                isMe ? "justify-end" : "justify-start"
                                            )}>
                                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">
                                                    {format(new Date(msg.created_at), 'hh:mm a')}
                                                </span>
                                                {msg.is_edited && (
                                                    <span className="text-[9px] text-muted-foreground/60 italic">edited</span>
                                                )}
                                                {isMe && (
                                                    <span className={cn(
                                                        "transition-colors duration-300",
                                                        getMessageStatus(msg) === 'read' ? "text-primary" : "text-muted-foreground/50"
                                                    )}>
                                                        <div className="flex -space-x-1.5">
                                                            <Check className="w-3 h-3" />
                                                            <Check className="w-3 h-3" />
                                                        </div>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </MessageContextMenu>
                            </div>
                        );
                    })}
                    <div ref={scrollRef} className="h-4" />
                </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t border-border/50 bg-background/80 backdrop-blur-md sticky bottom-0 z-10">
                <div className="max-w-5xl mx-auto">
                    <ChatInput
                        conversationId={conversationId}
                        currentUserId={user?.id || ''}
                        onSendMessage={handleSendMessageOptimistically}
                        onTyping={handleTyping}
                        replyingTo={replyingTo ? {
                            id: replyingTo.id,
                            content: replyingTo.content,
                            sender_name: replyingTo.profiles?.name || null,
                        } : null}
                        onCancelReply={() => setReplyingTo(null)}
                        editingMessage={editingMessage}
                        onCancelEdit={() => setEditingMessage(null)}
                        onSubmitEdit={handleSubmitEdit}
                    />
                </div>
            </div>
        </div>
    );
};
