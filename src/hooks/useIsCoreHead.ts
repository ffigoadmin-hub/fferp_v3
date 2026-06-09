import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useIsCoreHead() {
    const { user } = useAuth();

    const { data: isCoreHead = false, isLoading } = useQuery({
        queryKey: ['is-core-head', user?.id],
        queryFn: async () => {
            if (!user?.id) return false;
            const { data, error } = await supabase
                .from('core_heads')
                .select('id, is_active')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .maybeSingle();
            if (error) return false;
            return !!data;
        },
        enabled: !!user?.id,
        staleTime: 5 * 60 * 1000, // cache 5 mins
    });

    return { isCoreHead, isLoading };
}
