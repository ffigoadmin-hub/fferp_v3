import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { LocationZone } from '@/types/igo-chain';
import { getCurrentPosition, calculateDistance } from '@/utils/geolocation';

export interface DayStartData {
  id: string;
  date: string;
  day_plan: string;
  location_zone: string;
  location_zone_other: string | null;
  location_verified: boolean;
  submitted_at: string;
  login_status: string | null;
}

export function useDayStart(date: Date) {
  const { user } = useAuth();
  const [dayStart, setDayStart] = useState<DayStartData | null>(null);
  const [hasMorningSelfie, setHasMorningSelfie] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const dateStr = format(date, 'yyyy-MM-dd');

  const fetchDayStart = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      // Check for day start
      const { data: dayStartData, error: dayStartError } = await (supabase
        .from('day_starts') as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('date', dateStr)
        .maybeSingle();

      if (dayStartError) throw dayStartError;
      setDayStart(dayStartData);

      // Check for morning selfie
      const { data: selfieData, error: selfieError } = await supabase
        .from('selfie_records')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', dateStr)
        .eq('selfie_type', 'morning_login')
        .maybeSingle();

      if (selfieError) throw selfieError;
      setHasMorningSelfie(!!selfieData);

    } catch (error) {
      console.error('Error fetching day start status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDayStart();
  }, [user, dateStr]);

  const submitDayStart = async (
    locationZone: LocationZone,
    dayPlan: string,
    otherReason?: string
  ) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    if (dayStart) {
      return { success: false, error: 'Day start already submitted' };
    }

    setIsSaving(true);

    try {
      // Get the morning selfie captured_at time as the official login time
      const { data: selfieData } = await (supabase
        .from('selfie_records') as any)
        .select('captured_at')
        .eq('user_id', user.id)
        .eq('date', dateStr)
        .eq('selfie_type', 'morning_login')
        .maybeSingle();

      // Determine login status based on selfie capture time using IST
      let loginStatus = 'on_time';
      if (selfieData?.captured_at) {
        const capturedAt = new Date(selfieData.captured_at);
        // Convert UTC to IST (UTC + 5:30)
        const utcHours = capturedAt.getUTCHours();
        const utcMinutes = capturedAt.getUTCMinutes();

        let istMinutes = utcMinutes + 30;
        let istHours = utcHours + 5;

        // Handle minute overflow
        if (istMinutes >= 60) {
          istHours += 1;
          istMinutes -= 60;
        }

        // Handle day overflow
        if (istHours >= 24) {
          istHours -= 24;
        }

        const timeInMinutes = istHours * 60 + istMinutes;

        if (user.role.toLowerCase() === 'auditor') {
          loginStatus = 'on_time';
        } else if (timeInMinutes > 660) {
          loginStatus = 'severe_late'; // > 11:00 AM - 0.5 day LOP
        } else if (timeInMinutes > 615) {
          loginStatus = 'late'; // 10:16 - 11:00 AM - 0.25 day LOP
        } else if (timeInMinutes < 585) {
          loginStatus = 'perfect'; // < 9:45 AM
        } else {
          loginStatus = 'on_time'; // 9:45 - 10:15 AM
        }
      }

      // Use selfie captured_at as submitted_at (login time) if available
      const submittedAt = selfieData?.captured_at || new Date().toISOString();

      // NEW: Geofence Verification logic
      let isVerified = false;
      let matchedGeofenceId = null;
      let gpsPosition = null;

      try {
        gpsPosition = await getCurrentPosition().catch(() => null);
        if (gpsPosition) {
          const { data: fences } = await (supabase.from('geofences') as any)
            .select('*')
            .eq('is_active', true);

          if (fences && fences.length > 0) {
            for (const f of fences) {
              const d = calculateDistance(gpsPosition.lat, gpsPosition.lng, f.latitude, f.longitude);
              if (d <= f.radius_meters) {
                isVerified = true;
                matchedGeofenceId = f.id;
                break;
              }
            }
          }

          // Log this login event with GPS context
          await (supabase.from('user_location_logs') as any).insert({
            user_id: user.id,
            latitude: gpsPosition.lat,
            longitude: gpsPosition.lng,
            accuracy: gpsPosition.accuracy,
            action_type: 'ATTENDANCE_LOGIN',
            is_within_geofence: isVerified,
            matched_geofence_id: matchedGeofenceId,
            device_info: { source: 'day_start_submission' },
            timestamp: submittedAt // Sync log time with selfie time
          });
        }
      } catch (geoErr) {
        console.warn("Geofence check failed during login:", geoErr);
      }

      const result = await (supabase
        .from('day_starts') as any)
        .insert({
          user_id: user.id,
          date: dateStr,
          day_plan: dayPlan,
          location_zone: locationZone,
          location_zone_other: otherReason || null,
          location_verified: isVerified,
          login_status: loginStatus,
          submitted_at: submittedAt,
        })
        .select()
        .single();

      if (result.error) throw result.error;

      setDayStart(result.data);
      setHasMorningSelfie(!!selfieData); // Should be true if they got here
      toast.success('Day start recorded successfully');

      return { success: true, data: result.data };
    } catch (error) {
      console.error('Error submitting day start:', error);
      toast.error('Failed to submit day start');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  return {
    dayStart,
    hasMorningSelfie,
    isLoading,
    isSaving,
    hasStartedDay: !!dayStart,
    submitDayStart,
    refetch: fetchDayStart,
  };
}
