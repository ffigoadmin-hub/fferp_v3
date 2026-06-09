import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TopDepartment {
    dept: string;
    avgScore: number;
    reason: string;
}

export interface StrategicConcern {
    concern: string;
    impact: 'high' | 'medium';
    evidence: string;
}

export interface SuccessStory {
    title: string;
    description: string;
}

export interface StrategicRecommendation {
    recommendation: string;
    timeframe: 'short-term' | 'mid-term' | 'long-term';
    expectedROI: string;
}

export interface MonthlyReport {
    id: string;
    month: string;
    generated_at: string;
    avg_org_score: number;
    total_active_employees: number;
    improvement_from_last_month: number;
    top_departments: TopDepartment[];
    strategic_concerns: StrategicConcern[];
    success_stories: SuccessStory[];
    quarterly_projection: string;
    executive_summary: string;
    detailed_analysis: string;
    strategic_recommendations: StrategicRecommendation[];
}

interface UseMonthlyReportsReturn {
    report: MonthlyReport | null;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}

export function useMonthlyReports(): UseMonthlyReportsReturn {
    const [report, setReport] = useState<MonthlyReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchReport = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const { data, error: fetchError } = await supabase
                .from('ai_monthly_reports' as any)
                .select('*')
                .order('month', { ascending: false })
                .limit(1)
                .single();

            if (fetchError) {
                if (fetchError.code === 'PGRST116') {
                    setReport(null);
                    return;
                }
                throw fetchError;
            }

            setReport(data as unknown as MonthlyReport);
        } catch (err) {
            console.error('[useMonthlyReports] Error:', err);
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    return {
        report,
        isLoading,
        error,
        refetch: fetchReport,
    };
}
