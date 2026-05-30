import { isMissingTable } from '@/lib/supabase-error-guard';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight, Loader2, Download, FileSpreadsheet, X, Clock, AlertTriangle, CheckCircle, User, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, getDay, addMonths, subMonths, isFuture, isWeekend } from 'date-fns';
import { cn } from '@/lib/utils';
import { exportToCSV, exportToPDF } from '@/lib/exportUtils';
import { toast } from 'sonner';

interface AttendanceDay {
  date: string;
  employees: {
    id: string;
    name: string;
    loginTime: string | null;
    isLate: boolean;
    lateMinutes: number;
    hasEod: boolean;
    eodTime: string | null;
    slotsFilled: number;
    lateReports: number;
  }[];
  absentEmployees: {
    id: string;
    name: string;
  }[];
  presentCount: number;
  lateCount: number;
  absentCount: number;
  isFutureDay: boolean;
  isWeekendDay: boolean;
}

type FilterType = 'all' | 'late' | 'absent';

export function AttendanceCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<AttendanceDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<AttendanceDay | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch ALL active employees (not just role='employee') for accurate tracking
      const { data: empData, error: empError } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (empError) throw empError;
      setEmployees(empData || []);

      const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

      let dayStartsQuery = supabase
        .from('day_starts')
        .select('*, profiles!day_starts_user_id_fkey(name)')
        .gte('date', monthStart)
        .lte('date', monthEnd);

      let eodQuery = supabase
        .from('eod_reports')
        .select('user_id, date, submitted_at')
        .gte('date', monthStart)
        .lte('date', monthEnd);

      let hourlyQuery = supabase
        .from('hourly_reports')
        .select('user_id, date, is_late, delay_minutes')
        .gte('date', monthStart)
        .lte('date', monthEnd);

      // Fetch HR attestations for absences
      let attestationsQuery = supabase
        .from('hr_attestations')
        .select('employee_id, date, status')
        .gte('date', monthStart)
        .lte('date', monthEnd);

      if (selectedEmployee !== 'all') {
        dayStartsQuery = dayStartsQuery.eq('user_id', selectedEmployee);
        eodQuery = eodQuery.eq('user_id', selectedEmployee);
        hourlyQuery = hourlyQuery.eq('user_id', selectedEmployee);
        attestationsQuery = attestationsQuery.eq('employee_id', selectedEmployee);
      }

      const [dayStarts, eodReports, hourlyReports, attestations] = await Promise.all([
        dayStartsQuery,
        eodQuery,
        hourlyQuery,
        attestationsQuery,
      ]);

      if (dayStarts.error) throw dayStarts.error;
      if (eodReports.error) throw eodReports.error;
      if (hourlyReports.error) throw hourlyReports.error;
      if (attestations.error) throw attestations.error;

      // Group by date
      const daysInMonth = eachDayOfInterval({
        start: startOfMonth(currentMonth),
        end: endOfMonth(currentMonth),
      });

      const attendanceByDate: AttendanceDay[] = daysInMonth.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayLogins = dayStarts.data?.filter(ds => ds.date === dateStr) || [];
        const dayEods = eodReports.data?.filter(e => e.date === dateStr) || [];
        const dayHourly = hourlyReports.data?.filter(h => h.date === dateStr) || [];
        const dayAttestations = attestations.data?.filter(a => a.date === dateStr) || [];

        const isFutureDay = isFuture(day);
        const isWeekendDay = isWeekend(day);

        const employeesList = dayLogins.map(login => {
          const loginTime = login.submitted_at ? format(new Date(login.submitted_at), 'HH:mm') : null;
          // Login after 10:15 is late
          const isLate = loginTime ? loginTime > '10:15' : false;
          let lateMinutes = 0;
          if (isLate && loginTime) {
            const [h, m] = loginTime.split(':').map(Number);
            const loginMinutes = h * 60 + m;
            const cutoffMinutes = 10 * 60 + 15; // 10:15
            lateMinutes = loginMinutes - cutoffMinutes;
          }

          const eodRecord = dayEods.find(e => e.user_id === login.user_id);
          const hasEod = !!eodRecord;
          const eodTime = eodRecord?.submitted_at ? format(new Date(eodRecord.submitted_at), 'HH:mm') : null;

          const userHourly = dayHourly.filter(h => h.user_id === login.user_id);
          const slotsFilled = userHourly.length;
          const lateReports = userHourly.filter(h => h.is_late).length;

          return {
            id: login.user_id,
            name: (login.profiles as any)?.name || 'Unknown',
            loginTime,
            isLate,
            lateMinutes,
            hasEod,
            eodTime,
            slotsFilled,
            lateReports,
          };
        });

        // Get absent employees from HR attestations
        const absentEmployeeIds = dayAttestations
          .filter(a => a.status === 'Absent')
          .map(a => a.employee_id);

        const absentEmployees = (empData || [])
          .filter(emp => absentEmployeeIds.includes(emp.id))
          .map(emp => ({ id: emp.id, name: emp.name }));

        return {
          date: dateStr,
          employees: employeesList,
          absentEmployees,
          presentCount: dayLogins.length,
          lateCount: employeesList.filter(e => e.isLate).length,
          absentCount: absentEmployees.length,
          isFutureDay,
          isWeekendDay,
        };
      });

      setAttendanceData(attendanceByDate);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      if (!isMissingTable(error)) toast.error('Failed to fetch attendance data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentMonth, selectedEmployee]);

  // Real-time subscriptions
  useEffect(() => {
    const dayStartsChannel = supabase
      .channel('calendar-day-starts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'day_starts' },
        () => fetchData()
      )
      .subscribe();

    const attestationsChannel = supabase
      .channel('calendar-attestations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hr_attestations' },
        () => fetchData()
      )
      .subscribe();

    const hourlyChannel = supabase
      .channel('calendar-hourly')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hourly_reports' },
        () => fetchData()
      )
      .subscribe();

    const eodChannel = supabase
      .channel('calendar-eod')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'eod_reports' },
        () => fetchData()
      )
      .subscribe();

    const selfieChannel = supabase
      .channel('calendar-selfies')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'selfie_records' },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(dayStartsChannel);
      supabase.removeChannel(attestationsChannel);
      supabase.removeChannel(hourlyChannel);
      supabase.removeChannel(eodChannel);
      supabase.removeChannel(selfieChannel);
    };
  }, [currentMonth, selectedEmployee]);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const firstDayOfMonth = getDay(startOfMonth(currentMonth));

  // Filter attendance data based on filterType
  const getFilteredData = () => {
    return attendanceData.map(day => {
      if (filterType === 'late') {
        return {
          ...day,
          employees: day.employees.filter(e => e.isLate),
          presentCount: day.employees.filter(e => e.isLate).length,
        };
      }
      if (filterType === 'absent') {
        return {
          ...day,
          employees: [],
          presentCount: 0,
        };
      }
      return day;
    });
  };

  const filteredData = getFilteredData();

  const getDateColor = (day: AttendanceDay) => {
    if (day.isFutureDay || day.isWeekendDay) return 'bg-muted/20 border-muted/30';

    if (filterType === 'late') {
      if (day.lateCount === 0) return 'bg-muted/30';
      if (day.lateCount >= 3) return 'bg-status-missed/20 border-status-missed/40';
      return 'bg-status-late/20 border-status-late/40';
    }

    if (filterType === 'absent') {
      if (day.absentCount === 0) return 'bg-muted/30';
      if (day.absentCount >= 3) return 'bg-status-missed/20 border-status-missed/40';
      return 'bg-status-late/20 border-status-late/40';
    }

    if (day.presentCount === 0) return 'bg-muted/30';
    const presentRatio = day.presentCount / (employees?.length || 1);
    if (presentRatio >= 0.9) return 'bg-status-live/20 border-status-live/40';
    if (presentRatio >= 0.7) return 'bg-status-late/20 border-status-late/40';
    return 'bg-status-missed/20 border-status-missed/40';
  };

  const handleDayClick = (day: AttendanceDay) => {
    if (day.isFutureDay) return;
    setSelectedDay(day);
    setIsDialogOpen(true);
  };

  // Export handlers
  const handleExportCSV = () => {
    if (!attendanceData) return;

    const exportData: Record<string, unknown>[] = [];

    attendanceData.forEach(day => {
      if (day.isFutureDay || day.isWeekendDay) return;

      day.employees.forEach(emp => {
        exportData.push({
          date: day.date,
          employeeName: emp.name,
          status: emp.isLate ? 'Late' : 'Present',
          loginTime: emp.loginTime || '-',
          lateMinutes: emp.lateMinutes > 0 ? emp.lateMinutes : 0,
          slotsFilled: emp.slotsFilled,
          lateReports: emp.lateReports,
          eodSubmitted: emp.hasEod ? 'Yes' : 'No',
          eodTime: emp.eodTime || '-',
        });
      });

      day.absentEmployees.forEach(emp => {
        exportData.push({
          date: day.date,
          employeeName: emp.name,
          status: 'Absent',
          loginTime: '-',
          lateMinutes: '-',
          slotsFilled: 0,
          lateReports: 0,
          eodSubmitted: 'No',
          eodTime: '-',
        });
      });
    });

    exportToCSV(exportData, `attendance-${format(currentMonth, 'yyyy-MM')}`, [
      { key: 'date', label: 'Date' },
      { key: 'employeeName', label: 'Employee Name' },
      { key: 'status', label: 'Status' },
      { key: 'loginTime', label: 'Login Time' },
      { key: 'lateMinutes', label: 'Late by (mins)' },
      { key: 'slotsFilled', label: 'Hourly Reports' },
      { key: 'lateReports', label: 'Late Reports' },
      { key: 'eodSubmitted', label: 'EOD Submitted' },
      { key: 'eodTime', label: 'EOD Time' },
    ]);
    toast.success('CSV exported successfully');
  };

  const handleExportPDF = () => {
    if (!attendanceData) return;

    const exportData: Record<string, unknown>[] = [];

    attendanceData.forEach(day => {
      if (day.isFutureDay || day.isWeekendDay) return;

      day.employees.forEach(emp => {
        exportData.push({
          date: day.date,
          employeeName: emp.name,
          status: emp.isLate ? 'Late' : 'Present',
          loginTime: emp.loginTime || '-',
          lateMinutes: emp.lateMinutes > 0 ? emp.lateMinutes : 0,
          slotsFilled: emp.slotsFilled,
          lateReports: emp.lateReports,
          eodSubmitted: emp.hasEod ? 'Yes' : 'No',
          eodTime: emp.eodTime || '-',
        });
      });

      day.absentEmployees.forEach(emp => {
        exportData.push({
          date: day.date,
          employeeName: emp.name,
          status: 'Absent',
          loginTime: '-',
          lateMinutes: '-',
          slotsFilled: 0,
          lateReports: 0,
          eodSubmitted: 'No',
          eodTime: '-',
        });
      });
    });

    exportToPDF(
      exportData,
      `attendance-${format(currentMonth, 'yyyy-MM')}`,
      `Attendance Report - ${format(currentMonth, 'MMMM yyyy')}`,
      [
        { key: 'date', label: 'Date' },
        { key: 'employeeName', label: 'Employee' },
        { key: 'status', label: 'Status' },
        { key: 'loginTime', label: 'Login' },
        { key: 'lateMinutes', label: 'Late (mins)' },
        { key: 'slotsFilled', label: 'Reports' },
        { key: 'lateReports', label: 'Late Reports' },
        { key: 'eodSubmitted', label: 'EOD' },
        { key: 'eodTime', label: 'EOD Time' },
      ]
    );
    toast.success('PDF export opened');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center">
            <Calendar className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold mb-1">Attendance Calendar</h1>
            <p className="text-muted-foreground">Daily login patterns and compliance overview</p>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExportCSV()}
            disabled={!attendanceData || attendanceData.length === 0}
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExportPDF()}
            disabled={!attendanceData || attendanceData.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-lg font-semibold min-w-[150px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter by type */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filterType} onValueChange={(v: FilterType) => setFilterType(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Records</SelectItem>
                <SelectItem value="late">Late Logins</SelectItem>
                <SelectItem value="absent">Absences Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filter by employee */}
          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees?.map(emp => (
                <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm">
        {filterType === 'all' && (
          <>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-status-live/20 border border-status-live/40" />
              <span>High Attendance (≥90%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-status-late/20 border border-status-late/40" />
              <span>Medium (70-90%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-status-missed/20 border border-status-missed/40" />
              <span>Low (&lt;70%)</span>
            </div>
          </>
        )}
        {filterType === 'late' && (
          <>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-muted/30" />
              <span>No Late Logins</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-status-late/20 border border-status-late/40" />
              <span>1-2 Late</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-status-missed/20 border border-status-missed/40" />
              <span>3+ Late</span>
            </div>
          </>
        )}
        {filterType === 'absent' && (
          <>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-muted/30" />
              <span>No Absences</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-status-late/20 border border-status-late/40" />
              <span>1-2 Absent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-status-missed/20 border border-status-missed/40" />
              <span>3+ Absent</span>
            </div>
          </>
        )}
      </div>

      {/* Calendar Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="authority-card">
          {/* Week headers */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {weekDays.map(day => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-2">
            {/* Empty cells for days before month start */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {/* Actual days */}
            {filteredData?.map((day, index) => {
              const originalDay = attendanceData.find(d => d.date === day.date);
              const date = new Date(day.date);
              const isCurrentDay = isToday(date);

              return (
                <motion.div
                  key={day.date}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.01 }}
                  onClick={() => originalDay && handleDayClick(originalDay)}
                  className={cn(
                    'aspect-square p-2 rounded-lg border cursor-pointer transition-all hover:scale-105',
                    getDateColor(originalDay || day),
                    isCurrentDay && 'ring-2 ring-primary',
                    day.isFutureDay && 'cursor-not-allowed opacity-50'
                  )}
                >
                  <div className="h-full flex flex-col">
                    <span className={cn(
                      'text-sm font-medium',
                      isCurrentDay && 'text-primary'
                    )}>
                      {format(date, 'd')}
                    </span>
                    <div className="flex-1 flex flex-col justify-end text-xs">
                      {filterType === 'all' && (
                        <>
                          <span className="text-status-live">{day.presentCount} ✓</span>
                          {day.lateCount > 0 && (
                            <span className="text-status-late">{day.lateCount} late</span>
                          )}
                        </>
                      )}
                      {filterType === 'late' && (
                        <span className="text-status-late">
                          {originalDay?.lateCount || 0} late
                        </span>
                      )}
                      {filterType === 'absent' && (
                        <span className="text-status-missed">
                          {originalDay?.absentCount || 0} absent
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}


      {/* Daily Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {selectedDay && format(new Date(selectedDay.date), 'EEEE, MMMM d, yyyy')}
            </DialogTitle>
          </DialogHeader>

          {selectedDay && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-status-live/10 border border-status-live/20 text-center">
                  <p className="text-2xl font-bold text-status-live">{selectedDay.presentCount}</p>
                  <p className="text-sm text-muted-foreground">Present</p>
                </div>
                <div className="p-4 rounded-lg bg-status-late/10 border border-status-late/20 text-center">
                  <p className="text-2xl font-bold text-status-late">{selectedDay.lateCount}</p>
                  <p className="text-sm text-muted-foreground">Late</p>
                </div>
                <div className="p-4 rounded-lg bg-status-missed/10 border border-status-missed/20 text-center">
                  <p className="text-2xl font-bold text-status-missed">{selectedDay.absentCount}</p>
                  <p className="text-sm text-muted-foreground">Absent</p>
                </div>
              </div>

              {/* Present Employees */}
              {selectedDay.employees.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-status-live" />
                    Present Employees ({selectedDay.employees.length})
                  </h3>
                  <div className="space-y-2">
                    {selectedDay.employees.map(emp => (
                      <div
                        key={emp.id}
                        className={cn(
                          'p-3 rounded-lg border flex items-center justify-between',
                          emp.isLate ? 'bg-status-late/5 border-status-late/20' : 'bg-status-live/5 border-status-live/20'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{emp.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              Login: {emp.loginTime || 'N/A'}
                              {emp.isLate && (
                                <Badge variant="outline" className="text-status-late border-status-late/30">
                                  Late by {emp.lateMinutes} min
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Reports:</span>
                            <span className="font-medium">{emp.slotsFilled}/8</span>
                            {emp.lateReports > 0 && (
                              <Badge variant="outline" className="text-status-late border-status-late/30">
                                {emp.lateReports} late
                              </Badge>
                            )}
                          </div>
                          {emp.hasEod && (
                            <div className="flex items-center gap-1 text-xs mt-1">
                              <span className="text-status-live flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                EOD: {emp.eodTime}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Absent Employees */}
              {selectedDay.absentEmployees.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-status-missed" />
                    Absent Employees ({selectedDay.absentEmployees.length})
                  </h3>
                  <div className="space-y-2">
                    {selectedDay.absentEmployees.map(emp => (
                      <div
                        key={emp.id}
                        className="p-3 rounded-lg border bg-status-missed/5 border-status-missed/20 flex items-center gap-3"
                      >
                        <div className="w-8 h-8 rounded-full bg-status-missed/20 flex items-center justify-center">
                          <User className="w-4 h-4 text-status-missed" />
                        </div>
                        <div>
                          <p className="font-medium">{emp.name}</p>
                          <p className="text-xs text-muted-foreground">Marked absent by HR</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No records */}
              {selectedDay.employees.length === 0 && selectedDay.absentEmployees.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No attendance records for this day</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
