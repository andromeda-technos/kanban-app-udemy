import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, Database, History, LayoutGrid, type LucideIcon } from 'lucide-react';

interface RadialMenuProps {
  onOpenDataCenter: () => void;
  onOpenAnalytics: () => void;
  onOpenLogs: () => void;
}

interface Item {
  key: string;
  label: string;
  icon: LucideIcon;
  /** circle colors */
  tone: string;
  action: () => void;
}

const AUTO_CLOSE_MS = 5000;

/**
 * Quick menu on top of the bottom-right button stack (prayer, Pomodoro, AI-token timer below).
 * Items fan out up and to the left in a quarter circle, so the timer buttons below stay
 * visible and clickable. Closes by itself after 5 s without interaction.
 */
export const RadialMenu: React.FC<RadialMenuProps> = ({ onOpenDataCenter, onOpenAnalytics, onOpenLogs }) => {
  const [open, setOpen] = useState(false);
  const [poke, setPoke] = useState(0); // bumps on every interaction → restarts the countdown
  const rootRef = useRef<HTMLDivElement>(null);
  const lastPoke = useRef(0);

  const items: Item[] = [
    { key: 'data', label: 'Pusat Data', icon: Database, tone: 'bg-blue-600 text-white', action: onOpenDataCenter },
    { key: 'stats', label: 'Statistik', icon: BarChart3, tone: 'bg-violet-600 text-white', action: onOpenAnalytics },
    { key: 'logs', label: 'Riwayat', icon: History, tone: 'bg-slate-700 text-white dark:bg-slate-600', action: onOpenLogs },
  ];

  const keepAlive = useCallback(() => {
    const now = Date.now();
    if (now - lastPoke.current < 250) return; // pointermove fires a lot
    lastPoke.current = now;
    setPoke((p) => p + 1);
  }, []);

  // Auto-close after 5 s of no interaction
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => setOpen(false), AUTO_CLOSE_MS);
    return () => window.clearTimeout(id);
  }, [open, poke]);

  // Outside click / Esc closes; typing keeps it alive. No overlay, so the timer buttons stay usable.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      else keepAlive();
    };
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, keepAlive]);

  // Quarter circle: straight up (90°) → straight left (180°)
  const radius = 96;
  const START = 90;
  const END = 180;
  const step = items.length > 1 ? (END - START) / (items.length - 1) : 0;
  const disc = radius + 62;

  return (
    <div
      ref={rootRef}
      className="fixed bottom-[196px] right-4 z-40"
      onPointerMove={open ? keepAlive : undefined}
      onPointerDown={open ? keepAlive : undefined}
      onFocus={open ? keepAlive : undefined}
    >
      {/* Glass quarter-disc behind the items (its corner sits on the button's center) */}
      <div
        aria-hidden="true"
        className={`absolute right-6 bottom-6 rounded-tl-full origin-bottom-right bg-white/75 dark:bg-slate-900/75 backdrop-blur-md border border-b-0 border-r-0 border-slate-200/80 dark:border-slate-700/70 shadow-xl shadow-slate-900/10 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          open ? 'opacity-100 scale-100' : 'opacity-0 scale-50 pointer-events-none'
        }`}
        style={{ width: disc, height: disc }}
      />

      {/* Items */}
      <div role="menu" aria-label="Menu cepat" aria-hidden={!open}>
        {items.map((it, i) => {
          const deg = START + i * step;
          const rad = (deg * Math.PI) / 180;
          const x = Math.cos(rad) * radius;
          const y = -Math.sin(rad) * radius;
          const Icon = it.icon;
          return (
            <button
              key={it.key}
              type="button"
              role="menuitem"
              tabIndex={open ? 0 : -1}
              onClick={() => {
                setOpen(false);
                it.action();
              }}
              title={it.label}
              className={`group absolute left-1/2 top-1/2 flex flex-col items-center gap-1 outline-none transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                open ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              style={{
                transform: open
                  ? `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(1)`
                  : 'translate(-50%, -50%) scale(0.3)',
                transitionDelay: open ? `${i * 45}ms` : '0ms',
              }}
            >
              <span
                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg shadow-slate-900/25 ring-4 ring-white/60 dark:ring-slate-900/60 transition-transform group-hover:scale-110 group-active:scale-95 group-focus-visible:ring-blue-400 ${it.tone}`}
              >
                <Icon className="w-5 h-5" />
              </span>
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap text-slate-700 dark:text-slate-200 bg-white/90 dark:bg-slate-800/90">
                {it.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Center button with the auto-close countdown ring */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={open ? 'Tutup menu' : 'Menu: Pusat Data, Statistik, Riwayat'}
        className={`relative w-12 h-12 rounded-full flex items-center justify-center shadow-lg shadow-slate-900/25 border transition-all hover:scale-105 active:scale-95 ${
          open
            ? 'bg-slate-800 dark:bg-slate-700 border-slate-700 text-white'
            : 'bg-gradient-to-tr from-blue-600 to-indigo-500 border-blue-500 text-white'
        }`}
      >
        <LayoutGrid className={`w-5 h-5 transition-transform duration-300 ${open ? 'rotate-45 scale-90' : ''}`} />
        {open && (
          <svg key={poke} viewBox="0 0 54 54" className="absolute -inset-[3px] w-[54px] h-[54px] -rotate-90 pointer-events-none">
            <circle
              cx="27"
              cy="27"
              r="25.5"
              pathLength={100}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="text-blue-400 radial-countdown"
              style={{ animationDuration: `${AUTO_CLOSE_MS}ms` }}
            />
          </svg>
        )}
      </button>
    </div>
  );
};
