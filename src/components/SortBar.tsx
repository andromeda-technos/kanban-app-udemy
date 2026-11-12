import React from 'react';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, ArrowUpDown } from 'lucide-react';
import { useKanban } from '../context/KanbanContext';
import { SortOption } from '../types/kanban';
import { sortMetaOf } from '../utils/taskSort';

const QUICK: SortOption[] = ['custom', 'priority', 'dueDate', 'complexity'];

/** Quick sort switcher shown above the columns (the full list lives in the Filter drawer). */
export const SortBar: React.FC = () => {
  const { filters, setFilters } = useKanban();
  const active = filters.sortBy;
  const meta = sortMetaOf(active);
  // Title/created sorts are only picked from the drawer; still show them as the active chip
  const options = QUICK.includes(active) ? QUICK : [...QUICK, active];

  const pick = (value: SortOption) =>
    setFilters((prev) => ({ ...prev, sortBy: value, sortReverse: prev.sortBy === value ? prev.sortReverse : false }));

  return (
    <div className="flex flex-wrap items-center gap-2 min-w-0">
      <span className="hidden sm:flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
        <ArrowUpDown className="w-3.5 h-3.5" />
        Urutkan
      </span>
      <div className="flex w-full sm:w-auto items-center gap-1 p-1 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 backdrop-blur-sm overflow-x-auto no-scrollbar">
        {options.map((value) => {
          const isActive = value === active;
          return (
            <button
              key={value}
              type="button"
              onClick={() => pick(value)}
              aria-pressed={isActive}
              className={`flex-1 sm:flex-none shrink-0 px-2 sm:px-2.5 py-1 rounded-lg whitespace-nowrap text-[11px] font-semibold transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {sortMetaOf(value).label}
            </button>
          );
        })}
      </div>
      {active !== 'custom' && (
        <button
          type="button"
          onClick={() => setFilters((prev) => ({ ...prev, sortReverse: !prev.sortReverse }))}
          title="Balik arah urutan"
          className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 text-slate-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          {filters.sortReverse ? (
            <ArrowUpNarrowWide className="w-3.5 h-3.5" />
          ) : (
            <ArrowDownWideNarrow className="w-3.5 h-3.5" />
          )}
          <span className="whitespace-nowrap">{filters.sortReverse ? meta.reversed : meta.natural}</span>
        </button>
      )}
    </div>
  );
};
