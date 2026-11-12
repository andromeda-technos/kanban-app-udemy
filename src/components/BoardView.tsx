import { IndonesiaClock } from './IndonesiaClock';
import { SortBar } from './SortBar';
import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type DropAnimation,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { useFlipAnimation } from '../hooks/useFlipAnimation';
import { useKanban } from '../context/KanbanContext';
import { ColumnView, SortableColumn } from './ColumnView';
import { Column, Task } from '../types/kanban';
import { Plus, Layout } from 'lucide-react';

const dropAnimation: DropAnimation = {
  duration: 280,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: '0' } },
  }),
};

interface BoardViewProps {
  onAddTask: (columnId: string) => void;
  onEditTask: (task: Task) => void;
  onAddColumn: () => void;
  onEditColumn: (column: Column) => void;
  onOpenTimers?: () => void;
}

export const BoardView: React.FC<BoardViewProps> = ({
  onAddTask,
  onEditTask,
  onAddColumn,
  onEditColumn,
  onOpenTimers,
}) => {
  const { activeBoard, activeColumns, filteredTasks, reorderColumn } = useKanban();

  // Smoothly animate columns/cards to their new positions on every reorder or move.
  // Paused while dnd-kit drags a column, since dnd-kit animates that itself.
  const boardRef = useRef<HTMLElement>(null);
  const flipPausedRef = useRef(false);
  useFlipAnimation(boardRef, flipPausedRef);

  // Column drag & drop (dnd-kit)
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const activeColumn = activeColumns.find((c) => c.id === activeColumnId) ?? null;

  const sensors = useSensors(
    // Small movement threshold so clicks on header buttons still work
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Long-press on touch screens, so swiping still scrolls the board
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const columnTitle = (id: string | number | undefined) =>
    activeColumns.find((c) => c.id === id)?.title ?? '';
  const columnPos = (id: string | number | undefined) =>
    activeColumns.findIndex((c) => c.id === id) + 1;

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Mengambil kolom ${columnTitle(active.id)} (posisi ${columnPos(active.id)} dari ${activeColumns.length}).`,
    onDragOver: ({ active, over }) =>
      over ? `Kolom ${columnTitle(active.id)} akan dipindah ke posisi ${columnPos(over.id)}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `Kolom ${columnTitle(active.id)} dipindah ke posisi ${columnPos(over.id)}.`
        : `Kolom ${columnTitle(active.id)} dilepas.`,
    onDragCancel: ({ active }) => `Batal memindahkan kolom ${columnTitle(active.id)}.`,
  };

  const resumeFlip = () => {
    // Let the reorder commit (and be measured) before FLIP animations resume
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        flipPausedRef.current = false;
      })
    );
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    flipPausedRef.current = true;
    setActiveColumnId(String(active.id));
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveColumnId(null);
    if (over && active.id !== over.id) {
      const from = activeColumns.findIndex((c) => c.id === active.id);
      const to = activeColumns.findIndex((c) => c.id === over.id);
      // reorderColumn expects an insertion gap index (counted before removal)
      if (from !== -1 && to !== -1) reorderColumn(String(active.id), to > from ? to + 1 : to);
    }
    resumeFlip();
  };

  const handleDragCancel = () => {
    setActiveColumnId(null);
    resumeFlip();
  };

  return (
    <main ref={boardRef} className="relative z-10 flex-1 flex flex-col p-4 sm:p-6 pb-28 sm:pb-28">
      {/* Board Info Subheader */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-3 shrink-0">
        <div className="min-w-0">
          <h1 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            {activeBoard?.title}
          </h1>
          {activeBoard?.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              {activeBoard.description}
            </p>
          )}
        </div>
        <IndonesiaClock className="w-full lg:w-auto lg:min-w-[340px] shrink-0" />
      </div>

      {/* Sort switcher + count */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 shrink-0">
        <SortBar />
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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              'Tekan spasi atau enter untuk mengambil kolom. Gunakan panah kiri/kanan untuk memindahkan, spasi/enter lagi untuk melepas, atau escape untuk batal.',
          },
        }}
      >
      <div
        className={`flex gap-3 sm:gap-4 overflow-x-auto pb-4 items-start custom-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 scroll-px-4 sm:scroll-px-0 ${
          // Phones: swipe snaps one column at a time (off while dragging a column)
          activeColumnId ? 'select-none snap-none' : 'snap-x snap-mandatory sm:snap-none'
        }`}
      >
        <SortableContext
          items={activeColumns.map((c) => c.id)}
          strategy={horizontalListSortingStrategy}
        >
          {activeColumns.map((col, index) => (
            <SortableColumn
              key={col.id}
              column={col}
              tasks={filteredTasks.filter((t) => t.columnId === col.id)}
              onAddTask={onAddTask}
              onEditTask={onEditTask}
              onEditColumn={onEditColumn}
              onOpenTimers={onOpenTimers}
              isFirst={index === 0}
              isLast={index === activeColumns.length - 1}
            />
          ))}
        </SortableContext>

        {/* Add Column Button Card */}
        <div className="w-[85vw] max-w-72 sm:w-72 shrink-0 snap-start">
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

      {/* Lifted copy of the column that follows the pointer (portaled so it never gets clipped) */}
      {createPortal(
        <DragOverlay dropAnimation={dropAnimation}>
          {activeColumn && (
            <ColumnView
              column={activeColumn}
              tasks={filteredTasks.filter((t) => t.columnId === activeColumn.id)}
              onAddTask={onAddTask}
              onEditTask={onEditTask}
              onEditColumn={onEditColumn}
              isFirst={false}
              isLast={false}
              isOverlay
            />
          )}
        </DragOverlay>,
        document.body
      )}
      </DndContext>
    </main>
  );
};
