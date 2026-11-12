export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: string; // when it was last checked off
  note?: string; // short completion note, shown under the subtask once it's done
}

/** Cover visual of a task (photo / GIF / looping video): a web URL or a file uploaded into IndexedDB. */
export interface MediaAttachment {
  kind: 'image' | 'video';
  url?: string; // external link
  fileId?: string; // key in the IndexedDB media store (uploaded file, local-only mode)
  storagePath?: string; // path in the Supabase Storage "covers" bucket (cloud mode)
  name?: string; // original file name, for display
}

/** External reference attached to a task, e.g. a document that needs review. */
export interface TaskLink {
  id: string;
  title: string;
  url: string;
}

export interface Tag {
  id: string;
  label: string;
  color: string; // Tailwind color class or hex
}

export interface Assignee {
  id: string;
  name: string;
  avatarColor: string;
}

export interface Task {
  id: string;
  columnId: string;
  title: string;
  description: string;
  priority: Priority;
  dueDate?: string; // YYYY-MM-DD
  tags: string[]; // tag labels
  subtasks: Subtask[];
  assignees: Assignee[];
  links?: TaskLink[];
  media?: MediaAttachment; // cover shown on the card
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Column {
  id: string;
  boardId: string;
  title: string;
  color: string; // Header accent color
  wipLimit?: number; // Work In Progress limit
  notes?: ColumnNote[]; // Important notes pinned at the top of the column
  order: number;
}

export interface ColumnNote {
  id: string;
  text: string;
  taskIds?: string[]; // Related tasks linked from this note
  createdAt: string;
  updatedAt?: string;
}

/** Countdown until an assignee's AI token / usage limit refreshes. */
export interface TokenTimer {
  id: string;
  assigneeId: string;
  label: string; // e.g. "Claude", "ChatGPT"
  resetAt: string; // ISO time the tokens become usable again
  durationMinutes?: number; // last duration used, for a quick restart
  remindBeforeMinutes?: number; // optional heads-up before resetAt (0 = off)
  notifiedBefore?: boolean;
  notifiedReady?: boolean;
  createdAt: string;
}

export interface Board {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  action: 'create_task' | 'update_task' | 'delete_task' | 'move_task' | 'create_column' | 'delete_column';
  details: string;
}

export type SortOption = 'custom' | 'dueDate' | 'priority' | 'complexity' | 'title' | 'createdAt';

/** Task size by number of subtasks: Ringan 0–2, Sedang 3–5, Kompleks 6+. */
export type ComplexityFilter = 'all' | 'simple' | 'medium' | 'complex';

export interface FilterState {
  search: string;
  priorities: Priority[];
  tags: string[];
  assignees: string[];
  dueFilter: 'all' | 'overdue' | 'dueToday' | 'dueWeek';
  sortBy: SortOption;
  /** false = the option's natural direction (most urgent / nearest / most complex first) */
  sortReverse: boolean;
  complexity: ComplexityFilter;
}
