// @ts-nocheck
import { describe, it, expect } from "vitest";
import { calculatePayroll } from "@/modules/hr-payroll/utils/payrollCalc";

describe("payrollCalc", () => {
  it("calculates correctly for 31-day month, full attendance", () => {
    const result = calculatePayroll({
      monthlySalary: 31000,
      daysInMonth: 31,
      joiningDate: "2024-01-01",
      payrollMonth: 3,
      payrollYear: 2025,
      lopDays: 0,
      bonus: 0,
      incentive: 0,
    });
    expect(result.dailySalary).toBe(1000);
    expect(result.payableDays).toBe(31);
    expect(result.basePay).toBe(31000);
    expect(result.earned).toBe(31000);
    expect(result.gross).toBe(31000);
    expect(result.tds).toBe(310);
    expect(result.pf).toBe(0);
    expect(result.esi).toBe(0);
    expect(result.netPay).toBe(30690);
  });

  it("calculates correctly for 28-day month", () => {
    const result = calculatePayroll({
      monthlySalary: 28000,
      daysInMonth: 28,
      joiningDate: "2024-01-01",
      payrollMonth: 2,
      payrollYear: 2025,
      lopDays: 0,
      bonus: 500,
      incentive: 200,
    });
    expect(result.dailySalary).toBe(1000);
    expect(result.payableDays).toBe(28);
    expect(result.earned).toBe(28000);
    expect(result.gross).toBe(28700);
    expect(result.tds).toBe(287);
    expect(result.netPay).toBe(28413);
  });

  it("prorates for mid-month join", () => {
    const result = calculatePayroll({
      monthlySalary: 31000,
      daysInMonth: 31,
      joiningDate: "2025-03-16",
      payrollMonth: 3,
      payrollYear: 2025,
      lopDays: 0,
      bonus: 0,
      incentive: 0,
    });
    // payableDays = 31 - (16-1) = 16
    expect(result.payableDays).toBe(16);
    expect(result.basePay).toBe(16000);
    expect(result.earned).toBe(16000);
    expect(result.netPay).toBe(15840);
  });

  it("handles decimal LOP days", () => {
    const result = calculatePayroll({
      monthlySalary: 30000,
      daysInMonth: 30,
      joiningDate: "2024-01-01",
      payrollMonth: 4,
      payrollYear: 2025,
      lopDays: 2.5,
      bonus: 0,
      incentive: 0,
    });
    // dailySalary = 1000, earned = 30000 - 2500 = 27500
    expect(result.dailySalary).toBe(1000);
    expect(result.earned).toBe(27500);
    expect(result.gross).toBe(27500);
    expect(result.tds).toBe(275);
    expect(result.netPay).toBe(27225);
  });

  it("caps LOP at payable days", () => {
    const result = calculatePayroll({
      monthlySalary: 31000,
      daysInMonth: 31,
      joiningDate: "2025-03-25",
      payrollMonth: 3,
      payrollYear: 2025,
      lopDays: 50, // more than payable
      bonus: 0,
      incentive: 0,
    });
    // payableDays = 31 - 24 = 7, LOP capped at 7
    expect(result.payableDays).toBe(7);
    expect(result.earned).toBe(0);
    expect(result.netPay).toBe(0);
  });

  it("rounds money to 2 decimal places", () => {
    const result = calculatePayroll({
      monthlySalary: 10000,
      daysInMonth: 31,
      joiningDate: "2024-01-01",
      payrollMonth: 1,
      payrollYear: 2025,
      lopDays: 0,
      bonus: 0,
      incentive: 0,
    });
    // dailySalary = 10000/31 = 322.58...
    expect(result.dailySalary).toBe(322.58);
    // basePay = 322.58 * 31 = 9999.98
    expect(result.basePay).toBe(9999.98);
    // Each value should have at most 2 decimal places
    const decimals = (n: number) => (n.toString().split(".")[1] || "").length;
    expect(decimals(result.dailySalary)).toBeLessThanOrEqual(2);
    expect(decimals(result.netPay)).toBeLessThanOrEqual(2);
  });
});
