import React from 'react';
import { useKanban } from '../context/KanbanContext';
import { useNow } from '../hooks/useNow';
import { formatCountdown, getTimerStatus } from '../utils/timers';
import { TokenTimerManager } from './TokenTimerManager';
import { Timer, X } from 'lucide-react';

interface TokenTimerFabProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Floating button (bottom-right) that opens the AI token timer panel.
 * The button itself summarises the state: tokens ready, or the nearest countdown.
 */
export const TokenTimerFab: React.FC<TokenTimerFabProps> = ({ isOpen, onOpenChange }) => {
  const { tokenTimers } = useKanban();
  const now = useNow(1000, tokenTimers.length > 0);

  const statuses = tokenTimers.map((t) => ({ t, status: getTimerStatus(t, now) }));
  const readyCount = statuses.filter((s) => s.status === 'ready').length;
  const upcoming = statuses
    .filter((s) => s.status !== 'ready')
    .sort((a, b) => a.t.resetAt.localeCompare(b.t.resetAt))[0];
  const tone = readyCount > 0 ? 'ready' : upcoming?.status === 'soon' ? 'soon' : 'idle';

  const summary =
    readyCount > 0
      ? `${readyCount} siap`
      : upcoming
      ? formatCountdown(new Date(upcoming.t.resetAt).getTime() - now)
      : null;

  return (
    <>
      {/* Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Timer Token AI"
          className="fixed bottom-[196px] right-4 z-40 w-[calc(100vw-2rem)] max-w-[400px] max-h-[calc(100dvh-14rem)] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 origin-bottom-right animate-[toast-in_220ms_cubic-bezier(0.22,1,0.36,1)]"
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Timer className="w-4 h-4 text-blue-500" />
                Timer Token AI
              </h2>
              <p className="text-[11px] text-slate-400">Diberi tahu saat token tiap assignee bisa dipakai lagi.</p>
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
          <div className="p-4 overflow-y-auto custom-scrollbar">
            <TokenTimerManager />
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        type="button"
        onClick={() => onOpenChange(!isOpen)}
        aria-expanded={isOpen}
        title="Timer Token AI"
        className={`fixed bottom-4 right-4 z-40 flex items-center gap-2 h-12 pl-3.5 ${
          summary ? 'pr-4' : 'pr-3.5'
        } rounded-full shadow-lg shadow-slate-900/20 border text-sm font-bold tabular-nums transition-all hover:scale-105 active:scale-95 ${
          isOpen
            ? 'bg-slate-800 dark:bg-slate-700 border-slate-700 text-white'
            : tone === 'ready'
            ? 'bg-emerald-500 border-emerald-400 text-white'
            : tone === 'soon'
            ? 'bg-amber-500 border-amber-400 text-white'
            : 'bg-blue-600 border-blue-500 text-white'
        }`}
      >
        <span className="relative">
          {isOpen ? <X className="w-5 h-5" /> : <Timer className="w-5 h-5" />}
          {!isOpen && tone !== 'idle' && (
            <span className="absolute -top-1 -right-1 flex w-2.5 h-2.5">
              <span className="absolute inline-flex w-full h-full rounded-full bg-white opacity-75 animate-ping" />
              <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-white" />
            </span>
          )}
        </span>
        {summary && !isOpen && <span>{summary}</span>}
      </button>
    </>
  );
};
