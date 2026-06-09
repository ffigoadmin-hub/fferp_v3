import { supabase } from '@/integrations/supabase/client';

export interface SalaryAnalysis {
  id: string;
  employee_id: string;
  full_name: string;
  department: string;
  status: string;
  fixed_monthly_salary: number;
  increment_amount: number;
  incentive: number;
  bonus: number;
  lop_days: number;
  lop_amount: number;
  gross_salary: number;
  tds_amount: number;
  net_salary: number;
}

export async function getSalaryAnalysis(month: number, year: number): Promise<SalaryAnalysis[]> {
  const { data, error } = await supabase
    .rpc('get_salary_analysis' as any, {
      p_month: month,
      p_year: year
    });

  if (error) throw new Error(`Failed to fetch salary analysis: ${error.message}`);
  
  // Normalize numeric fields to ensure they're never undefined/null
  return (data as any[]).map((analysis: any): SalaryAnalysis => ({
    id: analysis.id || '',
    employee_id: analysis.employee_id || '',
    full_name: analysis.full_name || '',
    department: analysis.department || '',
    status: analysis.status || '',
    fixed_monthly_salary: Number(analysis.fixed_monthly_salary) || 0,
    increment_amount: Number(analysis.increment_amount) || 0,
    incentive: Number(analysis.incentive) || 0,
    bonus: Number(analysis.bonus) || 0,
    lop_days: Number(analysis.lop_days) || 0,
    lop_amount: Number(analysis.lop_amount) || 0,
    gross_salary: Number(analysis.gross_salary) || 0,
    tds_amount: Number(analysis.tds_amount) || 0,
    net_salary: Number(analysis.net_salary) || 0
  }));
}

export function exportSalaryAnalysisToExcel(analysis: SalaryAnalysis[]) {
  const XLSX = require('xlsx');
  
  const ws = XLSX.utils.json_to_sheet(analysis.map(emp => ({
    'Employee ID': emp.employee_id,
    'Name': emp.full_name,
    'Department': emp.department,
    'Status': emp.status,
    'Salary': emp.fixed_monthly_salary,
    'Increment': emp.increment_amount,
    'Incentive': emp.incentive,
    'Bonus': emp.bonus,
    'LOP Days': emp.lop_days,
    'LOP Amount': emp.lop_amount,
    'Gross': emp.gross_salary,
    'TDS': emp.tds_amount,
    'Net': emp.net_salary
  })));
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Salary Analysis');
  
  const date = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `salary_analysis_${date}.xlsx`);
}
