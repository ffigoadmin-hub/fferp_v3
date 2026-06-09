import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { normalizeSlot } from '@/lib/slotHelpers';

export interface UnifiedActivity {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    department: string;
    role: string;
    type: 'regular' | 'shift';
    status: 'working' | 'break' | 'absent' | 'completed';
    loginTime: string | null;
    lastActiveSlot: string | null;
    complianceScore: number;
    aiScore?: {
        score: number;
        status: string;
        analysis: string;
        breakdown: {
            punctuality: number;
            planQuality: number;
            reportQuality: number;
            consistency: number;
        };
    };
    metrics: {
        plansCount: number;
        reportsCount: number;
        lateReports: number;
        selfiesCount: number;
    };
    raw: {
        plans: any[];
        reports: any[];
        selfies: any[];
        eod: any | null;
    };
}

export function useUnifiedWorkAnalytics(date: Date = new Date()) {
    const [activities, setActivities] = useState<UnifiedActivity[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const dateStr = format(date, 'yyyy-MM-dd');

    const fetchAnalytics = useCallback(async () => {
        setIsLoading(true);
        try {
            // 1. Fetch all profiles, AI scores, and daily data in parallel
            const [profilesRes, aiScoresRes, regPlans, regReports, regSelfies, regEod, shiftSessions, shiftSlots, shiftBreaks, dayStartsRes] = await Promise.all([
                supabase.from('profiles').select('id, name, email, department, role'),
                supabase.from('ai_employee_scores' as any).select('*').eq('date', dateStr),
                supabase.from('hourly_plans').select('*').eq('date', dateStr),
                supabase.from('hourly_reports').select('*').eq('date', dateStr),
                supabase.from('selfie_records').select('*').eq('date', dateStr),
                supabase.from('eod_reports').select('*').eq('date', dateStr),
                (supabase.from('shift_sessions') as any).select('*').eq('date', dateStr),
                (supabase.from('shift_hourly_slots') as any).select('*').eq('date', dateStr),
                (supabase.from('shift_breaks') as any).select('*').eq('date', dateStr),
                supabase.from('day_starts').select('*').eq('date', dateStr),
            ]);

            if (profilesRes.error) throw profilesRes.error;
            const profiles = profilesRes.data || [];
            const aiScores = aiScoresRes.data || [];

            // 4. Normalize and Combine
            const combined: UnifiedActivity[] = profiles.map((profile: any) => {
                const shiftSessionsList = (shiftSessions.data as any[]) || [];
                const shiftSlotsList = (shiftSlots.data as any[]) || [];
                const shiftBreaksList = (shiftBreaks.data as any[]) || [];

                const session = shiftSessionsList.find(s => s.user_id === profile.id);
                const aiScoreEntry = aiScores.find((s: any) => s.user_id === profile.id);
                const isShiftWorker = !!session;

                if (isShiftWorker) {
                    const slots = shiftSlotsList.filter(s => s.session_id === session.id);
                    const breaks = shiftBreaksList.filter(b => b.session_id === session.id);

                    const isOnBreak = breaks.some(b => !b.break_end);
                    const isCompleted = session.status === 'completed';

                    const plansCount = slots.filter(s => !!s.plan).length;
                    const reportsCount = slots.filter(s => !!s.report).length;

                    return {
                        id: profile.id,
                        userId: profile.id,
                        userName: profile.name,
                        userEmail: profile.email,
                        department: profile.department || 'N/A',
                        role: profile.role,
                        type: 'shift',
                        status: isOnBreak ? 'break' : isCompleted ? 'completed' : 'working',
                        loginTime: format(new Date(session.shift_start), 'hh:mm a'),
                        lastActiveSlot: slots[slots.length - 1]?.slot_start || null,
                        complianceScore: aiScoreEntry ? (aiScoreEntry as any).ai_score : 0,
                        aiScore: aiScoreEntry ? {
                            score: (aiScoreEntry as any).ai_score,
                            status: (aiScoreEntry as any).ai_status,
                            analysis: (aiScoreEntry as any).ai_analysis,
                            breakdown: {
                                punctuality: (aiScoreEntry as any).punctuality_score,
                                planQuality: (aiScoreEntry as any).plan_quality_score,
                                reportQuality: (aiScoreEntry as any).report_quality_score,
                                consistency: (aiScoreEntry as any).consistency_score,
                            }
                        } : undefined,
                        metrics: {
                            plansCount,
                            reportsCount,
                            lateReports: 0,
                            selfiesCount: session.logout_selfie_url ? 2 : 1
                        },
                        raw: {
                            plans: slots,
                            reports: slots,
                            selfies: [],
                            eod: null
                        }
                    };
                } else {
                    // Regular Worker - AI-Governed Model
                    const plans = (regPlans.data as any[] || []).filter(p => p.user_id === profile.id);
                    const reports = (regReports.data as any[] || []).filter(r => r.user_id === profile.id);
                    const selfies = (regSelfies.data as any[] || []).filter(s => s.user_id === profile.id);
                    const eod = (regEod.data as any[] || []).find(e => e.user_id === profile.id) || null;

                    const morningSelfie = selfies.find(s => s.selfie_type === 'morning_login');
                    const dayStart = (dayStartsRes.data as any[] || []).find(ds => ds.user_id === profile.id);
                    const eveningSelfie = selfies.find(s => s.selfie_type === 'evening_logout');

                    const loginTimestamp = morningSelfie?.captured_at || dayStart?.submitted_at;

                    return {
                        id: profile.id,
                        userId: profile.id,
                        userName: profile.name,
                        userEmail: profile.email,
                        department: profile.department || 'N/A',
                        role: profile.role,
                        type: 'regular',
                        status: eveningSelfie ? 'completed' : loginTimestamp ? 'working' : 'absent',
                        loginTime: loginTimestamp ? format(new Date(loginTimestamp), 'hh:mm a') : null,
                        lastActiveSlot: reports[reports.length - 1]?.time_slot || null,
                        complianceScore: aiScoreEntry ? (aiScoreEntry as any).ai_score : 0,
                        aiScore: aiScoreEntry ? {
                            score: (aiScoreEntry as any).ai_score,
                            status: (aiScoreEntry as any).ai_status,
                            analysis: (aiScoreEntry as any).ai_analysis,
                            breakdown: {
                                punctuality: (aiScoreEntry as any).punctuality_score,
                                planQuality: (aiScoreEntry as any).plan_quality_score,
                                reportQuality: (aiScoreEntry as any).report_quality_score,
                                consistency: (aiScoreEntry as any).consistency_score,
                            }
                        } : undefined,
                        metrics: {
                            plansCount: plans.length,
                            reportsCount: reports.length,
                            lateReports: reports.filter(r => r.is_late).length,
                            selfiesCount: selfies.length
                        },
                        raw: {
                            plans,
                            reports,
                            selfies,
                            eod
                        }
                    };
                }
            });

            setActivities(combined.sort((a, b) => b.complianceScore - a.complianceScore));
        } catch (error) {
            console.error('Error fetching unified analytics:', error);
        } finally {
            setIsLoading(false);
        }
    }, [dateStr]);

    useEffect(() => {
        fetchAnalytics();

        const tables = [
            'hourly_plans', 'hourly_reports', 'selfie_records',
            'shift_sessions', 'shift_hourly_slots', 'shift_breaks',
            'ai_employee_scores', 'day_starts'
        ];

        const channels = tables.map(table =>
            supabase.channel(`realtime-${table}-${dateStr}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table,
                    filter: table === 'ai_employee_scores' ? `date=eq.${dateStr}` : undefined
                }, () => fetchAnalytics())
                .subscribe()
        );

        return () => {
            channels.forEach(channel => supabase.removeChannel(channel));
        };
    }, [fetchAnalytics, dateStr]);

    return { activities, isLoading, refetch: fetchAnalytics };
}
