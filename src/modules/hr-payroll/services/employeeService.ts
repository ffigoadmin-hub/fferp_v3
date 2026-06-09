import { supabase } from '../../../integrations/supabase/client';

export interface Employee {
  id?: string;
  profile_id?: string;
  full_name?: string;
  employee_id?: string;
  phone_number?: string;
  email?: string;
  department?: string;
  location_type?: string;
  status?: string;
  fixed_monthly_salary?: number;
  bonus?: number;
  increment_amount?: number;
  incentive?: number;
  total_salary?: number;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeFilters {
  status?: string;
  department?: string;
  location_type?: string;
}

/**
 * Get all employees with proper error handling and filtering
 */
export async function listEmployees(q?: string, filters: EmployeeFilters = {}): Promise<Employee[]> {
  try {
    // Use profiles table instead of employees (more likely to exist)
    let query = supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (q) {
      // PostgREST OR syntax for profiles table
      query = query.or(
        `name.ilike.%${q}%,department.ilike.%${q}%,email.ilike.%${q}%`
      );
    }

    if (filters.department) query = query.eq('department', filters.department);

    const { data, error } = await query;
    
    if (error) {
      console.error('Failed to fetch profiles:', error);
      throw new Error(`Failed to fetch employees: ${error.message}`);
    }

    // Normalize numeric fields and map to Employee interface
    return (data as any[]).map(emp => ({
      id: emp.id,
      profile_id: emp.id,
      full_name: emp.name || 'Unknown',
      employee_id: emp.id,
      phone_number: '', // No phone field in profiles table
      email: emp.email || '',
      department: emp.department || 'Unknown',
      location_type: 'Office', // Default value
      status: 'ACTIVE', // Default value
      fixed_monthly_salary: 0, // Default value
      bonus: 0,
      increment_amount: 0,
      incentive: 0,
      total_salary: 0,
      created_at: emp.created_at,
      updated_at: emp.updated_at
    }));
  } catch (error) {
    console.error('Error in listEmployees:', error);
    throw error;
  }
}

/**
 * Get employee by ID
 */
export async function getEmployeeById(id: string): Promise<Employee | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch employee: ${error.message}`);
    }

    return {
      id: data.id,
      profile_id: data.id,
      full_name: data.name || 'Unknown',
      employee_id: data.id,
      phone_number: '', // No phone field in profiles table
      email: data.email || '',
      department: data.department || 'Unknown',
      location_type: 'Office',
      status: 'ACTIVE',
      fixed_monthly_salary: 0,
      bonus: 0,
      increment_amount: 0,
      incentive: 0,
      total_salary: 0,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  } catch (error) {
    console.error('Error in getEmployeeById:', error);
    throw error;
  }
}

/**
 * Create or update employee
 */
export async function upsertEmployee(employeeData: Partial<Employee>): Promise<Employee> {
  try {
    if (!employeeData.profile_id) {
      throw new Error('Profile ID is required');
    }

    // Map to profiles table structure
    const profileData = {
      id: employeeData.profile_id,
      name: employeeData.full_name,
      email: employeeData.email,
      department: employeeData.department,
      role: 'employee', // Required field - default to employee
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('profiles')
      .upsert(profileData, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to upsert employee: ${error.message}`);
    }

    return {
      id: data.id,
      profile_id: data.id,
      full_name: data.name || 'Unknown',
      employee_id: data.id,
      phone_number: '', // No phone field in profiles table
      email: data.email || '',
      department: data.department || 'Unknown',
      location_type: employeeData.location_type || 'Office',
      status: employeeData.status || 'ACTIVE',
      fixed_monthly_salary: employeeData.fixed_monthly_salary || 0,
      bonus: employeeData.bonus || 0,
      increment_amount: employeeData.increment_amount || 0,
      incentive: employeeData.incentive || 0,
      total_salary: employeeData.total_salary || 0,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  } catch (error) {
    console.error('Error in upsertEmployee:', error);
    throw error;
  }
}

/**
 * Delete employee
 */
export async function deleteEmployee(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete employee: ${error.message}`);
    }
  } catch (error) {
    console.error('Error in deleteEmployee:', error);
    throw error;
  }
}

/**
 * Department interface
 */
export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  is_active: boolean;
}

/**
 * Get departments from departments master table
 */
export async function getDepartments(): Promise<Department[]> {
  try {
    const { data, error } = await supabase
      .from('departments')
      .select('id, name, code, description, is_active')
      .eq('is_active', true)
      .order('name');

    if (error) {
      throw new Error(`Failed to fetch departments: ${error.message}`);
    }

    return (data || []) as Department[];
  } catch (error) {
    console.error('Error in getDepartments:', error);
    throw error;
  }
}

/**
 * Get employee statistics
 */
export async function getEmployeeStats(): Promise<{
  total: number;
  active: number;
  byDepartment: Record<string, number>;
}> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('department');

    if (error) {
      throw new Error(`Failed to fetch stats: ${error.message}`);
    }

    const employees = data || [];
    const byDepartment: Record<string, number> = {};

    employees.forEach(emp => {
      const dept = emp.department || 'Unknown';
      byDepartment[dept] = (byDepartment[dept] || 0) + 1;
    });

    return {
      total: employees.length,
      active: employees.length, // All profiles are considered active
      byDepartment
    };
  } catch (error) {
    console.error('Error in getEmployeeStats:', error);
    throw error;
  }
}
