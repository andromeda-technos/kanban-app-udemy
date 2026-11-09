import React, { useState } from 'react';
import { Column, Task } from '../types/kanban';
import { TaskCard } from './TaskCard';
import { useKanban } from '../context/KanbanContext';
import {
  Plus,
  MoreHorizontal,
  ArrowLeft,
  ArrowRight,
  Edit2,
  Trash2,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';

interface ColumnViewProps {
  column: Column;
  tasks: Task[];
  onAddTask: (columnId: string) => void;
  onEditTask: (task: Task) => void;
  onEditColumn: (column: Column) => void;
  isFirst: boolean;
  isLast: boolean;
}

export const ColumnView: React.FC<ColumnViewProps> = ({
  column,
  tasks,
  onAddTask,
  onEditTask,
  onEditColumn,
  isFirst,
  isLast,
}) => {
  const { moveTask, deleteColumn, moveColumnOrder } = useKanban();
  const [showMenu, setShowMenu] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null);

  const isWipExceeded = column.wipLimit && column.wipLimit > 0 && tasks.length > column.wipLimit;

  // Handle Drag Over column
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);

    // Calculate which card we are hovering over to show insertion indicator
    const cardElements = Array.from(
      e.currentTarget.querySelectorAll('[data-task-id]')
    ) as HTMLElement[];

    const mouseY = e.clientY;
    let targetIdx = cardElements.length;

    for (let i = 0; i < cardElements.length; i++) {
      const rect = cardElements[i].getBoundingClientRect();
      const middleY = rect.top + rect.height / 2;
      if (mouseY < middleY) {
        targetIdx = i;
        break;
      }
    }
    setDropIndicatorIndex(targetIdx);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only reset if leaving the column itself, not entering children
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
      setDropIndicatorIndex(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const targetIdx = dropIndicatorIndex !== null ? dropIndicatorIndex : tasks.length;
    moveTask(taskId, column.id, targetIdx);
    setDropIndicatorIndex(null);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col w-80 shrink-0 bg-slate-100/90 dark:bg-slate-900/60 rounded-2xl p-3 border transition-all duration-200 ${
        isDragOver
          ? 'border-blue-500/80 bg-blue-50/40 dark:bg-blue-950/20 ring-2 ring-blue-500/20'
          : 'border-slate-200/80 dark:border-slate-800'
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between gap-2 px-1 py-1.5 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: column.color || '#3b82f6' }}
          />
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
            {column.title}
          </h3>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              isWipExceeded
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                : 'bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60'
            }`}
          >
            {tasks.length}
            {column.wipLimit && column.wipLimit > 0 ? ` / ${column.wipLimit}` : ''}
          </span>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onAddTask(column.id)}
            className="p-1 rounded-lg text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-slate-800 transition-colors"
            title="Tambah tugas di kolom ini"
          >
            <Plus className="w-4 h-4" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-20 py-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onEditColumn(column);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                    Edit Kolom
                  </button>

                  {!isFirst && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        moveColumnOrder(column.id, 'left');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Geser ke Kiri
                    </button>
                  )}

                  {!isLast && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        moveColumnOrder(column.id, 'right');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      Geser ke Kanan
                    </button>
                  )}

                  <div className="my-1 border-t border-slate-100 dark:border-slate-700" />

                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      if (
                        confirm(
                          `Apakah Anda yakin ingin menghapus kolom "${column.title}" dan seluruh ${tasks.length} tugas di dalamnya?`
                        )
                      ) {
                        deleteColumn(column.id);
                      }
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus Kolom
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* WIP Limit warning alert */}
      {isWipExceeded && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 mb-2 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-medium">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Melebihi batas WIP limit ({column.wipLimit})!</span>
        </div>
      )}

      {/* Tasks List */}
      <div className="flex-1 flex flex-col gap-2.5 min-h-[140px] overflow-y-auto max-h-[calc(100vh-220px)] pr-1 custom-scrollbar">
        {tasks.map((task, index) => (
          <React.Fragment key={task.id}>
            {/* Visual drop target indicator line */}
            {isDragOver && dropIndicatorIndex === index && (
              <div className="h-1 bg-blue-500 rounded-full animate-pulse my-0.5" />
            )}
            <TaskCard
              task={task}
              onEdit={onEditTask}
              isFirstColumn={isFirst}
              isLastColumn={isLast}
            />
          </React.Fragment>
        ))}

        {/* Drop target at end */}
        {isDragOver && dropIndicatorIndex === tasks.length && (
          <div className="h-1 bg-blue-500 rounded-full animate-pulse my-0.5" />
        )}

        {/* Empty state */}
        {tasks.length === 0 && !isDragOver && (
          <div
            onClick={() => onAddTask(column.id)}
            className="flex-1 flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl hover:border-blue-400/50 hover:bg-white/50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group"
          >
            <FolderOpen className="w-8 h-8 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 mb-2 transition-colors" />
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
              Belum ada tugas
            </p>
            <span className="text-[11px] text-blue-600 dark:text-blue-400 mt-1 font-semibold flex items-center gap-1">
              <Plus className="w-3 h-3" /> Tambah tugas
            </span>
          </div>
        )}
      </div>

      {/* Add Task footer button */}
      <button
        type="button"
        onClick={() => onAddTask(column.id)}
        className="mt-2.5 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-xl shadow-xs hover:text-blue-600 dark:hover:text-blue-400 transition-all"
      >
        <Plus className="w-3.5 h-3.5" />
        Tambah Tugas
      </button>
    </div>
  );
};
