import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useKanban } from '../context/KanbanContext';
import { PREF_KEYS, usePreference } from '../hooks/usePreference';
import { getDeadlineStatus, isDoneColumn } from '../utils/deadline';

// ---------------------------------------------------------------------------
// Sprite (13 × 10 pixel grid, drawn with crisp SVG rects)
// ---------------------------------------------------------------------------
type Pose = 'idle' | 'walk' | 'sleep' | 'happy' | 'held';

const BODY = '#D97757';
const SHADE = '#B85C3E';
const EYE = '#1C120D';

const Px: React.FC<{ x: number; y: number; w?: number; h?: number; fill?: string; className?: string }> = ({
  x,
  y,
  w = 1,
  h = 1,
  fill = BODY,
  className,
}) => <rect x={x} y={y} width={w} height={h} fill={fill} className={className} />;

const ClawdSprite: React.FC<{ pose: Pose; look: -1 | 0 | 1; size: number }> = ({ pose, look, size }) => {
  const armsUp = pose === 'happy' || pose === 'held';
  return (
    <svg
      viewBox="0 0 13 10"
      width={size}
      height={(size * 10) / 13}
      shapeRendering="crispEdges"
      className={`clawd-sprite overflow-visible ${pose === 'walk' ? 'is-walking' : ''} ${pose === 'idle' ? 'is-idle' : ''}`}
      aria-hidden="true"
    >
      {/* ground shadow */}
      <rect x={2} y={9.2} width={9} height={0.8} rx={0.4} fill="#000" opacity={0.18} />

      {/* legs: two pairs that alternate while walking */}
      <g className="clawd-legs-a">
        <Px x={3} y={7} h={2} fill={SHADE} />
        <Px x={7} y={7} h={2} fill={SHADE} />
      </g>
      <g className="clawd-legs-b">
        <Px x={5} y={7} h={2} fill={SHADE} />
        <Px x={9} y={7} h={2} fill={SHADE} />
      </g>

      <g className="clawd-body">
        {/* body */}
        <Px x={2} y={2} w={9} h={5} />
        <Px x={2} y={6} w={9} h={1} fill={SHADE} />

        {/* arms */}
        {armsUp ? (
          <>
            <Px x={0} y={0} h={3} />
            <Px x={1} y={3} />
            <Px x={12} y={0} h={3} />
            <Px x={11} y={3} />
          </>
        ) : (
          <>
            <Px x={0} y={4} w={2} />
            <Px x={11} y={4} w={2} />
          </>
        )}

        {/* eyes */}
        {pose === 'sleep' ? (
          <>
            <Px x={3} y={4} w={2} fill={EYE} />
            <Px x={8} y={4} w={2} fill={EYE} />
          </>
        ) : armsUp ? (
          <>
            {/* ^ ^ */}
            <Px x={3} y={4} fill={EYE} />
            <Px x={4} y={3} fill={EYE} />
            <Px x={5} y={4} fill={EYE} />
            <Px x={7} y={4} fill={EYE} />
            <Px x={8} y={3} fill={EYE} />
            <Px x={9} y={4} fill={EYE} />
          </>
        ) : (
          <g className="clawd-eyes">
            <Px x={4 + look} y={3} h={2} fill={EYE} />
            <Px x={8 + look} y={3} h={2} fill={EYE} />
          </g>
        )}
      </g>
    </svg>
  );
};

// ---------------------------------------------------------------------------
// What Clawd says
// ---------------------------------------------------------------------------
const TIPS = [
  'Tekan N buat bikin tugas baru ⌨️',
  'Tekan / buat langsung cari tugas 🔎',
  'Minum air dulu biar tetap fokus 💧',
  'Klik tombol 🍅 di kanan bawah buat mulai sesi fokus',
  'Tugas besar? Pecah jadi subtugas kecil-kecil ✂️',
  'Simpan file kerja di Pusat Data biar rapi 🗂️',
  'Aku bisa diseret, lho. Taruh aku di mana aja 👐',
];

const EVENT_LINES = {
  taskDone: ['Yeay, satu tugas beres! 🎉', 'Mantap! Satu kartu masuk Done ✨', 'Keren! Lanjut yang berikutnya? 🚀'],
  subtaskDone: ['Subtugas selesai, nice! ✅', 'Satu langkah lagi kelar 👍', 'Progres jalan terus! 📈'],
  taskNew: ['Tugas baru tercatat ✍️', 'Oke, aku catat ya 📝'],
  star: ['Bintang jatuh! Buruan bikin permohonan ✨', 'Wih, bintang jatuh! 🌠', 'Semoga semua deadline aman ya 🌠'],
  wake: ['Eh, aku ketiduran 😅', 'Hoaam... udah balik? 👋'],
};

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

const greeting = () => {
  const h = new Date().getHours();
  if (h < 4) return 'Udah larut banget, jangan lupa istirahat ya 🌙';
  if (h < 11) return 'Selamat pagi! ☀️ Mau mulai dari tugas yang mana?';
  if (h < 15) return 'Selamat siang! Jangan lupa makan ya 🍱';
  if (h < 18) return 'Sore! Cek lagi deadline terdekat yuk 🕓';
  return 'Selamat malam! Jangan begadang terus ya 🌙';
};

// ---------------------------------------------------------------------------
// Companion
// ---------------------------------------------------------------------------
const WALK_SPEED = 38; // px per second
const SLEEP_AFTER_MS = 2 * 60_000;
const RIGHT_RESERVE = 96; // keep clear of the timer button bottom-right

export const ClawdCompanion: React.FC = () => {
  const [enabled] = usePreference(PREF_KEYS.CLAWD, true);
  if (!enabled) return null;
  return <Companion />;
};

const Companion: React.FC = () => {
  const [, setEnabled] = usePreference(PREF_KEYS.CLAWD, true);
  const { activeTasks, activeColumns, tasks, columns } = useKanban();

  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    []
  );
  const [vw, setVw] = useState(() => window.innerWidth);
  const size = vw < 640 ? 44 : 56;
  const maxX = Math.max(16, vw - size - RIGHT_RESERVE);

  const [x, setX] = useState(() => 16 + Math.random() * Math.min(240, maxX));
  const [walkMs, setWalkMs] = useState(0); // > 0 while walking (transition length)
  const [look, setLook] = useState<-1 | 0 | 1>(0);
  const [mood, setMood] = useState<'idle' | 'happy' | 'sleep'>('idle');
  const [jumpKey, setJumpKey] = useState(0);
  const [held, setHeld] = useState(false);
  const [tick, setTick] = useState(0); // re-arms the wander timer
  const [bubble, setBubble] = useState<{ text: string; id: number } | null>(null);
  const bubbleRef = useRef(bubble);
  bubbleRef.current = bubble;

  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Keep inside the screen when the window resizes
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  useEffect(() => setX((v) => Math.min(Math.max(12, v), maxX)), [maxX]);

  // ---- speech ----------------------------------------------------------
  const bubbleTimer = useRef<number>(0);
  const say = useCallback((text: string, ms = 5000) => {
    window.clearTimeout(bubbleTimer.current);
    setBubble({ text, id: Date.now() });
    bubbleTimer.current = window.setTimeout(() => setBubble(null), ms);
  }, []);

  const celebrate = useCallback(
    (text: string) => {
      setMood('happy');
      setJumpKey((k) => k + 1);
      say(text, 4000);
      later(() => setMood((m) => (m === 'happy' ? 'idle' : m)), 2200);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [say]
  );

  // ---- contextual lines --------------------------------------------------
  const contextualLines = useCallback((): string[] => {
    const doneCols = new Set(activeColumns.filter(isDoneColumn).map((c) => c.id));
    const open = activeTasks.filter((t) => !doneCols.has(t.columnId));
    const done = activeTasks.length - open.length;
    const overdue = open.filter((t) => getDeadlineStatus(t) === 'overdue').length;
    const near = open.filter((t) => getDeadlineStatus(t) === 'near').length;
    const urgent = open.filter((t) => t.priority === 'urgent').length;
    const heavy = [...open]
      .filter((t) => t.subtasks.filter((s) => !s.completed).length >= 4)
      .sort((a, b) => b.subtasks.length - a.subtasks.length)[0];

    const lines = [greeting()];
    if (overdue) lines.push(`Ada ${overdue} tugas lewat deadline. Coba urutkan pakai "Deadline" 👀`);
    if (near) lines.push(`${near} tugas deadline-nya tinggal ≤ 2 hari. Gas! ⏰`);
    if (urgent) lines.push(`${urgent} tugas Mendesak masih jalan. Semangat! 🔥`);
    if (activeTasks.length)
      lines.push(`${done}/${activeTasks.length} tugas di board ini udah beres (${Math.round((done / activeTasks.length) * 100)}%) 💪`);
    if (heavy) lines.push(`"${heavy.title}" lumayan berat. Cicil satu subtugas dulu ya 🧩`);
    if (!overdue && !near && open.length) lines.push('Belum ada yang telat. Aman terkendali 😎');
    return [...lines, pick(TIPS), pick(TIPS)];
  }, [activeTasks, activeColumns]);

  const lineIndex = useRef(0);
  const talk = () => {
    const lines = contextualLines();
    say(lines[lineIndex.current % lines.length]);
    lineIndex.current++;
  };

  // ---- react to board changes (also teammates' changes via realtime) ---------
  const stats = useMemo(() => {
    const doneCols = new Set(columns.filter(isDoneColumn).map((c) => c.id));
    return {
      total: tasks.length,
      done: tasks.filter((t) => doneCols.has(t.columnId)).length,
      subs: tasks.reduce((n, t) => n + t.subtasks.filter((s) => s.completed).length, 0),
    };
  }, [tasks, columns]);
  const prevStats = useRef(stats);
  const mountedAt = useRef(Date.now());
  useEffect(() => {
    const prev = prevStats.current;
    prevStats.current = stats;
    // Ignore the initial cloud load and bulk imports
    if (Date.now() - mountedAt.current < 4000) return;
    const d = (a: number, b: number) => a - b >= 1 && a - b <= 3;
    if (d(stats.done, prev.done)) celebrate(pick(EVENT_LINES.taskDone));
    else if (d(stats.subs, prev.subs)) celebrate(pick(EVENT_LINES.subtaskDone));
    else if (stats.total - prev.total === 1) say(pick(EVENT_LINES.taskNew), 3000);
  }, [stats, celebrate, say]);

  // ---- shooting star in the pixel night sky → jump for joy -----------------
  useEffect(() => {
    const onStar = () => {
      if (moodRef.current === 'sleep') return; // let him sleep
      setMood('happy');
      setJumpKey((k) => k + 1);
      later(() => setMood((m) => (m === 'happy' ? 'idle' : m)), 1800);
      if (!bubbleRef.current && Math.random() < 0.35) say(pick(EVENT_LINES.star), 3500);
    };
    window.addEventListener('pixel-shooting-star', onStar);
    return () => window.removeEventListener('pixel-shooting-star', onStar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [say]);

  // ---- other features can make Clawd talk (e.g. Pomodoro) ---------------
  useEffect(() => {
    const onSay = (e: Event) => {
      const { text, celebrate: party } = (e as CustomEvent<{ text: string; celebrate?: boolean }>).detail ?? {};
      if (!text) return;
      if (moodRef.current === 'sleep') setMood('idle');
      if (party) celebrate(text);
      else say(text, 6000);
    };
    window.addEventListener('clawd-say', onSay);
    return () => window.removeEventListener('clawd-say', onSay);
  }, [say, celebrate]);

  // ---- hello -----------------------------------------------------------
  useEffect(() => {
    later(() => say(`Halo! Aku Clawd 👋 ${greeting()}`, 6000), 1500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- falls asleep when you're away -------------------------------------
  const lastActive = useRef(Date.now());
  const moodRef = useRef(mood);
  moodRef.current = mood;
  useEffect(() => {
    const onActivity = () => {
      lastActive.current = Date.now();
      if (moodRef.current === 'sleep') {
        setMood('idle');
        say(pick(EVENT_LINES.wake), 3000);
      }
    };
    const check = window.setInterval(() => {
      if (Date.now() - lastActive.current > SLEEP_AFTER_MS && moodRef.current === 'idle') {
        setMood('sleep');
        setWalkMs(0);
      }
    }, 5000);
    window.addEventListener('pointerdown', onActivity);
    window.addEventListener('keydown', onActivity);
    window.addEventListener('wheel', onActivity, { passive: true });
    return () => {
      window.clearInterval(check);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('wheel', onActivity);
    };
  }, [say]);

  // ---- wandering ----------------------------------------------------------
  const xRef = useRef(x);
  xRef.current = x;
  useEffect(() => {
    if (reducedMotion || mood !== 'idle' || held || walkMs > 0) return;
    const id = window.setTimeout(() => {
      // Sometimes just look around instead of walking
      if (Math.random() < 0.35) {
        setLook(pick([-1, 0, 1] as const));
        setTick((t) => t + 1);
        return;
      }
      const from = xRef.current;
      let to = from + (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 220);
      to = Math.min(Math.max(12, to), maxX);
      const dist = Math.abs(to - from);
      if (dist < 20) {
        setLook(0);
        setTick((t) => t + 1);
        return;
      }
      const ms = (dist / WALK_SPEED) * 1000;
      setLook(to > from ? 1 : -1);
      setWalkMs(ms);
      setX(to);
      later(() => {
        setWalkMs(0);
        setLook(0);
      }, ms);
    }, 3500 + Math.random() * 6000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, held, walkMs, maxX, reducedMotion, tick]);

  // ---- drag to move / click to talk -------------------------------------
  const drag = useRef<{ startX: number; origin: number; moved: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, origin: xRef.current, moved: false };
    setWalkMs(0);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) < 5) return;
    if (!d.moved) {
      d.moved = true;
      setHeld(true);
    }
    setLook(dx > 0 ? 1 : -1);
    setX(Math.min(Math.max(12, d.origin + dx), maxX));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) {
      setHeld(false);
      setLook(0);
      setJumpKey((k) => k + 1);
      return;
    }
    if (mood === 'sleep') {
      setMood('idle');
      say(pick(EVENT_LINES.wake), 3000);
      return;
    }
    setJumpKey((k) => k + 1);
    talk();
  };

  const pose: Pose = held ? 'held' : mood === 'sleep' ? 'sleep' : mood === 'happy' ? 'happy' : walkMs > 0 ? 'walk' : 'idle';
  // Bubble stays on screen and clear of the floating buttons on the right
  const bubbleMaxRight = vw - 128; // the Pomodoro pill grows to ~110px while running
  const bubbleW = Math.max(160, Math.min(260, bubbleMaxRight - 16));
  const bubbleLeft = Math.min(Math.max(16, x + size / 2 - 40), Math.max(16, bubbleMaxRight - bubbleW));
  const tailLeft = Math.min(Math.max(10, x + size / 2 - bubbleLeft - 6), bubbleW - 22);

  return (
    <div
      className="clawd fixed left-0 z-30 pointer-events-none select-none"
      style={{
        bottom: "calc(var(--pixel-ground-h, 12px) - 4px)",
        transform: `translateX(${x}px)`,
        transition: walkMs > 0 ? `transform ${walkMs}ms linear` : held ? 'none' : 'transform 200ms ease-out',
      }}
    >
      {/* Speech bubble */}
      {bubble && (
        <div
          key={bubble.id}
          className="clawd-bubble absolute bottom-full mb-2 w-max pointer-events-auto"
          style={{ left: bubbleLeft - x, maxWidth: bubbleW }}
        >
          <div className="relative px-3 py-2 pr-7 bg-white dark:bg-slate-900 text-[12px] leading-snug text-slate-800 dark:text-slate-100 border-2 border-slate-800 dark:border-slate-300 rounded-md shadow-[3px_3px_0_0_rgba(15,23,42,0.85)] dark:shadow-[3px_3px_0_0_rgba(0,0,0,0.9)]">
            {bubble.text}
            <button
              type="button"
              onClick={() => setBubble(null)}
              className="absolute top-1 right-1 p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              title="Tutup"
            >
              <X className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setEnabled(false)}
              className="block mt-1 text-[10px] font-semibold text-slate-400 hover:text-rose-500"
              title="Bisa dimunculkan lagi dari menu Tampilan"
            >
              Sembunyikan Clawd
            </button>
            <span
              className="absolute -bottom-[7px] w-3 h-3 rotate-45 bg-white dark:bg-slate-900 border-r-2 border-b-2 border-slate-800 dark:border-slate-300"
              style={{ left: tailLeft }}
            />
          </div>
        </div>
      )}

      {/* Zzz */}
      {mood === 'sleep' && (
        <div className="absolute -top-3 left-1/2 text-[11px] font-bold text-slate-400 dark:text-slate-500">
          <span className="clawd-z inline-block">z</span>
          <span className="clawd-z inline-block [animation-delay:0.8s]">Z</span>
        </div>
      )}

      <div
        key={jumpKey}
        role="button"
        tabIndex={0}
        aria-label="Clawd, teman kerjamu. Klik untuk ngobrol, seret untuk memindahkan."
        title="Klik buat ngobrol · seret buat pindahin"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            talk();
          }
        }}
        className={`pointer-events-auto cursor-grab active:cursor-grabbing touch-none outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded ${
          jumpKey > 0 && !held ? 'clawd-jump' : ''
        } ${held ? '-translate-y-3' : ''}`}
      >
        <ClawdSprite pose={pose} look={look} size={size} />
      </div>
    </div>
  );
};
