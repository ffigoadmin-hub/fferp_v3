/**
 * salaryWorkflowService.ts
 * Replacement for the missing @/modules/salary-workflow module.
 * Provides batch-level salary data access for the Employee Master page.
 */
import { supabase } from '@/integrations/supabase/client';

export interface SalaryBatch {
  id: string;
  batch_code: string | null;
  month: number;
  year: number;
  department: string | null;
  status: string;
  total_employees: number;
  total_net_pay: number;
  total_lop_amount: number;
  total_tds: number;
  from_day: number | null;
  to_day: number | null;
  prepared_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalaryBatchEmployee {
  id: string;
  batch_id: string;
  employee_id: string;
  profile_id: string | null;
  employee_name: string | null;
  department: string | null;
  days_in_month: number | null;
  selected_days: number | null;
  basic_salary: number | null;
  per_day_salary: number | null;
  earned_salary: number | null;
  lop_days: number | null;
  lop_bucket: string | null;
  lop_amount: number | null;
  incentive: number | null;
  increment: number | null;
  tds: number | null;
  net_pay: number | null;
  final_salary: number | null;
  bank_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  status: string | null;
}

/**
 * Fetch a single salary batch by ID.
 */
export const getSalaryBatch = async (batchId: string): Promise<SalaryBatch | null> => {
  try {
    const { data, error } = await (supabase as any)
      .from('salary_batches')
      .select('*')
      .eq('id', batchId)
      .single();

    if (error) {
      console.error('[salaryWorkflowService] getSalaryBatch error:', error);
      throw error;
    }
    return data as SalaryBatch;
  } catch (err) {
    console.error('[salaryWorkflowService] getSalaryBatch failed:', err);
    return null;
  }
};

/**
 * Fetch all employees for a given salary batch.
 * Returns data shaped for the EmployeeMasterPage PayrollEmployeeRow.
 */
export const getSalaryBatchEmployees = async (batchId: string): Promise<any[]> => {
  try {
    const { data, error } = await (supabase as any)
      .from('salary_batch_employees')
      .select('*')
      .eq('batch_id', batchId)
      .order('employee_name', { ascending: true });

    if (error) {
      console.error('[salaryWorkflowService] getSalaryBatchEmployees error:', error);
      throw error;
    }

    // Map to PayrollEmployeeRow shape expected by EmployeeMasterPage
    return (data || []).map((emp: SalaryBatchEmployee) => {
      const basic = Number(emp.basic_salary) || 0;
      const perDay = Number(emp.per_day_salary) || 0;
      const earned = Number(emp.earned_salary) || 0;
      const lopDays = Number(emp.lop_days) || 0;
      const lopAmount = Number(emp.lop_amount) || 0;
      const increment = Number(emp.increment) || 0;
      const incentive = Number(emp.incentive) || 0;
      const tds = Number(emp.tds) || 0;
      const netPay = Number(emp.net_pay) || 0;
      const rawFinal = Number(emp.final_salary);
      // Prefer net_pay when legacy final_salary column is present but stale/zero.
      const finalSalary = Number.isFinite(rawFinal) && rawFinal > 0 ? rawFinal : netPay;

      return {
      row_id: emp.id,
      profile_id: emp.profile_id || emp.employee_id,
      name: emp.employee_name ?? '',
      department: emp.department ?? '',
      basic_salary: basic,
      bank_name: emp.bank_name ?? '',
      account_number: emp.account_number ?? '',
      ifsc_code: emp.ifsc_code ?? '',
      increment,
      incentive,
      lop_days: lopDays,
      lop_amount: lopAmount,
      tds,
      tds_percent: 1,
      days_in_month: Number(emp.days_in_month) || 30,
      selected_days: Number(emp.selected_days) || 30,
      final_salary: finalSalary,
      per_day_salary: perDay,
      earned_salary: earned,
    };
    });
  } catch (err) {
    console.error('[salaryWorkflowService] getSalaryBatchEmployees failed:', err);
    return [];
  }
};
