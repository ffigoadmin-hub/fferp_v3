import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { LifecycleStage, LIFECYCLE_STAGES } from '@/constants/projectCategories';

export interface ProjectWithLifecycle {
  id: string;
  project_id: string;
  project_name: string;
  client_name: string;
  project_category: string | null;
  vertical_id: string | null;
  lifecycle_stage: string | null;
  deal_file_url: string | null;
  assigned_manager_id: string | null;
  assigned_engineer_id: string | null;
  assigned_site_manager_id: string | null;
  assigned_project_engineer_id: string | null;
  boq_submitted_at: string | null;
  boq_approved_at: string | null;
  boq_rejection_reason: string | null;
  created_at: string | null;
  status: string | null;
  target_start_date: string | null;
  vertical?: {
    id: string;
    name: string;
    icon: string;
    color: string;
    category: string;
  } | null;
  manager?: { id: string; name: string; email: string } | null;
  engineer?: { id: string; name: string; email: string } | null;
  site_manager?: { id: string; name: string; email: string } | null;
  project_engineer?: { id: string; name: string; email: string } | null;
}

export interface ProjectAging {
  total_age_days: number;
  current_stage: string;
  stage_ages: {
    new_deal: number;
    engineering_assigned: number;
    boq_pending: number;
    sourcing: number;
    execution: number;
  };
}

export function useProjectLifecycle(projectId?: string) {
  const { user } = useAuth();
  const [project, setProject] = useState<ProjectWithLifecycle | null>(null);
  const [aging, setAging] = useState<ProjectAging | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchProject = async () => {
    if (!projectId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          vertical:project_verticals(id, name, icon, color, category),
          manager:profiles!projects_assigned_manager_id_fkey(id, name, email),
          engineer:profiles!projects_assigned_engineer_id_fkey(id, name, email)
        `)
        .eq('id', projectId)
        .single();

      if (error) throw error;
      setProject(data as unknown as ProjectWithLifecycle);

      // Fetch aging data
      const { data: agingData } = await supabase.rpc('get_project_aging', { p_project_id: projectId });
      if (agingData) {
        setAging(agingData as unknown as ProjectAging);
      }
    } catch (error) {
      console.error('Error fetching project:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  // Real-time synchronization
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`project-lifecycle-${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'projects',
        filter: `id=eq.${projectId}`
      }, (payload) => {
        console.log('[useProjectLifecycle] Real-time project update:', payload.eventType);
        fetchProject();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const updateLifecycleStage = async (newStage: LifecycleStage) => {
    if (!project || !user) return { success: false, error: 'Not authenticated' };

    setIsSaving(true);
    try {
      const stageTimestampField = `stage_${newStage}_at`;
      const updates: Record<string, any> = {
        lifecycle_stage: newStage,
        [stageTimestampField]: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', project.id);

      if (error) throw error;

      // Log to timeline
      await supabase.from('project_timeline').insert({
        project_id: project.id,
        action: `stage_changed_to_${newStage}`,
        performed_by: user.id,
        performed_by_name: user.name,
        performed_by_role: user.role,
        details: { from_stage: project.lifecycle_stage, to_stage: newStage },
      });

      toast.success(`Project moved to ${LIFECYCLE_STAGES.find(s => s.value === newStage)?.label}`);
      await fetchProject();
      return { success: true };
    } catch (error: any) {
      toast.error(error.message || 'Failed to update stage');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const assignTeam = async (assignments: {
    assigned_manager_id?: string;
    assigned_project_engineer_id?: string;
    assigned_site_manager_id?: string;
  }) => {
    if (!project || !user) return { success: false, error: 'Not authenticated' };

    setIsSaving(true);
    try {
      const updates = {
        ...assignments,
        lifecycle_stage: 'engineering_assigned',
        stage_engineering_assigned_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', project.id);

      if (error) throw error;

      await supabase.from('project_timeline').insert({
        project_id: project.id,
        action: 'team_assigned',
        performed_by: user.id,
        performed_by_name: user.name,
        performed_by_role: user.role,
        details: assignments,
      });

      toast.success('Team assigned successfully');
      await fetchProject();
      return { success: true };
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign team');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  return {
    project,
    aging,
    isLoading,
    isSaving,
    updateLifecycleStage,
    assignTeam,
    refetch: fetchProject,
  };
}
