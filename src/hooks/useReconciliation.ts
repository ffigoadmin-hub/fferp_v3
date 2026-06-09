import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

// ========================================
// Bank Statement Reconciliation Engine
// ========================================

export interface BankStatementRow {
    rowNumber: number;
    date?: string;
    description?: string;
    accountNumber?: string;
    amount?: number;
    utrNumber?: string;
    type?: 'credit' | 'debit';
    rawData: Record<string, any>;
}

export interface MatchedPayment {
    paymentId: string;
    utr: string;
    amount: number;
    vendorName: string;
    matchScore: number;
    batchId?: string;
}

export interface UnmatchedRow {
    row: number;
    reason: string;
    data: BankStatementRow;
}

export interface ReconciliationResult {
    matched: MatchedPayment[];
    unmatched: UnmatchedRow[];
    exceptions: string[];
    summary: {
        totalRows: number;
        matchedCount: number;
        unmatchedCount: number;
        totalMatchedAmount: number;
    };
}

export function useReconciliation() {
    const { user } = useAuth();
    const [isProcessing, setIsProcessing] = useState(false);
    const [lastResult, setLastResult] = useState<ReconciliationResult | null>(null);

    /**
     * Parse bank statement Excel file
     * Handles various bank formats by detecting common column patterns
     */
    const parseStatement = async (file: File): Promise<BankStatementRow[]> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData: Record<string, any>[] = XLSX.utils.sheet_to_json(firstSheet);

                    const rows: BankStatementRow[] = jsonData.map((row, idx) => {
                        // Detect columns (handle various bank formats)
                        const keys = Object.keys(row).map(k => k.toLowerCase());
                        
                        // Find account number column
                        const accountKey = keys.find(k => 
                            k.includes('account') || k.includes('acct') || k.includes('a/c')
                        );
                        
                        // Find amount column
                        const amountKey = keys.find(k => 
                            k.includes('amount') || k.includes('debit') || k.includes('credit')
                        );
                        
                        // Find UTR/Reference column
                        const utrKey = keys.find(k => 
                            k.includes('utr') || k.includes('reference') || k.includes('ref') || k.includes('txn')
                        );
                        
                        // Find description column
                        const descKey = keys.find(k => 
                            k.includes('desc') || k.includes('particular') || k.includes('narration') || k.includes('remark')
                        );

                        const amount = parseFloat(row[amountKey || Object.keys(row).find(k => 
                            !isNaN(parseFloat(row[k])) && parseFloat(row[k]) > 0
                        ) || ''] || '0');

                        return {
                            rowNumber: idx + 2, // Excel row (1-indexed + header)
                            accountNumber: row[accountKey || '']?.toString() || undefined,
                            amount: amount,
                            utrNumber: row[utrKey || '']?.toString() || undefined,
                            description: row[descKey || '']?.toString() || undefined,
                            rawData: row
                        };
                    }).filter(row => row.amount && row.amount > 0); // Filter rows with valid amounts

                    resolve(rows);
                } catch (err) {
                    reject(new Error('Failed to parse Excel file'));
                }
            };

            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
    };

    /**
     * Auto-match bank statement rows with pending payments
     * Matching Logic: Account Number + Amount + Batch ID in description
     */
    const matchPayments = async (rows: BankStatementRow[]): Promise<ReconciliationResult> => {
        setIsProcessing(true);
        
        try {
            // Fetch payments awaiting reconciliation
            const { data: payments, error } = await (supabase
                .from('payment_requests')
                .select('*')
                .eq('status', 'bank_uploaded') as any);

            if (error) throw error;

            const matched: MatchedPayment[] = [];
            const unmatched: UnmatchedRow[] = [];
            const exceptions: string[] = [];
            const usedPaymentIds = new Set<string>();

            for (const row of rows) {
                let bestMatch: { payment: any; score: number } | null = null;

                for (const payment of (payments || [])) {
                    if (usedPaymentIds.has(payment.id)) continue;

                    let matchScore = 0;

                    // Account number match (40 points)
                    if (row.accountNumber && payment.vendor_account_number) {
                        if (row.accountNumber === payment.vendor_account_number) {
                            matchScore += 40;
                        }
                    }

                    // Amount match with tolerance (40 points)
                    if (row.amount && payment.amount) {
                        const amountDiff = Math.abs(Number(row.amount) - Number(payment.amount));
                        if (amountDiff < 1) {
                            matchScore += 40;
                        } else if (amountDiff < 10) {
                            matchScore += 20;
                        }
                    }

                    // Batch ID in description match (20 points)
                    if (row.description && payment.batch_id) {
                        if (row.description.includes(`BATCH-${payment.batch_id}`) ||
                            row.description.includes(payment.batch_id)) {
                            matchScore += 20;
                        }
                    }

                    if (matchScore >= 60 && (!bestMatch || matchScore > bestMatch.score)) {
                        bestMatch = { payment, score: matchScore };
                    }
                }

                if (bestMatch && row.utrNumber) {
                    matched.push({
                        paymentId: bestMatch.payment.id,
                        utr: row.utrNumber,
                        amount: Number(bestMatch.payment.amount),
                        vendorName: bestMatch.payment.vendor_name || '',
                        matchScore: bestMatch.score,
                        batchId: (bestMatch.payment as any).batch_id
                    });
                    usedPaymentIds.add(bestMatch.payment.id);
                } else {
                    unmatched.push({
                        row: row.rowNumber,
                        reason: !row.utrNumber 
                            ? 'Missing UTR number in statement' 
                            : 'No matching payment found (Account+Amount)',
                        data: row
                    });
                }
            }

            const result: ReconciliationResult = {
                matched,
                unmatched,
                exceptions,
                summary: {
                    totalRows: rows.length,
                    matchedCount: matched.length,
                    unmatchedCount: unmatched.length,
                    totalMatchedAmount: matched.reduce((sum, m) => sum + m.amount, 0)
                }
            };

            setLastResult(result);
            return result;
        } catch (error) {
            console.error('Reconciliation error:', error);
            throw error;
        } finally {
            setIsProcessing(false);
        }
    };

    /**
     * Apply reconciliation matches to database
     * Updates status to 'paid' and fills UTR numbers
     */
    const applyReconciliation = async (matches: MatchedPayment[]): Promise<{ success: boolean; appliedCount: number }> => {
        if (!user) {
            toast.error('Not authenticated');
            return { success: false, appliedCount: 0 };
        }

        setIsProcessing(true);
        let appliedCount = 0;

        try {
            for (const match of matches) {
                const now = new Date().toISOString();
                
                const { error } = await (supabase.from('payment_requests') as any)
                    .update({
                        utr_number: match.utr,
                        status: 'paid',
                        paid_at: now,
                        accounts_executed_by: user.id,
                        reconciliation_status: 'matched'
                    })
                    .eq('id', match.paymentId);

                if (error) {
                    console.error(`Failed to update payment ${match.paymentId}:`, error);
                } else {
                    appliedCount++;
                }
            }

            if (appliedCount > 0) {
                toast.success(`${appliedCount} payments reconciled and marked as PAID`);
            }

            return { success: true, appliedCount };
        } catch (error) {
            console.error('Apply reconciliation error:', error);
            toast.error('Failed to apply reconciliation');
            return { success: false, appliedCount };
        } finally {
            setIsProcessing(false);
        }
    };

    /**
     * Flag a payment as reconciliation exception
     */
    const flagException = async (paymentId: string, reason: string): Promise<boolean> => {
        try {
            const { error } = await (supabase.from('payment_requests') as any)
                .update({
                    status: 'reconciliation_exception',
                    reconciliation_status: 'exception'
                })
                .eq('id', paymentId);

            if (error) throw error;
            toast.success('Payment flagged as exception');
            return true;
        } catch (error) {
            console.error('Flag exception error:', error);
            toast.error('Failed to flag exception');
            return false;
        }
    };

    return {
        parseStatement,
        matchPayments,
        applyReconciliation,
        flagException,
        isProcessing,
        lastResult
    };
}
