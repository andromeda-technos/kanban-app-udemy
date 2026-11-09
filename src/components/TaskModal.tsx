import React, { useState, useEffect } from 'react';
import { Task, Priority, Subtask, Assignee } from '../types/kanban';
import { useKanban } from '../context/KanbanContext';
import {
  X,
  Plus,
  Trash2,
  Calendar,
  Tag as TagIcon,
  CheckSquare,
  User,
} from 'lucide-react';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: Task | null;
  defaultColumnId?: string;
}

const PRESET_TAGS = ['Frontend', 'Backend', 'UI/UX', 'Bug', 'Feature', 'DevOps', 'Security', 'Database', 'Mobile'];

const PRESET_ASSIGNEES: Assignee[] = [
  { id: 'u1', name: 'Rian Pratama', avatarColor: '#3b82f6' },
  { id: 'u2', name: 'Sarah Anindya', avatarColor: '#ec4899' },
  { id: 'u3', name: 'Dimas Kurnia', avatarColor: '#10b981' },
  { id: 'u4', name: 'Budi Santoso', avatarColor: '#8b5cf6' },
];

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  taskToEdit,
  defaultColumnId,
}) => {
  const { activeColumns, createTask, updateTask } = useKanban();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [columnId, setColumnId] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskInput, setNewSubtaskInput] = useState('');
  const [assignee, setAssignee] = useState<Assignee | undefined>(undefined);
  const [customAssigneeName, setCustomAssigneeName] = useState('');

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setDescription(taskToEdit.description || '');
      setColumnId(taskToEdit.columnId);
      setPriority(taskToEdit.priority);
      setDueDate(taskToEdit.dueDate || '');
      setTags(taskToEdit.tags || []);
      setSubtasks(taskToEdit.subtasks || []);
      setAssignee(taskToEdit.assignee);
    } else {
      setTitle('');
      setDescription('');
      setColumnId(defaultColumnId || activeColumns[0]?.id || '');
      setPriority('medium');
      setDueDate('');
      setTags([]);
      setSubtasks([]);
      setAssignee(PRESET_ASSIGNEES[0]);
    }
    setNewTagInput('');
    setNewSubtaskInput('');
    setCustomAssigneeName('');
  }, [taskToEdit, defaultColumnId, activeColumns, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

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
        assignee,
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
        assignee,
      });
    }

    onClose();
  };

  const handleAddTag = (tagToAdd: string) => {
    const trimmed = tagToAdd.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setNewTagInput('');
    }
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
    setSubtasks(
      subtasks.map((st) => (st.id === stId ? { ...st, completed: !st.completed } : st))
    );
  };

  const priorityOptions: { value: Priority; label: string; colorClass: string }[] = [
    { value: 'low', label: 'Rendah', colorClass: 'border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' },
    { value: 'medium', label: 'Sedang', colorClass: 'border-sky-500 text-sky-600 bg-sky-50 dark:bg-sky-950/40' },
    { value: 'high', label: 'Tinggi', colorClass: 'border-amber-500 text-orange-600 bg-amber-50 dark:bg-amber-950/40' },
    { value: 'urgent', label: 'Mendesak', colorClass: 'border-rose-500 text-rose-600 bg-rose-50 dark:bg-rose-950/40' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {taskToEdit ? 'Edit Tugas' : 'Buat Tugas Baru'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Judul Tugas <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Integrasi API Payment Gateway"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Column & Priority Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Column Selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Kolom
              </label>
              <select
                value={columnId}
                onChange={(e) => setColumnId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {activeColumns.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                Tenggat Waktu
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Priority selection pills */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Prioritas
            </label>
            <div className="grid grid-cols-4 gap-2">
              {priorityOptions.map((opt) => {
                const isSelected = priority === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPriority(opt.value)}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition-all ${
                      isSelected
                        ? `${opt.colorClass} ring-2 ring-blue-500/30`
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Deskripsi
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan detail tugas, requirements, atau referensi link..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Assignee */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-500" />
              Penanggung Jawab (Assignee)
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {PRESET_ASSIGNEES.map((user) => {
                const isSelected = assignee?.id === user.id;
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setAssignee(isSelected ? undefined : user)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ backgroundColor: user.avatarColor }}
                    >
                      {user.name.charAt(0)}
                    </div>
                    {user.name}
                  </button>
                );
              })}
            </div>
            {/* Custom Assignee Input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Atau masukkan nama orang lain..."
                value={customAssigneeName}
                onChange={(e) => setCustomAssigneeName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (customAssigneeName.trim()) {
                      const colors = ['#3b82f6', '#ec4899', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4'];
                      const randomColor = colors[Math.floor(Math.random() * colors.length)];
                      setAssignee({
                        id: `custom-${Date.now()}`,
                        name: customAssigneeName.trim(),
                        avatarColor: randomColor,
                      });
                      setCustomAssigneeName('');
                    }
                  }
                }}
                className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => {
                  if (customAssigneeName.trim()) {
                    const colors = ['#3b82f6', '#ec4899', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4'];
                    const randomColor = colors[Math.floor(Math.random() * colors.length)];
                    setAssignee({
                      id: `custom-${Date.now()}`,
                      name: customAssigneeName.trim(),
                      avatarColor: randomColor,
                    });
                    setCustomAssigneeName('');
                  }
                }}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-200"
              >
                Set
              </button>
            </div>
          </div>

          {/* Subtasks / Checklist */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
              Subtugas / Checklist ({subtasks.filter((s) => s.completed).length}/{subtasks.length})
            </label>

            {/* List */}
            <div className="space-y-1.5 mb-2">
              {subtasks.map((st) => (
                <div
                  key={st.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60"
                >
                  <label className="flex items-center gap-2 text-xs flex-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={st.completed}
                      onChange={() => handleToggleSubtask(st.id)}
                      className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                    />
                    <span
                      className={`text-slate-700 dark:text-slate-200 ${
                        st.completed ? 'line-through text-slate-400 dark:text-slate-500' : ''
                      }`}
                    >
                      {st.title}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleRemoveSubtask(st.id)}
                    className="text-slate-400 hover:text-rose-500 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add subtask input */}
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
                className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah
              </button>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <TagIcon className="w-3.5 h-3.5 text-blue-500" />
              Label / Tags
            </label>

            {/* Active tags */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-rose-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            {/* Preset tags quick add */}
            <div className="flex flex-wrap gap-1 mb-2">
              {PRESET_TAGS.filter((t) => !tags.includes(t)).map((preset) => (
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

            {/* Custom tag input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Atau buat tag baru..."
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag(newTagInput);
                  }
                }}
                className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => handleAddTag(newTagInput)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-200"
              >
                Tambah Tag
              </button>
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
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
    </div>
  );
};
