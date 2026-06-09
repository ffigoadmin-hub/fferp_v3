// @ts-nocheck
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProjectPhaseInsight {
  id: string;
  project_id: string;
  phase_name: string;
  phase_order: number;
  status: string;
  completion_percentage: number;
}

export interface ProjectMilestoneInsight {
  id: string;
  project_id: string;
  milestone_name: string;
  status: string;
  completion_percentage: number;
  planned_date: string;
  actual_date: string | null;
  phase_id: string | null;
}

export interface ProjectEscalationInsight {
  id: string;
  project_id: string;
  title: string;
  severity: string;
  status: string;
  created_at: string;
}

export interface ProjectInsightsSummary {
  projectId: string;
  phases: ProjectPhaseInsight[];
  milestones: ProjectMilestoneInsight[];
  escalations: ProjectEscalationInsight[];
  // Computed
  totalPhases: number;
  completedPhases: number;
  avgPhaseCompletion: number;
  totalMilestones: number;
  completedMilestones: number;
  delayedMilestones: number;
  nextMilestone: ProjectMilestoneInsight | null;
  openEscalations: number;
  criticalEscalations: number;
}

export function useProjectInsights(projectIds: string[]) {
  const { data: phasesData, isLoading: loadingPhases } = useQuery({
    queryKey: ['bulk-project-phases', projectIds.length],
    queryFn: async () => {
      if (projectIds.length === 0) return [];
      const { data, error } = await supabase
        .from('project_phases')
        .select('id, project_id, phase_name, phase_order, status, completion_percentage')
        .in('project_id', projectIds)
        .order('phase_order', { ascending: true });
      if (error) throw error;
      return (data || []) as ProjectPhaseInsight[];
    },
    enabled: projectIds.length > 0,
    staleTime: 30000,
  });

  const { data: milestonesData, isLoading: loadingMilestones } = useQuery({
    queryKey: ['bulk-project-milestones', projectIds.length],
    queryFn: async () => {
      if (projectIds.length === 0) return [];
      const { data, error } = await supabase
        .from('project_milestones')
        .select('id, project_id, milestone_name, status, completion_percentage, planned_date, actual_date, phase_id')
        .in('project_id', projectIds)
        .order('planned_date', { ascending: true });
      if (error) throw error;
      return (data || []) as ProjectMilestoneInsight[];
    },
    enabled: projectIds.length > 0,
    staleTime: 30000,
  });

  const { data: escalationsData, isLoading: loadingEscalations } = useQuery({
    queryKey: ['bulk-project-escalations', projectIds.length],
    queryFn: async () => {
      if (projectIds.length === 0) return [];
      const { data, error } = await supabase
        .from('escalations')
        .select('id, project_id, title, severity, status, created_at')
        .in('project_id', projectIds)
        .in('status', ['open', 'in_progress', 'pending', 'assigned']);
      if (error) throw error;
      return (data || []) as ProjectEscalationInsight[];
    },
    enabled: projectIds.length > 0,
    staleTime: 30000,
  });

  const getInsights = (projectId: string): ProjectInsightsSummary => {
    const phases = (phasesData || []).filter(p => p.project_id === projectId);
    const milestones = (milestonesData || []).filter(m => m.project_id === projectId);
    const escalations = (escalationsData || []).filter(e => e.project_id === projectId);

    const completedPhases = phases.filter(p => p.status === 'completed').length;
    const avgPhaseCompletion = phases.length > 0
      ? Math.round(phases.reduce((sum, p) => sum + (p.completion_percentage || 0), 0) / phases.length)
      : 0;

    const completedMilestones = milestones.filter(m => m.status === 'completed').length;
    const today = new Date();
    const delayedMilestones = milestones.filter(
      m => m.status !== 'completed' && new Date(m.planned_date) < today
    ).length;

    const nextMilestone = milestones.find(m => m.status !== 'completed' && new Date(m.planned_date) >= today) 
      || milestones.find(m => m.status !== 'completed') 
      || null;

    const criticalEscalations = escalations.filter(e => e.severity === 'critical').length;

    return {
      projectId,
      phases,
      milestones,
      escalations,
      totalPhases: phases.length,
      completedPhases,
      avgPhaseCompletion,
      totalMilestones: milestones.length,
      completedMilestones,
      delayedMilestones,
      nextMilestone,
      openEscalations: escalations.length,
      criticalEscalations,
    };
  };

  return {
    getInsights,
    isLoading: loadingPhases || loadingMilestones || loadingEscalations,
    phasesData: phasesData || [],
    milestonesData: milestonesData || [],
    escalationsData: escalationsData || [],
  };
}
