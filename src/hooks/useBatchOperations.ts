import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export type BatchStatus = 'draft' | 'pending_verification' | 'verified' | 'processed' | 'rejected';

export interface BulkBatch {
    id: string;
    batch_reference: string;
    status: BatchStatus;
    total_amount: number;
    payment_count: number;
    created_by: string;
    verified_by?: string;
    created_at: string;
    verified_at?: string;
    processed_at?: string;
    // Joins
    creator?: { name: string };
    verifier?: { name: string };
}

export function useBatchOperations() {
    const queryClient = useQueryClient();
    const [isLoading, setIsLoading] = useState(false);

    // Fetch Batches - Optimized to avoid N+1 queries
    const useBatches = (statusFilter?: BatchStatus) => useQuery({
        queryKey: ['bulk-batches', statusFilter],
        queryFn: async () => {
            let query = supabase
                .from('bulk_batches')
                .select('*')
                .order('created_at', { ascending: false });

            if (statusFilter) {
                query = query.eq('status', statusFilter);
            }

            const { data, error } = await query;
            if (error) {
                console.error('Error fetching batches:', error);
                throw error;
            }

            if (!data || data.length === 0) return [];

            // Batch fetch all unique user IDs for creators and verifiers
            const userIds = new Set<string>();
            data.forEach((batch: any) => {
                if (batch.created_by) userIds.add(batch.created_by);
                if (batch.verified_by) userIds.add(batch.verified_by);
            });

            // Single query for all profiles
            const profilesMap: Record<string, string> = {};
            if (userIds.size > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, name')
                    .in('id', Array.from(userIds));

                profiles?.forEach((p: any) => {
                    profilesMap[p.id] = p.name;
                });
            }

            // Batch fetch all payments linked to these batches
            const batchIds = data.map((b: any) => b.id);
            const { data: allPayments } = await supabase
                .from('payment_requests')
                .select('id, amount, bulk_batch_id')
                .in('bulk_batch_id', batchIds);

            // Group payments by batch
            const paymentsByBatch: Record<string, { count: number; total: number }> = {};
            batchIds.forEach(id => {
                paymentsByBatch[id] = { count: 0, total: 0 };
            });

            allPayments?.forEach((p: any) => {
                if (p.bulk_batch_id && paymentsByBatch[p.bulk_batch_id]) {
                    paymentsByBatch[p.bulk_batch_id].count++;
                    paymentsByBatch[p.bulk_batch_id].total += Number(p.amount);
                }
            });

            // Map batches with resolved data
            const batchesWithDetails = data.map((batch: any) => {
                const paymentInfo = paymentsByBatch[batch.id] || { count: 0, total: 0 };

                return {
                    ...batch,
                    batch_reference: batch.batch_id,
                    payment_count: paymentInfo.count > 0 ? paymentInfo.count : batch.total_transactions,
                    total_amount: paymentInfo.count > 0 ? paymentInfo.total : Number(batch.total_amount),
                    actual_payment_count: paymentInfo.count,
                    creator: profilesMap[batch.created_by] ? { name: profilesMap[batch.created_by] } : null,
                    verifier: profilesMap[batch.verified_by] ? { name: profilesMap[batch.verified_by] } : null
                };
            });

            // Filter out orphaned batches (no linked payments) for pending_verification status
            if (statusFilter === 'pending_verification') {
                return batchesWithDetails.filter(batch => batch.actual_payment_count > 0);
            }

            return batchesWithDetails;
        }
    });

    // Create Batch
    const createBatch = useMutation({
        mutationFn: async ({ paymentIds }: { paymentIds: string[] }) => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // 1. Fetch payments to calculate totals
            const { data: payments, error: fetchError } = await (supabase
                .from('payment_requests')
                .select('amount, id')
                .in('id', paymentIds) as any);

            if (fetchError || !payments) throw fetchError || new Error('Failed to fetch payments');

            const totalAmount = (payments as any[]).reduce((sum, p) => sum + Number(p.amount), 0);
            const count = payments.length;

            // Generate sequential batch reference: IGO PAY-001, IGO PAY-002, etc.
            const { data: existingBatches } = await supabase
                .from('bulk_batches')
                .select('batch_id')
                .order('created_at', { ascending: false })
                .limit(100);

            // Find the highest existing number
            let nextNumber = 1;
            if (existingBatches && existingBatches.length > 0) {
                const numbers = existingBatches
                    .map((b: any) => {
                        const match = b.batch_id?.match(/IGO PAY-(\d+)/i);
                        return match ? parseInt(match[1], 10) : 0;
                    })
                    .filter((n: number) => !isNaN(n) && n > 0);

                if (numbers.length > 0) {
                    nextNumber = Math.max(...numbers) + 1;
                }
            }

            const batchRef = `IGO PAY-${String(nextNumber).padStart(3, '0')}`;

            // 2. Insert Batch - using correct column names from DB schema
            const { data: batch, error: batchError } = await (supabase
                .from('bulk_batches') as any)
                .insert({
                    batch_id: batchRef,
                    total_amount: totalAmount,
                    total_transactions: count,
                    created_by: user.id,
                    status: 'draft'
                })
                .select()
                .single();

            if (batchError || !batch) {
                console.error('Batch creation error:', batchError);
                throw batchError || new Error('Failed to create batch record');
            }

            // 3. Update Payments with Batch ID (column is bulk_batch_id, not batch_id)
            const { error: updateError } = await (supabase
                .from('payment_requests') as any)
                .update({ bulk_batch_id: batch.id, status: 'bulk_prepared', bulk_prepared_at: new Date().toISOString() })
                .in('id', paymentIds);

            if (updateError) {
                console.error('Payment update error:', updateError);
                throw updateError;
            }

            return batch;
        },
        onSuccess: () => {
            toast.success('Batch created as Draft - Edit and Send to Admin when ready');
            queryClient.invalidateQueries({ queryKey: ['bulk-batches'] });
            queryClient.invalidateQueries({ queryKey: ['payment-requests'] });
        },
        onError: (error: any) => {
            console.error('Batch operation failed:', error);
            toast.error(`Failed to create batch: ${error?.message || 'Unknown error'}`);
        }
    });

    // Send batch to Admin for verification
    const sendBatchToAdmin = useMutation({
        mutationFn: async ({ batchId }: { batchId: string }) => {
            const { error } = await (supabase
                .from('bulk_batches') as any)
                .update({ status: 'pending_verification' })
                .eq('id', batchId);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('Batch sent to Admin for verification');
            queryClient.invalidateQueries({ queryKey: ['bulk-batches'] });
        },
        onError: (error: any) => {
            toast.error(`Failed to send batch: ${error?.message || 'Unknown error'}`);
        }
    });

    // Update batch payments (add/remove)
    const updateBatchPayments = useMutation({
        mutationFn: async ({ batchId, addPaymentIds, removePaymentIds }: {
            batchId: string;
            addPaymentIds?: string[];
            removePaymentIds?: string[];
        }) => {
            // Remove payments from batch
            if (removePaymentIds?.length) {
                const { error } = await (supabase
                    .from('payment_requests') as any)
                    .update({ bulk_batch_id: null, status: 'ceo_approved', bulk_prepared_at: null })
                    .in('id', removePaymentIds);
                if (error) throw error;
            }

            // Add payments to batch
            if (addPaymentIds?.length) {
                const { error } = await (supabase
                    .from('payment_requests') as any)
                    .update({ bulk_batch_id: batchId, status: 'bulk_prepared', bulk_prepared_at: new Date().toISOString() })
                    .in('id', addPaymentIds);
                if (error) throw error;
            }

            // Recalculate totals
            const { data: payments } = await supabase
                .from('payment_requests')
                .select('amount')
                .eq('bulk_batch_id', batchId);

            const newTotal = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
            const newCount = payments?.length || 0;

            await (supabase
                .from('bulk_batches') as any)
                .update({ total_amount: newTotal, total_transactions: newCount })
                .eq('id', batchId);
        },
        onSuccess: () => {
            toast.success('Batch payments updated');
            queryClient.invalidateQueries({ queryKey: ['bulk-batches'] });
            queryClient.invalidateQueries({ queryKey: ['payment-requests'] });
        },
        onError: (error: any) => {
            toast.error(`Failed to update batch: ${error?.message || 'Unknown error'}`);
        }
    });

    // Update Batch Status
    const updateBatchStatus = useMutation({
        mutationFn: async ({ batchId, status, notes }: { batchId: string, status: BatchStatus, notes?: string }) => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const updates: any = { status };
            if (status === 'verified') {
                updates.verified_by = user.id;
                updates.verified_at = new Date().toISOString();
            }
            if (status === 'processed') {
                updates.processed_at = new Date().toISOString();
                updates.processed_by = user.id;
            }

            const { error } = await (supabase
                .from('bulk_batches') as any)
                .update(updates)
                .eq('id', batchId);

            if (error) throw error;

            // NEW: If batch is processed, mark all payments as paid with correct amounts
            if (status === 'processed') {
                // 1. Fetch all payments in this batch to get their amounts
                const { data: paymentsInBatch, error: fetchError } = await (supabase
                    .from('payment_requests') as any)
                    .select('id, amount')
                    .eq('bulk_batch_id', batchId);

                if (fetchError) {
                    console.error('Failed to fetch payments for batch update:', fetchError);
                } else if (paymentsInBatch && paymentsInBatch.length > 0) {
                    // 2. Update each payment
                    const now = new Date().toISOString();
                    const paymentUpdates = paymentsInBatch.map((p: any) => (supabase
                        .from('payment_requests') as any)
                        .update({
                            status: 'paid',
                            paid_at: now,
                        })
                        .eq('id', p.id)
                    );

                    await Promise.all(paymentUpdates);

                    // 3. Update all associated split payments
                    const paymentIds = paymentsInBatch.map((p: any) => p.id);
                    await (supabase
                        .from('split_payments' as any) as any)
                        .update({
                            status: 'paid',
                            paid_at: now,
                        })
                        .in('parent_payment_id', paymentIds);
                }
            }
        },
        onSuccess: (_, variables) => {
            toast.success(`Batch ${variables.status === 'verified' ? 'Verified' : 'Updated'}`);
            queryClient.invalidateQueries({ queryKey: ['bulk-batches'] });
            queryClient.invalidateQueries({ queryKey: ['payment-requests'] }); // Ensure payments are refreshed
        },
        onError: (error) => {
            toast.error('Failed to update batch');
        }
    });

    // Delete Batch (Admin only)
    const deleteBatch = useMutation({
        mutationFn: async ({ batchId }: { batchId: string }) => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // First, unlink payments from this batch
            const { error: unlinkError } = await (supabase
                .from('payment_requests') as any)
                .update({ bulk_batch_id: null, status: 'ceo_approved', bulk_prepared_at: null })
                .eq('bulk_batch_id', batchId);

            if (unlinkError) {
                console.error('Failed to unlink payments:', unlinkError);
                throw unlinkError;
            }

            // Then delete the batch
            const { error: deleteError } = await (supabase
                .from('bulk_batches') as any)
                .delete()
                .eq('id', batchId);

            if (deleteError) {
                console.error('Failed to delete batch:', deleteError);
                throw deleteError;
            }
        },
        onSuccess: () => {
            toast.success('Batch deleted successfully');
            queryClient.invalidateQueries({ queryKey: ['bulk-batches'] });
            queryClient.invalidateQueries({ queryKey: ['payment-requests'] });
        },
        onError: (error: any) => {
            toast.error(`Failed to delete batch: ${error?.message || 'Unknown error'}`);
        }
    });

    return {
        useBatches,
        createBatch,
        updateBatchStatus,
        deleteBatch,
        sendBatchToAdmin,
        updateBatchPayments
    };
}
