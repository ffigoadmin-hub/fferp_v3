import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface HarvestRecord {
  id: string;
  cycle_id: string;
  project_id: string;
  harvest_date: string;
  quantity: number;
  unit: string;
  quality_grade: 'A' | 'B' | 'C' | 'rejected' | null;
  notes: string | null;
  recorded_by: string;
  created_at: string;
  cycle?: { cycle_name: string; crop_type: string } | null;
  project?: { project_name: string } | null;
  recorder?: { name: string };
}

export function useHarvestRecords(projectId?: string, cycleId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const recordsQuery = useQuery({
    queryKey: ['harvest-records', projectId, cycleId],
    queryFn: async () => {
      let query = supabase
        .from('harvest_records')
        .select(`
          *,
          cycle:cultivation_cycles(cycle_name, crop_type),
          project:projects(project_name),
          recorder:profiles!harvest_records_recorded_by_fkey(name)
        `)
        .order('harvest_date', { ascending: false });

      if (projectId) query = query.eq('project_id', projectId);
      if (cycleId) query = query.eq('cycle_id', cycleId);

      const { data, error } = await query;
      if (error) throw error;
      return data as HarvestRecord[];
    },
    enabled: !!user,
  });

  const createRecord = useMutation({
    mutationFn: async (record: Omit<HarvestRecord, 'id' | 'created_at' | 'cycle' | 'project' | 'recorder'>) => {
      const { data, error } = await supabase
        .from('harvest_records')
        .insert(record)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['harvest-records'] });
      toast.success('Harvest recorded');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to record harvest');
    },
  });

  const totalYield = recordsQuery.data?.reduce((sum, r) => sum + Number(r.quantity), 0) || 0;

  return {
    records: recordsQuery.data || [],
    isLoading: recordsQuery.isLoading,
    createRecord: createRecord.mutateAsync,
    totalYield,
    refetch: recordsQuery.refetch,
  };
}
