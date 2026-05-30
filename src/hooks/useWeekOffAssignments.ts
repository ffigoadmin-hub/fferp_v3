import { isMissingTable } from '@/lib/supabase-error-guard';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface WeekOffAssignment {
    id?: string;
    employee_id: string;
    week_off_date: string;
    assignment_type: 'one_time' | 'recurring_weekly';
    recurring_day?: number; // 0=Sunday, 6=Saturday
    reason?: string;
    assigned_by?: string;
    is_active?: boolean;
}

export interface WeekOffWithEmployee extends WeekOffAssignment {
    employee?: {
        id: string;
        name: string;
        email: string;
        department: string;
    };
    assigner?: {
        id: string;
        name: string;
    };
}

export function useWeekOffAssignments(employeeId?: string) {
    const [weekOffs, setWeekOffs] = useState<WeekOffWithEmployee[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch week off assignments
    const fetchWeekOffs = async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from('week_off_assignments')
                .select(`
          *,
          employee:profiles!employee_id(id, name, email, department),
          assigner:profiles!assigned_by(id, name)
        `)
                .eq('is_active', true)
                .order('week_off_date', { ascending: false });

            if (employeeId) {
                query = query.eq('employee_id', employeeId);
            }

            const { data, error } = await query;

            // week_off_assignments is an IGO-Chain table — not present in FFERPv2
            if (error) {
                const missing = (error as any)?.code === 'PGRST205' || (error as any)?.message?.includes('schema cache') || (error as any)?.message?.includes('does not exist');
                if (!missing) if (!isMissingTable(error)) toast.error('Failed to fetch week off assignments');
                setWeekOffs([]);
                return;
            }
            setWeekOffs((data || []) as unknown as WeekOffWithEmployee[]);
        } catch (error) {
            console.error('Error fetching week offs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Check if a specific date is a week off for an employee
    const isWeekOffDay = async (employeeId: string, date: string): Promise<boolean> => {
        try {
            const { data, error } = await supabase.rpc('is_week_off_day', {
                p_employee_id: employeeId,
                p_date: date
            });

            if (error) throw error;
            return data === true;
        } catch (error) {
            console.error('Error checking week off day:', error);
            return false;
        }
    };

    // Get all week off dates in a date range
    const getWeekOffDates = async (
        employeeId: string,
        startDate: string,
        endDate: string
    ): Promise<Array<{ week_off_date: string; assignment_type: string; reason: string }>> => {
        try {
            const { data, error } = await supabase.rpc('get_week_off_dates', {
                p_employee_id: employeeId,
                p_start_date: startDate,
                p_end_date: endDate
            });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error getting week off dates:', error);
            return [];
        }
    };

    // Assign a new week off
    const assignWeekOff = async (assignment: WeekOffAssignment) => {
        try {
            const { data, error } = await supabase
                .from('week_off_assignments')
                .insert({
                    employee_id: assignment.employee_id,
                    week_off_date: assignment.week_off_date,
                    assignment_type: assignment.assignment_type,
                    recurring_day: assignment.recurring_day,
                    reason: assignment.reason,
                    assigned_by: assignment.assigned_by,
                })
                .select()
                .single();

            if (error) throw error;

            toast.success('Week off assigned successfully');
            await fetchWeekOffs(); // Refresh the list
            return { data, error: null };
        } catch (error: any) {
            console.error('Error assigning week off:', error);

            // Handle unique constraint violation
            if (error.code === '23505') {
                toast.error('Week off already assigned for this employee on this date');
            } else {
                toast.error('Failed to assign week off');
            }

            return { data: null, error };
        }
    };

    // Remove/deactivate a week off assignment
    const removeWeekOff = async (id: string) => {
        try {
            const { error } = await supabase
                .from('week_off_assignments')
                .update({ is_active: false, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;

            toast.success('Week off removed successfully');
            await fetchWeekOffs(); // Refresh the list
            return { error: null };
        } catch (error) {
            console.error('Error removing week off:', error);
            toast.error('Failed to remove week off');
            return { error };
        }
    };

    // Update a week off assignment
    const updateWeekOff = async (id: string, updates: Partial<WeekOffAssignment>) => {
        try {
            const { error } = await supabase
                .from('week_off_assignments')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;

            toast.success('Week off updated successfully');
            await fetchWeekOffs(); // Refresh the list
            return { error: null };
        } catch (error) {
            console.error('Error updating week off:', error);
            toast.error('Failed to update week off');
            return { error };
        }
    };

    // Fetch on mount
    useEffect(() => {
        fetchWeekOffs();
        // Skip realtime subscription — week_off_assignments doesn't exist in FFERPv2
        // (subscribing to a non-existent table causes "Reconnecting to server..." banner)
    }, [employeeId]);

    return {
        weekOffs,
        isLoading,
        fetchWeekOffs,
        assignWeekOff,
        removeWeekOff,
        updateWeekOff,
        isWeekOffDay,
        getWeekOffDates,
    };
}
