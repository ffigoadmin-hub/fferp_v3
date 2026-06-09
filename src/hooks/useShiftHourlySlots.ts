import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface HourlySlot {
    id: string;
    sessionId: string;
    slotNumber: number;
    slotStart: string;
    slotEnd: string | null;
    plan: string | null;
    planSubmittedAt: string | null;
    report: string | null;
    reportSubmittedAt: string | null;
    status: 'pending' | 'plan_submitted' | 'report_submitted' | 'missed';
}

/**
 * Hook for managing rolling hourly slots
 * Every hour of active work requires a plan and report
 */
export function useShiftHourlySlots(sessionId: string | undefined) {
    const [slots, setSlots] = useState<HourlySlot[]>([]);
    const [currentSlot, setCurrentSlot] = useState<HourlySlot | null>(null);
    const [missedSlots, setMissedSlots] = useState<HourlySlot[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchSlots = useCallback(async () => {
        if (!sessionId) {
            setIsLoading(false);
            return;
        }

        try {
            const { data, error } = await (supabase
                .from('shift_hourly_slots') as any)
                .select('*')
                .eq('session_id', sessionId)
                .order('slot_number', { ascending: true });

            if (error) {
                console.error('Error fetching slots:', error);
                return;
            }

            const mappedSlots: HourlySlot[] = (data || []).map((s: any) => ({
                id: s.id,
                sessionId: s.session_id,
                slotNumber: s.slot_number,
                slotStart: s.slot_start,
                slotEnd: s.slot_end,
                plan: s.plan,
                planSubmittedAt: s.plan_submitted_at,
                report: s.report,
                reportSubmittedAt: s.report_submitted_at,
                status: s.status,
            }));

            setSlots(mappedSlots);

            // Find current active slot (plan submitted but no report yet, or pending)
            const current = mappedSlots.find(
                s => s.status === 'plan_submitted' || s.status === 'pending'
            );
            setCurrentSlot(current || null);

            // Find missed slots
            const missed = mappedSlots.filter(s => s.status === 'missed');
            setMissedSlots(missed);
        } catch (error) {
            console.error('Error in useShiftHourlySlots:', error);
        } finally {
            setIsLoading(false);
        }
    }, [sessionId]);

    useEffect(() => {
        fetchSlots();
    }, [fetchSlots]);

    const submitPlan = async (slotId: string, plan: string) => {
        setIsSubmitting(true);

        try {
            const { error } = await (supabase
                .from('shift_hourly_slots') as any)
                .update({
                    plan,
                    plan_submitted_at: new Date().toISOString(),
                    status: 'plan_submitted',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', slotId);

            if (error) throw error;

            toast.success('Plan submitted');
            await fetchSlots();
            return { success: true };
        } catch (error: any) {
            console.error('Error submitting plan:', error);
            toast.error('Failed to submit plan');
            return { success: false, error: error.message };
        } finally {
            setIsSubmitting(false);
        }
    };

    const submitReport = async (slotId: string, report: string) => {
        if (!sessionId) return { success: false, error: 'No session' };

        setIsSubmitting(true);

        try {
            // End current slot and mark as reported
            const { error: updateError } = await (supabase
                .from('shift_hourly_slots') as any)
                .update({
                    report,
                    report_submitted_at: new Date().toISOString(),
                    slot_end: new Date().toISOString(),
                    status: 'report_submitted',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', slotId);

            if (updateError) throw updateError;

            // Get the slot we just updated to get slot number
            const slot = slots.find(s => s.id === slotId);
            const nextSlotNumber = slot ? slot.slotNumber + 1 : slots.length + 1;

            // Create next slot (pending plan)
            const { error: insertError } = await (supabase
                .from('shift_hourly_slots') as any)
                .insert({
                    session_id: sessionId,
                    slot_number: nextSlotNumber,
                    slot_start: new Date().toISOString(),
                    status: 'pending',
                });

            if (insertError) {
                console.error('Error creating next slot:', insertError);
            }

            toast.success('Report submitted');
            await fetchSlots();
            return { success: true };
        } catch (error: any) {
            console.error('Error submitting report:', error);
            toast.error('Failed to submit report');
            return { success: false, error: error.message };
        } finally {
            setIsSubmitting(false);
        }
    };

    const createNextSlot = async (plan: string) => {
        if (!sessionId) return { success: false, error: 'No session' };

        setIsSubmitting(true);

        try {
            const nextSlotNumber = slots.length + 1;

            const { data, error } = await (supabase
                .from('shift_hourly_slots') as any)
                .insert({
                    session_id: sessionId,
                    slot_number: nextSlotNumber,
                    slot_start: new Date().toISOString(),
                    plan,
                    plan_submitted_at: new Date().toISOString(),
                    status: 'plan_submitted',
                })
                .select()
                .single();

            if (error) throw error;

            toast.success('Next hour started');
            await fetchSlots();
            return { success: true, data };
        } catch (error: any) {
            console.error('Error creating slot:', error);
            toast.error('Failed to start next hour');
            return { success: false, error: error.message };
        } finally {
            setIsSubmitting(false);
        }
    };

    // Check if we need to prompt for a new slot (more than 1 hour since last slot start)
    const needsNewSlot = useCallback((): boolean => {
        if (!currentSlot) return slots.length === 0;

        const slotStart = new Date(currentSlot.slotStart);
        const now = new Date();
        const hoursSinceStart = (now.getTime() - slotStart.getTime()) / (1000 * 60 * 60);

        return hoursSinceStart >= 1 && currentSlot.status === 'plan_submitted';
    }, [currentSlot, slots.length]);

    return {
        slots,
        currentSlot,
        missedSlots,
        hasMissedSlots: missedSlots.length > 0,
        needsNewSlot: needsNewSlot(),
        completedSlots: slots.filter(s => s.status === 'report_submitted').length,
        isLoading,
        isSubmitting,
        submitPlan,
        submitReport,
        createNextSlot,
        refetch: fetchSlots,
    };
}
