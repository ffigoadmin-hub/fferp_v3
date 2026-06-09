import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProjectHealthData {
  id: string;
  project_name: string;
  client_name: string;
  lifecycle_stage: string;
  vertical_name?: string;
  vertical_color?: string;
  status: 'healthy' | 'warning' | 'critical';
  days_in_stage: number;
  boq_count: number;
  po_count: number;
  wo_count: number;
  pending_payments: number;
  total_paid: number;
  created_at: string;
  updated_at: string;
}

export interface HealthSummary {
  total_projects: number;
  healthy: number;
  warning: number;
  critical: number;
  by_stage: Record<string, number>;
}

// Health thresholds in days
const STAGE_THRESHOLDS: Record<string, { warning: number; critical: number }> = {
  new_deal: { warning: 3, critical: 7 },
  engineering_assigned: { warning: 5, critical: 10 },
  boq_draft: { warning: 7, critical: 14 },
  boq_submitted: { warning: 3, critical: 5 },
  boq_approved: { warning: 3, critical: 7 },
  sourcing: { warning: 14, critical: 21 },
  execution: { warning: 30, critical: 60 },
};

function calculateProjectHealth(project: any): 'healthy' | 'warning' | 'critical' {
  const stage = project.lifecycle_stage || 'new_deal';
  const thresholds = STAGE_THRESHOLDS[stage] || { warning: 7, critical: 14 };

  const updatedAt = new Date(project.updated_at || project.created_at);
  const now = new Date();
  const daysInStage = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));

  if (daysInStage >= thresholds.critical) return 'critical';
  if (daysInStage >= thresholds.warning) return 'warning';
  return 'healthy';
}

export function useProjectHealth(vertical?: string) {
  const [projects, setProjects] = useState<ProjectHealthData[]>([]);
  const [summary, setSummary] = useState<HealthSummary>({
    total_projects: 0,
    healthy: 0,
    warning: 0,
    critical: 0,
    by_stage: {},
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchProjects = async () => {
    try {
      setIsLoading(true);

      const query = supabase
        .from('projects')
        .select(`
          *,
          vertical:project_verticals(id, name, color)
        `)
        .neq('lifecycle_stage', 'completed')
        .order('updated_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      // Fetch counts for each project
      const projectsWithHealth = await Promise.all(
        (data || []).map(async (project) => {
          const [boqCount, poCount, woCount, paymentStats] = await Promise.all([
            supabase.from('project_boq').select('id', { count: 'exact', head: true }).eq('project_id', project.id),
            supabase.from('purchase_orders').select('id', { count: 'exact', head: true }).eq('project_id', project.id),
            supabase.from('work_orders').select('id', { count: 'exact', head: true }).eq('project_id', project.id),
            supabase.from('payment_requests').select('amount, status').eq('project_id', project.id),
          ]);

          const payments = paymentStats.data || [];
          const totalPaid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount), 0);
          const pendingPayments = payments.filter(p => ['pending', 'admin_approved', 'ceo_approved'].includes(p.status)).reduce((sum, p) => sum + Number(p.amount), 0);

          const updatedAt = new Date(project.updated_at || project.created_at);
          const now = new Date();
          const daysInStage = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));

          return {
            id: project.id,
            project_name: project.project_name,
            client_name: project.client_name || '',
            lifecycle_stage: project.lifecycle_stage || 'new_deal',
            vertical_name: project.vertical?.name,
            vertical_color: project.vertical?.color,
            status: calculateProjectHealth(project),
            days_in_stage: daysInStage,
            boq_count: boqCount.count || 0,
            po_count: poCount.count || 0,
            wo_count: woCount.count || 0,
            pending_payments: pendingPayments,
            total_paid: totalPaid,
            created_at: project.created_at,
            updated_at: project.updated_at,
          };
        })
      );

      // Filter by vertical if specified
      const filteredProjects = vertical
        ? projectsWithHealth.filter(p => p.vertical_name?.toLowerCase() === vertical.toLowerCase())
        : projectsWithHealth;

      setProjects(filteredProjects);

      // Calculate summary
      const byStage: Record<string, number> = {};
      let healthy = 0, warning = 0, critical = 0;

      filteredProjects.forEach((p) => {
        byStage[p.lifecycle_stage] = (byStage[p.lifecycle_stage] || 0) + 1;
        if (p.status === 'healthy') healthy++;
        else if (p.status === 'warning') warning++;
        else critical++;
      });

      setSummary({
        total_projects: filteredProjects.length,
        healthy,
        warning,
        critical,
        by_stage: byStage,
      });
    } catch (error) {
      console.error('Error fetching project health:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();

    const channel = supabase
      .channel('project-health-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => fetchProjects())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [vertical]);

  return { projects, summary, isLoading, refetch: fetchProjects };
}
