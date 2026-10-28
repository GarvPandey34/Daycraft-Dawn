// ==========================================
// DAYCRAFT — STREAK CALCULATION ENGINE
// Honest, forgiving habit tracking with rest days & skip support
// ==========================================

import { Habit, HabitOccurrence, HabitStreakStats } from '../domain/models';

/**
 * Formats a Date object to YYYY-MM-DD in local time
 */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parse YYYY-MM-DD into a local Date object at midnight
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * Add days to a local date string
 */
export function addDays(dateStr: string, days: number): string {
  const date = parseLocalDate(dateStr);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

/**
 * Checks if a habit is scheduled on a specific date
 */
export function isHabitScheduledOnDate(habit: Habit, dateStr: string): boolean {
  if (dateStr < habit.startDate) return false;
  if (habit.archived) return false;

  const date = parseLocalDate(dateStr);
  const dayOfWeek = date.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

  // Check planned rest days
  if (habit.restDays && habit.restDays.includes(dayOfWeek)) {
    return false; // Planned rest day
  }

  switch (habit.scheduleType) {
    case 'daily':
      return true;
    case 'weekdays':
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    case 'custom':
      return habit.selectedDays ? habit.selectedDays.includes(dayOfWeek) : true;
    case 'weekly_target':
      return true; // Scheduled as flexible weekly target
    default:
      return true;
  }
}

/**
 * Checks whether an occurrence meets completion criteria
 */
export function isOccurrenceCompleted(habit: Habit, occurrence?: HabitOccurrence): boolean {
  if (!occurrence) return false;
  if (occurrence.status === 'completed') {
    return occurrence.recordedValue >= habit.targetValue;
  }
  return false;
}

/**
 * Calculate streak and historical statistics for a habit.
 * 
 * Rules:
 * 1. A planned rest day DOES NOT break a streak.
 * 2. An explicitly skipped occurrence does not break streak (excused).
 * 3. A missed scheduled day breaks the streak.
 * 4. Numeric habits only count as completed when recordedValue >= targetValue.
 * 5. Streaks are calculated deterministically from chronological occurrences.
 */
export function calculateHabitStreak(
  habit: Habit,
  occurrences: HabitOccurrence[],
  todayStr: string = formatLocalDate(new Date())
): HabitStreakStats {
  const occurrenceMap = new Map<string, HabitOccurrence>();
  for (const occ of occurrences) {
    if (occ.habitId === habit.id) {
      occurrenceMap.set(occ.date, occ);
    }
  }

  // Generate list of days from startDate up to today
  const start = habit.startDate > todayStr ? todayStr : habit.startDate;
  let currentPtr = start;
  const days: { date: string; scheduled: boolean; completed: boolean; skipped: boolean; restDay: boolean }[] = [];

  while (currentPtr <= todayStr) {
    const date = parseLocalDate(currentPtr);
    const dayOfWeek = date.getDay();
    const isRestDay = Boolean(habit.restDays && habit.restDays.includes(dayOfWeek));
    const scheduled = isHabitScheduledOnDate(habit, currentPtr);
    const occ = occurrenceMap.get(currentPtr);

    const completed = isOccurrenceCompleted(habit, occ);
    const skipped = occ?.status === 'skipped';

    days.push({
      date: currentPtr,
      scheduled,
      completed,
      skipped,
      restDay: isRestDay,
    });

    currentPtr = addDays(currentPtr, 1);
  }

  // Calculate Current Streak backwards from today
  let currentStreak = 0;
  let idx = days.length - 1;

  // If today is scheduled and not yet completed, but it's today, we don't break streak if yesterday was maintained
  if (idx >= 0 && days[idx].date === todayStr) {
    if (days[idx].completed) {
      currentStreak++;
      idx--;
    } else if (days[idx].skipped || days[idx].restDay || !days[idx].scheduled) {
      // Allowed to continue checking yesterday
      idx--;
    } else {
      // Today is pending (not yet missed, user still has time today)
      idx--;
    }
  }

  while (idx >= 0) {
    const day = days[idx];
    if (day.completed) {
      currentStreak++;
    } else if (day.skipped || day.restDay || !day.scheduled) {
      // Rest day or excused skip does not break streak, but also doesn't add to count
    } else {
      // Truly missed scheduled day breaks current streak
      break;
    }
    idx--;
  }

  // Calculate Longest Streak forwards
  let longestStreak = 0;
  let runningStreak = 0;

  for (const day of days) {
    if (day.completed) {
      runningStreak++;
      if (runningStreak > longestStreak) {
        longestStreak = runningStreak;
      }
    } else if (day.skipped || day.restDay || !day.scheduled) {
      // Maintains streak
    } else {
      runningStreak = 0;
    }
  }

  // Calculate completion rates
  const totalCompletions = days.filter(d => d.completed).length;
  const scheduledDays = days.filter(d => d.scheduled);
  const totalScheduledDays = scheduledDays.length;

  // Last 7 days rate
  const last7Days = days.slice(-7);
  const scheduled7d = last7Days.filter(d => d.scheduled);
  const completed7d = last7Days.filter(d => d.completed);
  const completionRate7d = scheduled7d.length > 0 ? Math.round((completed7d.length / scheduled7d.length) * 100) : 100;

  // Last 30 days rate
  const last30Days = days.slice(-30);
  const scheduled30d = last30Days.filter(d => d.scheduled);
  const completed30d = last30Days.filter(d => d.completed);
  const completionRate30d = scheduled30d.length > 0 ? Math.round((completed30d.length / scheduled30d.length) * 100) : 100;

  return {
    currentStreak,
    longestStreak,
    totalCompletions,
    completionRate7d,
    completionRate30d,
    totalScheduledDays,
  };
}
