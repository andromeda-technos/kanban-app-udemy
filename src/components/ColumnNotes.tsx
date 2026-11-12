import React, { useState } from 'react';
import { Column, Task } from '../types/kanban';
import { useKanban } from '../context/KanbanContext';
import {
  Pin,
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Link2,
  Search,
  ArrowUpRight,
} from 'lucide-react';

interface ColumnNotesProps {
  column: Column;
  /** Whether the "new note" editor is open (controlled so the column header/menu can open it) */
  isAdding: boolean;
  onAddingChange: (adding: boolean) => void;
  /** Opens a task's detail modal (fallback when its card isn't visible on the board) */
  onOpenTask: (task: Task) => void;
  /** Static copy (drag overlay): no editing */
  readOnly?: boolean;
}

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

/** Plain text with http(s) links made clickable. */
const NoteText: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(URL_REGEX).map((part, i) =>
      i % 2 === 1 ? (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-amber-500/60 hover:text-blue-600 dark:hover:text-blue-400 break-all"
        >
          {part}
        </a>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      )
    )}
  </>
);

const formatTime = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Scrolls the board to a task card and flashes it. Returns false when the card isn't rendered
 * (e.g. hidden by the active filter), so the caller can fall back to opening the task.
 */
const focusTaskCard = (taskId: string): boolean => {
  const el = document.querySelector<HTMLElement>(`main [data-task-id="${CSS.escape(taskId)}"]`);
  if (!el) return false;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center', inline: 'center' });
  el.animate(
    [
      { boxShadow: '0 0 0 0 rgba(245,158,11,0)' },
      { boxShadow: '0 0 0 4px rgba(245,158,11,0.7), 0 12px 28px -10px rgba(245,158,11,0.5)', offset: 0.25 },
      { boxShadow: '0 0 0 3px rgba(245,158,11,0.45)', offset: 0.7 },
      { boxShadow: '0 0 0 0 rgba(245,158,11,0)' },
    ],
    { duration: 1800, delay: reduceMotion ? 0 : 250, easing: 'ease-out' }
  );
  return true;
};

/** Chip that jumps to a linked task. */
const TaskLinkChip: React.FC<{ task: Task; onOpenTask: (task: Task) => void; onRemove?: () => void }> = ({
  task,
  onOpenTask,
  onRemove,
}) => {
  const { columns } = useKanban();
  const col = columns.find((c) => c.id === task.columnId);
  return (
    <span className="inline-flex items-center max-w-full rounded-md border border-amber-300/70 dark:border-amber-800/70 bg-white dark:bg-slate-900 text-[11px] font-medium text-slate-700 dark:text-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => {
          if (!focusTaskCard(task.id)) onOpenTask(task);
        }}
        title={`Ke tugas "${task.title}"${col ? ` (kolom ${col.title})` : ''}`}
        className="group/chip inline-flex items-center gap-1 min-w-0 pl-1.5 pr-1 py-0.5 hover:bg-amber-100 dark:hover:bg-amber-900/40 hover:text-amber-800 dark:hover:text-amber-300 transition-colors"
      >
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: col?.color || '#94a3b8' }}
        />
        <span className="truncate">{task.title}</span>
        <ArrowUpRight className="w-3 h-3 shrink-0 text-slate-400 group-hover/chip:text-amber-600" />
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          title="Lepas tautan"
          className="px-1 py-0.5 text-slate-400 hover:text-rose-500 border-l border-amber-200/70 dark:border-amber-900/60"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
};

/** Searchable list of the board's tasks to link to a note. */
const TaskPicker: React.FC<{
  selectedIds: string[];
  onToggle: (taskId: string) => void;
  onClose: () => void;
}> = ({ selectedIds, onToggle, onClose }) => {
  const { activeTasks, activeColumns } = useKanban();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  // Grouped by column in board order, like the board itself
  const options = activeColumns.flatMap((col) =>
    activeTasks
      .filter((t) => t.columnId === col.id && (!q || t.title.toLowerCase().includes(q)))
      .sort((a, b) => a.order - b.order)
      .map((t) => ({ task: t, col }))
  );

  return (
    <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="flex items-center gap-1.5 px-2 border-b border-slate-100 dark:border-slate-800">
        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }
          }}
          placeholder="Cari tugas..."
          className="flex-1 min-w-0 py-1.5 bg-transparent text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
        />
        <button type="button" onClick={onClose} className="p-0.5 text-slate-400 hover:text-slate-700" title="Tutup">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <ul className="max-h-44 overflow-y-auto custom-scrollbar py-1">
        {options.length === 0 && (
          <li className="px-2.5 py-2 text-[11px] text-slate-400">Tidak ada tugas yang cocok.</li>
        )}
        {options.map(({ task, col }) => {
          const selected = selectedIds.includes(task.id);
          return (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => onToggle(task.id)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors ${
                  selected
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span
                  className={`w-3.5 h-3.5 shrink-0 rounded border flex items-center justify-center ${
                    selected ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {selected && <Check className="w-2.5 h-2.5" />}
                </span>
                <span className="truncate flex-1">{task.title}</span>
                <span className="flex items-center gap-1 shrink-0 text-[10px] text-slate-400 max-w-[90px]">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                  <span className="truncate">{col.title}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

/** Note editor: text + linked tasks. Ctrl/Cmd+Enter saves, Esc cancels. */
const NoteEditor: React.FC<{
  initialText?: string;
  initialTaskIds?: string[];
  onSave: (text: string, taskIds: string[]) => void;
  onCancel: () => void;
  onOpenTask: (task: Task) => void;
}> = ({ initialText = '', initialTaskIds = [], onSave, onCancel, onOpenTask }) => {
  const { tasks } = useKanban();
  const [value, setValue] = useState(initialText);
  const [taskIds, setTaskIds] = useState<string[]>(initialTaskIds);
  const [showPicker, setShowPicker] = useState(false);

  const linkedTasks = taskIds
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is Task => !!t);

  const toggleTask = (id: string) =>
    setTaskIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const save = () => {
    if (value.trim()) onSave(value, linkedTasks.map((t) => t.id));
  };

  return (
    <div className="space-y-1.5">
      <textarea
        autoFocus
        rows={3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            save();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        placeholder="Tulis catatan penting... (mis: Semua PR wajib di-review 2 orang)"
        className="w-full px-2.5 py-2 rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/60 resize-y"
      />

      {/* Linked tasks */}
      {linkedTasks.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {linkedTasks.map((t) => (
            <TaskLinkChip key={t.id} task={t} onOpenTask={onOpenTask} onRemove={() => toggleTask(t.id)} />
          ))}
        </div>
      )}
      {showPicker ? (
        <TaskPicker selectedIds={taskIds} onToggle={toggleTask} onClose={() => setShowPicker(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:underline"
        >
          <Link2 className="w-3 h-3" />
          {linkedTasks.length > 0 ? 'Ubah tugas terkait' : 'Tautkan tugas terkait'}
        </button>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-amber-700/70 dark:text-amber-400/60">Ctrl+Enter simpan · Esc batal</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-md text-slate-500 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            title="Batal"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!value.trim()}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50"
          >
            <Check className="w-3 h-3" /> Simpan
          </button>
        </div>
      </div>
    </div>
  );
};

export const ColumnNotes: React.FC<ColumnNotesProps> = ({
  column,
  isAdding,
  onAddingChange,
  onOpenTask,
  readOnly = false,
}) => {
  const { tasks, addColumnNote, updateColumnNote, deleteColumnNote } = useKanban();
  const [collapsed, setCollapsed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const notes = column.notes ?? [];
  if (notes.length === 0 && !isAdding) return null;

  const showBody = !collapsed || isAdding;

  return (
    <div className="mb-2.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/25 shadow-xs">
      {/* Panel header */}
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1.5 min-w-0 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400"
          title={collapsed ? 'Tampilkan catatan' : 'Sembunyikan catatan'}
        >
          <Pin className="w-3.5 h-3.5 shrink-0 -rotate-45" />
          Catatan Penting
          <span className="px-1.5 rounded-full bg-amber-200/70 dark:bg-amber-900/60 text-[10px] normal-case tracking-normal">
            {notes.length}
          </span>
          {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
        {!readOnly && !isAdding && (
          <button
            type="button"
            onClick={() => {
              setCollapsed(false);
              onAddingChange(true);
            }}
            className="p-0.5 rounded-md text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            title="Tambah catatan"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {showBody && (
        <div className="px-2.5 pb-2.5 space-y-1.5">
          {notes.map((note) => {
            if (editingId === note.id) {
              return (
                <NoteEditor
                  key={note.id}
                  initialText={note.text}
                  initialTaskIds={note.taskIds}
                  onOpenTask={onOpenTask}
                  onSave={(text, taskIds) => {
                    updateColumnNote(column.id, note.id, text, taskIds);
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              );
            }

            // Tasks deleted since the note was written are simply not shown
            const linkedTasks = (note.taskIds ?? [])
              .map((id) => tasks.find((t) => t.id === id))
              .filter((t): t is Task => !!t);

            return (
              <div
                key={note.id}
                className="group/note relative pl-2.5 pr-1 py-1.5 rounded-lg bg-white/70 dark:bg-slate-900/50 border-l-2 border-amber-400"
              >
                <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words pr-10">
                  <NoteText text={note.text} />
                </p>
                {linkedTasks.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {linkedTasks.map((t) => (
                      <TaskLinkChip key={t.id} task={t} onOpenTask={onOpenTask} />
                    ))}
                  </div>
                )}
                <p className="mt-1 text-[10px] text-slate-400">
                  {note.updatedAt ? `Diubah ${formatTime(note.updatedAt)}` : formatTime(note.createdAt)}
                </p>
                {!readOnly && (
                  <div className="absolute top-1 right-1 hover-reveal flex gap-0.5 opacity-0 group-hover/note:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => setEditingId(note.id)}
                      className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Edit catatan / tugas terkait"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Hapus catatan ini?')) deleteColumnNote(column.id, note.id);
                      }}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      title="Hapus catatan"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {isAdding && !readOnly && (
            <NoteEditor
              onOpenTask={onOpenTask}
              onSave={(text, taskIds) => {
                addColumnNote(column.id, text, taskIds);
                onAddingChange(false);
              }}
              onCancel={() => onAddingChange(false)}
            />
          )}
        </div>
      )}
    </div>
  );
};
