import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';

export interface EODReportData {
  id: string;
  date: string;
  planned_work: string;
  completed_work: string;
  pending_items: string | null;
  completion_percentage: number;
  submitted_at: string;
}

export function useEODReport(date: Date) {
  const { user } = useAuth();
  const [eodReport, setEODReport] = useState<EODReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const dateStr = format(date, 'yyyy-MM-dd');

  const fetchEODReport = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('eod_reports')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', dateStr)
        .maybeSingle();

      if (error) throw error;
      setEODReport(data);
    } catch (error) {
      console.error('Error fetching EOD report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEODReport();
  }, [user, dateStr]);

  const submitEODReport = async (
    plannedWork: string,
    completedWork: string,
    pendingItems?: string,
    completionPercentage?: number
  ) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    
    if (eodReport) {
      return { success: false, error: 'EOD report already submitted' };
    }
    
    setIsSaving(true);
    
    try {
      const { data, error } = await supabase
        .from('eod_reports')
        .insert({
          user_id: user.id,
          date: dateStr,
          planned_work: plannedWork,
          completed_work: completedWork,
          pending_items: pendingItems || null,
          completion_percentage: completionPercentage || 0,
        })
        .select()
        .single();

      if (error) throw error;

      setEODReport(data);
      toast.success('EOD report submitted successfully');
      
      return { success: true, data };
    } catch (error) {
      console.error('Error submitting EOD report:', error);
      toast.error('Failed to submit EOD report');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  return {
    eodReport,
    isLoading,
    isSaving,
    hasSubmittedEOD: !!eodReport,
    submitEODReport,
    refetch: fetchEODReport,
  };
}
