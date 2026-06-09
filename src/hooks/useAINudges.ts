import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AINudge {
    id: string;
    user_id: string;
    date: string;
    nudge_type: 'reminder' | 'motivation' | 'alert' | 'coaching';
    trigger_reason: string;
    message: string;
    target_audience: 'employee' | 'manager' | 'both';
    delivered_at: string;
    read_at: string | null;
    dismissed_at: string | null;
    ai_score_at_trigger: number;
    hour_of_day: number;
}

interface UseAINudgesReturn {
    nudges: AINudge[];
    unreadCount: number;
    isLoading: boolean;
    markAsRead: (nudgeId: string) => Promise<void>;
    dismissNudge: (nudgeId: string) => Promise<void>;
    refetch: () => Promise<void>;
}

export function useAINudges(): UseAINudgesReturn {
    const [nudges, setNudges] = useState<AINudge[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { user } = useAuth();

    const fetchNudges = useCallback(async () => {
        if (!user?.id) return;

        setIsLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];

            const { data, error } = await supabase
                .from('ai_nudges' as any)
                .select('*')
                .eq('user_id', user.id)
                .gte('date', today)
                .order('delivered_at', { ascending: false });

            if (error) {
                if (error.code === '42P01') {
                    // Table doesn't exist yet
                    setNudges([]);
                    return;
                }
                throw error;
            }

            setNudges((data as unknown as AINudge[]) || []);
        } catch (err) {
            console.error('[useAINudges] Error:', err);
        } finally {
            setIsLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchNudges();

        // Realtime subscription
        const channel = supabase
            .channel('nudges-changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'ai_nudges',
                    filter: `user_id=eq.${user?.id}`,
                },
                () => {
                    fetchNudges();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchNudges, user?.id]);

    const markAsRead = useCallback(async (nudgeId: string) => {
        try {
            await supabase
                .from('ai_nudges' as any)
                .update({ read_at: new Date().toISOString() })
                .eq('id', nudgeId);

            setNudges(prev =>
                prev.map(n => n.id === nudgeId ? { ...n, read_at: new Date().toISOString() } : n)
            );
        } catch (err) {
            console.error('[useAINudges] Mark read error:', err);
        }
    }, []);

    const dismissNudge = useCallback(async (nudgeId: string) => {
        try {
            await supabase
                .from('ai_nudges' as any)
                .update({ dismissed_at: new Date().toISOString() })
                .eq('id', nudgeId);

            setNudges(prev => prev.filter(n => n.id !== nudgeId));
        } catch (err) {
            console.error('[useAINudges] Dismiss error:', err);
        }
    }, []);

    const unreadCount = nudges.filter(n => !n.read_at && !n.dismissed_at).length;

    return {
        nudges,
        unreadCount,
        isLoading,
        markAsRead,
        dismissNudge,
        refetch: fetchNudges,
    };
}
