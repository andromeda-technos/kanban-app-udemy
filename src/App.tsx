import React, { useState, useEffect, useRef } from 'react';
import { KanbanProvider, useKanban } from './context/KanbanContext';
import { Navbar } from './components/Navbar';
import { BoardView } from './components/BoardView';
import { TaskModal } from './components/TaskModal';
import { ColumnModal } from './components/ColumnModal';
import { BoardModal } from './components/BoardModal';
import { FilterDrawer } from './components/FilterDrawer';
import { AnalyticsModal } from './components/AnalyticsModal';
import { ActivityLogModal } from './components/ActivityLogModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { Task, Column, Board } from './types/kanban';

const KanbanDashboard: React.FC = () => {
  const { activeBoard } = useKanban();

  // Modals state
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [taskDefaultColumnId, setTaskDefaultColumnId] = useState<string | undefined>(undefined);

  const [columnModalOpen, setColumnModalOpen] = useState(false);
  const [columnToEdit, setColumnToEdit] = useState<Column | null>(null);

  const [boardModalOpen, setBoardModalOpen] = useState(false);
  const [boardToEdit, setBoardToEdit] = useState<Board | null>(null);

  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [analyticsModalOpen, setAnalyticsModalOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.tagName === 'SELECT';

      // Escape to close any modal
      if (e.key === 'Escape') {
        setTaskModalOpen(false);
        setColumnModalOpen(false);
        setBoardModalOpen(false);
        setFilterDrawerOpen(false);
        setAnalyticsModalOpen(false);
        setLogsModalOpen(false);
        setShortcutsModalOpen(false);
        return;
      }

      if (isInput) return;

      // 'N' for new task
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setTaskToEdit(null);
        setTaskDefaultColumnId(undefined);
        setTaskModalOpen(true);
      }

      // '/' to focus search
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      // '?' for shortcuts
      if (e.key === '?') {
        e.preventDefault();
        setShortcutsModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenNewTask = (columnId?: string) => {
    setTaskToEdit(null);
    setTaskDefaultColumnId(columnId);
    setTaskModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setTaskToEdit(task);
    setTaskDefaultColumnId(task.columnId);
    setTaskModalOpen(true);
  };

  const handleOpenNewColumn = () => {
    setColumnToEdit(null);
    setColumnModalOpen(true);
  };

  const handleEditColumn = (col: Column) => {
    setColumnToEdit(col);
    setColumnModalOpen(true);
  };

  const handleOpenNewBoard = () => {
    setBoardToEdit(null);
    setBoardModalOpen(true);
  };

  const handleEditBoard = () => {
    setBoardToEdit(activeBoard || null);
    setBoardModalOpen(true);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors">
      {/* Top Navbar */}
      <Navbar
        onOpenNewTask={() => handleOpenNewTask()}
        onOpenNewBoard={handleOpenNewBoard}
        onEditBoard={handleEditBoard}
        onOpenFilters={() => setFilterDrawerOpen(true)}
        onOpenAnalytics={() => setAnalyticsModalOpen(true)}
        onOpenLogs={() => setLogsModalOpen(true)}
        onOpenShortcuts={() => setShortcutsModalOpen(true)}
        searchInputRef={searchInputRef}
      />

      {/* Main Board View */}
      <BoardView
        onAddTask={(colId) => handleOpenNewTask(colId)}
        onEditTask={handleEditTask}
        onAddColumn={handleOpenNewColumn}
        onEditColumn={handleEditColumn}
      />

      {/* Modals & Drawers */}
      <TaskModal
        isOpen={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        taskToEdit={taskToEdit}
        defaultColumnId={taskDefaultColumnId}
      />

      <ColumnModal
        isOpen={columnModalOpen}
        onClose={() => setColumnModalOpen(false)}
        columnToEdit={columnToEdit}
      />

      <BoardModal
        isOpen={boardModalOpen}
        onClose={() => setBoardModalOpen(false)}
        boardToEdit={boardToEdit}
      />

      <FilterDrawer
        isOpen={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
      />

      <AnalyticsModal
        isOpen={analyticsModalOpen}
        onClose={() => setAnalyticsModalOpen(false)}
      />

      <ActivityLogModal
        isOpen={logsModalOpen}
        onClose={() => setLogsModalOpen(false)}
      />

      <ShortcutsModal
        isOpen={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
      />
    </div>
  );
};

export function App() {
  return (
    <KanbanProvider>
      <KanbanDashboard />
    </KanbanProvider>
  );
}

export default App;
