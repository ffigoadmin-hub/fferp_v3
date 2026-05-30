import { isMissingTable } from '@/lib/supabase-error-guard';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Payee {
    id: string;
    name: string;
    bank_name: string | null;
    account_number: string | null;
    ifsc_code: string | null;
    created_at: string | null;
    created_by: string | null;
}

export function usePayees() {
    const { user } = useAuth();
    const [payees, setPayees] = useState<Payee[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchPayees = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('payees')
                .select('*')
                .eq('created_by', user.id)
                .order('name', { ascending: true });

            if (error) throw error;
            setPayees(data || []);
        } catch (error) {
            console.error('Error fetching payees:', error);
            if (!isMissingTable(error)) toast.error('Failed to load bank credentials');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPayees();
    }, [user]);

    const addPayee = async (payeeData: Omit<Payee, 'id' | 'created_at' | 'created_by'>) => {
        if (!user) return { success: false, error: 'Not authenticated' };
        try {
            const { data, error } = await (supabase.from('payees') as any)
                .insert({
                    ...payeeData,
                    created_by: user.id
                })
                .select()
                .single();

            if (error) throw error;
            setPayees(prev => [...prev, data]);
            toast.success('Bank credentials added successfully');
            return { success: true, data };
        } catch (error) {
            console.error('Error adding payee:', error);
            toast.error('Failed to add bank credentials');
            return { success: false, error };
        }
    };

    const updatePayee = async (id: string, payeeData: Partial<Omit<Payee, 'id' | 'created_at' | 'created_by'>>) => {
        try {
            const { data, error } = await (supabase.from('payees') as any)
                .update(payeeData)
                .eq('id', id)
                .eq('created_by', user.id)
                .select()
                .single();

            if (error) throw error;
            setPayees(prev => prev.map(p => p.id === id ? data : p));
            toast.success('Credentials updated successfully');
            return { success: true, data };
        } catch (error) {
            console.error('Error updating payee:', error);
            toast.error('Failed to update credentials');
            return { success: false, error };
        }
    };

    const deletePayee = async (id: string) => {
        try {
            const { error } = await supabase
                .from('payees')
                .delete()
                .eq('id', id)
                .eq('created_by', user.id);

            if (error) throw error;
            setPayees(prev => prev.filter(p => p.id !== id));
            toast.success('Credentials deleted');
            return { success: true };
        } catch (error) {
            console.error('Error deleting payee:', error);
            toast.error('Failed to delete credentials');
            return { success: false, error };
        }
    };

    return {
        payees,
        isLoading,
        addPayee,
        updatePayee,
        deletePayee,
        refresh: fetchPayees
    };
}
