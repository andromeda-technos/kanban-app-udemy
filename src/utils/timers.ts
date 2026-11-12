import { TokenTimer } from '../types/kanban';

export const AI_SERVICE_PRESETS = ['Claude', 'ChatGPT', 'Gemini', 'Copilot', 'Cursor'];

export const DURATION_PRESETS = [
  { label: '1 jam', minutes: 60 },
  { label: '3 jam', minutes: 180 },
  { label: '5 jam', minutes: 300 },
  { label: '24 jam', minutes: 1440 },
];

export type TimerStatus = 'waiting' | 'soon' | 'ready';

/** "soon" = inside the reminder window (or the last 15 minutes when no reminder is set). */
export const getTimerStatus = (timer: TokenTimer, now: number): TimerStatus => {
  const remaining = new Date(timer.resetAt).getTime() - now;
  if (remaining <= 0) return 'ready';
  const windowMs = (timer.remindBeforeMinutes || 15) * 60_000;
  return remaining <= windowMs ? 'soon' : 'waiting';
};

/** Compact countdown: "2j 15m", "14m", "45d" (jam / menit / detik). */
export const formatCountdown = (ms: number): string => {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return m > 0 ? `${h}j ${m}m` : `${h}j`;
  if (m > 0) return `${m}m`;
  return `${s}d`;
};

/** Clock time, plus the day when it isn't today: "14:30" or "Sen 14:30". */
export const formatResetTime = (iso: string): string => {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString()
    ? time
    : `${d.toLocaleDateString('id-ID', { weekday: 'short' })} ${time}`;
};

/** Next occurrence of HH:MM (today, or tomorrow if that time has passed). */
export const nextOccurrence = (hhmm: string): Date | null => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) return null;
  const d = new Date();
  d.setHours(Number(match[1]), Number(match[2]), 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
};

/** Short two-tone chime via Web Audio (no asset needed). Silently ignored if audio is blocked. */
export const playChime = () => {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    });
    setTimeout(() => ctx.close(), 1000);
  } catch {
    /* audio unavailable */
  }
};

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

/** Shows an OS notification when permitted; returns whether it was shown. */
export const showBrowserNotification = (title: string, body: string, tag: string): boolean => {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false;
  try {
    const n = new Notification(title, { body, tag });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return true;
  } catch {
    return false;
  }
};
