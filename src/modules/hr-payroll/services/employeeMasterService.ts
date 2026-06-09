// @ts-nocheck
import { supabase } from '@/integrations/supabase/client';

// 1️⃣ Safer Profile interface
export interface Profile {
  id: string;
  name: string;
  department: string;
  created_at?: string;
  updated_at?: string;
}

// 2️⃣ Safer LOP Entry interface  
export interface LopEntry {
  id?: string;
  profile_id: string;
  lop_type: '1_day' | '0.5_day' | '0.25_day';
  status: 'approved' | 'pending' | 'rejected';
  lop_date: string;
  reason?: string;
  created_at?: string;
}

// 3️⃣ Safer Employee Master interface
export interface EmployeeMaster {
  id?: string;
  employee_id?: string;
  profile_id: string;
  basic_salary: number;
  increment?: number;
  incentive?: number;
  tds_percent?: number;
  // Bank details
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  designation?: string;
  doj?: string;
  bank?: string;
  pf?: string;
  esi?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

// 4️⃣ Safer Employee with Profile interface
export interface EmployeeWithProfile {
  id: string;
  name: string;
  department: string;
  basic_salary: number;
  increment: number;
  incentive: number;
  tds_percent: number;
  // Bank details
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  // Auto-calculated fields
  days_in_month: number;
  selected_days: number;
  selected_days_salary: number; // NEW: salary for selected days
  salary_for_days: number; // NEW: for direct calculation updates
  tds_amount: number; // NEW: for direct calculation updates
  final_salary: number; // NEW: for direct calculation updates
  gross_for_selected_days: number; // NEW: gross salary for selected days
  calculation_from_date: string; // NEW: calculation date range start
  calculation_to_date: string; // NEW: calculation date range end
  lop_days: number;
  one_day_salary: number;
  earned_salary: number;
  lop_amount: number;
  gross_salary: number;
  tds_1_percent: number;
  final_total_salary: number;
  // Additional fields
  designation?: string;
  doj?: string;
  bank?: string;
  pf?: string;
  esi?: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  calculation_type?: string;
  from_date?: string | null;
  to_date?: string | null;
}

// 5️⃣ Payroll calculation result interface
export interface PayrollCalculation {
  profileId: string;
  employeeName: string;
  department: string;
  basicSalary: string;
  daysInMonth: number;
  selectedDays: number;
  lopDeduction: number;
  perDaySalary: string;
  lopAmount: string;
  salaryAfterLop: string;
  tds: string;
  finalSalary: string;
}

// 6️⃣ Employee Master Upsert interface
export interface EmployeeMasterUpsertData {
  employee_id?: string;
  name?: string;
  department?: string;
  basic_salary?: number;
  increment?: number;
  incentive?: number;
  tds_percent?: number;
  salary?: number;
  // Bank details
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
}

// 6️⃣ Safe data fetching functions
// Define database response types
type DatabaseProfile = {
  id: string;
  name?: string;
  department?: string;
  created_at?: string;
  updated_at?: string;
};

type DatabaseLOPEntry = {
  id?: string;
  employee_id: string;
  lop_type: string; // Supabase returns string, not union type
  status: string;   // Supabase returns string, not union type
  lop_date: string;
  reason?: string;
  created_at?: string;
};

type DatabaseEmployeeMaster = {
  id?: string;
  employee_id?: string;
  profile_id: string;
  basic_salary?: number;
  increment?: number;
  incentive?: number;
  tds_percent?: number;
  // Bank details
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  designation?: string;
  doj?: string;
  bank?: string;
  pf?: string;
  esi?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

export const fetchProfilesSafely = async (): Promise<Profile[]> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, department, created_at, updated_at');

    if (error) {
      console.error('Error fetching profiles:', error);
      return [];
    }

    // Filter out invalid profiles and ensure required fields
    return (data || [])
      .filter((profile: DatabaseProfile): profile is Profile => 
        profile && 
        typeof profile.id === 'string' && 
        typeof profile.name === 'string' && 
        typeof profile.department === 'string'
      )
      .map((profile: DatabaseProfile): Profile => ({
        id: profile.id,
        name: profile.name || 'Unknown',
        department: profile.department || 'Unknown',
        created_at: profile.created_at,
        updated_at: profile.updated_at
      }));
  } catch (error) {
    console.error('Unexpected error fetching profiles:', error);
    return [];
  }
};

export const fetchLopEntriesSafely = async (
  profileId: string, 
  startDate: string, 
  endDate: string
): Promise<LopEntry[]> => {
  try {
    const { data, error } = await supabase
      .from('lop_entries')
      .select('id, employee_id, lop_type, status, lop_date, reason, created_at')
      .eq('employee_id', profileId)
      .eq('status', 'approved')
      .gte('lop_date', startDate)
      .lt('lop_date', endDate);

    if (error) {
      console.error('Error fetching LOP entries:', error);
      return [];
    }

    // Filter and validate LOP entries, then map to LopEntry interface
    return (data || [])
      .filter((entry: DatabaseLOPEntry) => 
        entry && 
        typeof entry.employee_id === 'string' &&
        ['1_day', '0.5_day', '0.25_day'].includes(entry.lop_type) &&
        ['approved', 'pending', 'rejected'].includes(entry.status) &&
        typeof entry.lop_date === 'string'
      )
      .map((entry: DatabaseLOPEntry): LopEntry => ({
        id: entry.id,
        profile_id: entry.employee_id, // Map employee_id to profile_id for interface compatibility
        lop_type: entry.lop_type as '1_day' | '0.5_day' | '0.25_day', // Type assertion since we filtered it
        status: entry.status as 'approved' | 'pending' | 'rejected',   // Type assertion since we filtered it
        lop_date: entry.lop_date,
        reason: entry.reason,
        created_at: entry.created_at
      }));
  } catch (error) {
    console.error('Unexpected error fetching LOP entries:', error);
    return [];
  }
};

// 7️⃣ Safe payroll calculation function
export const calculatePayrollSafely = (
  profiles: Profile[],
  employeeMasterData: EmployeeMaster[],
  lopEntriesMap: Map<string, LopEntry[]>,
  daysInMonth: number
): PayrollCalculation[] => {
  return profiles
    .filter(profile => profile && profile.id)
    .map(profile => {
      // Get employee master data
      const empMaster = employeeMasterData.find(emp => emp.profile_id === profile.id);
      const basicSalary = empMaster?.basic_salary || 0;
      
      // Get LOP entries for this employee
      const empLops = lopEntriesMap.get(profile.id) || [];
      const lopDeduction = empLops.reduce((sum, entry) => {
        const fraction = entry.lop_type === '1_day' ? 1.0 : 
                        entry.lop_type === '0.5_day' ? 0.5 : 
                        entry.lop_type === '0.25_day' ? 0.25 : 0;
        return sum + fraction;
      }, 0);

      // Calculate payroll safely
      const perDaySalary = daysInMonth > 0 ? basicSalary / daysInMonth : 0;
      const lopAmount = perDaySalary * lopDeduction;
      const salaryAfterLop = basicSalary - lopAmount;
      const tds = salaryAfterLop * 0.01;
      const finalSalary = salaryAfterLop - tds;
      const selectedDays = daysInMonth - lopDeduction;

      return {
        profileId: profile.id,
        employeeName: profile.name || "N/A",
        department: profile.department || "N/A",
        basicSalary: basicSalary.toFixed(2),
        daysInMonth: daysInMonth,
        selectedDays: Math.max(0, selectedDays),
        lopDeduction: lopDeduction,
        perDaySalary: perDaySalary.toFixed(2),
        lopAmount: lopAmount.toFixed(2),
        salaryAfterLop: Math.max(0, salaryAfterLop).toFixed(2),
        tds: tds.toFixed(2),
        finalSalary: Math.max(0, finalSalary).toFixed(2),
      };
    });
};


/**
 * Calculate salary for ALL employees based on calendar date range
 */
export const calculateSalaryForAllEmployees = async (
  fromDate: Date,
  toDate: Date
): Promise<{
  id: string;
  name: string;
  department: string;
  basic_salary: number;
  increment: number;
  incentive: number;
  selected_days: number;
  total_days_in_month: number;
  per_day_salary: number;
  selected_days_salary: number; // NEW: salary for selected days
  lop_days: number;
  lop_amount: number;
  tds_1_percent: number;
  final_salary: number;
  from_date: string;
  to_date: string;
  calculation_month: string;
}[]> => {
  try {
    console.log('Calculating salary for all employees from', fromDate, 'to', toDate);
    
    // Get all employees with their basic salary data
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, department');

    if (profileError) {
      console.error('Failed to fetch profiles:', profileError);
      throw new Error(`Failed to fetch profiles: ${profileError.message}`);
    }

    // Get employee master data
    const profileIds = profiles.map(p => p.id);
    const { data: employeeData, error: employeeError } = await supabase
      .from('employee_master')
      .select('*')
      .in('profile_id', profileIds);

    if (employeeError) {
      console.error('Failed to fetch employee master data:', employeeError);
      throw new Error(`Failed to fetch employee master data: ${employeeError.message}`);
    }

    // Create employee data map
    const employeeMap = new Map<string, DatabaseEmployeeMaster>();
    (employeeData as DatabaseEmployeeMaster[] || []).forEach(emp => {
      employeeMap.set(emp.profile_id, emp);
    });

    // Calculate date range details
    const selectedDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 3600 * 24)) + 1;
    const totalDaysInMonth = new Date(fromDate.getFullYear(), fromDate.getMonth() + 1, 0).getDate();
    
    // Get LOP data for the month
    const startDate = `${fromDate.getFullYear()}-${(fromDate.getMonth() + 1).toString().padStart(2, '0')}-01`;
    const nextMonthStart = fromDate.getMonth() === 11 
      ? `${fromDate.getFullYear() + 1}-01-01` 
      : `${fromDate.getFullYear()}-${(fromDate.getMonth() + 2).toString().padStart(2, '0')}-01`;

    // Calculate salary for each employee
    const calculatedSalaries = await Promise.all(
      profiles.filter(profile => profile && profile.id).map(async (profile: any) => {
        console.log(`Calculating salary for employee: ${profile.name || 'Unknown'}`);
        
        // Get LOP data for this employee
        const { data: lopData, error: lopError } = await supabase
          .from('lop_entries')
          .select('lop_type, status, lop_date')
          .eq('employee_id', profile.id)
          .eq('status', 'approved')
          .gte('lop_date', startDate)
          .lt('lop_date', nextMonthStart);

        let totalLOP = 0;
        if (!lopError && lopData) {
          totalLOP = lopData.reduce((sum: number, entry: any) => {
            let value = 0;
            if (entry && typeof entry.lop_type === 'string') {
              switch (entry.lop_type) {
                case '1_day':
                  value = 1.0;
                  break;
                case '0.5_day':
                  value = 0.5;
                  break;
                case '0.25_day':
                  value = 0.25;
                  break;
                default:
                  value = 0;
              }
            }
            return sum + value;
          }, 0);
        }

        // Extract employee master data
        const empMaster = employeeMap.get(profile.id) || {};
        const basicSalary = empMaster.basic_salary || empMaster.salary || 0;
        const increment = empMaster.increment || 0;
        const incentive = empMaster.incentive || 0;
        const tdsPercent = empMaster.tds_percent || 1.0;

        // Calculate salary components - FIXED FORMULA
        const perDaySalary = totalDaysInMonth > 0 ? basicSalary / totalDaysInMonth : 0;
        const salaryForSelectedDays = perDaySalary * selectedDays;
        const lopAmount = perDaySalary * totalLOP;
        const tdsAmount = salaryForSelectedDays * 0.01; // TDS = 1% of salary_for_selected_days
        
        // Final salary = salary_for_selected_days + increment + incentive - lop_amount - tds_amount
        const finalSalary = salaryForSelectedDays + increment + incentive - lopAmount - tdsAmount;

        return {
          id: profile.id,
          name: profile.name || 'Unknown',
          department: profile.department,
          basic_salary: basicSalary,
          increment: increment,
          incentive: incentive,
          // Calculation details
          selected_days: selectedDays,
          total_days_in_month: totalDaysInMonth,
          per_day_salary: Math.round(perDaySalary * 100) / 100,
          selected_days_salary: Math.round(salaryForSelectedDays * 100) / 100, // NEW: salary for selected days
          lop_days: totalLOP,
          lop_amount: Math.round(lopAmount * 100) / 100,
          tds_1_percent: Math.round(tdsAmount * 100) / 100, // FIXED: TDS amount
          final_salary: Math.round(finalSalary * 100) / 100,
          // Date range info
          from_date: fromDate.toLocaleDateString(),
          to_date: toDate.toLocaleDateString(),
          calculation_month: fromDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        };
      })
    );

    console.log(`Calculated salaries for ${calculatedSalaries.length} employees`);
    return calculatedSalaries;

  } catch (error) {
    console.error('Error calculating salaries for all employees:', error);
    throw error;
  }
};

/**
 * Calculate salary for a specific date range within a month
 */
export const calculateSalaryForDateRange = (
  basicSalary: number,
  fromDay: number,
  toDay: number,
  totalDaysInMonth: number
): {
  per_day_salary: number;
  selected_days: number;
  calculated_salary: number;
  error: string | null;
} => {
  // Validate inputs
  if (basicSalary <= 0 || fromDay < 1 || toDay < 1 || fromDay > toDay || toDay > totalDaysInMonth) {
    return {
      per_day_salary: 0,
      selected_days: 0,
      calculated_salary: 0,
      error: 'Invalid date range or salary'
    };
  }

  // Calculate per day salary
  const perDaySalary = basicSalary / totalDaysInMonth;
  
  // Calculate selected days
  const selectedDays = toDay - fromDay + 1;
  
  // Calculate salary for selected range
  const calculatedSalary = perDaySalary * selectedDays;

  return {
    per_day_salary: Math.round(perDaySalary * 100) / 100,
    selected_days: selectedDays,
    calculated_salary: Math.round(calculatedSalary * 100) / 100,
    error: null
  };
};

/**
 * Get days in month for a given year and month
 */
export const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month, 0).getDate();
};

/**
 * Get current month and year
 */
export const getCurrentMonthYear = () => {
  const now = new Date();
  return {
    month: now.getMonth() + 1, // 1-12
    year: now.getFullYear()
  };
};

/**
 * Calculate LOP status text
 */
export const getLOPStatus = (lopDays: number): string => {
  if (lopDays === 0) return "No LOP";
  if (lopDays === 1) return "1 Day";
  return `${lopDays} Days`;
};

/**
 * Calculate salary components with direct LOP deduction
 */
export const calculateSalaryComponents = (
  basicSalary: number,
  increment: number,
  incentive: number,
  lopDays: number,
  totalDaysInMonth: number,
  tdsPercent: number = 1.0
): {
  one_day_salary: number;
  tds_1_percent: number;
  final_total_salary: number;
} => {
  // Step 2: One Day Salary
  const oneDaySalary = totalDaysInMonth > 0 ? basicSalary / totalDaysInMonth : 0;

  // Step 3: Salary before LOP
  const salaryBeforeLOP = basicSalary + increment + incentive;

  // Step 4: Final Salary Direct Deduction (LOP deducted directly)
  const salaryAfterLOP = salaryBeforeLOP - (oneDaySalary * lopDays);

  // Step 5: TDS (1%) deducted from result
  const tds = salaryAfterLOP * (tdsPercent / 100);

  // Step 6: Final Total Salary
  const finalTotalSalary = salaryAfterLOP - tds;

  return {
    one_day_salary: Math.round(oneDaySalary * 100) / 100,
    tds_1_percent: Math.round(tds * 100) / 100,
    final_total_salary: Math.round(finalTotalSalary * 100) / 100
  };
};

/**
 * Debug function to check LOP entries
 */
export const debugLOPEntries = async (): Promise<{
  allLOP?: any[];
  profiles?: any[];
  employeeMaster?: any[];
  errors?: {
    lopError?: any;
    profileError?: any;
    empError?: any;
  };
  error?: any;
}> => {
  try {
    console.log('=== DEBUG: Checking LOP Entries ===');
    
    // Check if we can access lop_entries table
    const { data: allLOP, error: lopError } = await supabase
      .from('lop_entries' as any)
      .select('*')
      .limit(10);

    console.log('All LOP entries:', allLOP);
    console.log('LOP fetch error:', lopError);

    // Check profiles
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, department')
      .limit(5);

    console.log('Profiles:', profiles);
    console.log('Profile fetch error:', profileError);

    // Check employee_master
    const { data: employeeMaster, error: empError } = await supabase
      .from('employee_master' as any)
      .select('*')
      .limit(5);

    console.log('Employee Master:', employeeMaster);
    console.log('Employee Master error:', empError);

    // Test LOP aggregation for each profile with correct filtering
    if (profiles && !profileError) {
      const { month: currentMonth, year: currentYear } = getCurrentMonthYear();
      
      for (const profile of profiles.filter(p => p && p.id)) {
        console.log(`\n--- Testing LOP for ${profile.name || 'Unknown'} (${profile.id}) ---`);
        
        // Use the same date range logic as the main function
        const monthFilter = currentMonth; // Use current month for debug
        const yearFilter = currentYear;
        
        // Create exact date range (start inclusive, end exclusive)
        const startDate = `${yearFilter}-${monthFilter.toString().padStart(2, '0')}-01`;
        const nextMonthStart = monthFilter === 12 
          ? `${yearFilter + 1}-01-01` 
          : `${yearFilter}-${(monthFilter + 1).toString().padStart(2, '0')}-01`;
        
        console.log(`Debug date range: ${startDate} to ${nextMonthStart} (exclusive)`);
        
        const { data: empLOP, error: empLOPError } = await supabase
          .from('lop_entries' as any)
          .select('lop_type, status, lop_date, reason')
          .eq('employee_id', profile.id)
          .eq('status', 'approved')
          .gte('lop_date', startDate)
          .lt('lop_date', nextMonthStart);

        console.log(`LOP entries for ${profile.name || 'Unknown'} (approved, selected month):`, empLOP);
        console.log(`LOP error for ${profile.name || 'Unknown'}:`, empLOPError);
        
        if (!empLOPError && empLOP) {
          const totalLOP = empLOP.reduce((sum: number, entry: any) => {
            let value = 0;
            if (entry && typeof entry.lop_type === 'string') {
              switch (entry.lop_type) {
                case '1_day':
                  value = 1.0;
                  break;
                case '0.5_day':
                  value = 0.5;
                  break;
                case '0.25_day':
                  value = 0.25;
                  break;
                default:
                  console.warn(`Unknown lop_type: ${entry.lop_type}`);
                  value = 0;
              }
            }
            console.log(`Debug LOP entry: ${entry.lop_type} → ${value} days`);
            return sum + value;
          }, 0);
          console.log(`Total LOP for ${profile.name || 'Unknown'}:`, totalLOP);
          
          // Show individual entries for debugging
          empLOP.forEach((entry: any, index: number) => {
            console.log(`  Entry ${index + 1}: lop_type=${entry.lop_type}, status=${entry.status}, date=${entry.lop_date}, reason=${entry.reason}`);
          });
        }
        
        // Also check all LOP entries for this employee (any status, any date) for comparison
        const { data: allEmpLOP, error: allEmpLOPError } = await supabase
          .from('lop_entries')
          .select('lop_type, status, lop_date, reason')
          .eq('employee_id', profile.id);

        console.log(`ALL LOP entries for ${profile.name || 'Unknown'}:`, allEmpLOP);
        
        // Check LOP entries for different months to verify filtering
        const { data: otherMonthLOP, error: otherMonthError } = await supabase
          .from('lop_entries')
          .select('lop_type, status, lop_date, reason')
          .eq('employee_id', profile.id)
          .eq('status', 'approved')
          .lt('lop_date', startDate); // Previous months only

        console.log(`Previous month LOP entries for ${profile.name || 'Unknown'}:`, otherMonthLOP);
      }
    }

    return { allLOP, profiles, employeeMaster, errors: { lopError, profileError, empError } };
  } catch (error) {
    console.error('Debug error:', error);
    return { error };
  }
};

/**
 * Get employees with profile and salary calculation based on date range (SAFER VERSION)
 */
export const getEmployeesWithProfile = async (selectedMonth?: number, selectedYear?: number, dateRange?: { from_date: Date, to_date: Date }): Promise<EmployeeWithProfile[]> => {
  try {
    console.log('Fetching employees with profile - Month:', selectedMonth, 'Year:', selectedYear, 'DateRange:', dateRange);
    
    // 1️⃣ Fetch profiles safely
    const profiles = await fetchProfilesSafely();
    console.log(`Fetched ${profiles.length} valid profiles`);
    
    if (profiles.length === 0) {
      console.warn('No valid profiles found');
      return [];
    }
    
    // 2️⃣ Fetch employee master data safely
    const profileIds = profiles.map(p => p.id);
    const { data: employeeData, error: employeeError } = await supabase
      .from('employee_master')
      .select('*')
      .in('profile_id', profileIds);

    if (employeeError) {
      console.error('Failed to fetch employee master data:', employeeError);
      throw new Error(`Failed to fetch employee master data: ${employeeError.message}`);
    }

    // Validate and filter employee master data
    const validEmployeeData = (employeeData as any[] || [])
      .filter((emp: any): emp is EmployeeMaster => 
        emp && 
        typeof emp.profile_id === 'string' &&
        typeof emp.basic_salary === 'number'
      );

    console.log(`Fetched ${validEmployeeData.length} valid employee master records`);

    // 3️⃣ Create employee data map
    const employeeMap = new Map<string, EmployeeMaster>();
    validEmployeeData.forEach(emp => {
      employeeMap.set(emp.profile_id, emp);
    });

    // 4️⃣ Calculate based on date range or month
    let employeesWithSalary: EmployeeWithProfile[];
    
    if (dateRange) {
      // Use date range calculation
      employeesWithSalary = await calculateEmployeesForDateRangeSafely(profiles, employeeMap, dateRange);
    } else {
      // Use existing month-based calculation
      employeesWithSalary = await calculateEmployeesForMonthSafely(profiles, employeeMap, selectedMonth, selectedYear);
    }

    console.log(`Successfully calculated payroll for ${employeesWithSalary.length} employees`);
    return employeesWithSalary;

  } catch (error) {
    console.error('Error in getEmployeesWithProfile:', error);
    throw error;
  }
};

/**
 * Calculate employees for date range (SAFER VERSION)
 */
const calculateEmployeesForDateRangeSafely = async (
  profiles: Profile[], 
  employeeMap: Map<string, EmployeeMaster>, 
  dateRange: { from_date: Date, to_date: Date }
): Promise<EmployeeWithProfile[]> => {
  const { from_date, to_date } = dateRange;
  
  // Calculate date range details
  const selectedDays = Math.ceil((to_date.getTime() - from_date.getTime()) / (1000 * 3600 * 24)) + 1;
  const totalDaysInMonth = new Date(from_date.getFullYear(), from_date.getMonth() + 1, 0).getDate();
  
  // Get LOP data for the month
  const startDate = `${from_date.getFullYear()}-${(from_date.getMonth() + 1).toString().padStart(2, '0')}-01`;
  const nextMonthStart = from_date.getMonth() === 11 
    ? `${from_date.getFullYear() + 1}-01-01` 
    : `${from_date.getFullYear()}-${(from_date.getMonth() + 2).toString().padStart(2, '0')}-01`;

  console.log(`Date range calculation: ${from_date.toLocaleDateString()} to ${to_date.toLocaleDateString()}`);
  console.log(`Selected days: ${selectedDays}, Total days in month: ${totalDaysInMonth}`);

  // Calculate salary for each employee safely
  const employeesWithSalary = await Promise.all(
    profiles.map(async (profile: Profile) => {
      console.log(`Calculating salary for employee: ${profile.name}`);
      
      // Get LOP data safely
      const lopData = await fetchLopEntriesSafely(profile.id, startDate, nextMonthStart);
      
      // Calculate total LOP days
      const lopDeductionDays = lopData.reduce((sum, entry) => {
        const fraction = entry.lop_type === '1_day' ? 1.0 : 
                        entry.lop_type === '0.5_day' ? 0.5 : 
                        entry.lop_type === '0.25_day' ? 0.25 : 0;
        return sum + fraction;
      }, 0);

      // Extract employee master data safely
      const empMaster = employeeMap.get(profile.id);
      const basicSalary = empMaster?.basic_salary || 0;
      const increment = empMaster?.increment || 0;
      const incentive = empMaster?.incentive || 0;
      const tdsPercent = empMaster?.tds_percent || 1.0;

      // Debug bank fields for first employee in date range calculation
      if (profile.id === profiles[0]?.id) {
        console.log('DATE RANGE MERGE DEBUG - Employee Master Data:', empMaster);
        console.log('DATE RANGE MERGE DEBUG - Bank fields from master:', {
          bank_name: empMaster?.bank_name,
          account_number: empMaster?.account_number,
          ifsc_code: empMaster?.ifsc_code
        });
      }

      // Calculate salary components correctly
      const perDaySalary = basicSalary / 30; // Always divide by 30
      const selectedDaysWorked = totalDaysInMonth - lopDeductionDays;
      const salaryForSelectedDays = perDaySalary * selectedDaysWorked;
      const lopAmount = perDaySalary * lopDeductionDays;
      const tdsAmount = salaryForSelectedDays * 0.01; // Always 1%
      
      // Final salary calculation
      const finalSalary = salaryForSelectedDays + increment + incentive - lopAmount - tdsAmount;

      console.log(`Salary calculation for ${profile.name}:`, {
        basicSalary,
        perDaySalary,
        totalDaysInMonth,
        selectedDaysWorked,
        lopDeductionDays,
        lopAmount,
        salaryForSelectedDays,
        tdsAmount,
        finalSalary
      });

      return {
        id: profile.id,
        name: profile.name,
        department: profile.department,
        designation: empMaster?.designation,
        doj: empMaster?.doj,
        bank: empMaster?.bank,
        pf: empMaster?.pf,
        esi: empMaster?.esi,
        // Bank details
        bank_name: empMaster?.bank_name,
        account_number: empMaster?.account_number,
        ifsc_code: empMaster?.ifsc_code,
        status: empMaster?.status || 'ACTIVE',
        created_at: empMaster?.created_at,
        updated_at: empMaster?.updated_at,
        // Salary components
        basic_salary: basicSalary,
        increment: increment,
        incentive: incentive,
        tds_percent: tdsPercent,
        // Auto-calculated fields based on actual LOP entries
        days_in_month: totalDaysInMonth,
        selected_days: selectedDaysWorked,
        selected_days_salary: Math.round(salaryForSelectedDays * 100) / 100, // NEW: salary for selected days
        lop_days: lopDeductionDays,
        one_day_salary: Math.round(perDaySalary * 100) / 100,
        earned_salary: Math.round(salaryForSelectedDays * 100) / 100,
        lop_amount: Math.round(lopAmount * 100) / 100,
        gross_salary: Math.round(salaryForSelectedDays * 100) / 100,
        tds_1_percent: Math.round(tdsAmount * 100) / 100,
        final_total_salary: Math.round(finalSalary * 100) / 100,
        // Date range info
        calculation_type: 'lop_entries',
        from_date: from_date.toLocaleDateString(),
        to_date: to_date.toLocaleDateString()
      };
    })
  );

  return employeesWithSalary;
};

/**
 * Calculate employees for month (SAFER VERSION)
 */
const calculateEmployeesForMonthSafely = async (
  profiles: Profile[], 
  employeeMap: Map<string, EmployeeMaster>, 
  selectedMonth?: number, 
  selectedYear?: number
): Promise<EmployeeWithProfile[]> => {
  const { month: currentMonth, year: currentYear } = getCurrentMonthYear();
  const monthFilter = selectedMonth ?? currentMonth;
  const yearFilter = selectedYear ?? currentYear;

  console.log(`Month-based calculation: ${monthFilter}/${yearFilter}`);

  // Get LOP data for the month
  const startDate = `${yearFilter}-${monthFilter.toString().padStart(2, '0')}-01`;
  const nextMonthStart = monthFilter === 12 
    ? `${yearFilter + 1}-01-01` 
    : `${yearFilter}-${(monthFilter + 1).toString().padStart(2, '0')}-01`;

  // Calculate salary for each employee safely
  const employeesWithSalary = await Promise.all(
    profiles.map(async (profile: Profile) => {
      // Get LOP data safely
      const lopData = await fetchLopEntriesSafely(profile.id, startDate, nextMonthStart);
      
      // Calculate total LOP days
      const totalLOP = lopData.reduce((sum, entry) => {
        const fraction = entry.lop_type === '1_day' ? 1.0 : 
                        entry.lop_type === '0.5_day' ? 0.5 : 
                        entry.lop_type === '0.25_day' ? 0.25 : 0;
        return sum + fraction;
      }, 0);

      // Extract employee master data safely
      const empMaster = employeeMap.get(profile.id);
      const basicSalary = empMaster?.basic_salary || 0;
      const increment = empMaster?.increment || 0;
      const incentive = empMaster?.incentive || 0;
      const tdsPercent = empMaster?.tds_percent || 1.0;

      // EXISTING MONTH-BASED CALCULATION
      const daysInMonth = new Date(yearFilter, monthFilter, 0).getDate();
      const salaryComponents = calculateSalaryComponents(basicSalary, increment, incentive, totalLOP, tdsPercent);

      return {
        id: profile.id,
        name: profile.name,
        department: profile.department,
        designation: empMaster?.designation,
        doj: empMaster?.doj,
        bank: empMaster?.bank,
        pf: empMaster?.pf,
        esi: empMaster?.esi,
        status: empMaster?.status || 'ACTIVE',
        created_at: empMaster?.created_at,
        updated_at: empMaster?.updated_at,
        // Salary components
        basic_salary: basicSalary,
        increment: increment,
        incentive: incentive,
        tds_percent: tdsPercent,
        // Auto-calculated fields
        days_in_month: daysInMonth,
        lop_days: totalLOP,
        one_day_salary: salaryComponents.one_day_salary,
        tds_1_percent: salaryComponents.tds_1_percent,
        final_total_salary: salaryComponents.final_total_salary,
        // Date range info
        calculation_type: 'month',
        from_date: null,
        to_date: null
      };
    })
  );

  return employeesWithSalary;
};
const calculateEmployeesForDateRange = async (profiles: any[], employeeMap: Map<string, any>, dateRange: { from_date: Date, to_date: Date }) => {
  const { from_date, to_date } = dateRange;
  
  // Calculate date range details
  const selectedDays = Math.ceil((to_date.getTime() - from_date.getTime()) / (1000 * 3600 * 24)) + 1;
  const totalDaysInMonth = new Date(from_date.getFullYear(), from_date.getMonth() + 1, 0).getDate();
  
  // Get LOP data for the month
  const startDate = `${from_date.getFullYear()}-${(from_date.getMonth() + 1).toString().padStart(2, '0')}-01`;
  const nextMonthStart = from_date.getMonth() === 11 
    ? `${from_date.getFullYear() + 1}-01-01` 
    : `${from_date.getFullYear()}-${(from_date.getMonth() + 2).toString().padStart(2, '0')}-01`;

  console.log(`Date range calculation: ${from_date.toLocaleDateString()} to ${to_date.toLocaleDateString()}`);
  console.log(`Selected days: ${selectedDays}, Total days in month: ${totalDaysInMonth}`);

  // Calculate salary for each employee
  const employeesWithSalary = await Promise.all(
    profiles.filter(profile => profile && profile.id).map(async (profile: any) => {
      console.log(`Calculating salary for employee: ${profile.name || 'Unknown'}`);
      
      // Get LOP data for this employee
      const { data: lopData, error: lopError } = await supabase
        .from('lop_entries')
        .select('lop_type, status, lop_date')
        .eq('employee_id', profile.id)
        .in('status', ['approved', 'pending_admin', 'pending_boi'])  // Include pending statuses
        .gte('lop_date', startDate)
        .lt('lop_date', nextMonthStart);

      let totalLOP = 0;
      if (!lopError && lopData) {
        totalLOP = lopData.reduce((sum, entry) => {
          let value = 0;
          switch (entry.lop_type) {
            case '1_day':
              value = 1.0;
              break;
            case '0.5_day':
              value = 0.5;
              break;
            case '0.25_day':
              value = 0.25;
              break;
            default:
              value = 0;
          }
          return sum + value;
        }, 0);
      }

      // Extract employee master data
      const empMaster = employeeMap.get(profile.id) || {};
      const basicSalary = empMaster.basic_salary || empMaster.salary || 0;
      const increment = empMaster.increment || 0;
      const incentive = empMaster.incentive || 0;
      const tdsPercent = empMaster.tds_percent || 1.0;

      // NEW CALCULATION LOGIC BASED ON ACTUAL LOP ENTRIES
      const perDaySalary = totalDaysInMonth > 0 ? basicSalary / totalDaysInMonth : 0;
      
      // Fetch actual LOP entries from the LOP table for this employee in this month
      // LOP table has: profileId, lopDate, lopFraction (0.25,0.5,1)
      let lopDeductionDays = 0;
      if (!lopError && lopData) {
        // Calculate total LOP Days as sum of lopFraction
        lopDeductionDays = lopData.reduce((sum: number, entry: any) => {
          let fraction = 0;
          if (entry && typeof entry.lop_type === 'string') {
            switch (entry.lop_type) {
              case '1_day':
                fraction = 1.0;
                break;
              case '0.5_day':
                fraction = 0.5;
                break;
              case '0.25_day':
                fraction = 0.25;
                break;
              default:
                fraction = 0;
            }
          }
          return sum + fraction;
        }, 0);
      }
      
      const lopAmount = perDaySalary * lopDeductionDays;
      const salaryAfterLop = basicSalary - lopAmount;  // Use basicSalary
      const tdsAmount = salaryAfterLop * 0.01;          // Fixed 1% TDS
      const finalSalary = salaryAfterLop - tdsAmount;   // salary_after_lop - tds_amount
      
      // Get Selected Days from calendar (or calculate from LOP)
      const selectedDays = totalDaysInMonth - lopDeductionDays;

      console.log(`Salary calculation for ${profile.name || 'Unknown'}:`, {
        basicSalary,
        perDaySalary,
        totalDaysInMonth,
        selectedDays,
        lopDeductionDays,
        lopAmount,
        salaryAfterLop,
        tdsAmount,
        finalSalary
      });

      return {
        id: profile.id,
        name: profile.name || 'Unknown',
        department: profile.department,
        designation: empMaster.designation,
        doj: empMaster.doj,
        bank: empMaster.bank,
        pf: empMaster.pf,
        esi: empMaster.esi,
        // Bank details
        bank_name: empMaster?.bank_name,
        account_number: empMaster?.account_number,
        ifsc_code: empMaster?.ifsc_code,
        status: empMaster.status || 'ACTIVE',
        created_at: empMaster.created_at,
        updated_at: empMaster.updated_at,
        // Salary components
        basic_salary: basicSalary,
        increment: increment,
        incentive: incentive,
        tds_percent: tdsPercent,
        // Auto-calculated fields based on actual LOP entries
        days_in_month: totalDaysInMonth,
        selected_days: selectedDays,  // Calculated from LOP entries
        lop_days: lopDeductionDays,  // Sum of fractional LOP from database
        one_day_salary: Math.round(perDaySalary * 100) / 100,
        earned_salary: Math.round(basicSalary * 100) / 100,  // Show basic salary
        lop_amount: Math.round(lopAmount * 100) / 100,
        gross_salary: Math.round(salaryAfterLop * 100) / 100,  // Show salary_after_lop
        tds_1_percent: Math.round(tdsAmount * 100) / 100,
        final_total_salary: Math.round(finalSalary * 100) / 100,
        // Date range info
        calculation_type: 'month',
        from_date: null,
        to_date: null
      };
    })
  );

  return employeesWithSalary;
};

/**
 * Calculate employees for month (existing logic)
 */
const calculateEmployeesForMonth = async (profiles: any[], employeeMap: Map<string, any>, selectedMonth?: number, selectedYear?: number) => {
  const { month: currentMonth, year: currentYear } = getCurrentMonthYear();
  const monthFilter = selectedMonth ?? currentMonth;
  const yearFilter = selectedYear ?? currentYear;

  console.log(`Month-based calculation: ${monthFilter}/${yearFilter}`);

  // Get LOP data for the month
  const startDate = `${yearFilter}-${monthFilter.toString().padStart(2, '0')}-01`;
  const nextMonthStart = monthFilter === 12 
    ? `${yearFilter + 1}-01-01` 
    : `${yearFilter}-${(monthFilter + 1).toString().padStart(2, '0')}-01`;

  // Calculate salary for each employee using existing logic
  const employeesWithSalary = await Promise.all(
    profiles.filter(profile => profile && profile.id).map(async (profile: any) => {
      // Get LOP data for this employee
      const { data: lopData, error: lopError } = await supabase
        .from('lop_entries')
        .select('lop_type, status, lop_date')
        .eq('employee_id', profile.id)
        .in('status', ['approved', 'pending_admin', 'pending_boi'])  // Include pending statuses
        .gte('lop_date', startDate)
        .lt('lop_date', nextMonthStart);

      let totalLOP = 0;
      if (!lopError && lopData) {
        totalLOP = lopData.reduce((sum, entry) => {
          let value = 0;
          switch (entry.lop_type) {
            case '1_day':
              value = 1.0;
              break;
            case '0.5_day':
              value = 0.5;
              break;
            case '0.25_day':
              value = 0.25;
              break;
            default:
              value = 0;
          }
          return sum + value;
        }, 0);
      }

      // Extract employee master data
      const empMaster = employeeMap.get(profile.id) || {};
      const basicSalary = empMaster.basic_salary || empMaster.salary || 0;
      const increment = empMaster.increment || 0;
      const incentive = empMaster.incentive || 0;
      const tdsPercent = empMaster.tds_percent || 1.0;

      // EXISTING MONTH-BASED CALCULATION
      const daysInMonth = new Date(yearFilter, monthFilter, 0).getDate();
      const salaryComponents = calculateSalaryComponents(basicSalary, increment, incentive, totalLOP, tdsPercent);

      return {
        id: profile.id,
        name: profile.name || 'Unknown',
        department: profile.department,
        designation: empMaster.designation,
        doj: empMaster.doj,
        bank: empMaster.bank,
        pf: empMaster.pf,
        esi: empMaster.esi,
        status: empMaster.status || 'ACTIVE',
        created_at: empMaster.created_at,
        updated_at: empMaster.updated_at,
        // Salary components
        basic_salary: basicSalary,
        increment: increment,
        incentive: incentive,
        tds_percent: tdsPercent,
        // Auto-calculated fields
        days_in_month: daysInMonth,
        selected_days: daysInMonth - totalLOP,
        lop_days: totalLOP,
        one_day_salary: salaryComponents.one_day_salary,
        tds_1_percent: salaryComponents.tds_1_percent,
        final_total_salary: salaryComponents.final_total_salary,
        // Date range info
        calculation_type: 'month',
        from_date: null,
        to_date: null
      };
    })
  );

  return employeesWithSalary;
};

/**
 * Process payroll for all employees in a given month
 */
export const processPayrollForAllEmployees = async (month?: number, year?: number): Promise<{
  profileId: string;
  employeeName: string;
  department: string;
  basicSalary: string;
  daysInMonth: number;
  selectedDays: number;
  lopDeduction: number;
  perDaySalary: string;
  lopAmount: string;
  salaryAfterLop: string;
  tds: string;
  finalSalary: string;
  actions: string;
  id: string;
  name: string;
  department_name: string;
  increment: number;
  incentive: number;
  tds_percent: number;
  lop_days: number;
  one_day_salary: number;
  earned_salary: number;
  gross_salary: number;
  tds_1_percent: number;
  final_total_salary: number;
}[]> => {
  try {
    console.log('Processing payroll for all employees - Month:', month, 'Year:', year);
    
    // 1️⃣ Define month and year for payroll calculation
    const currentDate = new Date();
    const currentMonth = month ?? currentDate.getMonth() + 1; // January = 0
    const currentYear = year ?? currentDate.getFullYear();
    
    // 2️⃣ Fetch all employees with status "active"
    const { data: employeeMaster, error: empError } = await supabase
      .from('employee_master')
      .select('*')
      .eq('status', 'ACTIVE');

    if (empError) {
      console.error('Failed to fetch employee master data:', empError);
      throw new Error(`Failed to fetch employee master data: ${empError.message}`);
    }

    // Get profile data for all employees
    const profileIds = (employeeMaster as any[] || []).map(emp => emp.profile_id).filter(Boolean);
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', profileIds);

    if (profileError) {
      console.error('Failed to fetch profiles:', profileError);
      throw new Error(`Failed to fetch profiles: ${profileError.message}`);
    }

    // Create maps for easy lookup
    const employeeMap = new Map<string, any>();
    (employeeMaster as any[] || []).forEach(emp => {
      employeeMap.set(emp.profile_id, emp);
    });

    const profileMap = new Map<string, any>();
    (profiles || []).forEach(profile => {
      profileMap.set(profile.id, profile);
    });

    // Get LOP date range for the month
    const startDate = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
    const nextMonthStart = currentMonth === 12 
      ? `${currentYear + 1}-01-01` 
      : `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`;

    // Get total days in month
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

    console.log(`Processing payroll for ${employeeMaster?.length || 0} employees in ${currentMonth}/${currentYear}`);
    console.log(`LOP date range: ${startDate} to ${nextMonthStart} (exclusive)`);
    console.log(`Days in month: ${daysInMonth}`);

    // 3️⃣ Prepare payroll table
    const payrollTable = await Promise.all(
      (employeeMaster as any[] || []).map(async (employee: any) => {
        const profile = profileMap.get(employee.profile_id);
        if (!profile) {
          console.warn(`Profile not found for employee: ${employee.profile_id}`);
          return null;
        }

        // Fetch LOP entries for this employee
        const { data: lopEntries, error: lopError } = await supabase
          .from('lop_entries')
          .select('lop_type, status, lop_date')
          .eq('employee_id', employee.profile_id)
          .in('status', ['approved', 'pending_admin', 'pending_boi'])  // Include pending statuses
          .gte('lop_date', startDate)
          .lt('lop_date', nextMonthStart);

        // Calculate total LOP in fractional days (0.25,0.5,1)
        let lopDeductionDays = 0;
        if (!lopError && lopEntries) {
          lopDeductionDays = lopEntries.reduce((sum: number, entry: any) => {
            let fraction = 0;
            if (entry && typeof entry.lop_type === 'string') {
              switch (entry.lop_type) {
                case '1_day':
                  fraction = 1.0;
                  break;
                case '0.5_day':
                  fraction = 0.5;
                  break;
                case '0.25_day':
                  fraction = 0.25;
                  break;
                default:
                  fraction = 0;
              }
            }
            return sum + fraction;
          }, 0);
        }

        // Per day salary
        const basicSalary = employee.basic_salary || employee.salary || 0;
        const perDaySalary = daysInMonth > 0 ? basicSalary / daysInMonth : 0;

        // LOP Amount
        const lopAmount = perDaySalary * lopDeductionDays;

        // Salary after LOP
        const salaryAfterLop = basicSalary - lopAmount;

        // TDS 1%
        const tds = salaryAfterLop * 0.01;

        // Final Salary
        const finalSalary = salaryAfterLop - tds;

        // Selected Days = Days in Month - LOP Deduction
        const selectedDays = daysInMonth - lopDeductionDays;

        // Return table row
        return {
          profileId: employee.profile_id,
          employeeName: profile.name || 'Unknown',
          department: profile.department || 'Unknown',
          basicSalary: basicSalary.toFixed(2),
          daysInMonth: daysInMonth,
          selectedDays: selectedDays,
          lopDeduction: lopDeductionDays,    // fractional LOP
          perDaySalary: perDaySalary.toFixed(2),
          lopAmount: lopAmount.toFixed(2),
          salaryAfterLop: salaryAfterLop.toFixed(2),
          tds: tds.toFixed(2),
          finalSalary: finalSalary.toFixed(2),
          actions: "Edit/Delete",
          // Additional fields for compatibility
          id: employee.profile_id,
          name: profile.name || 'Unknown',
          department_name: profile.department,
          increment: employee.increment || 0,
          incentive: employee.incentive || 0,
          tds_percent: employee.tds_percent || 1.0,
          lop_days: lopDeductionDays,
          one_day_salary: perDaySalary,
          earned_salary: basicSalary,
          gross_salary: salaryAfterLop,
          tds_1_percent: tds,
          final_total_salary: finalSalary
        };
      })
    );

    // Filter out null entries and return
    const validPayrollTable = payrollTable.filter(row => row !== null);

    console.log(`Processed payroll for ${validPayrollTable.length} employees`);
    
    // 4️⃣ Return table for display
    return validPayrollTable;

  } catch (error) {
    console.error('Error in processPayrollForAllEmployees:', error);
    throw error;
  }
};
// Delete employee and related LOP entries
export async function deleteEmployee(employeeId: string): Promise<void> {
  try {
    console.log('Deleting employee:', employeeId);

    // First, delete related LOP entries
    const { error: lopError } = await supabase
      .from('lop_entries')
      .delete()
      .eq('employee_id', employeeId);

    if (lopError) {
      console.error('LOP entries deletion error:', lopError);
      throw new Error(`Failed to delete LOP entries: ${lopError.message}`);
    }

    // Then, delete employee master record
    const { error: masterError } = await supabase
      .from('employee_master')
      .delete()
      .eq('profile_id', employeeId);

    if (masterError) {
      console.error('Employee master deletion error:', masterError);
      throw new Error(`Failed to delete employee master: ${masterError.message}`);
    }

    // Finally, delete profile record
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', employeeId);

    if (profileError) {
      console.error('Profile deletion error:', profileError);
      throw new Error(`Failed to delete profile: ${profileError.message}`);
    }

    console.log('Employee deleted successfully:', employeeId);
  } catch (error) {
    console.error('Error in deleteEmployee:', error);
    throw error;
  }
}

export async function upsertEmployeeMaster(formData: EmployeeMasterUpsertData): Promise<EmployeeMaster> {
  try {
    console.log('Upserting employee master:', formData);
    console.log('Request body:', JSON.stringify(formData, null, 2)); // Debug log

    // First, update the profiles table with name and department
    if (formData.employee_id && (formData.name || formData.department)) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: formData.name,
          department: formData.department,
          updated_at: new Date().toISOString()
        })
        .eq('id', formData.employee_id);

      if (profileError) {
        console.error('Profile update error:', profileError);
        throw new Error(`Failed to update profile: ${profileError.message}`);
      }
    }

    // Prepare employee master data — only include stable columns.
    // Handles two known schema variants:
    //   Variant A: incentive, ifsc_code  (code-first schema)
    //   Variant B: incentives, ifsc      (migration-007/010 schema)
    const buildPayload = (useAltNames: boolean): Record<string, unknown> => ({
      profile_id: formData.employee_id,
      basic_salary: formData.basic_salary ?? 0,
      increment: formData.increment ?? 0,
      bank_name: formData.bank_name || null,
      account_number: formData.account_number || null,
      // incentive column name variant
      ...(useAltNames
        ? { incentives: formData.incentive ?? 0 }
        : { incentive: formData.incentive ?? 0 }),
      // IFSC column name variant
      ...(useAltNames
        ? { ifsc: formData.ifsc_code || null }
        : { ifsc_code: formData.ifsc_code || null }),
    });

    const dataToUpsert = buildPayload(false);
    console.log('Employee master data prepared:', dataToUpsert);

    // Perform upsert using profile_id as unique key
    let { data, error } = await supabase
      .from('employee_master')
      .upsert(dataToUpsert, { onConflict: 'profile_id' })
      .select()
      .single();

    // If failed due to unknown column name, retry with alternate column names
    if (error && /column .*(incentive|ifsc_code).* does not exist/i.test(error.message)) {
      console.warn('[upsertEmployeeMaster] Column name mismatch detected, retrying with alt names:', error.message);
      const altPayload = buildPayload(true);
      const altResult = await supabase
        .from('employee_master')
        .upsert(altPayload, { onConflict: 'profile_id' })
        .select()
        .single();
      data = altResult.data;
      error = altResult.error;
    }

    if (error) {
      console.error('Employee master upsert error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      console.error('Data being upserted:', dataToUpsert);
      throw new Error(`Failed to upsert employee master: ${error.message}`);
    }

    console.log('Upsert successful:', data);
    return data as unknown as EmployeeMaster;
  } catch (error) {
    console.error('Error in upsertEmployeeMaster:', error);
    throw error;
  }
}

/**
 * Get departments from departments master table
 */
export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  is_active: boolean;
}

export async function getDepartments(): Promise<Department[]> {
  try {
    const { data, error } = await supabase
      .from('departments')
      .select('id, name, code, description, is_active')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Failed to fetch departments:', error);
      throw new Error(`Failed to fetch departments: ${error.message}`);
    }

    return (data || []) as Department[];
  } catch (error) {
    console.error('Error in getDepartments:', error);
    throw error;
  }
}

/**
 * Get department names as simple string array (for backward compatibility)
 */
export async function getDepartmentNames(): Promise<string[]> {
  try {
    const departments = await getDepartments();
    return departments.map(d => d.name);
  } catch (error) {
    console.error('Error in getDepartmentNames:', error);
    return [];
  }
}

/**
 * Sanitize numeric value (avoid NaN)
 */
export function safeNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Recalculate a single row: TDS 1%, final salary, LOP amount from lop_days if not provided.
 * ctx: { daysInMonth, selectedDays } (selectedDays = toDay - fromDay + 1).
 * Row must have: basic_salary, increment, incentive, lop_days; optional lop_amount (from DB).
 */
export function recalculateRow(
  row: {
    basic_salary: number;
    increment: number;
    incentive: number;
    lop_days: number;
    lop_amount?: number;
  },
  ctx: { daysInMonth: number; selectedDays: number }
): {
  per_day_salary: number;
  earned_salary: number;
  lop_amount: number;
  salary_after_lop: number;
  tds: number;
  final_salary: number;
} {
  const basic_salary = safeNum(row.basic_salary);
  const increment = safeNum(row.increment);
  const incentive = safeNum(row.incentive);
  const lop_days = safeNum(row.lop_days);
  const daysInMonth = Math.max(1, safeNum(ctx.daysInMonth));
  const selectedDays = Math.max(0, safeNum(ctx.selectedDays));

  const per_day_salary = daysInMonth > 0 ? Math.round((basic_salary / daysInMonth) * 100) / 100 : 0;
  const earned_salary = Math.round(per_day_salary * selectedDays * 100) / 100;
  // Always recompute lop_amount from lop_days so fractional LOP (0.25/0.5)
  // is reflected immediately and stale DB snapshots don't override UI math.
  const lop_amount = Math.round(lop_days * per_day_salary * 100) / 100;
  
  // DEBUG: Log calculation inputs and result
  console.log('[recalculateRow] DEBUG:', {
    basic_salary,
    daysInMonth,
    selectedDays,
    per_day_salary,
    lop_days,
    lop_amount,
    earned_salary
  });
  
  const salary_after_lop = Math.max(0, Math.round((earned_salary - lop_amount) * 100) / 100);
  const tds = Math.round(salary_after_lop * 0.01 * 100) / 100;
  const final_salary = Math.max(0, Math.round((salary_after_lop - tds + increment + incentive) * 100) / 100);

  return {
    per_day_salary,
    earned_salary,
    lop_amount,
    salary_after_lop,
    tds,
    final_salary,
  };
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
 * Schema validation function
 */
export const validateEmployeeMasterSchema = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('employee_master')
      .select('basic_salary')
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

/**
 * Get all profiles for dropdown selection
 */
export async function getProfiles(): Promise<{
  id: string;
  name: string;
  department: string;
}[]> {
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
