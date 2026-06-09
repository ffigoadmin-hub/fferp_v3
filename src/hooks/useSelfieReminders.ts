import { useEffect, useRef, useCallback, useState } from 'react';
import { useBrowserNotifications } from './useBrowserNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { format, parse, addMinutes, differenceInSeconds, isWithinInterval } from 'date-fns';
import { playAlert, resumeAudioContext } from '@/lib/alertSounds';
import { pushAlert } from '@/components/AlertPopup';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to send reminders 5 minutes before selfie deadlines
 * - Morning: 10:10 AM (Deadline 10:15)
 * - Lunch: 2:40 PM (Deadline 2:45)
 * - Evening: 5:40 PM (Deadline 5:45)
 */
export function useSelfieReminders() {
    const { user, isAuthenticated } = useAuth();
    const { showNotification, isSupported, permission } = useBrowserNotifications();
    const [hasInteracted, setHasInteracted] = useState(false);
    const notifiedRef = useRef<Set<string>>(new Set());

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

    const triggerSelfieAlert = useCallback((type: 'morning' | 'lunch' | 'evening', timeStr: string) => {
        const labels = {
            morning: { title: 'Morning Selfie', msg: '10:15 AM deadline approaching!' },
            lunch: { title: 'Lunch Selfie', msg: '2:45 PM deadline approaching!' },
            evening: { title: 'Evening Selfie', msg: '5:45 PM deadline approaching!' }
        };

        const config = labels[type];

        // Play alert sound
        if (hasInteracted) {
            // Use specific alert types with fallbacks implicitly handled by playAlert if desired, 
            // but we now support these specific types directly.
            playAlert(type === 'morning' ? 'morning_selfie' : type === 'lunch' ? 'lunch_selfie' : 'evening_selfie');
        }

        // Push popup alert
        pushAlert({
            type: 'slot_opening',
            title: `⚠️ ${config.title} Reminder`,
            message: `You have 5 minutes left! Submit your selfie before ${config.msg}`,
            priority: 'critical',
        });

        // Show browser notification
        if (isSupported && permission === 'granted') {
            showNotification(`📸 ${config.title} Reminder`, {
                body: `Submit your ${type} selfie now to avoid LOP. Deadline is 5 minutes away!`,
                tag: `selfie-${type}-${timeStr}`,
                requireInteraction: true,
            });
        }
    }, [hasInteracted, isSupported, permission, showNotification]);

    useEffect(() => {
        if (!isAuthenticated || !user) return;

        // Skip for CEO/Admin/Auditor who don't need selfies usually, 
        // but check current role mapping in the app
        const role = user.role?.toLowerCase();
        if (['ceo', 'admin', 'auditor'].includes(role)) return;

        const checkSelfieReminders = async () => {
            const now = new Date();
            const today = format(now, 'yyyy-MM-dd');

            // Define reminder windows (5 minutes before deadline)
            const reminders = [
                { type: 'morning' as const, time: '10:10', deadline: '10:15', selfieType: 'morning_login' },
                { type: 'lunch' as const, time: '14:40', deadline: '14:45', selfieType: 'afternoon_break' },
                { type: 'evening' as const, time: '17:40', deadline: '17:45', selfieType: 'evening_break' }
            ];

            for (const reminder of reminders) {
                const reminderTime = parse(`${today} ${reminder.time}`, 'yyyy-MM-dd HH:mm', now);

                // Is it the reminder window? (within 60 seconds)
                const diff = differenceInSeconds(now, reminderTime);
                const isReminderWindow = diff >= 0 && diff <= 60;

                if (isReminderWindow) {
                    const key = `selfie-${reminder.type}-${today}`;
                    if (notifiedRef.current.has(key)) continue;

                    // Crucial: Check if selfie is ALREADY submitted
                    const { data, error } = await supabase
                        .from('selfie_records')
                        .select('id')
                        .eq('user_id', user.id)
                        .eq('date', today)
                        .eq('selfie_type', reminder.selfieType)
                        .maybeSingle();

                    if (!error && !data) {
                        // No selfie found, trigger reminder
                        notifiedRef.current.add(key);
                        triggerSelfieAlert(reminder.type, today);
                    } else if (data) {
                        // Selfie exists, mark as "notified" to skip this window
                        notifiedRef.current.add(key);
                    }
                }
            }
        };

        // Run check every 30 seconds
        const interval = setInterval(checkSelfieReminders, 30000);
        checkSelfieReminders();

        return () => clearInterval(interval);
    }, [isAuthenticated, user, triggerSelfieAlert]);
}
