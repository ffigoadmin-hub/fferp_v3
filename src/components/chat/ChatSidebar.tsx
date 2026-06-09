import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Search, MessageSquare, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { NewChatDialog } from "./NewChatDialog";
import { useChat } from "./ChatLayout";

type ParticipantProfile = {
    name: string | null;
};

type ChatParticipant = {
    user_id: string;
    last_read_at: string | null;
    profiles: ParticipantProfile | null;
};

type Conversation = {
    id: string;
    name: string | null;
    type: 'direct' | 'group';
    last_message_at: string | null;
    avatar_url: string | null;
    chat_participants: ChatParticipant[]; // Renamed from 'participants' to match the query and new helpers
};

export const ChatSidebar = () => {
    const { onlineUsers } = useChat();
    const navigate = useNavigate();
    const { conversationId } = useParams();
    const { user } = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

    useEffect(() => {
        if (!user) return;

        let timeout: NodeJS.Timeout | null = null;
        const debouncedFetch = () => {
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => {
                fetchConversations();
            }, 100); // Reduced debounce for faster updates
        };

        debouncedFetch(); // Initial fetch

        // Subscribe to all relevant tables for real-time updates
        const channel = supabase
            .channel('chat_sidebar_sync')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'chat_conversations' },
                debouncedFetch
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'chat_participants' },
                debouncedFetch
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'chat_activity' },
                debouncedFetch
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'chat_messages' },
                debouncedFetch
            )
            .subscribe((status) => {
                console.log('[ChatSidebar] Subscription status:', status);
            });

        // Refresh on window focus to ensure counts are up to date
        const handleFocus = () => {
            debouncedFetch();
        };
        window.addEventListener('focus', handleFocus);

        return () => {
            if (timeout) clearTimeout(timeout);
            window.removeEventListener('focus', handleFocus);
            supabase.removeChannel(channel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const fetchConversations = async () => {
        if (!user?.id) return;

        try {
            const { data: myParticipations, error: partError } = await supabase
                .from('chat_participants')
                .select('conversation_id')
                .eq('user_id', user.id);

            if (partError) throw partError;
            if (!myParticipations || myParticipations.length === 0) {
                setConversations([]);
                setIsLoading(false);
                return;
            }

            const conversationIds = myParticipations.map(p => p.conversation_id);

            const { data, error } = await supabase
                .from('chat_conversations')
                .select(`
                    id,
                    name,
                    type,
                    last_message_at,
                    avatar_url,
                    chat_participants (
                        user_id,
                        last_read_at,
                        profiles (
                            name
                        )
                    )
                `)
                .in('id', conversationIds)
                .order('last_message_at', { ascending: false });

            if (error) throw error;
            setConversations(data as any as Conversation[]);

            // Fetch unread message counts
            const { data: activityData, error: activityError } = await supabase
                .from('chat_activity')
                .select('entity_id')
                .eq('user_id', user.id)
                .eq('is_read', false)
                .eq('type', 'message');

            if (!activityError && activityData) {
                const counts: Record<string, number> = {};
                activityData.forEach(act => {
                    counts[act.entity_id] = (counts[act.entity_id] || 0) + 1;
                });
                setUnreadCounts(counts);
            }

        } catch (error) {
            console.error('Error fetching conversations:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Helper to get other participant
    const getOtherParticipant = (conversation: Conversation) => {
        if (conversation.type === 'group') return null;
        return conversation.chat_participants.find((p: ChatParticipant) => p.user_id !== user?.id)?.profiles;
    };

    const getConversationName = (conv: Conversation) => {
        if (conv.type === 'group') return conv.name || 'Group Chat';

        const otherParticipant = getOtherParticipant(conv);
        if (!otherParticipant) return 'Unknown User';

        return otherParticipant.name || 'Unknown User';
    };

    const isOnline = (conversation: Conversation) => {
        if (conversation.type === 'group') return false;
        const other = conversation.chat_participants.find((p: ChatParticipant) => p.user_id !== user?.id);
        return other && onlineUsers.has(other.user_id);
    };

    const getUnreadCount = (conversation: Conversation) => {
        return unreadCounts[conversation.id] || 0;
    };

    const filteredConversations = conversations.filter(conv =>
        getConversationName(conv).toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="w-80 border-r border-border/50 flex flex-col h-full bg-background shadow-sm">
            {/* Header */}
            <div className="p-4 border-b border-border/50 flex flex-col gap-4 bg-muted/20">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold tracking-tight">Chat</h2>
                    <NewChatDialog>
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-primary/10 hover:bg-primary/20 transition-all">
                            <Plus className="h-4 w-4 text-primary" />
                        </Button>
                    </NewChatDialog>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search chats..."
                        className="pl-9 bg-muted/30 border-none h-9 text-sm focus-visible:ring-1 focus-visible:ring-primary/20"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Conversations List */}
            <ScrollArea className="flex-1">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full p-12 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                        <span className="text-sm font-medium">Loading chats...</span>
                    </div>
                ) : (
                    <div className="p-2 space-y-0.5">
                        {filteredConversations.map((conversation) => {
                            const online = isOnline(conversation);
                            const unreadCount = getUnreadCount(conversation);
                            const isActive = conversationId === conversation.id;

                            return (
                                <div
                                    key={conversation.id}
                                    onClick={() => navigate(`/chat/${conversation.id}`)}
                                    className={cn(
                                        "group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 border border-transparent",
                                        isActive
                                            ? "bg-primary/10 border-primary/20 shadow-sm"
                                            : "hover:bg-muted/60"
                                    )}
                                >
                                    <div className="relative">
                                        <Avatar className={cn(
                                            "h-11 w-11 border-2 border-background shadow-sm group-hover:scale-105 transition-transform",
                                            isActive && "border-primary/20"
                                        )}>
                                            <AvatarImage src={conversation.avatar_url || undefined} />
                                            <AvatarFallback className={cn(
                                                "bg-muted text-muted-foreground font-bold text-sm",
                                                isActive && "bg-primary/20 text-primary"
                                            )}>
                                                {conversation.type === 'group' ? 'GP' : getConversationName(conversation).charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                        {online && (
                                            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-[2.5px] border-background rounded-full shadow-sm"></span>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-0.5">
                                            <h3 className={cn(
                                                "text-sm truncate transition-colors",
                                                isActive ? "text-primary font-bold" : unreadCount > 0 ? "text-foreground font-bold" : "text-foreground font-semibold"
                                            )}>
                                                {getConversationName(conversation)}
                                            </h3>
                                            {conversation.last_message_at && (
                                                <span className={cn(
                                                    "text-[10px] font-medium shrink-0 ml-2",
                                                    unreadCount > 0 && !isActive ? "text-primary font-bold" : "text-muted-foreground"
                                                )}>
                                                    {format(new Date(conversation.last_message_at), 'hh:mm a')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between gap-1">
                                            <p className={cn(
                                                "text-[11px] truncate leading-relaxed",
                                                unreadCount > 0 && !isActive ? "text-foreground font-bold" : "text-muted-foreground"
                                            )}>
                                                {unreadCount > 0 && !isActive ? "New messages" : "Click to view conversation"}
                                            </p>
                                            {unreadCount > 0 && !isActive && (
                                                <div className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shrink-0 shadow-sm">
                                                    {unreadCount > 99 ? '99+' : unreadCount}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {isActive && (
                                        <div className="w-1 h-6 bg-primary rounded-full ml-1 shrink-0" />
                                    )}
                                </div>
                            );
                        })}
                        {filteredConversations.length === 0 && !isLoading && (
                            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                                <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
                                <h3 className="text-sm font-semibold text-foreground">No conversations</h3>
                                <p className="text-xs mt-1">Start a new chat to begin.</p>
                            </div>
                        )}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
};
