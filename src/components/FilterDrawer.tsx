import React from 'react';
import { useKanban } from '../context/KanbanContext';
import { Priority, SortOption } from '../types/kanban';
import { X, Filter, RotateCcw, ArrowUpDown } from 'lucide-react';

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FilterDrawer: React.FC<FilterDrawerProps> = ({ isOpen, onClose }) => {
  const { filters, setFilters, resetFilters, allTags, allAssignees } = useKanban();

  if (!isOpen) return null;

  const priorityList: { value: Priority; label: string }[] = [
    { value: 'urgent', label: 'Mendesak' },
    { value: 'high', label: 'Tinggi' },
    { value: 'medium', label: 'Sedang' },
    { value: 'low', label: 'Rendah' },
  ];

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'custom', label: 'Urutan Manual (Drag & Drop)' },
    { value: 'dueDate', label: 'Tenggat Waktu Terdekat' },
    { value: 'priority', label: 'Prioritas Tertinggi' },
    { value: 'title', label: 'Abjad Judul (A-Z)' },
    { value: 'createdAt', label: 'Tugas Terbaru Dibuat' },
  ];

  const togglePriority = (p: Priority) => {
    setFilters((prev) => ({
      ...prev,
      priorities: prev.priorities.includes(p)
        ? prev.priorities.filter((item) => item !== p)
        : [...prev.priorities, p],
    }));
  };

  const toggleTag = (tag: string) => {
    setFilters((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((item) => item !== tag)
        : [...prev.tags, tag],
    }));
  };

  const toggleAssignee = (userId: string) => {
    setFilters((prev) => ({
      ...prev,
      assignees: prev.assignees.includes(userId)
        ? prev.assignees.filter((item) => item !== userId)
        : [...prev.assignees, userId],
    }));
  };

  const isFiltered =
    filters.priorities.length > 0 ||
    filters.tags.length > 0 ||
    filters.assignees.length > 0 ||
    filters.dueFilter !== 'all' ||
    filters.sortBy !== 'custom';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Filter & Urutkan</h3>
          </div>
          <div className="flex items-center gap-2">
            {isFiltered && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600 font-medium"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
          {/* Sorting */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-blue-500" /> Urutkan Berdasarkan
            </label>
            <div className="space-y-1.5">
              {sortOptions.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2.5 p-2 rounded-xl text-xs font-medium cursor-pointer border transition-all ${
                    filters.sortBy === opt.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                      : 'border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <input
                    type="radio"
                    name="sortBy"
                    checked={filters.sortBy === opt.value}
                    onChange={() => setFilters((prev) => ({ ...prev, sortBy: opt.value }))}
                    className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Due date filter */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Status Tenggat Waktu
            </label>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {[
                { id: 'all', label: 'Semua Waktu' },
                { id: 'overdue', label: '⚠️ Terlambat' },
                { id: 'dueToday', label: '📅 Hari Ini' },
                { id: 'dueWeek', label: '🗓️ 7 Hari ke Depan' },
              ].map((df) => (
                <button
                  key={df.id}
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, dueFilter: df.id as any }))}
                  className={`p-2 rounded-xl border text-left font-medium transition-colors ${
                    filters.dueFilter === df.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                      : 'border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {df.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority filter */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Prioritas
            </label>
            <div className="flex flex-wrap gap-1.5">
              {priorityList.map((p) => {
                const isSelected = filters.priorities.includes(p.value);
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => togglePriority(p.value)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500 text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags filter */}
          {allTags.length > 0 && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Tag / Label
              </label>
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((tag) => {
                  const isSelected = filters.tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500 text-white'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      #{tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Assignees filter */}
          {allAssignees.length > 0 && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Penanggung Jawab
              </label>
              <div className="space-y-1.5">
                {allAssignees.map((user) => {
                  const isSelected = filters.assignees.includes(user.id);
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => toggleAssignee(user.id)}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-medium border transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                          : 'border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ backgroundColor: user.avatarColor }}
                        >
                          {user.name.charAt(0)}
                        </div>
                        <span>{user.name}</span>
                      </div>
                      {isSelected && <span className="text-blue-600 font-bold">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors"
          >
            Terapkan Filter
          </button>
        </div>
      </div>
    </div>
  );
};
