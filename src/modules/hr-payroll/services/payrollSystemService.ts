// @ts-nocheck
import { supabase } from '../../../integrations/supabase/client';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface Profile {
  id: string;
  name: string;
  department: string;
}

export interface EmployeeMaster {
  id: string;
  employee_id: string;
  basic_salary: number;
  increment: number;
  incentive: number;
  tds_percent: number;
  created_at: string;
  updated_at: string;
}

export interface LOPEntry {
  id: string;
  employee_id: string;
  lop_days: number;
  reason?: string;
  lop_date: string;
  created_at: string;
  updated_at: string;
}

export interface PayrollSummary {
  employee_uuid: string;
  id: string;
  name: string;
  department: string;
  basic_salary: number;
  increment: number;
  incentive: number;
  lop_days: number;
  daily_salary: number;
  lop_amount: number;
  gross_salary: number;
  salary_after_lop: number;
  tds_percent: number;
  tds_amount: number;
  final_salary: number;
  has_salary_record: boolean;
}

export interface PayrollInput {
  employee_id: string;
  basic_salary: number;
  increment?: number;
  incentive?: number;
  tds_percent?: number;
}

// =====================================================
// PROFILE OPERATIONS
// =====================================================

/**
 * Fetch all profiles (employees)
 */
export async function fetchProfiles(): Promise<Profile[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, department')
      .order('name');

    if (error) {
      console.error('Error fetching profiles:', error);
      throw new Error(`Failed to fetch profiles: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchProfiles:', error);
    throw error;
  }
}

/**
 * Fetch profiles by department
 */
export async function fetchProfilesByDepartment(department: string): Promise<Profile[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, department')
      .eq('department', department)
      .order('name');

    if (error) {
      console.error('Error fetching profiles by department:', error);
      throw new Error(`Failed to fetch profiles by department: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchProfilesByDepartment:', error);
    throw error;
  }
}

// =====================================================
// EMPLOYEE MASTER OPERATIONS
// =====================================================

/**
 * Fetch all employee master records
 */
export async function fetchEmployeeMaster(): Promise<EmployeeMaster[]> {
  try {
    const { data, error } = await supabase
      .from('employee_master')
      .select('*')
      .order('created_at');

    if (error) {
      console.error('Error fetching employee master:', error);
      throw new Error(`Failed to fetch employee master: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchEmployeeMaster:', error);
    throw error;
  }
}

/**
 * Get employee master record for a specific employee
 */
export async function getEmployeeMaster(employeeId: string): Promise<EmployeeMaster | null> {
  try {
    const { data, error } = await supabase
      .from('employee_master')
      .select('*')
      .eq('employee_id', employeeId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Error getting employee master:', error);
      throw new Error(`Failed to get employee master: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Error in getEmployeeMaster:', error);
    throw error;
  }
}

/**
 * Create or update employee master record
 */
export async function upsertEmployeeMaster(input: PayrollInput): Promise<EmployeeMaster> {
  try {
    const { data, error } = await supabase
      .from('employee_master')
      .upsert({
        employee_id: input.employee_id,
        basic_salary: input.basic_salary,
        increment: input.increment || 0,
        incentive: input.incentive || 0,
        tds_percent: input.tds_percent || 1.0,
      })
      .select()
      .single();

    if (error) {
      console.error('Error upserting employee master:', error);
      throw new Error(`Failed to upsert employee master: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Error in upsertEmployeeMaster:', error);
    throw error;
  }
}

/**
 * Delete employee master record
 */
export async function deleteEmployeeMaster(employeeId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('employee_master')
      .delete()
      .eq('employee_id', employeeId);

    if (error) {
      console.error('Error deleting employee master:', error);
      throw new Error(`Failed to delete employee master: ${error.message}`);
    }
  } catch (error) {
    console.error('Error in deleteEmployeeMaster:', error);
    throw error;
  }
}

// =====================================================
// LOP ENTRIES OPERATIONS
// =====================================================

/**
 * Fetch all LOP entries
 */
export async function fetchLOPEntries(): Promise<LOPEntry[]> {
  try {
    const { data, error } = await supabase
      .from('lop_entries')
      .select('*')
      .order('lop_date', { ascending: false });

    if (error) {
      console.error('Error fetching LOP entries:', error);
      throw new Error(`Failed to fetch LOP entries: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchLOPEntries:', error);
    throw error;
  }
}

/**
 * Fetch LOP entries for a specific employee
 */
export async function getLOPEntriesByEmployee(employeeId: string): Promise<LOPEntry[]> {
  try {
    const { data, error } = await supabase
      .from('lop_entries')
      .select('*')
      .eq('employee_id', employeeId)
      .order('lop_date', { ascending: false });

    if (error) {
      console.error('Error fetching LOP entries by employee:', error);
      throw new Error(`Failed to fetch LOP entries by employee: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error in getLOPEntriesByEmployee:', error);
    throw error;
  }
}

/**
 * Get total LOP days for an employee
 */
export async function getTotalLOPDays(employeeId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('lop_entries')
      .select('lop_days')
      .eq('employee_id', employeeId);

    if (error) {
      console.error('Error getting total LOP days:', error);
      throw new Error(`Failed to get total LOP days: ${error.message}`);
    }

    const totalDays = data?.reduce((sum, entry) => sum + entry.lop_days, 0) || 0;
    return totalDays;
  } catch (error) {
    console.error('Error in getTotalLOPDays:', error);
    throw error;
  }
}

/**
 * Add LOP entry
 */
export async function addLOPEntry(entry: Omit<LOPEntry, 'id' | 'created_at' | 'updated_at'>): Promise<LOPEntry> {
  try {
    const { data, error } = await supabase
      .from('lop_entries')
      .insert(entry)
      .select()
      .single();

    if (error) {
      console.error('Error adding LOP entry:', error);
      throw new Error(`Failed to add LOP entry: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Error in addLOPEntry:', error);
    throw error;
  }
}

/**
 * Update LOP entry
 */
export async function updateLOPEntry(id: string, updates: Partial<LOPEntry>): Promise<LOPEntry> {
  try {
    const { data, error } = await supabase
      .from('lop_entries')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating LOP entry:', error);
      throw new Error(`Failed to update LOP entry: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Error in updateLOPEntry:', error);
    throw error;
  }
}

/**
 * Delete LOP entry
 */
export async function deleteLOPEntry(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('lop_entries')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting LOP entry:', error);
      throw new Error(`Failed to delete LOP entry: ${error.message}`);
    }
  } catch (error) {
    console.error('Error in deleteLOPEntry:', error);
    throw error;
  }
}

// =====================================================
// PAYROLL SUMMARY OPERATIONS
// =====================================================

/**
 * Fetch complete payroll summary
 */
export async function fetchPayrollSummary(): Promise<PayrollSummary[]> {
  try {
    const { data, error } = await supabase
      .from('payroll_summary')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching payroll summary:', error);
      throw new Error(`Failed to fetch payroll summary: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchPayrollSummary:', error);
    throw error;
  }
}

/**
 * Fetch payroll summary by department
 */
export async function fetchPayrollSummaryByDepartment(department: string): Promise<PayrollSummary[]> {
  try {
    const { data, error } = await supabase
      .from('payroll_summary')
      .select('*')
      .eq('department', department)
      .order('name');

    if (error) {
      console.error('Error fetching payroll summary by department:', error);
      throw new Error(`Failed to fetch payroll summary by department: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchPayrollSummaryByDepartment:', error);
    throw error;
  }
}

/**
 * Get payroll statistics
 */
export async function getPayrollStatistics(): Promise<{
  total_employees: number;
  employees_with_salary: number;
  total_basic_salary: number;
  total_final_salary: number;
  average_final_salary: number;
  total_lop_amount: number;
  total_tds_amount: number;
}> {
  try {
    const { data, error } = await supabase
      .from('payroll_summary')
      .select('*');

    if (error) {
      console.error('Error getting payroll statistics:', error);
      throw new Error(`Failed to get payroll statistics: ${error.message}`);
    }

    const payrollData = data || [];
    
    const stats = {
      total_employees: payrollData.length,
      employees_with_salary: payrollData.filter(emp => emp.has_salary_record).length,
      total_basic_salary: payrollData.reduce((sum, emp) => sum + emp.basic_salary, 0),
      total_final_salary: payrollData.reduce((sum, emp) => sum + emp.final_salary, 0),
      average_final_salary: 0,
      total_lop_amount: payrollData.reduce((sum, emp) => sum + emp.lop_amount, 0),
      total_tds_amount: payrollData.reduce((sum, emp) => sum + emp.tds_amount, 0),
    };

    stats.average_final_salary = stats.employees_with_salary > 0 
      ? stats.total_final_salary / stats.employees_with_salary 
      : 0;

    return stats;
  } catch (error) {
    console.error('Error in getPayrollStatistics:', error);
    throw error;
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Format currency to Indian Rupees
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

/**
 * Format number with specified decimal places
 */
export const formatNumber = (value: number, decimals: number = 2): string => {
  return value.toFixed(decimals);
};

/**
 * Calculate payroll manually (for validation)
 */
export const calculatePayroll = (
  basicSalary: number,
  increment: number,
  incentive: number,
  lopDays: number,
  tdsPercent: number = 1.0
): {
  dailySalary: number;
  lopAmount: number;
  grossSalary: number;
  salaryAfterLOP: number;
  tdsAmount: number;
  finalSalary: number;
} => {
  const dailySalary = basicSalary / 30;
  const lopAmount = dailySalary * lopDays;
  const grossSalary = basicSalary + increment + incentive;
  const salaryAfterLOP = grossSalary - lopAmount;
  const tdsAmount = salaryAfterLOP * (tdsPercent / 100);
  const finalSalary = salaryAfterLOP - tdsAmount;

  return {
    dailySalary,
    lopAmount,
    grossSalary,
    salaryAfterLOP,
    tdsAmount,
    finalSalary
  };
};
