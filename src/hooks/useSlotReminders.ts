import { useEffect, useRef, useCallback, useState } from 'react';
import { useBrowserNotifications } from './useBrowserNotifications';
import { useHourlyReports } from './useHourlyReports';
import { useHourlyPlans } from './useHourlyPlans';
import { useAuth } from '@/contexts/AuthContext';
import { TIME_SLOTS } from '@/types/igo-chain';
import { format, parse, addMinutes, differenceInSeconds } from 'date-fns';
import { playSlotOpeningAlert, resumeAudioContext } from '@/lib/alertSounds';
import { pushAlert } from '@/components/AlertPopup';

/**
 * Hook to send browser notifications and high-priority alerts for slot reminders
 * - When a new slot opens (start of slot)
 * - 5 minutes before report deadline
 */
export function useSlotReminders() {
  const { user, isAuthenticated } = useAuth();
  const { showNotification, isSupported, permission } = useBrowserNotifications();
  const { reports } = useHourlyReports(new Date());
  const { plans } = useHourlyPlans(new Date());
  const notifiedSlotsRef = useRef<Set<string>>(new Set());
  const slotOpenNotifiedRef = useRef<Set<string>>(new Set());
  const [hasInteracted, setHasInteracted] = useState(false);

  // Track user interaction to enable audio
  useEffect(() => {
    const handleInteraction = () => {
      setHasInteracted(true);
      resumeAudioContext();
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };

    document.addEventListener('click', handleInteraction);
    document.addEventListener('keydown', handleInteraction);

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };
  }, []);

  // Trigger slot opening alert with sound and popup
  const triggerSlotOpeningAlert = useCallback((slot: { startTime: string; endTime: string; id: string }) => {
    // Play the alert sound if user has interacted
    if (hasInteracted) {
      playSlotOpeningAlert();
    }

    // Push popup alert
    pushAlert({
      type: 'slot_opening',
      title: `Report Slot ${slot.startTime} - ${slot.endTime} is NOW OPEN!`,
      message: 'Submit your hourly report before the deadline. You have 15 minutes grace period after the slot ends.',
      priority: 'high',
    });

    // Show browser notification
    if (isSupported && permission === 'granted') {
      showNotification(`🔔 Report Slot NOW OPEN: ${slot.startTime} - ${slot.endTime}`, {
        body: 'Your hourly report slot is now active. Submit your work report!',
        tag: `slot-open-${slot.id}`,
        requireInteraction: true,
      });
    }
  }, [hasInteracted, isSupported, permission, showNotification]);

  // Trigger deadline reminder alert
  const triggerDeadlineReminder = useCallback((slot: { startTime: string; endTime: string; id: string }, hasPlan: boolean) => {
    // Play a less urgent sound for deadline reminder
    if (hasInteracted) {
      playSlotOpeningAlert();
    }

    pushAlert({
      type: 'slot_opening',
      title: `⚠️ 5 Minutes Left for ${slot.startTime} - ${slot.endTime} Report!`,
      message: hasPlan 
        ? 'You have a plan locked. Submit your report NOW to avoid LOP!' 
        : 'Submit your hourly report before the grace period ends!',
      priority: 'critical',
    });

    showNotification(`🔔 5 Minutes left to submit your ${slot.startTime}-${slot.endTime} Report!`, {
      body: hasPlan 
        ? 'You have a plan locked. Click to submit your report now.' 
        : 'Submit your hourly report before the deadline.',
      tag: `slot-reminder-${slot.id}`,
      requireInteraction: true,
    });
  }, [hasInteracted, showNotification]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      return;
    }

    // CEO does not participate in daily workflow - skip all slot reminders
    if (user.role === 'ceo') {
      return;
    }

    const checkReminders = () => {
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');

      TIME_SLOTS.forEach((slot) => {
        if (slot.isLunchBreak) return;

        // Parse slot times
        const slotStart = parse(`${today} ${slot.startTime}`, 'yyyy-MM-dd HH:mm', now);
        const slotEnd = parse(`${today} ${slot.endTime}`, 'yyyy-MM-dd HH:mm', now);
        const reminderTime = addMinutes(slotEnd, -5); // 5 minutes before end

        // Check if slot just opened (within 1 minute window of start)
        const secondsFromSlotStart = differenceInSeconds(now, slotStart);
        const isSlotJustOpened = secondsFromSlotStart >= 0 && secondsFromSlotStart <= 60;

        // Check if we're at the -5 minute mark (within 1 minute window)
        const secondsUntilReminder = differenceInSeconds(reminderTime, now);
        const isReminderWindow = secondsUntilReminder >= 0 && secondsUntilReminder <= 60;

        // Check if report is pending for this slot
        const hasReport = reports.some((r) => r.time_slot === slot.id);
        const hasPlan = plans.some((p) => p.time_slot === slot.id);

        // Unique keys for notifications
        const slotOpenKey = `open-${today}-${slot.id}`;
        const reminderKey = `reminder-${today}-${slot.id}`;

        // SLOT OPENING ALERT - when slot starts
        if (isSlotJustOpened && !slotOpenNotifiedRef.current.has(slotOpenKey)) {
          slotOpenNotifiedRef.current.add(slotOpenKey);
          triggerSlotOpeningAlert(slot);
        }

        // 5-MINUTE DEADLINE ALERT
        if (isReminderWindow && !hasReport && !notifiedSlotsRef.current.has(reminderKey)) {
          notifiedSlotsRef.current.add(reminderKey);
          triggerDeadlineReminder(slot, hasPlan);
        }
      });
    };

    // Run immediately and every 30 seconds
    checkReminders();
    const interval = setInterval(checkReminders, 30000);

    // Reset notified slots at midnight
    const resetNotified = () => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        notifiedSlotsRef.current.clear();
        slotOpenNotifiedRef.current.clear();
      }
    };
    const midnightCheck = setInterval(resetNotified, 60000);

    return () => {
      clearInterval(interval);
      clearInterval(midnightCheck);
    };
  }, [isAuthenticated, user, reports, plans, triggerSlotOpeningAlert, triggerDeadlineReminder]);
}
