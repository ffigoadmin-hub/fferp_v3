// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface WorkOrderPayment {
  id: string;
  work_order_id: string;
  payment_number: number;
  payment_type: 'advance' | 'installment' | 'final';
  amount: number;
  percentage?: number | null;
  description: string | null;
  boi_verified_by: string | null;
  boi_verified_at: string | null;
  boi_rejection_reason: string | null;
  admin_approved_by: string | null;
  admin_approved_at: string | null;
  admin_rejection_reason: string | null;
  ceo_approved_by: string | null;
  ceo_approved_at: string | null;
  ceo_hold_reason: string | null;
  linked_payment_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  work_order?: {
    wo_number: number;
    work_description: string;
    project?: {
      project_name: string;
      project_id: string;
    };
  };
}

interface CreatePaymentData {
  workOrderId: string;
  paymentType: 'advance' | 'installment' | 'final';
  amount: number;
  percentage?: number;
  description?: string;
}

export function useWorkOrderPayments(workOrderId?: string) {
  const { user } = useAuth();
  const [payments, setPayments] = useState<WorkOrderPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('work_order_payments')
        .select(`
          *,
          work_order:work_orders!work_order_payments_work_order_id_fkey(
            wo_number,
            work_description,
            project:projects!work_orders_project_id_fkey(project_name, project_id)
          )
        `)
        .order('payment_number', { ascending: true });

      if (workOrderId) {
        query = query.eq('work_order_id', workOrderId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error fetching work order payments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [workOrderId]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    const channelName = workOrderId
      ? `wo-payments-${workOrderId}`
      : 'wo-payments-all';

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'work_order_payments',
        ...(workOrderId ? { filter: `work_order_id=eq.${workOrderId}` } : {})
      }, () => {
        fetchPayments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workOrderId, fetchPayments]);

  const createPayment = async (data: CreatePaymentData) => {
    if (!user) return { success: false };

    setIsSaving(true);
    try {
      // Budget validation — check total payments against WO value
      const { data: woData } = await supabase
        .from('work_orders')
        .select('negotiated_amount, approved_budget, total_paid')
        .eq('id', data.workOrderId)
        .single();

      const { data: existingPayments } = await supabase
        .from('work_order_payments')
        .select('amount')
        .eq('work_order_id', data.workOrderId)
        .not('status', 'in', '("rejected","admin_rejected")');

      const totalExisting = woData?.total_paid || 0;
      const woValue = woData?.negotiated_amount || woData?.approved_budget || 0;
      const newTotal = totalExisting + data.amount;

      if (newTotal > woValue) {
        return {
          success: false,
          budgetExceeded: true,
          woValue,
          totalExisting,
          newTotal,
          overshoot: newTotal - woValue,
        };
      }

      // Get next payment number
      const { data: existing } = await supabase
        .from('work_order_payments')
        .select('payment_number')
        .eq('work_order_id', data.workOrderId)
        .order('payment_number', { ascending: false })
        .limit(1);

      const nextNumber = (existing?.[0]?.payment_number || 0) + 1;

      const { data: newPayment, error } = await supabase
        .from('work_order_payments')
        .insert({
          work_order_id: data.workOrderId,
          payment_number: nextNumber,
          payment_type: data.paymentType,
          amount: data.amount,
          percentage: data.percentage || null,
          description: data.description || null,
          created_by: user.id,
          status: 'pending',
        } as any)
        .select()
        .single();

      if (error) throw error;

      toast.success(`Payment #${nextNumber} (${data.paymentType}) created`);
      await fetchPayments();
      return { success: true, data: newPayment };
    } catch (error: any) {
      console.error('Error creating payment:', error);
      toast.error(error.message || 'Failed to create payment');
      return { success: false };
    } finally {
      setIsSaving(false);
    }
  };

  const boiVerify = async (id: string, approved: boolean, reason?: string) => {
    if (!user) return;

    try {
      const updates: any = approved
        ? {
          status: 'boi_approved',
          boi_verified_by: user.id,
          boi_verified_at: new Date().toISOString(),
        }
        : {
          status: 'boi_rejected',
          boi_verified_by: user.id,
          boi_verified_at: new Date().toISOString(),
          boi_rejection_reason: reason,
        };

      const { error } = await supabase
        .from('work_order_payments')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      toast.success(approved ? 'Payment verified by BOI' : 'Payment rejected by BOI');
      await fetchPayments();
    } catch (error: any) {
      toast.error(error.message || 'Failed to verify payment');
    }
  };

  const adminApprove = async (id: string, approved: boolean, reason?: string) => {
    if (!user) return;

    try {
      const updates: any = approved
        ? {
          status: 'admin_approved',
          admin_approved_by: user.id,
          admin_approved_at: new Date().toISOString(),
        }
        : {
          status: 'admin_rejected',
          admin_approved_by: user.id,
          admin_approved_at: new Date().toISOString(),
          admin_rejection_reason: reason,
        };

      const { error } = await supabase
        .from('work_order_payments')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      toast.success(approved ? 'Payment approved by Admin' : 'Payment rejected by Admin');
      await fetchPayments();
    } catch (error: any) {
      toast.error(error.message || 'Failed to process payment');
    }
  };

  const ceoApprove = async (id: string, approved: boolean, holdReason?: string) => {
    if (!user) return;

    try {
      const updates: any = approved
        ? {
          status: 'ceo_approved',
          ceo_approved_by: user.id,
          ceo_approved_at: new Date().toISOString(),
        }
        : {
          status: 'ceo_hold',
          ceo_approved_by: user.id,
          ceo_approved_at: new Date().toISOString(),
          ceo_hold_reason: holdReason,
        };

      const { error } = await supabase
        .from('work_order_payments')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      toast.success(approved ? 'Payment approved by CEO - ready for release' : 'Payment put on hold');
      await fetchPayments();
    } catch (error: any) {
      toast.error(error.message || 'Failed to process payment');
    }
  };

  const createLinkedPayment = async (woPaymentId: string, projectId: string) => {
    if (!user) return;

    try {
      // Get the WO payment details
      const { data: woPayment, error: fetchError } = await supabase
        .from('work_order_payments')
        .select(`
          *,
          work_order:work_orders!work_order_payments_work_order_id_fkey(
            wo_number,
            work_description,
            project:projects!work_orders_project_id_fkey(project_name)
          )
        `)
        .eq('id', woPaymentId)
        .single();

      if (fetchError) throw fetchError;

      // Create payment request
      const { data: paymentReq, error: payError } = await supabase
        .from('payment_requests')
        .insert({
          requester_id: user.id,
          project_id: projectId,
          vendor_name: woPayment.work_order?.work_description?.split(' ')[0] || 'Work Order',
          amount: woPayment.amount,
          purpose: `WO-${woPayment.work_order?.wo_number} - Payment #${woPayment.payment_number} (${woPayment.payment_type})`,
          urgency: 'normal',
          payment_mode: 'bank_transfer',
          status: 'pending',
        } as any)
        .select()
        .single();

      if (payError) throw payError;

      // Link the payment
      await supabase
        .from('work_order_payments')
        .update({
          linked_payment_id: paymentReq.id,
          status: 'payment_created',
        })
        .eq('id', woPaymentId);

      toast.success('Payment request created and linked');
      await fetchPayments();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create payment request');
    }
  };

  return {
    payments,
    isLoading,
    isSaving,
    createPayment,
    boiVerify,
    adminApprove,
    ceoApprove,
    createLinkedPayment,
    refetch: fetchPayments,
  };
}
