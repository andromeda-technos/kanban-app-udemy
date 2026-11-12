import React, { useState, useEffect } from 'react';
import {
  Task,
  Priority,
  Subtask,
  Assignee,
  TaskLink,
  MediaAttachment,
} from '../types/kanban';
import { useKanban } from '../context/KanbanContext';
import {
  X,
  Plus,
  Trash2,
  Calendar,
  Tag as TagIcon,
  CheckSquare,
  Users,
  Settings,
  Paperclip,
  ExternalLink,
  ImagePlus,
  Image as ImageIcon,
  Database,
  FileText,
  Flag,
  Link2,
  type LucideIcon,
} from 'lucide-react';
import { useFiles } from '../context/FilesContext';
import { FileChip } from './datacenter/FileBits';
import { AttachButton, AttachFilesDialog } from './datacenter/TaskFiles';
import { normalizeUrl, getHostname, getLinkKind } from '../utils/links';
import { SortableChecklist } from './SortableChecklist';
import { SubtaskNote } from './SubtaskNote';
import { MediaEditor, MediaView } from './TaskMedia';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: Task | null;
  defaultColumnId?: string;
  onOpenSettings?: (tab?: 'assignees' | 'tags') => void;
}

// ---------------------------------------------------------------------------
// Layout pieces
// ---------------------------------------------------------------------------
const TONES = {
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
  pink: 'bg-pink-50 text-pink-600 dark:bg-pink-950/50 dark:text-pink-400',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400',
  indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
} as const;

const Section: React.FC<{
  icon: LucideIcon;
  tone: keyof typeof TONES;
  title: string;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ icon: Icon, tone, title, meta, action, children }) => (
  <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm shadow-slate-200/40 dark:shadow-none">
    <header className="flex items-center gap-2.5 px-4 pt-3.5 pb-3">
      <span className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center ${TONES[tone]}`}>
        <Icon className="w-4 h-4" />
      </span>
      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h3>
      {meta !== undefined && meta !== null && (
        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 truncate">{meta}</span>
      )}
      {action && <div className="ml-auto shrink-0">{action}</div>}
    </header>
    <div className="px-4 pb-4 space-y-3">{children}</div>
  </section>
);

const GroupLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="px-1 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
    {children}
  </p>
);

const ManageButton: React.FC<{ onClick: () => void; title: string }> = ({ onClick, title }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
  >
    <Settings className="w-3.5 h-3.5" />
    Kelola
  </button>
);

const fieldLabel = 'block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5';
const inputCls =
  'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all';
const smallInputCls =
  'w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const dashedButtonCls =
  'w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:border-blue-400/60 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors';

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------
export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  taskToEdit,
  defaultColumnId,
  onOpenSettings,
}) => {
  const { activeColumns, createTask, updateTask, assignees, tagOptions, createTag } = useKanban();
  const { enabled: filesEnabled, filesForTask } = useFiles();
  const taskFiles = taskToEdit ? filesForTask(taskToEdit.id) : [];
  const [attachTarget, setAttachTarget] = useState<{ title: string; subtaskId?: string } | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [columnId, setColumnId] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [noteEditingId, setNoteEditingId] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaAttachment | undefined>(undefined);
  const [editingMedia, setEditingMedia] = useState(false);
  const [newSubtaskInput, setNewSubtaskInput] = useState('');
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [links, setLinks] = useState<TaskLink[]>([]);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [linkError, setLinkError] = useState('');

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setDescription(taskToEdit.description || '');
      setColumnId(taskToEdit.columnId);
      setPriority(taskToEdit.priority);
      setDueDate(taskToEdit.dueDate || '');
      setTags(taskToEdit.tags || []);
      setSubtasks(taskToEdit.subtasks || []);
      setSelectedAssigneeIds(taskToEdit.assignees.map((a) => a.id));
      setLinks(taskToEdit.links || []);
      setMedia(taskToEdit.media);
    } else {
      setTitle('');
      setDescription('');
      setColumnId(defaultColumnId || activeColumns[0]?.id || '');
      setPriority('medium');
      setDueDate('');
      setTags([]);
      setSubtasks([]);
      setSelectedAssigneeIds(assignees[0] ? [assignees[0].id] : []);
      setLinks([]);
      setMedia(undefined);
    }
    setEditingMedia(false);
    setNewLinkUrl('');
    setNewLinkTitle('');
    setLinkError('');
    setNewTagInput('');
    setNewSubtaskInput('');
  }, [taskToEdit, defaultColumnId, activeColumns, isOpen]);

  // A tag deleted in Global Settings while this modal is open is dropped from the selection too
  useEffect(() => {
    setTags((prev) => {
      const kept = prev.filter((t) => tagOptions.includes(t));
      return kept.length === prev.length ? prev : kept;
    });
  }, [tagOptions]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Use the latest directory entries (they may have been renamed or deleted in Global Settings meanwhile)
    const resolvedAssignees: Assignee[] = assignees.filter((a) => selectedAssigneeIds.includes(a.id));

    if (taskToEdit) {
      updateTask({
        ...taskToEdit,
        title: title.trim(),
        description: description.trim(),
        columnId,
        priority,
        dueDate: dueDate || undefined,
        tags,
        subtasks,
        assignees: resolvedAssignees,
        links,
        media,
      });
    } else {
      createTask({
        title: title.trim(),
        description: description.trim(),
        columnId: columnId || activeColumns[0]?.id || '',
        priority,
        dueDate: dueDate || undefined,
        tags,
        subtasks,
        assignees: resolvedAssignees,
        links,
        media,
      });
    }

    onClose();
  };

  const handleAddTag = (tagToAdd: string) => {
    const trimmed = tagToAdd.trim();
    if (!trimmed) return;
    // Reuse the existing spelling ("frontend" → "Frontend"); a brand-new tag is recorded in the directory
    const existing = tagOptions.find((t) => t.toLowerCase() === trimmed.toLowerCase());
    const label = existing ?? trimmed;
    if (!existing) createTag(label);
    if (!tags.includes(label)) setTags([...tags, label]);
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleAddSubtask = () => {
    const trimmed = newSubtaskInput.trim();
    if (trimmed) {
      setSubtasks([
        ...subtasks,
        { id: `st-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, title: trimmed, completed: false },
      ]);
      setNewSubtaskInput('');
    }
  };

  const handleRemoveSubtask = (stId: string) => {
    setSubtasks(subtasks.filter((st) => st.id !== stId));
  };

  const handleToggleSubtask = (stId: string) => {
    const target = subtasks.find((st) => st.id === stId);
    setSubtasks(
      subtasks.map((st) =>
        st.id === stId
          ? {
              ...st,
              completed: !st.completed,
              completedAt: !st.completed ? new Date().toISOString() : st.completedAt,
            }
          : st
      )
    );
    // Just finished → offer a quick completion note
    setNoteEditingId(target && !target.completed ? stId : null);
  };

  const handleSubtaskNote = (stId: string, note: string) => {
    setSubtasks((prev) => prev.map((st) => (st.id === stId ? { ...st, note: note || undefined } : st)));
  };

  const handleAddLink = () => {
    const url = normalizeUrl(newLinkUrl);
    if (!url) {
      setLinkError('URL tidak valid. Contoh: https://docs.google.com/document/d/...');
      return;
    }
    if (links.some((l) => l.url === url)) {
      setLinkError('Link ini sudah ditambahkan.');
      return;
    }
    setLinks([
      ...links,
      {
        id: `link-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: newLinkTitle.trim() || getHostname(url),
        url,
      },
    ]);
    setNewLinkUrl('');
    setNewLinkTitle('');
    setLinkError('');
  };

  const handleRemoveLink = (linkId: string) => {
    setLinks(links.filter((l) => l.id !== linkId));
  };

  const priorityOptions: { value: Priority; label: string; dot: string; colorClass: string }[] = [
    { value: 'low', label: 'Rendah', dot: 'bg-emerald-500', colorClass: 'border-emerald-500 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40' },
    { value: 'medium', label: 'Sedang', dot: 'bg-sky-500', colorClass: 'border-sky-500 text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40' },
    { value: 'high', label: 'Tinggi', dot: 'bg-amber-500', colorClass: 'border-amber-500 text-orange-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40' },
    { value: 'urgent', label: 'Mendesak', dot: 'bg-rose-500', colorClass: 'border-rose-500 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40' },
  ];

  const doneCount = subtasks.filter((s) => s.completed).length;
  const progress = subtasks.length ? Math.round((doneCount / subtasks.length) * 100) : 0;
  const unusedTags = tagOptions.filter((t) => !tags.includes(t));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] bg-slate-50 dark:bg-slate-950 sheet-panel rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
              {taskToEdit ? 'Edit Tugas' : 'Buat Tugas Baru'}
            </h2>
            {taskToEdit && (
              <p className="text-[11px] text-slate-400 truncate">{taskToEdit.title}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Tutup (Esc)"
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          {/* Scrollable body */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 sm:p-5 space-y-3">
            <GroupLabel>Informasi Utama</GroupLabel>

            {/* Title + description */}
            <Section icon={FileText} tone="blue" title="Detail Tugas">
              <div>
                <label className={fieldLabel}>
                  Judul <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Integrasi API Payment Gateway"
                  className={`${inputCls} font-semibold`}
                />
              </div>
              <div>
                <label className={fieldLabel}>Deskripsi</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Jelaskan detail tugas, requirements, atau catatan penting..."
                  className={`${inputCls} resize-y min-h-[80px]`}
                />
              </div>
            </Section>

            {/* Column, due date, priority */}
            <Section icon={Flag} tone="amber" title="Status & Jadwal">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={fieldLabel}>Kolom</label>
                  <select value={columnId} onChange={(e) => setColumnId(e.target.value)} className={inputCls}>
                    {activeColumns.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`${fieldLabel} flex items-center gap-1`}>
                    <Calendar className="w-3 h-3" />
                    Tenggat Waktu
                  </label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={fieldLabel}>Prioritas</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {priorityOptions.map((opt) => {
                    const isSelected = priority === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPriority(opt.value)}
                        className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-bold border transition-all ${
                          isSelected
                            ? `${opt.colorClass} ring-2 ring-blue-500/20`
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${opt.dot}`} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Section>

            <GroupLabel>Pengerjaan</GroupLabel>

            {/* Assignees */}
            <Section
              icon={Users}
              tone="violet"
              title="Penanggung Jawab"
              meta={selectedAssigneeIds.length > 0 ? `${selectedAssigneeIds.length} dipilih` : undefined}
              action={onOpenSettings && <ManageButton onClick={() => onOpenSettings('assignees')} title="Tambah atau edit assignee di Global Settings" />}
            >
              <div className="flex flex-wrap gap-2">
                {assignees.map((user) => {
                  const isSelected = selectedAssigneeIds.includes(user.id);
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() =>
                        setSelectedAssigneeIds((prev) =>
                          isSelected ? prev.filter((id) => id !== user.id) : [...prev, user.id]
                        )
                      }
                      className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-full text-xs font-medium border transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ backgroundColor: user.avatarColor }}
                      >
                        {user.name.charAt(0)}
                      </span>
                      {user.name}
                    </button>
                  );
                })}
                {assignees.length === 0 && <span className="text-xs text-slate-400">Belum ada assignee terdaftar.</span>}
              </div>
            </Section>

            {/* Subtasks */}
            <Section
              icon={CheckSquare}
              tone="emerald"
              title="Subtugas"
              meta={subtasks.length > 0 ? `${doneCount}/${subtasks.length} selesai` : undefined}
            >
              {subtasks.length > 0 && (
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}

              <SortableChecklist
                items={subtasks}
                onReorder={setSubtasks}
                className="space-y-1.5"
                renderItem={(st, handle, isDragging) => (
                  <div
                    className={`group/strow p-2 rounded-xl border ${
                      isDragging
                        ? 'bg-white dark:bg-slate-800 border-blue-300 dark:border-blue-700 shadow-lg'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-700/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {handle}
                      <label className="flex items-center gap-2 text-xs flex-1 min-w-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={st.completed}
                          onChange={() => handleToggleSubtask(st.id)}
                          className="w-4 h-4 shrink-0 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                        />
                        <span
                          className={`text-slate-700 dark:text-slate-200 break-words ${
                            st.completed ? 'line-through text-slate-400 dark:text-slate-500' : ''
                          }`}
                        >
                          {st.title}
                        </span>
                      </label>
                      {taskToEdit && filesEnabled && (
                        <AttachButton
                          count={taskFiles.filter((f) => f.subtaskId === st.id).length}
                          title="Lampirkan file ke subtugas ini"
                          onClick={() => setAttachTarget({ title: `File · ${st.title}`, subtaskId: st.id })}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveSubtask(st.id)}
                        title="Hapus subtugas"
                        className="text-slate-400 hover:text-rose-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {taskFiles.some((f) => f.subtaskId === st.id) && (
                      <div className="mt-1.5 ml-[46px] flex flex-wrap gap-1">
                        {taskFiles
                          .filter((f) => f.subtaskId === st.id)
                          .map((f) => (
                            <FileChip key={f.id} file={f} compact />
                          ))}
                      </div>
                    )}
                    <SubtaskNote
                      subtask={st}
                      editing={noteEditingId === st.id}
                      onEditingChange={(on) => setNoteEditingId(on ? st.id : null)}
                      onSave={(note) => handleSubtaskNote(st.id, note)}
                    />
                  </div>
                )}
              />

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ketik subtugas & tekan Enter..."
                  value={newSubtaskInput}
                  onChange={(e) => setNewSubtaskInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSubtask();
                    }
                  }}
                  className={`${smallInputCls} flex-1`}
                />
                <button
                  type="button"
                  onClick={handleAddSubtask}
                  disabled={!newSubtaskInput.trim()}
                  className="shrink-0 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah
                </button>
              </div>
            </Section>

            {/* Tags */}
            <Section
              icon={TagIcon}
              tone="sky"
              title="Label"
              meta={tags.length > 0 ? `${tags.length} dipakai` : undefined}
              action={onOpenSettings && <ManageButton onClick={() => onOpenSettings('tags')} title="Ubah nama / hapus tag di Global Settings" />}
            >
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900"
                    >
                      #{tag}
                      <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-rose-500" title="Lepas tag">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {unusedTags.length > 0 && (
                <div>
                  <p className="text-[11px] text-slate-400 mb-1.5">Pilih cepat</p>
                  <div className="flex flex-wrap gap-1">
                    {unusedTags.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleAddTag(preset)}
                        className="px-2 py-0.5 rounded-md text-[11px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Buat tag baru..."
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag(newTagInput);
                    }
                  }}
                  className={`${smallInputCls} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => handleAddTag(newTagInput)}
                  disabled={!newTagInput.trim()}
                  className="shrink-0 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-200"
                >
                  Tambah Tag
                </button>
              </div>
            </Section>

            <GroupLabel>Lampiran</GroupLabel>

            {/* Cover media */}
            <Section icon={ImageIcon} tone="pink" title="Media Sampul" meta="foto, GIF, atau video looping">
              {media && !editingMedia && (
                <MediaView
                  media={media}
                  title={title || 'Media sampul'}
                  onReplace={() => setEditingMedia(true)}
                  onRemove={() => setMedia(undefined)}
                />
              )}
              {editingMedia ? (
                <MediaEditor onChange={setMedia} onClose={() => setEditingMedia(false)} />
              ) : (
                !media && (
                  <button type="button" onClick={() => setEditingMedia(true)} className={dashedButtonCls}>
                    <ImagePlus className="w-4 h-4" />
                    Tambahkan Media
                  </button>
                )
              )}
            </Section>

            {/* Links */}
            <Section
              icon={Link2}
              tone="indigo"
              title="Link Dokumen"
              meta={links.length > 0 ? `${links.length} link` : 'dokumen untuk direview'}
            >
              {links.length > 0 && (
                <div className="space-y-1.5">
                  {links.map((link) => {
                    const kind = getLinkKind(link.url);
                    const KindIcon = kind.icon;
                    return (
                      <div
                        key={link.id}
                        className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60"
                      >
                        <div className="w-7 h-7 shrink-0 rounded-md bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center">
                          <KindIcon className={`w-3.5 h-3.5 ${kind.className}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{link.title}</p>
                          <p className="text-[11px] text-slate-400 truncate">{link.url}</p>
                        </div>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Buka link di tab baru"
                          className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleRemoveLink(link.id)}
                          title="Hapus link"
                          className="p-1 text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                <input
                  type="text"
                  inputMode="url"
                  placeholder="Tempel URL dokumen..."
                  value={newLinkUrl}
                  onChange={(e) => {
                    setNewLinkUrl(e.target.value);
                    if (linkError) setLinkError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddLink();
                    }
                  }}
                  className={`${smallInputCls} ${linkError ? '!border-rose-400 dark:!border-rose-700' : ''}`}
                />
                <input
                  type="text"
                  placeholder="Nama (opsional), mis: Draft PRD v2"
                  value={newLinkTitle}
                  onChange={(e) => setNewLinkTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddLink();
                    }
                  }}
                  className={smallInputCls}
                />
                <button
                  type="button"
                  onClick={handleAddLink}
                  disabled={!newLinkUrl.trim()}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah
                </button>
              </div>
              {linkError && <p className="text-[11px] text-rose-500">{linkError}</p>}
            </Section>

            {/* Work files from Pusat Data (Google Drive) */}
            {filesEnabled && (
              <Section
                icon={Database}
                tone="slate"
                title="File Pusat Data"
                meta={taskFiles.length > 0 ? `${taskFiles.length} file` : 'Google Drive tim'}
              >
                {taskToEdit ? (
                  <>
                    {taskFiles.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {taskFiles.map((f) => (
                          <span key={f.id} className="inline-flex items-center gap-1 max-w-full">
                            <FileChip file={f} />
                            {f.subtaskId && (
                              <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                                › {subtasks.find((s) => s.id === f.subtaskId)?.title ?? 'subtugas'}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setAttachTarget({ title: `File · ${taskToEdit.title}` })}
                      className={dashedButtonCls}
                    >
                      <Paperclip className="w-4 h-4" />
                      Lampirkan file (unggah / pilih dari Pusat Data)
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-slate-400 rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5">
                    Simpan tugas dulu, lalu buka lagi untuk melampirkan file.
                  </p>
                )}
              </Section>
            )}
          </div>

          {/* Pinned footer */}
          <div className="shrink-0 flex items-center justify-end gap-3 px-4 sm:px-6 py-3 border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
            <span className="mr-auto hidden sm:inline text-[11px] text-slate-400">Esc untuk menutup</span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all"
            >
              {taskToEdit ? 'Simpan Perubahan' : 'Buat Tugas'}
            </button>
          </div>
        </form>
      </div>

      {attachTarget && taskToEdit && (
        <AttachFilesDialog
          title={attachTarget.title}
          link={{ taskId: taskToEdit.id, subtaskId: attachTarget.subtaskId }}
          onClose={() => setAttachTarget(null)}
        />
      )}
    </div>
  );
};
