import React, { useState, useEffect } from 'react';
import {
  Home,
  Sun,
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
  getDestinationFromLocation,
  isValidDestination,
  useNavigationState,
} from './navigationState';
import { getBackupReminderStatus } from '../services/workflowConnectService';
import { fileSystemAdapter } from '../platform/adapters';
import { useNotifications } from '../notifications/NotificationContext';

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
import { SettingsView } from '../features/settings/SettingsView';

export type { Destination } from './navigationState';

export const AppShell: React.FC = () => {
  const { toggleMode, resolvedMode } = useTheme();
  const { isReduced, variants } = useMotionPreference();
  const { notify } = useNotifications();
  const {
    currentDestination,
    zenMode,
    collapsedGroups,
    pinnedDestinations,
    navigateTo: setNavigationView,
    toggleZenMode,
    toggleGroupCollapsed,
    togglePinnedDestination,
  } = useNavigationState();
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [, setTick] = useState(0);

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
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        setIsQuickAddOpen(true);
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
  }, [setNavigationView]);

  const settings = db.getSettings();
  const appName = settings.appName || 'Daycraft';
  const hasUnseenAchievements =
    settings.gamificationEnabled && db.getUnseenAchievementIds().length > 0;
  const backupReminder = getBackupReminderStatus(settings);

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

      {/* Mobile Top Header (Small Screens) */}
      <header
        className="md:hidden flex items-center justify-between px-4 py-3 border-b sticky top-0 z-30 backdrop-blur-md"
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="Open menu drawer"
            className="p-1.5 rounded-lg border"
            style={{ borderColor: 'var(--border)' }}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div
            className="flex items-center gap-1.5 font-bold text-sm"
            style={{ color: 'var(--text-primary)' }}
          >
            <Compass className="w-4 h-4 text-amber-600" />
            <span>{appName}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSearchOpen(true)}
            aria-label="Search records"
            className="p-1.5 rounded-lg border text-stone-500"
            style={{ borderColor: 'var(--border)' }}
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsQuickAddOpen(true)}
            aria-label="Quick add"
            className="p-1.5 rounded-lg text-white"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Sidebar Navigation (Desktop + Mobile Drawer) */}
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
        zenMode={zenMode}
        onToggleZenMode={() => toggleZenMode()}
        collapsedGroups={collapsedGroups}
        onToggleGroupCollapsed={toggleGroupCollapsed}
        pinnedDestinations={pinnedDestinations}
        onTogglePinnedDestination={togglePinnedDestination}
        backupReminder={backupReminder}
        onQuickExportBackup={handleQuickExportBackup}
      />

      {/* Main Content Area with Smooth Page Transition */}
      <main className="flex-1 pb-20 md:pb-6 overflow-y-auto focus:outline-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentDestination}
            variants={variants.page}
            initial="initial"
            animate="animate"
            exit="exit"
            className="w-full"
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
