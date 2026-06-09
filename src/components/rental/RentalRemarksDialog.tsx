import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Send, MessageSquare, Loader2, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface RentalRemarksDialogProps {
    propertyId: string;
    propertyTitle?: string;
    trigger?: React.ReactNode;
}

export function RentalRemarksDialog({ propertyId, propertyTitle, trigger }: RentalRemarksDialogProps) {
    const [open, setOpen] = useState(false);
    const queryClient = useQueryClient();
    const [message, setMessage] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Fetch user profile
    const { data: userProfile } = useQuery({
        queryKey: ['user-profile'],
        queryFn: async () => {
            const { data } = await supabase.auth.getUser();
            if (!data.user) return null;
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
            return profile;
        }
    });

    // Fetch remarks
    const { data: remarks, isLoading } = useQuery({
        queryKey: ['rental-property-remarks', propertyId],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from('rental_property_remarks')
                .select(`
                    *,
                    profiles:created_by (name, role)
                `)
                .eq('property_id', propertyId)
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
    }, [remarks, open]);

    const sendMessageMutation = useMutation({
        mutationFn: async () => {
            const { data: session } = await supabase.auth.getSession();
            if (!session.session) throw new Error("Not authenticated");

            const { error } = await (supabase as any).from('rental_property_remarks').insert({
                property_id: propertyId,
                remark: message,
                created_by: session.session.user.id
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rental-property-remarks', propertyId] });
            setMessage('');
        }
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm" className="gap-2">
                        <MessageSquare className="w-4 h-4" /> Remarks
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col p-0 gap-0">
                <DialogHeader className="p-4 border-b">
                    <DialogTitle className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-primary" /> Property Remarks
                    </DialogTitle>
                    <DialogDescription className="truncate font-medium text-foreground/80">
                        {propertyTitle || 'Property Discussion'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden bg-muted/30 p-4">
                    <ScrollArea className="h-full pr-4">
                        {isLoading ? (
                            <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                        ) : remarks?.length === 0 ? (
                            <div className="text-center text-muted-foreground py-10 text-sm flex flex-col items-center gap-2">
                                <MessageSquare className="w-8 h-8 opacity-20" />
                                <p>No remarks yet. Add a note for this property.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {remarks?.map((msg: any) => {
                                    const isMe = msg.created_by === (userProfile as any)?.id;
                                    return (
                                        <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                                            <Avatar className="w-8 h-8 border mt-1">
                                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                                                    {msg.profiles?.name?.substring(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className={`flex flex-col max-w-[85%] ${isMe ? 'items-end' : 'items-start'}`}>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-bold text-foreground">
                                                        {msg.profiles?.name || 'Unknown User'}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground uppercase px-1.5 py-0.5 rounded bg-muted border">
                                                        {msg.profiles?.role}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                                        <Clock className="w-3 h-3" /> {format(new Date(msg.created_at), 'dd MMM, hh:mm a')}
                                                    </span>
                                                </div>
                                                <div className={`p-3 rounded-xl text-sm leading-relaxed shadow-sm ${isMe ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-background border rounded-tl-none'}`}>
                                                    {msg.remark}
                                                </div>
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
                        className="relative flex gap-2"
                    >
                        <Textarea
                            placeholder="Type a remark..."
                            className="resize-none min-h-[44px] max-h-32"
                            value={message}
                            rows={2}
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
                            className="h-auto w-12 shrink-0 self-end"
                            type="submit"
                            disabled={!message.trim() || sendMessageMutation.isPending}
                        >
                            {sendMessageMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        </Button>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
    );
}
