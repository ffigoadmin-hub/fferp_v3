import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export function useCoreHeads() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: usersRaw, isLoading, error } = useQuery({
        queryKey: ['core-heads-management'],
        queryFn: async () => {
            // 1. Fetch all profiles
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, name, email, role, department')
                .order('name', { ascending: true });

            if (profilesError) {
                console.error('[useCoreHeads] profiles fetch error:', profilesError);
                throw profilesError;
            }

            console.log('[useCoreHeads] profiles fetched:', profiles?.length);

            if (!profiles || profiles.length === 0) return [];

            // 2. Fetch all core_heads records (ignore error — table may be empty)
            const { data: coreHeads, error: coreHeadsError } = await supabase
                .from('core_heads')
                .select('id, user_id, is_active, tagged_at, tagged_by');

            if (coreHeadsError) {
                console.warn('[useCoreHeads] core_heads fetch error (non-fatal):', coreHeadsError);
            }

            console.log('[useCoreHeads] core_heads fetched:', coreHeads?.length ?? 0);

            // 3. Merge client-side
            const coreHeadMap = new Map(
                (coreHeads || []).map(ch => [ch.user_id, ch])
            );

            // Cast to any to avoid deep type recursion in complex Supabase joins
            return (profiles as any[]).map(profile => ({
                ...profile,
                core_head: coreHeadMap.get(profile.id) ?? null,
            }));
        },
    });

    // Tag user as Core Manager
    const tagCoreHead = useMutation({
        mutationFn: async (userId: string) => {
            const { data: userData } = await supabase.auth.getUser();

            // Upsert: use insert with onConflict to handle re-tagging
            const { data, error } = await supabase
                .from('core_heads')
                .upsert(
                    {
                        user_id: userId,
                        is_active: true,
                        tagged_at: new Date().toISOString(),
                        tagged_by: userData.user?.id,
                    },
                    { onConflict: 'user_id' }
                )
                .select()
                .single();

            if (error) {
                console.error('[useCoreHeads] tag error:', error);
                throw error;
            }
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['core-heads-management'] });
            toast({ title: 'Success', description: 'User tagged as Core Manager' });
        },
        onError: (error: any) => {
            toast({
                title: 'Error tagging Core Manager',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    // Untag user as Core Manager
    const untagCoreHead = useMutation({
        mutationFn: async (userId: string) => {
            const { data: userData } = await supabase.auth.getUser();
            const { data, error } = await supabase
                .from('core_heads')
                .update({
                    is_active: false,
                    untagged_by: userData.user?.id,
                    untagged_at: new Date().toISOString(),
                })
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                console.error('[useCoreHeads] untag error:', error);
                throw error;
            }
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['core-heads-management'] });
            toast({ title: 'Success', description: 'User untagged as Core Manager' });
        },
        onError: (error: any) => {
            toast({
                title: 'Error',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    // Unlock weekly targets for a Core Manager
    const unlockTargets = useMutation({
        mutationFn: async (coreHeadId: string) => {
            const { error } = await supabase
                .from('weekly_targets')
                .update({
                    is_locked: false,
                    is_unlocked_by_admin: true,
                })
                .eq('core_head_id', coreHeadId)
                .eq('is_locked', true);

            if (error) {
                console.error('[useCoreHeads] unlock error:', error);
                throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['core-heads-management'] });
            toast({ title: 'Targets Unlocked', description: 'Weekly targets have been unlocked for editing.' });
        },
        onError: (error: any) => {
            toast({
                title: 'Unlock Failed',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    // Set weekly target date for a Core Manager
    const setWeeklyTarget = useMutation({
        mutationFn: async ({ coreHeadId, targetDate }: { coreHeadId: string; targetDate: string }) => {
            const { error } = await supabase
                .from('core_heads')
                .update({
                    target_date: targetDate,
                } as any)
                .eq('user_id', coreHeadId);

            if (error) {
                console.error('[useCoreHeads] setWeeklyTarget error:', error);
                throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['core-heads-management'] });
            toast({ title: 'Target Date Set', description: 'Weekly target date updated.' });
        },
        onError: (error: any) => {
            toast({
                title: 'Error Setting Target',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    // Set weekly achievement deadline for a Core Manager
    const setWeeklyAchievement = useMutation({
        mutationFn: async ({ coreHeadId, achievementDeadline }: { coreHeadId: string; achievementDeadline: string }) => {
            const { error } = await supabase
                .from('core_heads')
                .update({
                    achievement_date: achievementDeadline,
                } as any)
                .eq('user_id', coreHeadId);

            if (error) {
                console.error('[useCoreHeads] setWeeklyAchievement error:', error);
                throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['core-heads-management'] });
            toast({ title: 'Achievement Deadline Set', description: 'Weekly achievement deadline updated.' });
        },
        onError: (error: any) => {
            toast({
                title: 'Error Setting Achievement Deadline',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    // Bulk tag users as Core Managers
    const bulkTagCoreHeads = useMutation({
        mutationFn: async (userIds: string[]) => {
            const { data: userData } = await supabase.auth.getUser();
            const now = new Date().toISOString();
            const records = userIds.map(uid => ({
                user_id: uid,
                is_active: true,
                tagged_at: now,
                tagged_by: userData.user?.id,
            }));
            const { error } = await supabase
                .from('core_heads')
                .upsert(records, { onConflict: 'user_id' });
            if (error) throw error;
        },
        onSuccess: (_, ids) => {
            queryClient.invalidateQueries({ queryKey: ['core-heads-management'] });
            toast({ title: 'Bulk Tag Complete', description: `${ids.length} user(s) tagged as Core Manager.` });
        },
        onError: (e: any) => toast({ title: 'Bulk Tag Failed', description: e.message, variant: 'destructive' }),
    });

    // Bulk untag users as Core Managers
    const bulkUntagCoreHeads = useMutation({
        mutationFn: async (userIds: string[]) => {
            const { data: userData } = await supabase.auth.getUser();
            const now = new Date().toISOString();
            const { error } = await supabase
                .from('core_heads')
                .update({ is_active: false, untagged_by: userData.user?.id, untagged_at: now })
                .in('user_id', userIds);
            if (error) throw error;
        },
        onSuccess: (_, ids) => {
            queryClient.invalidateQueries({ queryKey: ['core-heads-management'] });
            toast({ title: 'Bulk Untag Complete', description: `${ids.length} user(s) untagged.` });
        },
        onError: (e: any) => toast({ title: 'Bulk Untag Failed', description: e.message, variant: 'destructive' }),
    });

    // Clear ALL weekly targets + achievements (full data purge for admin)
    const clearAllWeeklyData = useMutation({
        mutationFn: async () => {
            const [t, a] = await Promise.all([
                (supabase.from('weekly_targets') as any).delete().neq('id', '00000000-0000-0000-0000-000000000000'),
                (supabase.from('weekly_achievements') as any).delete().neq('id', '00000000-0000-0000-0000-000000000000'),
            ]);
            if (t.error) throw t.error;
            if (a.error) console.warn('[clearAllWeeklyData] achievements delete warn:', a.error);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['core-heads-management'] });
            toast({ title: '🗑️ Weekly Data Cleared', description: 'All weekly targets and achievements have been deleted.' });
        },
        onError: (e: any) => toast({ title: 'Clear Failed', description: e.message, variant: 'destructive' }),
    });

    // --- GLOBAL DEADLINES ---
    // Read the current global deadline from the first active core_head record
    const globalDeadlines = {
        target_date: (usersRaw as any)?.[0]?.core_head?.target_date ?? null as string | null,
        achievement_date: (usersRaw as any)?.[0]?.core_head?.achievement_date ?? null as string | null,
    };

    // Set the same target_date + achievement_date on ALL active core_heads at once
    const setGlobalDeadlines = useMutation({
        mutationFn: async ({ targetDate, achievementDate }: { targetDate: string; achievementDate: string }) => {
            const { error } = await (supabase.from('core_heads') as any)
                .update({
                    target_date: targetDate,
                    achievement_date: achievementDate,
                } as any)
                .eq('is_active', true);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['core-heads-management'] });
            queryClient.invalidateQueries({ queryKey: ['my-core-head-deadlines'] });
            toast({
                title: '✅ Global Deadlines Set',
                description: 'Target & achievement deadlines applied to all active Core Managers.',
            });
        },
        onError: (e: any) => toast({ title: 'Failed to set deadlines', description: e.message, variant: 'destructive' }),
    });

    return {
        users: usersRaw,
        isLoading,
        error,
        tagCoreHead,
        untagCoreHead,
        unlockTargets,
        setWeeklyTarget,
        setWeeklyAchievement,
        bulkTagCoreHeads,
        bulkUntagCoreHeads,
        clearAllWeeklyData,
        globalDeadlines,
        setGlobalDeadlines,
    };
}
