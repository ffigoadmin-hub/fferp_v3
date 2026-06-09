import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ShiftConfig {
    id: string;
    targetHours: number;
    maxHours: number;
    isActive: boolean;
    assignedAt: string;
}

/**
 * Hook to check if the current user is in shift mode
 * and retrieve their shift configuration
 */
export function useShiftUserStatus() {
    const { user } = useAuth();
    const [isShiftUser, setIsShiftUser] = useState(false);
    const [shiftConfig, setShiftConfig] = useState<ShiftConfig | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkShiftStatus = async () => {
            if (!user) {
                setIsLoading(false);
                return;
            }

            // Demo users (fake UUIDs) bypass Supabase queries entirely
            if (user.id?.startsWith('demo-')) {
                setIsShiftUser(false);
                setShiftConfig(null);
                setIsLoading(false);
                return;
            }

            try {
                const { data, error } = await (supabase
                    .from('shift_user_assignments') as any)
                    .select('id, target_hours, max_hours, is_active, assigned_at')
                    .eq('user_id', user.id)
                    .eq('is_active', true)
                    .maybeSingle();

                if (error) {
                    console.error('Error checking shift status:', error);
                    setIsShiftUser(false);
                    setShiftConfig(null);
                } else if (data) {
                    setIsShiftUser(true);
                    setShiftConfig({
                        id: data.id,
                        targetHours: data.target_hours,
                        maxHours: data.max_hours,
                        isActive: data.is_active,
                        assignedAt: data.assigned_at,
                    });
                } else {
                    setIsShiftUser(false);
                    setShiftConfig(null);
                }
            } catch (error) {
                console.error('Error in useShiftUserStatus:', error);
                setIsShiftUser(false);
                setShiftConfig(null);
            } finally {
                setIsLoading(false);
            }
        };

        checkShiftStatus();
    }, [user]);

    return {
        isShiftUser,
        shiftConfig,
        isLoading,
    };
}
