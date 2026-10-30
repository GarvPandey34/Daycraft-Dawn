import React, { useState, useEffect } from 'react';
import {
  Sun,
  Moon,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Flame,
  Calendar,
  CalendarPlus,
  Timer,
  CalendarDays,
  Plus,
} from 'lucide-react';
import { db } from '../../database/db';
import { addDays, formatLocalDate } from '../../services/streakService';
import { useNotifications } from '../../notifications/NotificationContext';
import { Task } from '../../domain/models';
import {
  performEndOfDayShutdown,
  scheduleTaskToCalendar,
  getDailyActivitySummary,
} from '../../services/workflowConnectService';
import { filterTodayFocusSessions } from '../../services/focusTimerStateService';

export function resolveRescheduledTaskDate(todayStr: string, daysFromToday: number): string {
  return addDays(todayStr, daysFromToday);
}

export function getMyDayScheduledTasks(tasks: Task[], selectedDate: string, todayStr: string) {
  const scheduledPool = tasks.filter(t => !t.archived && t.status !== 'inbox');
  const dateTasks = scheduledPool.filter(t => t.dueDate === selectedDate);
  const completedDateTasks = dateTasks.filter(t => t.status === 'completed');
  const unfinishedDateTasks = dateTasks.filter(t => t.status !== 'completed');
  const overdueTasks = scheduledPool.filter(
    t => t.status !== 'completed' && Boolean(t.dueDate && t.dueDate < todayStr)
  );
  return {
    dateTasks,
    completedDateTasks,
    unfinishedDateTasks,
    overdueTasks,
  };
}

interface MyDayViewProps {
  onOpenQuickAdd: () => void;
  onNavigate: (dest: string) => void;
}

export const MyDayView: React.FC<MyDayViewProps> = ({ onOpenQuickAdd, onNavigate }) => {
  const { notify, triggerCelebration } = useNotifications();
  const [, setTick] = useState(0);
  const [selectedDate, setSelectedDate] = useState(formatLocalDate(new Date()));
  const [isShutdownOpen, setIsShutdownOpen] = useState(false);
  const [rolloverUnfinished, setRolloverUnfinished] = useState(true);
  const [shutdownReflection, setShutdownReflection] = useState('');
  const [shutdownMood, setShutdownMood] = useState<number>(4);

  useEffect(() => {
    return db.subscribe(() => setTick(t => t + 1));
  }, []);

  const todayStr = formatLocalDate(new Date());
  const tasks = db.getTasks().filter(t => !t.archived);
  const habits = db.getHabits().filter(h => !h.archived);
  const occurrences = db.getHabitOccurrences();
  const events = db.getCalendarEvents();
  const timeBlocks = db.getTimeBlocks().filter(b => b.date === selectedDate);
  const focusSessions = filterTodayFocusSessions(db.getFocusSessions(), selectedDate);

  const {
    dateTasks,
    completedDateTasks,
    unfinishedDateTasks,
    overdueTasks,
  } = getMyDayScheduledTasks(tasks, selectedDate, todayStr);

  const dailySummary = getDailyActivitySummary(selectedDate);

  const handleCompleteShutdown = (e: React.FormEvent) => {
    e.preventDefault();
    const res = performEndOfDayShutdown({
      date: selectedDate,
      rolloverUnfinishedTasks: rolloverUnfinished,
      reflectionLine: shutdownReflection,
      mood: shutdownMood,
    });

    const parts: string[] = [];
    if (res.rolledOverCount > 0) {
      parts.push(`Rolled ${res.rolledOverCount} task${res.rolledOverCount === 1 ? '' : 's'} to ${res.targetTomorrowDate}`);
    }
    if (res.journalEntry) {
      parts.push('Saved evening reflection to Journal');
    }

    notify({
      title: 'Day Closed Out',
      message: parts.length > 0 ? parts.join(' · ') : 'Evening review completed.',
      type: 'system',
    });
    triggerCelebration();
    setShutdownReflection('');
    setIsShutdownOpen(false);
  };

  const handleScheduleTask = (task: Task) => {
    const { block, alreadyScheduled } = scheduleTaskToCalendar(task, { date: selectedDate });
    notify({
      title: alreadyScheduled ? 'Already Time-Blocked' : 'Scheduled on Calendar',
      message: `"${task.title}" scheduled at ${block.startTime}–${block.endTime}.`,
      type: 'task',
    });
  };

  const toggleTask = (task: Task) => {
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

  const postponeTask = (task: Task, daysFromToday: number) => {
    const newDueDate = resolveRescheduledTaskDate(todayStr, daysFromToday);
    db.saveTask({
      ...task,
      dueDate: newDueDate,
    });
    const label =
      daysFromToday === 0 ? `Today (${newDueDate})` : daysFromToday === 1 ? `Tomorrow (${newDueDate})` : newDueDate;
    notify({
      title: 'Task Rescheduled',
      message: `Moved "${task.title}" to ${label}`,
      type: 'system',
    });
  };

  const toggleHabit = (habitId: string, currentTarget: number) => {
    const existing = occurrences.find(o => o.habitId === habitId && o.date === selectedDate);
    const isCompleted = existing && existing.recordedValue >= currentTarget;

    const outcome = db.recordHabitOccurrence({
      id: existing ? existing.id : `occ_${Date.now()}_${habitId}`,
      habitId,
      date: selectedDate,
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

  const dayEvents = events.filter(e => e.startDate === selectedDate);

  // Time of day greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
            <Sun className="w-4 h-4" />
            <span>{greeting}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">My Day Focus</h1>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 rounded-xl border text-xs focus-visible:outline-none"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
          />
          {selectedDate !== todayStr && (
            <button
              onClick={() => setSelectedDate(todayStr)}
              className="px-3 py-1.5 rounded-xl border text-xs font-medium"
              style={{ backgroundColor: 'var(--bg-surface-subtle)', borderColor: 'var(--border)' }}
            >
              Back to Today
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsShutdownOpen(prev => !prev)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border shadow-xs transition-all hover:bg-black/5 cursor-pointer"
            style={{
              borderColor: 'var(--border)',
              backgroundColor: isShutdownOpen ? 'var(--bg-surface-subtle)' : 'var(--bg-surface)',
              color: 'var(--text-primary)',
            }}
          >
            <Moon className="w-4 h-4 text-amber-500" />
            <span>2-Min Shutdown</span>
          </button>
          <button
            onClick={onOpenQuickAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all hover:brightness-105 active:scale-98 cursor-pointer"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
          >
            <Plus className="w-4 h-4" />
            <span>Quick Add</span>
          </button>
        </div>
      </div>

      {/* 2-Minute End of Day Shutdown Panel */}
      {isShutdownOpen && (
        <form
          onSubmit={handleCompleteShutdown}
          className="p-5 rounded-2xl border shadow-md space-y-4"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--accent)',
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                <Moon className="w-4 h-4" />
                <span>2-Minute End of Day Shutdown</span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                Roll unfinished tasks to tomorrow, capture a one-line reflection, and close out {selectedDate}.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              <span>✓ {dailySummary.completedTasks.length} tasks</span>
              <span>· {dailySummary.completedHabits.length} habits</span>
              <span>· {dailySummary.focusMinutes}m focus</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <label className="flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer text-xs font-medium" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <input
                type="checkbox"
                checked={rolloverUnfinished}
                onChange={e => setRolloverUnfinished(e.target.checked)}
                className="rounded cursor-pointer"
              />
              <div>
                <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Roll unfinished tasks over to tomorrow ({addDays(selectedDate, 1)})
                </div>
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {unfinishedDateTasks.length + overdueTasks.length} open task(s) due on or before {selectedDate}
                </div>
              </div>
            </label>

            <div className="flex items-center justify-between p-3 rounded-xl border text-xs" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Today&apos;s Mood (1–5):
              </span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setShutdownMood(m)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      shutdownMood === m ? 'shadow-xs' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: shutdownMood === m ? 'var(--accent)' : 'transparent',
                      borderColor: shutdownMood === m ? 'var(--accent)' : 'var(--border)',
                      color: shutdownMood === m ? 'var(--accent-foreground)' : 'var(--text-primary)',
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <input
              type="text"
              value={shutdownReflection}
              onChange={e => setShutdownReflection(e.target.value)}
              placeholder="One-line reflection: What was today's highlight or key takeaway? (Saved to Journal)"
              className="w-full px-3.5 py-2 rounded-xl border text-sm focus:outline-none"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              type="button"
              onClick={() => setIsShutdownOpen(false)}
              className="px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg text-xs font-bold shadow-xs cursor-pointer"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
            >
              Complete Day Shutdown
            </button>
          </div>
        </form>
      )}

      {/* Overdue Section (Alerts clearly separated) */}
      {selectedDate === todayStr && overdueTasks.length > 0 && (
        <div
          className="p-5 rounded-2xl border"
          style={{
            backgroundColor: 'var(--danger-subtle)',
            borderColor: 'var(--danger)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" style={{ color: 'var(--danger)' }} />
              <h2 className="text-sm font-bold" style={{ color: 'var(--danger)' }}>
                Overdue Tasks ({overdueTasks.length})
              </h2>
            </div>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Tasks remain active until completed or rescheduled.
            </span>
          </div>

          <div className="divide-y divide-red-200 dark:divide-red-950/40">
            {overdueTasks.map(t => (
              <div key={t.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => toggleTask(t)}
                    className="p-1 rounded-lg"
                    style={{ color: 'var(--danger)' }}
                  >
                    <Circle className="w-5 h-5" />
                  </button>
                  <div className="min-w-0">
                    <span className="text-sm font-semibold truncate block" style={{ color: 'var(--text-primary)' }}>
                      {t.title}
                    </span>
                    <span className="text-[11px] block text-red-600 dark:text-red-400">
                      Was due on: {t.dueDate}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => postponeTask(t, 0)}
                    className="px-2.5 py-1 rounded-lg border text-xs font-medium hover:bg-white/40 cursor-pointer"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    Move to Today
                  </button>
                  <button
                    onClick={() => postponeTask(t, 1)}
                    className="px-2.5 py-1 rounded-lg border text-xs font-medium hover:bg-white/40 cursor-pointer"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    Tomorrow
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scheduled Time Blocks & Events */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Tasks Due Today */}
          <div
            className="p-5 rounded-2xl border shadow-sm"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-bold">Tasks Due ({dateTasks.length})</h2>
              </div>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {completedDateTasks.length} completed
              </span>
            </div>

            {dateTasks.length === 0 ? (
              <div className="p-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                No tasks due on this date.
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {dateTasks.map(t => {
                  const isDone = t.status === 'completed';
                  return (
                    <div key={t.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          onClick={() => toggleTask(t)}
                          className="p-1 rounded-lg transition-transform active:scale-90"
                          style={{ color: isDone ? 'var(--success)' : 'var(--text-muted)' }}
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <Circle className="w-5 h-5 hover:text-emerald-500" />
                          )}
                        </button>
                        <div className="min-w-0">
                          <span className={`text-sm font-medium truncate block ${isDone ? 'line-through opacity-50' : ''}`} style={{ color: 'var(--text-primary)' }}>
                            {t.title}
                          </span>
                          {t.description && (
                            <span className="text-xs line-clamp-1" style={{ color: 'var(--text-secondary)' }}>
                              {t.description}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!isDone && (
                          <button
                            type="button"
                            onClick={() => handleScheduleTask(t)}
                            title="Schedule on Calendar"
                            className="p-1.5 rounded-lg border hover:bg-black/5 cursor-pointer"
                            style={{ borderColor: 'var(--border)', color: 'var(--accent)' }}
                          >
                            <CalendarPlus className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {t.dueTime && (
                          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                            <Clock className="w-3.5 h-3.5" /> {t.dueTime}
                          </span>
                        )}
                        <span
                          className="text-[10px] px-2 py-0.5 rounded uppercase font-bold"
                          style={{
                            backgroundColor: 'var(--bg-surface-subtle)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {t.priority}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Today's Habits */}
          <div
            className="p-5 rounded-2xl border shadow-sm"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-bold">Habits for {selectedDate}</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {habits.map(h => {
                const occ = occurrences.find(o => o.habitId === h.id && o.date === selectedDate);
                const isDone = occ && occ.recordedValue >= h.targetValue;
                return (
                  <div
                    key={h.id}
                    className="p-3.5 rounded-xl border flex items-center justify-between gap-3"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: isDone ? 'var(--success)' : 'var(--border)',
                    }}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {h.name}
                      </div>
                      <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        Target: {h.targetValue} {h.targetUnit}
                      </div>
                    </div>

                    <button
                      onClick={() => toggleHabit(h.id, h.targetValue)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isDone ? 'bg-emerald-600 text-white' : 'border'
                      }`}
                      style={{
                        backgroundColor: isDone ? 'var(--success)' : 'var(--bg-surface-subtle)',
                        borderColor: 'var(--border)',
                        color: isDone ? '#FFFFFF' : 'var(--text-secondary)',
                      }}
                    >
                      {isDone ? 'Done' : 'Check'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Time blocks & Sessions */}
        <div className="space-y-6">
          {/* Scheduled Calendar Events */}
          <div
            className="p-5 rounded-2xl border shadow-sm"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                <Calendar className="w-4 h-4 text-sky-500" />
                <span>Scheduled Events ({dayEvents.length})</span>
              </div>
              <button
                onClick={() => onNavigate('calendar')}
                className="text-xs hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                Calendar
              </button>
            </div>

            {dayEvents.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                No events booked for this date.
              </p>
            ) : (
              <div className="space-y-2">
                {dayEvents.map(e => (
                  <div key={e.id} className="p-2.5 rounded-xl border text-xs" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                    <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{e.title}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {e.startTime ? `${e.startTime} - ${e.endTime || ''}` : 'All Day'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Time Blocks */}
          <div
            className="p-5 rounded-2xl border shadow-sm"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                <CalendarDays className="w-4 h-4 text-emerald-600" />
                <span>Time Blocks ({timeBlocks.length})</span>
              </div>
            </div>

            {timeBlocks.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                No time blocks created.
              </p>
            ) : (
              <div className="space-y-2">
                {timeBlocks.map(tb => (
                  <div key={tb.id} className="p-2.5 rounded-xl border text-xs flex items-center justify-between" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                    <div>
                      <div className="font-semibold">{tb.title}</div>
                      <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{tb.startTime} - {tb.endTime}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Focus Sessions Completed Today */}
          <div
            className="p-5 rounded-2xl border shadow-sm"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                <Timer className="w-4 h-4 text-indigo-500" />
                <span>Focus Completed ({focusSessions.length})</span>
              </div>
              <button
                onClick={() => onNavigate('focus')}
                className="text-xs hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                Timer
              </button>
            </div>

            {focusSessions.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                No focus sprints logged yet today.
              </p>
            ) : (
              <div className="space-y-2">
                {focusSessions.map(fs => (
                  <div key={fs.id} className="p-2 rounded-lg border text-xs flex justify-between" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                    <span>{fs.notes || 'Focus sprint'}</span>
                    <span className="font-bold">{fs.durationMinutes}m</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
