import { isMissingTable } from '@/lib/supabase-error-guard';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface FraudAlert {
    id: string;
    alert_type: string;
    requester_id: string | null;
    vendor_name: string | null;
    payment_ids: string[];
    pattern_description: string;
    severity: 'low' | 'medium' | 'high';
    reviewed_by: string | null;
    reviewed_at: string | null;
    review_notes: string | null;
    status: 'pending' | 'reviewed' | 'dismissed';
    created_at: string;
}

export function useFraudAlerts(statusFilter: string[] = ['pending']) {
    const { user } = useAuth();
    const [alerts, setAlerts] = useState<FraudAlert[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState({
        total: 0,
        pending: 0,
        high: 0,
        reviewed: 0,
    });

    const fetchAlerts = useCallback(async () => {
        if (!user) return;

        // Only admin/ceo can access
        if (!['admin', 'ceo'].includes(user.role)) {
            setIsLoading(false);
            return;
        }

        try {
            let query = (supabase
                .from('fraud_pattern_alerts') as any)
                .select('*')
                .order('created_at', { ascending: false });

            if (statusFilter.length > 0) {
                query = query.in('status', statusFilter);
            }

            const { data, error } = await query.limit(100);

            if (error) throw error;

            setAlerts((data || []) as FraudAlert[]);

            // Fetch stats
            const { data: allAlerts } = await (supabase
                .from('fraud_pattern_alerts') as any)
                .select('status, severity');

            if (allAlerts) {
                setStats({
                    total: allAlerts.length,
                    pending: allAlerts.filter((a: any) => a.status === 'pending').length,
                    high: allAlerts.filter((a: any) => a.severity === 'high' && a.status === 'pending').length,
                    reviewed: allAlerts.filter((a: any) => a.status === 'reviewed').length,
                });
            }
        } catch (err) {
            console.error('Error fetching fraud alerts:', err);
            if (!isMissingTable(error)) toast.error('Failed to load fraud alerts');
        } finally {
            setIsLoading(false);
        }
    }, [user, JSON.stringify(statusFilter)]);

    useEffect(() => {
        fetchAlerts();

        // Subscribe to real-time changes
        const channel = supabase
            .channel('fraud-alerts-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'fraud_pattern_alerts'
                },
                () => {
                    fetchAlerts();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchAlerts]);

    const markReviewed = useCallback(async (alertId: string, notes: string) => {
        if (!user) return;

        try {
            const { error } = await (supabase
                .from('fraud_pattern_alerts') as any)
                .update({
                    status: 'reviewed',
                    reviewed_by: user.id,
                    reviewed_at: new Date().toISOString(),
                    review_notes: notes,
                })
                .eq('id', alertId);

            if (error) throw error;

            toast.success('Alert marked as reviewed');
            fetchAlerts();
        } catch (err) {
            console.error('Error reviewing alert:', err);
            toast.error('Failed to update alert');
        }
    }, [user, fetchAlerts]);

    const dismiss = useCallback(async (alertId: string, notes: string) => {
        if (!user) return;

        try {
            const { error } = await (supabase
                .from('fraud_pattern_alerts') as any)
                .update({
                    status: 'dismissed',
                    reviewed_by: user.id,
                    reviewed_at: new Date().toISOString(),
                    review_notes: notes || 'Dismissed',
                })
                .eq('id', alertId);

            if (error) throw error;

            toast.success('Alert dismissed');
            fetchAlerts();
        } catch (err) {
            console.error('Error dismissing alert:', err);
            toast.error('Failed to dismiss alert');
        }
    }, [user, fetchAlerts]);

    return {
        alerts,
        isLoading,
        stats,
        markReviewed,
        dismiss,
        refetch: fetchAlerts,
    };
}
