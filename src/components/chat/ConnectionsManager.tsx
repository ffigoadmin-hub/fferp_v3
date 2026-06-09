import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
    UserPlus,
    UserCheck,
    UserX,
    Search,
    Loader2,
    Check,
    X,
    MessageSquare,
    Users
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

type Connection = {
    id: string;
    status: 'pending' | 'accepted' | 'rejected' | 'blocked';
    sender_id: string;
    receiver_id: string;
    profiles: {
        id: string;
        name: string | null;
        role: string | null;
        department: string | null;
    } | null;
};

export const ConnectionsManager = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [connections, setConnections] = useState<Connection[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        if (!user) return;
        fetchConnections();
    }, [user]);

    const fetchConnections = async () => {
        setLoading(true);
        try {
            const { data, error } = await (supabase
                .from('chat_connections') as any)
                .select(`
                    *,
                    sender:profiles!chat_connections_sender_id_fkey (id, name, role, department),
                    receiver:profiles!chat_connections_receiver_id_fkey (id, name, role, department)
                `)
                .or(`sender_id.eq.${user?.id},receiver_id.eq.${user?.id}`);

            if (error) throw error;

            const formatted: Connection[] = (data || []).map((conn: any) => {
                const isSender = conn.sender_id === user?.id;
                return {
                    ...conn,
                    profiles: isSender ? conn.receiver : conn.sender
                };
            });

            setConnections(formatted);
        } catch (error) {
            console.error('Error fetching connections:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (id: string, status: string) => {
        try {
            const { error } = await (supabase
                .from('chat_connections') as any)
                .update({ status })
                .eq('id', id);

            if (error) throw error;
            toast.success(`Connection ${status}`);
            fetchConnections();
        } catch (error) {
            toast.error("Action failed");
        }
    };

    const handleDeleteConnection = async (id: string) => {
        try {
            const { error } = await (supabase
                .from('chat_connections') as any)
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success("Request cancelled");
            fetchConnections();
        } catch (error) {
            toast.error("Failed to cancel request");
        }
    };

    const startChat = async (profileId: string) => {
        // Logic to start/navigate to chat
        toast.info("Opening chat...");
        // This would reuse the startChat logic from EmployeeList
    };

    const pendingIncoming = connections.filter(c => c.status === 'pending' && c.receiver_id === user?.id);
    const pendingOutgoing = connections.filter(c => c.status === 'pending' && c.sender_id === user?.id);
    const accepted = connections.filter(c => c.status === 'accepted');

    return (
        <div className="flex flex-col h-full bg-background border-r border-border/50 w-80">
            <div className="p-4 border-b border-border/50 space-y-4">
                <h2 className="text-xl font-bold tracking-tight">Teams</h2>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search connections..."
                        className="pl-9 bg-muted/30 border-none h-9 text-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <Tabs defaultValue="accepted" className="flex-1 flex flex-col min-h-0">
                <TabsList className="grid grid-cols-2 mx-2 mt-2 bg-muted/50">
                    <TabsTrigger value="accepted" className="text-xs font-bold uppercase tracking-wider">My Team</TabsTrigger>
                    <TabsTrigger value="pending" className="text-xs font-bold uppercase tracking-wider relative">
                        Requests
                        {pendingIncoming.length > 0 && (
                            <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                                {pendingIncoming.length}
                            </span>
                        )}
                    </TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1 mt-2">
                    <TabsContent value="accepted" className="m-0 p-2 space-y-1">
                        {accepted.map(conn => (
                            <div key={conn.id} className="group flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer border border-transparent hover:border-border/50 transition-all">
                                <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                                    <AvatarFallback className="bg-primary/5 text-primary font-bold">
                                        {conn.profiles?.name?.[0]}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-bold truncate">{conn.profiles?.name}</h4>
                                    <p className="text-[10px] text-muted-foreground font-medium uppercase truncate">
                                        {conn.profiles?.role}
                                    </p>
                                </div>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                    <MessageSquare className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                        {accepted.length === 0 && !loading && (
                            <div className="p-8 text-center text-muted-foreground">
                                <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                <p className="text-sm font-medium">No team members yet</p>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="pending" className="m-0 p-2 space-y-4">
                        {pendingIncoming.length > 0 && (
                            <div className="space-y-1">
                                <h3 className="px-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Incoming</h3>
                                {pendingIncoming.map(conn => (
                                    <div key={conn.id} className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                                        <div className="flex items-center gap-3 mb-3">
                                            <Avatar className="h-9 w-9">
                                                <AvatarFallback className="font-bold">{conn.profiles?.name?.[0]}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-bold truncate">{conn.profiles?.name}</h4>
                                                <p className="text-[10px] text-muted-foreground font-medium truncate">{conn.profiles?.department}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button size="sm" className="flex-1 h-8 bg-primary text-xs font-bold" onClick={() => handleAction(conn.id, 'accepted')}>
                                                Accept
                                            </Button>
                                            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs font-bold" onClick={() => handleAction(conn.id, 'rejected')}>
                                                Decline
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {pendingOutgoing.length > 0 && (
                            <div className="space-y-1">
                                <h3 className="px-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Sent Requests</h3>
                                {pendingOutgoing.map(conn => (
                                    <div key={conn.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30">
                                        <Avatar className="h-8 w-8">
                                            <AvatarFallback>{conn.profiles?.name?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-xs font-bold truncate">{conn.profiles?.name}</h4>
                                            <p className="text-[9px] text-muted-foreground font-medium uppercase">Pending response</p>
                                        </div>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                            onClick={() => handleDeleteConnection(conn.id)}
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {pendingIncoming.length === 0 && pendingOutgoing.length === 0 && !loading && (
                            <div className="p-8 text-center text-muted-foreground">
                                <p className="text-sm font-medium">No pending requests</p>
                            </div>
                        )}
                    </TabsContent>
                </ScrollArea>
            </Tabs>
        </div>
    );
};
