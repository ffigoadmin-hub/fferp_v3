import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import {
  Users, Search, FileText, Loader2, ChevronDown,
  CalendarDays, AlertTriangle, RefreshCw, CalendarIcon, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

interface LOPEntry {
  id: string;
  lop_date: string;
  lop_type: string;
  reason: string;
  status: string;
  source: string | null;
}

interface EmployeeLOPSummary {
  employee_id: string;
  employee_name: string;
  employee_email: string;
  department: string;
  total_lop_days: number;
  lop_entries: LOPEntry[];
}

export function EmployeeLOPSummaryWidget() {
  const [employees, setEmployees] = useState<EmployeeLOPSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeLOPSummary | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Date range filter - default to current month
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });

  const fetchLOPSummary = useCallback(async () => {
    setIsLoading(true);
    try {
      // Use date range for filtering
      const startDate = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const endDate = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : format(endOfMonth(new Date()), 'yyyy-MM-dd');

      console.log('Fetching LOP entries for:', startDate, 'to', endDate);

      // Fetch all approved LOP entries with employee details
      const { data, error } = await supabase
        .from('lop_entries')
        .select(`
          id,
          employee_id,
          lop_date,
          lop_type,
          reason,
          status,
          source,
          profile:profiles!lop_entries_employee_id_fkey(name, email, department)
        `)
        .eq('status', 'approved')
        .gte('lop_date', startDate)
        .lte('lop_date', endDate)
        .order('lop_date', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Fetched LOP entries:', data?.length || 0);

      // Group by employee
      const employeeMap: Record<string, EmployeeLOPSummary> = {};

      (data || []).forEach((entry: any) => {
        if (!employeeMap[entry.employee_id]) {
          employeeMap[entry.employee_id] = {
            employee_id: entry.employee_id,
            employee_name: entry.profile?.name || 'Unknown',
            employee_email: entry.profile?.email || '',
            department: entry.profile?.department || '',
            total_lop_days: 0,
            lop_entries: []
          };
        }

        // Calculate LOP days
        const lopValue = entry.lop_type === '1_day' ? 1 : entry.lop_type === '0.5_day' ? 0.5 : 0.25;
        employeeMap[entry.employee_id].total_lop_days = parseFloat((employeeMap[entry.employee_id].total_lop_days + lopValue).toFixed(2));
        employeeMap[entry.employee_id].lop_entries.push({
          id: entry.id,
          lop_date: entry.lop_date,
          lop_type: entry.lop_type,
          reason: entry.reason,
          status: entry.status,
          source: entry.source
        });
      });

      // Convert to array and sort by total LOP days descending
      const employeeList = Object.values(employeeMap).sort((a, b) => b.total_lop_days - a.total_lop_days);
      setEmployees(employeeList);
    } catch (err) {
      console.error('Error fetching LOP summary:', err);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchLOPSummary();
  }, [fetchLOPSummary]);

  // Real-time subscription for LOP entries
  useEffect(() => {
    const channel = supabase
      .channel('lop-summary-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lop_entries' },
        () => {
          // Refetch when any LOP entry changes
          fetchLOPSummary();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLOPSummary]);

  const filteredEmployees = employees.filter(emp => {
    const searchLower = searchTerm.toLowerCase();
    return (
      emp.employee_name.toLowerCase().includes(searchLower) ||
      emp.employee_email.toLowerCase().includes(searchLower) ||
      emp.department.toLowerCase().includes(searchLower)
    );
  });

  const totalLOPDays = parseFloat(employees.reduce((sum, emp) => sum + emp.total_lop_days, 0).toFixed(2));
  const totalEmployeesWithLOP = employees.length;

  const getLOPTypeLabel = (type: string) => {
    switch (type) {
      case '1_day': return '1 Day';
      case '0.5_day': return '0.5 Day';
      case '0.25_day': return '0.25 Day';
      default: return type;
    }
  };

  const getLOPTypeBadgeVariant = (type: string): "destructive" | "secondary" | "outline" => {
    switch (type) {
      case '1_day': return 'destructive';
      case '0.5_day': return 'secondary';
      case '0.25_day': return 'outline';
      default: return 'outline';
    }
  };

  const handleViewDetails = (emp: EmployeeLOPSummary) => {
    setSelectedEmployee(emp);
    setShowModal(true);
  };

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
    <>
      <Card className="h-full">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg">Employee LOP Summary</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {totalEmployeesWithLOP} employees with {totalLOPDays} total LOP days
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Date Range Picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal text-xs h-9",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "dd MMM")} - {format(dateRange.to, "dd MMM yyyy")}
                        </>
                      ) : (
                        format(dateRange.from, "dd MMM yyyy")
                      )
                    ) : (
                      <span>Pick date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    className="pointer-events-auto"
                  />
                  <div className="p-3 border-t flex justify-between gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDateRange({
                        from: startOfMonth(new Date()),
                        to: endOfMonth(new Date())
                      })}
                      className="text-xs"
                    >
                      This Month
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const now = new Date();
                        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                        setDateRange({
                          from: startOfMonth(lastMonth),
                          to: endOfMonth(lastMonth)
                        });
                      }}
                      className="text-xs"
                    >
                      Last Month
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              {dateRange && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setDateRange({
                    from: startOfMonth(new Date()),
                    to: endOfMonth(new Date())
                  })}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}

              <Button variant="outline" size="icon" className="h-9 w-9" onClick={fetchLOPSummary}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground">Employees</p>
              <p className="text-xl sm:text-2xl font-bold text-destructive">{totalEmployeesWithLOP}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground">Total LOP Days</p>
              <p className="text-xl sm:text-2xl font-bold text-destructive">{totalLOPDays.toFixed(2).replace(/\.00$/, '')}</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search employee..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Employee List */}
          <ScrollArea className="h-[350px] sm:h-[400px]">
            <div className="space-y-2">
              {filteredEmployees.length === 0 ? (
                <div className="py-8 text-center">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No LOP entries found</p>
                </div>
              ) : (
                filteredEmployees.map((emp) => (
                  <div
                    key={emp.employee_id}
                    className="p-3 sm:p-4 rounded-lg border border-border bg-card hover:border-primary/50 cursor-pointer transition-colors"
                    onClick={() => handleViewDetails(emp)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm sm:text-base truncate">{emp.employee_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{emp.department}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="destructive" className="text-xs sm:text-sm">
                          {emp.total_lop_days.toFixed(2).replace(/\.00$/, '')} days
                        </Badge>
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {emp.lop_entries.slice(0, 3).map((entry) => (
                        <Badge key={entry.id} variant="outline" className="text-[10px] sm:text-xs">
                          {format(new Date(entry.lop_date), 'dd MMM')}
                        </Badge>
                      ))}
                      {emp.lop_entries.length > 3 && (
                        <Badge variant="secondary" className="text-[10px] sm:text-xs">
                          +{emp.lop_entries.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              {selectedEmployee?.employee_name} - LOP Details
            </DialogTitle>
          </DialogHeader>

          {selectedEmployee && (
            <div className="space-y-4">
              <div className="p-3 sm:p-4 rounded-lg bg-muted/30">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Department</p>
                    <p className="font-medium text-sm sm:text-base">{selectedEmployee.department}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total LOP Days</p>
                    <p className="font-bold text-lg sm:text-xl text-destructive">{selectedEmployee.total_lop_days.toFixed(2).replace(/\.00$/, '')}</p>
                  </div>
                </div>
              </div>

              <ScrollArea className="h-[300px] sm:h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">Date</TableHead>
                      <TableHead className="text-xs sm:text-sm">Type</TableHead>
                      <TableHead className="text-xs sm:text-sm">Reason</TableHead>
                      <TableHead className="text-xs sm:text-sm">Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedEmployee.lop_entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-xs sm:text-sm">
                          <div className="flex items-center gap-1">
                            <CalendarDays className="w-3 h-3 text-muted-foreground" />
                            {format(new Date(entry.lop_date), 'dd MMM yyyy')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getLOPTypeBadgeVariant(entry.lop_type)} className="text-[10px] sm:text-xs">
                            {getLOPTypeLabel(entry.lop_type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[120px] sm:max-w-[200px] truncate text-xs sm:text-sm" title={entry.reason}>
                          {entry.reason}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm capitalize">
                          {entry.source || 'manual'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
