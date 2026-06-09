import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProjectIntakeAssignmentInput {
  projectId: string;
  gmoId: string;
  smoId: string;
  engineerId: string;
  reviewNotes?: string;
}

export function useProjectIntakeProjects() {
  return useQuery({
    queryKey: ['project-intake-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          project_id,
          project_name,
          client_name,
          location_city,
          location_state,
          created_at,
          created_by,
          uploaded_by_bd_data_id,
          intake_status,
          lifecycle_stage,
          project_category,
          project_category_tags,
          vertical_id,
          assigned_manager_id,
          assigned_project_engineer_id,
          assigned_engineer_id
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useProjectIntakeQueue() {
  return useQuery({
    queryKey: ['project-intake-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          project_id,
          project_name,
          client_name,
          location_city,
          location_state,
          created_at,
          created_by,
          uploaded_by_bd_data_id,
          intake_status,
          project_category,
          project_category_tags,
          vertical_id
        `)
        .in('intake_status', ['pending_admin_review', 'assignment_pending'])
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    },
  });
}

export function useAssignProjectTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      gmoId,
      smoId,
      engineerId,
      reviewNotes,
    }: ProjectIntakeAssignmentInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const now = new Date().toISOString();

      const { error } = await supabase
        .from('projects')
        .update({
          assigned_manager_id: gmoId,
          assigned_project_engineer_id: smoId,
          assigned_engineer_id: engineerId,
          intake_status: 'engineering_assigned',
          admin_reviewed_by: user?.id ?? null,
          admin_reviewed_at: now,
          admin_review_notes: reviewNotes ?? null,
          stage_engineering_assigned_at: now,
        })
        .eq('id', projectId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-intake-queue'] });
      queryClient.invalidateQueries({ queryKey: ['project-intake-projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
