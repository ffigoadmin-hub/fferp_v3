import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { addDays, isAfter } from 'date-fns';

export interface SiteVisitDailyReportInput {
  request_id: string;
  assignment_id: string;
  report_date: string;
  visit_day_number: number;
  login_time: string;    // HH:MM
  logout_time: string;   // HH:MM
  site_location_title: string;
  site_location_address: string;
  location_lat?: number;
  location_lng?: number;
  location_accuracy_meters?: number;
  geotagged_image_urls: string[];
  work_summary: string;
  site_observations?: string;
  challenges_faced?: string;
  next_day_plan?: string;
  is_visit_complete: boolean;
  traveling_mode?: string;
  // ITC fields (FM writes, SMO/CEO read)
  itc_data_available?: boolean;
  itc_remarks?: string;
  itc_document_url?: string;
  itc_data_reference?: string;
  is_rental_polyhouse_visit?: boolean;
  report_docx_url?: string;
  soil_water_test_report_url?: string;
}

// Reads from the PUBLIC VIEW (ITC masked for non-SMO/CEO)
export function useSiteVisitDailyReports(assignmentId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['site-visit-daily-reports', assignmentId],
    queryFn: async () => {
      let q = (supabase as any).from('site_visit_daily_reports_public')
        .select('*')
        .order('report_date', { ascending: false });

      if (assignmentId) {
        q = q.eq('assignment_id', assignmentId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!assignmentId,
  });
}

export function useSiteVisitDailyReport() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: async (input: SiteVisitDailyReportInput) => {
      const now = new Date().toISOString();

      // Compute total hours
      const [loginH, loginM] = input.login_time.split(':').map(Number);
      const [logoutH, logoutM] = input.logout_time.split(':').map(Number);
      const totalHours = ((logoutH * 60 + logoutM) - (loginH * 60 + loginM)) / 60;

      // Check late submission (submitted > 2 hours after logout)
      const logoutDateTime = new Date();
      logoutDateTime.setHours(logoutH, logoutM, 0, 0);
      const twoHoursAfterLogout = new Date(logoutDateTime.getTime() + 2 * 60 * 60 * 1000);
      const isAfterLogout = isAfter(now, logoutDateTime); // simplified for now
      const isLateSubmission = isAfter(new Date(), twoHoursAfterLogout);

      // Validate min 2 geotagged images
      if (input.geotagged_image_urls.length < 2) {
        throw new Error('Minimum 2 geotagged images are required');
      }

      // Validate work summary length
      if (input.work_summary.length < 100) {
        throw new Error('Work summary must be at least 100 characters');
      }

      // INSERT into raw table (FM writes directly)
      const { data: report, error } = await (supabase as any)
        .from('site_visit_daily_reports')
        .insert({
          request_id: input.request_id,
          assignment_id: input.assignment_id,
          submitted_by: user!.id,
          submitted_by_name: user!.name,
          report_date: input.report_date,
          visit_day_number: input.visit_day_number,
          login_time: input.login_time,
          logout_time: input.logout_time,
          total_hours_on_site: parseFloat(totalHours.toFixed(2)),
          site_location_title: input.site_location_title,
          site_location_address: input.site_location_address,
          location_lat: input.location_lat || null,
          location_lng: input.location_lng || null,
          location_accuracy_meters: input.location_accuracy_meters || null,
          geotagged_image_urls: input.geotagged_image_urls,
          work_summary: input.work_summary,
          site_observations: input.site_observations || null,
          challenges_faced: input.challenges_faced || null,
          next_day_plan: input.next_day_plan || null,
          is_visit_complete: input.is_visit_complete,
          itc_data_available: input.itc_data_available || false,
          itc_remarks: input.itc_remarks || null,
          itc_document_url: input.itc_document_url || null,
          itc_data_reference: input.itc_data_reference || null,
          submitted_at: now,
          is_late_submission: isLateSubmission,
          traveling_mode: input.traveling_mode || null,
          is_rental_polyhouse_visit: input.is_rental_polyhouse_visit || false,
          report_docx_url: input.report_docx_url || null,
          soil_water_test_report_url: input.soil_water_test_report_url || null,
        })
        .select()
        .single();
      if (error) throw error;

      await Promise.all([
        supabase.from('audit_logs').insert({
          action: 'SITE_VISIT_DAILY_REPORT_SUBMITTED',
          performed_by: user!.id,
          performed_by_name: user!.name,
          performed_by_role: user!.role,
          record_type: 'site_visit_request',
          record_id: input.request_id,
          after_state: {
            day: input.visit_day_number,
            date: input.report_date,
            is_visit_complete: input.is_visit_complete,
            is_late: isLateSubmission,
          },
          remarks: `Day ${input.visit_day_number} report submitted${isLateSubmission ? ' (LATE)' : ''}`,
        } as any),
        (supabase as any).from('site_visit_timeline').insert({
          request_id: input.request_id,
          action: 'DAILY_REPORT_SUBMITTED',
          performed_by: user!.id,
          performed_by_name: user!.name,
          performed_by_role: user!.role,
          details: {
            day: input.visit_day_number,
            date: input.report_date,
            hours: totalHours.toFixed(2),
            is_late: isLateSubmission,
            is_complete: input.is_visit_complete,
          },
        }),
      ]);

      // If visit is marked complete, update request status and start SLA-2 and SLA-4
      if (input.is_visit_complete) {
        const sla2Deadline = addDays(new Date(), 2).toISOString();
        const sla4Deadline = addDays(new Date(), 10).toISOString();

        await Promise.all([
          (supabase as any).from('site_visit_requests')
            .update({
              status: 'visit_completed',
              visit_completed_at: now,
              updated_at: now,
            })
            .eq('id', input.request_id),
          (supabase as any).from('site_visit_sla_tracking').insert([
            {
              request_id: input.request_id,
              sla_number: 2,
              sla_name: 'Site Visit Report',
              clock_start_at: now,
              deadline_at: sla2Deadline,
              status: 'pending',
            },
            {
              request_id: input.request_id,
              sla_number: 4,
              sla_name: 'Soil & Water Reports',
              clock_start_at: now,
              deadline_at: sla4Deadline,
              status: 'pending',
            },
          ]),
          (supabase as any).from('site_visit_timeline').insert({
            request_id: input.request_id,
            action: 'VISIT_COMPLETED',
            performed_by: user!.id,
            performed_by_name: user!.name,
            performed_by_role: user!.role,
            details: {
              sla2_deadline: sla2Deadline,
              sla4_deadline: sla4Deadline,
            },
          }),
        ]);
      }

      return report;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['site-visit-daily-reports', vars.assignment_id] });
      queryClient.invalidateQueries({ queryKey: ['site-visit-requests'] });
      toast.success(
        _.is_visit_complete
          ? 'Daily report submitted. Visit marked as complete!'
          : 'Daily report submitted successfully'
      );
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to submit report'),
  });

  return {
    submitReport: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,
  };
}
