import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Real-time attendance monitoring hook (GLOBAL for BOI/HR/Admin)
 * Subscribes to ALL changes in attendance-related tables (not filtered by user)
 * This ensures BOI and management see updates from all employees instantly
 */
export const useRealtimeAttendance = (onUpdate: () => void) => {
  const stableOnUpdate = useCallback(onUpdate, [onUpdate]);

  useEffect(() => {
    // GLOBAL unified subscription - single channel for multiple potential triggers
    const channel = supabase
      .channel('global-attendance-monitor')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'day_starts' },
        () => stableOnUpdate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hourly_reports' },
        () => stableOnUpdate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hr_attestations' },
        () => stableOnUpdate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'day_plans' },
        () => stableOnUpdate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'selfie_records' },
        () => stableOnUpdate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hourly_plans' },
        () => stableOnUpdate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => stableOnUpdate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lop_entries' },
        () => stableOnUpdate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shift_sessions' },
        () => stableOnUpdate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shift_hourly_slots' },
        () => stableOnUpdate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shift_eod_reports' },
        () => stableOnUpdate()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };

  }, [stableOnUpdate]);
};
