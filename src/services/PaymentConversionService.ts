import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ConversionResult {
    success: boolean;
    directPaymentId?: string;
    error?: string;
}

export class PaymentConversionService {
    /**
     * Convert a batch payment to a direct payment
     * Only Accounts role can perform this operation
     */
    static async convertBatchToDirectPayment(
        paymentId: string,
        batchId: string
    ): Promise<ConversionResult> {
        try {
            // 1. Verify user has Accounts role
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', (await supabase.auth.getUser()).data.user?.id)
                .single();

            if (!['accounts', 'admin', 'ceo'].includes(profile?.role?.toLowerCase() || '')) {
                return {
                    success: false,
                    error: 'Only Accounts team, Admin, or CEO can convert batch payments'
                };
            }

            // 2. Get the payment details
            const { data: payment, error: fetchError } = await supabase
                .from('payment_requests')
                .select('*')
                .eq('id', paymentId)
                .single();

            if (fetchError || !payment) {
                return {
                    success: false,
                    error: 'Payment not found'
                };
            }

            // 3. Verify payment is in a batch
            if (!payment.bulk_batch_id) {
                return {
                    success: false,
                    error: 'Payment is not part of a batch'
                };
            }

            // 4. Update payment to mark as converted and remove from batch
            const { error: updateError } = await supabase
                .from('payment_requests')
                .update({
                    bulk_batch_id: null, // Remove from batch
                    converted_from_batch: true,
                    original_batch_id: batchId,
                    conversion_date: new Date().toISOString(),
                    converted_by: (await supabase.auth.getUser()).data.user?.id,
                    status: 'ceo_approved' // Reset to CEO approved for direct payment flow
                })
                .eq('id', paymentId);

            if (updateError) {
                return {
                    success: false,
                    error: updateError.message
                };
            }

            // 5. Update batch to reflect conversion - REMOVED to keep batch visible
            // The batch should remain in its current status (pending_verification or verified)
            // recalculateBatchTotals will update the amounts
            /*
            const { error: batchUpdateError } = await supabase
                .from('bulk_batches')
                .update({ status: 'converted' } as any)
                .eq('id', batchId);

            if (batchUpdateError) {
                console.error('Failed to update batch status:', batchUpdateError);
            }
            */

            // 6. Recalculate batch totals
            await this.recalculateBatchTotals(batchId);

            return {
                success: true,
                directPaymentId: paymentId
            };
        } catch (error) {
            console.error('Conversion error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Recalculate batch totals after payment removal
     */
    private static async recalculateBatchTotals(batchId: string): Promise<void> {
        const { data: payments } = await supabase
            .from('payment_requests')
            .select('amount')
            .eq('bulk_batch_id', batchId);

        if (payments) {
            const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);
            const totalCount = payments.length;

            await supabase
                .from('bulk_batches')
                .update({
                    total_amount: totalAmount,
                    total_transactions: totalCount
                })
                .eq('id', batchId);
        }
    }

    /**
     * Convert a batch payment to a petty cash payment
     * Only Accounts role can perform this operation
     */
    static async convertBatchToPettyCash(
        paymentId: string,
        batchId: string
    ): Promise<ConversionResult> {
        try {
            // 1. Verify user has Accounts role
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', (await supabase.auth.getUser()).data.user?.id)
                .single();

            if (!['accounts', 'admin', 'ceo'].includes(profile?.role?.toLowerCase() || '')) {
                return {
                    success: false,
                    error: 'Only Accounts team, Admin, or CEO can convert batch payments'
                };
            }

            // 2. Get the payment details
            const { data: payment, error: fetchError } = await supabase
                .from('payment_requests')
                .select('*')
                .eq('id', paymentId)
                .single();

            if (fetchError || !payment) {
                return {
                    success: false,
                    error: 'Payment not found'
                };
            }

            // 3. Verify payment is in a batch
            if (!payment.bulk_batch_id) {
                return {
                    success: false,
                    error: 'Payment is not part of a batch'
                };
            }

            // 4. Update payment to mark as converted and remove from batch
            const { error: updateError } = await supabase
                .from('payment_requests')
                .update({
                    bulk_batch_id: null, // Remove from batch
                    converted_from_batch: true,
                    original_batch_id: batchId,
                    conversion_date: new Date().toISOString(),
                    converted_by: (await supabase.auth.getUser()).data.user?.id,
                    is_petty_cash: true,
                    status: 'ceo_approved' // Ensure it stays in approved state for execution
                })
                .eq('id', paymentId);

            if (updateError) {
                return {
                    success: false,
                    error: updateError.message
                };
            }

            // 5. Update batch to reflect conversion - REMOVED to keep batch visible
            /*
            const { error: batchUpdateError } = await supabase
                .from('bulk_batches')
                .update({ status: 'converted' } as any)
                .eq('id', batchId);

            if (batchUpdateError) {
                console.error('Failed to update batch status:', batchUpdateError);
            }
            */

            // 6. Recalculate batch totals
            await this.recalculateBatchTotals(batchId);

            return {
                success: true,
                directPaymentId: paymentId
            };
        } catch (error) {
            console.error('Conversion error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Get conversion history for a payment
     */
    static async getConversionHistory(paymentId: string) {
        const { data, error } = await (supabase as any)
            .from('payment_audit_logs')
            .select('*, actor:profiles!payment_audit_logs_actor_id_fkey(name, role)')
            .eq('target_id', paymentId)
            // Filter for either conversion type
            .in('action', ['BATCH_TO_DIRECT_CONVERSION', 'BATCH_TO_PETTY_CASH_CONVERSION'])
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Failed to fetch conversion history:', error);
            return [];
        }

        return data;
    }

    /**
     * Check if user has permission to convert
     */
    static async canConvert(): Promise<boolean> {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', (await supabase.auth.getUser()).data.user?.id)
            .single();

        return ['accounts', 'admin', 'ceo'].includes(profile?.role?.toLowerCase() || '');
    }
}
