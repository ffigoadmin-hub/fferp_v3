import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProjectTimelineEntry {
  id: string;
  project_id: string;
  action: string;
  performed_by: string | null;
  performed_by_name: string | null;
  performed_by_role: string | null;
  details: Record<string, any> | null;
  created_at: string;
  // Derived field for unified timeline
  source?: 'timeline' | 'lifecycle' | 'material' | 'phase';
}

/** Lifecycle stage timestamps from the projects table */
const STAGE_MAP: Record<string, { action: string; label: string }> = {
  stage_new_deal_at: { action: 'stage_new_deal', label: 'Project onboarded as New Deal' },
  stage_engineering_assigned_at: { action: 'stage_engineering_assigned', label: 'Engineering team assigned' },
  stage_boq_submitted_at: { action: 'stage_boq_submitted', label: 'BOQ submitted for approval' },
  stage_boq_approved_at: { action: 'stage_boq_approved', label: 'BOQ approved' },
  stage_sourcing_at: { action: 'stage_sourcing', label: 'Sourcing started' },
  stage_execution_at: { action: 'stage_execution', label: 'Execution started' },
  stage_completed_at: { action: 'stage_completed', label: 'Project completed' },
};

export function useProjectTimeline(projectId: string) {
  const [entries, setEntries] = useState<ProjectTimelineEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);

    try {
      // Fetch timeline entries and project lifecycle stages in parallel
      const [timelineRes, projectRes, materialRes, phaseRes, escalationRes, criticalRes, woRes] = await Promise.all([
        supabase
          .from('project_timeline')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false }),
        supabase
          .from('projects')
          .select('created_at, onboarded_date, stage_new_deal_at, stage_engineering_assigned_at, stage_boq_submitted_at, stage_boq_approved_at, stage_sourcing_at, stage_execution_at, stage_completed_at, lifecycle_stage, project_name, client_name')
          .eq('id', projectId)
          .single(),
        supabase
          .from('material_requests')
          .select('id, created_at, approval_status, order_status, urgency, boq_items')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false }),
        supabase
          .from('project_phases')
          .select('id, phase_name, status, created_at, started_at, completed_at, completion_percentage')
          .eq('project_id', projectId)
          .order('phase_order', { ascending: true }),
        supabase
          .from('client_escalations')
          .select('id, ticket_number, issue_title, status, created_at, urgency, resolved_at')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false }),
        supabase
          .from('hourly_criticals')
          .select('id, ticket_number, issue_title, status, created_at, resolved_at')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false }),
        supabase
          .from('work_orders' as any)
          .select('id, wo_number, work_description, status, created_at, smo_approved_at, gmo_approved_at, gm_approved_at, admin_approved_at, ceo_approved_at')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false }),
      ]);

      const allEntries: ProjectTimelineEntry[] = [];

      // 1. Add explicit timeline entries
      if (timelineRes.data) {
        for (const entry of timelineRes.data) {
          allEntries.push({ ...entry, source: 'timeline' } as ProjectTimelineEntry);
        }
      }

      // 2. Synthesize lifecycle stage entries from project timestamps
      if (projectRes.data) {
        const project = projectRes.data;

        // Project creation event
        if (project.created_at) {
          allEntries.push({
            id: `lifecycle-created`,
            project_id: projectId,
            action: 'project_created',
            performed_by: null,
            performed_by_name: null,
            performed_by_role: 'system',
            details: { project_name: project.project_name, client_name: project.client_name },
            created_at: project.created_at,
            source: 'lifecycle',
          });
        }

        // Stage transitions
        for (const [field, config] of Object.entries(STAGE_MAP)) {
          const timestamp = (project as any)[field];
          if (timestamp) {
            allEntries.push({
              id: `lifecycle-${field}`,
              project_id: projectId,
              action: config.action,
              performed_by: null,
              performed_by_name: null,
              performed_by_role: 'system',
              details: { label: config.label },
              created_at: timestamp,
              source: 'lifecycle',
            });
          }
        }
      }

      // 3. Add material request events
      if (materialRes.data) {
        for (const mr of materialRes.data) {
          const items = Array.isArray(mr.boq_items) ? mr.boq_items : [];
          const itemNames = items.slice(0, 3).map((i: any) => i.material_name || 'Item').join(', ');
          const suffix = items.length > 3 ? ` +${items.length - 3} more` : '';

          allEntries.push({
            id: `mr-${mr.id}`,
            project_id: projectId,
            action: 'material_request_created',
            performed_by: null,
            performed_by_name: null,
            performed_by_role: 'employee',
            details: {
              items_count: items.length,
              items_summary: `${itemNames}${suffix}`,
              urgency: mr.urgency,
              approval_status: mr.approval_status,
              order_status: mr.order_status,
            },
            created_at: mr.created_at,
            source: 'material',
          });
        }
      }

      // 4. Add phase events
      if (phaseRes.data) {
        for (const phase of phaseRes.data) {
          if (phase.created_at) {
            allEntries.push({
              id: `phase-created-${phase.id}`,
              project_id: projectId,
              action: 'phase_created',
              performed_by: null,
              performed_by_name: null,
              performed_by_role: 'employee',
              details: { phase_name: phase.phase_name, status: phase.status },
              created_at: phase.created_at,
              source: 'phase',
            });
          }
          if (phase.started_at) {
            allEntries.push({
              id: `phase-started-${phase.id}`,
              project_id: projectId,
              action: 'phase_started',
              performed_by: null,
              performed_by_name: null,
              performed_by_role: 'employee',
              details: { phase_name: phase.phase_name, completion: phase.completion_percentage },
              created_at: phase.started_at,
              source: 'phase',
            });
          }
          if (phase.completed_at) {
            allEntries.push({
              id: `phase-completed-${phase.id}`,
              project_id: projectId,
              action: 'phase_completed',
              performed_by: null,
              performed_by_name: null,
              performed_by_role: 'employee',
              details: { phase_name: phase.phase_name },
              created_at: phase.completed_at,
              source: 'phase',
            });
          }
        }
      }

      // 5. Add Escalation events
      if (escalationRes.data) {
        for (const esc of escalationRes.data) {
          allEntries.push({
            id: `esc-${esc.id}`,
            project_id: projectId,
            action: 'client_escalation_created',
            performed_by: null,
            performed_by_name: null,
            performed_by_role: 'client',
            details: { 
              ticket_no: esc.ticket_number, 
              title: esc.issue_title, 
              status: esc.status,
              urgency: esc.urgency 
            },
            created_at: esc.created_at,
            source: 'timeline',
          } as any);
          
          if (esc.resolved_at) {
            allEntries.push({
              id: `esc-resolved-${esc.id}`,
              project_id: projectId,
              action: 'client_escalation_resolved',
              performed_by: null,
              performed_by_name: null,
              performed_by_role: 'system',
              details: { ticket_no: esc.ticket_number, title: esc.issue_title },
              created_at: esc.resolved_at,
              source: 'timeline',
            } as any);
          }
        }
      }

      // 6. Add Critical events
      if (criticalRes.data) {
        for (const crit of criticalRes.data) {
          allEntries.push({
            id: `crit-${crit.id}`,
            project_id: projectId,
            action: 'hourly_critical_created',
            performed_by: null,
            performed_by_name: null,
            performed_by_role: 'data_team',
            details: { ticket_no: crit.ticket_number, title: crit.issue_title, status: crit.status },
            created_at: crit.created_at,
            source: 'timeline',
          } as any);

          if (crit.resolved_at) {
            allEntries.push({
              id: `crit-resolved-${crit.id}`,
              project_id: projectId,
              action: 'hourly_critical_resolved',
              performed_by: null,
              performed_by_name: null,
              performed_by_role: 'system',
              details: { ticket_no: crit.ticket_number, title: crit.issue_title },
              created_at: crit.resolved_at,
              source: 'timeline',
            } as any);
          }
        }
      }

      // 7. Add Work Order Approval events
      if (woRes.data) {
        for (const wo of woRes.data as any[]) {
          const baseDetails = { wo_no: wo.wo_number, title: wo.work_description };
          
          if (wo.created_at) {
            allEntries.push({
              id: `wo-created-${wo.id}`,
              project_id: projectId,
              action: 'work_order_created',
              performed_by: null,
              performed_by_name: null,
              performed_by_role: 'employee',
              details: baseDetails,
              created_at: wo.created_at,
              source: 'timeline',
            } as any);
          }
          if (wo.smo_approved_at) {
            allEntries.push({
              id: `wo-smo-approved-${wo.id}`,
              project_id: projectId,
              action: 'wo_approved_smo',
              performed_by: null,
              performed_by_name: 'SMO',
              performed_by_role: 'smo',
              details: baseDetails,
              created_at: wo.smo_approved_at,
              source: 'timeline',
            } as any);
          }
          if (wo.gmo_approved_at) {
            allEntries.push({
              id: `wo-gmo-approved-${wo.id}`,
              project_id: projectId,
              action: 'wo_approved_gmo',
              performed_by: null,
              performed_by_name: 'GMO',
              performed_by_role: 'gmo',
              details: baseDetails,
              created_at: wo.gmo_approved_at,
              source: 'timeline',
            } as any);
          }
          if (wo.gm_approved_at) {
            allEntries.push({
              id: `wo-gm-approved-${wo.id}`,
              project_id: projectId,
              action: 'wo_approved_gm',
              performed_by: null,
              performed_by_name: 'GM',
              performed_by_role: 'gm',
              details: baseDetails,
              created_at: wo.gm_approved_at,
              source: 'timeline',
            } as any);
          }
          if (wo.admin_approved_at) {
            allEntries.push({
              id: `wo-admin-approved-${wo.id}`,
              project_id: projectId,
              action: 'wo_approved_admin',
              performed_by: null,
              performed_by_name: 'Admin',
              performed_by_role: 'admin',
              details: baseDetails,
              created_at: wo.admin_approved_at,
              source: 'timeline',
            } as any);
          }
          if (wo.ceo_approved_at) {
            allEntries.push({
              id: `wo-ceo-approved-${wo.id}`,
              project_id: projectId,
              action: 'wo_approved_ceo',
              performed_by: null,
              performed_by_name: 'CEO',
              performed_by_role: 'ceo',
              details: baseDetails,
              created_at: wo.ceo_approved_at,
              source: 'timeline',
            } as any);
          }
        }
      }

      // Deduplicate: remove lifecycle events that already exist as explicit timeline entries
      const explicitActions = new Set(
        allEntries.filter(e => e.source === 'timeline').map(e => e.action)
      );

      const filtered = allEntries.filter(e => {
        if (e.source !== 'lifecycle') return true;
        // Don't show lifecycle 'stage_boq_submitted' if explicit 'boq_submitted' exists
        const baseAction = e.action.replace('stage_', '');
        return !explicitActions.has(baseAction);
      });

      // Sort by date descending
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setEntries(filtered);
    } catch (error) {
      console.error('Error fetching timeline:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) fetchEntries();
  }, [projectId, fetchEntries]);

  return { entries, isLoading, refetch: fetchEntries };
}
