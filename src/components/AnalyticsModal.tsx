import React from 'react';
import { useKanban } from '../context/KanbanContext';
import { X, BarChart3, CheckCircle2, Clock, AlertTriangle, ListTodo } from 'lucide-react';

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({ isOpen, onClose }) => {
  const { activeBoard, activeColumns, activeTasks } = useKanban();

  if (!isOpen) return null;

  const totalTasks = activeTasks.length;
  const todayStr = new Date().toISOString().split('T')[0];

  const doneColumnIds = activeColumns
    .filter((c) => {
      const t = c.title.toLowerCase();
      return t.includes('done') || t.includes('selesai') || t.includes('shipped');
    })
    .map((c) => c.id);

  const completedTasks = activeTasks.filter((t) => doneColumnIds.includes(t.columnId)).length;
  const overdueTasks = activeTasks.filter(
    (t) => t.dueDate && t.dueDate < todayStr && !doneColumnIds.includes(t.columnId)
  ).length;
  const inProgressTasks = totalTasks - completedTasks;

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Total subtasks
  let totalSubtasks = 0;
  let completedSubtasks = 0;
  activeTasks.forEach((t) => {
    totalSubtasks += t.subtasks.length;
    completedSubtasks += t.subtasks.filter((st) => st.completed).length;
  });
  const subtaskRate = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  // Breakdown by priority
  const priorityCount = {
    urgent: activeTasks.filter((t) => t.priority === 'urgent').length,
    high: activeTasks.filter((t) => t.priority === 'high').length,
    medium: activeTasks.filter((t) => t.priority === 'medium').length,
    low: activeTasks.filter((t) => t.priority === 'low').length,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                Statistik & Metrik Produktivitas
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Papan: {activeBoard?.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {/* Key Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50">
              <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-semibold mb-1">
                <ListTodo className="w-3.5 h-3.5" /> Total Tugas
              </div>
              <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{totalTasks}</div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Selesai
              </div>
              <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{completedTasks}</div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50">
              <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-semibold mb-1">
                <Clock className="w-3.5 h-3.5" /> Berjalan
              </div>
              <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{inProgressTasks}</div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50">
              <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-semibold mb-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Terlambat
              </div>
              <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{overdueTasks}</div>
            </div>
          </div>

          {/* Progress Bars */}
          <div className="space-y-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span className="text-slate-700 dark:text-slate-300">Tingkat Penyelesaian Tugas Proyek</span>
                <span className="text-blue-600 dark:text-blue-400">{completionRate}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500 rounded-full"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span className="text-slate-700 dark:text-slate-300">
                  Penyelesaian Subtugas ({completedSubtasks}/{totalSubtasks})
                </span>
                <span className="text-emerald-600 dark:text-emerald-400">{subtaskRate}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
                  style={{ width: `${subtaskRate}%` }}
                />
              </div>
            </div>
          </div>

          {/* Distribution by Column */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Distribusi per Kolom
            </h4>
            <div className="space-y-2">
              {activeColumns.map((col) => {
                const count = activeTasks.filter((t) => t.columnId === col.id).length;
                const percentage = totalTasks > 0 ? (count / totalTasks) * 100 : 0;
                return (
                  <div key={col.id} className="text-xs">
                    <div className="flex justify-between font-medium text-slate-700 dark:text-slate-300 mb-1">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                        {col.title}
                      </span>
                      <span>
                        {count} tugas ({Math.round(percentage)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all duration-300 rounded-full"
                        style={{ width: `${percentage}%`, backgroundColor: col.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Breakdown by Priority */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Distribusi Prioritas
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20">
                <div className="text-xs text-rose-600 dark:text-rose-400 font-semibold">Mendesak</div>
                <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{priorityCount.urgent}</div>
              </div>
              <div className="p-2.5 rounded-xl border border-orange-200 dark:border-orange-900/60 bg-orange-50/40 dark:bg-orange-950/20">
                <div className="text-xs text-orange-600 dark:text-orange-400 font-semibold">Tinggi</div>
                <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{priorityCount.high}</div>
              </div>
              <div className="p-2.5 rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/40 dark:bg-sky-950/20">
                <div className="text-xs text-sky-600 dark:text-sky-400 font-semibold">Sedang</div>
                <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{priorityCount.medium}</div>
              </div>
              <div className="p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20">
                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Rendah</div>
                <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{priorityCount.low}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
