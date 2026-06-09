import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface CultivationCycle {
  id: string;
  project_id: string;
  cycle_name: string;
  crop_type: string;
  start_date: string;
  expected_harvest_date: string | null;
  actual_harvest_date: string | null;
  project?: { project_name: string; vertical: string } | null;
  status: 'active' | 'completed' | 'failed' | 'paused';
  growing_conditions: Record<string, any>;
  stage: 'germination' | 'seedling' | 'vegetative' | 'flowering' | 'fruiting' | 'harvest' | 'post_harvest';
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  
}

export function useCultivationCycles(projectId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const cyclesQuery = useQuery({
    queryKey: ['cultivation-cycles', projectId],
    queryFn: async () => {
      let query = supabase
        .from('cultivation_cycles')
        .select('*, project:projects(project_name, vertical)')
        .order('created_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CultivationCycle[];
    },
    enabled: !!user,
  });

  const createCycle = useMutation({
    mutationFn: async (cycle: Omit<CultivationCycle, 'id' | 'created_at' | 'updated_at' | 'project'>) => {
      const { data, error } = await supabase
        .from('cultivation_cycles')
        .insert({ ...cycle, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cultivation-cycles'] });
      toast.success('Cultivation cycle created');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create cycle');
    },
  });

  const updateCycle = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CultivationCycle> & { id: string }) => {
      const { data, error } = await supabase
        .from('cultivation_cycles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cultivation-cycles'] });
      toast.success('Cycle updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update cycle');
    },
  });

  return {
    cycles: cyclesQuery.data || [],
    isLoading: cyclesQuery.isLoading,
    createCycle: createCycle.mutateAsync,
    updateCycle: updateCycle.mutateAsync,
    refetch: cyclesQuery.refetch,
  };
}
