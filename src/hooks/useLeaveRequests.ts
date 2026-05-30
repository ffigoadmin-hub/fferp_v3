import { isMissingTable } from '@/lib/supabase-error-guard';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface LeaveType {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  requires_proof: boolean;
  allow_retroactive: boolean;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  employee_name?: string;
  employee_department?: string;
  leave_type_id: string;
  leave_type_name?: string;
  start_date: string;
  end_date: string;
  reason: string;
  proof_url?: string | null;
  status: 'pending_hr' | 'pending_boi' | 'pending_admin' | 'pending_ceo' | 'approved' | 'rejected';
  hr_reviewed_by: string | null;
  hr_reviewed_at: string | null;
  hr_remarks: string | null;
  hr_reviewer_name?: string | null;
  admin_reviewed_by: string | null;
  admin_reviewed_at: string | null;
  admin_remarks: string | null;
  admin_reviewer_name?: string | null;
  ceo_reviewed_by: string | null;
  ceo_reviewed_at: string | null;
  ceo_remarks: string | null;
  ceo_reviewer_name?: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  rejected_by_name?: string | null;

  duration_category: 'full' | 'half' | 'hourly';
  start_time: string | null;
  end_time: string | null;
  shift: 'first' | 'second' | null;
  created_at: string;
  updated_at: string;
}

export function useLeaveRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchLeaveTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_types')
        .select('id, name, description, is_active, requires_proof, allow_retroactive')
        .eq('is_active', true)
        .order('name') as any;

      if (error) {
        const missing = (error as any)?.code === 'PGRST205' || (error as any)?.message?.includes('schema cache') || (error as any)?.message?.includes('does not exist');
        if (!missing) console.error('Error fetching leave types:', error);
        setLeaveTypes([]);
        return;
      }
      setLeaveTypes((data as LeaveType[]) || []);
    } catch (error) {
      console.error('Error fetching leave types:', error);
    }
  };

  const fetchRequests = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select(`
          *,
          duration_category,
          start_time,
          end_time,
          shift,
          employee:profiles!leave_requests_employee_id_fkey(name, department),
          leave_type:leave_types(name),
          hr_reviewer:profiles!leave_requests_hr_reviewed_by_fkey(name),
          admin_reviewer:profiles!leave_requests_admin_reviewed_by_fkey(name),
          ceo_reviewer:profiles!leave_requests_ceo_reviewed_by_fkey(name),
          rejector:profiles!leave_requests_rejected_by_fkey(name)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        // leave_requests is an IGO-Chain table — silently return empty in FFERPv2
        const missing = (error as any)?.code === 'PGRST205' || (error as any)?.message?.includes('schema cache') || (error as any)?.message?.includes('does not exist');
        if (!missing) if (!isMissingTable(error)) toast.error('Failed to fetch leave requests');
        setRequests([]);
        setIsLoading(false);
        return;
      }

      const formatted = (data || []).map((req: any) => ({
        ...req,
        employee_name: req.employee?.name,
        employee_department: req.employee?.department,
        leave_type_name: req.leave_type?.name,
        hr_reviewer_name: req.hr_reviewer?.name,
        admin_reviewer_name: req.admin_reviewer?.name,
        ceo_reviewer_name: req.ceo_reviewer?.name,
        rejected_by_name: req.rejector?.name,
      }));

      setRequests(formatted);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      if (!isMissingTable(error)) toast.error('Failed to fetch leave requests');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveTypes();
    fetchRequests();
  }, [user]);

  const createRequest = async (data: {
    leave_type_id: string;
    start_date: string;
    end_date: string;
    reason: string;
    proof_url?: string | null;
    duration_category?: 'full' | 'half' | 'hourly';
    start_time?: string | null;
    end_time?: string | null;
    shift?: 'first' | 'second' | null;
  }) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('leave_requests')
        .insert({
          ...data,
          employee_id: user.id,
        });

      if (error) throw error;

      toast.success('Leave request submitted successfully');
      await fetchRequests();

      return { success: true };
    } catch (error) {
      console.error('Error creating leave request:', error);
      toast.error('Failed to submit leave request');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const approveRequest = async (id: string, remarks: string, request?: LeaveRequest) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsSaving(true);

    try {
      // Use edge function to bypass RLS issues
      const { data, error } = await supabase.functions.invoke('approve-leave', {
        body: {
          requestId: id,
          action: 'approve',
          remarks: remarks || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Leave request approved');
      await fetchRequests();

      return { success: true };
    } catch (error: any) {
      console.error('Error approving request:', error);
      toast.error(error?.message || 'Failed to approve request');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const rejectRequest = async (id: string, reason: string, request?: LeaveRequest) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsSaving(true);

    try {
      // Use edge function to bypass RLS issues
      const { data, error } = await supabase.functions.invoke('approve-leave', {
        body: {
          requestId: id,
          action: 'reject',
          rejectionReason: reason,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Leave request rejected');
      await fetchRequests();

      return { success: true };
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      toast.error(error?.message || 'Failed to reject request');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const addLeaveType = async (name: string, description: string) => {
    try {
      const { error } = await supabase
        .from('leave_types')
        .insert({ name, description });

      if (error) throw error;

      toast.success('Leave type added');
      await fetchLeaveTypes();
      return { success: true };
    } catch (error) {
      console.error('Error adding leave type:', error);
      toast.error('Failed to add leave type');
      return { success: false, error };
    }
  };

  return {
    requests,
    leaveTypes,
    isLoading,
    isSaving,
    createRequest,
    approveRequest,
    rejectRequest,
    addLeaveType,
    refetch: fetchRequests,
  };
}
