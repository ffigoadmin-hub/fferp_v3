import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface RouteGuardStatus {
  hasMorningSelfie: boolean;
  isWeekOff: boolean;
  isShiftUser: boolean;
  isLockRevoked: boolean;
  isManuallyLocked: boolean;
}

const DEFAULT_STATUS: RouteGuardStatus = {
  hasMorningSelfie: false,
  isWeekOff: false,
  isShiftUser: false,
  isLockRevoked: false,
  isManuallyLocked: false,
};

const fetchRouteGuardStatus = async (userId: string, date: string): Promise<RouteGuardStatus> => {
  const [selfieRes, weekOffRes, shiftRes, overrideRes] = await Promise.all([
    supabase
      .from('selfie_records')
      .select('id')
      .eq('user_id', userId)
      .eq('date', date)
      .eq('selfie_type', 'morning_login')
      .maybeSingle(),
    (supabase.rpc as any)('is_week_off_day', {
      p_employee_id: userId,
      p_date: date,
    }),
    (supabase.from('shift_user_assignments') as any)
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle(),
    (supabase.from('attendance_lock_overrides') as any)
      .select('override_type')
      .eq('user_id', userId)
      .eq('override_date', date)
      .maybeSingle(),
  ]);

  // Check for critical errors (network failures, etc.)
  const criticalErrors = [selfieRes.error, weekOffRes.error, shiftRes.error, overrideRes.error].filter(Boolean);

  if (criticalErrors.length > 0) {
    const isNetworkError = criticalErrors.some(err =>
      err.message?.includes('Failed to fetch') ||
      err.message?.includes('NetworkError') ||
      err.message?.includes('fetch')
    );

    if (isNetworkError) {
      throw new Error('Network error fetching route guard status');
    }

    // Log other errors but maybe don't block? 
    // Actually, it's safer to throw for ANY error to avoid inconsistent states.
    console.error('Errors fetching route guard status:', criticalErrors);
    throw new Error('Error fetching route guard status');
  }

  const overrideType = overrideRes.data?.override_type;

  return {
    hasMorningSelfie: !!selfieRes.data,
    isWeekOff: !!weekOffRes.data,
    isShiftUser: !!shiftRes.data,
    isLockRevoked: overrideType === 'REVOKE',
    isManuallyLocked: overrideType === 'LOCK',
  };
};

export const useRouteGuardStatus = () => {
  const { user } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');
  const isEmployee = user?.role?.toLowerCase() === 'employee';

  const query = useQuery({
    queryKey: ['route-guard-status', user?.id, today],
    enabled: !!user?.id && isEmployee,
    queryFn: () => fetchRouteGuardStatus(user!.id, today),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return {
    ...query,
    data: query.data ?? DEFAULT_STATUS,
  };
};
