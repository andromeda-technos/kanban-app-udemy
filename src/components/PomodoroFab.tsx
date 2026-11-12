import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Brain, ChevronDown, Coffee, Pause, Play, RotateCcw, SkipForward, X } from 'lucide-react';
import { useKanban } from '../context/KanbanContext';
import { useNow } from '../hooks/useNow';
import { isDoneColumn } from '../utils/deadline';
import { setTitleOverride } from '../utils/docTitle';
import { PomodoroMusic } from './PomodoroMusic';
import { notificationsSupported, playChime, showBrowserNotification } from '../utils/timers';

// ---------------------------------------------------------------------------
// State (per browser, survives reloads)
// ---------------------------------------------------------------------------
type Phase = 'work' | 'break' | 'long';

interface Settings {
  workMin: number;
  breakMin: number;
  longBreakMin: number;
  /** Long break after this many focus sessions (0 = never) */
  longEvery: number;
  autoStart: boolean;
  sound: boolean;
}

interface PomodoroState {
  settings: Settings;
  phase: Phase;
  running: boolean;
  endsAt: number | null; // while running
  remainingMs: number; // while paused
  cycle: number; // focus sessions since the last long break
  day: string;
  doneToday: number;
  taskId?: string;
}

const KEY = 'kanban_pomodoro_v1';
const MIN = 60_000;

const DEFAULT_SETTINGS: Settings = { workMin: 50, breakMin: 10, longBreakMin: 20, longEvery: 0, autoStart: true, sound: true };

const PRESETS: { label: string; work: number; rest: number }[] = [
  { label: '25 / 5', work: 25, rest: 5 },
  { label: '50 / 10', work: 50, rest: 10 },
  { label: '90 / 20', work: 90, rest: 20 },
];

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

const durationOf = (phase: Phase, s: Settings) =>
  (phase === 'work' ? s.workMin : phase === 'break' ? s.breakMin : s.longBreakMin) * MIN;

const initialState = (): PomodoroState => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null') as PomodoroState | null;
    if (saved?.settings) {
      const settings = { ...DEFAULT_SETTINGS, ...saved.settings };
      return saved.day === today() ? { ...saved, settings } : { ...saved, settings, day: today(), doneToday: 0 };
    }
  } catch {
    /* corrupted → defaults */
  }
  return {
    settings: DEFAULT_SETTINGS,
    phase: 'work',
    running: false,
    endsAt: null,
    remainingMs: DEFAULT_SETTINGS.workMin * MIN,
    cycle: 0,
    day: today(),
    doneToday: 0,
  };
};

const PHASE_META: Record<Phase, { label: string; icon: typeof Brain; ring: string; chip: string; fab: string }> = {
  work: {
    label: 'Fokus',
    icon: Brain,
    ring: '#f43f5e',
    chip: 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300',
    fab: 'bg-rose-500 border-rose-400',
  },
  break: {
    label: 'Rehat',
    icon: Coffee,
    ring: '#10b981',
    chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300',
    fab: 'bg-emerald-500 border-emerald-400',
  },
  long: {
    label: 'Rehat Panjang',
    icon: Coffee,
    ring: '#0ea5e9',
    chip: 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300',
    fab: 'bg-sky-500 border-sky-400',
  },
};

const fmt = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

/** Ask Clawd to say something (he listens for this event). */
const clawdSay = (text: string, celebrate = false) =>
  window.dispatchEvent(new CustomEvent('clawd-say', { detail: { text, celebrate } }));

// ---------------------------------------------------------------------------
// Component: floating button + panel (always mounted so alerts fire anywhere)
// ---------------------------------------------------------------------------
export const PomodoroFab: React.FC<{ isOpen: boolean; onOpenChange: (open: boolean) => void }> = ({
  isOpen,
  onOpenChange,
}) => {
  const { tasks, columns } = useKanban();
  const [st, setSt] = useState<PomodoroState>(initialState);
  const [showSettings, setShowSettings] = useState(false);
  const now = useNow(1000, st.running || isOpen);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(st));
    } catch {
      /* ignore */
    }
  }, [st]);

  const meta = PHASE_META[st.phase];
  const total = durationOf(st.phase, st.settings);
  const remaining = Math.min(total, st.running && st.endsAt ? Math.max(0, st.endsAt - now) : st.remainingMs);
  const progress = total ? 1 - remaining / total : 0;
  const started = st.running || st.remainingMs < total;

  const focusTask = tasks.find((t) => t.id === st.taskId);
  const openTasks = useMemo(() => {
    const done = new Set(columns.filter(isDoneColumn).map((c) => c.id));
    return tasks.filter((t) => !done.has(t.columnId));
  }, [tasks, columns]);

  // ---- phase change ------------------------------------------------------
  const goToNext = useCallback((prev: PomodoroState, finished: boolean): PomodoroState => {
    const s = prev.settings;
    let { cycle, doneToday } = prev;
    let next: Phase;
    if (prev.phase === 'work') {
      if (finished) doneToday += prev.day === today() ? 1 : 0;
      cycle += 1;
      next = s.longEvery > 0 && cycle >= s.longEvery ? 'long' : 'break';
      if (next === 'long') cycle = 0;
    } else {
      next = 'work';
    }
    const dur = durationOf(next, s);
    const run = finished ? s.autoStart : prev.running;
    return {
      ...prev,
      phase: next,
      cycle,
      doneToday,
      day: today(),
      running: run,
      endsAt: run ? Date.now() + dur : null,
      remainingMs: dur,
    };
  }, []);

  const announce = (from: Phase, to: PomodoroState) => {
    const s = to.settings;
    const title = from === 'work' ? 'Sesi fokus selesai! 🍅' : 'Rehat selesai 💪';
    const body =
      from === 'work'
        ? `Waktunya ${to.phase === 'long' ? 'rehat panjang' : 'rehat'} ${to.phase === 'long' ? s.longBreakMin : s.breakMin} menit. Regangkan badan & minum air.`
        : `Yuk lanjut fokus ${s.workMin} menit${focusTask ? ` di "${focusTask.title}"` : ''}.`;
    if (s.sound) playChime();
    showBrowserNotification(title, body, 'pomodoro');
    clawdSay(from === 'work' ? `${title} ${body}` : `${title} ${body}`, from === 'work');
  };

  // Timer reached zero (also handles coming back to a tab after it ended)
  const firedFor = useRef<number | null>(null);
  useEffect(() => {
    if (!st.running || !st.endsAt || now < st.endsAt) return;
    if (firedFor.current === st.endsAt) return;
    firedFor.current = st.endsAt;
    const next = goToNext(st, true);
    announce(st.phase, next);
    setSt(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, st]);

  // Countdown in the browser tab title while running
  useEffect(() => {
    setTitleOverride(st.running ? `${st.phase === 'work' ? '🍅' : '☕'} ${fmt(remaining)} · ${meta.label}` : null);
  }, [st.running, remaining, st.phase, meta.label]);
  useEffect(() => () => setTitleOverride(null), []);

  // ---- controls -------------------------------------------------------------
  const start = () => {
    if (notificationsSupported() && Notification.permission === 'default') Notification.requestPermission();
    setSt((p) => ({ ...p, running: true, endsAt: Date.now() + p.remainingMs, day: today() }));
    if (st.phase === 'work' && !started) clawdSay(`Fokus ${st.settings.workMin} menit dimulai. Aku jagain ya 🍅`);
  };
  const pause = () =>
    setSt((p) => ({ ...p, running: false, remainingMs: p.endsAt ? Math.max(0, p.endsAt - Date.now()) : p.remainingMs, endsAt: null }));
  // Prayer time → pause the focus timer (event from PrayerFab)
  useEffect(() => {
    const onPause = () =>
      setSt((p) =>
        p.running
          ? { ...p, running: false, remainingMs: p.endsAt ? Math.max(0, p.endsAt - Date.now()) : p.remainingMs, endsAt: null }
          : p
      );
    window.addEventListener('pomodoro-pause', onPause);
    return () => window.removeEventListener('pomodoro-pause', onPause);
  }, []);

  const reset = () => setSt((p) => ({ ...p, running: false, endsAt: null, remainingMs: durationOf(p.phase, p.settings) }));
  const skip = () => setSt((p) => goToNext({ ...p, running: false }, false));

  const updateSettings = (patch: Partial<Settings>) =>
    setSt((p) => {
      const settings = { ...p.settings, ...patch };
      // Not started yet → the new length applies right away; otherwise from the next phase
      const untouched = !p.running && p.remainingMs === durationOf(p.phase, p.settings);
      return { ...p, settings, remainingMs: untouched ? durationOf(p.phase, settings) : p.remainingMs };
    });

  // ---- ring ------------------------------------------------------------------
  const R = 52;
  const C = 2 * Math.PI * R;
  const PhaseIcon = meta.icon;
  const numInput =
    'w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500';
  const clampMin = (v: string, max: number) => Math.min(max, Math.max(1, Math.round(Number(v) || 1)));

  return (
    <>
      {/* Always mounted (only hidden when closed) so the music player keeps playing */}
      {(
        <div
          role="dialog"
          aria-label="Pomodoro"
          aria-hidden={!isOpen}
          className={`fixed bottom-[256px] right-4 z-40 w-[calc(100vw-2rem)] max-w-[360px] max-h-[calc(100dvh-18rem)] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 origin-bottom-right transition-[opacity,transform,visibility] duration-200 ${
            isOpen ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 translate-y-2 invisible pointer-events-none'
          }`}
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                🍅 Pomodoro
              </h2>
              <p className="text-[11px] text-slate-400">
                {st.settings.workMin} menit fokus · {st.settings.breakMin} menit rehat
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
            {/* Ring */}
            <div className="flex flex-col items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${meta.chip}`}>
                <PhaseIcon className="w-3.5 h-3.5" />
                {meta.label}
                {st.settings.longEvery > 0 && st.phase === 'work' && (
                  <span className="font-semibold opacity-70">
                    · {st.cycle + 1}/{st.settings.longEvery}
                  </span>
                )}
              </span>
              <div className="relative w-40 h-40">
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                  <circle cx="60" cy="60" r={R} fill="none" strokeWidth="8" className="stroke-slate-100 dark:stroke-slate-800" />
                  <circle
                    cx="60"
                    cy="60"
                    r={R}
                    fill="none"
                    strokeWidth="8"
                    strokeLinecap="round"
                    stroke={meta.ring}
                    strokeDasharray={C}
                    strokeDashoffset={C * (1 - progress)}
                    className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-mono tabular-nums text-3xl font-bold text-slate-800 dark:text-slate-100">
                    {fmt(remaining)}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {st.running ? 'berjalan' : started ? 'dijeda' : 'siap'}
                  </span>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={reset}
                disabled={!started}
                title="Ulang fase ini"
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={st.running ? pause : start}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-md transition-colors ${
                  st.running ? 'bg-slate-700 hover:bg-slate-800' : st.phase === 'work' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-500 hover:bg-emerald-600'
                }`}
              >
                {st.running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {st.running ? 'Jeda' : started ? 'Lanjut' : 'Mulai'}
              </button>
              <button
                type="button"
                onClick={skip}
                title={st.phase === 'work' ? 'Lewati ke rehat' : 'Lewati ke fokus'}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            {/* Focus task */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Lagi ngerjain</label>
              <select
                value={st.taskId ?? ''}
                onChange={(e) => setSt((p) => ({ ...p, taskId: e.target.value || undefined }))}
                className={numInput}
              >
                <option value="">Tidak spesifik</option>
                {openTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Music: separate YouTube playlists for focus and break */}
            <PomodoroMusic phase={st.phase} running={st.running} />

            {/* Today */}
            <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Sesi fokus hari ini</span>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
                {st.doneToday > 0 ? `${'🍅'.repeat(Math.min(st.doneToday, 8))}${st.doneToday > 8 ? ` ×${st.doneToday}` : ''}` : '–'}
              </span>
            </div>

            {/* Settings */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowSettings((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                Atur durasi
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showSettings ? 'rotate-180' : ''}`} />
              </button>
              {showSettings && (
                <div className="px-3 pb-3 space-y-3">
                  <div className="flex gap-1.5">
                    {PRESETS.map((p) => {
                      const active = st.settings.workMin === p.work && st.settings.breakMin === p.rest;
                      return (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => updateSettings({ workMin: p.work, breakMin: p.rest })}
                          className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                            active
                              ? 'border-blue-500 bg-blue-600 text-white'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Fokus (menit)
                      <input
                        type="number"
                        min={1}
                        max={180}
                        value={st.settings.workMin}
                        onChange={(e) => updateSettings({ workMin: clampMin(e.target.value, 180) })}
                        className={`${numInput} mt-1`}
                      />
                    </label>
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Rehat (menit)
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={st.settings.breakMin}
                        onChange={(e) => updateSettings({ breakMin: clampMin(e.target.value, 60) })}
                        className={`${numInput} mt-1`}
                      />
                    </label>
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Rehat panjang tiap
                      <select
                        value={st.settings.longEvery}
                        onChange={(e) => updateSettings({ longEvery: Number(e.target.value) })}
                        className={`${numInput} mt-1`}
                      >
                        <option value={0}>Tidak pakai</option>
                        {[2, 3, 4].map((n) => (
                          <option key={n} value={n}>
                            {n} sesi
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Rehat panjang (menit)
                      <input
                        type="number"
                        min={1}
                        max={90}
                        disabled={st.settings.longEvery === 0}
                        value={st.settings.longBreakMin}
                        onChange={(e) => updateSettings({ longBreakMin: clampMin(e.target.value, 90) })}
                        className={`${numInput} mt-1 disabled:opacity-50`}
                      />
                    </label>
                  </div>
                  {[
                    { key: 'autoStart' as const, label: 'Lanjut otomatis ke fase berikutnya' },
                    { key: 'sound' as const, label: 'Bunyi saat fase selesai' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={st.settings[key]}
                        onChange={(e) => updateSettings({ [key]: e.target.checked })}
                        className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                      />
                      {label}
                    </label>
                  ))}
                  {st.running && (
                    <p className="text-[10px] text-slate-400">Durasi baru berlaku mulai fase berikutnya.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating button (above the AI token timer button) */}
      <button
        type="button"
        onClick={() => onOpenChange(!isOpen)}
        aria-expanded={isOpen}
        title={st.running ? `${meta.label} · ${fmt(remaining)}` : 'Pomodoro'}
        className={`fixed bottom-[76px] right-4 z-40 flex items-center gap-2 h-12 ${
          st.running && !isOpen ? 'pl-3 pr-4' : 'px-3.5'
        } rounded-full shadow-lg shadow-slate-900/20 border text-sm font-bold text-white tabular-nums transition-all hover:scale-105 active:scale-95 ${
          isOpen ? 'bg-slate-800 dark:bg-slate-700 border-slate-700' : started ? meta.fab : 'bg-rose-500 border-rose-400'
        }`}
      >
        {isOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <span className="relative w-5 h-5 flex items-center justify-center">
            {started ? (
              <svg viewBox="0 0 20 20" className="absolute inset-0 -rotate-90">
                <circle cx="10" cy="10" r="8.5" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
                <circle
                  cx="10"
                  cy="10"
                  r="8.5"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeDasharray={2 * Math.PI * 8.5}
                  strokeDashoffset={2 * Math.PI * 8.5 * (1 - progress)}
                />
              </svg>
            ) : (
              <span className="text-base leading-none">🍅</span>
            )}
          </span>
        )}
        {started && !isOpen && (
          <span className="font-mono">
            {fmt(remaining)}
            {!st.running && <span className="ml-1 text-[10px] opacity-80">jeda</span>}
          </span>
        )}
      </button>
    </>
  );
};
