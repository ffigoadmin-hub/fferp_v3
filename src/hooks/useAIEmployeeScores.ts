import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export interface AIEmployeeScore {
    id: string;
    user_id: string;
    date: string;
    last_updated: string;
    ai_score: number;
    ai_status: 'working_productively' | 'idle' | 'needs_attention';
    ai_analysis: string;
    punctuality_score: number;
    plan_quality_score: number;
    report_quality_score: number;
    consistency_score: number;
    model_version: string;
    analysis_timestamp: string;
}

export interface AIScoreWithProfile extends AIEmployeeScore {
    userName: string;
    department: string;
    role: string;
}

interface UseAIEmployeeScoresReturn {
    scores: AIScoreWithProfile[];
    isLoading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    getScoreByUserId: (userId: string) => AIScoreWithProfile | undefined;
    averageScore: number;
    statusCounts: {
        working_productively: number;
        idle: number;
        needs_attention: number;
    };
}

export function useAIEmployeeScores(date: Date = new Date()): UseAIEmployeeScoresReturn {
    const [scores, setScores] = useState<AIScoreWithProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    // Generate date string in IST/Local format (YYYY-MM-DD) to match database records
    const dateStr = format(date, 'yyyy-MM-dd');

    const fetchScores = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Fetch AI scores for the date
            const { data: aiScores, error: scoresError } = await supabase
                .from('ai_employee_scores' as any)
                .select('*')
                .eq('date', dateStr);

            if (scoresError) {
                // Table might not exist yet
                if (scoresError.code === '42P01') {
                    console.log('[useAIEmployeeScores] Table not yet created');
                    setScores([]);
                    setIsLoading(false);
                    return;
                }
                throw scoresError;
            }

            if (!aiScores || aiScores.length === 0) {
                setScores([]);
                setIsLoading(false);
                return;
            }

            // Fetch profile info for users with scores
            const userIds = aiScores.map((s: any) => s.user_id);
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('id, name, department, role')
                .in('id', userIds);

            if (profileError) throw profileError;

            // Merge scores with profile data
            const scoresWithProfiles: AIScoreWithProfile[] = aiScores.map((score: any) => {
                const profile = profiles?.find(p => p.id === score.user_id);
                return {
                    ...score,
                    userName: profile?.name || 'Unknown',
                    department: profile?.department || 'Unknown',
                    role: profile?.role || 'employee',
                };
            });

            // Sort by score descending
            scoresWithProfiles.sort((a, b) => b.ai_score - a.ai_score);

            setScores(scoresWithProfiles);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to fetch AI scores';
            setError(errorMsg);
            console.error('[useAIEmployeeScores] Error:', err);
        } finally {
            setIsLoading(false);
        }
    }, [dateStr]);

    useEffect(() => {
        fetchScores();

        // Set up realtime subscription
        const channel = supabase
            .channel('ai-scores-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'ai_employee_scores',
                    filter: `date=eq.${dateStr}`,
                },
                (payload) => {
                    console.log('[useAIEmployeeScores] Realtime update:', payload);
                    fetchScores();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchScores, dateStr]);

    const getScoreByUserId = useCallback(
        (userId: string) => scores.find(s => s.user_id === userId),
        [scores]
    );

    const averageScore = scores.length > 0
        ? Math.round(scores.reduce((sum, s) => sum + s.ai_score, 0) / scores.length)
        : 0;

    const statusCounts = {
        working_productively: scores.filter(s => s.ai_status === 'working_productively').length,
        idle: scores.filter(s => s.ai_status === 'idle').length,
        needs_attention: scores.filter(s => s.ai_status === 'needs_attention').length,
    };

    return {
        scores,
        isLoading,
        error,
        refetch: fetchScores,
        getScoreByUserId,
        averageScore,
        statusCounts,
    };
}
