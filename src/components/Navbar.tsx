import React, { useRef, useState } from 'react';
import { useKanban } from '../context/KanbanContext';
import {
  Kanban,
  Search,
  Filter,
  BarChart3,
  History,
  Moon,
  Sun,
  Download,
  Upload,
  Plus,
  ChevronDown,
  Layers,
  Trash2,
  Edit3,
  RotateCcw,
  HelpCircle,
} from 'lucide-react';

interface NavbarProps {
  onOpenNewTask: () => void;
  onOpenNewBoard: () => void;
  onEditBoard: () => void;
  onOpenFilters: () => void;
  onOpenAnalytics: () => void;
  onOpenLogs: () => void;
  onOpenShortcuts: () => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenNewTask,
  onOpenNewBoard,
  onEditBoard,
  onOpenFilters,
  onOpenAnalytics,
  onOpenLogs,
  onOpenShortcuts,
  searchInputRef,
}) => {
  const {
    boards,
    activeBoardId,
    activeBoard,
    setActiveBoardId,
    deleteBoard,
    filters,
    setFilters,
    theme,
    toggleTheme,
    exportData,
    importData,
    resetToDemoData,
  } = useKanban();

  const [boardDropdownOpen, setBoardDropdownOpen] = useState(false);
  const [menuDropdownOpen, setMenuDropdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeFilterCount =
    filters.priorities.length +
    filters.tags.length +
    filters.assignees.length +
    (filters.dueFilter !== 'all' ? 1 : 0) +
    (filters.sortBy !== 'custom' ? 1 : 0);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = importData(content);
      alert(res.message);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors">
      <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* Left: Brand & Board Switcher */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 font-black text-slate-800 dark:text-slate-100 text-lg tracking-tight">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Kanban className="w-5 h-5" />
            </div>
            <span className="hidden sm:inline bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
              KanbanFlow
            </span>
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

          {/* Board Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setBoardDropdownOpen(!boardDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
            >
              <Layers className="w-3.5 h-3.5 text-blue-500" />
              <span className="truncate max-w-[140px] sm:max-w-[200px]">
                {activeBoard?.title || 'Pilih Papan'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {boardDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setBoardDropdownOpen(false)}
                />
                <div className="absolute left-0 top-full mt-1.5 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-30 p-2 text-xs">
                  <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Daftar Papan Proyek
                  </div>
                  <div className="space-y-1 my-1 max-h-48 overflow-y-auto custom-scrollbar">
                    {boards.map((b) => (
                      <div
                        key={b.id}
                        className={`flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer ${
                          b.id === activeBoardId
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300'
                        }`}
                        onClick={() => {
                          setActiveBoardId(b.id);
                          setBoardDropdownOpen(false);
                        }}
                      >
                        <span className="truncate flex-1">{b.title}</span>
                        {b.id === activeBoardId && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBoardDropdownOpen(false);
                                onEditBoard();
                              }}
                              className="p-1 hover:text-blue-700"
                              title="Edit papan"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            {boards.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBoardDropdownOpen(false);
                                  if (confirm(`Hapus papan "${b.title}"?`)) {
                                    deleteBoard(b.id);
                                  }
                                }}
                                className="p-1 text-rose-500 hover:text-rose-700"
                                title="Hapus papan"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-700 pt-1 mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setBoardDropdownOpen(false);
                        onOpenNewBoard();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 font-semibold text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah Papan Baru
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 max-w-xs md:max-w-md hidden md:block">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder="Cari tugas, tag, deskripsi, atau orang... (Tekan /)"
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, search: '' }))}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Right: Quick Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Filter button */}
          <button
            type="button"
            onClick={onOpenFilters}
            className={`relative p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeFilterCount > 0
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                : 'border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
            title="Filter dan Pengurutan"
          >
            <Filter className="w-4 h-4" />
            <span className="hidden lg:inline">Filter</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Analytics button */}
          <button
            type="button"
            onClick={onOpenAnalytics}
            className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            title="Statistik Proyek"
          >
            <BarChart3 className="w-4 h-4" />
          </button>

          {/* Activity log button */}
          <button
            type="button"
            onClick={onOpenLogs}
            className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors hidden sm:flex"
            title="Riwayat Aktivitas"
          >
            <History className="w-4 h-4" />
          </button>

          {/* More Menu (Export, Import, Demo Data, Shortcuts) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuDropdownOpen(!menuDropdownOpen)}
              className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              title="Menu Tambahan"
            >
              <Download className="w-4 h-4" />
            </button>

            {menuDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setMenuDropdownOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-30 p-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuDropdownOpen(false);
                      exportData();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-500" />
                    Ekspor Data Cadangan (.json)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMenuDropdownOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-500" />
                    Impor Data Cadangan (.json)
                  </button>

                  <div className="border-t border-slate-100 dark:border-slate-700 my-1" />

                  <button
                    type="button"
                    onClick={() => {
                      setMenuDropdownOpen(false);
                      if (confirm('Pulihkan data contoh awal (demo data)? Data custom Anda akan digantikan.')) {
                        resetToDemoData();
                      }
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                    Muat Ulang Data Contoh
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMenuDropdownOpen(false);
                      onOpenShortcuts();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
                    Pintasan Keyboard
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Hidden file input for import */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".json,application/json"
            className="hidden"
          />

          {/* Theme Switcher */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            title={theme === 'dark' ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {/* Primary Action: New Task */}
          <button
            type="button"
            onClick={onOpenNewTask}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Tugas Baru</span>
          </button>
        </div>
      </div>
    </header>
  );
};
