import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Home,
  Sun,
  Moon,
  CheckCircle2,
  Calendar,
  BookOpen,
  Search,
  Plus,
  Menu,
  Compass,
} from 'lucide-react';
import { db } from '../database/db';
import { useTheme } from '../theme/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import { useMotionPreference, MOTION_SPRINGS } from '../theme/motion';
import { QuickAddModal } from './QuickAddModal';
import { GlobalSearchModal } from './GlobalSearchModal';
import { AppLockOverlay } from './AppLockOverlay';
import { InAppNotificationStack } from './InAppNotificationStack';
import { SidebarNavigation } from './SidebarNavigation';
import {
  Destination,
  NAV_ITEMS,
  getDestinationFromLocation,
  isValidDestination,
  useNavigationState,
} from './navigationState';
import { getBackupReminderStatus } from '../services/workflowConnectService';
import { fileSystemAdapter } from '../platform/adapters';
import { useNotifications } from '../notifications/NotificationContext';
import { reconcileExpiredFocusTimer } from '../services/focusTimerStateService';
import { soundService } from '../services/soundService';
import { deviceModeService } from '../services/deviceModeService';

// Destination views
import { HomeDashboard } from '../features/home/HomeDashboard';
import { MyDayView } from '../features/myday/MyDayView';
import { InboxView } from '../features/inbox/InboxView';
import { TasksView } from '../features/tasks/TasksView';
import { HabitsView } from '../features/habits/HabitsView';
import { ProjectsView } from '../features/projects/ProjectsView';
import { GoalsView } from '../features/goals/GoalsView';
import { CalendarView } from '../features/calendar/CalendarView';
import { FocusTimerView } from '../features/focus/FocusTimerView';
import { StudyView } from '../features/study/StudyView';
import { WellnessView } from '../features/wellness/WellnessView';
import { JournalView } from '../features/journal/JournalView';
import { InsightsView } from '../features/insights/InsightsView';
import { AchievementsView } from '../features/achievements/AchievementsView';
import { TutorialView } from '../features/tutorial/TutorialView';
import { SettingsView } from '../features/settings/SettingsView';

export type { Destination } from './navigationState';

export const AppShell: React.FC = () => {
  const { toggleMode, resolvedMode } = useTheme();
  const { isReduced, variants } = useMotionPreference();
  const { notify, triggerCelebration } = useNotifications();
  const {
    currentDestination,
    zenMode,
    sidebarCollapsed,
    collapsedGroups,
    pinnedDestinations,
    navigateTo: setNavigationView,
    toggleZenMode,
    setSidebarCollapsed,
    toggleGroupCollapsed,
    togglePinnedDestination,
  } = useNavigationState();
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isTabletViewport, setIsTabletViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 && window.innerWidth < 1024 : false
  );
  const [tabletManualOverride, setTabletManualOverride] = useState<boolean | null>(null);
  const [, setTick] = useState(0);
  const lastNonTutorialDestRef = useRef<Destination>('home');
  const mobileMenuTriggerRef = useRef<HTMLButtonElement | null>(null);

  const effectiveSidebarCollapsed = isTabletViewport
    ? tabletManualOverride ?? true
    : sidebarCollapsed;

  const handleToggleSidebarCollapsed = useCallback(() => {
    const nextCollapsed = !effectiveSidebarCollapsed;
    if (isTabletViewport) {
      setTabletManualOverride(nextCollapsed);
    }
    setSidebarCollapsed(nextCollapsed);
  }, [effectiveSidebarCollapsed, isTabletViewport, setSidebarCollapsed]);

  useEffect(() => {
    if (currentDestination !== 'tutorial') {
      lastNonTutorialDestRef.current = currentDestination;
    }
  }, [currentDestination]);

  // Global focus timer expiration watcher so sessions complete reliably even when viewing other screens
  useEffect(() => {
    const checkExpiredTimer = () => {
      reconcileExpiredFocusTimer({
        database: db,
        onPlaySound: vol => soundService.playTimerBell(vol),
        onNotify: notify,
        onCelebrate: triggerCelebration,
        onRestoreDeviceMode: async () => {
          const currentSettings = db.getSettings();
          const deviceSettings =
            currentSettings.focusDeviceSettings || deviceModeService.getDefaultSettings();
          await deviceModeService.restorePreviousMode(
            deviceSettings.restoreAfterFocus ?? deviceSettings.restorePreviousMode ?? true
          );
        },
      });
    };

    checkExpiredTimer();
    const interval = setInterval(checkExpiredTimer, 500);
    const handleVisibilityOrFocus = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        checkExpiredTimer();
      }
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [notify, triggerCelebration]);

  // Responsive viewport listener: close mobile drawer when resizing >= 768px & track tablet range
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      const width = window.innerWidth;
      if (width >= 768) {
        setMobileDrawerOpen(false);
      }
      const nowTablet = width >= 768 && width < 1024;
      setIsTabletViewport(prev => {
        if (prev !== nowTablet) {
          setTabletManualOverride(null);
        }
        return nowTablet;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Check App Lock on start & bind global shortcuts + browser history back navigation
  useEffect(() => {
    const settings = db.getSettings();
    if (settings.appLockEnabled && settings.appLockPinHash) {
      setIsLocked(true);
    }

    // Ensure initial history state is seeded
    const initialDest = getDestinationFromLocation();
    if (!window.history.state?.destination) {
      setNavigationView(initialDest, { syncHistory: true, replaceHistory: true });
    }

    const handlePopState = (e: PopStateEvent) => {
      const nextDest =
        e.state?.destination && isValidDestination(e.state.destination)
          ? e.state.destination
          : getDestinationFromLocation();
      setIsQuickAddOpen(false);
      setIsSearchOpen(false);
      setMobileDrawerOpen(false);
      setNavigationView(nextDest, { syncHistory: false });
    };

    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        setIsQuickAddOpen(true);
      }
      // Cmd/Ctrl + B or Cmd/Ctrl + \ to toggle desktop/tablet sidebar collapse
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'b' || e.key === '\\')) {
        const target = e.target as HTMLElement | null;
        const isEditable =
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          Boolean(target?.isContentEditable);
        if (!isEditable || e.key === '\\') {
          e.preventDefault();
          if (window.innerWidth < 768) {
            setMobileDrawerOpen(prev => !prev);
          } else {
            handleToggleSidebarCollapsed();
          }
        }
      }
      // Alt+1 / Alt+2 / Alt+3 quick navigation between Tasks, Journal, and Calendar
      if (e.altKey && !e.metaKey && !e.ctrlKey) {
        if (e.key === '1') {
          e.preventDefault();
          setNavigationView('tasks');
        } else if (e.key === '2') {
          e.preventDefault();
          setNavigationView('journal');
        } else if (e.key === '3') {
          e.preventDefault();
          setNavigationView('calendar');
        }
      }
    };

    const unsubDb = db.subscribe(() => setTick(t => t + 1));
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleGlobalKey);
    return () => {
      unsubDb();
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleGlobalKey);
    };
  }, [setNavigationView, handleToggleSidebarCollapsed]);

  const settings = db.getSettings();
  const appName = settings.appName || 'Daycraft';
  const hasUnseenAchievements =
    settings.gamificationEnabled && db.getUnseenAchievementIds().length > 0;
  const rawBackupReminder = getBackupReminderStatus(settings);
  const backupReminder = db.hasPersonalActivity()
    ? rawBackupReminder
    : { ...rawBackupReminder, isDue: false };

  const workspaceCounts = {
    tasks: db.getTasks().filter(t => t.status !== 'completed' && !t.archived).length,
    journal: db.getJournalEntries().length,
    calendar: db.getCalendarEvents().length,
    habits: db.getHabits().filter(h => !h.archived).length,
    projects: db.getProjects().filter(p => p.status !== 'archived' && p.status !== 'completed').length,
    goals: db.getGoals().filter(g => g.status === 'active').length,
  };

  const navigateTo = (dest: Destination) => {
    setMobileDrawerOpen(false);
    if (dest === currentDestination) return;
    setNavigationView(dest);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: isReduced ? 'auto' : 'smooth' });
    }
  };

  const handleQuickExportBackup = async () => {
    const archive = db.exportArchive();
    const ok = await fileSystemAdapter.exportBackupFile(archive);
    if (ok) {
      notify({
        title: 'Local Backup Exported',
        message: 'Saved verified .daycraft archive.',
        type: 'system',
      });
    }
  };

  const renderActiveView = () => {
    switch (currentDestination) {
      case 'home':
        return (
          <HomeDashboard
            onNavigate={d => navigateTo(d as Destination)}
            onOpenQuickAdd={() => setIsQuickAddOpen(true)}
          />
        );
      case 'myday':
        return (
          <MyDayView
            onOpenQuickAdd={() => setIsQuickAddOpen(true)}
            onNavigate={d => navigateTo(d as Destination)}
          />
        );
      case 'inbox':
        return <InboxView />;
      case 'tasks':
        return <TasksView />;
      case 'habits':
        return <HabitsView />;
      case 'projects':
        return <ProjectsView />;
      case 'goals':
        return <GoalsView />;
      case 'calendar':
        return <CalendarView />;
      case 'focus':
        return <FocusTimerView />;
      case 'study':
        return <StudyView />;
      case 'wellness':
        return <WellnessView />;
      case 'journal':
        return <JournalView />;
      case 'insights':
        return <InsightsView onNavigate={d => navigateTo(d as Destination)} />;
      case 'achievements':
        return <AchievementsView onNavigate={d => navigateTo(d as Destination)} />;
      case 'tutorial':
        return (
          <TutorialView
            onNavigate={d => navigateTo(d)}
            onOpenQuickAdd={() => setIsQuickAddOpen(true)}
            onClose={() => navigateTo(lastNonTutorialDestRef.current || 'home')}
          />
        );
      case 'settings':
        return <SettingsView onNavigate={d => navigateTo(d as Destination)} />;
      default:
        return (
          <HomeDashboard
            onNavigate={d => navigateTo(d as Destination)}
            onOpenQuickAdd={() => setIsQuickAddOpen(true)}
          />
        );
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col md:flex-row relative"
      style={{ backgroundColor: 'var(--bg-app)' }}
    >
      {/* App Lock Overlay */}
      {isLocked && <AppLockOverlay onUnlocked={() => setIsLocked(false)} />}

      {/* Floating Notification Stack */}
      <InAppNotificationStack />

      {/* Quick Add Modal */}
      <QuickAddModal isOpen={isQuickAddOpen} onClose={() => setIsQuickAddOpen(false)} />

      {/* Command Palette & Global Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={d => navigateTo(d as Destination)}
        onOpenQuickAdd={() => setIsQuickAddOpen(true)}
      />

      {/* Mobile Top Header (Small Screens < 768px) */}
      <header
        className="md:hidden flex items-center justify-between gap-2 px-3.5 py-2.5 border-b sticky top-0 z-30 backdrop-blur-md"
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            ref={mobileMenuTriggerRef}
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={mobileDrawerOpen}
            aria-controls="daycraft-mobile-drawer"
            className="w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-colors cursor-pointer"
            style={{
              borderColor: 'var(--border)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-primary)',
            }}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-foreground)',
              }}
            >
              <Compass className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div
                className="font-bold text-sm truncate leading-tight"
                style={{ color: 'var(--text-primary)' }}
              >
                {appName}
              </div>
              <div
                className="text-[10px] font-medium truncate leading-tight"
                style={{ color: 'var(--text-secondary)' }}
              >
                {currentDestination === 'tutorial'
                  ? 'App Tutorial'
                  : currentDestination === 'settings'
                  ? 'Settings'
                  : NAV_ITEMS.find(item => item.id === currentDestination)?.label || 'Workspace'}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={toggleMode}
            aria-label={`Switch to ${resolvedMode === 'dark' ? 'light' : 'dark'} theme`}
            className="w-9 h-9 rounded-xl border flex items-center justify-center transition-colors cursor-pointer"
            style={{
              borderColor: 'var(--border)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-secondary)',
            }}
          >
            {resolvedMode === 'dark' ? (
              <Sun className="w-4 h-4" style={{ color: 'var(--warning)' }} />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            aria-label="Search records"
            className="w-9 h-9 rounded-xl border flex items-center justify-center transition-colors cursor-pointer"
            style={{
              borderColor: 'var(--border)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-secondary)',
            }}
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsQuickAddOpen(true)}
            aria-label="Quick add"
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-opacity hover:opacity-95 cursor-pointer"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-foreground)',
            }}
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </header>

      {/* Sidebar Navigation (Desktop Expanded + Icon Rail + Mobile Drawer) */}
      <SidebarNavigation
        appName={appName}
        currentDestination={currentDestination}
        onNavigate={navigateTo}
        onOpenQuickAdd={() => setIsQuickAddOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onToggleThemeMode={toggleMode}
        resolvedThemeMode={resolvedMode}
        hasUnseenAchievements={hasUnseenAchievements}
        workspaceCounts={workspaceCounts}
        mobileDrawerOpen={mobileDrawerOpen}
        onCloseMobileDrawer={() => setMobileDrawerOpen(false)}
        mobileTriggerRef={mobileMenuTriggerRef}
        zenMode={zenMode}
        onToggleZenMode={() => toggleZenMode()}
        sidebarCollapsed={effectiveSidebarCollapsed}
        onToggleSidebarCollapsed={handleToggleSidebarCollapsed}
        collapsedGroups={collapsedGroups}
        onToggleGroupCollapsed={toggleGroupCollapsed}
        pinnedDestinations={pinnedDestinations}
        onTogglePinnedDestination={togglePinnedDestination}
        backupReminder={backupReminder}
        onQuickExportBackup={handleQuickExportBackup}
      />

      {/* Main Content Area with Smooth Page Transition */}
      <main className="flex-1 min-w-0 pb-20 md:pb-6 overflow-y-auto overflow-x-hidden focus:outline-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentDestination}
            variants={variants.page}
            initial="initial"
            animate="animate"
            exit="exit"
            className="w-full min-w-0"
          >
            {renderActiveView()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t flex justify-around items-center py-2 px-1 backdrop-blur-md"
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border)',
        }}
      >
        {[
          { id: 'home', label: 'Home', icon: Home },
          { id: 'myday', label: 'My Day', icon: Sun },
          { id: 'tasks', label: 'Tasks', icon: CheckCircle2 },
          { id: 'journal', label: 'Journal', icon: BookOpen },
          { id: 'calendar', label: 'Calendar', icon: Calendar },
        ].map(item => {
          const Icon = item.icon;
          const active = currentDestination === item.id;
          return (
            <button
              key={item.id}
              onClick={() => navigateTo(item.id as Destination)}
              className="flex flex-col items-center gap-0.5 p-1 rounded-lg transition-transform active:scale-95 relative cursor-pointer"
              style={{
                color: active ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              {active && (
                <motion.span
                  layoutId="mobileActiveIndicator"
                  className="absolute -top-1 w-8 h-1 rounded-full"
                  style={{ backgroundColor: 'var(--accent)' }}
                  transition={isReduced ? { duration: 0 } : MOTION_SPRINGS.snappy}
                />
              )}
              <Icon className="w-5 h-5 relative z-10" />
              <span className="text-[10px] font-semibold relative z-10">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
