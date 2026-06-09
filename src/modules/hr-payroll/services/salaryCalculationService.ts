import { supabase } from '../../../integrations/supabase/client';

export interface EmployeeSalaryWithLOP {
  id: string;
  employee_id: string;
  full_name: string;
  department: string;
  fixed_monthly_salary: number;
  increment: number;
  incentive: number;
  lop_days: number;
  status: 'ACTIVE' | 'INACTIVE';
  gross_salary: number;
  tds: number;
  net_salary: number;
}

/**
 * Fetch employee data with LOP entries and calculate salary
 * Uses the current employees table schema
 */
export async function fetchEmployeeSalaryWithLOP(): Promise<EmployeeSalaryWithLOP[]> {
  try {
    // Use the fallback method since execute_sql RPC doesn't exist
    return await fetchEmployeeSalaryWithLOPFallback();
  } catch (error) {
    console.error('Error in fetchEmployeeSalaryWithLOP:', error);
    throw error;
  }
}

/**
 * Fallback method using individual queries
 */
async function fetchEmployeeSalaryWithLOPFallback(): Promise<EmployeeSalaryWithLOP[]> {
  try {
    // Try to fetch employees with increment and incentive, but handle missing columns
    const { data, error } = await supabase
      .from('employees')
      .select(`
        id,
        employee_id,
        full_name,
        department,
        fixed_monthly_salary,
        status
      `);

    if (error) {
      console.error('Error fetching employees:', error);
      throw new Error(`Failed to fetch employees: ${error.message}`);
    }

    // Try to fetch increment and incentive separately (in case columns exist)
    const { data: incrementData, error: incrementError } = await supabase
      .from('employees')
      .select('id, increment, incentive')
      .not('increment', 'is', null);

    // Create a map for increment and incentive data
    const incrementMap = new Map<string, { increment: number; incentive: number }>();
    if (!incrementError && incrementData) {
      (incrementData as any[]).forEach((emp: any) => {
        incrementMap.set(emp.id || '', {
          increment: emp.increment || 0,
          incentive: emp.incentive || 0
        });
      });
    } else if (incrementError) {
      // Log the error but continue without increment/incentive data
      console.log('Increment/Incentive columns do not exist or are not accessible:', incrementError.message);
    }

    // Fetch LOP entries separately
    const { data: lopData, error: lopError } = await supabase
      .from('lop_entries')
      .select('employee_id, lop_type');

    if (lopError) {
      console.error('Error fetching LOP entries:', lopError);
      throw new Error(`Failed to fetch LOP entries: ${lopError.message}`);
    }

    // Group LOP days by employee_id and convert lop_type to numeric days
    const lopMap = new Map<string, number>();
    lopData?.forEach(entry => {
      const currentDays = lopMap.get(entry.employee_id) || 0;
      let lopDays = 0;
      
      // Convert lop_type to numeric days
      switch (entry.lop_type) {
        case '1_day':
          lopDays = 1;
          break;
        case '0.5_day':
          lopDays = 0.5;
          break;
        case '0.25_day':
          lopDays = 0.25;
          break;
        default:
          lopDays = 0;
      }
      
      lopMap.set(entry.employee_id, currentDays + lopDays);
    });

    // Calculate salaries
    const employeesWithSalary: EmployeeSalaryWithLOP[] = (data || [])
      .filter((employee: any) => employee.status === 'ACTIVE')
      .map((employee: any) => {
        const lopDays = lopMap.get(employee.employee_id || '') || 0;
        const basicSalary = employee.fixed_monthly_salary || 0;
        const incrementData = incrementMap.get(employee.id || '') || { increment: 0, incentive: 0 };
        const increment = incrementData.increment;
        const incentive = incrementData.incentive;
        
        // Calculate LOP deduction (proportional: basic_salary * lop_days / 30)
        const lopDeduction = (basicSalary * lopDays) / 30;
        
        // Calculate gross salary (basic + increment + incentive - LOP deduction)
        const grossSalary = basicSalary + increment + incentive - lopDeduction;
        
        // Calculate TDS (1% of gross salary)
        const tds = grossSalary * 0.01;
        
        // Calculate net salary (gross salary - TDS)
        const netSalary = grossSalary - tds;

        return {
          id: employee.id || '',
          employee_id: employee.employee_id || '',
          full_name: employee.full_name || '',
          department: employee.department || '',
          fixed_monthly_salary: basicSalary,
          increment: increment,
          incentive: incentive,
          lop_days: lopDays,
          status: employee.status as 'ACTIVE' | 'INACTIVE',
          gross_salary: Math.round(grossSalary * 100) / 100, // Round to 2 decimal places
          tds: Math.round(tds * 100) / 100,
          net_salary: Math.round(netSalary * 100) / 100
        };
      });

    return employeesWithSalary;
  } catch (error) {
    console.error('Error in fetchEmployeeSalaryWithLOPFallback:', error);
    throw error;
  }
}

/**
 * Note: To add increment and incentive columns to employees table, run these SQL commands manually:
 * ALTER TABLE employees ADD COLUMN IF NOT EXISTS increment DECIMAL(12,2) DEFAULT 0;
 * ALTER TABLE employees ADD COLUMN IF NOT EXISTS incentive DECIMAL(12,2) DEFAULT 0;
 */
export async function addIncrementAndIncentiveColumns(): Promise<void> {
  // This function would require SQL execution capabilities
  // For now, provide the SQL commands for manual execution
  console.log('To add increment and incentive columns, run these SQL commands manually:');
  console.log('ALTER TABLE employees ADD COLUMN IF NOT EXISTS increment DECIMAL(12,2) DEFAULT 0;');
  console.log('ALTER TABLE employees ADD COLUMN IF NOT EXISTS incentive DECIMAL(12,2) DEFAULT 0;');
}

/**
 * Utility function to format currency
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};
