import React, { useState } from 'react';
import { useKanban } from '../context/KanbanContext';
import { useNow } from '../hooks/useNow';
import { TokenTimer } from '../types/kanban';
import {
  AI_SERVICE_PRESETS,
  DURATION_PRESETS,
  formatCountdown,
  formatResetTime,
  getTimerStatus,
  nextOccurrence,
  notificationsSupported,
} from '../utils/timers';
import { Bell, BellOff, Plus, RotateCcw, Trash2, CheckCircle2, Clock, ChevronUp } from 'lucide-react';

type Mode = 'duration' | 'clock';

const REMIND_OPTIONS = [0, 5, 10, 15, 30];

const statusStyle = {
  waiting: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  soon: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400',
  ready: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400',
};

const NotificationPermission: React.FC = () => {
  const [permission, setPermission] = useState(() =>
    notificationsSupported() ? Notification.permission : 'unsupported'
  );

  if (permission === 'granted') return null;
  if (permission === 'unsupported' || permission === 'denied') {
    return (
      <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400">
        <BellOff className="w-3.5 h-3.5 shrink-0 mt-px" />
        {permission === 'denied'
          ? 'Notifikasi browser diblokir. Izinkan lewat ikon gembok di address bar. Pemberitahuan di dalam aplikasi tetap muncul.'
          : 'Browser ini tidak mendukung notifikasi. Pemberitahuan di dalam aplikasi tetap muncul.'}
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-[11px] text-blue-700 dark:text-blue-300">
      <span className="flex items-center gap-2">
        <Bell className="w-3.5 h-3.5 shrink-0" />
        Aktifkan notifikasi browser agar tetap muncul walau tab tidak dibuka.
      </span>
      <button
        type="button"
        onClick={() => Notification.requestPermission().then(setPermission)}
        className="shrink-0 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold"
      >
        Aktifkan
      </button>
    </div>
  );
};

/** Timer list per assignee + "add timer" form. Lives in the floating timer panel. */
export const TokenTimerManager: React.FC = () => {
  const { assignees, tokenTimers, createTokenTimer, updateTokenTimer, deleteTokenTimer } = useKanban();
  const now = useNow(1000, tokenTimers.length > 0);

  const [showForm, setShowForm] = useState(() => tokenTimers.length === 0);
  const [assigneeId, setAssigneeId] = useState(assignees[0]?.id ?? '');
  const [label, setLabel] = useState(AI_SERVICE_PRESETS[0]);
  const [mode, setMode] = useState<Mode>('duration');
  const [hours, setHours] = useState(5);
  const [minutes, setMinutes] = useState(0);
  const [clock, setClock] = useState('');
  const [remindBefore, setRemindBefore] = useState(5);
  const [error, setError] = useState('');

  const selectedAssigneeId = assignees.some((a) => a.id === assigneeId) ? assigneeId : assignees[0]?.id ?? '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssigneeId) return setError('Tambahkan assignee dulu di Global Settings.');
    if (!label.trim()) return setError('Isi nama layanan AI.');

    let resetAt: Date | null;
    let durationMinutes: number | undefined;
    if (mode === 'duration') {
      durationMinutes = hours * 60 + minutes;
      if (durationMinutes <= 0) return setError('Durasi harus lebih dari 0.');
      resetAt = new Date(Date.now() + durationMinutes * 60_000);
    } else {
      resetAt = nextOccurrence(clock);
      if (!resetAt) return setError('Isi jam reset, contoh 14:30.');
    }

    createTokenTimer({
      assigneeId: selectedAssigneeId,
      label: label.trim(),
      resetAt: resetAt.toISOString(),
      durationMinutes,
      remindBeforeMinutes: remindBefore,
    });
    setError('');
    setShowForm(false);
    // Ask for OS notifications on the first timer (needs a user gesture)
    if (notificationsSupported() && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  const restart = (timer: TokenTimer) => {
    const prev = new Date(timer.resetAt);
    const sameClock = `${String(prev.getHours()).padStart(2, '0')}:${String(prev.getMinutes()).padStart(2, '0')}`;
    const base = timer.durationMinutes
      ? new Date(Date.now() + timer.durationMinutes * 60_000)
      : nextOccurrence(sameClock); // same clock time, next occurrence
    if (!base) return;
    updateTokenTimer(timer.id, {
      resetAt: base.toISOString(),
      notifiedBefore: false,
      notifiedReady: false,
    });
  };

  const inputClass =
    'w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const smallInput =
    'px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100';
  const labelClass = 'block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1';

  const assigneesWithTimers = assignees.filter((a) => tokenTimers.some((t) => t.assigneeId === a.id));

  return (
    <div className="space-y-3">
      <NotificationPermission />

      {/* Timers grouped per assignee */}
      {tokenTimers.length === 0 && !showForm && (
        <div className="text-center text-xs text-slate-400 py-4">Belum ada timer.</div>
      )}
      {assigneesWithTimers.map((a) => (
        <div key={a.id} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
              style={{ backgroundColor: a.avatarColor }}
            >
              {a.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{a.name}</span>
            <button
              type="button"
              onClick={() => {
                setAssigneeId(a.id);
                setShowForm(true);
              }}
              className="ml-auto text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              + timer
            </button>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {tokenTimers
              .filter((t) => t.assigneeId === a.id)
              .sort((x, y) => x.resetAt.localeCompare(y.resetAt))
              .map((t) => {
                const status = getTimerStatus(t, now);
                const remaining = new Date(t.resetAt).getTime() - now;
                return (
                  <li key={t.id} className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-900/40">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {t.label}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${statusStyle[status]}`}
                        >
                          {status === 'ready' ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> Siap
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3" /> {formatCountdown(remaining)}
                            </>
                          )}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        Refresh {formatResetTime(t.resetAt)}
                        {t.remindBeforeMinutes ? ` · ingatkan ${t.remindBeforeMinutes}m sebelumnya` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => restart(t)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                      title={
                        t.durationMinutes
                          ? `Mulai ulang (${formatCountdown(t.durationMinutes * 60_000)} dari sekarang)`
                          : 'Mulai ulang ke jam yang sama berikutnya'
                      }
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTokenTimer(t.id)}
                      className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      title="Hapus timer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}

      {/* Add form (collapsible) */}
      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-blue-500/60 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Pasang timer baru
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30 space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Timer baru</span>
            {tokenTimers.length > 0 && (
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                title="Tutup form"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Assignee</label>
              <select
                value={selectedAssigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className={inputClass}
              >
                {assignees.length === 0 && <option value="">Belum ada assignee</option>}
                {assignees.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Layanan AI</label>
              <input
                list="ai-service-presets"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Claude, ChatGPT..."
                className={inputClass}
              />
              <datalist id="ai-service-presets">
                {AI_SERVICE_PRESETS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Mode switch */}
          <div className="grid grid-cols-2 p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-xs font-semibold">
            {(
              [
                { id: 'duration', label: 'Hitung mundur' },
                { id: 'clock', label: 'Jam tertentu' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`py-1.5 rounded-md transition-colors ${
                  mode === m.id
                    ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {mode === 'duration' ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {DURATION_PRESETS.map((p) => {
                  const active = hours * 60 + minutes === p.minutes;
                  return (
                    <button
                      key={p.minutes}
                      type="button"
                      onClick={() => {
                        setHours(Math.floor(p.minutes / 60));
                        setMinutes(p.minutes % 60);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                        active
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                Refresh dalam
                <input
                  type="number"
                  min={0}
                  max={168}
                  value={hours}
                  onChange={(e) => setHours(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-14 ${smallInput}`}
                />
                jam
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={minutes}
                  onChange={(e) => setMinutes(Math.min(59, Math.max(0, Number(e.target.value) || 0)))}
                  className={`w-14 ${smallInput}`}
                />
                menit
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              Bisa dipakai lagi jam
              <input type="time" value={clock} onChange={(e) => setClock(e.target.value)} className={smallInput} />
              <span className="w-full text-[10px] text-slate-400">Jika jamnya sudah lewat, dihitung untuk besok.</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              Ingatkan
              <select
                value={remindBefore}
                onChange={(e) => setRemindBefore(Number(e.target.value))}
                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100"
              >
                {REMIND_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m === 0 ? 'Tidak' : `${m} menit sebelum`}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={assignees.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shadow-md shadow-blue-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              Pasang
            </button>
          </div>
          {error && <p className="text-[11px] text-rose-500">{error}</p>}
        </form>
      )}
    </div>
  );
};
