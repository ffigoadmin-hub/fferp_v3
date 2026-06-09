import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Users, UserCheck, Clock, UserX, Loader2, AlertTriangle, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useRealtimeAttendance } from '@/hooks/useRealtimeAttendance';


interface AttendanceStats {
  totalActive: number;
  present: number;
  late: number;
  absent: number;
  notLoggedIn: number;
}

export function AttendanceStatsWidget() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [stats, setStats] = useState<AttendanceStats>({
    totalActive: 0,
    present: 0,
    late: 0,
    absent: 0,
    notLoggedIn: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async (isInitial = true) => {
    try {
      if (isInitial) setIsLoading(true);
      // Get total active employees (exclude CEO role from tracking)
      const { data: activeEmployees, error: empError } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_active', true)
        .not('role', 'ilike', '%ceo%')
        .not('role', 'ilike', '%auditor%')
        .returns<{ id: string }[]>();


      if (empError) throw empError;

      const totalActive = activeEmployees?.length || 0;
      const employeeIds = activeEmployees?.map(e => e.id) || [];

      // Get HR attestations for selected date (for absent marking)
      const { data: attestations, error: attestError } = await supabase
        .from('hr_attestations')
        .select('employee_id, status')
        .eq('date', selectedDate)
        .returns<{ employee_id: string; status: string }[]>();

      if (attestError) throw attestError;

      // Get morning login selfies for selected date (actual login = selfie capture)
      const { data: morningLoginSelfies, error: selfieError } = await supabase
        .from('selfie_records')
        .select('user_id, captured_at')
        .eq('date', selectedDate)
        .eq('selfie_type', 'morning_login')
        .returns<{ user_id: string; captured_at: string }[]>();

      if (selfieError) throw selfieError;

      // Get week-off assignments for today to exclude from attendance tracking
      const { data: weekOffAssignments, error: weekOffError } = await supabase
        .from('week_off_assignments')
        .select('employee_id, assignment_type, week_off_date, recurring_day')
        .eq('is_active', true)
        .returns<{ employee_id: string; assignment_type: string; week_off_date: string | null; recurring_day: number | null }[]>();

      if (weekOffError) throw weekOffError;

      // Calculate which employees are on week-off today
      const todayDay = new Date(selectedDate).getDay();
      const weekOffIds = new Set(
        weekOffAssignments?.filter(wo => {
          if (wo.assignment_type === 'one_time') return wo.week_off_date === selectedDate;
          if (wo.assignment_type === 'recurring_weekly') return wo.recurring_day === todayDay;
          return false;
        }).map(wo => wo.employee_id) || []
      );

      // Absent = HR marked as Absent
      const absentAttestation = attestations?.filter(a => a.status === 'Absent').length || 0;

      // Calculate late logins based on selfie capture time (after 10:15 AM IST)
      let presentCount = 0;
      let lateCount = 0;

      morningLoginSelfies?.forEach(selfie => {
        if (!selfie.captured_at) return;
        presentCount++;

        const loginTime = new Date(selfie.captured_at);
        // Convert to IST: UTC + 5:30
        const utcHours = loginTime.getUTCHours();
        const utcMinutes = loginTime.getUTCMinutes();
        let istMinutes = utcMinutes + 30;
        let istHours = utcHours + 5;
        if (istMinutes >= 60) {
          istHours += 1;
          istMinutes -= 60;
        }
        if (istHours >= 24) istHours -= 24;
        // Late if after 10:15 AM IST
        if (istHours > 10 || (istHours === 10 && istMinutes > 15)) {
          lateCount++;
        }
      });

      // Not logged in = total - (those who have selfies or marked absent or on week-off)
      const loggedInIds = new Set(morningLoginSelfies?.map(s => s.user_id) || []);
      const absentIds = new Set(
        attestations?.filter(a => a.status === 'Absent').map(a => a.employee_id) || []
      );

      // Employees with no login, not marked absent, and NOT on week-off
      const notLoggedIn = employeeIds.filter(id =>
        !loggedInIds.has(id) && !absentIds.has(id) && !weekOffIds.has(id)
      ).length;

      setStats({
        totalActive,
        present: presentCount,
        late: lateCount,
        absent: absentAttestation,
        notLoggedIn,
      });
    } catch (error) {
      console.error('Error fetching attendance stats:', error);
    } finally {
      if (isInitial) setIsLoading(false);
    }
  };

  const fetchStatsMemoized = useCallback(fetchStats, [selectedDate]);

  const fetchStatsRealtime = useCallback(() => {
    fetchStatsMemoized(false);
  }, [fetchStatsMemoized]);

  // Use centralized real-time attendance hook
  useRealtimeAttendance(fetchStatsRealtime);


  useEffect(() => {
    fetchStatsMemoized(true);
    // Refresh every minute as a fallback
    const interval = setInterval(() => fetchStatsMemoized(false), 60000);
    return () => clearInterval(interval);
  }, [selectedDate, fetchStatsMemoized]);



  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const statItems = [
    {
      label: 'Total Active',
      value: stats.totalActive,
      icon: Users,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Present',
      value: stats.present,
      icon: UserCheck,
      color: 'text-status-live',
      bg: 'bg-status-live/10',
    },
    {
      label: 'Late',
      value: stats.late,
      icon: Clock,
      color: 'text-status-late',
      bg: 'bg-status-late/10',
    },
    {
      label: 'Absent',
      value: stats.absent,
      icon: UserX,
      color: 'text-destructive',
      bg: 'bg-destructive/10',
    },
  ];

  const formattedDisplayDate = format(new Date(selectedDate), 'EEEE, MMMM d, yyyy');
  const isToday = selectedDate === format(new Date(), 'yyyy-MM-dd');

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            Attendance
            {isToday && (
              <Badge variant="outline" className="ml-2 text-xs">
                Live
                <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-status-live animate-pulse" />
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-auto h-8 text-sm"
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{formattedDisplayDate}</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4">
          {statItems.map((item) => (
            <div
              key={item.label}
              className={`flex flex-col items-center p-4 rounded-lg ${item.bg}`}
            >
              <item.icon className={`w-6 h-6 ${item.color} mb-2`} />
              <span className="text-2xl font-bold">{item.value}</span>
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
        {stats.notLoggedIn > 0 && (
          <div className="mt-3 flex items-center justify-center gap-2 text-sm text-status-late">
            <AlertTriangle className="w-4 h-4" />
            <span>{stats.notLoggedIn} employee{stats.notLoggedIn > 1 ? 's' : ''} pending review</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
