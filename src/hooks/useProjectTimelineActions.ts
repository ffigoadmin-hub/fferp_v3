import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useProjectTimelineActions() {
  const { user } = useAuth();

  const addTimelineEntry = async (
    projectId: string,
    action: string,
    details?: Record<string, any>
  ) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const { data, error } = await supabase
        .from('project_timeline')
        .insert({
          project_id: projectId,
          action,
          performed_by: user.id,
          performed_by_name: user.name,
          performed_by_role: user.role,
          details,
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error: any) {
      console.error('Error adding timeline entry:', error);
      return { success: false, error };
    }
  };

  const addVerificationRemark = async (
    projectId: string,
    updateId: string,
    remark: string,
    remarkType: 'verified' | 'followed_up' | 'remark'
  ) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      // Add to project timeline
      const { error } = await supabase
        .from('project_timeline')
        .insert({
          project_id: projectId,
          action: `${remarkType === 'verified' ? 'Verified' : remarkType === 'followed_up' ? 'Followed up on' : 'Remarked on'} site update`,
          performed_by: user.id,
          performed_by_name: user.name,
          performed_by_role: user.role,
          details: {
            update_id: updateId,
            remark,
            remark_type: remarkType,
          },
        });

      if (error) throw error;
      
      toast.success('Remark added to timeline');
      return { success: true };
    } catch (error: any) {
      console.error('Error adding remark:', error);
      toast.error('Failed to add remark');
      return { success: false, error };
    }
  };

  return {
    addTimelineEntry,
    addVerificationRemark,
  };
}
