import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'N', desc: 'Buka modal untuk membuat tugas baru' },
    { key: '/', desc: 'Fokus ke kolom pencarian tugas' },
    { key: 'Esc', desc: 'Tutup modal atau drawer yang sedang aktif' },
    { key: 'Drag', desc: 'Geser kartu tugas antar kolom atau urutkan ulang' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 sheet-panel rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-y-auto sm:overflow-hidden max-h-[92dvh] sm:max-h-none">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Pintasan Keyboard
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          {shortcuts.map((sc) => (
            <div
              key={sc.key}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs"
            >
              <span className="text-slate-600 dark:text-slate-300 font-medium">{sc.desc}</span>
              <kbd className="px-2.5 py-1 font-mono font-bold text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xs text-slate-800 dark:text-slate-100">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
