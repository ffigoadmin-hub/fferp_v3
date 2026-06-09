// Notification sound utility for real-time alerts

// Create a simple beep sound using Web Audio API
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

export type NotificationSoundType = 'payment' | 'alert' | 'success' | 'warning';

const soundConfigs: Record<NotificationSoundType, { frequency: number; duration: number; type: OscillatorType }> = {
  payment: { frequency: 880, duration: 0.15, type: 'sine' }, // High A note, pleasant chime
  alert: { frequency: 440, duration: 0.2, type: 'square' }, // A4 note, attention-grabbing
  success: { frequency: 523.25, duration: 0.1, type: 'sine' }, // C5 note, positive
  warning: { frequency: 329.63, duration: 0.25, type: 'triangle' }, // E4 note, cautionary
};

export function playNotificationSound(type: NotificationSoundType = 'payment'): void {
  try {
    const ctx = getAudioContext();
    const config = soundConfigs[type];
    
    // Resume context if it's suspended (required by browsers)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = config.frequency;
    oscillator.type = config.type;

    // Fade in and out for a smoother sound
    const now = ctx.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01); // Quick fade in
    gainNode.gain.linearRampToValueAtTime(0, now + config.duration); // Fade out

    oscillator.start(now);
    oscillator.stop(now + config.duration);
  } catch (error) {
    console.warn('Failed to play notification sound:', error);
  }
}

// Play a double chime for new payments (more noticeable)
export function playPaymentNotificationSound(): void {
  playNotificationSound('payment');
  setTimeout(() => {
    playNotificationSound('success');
  }, 150);
}
