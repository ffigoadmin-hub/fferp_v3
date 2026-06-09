export type EmployeeStatus = "ACTIVE" | "INACTIVE";

export interface Employee {
  id: string; // uuid PK
  employee_id: string; // unique business ID
  full_name: string;
  joining_date: string; // ISO date
  phone_number: string;
  dob: string | null;
  emergency_contact_number: string | null;
  address: string | null;
  department: string | null;
  location_type: string | null;
  location_name: string | null;
  status: EmployeeStatus;
  fixed_monthly_salary: number; // HR/Admin only — never exposed to employee
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  user_id: string | null; // linked auth.users id for self-service
  created_at: string;
  updated_at: string;
}

/** Employee data safe for employee self-service — no salary */
export type EmployeeProfile = Omit<Employee, "fixed_monthly_salary">;

export type PayrollRunStatus = "DRAFT" | "FINALIZED";

export interface PayrollRun {
  id: string;
  month: number; // 1-12
  year: number;
  status: PayrollRunStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PayrollItem {
  id: string;
  payroll_run_id: string;
  employee_id: string; // FK -> employees.id
  employee_business_id: string; // denormalized for display
  employee_name: string; // denormalized
  salary_override: number | null;
  bonus: number;
  incentive: number;
  lop_days: number;
  days_in_month: number;
  payable_days: number;
  daily_salary: number;
  base_pay: number;
  earned: number;
  gross: number;
  tds: number;
  pf: number;
  esi: number;
  net_pay: number;
  created_at: string;
  updated_at: string;
}

export interface PayslipDocument {
  id: string;
  payroll_item_id: string;
  storage_path: string;
  generated_at: string;
}

export interface PayrollCalcInput {
  monthlySalary: number;
  daysInMonth: number;
  joiningDate: string; // ISO date
  payrollMonth: number; // 1-12
  payrollYear: number;
  lopDays: number;
  bonus: number;
  incentive: number;
}

export interface PayrollCalcResult {
  dailySalary: number;
  payableDays: number;
  basePay: number;
  earned: number;
  gross: number;
  tds: number;
  pf: number;
  esi: number;
  netPay: number;
}
