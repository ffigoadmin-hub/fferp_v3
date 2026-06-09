import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

export function useWeeklyAchievements(weeklyTargetId?: string) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    // Fetch achievement
    const { data: achievement, isLoading } = useQuery({
        queryKey: ['weekly-achievement', weeklyTargetId],
        queryFn: async () => {
            if (!weeklyTargetId) return null;

            const { data, error } = await supabase
                .from('weekly_achievements')
                .select(`
          *,
          task_achievements(
            *,
            daily_task:daily_tasks(*)
          )
        `)
                .eq('weekly_target_id', weeklyTargetId)
                .maybeSingle();

            if (error) throw error;
            return data;
        },
        enabled: !!weeklyTargetId,
    });

    // Create achievement
    const createAchievement = useMutation({
        mutationFn: async (data: {
            weeklyTargetId: string;
            weekStartDate: Date;
            weekEndDate: Date;
            weekNumber: number;
            year: number;
            submissionDeadline?: Date;
        }) => {
            const { data: userData } = await supabase.auth.getUser();
            const { data: result, error } = await supabase
                .from('weekly_achievements')
                .insert({
                    weekly_target_id: data.weeklyTargetId,
                    core_head_id: userData.user?.id,
                    week_start_date: format(data.weekStartDate, 'yyyy-MM-dd'),
                    week_end_date: format(data.weekEndDate, 'yyyy-MM-dd'),
                    week_number: data.weekNumber,
                    year: data.year,
                    submission_deadline: data.submissionDeadline?.toISOString(),
                    overall_summary: '',
                })
                .select()
                .single();

            if (error) throw error;
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['weekly-achievement'] });
        },
    });

    // Update achievement
    const updateAchievement = useMutation({
        mutationFn: async ({ achievementId, updates }: { achievementId: string; updates: any }) => {
            const { data, error } = await supabase
                .from('weekly_achievements')
                .update(updates)
                .eq('id', achievementId)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['weekly-achievement'] });
        },
    });

    // Add task achievement
    const addTaskAchievement = useMutation({
        mutationFn: async (data: {
            weeklyAchievementId: string;
            dailyTaskId: string;
            actualAchievement: string;
            actualValue?: number;
            status: string;
            notes?: string;
            proofUrl?: string;
        }) => {
            const { data: result, error } = await supabase
                .from('task_achievements')
                .upsert({
                    weekly_achievement_id: data.weeklyAchievementId,
                    daily_task_id: data.dailyTaskId,
                    actual_achievement: data.actualAchievement,
                    actual_value: data.actualValue,
                    status: data.status,
                    notes: data.notes,
                    proof_url: data.proofUrl,
                }, { onConflict: 'weekly_achievement_id,daily_task_id' })
                .select()
                .single();

            if (error) throw error;
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['weekly-achievement'] });
        },
    });

    // Submit achievement
    const submitAchievement = useMutation({
        mutationFn: async (achievementId: string) => {
            // Calculate metrics
            const { data: taskAchievements } = await supabase
                .from('task_achievements')
                .select('status')
                .eq('weekly_achievement_id', achievementId);

            const totalTasks = taskAchievements?.length || 0;
            const completedTasks = taskAchievements?.filter(t => t.status === 'completed').length || 0;
            const completionPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

            // Check if late
            const { data: achievement } = await supabase
                .from('weekly_achievements')
                .select('submission_deadline')
                .eq('id', achievementId)
                .single();

            const isLate = achievement?.submission_deadline
                ? new Date() > new Date(achievement.submission_deadline)
                : false;

            // Update achievement
            const { data, error } = await supabase
                .from('weekly_achievements')
                .update({
                    is_submitted: true,
                    submitted_at: new Date().toISOString(),
                    is_late: isLate,
                    total_tasks: totalTasks,
                    completed_tasks: completedTasks,
                    completion_percentage: completionPercentage,
                })
                .eq('id', achievementId)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['weekly-achievement'] });
            toast({
                title: "Success",
                description: "Achievement submitted successfully",
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
        achievement,
        isLoading,
        createAchievement,
        updateAchievement,
        addTaskAchievement,
        submitAchievement,
    };
}
