import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, Moon, Play, Sun, Sunrise, Sunset, X } from 'lucide-react';
import { useNow } from '../hooks/useNow';
import { notificationsSupported, playChime, showBrowserNotification } from '../utils/timers';

// ---------------------------------------------------------------------------
// Model (per browser; times are typed in manually from the local mosque / city schedule)
// ---------------------------------------------------------------------------
type PrayerKey = 'subuh' | 'dzuhur' | 'ashar' | 'maghrib' | 'isya';

interface PrayerSettings {
  times: Record<PrayerKey, string>; // "HH:MM"
  enabled: Record<PrayerKey, boolean>;
  remindBefore: number; // minutes, 0 = off
  awayMinutes: number; // how long Clawd is away praying
  pausePomodoro: boolean;
  sound: boolean;
  notify: boolean;
}

const KEY = 'kanban_prayer_v1';
const FIRED_KEY = 'kanban_prayer_fired_v1';
const WINDOW_MS = 3 * 60_000; // still fire if the tab woke up within 3 minutes

export const PRAYERS: { key: PrayerKey; label: string; icon: typeof Sun }[] = [
  { key: 'subuh', label: 'Subuh', icon: Sunrise },
  { key: 'dzuhur', label: 'Dzuhur', icon: Sun },
  { key: 'ashar', label: 'Ashar', icon: Sun },
  { key: 'maghrib', label: 'Maghrib', icon: Sunset },
  { key: 'isya', label: 'Isya', icon: Moon },
];

const DEFAULTS: PrayerSettings = {
  times: { subuh: '04:30', dzuhur: '11:55', ashar: '15:15', maghrib: '17:55', isya: '19:05' },
  enabled: { subuh: true, dzuhur: true, ashar: true, maghrib: true, isya: true },
  remindBefore: 10,
  awayMinutes: 15,
  pausePomodoro: true,
  sound: true,
  notify: true,
};

const load = (): PrayerSettings => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved) {
      return {
        ...DEFAULTS,
        ...saved,
        times: { ...DEFAULTS.times, ...saved.times },
        enabled: { ...DEFAULTS.enabled, ...saved.enabled },
      };
    }
  } catch {
    /* ignore */
  }
  return DEFAULTS;
};

const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

const at = (hhmm: string, base = new Date()) => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(base);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.getTime();
};

const fmtLeft = (ms: number) => {
  const total = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h} jam ${m} menit` : `${m} menit`;
};

/** Ask Clawd to talk (he listens for this event). */
const clawdSay = (text: string) => window.dispatchEvent(new CustomEvent('clawd-say', { detail: { text } }));

/** Pixel mosque icon (lucide has none) */
const MosqueIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M12 2v2" />
    <path d="M7 10a5 5 0 0 1 10 0" />
    <path d="M5 10h14v11H5z" />
    <path d="M10 21v-4a2 2 0 0 1 4 0v4" />
    <path d="M2 21V9l1.5-2L5 9" />
    <path d="M22 21V9l-1.5-2L19 9" />
    <path d="M1 21h22" />
  </svg>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const PrayerFab: React.FC<{ isOpen: boolean; onOpenChange: (open: boolean) => void }> = ({ isOpen, onOpenChange }) => {
  const [cfg, setCfg] = useState<PrayerSettings>(load);
  const now = useNow(isOpen ? 1000 : 15_000);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(cfg));
    } catch {
      /* ignore */
    }
  }, [cfg]);

  // ---- next prayer ------------------------------------------------------------
  const next = useMemo(() => {
    const today = new Date(now);
    const enabled = PRAYERS.filter((p) => cfg.enabled[p.key]);
    for (const p of enabled) {
      const t = at(cfg.times[p.key], today);
      if (t > now) return { ...p, at: t };
    }
    const first = enabled[0];
    if (!first) return null;
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { ...first, at: at(cfg.times[first.key], tomorrow) };
  }, [now, cfg]);

  // ---- scheduler (reminder + prayer time) ---------------------------------------
  const fired = useRef<{ day: string; keys: string[] }>(
    (() => {
      try {
        const saved = JSON.parse(localStorage.getItem(FIRED_KEY) || 'null');
        if (saved?.day === dayKey()) return saved;
      } catch {
        /* ignore */
      }
      return { day: dayKey(), keys: [] };
    })()
  );
  const markFired = (k: string) => {
    if (fired.current.day !== dayKey()) fired.current = { day: dayKey(), keys: [] };
    fired.current.keys.push(k);
    try {
      localStorage.setItem(FIRED_KEY, JSON.stringify(fired.current));
    } catch {
      /* ignore */
    }
  };
  const wasFired = (k: string) => fired.current.day === dayKey() && fired.current.keys.includes(k);

  useEffect(() => {
    for (const p of PRAYERS) {
      if (!cfg.enabled[p.key]) continue;
      const t = at(cfg.times[p.key], new Date(now));

      if (cfg.remindBefore > 0) {
        const r = t - cfg.remindBefore * 60_000;
        if (now >= r && now < r + WINDOW_MS && !wasFired(`remind:${p.key}`)) {
          markFired(`remind:${p.key}`);
          const text = `${cfg.remindBefore} menit lagi masuk waktu ${p.label} (${cfg.times[p.key]}). Siap-siap wudhu ya 💧`;
          clawdSay(text);
          if (cfg.notify) showBrowserNotification(`Sebentar lagi ${p.label}`, text, `prayer-remind-${p.key}`);
        }
      }

      if (now >= t && now < t + WINDOW_MS && !wasFired(`start:${p.key}`)) {
        markFired(`start:${p.key}`);
        startPrayer(p.label, cfg.times[p.key]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, cfg]);

  const startPrayer = (label: string, time: string, minutes = cfg.awayMinutes, test = false) => {
    if (cfg.sound) playChime();
    // A test only plays Clawd's animation: no notification, Pomodoro keeps running
    if (!test && cfg.notify) showBrowserNotification(`Waktu shalat ${label} 🕌`, `Sudah masuk waktu ${label} (${time}). Yuk shalat dulu.`, 'prayer-start');
    if (!test && cfg.pausePomodoro) window.dispatchEvent(new CustomEvent('pomodoro-pause'));
    window.dispatchEvent(new CustomEvent('clawd-prayer', { detail: { name: label, minutes } }));
  };

  const set = (patch: Partial<PrayerSettings>) => setCfg((c) => ({ ...c, ...patch }));
  const soon = next && next.at - now <= 30 * 60_000;
  const selectCls =
    'w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500';

  return (
    <>
      {isOpen && (
        <div
          role="dialog"
          aria-label="Waktu shalat"
          className="fixed bottom-[256px] right-4 z-40 w-[calc(100vw-2rem)] max-w-[360px] max-h-[calc(100dvh-18rem)] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 origin-bottom-right animate-[toast-in_220ms_cubic-bezier(0.22,1,0.36,1)]"
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <MosqueIcon className="w-4 h-4 text-emerald-500" />
                Waktu Shalat
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                {next ? `${next.label} dalam ${fmtLeft(next.at - now)} (${cfg.times[next.key]})` : 'Semua waktu dimatikan'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar">
            {/* Times */}
            <ul className="space-y-1.5">
              {PRAYERS.map((p) => {
                const Icon = p.icon;
                const isNext = next?.key === p.key;
                const passed = at(cfg.times[p.key], new Date(now)) <= now;
                return (
                  <li
                    key={p.key}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-colors ${
                      isNext
                        ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
                        : 'border-slate-200/80 dark:border-slate-800'
                    } ${cfg.enabled[p.key] ? '' : 'opacity-50'}`}
                  >
                    <input
                      type="checkbox"
                      checked={cfg.enabled[p.key]}
                      onChange={(e) => set({ enabled: { ...cfg.enabled, [p.key]: e.target.checked } })}
                      className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
                      aria-label={`Aktifkan ${p.label}`}
                    />
                    <Icon className={`w-4 h-4 shrink-0 ${isNext ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{p.label}</span>
                      <span className="block text-[10px] text-slate-400">
                        {isNext ? `berikutnya · ${fmtLeft(next!.at - now)} lagi` : passed && cfg.enabled[p.key] ? 'sudah lewat hari ini' : ''}
                      </span>
                    </span>
                    <input
                      type="time"
                      value={cfg.times[p.key]}
                      onChange={(e) => e.target.value && set({ times: { ...cfg.times, [p.key]: e.target.value } })}
                      className="w-[104px] px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono tabular-nums text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      aria-label={`Jam ${p.label}`}
                    />
                  </li>
                );
              })}
            </ul>
            <p className="text-[10px] text-slate-400 -mt-2">
              Isi sesuai jadwal masjid atau kota kamu. Disimpan di browser ini.
            </p>

            {/* Settings */}
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Ingatkan sebelum
                <select value={cfg.remindBefore} onChange={(e) => set({ remindBefore: Number(e.target.value) })} className={`${selectCls} mt-1`}>
                  <option value={0}>Tidak usah</option>
                  {[5, 10, 15, 20, 30].map((m) => (
                    <option key={m} value={m}>
                      {m} menit
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Clawd shalat selama
                <select value={cfg.awayMinutes} onChange={(e) => set({ awayMinutes: Number(e.target.value) })} className={`${selectCls} mt-1`}>
                  {[5, 10, 15, 20, 30].map((m) => (
                    <option key={m} value={m}>
                      {m} menit
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="space-y-1.5">
              {[
                { key: 'pausePomodoro' as const, label: 'Jeda Pomodoro otomatis saat waktu shalat' },
                { key: 'sound' as const, label: 'Bunyi saat masuk waktu' },
                { key: 'notify' as const, label: 'Notifikasi browser' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cfg[key]}
                    onChange={(e) => {
                      set({ [key]: e.target.checked });
                      if (key === 'notify' && e.target.checked && notificationsSupported() && Notification.permission === 'default') {
                        Notification.requestPermission();
                      }
                    }}
                    className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
                  />
                  {label}
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                startPrayer(next?.label ?? 'Dzuhur', 'tes', 0.25, true);
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-emerald-300 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            >
              <Play className="w-3.5 h-3.5" />
              Coba animasi Clawd (15 detik)
            </button>
          </div>
        </div>
      )}

      {/* Floating button (stack bottom-right, above Pomodoro) */}
      <button
        type="button"
        onClick={() => {
          onOpenChange(!isOpen);
          if (!isOpen && cfg.notify && notificationsSupported() && Notification.permission === 'default') {
            Notification.requestPermission();
          }
        }}
        aria-expanded={isOpen}
        title={next ? `Waktu shalat · ${next.label} ${cfg.times[next.key]}` : 'Waktu shalat'}
        className={`fixed bottom-[136px] right-4 z-40 flex items-center gap-2 h-12 ${
          soon && !isOpen ? 'pl-3 pr-4' : 'px-3.5'
        } rounded-full shadow-lg shadow-slate-900/20 border text-sm font-bold text-white transition-all hover:scale-105 active:scale-95 ${
          isOpen ? 'bg-slate-800 dark:bg-slate-700 border-slate-700' : 'bg-gradient-to-tr from-emerald-600 to-teal-500 border-emerald-400'
        }`}
      >
        {isOpen ? <X className="w-5 h-5" /> : soon ? <BellRing className="w-5 h-5" /> : <MosqueIcon />}
        {soon && !isOpen && next && (
          <span className="whitespace-nowrap">
            {next.label} <span className="font-mono">{fmtLeft(next.at - now).replace(' menit', 'm').replace(' jam ', 'j ')}</span>
          </span>
        )}
      </button>
    </>
  );
};
