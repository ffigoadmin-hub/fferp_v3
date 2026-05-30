import { isMissingTable } from '@/lib/supabase-error-guard';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface AuditLogEntry {
  id: string;
  action: string;
  performed_by: string | null;
  performed_by_name: string | null;
  performed_by_role: string | null;
  record_type: string;
  record_id: string | null;
  before_state: any;
  after_state: any;
  remarks: string | null;
  created_at: string;
}

export function useAuditLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchLogs = async (isInitial = true) => {
    if (!user) return;

    try {
      if (isInitial) setIsLoading(true);
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      const _isMissing = (error as any)?.code === 'PGRST205' || (error as any)?.message?.includes('schema cache'); if (!_isMissing) if (!isMissingTable(error)) toast.error('Failed to fetch audit logs');
    } finally {
      if (isInitial) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(true);

    // Subscribe to realtime updates
    const channel = supabase
      .channel('audit-logs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'audit_logs',
        },
        () => {
          fetchLogs(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const deleteLog = async (logId: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('audit_logs')
        .delete()
        .eq('id', logId);

      if (error) throw error;

      setLogs(prev => prev.filter(l => l.id !== logId));
      toast.success('Audit log deleted');
      return { success: true };
    } catch (error) {
      console.error('Error deleting audit log:', error);
      toast.error('Failed to delete audit log');
      return { success: false, error };
    } finally {
      setIsDeleting(false);
    }
  };

  const createLog = async (
    action: string,
    recordType: string,
    recordId?: string,
    beforeState?: any,
    afterState?: any,
    remarks?: string
  ) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const { error } = await supabase
        .from('audit_logs')
        .insert({
          action,
          performed_by: user.id,
          performed_by_name: user.name,
          performed_by_role: user.role,
          record_type: recordType,
          record_id: recordId,
          before_state: beforeState,
          after_state: afterState,
          remarks,
        });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error creating audit log:', error);
      return { success: false, error };
    }
  };

  return {
    logs,
    isLoading,
    isDeleting,
    deleteLog,
    createLog,
    refetch: fetchLogs,
  };
}
