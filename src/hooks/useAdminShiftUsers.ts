import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Real shift-role employees found live via SQL 2026-08-01 (7 hub_manager +
// 6 shift_employee) — these are the roles that actually use "Start Shift"
// (src/hooks/useShiftSession.ts), independent of shift_user_assignments.
const SHIFT_ROLES = ['hub_manager', 'shift_employee'];

interface ShiftUser {
    id: string | null;      // shift_user_assignments row id — null if this
                             // employee has never had a custom override
                             // (they're still a real shift user by role)
    userId: string;
    userName: string;
    userEmail: string;
    userRole: string;
    department: string;
    targetHours: number;
    maxHours: number;
    isActive: boolean;
    assignedAt: string | null;
    assignedByName: string;
    checkedInToday: boolean;
    todayLoginTime: string | null;
}

interface AssignUserParams {
    userId: string;
    targetHours?: number;
}

/**
 * Admin hook for managing shift users.
 *
 * Membership is role-based (hub_manager/shift_employee), NOT gated behind
 * manual enrollment — shift_user_assignments is only consulted for a
 * per-user target/max-hours override and active/inactive toggle, matching
 * how useShiftSession.ts already treats it as optional (defaults 9h/12h
 * when no row exists). Also joins today's shift_sessions so the admin can
 * see who's actually checked in today, not just who's "assigned".
 */
export function useAdminShiftUsers() {
    const [shiftUsers, setShiftUsers] = useState<ShiftUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    const fetchShiftUsers = useCallback(async () => {
        try {
            const today = new Date().toISOString().split('T')[0];

            const [profilesRes, assignmentsRes, sessionsRes] = await Promise.all([
                supabase
                    .from('profiles')
                    .select('id, name, email, role, department')
                    .in('role', SHIFT_ROLES)
                    .eq('is_active', true)
                    .order('name'),
                (supabase.from('shift_user_assignments') as any)
                    .select(`
                        id, user_id, target_hours, max_hours, is_active, assigned_at, assigned_by,
                        assigner:profiles!shift_user_assignments_assigned_by_fkey ( name )
                    `),
                supabase
                    .from('shift_sessions')
                    .select('user_id, created_at, status')
                    .eq('date', today),
            ]);

            if (profilesRes.error) throw profilesRes.error;
            if (assignmentsRes.error) throw assignmentsRes.error;
            if (sessionsRes.error) throw sessionsRes.error;

            const assignmentByUserId = new Map(
                (assignmentsRes.data || []).map((a: any) => [a.user_id, a])
            );
            const sessionByUserId = new Map(
                (sessionsRes.data || []).map((s: any) => [s.user_id, s])
            );

            const mappedUsers: ShiftUser[] = (profilesRes.data || []).map((p: any) => {
                const a: any = assignmentByUserId.get(p.id);
                const s: any = sessionByUserId.get(p.id);
                return {
                    id: a?.id ?? null,
                    userId: p.id,
                    userName: p.name || 'Unknown',
                    userEmail: p.email || '',
                    userRole: p.role || '',
                    department: p.department || '',
                    targetHours: a?.target_hours ?? 9,
                    maxHours: a?.max_hours ?? 12,
                    isActive: a?.is_active ?? true,
                    assignedAt: a?.assigned_at ?? null,
                    assignedByName: a?.assigner?.name || 'System (default)',
                    checkedInToday: !!s,
                    todayLoginTime: s?.created_at ?? null,
                };
            });

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
            const existingUser = shiftUsers.find(u => u.userId === params.userId);
            if (existingUser?.id) {
                toast.error('User already has a custom shift configuration');
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

            await (supabase
                .from('shift_assignment_history') as any)
                .insert({
                    assignment_id: data.id,
                    user_id: params.userId,
                    action: 'assigned',
                    performed_by: assignedBy,
                    new_value: { target_hours: params.targetHours || 9 },
                });

            toast.success('Shift configuration saved');
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

    // Ensures a shift_user_assignments row exists for this user, creating one
    // with current defaults if they've never had a custom override, then
    // returns its id so callers can update it.
    const ensureAssignmentRow = async (userId: string, performedBy: string): Promise<string> => {
        const existing = shiftUsers.find(u => u.userId === userId);
        if (existing?.id) return existing.id;

        const { data, error } = await (supabase
            .from('shift_user_assignments') as any)
            .insert({
                user_id: userId,
                assigned_by: performedBy,
                target_hours: existing?.targetHours ?? 9,
                max_hours: existing?.maxHours ?? 12,
                is_active: existing?.isActive ?? true,
            })
            .select()
            .single();
        if (error) throw error;
        return data.id;
    };

    const toggleUser = async (userId: string, isActive: boolean, performedBy: string) => {
        setIsProcessing(true);

        try {
            const assignmentId = await ensureAssignmentRow(userId, performedBy);

            const { error } = await (supabase
                .from('shift_user_assignments') as any)
                .update({
                    is_active: isActive,
                    deactivated_at: isActive ? null : new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', assignmentId);

            if (error) throw error;

            await (supabase
                .from('shift_assignment_history') as any)
                .insert({
                    assignment_id: assignmentId,
                    user_id: userId,
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
        userId: string,
        targetHours: number,
        performedBy: string
    ) => {
        setIsProcessing(true);

        try {
            const previousHours = shiftUsers.find(u => u.userId === userId)?.targetHours;
            const assignmentId = await ensureAssignmentRow(userId, performedBy);

            const { error } = await (supabase
                .from('shift_user_assignments') as any)
                .update({
                    target_hours: targetHours,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', assignmentId);

            if (error) throw error;

            await (supabase
                .from('shift_assignment_history') as any)
                .insert({
                    assignment_id: assignmentId,
                    user_id: userId,
                    action: 'target_hours_updated',
                    performed_by: performedBy,
                    old_value: { target_hours: previousHours },
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

    // Only meaningful when the user has a custom assignment row — resets
    // them back to role-based defaults (9h/12h, active) by deleting it.
    const removeUser = async (assignmentId: string, performedBy: string) => {
        setIsProcessing(true);

        try {
            const assignment = shiftUsers.find(u => u.id === assignmentId);
            if (!assignment) throw new Error('Assignment not found');

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

            toast.success('Reset to default shift configuration');
            await fetchShiftUsers();
            return { success: true };
        } catch (error: any) {
            console.error('Error removing user:', error);
            toast.error('Failed to reset user');
            return { success: false, error: error.message };
        } finally {
            setIsProcessing(false);
        }
    };

    return {
        shiftUsers,
        activeUsers: shiftUsers.filter(u => u.isActive),
        inactiveUsers: shiftUsers.filter(u => !u.isActive),
        checkedInToday: shiftUsers.filter(u => u.checkedInToday),
        isLoading,
        isProcessing,
        assignUser,
        toggleUser,
        updateTargetHours,
        removeUser,
        refetch: fetchShiftUsers,
    };
}
