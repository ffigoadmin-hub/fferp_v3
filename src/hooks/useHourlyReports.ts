import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { SlotStatus } from '@/types/igo-chain';

export interface HourlyReportData {
  id: string;
  time_slot: string;
  report_text: string;
  status: string;
  is_late: boolean;
  delay_minutes: number;
  submitted_at: string;
}

export function useHourlyReports(date: Date) {
  const { user } = useAuth();
  const [reports, setReports] = useState<HourlyReportData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const dateStr = format(date, 'yyyy-MM-dd');

  const fetchReports = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('hourly_reports')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', dateStr)
        .order('time_slot', { ascending: true });

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Error fetching hourly reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [user, dateStr]);

  const submitReport = async (
    timeSlot: string,
    reportText: string,
    slotEndTime: Date
  ) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsSaving(true);

    try {
      const now = new Date();
      const gracePeriodEnd = new Date(slotEndTime.getTime() + 15 * 60000); // 15-min grace
      // Report is only late if submitted AFTER the 15-minute grace period
      const isLate = now > gracePeriodEnd;
      const delayMinutes = isLate
        ? Math.floor((now.getTime() - gracePeriodEnd.getTime()) / 60000)
        : 0;

      // Check if report already exists
      const existingReport = reports.find(r => r.time_slot === timeSlot);

      if (existingReport) {
        return { success: false, error: 'Report already submitted for this slot' };
      }

      const { data, error } = await supabase
        .from('hourly_reports')
        .insert({
          user_id: user.id,
          date: dateStr,
          time_slot: timeSlot,
          report_text: reportText,
          status: 'submitted',
          is_late: isLate,
          delay_minutes: delayMinutes,
          slot_end_time: slotEndTime.toISOString(),
          grace_period_end_time: new Date(slotEndTime.getTime() + 15 * 60000).toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error submitting hourly report:', error);
        throw error;
      }

      setReports(prev => [...prev, data]);

      if (isLate) {
        toast.warning(`Report submitted late by ${delayMinutes} minutes`);
      } else {
        toast.success('Report submitted successfully');
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error submitting report:', error);
      toast.error('Failed to submit report');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const getReportForSlot = (timeSlot: string) => {
    return reports.find(r => r.time_slot === timeSlot);
  };

  return {
    reports,
    isLoading,
    isSaving,
    submitReport,
    getReportForSlot,
    refetch: fetchReports,
  };
}
