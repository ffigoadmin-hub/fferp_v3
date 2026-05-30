import { isMissingTable } from '@/lib/supabase-error-guard';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { calculateTransportAmount, type TransportExpenseRow } from '@/lib/transportHelpers';

export function useTransportExpenses(filters?: {
    status?: string;
    paymentStatus?: string;
    department?: string;
    category?: string;
    dateFrom?: string;
    dateTo?: string;
}) {
    const { user } = useAuth();
    const [expenses, setExpenses] = useState<TransportExpenseRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const fetchExpenses = useCallback(async () => {
        if (!user) { setIsLoading(false); return; }
        try {
            let query = (supabase.from('transport_expenses') as any)
                .select('*')
                .neq('status', 'draft') // Prevent drafts from leaking into public lists
                .order('trip_date', { ascending: false });

            if (filters?.status) query = query.eq('status', filters.status);
            if (filters?.paymentStatus) query = query.eq('payment_status', filters.paymentStatus);
            if (filters?.department) query = query.eq('department', filters.department);
            if (filters?.category) query = query.eq('category_code', filters.category);
            if (filters?.dateFrom) query = query.gte('trip_date', filters.dateFrom);
            if (filters?.dateTo) query = query.lte('trip_date', filters.dateTo);

            const { data, error } = await query;
            if (error) throw error;

            // Enrich with creator profiles
            const creatorIds = [...new Set((data || []).map((e: any) => e.created_by).filter(Boolean))];
            let profileMap: Record<string, { name: string; email: string; department: string }> = {};
            if (creatorIds.length > 0) {
                const { data: profiles } = await (supabase.from('profiles') as any)
                    .select('id, name, email, department')
                    .in('id', creatorIds);
                if (profiles) {
                    profileMap = Object.fromEntries(profiles.map((p: any) => [p.id, { name: p.name, email: p.email, department: p.department }]));
                }
            }

            const enriched = (data || []).map((e: any) => ({
                ...e,
                creator: profileMap[e.created_by] || null,
            }));

            setExpenses(enriched);
        } catch (error) {
            console.error('Error fetching transport expenses:', error);
            if (!isMissingTable(error)) toast.error('Failed to load transport expenses');
        } finally {
            setIsLoading(false);
        }
    }, [user, JSON.stringify(filters)]);

    useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

    const createExpense = async (data: {
        tripDate: string;
        fromLocation: string;
        toLocation: string;
        totalKm: number;
        ratePerKm: number;
        categoryCode: string;
        purpose: string;
        vendorName?: string;
        driverName?: string;
        vehicleNumber?: string;
        proofFileUrl: string;
        proofFileName?: string;
    }) => {
        if (!user) return null;
        setIsSaving(true);
        try {
            const totalAmount = calculateTransportAmount(data.totalKm, data.ratePerKm);
            const userDept = user.department || 'Others';

            const { data: result, error } = await (supabase.from('transport_expenses') as any)
                .insert({
                    trip_date: data.tripDate,
                    from_location: data.fromLocation,
                    to_location: data.toLocation,
                    total_km: data.totalKm,
                    rate_per_km: data.ratePerKm,
                    total_amount: totalAmount,
                    category_code: data.categoryCode,
                    purpose: data.purpose,
                    vendor_name: data.vendorName || null,
                    driver_name: data.driverName || null,
                    vehicle_number: data.vehicleNumber || null,
                    proof_file_url: data.proofFileUrl,
                    proof_file_name: data.proofFileName || null,
                    department: userDept,
                    created_by: user.id,
                })
                .select()
                .single();

            if (error) throw error;
            toast.success('Transport expense submitted');
            await fetchExpenses();
            return result;
        } catch (error: any) {
            console.error('Error creating transport expense:', error);
            toast.error(error.message || 'Failed to submit transport expense');
            return null;
        } finally {
            setIsSaving(false);
        }
    };

    const createBatchExpenses = async (entries: Array<{
        tripDate: string;
        fromLocation: string;
        toLocation: string;
        totalKm: number;
        ratePerKm: number;
        categoryCode: string;
        purpose: string;
        vendorName?: string;
        driverName?: string;
        vehicleNumber?: string;
        proofFileUrl: string;
        proofFileName?: string;
    }>) => {
        if (!user || entries.length === 0) return null;
        setIsSaving(true);
        try {
            const batchId = crypto.randomUUID();
            const userDept = user.department || 'Others';
            let totalKmSum = 0;
            let totalAmountSum = 0;

            const rows = entries.map(e => {
                const amt = calculateTransportAmount(e.totalKm, e.ratePerKm);
                totalKmSum += e.totalKm;
                totalAmountSum += amt;
                return {
                    trip_date: e.tripDate,
                    from_location: e.fromLocation,
                    to_location: e.toLocation,
                    total_km: e.totalKm,
                    rate_per_km: e.ratePerKm,
                    total_amount: amt,
                    category_code: e.categoryCode,
                    purpose: e.purpose,
                    vendor_name: e.vendorName || null,
                    driver_name: e.driverName || null,
                    vehicle_number: e.vehicleNumber || null,
                    proof_file_url: e.proofFileUrl,
                    proof_file_name: e.proofFileName || null,
                    department: userDept,
                    batch_id: batchId,
                    is_batch_entry: true,
                    created_by: user.id,
                };
            });

            const { error: insertError } = await (supabase.from('transport_expenses') as any).insert(rows);
            if (insertError) throw insertError;

            // Create batch record
            await (supabase.from('transport_batch_entries') as any).insert({
                batch_id: batchId,
                batch_name: `Batch ${new Date().toLocaleString('en-IN')}`,
                total_trips: entries.length,
                total_km: totalKmSum,
                total_amount: totalAmountSum,
                created_by: user.id,
            });

            toast.success(`${entries.length} transport expenses submitted as batch`);
            await fetchExpenses();
            return batchId;
        } catch (error: any) {
            console.error('Error creating batch transport expenses:', error);
            toast.error(error.message || 'Failed to submit batch');
            return null;
        } finally {
            setIsSaving(false);
        }
    };

    const createAdvancedTransportBatch = async (data: {
        batchName?: string;
        cutoffDate: string;
        cutoffTime: string;
        proofUrls: string[];
        bankProofUrl?: string;
        status?: string;
        entries: Array<{
            tripDate: string;
            fromLocation: string;
            toLocation: string;
            totalKm: number;
            ratePerKm: number;
            categoryCode: string;
            purpose: string;
            vendorName?: string;
            driverName?: string;
            vehicleNumber?: string;
            proofFileUrl: string;
            proofFileName?: string;
        }>;
        beneficiaries: Array<{
            payeeName: string;
            amount: number;
            paymentMethod: string;
            accountNumber?: string;
            ifscCode?: string;
            upiId?: string;
            beneficiaryName?: string;
        }>;
    }) => {
        if (!user || data.entries.length === 0) return null;
        setIsSaving(true);
        try {
            const batchId = crypto.randomUUID();
            const userDept = user.department || 'Others';
            let totalKmSum = 0;
            let totalAmountSum = 0;

            // 1. Prepare Trip Rows
            const tripRows = data.entries.map(e => {
                const amt = calculateTransportAmount(e.totalKm, e.ratePerKm);
                totalKmSum += e.totalKm;
                totalAmountSum += amt;
                return {
                    trip_date: e.tripDate,
                    from_location: e.fromLocation,
                    to_location: e.toLocation,
                    total_km: e.totalKm,
                    rate_per_km: e.ratePerKm,
                    total_amount: amt,
                    category_code: e.categoryCode,
                    purpose: e.purpose,
                    vendor_name: e.vendorName || null,
                    driver_name: e.driverName || null,
                    vehicle_number: e.vehicleNumber || null,
                    proof_file_url: e.proofFileUrl,
                    proof_file_name: e.proofFileName || null,
                    department: userDept,
                    batch_id: batchId,
                    is_batch_entry: true,
                    created_by: user.id,
                    status: data.status || 'pending'
                };
            });

            // 2. Create Batch Entry Record
            const { error: batchError } = await (supabase.from('transport_batch_entries') as any).insert({
                id: batchId,
                batch_id: batchId,
                batch_name: data.batchName || `Batch ${new Date().toLocaleString('en-IN')}`,
                total_trips: data.entries.length,
                total_km: totalKmSum,
                total_amount: totalAmountSum,
                created_by: user.id,
                cutoff_date: data.cutoffDate,
                cutoff_time: data.cutoffTime,
                proof_folder_url: data.proofUrls.length > 0 ? JSON.stringify(data.proofUrls) : null,
                bank_proof_url: data.bankProofUrl || null,
                status: data.status || 'pending'
            });

            if (batchError) throw batchError;

            // 3. Create Trip Records
            const { error: tripError } = await (supabase.from('transport_expenses') as any).insert(tripRows);
            if (tripError) throw tripError;

            // 4. Create Split Payment Records (if any)
            if (data.beneficiaries.length > 0) {
                const splitRows = data.beneficiaries.map(b => ({
                    batch_id: batchId,
                    payee_name: b.payeeName,
                    amount: b.amount,
                    payment_method: b.paymentMethod,
                    account_number: b.accountNumber,
                    ifsc_code: b.ifscCode,
                    upi_id: b.upiId,
                    beneficiary_name: b.beneficiaryName
                }));
                const { error: splitError } = await (supabase.from('transport_split_payments') as any).insert(splitRows);
                if (splitError) throw splitError;
            }

            toast.success('Transport batch with payees submitted successfully');
            await fetchExpenses();
            return batchId;
        } catch (error: any) {
            console.error('Error creating advanced batch:', error);
            toast.error(error.message || 'Failed to submit advanced batch');
            return null;
        } finally {
            setIsSaving(false);
        }
    };

    const approveExpense = async (expenseId: string) => {
        if (!user) return false;
        setIsSaving(true);
        try {
            const role = user.role?.toLowerCase() || '';
            const now = new Date().toISOString();
            let updates: any = {};

            if (['director', 'nsm', 'gm', 'gmo', 'smo', 'boi'].includes(role)) {
                updates = { dept_head_approved_by: user.id, dept_head_approved_at: now, status: 'dept_head_approved' };
            } else if (role === 'admin') {
                updates = { admin_approved_by: user.id, admin_approved_at: now, status: 'admin_approved' };
            } else if (role === 'accounts') {
                updates = { accounts_approved_by: user.id, accounts_approved_at: now, status: 'accounts_approved' };
            }

            const { error } = await (supabase.from('transport_expenses') as any)
                .update(updates)
                .eq('id', expenseId);

            if (error) throw error;
            toast.success('Expense approved');
            await fetchExpenses();
            return true;
        } catch (error: any) {
            toast.error(error.message || 'Failed to approve');
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const rejectExpense = async (expenseId: string, reason: string) => {
        if (!user) return false;
        setIsSaving(true);
        try {
            const { error } = await (supabase.from('transport_expenses') as any)
                .update({
                    status: 'rejected',
                    rejected_by: user.id,
                    rejected_at: new Date().toISOString(),
                    rejection_reason: reason,
                })
                .eq('id', expenseId);
            if (error) throw error;
            toast.success('Expense rejected');
            await fetchExpenses();
            return true;
        } catch (error: any) {
            toast.error(error.message || 'Failed to reject');
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const markAsPaid = async (expenseId: string, paymentData: {
        paymentDate: string;
        utrNumber?: string;
        paymentMode?: string;
        remarks?: string;
    }) => {
        if (!user) return false;
        setIsSaving(true);
        try {
            const { error } = await (supabase.from('transport_expenses') as any)
                .update({
                    payment_status: 'paid',
                    status: 'paid',
                    paid_by: user.id,
                    paid_at: new Date().toISOString(),
                    payment_date: paymentData.paymentDate,
                    utr_number: paymentData.utrNumber || null,
                    payment_mode: paymentData.paymentMode || null,
                    payment_remarks: paymentData.remarks || null,
                })
                .eq('id', expenseId);
            if (error) throw error;
            toast.success('Marked as paid');
            await fetchExpenses();
            return true;
        } catch (error: any) {
            toast.error(error.message || 'Failed to mark as paid');
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const deleteTransportDraft = async (batchId: string) => {
        try {
            await (supabase.from('transport_expenses') as any).delete().eq('batch_id', batchId);
            await (supabase.from('transport_split_payments') as any).delete().eq('batch_id', batchId);
            const { error } = await (supabase.from('transport_batch_entries') as any).delete().eq('batch_id', batchId).eq('status', 'draft');
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error deleting transport draft:', error);
            toast.error('Failed to delete draft');
            return false;
        }
    };

    return {
        expenses,
        isLoading,
        isSaving,
        createExpense,
        createBatchExpenses,
        createAdvancedTransportBatch,
        approveExpense,
        rejectExpense,
        markAsPaid,
        deleteTransportDraft,
        refetch: fetchExpenses,
    };
}
