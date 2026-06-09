import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface TravelLog {
  id: string;
  assignment_id: string;
  request_id: string;
  user_id: string;
  user_name: string;
  traveling_mode: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  start_lat: number | null;
  start_lng: number | null;
  start_accuracy_meters: number | null;
  end_lat: number | null;
  end_lng: number | null;
  end_accuracy_meters: number | null;
  distance_km: number | null;
  remarks: string | null;
  created_at: string;
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 0,
    });
  });
}

/** Haversine formula — compute distance in km between two GPS coordinates */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useTravelLogs(assignmentId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['site-visit-travel', assignmentId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('site_visit_travel_logs')
        .select('*')
        .eq('assignment_id', assignmentId!)
        .order('started_at', { ascending: false });
      if (error) throw error;
      return data as TravelLog[];
    },
    enabled: !!user && !!assignmentId,
  });
}

export function useActiveTravelLog(assignmentId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['site-visit-travel', 'active', assignmentId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('site_visit_travel_logs')
        .select('*')
        .eq('assignment_id', assignmentId!)
        .eq('user_id', user!.id)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as TravelLog | null;
    },
    enabled: !!user && !!assignmentId,
    refetchInterval: 10_000,
  });
}

export function useSiteVisitTravel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const startMutation = useMutation({
    mutationFn: async ({
      assignmentId,
      requestId,
      travelingMode,
    }: {
      assignmentId: string;
      requestId: string;
      travelingMode: string;
    }) => {
      let startLat: number | null = null;
      let startLng: number | null = null;
      let startAcc: number | null = null;

      try {
        toast.info('Acquiring start GPS...');
        const pos = await getCurrentPosition();
        startLat = pos.coords.latitude;
        startLng = pos.coords.longitude;
        startAcc = pos.coords.accuracy;
        toast.success(`Start GPS locked (±${startAcc.toFixed(0)}m)`);
      } catch {
        toast.warning('Start GPS unavailable — continuing without location');
      }

      await (supabase as any)
        .from('site_visit_requests')
        .update({ status: 'visit_in_progress', updated_at: new Date().toISOString() })
        .eq('id', requestId);

      const { data, error } = await (supabase as any)
        .from('site_visit_travel_logs')
        .insert({
          assignment_id: assignmentId,
          request_id: requestId,
          user_id: user!.id,
          user_name: user!.name,
          traveling_mode: travelingMode,
          started_at: new Date().toISOString(),
          start_lat: startLat,
          start_lng: startLng,
          start_accuracy_meters: startAcc,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visit-travel'] });
      queryClient.invalidateQueries({ queryKey: ['site-visit-requests'] });
      toast.success('Travel tracking started');
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to start travel'),
  });

  const stopMutation = useMutation({
    mutationFn: async ({ logId, remarks }: { logId: string; remarks?: string }) => {
      let endLat: number | null = null;
      let endLng: number | null = null;
      let endAcc: number | null = null;

      try {
        toast.info('Acquiring end GPS...');
        const pos = await getCurrentPosition();
        endLat = pos.coords.latitude;
        endLng = pos.coords.longitude;
        endAcc = pos.coords.accuracy;
        toast.success(`End GPS locked (±${endAcc.toFixed(0)}m)`);
      } catch {
        toast.warning('End GPS unavailable — stopping without location');
      }

      const { data: log } = await (supabase as any)
        .from('site_visit_travel_logs')
        .select('started_at, start_lat, start_lng')
        .eq('id', logId)
        .single();

      const now = new Date();
      const durationMinutes = log
        ? (now.getTime() - new Date(log.started_at).getTime()) / 60000
        : null;

      // Calculate distance if both GPS points are available
      let distanceKm: number | null = null;
      if (log?.start_lat && log?.start_lng && endLat && endLng) {
        distanceKm = parseFloat(
          haversineDistance(log.start_lat, log.start_lng, endLat, endLng).toFixed(2)
        );
      }

      const updatePayload: any = {
        ended_at: now.toISOString(),
        duration_minutes: durationMinutes ? parseFloat(durationMinutes.toFixed(2)) : null,
        end_lat: endLat,
        end_lng: endLng,
        end_accuracy_meters: endAcc,
        remarks: remarks || null,
        updated_at: now.toISOString(),
      };

      if (distanceKm !== null) {
        updatePayload.distance_km = distanceKm;
      }

      const { data, error } = await (supabase as any)
        .from('site_visit_travel_logs')
        .update(updatePayload)
        .eq('id', logId)
        .select()
        .single();

      // Fallback if column distance_km doesn't exist in schema cache yet
      if (error && (error.message.includes('distance_km') || error.code === '42703')) {
        console.warn('Falling back: distance_km column not found in schema cache. Storing in remarks.');
        delete updatePayload.distance_km;
        if (distanceKm !== null) {
          updatePayload.remarks = `[Distance: ${distanceKm}km] ${updatePayload.remarks || ''}`.trim();
        }
        const retry = await (supabase as any)
          .from('site_visit_travel_logs')
          .update(updatePayload)
          .eq('id', logId)
          .select()
          .single();
        if (retry.error) throw retry.error;
        return retry.data;
      }

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visit-travel'] });
      toast.success('Travel tracking stopped');
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to stop travel'),
  });

  return {
    startTravel: startMutation.mutateAsync,
    stopTravel: stopMutation.mutateAsync,
    isStarting: startMutation.isPending,
    isStopping: stopMutation.isPending,
  };
}

