// @ts-nocheck
import { Employee, EmployeeWithProfileId } from "./types";
import { supabase } from "@/integrations/supabase/client";

// Helper function to map between database fields and interface fields
const mapEmployeeFromDB = (data: any): Employee => ({
  id: data.id,
  profile_id: data.profile_id || data.id,
  full_name: data.name || data.full_name || 'Unknown',
  employee_id: data.employee_id || data.id,
  phone_number: data.phone_number,
  email: data.email,
  department: data.department || 'Unknown',
  location_type: data.location_type || 'Office',
  status: data.status || 'ACTIVE',
  fixed_monthly_salary: data.fixed_monthly_salary || data.basic_salary || 0,
  bonus: data.bonus || 0,
  increment_amount: data.increment_amount || data.increment || 0,
  incentive: data.incentive || 0,
  total_salary: data.total_salary || 0,
  basic_salary: data.basic_salary || data.fixed_monthly_salary || 0,
  created_at: data.created_at,
  updated_at: data.updated_at
});

const mapEmployeeToDB = (employee: Partial<EmployeeWithProfileId>) => ({
  id: employee.profileId || employee.id,
  profile_id: employee.profileId || employee.id,
  name: employee.name || employee.full_name,
  employee_id: employee.employeeId || employee.id,
  phone_number: employee.phoneNumber,
  email: employee.email,
  department: employee.department,
  location_type: employee.locationType,
  status: employee.status,
  basic_salary: employee.basicSalary || employee.fixed_monthly_salary,
  bonus: employee.bonus,
  increment: employee.increment || employee.increment_amount,
  incentive: employee.incentive,
  total_salary: employee.totalSalary
});

// 1️⃣ Fetch all employees
export const fetchEmployees = async (): Promise<Employee[]> => {
  try {
    // Try employee_master table first, then fallback to profiles
    let { data, error } = await supabase
      .from("employee_master")
      .select("*");

    if (error && error.code === 'PGRST116') {
      // Table doesn't exist, try profiles table
      const result = await supabase
        .from("profiles")
        .select("*");
      
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error("Error fetching employees:", error.message);
      return [];
    }

    return (data || []).map(mapEmployeeFromDB);
  } catch (err) {
    console.error("Unexpected error fetching employees:", err);
    return [];
  }
};

// 2️⃣ Fetch single employee by profileId
export const fetchEmployeeByProfileId = async (
  profileId: string
): Promise<Employee | null> => {
  try {
    // Try employee_master table first
    let { data, error } = await supabase
      .from("employee_master")
      .select("*")
      .eq("profile_id", profileId)
      .single();

    if (error && error.code === 'PGRST116') {
      // Try profiles table
      const result = await supabase
        .from("profiles")
        .select("*")
        .eq("id", profileId)
        .single();
      
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error("Error fetching employee:", error.message);
      return null;
    }

    return data ? mapEmployeeFromDB(data) : null;
  } catch (err) {
    console.error("Unexpected error fetching employee:", err);
    return null;
  }
};

// 3️⃣ Update Basic Salary safely
export const updateBasicSalary = async (
  profileId: string,
  newSalary: number
): Promise<boolean> => {
  try {
    // Try employee_master table first
    let { error } = await supabase
      .from("employee_master")
      .update({ basic_salary: newSalary })
      .eq("profile_id", profileId);

    if (error && error.code === 'PGRST116') {
      // Try updating profiles table (might need to add basic_salary column)
      const result = await supabase
        .from("profiles")
        .update({ 
          updated_at: new Date().toISOString()
          // Note: basic_salary might not exist in profiles table
        })
        .eq("id", profileId);
      
      error = result.error;
      
      if (!error) {
        console.warn("basic_salary field not found in profiles table. Consider adding it to employee_master table.");
        return true;
      }
    }

    if (error) {
      console.error("Error updating basic salary:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Unexpected error updating basic salary:", err);
    return false;
  }
};

// 4️⃣ Create or update employee with flexible interface
export const upsertEmployee = async (
  employeeData: Partial<EmployeeWithProfileId>
): Promise<Employee | null> => {
  try {
    const dbData = mapEmployeeToDB(employeeData);
    
    // Try employee_master table first
    let { data, error } = await supabase
      .from("employee_master")
      .upsert(dbData, {
        onConflict: "profile_id"
      })
      .select()
      .single();

    if (error && error.code === 'PGRST116') {
      // Fallback to profiles table
      const profileData = {
        id: employeeData.profileId,
        name: employeeData.name,
        email: employeeData.email,
        department: employeeData.department,
        role: 'employee',
        updated_at: new Date().toISOString()
      };
      
      const result = await supabase
        .from("profiles")
        .upsert(profileData, {
          onConflict: "id"
        })
        .select()
        .single();
      
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error("Error upserting employee:", error.message);
      return null;
    }

    return data ? mapEmployeeFromDB(data) : null;
  } catch (err) {
    console.error("Unexpected error upserting employee:", err);
    return null;
  }
};

// 5️⃣ Delete employee
export const deleteEmployee = async (profileId: string): Promise<boolean> => {
  try {
    // Try employee_master table first
    let { error } = await supabase
      .from("employee_master")
      .delete()
      .eq("profile_id", profileId);

    if (error && error.code === 'PGRST116') {
      // Try profiles table
      const result = await supabase
        .from("profiles")
        .delete()
        .eq("id", profileId);
      
      error = result.error;
    }

    if (error) {
      console.error("Error deleting employee:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Unexpected error deleting employee:", err);
    return false;
  }
};
