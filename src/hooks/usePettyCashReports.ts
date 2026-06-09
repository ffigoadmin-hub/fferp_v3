import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { notifyRoles, notifyUser } from '@/utils/notificationUtils';

export interface PettyCashReport {
    id: string;
    report_number: number;
    period_start: string;
    period_end: string;
    total_amount: number;
    transaction_count: number;
    status: 'draft' | 'submitted' | 'auditor_reviewed' | 'director_approved' | 'closed';
    created_at: string;
    opening_balance?: number;
    closing_balance?: number;
    notes?: string;
}

export interface RefillRequest {
    id: string;
    refill_number: number;
    report_id: string;
    requested_amount: number;
    current_balance: number;
    status: 'pending_director' | 'director_approved' | 'admin_approved' | 'ceo_approved' | 'accounts_executed' | 'completed';
    created_at: string;
    payment_request_id?: string;
    notes?: string;
}

export function usePettyCashReports() {
    const { user } = useAuth();
    const [reports, setReports] = useState<PettyCashReport[]>([]);
    const [refillRequests, setRefillRequests] = useState<RefillRequest[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchReports = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await (supabase as any)
                .from('petty_cash_reports')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setReports((data || []) as PettyCashReport[]);
        } catch (error) {
            console.warn('[PettyCashReports] Table may not exist yet:', (error as any)?.message);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchRefillRequests = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await (supabase as any)
                .from('petty_cash_refill_requests')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRefillRequests((data || []) as RefillRequest[]);
        } catch (error) {
            console.warn('[PettyCashReports] Table may not exist yet:', (error as any)?.message);
        } finally {
            setIsLoading(false);
        }
    };

    const updateReportStatus = async (reportId: string, status: PettyCashReport['status'], notes?: string) => {
        try {
            const updateData: any = { status };
            if (notes) updateData.notes = notes;

            if (status === 'auditor_reviewed') {
                updateData.auditor_reviewed_at = new Date().toISOString();
                updateData.auditor_reviewed_by = user?.id;
            } else if (status === 'director_approved') {
                updateData.director_approved_at = new Date().toISOString();
                updateData.director_approved_by = user?.id;
            }

            const { error } = await (supabase as any)
                .from('petty_cash_reports')
                .update(updateData)
                .eq('id', reportId);

            if (error) throw error;

            // Notifications for Audit lifecycle
            if (status === 'submitted') {
                await notifyRoles({
                    roles: ['auditor'],
                    title: '📋 Audit Report Submitted',
                    message: `Audit report (Report #${reportId.substring(0, 8)}) has been submitted and is ready for your review.`,
                    relatedId: reportId
                });
            } else if (status === 'auditor_reviewed') {
                await notifyRoles({
                    roles: ['director', 'Director'],
                    title: '🔍 Audit Reviewed by Auditor',
                    message: `Auditor has reviewed the Audit report. Final approval needed from Director.`,
                    relatedId: reportId
                });
            } else if (status === 'director_approved') {
                await notifyRoles({
                    roles: ['accounts', 'admin'],
                    title: '✅ Audit Approved by Director',
                    message: `Audit report has been approved by the Director. Refill request can proceed.`,
                    relatedId: reportId
                });
            }

            toast.success(`Report status updated to ${status}`);
            fetchReports();
            return { success: true };
        } catch (error) {
            console.error('Error updating report status:', error);
            toast.error('Failed to update report status');
            return { success: false };
        }
    };

    const updateRefillStatus = async (refillId: string, status: RefillRequest['status'], notes?: string) => {
        try {
            const updateData: any = { status };
            if (notes) updateData.notes = notes;

            if (status === 'director_approved') {
                updateData.director_approved_by = user?.id;
            } else if (status === 'admin_approved') {
                updateData.admin_approved_by = user?.id;
            } else if (status === 'ceo_approved') {
                updateData.ceo_approved_by = user?.id;
            } else if (status === 'accounts_executed') {
                updateData.accounts_executed_by = user?.id;
                updateData.accounts_executed_at = new Date().toISOString();
            }

            const { error } = await (supabase as any)
                .from('petty_cash_refill_requests')
                .update(updateData)
                .eq('id', refillId);

            if (error) throw error;

            // Notifications for Refill lifecycle
            if (status === 'director_approved') {
                await notifyRoles({
                    roles: ['admin'],
                    title: '💰 Refill Approved by Director',
                    message: `Refill request has been approved by Director. Admin approval needed.`,
                    relatedId: refillId
                });
            } else if (status === 'admin_approved') {
                await notifyRoles({
                    roles: ['ceo'],
                    title: '💎 Refill Approved by Admin',
                    message: `Refill request has been approved by Admin. Final CEO approval needed.`,
                    relatedId: refillId
                });
            } else if (status === 'ceo_approved') {
                await notifyRoles({
                    roles: ['accounts'],
                    title: '💸 Refill Approved by CEO',
                    message: `Refill request has received final CEO approval. Accounts can now execute the refill.`,
                    relatedId: refillId
                });
            } else if (status === 'accounts_executed') {
                await notifyRoles({
                    roles: ['accounts', 'admin'],
                    title: '🏦 Refill Executed',
                    message: `The refill amount has been processed and ready to be marked as completed in the ledger.`,
                    relatedId: refillId
                });
            }

            toast.success(`Refill status updated to ${status}`);
            fetchRefillRequests();
            return { success: true };
        } catch (error) {
            console.error('Error updating refill status:', error);
            toast.error('Failed to update refill status');
            return { success: false };
        }
    };

    useEffect(() => {
        if (user) {
            fetchReports();
            fetchRefillRequests();
        }
    }, [user]);

    const notifyRole = async (roles: string[], title: string, message: string, relatedId?: string, type: string = 'payment_status') => {
        try {
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id')
                .in('role', roles);

            if (profiles && profiles.length > 0) {
                const notifications = profiles.map(p => ({
                    user_id: p.id,
                    type,
                    title,
                    message,
                    role: roles[0],
                    related_record_id: relatedId
                }));

                const { error } = await supabase.from('notifications').insert(notifications);
                if (error) throw error;
            }
        } catch (err) {
            console.error('Failed to send group notifications:', err);
        }
    };

    const createManualRefillRequest = async (amount: number, notes?: string): Promise<{ success: boolean }> => {
        if (!user) return { success: false };
        try {
            // Fetch current balance
            const { data: latestLedger } = await (supabase as any)
                .from('petty_cash_ledger')
                .select('balance_after')
                .order('executed_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            const currentBalance = (latestLedger as any)?.balance_after ?? 0;

            const { error } = await (supabase as any)
                .from('petty_cash_refill_requests')
                .insert({
                    requested_amount: amount,
                    current_balance: currentBalance,
                    status: 'pending_director',
                    notes: notes || 'Manual refill request'
                });

            if (error) throw error;

            await notifyRoles({
                roles: ['director', 'Director', 'admin', 'ceo', 'accounts'],
                title: '💰 Manual Petty Cash Refill Request',
                message: `A manual refill request of ₹${amount.toLocaleString()} has been raised. Current balance: ₹${currentBalance.toLocaleString()}.`,
                type: 'payment_status'
            });

            toast.success('Manual refill request created successfully');
            fetchRefillRequests();
            return { success: true };
        } catch (error) {
            console.error('Error creating manual refill:', error);
            toast.error('Failed to create refill request');
            return { success: false };
        }
    };

    const fetchReportLedger = async (reportId: string) => {
        try {
            const { data, error } = await (supabase as any)
                .from('petty_cash_ledger')
                .select('*')
                .eq('report_id', reportId)
                .order('executed_at', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching report ledger:', error);
            return [];
        }
    };

    return {
        reports,
        refillRequests,
        isLoading,
        fetchReports,
        fetchRefillRequests,
        fetchReportLedger,
        updateReportStatus,
        updateRefillStatus,
        createManualRefillRequest,
        notifyRole
    };
}
