import { Habit, HabitOccurrence, Task } from '../domain/models';
import { addDays, formatLocalDate, parseLocalDate } from './streakService';

export interface CompletedHabitDetail {
  habitId: string;
  habitName: string;
  category: string;
  icon: string;
  color: string;
  recordedValue: number;
  targetValue: number;
  targetUnit: string;
}

export interface DayCompletionData {
  date: string; // YYYY-MM-DD
  dayLabel: string; // "Mon", "Tue", or "Today"
  displayDate: string; // e.g. "Oct 15"
  isToday: boolean;
  tasksCount: number;
  habitsCount: number;
  totalCount: number;
  completedTasks: Task[];
  completedHabits: CompletedHabitDetail[];
}

export interface SevenDayCompletionSummary {
  days: DayCompletionData[];
  totalTasks: number;
  totalHabits: number;
  grandTotal: number;
  dailyAverage: number;
  bestDay: DayCompletionData | null;
  taskPercentage: number;
  habitPercentage: number;
  velocityTrend: 'increasing' | 'stable' | 'decreasing';
  completionStreakDays: number;
}

/**
 * Extracts the local YYYY-MM-DD date string when a task was completed
 */
export function getTaskCompletionDate(task: Task): string | null {
  if (task.status !== 'completed') return null;

  if (task.completedAt) {
    try {
      const d = new Date(task.completedAt);
      if (!isNaN(d.getTime())) {
        return formatLocalDate(d);
      }
    } catch {
      // fallback
    }
  }

  // Fallback to dueDate if completed without timestamp
  if (task.dueDate) {
    return task.dueDate;
  }

  // Fallback to updatedAt
  if (task.updatedAt) {
    try {
      const d = new Date(task.updatedAt);
      if (!isNaN(d.getTime())) {
        return formatLocalDate(d);
      }
    } catch {
      // fallback
    }
  }

  return null;
}

/**
 * Aggregates task and habit completions for the past 7 days (ending on referenceDate or today)
 */
export function getSevenDayCompletionData(
  tasks: Task[],
  habits: Habit[],
  occurrences: HabitOccurrence[],
  referenceDateStr?: string
): SevenDayCompletionSummary {
  const todayStr = referenceDateStr || formatLocalDate(new Date());
  const habitMap = new Map<string, Habit>();
  habits.forEach(h => habitMap.set(h.id, h));

  // Build the 7 days array: [today - 6, today - 5, ..., today]
  const days: DayCompletionData[] = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = 6; i >= 0; i--) {
    const dateStr = addDays(todayStr, -i);
    const dateObj = parseLocalDate(dateStr);
    const isToday = i === 0;
    const dayOfWeek = dayNames[dateObj.getDay()];
    const month = monthNames[dateObj.getMonth()];
    const dayOfMonth = dateObj.getDate();

    // 1. Find tasks completed on this date
    const dayCompletedTasks = tasks.filter(t => {
      const compDate = getTaskCompletionDate(t);
      return compDate === dateStr;
    });

    // 2. Find habits completed on this date
    const dayOccurrences = occurrences.filter(
      o => o.date === dateStr && o.status === 'completed' && o.recordedValue >= o.targetValue
    );

    const dayCompletedHabits: CompletedHabitDetail[] = dayOccurrences
      .map(occ => {
        const habit = habitMap.get(occ.habitId);
        return {
          habitId: occ.habitId,
          habitName: habit ? habit.name : 'Kept Habit',
          category: habit ? habit.category : 'general',
          icon: habit ? habit.icon : 'Check',
          color: habit ? habit.color : '#C86D51',
          recordedValue: occ.recordedValue,
          targetValue: occ.targetValue,
          targetUnit: habit ? habit.targetUnit : '',
        };
      })
      // Avoid duplicate occurrences for same habit on same day
      .filter((item, index, self) => index === self.findIndex(t => t.habitId === item.habitId));

    const tasksCount = dayCompletedTasks.length;
    const habitsCount = dayCompletedHabits.length;

    days.push({
      date: dateStr,
      dayLabel: isToday ? 'Today' : dayOfWeek,
      displayDate: `${month} ${dayOfMonth}`,
      isToday,
      tasksCount,
      habitsCount,
      totalCount: tasksCount + habitsCount,
      completedTasks: dayCompletedTasks,
      completedHabits: dayCompletedHabits,
    });
  }

  const totalTasks = days.reduce((sum, d) => sum + d.tasksCount, 0);
  const totalHabits = days.reduce((sum, d) => sum + d.habitsCount, 0);
  const grandTotal = totalTasks + totalHabits;
  const dailyAverage = Math.round((grandTotal / 7) * 10) / 10;

  // Best day: highest totalCount
  let bestDay: DayCompletionData | null = null;
  days.forEach(d => {
    if (!bestDay || d.totalCount > bestDay.totalCount) {
      bestDay = d;
    }
  });

  const taskPercentage = grandTotal > 0 ? Math.round((totalTasks / grandTotal) * 100) : 0;
  const habitPercentage = grandTotal > 0 ? Math.round((totalHabits / grandTotal) * 100) : 0;

  // Calculate 7-day velocity trend: first 3 days vs last 3 days
  const first3Days = days.slice(0, 3).reduce((sum, d) => sum + d.totalCount, 0);
  const last3Days = days.slice(4, 7).reduce((sum, d) => sum + d.totalCount, 0);
  let velocityTrend: 'increasing' | 'stable' | 'decreasing' = 'stable';
  if (last3Days > first3Days + 1) velocityTrend = 'increasing';
  else if (first3Days > last3Days + 1) velocityTrend = 'decreasing';

  // Completion streak days in the 7-day window (consecutive days with at least 1 completion up to today)
  let completionStreakDays = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].totalCount > 0) {
      completionStreakDays++;
    } else {
      break;
    }
  }

  return {
    days,
    totalTasks,
    totalHabits,
    grandTotal,
    dailyAverage,
    bestDay,
    taskPercentage,
    habitPercentage,
    velocityTrend,
    completionStreakDays,
  };
}
