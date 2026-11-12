import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { DataFile, useFiles } from '../../context/FilesContext';
import { useKanban } from '../../context/KanbanContext';
import { DATA_CATEGORIES, categoryOf, drivePreviewUrl } from '../../utils/dataCenter';
import {
  ExternalLink,
  File,
  FileArchive,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  Film,
  Link2,
  Presentation,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
export const fileIconFor = (file: Pick<DataFile, 'mimeType' | 'name'>): { Icon: LucideIcon; color: string } => {
  const mime = file.mimeType ?? '';
  const name = file.name.toLowerCase();
  if (mime === 'text/uri-list') return { Icon: Link2, color: 'text-slate-500' };
  if (mime.startsWith('image/')) return { Icon: FileImage, color: 'text-pink-500' };
  if (mime.startsWith('video/')) return { Icon: Film, color: 'text-violet-500' };
  if (mime.includes('spreadsheet') || /\.(xlsx?|csv)$/.test(name)) return { Icon: FileSpreadsheet, color: 'text-emerald-500' };
  if (mime.includes('presentation') || /\.(pptx?|key)$/.test(name)) return { Icon: Presentation, color: 'text-amber-500' };
  if (/zip|rar|7z|tar|gzip/.test(mime) || /\.(zip|rar|7z|tar|gz|skill)$/.test(name)) return { Icon: FileArchive, color: 'text-orange-500' };
  if (/\.(js|ts|tsx|jsx|py|gs|html|css|json|sql|java|go|rb|php|sh)$/.test(name)) return { Icon: FileCode, color: 'text-cyan-500' };
  if (mime.includes('pdf') || mime.includes('document') || /\.(pdf|docx?|md|txt)$/.test(name)) return { Icon: FileText, color: 'text-blue-500' };
  return { Icon: File, color: 'text-slate-400' };
};

/** Close on Esc without also closing the modal behind (capture phase). */
const useEscape = (onClose: () => void) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
};

// ---------------------------------------------------------------------------
// Preview (Drive embed)
// ---------------------------------------------------------------------------
export const FilePreview: React.FC<{ file: DataFile; onClose: () => void }> = ({ file, onClose }) => {
  useEscape(onClose);
  const { Icon, color } = fileIconFor(file);
  return createPortal(
    <div className="fixed inset-0 z-[75] flex flex-col bg-slate-950/90 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex items-center gap-3 px-4 py-3 text-white border-b border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <Icon className={`w-5 h-5 shrink-0 ${color}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{file.name}</p>
          <p className="text-[11px] text-white/60">{categoryOf(file.category).label}</p>
        </div>
        {file.webViewLink && (
          <a
            href={file.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Buka di Drive</span>
          </a>
        )}
        <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-white/10" title="Tutup (Esc)">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 p-2 sm:p-6" onClick={(e) => e.stopPropagation()}>
        {file.driveFileId ? (
          <iframe
            title={file.name}
            src={drivePreviewUrl(file.driveFileId)}
            allow="autoplay"
            className="w-full h-full rounded-xl bg-white"
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-white/80 text-sm">
            <Link2 className="w-8 h-8" />
            Ini entri link, bukan file Drive.
            {file.webViewLink && (
              <a href={file.webViewLink} target="_blank" rel="noopener noreferrer" className="underline">
                {file.webViewLink}
              </a>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

// ---------------------------------------------------------------------------
// Compact chip (cards, task form)
// ---------------------------------------------------------------------------
export const FileChip: React.FC<{ file: DataFile; onRemove?: () => void; compact?: boolean }> = ({
  file,
  onRemove,
  compact = false,
}) => {
  const [preview, setPreview] = useState(false);
  const { Icon, color } = fileIconFor(file);
  return (
    <span
      className={`inline-flex items-center max-w-full rounded-lg border border-slate-200/80 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-800/60 overflow-hidden ${
        compact ? 'text-[10px]' : 'text-[11px]'
      }`}
    >
      <button
        type="button"
        draggable={false}
        onClick={(e) => {
          e.stopPropagation();
          if (file.driveFileId) setPreview(true);
          else if (file.webViewLink) window.open(file.webViewLink, '_blank', 'noopener');
        }}
        className="inline-flex items-center gap-1 min-w-0 px-1.5 py-0.5 font-medium text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400"
        title={`${categoryOf(file.category).label} · ${file.name}`}
      >
        <Icon className={`w-3 h-3 shrink-0 ${color}`} />
        <span className="truncate max-w-[140px]">{file.name}</span>
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="px-1 py-0.5 text-slate-400 hover:text-rose-500 border-l border-slate-200/80 dark:border-slate-700/70"
          title="Lepas tautan"
        >
          <X className="w-3 h-3" />
        </button>
      )}
      {preview && <FilePreview file={file} onClose={() => setPreview(false)} />}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Dialog shell
// ---------------------------------------------------------------------------
const Dialog: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({
  title,
  onClose,
  children,
}) => {
  useEscape(onClose);
  return createPortal(
    <div
      className="fixed inset-0 z-[72] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="sheet-panel w-full max-w-lg max-h-[85dvh] flex flex-col bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
};

const SearchBox: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string }> = ({
  value,
  onChange,
  placeholder,
}) => (
  <div className="relative">
    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
    <input
      autoFocus
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
);

// ---------------------------------------------------------------------------
// "Pilih dari Pusat Data"
// ---------------------------------------------------------------------------
/** Remembered while the page is open, so attaching several PRDs in a row stays on PRD. */
let lastChooserCategory = 'all';

export const FileChooser: React.FC<{
  title: string;
  excludeIds?: string[];
  onPick: (file: DataFile) => void;
  onClose: () => void;
}> = ({ title, excludeIds = [], onPick, onClose }) => {
  const { files } = useFiles();
  const [query, setQuery] = useState('');
  const [category, setCategoryState] = useState<string>(lastChooserCategory);
  const setCategory = (c: string) => {
    lastChooserCategory = c;
    setCategoryState(c);
  };
  const q = query.trim().toLowerCase();

  // Search applies first so the chip counts show how many matches each category has
  const searched = files.filter(
    (f) =>
      !excludeIds.includes(f.id) &&
      (!q || f.name.toLowerCase().includes(q) || categoryOf(f.category).label.toLowerCase().includes(q))
  );
  const counts: Record<string, number> = {};
  searched.forEach((f) => (counts[f.category] = (counts[f.category] ?? 0) + 1));
  const list = category === 'all' ? searched : searched.filter((f) => f.category === category);

  const chipBase =
    'shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors';
  const chipOn = 'bg-blue-600 border-blue-600 text-white';
  const chipOff =
    'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400';

  return (
    <Dialog title={title} onClose={onClose}>
      <div className="p-4 pb-2 space-y-2.5">
        <SearchBox value={query} onChange={setQuery} placeholder="Cari nama file atau kategori..." />
        <div className="flex gap-1.5 overflow-x-auto sm:flex-wrap no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 pb-0.5">
          <button
            type="button"
            onClick={() => setCategory('all')}
            className={`${chipBase} ${category === 'all' ? chipOn : chipOff}`}
          >
            Semua
            <span className={category === 'all' ? 'text-white/80' : 'text-slate-400'}>{searched.length}</span>
          </button>
          {DATA_CATEGORIES.map((c) => {
            const active = category === c.key;
            const n = counts[c.key] ?? 0;
            const CatIcon = c.icon;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                className={`${chipBase} ${active ? chipOn : chipOff} ${n === 0 && !active ? 'opacity-50' : ''}`}
              >
                <CatIcon className={`w-3 h-3 ${active ? 'text-white' : c.color}`} />
                {c.label}
                <span className={active ? 'text-white/80' : 'text-slate-400'}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>
      <ul className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-3">
        {list.length === 0 && (
          <li className="px-3 py-6 text-center text-xs text-slate-400">
            {category !== 'all' && searched.length > 0 ? (
              <>
                Tidak ada file di kategori <b>{categoryOf(category).label}</b>
                {q && ' yang cocok'}.{' '}
                <button type="button" onClick={() => setCategory('all')} className="text-blue-600 font-semibold hover:underline">
                  Lihat semua
                </button>
              </>
            ) : (
              'Tidak ada file.'
            )}
          </li>
        )}
        {list.map((f) => {
          const { Icon, color } = fileIconFor(f);
          const cat = categoryOf(f.category);
          return (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => onPick(f)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-blue-50 dark:hover:bg-blue-950/40"
              >
                <Icon className={`w-4 h-4 shrink-0 ${color}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{f.name}</span>
                  <span className="block text-[11px] text-slate-400">{cat.label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// "Tautkan ke tugas / subtugas"
// ---------------------------------------------------------------------------
export const TaskLinkChooser: React.FC<{
  current?: { taskId?: string; subtaskId?: string };
  onPick: (link: { taskId?: string; subtaskId?: string }) => void;
  onClose: () => void;
}> = ({ current, onPick, onClose }) => {
  const { tasks, columns, boards } = useKanban();
  const [query, setQuery] = useState('');
  const [taskId, setTaskId] = useState<string | undefined>(current?.taskId);
  const q = query.trim().toLowerCase();

  const options = useMemo(
    () =>
      tasks
        .filter((t) => !q || t.title.toLowerCase().includes(q))
        .map((t) => {
          const col = columns.find((c) => c.id === t.columnId);
          const board = boards.find((b) => b.id === col?.boardId);
          return { task: t, col, board };
        })
        .slice(0, 80),
    [tasks, columns, boards, q]
  );
  const selected = tasks.find((t) => t.id === taskId);

  return (
    <Dialog title="Tautkan ke tugas / subtugas" onClose={onClose}>
      {!selected ? (
        <>
          <div className="p-4 pb-2">
            <SearchBox value={query} onChange={setQuery} placeholder="Cari judul tugas..." />
          </div>
          <ul className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-3">
            {current?.taskId && (
              <li>
                <button
                  type="button"
                  onClick={() => onPick({ taskId: undefined, subtaskId: undefined })}
                  className="w-full px-3 py-2.5 rounded-xl text-left text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  Lepas dari tugas
                </button>
              </li>
            )}
            {options.map(({ task, col, board }) => (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => (task.subtasks.length > 0 ? setTaskId(task.id) : onPick({ taskId: task.id }))}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-blue-50 dark:hover:bg-blue-950/40"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: col?.color ?? '#94a3b8' }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{task.title}</span>
                    <span className="block text-[11px] text-slate-400 truncate">
                      {board?.title} · {col?.title}
                      {task.subtasks.length > 0 && ` · ${task.subtasks.length} subtugas`}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
          <button type="button" onClick={() => setTaskId(undefined)} className="text-xs font-semibold text-blue-600 hover:underline">
            ← Pilih tugas lain
          </button>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{selected.title}</p>
          <button
            type="button"
            onClick={() => onPick({ taskId: selected.id })}
            className="w-full px-3 py-2.5 rounded-xl border-2 border-blue-500 bg-blue-50/60 dark:bg-blue-950/30 text-left text-sm font-semibold text-blue-700 dark:text-blue-300"
          >
            Tautkan ke tugas ini (bukan subtugas tertentu)
          </button>
          <p className="pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Atau ke subtugas</p>
          {selected.subtasks.map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => onPick({ taskId: selected.id, subtaskId: st.id })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {st.completed ? '✓ ' : ''}
              {st.title}
            </button>
          ))}
        </div>
      )}
    </Dialog>
  );
};
