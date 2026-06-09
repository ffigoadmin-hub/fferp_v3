import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Project {
  id: string;
  project_id: string;
  project_name: string;
  client_name: string;
  status: string;
  created_at: string;
  vertical?: string;
  location_city?: string;
  location_state?: string;
  lifecycle_stage?: string;
  assigned_engineer_id?: string;
  assigned_site_manager_id?: string;
  assigned_manager_id?: string;
  assigned_project_engineer_id?: string;
  department?: string;
  project_type?: string;
  project_vertical?: string;
  boq_rejection_reason?: string;
  updated_at?: string;
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(false);

  const fetchProjects = useCallback(async (isInitial = true) => {
    console.log('[useProjects] Fetching projects...');
    if (isInitial) setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_id, project_name, client_name, status, created_at, vertical, location_city, location_state, lifecycle_stage, assigned_engineer_id, assigned_site_manager_id, assigned_manager_id, assigned_project_engineer_id, department, project_type, project_vertical, boq_rejection_reason, updated_at')
        .order('project_name');

      if (error) throw error;
      if (error) throw error;
      console.log('[useProjects] Successfully fetched', data?.length, 'active/upcoming projects from DB');
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      if (isInitial) setIsLoading(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      fetchProjects();
    }
  }, [fetchProjects]);

  // Real-time subscription
  useEffect(() => {
    console.log('[useProjects] Setting up real-time subscription');

    const channel = supabase
      .channel('projects-realtime-hook')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, (payload) => {
        console.log('[useProjects] Real-time update received:', payload.eventType);
        fetchProjects(false);
      })
      .subscribe((status) => {
        console.log('[useProjects] Subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchProjects]);

  const getProjectById = (id: string) => {
    return projects.find(p => p.id === id);
  };

  return {
    projects,
    isLoading,
    getProjectById,
    refetch: fetchProjects,
  };
}
