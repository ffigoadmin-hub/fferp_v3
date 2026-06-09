// @ts-nocheck
import { supabase } from '@/integrations/supabase/client';
import { PayrollCalculation, calculatePayroll, getCurrentMonthRange } from '../utils/salaryUtils';

export interface PayrollRecord {
  id?: string;
  employee_id: string;
  month: number;
  year: number;
  monthly_salary: number;
  increment: number;
  incentives: number;
  total_days_in_month: number;
  lop_days: number;
  per_day_salary: number;
  lop_amount: number;
  tds_percent: number;
  tds_amount: number;
  total_salary: number;
  status: 'ACTIVE' | 'INACTIVE';
  created_at?: string;
  updated_at?: string;
}

export interface PayrollFormData {
  employee_id: string;
  monthly_salary: number;
  increment: number;
  incentives: number;
  status: 'ACTIVE' | 'INACTIVE';
}

/**
 * Save payroll calculation for an employee
 */
export async function savePayrollCalculation(
  employeeId: string,
  monthlySalary: number,
  increment: number = 0,
  incentives: number = 0,
  tdsPercent: number = 1,
  date: Date = new Date()
): Promise<PayrollRecord> {
  console.log('Saving payroll calculation for employee:', employeeId);
  
  const { startDate, endDate } = getCurrentMonthRange();
  const currentMonth = date.getMonth() + 1;
  const currentYear = date.getFullYear();
  
  // Get LOP days for current month
  const lopDays = await getLOPDaysForEmployee(employeeId, currentMonth, currentYear);
  
  // Calculate payroll
  const payrollCalc = calculatePayroll(
    monthlySalary,
    lopDays,
    tdsPercent,
    date
  );
  
  if (!payrollCalc.isValid) {
    throw new Error(`Invalid payroll calculation: ${payrollCalc.errors?.join(', ')}`);
  }
  
  // Save to payroll table
  const { data, error } = await supabase
    .from('payroll')
    .upsert({
      employee_id: employeeId,
      month: currentMonth,
      year: currentYear,
      monthly_salary,
      increment,
      incentives,
      total_days_in_month: payrollCalc.totalDaysInMonth,
      lop_days: payrollCalc.lopDays,
      tds_percent: tdsPercent,
      status: 'ACTIVE'
    }, {
      onConflict: 'employee_id, month, year'
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to save payroll calculation: ${error.message}`);
  }
  
  console.log('Payroll saved successfully:', data);
  return data as PayrollRecord;
}

/**
 * Get LOP days for employee in specific month/year
 */
async function getLOPDaysForEmployee(
  employeeId: string,
  month: number,
  year: number
): Promise<number> {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    const { data, error } = await supabase
      .from('lop_entries')
      .select('lop_type')
      .eq('employee_id', employeeId)
      .gte('lop_date', startDate.toISOString().split('T')[0])
      .lte('lop_date', endDate.toISOString().split('T')[0]);

    if (error) {
      throw new Error(`Failed to fetch LOP days: ${error.message}`);
    }
    
    let totalLOPDays = 0;
    (data || []).forEach(entry => {
      const days = parseFloat(entry.lop_type.replace(/[^0-9.]/g, ''));
      totalLOPDays += days;
    });
    
    return totalLOPDays;
  } catch (error) {
    throw error;
  }
}

/**
 * Get payroll record for employee for current month
 */
export async function getCurrentPayroll(employeeId: string): Promise<PayrollRecord | null> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  
  const { data, error } = await supabase
    .from('payroll')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('month', month)
    .eq('year', year)
    .single();
  
  if (error) {
    console.warn('Failed to fetch current payroll:', error);
    return null;
  }
  
  return data as PayrollRecord;
}

/**
 * Get all payroll records for current month
 */
export async function getCurrentMonthPayroll(): Promise<PayrollRecord[]> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  
  try {
    const { data, error } = await supabase
      .from('payroll')
      .select(`
        *,
        profiles!inner (
          name,
          department
        )
      `)
      .eq('month', month)
      .eq('year', year)
      .order('profiles.name');
    
    if (error) {
      // If payroll table doesn't exist, return empty array
      if (error.code === 'PGRST116' || error.message.includes('relation "public.payroll" does not exist')) {
        console.warn('Payroll table does not exist yet, returning empty array');
        return [];
      }
      throw new Error(`Failed to fetch current month payroll: ${error.message}`);
    }
    
    return (data || []) as PayrollRecord[];
  } catch (error: any) {
    // Handle any other errors gracefully
    console.warn('Error fetching payroll:', error.message);
    return [];
  }
}

/**
 * Revert a finalized payroll run back to DRAFT status
 */
export async function unfinalizePayroll(
  payrollRunId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('payroll_runs')
      .update({ status: 'DRAFT', updated_at: new Date().toISOString() })
      .eq('id', payrollRunId)
      .eq('status', 'FINAL');

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
