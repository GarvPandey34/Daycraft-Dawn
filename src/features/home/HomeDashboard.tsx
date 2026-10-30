import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Flame,
  ArrowRight,
  Play,
  Calendar,
  Folder,
  BookOpen,
  Plus,
  SlidersHorizontal,
  Eye,
  EyeOff,
  TrendingUp,
  Target,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../../database/db';
import { Task } from '../../domain/models';
import { formatLocalDate } from '../../services/streakService';
import { useNotifications } from '../../notifications/NotificationContext';
import { calculateLevel } from '../../services/gamificationService';
import { getSevenDayCompletionData } from '../../services/completionAnalyticsService';
import { useMotionPreference } from '../../theme/motion';
import { AnimatedCheckbox, EmptyStateMotion } from '../../components/MotionPrimitives';
import { FRESH_START_EMPTY_STATES } from '../../services/tutorialService';

export function getHomeDashboardTasks(tasks: Task[], todayStr: string) {
  const scheduledPool = tasks.filter(t => !t.archived && t.status !== 'inbox');
  const todayTasks = scheduledPool.filter(
    t => t.dueDate === todayStr || (!t.dueDate && t.priority === 'urgent')
  );
  const completedTodayTasks = todayTasks.filter(t => t.status === 'completed');
  const overdueTasks = scheduledPool.filter(
    t => t.status !== 'completed' && Boolean(t.dueDate && t.dueDate < todayStr)
  );
  const todayCompletionPercent =
    todayTasks.length > 0 ? Math.round((completedTodayTasks.length / todayTasks.length) * 100) : 0;

  return {
    todayTasks,
    completedTodayTasks,
    overdueTasks,
    todayCompletionPercent,
  };
}

interface HomeDashboardProps {
  onNavigate: (destination: string) => void;
  onOpenQuickAdd: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({ onNavigate, onOpenQuickAdd }) => {
  const { notify, triggerCelebration } = useNotifications();
  const { variants, tactileProps, cardHoverProps } = useMotionPreference();
  const [, setTick] = useState(0);
  const [showConfig, setShowConfig] = useState(false);
  const [enabledWidgets, setEnabledWidgets] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('daycraft_home_widgets');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return {
      priorities: true,
      progress: true,
      velocity7d: true,
      habits: true,
      calendar: true,
      projects: true,
      goals: true,
      focus: true,
      journal: true,
    };
  });

  useEffect(() => {
    return db.subscribe(() => setTick(t => t + 1));
  }, []);

  const toggleWidget = (key: string) => {
    const next = { ...enabledWidgets, [key]: !enabledWidgets[key] };
    setEnabledWidgets(next);
    localStorage.setItem('daycraft_home_widgets', JSON.stringify(next));
  };

  const todayStr = formatLocalDate(new Date());
  const tasks = db.getTasks().filter(t => !t.archived);
  const habits = db.getHabits().filter(h => !h.archived);
  const occurrences = db.getHabitOccurrences();
  const projects = db.getProjects().filter(p => p.status !== 'archived');
  const goals = db.getGoals().filter(g => g.status === 'active');
  const events = db.getCalendarEvents();
  const journals = db.getJournalEntries();
  const totalXp = db.getTotalXp();
  const levelInfo = calculateLevel(totalXp);
  const hasPersonalActivity = db.hasPersonalActivity();

  // Today's priorities (excluding unconfirmed Inbox captures)
  const {
    todayTasks,
    completedTodayTasks,
    overdueTasks,
    todayCompletionPercent,
  } = getHomeDashboardTasks(tasks, todayStr);

  // Today's habit completions
  const todayHabitOccs = occurrences.filter(o => o.date === todayStr);

  // 7-day completion analytics for dashboard visualization
  const sevenDaySummary = useMemo(() => {
    return getSevenDayCompletionData(tasks, habits, occurrences);
  }, [tasks, habits, occurrences]);

  const sevenDayChartData = useMemo(() => {
    return sevenDaySummary.days.map(d => ({
      name: d.dayLabel,
      displayDate: d.displayDate,
      Tasks: d.tasksCount,
      Habits: d.habitsCount,
      Total: d.totalCount,
    }));
  }, [sevenDaySummary.days]);

  const toggleTask = (task: typeof tasks[0]) => {
    const isCompleted = task.status === 'completed';
    const outcome = db.saveTask({
      ...task,
      status: isCompleted ? 'todo' : 'completed',
      completedAt: isCompleted ? undefined : new Date().toISOString(),
    });
    if (!isCompleted) {
      notify({
        title: 'Task Completed',
        message:
          outcome.xpAwarded > 0
            ? `Finished "${task.title}" (+${outcome.xpAwarded} XP)`
            : `Finished "${task.title}"`,
        type: 'task',
      });
      triggerCelebration();
    }
  };

  const toggleHabit = (habitId: string, currentTarget: number) => {
    const existing = todayHabitOccs.find(o => o.habitId === habitId);
    const isCompleted = existing && existing.recordedValue >= currentTarget;

    const outcome = db.recordHabitOccurrence({
      id: existing ? existing.id : `occ_${Date.now()}_${habitId}`,
      habitId,
      date: todayStr,
      recordedValue: isCompleted ? 0 : currentTarget,
      targetValue: currentTarget,
      status: isCompleted ? 'missed' : 'completed',
      completedAt: isCompleted ? undefined : new Date().toISOString(),
    });

    if (!isCompleted) {
      notify({
        title: 'Habit Anchor Kept',
        message:
          outcome.xpAwarded > 0
            ? `Recorded completion (+${outcome.xpAwarded} XP)`
            : 'Recorded completion',
        type: 'habit',
      });
    }
  };

  const nextEvent = events
    .filter(e => e.startDate >= todayStr)
    .sort((a, b) => (a.startDate + (a.startTime || '')).localeCompare(b.startDate + (b.startTime || '')))[0];

  const recentJournal = journals[0];

  return (
    <motion.div
      variants={variants.cardListContainer}
      initial="initial"
      animate="animate"
      className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 min-w-0"
    >
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b min-w-0" style={{ borderColor: 'var(--border)' }}>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Today's Operating Dashboard</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Fully local, private, and offline-first personal management system.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Level / XP status button */}
          <motion.button
            {...tactileProps}
            onClick={() => onNavigate('achievements')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
            <span className="font-semibold">Level {levelInfo.level}</span>
            <span style={{ color: 'var(--text-muted)' }}>·</span>
            <span className="font-mono text-[11px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>{totalXp} XP</span>
          </motion.button>

          <motion.button
            {...tactileProps}
            onClick={() => setShowConfig(!showConfig)}
            aria-label="Customize dashboard widgets"
            className="p-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border)',
              color: 'var(--text-secondary)',
            }}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Widgets</span>
          </motion.button>

          <motion.button
            {...tactileProps}
            onClick={onOpenQuickAdd}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-xs transition-all hover:brightness-105 cursor-pointer"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-foreground)',
            }}
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Quick Add</span>
          </motion.button>
        </div>
      </div>

      {/* Fresh-Start Welcome Card (shown when database has no personal activity yet) */}
      {!hasPersonalActivity && (
        <motion.div
          variants={variants.cardItem}
          className="p-6 rounded-3xl border shadow-xs space-y-4"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--card-shadow)',
          }}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Fresh Start · Clean Workspace</span>
              </div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                Welcome to Daycraft. Your personal workspace is clean and ready.
              </h2>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                There is no pre-filled sample clutter—every task, habit, streak, focus session, and XP milestone begins with your real actions. Choose a starting point below or explore the permanent App Tutorial.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('tutorial')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-opacity hover:opacity-90"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-foreground)',
              }}
            >
              <BookOpen className="w-4 h-4" />
              <span>Explore the app tutorial</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              type="button"
              onClick={onOpenQuickAdd}
              className="p-3.5 rounded-2xl border text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer flex flex-col justify-between gap-2"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                  {FRESH_START_EMPTY_STATES.tasks.actionLabel}
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                {FRESH_START_EMPTY_STATES.tasks.description}
              </p>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('habits')}
              className="p-3.5 rounded-2xl border text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer flex flex-col justify-between gap-2"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                  {FRESH_START_EMPTY_STATES.habits.actionLabel}
                </span>
                <Flame className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                {FRESH_START_EMPTY_STATES.habits.description}
              </p>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('goals')}
              className="p-3.5 rounded-2xl border text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer flex flex-col justify-between gap-2"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                  {FRESH_START_EMPTY_STATES.goals.actionLabel}
                </span>
                <Target className="w-4 h-4 text-violet-500" />
              </div>
              <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                {FRESH_START_EMPTY_STATES.goals.description}
              </p>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('focus')}
              className="p-3.5 rounded-2xl border text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer flex flex-col justify-between gap-2"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                  {FRESH_START_EMPTY_STATES.focus.actionLabel}
                </span>
                <Play className="w-4 h-4 text-sky-500" />
              </div>
              <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                {FRESH_START_EMPTY_STATES.focus.description}
              </p>
            </button>
          </div>
        </motion.div>
      )}

      {/* Widget Visibility Config Drawer */}
      <AnimatePresence initial={false}>
        {showConfig && (
          <motion.div
            variants={variants.accordion}
            initial="initial"
            animate="animate"
            exit="exit"
            className="overflow-hidden"
          >
            <div className="p-4 rounded-2xl border mb-2" style={{ backgroundColor: 'var(--bg-surface-subtle)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  Customize Home Widgets
                </h3>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Preferences are saved locally</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.keys(enabledWidgets).map(key => (
                  <motion.button
                    key={key}
                    {...tactileProps}
                    onClick={() => toggleWidget(key)}
                    className="flex items-center justify-between p-2.5 rounded-lg border text-xs font-medium capitalize transition-colors hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border)',
                      color: enabledWidgets[key] ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}
                  >
                    <span>{key}</span>
                    {enabledWidgets[key] ? (
                      <Eye className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-stone-400" />
                    )}
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column (2 cols wide) */}
        <div className="md:col-span-2 space-y-6">
          {/* Progress Banner */}
          {enabledWidgets.progress && (
            <motion.div
              variants={variants.cardItem}
              {...cardHoverProps}
              className="tactile-card p-5 rounded-2xl border shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border)',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <div className="flex items-center gap-4">
                <div className="relative w-13 h-13 flex items-center justify-center shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-stone-200 dark:text-stone-800"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      strokeDasharray={`${todayCompletionPercent}, 100`}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke="var(--accent)"
                      fill="none"
                      className="transition-all duration-300"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <span className="absolute text-xs font-bold font-mono tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    {todayCompletionPercent}%
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold">Daily Completion Progress</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {todayTasks.length === 0
                      ? 'No tasks scheduled for today yet'
                      : `${completedTodayTasks.length} of ${todayTasks.length} scheduled tasks completed today`}
                  </p>
                </div>
              </div>

              {overdueTasks.length > 0 && (
                <motion.button
                  {...tactileProps}
                  onClick={() => onNavigate('tasks')}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all hover:brightness-95 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--danger-subtle)',
                    color: 'var(--danger)',
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                  <span>{overdueTasks.length} overdue</span>
                  <ArrowRight className="w-3 h-3 opacity-70" />
                </motion.button>
              )}
            </motion.div>
          )}

          {/* 7-Day Completion Velocity Widget (Recharts) */}
          {enabledWidgets.velocity7d && (
            <motion.div
              variants={variants.cardItem}
              {...cardHoverProps}
              className="tactile-card p-5 rounded-2xl border shadow-xs"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border)',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-600" />
                  <h2 className="text-sm font-bold">Past 7 Days Activity</h2>
                  <span className="text-xs font-mono font-medium tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    · {sevenDaySummary.grandTotal} completed
                  </span>
                </div>
                <button
                  onClick={() => onNavigate('insights')}
                  className="text-xs font-medium flex items-center gap-1 hover:underline cursor-pointer"
                  style={{ color: 'var(--accent)' }}
                >
                  Full Insights <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-between text-xs mb-3">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs inline-block" style={{ backgroundColor: '#C86D51' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>Tasks ({sevenDaySummary.totalTasks})</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs inline-block" style={{ backgroundColor: '#3E7051' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>Habits ({sevenDaySummary.totalHabits})</span>
                  </span>
                </div>
                <span className="text-[11px] font-mono tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  Avg: {sevenDaySummary.dailyAverage}/day · {sevenDaySummary.velocityTrend}
                </span>
              </div>

              <div className="w-full h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sevenDayChartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <XAxis
                      dataKey="name"
                      stroke="var(--text-muted)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--border)' }}
                    />
                    <RechartsTooltip
                      cursor={{ fill: 'transparent' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          return (
                            <div
                              className="p-3 rounded-xl border shadow-md text-xs space-y-1.5"
                              style={{
                                backgroundColor: 'var(--bg-surface-elevated)',
                                borderColor: 'var(--border)',
                                color: 'var(--text-primary)',
                              }}
                            >
                              <p className="font-bold border-b pb-1" style={{ borderColor: 'var(--border)' }}>
                                {d.name} ({d.displayDate})
                              </p>
                              <p className="font-medium flex items-center justify-between gap-3" style={{ color: '#C86D51' }}>
                                <span>Tasks:</span> <span className="font-mono font-bold">{d.Tasks}</span>
                              </p>
                              <p className="font-medium flex items-center justify-between gap-3" style={{ color: '#3E7051' }}>
                                <span>Habits:</span> <span className="font-mono font-bold">{d.Habits}</span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="Tasks" fill="#C86D51" radius={[3, 3, 0, 0]} maxBarSize={22} />
                    <Bar dataKey="Habits" fill="#3E7051" radius={[3, 3, 0, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}

          {/* Today's Priorities */}
          {enabledWidgets.priorities && (
            <motion.div
              variants={variants.cardItem}
              {...cardHoverProps}
              className="tactile-card p-5 rounded-2xl border shadow-xs"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border)',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-sm font-bold">Today's Priorities</h2>
                  <span className="text-xs font-mono tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    ({todayTasks.length})
                  </span>
                </div>
                <button
                  onClick={() => onNavigate('myday')}
                  className="text-xs font-medium flex items-center gap-1 hover:underline cursor-pointer"
                  style={{ color: 'var(--accent)' }}
                >
                  View My Day <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {todayTasks.length === 0 ? (
                <EmptyStateMotion className="p-6 text-center space-y-2">
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {FRESH_START_EMPTY_STATES.tasks.headline}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {FRESH_START_EMPTY_STATES.tasks.description}
                  </p>
                  <button
                    type="button"
                    onClick={onOpenQuickAdd}
                    className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
                    style={{ backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)' }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{FRESH_START_EMPTY_STATES.tasks.actionLabel}</span>
                  </button>
                </EmptyStateMotion>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {todayTasks.map((t) => {
                    const isCompleted = t.status === 'completed';
                    return (
                      <div
                        key={t.id}
                        className="py-2.5 flex items-center justify-between gap-3 group transition-colors hover:bg-black/[0.015] dark:hover:bg-white/[0.015] px-1 rounded-lg"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <AnimatedCheckbox
                            checked={isCompleted}
                            onChange={() => toggleTask(t)}
                            label={`Toggle task: ${t.title}`}
                          />
                          <div className="min-w-0">
                            <span className={`text-xs font-medium block truncate transition-opacity ${isCompleted ? 'line-through opacity-50' : ''}`} style={{ color: 'var(--text-primary)' }}>
                              {t.title}
                            </span>
                            {t.dueTime && (
                              <span className="text-[11px] block font-mono" style={{ color: 'var(--text-secondary)' }}>
                                {t.dueTime}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Priority indicator as clean typography with colored dot */}
                        <span className="flex items-center gap-1.5 text-xs font-medium shrink-0">
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{
                              backgroundColor:
                                t.priority === 'urgent'
                                  ? 'var(--danger)'
                                  : t.priority === 'high'
                                  ? 'var(--warning)'
                                  : 'var(--text-muted)',
                            }}
                          />
                          <span
                            className="capitalize text-[11px]"
                            style={{
                              color:
                                t.priority === 'urgent'
                                  ? 'var(--danger)'
                                  : t.priority === 'high'
                                  ? 'var(--warning)'
                                  : 'var(--text-secondary)',
                            }}
                          >
                            {t.priority}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* Habit Checklist */}
          {enabledWidgets.habits && (
            <motion.div
              variants={variants.cardItem}
              {...cardHoverProps}
              className="tactile-card p-5 rounded-2xl border shadow-xs"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border)',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-500" />
                  <h2 className="text-sm font-bold">Today's Habit Anchors</h2>
                  <span className="text-xs font-mono tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    ({habits.length})
                  </span>
                </div>
                <button
                  onClick={() => onNavigate('habits')}
                  className="text-xs font-medium flex items-center gap-1 hover:underline cursor-pointer"
                  style={{ color: 'var(--accent)' }}
                >
                  Manage Habits <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {habits.length === 0 ? (
                <EmptyStateMotion className="p-6 text-center space-y-2">
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {FRESH_START_EMPTY_STATES.habits.headline}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {FRESH_START_EMPTY_STATES.habits.description}
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate('habits')}
                    className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
                    style={{ backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)' }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{FRESH_START_EMPTY_STATES.habits.actionLabel}</span>
                  </button>
                </EmptyStateMotion>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {habits.map((h) => {
                    const occ = todayHabitOccs.find(o => o.habitId === h.id);
                    const isDone = Boolean(occ && occ.recordedValue >= h.targetValue);
                    return (
                      <div
                        key={h.id}
                        className="p-3 rounded-xl border flex items-center justify-between gap-3 transition-all hover:bg-black/[0.015] dark:hover:bg-white/[0.015]"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: isDone ? 'rgba(74, 124, 89, 0.4)' : 'var(--border)',
                        }}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                            {h.name}
                          </div>
                          <div className="text-[11px] mt-0.5 font-mono" style={{ color: 'var(--text-secondary)' }}>
                            {h.targetValue} {h.targetUnit}
                          </div>
                        </div>

                        <motion.button
                          {...tactileProps}
                          onClick={() => toggleHabit(h.id, h.targetValue)}
                          aria-label={`Mark habit completed: ${h.name}`}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            isDone ? 'bg-emerald-600 text-white shadow-xs font-semibold' : 'border hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                          style={{
                            backgroundColor: isDone ? 'var(--success)' : 'var(--bg-surface-subtle)',
                            borderColor: isDone ? 'transparent' : 'var(--border)',
                            color: isDone ? '#FFFFFF' : 'var(--text-secondary)',
                          }}
                        >
                          {isDone ? 'Done' : 'Check'}
                        </motion.button>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Right Column (1 col wide) */}
        <div className="space-y-6">
          {/* Quick Focus Launcher */}
          {enabledWidgets.focus && (
            <motion.div
              variants={variants.cardItem}
              {...cardHoverProps}
              className="tactile-card p-5 rounded-2xl border shadow-xs flex flex-col justify-between"
              style={{
                backgroundColor: 'var(--accent-subtle)',
                borderColor: 'var(--border)',
              }}
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                  Deep Focus Mode
                </span>
                <h3 className="text-sm font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
                  {FRESH_START_EMPTY_STATES.focus.headline}
                </h3>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {FRESH_START_EMPTY_STATES.focus.description}
                </p>
              </div>

              <motion.button
                {...tactileProps}
                onClick={() => onNavigate('focus')}
                className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-xs shadow-xs transition-all hover:brightness-105 cursor-pointer"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-foreground)',
                }}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{FRESH_START_EMPTY_STATES.focus.actionLabel}</span>
              </motion.button>
            </motion.div>
          )}

          {/* Active Goals Widget */}
          {enabledWidgets.goals && (
            <motion.div
              variants={variants.cardItem}
              {...cardHoverProps}
              className="tactile-card p-5 rounded-2xl border shadow-sm"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border)',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                  <Target className="w-4 h-4 text-violet-500" />
                  <span>Active Goals ({goals.length})</span>
                </div>
                <button
                  onClick={() => onNavigate('goals')}
                  className="text-xs hover:underline cursor-pointer"
                  style={{ color: 'var(--accent)' }}
                >
                  All Goals
                </button>
              </div>

              {goals.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {FRESH_START_EMPTY_STATES.goals.headline}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {FRESH_START_EMPTY_STATES.goals.description}
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate('goals')}
                    className="inline-flex items-center gap-1 text-xs font-semibold hover:underline cursor-pointer"
                    style={{ color: 'var(--accent)' }}
                  >
                    <span>{FRESH_START_EMPTY_STATES.goals.actionLabel}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {goals.slice(0, 3).map(g => {
                    const doneMs = g.milestones.filter(m => m.completed).length;
                    const pct = g.milestones.length > 0 ? Math.round((doneMs / g.milestones.length) * 100) : 0;
                    return (
                      <div key={g.id}>
                        <div className="flex justify-between text-xs mb-1 font-medium">
                          <span className="truncate">{g.title}</span>
                          <span className="font-mono tabular-nums" style={{ color: 'var(--text-secondary)' }}>{pct}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-surface-subtle)' }}>
                          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: 'var(--accent)' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* Next Calendar Event */}
          {enabledWidgets.calendar && (
            <motion.div
              variants={variants.cardItem}
              {...cardHoverProps}
              className="tactile-card p-5 rounded-2xl border shadow-sm"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border)',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                  <Calendar className="w-4 h-4 text-sky-500" />
                  <span>Next Event</span>
                </div>
                <button
                  onClick={() => onNavigate('calendar')}
                  className="text-xs hover:underline cursor-pointer"
                  style={{ color: 'var(--accent)' }}
                >
                  Calendar
                </button>
              </div>

              {nextEvent ? (
                <div>
                  <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {nextEvent.title}
                  </h4>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {nextEvent.startDate} {nextEvent.startTime ? `at ${nextEvent.startTime}` : 'All Day'}
                  </p>
                </div>
              ) : (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  No upcoming calendar events scheduled.
                </p>
              )}
            </motion.div>
          )}

          {/* Active Projects Preview */}
          {enabledWidgets.projects && (
            <motion.div
              variants={variants.cardItem}
              {...cardHoverProps}
              className="tactile-card p-5 rounded-2xl border shadow-sm"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border)',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                  <Folder className="w-4 h-4 text-emerald-600" />
                  <span>Active Projects ({projects.length})</span>
                </div>
                <button
                  onClick={() => onNavigate('projects')}
                  className="text-xs hover:underline cursor-pointer"
                  style={{ color: 'var(--accent)' }}
                >
                  All Projects
                </button>
              </div>

              {projects.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  No active projects yet. Group multi-step tasks under Projects when ready.
                </p>
              ) : (
                <div className="space-y-3">
                  {projects.slice(0, 3).map(p => {
                    const pTasks = tasks.filter(t => t.projectId === p.id);
                    const pDone = pTasks.filter(t => t.status === 'completed').length;
                    const pct = pTasks.length > 0 ? Math.round((pDone / pTasks.length) * 100) : 0;
                    return (
                      <div key={p.id}>
                        <div className="flex justify-between text-xs mb-1 font-medium">
                          <span className="truncate">{p.name}</span>
                          <span className="font-mono tabular-nums" style={{ color: 'var(--text-secondary)' }}>{pct}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-surface-subtle)' }}>
                          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: p.color || 'var(--accent)' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* Recent Journal */}
          {enabledWidgets.journal && recentJournal && (
            <motion.div
              variants={variants.cardItem}
              {...cardHoverProps}
              className="tactile-card p-5 rounded-2xl border shadow-sm"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border)',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                  <BookOpen className="w-4 h-4 text-stone-500" />
                  <span>Recent Reflection</span>
                </div>
                <button
                  onClick={() => onNavigate('journal')}
                  className="text-xs hover:underline cursor-pointer"
                  style={{ color: 'var(--accent)' }}
                >
                  Journal
                </button>
              </div>
              <h4 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                {recentJournal.title}
              </h4>
              <p className="text-[11px] mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                {recentJournal.content}
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
