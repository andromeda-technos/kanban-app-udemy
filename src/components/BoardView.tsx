import React from 'react';
import { useKanban } from '../context/KanbanContext';
import { ColumnView } from './ColumnView';
import { Column, Task } from '../types/kanban';
import { Plus, Layout } from 'lucide-react';

interface BoardViewProps {
  onAddTask: (columnId: string) => void;
  onEditTask: (task: Task) => void;
  onAddColumn: () => void;
  onEditColumn: (column: Column) => void;
}

export const BoardView: React.FC<BoardViewProps> = ({
  onAddTask,
  onEditTask,
  onAddColumn,
  onEditColumn,
}) => {
  const { activeBoard, activeColumns, filteredTasks } = useKanban();

  return (
    <main className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 overflow-hidden">
      {/* Board Info Subheader */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 shrink-0">
        <div>
          <h1 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            {activeBoard?.title}
          </h1>
          {activeBoard?.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              {activeBoard.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {filteredTasks.length}
          </span>{' '}
          tugas ditampilkan di{' '}
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {activeColumns.length}
          </span>{' '}
          kolom
        </div>
      </div>

      {/* Columns Container (Horizontal Scroll) */}
      <div className="flex-1 flex gap-4 overflow-x-auto overflow-y-hidden pb-4 items-start custom-scrollbar">
        {activeColumns.map((col, index) => {
          const colTasks = filteredTasks.filter((t) => t.columnId === col.id);
          return (
            <ColumnView
              key={col.id}
              column={col}
              tasks={colTasks}
              onAddTask={onAddTask}
              onEditTask={onEditTask}
              onEditColumn={onEditColumn}
              isFirst={index === 0}
              isLast={index === activeColumns.length - 1}
            />
          );
        })}

        {/* Add Column Button Card */}
        <div className="w-72 shrink-0">
          <button
            type="button"
            onClick={onAddColumn}
            className="w-full flex items-center justify-center gap-2 p-3.5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-800 hover:border-blue-500/60 dark:hover:border-blue-500/50 bg-slate-100/50 dark:bg-slate-900/30 hover:bg-white dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-bold transition-all group"
          >
            <div className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 shadow-xs flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Plus className="w-4 h-4" />
            </div>
            <span>Tambah Kolom Baru</span>
          </button>
        </div>

        {/* Empty state if board has 0 columns */}
        {activeColumns.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <Layout className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
            <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 mb-1">
              Papan ini belum memiliki kolom
            </h3>
            <p className="text-xs text-slate-400 mb-4 max-w-sm">
              Mulai atur alur kerja Anda dengan menambahkan kolom pertama (misal: To Do, In Progress, Done).
            </p>
            <button
              type="button"
              onClick={onAddColumn}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors"
            >
              + Tambah Kolom Sekarang
            </button>
          </div>
        )}
      </div>
    </main>
  );
};
