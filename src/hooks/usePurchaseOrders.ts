import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface PurchaseOrder {
    id: string;
    po_number: number;
    requester_id: string;
    project_id: string;
    vendor_name: string;
    vendor_bank_details?: string;
    vendor_upi?: string;
    item_description: string;
    quantity?: number;
    unit_price?: number;
    total_amount: number;
    cost_comparison_url?: string;
    po_document_url: string;
    status: string;
    admin_approved_by: string | null;
    admin_approved_at: string | null;
    admin_rejection_reason?: string | null;
    ceo_approved_by: string | null;
    ceo_approved_at: string | null;
    ceo_hold_reason: string | null;
    linked_payment_id?: string | null;
    created_at: string;
    updated_at: string;
    requester?: {
        name: string;
        department: string;
    };
    project?: {
        project_id: string;
        project_name: string;
    };
}

export interface CreatePurchaseOrderData {
    projectId: string;
    vendorName: string;
    vendorBankDetails: string;
    vendorUpi?: string;
    itemDescription: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    costComparisonUrl?: string;
    poDocumentUrl: string;
}

export function usePurchaseOrders(projectId?: string) {
    const { user } = useAuth();
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const currentProjectIdRef = useRef<string | undefined>(undefined);
    const isMountedRef = useRef(false);

    const fetchPurchaseOrders = useCallback(async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from('purchase_orders')
                .select(`
          *,
          requester:profiles!purchase_orders_requester_id_fkey(name, department),
          project:projects!purchase_orders_project_id_fkey(project_id, project_name)
        `)
                .order('created_at', { ascending: false });

            if (projectId) {
                query = query.eq('project_id', projectId);
            }

            const { data, error } = await query;

            if (error) throw error;
            console.log('[usePurchaseOrders] Fetched', data?.length, 'purchase orders');
            setPurchaseOrders((data || []) as any);
        } catch (error) {
            console.error('Error fetching purchase orders:', error);
        } finally {
            setIsLoading(false);
        }
    }, [projectId]);

    // Initial fetch on mount and when projectId changes
    useEffect(() => {
        if (!isMountedRef.current || projectId !== currentProjectIdRef.current) {
            isMountedRef.current = true;
            currentProjectIdRef.current = projectId;
            fetchPurchaseOrders();
        }
    }, [projectId, fetchPurchaseOrders]);

    // Real-time subscription
    useEffect(() => {
        const channelName = projectId
            ? `purchase-orders-${projectId}`
            : 'purchase-orders-all';

        console.log('[usePurchaseOrders] Setting up subscription:', channelName);

        const channel = supabase
            .channel(channelName)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'purchase_orders',
                ...(projectId ? { filter: `project_id=eq.${projectId}` } : {})
            }, (payload) => {
                console.log('[usePurchaseOrders] Real-time update:', payload.eventType);
                fetchPurchaseOrders();
            })
            .subscribe((status) => {
                console.log('[usePurchaseOrders] Subscription status:', status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [projectId, fetchPurchaseOrders]);

    const createPurchaseOrder = async (data: CreatePurchaseOrderData) => {
        if (!user) return { success: false };

        setIsSaving(true);
        try {
            const insertData = {
                requester_id: user.id,
                project_id: data.projectId,
                vendor_name: data.vendorName,
                vendor_bank_details: data.vendorBankDetails,
                vendor_upi: data.vendorUpi || null,
                item_description: data.itemDescription,
                quantity: data.quantity,
                unit_price: data.unitPrice,
                total_amount: data.totalAmount,
                cost_comparison_url: data.costComparisonUrl,
                po_document_url: data.poDocumentUrl,
            };
            const { data: newPO, error } = await (supabase
                .from('purchase_orders') as any)
                .insert(insertData)
                .select()
                .single();

            if (error) throw error;

            toast.success('Purchase Order submitted successfully');
            await fetchPurchaseOrders();
            return { success: true, data: newPO };
        } catch (error: any) {
            console.error('Error creating purchase order:', error);
            toast.error(error.message || 'Failed to create purchase order');
            return { success: false };
        } finally {
            setIsSaving(false);
        }
    };

    const approvePurchaseOrder = async (id: string, role: 'admin' | 'ceo') => {
        if (!user) return;

        try {
            const updates = role === 'admin'
                ? {
                    status: 'admin_approved',
                    admin_approved_by: user.id,
                    admin_approved_at: new Date().toISOString()
                }
                : {
                    status: 'ceo_approved',
                    ceo_approved_by: user.id,
                    ceo_approved_at: new Date().toISOString()
                };

            const { error } = await supabase
                .from('purchase_orders')
                .update(updates)
                .eq('id', id);

            if (error) throw error;
            toast.success(`Purchase Order approved`);
            await fetchPurchaseOrders();
        } catch (error: any) {
            toast.error(error.message || 'Failed to approve purchase order');
        }
    };

    const holdPurchaseOrder = async (id: string, reason: string) => {
        if (!user) return;
        try {
            const { error } = await supabase
                .from('purchase_orders')
                .update({
                    status: 'ceo_hold',
                    ceo_hold_reason: reason,
                    ceo_approved_by: user.id
                })
                .eq('id', id);

            if (error) throw error;
            toast.success('Purchase Order put on hold');
            await fetchPurchaseOrders();
        } catch (error: any) {
            toast.error(error.message || 'Failed to hold purchase order');
        }
    };

    const resubmitPurchaseOrder = async (id: string, data: Partial<CreatePurchaseOrderData>) => {
        if (!user) return { success: false };
        setIsSaving(true);
        try {
            const { error } = await (supabase.from('purchase_orders') as any)
                .update({ ...data, status: 'pending' })
                .eq('id', id);
            if (error) throw error;
            toast.success('Purchase Order resubmitted successfully');
            await fetchPurchaseOrders();
            return { success: true };
        } catch (error: any) {
            toast.error(error.message || 'Failed to resubmit purchase order');
            return { success: false };
        } finally {
            setIsSaving(false);
        }
    };

    return {
        purchaseOrders,
        isLoading,
        isSaving,
        createPurchaseOrder,
        approvePurchaseOrder,
        holdPurchaseOrder,
        resubmitPurchaseOrder,
        refetch: fetchPurchaseOrders,
    };
}
