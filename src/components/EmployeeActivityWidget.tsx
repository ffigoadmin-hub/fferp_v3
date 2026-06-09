import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import {
  Users, Clock, ClipboardList, FileText,
  Loader2, CalendarIcon, Search, ChevronDown,
  CheckCircle, XCircle, Camera, Download, AlertTriangle, Filter, UserX
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useEmployeeDataExport, EmployeeExportData } from '@/hooks/useEmployeeDataExport';
import { useRealtimeAttendance } from '@/hooks/useRealtimeAttendance';
import { useAuth } from '@/contexts/AuthContext';
import { useBOILOPEntries } from '@/hooks/useBOIData';
import { DEPARTMENTS } from '@/constants/departments';
import { toast } from 'sonner';
import { getSelfiePublicUrl } from '@/utils/selfieUrl';
import { normalizeSlot, findBySlot, TIME_SLOTS, formatSlotDisplay } from '@/lib/slotHelpers';

interface EmployeeActivityWidgetProps {
  title?: string;
  filterDepartments?: string[];
}

interface EmployeeDetail extends EmployeeExportData {
  id?: string;
  hourly_plans: {
    time_slot: string;
    plan_text: string;
    submitted_at: string;
  }[];
  hourly_reports: {
    time_slot: string;
    report_text: string;
    submitted_at: string;
    is_late: boolean;
    delay_minutes: number;
  }[];
  eod_report: {
    planned_work: string;
    completed_work: string;
    pending_items: string | null;
    completion_percentage: number;
  } | null;
  selfies: {
    selfie_type: string;
    selfie_url: string;
    captured_at: string;
  }[];
  day_plan?: {
    tasks: string[];
    expected_output: string;
    dependency: string | null;
    submitted_at: string;
  } | null;
}

// Helper to parse and format report text (handles JSON format)
// Helper to parse and format report text (handles JSON format)
function formatReportText(text: string, dayPlanTasks: string[] = []): string {
  if (!text) return '';

  // Try to parse as JSON
  try {
    let parsed = JSON.parse(text);

    // Handle double-stringified JSON (common issue)
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        // failed second parse, stick with first result (which is a string, so we'll treat it as text)
      }
    }

    if (parsed && typeof parsed === 'object') {
      const parts: string[] = [];

      // Handle tasks array
      // Handle tasks array
      if (Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
        // Check if tasks are indices (numbers) and we have the reference list
        const areIndices = parsed.tasks.every((t: any) => typeof t === 'number');

        if (areIndices && dayPlanTasks && dayPlanTasks.length > 0) {
          const taskNames = parsed.tasks
            .map((idx: number) => dayPlanTasks[idx])
            .filter(Boolean);

          if (taskNames.length > 0) {
            parts.push(`Tasks: ${taskNames.join(', ')}`);
          } else {
            parts.push(`Tasks: [IDs: ${parsed.tasks.join(', ')}]`);
          }
        } else {
          // Already strings or no reference list
          parts.push(`Tasks: ${parsed.tasks.join(', ')}`);
        }
      }

      // Handle notes
      if (parsed.notes) {
        // Clean up quotes if they are embedded strings
        parts.push(String(parsed.notes).replace(/^"|"$/g, ''));
      }

      // Handle any other string values (fallback)
      if (parts.length === 0) {
        Object.entries(parsed).forEach(([key, value]) => {
          if (key !== 'tasks' && key !== 'notes' && typeof value === 'string') {
            parts.push(`${key}: ${value}`);
          }
        });
      }

      if (parts.length > 0) {
        return parts.join('\n');
      }
    }
  } catch {
    // Not JSON, return as-is
  }

  return text;
}

// TIME_SLOTS now imported from slotHelpers

export function EmployeeActivityWidget({ title = "Employee Activity Monitor", filterDepartments }: EmployeeActivityWidgetProps) {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [userTypeFilter, setUserTypeFilter] = useState<string>('all');
  const [employees, setEmployees] = useState<EmployeeExportData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [employeeDetail, setEmployeeDetail] = useState<EmployeeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showLOPModal, setShowLOPModal] = useState(false);
  const [selectedEmployeeForLOP, setSelectedEmployeeForLOP] = useState<EmployeeExportData | null>(null);
  const [lopReason, setLopReason] = useState('');
  const [lopSubmitting, setLopSubmitting] = useState(false);

  const { fetchEmployeeData, exportEmployeeDataCSV } = useEmployeeDataExport();
  const { createLOP } = useBOILOPEntries();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchEmployeeData(selectedDate);
      const filtered = filterDepartments?.length
        ? data.filter(emp => filterDepartments.some(d => emp.department?.toLowerCase().includes(d.toLowerCase())))
        : data;
      setEmployees(filtered);
    } catch (error) {
      console.error('Error loading employee data:', error);
      toast.error('Failed to load employee data');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, fetchEmployeeData, filterDepartments]);

  // Real-time subscription for attendance updates
  useRealtimeAttendance(loadData);

  useEffect(() => {
    loadData();

    // Auto-refresh every 5 minutes
    const refreshInterval = setInterval(() => {
      console.log('Auto-refreshing employee activity data...');
      loadData();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(refreshInterval);
  }, [selectedDate]);

  const fetchEmployeeDetail = async (emp: EmployeeExportData) => {
    setDetailLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      // Use user_id directly from the employee data - no need to query by name
      const userId = emp.user_id;

      if (!userId) {
        toast.error('Employee ID not found');
        return;
      }

      // Fetch regular data + shift data in parallel
      const [plansResult, reportsResult, eodResult, selfiesResult, dayPlanResult, shiftSessionResult, shiftEodResult] = await Promise.all([
        supabase.from('hourly_plans').select('*').eq('date', dateStr).eq('user_id', userId).order('time_slot'),
        supabase.from('hourly_reports').select('*').eq('date', dateStr).eq('user_id', userId).order('time_slot'),
        supabase.from('eod_reports').select('*').eq('date', dateStr).eq('user_id', userId).maybeSingle(),
        supabase.from('selfie_records').select('*').eq('date', dateStr).eq('user_id', userId).order('captured_at'),
        supabase.from('day_plans').select('*').eq('date', dateStr).eq('user_id', userId).maybeSingle(),
        (supabase.from('shift_sessions') as any).select('*').eq('date', dateStr).eq('user_id', userId).maybeSingle(),
        (supabase.from('shift_eod_reports') as any).select('*, shift_sessions!inner(user_id)').eq('shift_sessions.user_id', userId),
      ]);

      const shiftSession = shiftSessionResult.data as any;
      const isShiftUser = !!shiftSession;

      // If shift user, fetch their hourly slots from shift tables
      let shiftSlots: any[] = [];
      if (isShiftUser) {
        const { data } = await (supabase.from('shift_hourly_slots') as any)
          .select('*')
          .eq('session_id', shiftSession.id)
          .order('slot_number');
        shiftSlots = (data || []) as any[];
      }

      const shiftEod = shiftEodResult.data?.[0] || null;

      // Build detail data — shift users use shift tables, regular users use standard tables
      setEmployeeDetail({
        ...emp,
        hourly_plans: isShiftUser
          ? shiftSlots.filter(s => s.plan).map((s, i) => ({
            time_slot: `Slot ${s.slot_number || (i + 1)}`,
            plan_text: s.plan,
            submitted_at: s.plan_submitted_at || s.created_at || '',
          }))
          : ((plansResult.data || []) as any[]).map(p => ({
            time_slot: p.time_slot,
            plan_text: p.plan_text,
            submitted_at: p.submitted_at || '',
          })),
        hourly_reports: isShiftUser
          ? shiftSlots.filter(s => s.report).map((s, i) => ({
            time_slot: `Slot ${s.slot_number || (i + 1)}`,
            report_text: s.report,
            submitted_at: s.report_submitted_at || s.updated_at || '',
            is_late: false,
            delay_minutes: 0,
          }))
          : ((reportsResult.data || []) as any[]).map(r => ({
            time_slot: r.time_slot,
            report_text: r.report_text,
            submitted_at: r.submitted_at || '',
            is_late: r.is_late || false,
            delay_minutes: r.delay_minutes || 0,
          })),
        eod_report: isShiftUser
          ? (shiftEod ? {
            planned_work: shiftSession.day_plan || '',
            completed_work: shiftEod.summary || '',
            pending_items: null,
            completion_percentage: 100,
          } : null)
          : ((eodResult.data as any) ? {
            planned_work: (eodResult.data as any).planned_work,
            completed_work: (eodResult.data as any).completed_work,
            pending_items: (eodResult.data as any).pending_items,
            completion_percentage: (eodResult.data as any).completion_percentage || 0,
          } : null),
        selfies: isShiftUser
          ? [
            ...(shiftSession.login_selfie_url ? [{
              selfie_type: 'shift_login',
              selfie_url: shiftSession.login_selfie_url,
              captured_at: shiftSession.shift_start,
            }] : []),
            ...(shiftSession.logout_selfie_url ? [{
              selfie_type: 'shift_logout',
              selfie_url: shiftSession.logout_selfie_url,
              captured_at: shiftSession.shift_end || '',
            }] : []),
          ]
          : ((selfiesResult.data || []) as any[]).map(s => ({
            selfie_type: s.selfie_type,
            selfie_url: s.selfie_url,
            captured_at: s.captured_at,
          })),
        day_plan: isShiftUser
          ? (shiftSession.day_plan ? {
            tasks: [shiftSession.day_plan],
            expected_output: 'Shift mode',
            dependency: null,
            submitted_at: shiftSession.shift_start,
          } : null)
          : ((dayPlanResult.data as any) ? {
            tasks: (dayPlanResult.data as any).tasks || [],
            expected_output: (dayPlanResult.data as any).expected_output,
            dependency: (dayPlanResult.data as any).dependency,
            submitted_at: (dayPlanResult.data as any).submitted_at,
          } : (emp.day_plan_submitted === 'YES' ? {
            tasks: emp.day_plan_tasks_array || [],
            expected_output: emp.day_plan_output || '',
            dependency: emp.day_plan_dependency || null,
            submitted_at: emp.day_plan_time || '',
          } : null)),
      });
      setShowDetailModal(true);
    } catch (error) {
      console.error('Error fetching employee detail:', error);
      toast.error('Failed to load employee details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      await exportEmployeeDataCSV(selectedDate);
      toast.success('CSV exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export CSV');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Raise LOP
  const handleRaiseLOP = async (emp: EmployeeExportData) => {
    setSelectedEmployeeForLOP(emp);
    setLopReason(emp.late_login_minutes > 0 ? `Late login by ${emp.late_login_minutes} minutes` : 'Disciplinary action');
    setShowLOPModal(true);
  };

  const submitLOP = async () => {
    if (!selectedEmployeeForLOP || !lopReason.trim()) {
      toast.error('Please provide a reason for LOP');
      return;
    }

    setLopSubmitting(true);
    try {
      // Get employee ID from profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('name', selectedEmployeeForLOP.name)
        .maybeSingle();

      if (!profile) {
        toast.error('Employee not found');
        return;
      }

      await createLOP((profile as any).id, format(selectedDate, 'yyyy-MM-dd'), lopReason);
      toast.success(`LOP raised for ${selectedEmployeeForLOP.name}`);
      setShowLOPModal(false);
      setSelectedEmployeeForLOP(null);
      setLopReason('');
    } catch (error) {
      console.error('Error raising LOP:', error);
      toast.error('Failed to raise LOP');
    } finally {
      setLopSubmitting(false);
    }
  };

  // Filter employees by search, department, and status
  const filteredEmployees = employees.filter(emp => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = (
      emp.name.toLowerCase().includes(query) ||
      emp.employee_id.toLowerCase().includes(query) ||
      emp.department.toLowerCase().includes(query)
    );
    const matchesDepartment = departmentFilter === 'all' || emp.department === departmentFilter;

    // User type filter (shift vs general)
    let matchesUserType = true;
    if (userTypeFilter === 'shift') {
      matchesUserType = emp.is_shift_user === true;
    } else if (userTypeFilter === 'general') {
      matchesUserType = emp.is_shift_user !== true;
    }

    // Status filter
    let matchesStatus = true;
    if (statusFilter === 'late_login') {
      matchesStatus = emp.late_login_minutes > 0;
    } else if (statusFilter === 'absent') {
      matchesStatus = emp.login_time === 'NO LOGIN';
    } else if (statusFilter === 'logged_in') {
      matchesStatus = emp.login_time !== 'NO LOGIN';
    } else if (statusFilter === 'eod_done') {
      matchesStatus = emp.eod_submitted === 'YES';
    } else if (statusFilter === 'eod_pending') {
      matchesStatus = emp.eod_submitted !== 'YES' && emp.login_time !== 'NO LOGIN';
    }

    return matchesSearch && matchesDepartment && matchesUserType && matchesStatus;
  });

  // Stats
  const totalEmployees = filteredEmployees.length;
  const loggedInCount = filteredEmployees.filter(e => e.login_time !== 'NO LOGIN').length;
  const notLoggedInCount = filteredEmployees.filter(e => e.login_time === 'NO LOGIN').length;
  const lateLoginCount = filteredEmployees.filter(e => e.late_login_minutes > 0).length;
  const eodSubmittedCount = filteredEmployees.filter(e => e.eod_submitted === 'YES').length;

  // Get unique departments for filter
  const uniqueDepartments = [...new Set(employees.map(e => e.department))].sort();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {title}
            </CardTitle>
            <CardDescription>Complete daily activity for all employees</CardDescription>
          </div>
          <div className="flex items-center gap-3">

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Export All
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, 'MMM d, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Search, Filter & Stats */}
        <div className="mt-4 space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search by name, ID, or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {uniqueDepartments.map((dept, idx) => (
                  <SelectItem key={dept} value={dept}>{idx + 1}. {dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <Users className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All Users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="shift">🔄 Shift Users</SelectItem>
                <SelectItem value="general">💼 General Users</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <Clock className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="logged_in">✓ Logged In</SelectItem>
                <SelectItem value="absent">✗ Absent</SelectItem>
                <SelectItem value="late_login">⚠ Late Login</SelectItem>
                <SelectItem value="eod_done">✓ EOD Done</SelectItem>
                <SelectItem value="eod_pending">⏳ EOD Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-5 gap-3">
            <div className="p-3 rounded-lg bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-xl font-bold">{totalEmployees}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground">Logged In</p>
              <p className="text-xl font-bold text-status-live">{loggedInCount}</p>
            </div>
            <div className="p-3 rounded-lg bg-destructive/10 text-center relative">
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <UserX className="w-3 h-3" /> Not Logged In
              </p>
              <p className="text-xl font-bold text-destructive">{notLoggedInCount}</p>
              {notLoggedInCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full animate-pulse" />
              )}
            </div>
            <div className="p-3 rounded-lg bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground">Late Login</p>
              <p className="text-xl font-bold text-status-late">{lateLoginCount}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground">EOD Done</p>
              <p className="text-xl font-bold text-primary">{eodSubmittedCount}</p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-[600px]">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="w-[40px] text-[10px] font-black uppercase tracking-widest text-center">S.No</TableHead>
                <TableHead className="w-[200px] text-[10px] font-black uppercase tracking-widest">Employee Intelligence</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Login</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Day Plan</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Plans</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Reports</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Deviation</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">EOD</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Status</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-muted-foreground italic">
                    No active personnel match the current tactical filters
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees.map((emp, index) => {
                  const isLate = emp.late_login_minutes > 0;
                  const noLogin = emp.login_time === 'NO LOGIN';
                  const hasLateReports = emp.late_reports_count > 0;

                  return (
                    <TableRow
                      key={emp.employee_id + index}
                      className="cursor-pointer hover:bg-muted/50 transition-colors group"
                      onClick={() => fetchEmployeeDetail(emp)}
                    >
                      <TableCell className="text-center font-bold text-xs text-muted-foreground w-[40px]">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-black text-sm">{emp.name}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                            {emp.employee_id} • {emp.department}
                            {emp.is_shift_user && (
                              <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-500/15 text-blue-400 border border-blue-500/30 tracking-widest">
                                SHIFT
                              </span>
                            )}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className={cn(
                            "font-mono text-sm font-bold",
                            noLogin ? "text-status-missed" : isLate ? "text-status-late" : "text-foreground"
                          )}>
                            {emp.login_time}
                          </span>
                          {isLate && (
                            <span className="text-[10px] font-bold text-status-late uppercase tracking-tighter">+{emp.late_login_minutes}m Late</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {emp.day_plan_submitted === 'YES' ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex flex-col max-w-[150px]">
                                  <span className="text-xs font-bold text-primary flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" />
                                    Submitted
                                  </span>
                                  <span className="text-[10px] text-muted-foreground truncate italic">
                                    {emp.day_plan_tasks}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs p-4 space-y-2">
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Planned Tasks</p>
                                  <ul className="text-xs space-y-1">
                                    {String(emp.day_plan_tasks).split('; ').map((task, idx) => (
                                      <li key={idx} className="flex gap-1">
                                        <span className="text-primary">•</span>
                                        {task}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Expected Output</p>
                                  <p className="text-xs">{String(emp.day_plan_output)}</p>
                                </div>
                                {emp.day_plan_dependency && emp.day_plan_dependency !== 'N/A' && (
                                  <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Dependencies</p>
                                    <p className="text-xs">{String(emp.day_plan_dependency)}</p>
                                  </div>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-status-missed opacity-40 italic text-xs">No Plan</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "font-black text-sm",
                          emp.hourly_plans_count >= 6 ? "text-status-live" : emp.hourly_plans_count >= 3 ? "text-status-late" : "text-status-missed"
                        )}>
                          {emp.hourly_plans_count}/8
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "font-black text-sm",
                          emp.hourly_reports_count >= 6 ? "text-status-live" : emp.hourly_reports_count >= 3 ? "text-status-late" : "text-status-missed"
                        )}>
                          {emp.hourly_reports_count}/8
                        </span>
                      </TableCell>
                      <TableCell>
                        {hasLateReports ? (
                          <Badge variant="destructive" className="font-black text-[10px] px-2 py-0">
                            {emp.late_reports_count}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-black bg-status-live/10 text-status-live border-status-live/30 px-2 py-0">
                            0
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {emp.eod_submitted === 'YES' ? (
                          <CheckCircle className="w-5 h-5 text-status-live" />
                        ) : (
                          <XCircle className="w-5 h-5 text-status-missed opacity-40" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={emp.attendance_status === 'Pending' ? 'secondary' : 'outline'}
                          className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5"
                        >
                          {emp.attendance_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            fetchEmployeeDetail(emp);
                          }}
                        >
                          <ChevronDown className="w-4 h-4 text-authority-admin" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Users className="w-5 h-5" />
              {employeeDetail?.name} - {format(selectedDate, 'PPP')}
            </DialogTitle>
          </DialogHeader>

          {employeeDetail && (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Login</span>
                    </div>
                    <p className={cn(
                      "font-mono font-semibold",
                      employeeDetail.login_time === 'NO LOGIN' ? "text-status-missed" :
                        employeeDetail.late_login_minutes > 0 ? "text-status-late" : "text-foreground"
                    )}>
                      {employeeDetail.login_time}
                    </p>
                    {employeeDetail.late_login_minutes > 0 && (
                      <p className="text-xs text-status-late">+{employeeDetail.late_login_minutes}m late</p>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 mb-1">
                      <ClipboardList className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Plans</span>
                    </div>
                    <p className="font-semibold">{employeeDetail.hourly_plans_count}/8</p>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Reports</span>
                    </div>
                    <p className="font-semibold">{employeeDetail.hourly_reports_count}/8</p>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">EOD</span>
                    </div>
                    <p className={cn(
                      "font-semibold",
                      employeeDetail.eod_submitted === 'YES' ? "text-status-live" : "text-status-missed"
                    )}>
                      {employeeDetail.eod_submitted}
                    </p>
                  </div>
                </div>

                {/* Day Plan - MOVED HERE */}
                {employeeDetail.day_plan && (
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-primary" />
                      Day Plan
                      {employeeDetail.day_plan.submitted_at && (
                        <Badge variant="outline" className="ml-2 bg-primary/10 text-primary border-primary/30">
                          {format(new Date(employeeDetail.day_plan.submitted_at), 'hh:mm a')}
                        </Badge>
                      )}
                    </h4>
                    <div className="space-y-3">
                      {employeeDetail.day_plan.tasks.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Planned Tasks</p>
                          <ul className="space-y-1">
                            {employeeDetail.day_plan.tasks.map((task, idx) => (
                              <li key={idx} className="text-sm flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                <span>{task}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Expected Output</p>
                        <p className="text-sm">{employeeDetail.day_plan.expected_output}</p>
                      </div>
                      {employeeDetail.day_plan.dependency && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Dependencies</p>
                          <p className="text-sm">{employeeDetail.day_plan.dependency}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}


                {/* Selfies */}
                {employeeDetail.selfies.length > 0 && (
                  <div className="p-4 rounded-lg bg-muted/20 border border-border">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Camera className="w-4 h-4" />
                      Attendance Selfies
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      {employeeDetail.selfies.map((selfie, idx) => (
                        <div key={idx} className="relative group">
                          <img
                            src={getSelfiePublicUrl(selfie.selfie_url)}
                            alt={selfie.selfie_type}
                            className="w-full h-32 object-cover rounded-lg"
                            onError={(e) => {
                              const img = e.target as HTMLImageElement;
                              const publicUrl = getSelfiePublicUrl(selfie.selfie_url);
                              if (img.src !== publicUrl) {
                                img.src = publicUrl;
                              } else {
                                img.src = '/placeholder.svg';
                              }
                            }}
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 rounded-b-lg">
                            <p className="text-xs text-white font-medium">{selfie.selfie_type}</p>
                            <p className="text-xs text-white/70">
                              {format(new Date(selfie.captured_at), 'hh:mm a')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hourly Plans */}
                <div className="p-4 rounded-lg bg-muted/20 border border-border">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <ClipboardList className="w-4 h-4" />
                    Hourly Plans ({employeeDetail.hourly_plans.length}/{employeeDetail.hourly_plans.some(p => p.time_slot?.startsWith('Slot')) ? employeeDetail.hourly_plans.length : 8})
                  </h4>
                  {employeeDetail.hourly_plans.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hourly plans submitted</p>
                  ) : employeeDetail.hourly_plans.some(p => p.time_slot?.startsWith('Slot')) ? (
                    /* Shift user: render actual submitted slots */
                    <div className="space-y-2">
                      {employeeDetail.hourly_plans.map((plan, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg border bg-status-live/5 border-status-live/20"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-sm font-medium">{plan.time_slot}</span>
                            {plan.submitted_at && (
                              <span className="text-xs text-muted-foreground">
                                Submitted: {format(new Date(plan.submitted_at), 'hh:mm a')}
                              </span>
                            )}
                          </div>
                          <p className="text-sm whitespace-pre-wrap">
                            {formatReportText(plan.plan_text, employeeDetail.day_plan?.tasks)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Regular user: iterate over TIME_SLOTS */
                    <div className="space-y-2">
                      {TIME_SLOTS.map(slot => {
                        const plan = findBySlot(employeeDetail.hourly_plans, slot);
                        return (
                          <div
                            key={slot}
                            className={cn(
                              "p-3 rounded-lg border",
                              plan ? "bg-status-live/5 border-status-live/20" : "bg-muted/30 border-border"
                            )}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-mono text-sm font-medium">{formatSlotDisplay(slot)}</span>
                              {plan && (
                                <span className="text-xs text-muted-foreground">
                                  Submitted: {format(new Date(plan.submitted_at), 'hh:mm a')}
                                </span>
                              )}
                            </div>
                            <p className="text-sm whitespace-pre-wrap">
                              {plan ? formatReportText(plan.plan_text, employeeDetail.day_plan?.tasks) : <span className="text-muted-foreground italic">Not submitted</span>}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Hourly Reports */}
                <div className="p-4 rounded-lg bg-muted/20 border border-border">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Hourly Reports ({employeeDetail.hourly_reports.length}/{employeeDetail.hourly_reports.some(r => r.time_slot?.startsWith('Slot')) ? employeeDetail.hourly_reports.length : 8})
                    {employeeDetail.late_reports_count > 0 && (
                      <Badge variant="destructive" className="ml-2">
                        {employeeDetail.late_reports_count} late
                      </Badge>
                    )}
                  </h4>
                  {employeeDetail.hourly_reports.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hourly reports submitted</p>
                  ) : employeeDetail.hourly_reports.some(r => r.time_slot?.startsWith('Slot')) ? (
                    /* Shift user: render actual submitted slots */
                    <div className="space-y-2">
                      {employeeDetail.hourly_reports.map((report, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg border bg-status-live/5 border-status-live/20"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-sm font-medium">{report.time_slot}</span>
                            {report.submitted_at && (
                              <span className="text-xs text-muted-foreground">
                                Submitted: {format(new Date(report.submitted_at), 'hh:mm a')}
                              </span>
                            )}
                          </div>
                          <p className="text-sm whitespace-pre-wrap">
                            {formatReportText(report.report_text, employeeDetail.day_plan?.tasks)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Regular user: iterate over TIME_SLOTS */
                    <div className="space-y-2">
                      {TIME_SLOTS.map(slot => {
                        const report = findBySlot(employeeDetail.hourly_reports, slot);
                        return (
                          <div
                            key={slot}
                            className={cn(
                              "p-3 rounded-lg border",
                              report
                                ? report.is_late
                                  ? "bg-status-late/5 border-status-late/20"
                                  : "bg-status-live/5 border-status-live/20"
                                : "bg-muted/30 border-border"
                            )}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-medium">{formatSlotDisplay(slot)}</span>
                                {report?.is_late && (
                                  <Badge variant="destructive" className="text-xs">
                                    +{report.delay_minutes}m late
                                  </Badge>
                                )}
                              </div>
                              {report && (
                                <span className="text-xs text-muted-foreground">
                                  Submitted: {format(new Date(report.submitted_at), 'hh:mm a')}
                                </span>
                              )}
                            </div>
                            <p className="text-sm whitespace-pre-wrap">
                              {report ? formatReportText(report.report_text, employeeDetail.day_plan?.tasks) : <span className="text-muted-foreground italic">Not submitted</span>}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* EOD Report */}
                <div className="p-4 rounded-lg bg-muted/20 border border-border">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    EOD Report
                    {employeeDetail.eod_report && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "ml-2",
                          employeeDetail.eod_report.completion_percentage >= 80
                            ? "bg-status-live/10 text-status-live border-status-live/30"
                            : employeeDetail.eod_report.completion_percentage >= 50
                              ? "bg-status-late/10 text-status-late border-status-late/30"
                              : "bg-status-missed/10 text-status-missed border-status-missed/30"
                        )}
                      >
                        {employeeDetail.eod_report.completion_percentage}% complete
                      </Badge>
                    )}
                  </h4>
                  {employeeDetail.eod_report ? (
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Planned Work</p>
                        <p className="text-sm">{employeeDetail.eod_report.planned_work}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Completed Work</p>
                        <p className="text-sm">{employeeDetail.eod_report.completed_work}</p>
                      </div>
                      {employeeDetail.eod_report.pending_items && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Pending Items</p>
                          <p className="text-sm">{employeeDetail.eod_report.pending_items}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-status-missed">
                      <XCircle className="w-5 h-5" />
                      <span>EOD report not submitted</span>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea >
          )
          }
        </DialogContent >
      </Dialog >

      {/* Raise LOP Modal */}
      < Dialog open={showLOPModal} onOpenChange={setShowLOPModal} >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Raise LOP - Disciplinary Action
            </DialogTitle>
            <DialogDescription>
              This will create a Loss of Pay entry for the employee.
            </DialogDescription>
          </DialogHeader>

          {selectedEmployeeForLOP && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <p className="font-semibold">{selectedEmployeeForLOP.name}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedEmployeeForLOP.employee_id} • {selectedEmployeeForLOP.department}
                </p>
                <div className="mt-2 flex gap-2">
                  {selectedEmployeeForLOP.login_time === 'NO LOGIN' ? (
                    <Badge variant="destructive">No Login</Badge>
                  ) : selectedEmployeeForLOP.late_login_minutes > 0 ? (
                    <Badge variant="destructive">Late +{selectedEmployeeForLOP.late_login_minutes}m</Badge>
                  ) : null}
                  {selectedEmployeeForLOP.late_reports_count > 0 && (
                    <Badge variant="secondary">{selectedEmployeeForLOP.late_reports_count} late reports</Badge>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Reason for LOP</label>
                <Input
                  value={lopReason}
                  onChange={(e) => setLopReason(e.target.value)}
                  placeholder="Enter reason for disciplinary action..."
                />
              </div>

              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowLOPModal(false)}
                  disabled={lopSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={submitLOP}
                  disabled={lopSubmitting || !lopReason.trim()}
                >
                  {lopSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Confirm LOP
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog >
    </Card >
  );
}
