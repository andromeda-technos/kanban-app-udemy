import React, { useRef, useState } from 'react';
import { Subtask } from '../types/kanban';
import { MessageSquareText, Pencil } from 'lucide-react';

interface SubtaskNoteProps {
  subtask: Subtask;
  /** Show the input right away (just checked off) */
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onSave: (note: string) => void;
  compact?: boolean;
}

const formatDone = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';

/**
 * Small completion note under a finished subtask.
 * Enter saves, Esc / leaving the field closes it (an empty note is simply skipped).
 */
export const SubtaskNote: React.FC<SubtaskNoteProps> = ({
  subtask,
  editing,
  onEditingChange,
  onSave,
  compact = false,
}) => {
  const [value, setValue] = useState(subtask.note ?? '');
  // Set on Esc so the blur fired while the input unmounts doesn't save anyway
  const cancelledRef = useRef(false);

  if (!subtask.completed) return null;

  // Line the note up with the subtask title (past the grip + checkbox)
  const indent = compact ? 'ml-9' : 'ml-[46px]';

  if (editing) {
    const commit = () => {
      if (cancelledRef.current) return;
      onSave(value.trim());
      onEditingChange(false);
    };
    return (
      <div className={`${indent} mt-1 mb-0.5 flex items-center gap-1.5`}>
        <MessageSquareText className="w-3 h-3 shrink-0 text-emerald-500" />
        <input
          autoFocus
          onFocus={() => {
            cancelledRef.current = false;
          }}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              cancelledRef.current = true;
              setValue(subtask.note ?? '');
              onEditingChange(false);
            }
          }}
          onBlur={commit}
          maxLength={200}
          placeholder="Catatan singkat (opsional), Enter untuk simpan"
          className="flex-1 min-w-0 px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 text-[11px] text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 select-text"
        />
      </div>
    );
  }

  // Finished without a note yet: discreet "add note" link, revealed on row hover
  if (!subtask.note) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue('');
          onEditingChange(true);
        }}
        className={`hover-reveal ${indent} mt-0.5 flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 opacity-0 group-hover/strow:opacity-100 focus:opacity-100 transition-opacity`}
      >
        <MessageSquareText className="w-3 h-3" />
        Tambah catatan
      </button>
    );
  }

  return (
    <div className={`${indent} mt-0.5 mb-0.5 group/stnote flex items-start gap-1.5`}>
      <MessageSquareText className="w-3 h-3 shrink-0 mt-px text-emerald-500/80" />
      <p className="flex-1 min-w-0 text-[11px] leading-snug text-slate-500 dark:text-slate-400 italic break-words">
        {subtask.note}
        {subtask.completedAt && (
          <span className="not-italic text-[10px] text-slate-400 dark:text-slate-500"> · {formatDone(subtask.completedAt)}</span>
        )}
      </p>
      <button
        type="button"
        onClick={() => {
          setValue(subtask.note ?? '');
          onEditingChange(true);
        }}
        className="hover-reveal p-0.5 rounded text-slate-400 hover:text-blue-600 opacity-0 group-hover/stnote:opacity-100 focus:opacity-100 transition-opacity"
        title="Edit catatan"
      >
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  );
};
