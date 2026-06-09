import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface BOQPipelineItem {
  id: string;
  project_id: string;
  project_name: string;
  client_name: string;
  lifecycle_stage: string;
  boq_status: 'pending' | 'draft' | 'submitted' | 'approved' | 'rejected';
  boq_count: number;
  total_estimated_value: number;
  submitted_at?: string;
  approved_at?: string;
  days_pending: number;
}

export interface BOQPipelineSummary {
  total_boqs: number;
  pending_approval: number;
  approved_today: number;
  with_deviations: number;
  total_pipeline_value: number;
}

export function useBOQPipeline() {
  const { user } = useAuth();
  const [items, setItems] = useState<BOQPipelineItem[]>([]);
  const [summary, setSummary] = useState<BOQPipelineSummary>({
    total_boqs: 0,
    pending_approval: 0,
    approved_today: 0,
    with_deviations: 0,
    total_pipeline_value: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchPipeline = async () => {
    try {
      setIsLoading(true);

      // Fetch projects in BOQ stages
      const { data: projects, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .in('lifecycle_stage', ['boq_draft', 'boq_submitted', 'boq_submitted_smo', 'boq_submitted_gmo', 'boq_approved'])
        .order('updated_at', { ascending: false });

      if (projectError) throw projectError;

      // Fetch BOQ items for each project
      const pipelineItems = await Promise.all(
        (projects || []).map(async (project) => {
          const { data: boqItems } = await supabase
            .from('project_boq')
            .select('*')
            .eq('project_id', project.id);

          const totalValue = (boqItems || []).reduce(
            (sum, item) => sum + (Number(item.quantity) * Number(item.estimated_unit_cost || 0)),
            0
          );

          const isSubmitted = ['boq_submitted', 'boq_submitted_smo', 'boq_submitted_gmo'].includes(project.lifecycle_stage);
          const submittedAt = isSubmitted ? project.updated_at : undefined;
          const approvedAt = project.lifecycle_stage === 'boq_approved' ? project.updated_at : undefined;

          const pendingDate = submittedAt ? new Date(submittedAt) : new Date(project.created_at);
          const now = new Date();
          const daysPending = Math.floor((now.getTime() - pendingDate.getTime()) / (1000 * 60 * 60 * 24));

          return {
            id: project.id,
            project_id: project.id,
            project_name: project.project_name,
            client_name: project.client_name || '',
            lifecycle_stage: project.lifecycle_stage,
            boq_status: project.lifecycle_stage === 'boq_approved' ? 'approved'
              : isSubmitted ? 'submitted'
                : 'draft',
            boq_count: (boqItems || []).length,
            total_estimated_value: totalValue,
            submitted_at: submittedAt,
            approved_at: approvedAt,
            days_pending: daysPending,
          } as BOQPipelineItem;
        })
      );

      setItems(pipelineItems);

      // Calculate summary
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const pendingApproval = pipelineItems.filter(i => i.boq_status === 'submitted').length;
      const approvedToday = pipelineItems.filter(i => {
        if (!i.approved_at) return false;
        const approvedDate = new Date(i.approved_at);
        approvedDate.setHours(0, 0, 0, 0);
        return approvedDate.getTime() === today.getTime();
      }).length;

      // Count deviations - using project_boq table for deviation status
      const deviationCount = 0; // Placeholder - no boq_deviations table exists

      const totalValue = pipelineItems.reduce((sum, i) => sum + i.total_estimated_value, 0);

      setSummary({
        total_boqs: pipelineItems.reduce((sum, i) => sum + i.boq_count, 0),
        pending_approval: pendingApproval,
        approved_today: approvedToday,
        with_deviations: deviationCount || 0,
        total_pipeline_value: totalValue,
      });
    } catch (error) {
      console.error('Error fetching BOQ pipeline:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPipeline();

    const channel = supabase
      .channel('boq-pipeline-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => fetchPipeline())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_boq' }, () => fetchPipeline())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { items, summary, isLoading, refetch: fetchPipeline };
}
