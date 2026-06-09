import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DuplicateMatch {
    rule: string;
    confidence: number;
    payment_id: string;
    vendor: string;
    amount: number;
    date: string;
}

export interface DuplicateCheckResult {
    is_duplicate: boolean;
    confidence: number;
    recommendation: 'allow' | 'warn' | 'flag';
    matches: DuplicateMatch[];
    fingerprints?: {
        vendor: string;
        account: string | null;
        upi: string | null;
        bill_url: string | null;
    };
    error?: string;
}

interface DuplicateCheckInput {
    vendor_name: string;
    amount: number;
    account_number?: string;
    ifsc?: string;
    upi?: string;
    bill_url?: string;
    requester_id: string;
    date?: string;
}

export function useDuplicateCheck() {
    const [result, setResult] = useState<DuplicateCheckResult | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const checkDuplicate = useCallback(async (input: DuplicateCheckInput) => {
        // Cancel any pending debounced call
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        // Don't check if minimum fields are missing
        if (!input.vendor_name || !input.amount || input.amount <= 0) {
            setResult(null);
            return;
        }

        return new Promise<DuplicateCheckResult | null>((resolve) => {
            debounceRef.current = setTimeout(async () => {
                setIsChecking(true);
                try {
                    const { data, error } = await supabase.functions.invoke('duplicate-payment-detector', {
                        body: input,
                    });

                    if (error) {
                        console.error('Duplicate check error:', error);
                        // Fail open
                        const failResult: DuplicateCheckResult = {
                            is_duplicate: false,
                            confidence: 0,
                            recommendation: 'allow',
                            matches: [],
                            error: 'Detection service temporarily unavailable',
                        };
                        setResult(failResult);
                        resolve(failResult);
                        return;
                    }

                    setResult(data as DuplicateCheckResult);
                    resolve(data as DuplicateCheckResult);
                } catch (err) {
                    console.error('Duplicate check failed:', err);
                    const failResult: DuplicateCheckResult = {
                        is_duplicate: false,
                        confidence: 0,
                        recommendation: 'allow',
                        matches: [],
                        error: 'Detection service error',
                    };
                    setResult(failResult);
                    resolve(failResult);
                } finally {
                    setIsChecking(false);
                }
            }, 500); // 500ms debounce
        });
    }, []);

    const reset = useCallback(() => {
        setResult(null);
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
    }, []);

    return {
        result,
        isChecking,
        checkDuplicate,
        reset,
        isDuplicate: result?.is_duplicate ?? false,
        confidence: result?.confidence ?? 0,
        recommendation: result?.recommendation ?? 'allow',
        matches: result?.matches ?? [],
    };
}
