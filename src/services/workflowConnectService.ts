import { DatabaseManager, db as defaultDb } from '../database/db';
import { JournalEntry, Task, TimeBlock, UserSettings } from '../domain/models';
import { addDays, formatLocalDate } from './streakService';

export interface ScheduleTaskOptions {
  date?: string; // YYYY-MM-DD, defaults to task.dueDate || today
  preferredStartTime?: string; // HH:mm
  durationMinutes?: number;
}

/**
 * Finds the next available 30-minute slot on a given date between 08:00 and 20:30,
 * or uses the task's dueTime / preferredStartTime if specified.
 */
export function findNextAvailableTimeSlot(
  existingBlocks: TimeBlock[],
  date: string,
  durationMinutes: number = 60,
  preferredStartTime?: string
): { startTime: string; endTime: string } {
  const clampDuration = Math.max(15, Math.min(240, durationMinutes || 60));

  const toMinutes = (hhmm: string): number => {
    const [h, m] = hhmm.split(':').map(Number);
    return (Number.isFinite(h) ? h : 9) * 60 + (Number.isFinite(m) ? m : 0);
  };

  const toHHMM = (totalMins: number): string => {
    const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMins));
    const h = Math.floor(clamped / 60);
    const m = clamped % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const dayBlocks = existingBlocks.filter(b => b.date === date);

  if (preferredStartTime && /^\d{2}:\d{2}$/.test(preferredStartTime)) {
    const startMins = toMinutes(preferredStartTime);
    return {
      startTime: toHHMM(startMins),
      endTime: toHHMM(startMins + clampDuration),
    };
  }

  // Candidate slots from 09:00 to 20:00 in 30-min increments
  for (let startMins = 9 * 60; startMins <= 20 * 60; startMins += 30) {
    const endMins = startMins + clampDuration;
    const hasOverlap = dayBlocks.some(b => {
      const bStart = toMinutes(b.startTime);
      const bEnd = toMinutes(b.endTime);
      return startMins < bEnd && endMins > bStart;
    });
    if (!hasOverlap) {
      return {
        startTime: toHHMM(startMins),
        endTime: toHHMM(endMins),
      };
    }
  }

  return {
    startTime: '09:00',
    endTime: toHHMM(9 * 60 + clampDuration),
  };
}

/**
 * Schedules a Task as a TimeBlock on the Calendar without duplicating if already scheduled on that date.
 */
export function scheduleTaskToCalendar(
  task: Task,
  options: ScheduleTaskOptions = {},
  database: DatabaseManager = defaultDb
): { block: TimeBlock; alreadyScheduled: boolean } {
  const todayStr = formatLocalDate(new Date());
  const targetDate =
    options.date ||
    (task.dueDate && task.dueDate >= todayStr ? task.dueDate : todayStr);

  const existingBlocks = database.getTimeBlocks();
  const existingForTask = existingBlocks.find(
    b => b.linkedTaskId === task.id && b.date === targetDate
  );

  if (existingForTask) {
    return { block: existingForTask, alreadyScheduled: true };
  }

  const duration = options.durationMinutes || task.estimatedMinutes || 60;
  const { startTime, endTime } = findNextAvailableTimeSlot(
    existingBlocks,
    targetDate,
    duration,
    options.preferredStartTime || task.dueTime
  );

  const priorityColors: Record<Task['priority'], string> = {
    urgent: '#dc2626',
    high: '#d97706',
    medium: '#1B6B4A',
    low: '#0284c7',
  };

  const newBlock: TimeBlock = {
    id: `tb_task_${task.id}_${Date.now()}`,
    date: targetDate,
    startTime,
    endTime,
    title: task.title,
    linkedTaskId: task.id,
    linkedProjectId: task.projectId,
    color: priorityColors[task.priority] || '#1B6B4A',
  };

  database.saveTimeBlock(newBlock);
  return { block: newBlock, alreadyScheduled: false };
}

export const TASK_DRAG_MIME = 'application/x-daycraft-task-id';
export const TASK_DRAG_PREFIX = 'daycraft-task:';

let activeDraggedTaskId: string | null = null;

export function setActiveDraggedTaskId(taskId: string | null): void {
  activeDraggedTaskId = taskId;
}

export function getActiveDraggedTaskId(): string | null {
  return activeDraggedTaskId;
}

/**
 * Populates a DragEvent DataTransfer with a task ID so it can be dropped
 * onto Calendar time slots, Month day cells, or the Calendar navigation tab.
 */
export function setTaskDragData(
  dataTransfer: Pick<DataTransfer, 'setData'> & { effectAllowed?: string },
  taskId: string
): void {
  activeDraggedTaskId = taskId;
  try {
    dataTransfer.setData(TASK_DRAG_MIME, taskId);
    dataTransfer.setData('text/plain', `${TASK_DRAG_PREFIX}${taskId}`);
    if ('effectAllowed' in dataTransfer) {
      dataTransfer.effectAllowed = 'copyMove';
    }
  } catch {
    // Fallback uses activeDraggedTaskId in environments with restricted DataTransfer
  }
}

/**
 * Extracts a dragged Task ID from DataTransfer (or active drag state), returning null
 * if the dragged item is not a valid task.
 */
export function extractDraggedTaskId(
  dataTransfer?: Pick<DataTransfer, 'getData'> | null,
  fallbackId?: string | null,
  database: DatabaseManager = defaultDb
): string | null {
  let candidate: string | null = null;

  if (dataTransfer) {
    try {
      const custom = dataTransfer.getData(TASK_DRAG_MIME);
      if (custom) {
        candidate = custom.trim();
      } else {
        const plain = dataTransfer.getData('text/plain');
        if (plain && plain.startsWith(TASK_DRAG_PREFIX)) {
          candidate = plain.slice(TASK_DRAG_PREFIX.length).trim();
        } else if (plain) {
          candidate = plain.trim();
        }
      }
    } catch {
      // Ignore DataTransfer read errors
    }
  }

  if (!candidate && fallbackId) {
    candidate = fallbackId.startsWith(TASK_DRAG_PREFIX)
      ? fallbackId.slice(TASK_DRAG_PREFIX.length).trim()
      : fallbackId.trim();
  }

  if (!candidate && activeDraggedTaskId) {
    candidate = activeDraggedTaskId;
  }

  if (!candidate) return null;

  const exists = database.getTasks().some(t => t.id === candidate);
  return exists ? candidate : null;
}

export interface TaskDropScheduleResult {
  block: TimeBlock;
  task: Task;
  updatedExisting: boolean;
}

/**
 * Handles dropping a Task into the Calendar component view (either onto a specific
 * HH:mm time slot or onto a YYYY-MM-DD date cell) to automatically schedule it as a TimeBlock.
 */
export function handleTaskDropToCalendar(
  taskId: string,
  options: {
    date?: string;
    startTime?: string;
    durationMinutes?: number;
  } = {},
  database: DatabaseManager = defaultDb
): TaskDropScheduleResult | null {
  const cleanId = taskId.startsWith(TASK_DRAG_PREFIX)
    ? taskId.slice(TASK_DRAG_PREFIX.length).trim()
    : taskId.trim();

  const task = database.getTasks().find(t => t.id === cleanId);
  if (!task) return null;

  const targetDate = options.date || formatLocalDate(new Date());

  const duration = Math.max(
    15,
    Math.min(240, options.durationMinutes || task.estimatedMinutes || 60)
  );

  const existingBlocks = database.getTimeBlocks();
  const existingForTaskOnDate = existingBlocks.find(
    b => b.linkedTaskId === task.id && b.date === targetDate
  );

  const { startTime, endTime } = findNextAvailableTimeSlot(
    existingBlocks.filter(b => b.id !== existingForTaskOnDate?.id),
    targetDate,
    duration,
    options.startTime || task.dueTime
  );

  const priorityColors: Record<Task['priority'], string> = {
    urgent: '#dc2626',
    high: '#d97706',
    medium: '#1B6B4A',
    low: '#0284c7',
  };

  const block: TimeBlock = existingForTaskOnDate
    ? {
        ...existingForTaskOnDate,
        date: targetDate,
        startTime,
        endTime,
        title: task.title,
        color: existingForTaskOnDate.color || priorityColors[task.priority] || '#1B6B4A',
      }
    : {
        id: `tb_task_${task.id}_${Date.now()}`,
        date: targetDate,
        startTime,
        endTime,
        title: task.title,
        linkedTaskId: task.id,
        linkedProjectId: task.projectId,
        color: priorityColors[task.priority] || '#1B6B4A',
      };

  database.saveTimeBlock(block);
  activeDraggedTaskId = null;

  return {
    block,
    task,
    updatedExisting: Boolean(existingForTaskOnDate),
  };
}

export interface DailyActivitySummary {
  date: string;
  completedTasks: { id: string; title: string; priority: Task['priority'] }[];
  completedHabits: { id: string; name: string; recordedValue: number; unit: string }[];
  focusMinutes: number;
  focusSessionsCount: number;
}

/**
 * Computes a summary of tasks completed, habits logged, and focus minutes for a given YYYY-MM-DD date.
 */
export function getDailyActivitySummary(
  date: string,
  database: DatabaseManager = defaultDb
): DailyActivitySummary {
  const tasks = database.getTasks().filter(t => !t.archived);
  const completedTasks = tasks
    .filter(t => {
      if (t.status !== 'completed') return false;
      if (t.completedAt) {
        const completedLocal = formatLocalDate(new Date(t.completedAt));
        if (completedLocal === date) return true;
      }
      return t.dueDate === date;
    })
    .map(t => ({ id: t.id, title: t.title, priority: t.priority }));

  const habits = database.getHabits();
  const occurrences = database
    .getHabitOccurrences()
    .filter(o => o.date === date && o.status === 'completed');

  const completedHabits = occurrences.map(occ => {
    const habit = habits.find(h => h.id === occ.habitId);
    return {
      id: occ.habitId,
      name: habit ? habit.name : 'Habit',
      recordedValue: occ.recordedValue,
      unit: habit ? habit.targetUnit : '',
    };
  });

  const focusSessions = database.getFocusSessions().filter(s => {
    if (!s.completed || s.type !== 'focus') return false;
    if (s.startTime.startsWith(date)) return true;
    const parsed = new Date(s.startTime);
    return !Number.isNaN(parsed.getTime()) && formatLocalDate(parsed) === date;
  });

  const focusMinutes = focusSessions.reduce(
    (sum, s) => sum + (Number.isFinite(s.durationMinutes) ? s.durationMinutes : 0),
    0
  );

  return {
    date,
    completedTasks,
    completedHabits,
    focusMinutes,
    focusSessionsCount: focusSessions.length,
  };
}

export function formatDailySummaryMarkdown(summary: DailyActivitySummary): string {
  const lines: string[] = [`\n### Daily Activity Snapshot (${summary.date})`];
  if (summary.completedTasks.length > 0) {
    lines.push(
      `- **Tasks Completed (${summary.completedTasks.length}):** ${summary.completedTasks
        .map(t => t.title)
        .join(', ')}`
    );
  } else {
    lines.push(`- **Tasks Completed:** 0`);
  }

  if (summary.completedHabits.length > 0) {
    lines.push(
      `- **Habits Logged (${summary.completedHabits.length}):** ${summary.completedHabits
        .map(h => `${h.name} (${h.recordedValue} ${h.unit})`.trim())
        .join(', ')}`
    );
  } else {
    lines.push(`- **Habits Logged:** 0`);
  }

  lines.push(
    `- **Deep Focus:** ${summary.focusMinutes} mins (${summary.focusSessionsCount} session${
      summary.focusSessionsCount === 1 ? '' : 's'
    })`
  );

  return lines.join('\n');
}

export interface EndOfDayShutdownInput {
  date: string;
  rolloverUnfinishedTasks: boolean;
  reflectionLine: string;
  mood?: number;
  energy?: number;
}

export interface EndOfDayShutdownResult {
  rolledOverCount: number;
  targetTomorrowDate: string;
  journalEntry?: JournalEntry;
}

/**
 * Executes the 2-Minute End-of-Day Shutdown:
 * 1. Optionally rolls unfinished tasks due on or before `date` over to tomorrow.
 * 2. Saves or appends a one-line reflection to `date`'s JournalEntry.
 */
export function performEndOfDayShutdown(
  input: EndOfDayShutdownInput,
  database: DatabaseManager = defaultDb
): EndOfDayShutdownResult {
  const tomorrowDate = addDays(input.date, 1);
  let rolledOverCount = 0;

  if (input.rolloverUnfinishedTasks) {
    const unfinishedDueOrOverdue = database
      .getTasks()
      .filter(
        t =>
          !t.archived &&
          t.status !== 'completed' &&
          t.dueDate &&
          t.dueDate <= input.date
      );

    for (const task of unfinishedDueOrOverdue) {
      database.saveTask({
        ...task,
        dueDate: tomorrowDate,
        updatedAt: new Date().toISOString(),
      });
      rolledOverCount++;
    }
  }

  let savedJournalEntry: JournalEntry | undefined;
  const trimmedReflection = input.reflectionLine.trim();

  if (trimmedReflection) {
    const existingEntries = database.getJournalEntries();
    const existingToday = existingEntries.find(e => e.date === input.date);
    const summary = getDailyActivitySummary(input.date, database);
    const summaryFooter = formatDailySummaryMarkdown(summary);
    const nowIso = new Date().toISOString();

    if (existingToday) {
      const updatedContent = `${existingToday.content.trim()}\n\n### Evening Shutdown Reflection\n> ${trimmedReflection}\n${summaryFooter}`;
      savedJournalEntry = {
        ...existingToday,
        content: updatedContent,
        mood: input.mood ?? existingToday.mood,
        energy: input.energy ?? existingToday.energy,
        tags: Array.from(new Set([...(existingToday.tags || []), 'shutdown'])),
        updatedAt: nowIso,
      };
      database.saveJournalEntry(savedJournalEntry);
    } else {
      savedJournalEntry = {
        id: `j_shutdown_${Date.now()}`,
        date: input.date,
        title: `Evening Shutdown — ${input.date}`,
        content: `# Evening Shutdown\n\n> ${trimmedReflection}\n${summaryFooter}`,
        mood: input.mood ?? 4,
        energy: input.energy ?? 4,
        tags: ['reflection', 'shutdown'],
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      database.saveJournalEntry(savedJournalEntry);
    }
  }

  return {
    rolledOverCount,
    targetTomorrowDate: tomorrowDate,
    journalEntry: savedJournalEntry,
  };
}

export interface BackupReminderStatus {
  isDue: boolean;
  daysSinceLastBackup: number | null;
  thresholdDays: number;
  label: string;
}

/**
 * Evaluates whether a gentle local backup reminder should be displayed
 * (default threshold: 14 days when no backup has been exported recently).
 */
export function getBackupReminderStatus(
  settings: Pick<UserSettings, 'lastBackupDate' | 'autoBackupDays'>,
  now: Date = new Date()
): BackupReminderStatus {
  const thresholdDays =
    typeof settings.autoBackupDays === 'number' && settings.autoBackupDays >= 14
      ? settings.autoBackupDays
      : 14;

  if (!settings.lastBackupDate) {
    return {
      isDue: true,
      daysSinceLastBackup: null,
      thresholdDays,
      label: 'No local backup exported yet',
    };
  }

  const lastDate = new Date(settings.lastBackupDate);
  if (Number.isNaN(lastDate.getTime())) {
    return {
      isDue: true,
      daysSinceLastBackup: null,
      thresholdDays,
      label: 'Backup date unknown — export recommended',
    };
  }

  const diffMs = Math.max(0, now.getTime() - lastDate.getTime());
  const daysSince = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const isDue = daysSince >= thresholdDays;

  return {
    isDue,
    daysSinceLastBackup: daysSince,
    thresholdDays,
    label: isDue
      ? `Last backup was ${daysSince} days ago`
      : `Backed up ${daysSince === 0 ? 'today' : `${daysSince}d ago`}`,
  };
}
