import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Compass,
  Plus,
  Search,
  Settings,
  BookOpen,
  Moon,
  Sun,
  X,
  ChevronDown,
  ChevronRight,
  Pin,
  Minimize2,
  Maximize2,
  Download,
  PanelLeftClose,
  PanelLeftOpen,
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
  mobileTriggerRef?: React.RefObject<HTMLButtonElement | null>;
  zenMode: boolean;
  onToggleZenMode: () => void;
  collapsedGroups: NavGroupKey[];
  onToggleGroupCollapsed: (group: NavGroupKey) => void;
  pinnedDestinations: Destination[];
  onTogglePinnedDestination: (destination: Destination) => void;
  sidebarCollapsed: boolean;
  onToggleSidebarCollapsed: () => void;
  backupReminder?: BackupReminderStatus;
  onQuickExportBackup?: () => void;
}

interface ActiveRailTooltip {
  label: string;
  sublabel?: string;
  shortcut?: string;
  badge?: number | string;
  top: number;
  left: number;
}

const GROUP_LABELS: Record<'core' | 'planning' | 'reflection', string> = {
  core: 'Daily Flow',
  planning: 'Planning & Sprints',
  reflection: 'Reflect & Growth',
};

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
  mobileTriggerRef,
  zenMode,
  onToggleZenMode,
  collapsedGroups,
  onToggleGroupCollapsed,
  pinnedDestinations,
  onTogglePinnedDestination,
  sidebarCollapsed,
  onToggleSidebarCollapsed,
  backupReminder,
  onQuickExportBackup,
}) => {
  const { isReduced, variants, tactileProps } = useMotionPreference();

  const pinnedItems = pinnedDestinations
    .map(id => NAV_ITEMS.find(item => item.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const [calendarDropHover, setCalendarDropHover] = useState(false);
  const [railTooltip, setRailTooltip] = useState<ActiveRailTooltip | null>(null);

  const drawerPanelRef = useRef<HTMLDivElement | null>(null);
  const closeDrawerButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasMobileDrawerOpenRef = useRef(false);

  // Clear tooltip whenever sidebar expands or destination changes
  useEffect(() => {
    setRailTooltip(null);
  }, [sidebarCollapsed, currentDestination]);

  // Lock body scroll, manage focus entry/return, and trap Tab focus + Escape key when mobile drawer is open
  useEffect(() => {
    if (!mobileDrawerOpen) {
      if (wasMobileDrawerOpenRef.current) {
        wasMobileDrawerOpenRef.current = false;
        mobileTriggerRef?.current?.focus();
      }
      return;
    }

    wasMobileDrawerOpenRef.current = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      closeDrawerButtonRef.current?.focus();
    }, 30);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCloseMobileDrawer();
        return;
      }

      if (e.key === 'Tab' && drawerPanelRef.current) {
        const focusable = drawerPanelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [mobileDrawerOpen, onCloseMobileDrawer, mobileTriggerRef]);

  const showRailTooltip = useCallback(
    (
      e: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>,
      info: Omit<ActiveRailTooltip, 'top' | 'left'>
    ) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setRailTooltip({
        ...info,
        top: rect.top + rect.height / 2,
        left: rect.right + 10,
      });
    },
    []
  );

  const hideRailTooltip = useCallback(() => {
    setRailTooltip(null);
  }, []);

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

  const renderExpandedNavItem = (
    item: (typeof NAV_ITEMS)[number],
    layoutScope: 'desktop' | 'mobile'
  ) => {
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
          type="button"
          onClick={() => onNavigate(item.id)}
          aria-current={active ? 'page' : undefined}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium relative transition-colors cursor-pointer ${
            isCalendarDropActive
              ? 'ring-2 font-bold'
              : active
              ? 'font-semibold'
              : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-85 hover:opacity-100'
          }`}
          style={{
            color: active || isCalendarDropActive ? 'var(--accent)' : 'var(--text-primary)',
            ...(isCalendarDropActive
              ? {
                  backgroundColor: 'var(--accent-subtle)',
                  borderColor: 'var(--accent)',
                }
              : {}),
          }}
        >
          {active && (
            <motion.span
              layoutId={`${layoutScope}SidebarActivePill`}
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
              layoutId={`${layoutScope}SidebarActiveBar`}
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
              className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold tabular-nums relative z-10 group-hover/navitem:opacity-0 transition-opacity"
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
              className="w-2 h-2 rounded-full shrink-0 relative z-10"
              style={{ backgroundColor: 'var(--warning)' }}
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
          title={
            isPinned
              ? `Unpin ${item.label} from top switcher`
              : `Pin ${item.label} to top switcher (max 4)`
          }
          aria-label={isPinned ? `Unpin ${item.label}` : `Pin ${item.label}`}
          className={`absolute right-2 z-20 p-1 rounded-md transition-opacity cursor-pointer ${
            isPinned
              ? 'opacity-75 hover:opacity-100'
              : 'opacity-0 group-hover/navitem:opacity-70 focus-visible:opacity-100 hover:!opacity-100'
          }`}
          style={{
            color: isPinned ? 'var(--accent)' : 'var(--text-muted)',
          }}
        >
          <Pin className={`w-3 h-3 ${isPinned ? 'fill-current' : ''}`} />
        </button>
      </div>
    );
  };

  const renderCollapsedRailNavItem = (item: (typeof NAV_ITEMS)[number]) => {
    const Icon = item.icon;
    const active = currentDestination === item.id;
    const isPinned = pinnedDestinations.includes(item.id);
    const badgeCount = workspaceCounts[item.id] ?? 0;
    const isCalendarItem = item.id === 'calendar';
    const isCalendarDropActive = isCalendarItem && calendarDropHover;
    const groupLabel =
      item.group !== 'system' ? GROUP_LABELS[item.group] : 'System';

    const accessibleLabel =
      badgeCount > 0 ? `${item.label} (${badgeCount})` : item.label;

    return (
      <div
        key={item.id}
        onDragOver={e => handleCalendarNavDragOver(e, isCalendarItem)}
        onDragLeave={() => isCalendarItem && setCalendarDropHover(false)}
        onDrop={e => handleCalendarNavDrop(e, isCalendarItem)}
        className="relative flex justify-center"
      >
        <motion.button
          {...tactileProps}
          type="button"
          onClick={() => onNavigate(item.id)}
          onMouseEnter={e =>
            showRailTooltip(e, {
              label: item.label,
              sublabel: isPinned ? `${groupLabel} · Pinned` : groupLabel,
              shortcut: item.shortcut,
              badge: badgeCount > 0 ? badgeCount : undefined,
            })
          }
          onMouseLeave={hideRailTooltip}
          onFocus={e =>
            showRailTooltip(e, {
              label: item.label,
              sublabel: isPinned ? `${groupLabel} · Pinned` : groupLabel,
              shortcut: item.shortcut,
              badge: badgeCount > 0 ? badgeCount : undefined,
            })
          }
          onBlur={hideRailTooltip}
          title={accessibleLabel}
          aria-label={accessibleLabel}
          aria-current={active ? 'page' : undefined}
          className={`w-11 h-10 rounded-xl flex items-center justify-center relative transition-colors cursor-pointer ${
            isCalendarDropActive
              ? 'ring-2 font-bold'
              : active
              ? 'font-semibold'
              : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-80 hover:opacity-100'
          }`}
          style={{
            color: active || isCalendarDropActive ? 'var(--accent)' : 'var(--text-primary)',
            ...(isCalendarDropActive
              ? {
                  backgroundColor: 'var(--accent-subtle)',
                  borderColor: 'var(--accent)',
                }
              : {}),
          }}
        >
          {active && (
            <motion.span
              layoutId="desktopSidebarActivePill"
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
              layoutId="desktopSidebarActiveBar"
              className="absolute left-0.5 top-2 bottom-2 w-1 rounded-full z-10"
              style={{ backgroundColor: 'var(--accent)' }}
              transition={isReduced ? { duration: 0 } : MOTION_SPRINGS.snappy}
            />
          )}
          <Icon
            className={`w-4 h-4 shrink-0 relative z-10 ${
              active ? 'stroke-[2.25]' : ''
            }`}
          />

          {/* Subtle badge count pill in collapsed rail */}
          {badgeCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold tabular-nums flex items-center justify-center z-20 border"
              style={{
                backgroundColor: active ? 'var(--accent)' : 'var(--bg-surface-elevated)',
                color: active ? 'var(--accent-foreground)' : 'var(--text-secondary)',
                borderColor: 'var(--border)',
              }}
            >
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          )}

          {/* Unseen achievement dot */}
          {item.id === 'achievements' && hasUnseenAchievements && (
            <span
              aria-label="New achievement unlocked"
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full z-20"
              style={{ backgroundColor: 'var(--warning)' }}
            />
          )}
        </motion.button>
      </div>
    );
  };

  const renderCategorySection = (
    title: string,
    group: 'core' | 'planning' | 'reflection',
    layoutScope: 'desktop' | 'mobile'
  ) => {
    const items = NAV_ITEMS.filter(i => i.group === group);
    const isCollapsed = collapsedGroups.includes(group);

    return (
      <div>
        <button
          type="button"
          onClick={() => onToggleGroupCollapsed(group)}
          aria-expanded={!isCollapsed}
          className="w-full flex items-center justify-between text-[10px] uppercase font-semibold tracking-wider px-3 py-1 mb-1 transition-opacity opacity-75 hover:opacity-100 cursor-pointer"
          style={{ color: 'var(--text-muted)' }}
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
              {items.map(item => renderExpandedNavItem(item, layoutScope))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const ThemeModeIcon = resolvedThemeMode === 'dark' ? Moon : Sun;

  return (
    <>
      {/* Desktop & Tablet Persistent Sidebar (Expanded State A or Collapsed Icon Rail State B) */}
      <aside
        aria-label="Sidebar Navigation"
        data-sidebar-state={sidebarCollapsed ? 'collapsed' : 'expanded'}
        className={`hidden md:flex flex-col border-r shrink-0 min-h-screen sticky top-0 h-screen overflow-y-auto overflow-x-hidden select-none ${
          sidebarCollapsed ? 'w-[76px] px-2.5 py-3.5' : 'w-[272px] p-4'
        } ${
          isReduced
            ? ''
            : 'transition-[width,padding] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]'
        }`}
        style={{
          backgroundColor: 'var(--sidebar-bg)',
          borderColor: 'var(--border)',
        }}
      >
        {sidebarCollapsed ? (
          /* =================================================================
             STATE B: COLLAPSED DESKTOP / TABLET ICON RAIL
             ================================================================= */
          <>
            {/* Top Brand Mark + Expand Control */}
            <div
              className="flex flex-col items-center gap-2 pb-3 mb-2.5 border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              <button
                type="button"
                onClick={() => onNavigate('home')}
                onMouseEnter={e =>
                  showRailTooltip(e, {
                    label: `${appName} — Home`,
                    sublabel: 'Offline · Local OS',
                  })
                }
                onMouseLeave={hideRailTooltip}
                onFocus={e =>
                  showRailTooltip(e, {
                    label: `${appName} — Home`,
                    sublabel: 'Offline · Local OS',
                  })
                }
                onBlur={hideRailTooltip}
                title={`${appName} — Home`}
                aria-label={`${appName} Home`}
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold shadow-xs transition-transform hover:scale-105 cursor-pointer relative"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-foreground)',
                }}
              >
                <Compass className="w-5 h-5 stroke-[2.2]" />
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                  style={{
                    backgroundColor: 'var(--success)',
                    borderColor: 'var(--sidebar-bg)',
                  }}
                />
              </button>

              <button
                type="button"
                onClick={onToggleSidebarCollapsed}
                onMouseEnter={e =>
                  showRailTooltip(e, {
                    label: 'Expand sidebar',
                    shortcut: '⌘B',
                  })
                }
                onMouseLeave={hideRailTooltip}
                onFocus={e =>
                  showRailTooltip(e, {
                    label: 'Expand sidebar',
                    shortcut: '⌘B',
                  })
                }
                onBlur={hideRailTooltip}
                title="Expand sidebar (⌘B)"
                aria-label="Expand sidebar"
                aria-expanded={false}
                className="w-10 h-8 rounded-lg border flex items-center justify-center transition-colors hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-secondary)',
                }}
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            </div>

            {/* Global Actions: Quick Add & Command/Search */}
            <div className="flex flex-col items-center gap-2 mb-3">
              <button
                type="button"
                onClick={onOpenQuickAdd}
                onMouseEnter={e =>
                  showRailTooltip(e, {
                    label: 'Quick Add',
                    sublabel: 'Create task, habit, event, or note',
                    shortcut: '⌘Q',
                  })
                }
                onMouseLeave={hideRailTooltip}
                onFocus={e =>
                  showRailTooltip(e, {
                    label: 'Quick Add',
                    sublabel: 'Create task, habit, event, or note',
                    shortcut: '⌘Q',
                  })
                }
                onBlur={hideRailTooltip}
                title="Quick Add (⌘Q)"
                aria-label="Quick Add"
                className="w-11 h-10 rounded-xl flex items-center justify-center shadow-xs transition-all hover:brightness-105 active:scale-[0.97] cursor-pointer"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-foreground)',
                }}
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
              </button>

              <button
                type="button"
                onClick={onOpenSearch}
                onMouseEnter={e =>
                  showRailTooltip(e, {
                    label: 'Command & Search',
                    sublabel: 'Jump to view or run action',
                    shortcut: '⌘K',
                  })
                }
                onMouseLeave={hideRailTooltip}
                onFocus={e =>
                  showRailTooltip(e, {
                    label: 'Command & Search',
                    sublabel: 'Jump to view or run action',
                    shortcut: '⌘K',
                  })
                }
                onBlur={hideRailTooltip}
                title="Command & Search (⌘K)"
                aria-label="Command & Search"
                className="w-11 h-9 rounded-xl border flex items-center justify-center transition-all hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98] cursor-pointer"
                style={{
                  borderColor: 'var(--border)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-secondary)',
                }}
              >
                <Search className="w-4 h-4" />
              </button>
            </div>

            {/* Compact Pinned Views Strip */}
            {pinnedItems.length > 0 && (
              <div
                role="tablist"
                aria-label="Pinned Workspace Views"
                className="mb-2.5 py-1.5 px-1 rounded-2xl border flex flex-col items-center gap-1"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border)',
                }}
              >
                <span
                  className="text-[9px] uppercase font-bold tracking-wider flex items-center gap-0.5"
                  style={{ color: 'var(--text-muted)' }}
                  title={`Pinned Views (${pinnedItems.length}/4)`}
                >
                  <Pin className="w-2.5 h-2.5" />
                </span>
                {pinnedItems.map(item => {
                  const Icon = item.icon;
                  const active = currentDestination === item.id;
                  const count = workspaceCounts[item.id] ?? 0;
                  const isCalendarItem = item.id === 'calendar';
                  const isCalendarDropActive = isCalendarItem && calendarDropHover;
                  return (
                    <button
                      key={`rail_pin_${item.id}`}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      aria-label={`Pinned: ${item.label}`}
                      title={`Pinned: ${item.label}`}
                      onClick={() => onNavigate(item.id)}
                      onDragOver={e => handleCalendarNavDragOver(e, isCalendarItem)}
                      onDragLeave={() => isCalendarItem && setCalendarDropHover(false)}
                      onDrop={e => handleCalendarNavDrop(e, isCalendarItem)}
                      onMouseEnter={e =>
                        showRailTooltip(e, {
                          label: item.label,
                          sublabel: 'Pinned View',
                          shortcut: item.shortcut,
                          badge: count > 0 ? count : undefined,
                        })
                      }
                      onMouseLeave={hideRailTooltip}
                      onFocus={e =>
                        showRailTooltip(e, {
                          label: item.label,
                          sublabel: 'Pinned View',
                          shortcut: item.shortcut,
                          badge: count > 0 ? count : undefined,
                        })
                      }
                      onBlur={hideRailTooltip}
                      className={`w-9 h-8 rounded-lg flex items-center justify-center relative transition-all cursor-pointer ${
                        isCalendarDropActive
                          ? 'ring-2'
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
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      {count > 0 && (
                        <span
                          className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                          style={{
                            backgroundColor: active
                              ? 'var(--accent-foreground)'
                              : 'var(--accent)',
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Main Navigation Icons */}
            <nav
              aria-label="Main Navigation"
              className="flex-1 flex flex-col items-center space-y-1"
            >
              {zenMode ? (
                <>
                  {NAV_ITEMS.filter(i => ZEN_CORE_DESTINATIONS.includes(i.id)).map(
                    renderCollapsedRailNavItem
                  )}
                </>
              ) : (
                <>
                  {NAV_ITEMS.filter(i => i.group === 'core').map(
                    renderCollapsedRailNavItem
                  )}
                  <div
                    role="separator"
                    className="w-7 my-1.5 border-t"
                    style={{ borderColor: 'var(--border)' }}
                  />
                  {NAV_ITEMS.filter(i => i.group === 'planning').map(
                    renderCollapsedRailNavItem
                  )}
                  <div
                    role="separator"
                    className="w-7 my-1.5 border-t"
                    style={{ borderColor: 'var(--border)' }}
                  />
                  {NAV_ITEMS.filter(i => i.group === 'reflection').map(
                    renderCollapsedRailNavItem
                  )}
                </>
              )}
            </nav>

            {/* Bottom Rail Utilities */}
            <div
              className="pt-2.5 mt-3 border-t flex flex-col items-center gap-1"
              style={{ borderColor: 'var(--border)' }}
            >
              {/* Zen Mode toggle in rail */}
              <button
                type="button"
                onClick={onToggleZenMode}
                aria-pressed={zenMode}
                aria-label={
                  zenMode
                    ? `Disable Zen Mode (Show all ${NAV_ITEMS.length} destinations)`
                    : 'Enable Zen Mode (Core views only)'
                }
                title={
                  zenMode
                    ? 'Disable Zen Mode (Show all destinations)'
                    : 'Enable Zen Mode (Core views only)'
                }
                onMouseEnter={e =>
                  showRailTooltip(e, {
                    label: zenMode ? 'Zen Mode: On' : 'Core / Zen Mode',
                    sublabel: zenMode
                      ? 'Click to show all 16 destinations'
                      : 'Click to focus on 5 core views',
                  })
                }
                onMouseLeave={hideRailTooltip}
                onFocus={e =>
                  showRailTooltip(e, {
                    label: zenMode ? 'Zen Mode: On' : 'Core / Zen Mode',
                    sublabel: zenMode
                      ? 'Click to show all 16 destinations'
                      : 'Click to focus on 5 core views',
                  })
                }
                onBlur={hideRailTooltip}
                className="w-11 h-9 rounded-xl border flex items-center justify-center transition-colors cursor-pointer"
                style={{
                  backgroundColor: zenMode ? 'var(--accent)' : 'var(--bg-surface)',
                  borderColor: zenMode ? 'var(--accent)' : 'var(--border)',
                  color: zenMode ? 'var(--accent-foreground)' : 'var(--text-secondary)',
                }}
              >
                {zenMode ? (
                  <Maximize2 className="w-3.5 h-3.5" />
                ) : (
                  <Minimize2 className="w-3.5 h-3.5" />
                )}
              </button>

              {backupReminder?.isDue && onQuickExportBackup && (
                <button
                  type="button"
                  onClick={onQuickExportBackup}
                  aria-label="Local Backup Due — Export Backup"
                  title={`Local Backup Due (${backupReminder.label})`}
                  onMouseEnter={e =>
                    showRailTooltip(e, {
                      label: 'Local Backup Due',
                      sublabel: `${backupReminder.label} · Click to export`,
                    })
                  }
                  onMouseLeave={hideRailTooltip}
                  onFocus={e =>
                    showRailTooltip(e, {
                      label: 'Local Backup Due',
                      sublabel: `${backupReminder.label} · Click to export`,
                    })
                  }
                  onBlur={hideRailTooltip}
                  className="w-11 h-9 rounded-xl border flex items-center justify-center cursor-pointer"
                  style={{
                    backgroundColor: 'var(--warning-subtle)',
                    borderColor: 'var(--warning)',
                    color: 'var(--warning)',
                  }}
                >
                  <Download className="w-4 h-4" />
                </button>
              )}

              {/* Permanent App Tutorial — immediately above Settings */}
              {renderCollapsedRailNavItem(
                NAV_ITEMS.find(i => i.id === 'tutorial')!
              )}

              {/* Settings */}
              {renderCollapsedRailNavItem(
                NAV_ITEMS.find(i => i.id === 'settings')!
              )}

              {/* Theme Mode Toggle */}
              <button
                type="button"
                onClick={onToggleThemeMode}
                aria-label={`Toggle theme mode (currently ${resolvedThemeMode})`}
                title={`Theme: ${resolvedThemeMode} (Click to toggle)`}
                onMouseEnter={e =>
                  showRailTooltip(e, {
                    label: `Theme: ${resolvedThemeMode}`,
                    sublabel: 'Click to switch light / dark mode',
                  })
                }
                onMouseLeave={hideRailTooltip}
                onFocus={e =>
                  showRailTooltip(e, {
                    label: `Theme: ${resolvedThemeMode}`,
                    sublabel: 'Click to switch light / dark mode',
                  })
                }
                onBlur={hideRailTooltip}
                className="w-11 h-9 rounded-xl flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                style={{ color: 'var(--text-secondary)' }}
              >
                <ThemeModeIcon className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          /* =================================================================
             STATE A: EXPANDED DESKTOP SIDEBAR
             ================================================================= */
          <>
            {/* Brand, Zen Mode Toggle & Collapse Sidebar Control */}
            <div
              className="flex items-center justify-between gap-2 pb-4 mb-2 border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => onNavigate('home')}
                  title={`${appName} — Home`}
                  aria-label={`${appName} Home`}
                  className="w-9 h-9 rounded-xl flex items-center justify-center font-bold shadow-xs transition-transform hover:scale-105 shrink-0 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-foreground)',
                  }}
                >
                  <Compass className="w-5 h-5 stroke-[2.2]" />
                </button>
                <div className="min-w-0">
                  <h1
                    className="text-sm font-bold tracking-tight truncate"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {appName}
                  </h1>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
                      style={{ backgroundColor: 'var(--success)' }}
                    />
                    <span
                      className="text-[11px] font-medium tracking-tight truncate"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Offline · Local OS
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={onToggleZenMode}
                  title={
                    zenMode
                      ? `Disable Zen Mode (Show all ${NAV_ITEMS.length} destinations)`
                      : 'Enable Zen Mode (Core views only: My Day, Tasks, Journal, Calendar, Habits)'
                  }
                  aria-pressed={zenMode}
                  className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    zenMode ? 'shadow-xs' : 'opacity-80 hover:opacity-100'
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

                <button
                  type="button"
                  onClick={onToggleSidebarCollapsed}
                  title="Collapse sidebar (⌘B)"
                  aria-label="Collapse sidebar"
                  aria-expanded={true}
                  className="p-1.5 rounded-lg border transition-colors hover:bg-black/5 dark:hover:bg-white/5 opacity-80 hover:opacity-100 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Global Action Buttons */}
            <div className="space-y-2 mb-3">
              <button
                type="button"
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
                type="button"
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
                  className="text-[10px] px-1.5 py-0.5 rounded font-mono border"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--bg-surface-subtle)',
                    color: 'var(--text-muted)',
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
                <span
                  className="text-[10px] uppercase font-semibold tracking-wider flex items-center gap-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Pin className="w-2.5 h-2.5" />
                  <span>Pinned Views</span>
                </span>
                <span
                  className="text-[10px] font-medium tabular-nums"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {pinnedItems.length}/4 pinned
                </span>
              </div>
              <div
                role="tablist"
                aria-label="Pinned Workspace Views"
                className={`grid gap-1 ${
                  pinnedItems.length === 4 || pinnedItems.length === 2
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
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => onNavigate(item.id)}
                      onDragOver={e => handleCalendarNavDragOver(e, isCalendarItem)}
                      onDragLeave={() => isCalendarItem && setCalendarDropHover(false)}
                      onDrop={e => handleCalendarNavDrop(e, isCalendarItem)}
                      className={`flex flex-col items-center justify-center py-2 px-1.5 rounded-xl text-[11px] font-semibold relative transition-all cursor-pointer ${
                        isCalendarDropActive
                          ? 'ring-2'
                          : active
                          ? 'shadow-xs'
                          : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-85 hover:opacity-100'
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
                            className="text-[9px] px-1 rounded-full font-bold leading-tight tabular-nums"
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
                    <span
                      className="text-[10px] uppercase font-semibold tracking-wider"
                      style={{ color: 'var(--text-muted)' }}
                    >
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
                      item => renderExpandedNavItem(item, 'desktop')
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {renderCategorySection('Daily Flow', 'core', 'desktop')}
                  {renderCategorySection('Planning & Sprints', 'planning', 'desktop')}
                  {renderCategorySection('Reflect & Growth', 'reflection', 'desktop')}
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

              {/* Permanent App Tutorial — immediately above Settings */}
              <motion.button
                {...tactileProps}
                type="button"
                onClick={() => onNavigate('tutorial')}
                aria-current={currentDestination === 'tutorial' ? 'page' : undefined}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold relative transition-colors cursor-pointer ${
                  currentDestination === 'tutorial'
                    ? 'font-bold'
                    : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-85 hover:opacity-100'
                }`}
                style={{
                  color:
                    currentDestination === 'tutorial'
                      ? 'var(--accent)'
                      : 'var(--text-secondary)',
                }}
              >
                {currentDestination === 'tutorial' && (
                  <motion.span
                    layoutId="desktopSidebarActivePill"
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
                {currentDestination === 'tutorial' && (
                  <motion.span
                    layoutId="desktopSidebarActiveBar"
                    className="absolute left-1 top-2 bottom-2 w-1 rounded-full z-10"
                    style={{ backgroundColor: 'var(--accent)' }}
                    transition={isReduced ? { duration: 0 } : MOTION_SPRINGS.snappy}
                  />
                )}
                <BookOpen className="w-4 h-4 relative z-10" />
                <span className="relative z-10">App Tutorial</span>
              </motion.button>

              <motion.button
                {...tactileProps}
                type="button"
                onClick={() => onNavigate('settings')}
                aria-current={currentDestination === 'settings' ? 'page' : undefined}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold relative transition-colors cursor-pointer ${
                  currentDestination === 'settings'
                    ? 'font-bold'
                    : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-85 hover:opacity-100'
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
                    layoutId="desktopSidebarActivePill"
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
                {currentDestination === 'settings' && (
                  <motion.span
                    layoutId="desktopSidebarActiveBar"
                    className="absolute left-1 top-2 bottom-2 w-1 rounded-full z-10"
                    style={{ backgroundColor: 'var(--accent)' }}
                    transition={isReduced ? { duration: 0 } : MOTION_SPRINGS.snappy}
                  />
                )}
                <Settings className="w-4 h-4 relative z-10" />
                <span className="relative z-10">Settings</span>
              </motion.button>

              <button
                type="button"
                onClick={onToggleThemeMode}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                style={{ color: 'var(--text-secondary)' }}
              >
                <span className="flex items-center gap-2.5">
                  <ThemeModeIcon className="w-4 h-4" />
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
          </>
        )}
      </aside>

      {/* Floating Theme-Aware Tooltip for Collapsed Icon Rail (never clipped by scroll container) */}
      {sidebarCollapsed && railTooltip && (
        <div
          role="tooltip"
          className="hidden md:flex fixed z-[80] pointer-events-none items-center gap-2.5 px-3 py-2 rounded-xl border shadow-lg text-xs"
          style={{
            top: `${railTooltip.top}px`,
            left: `${railTooltip.left}px`,
            transform: 'translateY(-50%)',
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
            boxShadow: 'var(--card-shadow)',
          }}
        >
          <div className="min-w-0">
            <div className="font-semibold leading-tight flex items-center gap-1.5">
              <span>{railTooltip.label}</span>
              {railTooltip.badge !== undefined && (
                <span
                  className="text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums"
                  style={{
                    backgroundColor: 'var(--accent-subtle)',
                    color: 'var(--accent)',
                  }}
                >
                  {railTooltip.badge}
                </span>
              )}
            </div>
            {railTooltip.sublabel && (
              <div
                className="text-[10px] mt-0.5 leading-tight"
                style={{ color: 'var(--text-muted)' }}
              >
                {railTooltip.sublabel}
              </div>
            )}
          </div>
          {railTooltip.shortcut && (
            <kbd
              className="text-[10px] px-1.5 py-0.5 rounded font-mono border shrink-0"
              style={{
                backgroundColor: 'var(--bg-surface-subtle)',
                borderColor: 'var(--border)',
                color: 'var(--text-secondary)',
              }}
            >
              {railTooltip.shortcut}
            </kbd>
          )}
        </div>
      )}

      {/* =================================================================
         STATE C: MOBILE / SMALL SCREEN NAVIGATION DRAWER
         ================================================================= */}
      <AnimatePresence>
        {mobileDrawerOpen && (
          <motion.div
            variants={variants.modalOverlay}
            initial="initial"
            animate="animate"
            exit="exit"
            id="daycraft-mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            onClick={onCloseMobileDrawer}
            className="md:hidden fixed inset-0 z-50 flex backdrop-blur-xs bg-black/50"
          >
            <motion.div
              ref={drawerPanelRef}
              onClick={e => e.stopPropagation()}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={
                isReduced ? { duration: 0.08 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }
              }
              className="w-[min(320px,88vw)] max-w-full h-full p-4 flex flex-col overflow-y-auto overscroll-contain border-r shadow-2xl"
              style={{
                backgroundColor: 'var(--sidebar-bg)',
                borderColor: 'var(--border)',
              }}
            >
              {/* Drawer Header */}
              <div
                className="flex items-center justify-between gap-2 pb-3.5 border-b mb-3"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center font-bold shrink-0"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-foreground)',
                    }}
                  >
                    <Compass className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <div className="min-w-0">
                    <div
                      className="font-bold text-sm truncate"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {appName}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full inline-block"
                        style={{ backgroundColor: 'var(--success)' }}
                      />
                      <span
                        className="text-[10px] font-medium truncate"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Offline · Local OS
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={onToggleZenMode}
                    aria-pressed={zenMode}
                    className="px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 cursor-pointer"
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

                  <button
                    ref={closeDrawerButtonRef}
                    type="button"
                    onClick={onCloseMobileDrawer}
                    aria-label="Close navigation menu"
                    className="p-1.5 rounded-lg border transition-colors hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Mobile Quick Add & Search Actions */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => {
                    onCloseMobileDrawer();
                    onOpenQuickAdd();
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-foreground)',
                  }}
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Quick Add</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onCloseMobileDrawer();
                    onOpenSearch();
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-medium cursor-pointer"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Search</span>
                </button>
              </div>

              {/* Mobile Pinned Views Switcher */}
              <div
                className="mb-3 p-2 rounded-2xl border"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border)',
                }}
              >
                <div className="flex items-center justify-between text-[10px] uppercase font-semibold tracking-wider px-1.5 pb-1.5">
                  <span
                    className="flex items-center gap-1"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Pin className="w-2.5 h-2.5" />
                    <span>Pinned Views</span>
                  </span>
                  <span
                    className="tabular-nums"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {pinnedItems.length}/4
                  </span>
                </div>
                <div
                  className={`grid gap-1 ${
                    pinnedItems.length === 4 || pinnedItems.length === 2
                      ? 'grid-cols-2'
                      : 'grid-cols-3'
                  }`}
                >
                  {pinnedItems.map(item => {
                    const Icon = item.icon;
                    const active = currentDestination === item.id;
                    const count = workspaceCounts[item.id] ?? 0;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onNavigate(item.id)}
                        className="flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[11px] font-semibold cursor-pointer"
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
                          <Icon className="w-3.5 h-3.5" />
                          {count > 0 && (
                            <span
                              className="text-[9px] px-1 rounded-full font-bold tabular-nums"
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
                        <span className="mt-0.5 truncate max-w-full">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mobile Grouped Navigation */}
              <nav aria-label="Mobile Navigation" className="space-y-3 flex-1">
                {zenMode ? (
                  <div>
                    <div className="flex items-center justify-between px-3 mb-1.5">
                      <span
                        className="text-[10px] uppercase font-semibold tracking-wider"
                        style={{ color: 'var(--text-muted)' }}
                      >
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
                        item => renderExpandedNavItem(item, 'mobile')
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {renderCategorySection('Daily Flow', 'core', 'mobile')}
                    {renderCategorySection('Planning & Sprints', 'planning', 'mobile')}
                    {renderCategorySection('Reflect & Growth', 'reflection', 'mobile')}
                  </>
                )}
              </nav>

              {/* Mobile Drawer Footer */}
              <div
                className="pt-3 border-t mt-4 space-y-1.5"
                style={{ borderColor: 'var(--border)' }}
              >
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
                        onClick={() => {
                          onCloseMobileDrawer();
                          onQuickExportBackup();
                        }}
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

                {renderExpandedNavItem(
                  NAV_ITEMS.find(i => i.id === 'tutorial')!,
                  'mobile'
                )}
                {renderExpandedNavItem(
                  NAV_ITEMS.find(i => i.id === 'settings')!,
                  'mobile'
                )}

                <button
                  type="button"
                  onClick={onToggleThemeMode}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span className="flex items-center gap-2.5">
                    <ThemeModeIcon className="w-4 h-4" />
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
