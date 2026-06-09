import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RentalAccess {
    role: string | null;
    department: string | null;
    isRSH: boolean;
    isHR: boolean;
    isAdmin: boolean;
    isCEO: boolean;
    isAccounts: boolean;
    isPurchase: boolean;
    isPurchaseHead: boolean;

    // Feature Flags based on specs
    canCreateCategory: boolean;
    canViewSectionD: boolean; // Farm Details
    canViewHRProperties: boolean;
    canViewRSHProperties: boolean;
    canApproveRentals: boolean;
    canExecutePayments: boolean;
    canCreateProperties: boolean;
}

export function useRentalAccess() {
    const { data: profile, isLoading } = useQuery({
        queryKey: ['user-profile-rental-access'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            const { data } = await supabase
                .from('profiles')
                .select('role, department')
                .eq('id', user.id)
                .single();
            return data;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    const access: RentalAccess = useMemo(() => {
        const role = (profile as any)?.role?.toLowerCase() || null;
        const department = (profile as any)?.department || null;

        const isAdmin = role === 'admin';
        const isCEO = role === 'ceo' || role === 'director';
        const isAccounts = role === 'accounts';
        // RSH Logic: Role 'rsh' OR (Role 'employee' AND Dept 'Rental Sourcing')
        const isRSH = role === 'rsh' || (role === 'employee' && department?.toLowerCase() === 'rental sourcing');
        // HR removed from rental management - isHR will be false
        const isHR = false;
        const isPurchase = role === 'purchase_head' || ['purchase', 'procurement'].includes(department?.toLowerCase() || '');
        const isPurchaseHead = role === 'purchase_head';

        return {
            role,
            department,
            isRSH,
            isHR,
            isAdmin,
            isCEO,
            isAccounts,
            isPurchase,
            isPurchaseHead,

            canCreateCategory: isAdmin,
            canViewSectionD: isRSH || isAdmin, // Only RSH and Admin
            canViewHRProperties: isRSH || isAdmin || isCEO || isAccounts, // HR removed
            canViewRSHProperties: isRSH || isAdmin || isCEO || isAccounts, // HR removed
            canCreateProperties: isRSH || isAdmin, // HR removed from property creation
            canApproveRentals: isCEO || isAdmin,
            canExecutePayments: isAccounts || isAdmin,
        };
    }, [profile]);

    return { access, isLoading };
}
