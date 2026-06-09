// @ts-nocheck
import { supabase } from '@/integrations/supabase/client';
import { PayrollRecord } from './payrollService';

export interface Payslip extends PayrollRecord {
  employee_name: string;
  employee_department: string;
  employee_designation?: string;
  pan_number?: string;
  bank_account_number?: string;
  payment_date?: string;
}

export async function downloadPayslip(payslipId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('payslips')
    .select('*')
    .eq('id', payslipId)
    .eq('employee_id', user.user_metadata?.employee_id)
    .single();

  if (error) {
    throw new Error(`Failed to download payslip: ${error.message}`);
  }

  // Generate PDF or return download URL
  // For now, return the data
  return data;
}

export async function getPayslipPreview(payrollRecordId: string): Promise<Payslip> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('payroll_records')
    .select(`
      *,
      employees!inner(
        full_name,
        department,
        employee_id
      )
    `)
    .eq('id', payrollRecordId)
    .eq('employee_id', user.user_metadata?.employee_id)
    .single();

  if (error) {
    throw new Error(`Failed to get payslip preview: ${error.message}`);
  }

  return {
    ...data,
    employee_name: data.employees.full_name,
    employee_department: data.employees.department,
    employee_designation: data.employees.designation,
    pan_number: data.employees.pan_number,
    bank_account_number: data.employees.bank_account_number
  } as Payslip;
}

export async function getMyPayslips(employeeId?: string): Promise<Payslip[]> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const targetEmployeeId = employeeId || user.user_metadata?.employee_id;
  
  if (!targetEmployeeId) {
    throw new Error('Employee ID not found');
  }

  const { data, error } = await supabase
    .from('payroll_records')
    .select(`
      *,
      employees!inner(
        full_name,
        department,
        employee_id
      )
    `)
    .eq('employee_id', targetEmployeeId)
    .eq('status', 'PAID')
    .order('year', { ascending: false })
    .order('month', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch payslips: ${error.message}`);
  }

  return data.map(record => ({
    ...record,
    employee_name: record.employees.full_name,
    employee_department: record.employees.department
  })) as Payslip[];
}

export async function generatePayslip(payrollRecordId: string) {
  const { data, error } = await supabase
    .from('payslips')
    .insert({
      payroll_record_id: payrollRecordId,
      generated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to generate payslip: ${error.message}`);
  }

  return data;
}

// Utility functions for payment conversion
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function toNumberSafe(value: any): number {
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

export function money(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}
