import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { addDays } from 'date-fns';

export function useSiteVisitSMO() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Forward: submitted → smo_reviewed or assigned (direct allocation)
  const forwardMutation = useMutation({
    mutationFn: async ({ id, remarks, assignedTo }: { id: string; remarks?: string; assignedTo?: string }) => {
      const reviewedAt = new Date().toISOString();
      const sla1Deadline = addDays(new Date(), 5).toISOString();
      const status = assignedTo ? 'assigned' : 'smo_reviewed';

      const { error } = await (supabase as any).from('site_visit_requests')
        .update({
          status,
          smo_reviewed_by: user!.id,
          smo_reviewed_at: reviewedAt,
          smo_remarks: remarks || null,
          updated_at: reviewedAt,
        })
        .eq('id', id)
        .in('status', ['submitted', 'smo_reviewed', 'assigned', 'visit_in_progress']);
      if (error) throw error;

      // Fetch request for notification
      const { data: req } = await (supabase as any).from('site_visit_requests')
        .select('request_number, location_title, priority, requester_id')
        .eq('id', id)
        .single();

      const promises: any[] = [
        supabase.from('audit_logs').insert({
          action: assignedTo ? 'SITE_VISIT_DIRECTLY_ASSIGNED' : 'SITE_VISIT_SMO_REVIEWED',
          performed_by: user!.id,
          performed_by_name: user!.name,
          performed_by_role: user!.role,
          record_type: 'site_visit_request',
          record_id: id,
          before_state: { status: 'submitted' },
          after_state: { status },
          remarks: remarks || (assignedTo ? `Directly assigned to FM ${assignedTo}` : 'Forwarded for allocation'),
        } as any),
        (supabase as any).from('site_visit_timeline').insert({
          request_id: id,
          action: assignedTo ? 'SMO_ASSIGNED' : 'SMO_FORWARDED',
          performed_by: user!.id,
          performed_by_name: user!.name,
          performed_by_role: user!.role,
          details: { remarks, sla1_deadline: sla1Deadline, assigned_to: assignedTo },
        }),
        // Create SLA-1 tracking record (completed if directly assigned)
        (supabase as any).from('site_visit_sla_tracking').insert({
          request_id: id,
          sla_number: 1,
          sla_name: 'Site Visit Allocation',
          clock_start_at: reviewedAt,
          deadline_at: sla1Deadline,
          status: assignedTo ? 'completed' : 'pending',
          completed_at: assignedTo ? reviewedAt : null,
        }),
      ];

      if (assignedTo) {
        // Fetch FM name for assignment record
        const { data: fmProfile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', assignedTo)
          .single();

        // Direct assignment record — use correct column names
        // Handle assignment: Update if exists, else insert
        const { data: existingAssignment } = await (supabase as any)
          .from('site_visit_assignments')
          .select('id')
          .eq('request_id', id)
          .maybeSingle();

        if (existingAssignment) {
          promises.push(
            (supabase as any).from('site_visit_assignments').update({
              assigned_by: user!.id,
              assigned_person_user_id: assignedTo,
              assigned_person_name: fmProfile?.name || 'Farm Manager',
              assigned_at: reviewedAt,
              sla1_status: 'completed',
              visit_instructions: remarks || null,
            }).eq('id', existingAssignment.id)
          );
        } else {
          promises.push(
            (supabase as any).from('site_visit_assignments').insert({
              request_id: id,
              assigned_by: user!.id,
              assigned_person_user_id: assignedTo,
              assigned_person_name: fmProfile?.name || 'Farm Manager',
              assigned_at: reviewedAt,
              sla1_deadline: sla1Deadline,
              sla1_status: 'completed',
              visit_instructions: remarks || null,
            })
          );
        }

        // Notify specifically assigned FM
        promises.push(
          (supabase as any).from('notifications').insert({
            type: 'site_visit_assigned',
            title: `Site Visit Assignment: ${req?.request_number}`,
            message: existingAssignment 
              ? `You have been REASSIGNED to ${req?.location_title}` 
              : `SMO directly assigned you ${req?.location_title} — Please start visiting`,
            user_id: assignedTo,
            metadata: { request_id: id, priority: req?.priority },
          })
        );
      } else {
        // Notify all FMs
        promises.push(
          (supabase as any).from('notifications').insert({
            type: 'site_visit_forwarded',
            title: `New Requisition: ${req?.request_number}`,
            message: `New site visit request pending — ${req?.location_title} (${req?.priority})`,
            role_target: 'site_visit_farm_manager',
            metadata: { request_id: id, priority: req?.priority },
          })
        );
      }

      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visit-requests'] });
      toast.success('Request forwarded to Farm Manager');
    },
    onError: () => toast.error('Failed to forward request'),
  });

  // Return: submitted → returned_to_rsh (was draft)
  const returnMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data: req } = await (supabase as any).from('site_visit_requests')
        .select('request_number, requester_id')
        .eq('id', id)
        .single();

      const { error } = await (supabase as any).from('site_visit_requests')
        .update({
          status: 'returned_to_rsh',
          smo_rejection_reason: reason,
          smo_reviewed_by: user!.id,
          smo_reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('status', 'submitted');
      if (error) throw error;

      await Promise.all([
        supabase.from('audit_logs').insert({
          action: 'SITE_VISIT_RETURNED_TO_RSH',
          performed_by: user!.id,
          performed_by_name: user!.name,
          performed_by_role: user!.role,
          record_type: 'site_visit_request',
          record_id: id,
          before_state: { status: 'submitted' },
          after_state: { status: 'returned_to_rsh' },
          remarks: reason,
        } as any),
        (supabase as any).from('site_visit_timeline').insert({
          request_id: id,
          action: 'SMO_RETURNED',
          performed_by: user!.id,
          performed_by_name: user!.name,
          performed_by_role: user!.role,
          details: { reason },
        }),
        // Notify RSH
        (supabase as any).from('notifications').insert({
          type: 'site_visit_returned',
          title: `Request Returned: ${req?.request_number}`,
          message: `SMO returned your site visit request. Reason: ${reason}`,
          user_id: req?.requester_id,
          metadata: { request_id: id },
        }),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visit-requests'] });
      toast.success('Request returned to RSH');
    },
    onError: () => toast.error('Failed to return request'),
  });

  const triggerDeploymentMutation = useMutation({
    mutationFn: async ({ id, fmId }: { id: string; fmId: string }) => {
      const { error } = await (supabase as any)
        .from('site_visit_requests')
        .update({ status: 'visit_in_progress', updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;

      await Promise.all([
        (supabase as any).from('site_visit_timeline').insert({
          request_id: id,
          action: 'SMO_TRIGGERED_DEPLOYMENT',
          performed_by: user!.id,
          performed_by_name: user!.name,
          performed_by_role: user!.role,
          details: { message: 'SMO triggered field deployment' },
        }),
        (supabase as any).from('notifications').insert({
          type: 'site_visit_triggered',
          title: 'Field Deployment Triggered',
          message: 'SMO has remotely triggered your field deployment. Please start on-site reporting immediately.',
          user_id: fmId,
          metadata: { request_id: id },
        })
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visit-requests'] });
      toast.success('Field deployment triggered successfully');
    },
    onError: () => toast.error('Failed to trigger deployment'),
  });

  const stopDeploymentMutation = useMutation({
    mutationFn: async ({ id, reason, fmId }: { id: string; reason: string; fmId?: string }) => {
      // Use 'returned_to_rsh' as a fallback if 'on_hold' violates constraints
      const { error } = await (supabase as any)
        .from('site_visit_requests')
        .update({ status: 'returned_to_rsh', updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;

      const results: any[] = [
        (supabase as any).from('site_visit_timeline').insert({
          request_id: id,
          action: 'SMO_STOPPED_DEPLOYMENT',
          performed_by: user!.id,
          performed_by_name: user!.name,
          performed_by_role: user!.role,
          details: { reason, message: 'SMO halted active mission and returned to review queue' },
        })
      ];

      // Only send notification if we have a target user
      if (fmId) {
        results.push(
          (supabase as any).from('notifications').insert({
            type: 'site_visit_stopped',
            title: 'Mission Halted',
            message: `SMO has halted the mission: ${reason}`,
            user_id: fmId,
            metadata: { request_id: id },
          })
        );
      }

      await Promise.all(results);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visit-requests'] });
      toast.warning('Mission halted and returned for review');
    },
    onError: (error: any) => {
      console.error('Stop deployment error:', error);
      toast.error(`Failed to halt mission: ${error.message || 'Check database constraints'}`);
    },
  });

  return {
    forwardRequest: forwardMutation.mutateAsync,
    returnRequest: returnMutation.mutateAsync,
    triggerDeployment: triggerDeploymentMutation.mutateAsync,
    stopDeployment: stopDeploymentMutation.mutateAsync,
    isForwarding: forwardMutation.isPending,
    isReturning: returnMutation.isPending,
    isTriggering: triggerDeploymentMutation.isPending,
    isStopping: stopDeploymentMutation.isPending,
  };
}
