import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ShiftUser {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    userRole: string;
    department: string;
    targetHours: number;
    maxHours: number;
    isActive: boolean;
    assignedAt: string;
    assignedByName: string;
}

interface AssignUserParams {
    userId: string;
    targetHours?: number;
}

/**
 * Admin hook for managing shift user assignments
 */
export function useAdminShiftUsers() {
    const [shiftUsers, setShiftUsers] = useState<ShiftUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    const fetchShiftUsers = useCallback(async () => {
        try {
            const { data, error } = await (supabase
                .from('shift_user_assignments') as any)
                .select(`
          id,
          user_id,
          target_hours,
          max_hours,
          is_active,
          assigned_at,
          assigned_by,
          profiles!shift_user_assignments_user_id_fkey (
            name,
            email,
            role,
            department
          ),
          assigner:profiles!shift_user_assignments_assigned_by_fkey (
            name
          )
        `)
                .order('assigned_at', { ascending: false });

            if (error) {
                console.error('Error fetching shift users:', error);
                return;
            }

            const mappedUsers: ShiftUser[] = (data || []).map((item: any) => ({
                id: item.id,
                userId: item.user_id,
                userName: item.profiles?.name || 'Unknown',
                userEmail: item.profiles?.email || '',
                userRole: item.profiles?.role || '',
                department: item.profiles?.department || '',
                targetHours: item.target_hours,
                maxHours: item.max_hours,
                isActive: item.is_active,
                assignedAt: item.assigned_at,
                assignedByName: item.assigner?.name || 'System',
            }));

            setShiftUsers(mappedUsers);
        } catch (error) {
            console.error('Error in useAdminShiftUsers:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchShiftUsers();
    }, [fetchShiftUsers]);

    const assignUser = async (params: AssignUserParams, assignedBy: string) => {
        setIsProcessing(true);

        try {
            // Check if user is already assigned
            const existingUser = shiftUsers.find(u => u.userId === params.userId);
            if (existingUser) {
                toast.error('User is already assigned to shift mode');
                return { success: false, error: 'User already assigned' };
            }

            const { data, error } = await (supabase
                .from('shift_user_assignments') as any)
                .insert({
                    user_id: params.userId,
                    assigned_by: assignedBy,
                    target_hours: params.targetHours || 9,
                    max_hours: 12,
                    is_active: true,
                })
                .select()
                .single();

            if (error) throw error;

            // Log to history
            await (supabase
                .from('shift_assignment_history') as any)
                .insert({
                    assignment_id: data.id,
                    user_id: params.userId,
                    action: 'assigned',
                    performed_by: assignedBy,
                    new_value: { target_hours: params.targetHours || 9 },
                });

            toast.success('User assigned to shift mode');
            await fetchShiftUsers();
            return { success: true, data };
        } catch (error: any) {
            console.error('Error assigning user:', error);
            toast.error('Failed to assign user');
            return { success: false, error: error.message };
        } finally {
            setIsProcessing(false);
        }
    };

    const toggleUser = async (assignmentId: string, isActive: boolean, performedBy: string) => {
        setIsProcessing(true);

        try {
            const assignment = shiftUsers.find(u => u.id === assignmentId);
            if (!assignment) throw new Error('Assignment not found');

            const { error } = await (supabase
                .from('shift_user_assignments') as any)
                .update({
                    is_active: isActive,
                    deactivated_at: isActive ? null : new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', assignmentId);

            if (error) throw error;

            // Log to history
            await (supabase
                .from('shift_assignment_history') as any)
                .insert({
                    assignment_id: assignmentId,
                    user_id: assignment.userId,
                    action: isActive ? 'activated' : 'deactivated',
                    performed_by: performedBy,
                    old_value: { is_active: !isActive },
                    new_value: { is_active: isActive },
                });

            toast.success(isActive ? 'User activated' : 'User deactivated');
            await fetchShiftUsers();
            return { success: true };
        } catch (error: any) {
            console.error('Error toggling user:', error);
            toast.error('Failed to toggle user');
            return { success: false, error: error.message };
        } finally {
            setIsProcessing(false);
        }
    };

    const updateTargetHours = async (
        assignmentId: string,
        targetHours: number,
        performedBy: string
    ) => {
        setIsProcessing(true);

        try {
            const assignment = shiftUsers.find(u => u.id === assignmentId);
            if (!assignment) throw new Error('Assignment not found');

            const { error } = await (supabase
                .from('shift_user_assignments') as any)
                .update({
                    target_hours: targetHours,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', assignmentId);

            if (error) throw error;

            // Log to history
            await (supabase
                .from('shift_assignment_history') as any)
                .insert({
                    assignment_id: assignmentId,
                    user_id: assignment.userId,
                    action: 'target_hours_updated',
                    performed_by: performedBy,
                    old_value: { target_hours: assignment.targetHours },
                    new_value: { target_hours: targetHours },
                });

            toast.success('Target hours updated');
            await fetchShiftUsers();
            return { success: true };
        } catch (error: any) {
            console.error('Error updating target hours:', error);
            toast.error('Failed to update target hours');
            return { success: false, error: error.message };
        } finally {
            setIsProcessing(false);
        }
    };

    const removeUser = async (assignmentId: string, performedBy: string) => {
        setIsProcessing(true);

        try {
            const assignment = shiftUsers.find(u => u.id === assignmentId);
            if (!assignment) throw new Error('Assignment not found');

            // Log to history first (before delete)
            await (supabase
                .from('shift_assignment_history') as any)
                .insert({
                    assignment_id: assignmentId,
                    user_id: assignment.userId,
                    action: 'removed',
                    performed_by: performedBy,
                    old_value: {
                        target_hours: assignment.targetHours,
                        is_active: assignment.isActive,
                    },
                });

            const { error } = await (supabase
                .from('shift_user_assignments') as any)
                .delete()
                .eq('id', assignmentId);

            if (error) throw error;

            toast.success('User removed from shift mode');
            await fetchShiftUsers();
            return { success: true };
        } catch (error: any) {
            console.error('Error removing user:', error);
            toast.error('Failed to remove user');
            return { success: false, error: error.message };
        } finally {
            setIsProcessing(false);
        }
    };

    return {
        shiftUsers,
        activeUsers: shiftUsers.filter(u => u.isActive),
        inactiveUsers: shiftUsers.filter(u => !u.isActive),
        isLoading,
        isProcessing,
        assignUser,
        toggleUser,
        updateTargetHours,
        removeUser,
        refetch: fetchShiftUsers,
    };
}
