import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Users,
  DollarSign,
  Calendar,
  Eye,
  Pencil,
  CheckCircle2,
  RefreshCw,
  FileSpreadsheet,
  Search,
  Building2,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { getDepartments, getEmployeesWithProfile, safeNum } from '../services/employeeMasterService';
import {
  fetchBatchesForHR,
  hrVerifyBatch,
  createBulkBatch,
  type SalaryBatchCard,
  type PayrollRowForBatch,
} from '../services/salaryBatchWorkflowService';
import { SALARY_BATCH_STATUS, STATUS_BADGE_CLASS } from '../lib/salaryBatchWorkflow';
import { supabase } from '@/integrations/supabase/client';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const fmt = (v: number) =>
  `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

const getDaysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();

export default function HRSalarySheetAccessPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const daysInMonth = getDaysInMonth(year, month);
  const [fromDay, setFromDay] = useState(1);
  const [toDay, setToDay] = useState(daysInMonth);
  const [searchQuery, setSearchQuery] = useState('');
  const [verifyModalBatch, setVerifyModalBatch] = useState<SalaryBatchCard | null>(null);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ['employees-with-profile', month, year],
    queryFn: () => getEmployeesWithProfile(month, year),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: getDepartments,
  });

  const { data: batches = [], isLoading: loadingBatches } = useQuery({
    queryKey: ['salary-batches-hr'],
    queryFn: fetchBatchesForHR,
  });

  const filteredEmployees = useMemo(() => {
    let list = employees;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          (e.name || '').toLowerCase().includes(q) ||
          (e.department || '').toLowerCase().includes(q)
      );
    }
    if (selectedDepartments.length > 0) {
      list = list.filter((e) => selectedDepartments.includes(e.department || ''));
    }
    return list;
  }, [employees, searchQuery, selectedDepartments]);

  const selectedDays = Math.max(0, toDay - fromDay + 1);

  useEffect(() => {
    const max = daysInMonth;
    setFromDay((d) => Math.min(Math.max(1, d), max));
    setToDay((d) => Math.min(Math.max(1, d), max));
  }, [daysInMonth]);

  const bulkPrepareMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');
      const payrollRows: PayrollRowForBatch[] = filteredEmployees.map((e) => ({
        id: e.id,
        name: e.name || '',
        department: e.department || '',
        basic_salary: safeNum(e.basic_salary),
        bank_name: e.bank_name,
        account_number: e.account_number,
        ifsc_code: e.ifsc_code,
        increment: safeNum(e.increment),
        incentive: safeNum(e.incentive),
        lop_days: safeNum(e.lop_days),
        lop_amount: safeNum(e.lop_amount),
        tds: safeNum(e.tds_amount ?? e.tds_1_percent),
        days_in_month: safeNum(e.days_in_month) || 30,
        selected_days: selectedDays || 30,
        final_salary: safeNum(e.final_salary ?? e.final_total_salary),
        earned_salary: safeNum(e.earned_salary),
        per_day_salary: safeNum(e.one_day_salary),
      }));
      return createBulkBatch(payrollRows, month, year, user.id, 'All', fromDay, toDay);
    },
    onSuccess: async (result) => {
      toast.success(`Batch created: ${result.batchCode}`);
      // Force immediate refetch to show new batch
      await queryClient.invalidateQueries({ queryKey: ['salary-batches-hr'] });
      await queryClient.refetchQueries({ queryKey: ['salary-batches-hr'], type: 'active' });
    },
    onError: (e: Error) => toast.error(e.message || 'Bulk prepare failed'),
  });

  const verifyMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');
      await hrVerifyBatch(batchId, user.id);
    },
    onSuccess: () => {
      toast.success('Batch verified. It will now appear on the Auditor Salary Audit page.');
      setVerifyModalBatch(null);
      queryClient.invalidateQueries({ queryKey: ['salary-batches-hr'] });
      queryClient.invalidateQueries({ queryKey: ['salary-batches-auditor'] });
    },
    onError: (e: Error) => toast.error(e.message || 'Verify failed'),
  });

  const canVerify = (b: SalaryBatchCard) =>
    b.status === SALARY_BATCH_STATUS.DRAFT || b.status === 'DRAFT';

  const statusBadgeClass = (s: string) =>
    STATUS_BADGE_CLASS[s] ?? 'bg-gray-100 text-gray-800';

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">HR Salary Sheet</h1>
          <p className="text-muted-foreground">
            Choose month, payroll period, and prepare salary batches; verify to send to Auditor
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/hr/employee-master')}>
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Employee Master
        </Button>
      </div>

      {/* Month/Year, selected days, search, Bulk Prepare */}
      <Card>
        <CardHeader>
          <CardTitle>Prepare Salary</CardTitle>
          <CardDescription>
            Choose month, year, and payroll period (From Day / To Day), then Bulk Prepare Salary to create batch cards
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label>Month</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Year</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value) || year)}
                className="w-[100px]"
              />
            </div>
            <div className="space-y-1">
              <Label>From Day</Label>
              <Input
                type="number"
                min={1}
                max={daysInMonth}
                value={fromDay}
                onChange={(e) => setFromDay(Math.min(daysInMonth, Math.max(1, Number(e.target.value) || 1)))}
                className="w-[80px]"
              />
            </div>
            <div className="space-y-1">
              <Label>To Day</Label>
              <Input
                type="number"
                min={1}
                max={daysInMonth}
                value={toDay}
                onChange={(e) => setToDay(Math.min(daysInMonth, Math.max(1, Number(e.target.value) || 1)))}
                className="w-[80px]"
              />
            </div>
            {selectedDays > 0 && (
              <p className="text-sm text-muted-foreground self-center">
                Selected: {selectedDays} day{selectedDays !== 1 ? 's' : ''}
              </p>
            )}
            <div className="relative flex-1 max-w-xs">
              <Label className="sr-only">Search employees</Label>
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            
            {/* Department Filter with Checkboxes */}
            <div className="space-y-1">
              <Label>Department Filter</Label>
              <div className="flex flex-wrap gap-2 items-center">
                {departments.map((dept) => {
                  const deptName = dept.name;
                  const checked = selectedDepartments.includes(deptName);
                  return (
                    <label
                      key={dept.id}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md border cursor-pointer text-sm transition-colors ${
                        checked
                          ? 'bg-primary/10 border-primary/50 text-primary'
                          : 'bg-muted/30 border-border/50 hover:bg-muted/50'
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          setSelectedDepartments((prev) => {
                            if (v) return [...prev, deptName];
                            return prev.filter((d) => d !== deptName);
                          });
                        }}
                        className="h-3.5 w-3.5"
                      />
                      <span>{deptName}</span>
                    </label>
                  );
                })}
                {selectedDepartments.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => setSelectedDepartments([])}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
            <Button
              onClick={() => bulkPrepareMutation.mutate()}
              disabled={filteredEmployees.length === 0 || bulkPrepareMutation.isPending}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Bulk Prepare Salary ({filteredEmployees.length} employees)
            </Button>
          </div>
          {loadingEmployees && (
            <p className="text-sm text-muted-foreground">Loading employees…</p>
          )}
          {!loadingEmployees && (
            <p className="text-sm text-muted-foreground">
              Showing {filteredEmployees.length} employees
            </p>
          )}
        </CardContent>
      </Card>

      {/* Salary Sheet Card View */}
      <Card>
        <CardHeader>
          <CardTitle>Salary Sheet Batches</CardTitle>
          <CardDescription>
            View, edit, verify, or delete (Draft only) batches. After verification, batches move to Auditor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingBatches ? (
            <p className="text-muted-foreground">Loading batches…</p>
          ) : batches.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No batches yet. Use Bulk Prepare Salary above to create batches.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {batches.map((batch) => (
                <Card key={batch.id} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{batch.batch_code}</CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <Building2 className="w-3 h-3" />
                          {batch.departments_display}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge className={statusBadgeClass(batch.status)}>
                          {batch.status}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span>{batch.total_employees} employees</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span>Net: {fmt(batch.total_net_pay ?? 0)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDateTime(batch.created_at)}</span>
                    </div>
                    {batch.auditor_rejected_reason && (
                      <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                        Auditor rejected: {batch.auditor_rejected_reason}
                      </p>
                    )}
                    {batch.ceo_rejected_reason && (
                      <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                        CEO rejected: {batch.ceo_rejected_reason}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/hr/sheet/view?batchId=${batch.id}`)}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/hr/employee-master/${batch.id}`)}
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      {canVerify(batch) && (
                        <Button
                          size="sm"
                          onClick={() => setVerifyModalBatch(batch)}
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Verify
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verify confirmation modal */}
      <Dialog open={!!verifyModalBatch} onOpenChange={() => setVerifyModalBatch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify batch</DialogTitle>
            <DialogDescription>
              This will mark the batch as &quot;HR Verified&quot; and move it to the Auditor page.
              You can no longer edit it after verification.
            </DialogDescription>
          </DialogHeader>
          {verifyModalBatch && (
            <p className="text-sm">
              Batch: <strong>{verifyModalBatch.batch_code}</strong> —{' '}
              {verifyModalBatch.total_employees} employees,{' '}
              {fmt(verifyModalBatch.total_net_pay ?? 0)} net pay.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyModalBatch(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => verifyModalBatch && verifyMutation.mutate(verifyModalBatch.id)}
              disabled={verifyMutation.isPending}
            >
              {verifyMutation.isPending ? 'Verifying…' : 'Verify'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
