import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { addDays, isAfter } from 'date-fns';

export interface SelfAssignInput {
  requestId: string;
  visitInstructions: string;
  expectedVisitDate: string;
  assignmentRemarks?: string;
  sla1StartedAt: string; // smo_reviewed_at from the request
}

const fetchImageAsBuffer = async (url: string): Promise<Uint8Array | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (e) {
    console.error('Failed to fetch image for DOCX:', url, e);
    return null;
  }
};

export function useSiteVisitFarmManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Self-assign: smo_reviewed → assigned (FM accepts visit for themselves)
  const selfAssignMutation = useMutation({
    mutationFn: async (input: SelfAssignInput) => {
      const now = new Date().toISOString();

      // Fetch profile for name/phone
      const { data: profile } = await (supabase as any).from('profiles')
        .select('name, phone, office_number')
        .eq('id', user!.id)
        .single();

      const { data: req } = await (supabase as any).from('site_visit_requests')
        .select('request_number, location_title, smo_reviewed_at, requester_id')
        .eq('id', input.requestId)
        .single();

      // Check if SLA-1 is already breached
      const sla1Deadline = addDays(new Date(req.smo_reviewed_at), 5);
      const sla1Status = isAfter(new Date(), sla1Deadline) ? 'completed_late' : 'completed';

      // Create assignment record
      const { data: assignment, error: assignError } = await (supabase as any)
        .from('site_visit_assignments')
        .insert({
          request_id: input.requestId,
          assigned_by: user!.id,
          assigned_person_name: profile?.name || user!.name,
          assigned_person_phone: profile?.phone || '',
          assigned_person_user_id: user!.id,
          visit_instructions: input.visitInstructions,
          expected_visit_date: input.expectedVisitDate,
          assignment_remarks: input.assignmentRemarks || null,
          sla1_deadline: sla1Deadline.toISOString(),
          sla1_status: sla1Status,
        })
        .select()
        .single();
      if (assignError) throw assignError;

      // Update request status
      const { error: reqError } = await (supabase as any).from('site_visit_requests')
        .update({
          status: 'assigned',
          assigned_farm_manager_id: user!.id,
          updated_at: now,
        })
        .eq('id', input.requestId);
      if (reqError) throw reqError;

      // Mark SLA-1 as completed
      await (supabase as any).from('site_visit_sla_tracking')
        .update({ status: sla1Status, completed_at: now })
        .eq('request_id', input.requestId)
        .eq('sla_number', 1);

      await Promise.all([
        supabase.from('audit_logs').insert({
          action: 'SITE_VISIT_ASSIGNED',
          performed_by: user!.id,
          performed_by_name: user!.name,
          performed_by_role: user!.role,
          record_type: 'site_visit_request',
          record_id: input.requestId,
          before_state: { status: 'smo_reviewed' },
          after_state: { status: 'assigned', assigned_to: user!.name },
          remarks: `FM self-assigned. SLA-1 status: ${sla1Status}`,
        } as any),
        (supabase as any).from('site_visit_timeline').insert({
          request_id: input.requestId,
          action: 'FM_SELF_ASSIGNED',
          performed_by: user!.id,
          performed_by_name: user!.name,
          performed_by_role: user!.role,
          details: {
            expected_visit_date: input.expectedVisitDate,
            sla1_status: sla1Status,
          },
        }),
        // Notify RSH
        (supabase as any).from('notifications').insert({
          type: 'site_visit_assigned',
          title: `SVR Accepted: ${req?.request_number}`,
          message: `${user!.name} accepted your site visit request. Expected visit: ${input.expectedVisitDate}`,
          user_id: req?.requester_id,
          metadata: { request_id: input.requestId },
        }),
      ]);

      return assignment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visit-requests'] });
      toast.success('Site visit accepted and self-assigned');
    },
    onError: () => toast.error('Failed to accept visit'),
  });

  // Start visit: assigned → visit_in_progress
  const startVisitMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const now = new Date().toISOString();
      const { error } = await (supabase as any).from('site_visit_requests')
        .update({ status: 'visit_in_progress', updated_at: now })
        .eq('id', requestId);
      if (error) throw error;

      await Promise.all([
        supabase.from('audit_logs').insert({
          action: 'SITE_VISIT_STARTED',
          performed_by: user!.id,
          performed_by_name: user!.name,
          performed_by_role: user!.role,
          record_type: 'site_visit_request',
          record_id: requestId,
          before_state: { status: 'assigned' },
          after_state: { status: 'visit_in_progress' },
          remarks: 'FM started site visit',
        } as any),
        (supabase as any).from('site_visit_timeline').insert({
          request_id: requestId,
          action: 'VISIT_STARTED',
          performed_by: user!.id,
          performed_by_name: user!.name,
          performed_by_role: user!.role,
        }),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visit-requests'] });
      toast.success('Visit marked as in progress');
    },
    onError: () => toast.error('Failed to update status'),
  });

  // Upload report: visit_completed → report_submitted (SLA-2 completed, SLA-3 starts)
  const uploadReportMutation = useMutation({
    mutationFn: async ({ requestId, reportUrl }: { requestId: string; reportUrl: string }) => {
      const now = new Date().toISOString();
      const sla3Deadline = addDays(new Date(), 4).toISOString();

      const { data: req } = await (supabase as any).from('site_visit_requests')
        .select('request_number, visit_completed_at, requester_id')
        .eq('id', requestId)
        .single();

      const { error } = await (supabase as any).from('site_visit_requests')
        .update({
          status: 'report_submitted',
          site_visit_report_url: reportUrl,
          report_submitted_at: now,
          report_submitted_by: user!.id,
          updated_at: now,
        })
        .eq('id', requestId)
        .eq('status', 'visit_completed');
      if (error) throw error;

      // Complete SLA-2
      const sla2Deadline = addDays(new Date(req.visit_completed_at), 2);
      const sla2Status = isAfter(new Date(), sla2Deadline) ? 'completed_late' : 'completed';
      await (supabase as any).from('site_visit_sla_tracking')
        .update({ status: sla2Status, completed_at: now })
        .eq('request_id', requestId)
        .eq('sla_number', 2);

      // Start Next SLAs based on category
      const slaSequence: any[] = [];
      const isProjectOrPoly = ['rental', 'polyhouse'].includes(req.visit_category?.toLowerCase() || '');

      // SLA-4 (Soil & Water) always starts after report is ready
      slaSequence.push({
        request_id: requestId,
        sla_number: 4,
        sla_name: 'Soil & Water Reports',
        clock_start_at: now,
        deadline_at: addDays(new Date(), 8).toISOString(), // 8 days after report
        status: 'pending',
      });

      if (isProjectOrPoly) {
        // SLA-3 (Quotation) only for projects/polyhouses
        slaSequence.push({
          request_id: requestId,
          sla_number: 3,
          sla_name: 'Quotation Submission',
          clock_start_at: now,
          deadline_at: sla3Deadline,
          status: 'pending',
        });
      }

      if (slaSequence.length > 0) {
        await (supabase as any).from('site_visit_sla_tracking').insert(slaSequence);
      }

      await Promise.all([
        supabase.from('audit_logs').insert({
          action: 'SITE_VISIT_REPORT_SUBMITTED',
          performed_by: user!.id,
          performed_by_name: user!.name,
          performed_by_role: user!.role,
          record_type: 'site_visit_request',
          record_id: requestId,
          before_state: { status: 'visit_completed' },
          after_state: { status: 'report_submitted', report_url: reportUrl },
          remarks: 'Site visit report uploaded',
        } as any),
        (supabase as any).from('site_visit_timeline').insert({
          request_id: requestId,
          action: 'REPORT_SUBMITTED',
          performed_by: user!.id,
          performed_by_name: user!.name,
          performed_by_role: user!.role,
          details: { report_url: reportUrl, sla3_deadline: sla3Deadline },
        }),
        // Notify RSH
        (supabase as any).from('notifications').insert({
          type: 'site_visit_report_ready',
          title: `Report Ready: ${req?.request_number}`,
          message: `Site visit report is now available for ${req?.request_number}`,
          user_id: req?.requester_id,
          metadata: { request_id: requestId },
        }),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visit-requests'] });
      toast.success('Site visit report uploaded');
    },
    onError: () => toast.error('Failed to upload report'),
  });

  // Upload quotation: report_submitted → quotation_submitted
  const uploadQuotationMutation = useMutation({
    mutationFn: async ({ requestId, quotationUrl }: { requestId: string; quotationUrl: string }) => {
      const now = new Date().toISOString();

      // Verify report is submitted first (unmutable rule)
      const { data: req } = await (supabase as any).from('site_visit_requests')
        .select('report_submitted_at, request_number, requester_id')
        .eq('id', requestId)
        .single();

      if (!req?.report_submitted_at) {
        throw new Error('Cannot upload quotation before site visit report is submitted');
      }

      const { error } = await (supabase as any).from('site_visit_requests')
        .update({
          quotation_url: quotationUrl,
          quotation_submitted_at: now,
          quotation_submitted_by: user!.id,
          updated_at: now,
        })
        .eq('id', requestId);
      if (error) throw error;

      // Complete SLA-3
      const sla3Deadline = addDays(new Date(req.report_submitted_at), 4);
      const sla3Status = isAfter(new Date(), sla3Deadline) ? 'completed_late' : 'completed';
      await (supabase as any).from('site_visit_sla_tracking')
        .update({ status: sla3Status, completed_at: now })
        .eq('request_id', requestId)
        .eq('sla_number', 3);

      await Promise.all([
        supabase.from('audit_logs').insert({
          action: 'SITE_VISIT_QUOTATION_SUBMITTED',
          performed_by: user!.id,
          performed_by_name: user!.name,
          performed_by_role: user!.role,
          record_type: 'site_visit_request',
          record_id: requestId,
          after_state: { quotation_url: quotationUrl },
          remarks: 'Quotation uploaded',
        } as any),
        (supabase as any).from('site_visit_timeline').insert({
          request_id: requestId,
          action: 'QUOTATION_SUBMITTED',
          performed_by: user!.id,
          performed_by_name: user!.name,
          performed_by_role: user!.role,
          details: { quotation_url: quotationUrl },
        }),
        (supabase as any).from('notifications').insert({
          type: 'site_visit_quotation_uploaded',
          title: `Quotation Uploaded: ${req?.request_number}`,
          message: `Quotation has been uploaded for ${req?.request_number}`,
          user_id: req?.requester_id,
          metadata: { request_id: requestId },
        }),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visit-requests'] });
      toast.success('Quotation uploaded');
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to upload quotation'),
  });

  // Upload soil & water: → soil_water_submitted
  const uploadSoilWaterMutation = useMutation({
    mutationFn: async ({ requestId, reportUrl }: { requestId: string; reportUrl: string }) => {
      const now = new Date().toISOString();

      const { data: req } = await (supabase as any).from('site_visit_requests')
        .select('request_number, visit_completed_at, requester_id')
        .eq('id', requestId)
        .single();

      const { error } = await (supabase as any).from('site_visit_requests')
        .update({
          soil_water_report_url: reportUrl,
          soil_water_submitted_at: now,
          soil_water_submitted_by: user!.id,
          updated_at: now,
        })
        .eq('id', requestId);
      if (error) throw error;

      // Complete SLA-4
      const sla4Deadline = addDays(new Date(req.visit_completed_at), 10);
      const sla4Status = isAfter(new Date(), sla4Deadline) ? 'completed_late' : 'completed';
      await (supabase as any).from('site_visit_sla_tracking')
        .update({ status: sla4Status, completed_at: now })
        .eq('request_id', requestId)
        .eq('sla_number', 4);

      await Promise.all([
        supabase.from('audit_logs').insert({
          action: 'SITE_VISIT_SOIL_WATER_SUBMITTED',
          performed_by: user!.id,
          performed_by_name: user!.name,
          performed_by_role: user!.role,
          record_type: 'site_visit_request',
          record_id: requestId,
          after_state: { soil_water_report_url: reportUrl },
          remarks: 'Soil & water report uploaded',
        } as any),
        (supabase as any).from('site_visit_timeline').insert({
          request_id: requestId,
          action: 'SOIL_WATER_SUBMITTED',
          performed_by: user!.id,
          performed_by_name: user!.name,
          performed_by_role: user!.role,
          details: { report_url: reportUrl },
        }),
        (supabase as any).from('notifications').insert({
          type: 'site_visit_soil_water_uploaded',
          title: `Soil/Water Report: ${req?.request_number}`,
          message: `All field reports received for ${req?.request_number}`,
          user_id: req?.requester_id,
          metadata: { request_id: requestId },
        }),
        (supabase as any).from('notifications').insert({
          type: 'site_visit_soil_water_uploaded',
          title: `Soil/Water Report: ${req?.request_number}`,
          message: `All field reports received for ${req?.request_number}`,
          role_target: 'admin',
          metadata: { request_id: requestId },
        }),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visit-requests'] });
      toast.success('Soil & water report uploaded');
    },
    onError: () => toast.error('Failed to upload soil & water report'),
  });

  return {
    selfAssign: selfAssignMutation.mutateAsync,
    startVisit: startVisitMutation.mutateAsync,
    uploadReport: uploadReportMutation.mutateAsync,
    uploadQuotation: uploadQuotationMutation.mutateAsync,
    uploadSoilWater: uploadSoilWaterMutation.mutateAsync,
    isSelfAssigning: selfAssignMutation.isPending,
    isStartingVisit: startVisitMutation.isPending,
    isUploadingReport: uploadReportMutation.isPending,
    isUploadingQuotation: uploadQuotationMutation.isPending,
    isUploadingSoilWater: uploadSoilWaterMutation.isPending,
  };
}
