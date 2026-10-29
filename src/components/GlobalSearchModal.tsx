import React, { useState, useEffect } from 'react';
import {
  Search,
  X,
  CheckCircle2,
  Flame,
  Folder,
  Target,
  Calendar,
  BookOpen,
  ArrowUpRight,
  Zap,
  Timer,
  Moon,
  Download,
  Plus,
  Minimize2,
  PanelLeftClose,
  Sun,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../database/db';
import { useMotionPreference, MOTION_SPRINGS } from '../theme/motion';
import { useTheme } from '../theme/ThemeContext';
import { fileSystemAdapter } from '../platform/adapters';
import { useNotifications } from '../notifications/NotificationContext';
import { navigationManager, NAV_ITEMS } from './navigationState';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (destination: string) => void;
  onOpenQuickAdd?: () => void;
}

interface PaletteItem {
  id: string;
  title: string;
  subtitle: string;
  type: 'Action' | 'Task' | 'Habit' | 'Project' | 'Goal' | 'Event' | 'Journal';
  dest?: string;
  action?: () => void;
  icon?: React.ReactNode;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenQuickAdd,
}) => {
  const { isReduced, variants, tactileProps } = useMotionPreference();
  const { toggleMode, resolvedMode } = useTheme();
  const { notify } = useNotifications();
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const q = query.toLowerCase().trim();

  const quickActions: PaletteItem[] = [
    {
      id: 'act_quick_add',
      title: 'Quick Add Task, Habit, or Event',
      subtitle: 'Command • Open natural language capture modal (⌘Q)',
      type: 'Action',
      icon: <Plus className="w-4 h-4 text-emerald-600" />,
      action: () => {
        onClose();
        onOpenQuickAdd?.();
      },
    },
    {
      id: 'act_focus_25',
      title: 'Start 25m Deep Focus Session',
      subtitle: 'Command • Jump to Pomodoro Focus Timer',
      type: 'Action',
      icon: <Timer className="w-4 h-4 text-amber-500" />,
      dest: 'focus',
    },
    {
      id: 'act_switch_theme',
      title: `Switch Theme Mode (Current: ${resolvedMode})`,
      subtitle: 'Command • Toggle between Light and Dark appearance',
      type: 'Action',
      icon: <Moon className="w-4 h-4 text-indigo-500" />,
      action: () => {
        toggleMode();
        notify({
          title: 'Theme Mode Switched',
          message: `Appearance toggled from ${resolvedMode}.`,
          type: 'system',
        });
        onClose();
      },
    },
    {
      id: 'act_toggle_sidebar_collapse',
      title: `${
        navigationManager.getSnapshot().sidebarCollapsed ? 'Expand' : 'Collapse'
      } Navigation Sidebar`,
      subtitle: 'Command • Toggle between full sidebar and compact icon rail (⌘B)',
      type: 'Action',
      icon: <PanelLeftClose className="w-4 h-4" style={{ color: 'var(--accent)' }} />,
      action: () => {
        const nextCollapsed = navigationManager.toggleSidebarCollapsed();
        notify({
          title: nextCollapsed ? 'Sidebar Collapsed' : 'Sidebar Expanded',
          message: nextCollapsed
            ? 'Switched to compact icon rail.'
            : 'Restored full navigation sidebar.',
          type: 'system',
        });
        onClose();
      },
    },
    {
      id: 'act_zen_sidebar',
      title: `Toggle Sidebar Zen Mode (${
        navigationManager.getSnapshot().zenMode ? 'Disable' : 'Enable Core Only'
      })`,
      subtitle: 'Command • Focus sidebar on My Day, Tasks, Journal, Calendar & Habits',
      type: 'Action',
      icon: <Minimize2 className="w-4 h-4 text-teal-600" />,
      action: () => {
        const next = navigationManager.toggleZenMode();
        notify({
          title: next ? 'Zen Sidebar Enabled' : 'Full Sidebar Restored',
          message: next
            ? 'Showing core daily views only.'
            : `All ${NAV_ITEMS.length} destinations visible.`,
          type: 'system',
        });
        onClose();
      },
    },
    {
      id: 'act_export_backup',
      title: 'Export Verified Local Backup (.daycraft)',
      subtitle: 'Command • Download encrypted-ready JSON snapshot with CRC32 checksum',
      type: 'Action',
      icon: <Download className="w-4 h-4 text-sky-500" />,
      action: async () => {
        onClose();
        const archive = db.exportArchive();
        const ok = await fileSystemAdapter.exportBackupFile(archive);
        if (ok) {
          notify({
            title: 'Local Backup Exported',
            message: 'Saved verified .daycraft archive.',
            type: 'system',
          });
        }
      },
    },
    {
      id: 'act_go_myday',
      title: 'Open My Day & Evening Shutdown',
      subtitle: 'Navigation • Daily focus & 2-minute end-of-day review',
      type: 'Action',
      icon: <Sun className="w-4 h-4 text-amber-500" />,
      dest: 'myday',
    },
    {
      id: 'act_open_tutorial',
      title: 'Open App Tutorial & Guided Tour',
      subtitle: 'Navigation • Interactive walkthroughs for all Daycraft features',
      type: 'Action',
      icon: <BookOpen className="w-4 h-4 text-emerald-600" />,
      dest: 'tutorial',
    },
  ];

  const matchingActions = quickActions.filter(
    a =>
      !q ||
      a.title.toLowerCase().includes(q) ||
      a.subtitle.toLowerCase().includes(q)
  );

  const tasks = db
    .getTasks()
    .filter(
      t =>
        !t.archived &&
        (t.title.toLowerCase().includes(q) ||
          t.tags.some(tag => tag.toLowerCase().includes(q)))
    );
  const habits = db
    .getHabits()
    .filter(
      h =>
        !h.archived &&
        (h.name.toLowerCase().includes(q) ||
          h.description.toLowerCase().includes(q))
    );
  const projects = db
    .getProjects()
    .filter(
      p =>
        p.status !== 'archived' &&
        (p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q))
    );
  const goals = db
    .getGoals()
    .filter(
      g =>
        g.title.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q)
    );
  const events = db
    .getCalendarEvents()
    .filter(e => e.title.toLowerCase().includes(q));
  const journals = db
    .getJournalEntries()
    .filter(
      j =>
        j.title.toLowerCase().includes(q) ||
        j.content.toLowerCase().includes(q)
    );

  const results: PaletteItem[] = [];

  if (filterType === 'all' || filterType === 'actions') {
    matchingActions.forEach(a => results.push(a));
  }
  if (filterType === 'all' || filterType === 'tasks') {
    tasks.slice(0, 5).forEach(t =>
      results.push({
        id: t.id,
        title: t.title,
        subtitle: `Priority: ${t.priority} • Due: ${t.dueDate || 'No date'}`,
        type: 'Task',
        dest: 'tasks',
      })
    );
  }
  if (filterType === 'all' || filterType === 'habits') {
    habits.slice(0, 5).forEach(h =>
      results.push({
        id: h.id,
        title: h.name,
        subtitle: `Schedule: ${h.scheduleType} • Target: ${h.targetValue} ${h.targetUnit}`,
        type: 'Habit',
        dest: 'habits',
      })
    );
  }
  if (filterType === 'all' || filterType === 'projects') {
    projects.slice(0, 5).forEach(p =>
      results.push({
        id: p.id,
        title: p.name,
        subtitle: `Status: ${p.status}`,
        type: 'Project',
        dest: 'projects',
      })
    );
  }
  if (filterType === 'all' || filterType === 'goals') {
    goals.slice(0, 5).forEach(g =>
      results.push({
        id: g.id,
        title: g.title,
        subtitle: `Category: ${g.category}`,
        type: 'Goal',
        dest: 'goals',
      })
    );
  }
  if (filterType === 'all' || filterType === 'events') {
    events.slice(0, 5).forEach(e =>
      results.push({
        id: e.id,
        title: e.title,
        subtitle: `${e.startDate} ${e.startTime || ''}`,
        type: 'Event',
        dest: 'calendar',
      })
    );
  }
  if (filterType === 'all' || filterType === 'journal') {
    journals.slice(0, 5).forEach(j =>
      results.push({
        id: j.id,
        title: j.title,
        subtitle: `${j.date} • Mood: ${j.mood || 5}/5`,
        type: 'Journal',
        dest: 'journal',
      })
    );
  }

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, filterType, isOpen]);

  const executeItem = (item: PaletteItem) => {
    if (item.action) {
      item.action();
    } else if (item.dest) {
      onNavigate(item.dest);
      onClose();
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
      }
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (results.length > 0 ? (prev + 1) % results.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev =>
          results.length > 0 ? (prev - 1 + results.length) % results.length : 0
        );
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        executeItem(results[selectedIndex]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const getTypeIcon = (item: PaletteItem) => {
    if (item.icon) return item.icon;
    switch (item.type) {
      case 'Action':
        return <Zap className="w-4 h-4 text-amber-500" />;
      case 'Task':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'Habit':
        return <Flame className="w-4 h-4 text-amber-500" />;
      case 'Project':
        return <Folder className="w-4 h-4 text-emerald-600" />;
      case 'Goal':
        return <Target className="w-4 h-4 text-violet-500" />;
      case 'Event':
        return <Calendar className="w-4 h-4 text-sky-500" />;
      case 'Journal':
        return <BookOpen className="w-4 h-4 text-stone-500" />;
      default:
        return <Search className="w-4 h-4 text-stone-400" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={variants.modalOverlay}
          initial="initial"
          animate="animate"
          exit="exit"
          role="dialog"
          aria-modal="true"
          aria-label="Command Palette & Global Search"
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 backdrop-blur-sm bg-black/40"
          onClick={onClose}
        >
          <motion.div
            variants={variants.modalDialog}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={e => e.stopPropagation()}
            className="w-full max-w-xl rounded-2xl border shadow-2xl flex flex-col overflow-hidden"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            <div
              className="flex items-center px-4 py-3 border-b gap-3"
              style={{ borderColor: 'var(--border)' }}
            >
              <Search className="w-5 h-5 shrink-0" style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Type a command (e.g. 'focus', 'theme', 'backup') or search records..."
                className="flex-1 bg-transparent text-sm focus:outline-none"
                style={{ color: 'var(--text-primary)' }}
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="p-1 rounded hover:opacity-75 cursor-pointer"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <kbd
                className="text-[10px] px-2 py-0.5 rounded border font-mono"
                style={{
                  backgroundColor: 'var(--bg-surface-subtle)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-muted)',
                }}
              >
                ↑↓ ↵ ESC
              </kbd>
            </div>

            {/* Filter Chips */}
            <div
              className="flex gap-1 px-4 py-2 border-b overflow-x-auto text-xs"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--bg-surface-subtle)',
              }}
            >
              {[
                'all',
                'actions',
                'tasks',
                'habits',
                'projects',
                'goals',
                'events',
                'journal',
              ].map(f => {
                const active = filterType === f;
                return (
                  <button
                    key={f}
                    onClick={() => setFilterType(f)}
                    className={`relative px-2.5 py-1 rounded-md capitalize transition-colors cursor-pointer ${
                      active ? 'font-semibold' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{
                      color: active ? 'var(--accent-foreground)' : 'var(--text-secondary)',
                    }}
                  >
                    {active && (
                      <motion.span
                        layoutId="globalSearchFilterPill"
                        className="absolute inset-0 rounded-md shadow-xs"
                        style={{ backgroundColor: 'var(--accent)', zIndex: 0 }}
                        transition={isReduced ? { duration: 0 } : MOTION_SPRINGS.snappy}
                      />
                    )}
                    <span className="relative z-10">{f}</span>
                  </button>
                );
              })}
            </div>

            {/* Results & Commands */}
            <div className="max-h-80 overflow-y-auto p-2">
              {results.length === 0 ? (
                <div
                  className="text-center py-10 text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {query
                    ? `No commands or records matching "${query}"`
                    : 'Type to run quick actions or search all offline records.'}
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {results.map((r, idx) => {
                    const isSelected = idx === selectedIndex;
                    return (
                      <motion.button
                        key={`${r.type}-${r.id}-${idx}`}
                        {...tactileProps}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        onClick={() => executeItem(r)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors group cursor-pointer border ${
                          isSelected ? 'shadow-xs' : 'border-transparent'
                        }`}
                        style={{
                          backgroundColor: isSelected
                            ? 'var(--bg-surface-subtle)'
                            : 'var(--bg-surface)',
                          borderColor: isSelected ? 'var(--accent)' : 'transparent',
                        }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="p-2 rounded-lg"
                            style={{ backgroundColor: 'var(--bg-surface-elevated)' }}
                          >
                            {getTypeIcon(r)}
                          </div>
                          <div className="min-w-0">
                            <div
                              className="text-sm font-medium truncate"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {r.title}
                            </div>
                            <div
                              className="text-xs truncate"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {r.subtitle}
                            </div>
                          </div>
                        </div>
                        <div
                          className="flex items-center gap-1 text-xs shrink-0 pl-2 opacity-70 group-hover:opacity-100"
                          style={{ color: 'var(--accent)' }}
                        >
                          <span>{r.type === 'Action' ? 'Run' : r.type}</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
