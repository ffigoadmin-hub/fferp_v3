import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export const runAutoLopCheck = async (adminId: string) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const now = new Date();

    // Only run after 8:00 PM
    if (now.getHours() < 20) {
        console.log('Auto LOP Check: Too early (runs after 8 PM)');
        return { success: false, message: 'Too early' };
    }

    try {
        // 1. Check if already run today
        // 2. Fetch all active employees
        const { data: employees, error: empError } = await (supabase
            .from('profiles') as any)
            .select('id, name')
            .eq('is_active', true)
            .not('role', 'ilike', '%auditor%');


        if (empError || !employees) throw empError;

        let lopCount = 0;

        for (const emp of employees) {
            // CRITICAL: Check if today is a week off for this employee
            const { data: isWeekOff } = await (supabase.rpc as any)('is_week_off_day', {
                p_employee_id: emp.id,
                p_date: today
            });

            if (isWeekOff === true) {
                console.log(`Skipping LOP for ${emp.name} - Week Off Day`);
                continue; // Skip this employee entirely
            }

            // DEFENSIVE GUARD: Check if employee is already Absent (1.0 LOP)
            // If they are absent, we should NOT check for selfies or apply minor penalties
            const { data: existingFullDayLop } = await (supabase
                .from('lop_entries') as any)
                .select('id')
                .eq('employee_id', emp.id)
                .eq('lop_date', today)
                .eq('lop_type', '1_day')
                .maybeSingle();

            if (existingFullDayLop) {
                console.log(`Skipping LOP for ${emp.name} - Already Marked Absent (1.0 Day)`);
                continue;
            }

            // 3. Fetch selfies for today
            const { data: selfies } = await (supabase
                .from('selfie_records') as any)
                .select('*')
                .eq('user_id', emp.id)
                .eq('date', today);

            const lunchSelfie = (selfies as any)?.find((s: any) => s.selfie_type === 'afternoon_break');
            const eveningSelfie = (selfies as any)?.find((s: any) => s.selfie_type === 'evening_break');

            // Rules:
            // Lunch: Window 2:30 PM - 2:45 PM.
            // Evening: Window 5:40 PM - 5:45 PM.

            // Check Lunch
            let lunchPenalty = false;
            let lunchReason = '';

            if (!lunchSelfie) {
                lunchPenalty = true;
                lunchReason = 'Missed Lunch Selfie';
            } else {
                // Check Lateness
                const capturedAt = new Date(lunchSelfie.captured_at);
                const utcHours = capturedAt.getUTCHours();
                const utcMinutes = capturedAt.getUTCMinutes();
                let istHours = utcHours + 5;
                let istMinutes = utcMinutes + 30;
                if (istMinutes >= 60) { istHours++; istMinutes -= 60; }
                if (istHours >= 24) { istHours -= 24; }

                const mins = istHours * 60 + istMinutes;
                // Lunch End: 2:45 PM = 14:45 = 885 mins.
                if (mins > 885) {
                    lunchPenalty = true;
                    lunchReason = `Late Lunch Selfie (+${mins - 885}m)`;
                }
            }

            if (lunchPenalty) {
                await applyLop(emp.id, today, 0.1, lunchReason, 'SYSTEM_SELFIE_LUNCH', adminId);
                lopCount += 0.1;
            }

            // Check Evening
            let eveningPenalty = false;
            let eveningReason = '';

            if (!eveningSelfie) {
                eveningPenalty = true;
                eveningReason = 'Missed Evening Selfie';
            } else {
                // Check Lateness
                const capturedAt = new Date(eveningSelfie.captured_at);
                const utcHours = capturedAt.getUTCHours();
                const utcMinutes = capturedAt.getUTCMinutes();
                let istHours = utcHours + 5;
                let istMinutes = utcMinutes + 30;
                if (istMinutes >= 60) { istHours++; istMinutes -= 60; }
                if (istHours >= 24) { istHours -= 24; }

                const mins = istHours * 60 + istMinutes;
                // Evening End: 5:45 PM = 17:45 = 1065 mins.
                if (mins > 1065) {
                    eveningPenalty = true;
                    eveningReason = `Late Evening Selfie (+${mins - 1065}m)`;
                }
            }

            if (eveningPenalty) {
                await applyLop(emp.id, today, 0.1, eveningReason, 'SYSTEM_SELFIE_EVENING', adminId);
                lopCount += 0.1;
            }
        }

        return { success: true, count: lopCount };

    } catch (error) {
        console.error('Auto LOP Error:', error);
        return { success: false, error };
    }
};

const applyLop = async (userId: string, date: string, amount: number, reason: string, source: string, adminId: string) => {
    // Check duplicate
    const { data: existing } = await (supabase
        .from('lop_entries') as any)
        .select('id')
        .eq('employee_id', userId)
        .eq('lop_date', date)
        .eq('source', source)
        .maybeSingle();

    if (existing) return; // Already applied

    // Insert
    await (supabase.from('lop_entries') as any).insert({
        employee_id: userId,
        lop_date: date,
        lop_type: '0.25_day', // Smallest unit in enum. Using as base for 0.1 penalty.
        reason: reason,
        status: 'approved',
        source: source,
        created_by: adminId,
        evidence_url: 'SYSTEM_AUTO_LOP'
    });
};
