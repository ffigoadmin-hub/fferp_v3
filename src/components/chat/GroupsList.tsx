import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NewChatDialog } from "./NewChatDialog";
import { Search, Plus, Users, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type Group = {
    id: string;
    name: string | null;
    avatar_url: string | null;
    last_message_at: string | null;
    _participantCount?: number;
    _isMember?: boolean;
};

export const GroupsList = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [groups, setGroups] = useState<Group[]>([]);
    const [search, setSearch] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    const isAdmin = user?.role === 'admin';

    useEffect(() => {
        fetchGroups();

        const channel = supabase
            .channel('groups-list-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_conversations' }, fetchGroups)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_participants' }, fetchGroups)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user?.id]);

    const fetchGroups = async () => {
        if (!user) return;
        setIsLoading(true);

        // Fetch all group conversations
        const { data: allGroups } = await supabase
            .from('chat_conversations')
            .select(`id, name, avatar_url, last_message_at, chat_participants(user_id)`)
            .eq('type', 'group')
            .order('last_message_at', { ascending: false, nullsFirst: false });

        if (allGroups) {
            const enriched = allGroups.map((g: any) => ({
                id: g.id,
                name: g.name,
                avatar_url: g.avatar_url,
                last_message_at: g.last_message_at,
                _participantCount: g.chat_participants?.length || 0,
                _isMember: g.chat_participants?.some((p: any) => p.user_id === user.id),
            }));
            setGroups(enriched);
        }

        setIsLoading(false);
    };

    const joinGroup = async (groupId: string) => {
        if (!user) return;
        await supabase.from('chat_participants').insert({
            conversation_id: groupId,
            user_id: user.id,
        });
        navigate(`/chat/${groupId}`);
    };

    const filtered = groups.filter(g =>
        (g.name || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-background border-r border-border/50 w-80">
            <div className="p-4 border-b border-border/50 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold tracking-tight">Groups</h2>
                    {isAdmin && (
                        <NewChatDialog defaultGroupMode>
                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-primary/10 hover:bg-primary/20 transition-all" title="Create Group">
                                <Plus className="h-4 w-4 text-primary" />
                            </Button>
                        </NewChatDialog>
                    )}
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        placeholder="Search groups..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9 h-8 text-sm bg-muted/30"
                    />
                </div>
            </div>

            <ScrollArea className="flex-1">
                {isLoading ? (
                    <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Loading...</div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 p-6 text-center text-muted-foreground gap-3">
                        <Users className="h-8 w-8 opacity-40" />
                        <p className="text-sm">No groups yet.{isAdmin ? ' Create one with +.' : ''}</p>
                    </div>
                ) : (
                    <div className="p-2 space-y-1">
                        {filtered.map(group => (
                            <button
                                key={group.id}
                                onClick={() => group._isMember ? navigate(`/chat/${group.id}`) : joinGroup(group.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200 group",
                                    "hover:bg-muted/60"
                                )}
                            >
                                <Avatar className="h-10 w-10 rounded-xl border border-primary/20 flex-shrink-0">
                                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm rounded-xl">
                                        {(group.name || 'G').slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className="font-semibold text-sm truncate">{group.name || 'Unnamed Group'}</p>
                                        {!group._isMember && <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {group._participantCount} member{group._participantCount !== 1 ? 's' : ''}
                                        {group.last_message_at && ` · ${format(new Date(group.last_message_at), 'MMM d')}`}
                                    </p>
                                </div>
                                {!group._isMember && (
                                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full flex-shrink-0">JOIN</span>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
};
