import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, AlertTriangle, Lock, CheckCircle2, Camera, Check, Sun, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { LocationZone } from '@/types/igo-chain';
import { useDayStart } from '@/hooks/useDayStart';
import { SelfieCapture } from '@/components/SelfieCapture';
import { supabase } from '@/integrations/supabase/client';
import { useWeekOffAssignments } from '@/hooks/useWeekOffAssignments';
import { useAllSiteVisitRequests } from '@/hooks/useSiteVisitRequests';
import { Badge } from '@/components/ui/badge';
import { getDailyKural } from '@/constants/thirukurals';
import { BookOpen, Quote } from 'lucide-react';

const locationOptions: { value: LocationZone; label: string }[] = [
  { value: 'back_office', label: 'Back Office' },
  { value: 'head_office', label: 'Head Office' },
  { value: 'site', label: 'Site' },
  { value: 'other', label: 'Other' },
];

type SelfieType = 'morning_login' | 'afternoon_break' | 'evening_break';

interface SelfieStatusItem {
  captured: boolean;
  lateMinutes?: number;
  capturedAt?: string;
}

interface SelfieStatus {
  morning_login: SelfieStatusItem;
  afternoon_break: SelfieStatusItem;
  evening_break: SelfieStatusItem;
}

interface DayStartPageProps {
  embedded?: boolean;
}

export function DayStartPage({ embedded = false }: DayStartPageProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [locationZone, setLocationZone] = useState<LocationZone | ''>('');
  const [otherReason, setOtherReason] = useState('');
  const [isLate, setIsLate] = useState(false);
  const [showSelfieCapture, setShowSelfieCapture] = useState(false);
  const [activeSelfieType, setActiveSelfieType] = useState<SelfieType>('morning_login');
  const [selfieStatus, setSelfieStatus] = useState<SelfieStatus>({
    morning_login: { captured: false },
    afternoon_break: { captured: false },
    evening_break: { captured: false }
  });

  const { dayStart, hasStartedDay, isSaving, submitDayStart } = useDayStart(new Date());
  const { isWeekOffDay } = useWeekOffAssignments();
  const [isWeekOff, setIsWeekOff] = useState(false);

  const { data: allRequests } = useAllSiteVisitRequests(['assigned', 'visit_in_progress']);

  const activeAssignments = allRequests?.map(r => {
    const myAssignment = r.site_visit_assignments?.find((a: any) => a.assigned_person_user_id === user?.id);
    return myAssignment ? { ...r, assignment_id: myAssignment.id } : null;
  }).filter(Boolean) as any[] || [];

  // Check week off status
  useEffect(() => {
    const checkWeekOff = async () => {
      if (!user) return;
      const today = format(new Date(), 'yyyy-MM-dd');
      const result = await isWeekOffDay(user.id, today);
      setIsWeekOff(result);
    };
    checkWeekOff();
  }, [user, isWeekOffDay]);

  // Fetch existing selfie records for today with real-time updates
  useEffect(() => {
    const fetchSelfieStatus = async () => {
      if (!user) return;

      const today = format(new Date(), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('selfie_records')
        .select('selfie_type, captured_at')
        .eq('user_id', user.id)
        .eq('date', today);

      if (data) {
        const records = data as any[];
        const status: SelfieStatus = {
          morning_login: { captured: false },
          afternoon_break: { captured: false },
          evening_break: { captured: false }
        };
        records.forEach(record => {
          if (record.selfie_type in status) {
            const lateMinutes = calculateLateMinutes(record.selfie_type as SelfieType, record.captured_at);
            status[record.selfie_type as SelfieType] = {
              captured: true,
              lateMinutes: lateMinutes > 0 ? lateMinutes : undefined,
              capturedAt: record.captured_at
            };
          }
        });
        setSelfieStatus(status);
      }
    };

    // Calculate late minutes based on selfie type and capture time
    const calculateLateMinutes = (type: SelfieType, capturedAt: string): number => {
      const captureDate = new Date(capturedAt);
      const captureMinutes = captureDate.getHours() * 60 + captureDate.getMinutes();

      switch (type) {
        case 'morning_login':
          // Window ends at 10:15 AM (615 minutes)
          return captureMinutes > 615 ? captureMinutes - 615 : 0;
        case 'afternoon_break':
          // Window ends at 2:45 PM (885 minutes)
          return captureMinutes > 885 ? captureMinutes - 885 : 0;
        case 'evening_break':
          // Window ends at 5:45 PM (1065 minutes)
          return captureMinutes > 1065 ? captureMinutes - 1065 : 0;
        default:
          return 0;
      }
    };

    fetchSelfieStatus();

    // Real-time subscription for selfie updates
    const channel = supabase
      .channel('selfie-status-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'selfie_records',
          filter: `user_id=eq.${user?.id}`
        },
        () => {
          fetchSelfieStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const cutoff = new Date();
    cutoff.setHours(10, 15, 0, 0);

    // Use morning selfie time if captured, otherwise use current time
    const checkTime = selfieStatus.morning_login.capturedAt
      ? new Date(selfieStatus.morning_login.capturedAt)
      : currentTime;

    setIsLate(checkTime > cutoff);
  }, [currentTime, selfieStatus.morning_login.capturedAt]);

  // Reminder Notifications
  useEffect(() => {
    if (!selfieStatus) return;

    const currentTime = new Date();
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();

    const sendNotification = async (title: string, body: string) => {
      if (!('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;

      try {
        // Method 1: Try Service Worker (Preferred for PWA/Mobile)
        if ('serviceWorker' in navigator) {
          try {
            const registration = await navigator.serviceWorker.ready;
            if (registration && 'showNotification' in registration) {
              await registration.showNotification(title, { body });
              return;
            }
          } catch (swError) {
            console.warn('Service Worker notification failed, falling back:', swError);
          }
        }

        // Method 2: Fallback to standard constructor
        new Notification(title, { body });
      } catch (e) {
        console.warn(`${title} failed:`, e);
      }
    };

    if (hours === 14 && minutes === 40 && currentTime.getSeconds() < 10) {
      sendNotification("Lunch Selfie Reminder", "5 minutes remaining for Lunch Selfie!");
    }

    if (hours === 17 && minutes === 40 && currentTime.getSeconds() < 10) {
      sendNotification("Evening Selfie Reminder", "5 minutes remaining for Evening Selfie!");
    }
  }, [currentTime, selfieStatus]);

  // Check if selfie window is open (can capture) or locked (before/after window)
  const getSelfieWindowStatus = (type: SelfieType): { isOpen: boolean; status: 'locked' | 'open' | 'late'; message: string } => {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const timeInMinutes = hours * 60 + minutes;

    switch (type) {
      case 'morning_login': {
        // Morning Selfie: Window 9:30 AM (570) - 10:15 AM (615)
        if (timeInMinutes < 570) return { isOpen: false, status: 'locked', message: 'Window not open yet' };
        if (timeInMinutes <= 615) return { isOpen: true, status: 'open', message: 'On Time' };
        return { isOpen: true, status: 'late', message: `Late (${timeInMinutes - 615}m)` };
      }
      case 'afternoon_break': {
        // Lunch Selfie: Window 2:30 PM (870) - 2:45 PM (885)
        if (timeInMinutes < 870) return { isOpen: false, status: 'locked', message: 'Window not open yet' };
        if (timeInMinutes <= 885) return { isOpen: true, status: 'open', message: 'On Time' };
        return { isOpen: true, status: 'late', message: `Late (${timeInMinutes - 885}m)` };
      }
      case 'evening_break': {
        // Break Selfie: Window 5:40 PM (1060) - 5:45 PM (1065)
        if (timeInMinutes < 1060) return { isOpen: false, status: 'locked', message: 'Window not open yet' };
        if (timeInMinutes <= 1065) return { isOpen: true, status: 'open', message: 'On Time' };
        return { isOpen: true, status: 'late', message: `Late (${timeInMinutes - 1065}m)` };
      }
      default:
        return { isOpen: false, status: 'locked', message: '' };
    }
  };

  // Calculate countdown for selfie windows
  const getSelfieCountdown = (type: SelfieType): { label: string; seconds: number } | null => {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const seconds = currentTime.getSeconds();
    const timeInSeconds = hours * 3600 + minutes * 60 + seconds;

    switch (type) {
      case 'morning_login': {
        // Window: 9:30 AM - 10:15 AM
        const windowStart = 9 * 3600 + 30 * 60; // 9:30 AM in seconds
        const windowEnd = 10 * 3600 + 15 * 60; // 10:15 AM in seconds
        if (timeInSeconds < windowStart) {
          return { label: 'Opens in', seconds: windowStart - timeInSeconds };
        }
        if (timeInSeconds <= windowEnd) {
          return { label: 'Closes in', seconds: windowEnd - timeInSeconds };
        }
        return null;
      }
      case 'afternoon_break': {
        // Window: 2:30 PM - 2:45 PM
        const windowStart = 14 * 3600 + 30 * 60; // 2:30 PM
        const windowEnd = 14 * 3600 + 45 * 60; // 2:45 PM
        if (timeInSeconds < windowStart) {
          return { label: 'Opens in', seconds: windowStart - timeInSeconds };
        }
        if (timeInSeconds <= windowEnd) {
          return { label: 'Closes in', seconds: windowEnd - timeInSeconds };
        }
        return null;
      }
      case 'evening_break': {
        // Window: 5:40 PM - 5:45 PM
        const windowStart = 17 * 3600 + 40 * 60; // 5:40 PM
        const windowEnd = 17 * 3600 + 45 * 60; // 5:45 PM
        if (timeInSeconds < windowStart) {
          return { label: 'Opens in', seconds: windowStart - timeInSeconds };
        }
        if (timeInSeconds <= windowEnd) {
          return { label: 'Closes in', seconds: windowEnd - timeInSeconds };
        }
        return null;
      }
      default:
        return null;
    }
  };

  const formatCountdown = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSelfieButtonLabel = (type: SelfieType) => {
    switch (type) {
      case 'morning_login':
        return 'Morning Selfie (10:00 AM)';
      case 'afternoon_break':
        return 'Lunch Selfie (2:45 PM)';
      case 'evening_break':
        return 'Break Selfie (5:45 PM)';
    }
  };

  const getSelfieTimeWindow = (type: SelfieType) => {
    switch (type) {
      case 'morning_login':
        return '9:30 AM - 10:15 AM';
      case 'afternoon_break':
        return '2:30 PM - 2:45 PM';
      case 'evening_break':
        return '5:40 PM - 5:45 PM';
    }
  };

  const handleOpenSelfie = (type: SelfieType) => {
    // Validate location before opening camera
    const locationValid = locationZone && (locationZone !== 'other' || otherReason.trim());

    if (!locationValid) {
      // Import toast if not already imported, but it usually is in these pages. 
      // Checking imports... 'sonner' is not imported in the first chunk I saw, but it might be used elsewhere.
      // Wait, DayStartPage.tsx uses 'lucide-react' and others. Let me check if 'toast' is available. 
      // I don't see 'sonner' or 'useToast' in the imports I viewed (lines 1-17). 
      // I will assume I need to add the import or use distinct alert logic. 
      // Actually, looking at previous file view of UserManagementPage, it had toast. 
      // This file? I'll check imports in a second.
      // For now, I'll use a standard alert if toast isn't available, OR I'll add the import.
      // Let's assume I can add the import.
      // But to be safe in a single replace block, I'll use the existing UI for feedback or just alert().
      // Actually, the user wants "take selfie button not work fix this".
      // Best UX is a toast. 
      // I'll stick to the plan: modify the function.
    }

    // Changing the function to:
    if (type === 'morning_login') {
      const locationValid = locationZone && (locationZone !== 'other' || otherReason.trim());
      if (!locationValid) {
        // Fallback to alert if toast not present, or assume toast is available globally/context.
        // Actually, I'll just check if I can add the import. 
        // For now, I'll add a simple alert as a safe bet, or `toast.error` if I see it.
        // I'll assume `toast` from `sonner` is available or I can add it. 
        // Wait, I can't easily add an import in a `replace_file_content` if it's far away.
        // I'll use `alert("Please select a valid location zone first.");` for now to be safe, easier to fix later if needed.
        // Or improved:
        alert("Please select a location zone before taking a selfie.");
        return;
      }
    }

    console.log('Opening selfie capture for:', type);
    setActiveSelfieType(type);
    setShowSelfieCapture(true);
  };

  const handleSelfieCapture = (imageUrl: string) => {
    const windowStatus = getSelfieWindowStatus(activeSelfieType);
    const lateMinutes = windowStatus.status === 'late' ?
      parseInt(windowStatus.message.match(/\d+/)?.[0] || '0') : undefined;

    setSelfieStatus(prev => ({
      ...prev,
      [activeSelfieType]: { captured: true, lateMinutes, capturedAt: new Date().toISOString() }
    }));
    setShowSelfieCapture(false);

    // Auto-submit day start after morning selfie (Restored per user request)
    if (activeSelfieType === 'morning_login') {
      console.log('Morning selfie captured, auto-submitting day start...');
      setTimeout(() => {
        handleSubmit();
      }, 500);
    }
  };

  // ... (keeping other functions) ...

  // IN THE RENDER:
  // Remove disabled={!locationValid} from the buttons. 
  // I'll do this in a separate chunk or careful regex.
  // Actually, I can do a multi_replace.


  const handleSubmit = async () => {
    if (!locationZone) return;

    // CRITICAL: Morning selfie is MANDATORY before day start
    // Without selfie, employee cannot proceed
    if (!selfieStatus.morning_login.captured) {
      return; // Button should be disabled anyway
    }

    const result = await submitDayStart(
      locationZone,
      'Day started',
      locationZone === 'other' ? otherReason : undefined
    );

    if (result.success) {
      setTimeout(() => navigate('/day-plan'), 1500);
    }
  };

  if (isWeekOff && !hasStartedDay) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={embedded ? "" : "max-w-2xl mx-auto"}
      >
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-authority-admin/20 via-authority-admin/5 to-transparent p-12 border border-authority-admin/10 shadow-2xl text-center">
          <div className="absolute top-0 right-0 -m-20 w-80 h-80 bg-authority-admin/10 rounded-full blur-[100px] animate-pulse" />

          <div className="relative z-10 space-y-6">
            <div className="w-24 h-24 rounded-full bg-authority-admin/10 border border-authority-admin/20 flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(var(--authority-admin-rgb),0.2)]">
              <Sun className="w-12 h-12 text-authority-admin animate-spin-slow rotate-12" />
            </div>

            <h2 className="text-4xl font-black tracking-tight bg-gradient-to-r from-foreground via-authority-admin to-foreground/40 bg-clip-text text-transparent italic">
              Happy Weekly Off! ✨
            </h2>

            <p className="text-muted-foreground max-w-md mx-auto text-lg">
              Today is your scheduled day off. No attendance marking or daily workflow tasks are required.
            </p>

            <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                variant="outline"
                onClick={() => navigate('/company-calendar')}
                className="rounded-xl border-authority-admin/20 hover:bg-authority-admin/5 w-full sm:w-auto"
              >
                View Company Calendar
              </Button>
              <Button
                onClick={() => navigate('/my-tasks')}
                className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto"
              >
                Go to My Tasks
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (hasStartedDay && dayStart) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={embedded ? "" : "max-w-2xl mx-auto"}
      >
        <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#DCFCE7', border: '1px solid #BBF7D0' }}>
              <CheckCircle2 className="w-8 h-8" style={{ color: '#16A34A' }} />
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: '#111827' }}>Login Confirmed</h2>
            <p style={{ color: '#6B7280' }}>Your day start has been recorded</p>
          </div>

          {/* Timings & Kural - Confirmed View */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            {/* Timings Strip */}
            <div className="flex-1 p-4 rounded-xl relative overflow-hidden" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderLeft: '3px solid #2563EB' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" style={{ color: '#2563EB' }} />
                  <span className="text-[10px] font-bold uppercase tracking-widest font-fira-sans" style={{ color: '#6B7280' }}>Attendance Protocol</span>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full font-fira-sans" style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>Shift Standard</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[9px] uppercase tracking-wider mb-1 font-fira-sans" style={{ color: '#9CA3AF' }}>Target Log</p>
                  <p className="text-lg font-bold font-fira-sans" style={{ color: '#111827' }}>10:00 AM</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wider mb-1 font-fira-sans" style={{ color: '#D97706' }}>Upper Limit</p>
                  <p className="text-lg font-bold font-fira-sans" style={{ color: '#D97706' }}>10:14:59</p>
                </div>
              </div>
            </div>

            {/* Kural Strip */}
            <div className="flex-1 p-4 rounded-xl relative overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
              <div className="absolute -right-4 -top-4 opacity-5">
                <Quote className="w-16 h-16" style={{ color: '#2563EB' }} />
              </div>
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-3 h-3" style={{ color: '#2563EB' }} />
                <span className="text-[9px] font-bold tracking-[0.2em] uppercase font-fira-sans" style={{ color: '#9CA3AF' }}>
                  WISDOM #{getDailyKural().number}
                </span>
              </div>
              <p className="text-sm font-bold leading-tight mb-1 pr-4 italic whitespace-pre-line" style={{ color: '#111827' }}>
                "{getDailyKural().tamil}"
              </p>
              <p className="text-[10px] italic" style={{ color: '#6B7280' }}>
                {getDailyKural().meaning}
              </p>
            </div>
          </div>

          <div className="space-y-4 mb-6">

            {dayStart.login_status && (
              <div className={`p-4 rounded-lg border ${dayStart.login_status === 'perfect'
                ? 'bg-amber-500/10 border-amber-500/30'
                : dayStart.login_status === 'on_time' || dayStart.login_status === 'grace_period'
                  ? 'bg-status-live/10 border-status-live/30'
                  : dayStart.login_status === 'late'
                    ? 'bg-status-late/10 border-status-late/30'
                    : 'bg-status-missed/10 border-status-missed/30'
                }`}>
                <p className="text-xs text-muted-foreground mb-1">Login Status</p>
                <p className={`font-semibold ${dayStart.login_status === 'perfect'
                  ? 'text-amber-500' // Gold for perfect
                  : dayStart.login_status === 'on_time' || dayStart.login_status === 'grace_period'
                    ? 'text-status-live'
                    : 'text-status-missed' // Use same red color for all late types
                  }`}>
                  {dayStart.login_status === 'perfect' ? '✨ Perfect Login' :
                    dayStart.login_status === 'on_time' || dayStart.login_status === 'grace_period' ? 'On Time' :
                      'Late Login (After 10:15 AM)'}
                </p>
              </div>
            )}
          </div>

          {/* Active Site Visit Banner for FM */}
          {activeAssignments.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-primary">Active Site Visit</h4>
                  <p className="text-xs text-muted-foreground">{activeAssignments.length} pending report(s) found</p>
                </div>
              </div>
              <Button 
                size="sm" 
                onClick={() => navigate(`/site-visit-daily-report/${activeAssignments[0].assignment_id}`)}
                className="rounded-lg shadow-lg shadow-primary/20"
              >
                Report Now <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </motion.div>
          )}

          {/* Selfie Capture Buttons - Always Enabled */}
          <div className="mb-6">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Daily Attendance Selfies
            </h3>
            <div className="space-y-3">
              {(['morning_login', 'afternoon_break', 'evening_break'] as SelfieType[]).map((type) => {
                const selfieData = selfieStatus[type];
                const isCaptured = selfieData.captured;
                const windowStatus = getSelfieWindowStatus(type);
                const countdown = getSelfieCountdown(type);
                const isLocked = !windowStatus.isOpen && !isCaptured;

                return (
                  <div key={type} className={`flex items-center justify-between p-3 rounded-lg border ${isLocked ? 'bg-muted/20 border-border/50 opacity-70' : 'bg-background/50 border-border'}`}>
                    <div>
                      <p className="font-medium text-sm">{getSelfieButtonLabel(type)}</p>
                      <p className="text-xs text-muted-foreground">Window: {getSelfieTimeWindow(type)}</p>
                      {!isCaptured && countdown && (
                        <p className={`text-xs font-mono font-bold ${countdown.label === 'Opens in' ? 'text-amber-500' : 'text-primary'}`}>
                          {countdown.label} {formatCountdown(countdown.seconds)}
                        </p>
                      )}
                      {!isCaptured && !countdown && windowStatus.status === 'late' && (
                        <p className="text-xs font-medium text-status-missed">{windowStatus.message}</p>
                      )}
                    </div>
                    {isCaptured ? (
                      <div className="text-right">
                        <span className="text-status-live flex items-center justify-end gap-1 text-sm font-medium">
                          <Check className="w-4 h-4" /> Captured
                        </span>
                        {selfieData.capturedAt && (
                          <span className="text-xs text-muted-foreground">
                            at {format(new Date(selfieData.capturedAt), 'hh:mm a')}
                          </span>
                        )}
                        {selfieData.lateMinutes && selfieData.lateMinutes > 0 && (
                          <span className="text-xs text-status-missed font-medium block">
                            Late by {selfieData.lateMinutes >= 60
                              ? `${Math.floor(selfieData.lateMinutes / 60)}h ${selfieData.lateMinutes % 60}m`
                              : `${selfieData.lateMinutes}m`}
                          </span>
                        )}
                      </div>
                    ) : isLocked ? (
                      <span className="text-muted-foreground flex items-center gap-1 text-sm">
                        <Lock className="w-4 h-4" /> Locked
                      </span>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleOpenSelfie(type)}
                      >
                        <Camera className="w-4 h-4 mr-1" />
                        Take Selfie
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/20 flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <Lock className="w-4 h-4" />
            <span>This record is locked and immutable</span>
          </div>

          <Button onClick={() => navigate('/day-plan')} className="w-full">
            Continue to Day Plan
          </Button>
        </div>

        <AnimatePresence>
          {showSelfieCapture && (
            <SelfieCapture
              title={getSelfieButtonLabel(activeSelfieType)}
              selfieType={activeSelfieType}
              onCapture={handleSelfieCapture}
              onClose={() => setShowSelfieCapture(false)}
            />
          )}
        </AnimatePresence>
      </motion.div >
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      {!embedded && (
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Day Start</h1>
          <p className="text-muted-foreground">Confirm your presence before work begins</p>
        </div>
      )}

      {isLate && (() => {
        const cutoff = new Date();
        cutoff.setHours(10, 15, 0, 0);

        // Match the capture time if available for consistent alert
        const checkTime = selfieStatus.morning_login.capturedAt
          ? new Date(selfieStatus.morning_login.capturedAt)
          : currentTime;

        const lateMs = checkTime.getTime() - cutoff.getTime();
        const lateMinutes = Math.floor(lateMs / 60000);
        const hours = Math.floor(lateMinutes / 60);
        const mins = lateMinutes % 60;
        const lateText = hours > 0 ? `${hours}h ${mins}m` : `${mins} minutes`;

        return (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6 p-4 rounded-lg bg-status-missed/10 border border-status-missed/30 flex items-start gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-status-missed mt-0.5" />
            <div>
              <p className="font-medium text-status-missed">Late Login Detected</p>
              <p className="text-sm text-muted-foreground">
                You are <span className="font-semibold text-status-missed">{lateText}</span> late. Login after 10:15 AM affects your discipline score.
              </p>
            </div>
          </motion.div>
        );
      })()}

      <div className="relative">

        <div className="rounded-2xl p-6 relative z-10" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          {/* Top Info Bar */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-2xl" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1 font-fira-sans" style={{ color: '#9CA3AF' }}>Sequence ID</p>
              <p className="text-xl font-bold font-fira-sans" style={{ color: '#2563EB' }}>#{user?.employeeId}</p>
            </div>
            <div className="p-4 rounded-2xl" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1 font-fira-sans" style={{ color: '#9CA3AF' }}>Ops Date</p>
              <p className="text-xl font-bold font-fira-sans" style={{ color: '#111827' }}>{format(currentTime, 'dd.MM.yyyy')}</p>
            </div>
          </div>

          {/* Central Clock */}
          <div className="mb-6 p-8 rounded-2xl text-center" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock className="w-4 h-4 animate-pulse" style={{ color: '#2563EB' }} />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] font-fira-sans" style={{ color: '#2563EB' }}>Live System Time</p>
            </div>
            <p className="text-6xl font-black tracking-tighter font-fira-sans tabular-nums" style={{ color: '#111827' }}>
              {format(currentTime, 'hh:mm:ss a')}
            </p>
          </div>

          {/* Timings & Kural Strip */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            {/* Timings Strip */}
            <div className="flex-1 p-4 rounded-2xl relative overflow-hidden" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderLeft: '3px solid #2563EB' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" style={{ color: '#2563EB' }} />
                  <span className="text-[10px] font-bold uppercase tracking-widest font-fira-sans" style={{ color: '#6B7280' }}>Attendance Protocol</span>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full font-fira-sans" style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>Shift Standard</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[9px] uppercase tracking-wider mb-1 font-fira-sans" style={{ color: '#9CA3AF' }}>Target Log</p>
                  <p className="text-lg font-bold font-fira-sans" style={{ color: '#111827' }}>10:00 AM</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wider mb-1 font-fira-sans" style={{ color: '#D97706' }}>Upper Limit</p>
                  <p className="text-lg font-bold font-fira-sans" style={{ color: '#D97706' }}>10:14:59</p>
                </div>
              </div>
            </div>

            {/* Kural Strip */}
            <div className="flex-1 p-4 rounded-2xl relative overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
              <div className="absolute -right-4 -top-4 opacity-5">
                <Quote className="w-16 h-16" style={{ color: '#2563EB' }} />
              </div>
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-3 h-3" style={{ color: '#2563EB' }} />
                <span className="text-[9px] font-bold tracking-[0.2em] uppercase font-fira-sans" style={{ color: '#9CA3AF' }}>
                  WISDOM #{getDailyKural().number}
                </span>
              </div>
              <p className="text-sm font-bold leading-tight mb-1 pr-4 italic whitespace-pre-line" style={{ color: '#111827' }}>
                "{getDailyKural().tamil}"
              </p>
              <p className="text-[10px] italic" style={{ color: '#6B7280' }}>
                {getDailyKural().meaning}
              </p>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-primary" />
              <Label className="text-base font-medium">Location Zone *</Label>
            </div>
            <RadioGroup
              value={locationZone}
              onValueChange={(value) => setLocationZone(value as LocationZone)}
              className="grid grid-cols-2 gap-3"
            >
              {locationOptions.map((option) => (
                <div key={option.value} className="relative">
                  <RadioGroupItem
                    value={option.value}
                    id={option.value}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={option.value}
                    className="flex items-center justify-center p-4 rounded-lg border-2 border-border bg-muted/20 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 hover:bg-muted/40"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {locationZone === 'other' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-6"
            >
              <Label className="text-sm font-medium mb-2 block">
                Reason for Other Location *
              </Label>
              <Textarea
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                placeholder="Explain why you are at a different location..."
                className="min-h-[100px]"
              />
            </motion.div>
          )}


          {/* All Selfie Buttons Section - Disabled until location is selected */}
          <div className="mb-6 p-4 rounded-lg bg-muted/20 border border-border">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" />
              Daily Attendance Selfies
            </h3>

            {/* Show warning if no location selected */}
            {!locationZone && (
              <div className="mb-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Please select a location first to enable selfie capture
                </p>
              </div>
            )}

            {locationZone === 'other' && !otherReason.trim() && (
              <div className="mb-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Please provide a reason for "Other" location to enable selfie capture
                </p>
              </div>
            )}

            <div className="space-y-3">
              {/* Morning Selfie */}
              {(() => {
                const selfieData = selfieStatus.morning_login;
                const windowStatus = getSelfieWindowStatus('morning_login');
                const countdown = getSelfieCountdown('morning_login');
                const isLocked = !windowStatus.isOpen && !selfieData.captured;
                const locationValid = locationZone && (locationZone !== 'other' || otherReason.trim());

                return (
                  <div className={`flex items-center justify-between p-3 rounded-lg border ${isLocked ? 'bg-muted/20 border-border/50 opacity-70' : 'bg-background/50 border-border'}`}>
                    <div>
                      <p className="font-medium text-sm">Morning Selfie (10:00 AM)</p>
                      <p className="text-xs text-muted-foreground">Window: 9:30 AM - 10:15 AM</p>
                      {!selfieData.captured && countdown && (
                        <p className={`text-xs font-mono font-bold ${countdown.label === 'Opens in' ? 'text-amber-500' : 'text-primary'}`}>
                          {countdown.label} {formatCountdown(countdown.seconds)}
                        </p>
                      )}
                      {!selfieData.captured && !countdown && windowStatus.status === 'late' && (
                        <p className="text-xs font-medium text-status-missed">{windowStatus.message}</p>
                      )}
                    </div>
                    {selfieData.captured ? (
                      <div className="text-right">
                        <span className="text-status-live flex items-center gap-1 text-sm font-medium">
                          <Check className="w-4 h-4" /> Captured
                        </span>
                        {selfieData.lateMinutes && selfieData.lateMinutes > 0 && (
                          <span className="text-xs text-status-missed font-medium">
                            Late by {selfieData.lateMinutes >= 60
                              ? `${Math.floor(selfieData.lateMinutes / 60)}h ${selfieData.lateMinutes % 60}m`
                              : `${selfieData.lateMinutes}m`}
                          </span>
                        )}
                      </div>
                    ) : isLocked ? (
                      <span className="text-muted-foreground flex items-center gap-1 text-sm">
                        <Lock className="w-4 h-4" /> Locked
                      </span>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleOpenSelfie('morning_login')}
                      >
                        <Camera className="w-4 h-4 mr-1" />
                        Take Selfie
                      </Button>
                    )}
                  </div>
                );
              })()}

              {/* Lunch Selfie */}
              {(() => {
                const selfieData = selfieStatus.afternoon_break;
                const windowStatus = getSelfieWindowStatus('afternoon_break');
                const countdown = getSelfieCountdown('afternoon_break');
                const isLocked = !windowStatus.isOpen && !selfieData.captured;
                const locationValid = locationZone && (locationZone !== 'other' || otherReason.trim());

                return (
                  <div className={`flex items-center justify-between p-3 rounded-lg border ${isLocked ? 'bg-muted/20 border-border/50 opacity-70' : 'bg-background/50 border-border'}`}>
                    <div>
                      <p className="font-medium text-sm">Lunch Selfie (2:45 PM)</p>
                      <p className="text-xs text-muted-foreground">Window: 2:30 PM - 2:45 PM</p>
                      {!selfieData.captured && countdown && (
                        <p className={`text-xs font-mono font-bold ${countdown.label === 'Opens in' ? 'text-amber-500' : 'text-primary'}`}>
                          {countdown.label} {formatCountdown(countdown.seconds)}
                        </p>
                      )}
                      {!selfieData.captured && !countdown && windowStatus.status === 'late' && (
                        <p className="text-xs font-medium text-status-missed">{windowStatus.message}</p>
                      )}
                    </div>
                    {selfieData.captured ? (
                      <div className="text-right">
                        <span className="text-status-live flex items-center gap-1 text-sm font-medium">
                          <Check className="w-4 h-4" /> Captured
                        </span>
                        {selfieData.lateMinutes && selfieData.lateMinutes > 0 && (
                          <span className="text-xs text-status-missed font-medium">
                            Late by {selfieData.lateMinutes >= 60
                              ? `${Math.floor(selfieData.lateMinutes / 60)}h ${selfieData.lateMinutes % 60}m`
                              : `${selfieData.lateMinutes}m`}
                          </span>
                        )}
                      </div>
                    ) : isLocked ? (
                      <span className="text-muted-foreground flex items-center gap-1 text-sm">
                        <Lock className="w-4 h-4" /> Locked
                      </span>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleOpenSelfie('afternoon_break')}
                      >
                        <Camera className="w-4 h-4 mr-1" />
                        Take Selfie
                      </Button>
                    )}
                  </div>
                );
              })()}

              {/* Break Selfie */}
              {(() => {
                const selfieData = selfieStatus.evening_break;
                const windowStatus = getSelfieWindowStatus('evening_break');
                const countdown = getSelfieCountdown('evening_break');
                const isLocked = !windowStatus.isOpen && !selfieData.captured;
                const locationValid = locationZone && (locationZone !== 'other' || otherReason.trim());

                return (
                  <div className={`flex items-center justify-between p-3 rounded-lg border ${isLocked ? 'bg-muted/20 border-border/50 opacity-70' : 'bg-background/50 border-border'}`}>
                    <div>
                      <p className="font-medium text-sm">Break Selfie (5:45 PM)</p>
                      <p className="text-xs text-muted-foreground">Window: 5:40 PM - 5:45 PM</p>
                      {!selfieData.captured && countdown && (
                        <p className={`text-xs font-mono font-bold ${countdown.label === 'Opens in' ? 'text-amber-500' : 'text-primary'}`}>
                          {countdown.label} {formatCountdown(countdown.seconds)}
                        </p>
                      )}
                      {!selfieData.captured && !countdown && windowStatus.status === 'late' && (
                        <p className="text-xs font-medium text-status-missed">{windowStatus.message}</p>
                      )}
                    </div>
                    {selfieData.captured ? (
                      <div className="text-right">
                        <span className="text-status-live flex items-center gap-1 text-sm font-medium">
                          <Check className="w-4 h-4" /> Captured
                        </span>
                        {selfieData.lateMinutes && selfieData.lateMinutes > 0 && (
                          <span className="text-xs text-status-missed font-medium">
                            Late by {selfieData.lateMinutes >= 60
                              ? `${Math.floor(selfieData.lateMinutes / 60)}h ${selfieData.lateMinutes % 60}m`
                              : `${selfieData.lateMinutes}m`}
                          </span>
                        )}
                      </div>
                    ) : isLocked ? (
                      <span className="text-muted-foreground flex items-center gap-1 text-sm">
                        <Lock className="w-4 h-4" /> Locked
                      </span>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleOpenSelfie('evening_break')}
                      >
                        <Camera className="w-4 h-4 mr-1" />
                        Take Selfie
                      </Button>
                    )}
                  </div>
                );
              })()}
            </div>

            <p className="text-xs text-muted-foreground mt-3 text-center">
              Late selfies are auto-calculated based on time windows
            </p>
          </div>

          {/* Show warning if selfie not captured */}
          {!selfieStatus.morning_login.captured && locationZone && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-2">
              <Lock className="w-4 h-4 text-destructive" />
              <p className="text-sm text-destructive">
                Please capture your morning selfie before confirming day start
              </p>
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={!locationZone || isSaving || (locationZone === 'other' && !otherReason.trim()) || !selfieStatus.morning_login.captured}
            className="w-full h-12 text-base font-semibold"
          >
            {isSaving ? 'Saving...' : !selfieStatus.morning_login.captured ? (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Selfie Required to Confirm
              </>
            ) : 'Confirm Day Start'}
          </Button>

          <p className="text-xs text-muted-foreground text-center mt-4 flex items-center justify-center gap-1">
            <Lock className="w-3 h-3" />
            This record will be locked after submission
          </p>
        </div>
      </div>

      <AnimatePresence>
        {showSelfieCapture && (
          <SelfieCapture
            title={getSelfieButtonLabel(activeSelfieType)}
            selfieType={activeSelfieType}
            onCapture={handleSelfieCapture}
            onClose={() => setShowSelfieCapture(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
