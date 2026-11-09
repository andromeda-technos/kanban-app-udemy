import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  Board,
  Column,
  Task,
  ActivityLog,
  FilterState,
  Assignee,
} from '../types/kanban';
import {
  INITIAL_BOARDS,
  INITIAL_COLUMNS,
  INITIAL_TASKS,
  INITIAL_LOGS,
  STORAGE_KEYS,
  loadFromStorage,
  saveToStorage,
  DEFAULT_FILTER_STATE,
} from '../utils/storage';
import { triggerConfetti } from '../utils/confetti';

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

  tasks: Task[];
  activeTasks: Task[];
  filteredTasks: Task[];
  createTask: (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'order'>) => void;
  updateTask: (task: Task) => void;
  deleteTask: (taskId: string) => void;
  moveTask: (taskId: string, targetColumnId: string, targetIndex: number) => void;
  quickMoveTask: (taskId: string, direction: 'prev' | 'next') => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;

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
}

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
    loadFromStorage<Task[]>(STORAGE_KEYS.TASKS, INITIAL_TASKS)
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

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTER_STATE);

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
      if (t.assignee) map.set(t.assignee.id, t.assignee);
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
          const matchAssignee = task.assignee?.name.toLowerCase().includes(searchLower);
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
          if (!task.assignee || !filters.assignees.includes(task.assignee.id)) return false;
        }

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
      .sort((a, b) => {
        if (filters.sortBy === 'dueDate') {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate);
        }
        if (filters.sortBy === 'priority') {
          const weight = { urgent: 4, high: 3, medium: 2, low: 1 };
          return weight[b.priority] - weight[a.priority];
        }
        if (filters.sortBy === 'title') {
          return a.title.localeCompare(b.title);
        }
        if (filters.sortBy === 'createdAt') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        // Custom order
        return a.order - b.order;
      });
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
        if (
          !isSameColumn &&
          targetColumn &&
          (targetColumn.title.toLowerCase().includes('done') ||
            targetColumn.title.toLowerCase().includes('selesai') ||
            targetColumn.title.toLowerCase().includes('shipped'))
        ) {
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
            st.id === subtaskId ? { ...st, completed: !st.completed } : st
          );
          return { ...task, subtasks: updatedSubtasks, updatedAt: new Date().toISOString() };
        })
      );
    },
    []
  );

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
  }, [boards, columns, tasks]);

  const importData = useCallback(
    (jsonString: string): { success: boolean; message: string } => {
      try {
        const parsed = JSON.parse(jsonString);
        if (!parsed.boards || !parsed.columns || !parsed.tasks) {
          return { success: false, message: 'Format data JSON tidak valid (harus memiliki boards, columns, dan tasks).' };
        }
        setBoards(parsed.boards);
        setColumns(parsed.columns);
        setTasks(parsed.tasks);
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
    setActivityLogs(INITIAL_LOGS);
    setFilters(DEFAULT_FILTER_STATE);
  }, []);

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
        tasks,
        activeTasks,
        filteredTasks,
        createTask,
        updateTask,
        deleteTask,
        moveTask,
        quickMoveTask,
        toggleSubtask,
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
