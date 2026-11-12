import React from 'react';
import { useKanban } from '../context/KanbanContext';
import { useNow } from '../hooks/useNow';
import { formatCountdown, formatResetTime, getTimerStatus } from '../utils/timers';

/** "Siap" badges stay visible this long after the reset, then only show in Global Settings. */
const READY_BADGE_HOURS = 12;

const chipStyle = {
  waiting: 'bg-white/80 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300',
  soon: 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400',
  ready: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400',
};

/**
 * Token-timer badges for every assignee that has a task in this column.
 * Shows a live countdown, turns amber shortly before the reset and green once tokens are usable.
 */
export const ColumnTimerBadges: React.FC<{ columnId: string; onOpenTimers?: () => void }> = ({
  columnId,
  onOpenTimers,
}) => {
  const { tasks, tokenTimers, assignees } = useKanban();

  const assigneeIds = new Set(
    tasks.filter((t) => t.columnId === columnId).flatMap((t) => t.assignees.map((a) => a.id))
  );
  const timers = tokenTimers.filter((t) => assigneeIds.has(t.assigneeId));
  const now = useNow(1000, timers.length > 0);

  const visible = timers
    .filter((t) => now - new Date(t.resetAt).getTime() < READY_BADGE_HOURS * 3_600_000)
    .sort((a, b) => a.resetAt.localeCompare(b.resetAt));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 px-1 mb-2">
      {visible.map((t) => {
        const person = assignees.find((a) => a.id === t.assigneeId);
        const status = getTimerStatus(t, now);
        const remaining = new Date(t.resetAt).getTime() - now;
        const firstName = person?.name.split(' ')[0] ?? '?';
        return (
          <button
            key={t.id}
            type="button"
            onClick={onOpenTimers}
            title={
              status === 'ready'
                ? `${person?.name}: token ${t.label} sudah bisa dipakai (refresh ${formatResetTime(t.resetAt)})`
                : `${person?.name}: token ${t.label} refresh jam ${formatResetTime(t.resetAt)} (${formatCountdown(remaining)} lagi)`
            }
            className={`inline-flex items-center gap-1.5 pl-0.5 pr-2 py-0.5 rounded-full border text-[10px] font-bold tabular-nums transition-colors hover:brightness-95 ${chipStyle[status]}`}
          >
            <span className="relative">
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                style={{ backgroundColor: person?.avatarColor ?? '#94a3b8' }}
              >
                {firstName.charAt(0).toUpperCase()}
              </span>
              {status !== 'waiting' && (
                <span className="absolute -top-0.5 -right-0.5 flex w-2 h-2">
                  <span
                    className={`absolute inline-flex w-full h-full rounded-full opacity-75 animate-ping ${
                      status === 'ready' ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                  />
                  <span
                    className={`relative inline-flex w-2 h-2 rounded-full ring-1 ring-white dark:ring-slate-900 ${
                      status === 'ready' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                </span>
              )}
            </span>
            <span className="font-semibold max-w-[70px] truncate">{firstName}</span>
            <span className="opacity-70 font-medium max-w-[60px] truncate">{t.label}</span>
            <span>{status === 'ready' ? 'Siap' : formatCountdown(remaining)}</span>
          </button>
        );
      })}
    </div>
  );
};
