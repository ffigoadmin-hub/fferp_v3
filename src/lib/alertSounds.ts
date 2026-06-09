// High-alert sound utilities for critical notifications

import { supabase } from '@/integrations/supabase/client';

let audioContext: AudioContext | null = null;
const customTonesCache: Record<string, string | null> = {};

// Preload custom tones from database
export async function preloadCustomTones(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('notification_settings')
      .select('category, audio_url')
      .eq('is_enabled', true);

    if (error) throw error;

    data?.forEach(setting => {
      if (setting.audio_url) {
        customTonesCache[setting.category] = setting.audio_url;
      }
    });
  } catch (error) {
    console.warn('Failed to preload custom tones:', error);
  }
}

// Resume audio context safely (checks if method exists)
export async function safeResume(ctx: BaseAudioContext): Promise<void> {
  if (ctx.state === 'suspended' && 'resume' in ctx) {
    try {
      await (ctx as AudioContext).resume();
    } catch (e) {
      console.warn('Context resume failed:', e);
    }
  }
}

// Global accessor
function getAudioContext(): AudioContext {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

// Public wrapper for global context
export async function resumeAudioContext(): Promise<void> {
  const ctx = getAudioContext();
  await safeResume(ctx);
}

// --- HELPER: Play a tone with ADSR envelope ---
const playTone = (ctx: BaseAudioContext, freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol: number = 0.5) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.value = freq;

  // Smooth Attack/Release to prevent clicking
  const attack = 0.05;
  const release = 0.05;

  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vol, start + attack);
  gain.gain.setValueAtTime(vol, start + dur - release);
  gain.gain.linearRampToValueAtTime(0, start + dur);

  osc.start(start);
  osc.stop(start + dur);
};

// DANGER ALERT - "Emergency Pulse" (Urgent Double Burst) (2s)
export function playDangerAlert(customCtx?: BaseAudioContext): void {
  try {
    const ctx = customCtx || getAudioContext();
    safeResume(ctx);
    const now = ctx.currentTime;

    // Two urgent bursts with rising tension
    for (let i = 0; i < 2; i++) {
      const t = now + (i * 0.7);

      // Core alarm tone (sine for clarity)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600 + (i * 100), t);
      osc.frequency.linearRampToValueAtTime(900 + (i * 100), t + 0.25);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.5, t + 0.04);
      gain.gain.setValueAtTime(0.5, t + 0.2);
      gain.gain.linearRampToValueAtTime(0, t + 0.4);

      osc.start(t);
      osc.stop(t + 0.4);

      // Sub-bass impact
      const sub = ctx.createOscillator();
      const sGain = ctx.createGain();
      sub.connect(sGain);
      sGain.connect(ctx.destination);
      sub.type = 'sine';
      sub.frequency.value = 120;
      sGain.gain.setValueAtTime(0, t);
      sGain.gain.linearRampToValueAtTime(0.3, t + 0.03);
      sGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
      sub.start(t);
      sub.stop(t + 0.3);
    }

  } catch (error) {
    console.warn('Failed to play danger alert:', error);
  }
}

// ESCALATION ALERT - "Attention Bell" (Sharp Double Ring) (2s)
export function playEscalationAlert(customCtx?: BaseAudioContext): void {
  try {
    const ctx = customCtx || getAudioContext();
    safeResume(ctx);
    const now = ctx.currentTime;

    // Two-strike bell: low → high (attention grabbing)
    const strikes = [1046.50, 1568.00]; // C6, G6
    strikes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;

      const t = now + (i * 0.2);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.5, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.8);

      osc.start(t);
      osc.stop(t + 0.8);

      // Metallic overtone
      const ov = ctx.createOscillator();
      const og = ctx.createGain();
      ov.connect(og);
      og.connect(ctx.destination);
      ov.type = 'sine';
      ov.frequency.value = freq * 2.76;
      og.gain.setValueAtTime(0, t);
      og.gain.linearRampToValueAtTime(0.05, t + 0.02);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      ov.start(t);
      ov.stop(t + 0.4);
    });

  } catch (error) {
    console.warn('Failed to play escalation alert:', error);
  }
}

// ANNOUNCEMENT ALERT - "Broadcast Chime" (Ding-Dong-Ding) (2s)
export function playAnnouncementAlert(customCtx?: BaseAudioContext): void {
  try {
    const ctx = customCtx || getAudioContext();
    safeResume(ctx);
    const now = ctx.currentTime;

    // Classic 3-note PA chime: High → Low → High
    const notes = [880, 659.25, 880]; // A5, E5, A5

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.value = freq;

      const t = now + (i * 0.35);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.7);

      osc.start(t);
      osc.stop(t + 0.7);
    });

  } catch (error) {
    console.warn('Failed to play announcement alert:', error);
  }
}

// TASK ASSIGNMENT - "Data Processing" (4s)
export function playTaskAlert(customCtx?: BaseAudioContext): void {
  try {
    const ctx = customCtx || getAudioContext();
    safeResume(ctx);
    const now = ctx.currentTime;

    // Rhythmic "typing" effect followed by confirmation
    for (let i = 0; i < 12; i++) {
      playTone(ctx, 1200 + (Math.random() * 200), now + (i * 0.15), 0.05, 'square', 0.15);
    }
    // Final confirmation Ping
    playTone(ctx, 1500, now + 2.0, 1.5, 'sine', 0.5);
    playTone(ctx, 3000, now + 2.0, 1.5, 'sine', 0.2); // Sparkle

  } catch (error) {
    console.warn('Failed to play task alert:', error);
  }
}

// LOP ALERT - "Penalty Tone" (Somber Descending Minor) (2s)
export function playLOPAlert(customCtx?: BaseAudioContext): void {
  try {
    const ctx = customCtx || getAudioContext();
    safeResume(ctx);
    const now = ctx.currentTime;

    // Descending minor third: E5 → C5 (sad but clear)
    const notes = [659.25, 523.25];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;

      const t = now + (i * 0.25);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.45, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.7);

      osc.start(t);
      osc.stop(t + 0.7);
    });

    // Low rumble underneath for weight
    const sub = ctx.createOscillator();
    const sGain = ctx.createGain();
    sub.connect(sGain);
    sGain.connect(ctx.destination);
    sub.type = 'sine';
    sub.frequency.value = 180;
    sGain.gain.setValueAtTime(0, now);
    sGain.gain.linearRampToValueAtTime(0.2, now + 0.1);
    sGain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
    sub.start(now);
    sub.stop(now + 1.0);

  } catch (error) {
    console.warn('Failed to play LOP alert:', error);
  }
}

// SLA BREACH - "Deadline Warning" (Accelerating Pulse) (2s)
export function playSLABreachAlert(customCtx?: BaseAudioContext): void {
  try {
    const ctx = customCtx || getAudioContext();
    safeResume(ctx);
    const now = ctx.currentTime;

    // 5 accelerating pings that build urgency
    for (let i = 0; i < 5; i++) {
      const t = now + (i * (0.3 - (i * 0.04)));
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 800 + (i * 60);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.35 + (i * 0.03), t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

      osc.start(t);
      osc.stop(t + 0.15);
    }

    // Final sustained warning tone
    const final = ctx.createOscillator();
    const fGain = ctx.createGain();
    final.connect(fGain);
    fGain.connect(ctx.destination);
    final.type = 'sine';
    final.frequency.value = 1100;
    fGain.gain.setValueAtTime(0, now + 1.2);
    fGain.gain.linearRampToValueAtTime(0.4, now + 1.25);
    fGain.gain.exponentialRampToValueAtTime(0.01, now + 2.0);
    final.start(now + 1.2);
    final.stop(now + 2.0);

  } catch (error) {
    console.warn('Failed to play SLA breach alert:', error);
  }
}

// SLOT OPENING - "Crystal Bells" (Premium Warm Chime) (2s)
export function playSlotOpeningAlert(customCtx?: BaseAudioContext): void {
  try {
    const ctx = customCtx || getAudioContext();
    safeResume(ctx);
    const now = ctx.currentTime;

    // 1. Warm chord sweep: Cmaj7 → Fmaj7 (lush, premium)
    const chord1 = [523.25, 659.25, 783.99, 987.77]; // C5, E5, G5, B5
    const chord2 = [698.46, 880.00, 1046.50, 1318.51]; // F5, A5, C6, E6

    // First chord - soft entrance
    chord1.forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);

      osc.start(now);
      osc.stop(now + 1.2);
    });

    // Second chord - resolves upward
    chord2.forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, now + 0.5);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.58);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 1.8);

      osc.start(now + 0.5);
      osc.stop(now + 1.8);
    });

    // 2. Sparkle cascade (quick descending twinkles)
    const sparkles = [3520, 3135.96, 2793.83, 2637.02]; // A7, G7, F7, E7
    sparkles.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;

      const t = now + 0.3 + (i * 0.08);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.1, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.start(t);
      osc.stop(t + 0.25);
    });

  } catch (error) {
    console.warn('Failed to play slot opening alert:', error);
  }
}



// CEO ALERT - "Executive Arrival" (Stately Ascending 4th) (2s)
export function playCEOAlert(customCtx?: BaseAudioContext): void {
  try {
    const ctx = customCtx || getAudioContext();
    safeResume(ctx);
    const now = ctx.currentTime;

    // Ascending perfect 4th: C5 → F5 (authoritative)
    const notes = [523.25, 698.46];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;

      const t = now + (i * 0.22);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.45, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.8);

      osc.start(t);
      osc.stop(t + 0.8);
    });

    // Sustaining F Major chord underneath
    const chord = [349.23, 440, 523.25]; // F4, A4, C5
    chord.forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, now + 0.4);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.5);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 1.8);

      osc.start(now + 0.4);
      osc.stop(now + 1.8);
    });

  } catch (error) {
    console.warn('Failed to play CEO alert:', error);
  }
}

// DIRECTOR ALERT - "Authority Signal" (Strong Double Strike) (2s)
export function playDirectorAlert(customCtx?: BaseAudioContext): void {
  try {
    const ctx = customCtx || getAudioContext();
    safeResume(ctx);
    const now = ctx.currentTime;

    // Two confident strikes: D5 → A5
    const strikes = [587.33, 880];
    strikes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.value = freq;

      const t = now + (i * 0.18);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);

      osc.start(t);
      osc.stop(t + 0.6);
    });

    // Warm sustain
    const pad = ctx.createOscillator();
    const pGain = ctx.createGain();
    pad.connect(pGain);
    pGain.connect(ctx.destination);
    pad.type = 'sine';
    pad.frequency.value = 440;
    pGain.gain.setValueAtTime(0, now + 0.3);
    pGain.gain.linearRampToValueAtTime(0.1, now + 0.4);
    pGain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
    pad.start(now + 0.3);
    pad.stop(now + 1.5);

  } catch (error) {
    console.warn('Failed to play Director alert:', error);
  }
}

// GM ALERT - "Command Ping" (Military Precision) (2s)
export function playGMAlert(customCtx?: BaseAudioContext): void {
  try {
    const ctx = customCtx || getAudioContext();
    safeResume(ctx);
    const now = ctx.currentTime;

    // Three quick precision pings: G5, B5, D6 (ascending)
    const notes = [783.99, 987.77, 1174.66];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;

      const t = now + (i * 0.12);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.45);

      osc.start(t);
      osc.stop(t + 0.45);
    });

  } catch (error) {
    console.warn('Failed to play GM alert:', error);
  }
}

// BOI ALERT - "Inspection Chime" (Clean Double Note) (2s)
export function playBOIAlert(customCtx?: BaseAudioContext): void {
  try {
    const ctx = customCtx || getAudioContext();
    safeResume(ctx);
    const now = ctx.currentTime;

    // Two clean notes: A5 → E6 (professional)
    const notes = [880, 1318.51];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;

      const t = now + (i * 0.15);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);

      osc.start(t);
      osc.stop(t + 0.6);
    });

    // Subtle confirmation hum
    const hum = ctx.createOscillator();
    const hGain = ctx.createGain();
    hum.connect(hGain);
    hGain.connect(ctx.destination);
    hum.type = 'sine';
    hum.frequency.value = 440;
    hGain.gain.setValueAtTime(0, now + 0.25);
    hGain.gain.linearRampToValueAtTime(0.08, now + 0.35);
    hGain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);
    hum.start(now + 0.25);
    hum.stop(now + 1.2);

  } catch (error) {
    console.warn('Failed to play BOI alert:', error);
  }
}

// PAYMENT ALERT - "Money Received" (Premium Confirmation) (2s)
export function playPaymentAlert(customCtx?: BaseAudioContext): void {
  try {
    const ctx = customCtx || getAudioContext();
    safeResume(ctx);
    const now = ctx.currentTime;

    // 1. Clean double-ping (like Google Pay / PhonePe success)
    const pingNotes = [783.99, 987.77]; // G5, B5
    pingNotes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;

      const t = now + (i * 0.12);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.45, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

      osc.start(t);
      osc.stop(t + 0.5);

      // Bell overtone
      const ov = ctx.createOscillator();
      const og = ctx.createGain();
      ov.connect(og);
      og.connect(ctx.destination);
      ov.type = 'sine';
      ov.frequency.value = freq * 2;
      og.gain.setValueAtTime(0, t);
      og.gain.linearRampToValueAtTime(0.06, t + 0.02);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      ov.start(t);
      ov.stop(t + 0.25);
    });

    // 2. Warm confirming chord (G Major - resolves nicely)
    const chord = [392.00, 493.88, 587.33, 783.99]; // G4, B4, D5, G5
    chord.forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, now + 0.3);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 1.8);

      osc.start(now + 0.3);
      osc.stop(now + 1.8);
    });

  } catch (error) {
    console.warn('Failed to play payment alert:', error);
  }
}

// SELFIE REMINDER - "Gentle Nudge" (Soft Pleasant Ping) (2s)
export function playSelfieReminderAlert(customCtx?: BaseAudioContext): void {
  try {
    const ctx = customCtx || getAudioContext();
    safeResume(ctx);
    const now = ctx.currentTime;

    // Two soft, warm notes: C5 → E5 (gentle major 3rd)
    const notes = [523.25, 659.25];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;

      const t = now + (i * 0.25);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.8);

      osc.start(t);
      osc.stop(t + 0.8);
    });

  } catch (error) {
    console.warn('Failed to play selfie reminder alert:', error);
  }
}


// INCOMING / OUTGOING CALL RINGTONE MANAGER
// Uses the Microsoft Teams default ringtone audio file (hosted via public CDN)
// Supports loop, start, and stop — must be explicitly stopped.

// Microsoft Teams inspired ringtone synthesis
const TEAMS_RINGTONE_URL = null; // We use synthesis for the perfect Teams feel
// Fallback: synthesized tone if audio fails to load

let ringtoneAudio: HTMLAudioElement | null = null;
let synthInterval: ReturnType<typeof setInterval> | null = null;

export const RingtoneManager = {
  start(): void {
    this.stop();
    this.startSynth();
  },

  startOutgoing(): void {
    try {
      this.stop();
      // For outgoing, we use a distinct synthesized pattern or a specific URL
      // For now, let's use a slower, pulsed synth pattern to signify "calling"
      const ctx = getAudioContext();
      safeResume(ctx);

      const playOutgoingPulse = () => {
        const now = ctx.currentTime;

        // Teams-like "Ba-da-ding" pulsed tone
        const playNote = (freq: number, startOffset: number, vol: number) => {
          const t = now + startOffset;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(vol, t + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
          osc.start(t);
          osc.stop(t + 0.4);
        };

        playNote(523.25, 0, 0.3); // C5
        playNote(783.99, 0.1, 0.2); // G5
        playNote(1046.50, 0.2, 0.1); // C6
      };

      playOutgoingPulse();
      synthInterval = setInterval(() => {
        playOutgoingPulse();
      }, 2500);
    } catch (e) {
      console.warn('[RingtoneManager] startOutgoing failed:', e);
    }
  },

  startSynth(): void {
    this.stop();
    // Initial play
    playCallRingtoneSynth();
    // Loop every 3 seconds (approx duration of the synth pattern)
    synthInterval = setInterval(() => {
      playCallRingtoneSynth();
    }, 3000);
  },

  stop(): void {
    if (ringtoneAudio) {
      ringtoneAudio.pause();
      ringtoneAudio.currentTime = 0;
      ringtoneAudio = null;
    }
    if (synthInterval) {
      clearInterval(synthInterval);
      synthInterval = null;
    }
  },

  isPlaying(): boolean {
    return ringtoneAudio !== null && !ringtoneAudio.paused;
  }
};

// Synthesized fallback (original Teams-like ascending 4-note pattern)
function playCallRingtoneSynth(customCtx?: BaseAudioContext): void {
  try {
    const ctx = customCtx || getAudioContext();
    safeResume(ctx);
    const now = ctx.currentTime;

    // The Teams "Remix" Melody (Modern, clean, digital)
    // Notes: Eb5, Ab5, Bb5, Eb6, Bb5, Ab5
    const melody = [
      { f: 622.25, t: 0.0 }, // Eb5
      { f: 830.61, t: 0.15 }, // Ab5
      { f: 932.33, t: 0.30 }, // Bb5
      { f: 1244.51, t: 0.45 }, // Eb6
      { f: 932.33, t: 0.60 }, // Bb5
      { f: 830.61, t: 0.75 }  // Ab5
    ];

    melody.forEach((note) => {
      const startTime = now + note.t;
      const duration = 0.3;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.f, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      osc.start(startTime);
      osc.stop(startTime + duration);

      // Add a subtle harmonics for "premium" feel
      const harm = ctx.createOscillator();
      const hGain = ctx.createGain();
      harm.connect(hGain);
      hGain.connect(ctx.destination);
      harm.type = 'sine';
      harm.frequency.setValueAtTime(note.f * 2, startTime);
      hGain.gain.setValueAtTime(0, startTime);
      hGain.gain.linearRampToValueAtTime(0.05, startTime + 0.05);
      hGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);
      harm.start(startTime);
      harm.stop(startTime + 0.2);
    });

    // Background pads for richness
    const pads = [311.13, 207.65]; // Eb4, Ab3
    pads.forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.5);
      gain.gain.linearRampToValueAtTime(0, now + 2.0);
      osc.start(now);
      osc.stop(now + 2.0);
    });
  } catch (error) {
    console.warn('Failed to play call ringtone:', error);
  }
}

// Legacy export — kept for backward compatibility with IncomingCallDialog
export function playCallRingtone(customCtx?: BaseAudioContext): void {
  playCallRingtoneSynth(customCtx);
}


// CHAT MESSAGE ALERT - "Soft Pop" (Clean and Minimal) (1s)
export function playChatMessageAlert(customCtx?: BaseAudioContext): void {
  try {
    const ctx = customCtx || getAudioContext();
    safeResume(ctx);
    const now = ctx.currentTime;

    // A pleasant, short "pop" sound: G5 → C6
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(783.99, now);
    osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.1);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    osc.start(now);
    osc.stop(now + 0.3);

  } catch (error) {
    console.warn('Failed to play chat message alert:', error);
  }
}

// Alert type configuration
export type AlertType = 'danger' | 'escalation' | 'announcement' | 'task' | 'lop' | 'sla_breach' | 'slot_opening' | 'morning_selfie' | 'lunch_selfie' | 'evening_selfie' | 'payment' | 'ceo' | 'director' | 'gm' | 'boi' | 'chat_message' | 'payment_new' | 'payment_approved' | 'payment_status' | 'task_comment' | 'task_progress';

// Play ONLY the synthesized (default) tone, ignoring custom overrides.
// Useful for previewing "System Default" in the admin panel.
export function playSynthesizedTone(type: AlertType, customCtx?: BaseAudioContext): void {
  const ctx = customCtx || getAudioContext();
  safeResume(ctx);

  // Helper to call specific alert with context
  switch (type) {
    case 'danger': playDangerAlert(ctx); break;
    case 'escalation': playEscalationAlert(ctx); break;
    case 'announcement': playAnnouncementAlert(ctx); break;
    case 'task': playTaskAlert(ctx); break;
    case 'lop': playLOPAlert(ctx); break;
    case 'sla_breach': playSLABreachAlert(ctx); break;
    case 'slot_opening': playSlotOpeningAlert(ctx); break;
    case 'payment': 
    case 'payment_new':
    case 'payment_approved':
    case 'payment_status':
      playPaymentAlert(ctx); break;
    case 'ceo': playCEOAlert(ctx); break;
    case 'director': playDirectorAlert(ctx); break;
    case 'gm': playGMAlert(ctx); break;
    case 'boi': playBOIAlert(ctx); break;
    case 'chat_message': playChatMessageAlert(ctx); break;
    case 'task_comment':
    case 'task_progress':
      playTaskAlert(ctx); break;
    case 'morning_selfie':
    case 'lunch_selfie':
    case 'evening_selfie':
      playSelfieReminderAlert(ctx); break;
  }
}


// Play alert based on type (Checks custom override first with system fallback)
export async function playAlert(type: AlertType): Promise<void> {
  // 1. Check if we have a custom tone for this category
  const customUrl = customTonesCache[type];

  if (customUrl) {
    try {
      const ctx = getAudioContext();
      await safeResume(ctx);

      const response = await fetch(customUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start();
      return;
    } catch (error) {
      console.warn(`Failed to play custom tone for ${type}, falling back...`, error);
    }
  }

  // 2. Fallback to synthesized beeps
  playSynthesizedTone(type);
}

// --- WAV Export Utilities ---

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function encodeWAV(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + samples.length * 2, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, samples.length * 2, true);

  floatTo16BitPCM(view, 44, samples);

  return view;
}

export async function generateSystemToneBlob(type: AlertType): Promise<Blob> {
  // Create offline context (duration 2s to match strict requirements)
  const duration = 2; // seconds
  const sampleRate = 44100;
  const offlineCtx = new OfflineAudioContext(1, sampleRate * duration, sampleRate);

  // Play tone into offline context
  playSynthesizedTone(type, offlineCtx);

  // Render audio
  const renderedBuffer = await offlineCtx.startRendering();

  // Convert to WAV
  const wavData = encodeWAV(renderedBuffer.getChannelData(0), sampleRate);

  return new Blob([wavData], { type: 'audio/wav' });
}
