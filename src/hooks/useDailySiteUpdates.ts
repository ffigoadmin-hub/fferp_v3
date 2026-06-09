import { isMissingTable } from '@/lib/supabase-error-guard';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface DailySiteUpdate {
  id: string;
  project_id: string;
  phase_id: string | null;
  reported_by: string;
  update_date: string;
  work_done: string;
  materials_used: any[];
  labor_count: number;
  issues_faced: string | null;
  photos: string[];
  location_data: any;
  weather_conditions: string | null;
  progress_percentage: number;
  created_at: string;
  // Joined fields
  project?: { project_name: string; project_id: string };
  phase?: { phase_name: string };
  reporter?: { name: string; email: string };
}

export function useDailySiteUpdates(projectId?: string) {
  const { user } = useAuth();
  const [updates, setUpdates] = useState<DailySiteUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchUpdates = async () => {
    if (!user) return;
    setIsLoading(true);
    
    try {
      let query = supabase
        .from('daily_site_updates')
        .select(`
          *,
          project:projects(project_name, project_id),
          phase:project_phases(phase_name),
          reporter:profiles!daily_site_updates_reported_by_fkey(name, email)
        `)
        .order('update_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setUpdates(data as DailySiteUpdate[] || []);
    } catch (error: any) {
      console.error('Error fetching site updates:', error);
      if (!isMissingTable(error)) toast.error('Failed to load site updates');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUpdates();
  }, [user, projectId]);

  const createUpdate = async (data: {
    project_id: string;
    phase_id?: string;
    work_done: string;
    materials_used?: any[];
    labor_count?: number;
    issues_faced?: string;
    photos?: string[];
    location_data?: any;
    weather_conditions?: string;
    progress_percentage?: number;
  }) => {
    if (!user) return;
    setIsSaving(true);

    try {
      const payload = {
        ...data,
        reported_by: user.id,
        update_date: new Date().toISOString().split('T')[0],
      };
      
      console.log('Submitting site update payload:', payload);

      const { error } = await supabase
        .from('daily_site_updates')
        .insert(payload);

      if (error) {
        console.error('Supabase error inserting site update:', error);
        throw error;
      }
      
      toast.success('Site update submitted successfully');
      await fetchUpdates();
    } catch (error: any) {
      console.error('Detailed error creating site update:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      toast.error(error.message || 'Failed to submit site update');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const updateSiteUpdate = async (id: string, updates: Partial<DailySiteUpdate>) => {
    if (!user) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('daily_site_updates')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      toast.success('Site update modified');
      await fetchUpdates();
    } catch (error: any) {
      console.error('Error updating site update:', error);
      toast.error('Failed to modify site update');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    updates,
    isLoading,
    isSaving,
    createUpdate,
    updateSiteUpdate,
    refetch: fetchUpdates,
  };
}
