export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
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
  assignee?: Assignee;
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
  order: number;
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

export type SortOption = 'custom' | 'dueDate' | 'priority' | 'title' | 'createdAt';

export interface FilterState {
  search: string;
  priorities: Priority[];
  tags: string[];
  assignees: string[];
  dueFilter: 'all' | 'overdue' | 'dueToday' | 'dueWeek';
  sortBy: SortOption;
}
