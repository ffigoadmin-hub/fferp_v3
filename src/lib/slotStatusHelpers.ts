import { TimeSlot } from '@/types/igo-chain';
import { format, parse, addMinutes, isBefore, isAfter } from 'date-fns';

export type SlotPhase = 'plan' | 'report' | 'locked';

interface SlotOptions {
  bypassTimeLocks?: boolean;
}

/**
 * Get the current phase of a slot (plan, report, or locked)
 * Updated with -5 minute rule and admin bypass
 */
export const getSlotPhase = (
  slot: TimeSlot,
  currentTime: Date,
  hasPlan: boolean,
  hasReport: boolean,
  options: SlotOptions = {}
): SlotPhase => {
  // If already has report, it's locked
  if (hasReport) return 'locked';

  // Admin/Tester bypass - always allow report phase
  if (options.bypassTimeLocks) {
    const today = format(currentTime, 'yyyy-MM-dd');
    const slotStart = parse(`${today} ${slot.startTime}`, 'yyyy-MM-dd HH:mm', new Date());
    const planWindowStart = addMinutes(slotStart, -15);
    
    // If we're in plan window and don't have plan
    if (currentTime >= planWindowStart && currentTime < slotStart && !hasPlan) {
      return 'plan';
    }
    // Admins can always submit reports
    return 'report';
  }

  const today = format(currentTime, 'yyyy-MM-dd');
  const slotStart = parse(`${today} ${slot.startTime}`, 'yyyy-MM-dd HH:mm', new Date());
  const slotEnd = parse(`${today} ${slot.endTime}`, 'yyyy-MM-dd HH:mm', new Date());

  // Plan phase: 15 min before slot starts until slot starts
  const planWindowStart = addMinutes(slotStart, -15);

  // If we're before slot start, it's plan phase
  if (currentTime < slotStart) {
    if (currentTime >= planWindowStart && !hasPlan) {
      return 'plan';
    }
    return 'locked';
  }

  // NEW: -5 Minute Rule - Report unlocks 5 minutes BEFORE slot ends
  const reportUnlockTime = addMinutes(slotEnd, -5);
  if (currentTime >= reportUnlockTime) {
    return 'report';
  }

  // During the slot but before -5 minute mark - locked
  return 'locked';
};

/**
 * Get slot status for display (live, late, missed, upcoming, completed)
 */
export type SlotStatus = 'live' | 'late' | 'missed' | 'upcoming' | 'completed';

export const getSlotStatus = (
  slot: TimeSlot,
  currentTime: Date,
  submitted: boolean,
  options: SlotOptions = {}
): SlotStatus => {
  if (submitted) return 'completed';
  if (slot.isLunchBreak) return 'upcoming';

  const today = format(currentTime, 'yyyy-MM-dd');
  const slotStart = parse(`${today} ${slot.startTime}`, 'yyyy-MM-dd HH:mm', new Date());
  const slotEnd = parse(`${today} ${slot.endTime}`, 'yyyy-MM-dd HH:mm', new Date());

  // Admin bypass - show as live if report window is open
  if (options.bypassTimeLocks) {
    if (isBefore(currentTime, slotStart)) return 'upcoming';
    return 'live';
  }

  if (isBefore(currentTime, slotStart)) return 'upcoming';
  if (isAfter(currentTime, slotEnd)) return 'missed';
  return 'live';
};

/**
 * Check if plan is required before report
 */
export const canSubmitReport = (
  slot: TimeSlot,
  currentTime: Date,
  hasPlan: boolean,
  hasReport: boolean,
  options: SlotOptions = {}
): { canSubmit: boolean; reason?: string } => {
  if (hasReport) {
    return { canSubmit: false, reason: 'Report already submitted' };
  }

  // Admins can always submit
  if (options.bypassTimeLocks) {
    return { canSubmit: true };
  }

  // Must have plan first (Plan First rule)
  if (!hasPlan) {
    return { canSubmit: false, reason: 'Submit Plan First' };
  }

  const phase = getSlotPhase(slot, currentTime, hasPlan, hasReport, options);
  if (phase !== 'report') {
    return { canSubmit: false, reason: 'Report window not open yet' };
  }

  return { canSubmit: true };
};

/**
 * Check if user has admin bypass privileges
 */
export const hasAdminBypass = (role?: string): boolean => {
  if (!role) return false;
  const normalizedRole = role.toLowerCase();
  return normalizedRole === 'admin' || normalizedRole === 'tester' || normalizedRole === 'ceo';
};

/**
 * Get EOD unlock time (7:20 PM)
 */
export const getEODUnlockTime = (date: Date = new Date()): Date => {
  const eodTime = new Date(date);
  eodTime.setHours(19, 20, 0, 0); // 7:20 PM
  return eodTime;
};

/**
 * Check if EOD report can be submitted
 */
export const canSubmitEOD = (
  currentTime: Date,
  hasSubmittedEOD: boolean,
  options: SlotOptions = {}
): { canSubmit: boolean; reason?: string } => {
  if (hasSubmittedEOD) {
    return { canSubmit: false, reason: 'EOD already submitted' };
  }

  // Admin bypass
  if (options.bypassTimeLocks) {
    return { canSubmit: true };
  }

  const eodUnlockTime = getEODUnlockTime(currentTime);
  if (currentTime < eodUnlockTime) {
    return { canSubmit: false, reason: 'EOD opens at 7:20 PM' };
  }

  return { canSubmit: true };
};
