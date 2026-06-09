// @ts-nocheck
import { supabase } from '@/integrations/supabase/client';

export interface LOPRecord {
  id?: string;
  employee_id: string;
  month: number;
  year: number;
  lop_days: number;
  created_at?: string;
  updated_at?: string;
}

export interface SalarySummary {
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
  days_in_month: number;
  daily_rate: number;
  lop_amount: number;
  gross_salary: number;
  tds_amount: number;
  net_salary: number;
}

export async function upsertLOPRecord(record: Omit<LOPRecord, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('employee_lop')
    .upsert({
      employee_id: record.employee_id,
      month: record.month,
      year: record.year,
      lop_days: record.lop_days
    }, {
      onConflict: 'employee_id,month,year'
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to upsert LOP record: ${error.message}`);
  return data as LOPRecord;
}

export async function getLOPRecord(employee_id: string, month: number, year: number) {
  const { data, error } = await supabase
    .from('employee_lop')
    .select('*')
    .eq('employee_id', employee_id)
    .eq('month', month)
    .eq('year', year)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    throw new Error(`Failed to fetch LOP record: ${error.message}`);
  }

  return data as LOPRecord | null;
}

export async function getSalarySummary(month: number, year: number): Promise<SalarySummary[]> {
  const { data, error } = await supabase
    .rpc('get_employee_salary_summary', {
      p_month: month,
      p_year: year
    });

  if (error) throw new Error(`Failed to fetch salary summary: ${error.message}`);
  
  // Normalize numeric fields to ensure they're never undefined/null
  return (data as SalarySummary[]).map(summary => ({
    ...summary,
    fixed_monthly_salary: Number(summary.fixed_monthly_salary) || 0,
    increment_amount: Number(summary.increment_amount) || 0,
    incentive: Number(summary.incentive) || 0,
    bonus: Number(summary.bonus) || 0,
    lop_days: Number(summary.lop_days) || 0,
    daily_rate: Number(summary.daily_rate) || 0,
    lop_amount: Number(summary.lop_amount) || 0,
    gross_salary: Number(summary.gross_salary) || 0,
    tds_amount: Number(summary.tds_amount) || 0,
    net_salary: Number(summary.net_salary) || 0
  }));
}

export async function deleteLOPRecord(employee_id: string, month: number, year: number) {
  const { error } = await supabase
    .from('employee_lop')
    .delete()
    .eq('employee_id', employee_id)
    .eq('month', month)
    .eq('year', year);

  if (error) throw new Error(`Failed to delete LOP record: ${error.message}`);
}

export async function getAllLOPRecords(month?: number, year?: number): Promise<LOPRecord[]> {
  let query = supabase.from('employee_lop').select('*');
  
  if (month) query = query.eq('month', month);
  if (year) query = query.eq('year', year);
  
  const { data, error } = await query.order('employee_id').order('month').order('year');
  
  if (error) throw new Error(`Failed to fetch LOP records: ${error.message}`);
  
  // Normalize numeric fields
  return (data as LOPRecord[]).map(record => ({
    ...record,
    lop_days: Number(record.lop_days) || 0
  }));
}
