// Employee interface for HR Payroll module
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
  basic_salary?: number;
  created_at?: string;
  updated_at?: string;
}

// Alternative interface that matches the user's requested field names
export interface EmployeeWithProfileId {
  id?: string;
  profileId?: string;
  name?: string;
  employeeId?: string;
  phoneNumber?: string;
  email?: string;
  department?: string;
  locationType?: string;
  status?: string;
  basicSalary?: number;
  bonus?: number;
  increment?: number;
  incentive?: number;
  totalSalary?: number;
  createdAt?: string;
  updatedAt?: string;
}
