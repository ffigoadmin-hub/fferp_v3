import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface ShiftSession {
    id: string;
    userId: string;
    date: string;
    shiftStart: string;
    shiftEnd: string | null;
    loginSelfieUrl: string;
    logoutSelfieUrl: string | null;
    loginLocation: { lat: number; lng: number } | null;
    logoutLocation: { lat: number; lng: number } | null;
    targetHours: number;
    maxHours: number;
    totalBreakMinutes: number;
    netWorkingMinutes: number | null;
    status: 'active' | 'completed' | 'incomplete';
    dayPlan: string | null;
}

interface ShiftStats {
    hoursWorked: number;
    breaksTaken: number;
    totalBreakMinutes: number;
    targetHours: number;
    progressPercent: number;
    isOvertime: boolean;
}

/**
 * Core hook for managing shift sessions
 */
export function useShiftSession() {
    const { user } = useAuth();
    const [currentSession, setCurrentSession] = useState<ShiftSession | null>(null);
    const [todayStats, setTodayStats] = useState<ShiftStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isStarting, setIsStarting] = useState(false);
    const [isEnding, setIsEnding] = useState(false);

    const dateStr = format(new Date(), 'yyyy-MM-dd');

    const fetchSession = useCallback(async () => {
        if (!user) {
            setIsLoading(false);
            return;
        }

        try {
            // Fetch today's session
            const { data, error } = await (supabase
                .from('shift_sessions') as any)
                .select('*')
                .eq('user_id', user.id)
                .eq('date', dateStr)
                .maybeSingle();

            if (error) {
                console.error('Error fetching shift session:', error);
                return;
            }

            if (data) {
                const session: ShiftSession = {
                    id: data.id,
                    userId: data.user_id,
                    date: data.date,
                    shiftStart: data.shift_start,
                    shiftEnd: data.shift_end,
                    loginSelfieUrl: data.login_selfie_url,
                    logoutSelfieUrl: data.logout_selfie_url,
                    loginLocation: data.login_location,
                    logoutLocation: data.logout_location,
                    targetHours: data.target_hours,
                    maxHours: data.max_hours,
                    totalBreakMinutes: data.total_break_minutes,
                    netWorkingMinutes: data.net_working_minutes,
                    status: data.status,
                    dayPlan: data.day_plan,
                };
                setCurrentSession(session);

                // Calculate live stats
                if (session.status === 'active') {
                    const now = new Date();
                    const start = new Date(session.shiftStart);
                    const totalMinutes = (now.getTime() - start.getTime()) / (1000 * 60);
                    const netMinutes = totalMinutes - session.totalBreakMinutes;
                    const hoursWorked = netMinutes / 60;
                    const progressPercent = Math.min((hoursWorked / session.targetHours) * 100, 100);

                    setTodayStats({
                        hoursWorked,
                        breaksTaken: 0, // Will be updated when we fetch breaks
                        totalBreakMinutes: session.totalBreakMinutes,
                        targetHours: session.targetHours,
                        progressPercent,
                        isOvertime: hoursWorked > session.targetHours,
                    });
                } else if (session.netWorkingMinutes !== null) {
                    const hoursWorked = session.netWorkingMinutes / 60;
                    setTodayStats({
                        hoursWorked,
                        breaksTaken: 0,
                        totalBreakMinutes: session.totalBreakMinutes,
                        targetHours: session.targetHours,
                        progressPercent: Math.min((hoursWorked / session.targetHours) * 100, 100),
                        isOvertime: hoursWorked > session.targetHours,
                    });
                }
            } else {
                setCurrentSession(null);
                setTodayStats(null);
            }
        } catch (error) {
            console.error('Error in useShiftSession:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user, dateStr]);

    useEffect(() => {
        fetchSession();

        // Refresh every minute for live timer
        const interval = setInterval(fetchSession, 60000);
        return () => clearInterval(interval);
    }, [fetchSession]);

    const startShift = async (
        selfieUrl: string,
        dayPlan: string,
        location?: { lat: number; lng: number }
    ) => {
        if (!user) return { success: false, error: 'Not authenticated' };
        if (currentSession) return { success: false, error: 'Session already active' };

        setIsStarting(true);

        try {
            // Get user's shift config
            const { data: config } = await (supabase
                .from('shift_user_assignments') as any)
                .select('target_hours, max_hours')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .maybeSingle();

            const targetHours = config?.target_hours || 9;
            const maxHours = config?.max_hours || 12;

            // Create session
            const { data, error } = await (supabase
                .from('shift_sessions') as any)
                .insert({
                    user_id: user.id,
                    date: dateStr,
                    login_selfie_url: selfieUrl,
                    login_location: location || null,
                    target_hours: targetHours,
                    max_hours: maxHours,
                    day_plan: dayPlan,
                    status: 'active',
                })
                .select()
                .single();

            if (error) throw error;

            // Create first hourly slot
            await (supabase
                .from('shift_hourly_slots') as any)
                .insert({
                    session_id: data.id,
                    slot_number: 1,
                    slot_start: new Date().toISOString(),
                    plan: dayPlan,
                    plan_submitted_at: new Date().toISOString(),
                    status: 'plan_submitted',
                });

            toast.success('Shift started successfully!');
            await fetchSession();
            return { success: true, data };
        } catch (error: any) {
            console.error('Error starting shift:', error);
            toast.error('Failed to start shift');
            return { success: false, error: error.message };
        } finally {
            setIsStarting(false);
        }
    };

    const endShift = async (
        selfieUrl: string,
        location?: { lat: number; lng: number }
    ) => {
        if (!user) return { success: false, error: 'Not authenticated' };
        if (!currentSession) return { success: false, error: 'No active session' };

        // Check for EOD report
        const { data: eod } = await (supabase
            .from('shift_eod_reports') as any)
            .select('id')
            .eq('session_id', currentSession.id)
            .maybeSingle();

        if (!eod) {
            return { success: false, error: 'EOD report is required before logout' };
        }

        setIsEnding(true);

        try {
            const { error } = await (supabase
                .from('shift_sessions') as any)
                .update({
                    shift_end: new Date().toISOString(),
                    logout_selfie_url: selfieUrl,
                    logout_location: location || null,
                    status: 'completed',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', currentSession.id);

            if (error) throw error;

            toast.success('Shift ended successfully!');
            await fetchSession();
            return { success: true };
        } catch (error: any) {
            console.error('Error ending shift:', error);
            toast.error('Failed to end shift');
            return { success: false, error: error.message };
        } finally {
            setIsEnding(false);
        }
    };

    return {
        currentSession,
        todayStats,
        isLoading,
        isStarting,
        isEnding,
        hasActiveSession: currentSession?.status === 'active',
        startShift,
        endShift,
        refetch: fetchSession,
    };
}
