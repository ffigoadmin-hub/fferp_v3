import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface FarmManagerRemark {
  id: string;
  site_update_id: string | null;
  farm_log_id: string | null;
  remark_type: 'verified' | 'followed_up' | 'needs_attention' | 'approved' | 'rejected';
  remark_text: string | null;
  created_by: string;
  created_by_name: string | null;
  created_by_role: string | null;
  created_at: string;
}

export function useFarmManagerRemarks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const addRemark = useMutation({
    mutationFn: async ({
      siteUpdateId,
      farmLogId,
      remarkType,
      remarkText,
      projectId,
    }: {
      siteUpdateId?: string;
      farmLogId?: string;
      remarkType: FarmManagerRemark['remark_type'];
      remarkText?: string;
      projectId?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      // Insert remark
      const { data, error } = await supabase
        .from('farm_manager_remarks')
        .insert({
          site_update_id: siteUpdateId || null,
          farm_log_id: farmLogId || null,
          remark_type: remarkType,
          remark_text: remarkText || null,
          created_by: user.id,
          created_by_name: user.name,
          created_by_role: user.role,
        })
        .select()
        .single();

      if (error) throw error;

      // Also add to project timeline if projectId provided
      if (projectId) {
        await supabase.from('project_timeline').insert({
          project_id: projectId,
          action: `Farm Manager ${remarkType === 'verified' ? 'verified' : remarkType === 'followed_up' ? 'followed up on' : remarkType} update`,
          performed_by: user.id,
          performed_by_name: user.name,
          performed_by_role: user.role,
          details: {
            site_update_id: siteUpdateId,
            farm_log_id: farmLogId,
            remark_type: remarkType,
            remark_text: remarkText,
          },
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-farm-logs'] });
      queryClient.invalidateQueries({ queryKey: ['daily-site-updates'] });
      queryClient.invalidateQueries({ queryKey: ['project-timeline'] });
      toast.success('Remark added');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add remark');
    },
  });

  return {
    addRemark: addRemark.mutateAsync,
    isAdding: addRemark.isPending,
  };
}
