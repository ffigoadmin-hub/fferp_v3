/**
 * Time slot normalization and matching utilities
 * Handles format mismatches between DB and UI
 * 
 * DB stores: "1", "2", "3", etc. (slot numbers)
 * UI expects: "10:00-11:00", "11:00-12:00", etc.
 */

// Canonical time slots used in the UI (8 slots - lunch break excluded)
export const TIME_SLOTS = [
  '10:00-11:00',
  '11:00-12:00',
  '12:00-13:00',
  '13:00-14:00',
  '14:45-16:00',
  '16:00-17:00',
  '17:00-18:00',
  '18:00-19:30',
] as const;

export type TimeSlotId = typeof TIME_SLOTS[number];

// Map from slot number to time string
// Handles both old (9-slot with lunch break as slot 5) and new (8-slot) systems
// Old system: 1,2,3,4,5(lunch),6,7,8,9
// New system: 1,2,3,4,5,6,7,8 (no lunch slot)
const SLOT_NUMBER_MAP: Record<string, string> = {
  '1': '10:00-11:00',
  '2': '11:00-12:00',
  '3': '12:00-13:00',
  '4': '13:00-14:00',
  '5': '14:45-16:00',  // New: slot 5 | Old: lunch break (14:00-14:45) - map to post-lunch
  '6': '14:45-16:00',  // Old: slot 6 was post-lunch when lunch was slot 5
  '7': '16:00-17:00',  // Old: slot 7 | New: slot 6
  '8': '17:00-18:00',  // Old: slot 8 | New: slot 7
  '9': '18:00-19:30',  // Old: slot 9 | New: slot 8
};

// Reverse map: time string to slot number
const SLOT_TIME_TO_NUMBER: Record<string, string> = Object.fromEntries(
  Object.entries(SLOT_NUMBER_MAP).map(([k, v]) => [v, k])
);

/**
 * Helper to convert HH:mm format to 12h format (e.g., "14:45" -> "02:45 PM")
 */
export function to12h(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
}

/**
 * Normalize a time slot to the canonical format "HH:MM-HH:MM"
 * Handles various formats:
 * - "1", "2", etc. (slot numbers from DB)
 * - "10:00-11:00" (already normalized)
 * - "10:00 AM - 11:00 AM"
 * - "10-11"
 */
export function normalizeSlot(slot: string | number): string {
  if (slot === null || slot === undefined) return '';

  const slotStr = String(slot).trim();
  if (!slotStr) return '';

  // Handle numeric slot IDs (1-9) - this is the DB format
  if (/^\d$/.test(slotStr)) {
    return SLOT_NUMBER_MAP[slotStr] || slotStr;
  }

  // Remove all spaces
  let normalized = slotStr.replace(/\s+/g, '');

  // Remove AM/PM suffixes (case insensitive)
  normalized = normalized.replace(/am|pm/gi, '');

  // Handle "10-11" format -> "10:00-11:00"
  const shortFormat = normalized.match(/^(\d{1,2})-(\d{1,2})$/);
  if (shortFormat) {
    const start = shortFormat[1].padStart(2, '0');
    const end = shortFormat[2].padStart(2, '0');
    return `${start}:00-${end}:00`;
  }

  // Handle "10:00-11:00" or similar
  const fullFormat = normalized.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
  if (fullFormat) {
    const startHour = fullFormat[1].padStart(2, '0');
    const startMin = fullFormat[2];
    const endHour = fullFormat[3].padStart(2, '0');
    const endMin = fullFormat[4];
    return `${startHour}:${startMin}-${endHour}:${endMin}`;
  }

  // Return as-is if no pattern matches
  return slotStr;
}

/**
 * Convert a time slot string to its numeric slot ID (1-8)
 */
export function getSlotNumber(slot: string): string {
  const normalized = normalizeSlot(slot);
  return SLOT_TIME_TO_NUMBER[normalized] || slot;
}

/**
 * Check if two slot strings represent the same time slot
 */
export function slotsMatch(slot1: string, slot2: string): boolean {
  return normalizeSlot(slot1) === normalizeSlot(slot2);
}

/**
 * Find a record in an array by matching its time_slot field
 */
export function findBySlot<T extends { time_slot: string }>(
  records: T[],
  targetSlot: string
): T | undefined {
  const normalizedTarget = normalizeSlot(targetSlot);
  return records.find(r => normalizeSlot(r.time_slot) === normalizedTarget);
}

/**
 * Get the display format of a slot (e.g., "10:00 AM - 11:00 AM")
 */
export function formatSlotDisplay(slot: string): string {
  const normalized = normalizeSlot(slot);
  const parts = normalized.split('-');
  if (parts.length === 2) {
    return `${to12h(parts[0])} - ${to12h(parts[1])}`;
  }
  return slot;
}

/**
 * Get the start hour of a slot (for sorting/comparison)
 */
export function getSlotStartHour(slot: string): number {
  const normalized = normalizeSlot(slot);
  const match = normalized.match(/^(\d{2}):/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Sort slots by start time
 */
export function sortSlots<T extends { time_slot: string }>(records: T[]): T[] {
  return [...records].sort((a, b) =>
    getSlotStartHour(a.time_slot) - getSlotStartHour(b.time_slot)
  );
}

