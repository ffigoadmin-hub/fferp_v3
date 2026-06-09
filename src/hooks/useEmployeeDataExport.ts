import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { exportToCSV, exportToPDF } from '@/lib/exportUtils';

export interface EmployeeExportData {
  [key: string]: unknown;
  user_id: string; // Actual UUID from profiles table
  name: string;
  role: string;
  employee_id: string;
  department: string;
  date: string;
  login_time: string;
  late_login_minutes: number;
  location_zone: string;
  selfie_url: string;
  day_plan_submitted: string;
  day_plan_tasks: string;
  day_plan_tasks_array?: string[];
  day_plan_output?: string;
  day_plan_dependency?: string;
  day_plan_time?: string;
  hourly_plans_count: number;
  hourly_reports_count: number;
  late_reports_count: number;
  eod_submitted: string;
  eod_completion_percentage: number;
  attendance_status: string;
  is_shift_user: boolean;
  hourly_plans?: { time_slot: string; plan_text: string }[];
  hourly_reports?: { time_slot: string; report_text: string; is_late: boolean; delay_minutes: number }[];
}

export function useEmployeeDataExport() {
  const fetchEmployeeData = async (date: Date): Promise<EmployeeExportData[]> => {
    const dateStr = format(date, 'yyyy-MM-dd');

    // Fetch all active staff (employees and other roles that need tracking)
    // Include: Employee, HR, Admin, Accounts, BOI, NSM, SMO, GMO, GM, Data Team
    const { data: employees, error: empError } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .not('role', 'ilike', '%ceo%')
      .not('role', 'ilike', '%auditor%')
      .order('name');

    if (empError) throw empError;
    if (!employees || employees.length === 0) return [];

    // Secondary safety filter: ensure no CEO or Auditor roles slip through
    const trackedEmployees = (employees as any[]).filter(emp => {
      const role = (emp.role || '').toLowerCase();
      return !role.includes('ceo') && !role.includes('auditor');
    });

    if (trackedEmployees.length === 0) return [];

    const employeeIds = trackedEmployees.map(e => e.id);

    // Fetch all related data in parallel (regular + shift tables)
    const [
      dayStartsResult,
      dayPlansResult,
      hourlyPlansResult,
      hourlyReportsResult,
      eodReportsResult,
      selfieRecordsResult,
      attestationsResult,
      shiftSessionsResult,
      shiftSlotsResult,
      shiftEodResult,
      shiftAssignmentsResult,
    ] = await Promise.all([
      supabase.from('day_starts').select('*').eq('date', dateStr).in('user_id', employeeIds),
      supabase.from('day_plans').select('*').eq('date', dateStr).in('user_id', employeeIds),
      supabase.from('hourly_plans').select('*').eq('date', dateStr).in('user_id', employeeIds),
      supabase.from('hourly_reports').select('*').eq('date', dateStr).in('user_id', employeeIds),
      supabase.from('eod_reports').select('*').eq('date', dateStr).in('user_id', employeeIds),
      supabase.from('selfie_records').select('*').eq('date', dateStr).in('user_id', employeeIds),
      supabase.from('hr_attestations').select('*').eq('date', dateStr).in('employee_id', employeeIds),
      (supabase.from('shift_sessions') as any).select('*').eq('date', dateStr).in('user_id', employeeIds),
      (supabase.from('shift_hourly_slots') as any).select('*, shift_sessions!inner(user_id, date)').eq('shift_sessions.date', dateStr),
      (supabase.from('shift_eod_reports') as any).select('*, shift_sessions!inner(user_id, date)').eq('shift_sessions.date', dateStr),
      (supabase.from('shift_user_assignments') as any).select('*').in('user_id', employeeIds),
    ]);

    const dayStarts = (dayStartsResult.data || []) as any[];
    const dayPlans = (dayPlansResult.data || []) as any[];
    const hourlyPlans = (hourlyPlansResult.data || []) as any[];
    const hourlyReports = (hourlyReportsResult.data || []) as any[];
    const eodReports = (eodReportsResult.data || []) as any[];
    const selfieRecords = (selfieRecordsResult.data || []) as any[];
    const attestations = (attestationsResult.data || []) as any[];
    const shiftSessions = (shiftSessionsResult.data || []) as any[];
    const shiftSlots = (shiftSlotsResult.data || []) as any[];
    const shiftEods = (shiftEodResult.data || []) as any[];
    const shiftAssignments = (shiftAssignmentsResult.data || []) as any[];

    return trackedEmployees.map(emp => {
      const dayStart = dayStarts.find(ds => ds.user_id === emp.id);
      const dayPlan = dayPlans.find(dp => dp.user_id === emp.id);
      const empHourlyPlans = hourlyPlans.filter(hp => hp.user_id === emp.id);
      const empHourlyReports = hourlyReports.filter(hr => hr.user_id === emp.id);
      const eodReport = eodReports.find(eod => eod.user_id === emp.id);
      const morningSelfie = selfieRecords.find(sr => sr.user_id === emp.id && sr.selfie_type === 'morning_login');
      const anySelfie = selfieRecords.find(sr => sr.user_id === emp.id);
      const attestation = attestations.find(a => a.employee_id === emp.id);

      // Check for shift session data
      const shiftSession = shiftSessions.find(ss => ss.user_id === emp.id);
      const empShiftSlots = shiftSession
        ? shiftSlots.filter(s => s.session_id === shiftSession.id)
        : [];
      const shiftEod = shiftSession
        ? shiftEods.find(e => e.session_id === shiftSession.id)
        : null;

      const lateReports = empHourlyReports.filter(r => r.is_late);

      // For shift users, use shift_start as login time
      const loginTimestamp = shiftSession?.shift_start
        || morningSelfie?.captured_at
        || dayStart?.submitted_at;

      // Calculate late login minutes using IST (10:15 AM cutoff)
      // Shift users may have flexible start times, so skip late calculation for them
      let lateLoginMinutes = 0;
      if (loginTimestamp && !shiftSession) {
        const loginTime = new Date(loginTimestamp);
        const utcHours = loginTime.getUTCHours();
        const utcMinutes = loginTime.getUTCMinutes();
        let istMinutes = utcMinutes + 30;
        let istHours = utcHours + 5;
        if (istMinutes >= 60) { istHours += 1; istMinutes -= 60; }
        if (istHours >= 24) { istHours -= 24; }
        const timeInMinutes = istHours * 60 + istMinutes;
        const cutoffMinutes = 10 * 60 + 15;
        if (timeInMinutes > cutoffMinutes) {
          lateLoginMinutes = timeInMinutes - cutoffMinutes;
        }
      }

      // Merge shift data: shift slots with plans/reports override regular counts
      const shiftPlansCount = empShiftSlots.filter(s => s.plan).length;
      const shiftReportsCount = empShiftSlots.filter(s => s.report).length;

      // Check for active shift assignment overlap with this date
      // User is a shift user if they have an assignment that covers this date
      const shiftAssignment = shiftAssignments.find(sa => {
        if (sa.user_id !== emp.id) return false;
        const assignedAt = new Date(sa.assigned_at);
        // If deactivated, check if date is before deactivation
        if (sa.deactivated_at) {
          const deactivatedAt = new Date(sa.deactivated_at);
          // We consider them a shift user if the date falls within their assignment period
          const targetDate = new Date(dateStr);
          // Simple date comparison: assigned_at <= date <= deactivated_at
          return assignedAt <= targetDate && targetDate <= deactivatedAt;
        }
        // If active (no deactivation), just check start date
        return assignedAt <= new Date(dateStr);
      });

      const isShiftUser = !!shiftAssignment;

      // Selfie URL: shift login selfie or regular selfie
      const selfieUrl = shiftSession?.login_selfie_url || anySelfie?.selfie_url || 'N/A';

      // Day plan: shift day_plan or regular day_plan
      const hasDayPlan = shiftSession?.day_plan || dayPlan;
      const dayPlanTasks = shiftSession?.day_plan
        ? shiftSession.day_plan
        : dayPlan?.tasks?.join('; ') || 'N/A';

      return {
        user_id: emp.id,
        name: emp.name,
        role: emp.role,
        employee_id: emp.office_number || `EMP-${emp.id.slice(0, 6).toUpperCase()}`,
        department: emp.department,
        date: dateStr,
        login_time: loginTimestamp ? format(new Date(loginTimestamp), 'hh:mm:ss a') : 'NO LOGIN',
        late_login_minutes: lateLoginMinutes,
        location_zone: dayStart?.location_zone || (shiftSession ? 'Shift' : 'N/A'),
        selfie_url: selfieUrl,
        day_plan_submitted: hasDayPlan ? 'YES' : 'NO',
        day_plan_tasks: dayPlanTasks,
        day_plan_tasks_array: shiftSession?.day_plan
          ? [shiftSession.day_plan]
          : dayPlan?.tasks || [],
        day_plan_output: dayPlan?.expected_output || (isShiftUser ? 'Shift mode' : 'N/A'),
        day_plan_dependency: dayPlan?.dependency || 'N/A',
        day_plan_time: dayPlan?.submitted_at || shiftSession?.shift_start,
        hourly_plans_count: isShiftUser ? shiftPlansCount : empHourlyPlans.length,
        hourly_reports_count: isShiftUser ? shiftReportsCount : empHourlyReports.length,
        late_reports_count: isShiftUser ? 0 : lateReports.length,
        eod_submitted: (isShiftUser ? !!shiftEod : !!eodReport) ? 'YES' : 'NO',
        eod_completion_percentage: eodReport?.completion_percentage || 0,
        attendance_status: attestation?.status || 'Pending',
        is_shift_user: isShiftUser,
        hourly_plans: isShiftUser
          ? empShiftSlots.filter(s => s.plan).map((s, i) => ({ time_slot: String(s.slot_number || (i + 1)), plan_text: s.plan }))
          : empHourlyPlans.map(p => ({ time_slot: p.time_slot, plan_text: p.plan_text })),
        hourly_reports: isShiftUser
          ? empShiftSlots.filter(s => s.report).map((s, i) => ({ time_slot: String(s.slot_number || (i + 1)), report_text: s.report, is_late: false, delay_minutes: 0 }))
          : empHourlyReports.map(r => ({
            time_slot: r.time_slot,
            report_text: r.report_text,
            is_late: r.is_late,
            delay_minutes: r.delay_minutes
          })),
      };
    });
  };

  const exportEmployeeDataCSV = async (date: Date) => {
    const data = await fetchEmployeeData(date);
    const headers: { key: keyof EmployeeExportData; label: string }[] = [
      { key: 'name', label: 'Employee Name' },
      { key: 'employee_id', label: 'Employee ID' },
      { key: 'department', label: 'Department' },
      { key: 'date', label: 'Date' },
      { key: 'login_time', label: 'Login Time' },
      { key: 'late_login_minutes', label: 'Late Login (mins)' },
      { key: 'location_zone', label: 'Location' },
      { key: 'selfie_url', label: 'Selfie URL' },
      { key: 'day_plan_submitted', label: 'Day Plan' },
      { key: 'day_plan_tasks', label: 'Day Plan Tasks' },
      { key: 'day_plan_output', label: 'Expected Output' },
      { key: 'day_plan_dependency', label: 'Dependencies' },
      { key: 'hourly_plans_count', label: 'Hourly Plans' },
      { key: 'hourly_reports_count', label: 'Hourly Reports' },
      { key: 'late_reports_count', label: 'Late Reports' },
      { key: 'eod_submitted', label: 'EOD Submitted' },
      { key: 'eod_completion_percentage', label: 'EOD Completion %' },
      { key: 'attendance_status', label: 'Attendance Status' },
    ];

    exportToCSV(data, `employee-data-${format(date, 'yyyy-MM-dd')}`, headers);
  };

  const exportEmployeeDataPDF = async (date: Date) => {
    const data = await fetchEmployeeData(date);
    const headers: { key: keyof EmployeeExportData; label: string }[] = [
      { key: 'name', label: 'Name' },
      { key: 'employee_id', label: 'ID' },
      { key: 'login_time', label: 'Login' },
      { key: 'late_login_minutes', label: 'Late (min)' },
      { key: 'location_zone', label: 'Location' },
      { key: 'hourly_reports_count', label: 'Reports' },
      { key: 'late_reports_count', label: 'Late' },
      { key: 'eod_submitted', label: 'EOD' },
      { key: 'attendance_status', label: 'Status' },
    ];

    exportToPDF(data, `employee-data-${format(date, 'yyyy-MM-dd')}`, `Employee Data Report - ${format(date, 'PPP')}`, headers);
  };

  const fetchEmployeeDataRange = async (startDate: Date, endDate: Date): Promise<EmployeeExportData[]> => {
    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = format(endDate, 'yyyy-MM-dd');

    // Fetch all active staff
    const { data: employees, error: empError } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .not('role', 'ilike', '%ceo%')
      .not('role', 'ilike', '%auditor%')
      .order('name');

    if (empError) throw empError;
    if (!employees || employees.length === 0) return [];

    // Secondary safety filter
    const trackedEmployees = (employees as any[]).filter(emp => {
      const role = (emp.role || '').toLowerCase();
      return !role.includes('ceo') && !role.includes('auditor');
    });

    if (trackedEmployees.length === 0) return [];

    const employeeIds = trackedEmployees.map(e => e.id);

    // Fetch data for the entire range in parallel
    const [
      dayStartsResult,
      dayPlansResult,
      hourlyPlansResult,
      hourlyReportsResult,
      eodReportsResult,
      selfieRecordsResult,
      attestationsResult,
      shiftSessionsResult,
      shiftAssignmentsResult,
    ] = await Promise.all([
      supabase.from('day_starts').select('*').gte('date', startStr).lte('date', endStr).in('user_id', employeeIds),
      supabase.from('day_plans').select('*').gte('date', startStr).lte('date', endStr).in('user_id', employeeIds),
      supabase.from('hourly_plans').select('*').gte('date', startStr).lte('date', endStr).in('user_id', employeeIds),
      supabase.from('hourly_reports').select('*').gte('date', startStr).lte('date', endStr).in('user_id', employeeIds),
      supabase.from('eod_reports').select('*').gte('date', startStr).lte('date', endStr).in('user_id', employeeIds),
      supabase.from('selfie_records').select('*').gte('date', startStr).lte('date', endStr).in('user_id', employeeIds),
      supabase.from('hr_attestations').select('*').gte('date', startStr).lte('date', endStr).in('employee_id', employeeIds),
      (supabase.from('shift_sessions') as any).select('*').gte('date', startStr).lte('date', endStr).in('user_id', employeeIds),
      (supabase.from('shift_user_assignments') as any).select('*').in('user_id', employeeIds),
    ]);

    const dayStarts = (dayStartsResult.data || []) as any[];
    const dayPlans = (dayPlansResult.data || []) as any[];
    const hourlyPlans = (hourlyPlansResult.data || []) as any[];
    const hourlyReports = (hourlyReportsResult.data || []) as any[];
    const eodReports = (eodReportsResult.data || []) as any[];
    const selfieRecords = (selfieRecordsResult.data || []) as any[];
    const attestations = (attestationsResult.data || []) as any[];
    const shiftSessions = (shiftSessionsResult.data || []) as any[];
    const shiftAssignments = (shiftAssignmentsResult.data || []) as any[];


    // Flatten data: One row per employee per day
    const allRows: EmployeeExportData[] = [];

    // Iterate through each day in the range
    const currentDate = new Date(startDate);
    const end = new Date(endDate);

    while (currentDate <= end) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');

      trackedEmployees.forEach(emp => {
        const dayStart = dayStarts.find(ds => ds.user_id === emp.id && ds.date === dateStr);
        const dayPlan = dayPlans.find(dp => dp.user_id === emp.id && dp.date === dateStr);
        // hourly plans/reports are many per day
        const empHourlyPlans = hourlyPlans.filter(hp => hp.user_id === emp.id && hp.date === dateStr);
        const empHourlyReports = hourlyReports.filter(hr => hr.user_id === emp.id && hr.date === dateStr);
        const eodReport = eodReports.find(eod => eod.user_id === emp.id && eod.date === dateStr);
        const morningSelfie = selfieRecords.find(sr => sr.user_id === emp.id && sr.date === dateStr && sr.selfie_type === 'morning_login');
        const anySelfie = selfieRecords.find(sr => sr.user_id === emp.id && sr.date === dateStr);
        const attestation = attestations.find(a => a.employee_id === emp.id && a.date === dateStr);
        const shiftSession = shiftSessions.find(ss => ss.user_id === emp.id && ss.date === dateStr);

        // Shift assignment check for range
        const shiftAssignment = shiftAssignments.find(sa => {
          if (sa.user_id !== emp.id) return false;
          const assignedAt = new Date(sa.assigned_at);
          const targetDate = new Date(dateStr);

          if (sa.deactivated_at) {
            const deactivatedAt = new Date(sa.deactivated_at);
            return assignedAt <= targetDate && targetDate <= deactivatedAt;
          }
          return assignedAt <= targetDate;
        });

        const isShiftUser = !!shiftAssignment;

        const lateReports = empHourlyReports.filter(r => r.is_late);

        // Login time logic
        const loginTimestamp = morningSelfie?.captured_at || dayStart?.submitted_at;
        let lateLoginMinutes = 0;

        if (loginTimestamp) {
          const loginTime = new Date(loginTimestamp);
          const utcHours = loginTime.getUTCHours();
          const utcMinutes = loginTime.getUTCMinutes();

          let istMinutes = utcMinutes + 30;
          let istHours = utcHours + 5;

          if (istMinutes >= 60) {
            istHours += 1;
            istMinutes -= 60;
          }
          if (istHours >= 24) istHours -= 24;

          const timeInMinutes = istHours * 60 + istMinutes;
          const cutoffMinutes = 10 * 60 + 15; // 10:15 AM

          if (timeInMinutes > cutoffMinutes) {
            lateLoginMinutes = timeInMinutes - cutoffMinutes;
          }
        }

        allRows.push({
          user_id: emp.id,
          name: emp.name,
          role: emp.role,
          employee_id: emp.office_number || `EMP-${emp.id.slice(0, 6).toUpperCase()}`,
          department: emp.department,
          date: dateStr,
          login_time: loginTimestamp ? format(new Date(loginTimestamp), 'hh:mm:ss a') : 'NO LOGIN',
          late_login_minutes: lateLoginMinutes,
          location_zone: dayStart?.location_zone || 'N/A',
          selfie_url: anySelfie?.selfie_url || 'N/A',
          day_plan_submitted: dayPlan ? 'YES' : 'NO',
          day_plan_tasks: dayPlan?.tasks?.join('; ') || 'N/A',
          day_plan_tasks_array: dayPlan?.tasks || [],
          day_plan_output: dayPlan?.expected_output || 'N/A',
          day_plan_dependency: dayPlan?.dependency || 'N/A',
          day_plan_time: dayPlan?.submitted_at,
          hourly_plans_count: empHourlyPlans.length,
          hourly_reports_count: empHourlyReports.length,
          late_reports_count: lateReports.length,
          eod_submitted: eodReport ? 'YES' : 'NO',
          eod_completion_percentage: eodReport?.completion_percentage || 0,
          attendance_status: attestation?.status || 'Pending',
          is_shift_user: isShiftUser,
          hourly_plans: empHourlyPlans.map(p => ({ time_slot: p.time_slot, plan_text: p.plan_text })),
          hourly_reports: empHourlyReports.map(r => ({
            time_slot: r.time_slot,
            report_text: r.report_text,
            is_late: r.is_late,
            delay_minutes: r.delay_minutes
          })),
        });
      });

      // Next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return allRows;
  };

  return {
    fetchEmployeeData,
    fetchEmployeeDataRange,
    exportEmployeeDataCSV,
    exportEmployeeDataPDF,
  };
}
