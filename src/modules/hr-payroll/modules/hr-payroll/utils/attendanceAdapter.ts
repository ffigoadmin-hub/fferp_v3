/**
 * Attendance adapter stub.
 * Replace this implementation with your actual attendance system integration.
 *
 * Interface contract:
 *   getLOPDays(employeeId, month, year) => number of LOP days
 */
export const attendanceAdapter = {
  /**
   * Returns LOP (Loss of Pay) days for a given employee in a given month.
   * Currently returns 0 — plug in attendance system here.
   */
  getLOPDays(_employeeId: string, _month: number, _year: number): number {
    return 0;
  },
};
