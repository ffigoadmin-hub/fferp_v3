import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDuplicateCheck, DuplicateCheckResult } from './useDuplicateCheck';
import { toast } from 'sonner';

interface PaymentFormData {
    vendor_name: string;
    amount: number;
    vendor_account_number?: string;
    vendor_ifsc_code?: string;
    vendor_upi?: string;
    bill_url?: string;
}

interface OverrideResult {
    success: boolean;
    error?: string;
}

export function usePaymentValidation() {
    const { user } = useAuth();
    const duplicateCheck = useDuplicateCheck();
    const [overrideApplied, setOverrideApplied] = useState(false);
    const [overrideReason, setOverrideReason] = useState('');

    const validatePayment = useCallback(async (formData: PaymentFormData): Promise<DuplicateCheckResult | null> => {
        if (!user) return null;

        const result = await duplicateCheck.checkDuplicate({
            vendor_name: formData.vendor_name,
            amount: formData.amount,
            account_number: formData.vendor_account_number,
            ifsc: formData.vendor_ifsc_code,
            upi: formData.vendor_upi,
            bill_url: formData.bill_url,
            requester_id: user.id,
        });

        return result;
    }, [user, duplicateCheck]);

    const handleOverride = useCallback(async (
        paymentRequestId: string,
        reason: string
    ): Promise<OverrideResult> => {
        if (!user) return { success: false, error: 'Not authenticated' };
        if (!reason || reason.trim().length < 20) {
            return { success: false, error: 'Override reason must be at least 20 characters' };
        }

        try {
            // Updated logic: We don't update the registry here because the registry entry doesn't exist yet!
            // Instead, we just mark the state as overridden.
            // When the user submits the payment, we will pass `is_overridden: true` and `override_reason`
            // to the createPayment API, and the DB trigger will populate the registry correctly.

            setOverrideApplied(true);
            setOverrideReason(reason);
            toast.success('Override applied — payment will proceed');
            return { success: true };
        } catch (err) {
            console.error('Override failed:', err);
            toast.error('Failed to apply override');
            return { success: false, error: String(err) };
        }
    }, [user]);

    const resetValidation = useCallback(() => {
        duplicateCheck.reset();
        setOverrideApplied(false);
        setOverrideReason('');
    }, [duplicateCheck]);

    return {
        ...duplicateCheck,
        validatePayment,
        handleOverride,
        resetValidation,
        overrideApplied,
        overrideReason,
        setOverrideReason,
        canSubmit: !duplicateCheck.isDuplicate || overrideApplied,
    };
}
