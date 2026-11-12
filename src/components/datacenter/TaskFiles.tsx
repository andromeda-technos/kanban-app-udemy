import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileLink, useFiles } from '../../context/FilesContext';
import { DATA_CATEGORIES } from '../../utils/dataCenter';
import { FileChip, FileChooser } from './FileBits';
import { Database, LoaderCircle, Paperclip, Plus, X } from 'lucide-react';

/**
 * Dialog to attach Pusat Data files to a task or one of its subtasks:
 * upload a new file (goes to Drive + index) or pick an existing one.
 */
export const AttachFilesDialog: React.FC<{ title: string; link: FileLink; onClose: () => void }> = ({
  title,
  link,
  onClose,
}) => {
  const { enabled, files, folders, connection, uploads, uploadFiles, updateFile } = useFiles();
  const [category, setCategory] = useState('prd');
  const [choosing, setChoosing] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Esc closes only this dialog (capture phase, before the app-wide handler)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || choosing) return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, choosing]);

  const linked = files.filter(
    (f) => f.taskId === link.taskId && (link.subtaskId ? f.subtaskId === link.subtaskId : !f.subtaskId)
  );
  const canUpload = enabled && !!folders && connection === 'connected';

  return createPortal(
    <div
      className="fixed inset-0 z-[72] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="sheet-panel w-full max-w-lg max-h-[85dvh] flex flex-col bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 min-w-0">
            <Paperclip className="w-4 h-4 shrink-0 text-blue-500" />
            <span className="truncate">{title}</span>
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar">
          {/* Linked */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              File tertaut ({linked.length})
            </p>
            {linked.length === 0 ? (
              <p className="text-xs text-slate-400">Belum ada file.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {linked.map((f) => (
                  <FileChip
                    key={f.id}
                    file={f}
                    onRemove={() =>
                      updateFile(
                        f.id,
                        // Subtask dialog: unlink from the subtask only; task dialog: unlink completely
                        link.subtaskId ? { subtaskId: undefined } : { taskId: undefined, subtaskId: undefined }
                      ).catch((err) => setError((err as Error).message))
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pick existing */}
          <button
            type="button"
            disabled={!enabled}
            onClick={() => setChoosing(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <Database className="w-4 h-4 text-blue-500" />
            Pilih dari Pusat Data
          </button>

          {/* Upload new */}
          <div className="p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 space-y-2">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Unggah file baru ke Google Drive</p>
            {canUpload ? (
              <div className="flex gap-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex-1 min-w-0 px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100"
                >
                  {DATA_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                >
                  <Plus className="w-4 h-4" />
                  Pilih file
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const list = e.target.files ? Array.from(e.target.files) : [];
                    e.target.value = '';
                    if (!list.length) return;
                    setError('');
                    try {
                      await uploadFiles(list, category, link);
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}
                />
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">
                Folder Drive tim belum siap / belum terhubung. Buka <b>Pusat Data</b> untuk menyiapkannya.
              </p>
            )}
            {uploads.map((u) => (
              <div key={u.id} className="text-[11px]">
                <div className="flex justify-between gap-2 text-slate-600 dark:text-slate-300">
                  <span className="truncate">{u.name}</span>
                  {u.error ? (
                    <span className="text-rose-500">Gagal</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-slate-400">
                      <LoaderCircle className="w-3 h-3 animate-spin" />
                      {Math.round(u.ratio * 100)}%
                    </span>
                  )}
                </div>
                {u.error && <p className="text-rose-500">{u.error}</p>}
              </div>
            ))}
            {error && <p className="text-[11px] text-rose-500">{error}</p>}
          </div>
        </div>
      </div>

      {choosing && (
        <FileChooser
          title="Pilih file untuk ditautkan"
          excludeIds={linked.map((f) => f.id)}
          onClose={() => setChoosing(false)}
          onPick={async (f) => {
            setChoosing(false);
            try {
              await updateFile(f.id, { taskId: link.taskId, subtaskId: link.subtaskId });
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        />
      )}
    </div>,
    document.body
  );
};

/** Small paperclip button with the number of attached files. */
export const AttachButton: React.FC<{ count: number; onClick: () => void; compact?: boolean; title: string }> = ({
  count,
  onClick,
  compact = false,
  title,
}) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    title={title}
    className={`inline-flex items-center gap-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 ${
      count > 0 ? 'text-blue-500' : 'text-slate-400 hover:text-blue-600'
    } ${compact ? 'p-0.5 text-[10px]' : 'p-1 text-[11px]'}`}
  >
    <Paperclip className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
    {count > 0 && <span className="font-semibold">{count}</span>}
  </button>
);
