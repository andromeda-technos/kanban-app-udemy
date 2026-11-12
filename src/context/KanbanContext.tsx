import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  Board,
  Column,
  ColumnNote,
  Subtask,
  MediaAttachment,
  Task,
  ActivityLog,
  FilterState,
  Assignee,
  TokenTimer,
} from '../types/kanban';
import {
  INITIAL_BOARDS,
  INITIAL_COLUMNS,
  INITIAL_TASKS,
  INITIAL_LOGS,
  INITIAL_ASSIGNEES,
  STORAGE_KEYS,
  DEFAULT_TAGS,
  mergeTaskTags,
  loadFromStorage,
  normalizeTasks,
  saveToStorage,
  DEFAULT_FILTER_STATE,
} from '../utils/storage';
import { triggerConfetti } from '../utils/confetti';
import { compareTasks, matchesComplexity } from '../utils/taskSort';
import { cleanupOrphanMedia } from '../utils/mediaStore';
import { useAuth } from './AuthContext';
import { SyncState, useSupabaseSync } from '../sync/useSupabaseSync';
import {
  assigneeSpec,
  boardSpec,
  columnSpec,
  logSpec,
  tagSpec,
  taskSpec,
  timerSpec,
} from '../sync/mappers';
import { isDoneColumn } from '../utils/deadline';

interface KanbanContextType {
  boards: Board[];
  activeBoardId: string;
  activeBoard?: Board;
  setActiveBoardId: (id: string) => void;
  createBoard: (title: string, description?: string) => string;
  updateBoard: (id: string, title: string, description?: string) => void;
  deleteBoard: (id: string) => void;

  columns: Column[];
  activeColumns: Column[];
  createColumn: (title: string, color: string, wipLimit?: number) => void;
  updateColumn: (id: string, title: string, color: string, wipLimit?: number) => void;
  deleteColumn: (id: string) => void;
  moveColumnOrder: (columnId: string, direction: 'left' | 'right') => void;
  reorderColumn: (columnId: string, insertIndex: number) => void;
  addColumnNote: (columnId: string, text: string, taskIds?: string[]) => void;
  updateColumnNote: (columnId: string, noteId: string, text: string, taskIds?: string[]) => void;
  deleteColumnNote: (columnId: string, noteId: string) => void;

  tasks: Task[];
  activeTasks: Task[];
  filteredTasks: Task[];
  createTask: (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'order'>) => void;
  updateTask: (task: Task) => void;
  deleteTask: (taskId: string) => void;
  moveTask: (taskId: string, targetColumnId: string, targetIndex: number) => void;
  quickMoveTask: (taskId: string, direction: 'prev' | 'next') => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  reorderSubtasks: (taskId: string, subtasks: Subtask[]) => void;
  updateSubtaskNote: (taskId: string, subtaskId: string, note: string) => void;
  updateTaskMedia: (taskId: string, media: MediaAttachment | undefined) => void;

  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  resetFilters: () => void;

  activityLogs: ActivityLog[];
  clearActivityLogs: () => void;

  theme: 'light' | 'dark';
  toggleTheme: () => void;

  exportData: () => void;
  importData: (jsonString: string) => { success: boolean; message: string };
  resetToDemoData: () => void;

  allTags: string[];
  allAssignees: Assignee[];

  // Global assignee directory (managed from Global Settings)
  assignees: Assignee[];
  createAssignee: (name: string, avatarColor: string) => void;
  updateAssignee: (id: string, name: string, avatarColor: string) => void;
  deleteAssignee: (id: string) => void;

  // AI token refresh timers per assignee
  tokenTimers: TokenTimer[];
  createTokenTimer: (data: Omit<TokenTimer, 'id' | 'createdAt' | 'notifiedBefore' | 'notifiedReady'>) => void;
  updateTokenTimer: (id: string, patch: Partial<Omit<TokenTimer, 'id'>>) => void;
  deleteTokenTimer: (id: string) => void;

  // Global tag directory: tags offered when editing a task (managed from Global Settings)
  tagOptions: string[];
  createTag: (label: string) => boolean;
  renameTag: (oldLabel: string, newLabel: string) => boolean;
  deleteTag: (label: string) => void;

  /** Supabase sync state ('local' when running without cloud) */
  sync: SyncState;
}

// Merge assignees referenced by tasks into the directory so no task points to an unknown person
const mergeTaskAssignees = (directory: Assignee[], taskList: Task[]): Assignee[] => {
  const map = new Map<string, Assignee>(directory.map((a) => [a.id, a]));
  taskList.forEach((t) => {
    t.assignees.forEach((a) => {
      if (!map.has(a.id)) map.set(a.id, a);
    });
  });
  return Array.from(map.values());
};

const KanbanContext = createContext<KanbanContextType | undefined>(undefined);

export const KanbanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [boards, setBoards] = useState<Board[]>(() =>
    loadFromStorage<Board[]>(STORAGE_KEYS.BOARDS, INITIAL_BOARDS)
  );

  const [activeBoardId, setActiveBoardId] = useState<string>(() =>
    loadFromStorage<string>(STORAGE_KEYS.ACTIVE_BOARD_ID, INITIAL_BOARDS[0]?.id || '')
  );

  const [columns, setColumns] = useState<Column[]>(() =>
    loadFromStorage<Column[]>(STORAGE_KEYS.COLUMNS, INITIAL_COLUMNS)
  );

  const [tasks, setTasks] = useState<Task[]>(() =>
    normalizeTasks(loadFromStorage<Task[]>(STORAGE_KEYS.TASKS, INITIAL_TASKS))
  );

  const [assignees, setAssignees] = useState<Assignee[]>(() => {
    const stored = loadFromStorage<Assignee[] | null>(STORAGE_KEYS.ASSIGNEES, null);
    if (stored) return stored;
    // First run / migration: seed from defaults plus any custom assignees already on tasks
    return mergeTaskAssignees(
      INITIAL_ASSIGNEES,
      normalizeTasks(loadFromStorage<Task[]>(STORAGE_KEYS.TASKS, INITIAL_TASKS))
    );
  });

  const [tagOptions, setTagOptions] = useState<string[]>(() => {
    const stored = loadFromStorage<string[] | null>(STORAGE_KEYS.TAGS, null);
    // First run / migration: defaults plus every tag already used on tasks
    return mergeTaskTags(
      Array.isArray(stored) ? stored : DEFAULT_TAGS,
      normalizeTasks(loadFromStorage<Task[]>(STORAGE_KEYS.TASKS, INITIAL_TASKS))
    );
  });

  const [tokenTimers, setTokenTimers] = useState<TokenTimer[]>(() =>
    loadFromStorage<TokenTimer[]>(STORAGE_KEYS.TOKEN_TIMERS, [])
  );

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() =>
    loadFromStorage<ActivityLog[]>(STORAGE_KEYS.LOGS, INITIAL_LOGS)
  );

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = loadFromStorage<'light' | 'dark' | null>(STORAGE_KEYS.THEME, null);
    if (savedTheme) return savedTheme;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });

  // The chosen sort order is remembered across reloads (the other filters are not)
  const [filters, setFilters] = useState<FilterState>(() => {
    const saved = loadFromStorage<Partial<Pick<FilterState, 'sortBy' | 'sortReverse'>>>(STORAGE_KEYS.SORT, {});
    return {
      ...DEFAULT_FILTER_STATE,
      ...(saved.sortBy ? { sortBy: saved.sortBy } : {}),
      ...(typeof saved.sortReverse === 'boolean' ? { sortReverse: saved.sortReverse } : {}),
    };
  });
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.SORT, { sortBy: filters.sortBy, sortReverse: filters.sortReverse });
  }, [filters.sortBy, filters.sortReverse]);

  // Sync to localStorage
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.BOARDS, boards);
  }, [boards]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.ACTIVE_BOARD_ID, activeBoardId);
  }, [activeBoardId]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.COLUMNS, columns);
  }, [columns]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.TASKS, tasks);
  }, [tasks]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.ASSIGNEES, assignees);
  }, [assignees]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.TAGS, tagOptions);
  }, [tagOptions]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.TOKEN_TIMERS, tokenTimers);
  }, [tokenTimers]);

  // Once per app start: drop uploaded cover media that no task references anymore
  // (removed/replaced media, deleted tasks). Not done eagerly so "Batal" in the form stays safe.
  useEffect(() => {
    cleanupOrphanMedia(tasks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Any tag used on a task (new task, edit, import...) is recorded in the tag directory right away
  useEffect(() => {
    setTagOptions((prev) => {
      const merged = mergeTaskTags(prev, tasks);
      return merged.length === prev.length ? prev : merged;
    });
  }, [tasks]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.LOGS, activityLogs);
  }, [activityLogs]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.THEME, theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const addLog = useCallback((action: ActivityLog['action'], details: string) => {
    const newLog: ActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      action,
      details,
    };
    setActivityLogs((prev) => [newLog, ...prev.slice(0, 49)]); // max 50 logs
  }, []);

  const activeBoard = useMemo(() => {
    return boards.find((b) => b.id === activeBoardId) || boards[0];
  }, [boards, activeBoardId]);

  const activeColumns = useMemo(() => {
    if (!activeBoard) return [];
    return columns
      .filter((col) => col.boardId === activeBoard.id)
      .sort((a, b) => a.order - b.order);
  }, [columns, activeBoard]);

  const activeColumnIds = useMemo(() => {
    return new Set(activeColumns.map((c) => c.id));
  }, [activeColumns]);

  const activeTasks = useMemo(() => {
    return tasks.filter((t) => activeColumnIds.has(t.columnId));
  }, [tasks, activeColumnIds]);

  // Unique tags and assignees for filtering
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    activeTasks.forEach((t) => t.tags.forEach((tag) => tagsSet.add(tag)));
    return Array.from(tagsSet);
  }, [activeTasks]);

  const allAssignees = useMemo(() => {
    const map = new Map<string, Assignee>();
    activeTasks.forEach((t) => {
      t.assignees.forEach((a) => map.set(a.id, a));
    });
    return Array.from(map.values());
  }, [activeTasks]);

  // Filter and Sort Tasks
  const filteredTasks = useMemo(() => {
    const searchLower = filters.search.trim().toLowerCase();
    const todayStr = new Date().toISOString().split('T')[0];

    const weekLater = new Date();
    weekLater.setDate(weekLater.getDate() + 7);
    const weekLaterStr = weekLater.toISOString().split('T')[0];

    return activeTasks
      .filter((task) => {
        // Search filter
        if (searchLower) {
          const matchTitle = task.title.toLowerCase().includes(searchLower);
          const matchDesc = task.description.toLowerCase().includes(searchLower);
          const matchTag = task.tags.some((tag) => tag.toLowerCase().includes(searchLower));
          const matchAssignee = task.assignees.some((a) => a.name.toLowerCase().includes(searchLower));
          if (!matchTitle && !matchDesc && !matchTag && !matchAssignee) return false;
        }

        // Priority filter
        if (filters.priorities.length > 0) {
          if (!filters.priorities.includes(task.priority)) return false;
        }

        // Tag filter
        if (filters.tags.length > 0) {
          const hasTag = task.tags.some((t) => filters.tags.includes(t));
          if (!hasTag) return false;
        }

        // Assignee filter
        if (filters.assignees.length > 0) {
          if (!task.assignees.some((a) => filters.assignees.includes(a.id))) return false;
        }

        // Complexity (number of subtasks)
        if (!matchesComplexity(task, filters.complexity)) return false;

        // Due date filter
        if (filters.dueFilter !== 'all') {
          if (!task.dueDate) return false;
          if (filters.dueFilter === 'overdue' && task.dueDate >= todayStr) return false;
          if (filters.dueFilter === 'dueToday' && task.dueDate !== todayStr) return false;
          if (
            filters.dueFilter === 'dueWeek' &&
            (task.dueDate < todayStr || task.dueDate > weekLaterStr)
          )
            return false;
        }

        return true;
      })
      .sort(compareTasks(filters.sortBy, filters.sortReverse));
  }, [activeTasks, filters]);

  // Board actions
  const createBoard = useCallback(
    (title: string, description?: string) => {
      const newBoardId = `board-${Date.now()}`;
      const newBoard: Board = {
        id: newBoardId,
        title,
        description,
        createdAt: new Date().toISOString(),
      };

      // Create default starter columns for the new board
      const defaultCols: Column[] = [
        { id: `col-${Date.now()}-1`, boardId: newBoardId, title: 'To Do', color: '#3b82f6', wipLimit: 6, order: 0 },
        { id: `col-${Date.now()}-2`, boardId: newBoardId, title: 'In Progress', color: '#f59e0b', wipLimit: 3, order: 1 },
        { id: `col-${Date.now()}-3`, boardId: newBoardId, title: 'Done', color: '#10b981', wipLimit: 0, order: 2 },
      ];

      setBoards((prev) => [...prev, newBoard]);
      setColumns((prev) => [...prev, ...defaultCols]);
      setActiveBoardId(newBoardId);
      addLog('create_column', `Papan baru "${title}" berhasil dibuat`);
      return newBoardId;
    },
    [addLog]
  );

  const updateBoard = useCallback((id: string, title: string, description?: string) => {
    setBoards((prev) =>
      prev.map((b) => (b.id === id ? { ...b, title, description } : b))
    );
  }, []);

  const deleteBoard = useCallback(
    (id: string) => {
      if (boards.length <= 1) {
        alert('Anda tidak dapat menghapus satu-satunya papan!');
        return;
      }
      setBoards((prev) => prev.filter((b) => b.id !== id));
      setColumns((prev) => prev.filter((c) => c.boardId !== id));
      // Delete tasks in deleted board
      const boardColIds = new Set(columns.filter((c) => c.boardId === id).map((c) => c.id));
      setTasks((prev) => prev.filter((t) => !boardColIds.has(t.columnId)));

      const remaining = boards.filter((b) => b.id !== id);
      if (remaining.length > 0) {
        setActiveBoardId(remaining[0].id);
      }
    },
    [boards, columns]
  );

  // Column actions
  const createColumn = useCallback(
    (title: string, color: string, wipLimit?: number) => {
      if (!activeBoard) return;
      const newCol: Column = {
        id: `col-${Date.now()}`,
        boardId: activeBoard.id,
        title,
        color,
        wipLimit: wipLimit && wipLimit > 0 ? wipLimit : undefined,
        order: activeColumns.length,
      };
      setColumns((prev) => [...prev, newCol]);
      addLog('create_column', `Kolom baru "${title}" ditambahkan ke ${activeBoard.title}`);
    },
    [activeBoard, activeColumns.length, addLog]
  );

  // Column notes ("Catatan Penting")
  const mapColumnNotes = useCallback(
    (columnId: string, fn: (notes: ColumnNote[]) => ColumnNote[]) =>
      setColumns((prev) =>
        prev.map((c) => (c.id === columnId ? { ...c, notes: fn(c.notes ?? []) } : c))
      ),
    []
  );

  const addColumnNote = useCallback(
    (columnId: string, text: string, taskIds: string[] = []) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      mapColumnNotes(columnId, (notes) => [
        ...notes,
        {
          id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          text: trimmed,
          taskIds,
          createdAt: new Date().toISOString(),
        },
      ]);
    },
    [mapColumnNotes]
  );

  const updateColumnNote = useCallback(
    (columnId: string, noteId: string, text: string, taskIds?: string[]) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      mapColumnNotes(columnId, (notes) =>
        notes.map((n) =>
          n.id === noteId
            ? { ...n, text: trimmed, taskIds: taskIds ?? n.taskIds, updatedAt: new Date().toISOString() }
            : n
        )
      );
    },
    [mapColumnNotes]
  );

  const deleteColumnNote = useCallback(
    (columnId: string, noteId: string) => {
      mapColumnNotes(columnId, (notes) => notes.filter((n) => n.id !== noteId));
    },
    [mapColumnNotes]
  );

  const updateColumn = useCallback(
    (id: string, title: string, color: string, wipLimit?: number) => {
      setColumns((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, title, color, wipLimit: wipLimit && wipLimit > 0 ? wipLimit : undefined }
            : c
        )
      );
    },
    []
  );

  const deleteColumn = useCallback(
    (id: string) => {
      const col = columns.find((c) => c.id === id);
      if (!col) return;
      setColumns((prev) => prev.filter((c) => c.id !== id));
      setTasks((prev) => prev.filter((t) => t.columnId !== id));
      addLog('delete_column', `Kolom "${col.title}" dan seluruh tugas di dalamnya telah dihapus`);
    },
    [columns, addLog]
  );

  const moveColumnOrder = useCallback(
    (columnId: string, direction: 'left' | 'right') => {
      const currentIndex = activeColumns.findIndex((c) => c.id === columnId);
      if (currentIndex === -1) return;

      const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= activeColumns.length) return;

      const newCols = [...activeColumns];
      const [moved] = newCols.splice(currentIndex, 1);
      newCols.splice(targetIndex, 0, moved);

      // Reassign order
      const reordered = newCols.map((c, idx) => ({ ...c, order: idx }));
      const otherCols = columns.filter((c) => c.boardId !== activeBoardId);
      setColumns([...otherCols, ...reordered]);
    },
    [activeColumns, columns, activeBoardId]
  );

  // Drag & drop: insertIndex is the gap position (0..length) in the current column order
  const reorderColumn = useCallback(
    (columnId: string, insertIndex: number) => {
      const currentIndex = activeColumns.findIndex((c) => c.id === columnId);
      if (currentIndex === -1) return;

      const targetIndex = insertIndex > currentIndex ? insertIndex - 1 : insertIndex;
      if (targetIndex === currentIndex) return;

      const newCols = [...activeColumns];
      const [moved] = newCols.splice(currentIndex, 1);
      newCols.splice(targetIndex, 0, moved);

      const reordered = newCols.map((c, idx) => ({ ...c, order: idx }));
      const otherCols = columns.filter((c) => c.boardId !== activeBoardId);
      setColumns([...otherCols, ...reordered]);
    },
    [activeColumns, columns, activeBoardId]
  );

  // Task actions
  const createTask = useCallback(
    (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'order'>) => {
      const colTasks = tasks.filter((t) => t.columnId === taskData.columnId);
      const newTask: Task = {
        ...taskData,
        id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        order: colTasks.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setTasks((prev) => [...prev, newTask]);
      addLog('create_task', `Tugas "${newTask.title}" berhasil ditambahkan`);
    },
    [tasks, addLog]
  );

  const updateTask = useCallback(
    (updatedTask: Task) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === updatedTask.id ? { ...updatedTask, updatedAt: new Date().toISOString() } : t
        )
      );
      addLog('update_task', `Tugas "${updatedTask.title}" diperbarui`);
    },
    [addLog]
  );

  const deleteTask = useCallback(
    (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      addLog('delete_task', `Tugas "${task.title}" dihapus`);
    },
    [tasks, addLog]
  );

  const moveTask = useCallback(
    (taskId: string, targetColumnId: string, targetIndex: number) => {
      setTasks((prevTasks) => {
        const task = prevTasks.find((t) => t.id === taskId);
        if (!task) return prevTasks;

        const isSameColumn = task.columnId === targetColumnId;
        const targetColumn = columns.find((c) => c.id === targetColumnId);

        // Check if moving to done/finished column for celebration
        if (!isSameColumn && targetColumn && isDoneColumn(targetColumn)) {
          triggerConfetti();
        }

        // Get tasks in target column excluding the moving task
        const otherColumnTasks = prevTasks
          .filter((t) => t.columnId === targetColumnId && t.id !== taskId)
          .sort((a, b) => a.order - b.order);

        // Insert at target index
        const safeIndex = Math.max(0, Math.min(targetIndex, otherColumnTasks.length));
        otherColumnTasks.splice(safeIndex, 0, {
          ...task,
          columnId: targetColumnId,
          updatedAt: new Date().toISOString(),
        });

        // Re-index target column
        const updatedTargetTasks = otherColumnTasks.map((t, idx) => ({
          ...t,
          order: idx,
        }));

        // Other tasks untouched
        const restTasks = prevTasks.filter(
          (t) => t.columnId !== targetColumnId && t.id !== taskId
        );

        // If source column was different, re-index source column too
        if (!isSameColumn) {
          const sourceTasks = restTasks
            .filter((t) => t.columnId === task.columnId)
            .sort((a, b) => a.order - b.order)
            .map((t, idx) => ({ ...t, order: idx }));

          const otherUntouched = restTasks.filter((t) => t.columnId !== task.columnId);
          return [...otherUntouched, ...sourceTasks, ...updatedTargetTasks];
        }

        return [...restTasks, ...updatedTargetTasks];
      });

      const movedTask = tasks.find((t) => t.id === taskId);
      const col = columns.find((c) => c.id === targetColumnId);
      if (movedTask && col) {
        addLog('move_task', `Tugas "${movedTask.title}" dipindahkan ke kolom ${col.title}`);
      }
    },
    [columns, tasks, addLog]
  );

  const quickMoveTask = useCallback(
    (taskId: string, direction: 'prev' | 'next') => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      const currentColIndex = activeColumns.findIndex((c) => c.id === task.columnId);
      if (currentColIndex === -1) return;

      const nextColIndex = direction === 'next' ? currentColIndex + 1 : currentColIndex - 1;
      if (nextColIndex < 0 || nextColIndex >= activeColumns.length) return;

      const nextCol = activeColumns[nextColIndex];
      const targetTasks = tasks.filter((t) => t.columnId === nextCol.id);
      moveTask(taskId, nextCol.id, targetTasks.length);
    },
    [tasks, activeColumns, moveTask]
  );

  const toggleSubtask = useCallback(
    (taskId: string, subtaskId: string) => {
      setTasks((prev) =>
        prev.map((task) => {
          if (task.id !== taskId) return task;
          const updatedSubtasks = task.subtasks.map((st) =>
            st.id === subtaskId
              ? {
                  ...st,
                  completed: !st.completed,
                  completedAt: !st.completed ? new Date().toISOString() : st.completedAt,
                }
              : st
          );
          return { ...task, subtasks: updatedSubtasks, updatedAt: new Date().toISOString() };
        })
      );
    },
    []
  );

  const updateSubtaskNote = useCallback((taskId: string, subtaskId: string, note: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              subtasks: task.subtasks.map((st) =>
                st.id === subtaskId ? { ...st, note: note || undefined } : st
              ),
              updatedAt: new Date().toISOString(),
            }
          : task
      )
    );
  }, []);

  const updateTaskMedia = useCallback((taskId: string, media: MediaAttachment | undefined) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, media, updatedAt: new Date().toISOString() } : task
      )
    );
  }, []);

  const reorderSubtasks = useCallback((taskId: string, subtasks: Subtask[]) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, subtasks, updatedAt: new Date().toISOString() } : task
      )
    );
  }, []);

  // Assignee directory actions
  const createAssignee = useCallback((name: string, avatarColor: string) => {
    const newAssignee: Assignee = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name,
      avatarColor,
    };
    setAssignees((prev) => [...prev, newAssignee]);
  }, []);

  const updateAssignee = useCallback((id: string, name: string, avatarColor: string) => {
    const updated: Assignee = { id, name, avatarColor };
    setAssignees((prev) => prev.map((a) => (a.id === id ? updated : a)));
    // Propagate the new name/color to every task assigned to this person
    setTasks((prev) =>
      prev.map((t) =>
        t.assignees.some((a) => a.id === id)
          ? { ...t, assignees: t.assignees.map((a) => (a.id === id ? updated : a)) }
          : t
      )
    );
  }, []);

  const deleteAssignee = useCallback(
    (id: string) => {
      setAssignees((prev) => prev.filter((a) => a.id !== id));
      // Unassign the removed person from their tasks
      setTasks((prev) =>
        prev.map((t) =>
          t.assignees.some((a) => a.id === id)
            ? { ...t, assignees: t.assignees.filter((a) => a.id !== id) }
            : t
        )
      );
      setFilters((prev) => ({ ...prev, assignees: prev.assignees.filter((a) => a !== id) }));
      setTokenTimers((prev) => prev.filter((t) => t.assigneeId !== id));
    },
    []
  );

  // Token timer actions
  const createTokenTimer = useCallback(
    (data: Omit<TokenTimer, 'id' | 'createdAt' | 'notifiedBefore' | 'notifiedReady'>) => {
      setTokenTimers((prev) => [
        ...prev,
        {
          ...data,
          id: `timer-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          createdAt: new Date().toISOString(),
          notifiedBefore: false,
          notifiedReady: false,
        },
      ]);
    },
    []
  );

  const updateTokenTimer = useCallback((id: string, patch: Partial<Omit<TokenTimer, 'id'>>) => {
    setTokenTimers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const deleteTokenTimer = useCallback((id: string) => {
    setTokenTimers((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Tag directory actions (case-insensitive uniqueness)
  const createTag = useCallback(
    (label: string) => {
      const trimmed = label.trim();
      if (!trimmed || tagOptions.some((t) => t.toLowerCase() === trimmed.toLowerCase())) return false;
      setTagOptions((prev) => [...prev, trimmed]);
      return true;
    },
    [tagOptions]
  );

  const renameTag = useCallback(
    (oldLabel: string, newLabel: string) => {
      const trimmed = newLabel.trim();
      if (!trimmed) return false;
      if (tagOptions.some((t) => t !== oldLabel && t.toLowerCase() === trimmed.toLowerCase())) return false;
      if (trimmed === oldLabel) return true;
      const swap = (list: string[]) => list.map((t) => (t === oldLabel ? trimmed : t));
      // Propagate the new name to every task and the active filter
      setTasks((prev) =>
        prev.map((t) => (t.tags.includes(oldLabel) ? { ...t, tags: swap(t.tags) } : t))
      );
      setFilters((prev) => ({ ...prev, tags: swap(prev.tags) }));
      setTagOptions((prev) => swap(prev));
      return true;
    },
    [tagOptions]
  );

  const deleteTag = useCallback((label: string) => {
    setTagOptions((prev) => prev.filter((t) => t !== label));
    // Remove it from tasks too, otherwise it would be recorded again immediately
    setTasks((prev) =>
      prev.map((t) => (t.tags.includes(label) ? { ...t, tags: t.tags.filter((x) => x !== label) } : t))
    );
    setFilters((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== label) }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTER_STATE);
  }, []);

  const clearActivityLogs = useCallback(() => {
    setActivityLogs([]);
  }, []);

  const exportData = useCallback(() => {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      boards,
      columns,
      tasks,
      assignees,
      tags: tagOptions,
      tokenTimers,
    };
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(data, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `kanban-backup-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }, [boards, columns, tasks, assignees, tagOptions, tokenTimers]);

  const importData = useCallback(
    (jsonString: string): { success: boolean; message: string } => {
      try {
        const parsed = JSON.parse(jsonString);
        if (!parsed.boards || !parsed.columns || !parsed.tasks) {
          return { success: false, message: 'Format data JSON tidak valid (harus memiliki boards, columns, dan tasks).' };
        }
        setBoards(parsed.boards);
        setColumns(parsed.columns);
        const importedTasks = normalizeTasks(parsed.tasks);
        setTasks(importedTasks);
        setAssignees(
          mergeTaskAssignees(Array.isArray(parsed.assignees) ? parsed.assignees : [], importedTasks)
        );
        setTagOptions(
          mergeTaskTags(Array.isArray(parsed.tags) ? parsed.tags : DEFAULT_TAGS, importedTasks)
        );
        setTokenTimers(Array.isArray(parsed.tokenTimers) ? parsed.tokenTimers : []);
        if (parsed.boards.length > 0) {
          setActiveBoardId(parsed.boards[0].id);
        }
        addLog('create_task', 'Data Kanban berhasil diimpor dari file cadangan JSON');
        return { success: true, message: 'Data Kanban berhasil diimpor!' };
      } catch (err) {
        return { success: false, message: `Gagal membaca file JSON: ${(err as Error).message}` };
      }
    },
    [addLog]
  );

  const resetToDemoData = useCallback(() => {
    setBoards(INITIAL_BOARDS);
    setActiveBoardId(INITIAL_BOARDS[0].id);
    setColumns(INITIAL_COLUMNS);
    setTasks(INITIAL_TASKS);
    setAssignees(INITIAL_ASSIGNEES);
    setTagOptions(mergeTaskTags(DEFAULT_TAGS, INITIAL_TASKS));
    setTokenTimers([]);
    setActivityLogs(INITIAL_LOGS);
    setFilters(DEFAULT_FILTER_STATE);
  }, []);

  // ---------- Cloud sync (Supabase) ----------
  const { cloudEnabled } = useAuth();

  // Empty team workspace + "Mulai dari kosong": one board with a basic workflow
  const onFreshStart = useCallback(() => {
    const now = new Date().toISOString();
    const boardId = `board-${Date.now()}`;
    const cols = [
      { title: 'To Do', color: '#64748b' },
      { title: 'In Progress', color: '#3b82f6' },
      { title: 'Review', color: '#f59e0b' },
      { title: 'Done', color: '#10b981' },
    ].map((c, i) => ({ id: `col-${Date.now()}-${i}`, boardId, title: c.title, color: c.color, order: i }));
    setBoards([{ id: boardId, title: 'Board Tim', description: 'Board bersama tim', createdAt: now }]);
    setActiveBoardId(boardId);
    setColumns(cols);
    setTasks([]);
    setAssignees([]);
    setTagOptions(DEFAULT_TAGS);
    setTokenTimers([]);
    setActivityLogs([]);
    setFilters(DEFAULT_FILTER_STATE);
  }, []);

  // Keep the selected board valid after the team data arrives
  const onLoaded = useCallback((loaded: Board[]) => {
    setActiveBoardId((prev) => (loaded.some((b) => b.id === prev) ? prev : loaded[0]?.id ?? ''));
  }, []);

  const sync = useSupabaseSync(
    cloudEnabled,
    {
      boards: { spec: boardSpec, items: boards, set: setBoards, realtime: true },
      columns: { spec: columnSpec, items: columns, set: setColumns, realtime: true },
      tasks: { spec: taskSpec, items: tasks, set: setTasks, realtime: true },
      assignees: { spec: assigneeSpec, items: assignees, set: setAssignees, realtime: true },
      tags: { spec: tagSpec, items: tagOptions, set: setTagOptions, realtime: true },
      timers: { spec: timerSpec, items: tokenTimers, set: setTokenTimers, realtime: true },
      logs: { spec: logSpec, items: activityLogs, set: setActivityLogs, realtime: false },
    },
    onFreshStart,
    onLoaded
  );

  return (
    <KanbanContext.Provider
      value={{
        boards,
        activeBoardId,
        activeBoard,
        setActiveBoardId,
        createBoard,
        updateBoard,
        deleteBoard,
        columns,
        activeColumns,
        createColumn,
        updateColumn,
        deleteColumn,
        moveColumnOrder,
        reorderColumn,
        addColumnNote,
        updateColumnNote,
        deleteColumnNote,
        tasks,
        activeTasks,
        filteredTasks,
        createTask,
        updateTask,
        deleteTask,
        moveTask,
        quickMoveTask,
        toggleSubtask,
        reorderSubtasks,
        updateSubtaskNote,
        updateTaskMedia,
        filters,
        setFilters,
        resetFilters,
        activityLogs,
        clearActivityLogs,
        theme,
        toggleTheme,
        exportData,
        importData,
        resetToDemoData,
        allTags,
        allAssignees,
        assignees,
        createAssignee,
        updateAssignee,
        deleteAssignee,
        tokenTimers,
        createTokenTimer,
        updateTokenTimer,
        deleteTokenTimer,
        tagOptions,
        createTag,
        renameTag,
        deleteTag,
        sync,
      }}
    >
      {children}
    </KanbanContext.Provider>
  );
};

export const useKanban = () => {
  const context = useContext(KanbanContext);
  if (!context) {
    throw new Error('useKanban must be used within a KanbanProvider');
  }
  return context;
};
