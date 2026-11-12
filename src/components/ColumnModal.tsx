import React, { useState, useEffect } from 'react';
import { Column } from '../types/kanban';
import { useKanban } from '../context/KanbanContext';
import { X } from 'lucide-react';

interface ColumnModalProps {
  isOpen: boolean;
  onClose: () => void;
  columnToEdit?: Column | null;
}

const COLOR_PRESETS = [
  '#3b82f6', // Blue
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f43f5e', // Rose
  '#64748b', // Slate
];

export const ColumnModal: React.FC<ColumnModalProps> = ({
  isOpen,
  onClose,
  columnToEdit,
}) => {
  const { createColumn, updateColumn } = useKanban();

  const [title, setTitle] = useState('');
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [wipLimit, setWipLimit] = useState<number | ''>('');

  useEffect(() => {
    if (columnToEdit) {
      setTitle(columnToEdit.title);
      setColor(columnToEdit.color || COLOR_PRESETS[0]);
      setWipLimit(columnToEdit.wipLimit || '');
    } else {
      setTitle('');
      setColor(COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)]);
      setWipLimit('');
    }
  }, [columnToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const limitNum = typeof wipLimit === 'number' && wipLimit > 0 ? wipLimit : undefined;

    if (columnToEdit) {
      updateColumn(columnToEdit.id, title.trim(), color, limitNum);
    } else {
      createColumn(title.trim(), color, limitNum);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 sheet-panel rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-y-auto sm:overflow-hidden max-h-[92dvh] sm:max-h-none">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
            {columnToEdit ? 'Edit Kolom' : 'Tambah Kolom Baru'}
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Nama Kolom <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Quality Assurance"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Warna Aksen
            </label>
            <div className="flex items-center gap-2.5">
              {COLOR_PRESETS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setColor(hex)}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    color === hex ? 'scale-125 ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              WIP Limit (Batas Tugas Berjalan)
            </label>
            <input
              type="number"
              min="0"
              placeholder="Kosongkan jika tidak ada batas"
              value={wipLimit}
              onChange={(e) => setWipLimit(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Peringatan visual akan muncul jika tugas di kolom ini melebihi angka limit.
            </p>
          </div>

          {/* Footer */}
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
              {columnToEdit ? 'Simpan Perubahan' : 'Buat Kolom'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
