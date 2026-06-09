import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getWeekInfo } from '@/lib/weekHelpers';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

export function useWeeklyTargets(weekStartDate?: Date) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const weekInfo = weekStartDate ? getWeekInfo(weekStartDate) : getWeekInfo();

    // Fetch weekly target
    const { data: weeklyTarget, isLoading } = useQuery({
        queryKey: ['weekly-target', format(weekInfo.startDate, 'yyyy-MM-dd')],
        queryFn: async () => {
            const { data: userData } = await supabase.auth.getUser();
            if (!userData.user?.id) return null;

            const { data, error } = await supabase
                .from('weekly_targets')
                .select(`
          *,
          daily_tasks(*)
        `)
                .eq('core_head_id', userData.user.id)
                .eq('week_start_date', format(weekInfo.startDate, 'yyyy-MM-dd'))
                .maybeSingle();

            if (error) throw error;
            return data;
        },
    });

    // Fetch this user's deadline settings from core_heads
    const { data: coreHeadDeadlines } = useQuery({
        queryKey: ['my-core-head-deadlines'],
        queryFn: async () => {
            const { data: userData } = await supabase.auth.getUser();
            if (!userData.user?.id) return null;
            const { data } = await (supabase.from('core_heads') as any)
                .select('target_date, achievement_date')
                .eq('user_id', userData.user.id)
                .eq('is_active', true)
                .maybeSingle();
            return data as { target_date: string | null; achievement_date: string | null } | null;
        },
    });

    // Create weekly target
    const createWeeklyTarget = useMutation({
        mutationFn: async () => {
            const { data: userData } = await supabase.auth.getUser();
            const { data, error } = await supabase
                .from('weekly_targets')
                .insert({
                    core_head_id: userData.user?.id,
                    week_start_date: format(weekInfo.startDate, 'yyyy-MM-dd'),
                    week_end_date: format(weekInfo.endDate, 'yyyy-MM-dd'),
                    week_number: weekInfo.weekNumber,
                    year: weekInfo.year,
                })
                .select()
                .maybeSingle();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['weekly-target'] });
            toast({ title: 'Initialized', description: 'Week initialized successfully.' });
        },
        onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
    });

    // Add daily task
    const addDailyTask = useMutation({
        mutationFn: async (task: {
            weeklyTargetId: string;
            taskDate: Date;
            taskTitle: string;
            taskDescription?: string;
            priority: string;
            expectedOutcome?: string;
            targetValue?: number;
        }) => {
            const { data, error } = await supabase
                .from('daily_tasks')
                .insert({
                    weekly_target_id: task.weeklyTargetId,
                    task_date: format(task.taskDate, 'yyyy-MM-dd'),
                    task_title: task.taskTitle,
                    task_description: task.taskDescription,
                    priority: task.priority,
                    expected_outcome: task.expectedOutcome,
                    target_value: task.targetValue,
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['weekly-target'] });
        },
    });

    // Update daily task
    const updateDailyTask = useMutation({
        mutationFn: async ({ taskId, updates }: { taskId: string; updates: any }) => {
            const { data, error } = await supabase
                .from('daily_tasks')
                .update(updates)
                .eq('id', taskId)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['weekly-target'] });
        },
    });

    // Delete daily task
    const deleteDailyTask = useMutation({
        mutationFn: async (taskId: string) => {
            const { error } = await supabase
                .from('daily_tasks')
                .delete()
                .eq('id', taskId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['weekly-target'] });
        },
    });

    // Lock weekly target
    const lockWeeklyTarget = useMutation({
        mutationFn: async (targetId: string) => {
            const { data, error } = await supabase
                .from('weekly_targets')
                .update({
                    is_locked: true,
                    locked_at: new Date().toISOString(),
                })
                .eq('id', targetId)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['weekly-target'] });
            toast({
                title: "Success",
                description: "Weekly target locked successfully",
            });
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        }
    });

    return {
        weeklyTarget,
        isLoading,
        createWeeklyTarget,
        addDailyTask,
        updateDailyTask,
        deleteDailyTask,
        lockWeeklyTarget,
        weekInfo,
        coreHeadDeadlines,
    };
}
