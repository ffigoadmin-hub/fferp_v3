import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ShiftBreak {
    id: string;
    sessionId: string;
    breakStart: string;
    breakEnd: string | null;
    durationMinutes: number | null;
    reason: string | null;
}

/**
 * Hook for managing breaks within a shift session
 */
export function useShiftBreaks(sessionId: string | undefined) {
    const [breaks, setBreaks] = useState<ShiftBreak[]>([]);
    const [activeBreak, setActiveBreak] = useState<ShiftBreak | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isStarting, setIsStarting] = useState(false);
    const [isEnding, setIsEnding] = useState(false);

    const fetchBreaks = useCallback(async () => {
        if (!sessionId) {
            setIsLoading(false);
            return;
        }

        try {
            const { data, error } = await (supabase
                .from('shift_breaks') as any)
                .select('*')
                .eq('session_id', sessionId)
                .order('break_start', { ascending: false });

            if (error) {
                console.error('Error fetching breaks:', error);
                return;
            }

            const mappedBreaks: ShiftBreak[] = (data || []).map((b: any) => ({
                id: b.id,
                sessionId: b.session_id,
                breakStart: b.break_start,
                breakEnd: b.break_end,
                durationMinutes: b.duration_minutes,
                reason: b.reason,
            }));

            setBreaks(mappedBreaks);

            // Check for active break (no end time)
            const active = mappedBreaks.find(b => b.breakEnd === null);
            setActiveBreak(active || null);
        } catch (error) {
            console.error('Error in useShiftBreaks:', error);
        } finally {
            setIsLoading(false);
        }
    }, [sessionId]);

    useEffect(() => {
        fetchBreaks();
    }, [fetchBreaks]);

    const startBreak = async (reason?: string) => {
        if (!sessionId) return { success: false, error: 'No active session' };
        if (activeBreak) return { success: false, error: 'Break already active' };

        setIsStarting(true);

        try {
            const { data, error } = await (supabase
                .from('shift_breaks') as any)
                .insert({
                    session_id: sessionId,
                    break_start: new Date().toISOString(),
                    reason: reason || null,
                })
                .select()
                .single();

            if (error) throw error;

            toast.success('Break started');
            await fetchBreaks();
            return { success: true, data };
        } catch (error: any) {
            console.error('Error starting break:', error);
            toast.error('Failed to start break');
            return { success: false, error: error.message };
        } finally {
            setIsStarting(false);
        }
    };

    const endBreak = async () => {
        if (!activeBreak) return { success: false, error: 'No active break' };

        setIsEnding(true);

        try {
            const { error } = await (supabase
                .from('shift_breaks') as any)
                .update({
                    break_end: new Date().toISOString(),
                })
                .eq('id', activeBreak.id);

            if (error) throw error;

            toast.success('Break ended');
            await fetchBreaks();
            return { success: true };
        } catch (error: any) {
            console.error('Error ending break:', error);
            toast.error('Failed to end break');
            return { success: false, error: error.message };
        } finally {
            setIsEnding(false);
        }
    };

    // Calculate total break time
    const totalBreakMinutes = breaks.reduce((sum, b) => {
        if (b.durationMinutes) return sum + b.durationMinutes;
        if (b.breakEnd === null) {
            // Active break - calculate live
            const start = new Date(b.breakStart);
            const now = new Date();
            return sum + (now.getTime() - start.getTime()) / (1000 * 60);
        }
        return sum;
    }, 0);

    return {
        breaks,
        activeBreak,
        isOnBreak: activeBreak !== null,
        totalBreakMinutes,
        isLoading,
        isStarting,
        isEnding,
        startBreak,
        endBreak,
        refetch: fetchBreaks,
    };
}
