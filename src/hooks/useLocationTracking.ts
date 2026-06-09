import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentPosition, calculateDistance } from '@/utils/geolocation';

const TRACKING_INTERVAL_MS = 5 * 60 * 1000;
const GEOFENCE_CACHE_TTL_MS = 5 * 60 * 1000;

type Geofence = {
  id: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
};

let geofenceCache: { data: Geofence[]; fetchedAt: number } | null = null;

const fetchActiveGeofences = async (): Promise<Geofence[]> => {
  const now = Date.now();
  if (geofenceCache && now - geofenceCache.fetchedAt < GEOFENCE_CACHE_TTL_MS) {
    return geofenceCache.data;
  }

  const { data, error } = await (supabase.from('geofences') as any)
    .select('id, latitude, longitude, radius_meters')
    .eq('is_active', true);

  if (error) {
    console.error('Failed to fetch active geofences:', error);
    return geofenceCache?.data ?? [];
  }

  const geofences = (data ?? []) as Geofence[];
  geofenceCache = { data: geofences, fetchedAt: now };
  return geofences;
};

export const useLocationTracking = () => {
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Demo users (fake UUIDs) skip location tracking entirely
    if (user.id?.startsWith('demo-')) return;

    const trackLocation = async () => {
      try {
        const position = await getCurrentPosition().catch((err) => {
          console.warn('Periodic location tracking failed:', err);
          return null;
        });

        if (!position) return;

        const geofences = await fetchActiveGeofences();

        let isWithin = false;
        let matchedId: string | null = null;

        for (const fence of geofences) {
          const dist = calculateDistance(position.lat, position.lng, fence.latitude, fence.longitude);
          if (dist <= fence.radius_meters) {
            isWithin = true;
            matchedId = fence.id;
            break;
          }
        }

        await (supabase.from('user_location_logs') as any).insert({
          user_id: user.id,
          latitude: position.lat,
          longitude: position.lng,
          accuracy: position.accuracy,
          action_type: 'PERIODIC',
          is_within_geofence: isWithin,
          matched_geofence_id: matchedId,
          device_info: { userAgent: navigator.userAgent },
        });
      } catch (err) {
        console.error('Critical error in location tracking:', err);
      }
    };

    trackLocation();
    const intervalId = setInterval(trackLocation, TRACKING_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [user, isAuthenticated]);
};
