import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, addDays } from 'date-fns';

export interface DayPerformance {
    date: Date;
    dayName: string;
    loginTime: string | null;
    isLate: boolean;
    plansCount: number;
    reportsCount: number;
    lateReports: number;
    selfiesCount: number;
    status: 'working' | 'completed' | 'absent' | 'pending';
}

export interface WeeklyPerformance {
    weekStart: Date;
    weekEnd: Date;
    days: DayPerformance[];
    summary: {
        totalPlans: number;
        totalReports: number;
        totalLateReports: number;
        avgComplianceScore: number;
        presentDays: number;
        lateDays: number;
    };
}

export function useEmployeeWeeklyPerformance(userId: string | null, open: boolean, selectedDate: Date = new Date()) {
    const [weeklyData, setWeeklyData] = useState<WeeklyPerformance | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!userId || !open) {
            setWeeklyData(null);
            return;
        }

        const fetchWeeklyData = async () => {
            setLoading(true);
            try {
                // Get Monday of the week for the selected date
                const today = new Date();
                const monday = startOfWeek(selectedDate, { weekStartsOn: 1 });
                const saturday = addDays(monday, 5);

                // Generate date strings for the week
                const weekDates: string[] = [];
                const weekDays: Date[] = [];
                for (let i = 0; i < 6; i++) {
                    const day = addDays(monday, i);
                    weekDays.push(day);
                    weekDates.push(format(day, 'yyyy-MM-dd'));
                }

                console.log('Fetching weekly data for user:', userId);
                console.log('Week dates:', weekDates);

                // Fetch plans for the week - using 'date' column and 'time_slot'
                const { data: plans, error: plansError } = await supabase
                    .from('hourly_plans')
                    .select('date, time_slot, submitted_at')
                    .eq('user_id', userId)
                    .in('date', weekDates) as { data: { date: string; time_slot: string; submitted_at: string }[] | null; error: any };

                if (plansError) console.error('Plans fetch error:', plansError);
                console.log('Weekly plans fetched:', plans?.length || 0, plans);

                // Fetch reports for the week - using 'date' column and 'time_slot'
                const { data: reports, error: reportsError } = await supabase
                    .from('hourly_reports')
                    .select('date, time_slot, submitted_at, is_late')
                    .eq('user_id', userId)
                    .in('date', weekDates) as { data: { date: string; time_slot: string; submitted_at: string | null; is_late: boolean }[] | null; error: any };

                if (reportsError) console.error('Reports fetch error:', reportsError);
                console.log('Weekly reports fetched:', reports?.length || 0, reports);

                // Fetch day starts for login times
                const { data: dayStarts, error: dayStartsError } = await supabase
                    .from('day_starts')
                    .select('date, submitted_at')
                    .eq('user_id', userId)
                    .in('date', weekDates) as { data: { date: string; submitted_at: string | null }[] | null; error: any };

                if (dayStartsError) console.error('Day starts fetch error:', dayStartsError);
                console.log('Day starts fetched:', dayStarts?.length || 0, dayStarts);

                // Fetch selfies for the week - using 'date' column
                const { data: selfies } = await supabase
                    .from('selfie_records')
                    .select('date, created_at')
                    .eq('user_id', userId)
                    .in('date', weekDates) as { data: { date: string; created_at: string }[] | null };

                // Process data for each day
                const daysData: DayPerformance[] = weekDays.map(date => {
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const dayName = format(date, 'EEE');

                    // Find login time for this day
                    const dayStart = dayStarts?.find(ds => ds.date === dateStr);
                    const rawLoginTime = dayStart?.submitted_at || null;
                    const loginTime = rawLoginTime ? format(new Date(rawLoginTime), 'HH:mm') : null;

                    // Check if late (after 10:15 AM)
                    let isLate = false;
                    if (loginTime) {
                        const [hours, minutes] = loginTime.split(':').map(Number);
                        isLate = hours > 10 || (hours === 10 && minutes > 15);
                    }

                    // Count plans for this day - match by date string
                    const dayPlans = plans?.filter(p => p.date === dateStr) || [];

                    // Count reports for this day - match by date string
                    const dayReports = reports?.filter(r => r.date === dateStr) || [];

                    // Count late reports - use is_late field from database
                    const lateReports = dayReports.filter(r => r.is_late === true).length;

                    // Count selfies for this day - match by date string
                    const daySelfies = selfies?.filter(s => s.date === dateStr) || [];

                    // Determine status
                    let status: DayPerformance['status'] = 'pending';
                    const todayStr = format(today, 'yyyy-MM-dd');
                    if (dateStr === todayStr) {
                        status = dayPlans.length > 0 || dayReports.length > 0 ? 'working' : 'pending';
                    } else if (date < today) {
                        status = dayPlans.length > 0 || dayReports.length > 0 ? 'completed' : 'absent';
                    }

                    return {
                        date,
                        dayName,
                        loginTime,
                        isLate,
                        plansCount: dayPlans.length,
                        reportsCount: dayReports.length,
                        lateReports,
                        selfiesCount: daySelfies.length,
                        status,
                    };
                });

                // Calculate summary
                const presentDays = daysData.filter(d => d.status === 'completed' || d.status === 'working').length;
                const lateDays = daysData.filter(d => d.isLate).length;
                const totalPlans = daysData.reduce((sum, d) => sum + d.plansCount, 0);
                const totalReports = daysData.reduce((sum, d) => sum + d.reportsCount, 0);
                const totalLateReports = daysData.reduce((sum, d) => sum + d.lateReports, 0);

                // Calculate avg compliance (simplified)
                const maxDailyScore = 8 + 8; // 8 plans + 8 reports per day
                const actualScore = totalPlans + totalReports;
                const maxPossible = presentDays * maxDailyScore;
                const avgComplianceScore = maxPossible > 0 ? Math.round((actualScore / maxPossible) * 100) : 0;

                setWeeklyData({
                    weekStart: monday,
                    weekEnd: saturday,
                    days: daysData,
                    summary: {
                        totalPlans,
                        totalReports,
                        totalLateReports,
                        avgComplianceScore,
                        presentDays,
                        lateDays,
                    },
                });
            } catch (error) {
                console.error('Error fetching weekly performance:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchWeeklyData();
    }, [userId, open, selectedDate]);

    return { weeklyData, loading };
}
