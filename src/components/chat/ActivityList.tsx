import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { 
    Bell, 
    MessageSquare, 
    UserPlus, 
    CheckCircle2, 
    Clock,
    Loader2,
    Trash2
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

type Activity = {
    id: string;
    type: 'message' | 'connection_request' | 'connection_accepted' | 'group_invite';
    content: string;
    created_at: string;
    is_read: boolean;
    entity_id: string;
    actor_id: string;
    profiles: {
        name: string | null;
        office_number: string | null;
    } | null;
};

export const ActivityList = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        fetchActivity();

        const channel = supabase
            .channel('chat_activity')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_activity',
                    filter: `user_id=eq.${user.id}`
                },
                () => {
                    fetchActivity();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const fetchActivity = async () => {
        try {
            const { data, error } = await (supabase
                .from('chat_activity') as any)
                .select(`
                    *,
                    profiles:actor_id (
                        name,
                        office_number
                    )
                `)
                .eq('user_id', user?.id)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;
            setActivities(data as any);
        } catch (error) {
            console.error('Error fetching activity:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleActivityClick = async (activity: Activity) => {
        // Update state optimistically
        setActivities(prev => prev.map(a =>
            a.id === activity.id ? { ...a, is_read: true } : a
        ));

        // Mark as read in database (fire and forget with error handling)
        supabase
            .from('chat_activity')
            .update({ is_read: true })
            .eq('id', activity.id)
            .then(({ error }) => {
                if (error) {
                    console.error('Error marking activity as read:', error);
                    // Revert optimistic update on error
                    setActivities(prev => prev.map(a =>
                        a.id === activity.id ? { ...a, is_read: false } : a
                    ));
                }
            });

        // Navigate based on activity type
        if (activity.type === 'message') {
            navigate(`/chat/${activity.entity_id}`);
        } else if (activity.type.startsWith('connection')) {
            toast.info("Navigate to People to manage connections");
        }
    };

    const getActivityIcon = (type: string) => {
        switch (type) {
            case 'message': return <MessageSquare className="h-4 w-4 text-primary" />;
            case 'connection_request': return <UserPlus className="h-4 w-4 text-amber-500" />;
            case 'connection_accepted': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
            default: return <Bell className="h-4 w-4 text-muted-foreground" />;
        }
    };

    return (
        <div className="flex flex-col h-full bg-background border-r border-border/50 w-80">
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-tight">Activity</h2>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={fetchActivity}>
                    <Clock className="h-4 w-4" />
                </Button>
            </div>

            <ScrollArea className="flex-1">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full p-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="p-2 space-y-1">
                        {activities.map((activity) => (
                            <div 
                                key={activity.id}
                                className={cn(
                                    "group flex gap-3 p-3 rounded-lg cursor-pointer transition-all border border-transparent",
                                    activity.is_read ? "hover:bg-muted/50" : "bg-primary/5 border-primary/10 hover:bg-primary/10 shadow-sm"
                                )}
                                onClick={() => handleActivityClick(activity)}
                            >
                                <div className="relative shrink-0">
                                    <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                                        <AvatarFallback className="bg-muted text-muted-foreground font-bold">
                                            {activity.profiles?.name?.[0]?.toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1 shadow-sm border border-border/50">
                                        {getActivityIcon(activity.type)}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <p className={cn(
                                            "text-sm leading-tight mb-1",
                                            !activity.is_read ? "font-bold text-foreground" : "font-medium text-muted-foreground"
                                        )}>
                                            <span className="text-foreground">{activity.profiles?.name}</span> {activity.content}
                                        </p>
                                    </div>
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                        {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                                    </span>
                                </div>
                                {!activity.is_read && (
                                    <div className="w-2 h-2 bg-primary rounded-full mt-2 shrink-0 animate-pulse" />
                                )}
                            </div>
                        ))}
                        
                        {activities.length === 0 && (
                            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                                <Bell className="h-12 w-12 text-muted-foreground/30 mb-4" />
                                <h3 className="text-sm font-semibold text-foreground">No recent activity</h3>
                                <p className="text-xs mt-1">You're all caught up!</p>
                            </div>
                        )}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
};
