import { isMissingTable } from '@/lib/supabase-error-guard';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { notifyRoles } from '@/utils/notificationUtils';

// ========================================
// Petty Cash / Daily Expense Sheet Module
// ========================================

export interface DailyExpenseEntry {
    id: string;
    payment_request_id: string | null;
    expense_date: string;
    vendor_name: string;
    amount: number;
    department: string;
    category: string | null;
    approved_by: string | null;
    approved_at: string | null;
    created_at: string;
}

export interface PettyCashSummary {
    totalAmount: number;
    entryCount: number;
    byDepartment: Record<string, number>;
    byCategory: Record<string, number>;
}

// Low balance threshold to auto-trigger refill
export const LOW_BALANCE_THRESHOLD = 1100;
// Starting petty cash fund amount
export const PETTY_CASH_FUND = 15000;

export function usePettyCash() {
    const { user } = useAuth();
    const [entries, setEntries] = useState<DailyExpenseEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [summary, setSummary] = useState<PettyCashSummary>({
        totalAmount: 0,
        entryCount: 0,
        byDepartment: {},
        byCategory: {}
    });

    const fetchEntries = async (startDate?: Date, endDate?: Date) => {
        try {
            setIsLoading(true);

            let query = (supabase as any)
                .from('daily_expense_sheet')
                .select('*')
                .order('expense_date', { ascending: false });

            if (startDate) {
                query = query.gte('expense_date', format(startDate, 'yyyy-MM-dd'));
            }
            if (endDate) {
                query = query.lte('expense_date', format(endDate, 'yyyy-MM-dd'));
            }

            const { data, error } = await query;

            if (error) throw error;

            const entriesData = (data || []) as DailyExpenseEntry[];
            setEntries(entriesData);

            const byDepartment: Record<string, number> = {};
            const byCategory: Record<string, number> = {};
            let totalAmount = 0;

            entriesData.forEach(entry => {
                totalAmount += Number(entry.amount);
                const dept = entry.department || 'Unknown';
                byDepartment[dept] = (byDepartment[dept] || 0) + Number(entry.amount);
                const cat = entry.category || 'General';
                byCategory[cat] = (byCategory[cat] || 0) + Number(entry.amount);
            });

            setSummary({ totalAmount, entryCount: entriesData.length, byDepartment, byCategory });

        } catch (error) {
            console.error('Error fetching petty cash entries:', error);
            const _isMissing = (error as any)?.code === 'PGRST205' || (error as any)?.message?.includes('schema cache'); if (!_isMissing) if (!isMissingTable(error)) toast.error('Failed to fetch expense entries');
        } finally {
            setIsLoading(false);
        }
    };

    // Initial fetch - from start of month onward for better visibility
    useEffect(() => {
        fetchEntries(startOfMonth(new Date()));
    }, []);

    /**
     * Add entry to daily expense sheet
     */
    const addEntry = async (entry: {
        paymentRequestId?: string;
        vendorName: string;
        amount: number;
        department: string;
        category?: string;
    }): Promise<{ success: boolean; id?: string }> => {
        if (!user) {
            toast.error('Not authenticated');
            return { success: false };
        }

        try {
            const { data, error } = await (supabase
                .from('daily_expense_sheet') as any)
                .insert({
                    payment_request_id: entry.paymentRequestId || null,
                    expense_date: format(new Date(), 'yyyy-MM-dd'),
                    vendor_name: entry.vendorName,
                    amount: entry.amount,
                    department: entry.department,
                    category: entry.category || 'General',
                    approved_by: user.id,
                    approved_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;
            fetchEntries(startOfMonth(new Date()), endOfMonth(new Date()));
            return { success: true, id: data?.id };
        } catch (error) {
            console.error('Error adding expense entry:', error);
            toast.error('Failed to add expense entry');
            return { success: false };
        }
    };

    /**
     * Get monthly utilization report
     */
    const getMonthlyReport = async (year: number, month: number): Promise<{
        entries: DailyExpenseEntry[];
        summary: PettyCashSummary;
    }> => {
        const startDate = new Date(year, month, 1);
        const endDate = endOfMonth(startDate);

        try {
            const { data, error } = await (supabase as any)
                .from('daily_expense_sheet')
                .select('*')
                .gte('expense_date', format(startDate, 'yyyy-MM-dd'))
                .lte('expense_date', format(endDate, 'yyyy-MM-dd'))
                .order('expense_date', { ascending: true });

            if (error) throw error;

            const entriesData = (data || []) as DailyExpenseEntry[];
            const byDepartment: Record<string, number> = {};
            const byCategory: Record<string, number> = {};
            let totalAmount = 0;

            entriesData.forEach(entry => {
                totalAmount += Number(entry.amount);
                const dept = entry.department || 'Unknown';
                byDepartment[dept] = (byDepartment[dept] || 0) + Number(entry.amount);
                const cat = entry.category || 'General';
                byCategory[cat] = (byCategory[cat] || 0) + Number(entry.amount);
            });

            return { entries: entriesData, summary: { totalAmount, entryCount: entriesData.length, byDepartment, byCategory } };
        } catch (error) {
            console.error('Error fetching monthly report:', error);
            throw error;
        }
    };

    /**
     * Get the current petty cash balance from the ledger
     */
    const getCurrentBalance = async (): Promise<number> => {
        try {
            const { data, error } = await (supabase as any)
                .from('petty_cash_ledger')
                .select('balance_after')
                .order('executed_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;
            return (data as any)?.balance_after ?? 0;
        } catch (error) {
            console.warn('[PettyCash] Ledger table may not exist yet:', (error as any)?.message);
            return 0;
        }
    };

    /**
     * Get cumulative spend since the last completed refill
     */
    const getCumulativeSpend = async (): Promise<number> => {
        try {
            const { data: lastRefill, error: refillError } = await (supabase as any)
                .from('petty_cash_refill_requests')
                .select('created_at')
                .eq('status', 'completed')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (refillError) throw refillError;

            // Only sum positive amounts (debits/expenses), not credits (refills)
            let query = (supabase as any)
                .from('petty_cash_ledger')
                .select('amount')
                .gt('amount', 0);

            if (lastRefill) {
                query = query.gt('executed_at', (lastRefill as any).created_at);
            }

            const { data, error } = await query;
            if (error) throw error;

            return (data || []).reduce((sum: number, entry: any) => sum + Number(entry.amount), 0);
        } catch (error) {
            console.warn('[PettyCash] Tables may not exist yet:', (error as any)?.message);
            return 0;
        }
    };

    /**
     * Internal: auto-create a refill request when a threshold is hit.
     * Prevents duplicate refills by checking for active non-completed requests.
     */
    const autoTriggerRefill = async (reason: string, balanceAfter: number, cumulativeSpend: number) => {
        try {
            // 1. Get or create audit report
            const { data: existingReport } = await (supabase as any)
                .from('petty_cash_reports')
                .select('id, opening_balance, status')
                .neq('status', 'closed')
                .limit(1)
                .maybeSingle();

            let reportId: string | null = (existingReport as any)?.id || null;
            let openingBalance = (existingReport as any)?.opening_balance || PETTY_CASH_FUND;

            if (!reportId) {
                // Check if we should even create a new one (avoid spamming if a refill is already active)
                const { data: activeRefill } = await (supabase as any)
                    .from('petty_cash_refill_requests')
                    .select('id')
                    .not('status', 'in', '("completed","closed")')
                    .limit(1)
                    .maybeSingle();

                if (activeRefill) return; // Only block if we are trying to create a NEW audit cycle

                const { data: lastClosed } = await (supabase as any)
                    .from('petty_cash_reports')
                    .select('period_end, closing_balance')
                    .eq('status', 'closed')
                    .order('period_end', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                const periodStart = (lastClosed as any)?.period_end
                    || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

                // Opening for next is closing of last
                openingBalance = (lastClosed as any)?.closing_balance || PETTY_CASH_FUND;

                const { data: report, error: reportError } = await (supabase as any)
                    .from('petty_cash_reports')
                    .insert({
                        period_start: periodStart,
                        period_end: new Date().toISOString(),
                        total_amount: cumulativeSpend,
                        transaction_count: 0,
                        opening_balance: openingBalance,
                        closing_balance: balanceAfter,
                        status: 'draft'
                    })
                    .select()
                    .single();

                if (!reportError && report) reportId = report.id;
            } else {
                // Update closing balance and period on existing non-closed report
                await (supabase as any)
                    .from('petty_cash_reports')
                    .update({
                        closing_balance: balanceAfter,
                        total_amount: cumulativeSpend,
                        period_end: new Date().toISOString()
                    })
                    .eq('id', reportId);
            }

            // 2. Link all unlinked ledger entries to this report
            if (reportId) {
                await (supabase as any)
                    .from('petty_cash_ledger')
                    .update({ report_id: reportId })
                    .is('report_id', null);
            }

            // 3. Create or update the refill request associated with this report
            if (reportId) {
                const { data: refill } = await (supabase as any)
                    .from('petty_cash_refill_requests')
                    .select('id, status')
                    .eq('report_id', reportId)
                    .maybeSingle();

                if (!refill) {
                    await (supabase as any)
                        .from('petty_cash_refill_requests')
                        .insert({
                            report_id: reportId,
                            requested_amount: PETTY_CASH_FUND,
                            current_balance: balanceAfter,
                            status: 'pending_director',
                            notes: `Auto-triggered: ${reason}`
                        });
                } else {
                    // Update existing refill request details
                    await (supabase as any)
                        .from('petty_cash_refill_requests')
                        .update({
                            current_balance: balanceAfter,
                            requested_amount: PETTY_CASH_FUND
                        })
                        .eq('id', (refill as any).id);
                }
            }

            // 4. Notify governance roles
            await notifyRoles({
                roles: ['accounts', 'admin', 'auditor', 'director', 'Director', 'ceo'],
                title: '🚨 Petty Cash Refill Updated',
                message: `${reason} Refill/Audit for Report ${reportId?.substring(0, 8)} is active.`,
                relatedId: reportId || undefined,
                type: 'payment_status'
            });

        } catch (err) {
            console.error('[PettyCash] Failed to auto-trigger refill:', err);
        }
    };

    /**
     * Fill ₹10,000 cash into the petty cash fund.
     * Records a CREDIT entry in the ledger (negative amount = balance increases).
     */
    const fillCash = async (amount: number = PETTY_CASH_FUND): Promise<{ success: boolean }> => {
        if (!user) return { success: false };

        try {
            const currentBalance = await getCurrentBalance();
            const cumulativeSpend = await getCumulativeSpend();
            const balanceAfter = currentBalance + amount;

            const { error } = await (supabase as any)
                .from('petty_cash_ledger')
                .insert({
                    executed_by: user.id,
                    vendor_name: 'Cash Refill',
                    department: 'Accounts',
                    purpose: `Cash fund refill - ₹${amount.toLocaleString()} added`,
                    amount: -amount,
                    balance_before: currentBalance,
                    balance_after: balanceAfter,
                    cumulative_spend: cumulativeSpend
                });

            if (error) throw error;

            toast.success(`✅ ₹${amount.toLocaleString()} added to petty cash fund. New balance: ₹${balanceAfter.toLocaleString()}`);
            return { success: true };
        } catch (error) {
            console.error('Error filling cash:', error);
            toast.error('Failed to update petty cash balance');
            return { success: false };
        }
    };

    /**
     * Add entry to petty cash ledger and auto-trigger refill if thresholds are crossed.
     */
    const addLedgerEntry = async (entry: {
        paymentRequestId?: string;
        vendorName: string;
        amount: number;
        department: string;
        purpose?: string;
    }): Promise<{ success: boolean; id?: string }> => {
        if (!user) return { success: false };

        try {
            const currentBalance = await getCurrentBalance();
            const cumulativeSpend = await getCumulativeSpend();

            const balanceAfter = currentBalance - entry.amount;
            const newCumulativeSpend = cumulativeSpend + entry.amount;

            // Optional: Alert but allow negative balance for critical operations?
            // For now, just log a warning to toast if it goes negative.
            if (balanceAfter < 0) {
                toast.warning(`Warning: Balance will be negative (₹${balanceAfter.toLocaleString()}) after this entry.`);
            }

            const { data, error } = await (supabase as any)
                .from('petty_cash_ledger')
                .insert({
                    payment_request_id: entry.paymentRequestId || null,
                    executed_by: user.id,
                    vendor_name: entry.vendorName,
                    department: entry.department,
                    purpose: entry.purpose || 'Petty Cash Payment',
                    amount: entry.amount,
                    balance_before: currentBalance,
                    balance_after: balanceAfter,
                    cumulative_spend: newCumulativeSpend
                })
                .select()
                .single();

            if (error) throw error;

            // === AUTO-TRIGGER LOGIC ===
            // Trigger 1: Cumulative spend hit ₹10,000 limit
            if (newCumulativeSpend >= PETTY_CASH_FUND) {
                await autoTriggerRefill(
                    `Cumulative spend reached ₹${newCumulativeSpend.toLocaleString()} (₹${PETTY_CASH_FUND.toLocaleString()} limit).`,
                    balanceAfter,
                    newCumulativeSpend
                );
            }
            // Trigger 2: Running balance dropped below threshold
            else if (balanceAfter < LOW_BALANCE_THRESHOLD) {
                await autoTriggerRefill(
                    `Balance dropped below ₹${LOW_BALANCE_THRESHOLD} threshold (current: ₹${balanceAfter.toLocaleString()}).`,
                    balanceAfter,
                    newCumulativeSpend
                );
            }

            return { success: true, id: data?.id };
        } catch (error) {
            console.error('Error adding ledger entry:', error);
            toast.error('Failed to update ledger');
            return { success: false };
        }
    };

    return {
        entries,
        isLoading,
        summary,
        fetchEntries,
        addEntry,
        getCurrentBalance,
        getCumulativeSpend,
        addLedgerEntry,
        fillCash,
        getMonthlyReport,
        refetch: () => fetchEntries(startOfMonth(new Date()), endOfMonth(new Date()))
    };
}
