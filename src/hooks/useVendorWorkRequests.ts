import { isMissingTable } from '@/lib/supabase-error-guard';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface VendorWorkRequest {
  id: string;
  project_id: string;
  phase_id: string | null;
  requested_by: string;
  work_type: 'labor' | 'labour_work' | 'contract_work' | 'daily_wages' | 'installation' | 'service' | 'maintenance' | 'other';
  work_description: string;
  estimated_budget: number | null;
  timeline_days: number | null;
  status: 'pending' | 'vendor_search' | 'vendor_aligned' | 'wo_created' | 'completed' | 'cancelled';
  assigned_to_sourcing: string | null;
  aligned_vendor_name: string | null;
  aligned_vendor_contact: string | null;
  aligned_vendor_details: any;
  final_price: number | null;
  linked_wo_id: string | null;
  // New bank details fields
  vendor_bank_name: string | null;
  vendor_account_number: string | null;
  vendor_ifsc: string | null;
  vendor_gst: string | null;
  wo_approval_status: string | null;
  // Pre-sourcing approval fields
  approval_status: string | null;
  gm_approved_by: string | null;
  gm_approved_at: string | null;
  boi_approved_by: string | null;
  boi_approved_at: string | null;
  admin_approved_by: string | null;
  admin_approved_at: string | null;
  ceo_approved_by: string | null;
  ceo_approved_at: string | null;
  vendor_upi: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  project?: { project_name: string; project_id: string; created_at?: string };
  phase?: { phase_name: string };
  requester?: { name: string; email: string; department: string };
  assignee?: { name: string; email: string };
}

export function useVendorWorkRequests(projectId?: string) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<VendorWorkRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const currentProjectIdRef = useRef<string | undefined>(undefined);
  const isMountedRef = useRef(false);

  const fetchRequests = useCallback(async () => {
    console.log('[useVendorWorkRequests] Fetching work requests for projectId:', projectId);
    setIsLoading(true);

    try {
      let query = supabase
        .from('vendor_work_requests')
        .select(`
          *,
          project:projects(project_name, project_id, created_at),
          phase:project_phases(phase_name),
          requester:profiles!vendor_work_requests_requested_by_fkey(name, email, department),
          assignee:profiles!vendor_work_requests_assigned_to_sourcing_fkey(name, email)
        `)
        .order('created_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;

      if (error) throw error;
      console.log('[useVendorWorkRequests] Fetched', data?.length, 'requests');
      setRequests(data as unknown as VendorWorkRequest[] || []);
    } catch (error: any) {
      console.error('Error fetching vendor work requests:', error);
      if (!isMissingTable(error)) toast.error('Failed to load work requests');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Initial fetch on mount and when projectId changes
  useEffect(() => {
    // Always fetch on mount or when projectId changes
    if (!isMountedRef.current || projectId !== currentProjectIdRef.current) {
      isMountedRef.current = true;
      currentProjectIdRef.current = projectId;
      fetchRequests();
    }
  }, [projectId, fetchRequests]);

  // Real-time subscription
  useEffect(() => {
    const channelName = projectId
      ? `vendor-work-requests-${projectId}`
      : `vendor-work-requests-all`;

    console.log('[useVendorWorkRequests] Setting up subscription:', channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vendor_work_requests',
          ...(projectId ? { filter: `project_id=eq.${projectId}` } : {})
        },
        (payload) => {
          console.log('[useVendorWorkRequests] Real-time update received:', payload.eventType);
          fetchRequests();
        }
      )
      .subscribe((status) => {
        console.log('[useVendorWorkRequests] Subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, fetchRequests]);

  const createRequest = async (data: {
    project_id: string;
    phase_id?: string;
    work_type: 'labor' | 'labour_work' | 'contract_work' | 'daily_wages' | 'installation' | 'service' | 'maintenance' | 'other';
    work_description: string;
    estimated_budget?: number;
    timeline_days?: number;
    aligned_vendor_details?: any;
  }) => {
    if (!user) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('vendor_work_requests')
        .insert({
          ...data,
          requested_by: user.id,
          status: 'pending',
          approval_status: (user as any).role === 'smo' ? 'pending_gmo' : 'pending_smo',
        });

      if (error) throw error;
      toast.success('Work request created successfully');
      await fetchRequests();
    } catch (error: any) {
      console.error('Error creating work request:', error);
      toast.error('Failed to create work request');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const updateRequest = async (id: string, updates: Partial<VendorWorkRequest>) => {
    if (!user) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('vendor_work_requests')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      toast.success('Work request updated');
      await fetchRequests();
    } catch (error: any) {
      console.error('Error updating work request:', error);
      toast.error('Failed to update work request');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const alignVendor = async (id: string, vendorDetails: Partial<VendorWorkRequest>) => {
    return updateRequest(id, {
      ...vendorDetails,
      status: 'vendor_aligned',
    });
  };

  const approveRequest = async (id: string, role: 'smo' | 'gmo' | 'gm' | 'admin' | 'ceo') => {
    if (!user) return;
    setIsSaving(true);

    try {
      const updates: any = {
        [`${role}_approved_at`]: new Date().toISOString(),
        [`${role}_approved_by`]: user.id,
      };

      if (role === 'smo') {
        updates.approval_status = 'pending_gmo';
      } else if (role === 'gmo') {
        updates.approval_status = 'pending_gm';
      } else if (role === 'gm') {
        updates.approval_status = 'pending_admin';
      } else if (role === 'admin') {
        updates.approval_status = 'pending_ceo';
      } else if (role === 'ceo') {
        updates.approval_status = 'approved_for_sourcing';
        updates.approved_for_sourcing_at = new Date().toISOString();
      }

      await updateRequest(id, updates);
      toast.success(`${role.toUpperCase()} approval recorded`);
    } catch (error: any) {
      console.error('Error approving work request:', error);
      toast.error('Failed to approve work request');
    } finally {
      setIsSaving(false);
    }
  };

  const rejectRequest = async (id: string, reason: string) => {
    if (!user) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('vendor_work_requests')
        .update({
          approval_status: 'rejected_smo',
          smo_approved_at: new Date().toISOString(),
          smo_approved_by: user.id
        })
        .eq('id', id);

      if (error) throw error;

      // Log to procurement timeline
      await supabase.from('procurement_timeline').insert({
        vendor_work_request_id: id,
        action: 'rejected_smo',
        performed_by: user.id,
        performed_by_name: user.name,
        details: { reason }
      });

      toast.success('Work request rejected');
      await fetchRequests();
    } catch (error: any) {
      console.error('Error rejecting work request:', error);
      toast.error('Failed to reject work request');
    } finally {
      setIsSaving(false);
    }
  };

  return {
    requests,
    isLoading,
    isSaving,
    createRequest,
    updateRequest,
    alignVendor,
    approveRequest,
    rejectRequest,
    refetch: fetchRequests,
  };
}
// ... existing code ...

export function useMyVendorWorkRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<VendorWorkRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMyRequests = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('vendor_work_requests')
        .select(`
          *,
          project:projects(project_name, project_id),
          phase:project_phases(phase_name),
          requester:profiles!vendor_work_requests_requested_by_fkey(name, email, department),
          assignee:profiles!vendor_work_requests_assigned_to_sourcing_fkey(name, email)
        `)
        .eq('requested_by', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests((data || []) as unknown as VendorWorkRequest[]);
    } catch (error) {
      console.error('Error fetching my vendor work requests:', error);
      const _isMissing = (error as any)?.code === 'PGRST205' || (error as any)?.message?.includes('schema cache'); if (!_isMissing) if (!isMissingTable(error)) toast.error('Failed to fetch work requests');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMyRequests();

    const channel = supabase
      .channel('my-vendor-work-requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vendor_work_requests',
          filter: `requested_by=eq.${user?.id}`
        },
        () => {
          fetchMyRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchMyRequests]);

  return { requests, isLoading, refetch: fetchMyRequests };
}
