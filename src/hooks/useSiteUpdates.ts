import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isToday, parseISO, startOfDay, endOfDay } from 'date-fns';

export interface SiteUpdateSummary {
  totalUpdatesToday: number;
  totalLaborToday: number;
  projectsUpdatedToday: number;
  issuesReportedToday: number;
  averageProgress: number;
  updatesByProject: Array<{
    project_id: string;
    project_name: string;
    update_count: number;
    total_labor: number;
    latest_update: string;
    has_issues: boolean;
  }>;
  recentUpdates: Array<{
    id: string;
    project_id: string;
    project_name: string;
    work_done: string;
    labor_count: number;
    progress_percentage: number;
    issues_faced: string | null;
    update_date: string;
    reporter_name: string;
  }>;
}

export function useSiteUpdates(projectId?: string) {
  const [summary, setSummary] = useState<SiteUpdateSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSummary = async () => {
    try {
      setIsLoading(true);

      let query = supabase
        .from('daily_site_updates')
        .select(`
          *,
          project:projects(project_name, project_id),
          reporter:profiles!daily_site_updates_reported_by_fkey(name)
        `)
        .order('update_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const updates = data || [];

      // Filter today's updates
      const todayUpdates = updates.filter(u => {
        const updateDate = u.update_date || u.created_at;
        return isToday(parseISO(updateDate));
      });

      // Calculate summary
      const totalUpdatesToday = todayUpdates.length;
      const totalLaborToday = todayUpdates.reduce((sum, u) => sum + (u.labor_count || 0), 0);
      const projectsUpdatedToday = new Set(todayUpdates.map(u => u.project_id)).size;
      const issuesReportedToday = todayUpdates.filter(u => u.issues_faced).length;

      const progressValues = todayUpdates.filter(u => u.progress_percentage > 0).map(u => u.progress_percentage);
      const averageProgress = progressValues.length > 0
        ? progressValues.reduce((sum, p) => sum + p, 0) / progressValues.length
        : 0;

      // Group by project
      const projectMap = new Map<string, {
        project_id: string;
        project_name: string;
        update_count: number;
        total_labor: number;
        latest_update: string;
        has_issues: boolean;
      }>();

      todayUpdates.forEach(u => {
        const projectId = u.project_id;
        const existing = projectMap.get(projectId);
        
        if (existing) {
          existing.update_count++;
          existing.total_labor += u.labor_count || 0;
          if (u.issues_faced) existing.has_issues = true;
          if (new Date(u.created_at) > new Date(existing.latest_update)) {
            existing.latest_update = u.created_at;
          }
        } else {
          projectMap.set(projectId, {
            project_id: projectId,
            project_name: (u.project as any)?.project_name || 'Unknown',
            update_count: 1,
            total_labor: u.labor_count || 0,
            latest_update: u.created_at,
            has_issues: !!u.issues_faced
          });
        }
      });

      // Recent updates
      const recentUpdates = updates.slice(0, 20).map(u => ({
        id: u.id,
        project_id: u.project_id,
        project_name: (u.project as any)?.project_name || 'Unknown',
        work_done: u.work_done,
        labor_count: u.labor_count || 0,
        progress_percentage: u.progress_percentage || 0,
        issues_faced: u.issues_faced,
        update_date: u.update_date || u.created_at,
        reporter_name: (u.reporter as any)?.name || 'Unknown'
      }));

      setSummary({
        totalUpdatesToday,
        totalLaborToday,
        projectsUpdatedToday,
        issuesReportedToday,
        averageProgress,
        updatesByProject: Array.from(projectMap.values()),
        recentUpdates
      });
    } catch (error) {
      console.error('Error fetching site updates summary:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [projectId]);

  return {
    summary,
    isLoading,
    refetch: fetchSummary
  };
}
