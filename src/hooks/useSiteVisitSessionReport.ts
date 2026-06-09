import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type SessionType = 'morning' | 'afternoon' | 'evening';

export interface SessionReport {
  id: string;
  assignment_id: string;
  request_id: string;
  submitted_by: string;
  submitted_by_name: string;
  report_date: string;
  session_type: SessionType;
  session_start_time: string | null;
  session_end_time: string | null;
  site_location_title: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_accuracy_meters: number | null;
  work_summary: string;
  observations: string | null;
  challenges: string | null;
  photo_urls: string[];
  submitted_at: string;
  created_at: string;
}

export interface SessionReportInput {
  assignment_id: string;
  request_id: string;
  report_date: string;
  session_type: SessionType;
  session_start_time?: string;
  session_end_time?: string;
  site_location_title?: string;
  location_lat?: number;
  location_lng?: number;
  location_accuracy_meters?: number;
  work_summary: string;
  observations?: string;
  challenges?: string;
  photo_urls: string[];
}

export function useSessionReports(assignmentId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['site-visit-sessions', assignmentId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('site_visit_session_reports')
        .select('*')
        .eq('assignment_id', assignmentId!)
        .order('report_date', { ascending: false })
        .order('session_type', { ascending: true });
      if (error) throw error;
      return data as SessionReport[];
    },
    enabled: !!user && !!assignmentId,
  });
}

export function useSiteVisitSessionReport() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: async (input: SessionReportInput) => {
      const { data, error } = await (supabase as any)
        .from('site_visit_session_reports')
        .insert({
          assignment_id: input.assignment_id,
          request_id: input.request_id,
          submitted_by: user!.id,
          submitted_by_name: user!.name,
          report_date: input.report_date,
          session_type: input.session_type,
          session_start_time: input.session_start_time || null,
          session_end_time: input.session_end_time || null,
          site_location_title: input.site_location_title || null,
          location_lat: input.location_lat || null,
          location_lng: input.location_lng || null,
          location_accuracy_meters: input.location_accuracy_meters || null,
          work_summary: input.work_summary,
          observations: input.observations || null,
          challenges: input.challenges || null,
          photo_urls: input.photo_urls,
          submitted_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['site-visit-sessions', vars.assignment_id] });
      toast.success(`${vars.session_type.charAt(0).toUpperCase() + vars.session_type.slice(1)} session report submitted`);
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to submit session report'),
  });

  return {
    submitSession: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,
  };
}
