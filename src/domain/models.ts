// ==========================================
// DAYCRAFT — DOMAIN MODELS & TYPES
// A Private, Offline-First Personal Life Management System
// ==========================================

export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'inbox' | 'todo' | 'in_progress' | 'completed' | 'archived';

export interface RecurrenceRule {
  type: 'none' | 'daily' | 'weekly' | 'weekdays' | 'monthly' | 'custom';
  intervalDays?: number; // e.g. every 3 days
  selectedDays?: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  endDate?: string; // ISO date string (YYYY-MM-DD)
}

export interface Task {
  id: string;
  title: string;
  description: string;
  createdAt: string; // ISO timestamp
  updatedAt: string;
  status: TaskStatus;
  priority: Priority;
  startDate?: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  estimatedMinutes?: number;
  actualMinutes?: number;
  projectId?: string;
  parentTaskId?: string;
  tags: string[];
  recurrence?: RecurrenceRule;
  reminderMinutesBefore?: number;
  completedAt?: string;
  archived: boolean;
  dependsOnTaskId?: string;
}

export type HabitTargetType = 'boolean' | 'numeric' | 'duration' | 'counter';
export type HabitScheduleType = 'daily' | 'weekdays' | 'weekly_target' | 'custom';
export type HabitOccurrenceStatus = 'completed' | 'skipped' | 'missed';

export interface Habit {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  startDate: string; // YYYY-MM-DD
  scheduleType: HabitScheduleType;
  selectedDays?: number[]; // 0 = Sun, 1 = Mon...
  weeklyTargetCount?: number;
  targetType: HabitTargetType;
  targetValue: number; // e.g. 1 for boolean, 20 for pages, 45 for mins, 8 for glasses
  targetUnit: string; // e.g. "pages", "mins", "glasses", "times"
  preferredTimeOfDay?: 'morning' | 'afternoon' | 'evening' | 'anytime';
  reminderTime?: string; // HH:mm
  archived: boolean;
  restDays?: number[]; // e.g. [0] for Sunday rest day
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HabitOccurrence {
  id: string;
  habitId: string;
  date: string; // YYYY-MM-DD (local date representation)
  recordedValue: number;
  targetValue: number;
  status: HabitOccurrenceStatus;
  completedAt?: string;
  note?: string;
}

export interface HabitStreakStats {
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  completionRate7d: number;
  completionRate30d: number;
  totalScheduledDays: number;
}

export interface ProjectMilestone {
  id: string;
  title: string;
  targetDate?: string;
  completed: boolean;
  completedAt?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  startDate?: string;
  targetDate?: string;
  status: 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'archived';
  milestones: ProjectMilestone[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoalMilestone {
  id: string;
  title: string;
  completed: boolean;
  targetDate?: string;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  category: string;
  color: string;
  startDate: string;
  targetDate: string;
  status: 'active' | 'paused' | 'achieved' | 'archived';
  isMeasurable: boolean;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  linkedProjectIds: string[];
  linkedHabitIds: string[];
  milestones: GoalMilestone[];
  notes?: string;
  achievedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endDate: string; // YYYY-MM-DD
  endTime?: string; // HH:mm
  allDay: boolean;
  color?: string;
  location?: string;
  linkedTaskId?: string;
  linkedProjectId?: string;
  reminderMinutes?: number;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
  createdAt: string;
}

export interface TimeBlock {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  title: string;
  linkedTaskId?: string;
  linkedProjectId?: string;
  notes?: string;
  color?: string;
}

export interface FocusSession {
  id: string;
  startTime: string; // ISO timestamp
  endTime: string; // ISO timestamp
  durationMinutes: number;
  type: 'focus' | 'short_break' | 'long_break';
  completed: boolean;
  linkedTaskId?: string;
  linkedSubjectId?: string;
  notes?: string;
}

export interface StudySubject {
  id: string;
  name: string;
  color: string;
  icon: string;
  weeklyGoalHours: number;
  notes?: string;
  topics: string[];
  createdAt: string;
}

export interface StudySession {
  id: string;
  subjectId: string;
  date: string; // YYYY-MM-DD
  durationMinutes: number;
  topic?: string;
  notes?: string;
  linkedFocusSessionId?: string;
  createdAt: string;
}

export type WellnessMetricType = 'numeric' | 'scale_5' | 'duration_hours' | 'boolean';

export interface WellnessTracker {
  id: string;
  name: string;
  category: 'sleep' | 'hydration' | 'movement' | 'mood' | 'energy' | 'routine' | 'custom';
  type: WellnessMetricType;
  unit: string; // e.g. "hrs", "glasses", "steps", "1-5"
  icon: string;
  color: string;
  targetDailyValue?: number;
  enabled: boolean;
}

export interface WellnessEntry {
  id: string;
  trackerId: string;
  date: string; // YYYY-MM-DD
  value: number; // e.g. 7.5 hrs, 8 glasses, 4 for mood
  note?: string;
  recordedAt: string;
}

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  content: string; // structured rich text or markdown
  mood?: number; // 1 to 5
  energy?: number; // 1 to 5
  tags: string[];
  linkedTaskIds?: string[];
  linkedGoalIds?: string[];
  linkedProjectIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: 'consistency' | 'productivity' | 'focus' | 'learning' | 'mastery';
  icon: string;
  xpReward: number;
  unlockedAt?: string;
  progress: number; // 0 to 100
  target: number;
  current: number;
}

export interface XpLedgerEntry {
  id: string;
  timestamp: string;
  xp: number;
  sourceType:
    | 'task_completed'
    | 'habit_completed'
    | 'routine_completed'
    | 'goal_achieved'
    | 'focus_session'
    | 'study_session'
    | 'achievement_unlocked'
    | 'journal_entry';
  sourceId: string;
  description: string;
  occurrenceDate?: string;
  rewardKey?: string;
}

export type DeviceFocusMode = 'ask' | 'silent' | 'vibrate' | 'sound' | 'dnd';

export interface FocusDeviceSettings {
  askBeforeSession: boolean;
  defaultDeviceMode?: DeviceFocusMode;
  defaultMode?: DeviceFocusMode;
  restorePreviousMode?: boolean;
  restoreAfterFocus?: boolean;
  allowAutomaticChanges?: boolean;
  allowAutoModeChanges?: boolean;
  showDeviceModeStatus?: boolean;
  showStatusDuringFocus?: boolean;
  suppressPromptDuringQuietHours?: boolean;
  suppressDuringQuietHours?: boolean;
}

export interface UserSettings {
  appName: string;
  themePreset:
    | 'warm_paper'
    | 'midnight'
    | 'emerald_luxe'
    | 'aurora'
    | 'solar_gold'
    | 'sage_garden'
    | 'lavender_haze'
    | 'sunset'
    | 'monochrome';
  themeMode: 'light' | 'dark' | 'system';
  reduceMotion?: 'system' | 'reduced' | 'full';
  appLockEnabled: boolean;
  appLockPinHash?: string; // salted hash
  appLockSalt?: string;
  biometricsEnabled: boolean;
  lockTimeoutMinutes: number;
  soundEnabled: boolean;
  soundVolume: number; // 0 to 1
  celebrationEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "22:00"
  quietHoursEnd: string; // "07:00"
  notificationsEnabled: boolean;
  remindersLeadMinutes: number;
  gamificationEnabled: boolean;
  claimedLevelRewards?: number[];
  unseenAchievementIds?: string[];
  defaultFocusDurationMinutes: number;
  defaultShortBreakMinutes: number;
  defaultLongBreakMinutes: number;
  focusDeviceSettings?: FocusDeviceSettings;
  autoBackupEnabled: boolean;
  autoBackupDays: number;
  lastBackupDate?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'task' | 'habit' | 'focus' | 'achievement' | 'reminder' | 'system';
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

export interface HabitRoutine {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'anytime';
  habitIds: string[]; // ordered sequence of habits
  completionsCount: number;
  lastCompletedDate?: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
}
