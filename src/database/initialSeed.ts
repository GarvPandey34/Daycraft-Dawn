// ==========================================
// DAYCRAFT — INITIAL CONFIGURATION & CLEAN SEED
// Genuinely empty personal state with valid system defaults
// ==========================================

import {
  CalendarEvent,
  FocusSession,
  Goal,
  Habit,
  HabitOccurrence,
  HabitRoutine,
  JournalEntry,
  Project,
  StudySession,
  StudySubject,
  Task,
  TimeBlock,
  UserSettings,
  WellnessEntry,
  WellnessTracker,
  XpLedgerEntry,
} from '../domain/models';

export const DEFAULT_WELLNESS_TRACKERS: WellnessTracker[] = [
  {
    id: 'w_1',
    name: 'Sleep Quality',
    category: 'sleep',
    type: 'duration_hours',
    unit: 'hrs',
    icon: 'Moon',
    color: '#4B6B94',
    targetDailyValue: 8,
    enabled: true,
  },
  {
    id: 'w_2',
    name: 'Daily Hydration',
    category: 'hydration',
    type: 'numeric',
    unit: 'glasses',
    icon: 'Droplet',
    color: '#0284C7',
    targetDailyValue: 8,
    enabled: true,
  },
  {
    id: 'w_3',
    name: 'Movement & Walking',
    category: 'movement',
    type: 'numeric',
    unit: 'steps',
    icon: 'Footprints',
    color: '#3E7051',
    targetDailyValue: 8000,
    enabled: true,
  },
  {
    id: 'w_4',
    name: 'Energy Level',
    category: 'energy',
    type: 'scale_5',
    unit: 'scale 1-5',
    icon: 'Zap',
    color: '#D47B5F',
    enabled: true,
  },
];

export function getInitialSeedData() {
  const tasks: Task[] = [];
  const habits: Habit[] = [];
  const habitOccurrences: HabitOccurrence[] = [];
  const habitRoutines: HabitRoutine[] = [];
  const projects: Project[] = [];
  const goals: Goal[] = [];
  const calendarEvents: CalendarEvent[] = [];
  const timeBlocks: TimeBlock[] = [];
  const focusSessions: FocusSession[] = [];
  const studySubjects: StudySubject[] = [];
  const studySessions: StudySession[] = [];
  const wellnessTrackers: WellnessTracker[] = DEFAULT_WELLNESS_TRACKERS.map(t => ({ ...t }));
  const wellnessEntries: WellnessEntry[] = [];
  const journalEntries: JournalEntry[] = [];
  const xpLedger: XpLedgerEntry[] = [];

  const defaultSettings: UserSettings = {
    appName: 'Daycraft',
    themePreset: 'warm_paper',
    themeMode: 'light',
    reduceMotion: 'system',
    appLockEnabled: false,
    biometricsEnabled: false,
    lockTimeoutMinutes: 5,
    soundEnabled: true,
    soundVolume: 0.5,
    celebrationEnabled: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    notificationsEnabled: true,
    remindersLeadMinutes: 15,
    gamificationEnabled: true,
    claimedLevelRewards: [],
    unseenAchievementIds: [],
    defaultFocusDurationMinutes: 25,
    defaultShortBreakMinutes: 5,
    defaultLongBreakMinutes: 15,
    focusDeviceSettings: {
      askBeforeSession: true,
      defaultDeviceMode: 'ask',
      restorePreviousMode: true,
      allowAutomaticChanges: false,
      showDeviceModeStatus: true,
      suppressPromptDuringQuietHours: false,
    },
    autoBackupEnabled: true,
    autoBackupDays: 7,
    lastBackupDate: undefined,
  };

  return {
    tasks,
    habits,
    habitOccurrences,
    habitRoutines,
    projects,
    goals,
    calendarEvents,
    timeBlocks,
    focusSessions,
    studySubjects,
    studySessions,
    wellnessTrackers,
    wellnessEntries,
    journalEntries,
    xpLedger,
    defaultSettings,
  };
}
