import { isMissingTable } from '@/lib/supabase-error-guard';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// LOP Approval Chain: HR creates → Admin approves | Admin/Auditor creates → Auto-approved
export type LOPStatus = 'pending_admin' | 'pending_ceo' | 'approved' | 'rejected';

export interface LOPEntry {
  id: string;
  employee_id: string;
  employee_name?: string;
  employee_email?: string;
  employee_department?: string;
  lop_type: '1_day' | '0.5_day' | '0.25_day' | '0.1_day';
  reason: string;
  evidence_url: string;
  lop_date: string;
  created_by: string;
  created_at: string;
  status: LOPStatus;
  source?: string; // 'manual' or 'auto'
  admin_verified_at?: string;
  admin_verified_by?: string;
  ceo_approved_at?: string;
  ceo_approved_by?: string;
  rejection_reason?: string;
  // Reversal fields
  reversal_requested?: boolean;
  reversal_reason?: string;
  reversal_proof_url?: string;
  reversal_status?: string;
  created_by_name?: string;
  created_by_role?: string;
}

export function useLOPEntries(statusFilter?: LOPStatus | LOPStatus[]) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LOPEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const fetchEntries = useCallback(async () => {
    if (!user) return;

    try {
      let allData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      let totalCount = 0;

      // Fetch all entries with pagination
      while (hasMore) {
        let queryBuilder = supabase
          .from('lop_entries')
          .select(`
            *,
            employee:profiles!lop_entries_employee_id_fkey(name, email, department),
            creator:profiles!created_by(name, role)
          `, { count: page === 0 ? 'exact' : undefined });

        // Apply status filter if provided
        if (statusFilter) {
          if (Array.isArray(statusFilter)) {
            queryBuilder = queryBuilder.in('status', statusFilter);
          } else {
            queryBuilder = queryBuilder.eq('status', statusFilter);
          }
        }

        const { data, error, count } = await queryBuilder
          .order('lop_date', { ascending: false })
          .order('created_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allData = allData.concat(data);
          hasMore = data.length === pageSize;
          page++;
          if (page === 1 && count !== null) {
            totalCount = count;
          }
        }
      }

      const formatted = allData.map((entry: any) => ({
        ...entry,
        employee_name: entry.employee?.name,
        employee_email: entry.employee?.email,
        employee_department: entry.employee?.department,
        created_by_name: entry.creator?.name,
        created_by_role: entry.creator?.role,
      }));

      setEntries(formatted);
      setTotalCount(totalCount);
    } catch (error) {
      console.error('Error fetching LOP entries:', error);
      const _isMissing = (error as any)?.code === 'PGRST205' || (error as any)?.message?.includes('schema cache'); if (!_isMissing) if (!isMissingTable(error)) toast.error('Failed to fetch LOP entries');
    } finally {
      setIsLoading(false);
    }
  }, [user, statusFilter]);

  useEffect(() => {
    fetchEntries();

    const channel = supabase
      .channel('lop-entries-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lop_entries' },
        () => {
          fetchEntries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEntries]);

  const addEntry = async (data: {
    employee_id: string;
    lop_type: '1_day' | '0.5_day' | '0.25_day' | '0.1_day';
    reason: string;
    evidence_url: string;
    lop_date: string;
    status?: string;
    source?: string;
  }, creatorRole?: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    setIsSaving(true);
    try {
      const { data: isWeekOff, error: checkError } = await (supabase as any).rpc('is_week_off_day', {
        p_employee_id: data.employee_id,
        p_date: data.lop_date
      });
      if (checkError) console.error('Error checking week off:', checkError);
      else if (isWeekOff === true) {
        toast.error('Cannot create LOP for week off day.');
        setIsSaving(false);
        return { success: false, error: 'Date is a week off' };
      }
      const role = creatorRole?.toLowerCase() || '';
      const isDirectApproval = ['admin', 'auditor'].includes(role);
      const finalStatus = data.status || (isDirectApproval ? 'approved' : 'pending_admin');
      const { error } = await (supabase.from('lop_entries') as any).insert({
        employee_id: data.employee_id,
        lop_type: data.lop_type,
        reason: data.reason,
        evidence_url: data.evidence_url,
        lop_date: data.lop_date,
        created_by: user.id,
        status: finalStatus,
        source: data.source || 'manual',
      });
      if (error) throw error;
      toast.success(isDirectApproval ? 'LOP recorded' : 'LOP submitted for approval');
      await fetchEntries();
      return { success: true };
    } catch (error) {
      console.error('Error adding LOP entry:', error);
      toast.error('Failed to add LOP entry');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const verifyEntry = async (id: string, action: 'verify' | 'reject', rejectionReason?: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    setIsSaving(true);
    try {
      const entry = entries.find(e => e.id === id);
      const updateData: any = {
        admin_verified_at: new Date().toISOString(),
        admin_verified_by: user.id,
      };
      if (action === 'verify') {
        updateData.status = 'pending_ceo';
      } else {
        updateData.status = 'rejected';
        updateData.rejection_reason = rejectionReason || 'Rejected by Admin';
      }
      const { error } = await (supabase as any).from('lop_entries').update(updateData).eq('id', id);
      if (error) throw error;
      if (entry && action === 'reject') {
        await (supabase.from('notifications') as any).insert({
          user_id: entry.employee_id,
          title: 'LOP Rejected',
          message: `Your LOP for ${entry.lop_date} was rejected.`,
          type: 'lop_rejected',
          role: 'employee',
        });
      }
      toast.success(action === 'verify' ? 'LOP verified - forwarded to CEO' : 'LOP entry rejected');
      await fetchEntries();
      return { success: true };
    } catch (error) {
      console.error('Error verifying LOP entry:', error);
      toast.error('Failed to update LOP entry');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const approveEntry = async (id: string, action: 'approve' | 'reject', rejectionReason?: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    setIsSaving(true);
    try {
      const entry = entries.find(e => e.id === id);
      const updateData: any = {
        ceo_approved_at: new Date().toISOString(),
        ceo_approved_by: user.id,
      };
      if (action === 'approve') {
        updateData.status = 'approved';
      } else {
        updateData.status = 'rejected';
        updateData.rejection_reason = rejectionReason || 'Rejected by CEO';
      }
      const { error } = await (supabase as any).from('lop_entries').update(updateData).eq('id', id);
      if (error) throw error;
      if (entry) {
        await (supabase.from('notifications') as any).insert({
          user_id: entry.employee_id,
          title: action === 'approve' ? 'LOP Approved' : 'LOP Rejected',
          message: action === 'approve' ? 'Approved for payroll.' : 'Rejected by CEO.',
          type: action === 'approve' ? 'lop_approved' : 'lop_rejected',
          role: 'employee',
        });
      }
      toast.success(action === 'approve' ? 'LOP approved for payroll' : 'LOP entry rejected');
      await fetchEntries();
      return { success: true };
    } catch (error) {
      console.error('Error approving LOP entry:', error);
      toast.error('Failed to update LOP entry');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      const { error } = await (supabase.from('lop_entries') as any).delete().eq('id', id);
      if (error) throw error;
      toast.success('LOP entry deleted');
      await fetchEntries();
      return { success: true };
    } catch (error) {
      console.error('Error deleting LOP entry:', error);
      toast.error('Failed to delete LOP entry');
      return { success: false, error };
    }
  };

  const deleteEntries = async (ids: string[]) => {
    try {
      if (!ids.length) return { success: false, error: 'No IDs provided' };
      const { error } = await (supabase.from('lop_entries') as any).delete().in('id', ids);
      if (error) throw error;
      toast.success(`${ids.length} LOP entries deleted`);
      await fetchEntries();
      return { success: true };
    } catch (error) {
      console.error('Error deleting LOP entries:', error);
      toast.error('Failed to delete LOP entries');
      return { success: false, error };
    }
  };

  const getLOPValue = (type: string): number => {
    switch (type) {
      case '1_day': return 1;
      case '0.5_day': return 0.5;
      case '0.25_day': return 0.25;
      case '0.1_day': return 0.1;
      default: return 0;
    }
  };

  const adminReviewReversal = async (id: string, action: 'verify' | 'reject', rejectionReason?: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    setIsSaving(true);
    try {
      const entry = entries.find(e => e.id === id);
      const updateData: any = { reversal_admin_reviewed_at: new Date().toISOString(), reversal_admin_reviewed_by: user.id };
      updateData.reversal_status = action === 'verify' ? 'REV_PENDING_CEO' : 'REV_REJECTED';
      const { error } = await (supabase as any).from('lop_entries').update(updateData).eq('id', id);
      if (error) throw error;
      if (entry) {
        await (supabase.from('notifications') as any).insert({
          user_id: entry.employee_id,
          title: 'Reversal Update',
          message: action === 'verify' ? 'Forwarded to CEO.' : 'Rejected by Admin.',
          type: 'lop_reversal_progress',
          role: 'employee',
        });
      }
      toast.success(action === 'verify' ? 'Reversal forwarded to CEO' : 'Reversal request rejected');
      await fetchEntries();
      return { success: true };
    } catch (error) {
      console.error('Error reviewing reversal:', error);
      toast.error('Failed to update reversal request');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const ceoApproveReversal = async (id: string, action: 'approve' | 'reject') => {
    if (!user) return { success: false, error: 'Not authenticated' };
    setIsSaving(true);
    try {
      if (action === 'approve') {
        const { data, error } = await (supabase as any).rpc('ceo_approve_lop_reversal', { p_lop_id: id });
        if (error) throw error;
        const result = data as { success: boolean; error?: string };
        if (!result.success) throw new Error(result.error || 'Failed to approve reversal');
        toast.success('🎉 LOP reversed!');
      } else {
        const entry = entries.find(e => e.id === id);
        const { error } = await (supabase as any).from('lop_entries').update({
          reversal_status: 'REV_REJECTED',
          reversal_ceo_reviewed_at: new Date().toISOString(),
          reversal_ceo_reviewed_by: user.id,
        }).eq('id', id);
        if (error) throw error;
        if (entry) {
          await (supabase.from('notifications') as any).insert({
            user_id: entry.employee_id,
            title: 'Reversal Rejected',
            message: 'Rejected by CEO.',
            type: 'lop_reversal_rejected',
            role: 'employee',
          });
        }
        toast.error('Reversal rejected');
      }
      await fetchEntries();
      return { success: true };
    } catch (error) {
      console.error('Error approving reversal:', error);
      toast.error('Failed to update reversal request');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  return {
    entries,
    isLoading,
    isSaving,
    addEntry,
    verifyEntry,
    approveEntry,
    deleteEntry,
    deleteEntries,
    adminReviewReversal,
    ceoApproveReversal,
    refetch: fetchEntries,
    getLOPValue,
    totalCount,
  };
}
