import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLOPEntries } from '@/hooks/useLOPEntries';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from 'date-fns';
import { Download, FileSpreadsheet, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface LeaveAbsence {
  employee_id: string;
  employee_name: string;
  employee_email: string;
  start_date: string;
  end_date: string;
}

export function PayrollExportWidget() {
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [isExporting, setIsExporting] = useState(false);
  const [leaveAbsences, setLeaveAbsences] = useState<LeaveAbsence[]>([]);
  const { entries, getLOPValue } = useLOPEntries('approved');

  // Filter entries within the date range
  const monthEntries = entries.filter(e => {
    return e.lop_date >= startDate && e.lop_date <= endDate;
  });

  // Fetch approved leave requests for the selected date range
  useEffect(() => {
    const fetchLeaveAbsences = async () => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select(`
          employee_id,
          start_date,
          end_date,
          profiles:employee_id (name, email)
        `)
        .eq('status', 'approved')
        .gte('start_date', startDate)
        .lte('end_date', endDate);

      if (error) {
        console.error('Error fetching leave absences:', error);
        return;
      }

      const leaves: LeaveAbsence[] = (data || []).map((leave: any) => ({
        employee_id: leave.employee_id,
        employee_name: leave.profiles?.name || 'Unknown',
        employee_email: leave.profiles?.email || '',
        start_date: leave.start_date,
        end_date: leave.end_date,
      }));

      setLeaveAbsences(leaves);
    };

    fetchLeaveAbsences();
  }, [startDate, endDate]);

  // Calculate leave days (excluding weekends)
  const calculateLeaveDays = (startDate: string, endDate: string): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = eachDayOfInterval({ start, end });
    // Count only weekdays
    return days.filter(day => !isWeekend(day)).length;
  };

  const exportToCSV = async () => {
    setIsExporting(true);
    
    try {
      // Group by employee - combine LOP entries and leave absences
      const summary: Record<string, { 
        name: string; 
        email: string; 
        lopDays: number;
        leaveDays: number;
        totalDays: number; 
        lopDates: string[];
        leaveDates: string[];
        reasons: string[];
      }> = {};
      
      // Process LOP entries
      monthEntries.forEach(entry => {
        if (!summary[entry.employee_id]) {
          summary[entry.employee_id] = {
            name: entry.employee_name || 'Unknown',
            email: entry.employee_email || '',
            lopDays: 0,
            leaveDays: 0,
            totalDays: 0,
            lopDates: [],
            leaveDates: [],
            reasons: [],
          };
        }
        const lopValue = getLOPValue(entry.lop_type);
        summary[entry.employee_id].lopDays += lopValue;
        summary[entry.employee_id].totalDays += lopValue;
        summary[entry.employee_id].lopDates.push(format(new Date(entry.lop_date), 'dd MMM'));
        summary[entry.employee_id].reasons.push(entry.reason);
      });

      // Process leave absences (each leave day = 1 LOP day)
      leaveAbsences.forEach(leave => {
        if (!summary[leave.employee_id]) {
          summary[leave.employee_id] = {
            name: leave.employee_name,
            email: leave.employee_email,
            lopDays: 0,
            leaveDays: 0,
            totalDays: 0,
            lopDates: [],
            leaveDates: [],
            reasons: [],
          };
        }
        const leaveDaysCount = calculateLeaveDays(leave.start_date, leave.end_date);
        summary[leave.employee_id].leaveDays += leaveDaysCount;
        summary[leave.employee_id].totalDays += leaveDaysCount;
        summary[leave.employee_id].leaveDates.push(
          `${format(new Date(leave.start_date), 'dd MMM')} - ${format(new Date(leave.end_date), 'dd MMM')}`
        );
        summary[leave.employee_id].reasons.push('Approved Leave (1 day LOP per leave day)');
      });
      
      // Create CSV with payroll-friendly format
      const headers = ['Employee ID', 'Employee Name', 'Email', 'LOP Days', 'Leave Days', 'Total Deduction Days', 'LOP Dates', 'Leave Dates', 'Reasons'];
      const rows = Object.entries(summary).map(([id, data]) => [
        id.slice(0, 8).toUpperCase(),
        data.name,
        data.email,
        data.lopDays.toFixed(2),
        data.leaveDays.toString(),
        data.totalDays.toFixed(2),
        `"${data.lopDates.join(', ')}"`,
        `"${data.leaveDates.join(', ')}"`,
        `"${data.reasons.join('; ').replace(/"/g, '""')}"`,
      ]);
      
      const startLabel = format(new Date(startDate), 'dd_MMM_yyyy');
      const endLabel = format(new Date(endDate), 'dd_MMM_yyyy');
      const fileLabel = startDate === endDate ? startLabel : `${startLabel}_to_${endLabel}`;
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Payroll_Deductions_${fileLabel}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  // Calculate totals
  const totalLOPDays = monthEntries.reduce((sum, e) => sum + getLOPValue(e.lop_type), 0);
  const totalLeaveDays = leaveAbsences.reduce((sum, leave) => 
    sum + calculateLeaveDays(leave.start_date, leave.end_date), 0
  );
  
  // Unique employees from both LOP and leaves
  const lopEmployeeIds = new Set(monthEntries.map(e => e.employee_id));
  const leaveEmployeeIds = new Set(leaveAbsences.map(l => l.employee_id));
  const allEmployeeIds = new Set([...lopEmployeeIds, ...leaveEmployeeIds]);

  const hasData = monthEntries.length > 0 || leaveAbsences.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          Payroll Reports
        </CardTitle>
        <CardDescription>
          Export approved LOP entries and leave absences for payroll processing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label htmlFor="start-date">From</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (e.target.value > endDate) {
                  setEndDate(e.target.value);
                }
              }}
              className="mt-1 w-44"
            />
          </div>
          <div>
            <Label htmlFor="end-date">To</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-44"
            />
          </div>
          <Button 
            onClick={exportToCSV} 
            disabled={isExporting || !hasData}
            className="gap-2"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Download CSV
          </Button>
        </div>

        {/* Preview Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">{monthEntries.length}</p>
            <p className="text-xs text-muted-foreground">LOP Entries</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">{leaveAbsences.length}</p>
            <p className="text-xs text-muted-foreground">Leave Records</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">{allEmployeeIds.size}</p>
            <p className="text-xs text-muted-foreground">Employees</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-status-missed/10">
            <p className="text-2xl font-bold text-status-missed">{(totalLOPDays + totalLeaveDays).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Total Deduction Days</p>
          </div>
        </div>

        {/* Breakdown */}
        <div className="p-3 rounded-lg bg-muted/30 border text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">LOP Days (approved):</span>
            <span className="font-medium">{totalLOPDays.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Leave Days (1 day = 1 LOP):</span>
            <span className="font-medium">{totalLeaveDays}</span>
          </div>
        </div>

        {hasData && (
          <div className="flex items-center gap-2 text-sm text-status-live">
            <CheckCircle className="w-4 h-4" />
            <span>All entries in this export are CEO-approved</span>
          </div>
        )}

        {leaveAbsences.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-primary">
            <AlertCircle className="w-4 h-4" />
            <span>Leave absences included as 1-day LOP per leave day</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
