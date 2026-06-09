
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Clock, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from "@/components/ui/button";
import { RentalRemarksDialog } from './RentalRemarksDialog';

interface RentalRemarksPreviewProps {
    propertyId: string;
    propertyTitle: string;
}

export function RentalRemarksPreview({ propertyId, propertyTitle }: RentalRemarksPreviewProps) {
    const { data: userProfile } = useQuery({
        queryKey: ['user-profile'],
        queryFn: async () => {
            const { data } = await supabase.auth.getUser();
            if (!data.user) return null;
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
            return profile;
        }
    });

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
                .order('created_at', { ascending: true }); // Oldest top, newest bottom (chat style)

            if (error) throw error;
            return data;
        }
    });

    if (isLoading) {
        return <div className="flex justify-center p-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;
    }

    if (!remarks || remarks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-4 text-center border rounded-lg bg-muted/20">
                <p className="text-xs text-muted-foreground mb-2">No remarks found for this property.</p>
                <RentalRemarksDialog
                    propertyId={propertyId}
                    propertyTitle={propertyTitle}
                    trigger={
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                            Add First Remark
                        </Button>
                    }
                />
            </div>
        );
    }

    // Scroll to bottom logic could be added here if needed, but for preview maybe just show list
    return (
        <div className="border rounded-lg bg-card shadow-sm overflow-hidden">
            <div className="p-3 bg-muted/30 border-b flex justify-between items-center">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <MessageSquare className="w-3 h-3" /> Recent Remarks
                </h4>
                <RentalRemarksDialog
                    propertyId={propertyId}
                    propertyTitle={propertyTitle}
                    trigger={
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] hover:bg-background">
                            View All / Reply
                        </Button>
                    }
                />
            </div>
            <ScrollArea className="h-[200px] p-4">
                <div className="space-y-4">
                    {remarks.map((msg: any) => {
                        const isMe = msg.created_by === (userProfile as any)?.id;
                        return (
                            <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                                <Avatar className="w-6 h-6 border mt-1">
                                    <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-bold">
                                        {msg.profiles?.name?.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className={`flex flex-col max-w-[85%] ${isMe ? 'items-end' : 'items-start'}`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-bold text-foreground">
                                            {msg.profiles?.name || 'Unknown'}
                                        </span>
                                        <span className="text-[9px] text-muted-foreground">
                                            {format(new Date(msg.created_at), 'dd MMM, hh:mm a')}
                                        </span>
                                    </div>
                                    <div className={`px-3 py-2 rounded-lg text-xs leading-relaxed shadow-sm ${isMe ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-muted text-foreground rounded-tl-none'}`}>
                                        {msg.remark}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>
        </div>
    );
}
