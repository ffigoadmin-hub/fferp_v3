import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { subDays, format } from 'date-fns';

export interface WeeklyCompliance {
    date: string;
    averageScore: number;
    totalEmployees: number;
    effectiveCount: number;
    laggingCount: number;
}

export function useWeeklyWorkAnalytics() {
    const [weeklyData, setWeeklyData] = useState<WeeklyCompliance[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchWeeklyHistory = useCallback(async () => {
        setIsLoading(true);
        try {
            const history: WeeklyCompliance[] = [];

            // Fetch last 7 days
            for (let i = 0; i < 7; i++) {
                const date = subDays(new Date(), i);
                const dateStr = format(date, 'yyyy-MM-dd');

                const { data: profiles } = await supabase.from('profiles').select('id');
                const { data: selfies } = await supabase.from('selfie_records').select('user_id, selfie_type').eq('date', dateStr);
                const { data: plans } = await supabase.from('hourly_plans').select('user_id').eq('date', dateStr);
                const { data: reports } = await supabase.from('hourly_reports').select('user_id').eq('date', dateStr);

                if (profiles) {
                    let totalScore = 0;
                    let effective = 0;
                    let lagging = 0;

                    const selfieList = (selfies as any[]) || [];
                    const planList = (plans as any[]) || [];
                    const reportList = (reports as any[]) || [];

                    (profiles as any[]).forEach(p => {
                        const hasLogin = selfieList.some(s => s.user_id === p.id && s.selfie_type === 'morning_login');
                        const pPlans = planList.filter(pl => pl.user_id === p.id).length || 0;
                        const pReports = reportList.filter(r => r.user_id === p.id).length || 0;

                        let score = 0;
                        if (hasLogin) {
                            score = 40 + (pPlans / 8 * 30) + (pReports / 8 * 30);
                        }

                        totalScore += score;
                        if (score >= 80) effective++;
                        if (hasLogin && score < 50) lagging++;
                    });

                    history.push({
                        date: dateStr,
                        averageScore: Math.round(totalScore / profiles.length),
                        totalEmployees: profiles.length,
                        effectiveCount: effective,
                        laggingCount: lagging
                    });
                }
            }

            setWeeklyData(history.reverse());
        } catch (error) {
            console.error('Error fetching weekly analytics:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWeeklyHistory();
    }, [fetchWeeklyHistory]);

    return { weeklyData, isLoading, refetch: fetchWeeklyHistory };
}
