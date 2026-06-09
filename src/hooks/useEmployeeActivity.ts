/**
 * Real-time hook for employee activity data (hourly plans & reports)
 * Subscribes to live updates for a specific user
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { sortSlots } from '@/lib/slotHelpers';

export interface HourlyPlan {
  id: string;
  time_slot: string;
  plan_text: string;
  submitted_at: string;
  status: string;
}

export interface HourlyReport {
  id: string;
  time_slot: string;
  report_text: string;
  submitted_at: string;
  is_late: boolean;
  delay_minutes: number;
  status: string;
}

export interface SelfieRecord {
  id: string;
  selfie_type: string;
  selfie_url: string;
  captured_at: string;
}

export interface EODReport {
  id: string;
  planned_work: string;
  completed_work: string;
  pending_items: string | null;
  completion_percentage: number;
  submitted_at: string;
}

export interface EmployeeActivityData {
  plans: HourlyPlan[];
  reports: HourlyReport[];
  selfies: SelfieRecord[];
  eodReport: EODReport | null;
  loginTime: string | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useEmployeeActivity(
  userId: string | null,
  date: Date
): EmployeeActivityData {
  const [plans, setPlans] = useState<HourlyPlan[]>([]);
  const [reports, setReports] = useState<HourlyReport[]>([]);
  const [selfies, setSelfies] = useState<SelfieRecord[]>([]);
  const [eodReport, setEodReport] = useState<EODReport | null>(null);
  const [loginTime, setLoginTime] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dateStr = format(date, 'yyyy-MM-dd');

  const fetchData = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const [plansRes, reportsRes, selfiesRes, eodRes, dayStartRes] = await Promise.all([
        supabase
          .from('hourly_plans')
          .select('id, time_slot, plan_text, submitted_at, status')
          .eq('user_id', userId)
          .eq('date', dateStr),
        supabase
          .from('hourly_reports')
          .select('id, time_slot, report_text, submitted_at, is_late, delay_minutes, status')
          .eq('user_id', userId)
          .eq('date', dateStr),
        supabase
          .from('selfie_records')
          .select('id, selfie_type, selfie_url, captured_at')
          .eq('user_id', userId)
          .eq('date', dateStr)
          .order('captured_at', { ascending: true }),
        supabase
          .from('eod_reports')
          .select('id, planned_work, completed_work, pending_items, completion_percentage, submitted_at')
          .eq('user_id', userId)
          .eq('date', dateStr)
          .maybeSingle(),
        supabase
          .from('day_starts')
          .select('submitted_at')
          .eq('user_id', userId)
          .eq('date', dateStr)
          .maybeSingle(),
      ]);

      if (plansRes.error) throw plansRes.error;
      if (reportsRes.error) throw reportsRes.error;
      if (selfiesRes.error) throw selfiesRes.error;
      if (eodRes.error) throw eodRes.error;

      // Sort by time slot
      const sortedPlans = sortSlots((plansRes.data || []) as any[]);
      const sortedReports = sortSlots(
        ((reportsRes.data || []) as any[]).map(r => ({
          ...r,
          is_late: r.is_late || false,
          delay_minutes: r.delay_minutes || 0,
        }))
      );

      setPlans(sortedPlans);
      setReports(sortedReports);
      setSelfies((selfiesRes.data || []) as any[]);
      setEodReport(eodRes.data);

      // Get login time from morning selfie or day_start record
      const morningSelfie = ((selfiesRes.data || []) as any[]).find(s => s.selfie_type === 'morning_login');
      const loginTimestamp = morningSelfie?.captured_at || dayStartRes.data?.submitted_at;

      if (loginTimestamp) {
        setLoginTime(format(new Date(loginTimestamp), 'hh:mm:ss a'));
      } else {
        setLoginTime(null);
      }
    } catch (err: any) {
      console.error('Error fetching employee activity:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [userId, dateStr]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time subscriptions
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`employee-activity-${userId}-${dateStr}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hourly_plans',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // Only update if the date matches
          const record = payload.new as any;
          if (record?.date === dateStr || payload.eventType === 'DELETE') {
            fetchData();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hourly_reports',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const record = payload.new as any;
          if (record?.date === dateStr || payload.eventType === 'DELETE') {
            fetchData();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'selfie_records',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const record = payload.new as any;
          if (record?.date === dateStr || payload.eventType === 'DELETE') {
            fetchData();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'eod_reports',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const record = payload.new as any;
          if (record?.date === dateStr || payload.eventType === 'DELETE') {
            fetchData();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'day_starts',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const record = payload.new as any;
          if (record?.date === dateStr || payload.eventType === 'DELETE') {
            fetchData();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, dateStr, fetchData]);

  return {
    plans,
    reports,
    selfies,
    eodReport,
    loginTime,
    isLoading,
    error,
    refetch: fetchData,
  };
}
