import { ComplexityFilter, Priority, SortOption, Task } from '../types/kanban';

export const PRIORITY_WEIGHT: Record<Priority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

export interface ComplexityLevel {
  key: Exclude<ComplexityFilter, 'all'>;
  label: string;
  hint: string;
  min: number;
  max: number;
}

/** Complexity = how many subtasks a task has been broken into. */
export const COMPLEXITY_LEVELS: ComplexityLevel[] = [
  { key: 'simple', label: 'Ringan', hint: '0–2 subtugas', min: 0, max: 2 },
  { key: 'medium', label: 'Sedang', hint: '3–5 subtugas', min: 3, max: 5 },
  { key: 'complex', label: 'Kompleks', hint: '6+ subtugas', min: 6, max: Infinity },
];

export const complexityLevelOf = (task: Task): ComplexityLevel => {
  const n = task.subtasks.length;
  return COMPLEXITY_LEVELS.find((l) => n >= l.min && n <= l.max) ?? COMPLEXITY_LEVELS[0];
};

export const matchesComplexity = (task: Task, filter: ComplexityFilter) =>
  filter === 'all' || complexityLevelOf(task).key === filter;

export interface SortMeta {
  value: SortOption;
  label: string;
  /** Wording for the natural direction and for the reversed one */
  natural: string;
  reversed: string;
}

export const SORT_OPTIONS: SortMeta[] = [
  { value: 'custom', label: 'Manual', natural: 'Urutan drag & drop', reversed: 'Urutan drag & drop' },
  { value: 'priority', label: 'Urgensi', natural: 'Paling mendesak dulu', reversed: 'Paling santai dulu' },
  { value: 'dueDate', label: 'Deadline', natural: 'Paling dekat dulu', reversed: 'Paling jauh dulu' },
  { value: 'complexity', label: 'Kompleksitas', natural: 'Paling kompleks dulu', reversed: 'Paling ringan dulu' },
  { value: 'title', label: 'Judul', natural: 'A → Z', reversed: 'Z → A' },
  { value: 'createdAt', label: 'Dibuat', natural: 'Terbaru dulu', reversed: 'Terlama dulu' },
];

export const sortMetaOf = (value: SortOption) => SORT_OPTIONS.find((o) => o.value === value) ?? SORT_OPTIONS[0];

// Each comparator returns its "natural" order (negative = a first)
const byPriority = (a: Task, b: Task) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
const byDue = (a: Task, b: Task) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
const byComplexity = (a: Task, b: Task) =>
  b.subtasks.length - a.subtasks.length ||
  // Same size → the one with more work left is "heavier"
  b.subtasks.filter((s) => !s.completed).length - a.subtasks.filter((s) => !s.completed).length;
const byCreated = (a: Task, b: Task) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
const byOrder = (a: Task, b: Task) => a.order - b.order;

/** Sort comparator; ties fall back to sensible secondary keys (always in natural direction). */
export const compareTasks = (sortBy: SortOption, reverse: boolean) => {
  const dir = reverse ? -1 : 1;
  return (a: Task, b: Task): number => {
    switch (sortBy) {
      case 'priority':
        return dir * byPriority(a, b) || (a.dueDate && b.dueDate ? byDue(a, b) : 0) || byOrder(a, b);
      case 'dueDate': {
        // Tasks without a deadline always go last, whichever direction
        if (!a.dueDate || !b.dueDate) return a.dueDate ? -1 : b.dueDate ? 1 : byPriority(a, b) || byOrder(a, b);
        return dir * byDue(a, b) || byPriority(a, b) || byOrder(a, b);
      }
      case 'complexity':
        return dir * byComplexity(a, b) || byPriority(a, b) || byOrder(a, b);
      case 'title':
        return dir * a.title.localeCompare(b.title, 'id');
      case 'createdAt':
        return dir * byCreated(a, b);
      default:
        return byOrder(a, b);
    }
  };
};
