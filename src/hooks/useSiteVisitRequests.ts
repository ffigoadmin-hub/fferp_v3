import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface CreateSiteVisitInput {
  location_title: string;
  address: string;
  lat: number;
  lng: number;
  priority: 'low' | 'standard' | 'high' | 'urgent' | 'emergency';
  visit_purpose: string;
  contact_person_name?: string;
  contact_person_phone?: string;
  soil_testing_required?: boolean;
  water_testing_required?: boolean;
  remarks?: string;
}

export interface SiteVisitRequest {
  id: string;
  request_number: string;
  status: 'draft' | 'submitted' | 'smo_reviewed' | 'assigned' | 'visit_in_progress' | 'visit_completed' | 'report_submitted' | 'quotation_submitted' | 'soil_water_submitted' | 'approved' | 'on_hold' | 'cancelled' | 'returned_to_rsh';
  priority: 'low' | 'standard' | 'high' | 'urgent' | 'emergency';
  location_title: string;
  location_city?: string;
  location_state?: string;
  location_google_maps_url?: string;
  client_name?: string;
  client_company?: string;
  visit_category?: string;
  purpose_description?: string;
  requested_visit_deadline: string;
  address: string;
  lat: number;
  lng: number;
  visit_purpose: string;
  requester_id: string;
  requester?: {
    name: string;
    department: string;
    office_number: string;
  };
  contact_person_name?: string;
  contact_person_phone?: string;
  soil_testing_required: boolean;
  water_testing_required: boolean;
  remarks?: string;
  created_at: string;
  updated_at: string;
  smo_remarks?: string;
  smo_rejection_reason?: string;
  smo_reviewed_at?: string;
  report_submitted_at?: string;
  visit_completed_at?: string;
  site_visit_report_url?: string;
  quotation_url?: string;
  soil_water_report_url?: string;
  site_visit_sla_tracking?: any[];
  site_visit_assignments?: any[];
}

export function useSiteVisitRequests() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // RSH: fetch own requests
  const query = useQuery({
    queryKey: ['site-visit-requests', 'my', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('site_visit_requests')
        .select(`
          *,
          site_visit_sla_tracking (*),
          site_visit_assignments (
            id, assigned_person_user_id, assigned_at,
            assigned_user:profiles!assigned_person_user_id(name, email, role, department, phone)
          )
        `)
        .eq('requester_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as SiteVisitRequest[];
    },
    enabled: !!user,
  });

  // Create draft
  const createMutation = useMutation({
    mutationFn: async (input: CreateSiteVisitInput) => {
      const { data, error } = await (supabase as any)
        .from('site_visit_requests')
        .insert({
          ...input,
          requester_id: user!.id,
          status: 'draft',
        })
        .select()
        .single();
      if (error) throw error;

      await supabase.from('audit_logs').insert({
        action: 'SITE_VISIT_CREATED',
        performed_by: user!.id,
        performed_by_name: user!.name,
        performed_by_role: user!.role,
        record_type: 'site_visit_request',
        record_id: data.id,
        after_state: { status: 'draft', request_number: data.request_number },
        remarks: `Site visit request ${data.request_number} created as draft`,
      } as any);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visit-requests'] });
      toast.success('Site visit request created');
    },
    onError: () => toast.error('Failed to create request'),
  });

  // Submit draft → submitted
  const submitMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: existing } = await (supabase as any).from('site_visit_requests')
        .select('request_number, priority')
        .eq('id', id)
        .single();

      const { error } = await (supabase as any).from('site_visit_requests')
        .update({ status: 'submitted', updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('requester_id', user!.id);
      if (error) throw error;

      await Promise.allSettled([
        supabase.from('audit_logs').insert({
          action: 'SITE_VISIT_SUBMITTED',
          performed_by: user!.id,
          performed_by_name: user!.name,
          performed_by_role: user!.role,
          record_type: 'site_visit_request',
          record_id: id,
          before_state: { status: 'draft' },
          after_state: { status: 'submitted' },
          remarks: `Site visit request submitted by RSH`,
        } as any),
        (supabase as any).from('site_visit_timeline').insert({
          request_id: id,
          action: 'REQUEST_SUBMITTED',
          performed_by: user!.id,
          performed_by_name: user!.name,
          performed_by_role: user!.role,
        }),
        supabase.from('notifications').insert({
          type: 'site_visit_submitted',
          title: `New SVR: ${existing?.request_number}`,
          message: `RSH has submitted a new site visit request (${existing?.priority})`,
          role_target: 'site_visit_smo',
          metadata: { request_id: id },
        } as any),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visit-requests'] });
      toast.success('Request submitted for SMO review');
    },
    onError: () => toast.error('Failed to submit request'),
  });

  // Update draft
  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<CreateSiteVisitInput> }) => {
      const { error } = await (supabase as any).from('site_visit_requests')
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('requester_id', user!.id)
        .eq('status', 'draft');
      if (error) throw error;

      await supabase.from('audit_logs').insert({
        action: 'SITE_VISIT_UPDATED',
        performed_by: user!.id,
        performed_by_name: user!.name,
        performed_by_role: user!.role,
        record_type: 'site_visit_request',
        record_id: id,
        remarks: `Site visit draft updated`,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visit-requests'] });
      toast.success('Draft updated');
    },
    onError: () => toast.error('Failed to update draft'),
  });

  return {
    requests: query.data || [],
    isLoading: query.isLoading,
    createDraft: createMutation.mutateAsync,
    submitRequest: submitMutation.mutateAsync,
    updateDraft: updateMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isSubmitting: submitMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}

export function useAllSiteVisitRequests(statusFilter?: string | string[]) {
  return useQuery({
    queryKey: ['site-visit-requests', 'all', statusFilter],
    queryFn: async () => {
      let q = (supabase as any).from('site_visit_requests')
        .select(`
          *,
          requester:profiles!requester_id(name, department, office_number),
          site_visit_sla_tracking (*),
          site_visit_assignments (*)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter) {
        if (Array.isArray(statusFilter)) {
          q = q.in('status', statusFilter);
        } else {
          q = q.eq('status', statusFilter);
        }
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as SiteVisitRequest[];
    },
  });
}
