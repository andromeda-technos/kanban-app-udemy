import React, { useEffect, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Column, Task } from '../types/kanban';
import { TaskCard } from './TaskCard';
import { ColumnNotes } from './ColumnNotes';
import { ColumnTimerBadges } from './ColumnTimerBadges';
import { useKanban } from '../context/KanbanContext';
import { getDeadlineStatus, isDoneColumn, NEAR_DEADLINE_DAYS } from '../utils/deadline';
import {
  Plus,
  MoreHorizontal,
  ArrowLeft,
  ArrowRight,
  Edit2,
  Trash2,
  AlertTriangle,
  FolderOpen,
  GripVertical,
  StickyNote,
} from 'lucide-react';

type SortableState = ReturnType<typeof useSortable>;

interface ColumnViewProps {
  column: Column;
  tasks: Task[];
  onAddTask: (columnId: string) => void;
  onEditTask: (task: Task) => void;
  onEditColumn: (column: Column) => void;
  onOpenTimers?: () => void;
  isFirst: boolean;
  isLast: boolean;
  /** dnd-kit bindings; absent for the floating drag overlay copy */
  sortable?: SortableState;
  /** Rendered inside <DragOverlay>: the "lifted" copy that follows the pointer */
  isOverlay?: boolean;
}

/** Column registered with dnd-kit's sortable context (column reordering). */
export const SortableColumn: React.FC<Omit<ColumnViewProps, 'sortable' | 'isOverlay'>> = (props) => {
  const sortable = useSortable({ id: props.column.id, data: { type: 'column' } });
  return <ColumnView {...props} sortable={sortable} />;
};

export const ColumnView: React.FC<ColumnViewProps> = ({
  column,
  tasks,
  onAddTask,
  onEditTask,
  onEditColumn,
  onOpenTimers,
  isFirst,
  isLast,
  sortable,
  isOverlay = false,
}) => {
  const { moveTask, deleteColumn, moveColumnOrder, tasks: allTasks } = useKanban();
  const [showMenu, setShowMenu] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null);

  const isWipExceeded = !!column.wipLimit && column.wipLimit > 0 && tasks.length > column.wipLimit;

  // Deadline lamp: based on every task in the column (ignores active filters); finished columns are skipped
  const deadlineTasks = isDoneColumn(column)
    ? []
    : allTasks.filter((t) => t.columnId === column.id);
  const overdueTasks = deadlineTasks.filter((t) => getDeadlineStatus(t) === 'overdue');
  const nearTasks = deadlineTasks.filter((t) => getDeadlineStatus(t) === 'near');
  const lampLevel = overdueTasks.length > 0 ? 'overdue' : nearTasks.length > 0 ? 'near' : null;
  const lampTooltip = [
    overdueTasks.length > 0 &&
      `Lewat deadline (${overdueTasks.length}): ${overdueTasks.map((t) => t.title).join(', ')}`,
    nearTasks.length > 0 &&
      `Deadline <= ${NEAR_DEADLINE_DAYS} hari (${nearTasks.length}): ${nearTasks.map((t) => t.title).join(', ')}`,
  ]
    .filter(Boolean)
    .join('\n');

  const isDragging = sortable?.isDragging ?? false;

  // Close the "..." menu once the column gets picked up
  useEffect(() => {
    if (isDragging) setShowMenu(false);
  }, [isDragging]);

  // Native HTML5 drag & drop is only used for task cards (columns use dnd-kit)
  const handleDragOver = (e: React.DragEvent) => {
    if (isOverlay) return;
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
    if (isOverlay) return;
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
      ref={sortable?.setNodeRef}
      style={
        sortable
          ? { transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition }
          : undefined
      }
      data-column-id={isOverlay ? undefined : column.id}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex flex-col w-[85vw] max-w-80 sm:w-80 shrink-0 snap-start rounded-2xl p-3 border ${
        isOverlay
          ? 'bg-slate-100 dark:bg-slate-900 border-blue-400/70 dark:border-blue-500/60 shadow-2xl shadow-slate-900/25 dark:shadow-black/50 ring-2 ring-blue-500/30 rotate-[1.5deg] scale-[1.02] cursor-grabbing'
          : isDragOver
          ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-500/80 ring-2 ring-blue-500/20 transition-colors duration-200'
          : 'bg-slate-100/90 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800 transition-colors duration-200'
      }`}
    >
      {/* Placeholder left behind while the column is being dragged */}
      {isDragging && (
        <div className="absolute inset-0 z-10 rounded-2xl border-2 border-dashed border-blue-400/70 dark:border-blue-500/50 bg-blue-50/80 dark:bg-slate-950/80 flex items-center justify-center">
          <span className="text-xs font-semibold text-blue-500/80">Lepaskan di sini</span>
        </div>
      )}

      {/* Column Header (drag handle) */}
      <div
        ref={sortable?.setActivatorNodeRef}
        {...sortable?.attributes}
        {...sortable?.listeners}
        aria-roledescription="kolom yang bisa dipindah"
        aria-label={`Kolom ${column.title}. Tekan spasi untuk mulai memindahkan.`}
        className={`flex items-center justify-between gap-2 px-1 py-1.5 mb-2 rounded-lg group/header focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          isOverlay ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        title="Tarik untuk memindahkan kolom"
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripVertical className="w-3.5 h-3.5 -mx-1 shrink-0 text-slate-300 dark:text-slate-600 group-hover/header:text-slate-500 dark:group-hover/header:text-slate-400 transition-colors" />
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

          {/* Deadline indicator lamp */}
          {lampLevel && (
            <span
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 cursor-help ${
                lampLevel === 'overdue'
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
              }`}
              title={lampTooltip}
            >
              <span className="relative flex w-2 h-2">
                <span
                  className={`absolute inline-flex w-full h-full rounded-full opacity-75 animate-ping ${
                    lampLevel === 'overdue' ? 'bg-rose-400' : 'bg-amber-400'
                  }`}
                />
                <span
                  className={`relative inline-flex w-2 h-2 rounded-full ${
                    lampLevel === 'overdue' ? 'bg-rose-500' : 'bg-amber-500'
                  }`}
                />
              </span>
              {overdueTasks.length + nearTasks.length}
            </span>
          )}
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsAddingNote(true)}
            className="p-1 rounded-lg text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-white dark:hover:bg-slate-800 transition-colors"
            title="Tambah catatan penting"
          >
            <StickyNote className="w-4 h-4" />
          </button>
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

                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      setIsAddingNote(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <StickyNote className="w-3.5 h-3.5 text-amber-500" />
                    Tambah Catatan
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

      {/* AI token timers of the assignees working in this column */}
      <ColumnTimerBadges columnId={column.id} onOpenTimers={isOverlay ? undefined : onOpenTimers} />

      {/* WIP Limit warning alert */}
      {isWipExceeded && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 mb-2 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-medium">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Melebihi batas WIP limit ({column.wipLimit})!</span>
        </div>
      )}

      {/* Important notes pinned at the top of the column */}
      <ColumnNotes
        column={column}
        isAdding={isAddingNote}
        onAddingChange={setIsAddingNote}
        onOpenTask={onEditTask}
        readOnly={isOverlay}
      />

      {/* Tasks List */}
      <div className="flex-1 flex flex-col gap-2.5 min-h-[140px]">
        {tasks.map((task, index) => (
          <React.Fragment key={task.id}>
            {/* Visual drop target indicator line */}
            {isDragOver && dropIndicatorIndex === index && (
              <div className="h-1 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.6)] my-0.5 drop-indicator-x" />
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
          <div className="h-1 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.6)] my-0.5 drop-indicator-x" />
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
