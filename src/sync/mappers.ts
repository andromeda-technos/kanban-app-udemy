import { ActivityLog, Assignee, Board, Column, Task, TokenTimer } from '../types/kanban';

/**
 * Converters between the app's objects (camelCase) and Supabase rows (snake_case).
 * `toRow(fromRow(row))` must be stable so the diff-based sync never sees phantom changes.
 */

type Row = Record<string, unknown>;

export interface TableSpec<T> {
  table: string;
  key: string; // primary key column
  keyOf: (item: T) => string;
  toRow: (item: T) => Row;
  fromRow: (row: Row) => T;
}

const str = (v: unknown) => (v == null ? undefined : String(v));
const num = (v: unknown) => (v == null ? undefined : Number(v));

export const boardSpec: TableSpec<Board> = {
  table: 'boards',
  key: 'id',
  keyOf: (b) => b.id,
  toRow: (b) => ({ id: b.id, title: b.title, description: b.description ?? null, created_at: b.createdAt }),
  fromRow: (r) => ({
    id: String(r.id),
    title: String(r.title),
    description: str(r.description),
    createdAt: String(r.created_at),
  }),
};

export const columnSpec: TableSpec<Column> = {
  table: 'columns',
  key: 'id',
  keyOf: (c) => c.id,
  toRow: (c) => ({
    id: c.id,
    board_id: c.boardId,
    title: c.title,
    color: c.color ?? null,
    wip_limit: c.wipLimit ?? null,
    notes: c.notes ?? [],
    sort_order: c.order,
  }),
  fromRow: (r) => ({
    id: String(r.id),
    boardId: String(r.board_id),
    title: String(r.title),
    color: String(r.color ?? '#3b82f6'),
    wipLimit: num(r.wip_limit),
    notes: (r.notes as Column['notes']) ?? [],
    order: Number(r.sort_order ?? 0),
  }),
};

export const taskSpec: TableSpec<Task> = {
  table: 'tasks',
  key: 'id',
  keyOf: (t) => t.id,
  toRow: (t) => ({
    id: t.id,
    column_id: t.columnId,
    title: t.title,
    description: t.description ?? '',
    priority: t.priority,
    due_date: t.dueDate ?? null,
    tags: t.tags ?? [],
    subtasks: t.subtasks ?? [],
    assignees: t.assignees ?? [],
    links: t.links ?? [],
    media: t.media ?? null,
    sort_order: t.order,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  }),
  fromRow: (r) => ({
    id: String(r.id),
    columnId: String(r.column_id),
    title: String(r.title),
    description: String(r.description ?? ''),
    priority: (r.priority as Task['priority']) ?? 'medium',
    dueDate: str(r.due_date),
    tags: (r.tags as string[]) ?? [],
    subtasks: (r.subtasks as Task['subtasks']) ?? [],
    assignees: (r.assignees as Task['assignees']) ?? [],
    links: (r.links as Task['links']) ?? [],
    media: (r.media as Task['media']) ?? undefined,
    order: Number(r.sort_order ?? 0),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }),
};

export const assigneeSpec: TableSpec<Assignee> = {
  table: 'assignees',
  key: 'id',
  keyOf: (a) => a.id,
  toRow: (a) => ({ id: a.id, name: a.name, avatar_color: a.avatarColor }),
  fromRow: (r) => ({ id: String(r.id), name: String(r.name), avatarColor: String(r.avatar_color) }),
};

export const tagSpec: TableSpec<string> = {
  table: 'tags',
  key: 'label',
  keyOf: (t) => t,
  toRow: (t) => ({ label: t }),
  fromRow: (r) => String(r.label),
};

export const timerSpec: TableSpec<TokenTimer> = {
  table: 'token_timers',
  key: 'id',
  keyOf: (t) => t.id,
  toRow: (t) => ({
    id: t.id,
    assignee_id: t.assigneeId,
    label: t.label,
    reset_at: t.resetAt,
    duration_minutes: t.durationMinutes ?? null,
    remind_before_minutes: t.remindBeforeMinutes ?? null,
    notified_before: !!t.notifiedBefore,
    notified_ready: !!t.notifiedReady,
    created_at: t.createdAt,
  }),
  fromRow: (r) => ({
    id: String(r.id),
    assigneeId: String(r.assignee_id),
    label: String(r.label),
    resetAt: new Date(String(r.reset_at)).toISOString(),
    durationMinutes: num(r.duration_minutes),
    remindBeforeMinutes: num(r.remind_before_minutes),
    notifiedBefore: Boolean(r.notified_before),
    notifiedReady: Boolean(r.notified_ready),
    createdAt: String(r.created_at),
  }),
};

export const logSpec: TableSpec<ActivityLog> = {
  table: 'activity_logs',
  key: 'id',
  keyOf: (l) => l.id,
  toRow: (l) => ({ id: l.id, created_at: l.timestamp, action: l.action, details: l.details }),
  fromRow: (r) => ({
    id: String(r.id),
    timestamp: String(r.created_at),
    action: r.action as ActivityLog['action'],
    details: String(r.details),
  }),
};

/** JSON with sorted keys: Postgres jsonb reorders keys, which must not count as a change. */
export const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(',')}}`;
};
