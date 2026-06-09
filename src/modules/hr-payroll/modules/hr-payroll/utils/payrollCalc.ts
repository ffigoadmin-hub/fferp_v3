import type { PayrollCalcInput, PayrollCalcResult } from "../types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Core payroll calculation engine.
 * Structured so PF/ESI can be plugged in later by replacing the 0-returning functions.
 */
export function calculatePayroll(input: PayrollCalcInput): PayrollCalcResult {
  const { monthlySalary, daysInMonth, joiningDate, payrollMonth, payrollYear, lopDays, bonus, incentive } = input;

  const dailySalary = round2(monthlySalary / daysInMonth);

  // Join-month proration
  const joinDate = new Date(joiningDate);
  const joinMonth = joinDate.getMonth() + 1; // 1-based
  const joinYear = joinDate.getFullYear();
  const joinDay = joinDate.getDate();

  let payableDays = daysInMonth;
  if (joinMonth === payrollMonth && joinYear === payrollYear) {
    payableDays = daysInMonth - (joinDay - 1);
  }

  // Cap LOP at payable days
  const effectiveLop = Math.min(lopDays, payableDays);

  const basePay = round2(dailySalary * payableDays);
  const earned = round2(basePay - dailySalary * effectiveLop);
  const gross = round2(earned + bonus + incentive);

  // Deductions — structured for future plug-in
  const tds = round2(gross * 0.01);
  const pf = calculatePF(gross);
  const esi = calculateESI(gross);

  const netPay = round2(gross - tds - pf - esi);

  return { dailySalary, payableDays, basePay, earned, gross, tds, pf, esi, netPay };
}

/** PF stub — returns 0, replace with actual logic later */
function calculatePF(_gross: number): number {
  return 0;
}

/** ESI stub — returns 0, replace with actual logic later */
function calculateESI(_gross: number): number {
  return 0;
}
