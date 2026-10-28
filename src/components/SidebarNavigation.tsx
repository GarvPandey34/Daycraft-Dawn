import React from 'react';
import {
  Compass,
  Plus,
  Search,
  Settings,
  Moon,
  X,
  ChevronDown,
  ChevronRight,
  Pin,
  Minimize2,
  Maximize2,
  Download,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Destination,
  NAV_ITEMS,
  NavGroupKey,
  ZEN_CORE_DESTINATIONS,
} from './navigationState';
import { useMotionPreference, MOTION_SPRINGS } from '../theme/motion';
import {
  BackupReminderStatus,
  extractDraggedTaskId,
  handleTaskDropToCalendar,
} from '../services/workflowConnectService';

export interface WorkspaceBadgeCounts {
  tasks: number;
  journal: number;
  calendar: number;
  [key: string]: number | undefined;
}

export interface SidebarNavigationProps {
  appName: string;
  currentDestination: Destination;
  onNavigate: (destination: Destination) => void;
  onOpenQuickAdd: () => void;
  onOpenSearch: () => void;
  onToggleThemeMode: () => void;
  resolvedThemeMode: string;
  hasUnseenAchievements: boolean;
  workspaceCounts: WorkspaceBadgeCounts;
  mobileDrawerOpen: boolean;
  onCloseMobileDrawer: () => void;
  zenMode: boolean;
  onToggleZenMode: () => void;
  collapsedGroups: NavGroupKey[];
  onToggleGroupCollapsed: (group: NavGroupKey) => void;
  pinnedDestinations: Destination[];
  onTogglePinnedDestination: (destination: Destination) => void;
  backupReminder?: BackupReminderStatus;
  onQuickExportBackup?: () => void;
}

export const SidebarNavigation: React.FC<SidebarNavigationProps> = ({
  appName,
  currentDestination,
  onNavigate,
  onOpenQuickAdd,
  onOpenSearch,
  onToggleThemeMode,
  resolvedThemeMode,
  hasUnseenAchievements,
  workspaceCounts,
  mobileDrawerOpen,
  onCloseMobileDrawer,
  zenMode,
  onToggleZenMode,
  collapsedGroups,
  onToggleGroupCollapsed,
  pinnedDestinations,
  onTogglePinnedDestination,
  backupReminder,
  onQuickExportBackup,
}) => {
  const { isReduced, variants, tactileProps } = useMotionPreference();

  const pinnedItems = pinnedDestinations
    .map(id => NAV_ITEMS.find(item => item.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const [calendarDropHover, setCalendarDropHover] = React.useState(false);

  const handleCalendarNavDragOver = (e: React.DragEvent, isCalendarItem: boolean) => {
    if (!isCalendarItem) return;
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    setCalendarDropHover(true);
  };

  const handleCalendarNavDrop = (e: React.DragEvent, isCalendarItem: boolean) => {
    if (!isCalendarItem) return;
    e.preventDefault();
    setCalendarDropHover(false);
    const taskId = extractDraggedTaskId(e.dataTransfer);
    if (taskId) {
      handleTaskDropToCalendar(taskId, {});
      onNavigate('calendar');
    }
  };

  const renderNavItem = (item: (typeof NAV_ITEMS)[number]) => {
    const Icon = item.icon;
    const active = currentDestination === item.id;
    const isPinned = pinnedDestinations.includes(item.id);
    const badgeCount = workspaceCounts[item.id] ?? 0;
    const isCalendarItem = item.id === 'calendar';
    const isCalendarDropActive = isCalendarItem && calendarDropHover;

    return (
      <div
        key={item.id}
        onDragOver={e => handleCalendarNavDragOver(e, isCalendarItem)}
        onDragLeave={() => isCalendarItem && setCalendarDropHover(false)}
        onDrop={e => handleCalendarNavDrop(e, isCalendarItem)}
        className="group/navitem relative flex items-center"
      >
        <motion.button
          {...tactileProps}
          onClick={() => onNavigate(item.id)}
          aria-current={active ? 'page' : undefined}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium relative transition-colors cursor-pointer ${
            isCalendarDropActive
              ? 'ring-2 ring-amber-500 bg-amber-500/10 font-bold'
              : active
              ? 'font-semibold'
              : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-80 hover:opacity-100'
          }`}
          style={{
            color: active || isCalendarDropActive ? 'var(--accent)' : 'var(--text-primary)',
          }}
        >
          {active && (
            <motion.span
              layoutId="sidebarActivePill"
              className="absolute inset-0 rounded-xl border"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border)',
                boxShadow: 'var(--card-shadow)',
                zIndex: 0,
              }}
              transition={isReduced ? { duration: 0 } : MOTION_SPRINGS.snappy}
            />
          )}
          {active && (
            <motion.span
              layoutId="sidebarActiveBar"
              className="absolute left-1 top-2 bottom-2 w-1 rounded-full z-10"
              style={{ backgroundColor: 'var(--accent)' }}
              transition={isReduced ? { duration: 0 } : MOTION_SPRINGS.snappy}
            />
          )}
          <Icon
            className={`w-4 h-4 shrink-0 relative z-10 ${
              active ? 'stroke-[2.2]' : ''
            }`}
          />
          <span className="truncate relative z-10 flex-1 text-left">
            {item.label}
          </span>
          {badgeCount > 0 && (
            <span
              className="text-[10px] px-1.5 py-0.2 rounded-full font-semibold tabular-nums relative z-10 group-hover/navitem:opacity-0 transition-opacity"
              style={{
                backgroundColor: 'var(--bg-surface-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              {badgeCount}
            </span>
          )}
          {item.id === 'achievements' && hasUnseenAchievements && (
            <span
              title="New achievement unlocked"
              aria-label="New achievement unlocked"
              className="w-2 h-2 rounded-full bg-amber-500 shrink-0 relative z-10"
            />
          )}
        </motion.button>

        {/* Pin / Unpin to Top Favorites button */}
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onTogglePinnedDestination(item.id);
          }}
          title={isPinned ? `Unpin ${item.label} from top switcher` : `Pin ${item.label} to top switcher (max 4)`}
          aria-label={isPinned ? `Unpin ${item.label}` : `Pin ${item.label}`}
          className={`absolute right-2 z-20 p-1 rounded-md transition-opacity cursor-pointer ${
            isPinned
              ? 'opacity-65 hover:opacity-100 text-amber-600'
              : 'opacity-0 group-hover/navitem:opacity-70 hover:!opacity-100 text-stone-400'
          }`}
        >
          <Pin className={`w-3 h-3 ${isPinned ? 'fill-current' : ''}`} />
        </button>
      </div>
    );
  };

  const renderCategorySection = (title: string, group: 'core' | 'planning' | 'reflection') => {
    const items = NAV_ITEMS.filter(i => i.group === group);
    const isCollapsed = collapsedGroups.includes(group);

    return (
      <div>
        <button
          type="button"
          onClick={() => onToggleGroupCollapsed(group)}
          aria-expanded={!isCollapsed}
          className="w-full flex items-center justify-between text-[10px] uppercase font-semibold tracking-wider px-3 py-1 mb-1 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors cursor-pointer"
        >
          <span>{title}</span>
          {isCollapsed ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              variants={variants.accordion}
              initial="initial"
              animate="animate"
              exit="exit"
              className="space-y-0.5 overflow-hidden"
            >
              {items.map(renderNavItem)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        aria-label="Sidebar Navigation"
        className="hidden md:flex flex-col w-64 border-r shrink-0 min-h-screen p-4 sticky top-0 h-screen overflow-y-auto"
        style={{
          backgroundColor: 'var(--sidebar-bg)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Brand & Zen Mode Toggle */}
        <div
          className="flex items-center justify-between pb-4 mb-2 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-xs transition-transform hover:scale-105"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Compass className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h1
                className="text-sm font-bold tracking-tight"
                style={{ color: 'var(--text-primary)' }}
              >
                {appName}
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                <span
                  className="text-[11px] font-medium tracking-tight"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Offline · Local OS
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleZenMode}
            title={
              zenMode
                ? 'Disable Zen Mode (Show all 15 destinations)'
                : 'Enable Zen Mode (Core views only: My Day, Tasks, Journal, Calendar, Habits)'
            }
            aria-pressed={zenMode}
            className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
              zenMode ? 'shadow-xs' : 'opacity-75 hover:opacity-100'
            }`}
            style={{
              backgroundColor: zenMode ? 'var(--accent)' : 'var(--bg-surface)',
              borderColor: zenMode ? 'var(--accent)' : 'var(--border)',
              color: zenMode ? 'var(--accent-foreground)' : 'var(--text-secondary)',
            }}
          >
            {zenMode ? (
              <Maximize2 className="w-3 h-3" />
            ) : (
              <Minimize2 className="w-3 h-3" />
            )}
            <span>{zenMode ? 'Zen' : 'Core'}</span>
          </button>
        </div>

        {/* Global Action Buttons */}
        <div className="space-y-2 mb-3">
          <button
            onClick={onOpenQuickAdd}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold shadow-xs transition-all hover:brightness-105 active:scale-[0.98] cursor-pointer"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-foreground)',
            }}
          >
            <span className="flex items-center gap-2">
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Quick Add</span>
            </span>
            <kbd
              className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium opacity-85"
              style={{ backgroundColor: 'rgba(0,0,0,0.18)' }}
            >
              ⌘Q
            </kbd>
          </button>

          <button
            onClick={onOpenSearch}
            className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl border text-xs font-medium transition-all hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.99] cursor-pointer"
            style={{
              borderColor: 'var(--border)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-secondary)',
            }}
          >
            <span className="flex items-center gap-2.5">
              <Search className="w-3.5 h-3.5 opacity-70" />
              <span>Command & Search</span>
            </span>
            <kbd
              className="text-[10px] px-1.5 py-0.5 rounded font-mono text-stone-400 dark:text-stone-500 border"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--bg-surface-subtle)',
              }}
            >
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Pinned Favorites & Primary Switcher */}
        <div
          className="mb-4 p-2 rounded-2xl border"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="flex items-center justify-between px-2 pb-1.5">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-stone-400 dark:text-stone-500 flex items-center gap-1">
              <Pin className="w-2.5 h-2.5" />
              <span>Pinned Views</span>
            </span>
            <span
              className="text-[10px] font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              {pinnedItems.length}/4 pinned
            </span>
          </div>
          <div
            role="tablist"
            aria-label="Pinned Workspace Views"
            className={`grid gap-1 ${
              pinnedItems.length === 4
                ? 'grid-cols-2'
                : pinnedItems.length === 2
                ? 'grid-cols-2'
                : 'grid-cols-3'
            }`}
          >
            {pinnedItems.map(item => {
              const Icon = item.icon;
              const active = currentDestination === item.id;
              const count = workspaceCounts[item.id] ?? 0;
              const isCalendarItem = item.id === 'calendar';
              const isCalendarDropActive = isCalendarItem && calendarDropHover;
              return (
                <button
                  key={item.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => onNavigate(item.id)}
                  onDragOver={e => handleCalendarNavDragOver(e, isCalendarItem)}
                  onDragLeave={() => isCalendarItem && setCalendarDropHover(false)}
                  onDrop={e => handleCalendarNavDrop(e, isCalendarItem)}
                  className={`flex flex-col items-center justify-center py-2 px-1.5 rounded-xl text-[11px] font-semibold relative transition-all cursor-pointer ${
                    isCalendarDropActive
                      ? 'ring-2 ring-amber-500 bg-amber-500/10'
                      : active
                      ? 'shadow-xs'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-80 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: active
                      ? 'var(--accent)'
                      : 'var(--bg-surface-subtle)',
                    color: active
                      ? 'var(--accent-foreground)'
                      : 'var(--text-primary)',
                  }}
                >
                  <div className="flex items-center gap-1">
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {count > 0 && (
                      <span
                        className="text-[9px] px-1 rounded-full font-bold leading-tight"
                        style={{
                          backgroundColor: active
                            ? 'rgba(255,255,255,0.22)'
                            : 'var(--bg-surface-elevated)',
                          color: active
                            ? 'var(--accent-foreground)'
                            : 'var(--text-secondary)',
                        }}
                      >
                        {count}
                      </span>
                    )}
                  </div>
                  <span className="mt-1 truncate max-w-full">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation Categories or Zen Core Mode */}
        <nav aria-label="Main Navigation" className="flex-1 space-y-3">
          {zenMode ? (
            <div>
              <div className="flex items-center justify-between px-3 mb-1.5">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-stone-400 dark:text-stone-500">
                  Zen Core Workspace
                </span>
                <button
                  type="button"
                  onClick={onToggleZenMode}
                  className="text-[10px] font-semibold hover:underline cursor-pointer"
                  style={{ color: 'var(--accent)' }}
                >
                  Show All
                </button>
              </div>
              <div className="space-y-0.5">
                {NAV_ITEMS.filter(i => ZEN_CORE_DESTINATIONS.includes(i.id)).map(
                  renderNavItem
                )}
              </div>
            </div>
          ) : (
            <>
              {renderCategorySection('Daily Flow', 'core')}
              {renderCategorySection('Planning & Sprints', 'planning')}
              {renderCategorySection('Reflect & Growth', 'reflection')}
            </>
          )}
        </nav>

        {/* Bottom Sidebar Footer */}
        <div
          className="pt-3 border-t mt-4 space-y-1.5"
          style={{ borderColor: 'var(--border)' }}
        >
          {/* Gentle 14-Day Local Backup Reminder */}
          {backupReminder?.isDue && (
            <div
              className="p-2.5 rounded-xl border text-[11px] flex items-center justify-between gap-2"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border)',
              }}
            >
              <div className="min-w-0">
                <div
                  className="font-semibold truncate"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Local Backup Due
                </div>
                <div
                  className="text-[10px] truncate"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {backupReminder.label}
                </div>
              </div>
              {onQuickExportBackup && (
                <button
                  type="button"
                  onClick={onQuickExportBackup}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold shrink-0 flex items-center gap-1 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-foreground)',
                  }}
                >
                  <Download className="w-3 h-3" />
                  <span>Backup</span>
                </button>
              )}
            </div>
          )}

          <motion.button
            {...tactileProps}
            onClick={() => onNavigate('settings')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold relative transition-colors cursor-pointer ${
              currentDestination === 'settings'
                ? 'font-bold'
                : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-80 hover:opacity-100'
            }`}
            style={{
              color:
                currentDestination === 'settings'
                  ? 'var(--accent)'
                  : 'var(--text-secondary)',
            }}
          >
            {currentDestination === 'settings' && (
              <motion.span
                layoutId="sidebarActivePill"
                className="absolute inset-0 rounded-xl border"
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border)',
                  boxShadow: 'var(--card-shadow)',
                  zIndex: 0,
                }}
                transition={isReduced ? { duration: 0 } : MOTION_SPRINGS.snappy}
              />
            )}
            <Settings className="w-4 h-4 relative z-10" />
            <span className="relative z-10">Settings</span>
          </motion.button>

          <button
            onClick={onToggleThemeMode}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold hover:bg-black/5 cursor-pointer"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span className="flex items-center gap-2.5">
              <Moon className="w-4 h-4" />
              <span>Theme: {resolvedThemeMode}</span>
            </span>
            <span
              className="text-[10px] uppercase font-bold"
              style={{ color: 'var(--text-muted)' }}
            >
              Toggle
            </span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileDrawerOpen && (
          <motion.div
            variants={variants.modalOverlay}
            initial="initial"
            animate="animate"
            exit="exit"
            role="dialog"
            aria-modal="true"
            className="md:hidden fixed inset-0 z-50 flex backdrop-blur-xs bg-black/40"
          >
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={
                isReduced ? { duration: 0.1 } : { duration: 0.22, ease: 'easeOut' }
              }
              className="w-72 h-full p-4 flex flex-col overflow-y-auto border-r shadow-2xl"
              style={{
                backgroundColor: 'var(--sidebar-bg)',
                borderColor: 'var(--border)',
              }}
            >
              <div
                className="flex items-center justify-between pb-3 border-b mb-3"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex items-center gap-2">
                  <Compass className="w-5 h-5 text-amber-600" />
                  <span className="font-bold text-sm">{appName}</span>
                </div>
                <button
                  onClick={onCloseMobileDrawer}
                  aria-label="Close menu"
                  className="p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile Pinned Views Switcher */}
              <div
                className="mb-3 p-2 rounded-xl border"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border)',
                }}
              >
                <div className="flex items-center justify-between text-[10px] uppercase font-semibold tracking-wider px-1 pb-1.5 text-stone-400">
                  <span>Pinned Views</span>
                  <button
                    type="button"
                    onClick={onToggleZenMode}
                    className="text-[10px] font-bold"
                    style={{ color: 'var(--accent)' }}
                  >
                    {zenMode ? 'All Views' : 'Zen Mode'}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {pinnedItems.map(item => {
                    const Icon = item.icon;
                    const active = currentDestination === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onNavigate(item.id)}
                        className="flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[11px] font-semibold cursor-pointer"
                        style={{
                          backgroundColor: active
                            ? 'var(--accent)'
                            : 'var(--bg-surface-subtle)',
                          color: active
                            ? 'var(--accent-foreground)'
                            : 'var(--text-primary)',
                        }}
                      >
                        <Icon className="w-3.5 h-3.5 mb-0.5" />
                        <span className="truncate max-w-full">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <nav className="space-y-1 flex-1">
                {(zenMode
                  ? NAV_ITEMS.filter(i => ZEN_CORE_DESTINATIONS.includes(i.id))
                  : NAV_ITEMS
                ).map(item => {
                  const Icon = item.icon;
                  const active = currentDestination === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                        active ? 'font-bold' : ''
                      }`}
                      style={{
                        backgroundColor: active ? 'var(--accent)' : 'transparent',
                        color: active
                          ? 'var(--accent-foreground)'
                          : 'var(--text-primary)',
                      }}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.id === 'achievements' && hasUnseenAchievements && (
                        <span
                          title="New achievement unlocked"
                          aria-label="New achievement unlocked"
                          className="w-2 h-2 rounded-full bg-amber-500 shrink-0"
                        />
                      )}
                    </button>
                  );
                })}
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
