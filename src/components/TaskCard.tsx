import React, { useRef, useState } from 'react';
import { SortableChecklist } from './SortableChecklist';
import { SubtaskNote } from './SubtaskNote';
import { MediaEditor, MediaView } from './TaskMedia';
import { useFiles } from '../context/FilesContext';
import { FileChip } from './datacenter/FileBits';
import { AttachButton, AttachFilesDialog } from './datacenter/TaskFiles';
import { Task } from '../types/kanban';
import { useKanban } from '../context/KanbanContext';
import {
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Clock,
  AlertCircle,
  Edit2,
  Trash2,
  ExternalLink,
  ImagePlus,
  ImageOff,
  Paperclip,
  CheckCircle2,
} from 'lucide-react';
import { getHostname, getLinkKind } from '../utils/links';
import { isDoneColumn } from '../utils/deadline';

const MAX_VISIBLE_LINKS = 3;

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  isFirstColumn: boolean;
  isLastColumn: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onEdit,
  isFirstColumn,
  isLastColumn,
}) => {
  const {
    deleteTask,
    quickMoveTask,
    toggleSubtask,
    reorderSubtasks,
    updateSubtaskNote,
    updateTaskMedia,
    moveTask,
    activeColumns,
  } = useKanban();
  const { enabled: filesEnabled, filesForTask } = useFiles();
  const taskFiles = filesEnabled ? filesForTask(task.id) : [];
  const taskLevelFiles = taskFiles.filter((f) => !f.subtaskId);
  const [attachTarget, setAttachTarget] = useState<{ title: string; subtaskId?: string } | null>(null);
  const [noteEditingId, setNoteEditingId] = useState<string | null>(null);
  const [editingMedia, setEditingMedia] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  // True while the pointer went down inside the checklist: that gesture reorders subtasks,
  // so the card itself must not start a (native) drag
  const pointerInChecklistRef = useRef(false);
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [showAllLinks, setShowAllLinks] = useState(false);
  const links = task.links ?? [];
  const visibleLinks = showAllLinks ? links : links.slice(0, MAX_VISIBLE_LINKS);

  // Drag handlers
  const handleDragStart = (e: React.DragEvent) => {
    if (pointerInChecklistRef.current) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('opacity-40', 'scale-95');
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('opacity-40', 'scale-95');
  };

  // Due Date status
  const getDueStatus = () => {
    if (!task.dueDate) return null;
    const todayStr = new Date().toISOString().split('T')[0];
    const dueDate = task.dueDate;

    if (dueDate < todayStr) {
      return { label: 'Terlambat', color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900', isOverdue: true };
    }
    if (dueDate === todayStr) {
      return { label: 'Hari Ini', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900', isOverdue: false };
    }
    return {
      label: new Date(dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      color: 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
      isOverdue: false,
    };
  };

  const dueStatus = getDueStatus();

  const currentColumn = activeColumns.find((c) => c.id === task.columnId);
  const isDone = !!currentColumn && isDoneColumn(currentColumn);
  const doneColumn = activeColumns.find(isDoneColumn);

  const handleMarkDone = () => {
    if (!doneColumn) return;
    moveTask(task.id, doneColumn.id, Number.MAX_SAFE_INTEGER);
  };

  // Priority badge config
  const priorityConfig = {
    urgent: {
      label: 'Mendesak',
      badge: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900',
      dot: 'bg-red-500',
    },
    high: {
      label: 'Tinggi',
      badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-900',
      dot: 'bg-orange-500',
    },
    medium: {
      label: 'Sedang',
      badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-900',
      dot: 'bg-sky-500',
    },
    low: {
      label: 'Rendah',
      badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900',
      dot: 'bg-emerald-500',
    },
  };

  const completedSubtasks = task.subtasks.filter((st) => st.completed).length;
  const totalSubtasks = task.subtasks.length;
  const subtaskProgress = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;

  return (
    <div
      draggable
      onPointerDownCapture={(e) => {
        pointerInChecklistRef.current = !!(e.target as HTMLElement).closest('[data-checklist]');
      }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      data-task-id={task.id}
      className="group relative bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing hover:border-blue-400/50 dark:hover:border-blue-500/40 select-none"
    >
      {/* Cover media: photo / GIF / looping video for some lofi vibes */}
      {task.media && (
        <MediaView
          variant="cover"
          media={task.media}
          title={task.title}
          className="-mx-4 -mt-4 mb-3"
          onReplace={() => setEditingMedia(true)}
          onRemove={() => updateTaskMedia(task.id, undefined)}
        />
      )}
      {editingMedia && (
        <div data-checklist className="mb-3">
          <MediaEditor
            onChange={(media) => updateTaskMedia(task.id, media)}
            onClose={() => setEditingMedia(false)}
          />
        </div>
      )}

      {/* Header row: Priority & Options */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
              priorityConfig[task.priority].badge
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${priorityConfig[task.priority].dot} animate-pulse`}
            />
            {priorityConfig[task.priority].label}
          </span>

          {dueStatus && !isDone && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${dueStatus.color}`}
            >
              {dueStatus.isOverdue ? (
                <AlertCircle className="w-3 h-3 text-rose-500" />
              ) : (
                <Clock className="w-3 h-3" />
              )}
              {dueStatus.label}
            </span>
          )}

          {task.dueDate && !isDone && doneColumn && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleMarkDone();
              }}
              title={`Tandai selesai (pindah ke ${doneColumn.title})`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
            >
              <CheckCircle2 className="w-3 h-3" />
              Tandai Selesai
            </button>
          )}

          {isDone && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900">
              <CheckCircle2 className="w-3 h-3" />
              Selesai
            </span>
          )}
        </div>

        {/* Menu Toggle */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-20 py-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onEdit(task);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                >
                  <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                  Edit Tugas
                </button>

                {/* Task cover media (photo / GIF / looping video) */}
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    setEditingMedia(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                >
                  <ImagePlus className="w-3.5 h-3.5 text-blue-500" />
                  {task.media ? 'Ganti Media' : 'Tambahkan Media'}
                </button>
                {task.media && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      updateTaskMedia(task.id, undefined);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                  >
                    <ImageOff className="w-3.5 h-3.5 text-slate-400" />
                    Hapus Media
                  </button>
                )}
                {filesEnabled && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      setAttachTarget({ title: `File · ${task.title}` });
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-blue-500" />
                    Lampirkan File
                    {taskFiles.length > 0 && <span className="ml-auto text-[10px] text-slate-400">{taskFiles.length}</span>}
                  </button>
                )}
                <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    if (confirm(`Yakin ingin menghapus tugas "${task.title}"?`)) {
                      deleteTask(task.id);
                    }
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Hapus Tugas
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Title */}
      <h4
        onClick={() => onEdit(task)}
        className={`font-semibold text-sm leading-snug hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer mb-1.5 transition-colors ${
          isDone
            ? 'line-through text-slate-400 dark:text-slate-500'
            : 'text-slate-800 dark:text-slate-100'
        }`}
      >
        {task.title}
      </h4>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Work files from Pusat Data linked to the task itself */}
      {taskLevelFiles.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 mb-3">
          {taskLevelFiles.slice(0, 4).map((f) => (
            <FileChip key={f.id} file={f} compact />
          ))}
          {taskLevelFiles.length > 4 && (
            <button
              type="button"
              onClick={() => setAttachTarget({ title: `File · ${task.title}` })}
              className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              +{taskLevelFiles.length - 4} file
            </button>
          )}
        </div>
      )}

      {/* Attached links (documents to review etc.) — open in a new tab */}
      {links.length > 0 && (
        <div className="flex flex-col gap-1 mb-3">
          {visibleLinks.map((link) => {
            const kind = getLinkKind(link.url);
            const KindIcon = kind.icon;
            return (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                draggable={false}
                onClick={(e) => e.stopPropagation()}
                title={`${kind.label}: ${link.url}`}
                className="group/link flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 hover:border-blue-400/60 hover:bg-blue-50/60 dark:hover:bg-blue-950/30 transition-colors"
              >
                <KindIcon className={`w-3.5 h-3.5 shrink-0 ${kind.className}`} />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate flex-1 group-hover/link:text-blue-600 dark:group-hover/link:text-blue-400">
                  {link.title}
                </span>
                {link.title !== getHostname(link.url) && (
                  <span className="text-[10px] text-slate-400 truncate max-w-[80px] shrink-0">
                    {getHostname(link.url)}
                  </span>
                )}
                <ExternalLink className="w-3 h-3 shrink-0 text-slate-400 group-hover/link:text-blue-500" />
              </a>
            );
          })}
          {links.length > MAX_VISIBLE_LINKS && (
            <button
              type="button"
              onClick={() => setShowAllLinks(!showAllLinks)}
              className="self-start text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline px-1"
            >
              {showAllLinks ? 'Tampilkan lebih sedikit' : `+${links.length - MAX_VISIBLE_LINKS} link lainnya`}
            </button>
          )}
        </div>
      )}

      {/* Subtasks Progress */}
      {totalSubtasks > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <button
              type="button"
              onClick={() => setShowSubtasks(!showSubtasks)}
              className="inline-flex items-center gap-1.5 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
            >
              <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
              <span>Subtugas ({completedSubtasks}/{totalSubtasks})</span>
            </button>
            <span className="text-[11px] font-semibold">{Math.round(subtaskProgress)}%</span>
          </div>

          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                subtaskProgress === 100
                  ? 'bg-emerald-500'
                  : subtaskProgress > 50
                  ? 'bg-blue-500'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${subtaskProgress}%` }}
            />
          </div>

          {/* Collapsible Subtasks Checklist */}
          {showSubtasks && (
            <div data-checklist className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <SortableChecklist
                compact
                items={task.subtasks}
                onReorder={(next) => reorderSubtasks(task.id, next)}
                className="space-y-1"
                renderItem={(st, handle, isDragging) => (
                  <div className={`group/strow px-1 py-0.5 rounded-md ${isDragging ? 'bg-white dark:bg-slate-800' : ''}`}>
                    <div className="flex items-center gap-1.5">
                      {handle}
                      <label className="flex items-center gap-2 flex-1 min-w-0 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={st.completed}
                          onChange={() => {
                            toggleSubtask(task.id, st.id);
                            // Just finished → offer a quick completion note
                            setNoteEditingId(st.completed ? null : st.id);
                          }}
                          className="w-3.5 h-3.5 shrink-0 rounded text-blue-600 border-slate-300 focus:ring-blue-500 focus:ring-1"
                        />
                        <span className={st.completed ? 'line-through text-slate-400 dark:text-slate-500' : ''}>
                          {st.title}
                        </span>
                      </label>
                      {filesEnabled && (
                        <AttachButton
                          compact
                          count={taskFiles.filter((f) => f.subtaskId === st.id).length}
                          title="Lampirkan file ke subtugas ini"
                          onClick={() => setAttachTarget({ title: `File · ${st.title}`, subtaskId: st.id })}
                        />
                      )}
                    </div>
                    {taskFiles.some((f) => f.subtaskId === st.id) && (
                      <div className="ml-9 mt-0.5 mb-0.5 flex flex-wrap gap-1">
                        {taskFiles
                          .filter((f) => f.subtaskId === st.id)
                          .map((f) => (
                            <FileChip key={f.id} file={f} compact />
                          ))}
                      </div>
                    )}
                    <SubtaskNote
                      compact
                      subtask={st}
                      editing={noteEditingId === st.id}
                      onEditingChange={(on) => setNoteEditingId(on ? st.id : null)}
                      onSave={(note) => updateSubtaskNote(task.id, st.id, note)}
                    />
                  </div>
                )}
              />
            </div>
          )}
        </div>
      )}

      {/* Footer: Assignee & Quick Move Controls */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
        {/* Assignee */}
        {task.assignees.length > 0 ? (
          <div
            className="flex items-center gap-2 min-w-0"
            title={`Ditugaskan ke: ${task.assignees.map((a) => a.name).join(', ')}`}
          >
            <div className="flex -space-x-2">
              {task.assignees.slice(0, 3).map((a) => (
                <div
                  key={a.id}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow-xs ring-2 ring-white dark:ring-slate-900"
                  style={{ backgroundColor: a.avatarColor }}
                >
                  {a.name.charAt(0).toUpperCase()}
                </div>
              ))}
              {task.assignees.length > 3 && (
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200 ring-2 ring-white dark:ring-slate-900">
                  +{task.assignees.length - 3}
                </div>
              )}
            </div>
            {task.assignees.length === 1 && (
              <span className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate max-w-[100px]">
                {task.assignees[0].name.split(' ')[0]}
              </span>
            )}
          </div>
        ) : (
          <span className="text-[11px] text-slate-400 dark:text-slate-500 italic">
            Belum ditugaskan
          </span>
        )}

        {/* Quick move buttons */}
        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
          {!isFirstColumn && (
            <button
              type="button"
              onClick={() => quickMoveTask(task.id, 'prev')}
              title="Pindahkan ke kolom sebelumnya"
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          {!isLastColumn && (
            <button
              type="button"
              onClick={() => quickMoveTask(task.id, 'next')}
              title="Pindahkan ke kolom berikutnya"
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {attachTarget && (
        <AttachFilesDialog
          title={attachTarget.title}
          link={{ taskId: task.id, subtaskId: attachTarget.subtaskId }}
          onClose={() => setAttachTarget(null)}
        />
      )}
    </div>
  );
};
