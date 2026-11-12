import React from 'react';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { Subtask } from '../types/kanban';

interface SortableChecklistProps {
  items: Subtask[];
  onReorder: (next: Subtask[]) => void;
  /** Renders one row; `handle` is the drag grip to place inside it */
  renderItem: (item: Subtask, handle: React.ReactNode, isDragging: boolean) => React.ReactNode;
  className?: string;
  /** Size of the grip icon */
  compact?: boolean;
}

const SortableRow: React.FC<{
  item: Subtask;
  compact: boolean;
  renderItem: SortableChecklistProps['renderItem'];
}> = ({ item, compact, renderItem }) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Pindahkan "${item.title}"`}
      title="Tarik untuk memindahkan"
      className={`shrink-0 -ml-1 rounded text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 touch-none ${
        isDragging ? 'cursor-grabbing text-blue-500' : 'cursor-grab'
      }`}
    >
      <GripVertical className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative ${isDragging ? 'z-10 shadow-lg rounded-lg ring-2 ring-blue-500/40' : ''}`}
    >
      {renderItem(item, handle, isDragging)}
    </div>
  );
};

/** Vertical checklist whose rows can be reordered by dragging a grip (mouse, touch or keyboard). */
export const SortableChecklist: React.FC<SortableChecklistProps> = ({
  items,
  onReorder,
  renderItem,
  className,
  compact = false,
}) => {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from !== -1 && to !== -1) onReorder(arrayMove(items, from, to));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            'Tekan spasi untuk mengambil subtugas, panah atas/bawah untuk memindahkan, spasi lagi untuk melepas, atau escape untuk batal.',
        },
      }}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item) => (
            <SortableRow key={item.id} item={item} compact={compact} renderItem={renderItem} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
