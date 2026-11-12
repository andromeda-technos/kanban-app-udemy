import React, { useState, useEffect, useRef } from 'react';
import { KanbanProvider, useKanban } from './context/KanbanContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthGate } from './components/AuthGate';
import { BrandingProvider } from './context/BrandingContext';
import { SyncOverlay } from './components/SyncOverlay';
import { FilesProvider } from './context/FilesContext';
import { DataCenterModal } from './components/datacenter/DataCenterModal';
import { Navbar } from './components/Navbar';
import { BoardView } from './components/BoardView';
import { TaskModal } from './components/TaskModal';
import { ColumnModal } from './components/ColumnModal';
import { BoardModal } from './components/BoardModal';
import { FilterDrawer } from './components/FilterDrawer';
import { AnalyticsModal } from './components/AnalyticsModal';
import { ActivityLogModal } from './components/ActivityLogModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { GlobalSettingsModal, SettingsTab } from './components/GlobalSettingsModal';
import { TokenTimerNotifier } from './components/TokenTimerNotifier';
import { TokenTimerFab } from './components/TokenTimerFab';
import { PomodoroFab } from './components/PomodoroFab';
import { PrayerFab } from './components/PrayerFab';
import { RadialMenu } from './components/RadialMenu';
import { GeometricBackground } from './components/GeometricBackground';
import { PixelNightBackground } from './components/PixelNightBackground';
import { ClawdCompanion } from './components/Clawd';
import { PREF_KEYS, usePreference } from './hooks/usePreference';
import { Task, Column, Board } from './types/kanban';

const KanbanDashboard: React.FC = () => {
  const { activeBoard, theme } = useKanban();
  const [pixelFont] = usePreference(PREF_KEYS.PIXEL_FONT, true);
  const [pixelBg] = usePreference(PREF_KEYS.PIXEL_BG, true);

  // 16-bit look: the pixel font is applied to the whole page
  useEffect(() => {
    document.documentElement.classList.toggle('font-pixel', pixelFont);
  }, [pixelFont]);

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
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('assignees');
  // Only one floating panel (AI token timers / Pomodoro) is open at a time
  const [floatingPanel, setFloatingPanel] = useState<'timers' | 'pomodoro' | 'prayer' | null>(null);
  const timerPanelOpen = floatingPanel === 'timers';
  const setTimerPanelOpen = (open: boolean) => setFloatingPanel(open ? 'timers' : null);
  const [dataCenterOpen, setDataCenterOpen] = useState(false);
  const openSettings = (tab: SettingsTab = 'assignees') => {
    setSettingsTab(tab);
    setSettingsModalOpen(true);
  };

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
      // An inline editor already handled this Esc (e.g. cancelling a note) → keep modals open
      if (e.key === 'Escape' && e.defaultPrevented) return;

      if (e.key === 'Escape') {
        setTaskModalOpen(false);
        setColumnModalOpen(false);
        setBoardModalOpen(false);
        setFilterDrawerOpen(false);
        setAnalyticsModalOpen(false);
        setLogsModalOpen(false);
        setShortcutsModalOpen(false);
        setSettingsModalOpen(false);
        setFloatingPanel(null);
        setDataCenterOpen(false);
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
    <div className="relative isolate flex flex-col min-h-screen w-full overflow-x-clip bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors">
      {/* Decorative animated background (behind everything, ignores the mouse) */}
      {pixelBg ? <PixelNightBackground theme={theme} /> : <GeometricBackground theme={theme} />}

      {/* Top Navbar */}
      <Navbar
        onOpenNewTask={() => handleOpenNewTask()}
        onOpenNewBoard={handleOpenNewBoard}
        onEditBoard={handleEditBoard}
        onOpenFilters={() => setFilterDrawerOpen(true)}
        onOpenShortcuts={() => setShortcutsModalOpen(true)}
        onOpenSettings={() => openSettings('assignees')}
        searchInputRef={searchInputRef}
      />

      {/* Main Board View */}
      <BoardView
        onAddTask={(colId) => handleOpenNewTask(colId)}
        onEditTask={handleEditTask}
        onAddColumn={handleOpenNewColumn}
        onEditColumn={handleEditColumn}
        onOpenTimers={() => setTimerPanelOpen(true)}
      />

      {/* Modals & Drawers */}
      <TaskModal
        isOpen={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        taskToEdit={taskToEdit}
        defaultColumnId={taskDefaultColumnId}
        onOpenSettings={openSettings}
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

      {/* Rendered last so it stacks above TaskModal when opened from there */}
      <GlobalSettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        initialTab={settingsTab}
      />

      {/* Token refresh alerts (toasts + browser notifications) */}
      <TokenTimerNotifier onOpenTimers={() => setTimerPanelOpen(true)} />

      {/* Floating AI token timer menu (bottom-right) */}
      <TokenTimerFab isOpen={timerPanelOpen} onOpenChange={setTimerPanelOpen} />

      {/* Radial quick menu (bottom-right stack, above Pomodoro): Pusat Data, Statistik, Riwayat */}
      <RadialMenu
        onOpenDataCenter={() => setDataCenterOpen(true)}
        onOpenAnalytics={() => setAnalyticsModalOpen(true)}
        onOpenLogs={() => setLogsModalOpen(true)}
      />

      {/* Prayer times (manual schedule) — Clawd goes to pray */}
      <PrayerFab
        isOpen={floatingPanel === 'prayer'}
        onOpenChange={(open) => setFloatingPanel(open ? 'prayer' : null)}
      />

      {/* Pomodoro focus timer (floating, above the token timer button) */}
      <PomodoroFab
        isOpen={floatingPanel === 'pomodoro'}
        onOpenChange={(open) => setFloatingPanel(open ? 'pomodoro' : null)}
      />

      {/* Clawd, the pixel companion walking along the bottom of the screen */}
      <ClawdCompanion />

      {/* Pusat Data: team work files in Google Drive */}
      <DataCenterModal isOpen={dataCenterOpen} onClose={() => setDataCenterOpen(false)} />
    </div>
  );
};

/** Remount the Kanban state per signed-in account so one user's data never leaks to the next. */
const KanbanApp: React.FC = () => {
  const { user } = useAuth();
  return (
    <KanbanProvider key={user?.id ?? 'local'}>
      <FilesProvider>
        <KanbanDashboard />
      </FilesProvider>
      <SyncOverlay />
    </KanbanProvider>
  );
};

export function App() {
  return (
    <AuthProvider>
      <BrandingProvider>
        <AuthGate>
          <KanbanApp />
        </AuthGate>
      </BrandingProvider>
    </AuthProvider>
  );
}

export default App;
