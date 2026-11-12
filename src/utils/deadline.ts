import { Column, Task } from '../types/kanban';

/** Tasks due within this many days (today included) count as "near deadline". */
export const NEAR_DEADLINE_DAYS = 2;

export type DeadlineStatus = 'overdue' | 'near' | 'safe' | 'none';

/** Columns whose tasks are considered finished, so deadlines no longer matter. */
export const isDoneColumn = (column: Pick<Column, 'title'>): boolean => {
  const title = column.title.toLowerCase();
  return title.includes('done') || title.includes('selesai') || title.includes('shipped');
};

/** Whole days from today (local time) until the due date; negative means overdue. */
export const daysUntil = (dueDate: string): number => {
  const [y, m, d] = dueDate.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
};

export const getDeadlineStatus = (task: Pick<Task, 'dueDate'>): DeadlineStatus => {
  if (!task.dueDate) return 'none';
  const days = daysUntil(task.dueDate);
  if (days < 0) return 'overdue';
  if (days <= NEAR_DEADLINE_DAYS) return 'near';
  return 'safe';
};
