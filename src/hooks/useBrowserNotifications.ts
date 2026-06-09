import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

// Sound alert for SLA breaches (urgent beeping)
const playBreachSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Create an urgent beeping pattern
    const playBeep = (startTime: number, frequency: number, duration: number) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'square';

      gainNode.gain.setValueAtTime(0.3, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    // Play 3 urgent beeps
    const now = audioContext.currentTime;
    playBeep(now, 880, 0.15);
    playBeep(now + 0.2, 880, 0.15);
    playBeep(now + 0.4, 1100, 0.3);

    // Cleanup
    setTimeout(() => audioContext.close(), 1000);
  } catch (error) {
    console.log('Audio not supported:', error);
  }
};

// Sound alert for new high-priority tickets (notification chime)
const playNewTicketSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    const playTone = (startTime: number, frequency: number, duration: number, gain: number) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(gain, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    // Play ascending chime (pleasant alert)
    const now = audioContext.currentTime;
    playTone(now, 523.25, 0.15, 0.2);        // C5
    playTone(now + 0.12, 659.25, 0.15, 0.25); // E5
    playTone(now + 0.24, 783.99, 0.25, 0.3);  // G5

    // Cleanup
    setTimeout(() => audioContext.close(), 1000);
  } catch (error) {
    console.log('Audio not supported:', error);
  }
};

export function useBrowserNotifications() {
  const { user, isAuthenticated } = useAuth();
  const lastBreachSoundRef = useRef<number>(0);
  const lastNewTicketSoundRef = useRef<number>(0);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }, []);

  const showNotification = useCallback(async (title: string, options?: NotificationOptions) => {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      try {
        // Method 1: Try Service Worker (Preferred for PWA/Mobile)
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          if (registration && 'showNotification' in registration) {
            await registration.showNotification(title, {
              icon: '/favicon.ico',
              badge: '/favicon.ico',
              ...options,
            });
            return;
          }
        }

        // Method 2: Fallback to standard constructor
        const notification = new Notification(title, {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          ...options,
        });

        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000);

        // Focus window on click
        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        return notification;
      } catch (e) {
        console.warn('Notification construction failed:', e);
        return undefined;
      }
    }
  }, []);

  const playBreachAlert = useCallback(() => {
    const now = Date.now();
    // Prevent playing sound more than once every 5 seconds
    if (now - lastBreachSoundRef.current > 5000) {
      lastBreachSoundRef.current = now;
      playBreachSound();
    }
  }, []);

  const playNewTicketAlert = useCallback(() => {
    const now = Date.now();
    // Prevent playing sound more than once every 3 seconds
    if (now - lastNewTicketSoundRef.current > 3000) {
      lastNewTicketSoundRef.current = now;
      playNewTicketSound();
    }
  }, []);

  // Request permission on login
  useEffect(() => {
    if (isAuthenticated && user) {
      requestPermission();
    }
  }, [isAuthenticated, user, requestPermission]);

  return {
    requestPermission,
    showNotification,
    playBreachAlert,
    playNewTicketAlert,
    isSupported: 'Notification' in window,
    permission: typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'denied',
  };
}

// Helper to trigger notifications for specific events
export function triggerTicketNotification(
  showNotification: (title: string, options?: NotificationOptions) => Notification | Promise<Notification | undefined> | undefined,
  type: 'assigned' | 'breached' | 'resolved' | 'new_high_priority',
  ticketId: string,
  details?: string,
  playBreachAlert?: () => void,
  playNewTicketAlert?: () => void
) {
  const titles: Record<string, string> = {
    assigned: `New Ticket Assigned: ${ticketId}`,
    breached: `⚠️ SLA BREACHED: ${ticketId}`,
    resolved: `Ticket Resolved: ${ticketId}`,
    new_high_priority: `🔔 NEW HIGH PRIORITY: ${ticketId}`,
  };

  const bodies: Record<string, string> = {
    assigned: details || 'You have been assigned a new ticket',
    breached: details || 'This ticket has exceeded its SLA deadline',
    resolved: details || 'This ticket has been successfully resolved',
    new_high_priority: details || 'A new high-priority ticket requires attention',
  };

  // Play sound for breaches
  if (type === 'breached' && playBreachAlert) {
    playBreachAlert();
  }

  // Play sound for new high-priority tickets
  if (type === 'new_high_priority' && playNewTicketAlert) {
    playNewTicketAlert();
  }

  showNotification(titles[type], {
    body: bodies[type],
    tag: ticketId, // Prevents duplicate notifications for same ticket
    requireInteraction: type === 'breached' || type === 'new_high_priority',
  });
}
