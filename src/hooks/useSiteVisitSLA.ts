import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { differenceInSeconds } from 'date-fns';

export interface SLARecord {
  id: string;
  request_id: string;
  sla_number: 1 | 2 | 3 | 4;
  sla_name: string;
  clock_start_at: string;
  deadline_at: string;
  completed_at: string | null;
  status: 'pending' | 'at_risk' | 'breached' | 'completed' | 'completed_late';
  breach_notif_l1_sent_at: string | null;
  breach_notif_l2_sent_at: string | null;
  breach_notif_l3_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SLATimerInfo extends SLARecord {
  totalSeconds: number;
  remainingSeconds: number;
  percentageRemaining: number;
  displayStatus: 'completed' | 'completed_late' | 'breached' | 'at_risk' | 'warning' | 'healthy';
  countdownDisplay: string;  // DD:HH:MM
}

export function useSiteVisitSLA(requestId?: string) {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['site-visit-sla', requestId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('site_visit_sla_tracking')
        .select('*')
        .eq('request_id', requestId!)
        .order('sla_number', { ascending: true });
      if (error) throw error;
      return (data as SLARecord[]).map(enrichSLA);
    },
    enabled: !!user && !!requestId,
    refetchInterval: 60_000, // refresh every minute
  });

  return query;
}

export function useSiteVisitSLAAll() {
  const { user } = useAuth();

  // Used on dashboards to show all breached/at-risk SLAs
  return useQuery({
    queryKey: ['site-visit-sla', 'all'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('site_visit_sla_tracking')
        .select(`
          *,
          site_visit_requests!request_id(request_number, location_title, priority, status)
        `)
        .in('status', ['pending', 'at_risk', 'breached'])
        .order('deadline_at', { ascending: true });
      if (error) throw error;
      return (data as any[]).map((row) => ({ ...enrichSLA(row), request: row.site_visit_requests }));
    },
    enabled: !!user && ['smo', 'admin', 'ceo', 'site_visit_farm_manager'].includes(user.role),
    refetchInterval: 60_000,
  });
}

export function enrichSLA(sla: SLARecord): SLATimerInfo {
  const now = new Date();
  const start = new Date(sla.clock_start_at);
  const deadline = new Date(sla.deadline_at);

  const totalSeconds = differenceInSeconds(deadline, start);
  const remainingSeconds = Math.max(0, differenceInSeconds(deadline, now));
  const percentageRemaining = totalSeconds > 0 ? (remainingSeconds / totalSeconds) * 100 : 0;

  let displayStatus: SLATimerInfo['displayStatus'];
  if (sla.status === 'completed') displayStatus = 'completed';
  else if (sla.status === 'completed_late') displayStatus = 'completed_late';
  else if (sla.status === 'breached') displayStatus = 'breached';
  else if (sla.status === 'at_risk' || percentageRemaining < 20) displayStatus = 'at_risk';
  else if (percentageRemaining < 50) displayStatus = 'warning';
  else displayStatus = 'healthy';

  // Build DD:HH:MM countdown
  const totalSecs = Math.max(0, differenceInSeconds(deadline, now));
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const countdownDisplay = `${String(days).padStart(2, '0')}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  return {
    ...sla,
    totalSeconds,
    remainingSeconds,
    percentageRemaining,
    displayStatus,
    countdownDisplay,
  };
}
