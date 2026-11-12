import React, { useEffect, useState } from 'react';
import { useKanban } from '../context/KanbanContext';
import { useNow } from '../hooks/useNow';
import { formatCountdown, formatResetTime, playChime, showBrowserNotification } from '../utils/timers';
import { BellRing, Timer, X } from 'lucide-react';

interface Toast {
  id: string;
  kind: 'soon' | 'ready';
  title: string;
  body: string;
}

const TOAST_LIFETIME_MS = 20_000;

/**
 * Watches every token timer: sends a heads-up before the reset (if configured) and a
 * "ready" alert when tokens can be used again. Alerts go to the OS notification center
 * (when permitted), play a chime, and always show an in-app toast.
 */
export const TokenTimerNotifier: React.FC<{ onOpenTimers: () => void }> = ({ onOpenTimers }) => {
  const { tokenTimers, assignees, updateTokenTimer } = useKanban();
  const now = useNow(1000, tokenTimers.length > 0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    tokenTimers.forEach((timer) => {
      const name = assignees.find((a) => a.id === timer.assigneeId)?.name ?? 'Assignee';
      const remaining = new Date(timer.resetAt).getTime() - now;
      let alert: Toast | null = null;

      if (remaining <= 0 && !timer.notifiedReady) {
        alert = {
          id: `${timer.id}-ready`,
          kind: 'ready',
          title: `Token ${timer.label} siap dipakai`,
          body: `Token ${timer.label} milik ${name} sudah refresh (${formatResetTime(timer.resetAt)}). Bisa dipakai lagi sekarang.`,
        };
        updateTokenTimer(timer.id, { notifiedReady: true, notifiedBefore: true });
      } else if (
        remaining > 0 &&
        !timer.notifiedBefore &&
        timer.remindBeforeMinutes &&
        remaining <= timer.remindBeforeMinutes * 60_000
      ) {
        alert = {
          id: `${timer.id}-soon`,
          kind: 'soon',
          title: `Token ${timer.label} segera refresh`,
          body: `Token ${timer.label} milik ${name} refresh dalam ${formatCountdown(remaining)} (jam ${formatResetTime(timer.resetAt)}).`,
        };
        updateTokenTimer(timer.id, { notifiedBefore: true });
      }

      if (alert) {
        const toast = alert;
        showBrowserNotification(toast.title, toast.body, toast.id);
        playChime();
        setToasts((prev) => [...prev.filter((t) => t.id !== toast.id), toast]);
        window.setTimeout(
          () => setToasts((prev) => prev.filter((t) => t.id !== toast.id)),
          TOAST_LIFETIME_MS
        );
      }
    });
  }, [now, tokenTimers, assignees, updateTokenTimer]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-[60] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex gap-3 p-3.5 rounded-2xl shadow-2xl border bg-white dark:bg-slate-900 animate-[toast-in_280ms_cubic-bezier(0.22,1,0.36,1)] ${
            t.kind === 'ready'
              ? 'border-emerald-300 dark:border-emerald-800'
              : 'border-amber-300 dark:border-amber-800'
          }`}
        >
          <div
            className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${
              t.kind === 'ready'
                ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                : 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
            }`}
          >
            {t.kind === 'ready' ? <BellRing className="w-4.5 h-4.5" /> : <Timer className="w-4.5 h-4.5" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{t.title}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{t.body}</p>
            <button
              type="button"
              onClick={() => {
                setToasts((prev) => prev.filter((x) => x.id !== t.id));
                onOpenTimers();
              }}
              className="mt-1.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Lihat timer
            </button>
          </div>
          <button
            type="button"
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            className="self-start p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
