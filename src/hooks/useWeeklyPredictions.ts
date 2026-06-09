import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AtRiskEmployee {
    userId: string;
    reason: string;
    riskLevel: 'high' | 'medium';
}

export interface TopPerformer {
    userId: string;
    highlight: string;
}

export interface RecommendedAction {
    priority: 'high' | 'medium' | 'low';
    action: string;
    target: 'management' | 'hr' | 'employees';
}

export interface WeeklyPrediction {
    id: string;
    week_start: string;
    week_end: string;
    generated_at: string;
    org_trend: 'improving' | 'stable' | 'declining';
    org_avg_score: number;
    org_prediction: string;
    at_risk_employees: AtRiskEmployee[];
    top_performers: TopPerformer[];
    department_insights: Record<string, string>;
    recommended_actions: RecommendedAction[];
    full_analysis: string;
}

interface UseWeeklyPredictionsReturn {
    prediction: WeeklyPrediction | null;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}

export function useWeeklyPredictions(): UseWeeklyPredictionsReturn {
    const [prediction, setPrediction] = useState<WeeklyPrediction | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchPrediction = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const { data, error: fetchError } = await supabase
                .from('ai_weekly_predictions' as any)
                .select('*')
                .order('week_start', { ascending: false })
                .limit(1)
                .single();

            if (fetchError) {
                if (fetchError.code === 'PGRST116') {
                    // No prediction found
                    setPrediction(null);
                    return;
                }
                throw fetchError;
            }

            setPrediction(data as unknown as WeeklyPrediction);
        } catch (err) {
            console.error('[useWeeklyPredictions] Error:', err);
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPrediction();
    }, [fetchPrediction]);

    return {
        prediction,
        isLoading,
        error,
        refetch: fetchPrediction,
    };
}
