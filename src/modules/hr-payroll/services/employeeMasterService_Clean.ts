import { supabase } from '../../../integrations/supabase/client';

export interface EmployeeMaster {
  id?: string;
  employee_id?: string;
  full_name?: string;
  fixed_monthly_salary?: number;
  joining_date?: string;
  department?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  bank_name?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeWithProfile extends EmployeeMaster {
  perDaySalary?: number;
  totalSalary?: number;
}

/**
 * Get all profiles for dropdown selection
 */
export async function getProfiles(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, department')
      .order('name');

    if (error) {
      console.error('Failed to fetch profiles:', error);
      throw new Error(`Failed to fetch profiles: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error in getProfiles:', error);
    throw error;
  }
}

/**
 * Get employees with profile data - Clean PostgREST syntax
 */
export const getEmployeesWithProfile = async (): Promise<EmployeeWithProfile[]> => {
  try {
    console.log('Fetching employees with profile data...');

    // Clean select query - no SQL comments
    const { data, error } = await supabase
      .from("employees")
      .select('*');

    if (error) {
      console.error('Failed to fetch employees:', error);
      throw new Error(`Failed to fetch employees: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Process data with null safety
    return data.map(emp => {
      const fixedSalary = emp.fixed_monthly_salary || 0;
      const perDaySalary = fixedSalary / 30;
      const totalSalary = fixedSalary; // No LOP calculation for now

      return {
        id: emp.id,
        employee_id: emp.employee_id,
        full_name: emp.full_name,
        department: emp.department,
        fixed_monthly_salary: fixedSalary,
        joining_date: emp.joining_date,
        status: emp.status,
        bank_name: emp.bank_name,
        bank_account_number: emp.bank_account_number,
        bank_ifsc: emp.bank_ifsc,
        perDaySalary,
        totalSalary
      } as EmployeeWithProfile;
    });
  } catch (error) {
    console.error('Error in getEmployeesWithProfile:', error);
    throw error;
  }
};

/**
 * Upsert employee master with proper error handling
 */
export async function upsertEmployeeMaster(formData: {
  employee_id?: string;
  full_name?: string;
  fixed_monthly_salary?: number;
  department?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  bank_name?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  joining_date?: string;
  phone_number?: string;
  dob?: string;
  emergency_contact_number?: string;
  address?: string;
  location_type?: string;
  location_name?: string;
}): Promise<EmployeeMaster> {
  try {
    console.log('Upserting employee master:', formData);

    // Prepare upsert data with required fields
    const dataToUpsert = {
      employee_id: formData.employee_id,
      full_name: formData.full_name || '',
      fixed_monthly_salary: formData.fixed_monthly_salary || 0,
      department: formData.department || '',
      status: formData.status || 'ACTIVE',
      bank_name: formData.bank_name,
      bank_account_number: formData.bank_account_number,
      bank_ifsc: formData.bank_ifsc,
      joining_date: formData.joining_date || new Date().toISOString().split('T')[0],
      phone_number: formData.phone_number || '',
      dob: formData.dob || new Date().toISOString().split('T')[0],
      emergency_contact_number: formData.emergency_contact_number || '',
      address: formData.address || '',
      location_type: formData.location_type || 'HEAD_OFFICE',
      location_name: formData.location_name
    };

    console.log('Upsert data prepared:', dataToUpsert);

    // Perform upsert
    const { data, error } = await supabase
      .from('employees')
      .upsert(dataToUpsert, {
        onConflict: 'employee_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Upsert error:', error);
      throw new Error(`Failed to upsert employee master: ${error.message}`);
    }

    console.log('Upsert successful:', data);
    return data as EmployeeMaster;
  } catch (error) {
    console.error('Error in upsertEmployeeMaster:', error);
    throw error;
  }
}

/**
 * Get departments for filtering
 */
export async function getDepartments(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('department');

    if (error) {
      console.error('Failed to fetch departments:', error);
      throw new Error(`Failed to fetch departments: ${error.message}`);
    }

    const departments = Array.from(new Set((data || []).map(item => item.department).filter(Boolean)));
    return departments;
  } catch (error) {
    console.error('Error in getDepartments:', error);
    throw error;
  }
}

/**
 * Utility function for safe currency formatting
 */
export const formatCurrency = (value: number | null | undefined): string => {
  const safeValue = value || 0;
  return safeValue.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

/**
 * Calculate LOP amount safely
 */
export const calculateLOPAmount = (fixedSalary: number | null | undefined, lopDays: number | null | undefined): number => {
  const salary = fixedSalary || 0;
  const days = lopDays || 0;
  return (salary / 30) * days;
};

/**
 * Calculate total salary safely
 */
export const calculateTotalSalary = (fixedSalary: number | null | undefined, lopAmount: number | null | undefined): number => {
  const salary = fixedSalary || 0;
  const lop = lopAmount || 0;
  return salary - lop;
};

/**
 * Schema validation function - Clean syntax
 */
export const validateEmployeeMasterSchema = async (): Promise<boolean> => {
  try {
    // Clean select query - no SQL comments
    const { data, error } = await supabase
      .from('employees')
      .select('fixed_monthly_salary')
      .limit(1);

    if (error) {
      console.warn('Schema validation failed:', error.message);
      return false;
    }

    console.log('Schema validation passed');
    return true;
  } catch (error) {
    console.error('Schema validation error:', error);
    return false;
  }
};
