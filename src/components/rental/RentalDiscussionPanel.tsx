import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, MessageSquare, Loader2, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";

interface RentalDiscussionPanelProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    recordId: string;
    contextTitle?: string;
}

export function RentalDiscussionPanel({ open, onOpenChange, recordId, contextTitle }: RentalDiscussionPanelProps) {
    const queryClient = useQueryClient();
    const [message, setMessage] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Fetch user profile for avatar
    const { data: userProfile } = useQuery({
        queryKey: ['user-profile'],
        queryFn: async () => {
            const { data } = await supabase.auth.getUser();
            if (!data.user) return null;
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
            return profile;
        }
    });

    // Fetch messages
    const { data: messages, isLoading } = useQuery({
        queryKey: ['rental-discussions', recordId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('rental_discussions')
                .select(`
                    *,
                    profiles:user_id (first_name, last_name, role, department)
                `)
                .eq('record_id', recordId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return data;
        },
        enabled: open
    });

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, open]);

    const sendMessageMutation = useMutation({
        mutationFn: async () => {
            const { data: session } = await supabase.auth.getSession();
            if (!session.session) throw new Error("Not authenticated");

            const { error } = await supabase.from('rental_discussions').insert({
                record_id: recordId,
                message: message,
                user_id: session.session.user.id
            } as any);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rental-discussions', recordId] });
            setMessage('');
        }
    });

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-md w-full flex flex-col h-full p-0">
                <SheetHeader className="p-4 border-b">
                    <SheetTitle className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-primary" /> Discussion
                    </SheetTitle>
                    <SheetDescription className="truncate">
                        {contextTitle || 'Rental Record Discussion'}
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-hidden relative bg-muted/10">
                    <ScrollArea className="h-full p-4">
                        {isLoading ? (
                            <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                        ) : messages?.length === 0 ? (
                            <div className="text-center text-muted-foreground py-10 text-sm">
                                No messages yet. Start the discussion!
                            </div>
                        ) : (
                            <div className="space-y-4 pb-4">
                                {messages?.map((msg: any) => {
                                    const isMe = msg.user_id === (userProfile as any)?.id;
                                    return (
                                        <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                                            <Avatar className="w-8 h-8 border">
                                                <AvatarFallback className="text-xs bg-muted">
                                                    {msg.profiles?.first_name?.[0]}{msg.profiles?.last_name?.[0]}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-bold text-foreground">
                                                        {msg.profiles?.first_name} {msg.profiles?.last_name}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground uppercase px-1.5 py-0.5 rounded bg-muted">
                                                        {msg.profiles?.role}
                                                    </span>
                                                </div>
                                                <div className={`p-3 rounded-xl text-sm ${isMe ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-card border shadow-sm rounded-tl-none'}`}>
                                                    {msg.message}
                                                </div>
                                                <span className="text-[10px] text-muted-foreground mt-1">
                                                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={scrollRef} />
                            </div>
                        )}
                    </ScrollArea>
                </div>

                <div className="p-4 bg-background border-t mt-auto">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (message.trim()) sendMessageMutation.mutate();
                        }}
                        className="relative"
                    >
                        <Textarea
                            placeholder="Type a message..."
                            className="pr-12 resize-none min-h-[80px]"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    if (message.trim()) sendMessageMutation.mutate();
                                }
                            }}
                        />
                        <Button
                            size="icon"
                            className="absolute bottom-3 right-3 h-8 w-8"
                            type="submit"
                            disabled={!message.trim() || sendMessageMutation.isPending}
                        >
                            {sendMessageMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </Button>
                    </form>
                </div>
            </SheetContent>
        </Sheet>
    );
}
