// Salary calculation utilities for Employee Master

/**
 * Get the number of days in the current month
 */
export function getDaysInMonth(date: Date = new Date()): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Get the number of days in a specific month and year
 */
export function getDaysInMonthForDate(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Validate LOP days cannot exceed total days in month
 */
export function validateLOPDays(lopDays: number, totalDays: number): number {
  if (lopDays > totalDays) {
    console.warn(`LOP days (${lopDays}) cannot exceed total days in month (${totalDays})`);
    return totalDays;
  }
  return lopDays;
}

/**
 * Convert lop_type string to numeric days
 * Examples: "0.25_day" -> 0.25, "0.5_day" -> 0.5, "1_day" -> 1
 */
export function lopTypeToDays(type: string): number {
  if (!type) return 0;
  
  // Extract numeric part from lop_type (handles "0.25_day", "0.5_day", "1_day", etc.)
  const match = type.match(/([0-9.]+)/);
  return match ? Number(match[1]) : 0;
}

/**
 * Complete payroll calculation with validation
 */
export interface PayrollCalculation {
  monthlySalary: number;
  totalDaysInMonth: number;
  lopDays: number;
  perDaySalary: number;
  lopAmount: number;
  tdsPercent: number;
  tdsAmount: number;
  totalSalary: number;
  isValid: boolean;
  errors?: string[];
}

export function calculatePayroll(
  monthlySalary: number,
  lopDays: number,
  tdsPercent: number = 1,
  date: Date = new Date()
): PayrollCalculation {
  const totalDaysInMonth = getDaysInMonthForDate(date);
  const validLOPDays = validateLOPDays(lopDays, totalDaysInMonth);
  
  const perDaySalary = monthlySalary > 0 ? monthlySalary / totalDaysInMonth : 0;
  const lopAmount = perDaySalary * validLOPDays;
  const tdsAmount = monthlySalary * (tdsPercent / 100);
  const totalSalary = monthlySalary - lopAmount - tdsAmount;
  
  // Validation
  const errors: string[] = [];
  let isValid = true;
  
  if (monthlySalary <= 0) {
    errors.push('Monthly salary must be greater than 0');
    isValid = false;
  }
  
  if (validLOPDays > totalDaysInMonth) {
    errors.push(`LOP days (${validLOPDays}) cannot exceed total days in month (${totalDaysInMonth})`);
    isValid = false;
  }
  
  return {
    monthlySalary,
    totalDaysInMonth,
    lopDays: validLOPDays,
    perDaySalary: Math.round(perDaySalary * 100) / 100, // Round to 2 decimal places
    lopAmount: Math.round(lopAmount * 100) / 100,
    tdsPercent,
    tdsAmount: Math.round(tdsAmount * 100) / 100,
    totalSalary: Math.round(totalSalary * 100) / 100,
    isValid,
    errors
  };
}

/**
 * Get date range for current month filtering
 */
export function getCurrentMonthRange(): { startDate: Date; endDate: Date } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0); // First day of next month
  
  return { startDate, endDate };
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}
