import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EODReport {
    id: string;
    sessionId: string;
    summary: string;
    submittedAt: string;
    createdAt: string;
}

export interface SubmitEODParams {
    sessionId: string;
    summary: string;
}

export function useShiftEOD(sessionId: string | undefined | null) {
    const queryClient = useQueryClient();

    const { data: eodSummary, isLoading: loading } = useQuery({
        queryKey: ['shift-eod', sessionId],
        queryFn: async () => {
            if (!sessionId) return null;
            const { data, error } = await (supabase
                .from('shift_eod_reports') as any)
                .select('*')
                .eq('session_id', sessionId)
                .maybeSingle();

            if (error) throw error;
            if (!data) return null;

            return {
                id: data.id,
                sessionId: data.session_id,
                summary: data.summary,
                submittedAt: data.submitted_at,
                createdAt: data.created_at
            } as EODReport;
        },
        enabled: !!sessionId
    });

    const submitMutation = useMutation({
        mutationFn: async (params: SubmitEODParams) => {
            if (!sessionId) throw new Error("No Session ID");

            const payload = {
                session_id: sessionId,
                summary: params.summary,
                submitted_at: new Date().toISOString()
            };

            // Using Upsert if session_id is unique, though currently schema doesn't strictly enforce unique session_id on DB level for EOD, 
            // but logic implies 1 report per session. The table definition I made doesn't have unique constraint on session_id,
            // so safe to use insert? OR actually I should check if exists.
            // But wait, the previous hook used upsert.
            // Let's assume 1 per session.

            // First check if exists to update, or just insert.
            // Since I didn't add a unique constraint on session_id in schema, upsert might fail or create duplicates if I don't specify onConflict.
            // But 'id' is primary key.
            // I'll query first.

            const existing = eodSummary;

            let result;
            if (existing) {
                result = await (supabase
                    .from('shift_eod_reports') as any)
                    .update(payload)
                    .eq('id', existing.id);
            } else {
                result = await (supabase
                    .from('shift_eod_reports') as any)
                    .insert(payload);
            }

            if (result.error) throw result.error;
            return { success: true };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shift-eod', sessionId] });
            toast.success('EOD Report submitted');
        },
        onError: (err: any) => {
            console.error('EOD Submit Error:', err);
            toast.error(err.message || 'Failed to submit EOD');
        }
    });

    return {
        eodSummary,
        loading,
        submitEOD: (summary: string) => {
            return submitMutation.mutateAsync({ sessionId: sessionId || '', summary });
        },
        isSubmitting: submitMutation.isPending
    };
}
