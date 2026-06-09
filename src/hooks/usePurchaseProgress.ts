import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface PurchaseProgressLog {
  id: string;
  material_request_id: string;
  update_text: string;
  status_update: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
  created_at: string;
}

export function usePurchaseProgress(materialRequestId?: string) {
  const { user } = useAuth();
  const [progressLogs, setProgressLogs] = useState<PurchaseProgressLog[]>([]);
  const [allProgressLogs, setAllProgressLogs] = useState<PurchaseProgressLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchProgress = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      let query = supabase
        .from('purchase_progress_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (materialRequestId) {
        query = query.eq('material_request_id', materialRequestId);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;

      if (materialRequestId) {
        setProgressLogs(data || []);
      } else {
        setAllProgressLogs(data || []);
      }
    } catch (error: any) {
      console.error('Error fetching progress logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProgress();
  }, [user, materialRequestId]);

  const addProgress = async (requestId: string, updateText: string, statusUpdate?: string) => {
    if (!user) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('purchase_progress_logs')
        .insert({
          material_request_id: requestId,
          update_text: updateText,
          status_update: statusUpdate || null,
          updated_by: user.id,
          updated_by_name: user.name,
        });

      if (error) throw error;

      // Also log to procurement_timeline
      await supabase.from('procurement_timeline').insert({
        material_request_id: requestId,
        action: 'progress_update',
        performed_by: user.id,
        performed_by_name: user.name,
        details: { update_text: updateText, status_update: statusUpdate },
      });

      toast.success('Progress update added');
      await fetchProgress();
    } catch (error: any) {
      console.error('Error adding progress:', error);
      toast.error('Failed to add progress update');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const getLatestProgress = (requestId: string) => {
    return allProgressLogs.find(p => p.material_request_id === requestId);
  };

  const getLogsForRequest = (requestId: string) => {
    return allProgressLogs.filter(p => p.material_request_id === requestId);
  };

  return {
    logs: allProgressLogs,
    progressLogs,
    allProgressLogs,
    isLoading,
    isSaving,
    addProgress,
    getLatestProgress,
    getLogsForRequest,
    getLogsForGroup: (groupId: string, allRequests: any[]) => {
      const siblingIds = allRequests
        .filter(r => r.split_group_id === groupId || (r.id === groupId))
        .map(r => r.id);
      return allProgressLogs.filter(p => siblingIds.includes(p.material_request_id));
    },
    refetch: fetchProgress,
  };
}
