/**
 * Hourly Slot Helper Functions
 * Handles slot status calculation and late timing logic
 */

import { parse, format, addMinutes, differenceInMinutes } from 'date-fns';

export type SlotStatusType = 'LOCKED' | 'OPEN' | 'OPEN_LATE';

export interface SlotStatusResult {
  status: SlotStatusType;
  message: string;
  color?: string;
  lateMinutes?: number;
}

/**
 * Get the status of a report slot
 * Logic:
 * - Before slot end: LOCKED (Button Disabled)
 * - Slot end to +15 min: OPEN (Green) - Grace period
 * - After +15 min: OPEN_LATE - Can still submit but marked late
 * 
 * @param slotStart - Slot start time (e.g., "10:00")
 * @param slotEnd - Slot end time (e.g., "11:00")
 * @param isDayPlanSubmitted - Whether the day plan has been submitted
 * @param currentTime - Current time (defaults to now)
 */
export function getReportSlotStatus(
  slotStart: string,
  slotEnd: string,
  isDayPlanSubmitted: boolean,
  currentTime: Date = new Date()
): SlotStatusResult {
  const today = format(currentTime, 'yyyy-MM-dd');
  
  // Parse slot end time
  const slotEndTime = parse(`${today} ${slotEnd}`, 'yyyy-MM-dd HH:mm', new Date());
  
  // Grace period ends 15 minutes after slot end
  const gracePeriodEnd = addMinutes(slotEndTime, 15);

  // 1. CHECK DAY PLAN DEPENDENCY
  if (!isDayPlanSubmitted) {
    return { 
      status: 'LOCKED', 
      message: 'Submit Day Plan First',
      color: 'text-muted-foreground'
    };
  }

  // 2. CHECK IF SLOT IS OPEN (Current Time < Slot End Time)
  // Example: It's 10:30. Slot ends 11:00. You cannot report yet.
  if (currentTime < slotEndTime) {
    return { 
      status: 'LOCKED', 
      message: 'Slot Not Yet Completed',
      color: 'text-muted-foreground'
    };
  }

  // 3. CHECK GRACE PERIOD (Current Time <= Slot End + 15 mins)
  // Example: It's 11:10. Slot ended 11:00. Still within grace period.
  if (currentTime <= gracePeriodEnd) {
    return { 
      status: 'OPEN', 
      message: 'Submit Now (On Time)',
      color: 'text-status-live'
    };
  }

  // 4. AFTER GRACE PERIOD - LATE
  // Example: It's 11:20. Slot ended 11:00. Grace ended 11:15. Late by 5 mins.
  const lateMinutes = differenceInMinutes(currentTime, gracePeriodEnd);
  return { 
    status: 'OPEN_LATE', 
    message: `Late (+${lateMinutes} mins)`,
    color: 'text-status-missed',
    lateMinutes
  };
}

/**
 * Calculate lateness relative to grace period end
 * Returns the number of minutes late (0 if on time)
 * 
 * @param submissionTime - When the report was submitted
 * @param slotEnd - Slot end time (e.g., "11:00")
 * @param reportDate - Date of the report (defaults to today)
 */
export function calculateLateness(
  submissionTime: Date,
  slotEnd: string,
  reportDate: Date = new Date()
): { isLate: boolean; lateMinutes: number; message: string } {
  const dateStr = format(reportDate, 'yyyy-MM-dd');
  
  // Parse slot end time
  const slotEndTime = parse(`${dateStr} ${slotEnd}`, 'yyyy-MM-dd HH:mm', new Date());
  
  // Grace period ends 15 minutes after slot end
  const gracePeriodEnd = addMinutes(slotEndTime, 15);

  // If submitted within grace period, not late
  if (submissionTime <= gracePeriodEnd) {
    return {
      isLate: false,
      lateMinutes: 0,
      message: 'On Time'
    };
  }

  // Calculate minutes late (after grace period)
  const lateMinutes = differenceInMinutes(submissionTime, gracePeriodEnd);
  
  return {
    isLate: true,
    lateMinutes,
    message: `Late (+${lateMinutes} min)`
  };
}

/**
 * Get plan slot status
 * Plans can only be submitted during the 15-minute window before the slot starts
 * 
 * @param slotStart - Slot start time (e.g., "10:00")
 * @param currentTime - Current time (defaults to now)
 */
export function getPlanSlotStatus(
  slotStart: string,
  currentTime: Date = new Date()
): SlotStatusResult {
  const today = format(currentTime, 'yyyy-MM-dd');
  
  // Parse slot start time
  const slotStartTime = parse(`${today} ${slotStart}`, 'yyyy-MM-dd HH:mm', new Date());
  
  // Plan window opens 15 minutes before slot start
  const planWindowStart = addMinutes(slotStartTime, -15);

  // Before plan window opens
  if (currentTime < planWindowStart) {
    const minutesUntilOpen = differenceInMinutes(planWindowStart, currentTime);
    return { 
      status: 'LOCKED', 
      message: `Opens in ${minutesUntilOpen}m`,
      color: 'text-muted-foreground'
    };
  }

  // Within plan window (can submit)
  if (currentTime < slotStartTime) {
    const minutesRemaining = differenceInMinutes(slotStartTime, currentTime);
    return { 
      status: 'OPEN', 
      message: `${minutesRemaining}m to plan`,
      color: 'text-status-live'
    };
  }

  // Slot has started, plan is locked
  return { 
    status: 'LOCKED', 
    message: 'Plan Window Closed',
    color: 'text-status-late'
  };
}

/**
 * Format late badge text
 */
export function formatLateBadge(delayMinutes: number): string {
  if (delayMinutes <= 0) return '';
  return `+${delayMinutes}m`;
}

/**
 * Get the color class for late status
 */
export function getLateColorClass(lateMinutes: number): string {
  if (lateMinutes <= 0) return 'text-status-live';
  if (lateMinutes <= 5) return 'text-status-late';
  return 'text-status-missed';
}
