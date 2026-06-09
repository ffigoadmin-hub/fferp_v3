import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface DailyFarmLog {
  id: string;
  project_id: string;
  cycle_id: string | null;
  log_date: string;
  reported_by: string;
  activity_type: 'watering' | 'fertilizing' | 'pest_control' | 'pruning' | 'harvesting' | 'maintenance' | 'inspection' | 'planting' | 'other';
  activity_details: string;
  quantity_used: Record<string, any>;
  weather_data: Record<string, any>;
  environmental_readings: Record<string, any>;
  issues_reported: string | null;
  photos: string[];
  location_data: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  reporter?: { name: string; role: string };
  project?: { project_name: string } | null;
  cycle?: { cycle_name: string; crop_type: string } | null;
  remarks?: Array<{ id: string; remark_type: string; remark_text: string; created_by_name: string; created_at: string }> | null;
}

export function useDailyFarmLogs(projectId?: string, date?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const logsQuery = useQuery({
    queryKey: ['daily-farm-logs', projectId, date],
    queryFn: async () => {
      let query = supabase
        .from('daily_farm_logs')
        .select(`
          *,
          reporter:profiles!daily_farm_logs_reported_by_fkey(name, role),
          project:projects(project_name),
          cycle:cultivation_cycles(cycle_name, crop_type),
          remarks:farm_manager_remarks(id, remark_type, remark_text, created_by_name, created_at)
        `)
        .order('created_at', { ascending: false });

      if (projectId) query = query.eq('project_id', projectId);
      if (date) query = query.eq('log_date', date);

      const { data, error } = await query;
      if (error) throw error;
      return data as DailyFarmLog[];
    },
    enabled: !!user,
  });

  const createLog = useMutation({
    mutationFn: async (log: Omit<DailyFarmLog, 'id' | 'created_at' | 'updated_at' | 'reporter' | 'project' | 'cycle' | 'remarks'>) => {
      const { data, error } = await supabase
        .from('daily_farm_logs')
        .insert(log)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-farm-logs'] });
      toast.success('Farm log added');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add log');
    },
  });

  const updateLog = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DailyFarmLog> & { id: string }) => {
      const { data, error } = await supabase
        .from('daily_farm_logs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-farm-logs'] });
      toast.success('Log updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update log');
    },
  });

  return {
    logs: logsQuery.data || [],
    isLoading: logsQuery.isLoading,
    createLog: createLog.mutateAsync,
    updateLog: updateLog.mutateAsync,
    refetch: logsQuery.refetch,
  };
}
