import { useState, useEffect, useCallback } from 'react';
import { format, subDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, Search, User, Clock, Loader2, RefreshCw, Users, AlertTriangle, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRealtimeAttendance } from '@/hooks/useRealtimeAttendance';
import { getSelfiePublicUrl } from '@/utils/selfieUrl';


interface SelfieRecord {
  id: string;
  user_id: string;
  date: string;
  selfie_type: string;
  selfie_url: string;
  captured_at: string;
  expires_at: string;
  location?: string;
  profile?: {
    name: string;
    email: string;
    department: string;
  };
}

// Selfie window definitions for late calculation
const SELFIE_WINDOWS = {
  morning_login: { start: 9 * 60 + 30, end: 10 * 60 + 15 }, // 9:30 AM - 10:15 AM
  afternoon_break: { start: 14 * 60 + 30, end: 14 * 60 + 45 }, // 2:30 PM - 2:45 PM
  evening_break: { start: 17 * 60 + 40, end: 17 * 60 + 45 }, // 5:40 PM - 5:45 PM
};

const getSelfieLateness = (selfieType: string, capturedAt: string): { isLate: boolean; lateMinutes: number } => {
  const capturedTime = new Date(capturedAt);
  const hours = capturedTime.getHours();
  const minutes = capturedTime.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  const window = SELFIE_WINDOWS[selfieType as keyof typeof SELFIE_WINDOWS];
  if (!window) return { isLate: false, lateMinutes: 0 };

  if (timeInMinutes > window.end) {
    return { isLate: true, lateMinutes: timeInMinutes - window.end };
  }
  return { isLate: false, lateMinutes: 0 };
};

export function SelfieAttendanceWidget() {
  const [selfies, setSelfies] = useState<SelfieRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const fetchSelfies = async (isInitial = true) => {
    if (isInitial) setIsLoading(true);
    try {
      // Fetch regular selfies + shift sessions in parallel
      const [selfieResult, shiftResult, dayStartsResult] = await Promise.all([
        supabase
          .from('selfie_records')
          .select(`
            *,
            profile:profiles!selfie_records_user_id_fkey(name, email, department)
          `)
          .eq('date', selectedDate)
          .order('captured_at', { ascending: false }),
        (supabase.from('shift_sessions') as any)
          .select('id, user_id, date, login_selfie_url, logout_selfie_url, shift_start, shift_end, profiles!shift_sessions_user_id_fkey(name, email, department)')
          .eq('date', selectedDate),
        supabase
          .from('day_starts')
          .select('user_id, location_zone, location_zone_other')
          .eq('date', selectedDate),
      ]);

      if (selfieResult.error) throw selfieResult.error;

      // Map locations to selfies
      const locationMap = new Map();
      (dayStartsResult.data || []).forEach((ds: any) => {
        locationMap.set(ds.user_id, ds.location_zone === 'Other' ? ds.location_zone_other : ds.location_zone);
      });

      // Build regular selfies
      const regularSelfies = (selfieResult.data || []).map(selfie => ({
        ...selfie,
        location: locationMap.get(selfie.user_id) || 'Unknown Location'
      }));

      // Build shift selfies from shift_sessions
      const shiftSelfies: SelfieRecord[] = [];
      const shiftSessions = (shiftResult.data || []) as any[];
      for (const session of shiftSessions) {
        if (session.login_selfie_url) {
          shiftSelfies.push({
            id: `shift-login-${session.id}`,
            user_id: session.user_id,
            date: session.date,
            selfie_type: 'shift_login',
            selfie_url: session.login_selfie_url,
            captured_at: session.shift_start || session.date,
            expires_at: '',
            location: locationMap.get(session.user_id) || 'Shift Location',
            profile: session.profiles,
          });
        }
        if (session.logout_selfie_url) {
          shiftSelfies.push({
            id: `shift-logout-${session.id}`,
            user_id: session.user_id,
            date: session.date,
            selfie_type: 'shift_logout',
            selfie_url: session.logout_selfie_url,
            captured_at: session.shift_end || session.date,
            expires_at: '',
            location: locationMap.get(session.user_id) || 'Shift Location',
            profile: session.profiles,
          });
        }
      }

      // Merge: skip shift users who already have regular selfies
      const regularUserIds = new Set(regularSelfies.map(s => s.user_id));
      const uniqueShiftSelfies = shiftSelfies.filter(s => !regularUserIds.has(s.user_id));
      setSelfies([...regularSelfies, ...uniqueShiftSelfies]);
    } catch (err: any) {
      console.error('Error fetching selfies:', err);
    } finally {
      if (isInitial) setIsLoading(false);
    }
  };


  const fetchSelfiesMemoized = useCallback(fetchSelfies, [selectedDate]);

  const fetchSelfiesRealtime = useCallback(() => {
    fetchSelfiesMemoized(false);
  }, [fetchSelfiesMemoized]);

  // Use centralized real-time attendance hook
  useRealtimeAttendance(fetchSelfiesRealtime);


  useEffect(() => {
    fetchSelfiesMemoized(true);
    // Refresh every minute as a fallback
    const interval = setInterval(() => fetchSelfiesMemoized(false), 60000);
    return () => clearInterval(interval);
  }, [selectedDate, fetchSelfiesMemoized]);


  const getSelfieTypeLabel = (type: string) => {
    switch (type) {
      case 'morning_login':
        return 'Morning';
      case 'afternoon_break':
        return 'Lunch';
      case 'evening_break':
        return 'Break';
      case 'shift_login':
        return 'Shift In';
      case 'shift_logout':
        return 'Shift Out';
      default:
        return type;
    }
  };

  const getSelfieTypeBadgeVariant = (type: string): "default" | "secondary" | "outline" => {
    switch (type) {
      case 'morning_login':
      case 'shift_login':
        return 'default';
      case 'afternoon_break':
      case 'shift_logout':
        return 'secondary';
      case 'evening_break':
        return 'outline';
      default:
        return 'default';
    }
  };

  const filteredSelfies = selfies.filter(selfie => {
    const searchLower = searchTerm.toLowerCase();
    return (
      selfie.profile?.name?.toLowerCase().includes(searchLower) ||
      selfie.profile?.email?.toLowerCase().includes(searchLower) ||
      selfie.profile?.department?.toLowerCase().includes(searchLower)
    );
  });

  // Group selfies by user
  const groupedByUser = filteredSelfies.reduce((acc, selfie) => {
    const key = selfie.user_id;
    if (!acc[key]) {
      acc[key] = {
        profile: selfie.profile,
        selfies: []
      };
    }
    acc[key].selfies.push(selfie);
    return acc;
  }, {} as Record<string, { profile?: SelfieRecord['profile']; selfies: SelfieRecord[] }>);

  const totalEmployees = Object.keys(groupedByUser).length;

  // Count late selfies
  const lateSelfiesCount = filteredSelfies.filter(s => getSelfieLateness(s.selfie_type, s.captured_at).isLate).length;

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Camera className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm sm:text-base">Selfie Attendance</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {totalEmployees} employee{totalEmployees !== 1 ? 's' : ''} logged today
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="gap-1 text-xs">
            <Users className="w-3 h-3" />
            {filteredSelfies.length} selfies
          </Badge>
          {lateSelfiesCount > 0 && (
            <Badge variant="destructive" className="gap-1 text-xs">
              <AlertTriangle className="w-3 h-3" />
              {lateSelfiesCount} late
            </Badge>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search employee..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
          />
          <Button variant="outline" size="icon" onClick={() => fetchSelfiesMemoized(true)}>
            <RefreshCw className="w-4 h-4" />
          </Button>

        </div>
      </div>

      {/* Quick date filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <Button
          variant={selectedDate === format(new Date(), 'yyyy-MM-dd') ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
        >
          Today
        </Button>
        <Button
          variant={selectedDate === format(subDays(new Date(), 1), 'yyyy-MM-dd') ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedDate(format(subDays(new Date(), 1), 'yyyy-MM-dd'))}
        >
          Yesterday
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* No selfies */}
      {!isLoading && filteredSelfies.length === 0 && (
        <div className="py-12 text-center">
          <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No selfies found</h3>
          <p className="text-muted-foreground">
            No attendance selfies for {format(new Date(selectedDate), 'dd MMM yyyy')}
          </p>
        </div>
      )}

      {/* Selfies grid */}
      {!isLoading && Object.keys(groupedByUser).length > 0 && (
        <div className="space-y-4 max-h-[500px] sm:max-h-[600px] overflow-y-auto">
          {Object.entries(groupedByUser).map(([userId, data]) => {
            // Check if any selfie from this user is late
            const hasLateSelfie = data.selfies.some(s => getSelfieLateness(s.selfie_type, s.captured_at).isLate);

            return (
              <div key={userId} className={cn(
                "border rounded-lg p-3 sm:p-4",
                hasLateSelfie && "border-destructive/50 bg-destructive/5"
              )}>
                <div className="flex items-center gap-2 sm:gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate text-sm sm:text-base">{data.profile?.name || 'Unknown'}</h4>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{data.profile?.department}</p>
                      <span className="text-muted-foreground/30">•</span>
                      <div className="flex items-center gap-1 text-primary/70">
                        <MapPin className="w-2.5 h-2.5" />
                        <span className="text-[10px] sm:text-xs font-bold truncate">{(data.selfies[0] as any)?.location}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {hasLateSelfie && (
                      <Badge variant="destructive" className="text-[10px] sm:text-xs shrink-0">
                        <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                        Late
                      </Badge>
                    )}
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {data.selfies.length}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {data.selfies.map((selfie) => {
                    const { isLate, lateMinutes } = getSelfieLateness(selfie.selfie_type, selfie.captured_at);

                    return (
                      <div key={selfie.id} className="relative group">
                        <div className={cn(
                          "aspect-square rounded-lg overflow-hidden bg-muted",
                          isLate && "ring-2 ring-destructive"
                        )}>
                          <img
                            src={getSelfiePublicUrl(selfie.selfie_url)}
                            alt={`${data.profile?.name} - ${selfie.selfie_type}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const img = e.target as HTMLImageElement;
                              // Try public URL conversion as fallback
                              const publicUrl = getSelfiePublicUrl(selfie.selfie_url);
                              if (img.src !== publicUrl) {
                                img.src = publicUrl;
                              } else {
                                img.src = '/placeholder.svg';
                              }
                            }}
                          />
                        </div>

                        {/* Overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 sm:p-2 rounded-b-lg">
                          <div className="flex items-center gap-1">
                            <Badge
                              variant={getSelfieTypeBadgeVariant(selfie.selfie_type)}
                              className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0"
                            >
                              {getSelfieTypeLabel(selfie.selfie_type)}
                            </Badge>
                            {isLate && (
                              <Badge variant="destructive" className="text-[8px] sm:text-[10px] px-1 py-0">
                                +{lateMinutes}m
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-white/80 mt-0.5">
                            <Clock className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
                            {format(new Date(selfie.captured_at), 'hh:mm a')}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
