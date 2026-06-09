import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProjectPhase {
  id: string;
  project_id: string;
  phase_name: string;
  phase_order: number;
  status: string;
  description?: string | null;
  estimated_cost?: number | null;
  actual_cost?: number | null;
  completion_percentage?: number | null;
  started_at?: string | null;
  completed_at?: string | null;
}

export function useProjectPhases(projectId?: string) {
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const currentProjectIdRef = useRef<string | undefined>(undefined);
  const isMountedRef = useRef(false);

  const fetchPhases = useCallback(async () => {
    if (!projectId) {
      setPhases([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('project_phases')
        .select('id, project_id, phase_name, description, phase_order, status, estimated_cost, actual_cost, completion_percentage, started_at, completed_at')
        .eq('project_id', projectId)
        .order('phase_order', { ascending: true });

      if (error) throw error;
      setPhases(data || []);
    } catch (error) {
      console.error('Error fetching project phases:', error);
      setPhases([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!isMountedRef.current || projectId !== currentProjectIdRef.current) {
      isMountedRef.current = true;
      currentProjectIdRef.current = projectId;
      fetchPhases();
    }
  }, [projectId, fetchPhases]);

  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`project-phases-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_phases', filter: `project_id=eq.${projectId}` },
        () => {
          fetchPhases();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, fetchPhases]);

  const addPhase = async (phaseData: { phase_name: string; description?: string; estimated_cost?: number; started_at?: string }) => {
    const maxOrder = phases.length > 0 ? Math.max(...phases.map(p => p.phase_order)) : 0;
    const { error } = await (supabase.from('project_phases') as any).insert({
      project_id: projectId,
      phase_name: phaseData.phase_name,
      description: phaseData.description,
      estimated_cost: phaseData.estimated_cost,
      started_at: phaseData.started_at,
      phase_order: maxOrder + 1,
      status: 'pending',
      completion_percentage: 0,
    });
    if (error) throw error;
    await fetchPhases();
  };

  const updatePhaseProgress = async (phaseId: string, progress: number, startedAt?: string) => {
    const updates: any = { completion_percentage: progress };
    if (startedAt) updates.started_at = startedAt;
    if (progress === 100) {
      updates.status = 'completed';
      updates.completed_at = new Date().toISOString();
    } else if (progress > 0) {
      updates.status = 'in_progress';
    }
    const { error } = await (supabase.from('project_phases') as any).update(updates).eq('id', phaseId);
    if (error) throw error;
    await fetchPhases();
  };

  const deletePhase = async (phaseId: string) => {
    const { error } = await (supabase.from('project_phases') as any).delete().eq('id', phaseId);
    if (error) return { success: false, error };
    await fetchPhases();
    return { success: true };
  };

  return { phases, isLoading, refetch: fetchPhases, addPhase, updatePhaseProgress, deletePhase };
}
