import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TicketView {
    id: string;
    ticket_id: string;
    ticket_type: 'escalation' | 'critical' | 'site_visit';
    user_id: string;
    viewed_at: string;
    created_at: string;
    viewer_name?: string;
    viewer_role?: string;
}

export interface TicketViewWithProfile extends TicketView {
    profiles?: {
        name: string;
        role: string;
    };
}

export function useTicketViews(ticketId: string | null, ticketType: 'escalation' | 'critical' | 'site_visit') {
    const [views, setViews] = useState<TicketViewWithProfile[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { user } = useAuth();

    // Record that the current user has viewed this ticket
    const recordView = async () => {
        if (!ticketId || !user?.id) return;

        try {
            // Use upsert to update viewed_at if record exists, or insert if new
            const { error } = await supabase
                .from('ticket_views')
                .upsert(
                    {
                        ticket_id: ticketId,
                        ticket_type: ticketType,
                        user_id: user.id,
                        viewed_at: new Date().toISOString(),
                    },
                    {
                        onConflict: 'ticket_id,user_id',
                    }
                );

            if (error) {
                console.error('Error recording ticket view:', error);
            }
        } catch (error) {
            console.error('Error recording ticket view:', error);
        }
    };

    // Fetch all views for this ticket
    const fetchViews = async () => {
        if (!ticketId) {
            setViews([]);
            return;
        }

        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('ticket_views')
                .select(`
          *,
          profiles:user_id (
            name,
            role
          )
        `)
                .eq('ticket_id', ticketId)
                .order('viewed_at', { ascending: false });

            if (error) throw error;
            setViews((data || []) as unknown as TicketViewWithProfile[]);
        } catch (error) {
            console.error('Error fetching ticket views:', error);
            setViews([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch views when ticketId changes
    useEffect(() => {
        fetchViews();
    }, [ticketId]);

    // Record view when ticket is opened
    useEffect(() => {
        if (ticketId && user?.id) {
            recordView();
        }
    }, [ticketId, user?.id]);

    // Add real-time subscription for views
    useEffect(() => {
        if (!ticketId) return;

        const channel = supabase
            .channel(`ticket-views-${ticketId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'ticket_views',
                    filter: `ticket_id=eq.${ticketId}`,
                },
                () => {
                    fetchViews();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [ticketId]);

    return {
        views,
        isLoading,
        refetch: fetchViews,
        recordView,
    };
}
