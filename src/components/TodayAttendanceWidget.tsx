import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Users, Clock, CheckCircle, UserX, Loader2, Briefcase, Timer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useRealtimeAttendance } from '@/hooks/useRealtimeAttendance';

interface GroupStats {
  totalActive: number;
  present: number;
  late: number;
  absent: number;
}

interface AttendanceData {
  general: GroupStats;
  shift: GroupStats;
}

const emptyStats: GroupStats = { totalActive: 0, present: 0, late: 0, absent: 0 };

export function TodayAttendanceWidget() {
  const [data, setData] = useState<AttendanceData>({ general: { ...emptyStats }, shift: { ...emptyStats } });
  const [isLoading, setIsLoading] = useState(true);
  const today = format(new Date(), 'yyyy-MM-dd');

  const fetchAttendance = async () => {
    try {
      // Fetch all active staff
      const { data: employees, error: empError } = await supabase
        .from('profiles')
        .select('id, name, email, department, role')
        .eq('is_active', true)
        .not('role', 'ilike', '%ceo%')
        .not('role', 'ilike', '%auditor%');

      if (empError) throw empError;

      // Fetch active shift user assignments
      const { data: shiftAssignments, error: shiftError } = await (supabase
        .from('shift_user_assignments') as any)
        .select('user_id')
        .eq('is_active', true);

      if (shiftError) throw shiftError;

      const shiftUserIds = new Set((shiftAssignments || []).map((s: any) => s.user_id));

      // Split employees
      const generalEmployees = (employees || []).filter(e => !shiftUserIds.has(e.id));
      const shiftEmployees = (employees || []).filter(e => shiftUserIds.has(e.id));

      // Fetch morning login selfies
      const { data: selfies, error: selfieError } = await supabase
        .from('selfie_records')
        .select('user_id, captured_at')
        .eq('date', today)
        .eq('selfie_type', 'morning_login');

      if (selfieError) throw selfieError;

      // Fetch HR attestations
      const { data: attestations, error: attError } = await supabase
        .from('hr_attestations')
        .select('employee_id, status')
        .eq('date', today);

      if (attError) throw attError;

      const calcStats = (empList: typeof employees): GroupStats => {
        if (!empList || empList.length === 0) return { ...emptyStats };

        const empIds = new Set(empList.map(e => e.id));
        const absentIds = new Set(
          (attestations || []).filter(a => a.status === 'Absent' && empIds.has(a.employee_id)).map(a => a.employee_id)
        );

        let present = 0;
        let late = 0;

        (selfies || []).forEach(selfie => {
          if (!empIds.has(selfie.user_id)) return;
          if (selfie.captured_at) {
            present++;
            const loginTime = new Date(selfie.captured_at);
            const utcH = loginTime.getUTCHours();
            const utcM = loginTime.getUTCMinutes();
            let istM = utcM + 30;
            let istH = utcH + 5;
            if (istM >= 60) { istH++; istM -= 60; }
            if (istH >= 24) istH -= 24;
            if (istH > 10 || (istH === 10 && istM > 15)) late++;
          }
        });

        return {
          totalActive: empList.length,
          present,
          late,
          absent: absentIds.size,
        };
      };

      setData({
        general: calcStats(generalEmployees),
        shift: calcStats(shiftEmployees),
      });
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMemoized = useCallback(fetchAttendance, [today]);
  const fetchRealtime = useCallback(() => { fetchMemoized(); }, [fetchMemoized]);

  useRealtimeAttendance(fetchRealtime);

  useEffect(() => {
    fetchMemoized();
    const interval = setInterval(() => fetchMemoized(), 60000);
    return () => clearInterval(interval);
  }, [today, fetchMemoized]);

  if (isLoading) {
    return (
      <div className="authority-card">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const currentDate = format(new Date(), 'MMM d, yyyy');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="authority-card"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-base sm:text-lg">Today's Attendance</h3>
            <p className="text-xs text-muted-foreground">{currentDate}</p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs">
          Live
          <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-status-live animate-pulse" />
        </Badge>
      </div>

      {/* General Users Section */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Briefcase className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-blue-400">General Users</span>
        </div>
        <StatsGrid stats={data.general} />
      </div>

      {/* Shift Users Section */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center gap-2 mb-2">
          <Timer className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-amber-400">Shift Users</span>
        </div>
        <StatsGrid stats={data.shift} />
      </div>
    </motion.div>
  );
}

function StatsGrid({ stats }: { stats: GroupStats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="p-3 rounded-lg bg-muted/30 border border-border text-center">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <Users className="w-4 h-4 text-primary" />
        </div>
        <p className="text-2xl font-bold">{stats.totalActive}</p>
        <p className="text-[10px] sm:text-xs text-muted-foreground">Total Active</p>
      </div>

      <div className="p-3 rounded-lg bg-status-live/10 border border-status-live/30 text-center">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <CheckCircle className="w-4 h-4 text-status-live" />
        </div>
        <p className="text-2xl font-bold text-status-live">{stats.present}</p>
        <p className="text-[10px] sm:text-xs text-muted-foreground">Present</p>
      </div>

      <div className="p-3 rounded-lg bg-status-late/10 border border-status-late/30 text-center">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <Clock className="w-4 h-4 text-status-late" />
        </div>
        <p className="text-2xl font-bold text-status-late">{stats.late}</p>
        <p className="text-[10px] sm:text-xs text-muted-foreground">Late</p>
      </div>

      <div className="p-3 rounded-lg bg-status-missed/10 border border-status-missed/30 text-center">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <UserX className="w-4 h-4 text-status-missed" />
        </div>
        <p className="text-2xl font-bold text-status-missed">{stats.absent}</p>
        <p className="text-[10px] sm:text-xs text-muted-foreground">Absent</p>
      </div>
    </div>
  );
}
