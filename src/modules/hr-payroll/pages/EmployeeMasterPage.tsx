import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Save, AlertTriangle, Download, Upload, Plus, Pencil, X, Check, CalendarDays } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  upsertEmployeeMaster, 
  getDepartments,
  validateEmployeeMasterSchema,
  formatCurrency,
  recalculateRow,
  safeNum,
} from '../services/employeeMasterService';
import { getLOPSummaryByProfileIds, upsertLOPMonthlySummary } from '../services/lopResolver';
import { getSalaryBatchEmployees, getSalaryBatch } from '../services/salaryWorkflowService';
import { updateBatchEmployeeRow, updateBatchEmployeeRowById, recalculateBatchTotals } from '../services/salaryBatchWorkflowService';
import { SALARY_BATCH_STATUS } from '../lib/salaryBatchWorkflow';
import { supabase } from '@/integrations/supabase/client';
import { NotificationService } from '@/services/NotificationService';
import { useAuth } from '@/contexts/AuthContext';

// Constants
const ALL = "__all__";
const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' }
];

// Generate year options (current year ± 5)
const generateYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear - 5; i <= currentYear + 5; i++) {
    years.push({ value: i, label: i.toString() });
  }
  return years;
};

// Combined payroll employee row type (profile_id is the only unique key)
interface PayrollEmployeeRow {
  row_id?: string;
  profile_id: string;
  name: string;
  department: string;
  basic_salary: number;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  increment: number;
  incentive: number;
  lop_days: number;
  lop_amount: number;
  tds: number;
  tds_percent: number;
  days_in_month: number;
  selected_days: number;
  final_salary: number;
  per_day_salary?: number;
  earned_salary?: number;
}

export default function EmployeeMasterPage() {
  const { user } = useAuth();
  const params = useParams();
  const batchId = params.batchId as string | undefined;
  const [batchData, setBatchData] = useState<any>(null);
  const [isBatchMode, setIsBatchMode] = useState(!!batchId);
  const [filters, setFilters] = useState<{search?: string; department?: string}>({});
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [savingRows, setSavingRows] = useState<Set<string>>(new Set());
  const [schemaError, setSchemaError] = useState<string | null>(null);
  
  // Month and Year selector state
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  // Day range selector state
  const [fromDay, setFromDay] = useState<number>(1);
  const [toDay, setToDay] = useState<number>(new Date(selectedYear, selectedMonth, 0).getDate());
  
  // LOP dropdown options for row: 0, 0.25, 0.5, 0.75, 1 … 15 (step 0.25)
  const LOP_DROPDOWN_OPTIONS = (() => {
    const opts: { value: string; label: string }[] = [];
    for (let d = 0; d <= 15; d += 0.25) {
      const v = Math.round(d * 100) / 100;
      opts.push({ value: String(v), label: String(v) });
    }
    return opts;
  })();

  // Top LOP range filter: All, No LOP, 0-0.9, 0.9-1, 1-1.9, … 15+
  const LOP_RANGE_FILTER_OPTIONS = (() => {
    const opts: { value: string; label: string; min?: number; max?: number }[] = [
      { value: 'all', label: 'All' },
      { value: 'none', label: 'No LOP', min: 0, max: 0 },
      { value: '0-0.9', label: '0–0.9', min: 0, max: 0.9 },
      { value: '0.9-1', label: '0.9–1', min: 0.9, max: 1 },
    ];
    for (let i = 1; i <= 14; i++) {
      opts.push({ value: `${i}-${i + 0.9}`, label: `${i}–${i + 0.9}`, min: i, max: i + 0.9 });
    }
    opts.push({ value: '15+', label: '15+', min: 15, max: 999 });
    return opts;
  })();
  const [lopRangeFilter, setLopRangeFilter] = useState<string>('all');
  
  // Payroll calculation state
  const [payrollRows, setPayrollRows] = useState<PayrollEmployeeRow[]>([]);
  const [overallTotalSalary, setOverallTotalSalary] = useState(0);
  
  const yearOptions = generateYearOptions();

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const userRole = (user?.role ?? '').toString().trim().toLowerCase();
  const canWriteEmployeeMaster = userRole === 'hr' || userRole === 'admin';
  const backPath = userRole === 'ceo'
    ? '/ceo/salary-approval'
    : userRole === 'accounts'
      ? '/accounts/salary-execution'
      : '/hr/sheet';

  // Helper functions for day calculations
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };

  const getSelectedDays = () => {
    return Math.max(0, toDay - fromDay + 1);
  };

  const getFromDate = () => {
    return `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${fromDay.toString().padStart(2, '0')}`;
  };

  const getToDate = () => {
    return `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${toDay.toString().padStart(2, '0')}`;
  };

  // Helper to get TDS applicable days (only if range includes days 1-20)
  const getTdsApplicableDays = () => {
    // TDS only applies if selected range includes days 1-20
    if (fromDay <= 20 && toDay >= 1) {
      // Calculate overlap between selected range and days 1-20
      const tdsStart = Math.max(fromDay, 1);
      const tdsEnd = Math.min(toDay, 20);
      return Math.max(0, tdsEnd - tdsStart + 1);
    }
    return 0; // No TDS if range doesn't include days 1-20
  };

  const getLopBucket = (lopDays: number): string => {
    const d = safeNum(lopDays);
    if (d <= 0) return 'NO_LOP';
    if (d < 1) return '0_0_9';
    if (d < 2) return '1_1_99';
    if (d < 3) return '2_2_99';
    return '3_PLUS';
  };

  const detectSalaryBatchEmployeesIdColumns = async (): Promise<{ profile_id: boolean; employee_id: boolean }> => {
    const [profileRes, employeeRes] = await Promise.all([
      supabase.from('salary_batch_employees').select('profile_id').limit(1),
      supabase.from('salary_batch_employees').select('employee_id').limit(1),
    ]);

    const profile_id = !(profileRes.error && /column .*profile_id.* does not exist/i.test(profileRes.error.message));
    const employee_id = !(employeeRes.error && /column .*employee_id.* does not exist/i.test(employeeRes.error.message));

    console.log('[EmployeeMaster] salary_batch_employees id columns:', { profile_id, employee_id });
    return { profile_id, employee_id };
  };

  const fetchProfilesForIds = async (ids: string[]): Promise<Array<{ id: string; full_name?: string | null; name?: string | null; department?: string | null }>> => {
    // Try with full_name first, then fallback if column doesn't exist
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e7f8f17a-55dd-4230-ab08-b802fd3ee148',{method:'POST',mode:'no-cors',body:JSON.stringify({runId:'bulk-prepare-pre',hypothesisId:'H1',location:'EmployeeMasterPage.tsx:fetchProfilesForIds',message:'Fetching profiles for ids',data:{count:ids.length,sample:ids.slice(0,5)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const withFullName = await supabase.from('profiles').select('id, full_name, name, department').in('id', ids);
    if (withFullName.error) {
      if (/column .*full_name.* does not exist/i.test(withFullName.error.message)) {
        const fallback = await supabase.from('profiles').select('id, name, department').in('id', ids);
        if (fallback.error) throw new Error(`Failed to fetch profiles: ${fallback.error.message}`);
        return (fallback.data || []) as Array<{ id: string; name?: string | null; department?: string | null }>;
      }
      throw new Error(`Failed to fetch profiles: ${withFullName.error.message}`);
    }
    return (withFullName.data as unknown || []) as Array<{ id: string; full_name?: string | null; name?: string | null; department?: string | null }>;
  };

  const validateSelectedProfileIdsOrThrow = async (selectedIds: string[]): Promise<Map<string, { id: string; employee_name: string; department: string }>> => {
    const normalized = Array.from(new Set(selectedIds.map(s => String(s).trim()).filter(Boolean)));
    console.log('[EmployeeMaster] Selected employee ids:', normalized);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e7f8f17a-55dd-4230-ab08-b802fd3ee148',{method:'POST',mode:'no-cors',body:JSON.stringify({runId:'bulk-prepare-pre',hypothesisId:'H1',location:'EmployeeMasterPage.tsx:validateSelectedProfileIdsOrThrow',message:'Selected ids normalized',data:{count:normalized.length,sample:normalized.slice(0,5)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const profilesData = await fetchProfilesForIds(normalized);
    console.log('[EmployeeMaster] Fetched profiles count:', profilesData.length);
    console.log('[EmployeeMaster] Fetched profile IDs:', profilesData.map(p => p.id));

    const found = new Set(profilesData.map(p => p.id));
    const missing = normalized.filter(id => !found.has(id));
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e7f8f17a-55dd-4230-ab08-b802fd3ee148',{method:'POST',mode:'no-cors',body:JSON.stringify({runId:'bulk-prepare-pre',hypothesisId:'H1',location:'EmployeeMasterPage.tsx:validateSelectedProfileIdsOrThrow',message:'Profile fetch results',data:{selectedCount:normalized.length,fetchedCount:profilesData.length,missingCount:missing.length,missingSample:missing.slice(0,5),fetchedSample:profilesData.slice(0,3).map(p=>p.id)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (missing.length > 0) {
      throw new Error(`Selected employee is missing a valid profile ID. Cannot prepare batch. Missing profiles: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '…' : ''}`);
    }

    const map = new Map<string, { id: string; employee_name: string; department: string }>();
    for (const p of profilesData) {
      const employee_name = String((p.full_name ?? p.name ?? 'UNKNOWN') || 'UNKNOWN');
      const department = String((p.department ?? 'UNKNOWN') || 'UNKNOWN');
      map.set(p.id, { id: p.id, employee_name, department });
    }
    return map;
  };

  // Schema validation on mount
  useEffect(() => {
    const validateSchema = async () => {
      const isValid = await validateEmployeeMasterSchema();
      if (!isValid) {
        setSchemaError('Database schema is outdated. Please run: fix_employee_master_schema.sql');
      }
    };
    validateSchema();
  }, []);

  // Fetch batch data when in batch mode
  useEffect(() => {
    if (batchId && isBatchMode) {
      const fetchBatchData = async () => {
        try {
          const batch = await getSalaryBatch(batchId);
          const employees = await getSalaryBatchEmployees(batchId);
          setBatchData({ batch, employees });
        } catch (error) {
          console.error('Failed to fetch batch data:', error);
          toast.error('Failed to load batch data');
        }
      };
      fetchBatchData();
    }
  }, [batchId, isBatchMode]);

  // Fetch employees with payroll data or batch data (profile_id as key; LOP from lopResolver)
  const { data: employeesData = [], isLoading, error, refetch } = useQuery({
    queryKey: isBatchMode ? ['batch-data', batchId] : ['employees-with-profile', selectedMonth, selectedYear, fromDay, toDay],
    queryFn: async () => {
      if (isBatchMode && batchId) {
        const employees = await getSalaryBatchEmployees(batchId);
        return employees || [];
      }
      try {
        const fromDate = getFromDate();
        const toDate = getToDate();
        const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
        const selectedDays = getSelectedDays();

        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, name, department");
        if (profilesError) throw new Error(`Failed to fetch profiles: ${profilesError.message}`);

        const profileIds: string[] = profiles.map((p: { id: string }) => p.id);
        // Use select('*') to handle any schema variant (basic_salary/salary, incentive/incentives, ifsc_code/ifsc)
        const { data: masters, error: mastersError } = await supabase
          .from("employee_master")
          .select("*")
          .in("profile_id", profileIds as string[]);
        if (mastersError) throw new Error(`Failed to fetch employee master: ${mastersError.message}`);

        // DEBUG: Log selected payroll period
        console.log('[EmployeeMaster] PAYROLL PERIOD:', {
          selectedMonth,
          selectedYear,
          fromDate,
          toDate,
          daysInMonth,
          selectedDays
        });

        // DEBUG: Check profiles and their IDs
        console.log('[EmployeeMaster] PROFILES FETCHED:', {
          count: profiles.length,
          sample: profiles.slice(0, 3).map(p => ({ id: p.id, name: p.name }))
        });

        let lopMap: Map<string, { lop_days: number; lop_amount: number }>;
        try {
          console.log('[EmployeeMaster] FETCHING LOP - Query params:', { 
            profileIds: profileIds.slice(0, 5), 
            fromDate, 
            toDate,
            totalProfiles: profileIds.length 
          });
          lopMap = await getLOPSummaryByProfileIds(profileIds, fromDate, toDate);
          console.log('[EmployeeMaster] LOP FETCH RESULT:', { 
            entriesFound: lopMap.size,
            entries: Array.from(lopMap.entries()).slice(0, 3).map(([pid, data]) => ({
              profile_id: pid,
              lop_days: data.lop_days,
              lop_amount: data.lop_amount
            }))
          });
        } catch (lopError) {
          console.error('[EmployeeMaster] ERROR fetching LOP:', lopError);
          lopMap = new Map();
        }
        console.log('[EmployeeMaster] DEBUG - LOP query params:', { profileIds: profileIds.slice(0, 5), fromDate, toDate });
        if (lopMap.size > 0) {
          const firstEntry = lopMap.entries().next().value as [string, { lop_days: number; lop_amount: number }] | undefined;
          if (firstEntry) console.log('[EmployeeMaster] Sample merged LOP (profile_id, lop_days, lop_amount):', firstEntry[0], firstEntry[1].lop_days, firstEntry[1].lop_amount);
        } else {
          console.warn('[EmployeeMaster] WARNING: No LOP entries found for any profiles');
        }

        const mergedData = profiles.map((profile: { id: string; name: string; department: string }) => {
          const master = (masters as Record<string, unknown>[] | null)?.find((m: Record<string, unknown>) => m.profile_id === profile.id);
          const lop = lopMap.get(profile.id) ?? { lop_days: 0, lop_amount: 0 };
          
          // Debug: Track mapping for first few profiles
          if (profiles.indexOf(profile) < 3) {
            console.log(`[EmployeeMaster] MERGE DEBUG - Profile ${profile.id} (${profile.name}):`, {
              hasLOP: lopMap.has(profile.id),
              lopFromMap: lopMap.get(profile.id),
              finalLOP: lop,
              masterExists: !!master
            });
          }
          
          // Handle both "basic_salary" and legacy "salary" column names
          const basic_salary = safeNum((master?.basic_salary ?? (master as any)?.salary) as number | null);
          // Handle both "increment" column (consistent across migrations)
          const increment = safeNum(master?.increment as number | null);
          // Handle both "incentive" and "incentives" column names
          const incentive = safeNum(((master as any)?.incentive ?? (master as any)?.incentives) as number | null);
          const lop_days = safeNum(lop.lop_days);
          const lop_amount = safeNum(lop.lop_amount);
          
          // Debug: Track calculation inputs
          if (profiles.indexOf(profile) < 3) {
            console.log(`[EmployeeMaster] CALC DEBUG - Before recalc for ${profile.name}:`, {
              basic_salary,
              lop_days,
              lop_amount,
              daysInMonth,
              selectedDays
            });
          }
          const calc = recalculateRow(
            { basic_salary, increment, incentive, lop_days, lop_amount },
            { daysInMonth, selectedDays }
          );
          
          // Debug: Track final calculation results
          if (profiles.indexOf(profile) < 3) {
            console.log(`[EmployeeMaster] FINAL DEBUG - After recalc for ${profile.name}:`, {
              input_lop_days: lop_days,
              input_lop_amount: lop_amount,
              calculated_lop_amount: calc.lop_amount,
              final_salary: calc.final_salary,
              per_day_salary: calc.per_day_salary
            });
          }
          
          return {
            profile_id: profile.id,
            name: profile.name ?? '',
            department: profile.department ?? '',
            basic_salary,
            bank_name: ((master as any)?.bank_name ?? (master as any)?.bank ?? '') as string,
            account_number: ((master as any)?.account_number ?? '') as string,
            // Handle both "ifsc_code" and "ifsc" column names
            ifsc_code: ((master as any)?.ifsc_code ?? (master as any)?.ifsc ?? '') as string,
            increment,
            incentive,
            lop_days,
            lop_amount: calc.lop_amount,
            tds: calc.tds,
            tds_percent: 1,
            days_in_month: daysInMonth,
            selected_days: selectedDays,
            final_salary: calc.final_salary,
            per_day_salary: calc.per_day_salary,
            earned_salary: calc.earned_salary,
          };
        });
        
        // Debug: Log final merged data for first few employees
        console.log('[EmployeeMaster] DEBUG - Final merged data (first 3):', mergedData.slice(0, 3).map(emp => ({
          profile_id: emp.profile_id,
          name: emp.name,
          lop_days: emp.lop_days,
          lop_amount: emp.lop_amount,
          final_salary: emp.final_salary
        })));
        
        return mergedData;
      } catch (err) {
        console.error('Error fetching employee data:', err);
        throw err;
      }
    },
    enabled: isBatchMode ? !!batchId : true,
  });

  // Sync query result to payroll rows and total (query already applies recalculateRow)
  useEffect(() => {
    if (employeesData.length > 0) {
      setPayrollRows(employeesData);
      setOverallTotalSalary(employeesData.reduce((sum: number, emp: PayrollEmployeeRow) => sum + (emp.final_salary ?? 0), 0));
    }
  }, [employeesData]);

  // Recalc a single row (e.g. after LOP or salary edit) and return updated row
  const applyRecalc = (row: PayrollEmployeeRow): PayrollEmployeeRow => {
    const ctx = { daysInMonth: getDaysInMonth(selectedYear, selectedMonth), selectedDays: getSelectedDays() };
    const calc = recalculateRow(
      { basic_salary: row.basic_salary, increment: row.increment, incentive: row.incentive, lop_days: row.lop_days, lop_amount: row.lop_amount },
      ctx
    );
    return {
      ...row,
      lop_amount: calc.lop_amount,
      tds: calc.tds,
      final_salary: calc.final_salary,
      per_day_salary: calc.per_day_salary,
      earned_salary: calc.earned_salary,
      days_in_month: ctx.daysInMonth,
      selected_days: ctx.selectedDays,
    };
  };

  // Normalize lop_days to nearest 0.25 for dropdown value (so Select shows correct option)
  const lopDropdownValue = (lopDays: number): string => {
    const n = safeNum(lopDays);
    const rounded = Math.round(n * 4) / 4;
    const clamped = Math.min(15, Math.max(0, rounded));
    const s = String(clamped);
    return LOP_DROPDOWN_OPTIONS.some(o => o.value === s) ? s : '0';
  };

  // LOP dropdown change: update row state and recalc immediately
  const handleLOPDaysChange = (profileId: string, newLopDays: number) => {
    // Capture old value before state update for notification
    const oldRow = payrollRows.find(r => r.profile_id === profileId);
    const oldLopDays = oldRow?.lop_days ?? 0;
    const employeeName = oldRow?.name ?? profileId;

    setPayrollRows(prev => {
      const next = prev.map(r => r.profile_id === profileId ? { ...r, lop_days: newLopDays } : r);
      const updated = next.map(r => r.profile_id === profileId ? applyRecalc(r) : r);
      setOverallTotalSalary(updated.reduce((s, e) => s + (e.final_salary ?? 0), 0));
      return updated;
    });
    upsertLOPMonthlySummary(profileId, selectedYear, selectedMonth, newLopDays).catch(() => {});

    // In batch mode, sync LOP change to batch and recalc totals
    if (batchId) {
      const row = payrollRows.find(r => r.profile_id === profileId);
      if (row) {
        const recalcRow = applyRecalc({ ...row, lop_days: newLopDays });
        const updatePayload = {
          lop_days: newLopDays,
          lop_amount: recalcRow.lop_amount,
          lop_bucket: getLopBucket(newLopDays),
          tds: recalcRow.tds,
          net_pay: recalcRow.final_salary,
        };
        const updatePromise = row.row_id
          ? updateBatchEmployeeRowById(row.row_id, updatePayload)
          : updateBatchEmployeeRow(batchId, profileId, updatePayload);
        updatePromise
          .then(() => recalculateBatchTotals(batchId))
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ['batch-data', batchId] });
            queryClient.invalidateQueries({ queryKey: ['salary-batches-hr'] });
          })
          .catch(() => {});
      }
    }

    // Send notifications to Auditor and CEO when LOP changes
    if (oldLopDays !== newLopDays) {
      const msg = `HR updated LOP days for ${employeeName} from ${oldLopDays} to ${newLopDays}`;
      NotificationService.notifyRole('auditor', 'LOP Updated', msg, profileId, 'lop_update').catch(() => {});
      NotificationService.notifyRole('ceo', 'LOP Updated', msg, profileId, 'lop_update').catch(() => {});
    }
  };

  const handleEdit = (profileId: string) => setEditingRowId(profileId);
  const handleCancelEdit = () => {
    setEditingRowId(null);
    refetch();
  };

  // Row-level save: only allowed fields. Optimistic update + spinner; on success clear edit mode.
  const handleSave = async (profileId: string) => {
    const row = payrollRows.find(r => r.profile_id === profileId);
    if (!row) return;
    setSavingRows(prev => new Set(prev).add(profileId));
    try {
      if (canWriteEmployeeMaster) {
        await upsertMutation.mutateAsync({
          employee_id: profileId,
          name: row.name ?? undefined,
          department: row.department ?? undefined,
          basic_salary: row.basic_salary,
          bank_name: row.bank_name?.trim() || undefined,
          account_number: row.account_number?.trim() || undefined,
          ifsc_code: row.ifsc_code?.trim().toUpperCase() || undefined,
          increment: row.increment,
          incentive: row.incentive,
        });
      }
      if (batchId) {
        const updatePayload = {
          department: row.department ?? undefined,
          employee_name: row.name ?? undefined,
          basic_salary: row.basic_salary,
          days_in_month: row.days_in_month,
          selected_days: row.selected_days,
          per_day_salary: row.per_day_salary,
          earned_salary: row.earned_salary,
          lop_days: row.lop_days,
          lop_amount: row.lop_amount,
          incentive: row.incentive,
          increment: row.increment,
          tds: row.tds,
          net_pay: row.final_salary,
          bank_name: row.bank_name?.trim() || null,
          account_number: row.account_number?.trim() || null,
          ifsc_code: row.ifsc_code?.trim().toUpperCase() || null,
        };
        if (row.row_id) {
          await updateBatchEmployeeRowById(row.row_id, updatePayload);
        } else {
          await updateBatchEmployeeRow(batchId, profileId, updatePayload);
        }
        await recalculateBatchTotals(batchId);
      }
      if (!canWriteEmployeeMaster && batchId) {
        toast.success('Batch row updated successfully');
      }
      setEditingRowId(null);
      refetch();
    } finally {
      setSavingRows(prev => {
        const next = new Set(prev);
        next.delete(profileId);
        return next;
      });
    }
  };

  // Update a single field on a row and recalc if it affects salary
  const handleRowFieldChange = (profileId: string, field: keyof PayrollEmployeeRow, value: string | number) => {
    setPayrollRows(prev => {
      const next = prev.map(r => r.profile_id === profileId ? { ...r, [field]: value } : r);
      const row = next.find(r => r.profile_id === profileId);
      if (!row) return prev;
      const needsRecalc = ['basic_salary', 'increment', 'incentive', 'lop_days'].includes(field);
      const updated = needsRecalc ? next.map(r => r.profile_id === profileId ? applyRecalc(row) : r) : next;
      setOverallTotalSalary(updated.reduce((s, e) => s + (e.final_salary ?? 0), 0));
      return updated;
    });
  };

  // Filter employees (LOP range filter applied AFTER merge so row.lop_days is set)
  const filteredEmployees = payrollRows.filter(employee => {
    if (!employee) return false;
    const matchesSearch = !filters.search ||
      (employee.name ?? '').toLowerCase().includes(filters.search.toLowerCase()) ||
      (employee.department ?? '').toLowerCase().includes(filters.search.toLowerCase());
    const matchesDepartment =
      selectedDepartments.length === 0 || selectedDepartments.includes(employee.department ?? '');
    const lop = safeNum(employee.lop_days);
    const rangeOpt = LOP_RANGE_FILTER_OPTIONS.find(o => o.value === lopRangeFilter);
    const matchesLopRange = isBatchMode ? true : (() => {
      if (!rangeOpt || rangeOpt.value === 'all') return true;
      if (rangeOpt.value === 'none') return lop === 0;
      if (rangeOpt.min != null && rangeOpt.max != null) return lop >= rangeOpt.min && lop < rangeOpt.max;
      return true;
    })();
    return matchesSearch && matchesDepartment && matchesLopRange;
  });

  // CSV Download function
  const downloadPayrollCSV = () => {
    if (filteredEmployees.length === 0) {
      toast.error('No employee data to download');
      return;
    }

    // Create CSV headers
    const headers = [
      'Profile ID',
      'Name',
      'Department',
      'Basic Salary',
      'Bank Name',
      'Account Number',
      'IFSC Code',
      'Increment',
      'Incentive',
      'Selected Days',
      'LOP Days',
      'LOP Amount',
      'TDS',
      'Final Salary'
    ];

    // Create CSV data
    const csvData = filteredEmployees.map(emp => [
      emp.profile_id,
      emp.name ?? '',
      emp.department ?? '',
      safeNum(emp.basic_salary).toFixed(2),
      emp.bank_name || '',
      emp.account_number || '',
      emp.ifsc_code || '',
      safeNum(emp.increment).toFixed(2),
      safeNum(emp.incentive).toFixed(2),
      getSelectedDays().toString(),
      safeNum(emp.lop_days).toString(),
      safeNum(emp.lop_amount).toFixed(2),
      safeNum(emp.tds).toFixed(2),
      safeNum(emp.final_salary).toFixed(2)
    ]);

    // Convert to CSV string
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    // Generate filename with month and year
    const monthName = MONTHS.find(m => m.value === selectedMonth)?.label || 'Month';
    const filename = `payroll_${monthName}_${selectedYear}_days_${fromDay}-${toDay}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`Payroll CSV downloaded: ${filename}`);
  };

  // CSV Upload handler: parse CSV, validate, upsert into employee_master
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleUploadCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    event.target.value = '';

    setIsUploading(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) {
        toast.error('CSV file must have a header row and at least one data row');
        return;
      }

      // Parse header
      const headerLine = lines[0];
      const headers = headerLine.split(',').map(h => h.replace(/^"|"$/g, '').trim());
      const colMap: Record<string, number> = {};
      headers.forEach((h, i) => { colMap[h] = i; });

      // Validate required columns
      if (colMap['Profile ID'] === undefined) {
        toast.error('CSV must contain a "Profile ID" column. Download the template first.');
        return;
      }

      const parseCell = (row: string[], col: string): string => {
        const idx = colMap[col];
        if (idx === undefined) return '';
        return (row[idx] ?? '').replace(/^"|"$/g, '').trim();
      };

      // Parse rows
      const updates: Array<{
        profile_id: string;
        basic_salary?: number;
        bank_name?: string;
        account_number?: string;
        ifsc_code?: string;
        increment?: number;
        incentive?: number;
      }> = [];

      for (let i = 1; i < lines.length; i++) {
        // Simple CSV split (handles quoted values with commas inside)
        const cells: string[] = [];
        let current = '';
        let inQuotes = false;
        for (const ch of lines[i]) {
          if (ch === '"') { inQuotes = !inQuotes; continue; }
          if (ch === ',' && !inQuotes) { cells.push(current.trim()); current = ''; continue; }
          current += ch;
        }
        cells.push(current.trim());

        const profileId = parseCell(cells, 'Profile ID');
        if (!profileId) continue;

        const basicStr = parseCell(cells, 'Basic Salary');
        const incrementStr = parseCell(cells, 'Increment');
        const incentiveStr = parseCell(cells, 'Incentive');

        updates.push({
          profile_id: profileId,
          ...(basicStr ? { basic_salary: parseFloat(basicStr) || 0 } : {}),
          ...(parseCell(cells, 'Bank Name') ? { bank_name: parseCell(cells, 'Bank Name') } : {}),
          ...(parseCell(cells, 'Account Number') ? { account_number: parseCell(cells, 'Account Number') } : {}),
          ...(parseCell(cells, 'IFSC Code') ? { ifsc_code: parseCell(cells, 'IFSC Code').toUpperCase() } : {}),
          ...(incrementStr ? { increment: parseFloat(incrementStr) || 0 } : {}),
          ...(incentiveStr ? { incentive: parseFloat(incentiveStr) || 0 } : {}),
        });
      }

      if (updates.length === 0) {
        toast.error('No valid rows found in CSV');
        return;
      }

      // Upsert each row into employee_master
      let successCount = 0;
      let errorCount = 0;
      for (const row of updates) {
        try {
          await upsertEmployeeMaster({
            employee_id: row.profile_id,
            basic_salary: row.basic_salary ?? 0,
            bank_name: row.bank_name,
            account_number: row.account_number,
            ifsc_code: row.ifsc_code,
            increment: row.increment,
            incentive: row.incentive,
          });
          successCount++;
        } catch {
          errorCount++;
        }
      }

      if (errorCount > 0) {
        toast.warning(`Uploaded ${successCount} rows, ${errorCount} failed`);
      } else {
        toast.success(`Successfully uploaded ${successCount} employee records`);
      }
      refetch();
    } catch (err: any) {
      console.error('[EmployeeMaster] CSV upload error:', err);
      toast.error(`Upload failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Bulk Prepare function - create batch and navigate
  const handleBulkPrepare = async () => {
    if (filteredEmployees.length === 0) {
      toast.error('No employee data to prepare batch');
      return;
    }

    try {
      const idCols = await detectSalaryBatchEmployeesIdColumns();
      const selectedEmployeeIds = filteredEmployees.map(e => e.profile_id);
      const validatedProfiles = await validateSelectedProfileIdsOrThrow(selectedEmployeeIds);
      const selectedProfileIds = Array.from(validatedProfiles.keys());
      const fkColumnUsed = idCols.profile_id ? 'profile_id' : (idCols.employee_id ? 'employee_id' : 'UNKNOWN');
      console.log('[EmployeeMaster] FK column used for salary_batch_employees:', fkColumnUsed);
      console.log('[EmployeeMaster] Bulk Prepare selectedProfileIds:', selectedProfileIds);

      // Evidence for hypothesis: FK might reference employee_master instead of profiles
      try {
        const { data: masterRows, error: masterErr } = await supabase
          .from('employee_master')
          .select('id, profile_id')
          .in('profile_id', selectedProfileIds);
        if (masterErr) {
          console.warn('[EmployeeMaster] employee_master lookup failed:', masterErr.message);
        } else {
          const masterProfileIds = new Set((masterRows || []).map((r: any) => String(r.profile_id)));
          const missingInEmployeeMaster = selectedProfileIds.filter(id => !masterProfileIds.has(String(id)));
          console.log('[EmployeeMaster] employee_master rows fetched:', (masterRows || []).length);
          console.log('[EmployeeMaster] profileIds missing in employee_master (sample):', missingInEmployeeMaster.slice(0, 10));
        }
      } catch (e) {
        console.warn('[EmployeeMaster] employee_master lookup exception:', (e as any)?.message ?? String(e));
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e7f8f17a-55dd-4230-ab08-b802fd3ee148',{method:'POST',mode:'no-cors',body:JSON.stringify({runId:'bulk-prepare-pre',hypothesisId:'H2',location:'EmployeeMasterPage.tsx:handleBulkPrepare',message:'Detected salary_batch_employees FK columns',data:{idCols,fkColumnUsed,validatedCount:validatedProfiles.size},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      // Create batch in salary_batches table
      const { data: batch, error: batchError } = await supabase
        .from('salary_batches')
        .insert({
          month: selectedMonth,
          year: selectedYear,
          department: null, // All departments
          status: SALARY_BATCH_STATUS.DRAFT,
          total_employees: filteredEmployees.length,
          total_net_pay: filteredEmployees.reduce((sum, emp) => sum + safeNum(emp.final_salary), 0),
          total_lop_amount: filteredEmployees.reduce((sum, emp) => sum + safeNum(emp.lop_amount), 0),
          total_incentives: filteredEmployees.reduce((sum, emp) => sum + safeNum(emp.incentive), 0),
          total_tds: filteredEmployees.reduce((sum, emp) => sum + safeNum(emp.tds), 0),
          batch_code: `BATCH-${selectedMonth}-${selectedYear}-${Date.now()}`
          // Note: created_by will be auto-filled by DB default
        })
        .select()
        .single();

      if (batchError) {
        throw new Error(`Failed to create batch: ${batchError.message}`);
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e7f8f17a-55dd-4230-ab08-b802fd3ee148',{method:'POST',mode:'no-cors',body:JSON.stringify({runId:'bulk-prepare-pre',hypothesisId:'H3',location:'EmployeeMasterPage.tsx:handleBulkPrepare',message:'Created salary_batches row',data:{batchId:batch?.id,code:batch?.batch_code,totalEmployees:filteredEmployees.length},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      // Detect optional columns in salary_batch_employees
      const bsColCheck = await supabase.from('salary_batch_employees').select('basic_salary').limit(0);
      const hasBsCol = !bsColCheck.error || !/column .*basic_salary.* does not exist/i.test(bsColCheck.error?.message ?? '');
      console.log('[EmployeeMaster] salary_batch_employees has basic_salary column:', hasBsCol);

      // Insert employees into salary_batch_employees
      const byId = new Map(filteredEmployees.map(e => [String(e.profile_id), e]));
      const batchEmployees = Array.from(validatedProfiles.keys()).map(profileId => {
        const emp = byId.get(profileId);
        const meta = validatedProfiles.get(profileId)!;

        const days_in_month = safeNum(emp?.days_in_month) || getDaysInMonth(selectedYear, selectedMonth);
        // Always derive selected_days from toDay/fromDay to avoid 0 if emp row is missing
        const selected_days = (safeNum(emp?.selected_days) > 0 ? safeNum(emp.selected_days) : getSelectedDays()) || getDaysInMonth(selectedYear, selectedMonth);
        const basic_salary = safeNum(emp?.basic_salary);
        const per_day_salary = safeNum(emp?.per_day_salary) > 0
          ? safeNum(emp!.per_day_salary)
          : (days_in_month > 0 ? Math.round((basic_salary / days_in_month) * 100) / 100 : 0);
        const earned_salary = safeNum(emp?.earned_salary) > 0
          ? safeNum(emp!.earned_salary)
          : Math.round(per_day_salary * selected_days * 100) / 100;
        const lop_days = safeNum(emp?.lop_days);
        const lop_amount = safeNum(emp?.lop_amount);
        const tds = safeNum(emp?.tds);
        const net_pay = safeNum(emp?.final_salary);

        const payload: Record<string, unknown> = {
          batch_id: batch.id,
          ...(idCols.profile_id ? { profile_id: profileId } : {}),
          ...(idCols.employee_id ? { employee_id: profileId } : {}),
          employee_name: meta.employee_name,
          department: meta.department,
          days_in_month,
          selected_days,
          lop_days,
          lop_bucket: getLopBucket(lop_days),
          per_day_salary,
          earned_salary,
          lop_amount,
          incentive: safeNum(emp?.incentive),
          increment: safeNum(emp?.increment),
          tds,
          net_pay,
          bank_name: emp?.bank_name || null,
          account_number: emp?.account_number || null,
          ifsc_code: emp?.ifsc_code || null,
          // Store basic_salary snapshot if column exists (via optional migration)
          ...(hasBsCol ? { basic_salary } : {}),
          status: SALARY_BATCH_STATUS.DRAFT,
        };

        return payload;
      });

      console.log('[EmployeeMaster] Profile IDs being inserted (sample):', batchEmployees.slice(0, 10).map((r: any) => r.profile_id ?? r.employee_id));
      console.log('[EmployeeMaster] Batch employee insert payload (first 3):', batchEmployees.slice(0, 3));
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e7f8f17a-55dd-4230-ab08-b802fd3ee148',{method:'POST',mode:'no-cors',body:JSON.stringify({runId:'bulk-prepare-pre',hypothesisId:'H3',location:'EmployeeMasterPage.tsx:handleBulkPrepare',message:'Prepared salary_batch_employees payload',data:{count:batchEmployees.length,fkColumnUsed,sample:batchEmployees.slice(0,3).map(r=>({profile_id:(r as any).profile_id,employee_id:(r as any).employee_id,employee_name:(r as any).employee_name}))},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      // DEBUG: Log status value being used
      console.log('[EmployeeMaster] Status value for insert:', SALARY_BATCH_STATUS.DRAFT);
      console.log('[EmployeeMaster] Allowed status values:', Object.values(SALARY_BATCH_STATUS));

      // Pre-insert validation for profile IDs and status
      const invalidRows = batchEmployees.filter((emp: any) => {
        const missingProfileId = !emp.profile_id && !emp.employee_id;
        const invalidStatus = !emp.status || !Object.values(SALARY_BATCH_STATUS).includes(emp.status);
        return missingProfileId || invalidStatus;
      });

      if (invalidRows.length > 0) {
        console.error('[EmployeeMaster] Pre-insert validation failed:', invalidRows);
        throw new Error(`${invalidRows.length} employee row(s) have invalid profile_id or status. Check console for details.`);
      }

      console.log('[EmployeeMaster] All rows validated - inserting salary_batch_employees...');

      const { error: insertError } = await supabase
        .from('salary_batch_employees')
        .insert(batchEmployees as any);

      if (insertError) {
        // Best-effort cleanup (avoid orphan batch)
        await supabase.from('salary_batches').delete().eq('id', batch.id);
        console.error('[EmployeeMaster] salary_batch_employees insertError object:', insertError);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e7f8f17a-55dd-4230-ab08-b802fd3ee148',{method:'POST',mode:'no-cors',body:JSON.stringify({runId:'bulk-prepare-pre',hypothesisId:'H4',location:'EmployeeMasterPage.tsx:handleBulkPrepare',message:'Insert salary_batch_employees failed (rolled back batch)',data:{batchId:batch?.id,fkColumnUsed,error:{message:insertError.message,code:(insertError as any).code,details:(insertError as any).details,hint:(insertError as any).hint}},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        throw new Error(`Failed to create salary batch employees because employee profile IDs are invalid or do not exist in profiles. Batch rolled back. Details: ${insertError.message}`);
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e7f8f17a-55dd-4230-ab08-b802fd3ee148',{method:'POST',mode:'no-cors',body:JSON.stringify({runId:'bulk-prepare-pre',hypothesisId:'H5',location:'EmployeeMasterPage.tsx:handleBulkPrepare',message:'Inserted salary_batch_employees successfully',data:{batchId:batch?.id,count:batchEmployees.length},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      toast.success(`Batch prepared successfully: ${batch.batch_code}`);
      navigate(`/hr/sheet?batchId=${batch.id}`);
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e7f8f17a-55dd-4230-ab08-b802fd3ee148',{method:'POST',mode:'no-cors',body:JSON.stringify({runId:'bulk-prepare-pre',hypothesisId:'H4',location:'EmployeeMasterPage.tsx:handleBulkPrepare',message:'Bulk prepare caught error',data:{message:(error as any)?.message ?? String(error)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      toast.error(error.message || 'Failed to prepare batch');
    }
  };

  // Upsert mutation
  const upsertMutation = useMutation({
    mutationFn: upsertEmployeeMaster,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees-with-profile'] });
      if (batchId) {
        queryClient.invalidateQueries({ queryKey: ['batch-data', batchId] });
        queryClient.invalidateQueries({ queryKey: ['salary-sheet-batches'] });
        queryClient.invalidateQueries({ queryKey: ['salary-batches-ceo'] });
        queryClient.invalidateQueries({ queryKey: ['salary-batches-accounts'] });
      }
      queryClient.invalidateQueries({ queryKey: ['salary-batches-hr'] });
      toast.success('Employee data saved successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save employee data');
    }
  });

  // Fetch departments for filter
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: getDepartments
  });

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Employee Master Payroll Management</h1>
        <p className="text-muted-foreground">Manage employee payroll with automatic LOP calculations and dynamic month-based salary computation</p>
      </div>
      
      {/* Schema Error Alert */}
      {schemaError && (
        <Card className="mb-6 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="w-5 h-5" />
              <div>
                <strong>Database Schema Issue:</strong> {schemaError}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters & compact selected-days range */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters & Month Selection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name or department..."
                  value={filters.search || ''}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="lopDays">LOP Days (range filter)</Label>
              <Select value={lopRangeFilter} onValueChange={setLopRangeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All LOP Days" />
                </SelectTrigger>
                <SelectContent>
                  {LOP_RANGE_FILTER_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Department</Label>
              <Select 
                value={selectedDepartments.length === 0 ? 'all' : selectedDepartments[0]} 
                onValueChange={(value) => setSelectedDepartments(value === 'all' ? [] : [value])}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.name}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="month">Month</Label>
              <Select 
                value={selectedMonth?.toString()} 
                onValueChange={(value) => setSelectedMonth(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month) => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="year">Year</Label>
              <Select 
                value={selectedYear?.toString()} 
                onValueChange={(value) => setSelectedYear(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year.value} value={year.value.toString()}>
                      {year.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-3 md:col-span-2">
              <div>
                <Label htmlFor="fromDay">From Day</Label>
                <Input
                  id="fromDay"
                  type="number"
                  min="1"
                  max={getDaysInMonth(selectedYear, selectedMonth)}
                  value={fromDay}
                  onChange={(e) => setFromDay(Math.max(1, Math.min(getDaysInMonth(selectedYear, selectedMonth), Number(e.target.value))))}
                  className="h-8 w-20 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="toDay">To Day</Label>
                <Input
                  id="toDay"
                  type="number"
                  min="1"
                  max={getDaysInMonth(selectedYear, selectedMonth)}
                  value={toDay}
                  onChange={(e) => setToDay(Math.max(1, Math.min(getDaysInMonth(selectedYear, selectedMonth), Number(e.target.value))))}
                  className="h-8 w-20 text-sm"
                />
              </div>
              <div className="ml-auto">
                <div className="inline-flex flex-col items-start gap-1 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs md:text-[11px] leading-tight">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Selected Days</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400 text-sm">
                      {getSelectedDays()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">TDS Days</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400 text-sm">
                      {getTdsApplicableDays()}
                    </span>
                    <span className="text-[10px] text-muted-foreground">(1–20 only)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div>
            <Label className="text-xs">Date Range</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 w-full justify-start text-left font-normal">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {fromDay === toDay ? `Day ${fromDay}` : `Days ${fromDay}-${toDay}`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <div className="text-xs font-medium mb-2 text-center">Select day</div>
                <div className="grid grid-cols-7 gap-0.5 text-[10px]">
                  {['S','M','T','W','T','F','S'].map((d) => <div key={d} className="text-muted-foreground text-center py-0.5">{d}</div>)}
                  {Array.from({ length: getDaysInMonth(selectedYear, selectedMonth) }, (_, i) => i + 1).map((day) => {
                    const inRange = day >= fromDay && day <= toDay;
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          setFromDay(day);
                          setToDay(day);
                        }}
                        className={`rounded p-0.5 min-w-[24px] h-6 text-center transition-colors cursor-pointer hover:bg-primary/30 ${
                          inRange ? 'bg-primary/20 text-primary font-semibold' : 'bg-muted/30 hover:bg-muted/50'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Employee Payroll Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              {isBatchMode ? (
                <>
                  <CardTitle>Batch Details - {batchData?.batch?.month}/{batchData?.batch?.year}</CardTitle>
                  <div className="text-sm text-muted-foreground">
                    Status: <span className="font-bold">{batchData?.batch?.status}</span>
                  </div>
                </>
              ) : (
                <>
                  <CardTitle>Employees ({filteredEmployees.length})</CardTitle>
                  <div className="text-sm text-muted-foreground">
                    {isLoading ? 'Loading employees...' : 
                     error ? 'Error loading employees' :
                     `Payroll calculations for ${MONTHS.find(m => m.value === selectedMonth)?.label} ${selectedYear} (Days ${fromDay}-${toDay})`
                    }
                  </div>
                </>
              )}
            </div>
            {isBatchMode && (
              <Button 
                onClick={() => navigate(backPath)}
                variant="outline"
                className="text-sm"
              >
                ← Back
              </Button>
            )}
            <div className="flex gap-2 flex-wrap">
              <Button 
                onClick={downloadPayrollCSV}
                disabled={isLoading || filteredEmployees.length === 0}
                variant="outline"
              >
                <Download className="w-4 h-4 mr-2" />
                Download CSV
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                onChange={handleUploadCSV}
                className="hidden"
              />
              <Button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || isUploading}
                variant="outline"
              >
                <Upload className="w-4 h-4 mr-2" />
                {isUploading ? 'Uploading...' : 'Upload CSV'}
              </Button>
              <Button 
                onClick={handleBulkPrepare}
                disabled={isLoading || filteredEmployees.length === 0}
                variant="secondary"
              >
                <Plus className="w-4 h-4 mr-2" />
                Bulk Prepare
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">
              Error: {error.message}
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No employees found matching your criteria.
            </div>
          ) : (
            <>
            {/* Warn if many employees have 0 salary – data needs to be entered */}
            {(() => {
              const zeroCount = filteredEmployees.filter(e => safeNum(e.basic_salary) === 0).length;
              if (zeroCount === 0) return null;
              return (
                <div className="flex items-start gap-3 mb-4 p-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>{zeroCount} employee(s)</strong> have ₹0 Basic Salary.
                    Click <strong>Edit</strong> (pencil icon) on each row, enter the salary, and click <strong>Save</strong> before running Bulk Prepare.
                  </span>
                </div>
              );
            })()}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Basic Salary</TableHead>
                    <TableHead>Bank Name</TableHead>
                    <TableHead>Account Number</TableHead>
                    <TableHead>IFSC Code</TableHead>
                    <TableHead className="text-right">Increment</TableHead>
                    <TableHead className="text-right">Incentive</TableHead>
                    <TableHead className="text-right">LOP Days</TableHead>
                    <TableHead className="text-right">LOP Amount</TableHead>
                    <TableHead className="text-right">TDS</TableHead>
                    <TableHead className="text-right">Final Salary</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => {
                    const isEditing = editingRowId === employee.profile_id;
                    const saving = savingRows.has(employee.profile_id);
                    const disabled = saving;
                    return (
                      <TableRow key={employee.profile_id}>
                        <TableCell className="font-medium">{employee.name ?? ''}</TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Select
                              value={employee.department || ''}
                              onValueChange={(value) => handleRowFieldChange(employee.profile_id, 'department', value)}
                              disabled={disabled}
                            >
                              <SelectTrigger className="h-8 w-[140px]">
                                <SelectValue placeholder="Select dept" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Not Assigned</SelectItem>
                                {departments.map((dept) => (
                                  <SelectItem key={dept.id} value={dept.name}>
                                    {dept.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className={!employee.department ? 'text-muted-foreground italic' : ''}>
                              {employee.department || 'Not Assigned'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <Input
                              type="number"
                              className="h-8 w-24 text-right"
                              value={employee.basic_salary}
                              onChange={(e) => handleRowFieldChange(employee.profile_id, 'basic_salary', safeNum(Number(e.target.value)))}
                              disabled={disabled}
                            />
                          ) : (
                            formatCurrency(employee.basic_salary)
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              className="h-8 min-w-[100px]"
                              value={employee.bank_name || ''}
                              onChange={(e) => handleRowFieldChange(employee.profile_id, 'bank_name', e.target.value)}
                              disabled={disabled}
                            />
                          ) : (
                            (employee.bank_name || '-')
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              className="h-8 min-w-[120px]"
                              value={employee.account_number || ''}
                              onChange={(e) => handleRowFieldChange(employee.profile_id, 'account_number', e.target.value)}
                              disabled={disabled}
                            />
                          ) : (
                            (employee.account_number || '-')
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              className="h-8 min-w-[90px]"
                              value={employee.ifsc_code || ''}
                              onChange={(e) => handleRowFieldChange(employee.profile_id, 'ifsc_code', e.target.value)}
                              disabled={disabled}
                            />
                          ) : (
                            (employee.ifsc_code || '-')
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <Input
                              type="number"
                              className="h-8 w-20 text-right"
                              value={employee.increment}
                              onChange={(e) => handleRowFieldChange(employee.profile_id, 'increment', safeNum(Number(e.target.value)))}
                              disabled={disabled}
                            />
                          ) : (
                            formatCurrency(employee.increment)
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <Input
                              type="number"
                              className="h-8 w-20 text-right"
                              value={employee.incentive}
                              onChange={(e) => handleRowFieldChange(employee.profile_id, 'incentive', safeNum(Number(e.target.value)))}
                              disabled={disabled}
                            />
                          ) : (
                            formatCurrency(employee.incentive)
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <Select
                              value={lopDropdownValue(employee.lop_days)}
                              onValueChange={(v) => handleLOPDaysChange(employee.profile_id, Number(v))}
                              disabled={disabled}
                            >
                              <SelectTrigger className="h-8 w-[72px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {LOP_DROPDOWN_OPTIONS.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            safeNum(employee.lop_days).toFixed(2)
                          )}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(employee.lop_amount)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(employee.tds)}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(employee.final_salary)}</TableCell>
                        <TableCell className="text-center min-w-[120px]" style={{ minWidth: 120 }}>
                          {!isEditing ? (
                            <Button type="button" size="sm" variant="outline" onClick={() => handleEdit(employee.profile_id)} disabled={disabled} title="Edit">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          ) : (
                            <>
                              <Button type="button" size="sm" onClick={() => handleSave(employee.profile_id)} disabled={disabled} title="Save">
                                {saving ? (
                                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </Button>
                              <Button type="button" size="sm" variant="ghost" onClick={handleCancelEdit} disabled={disabled} title="Cancel" className="ml-1">
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={12} className="text-right font-bold">
                      Total: {formatCurrency(overallTotalSalary)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
