// ==========================================
// DAYCRAFT — INITIAL SEED DATA
// Real, rich, inspiring productivity records
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
import { addDays, formatLocalDate } from '../services/streakService';

export function getInitialSeedData() {
  const today = formatLocalDate(new Date());
  const yesterday = addDays(today, -1);
  const twoDaysAgo = addDays(today, -2);
  const tomorrow = addDays(today, 1);
  const in3Days = addDays(today, 3);
  const in7Days = addDays(today, 7);

  const tasks: Task[] = [
    {
      id: 't_1',
      title: 'Review quarterly architecture roadmap',
      description: 'Audit offline SQLite database migrations and verify native adapter bridges.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'in_progress',
      priority: 'high',
      dueDate: today,
      dueTime: '15:00',
      estimatedMinutes: 60,
      projectId: 'p_1',
      tags: ['architecture', 'offline-first'],
      archived: false,
    },
    {
      id: 't_2',
      title: 'Draft weekly reflection and learning log',
      description: 'Summarize key breakthroughs and plan next study modules.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'todo',
      priority: 'medium',
      dueDate: today,
      projectId: 'p_2',
      tags: ['reflection'],
      archived: false,
    },
    {
      id: 't_3',
      title: 'Submit Android APK signing credentials report',
      description: 'Audit Keystore configs and verify SHA-256 fingerprint.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'todo',
      priority: 'urgent',
      dueDate: yesterday, // Intentionally overdue for testing!
      projectId: 'p_1',
      tags: ['security', 'android'],
      archived: false,
    },
    {
      id: 't_4',
      title: 'Deep reading on local quantized GGUF architectures',
      description: 'Read llama.cpp and WebLLM mobile performance papers.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'todo',
      priority: 'low',
      dueDate: tomorrow,
      projectId: 'p_3',
      tags: ['ai', 'learning'],
      archived: false,
    },
    {
      id: 't_5',
      title: 'Configure calm workspace lighting & backup drive',
      description: 'Format external solid state drive for local cold-storage backups.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'completed',
      priority: 'medium',
      dueDate: yesterday,
      completedAt: new Date(Date.now() - 86400000).toISOString(),
      tags: ['setup'],
      archived: false,
    },
  ];

  const habits: Habit[] = [
    {
      id: 'h_1',
      name: 'Morning Hydration',
      description: 'Drink 2 large glasses of water immediately upon waking',
      category: 'wellness',
      icon: 'Droplet',
      color: '#0284C7',
      startDate: twoDaysAgo,
      scheduleType: 'daily',
      targetType: 'numeric',
      targetValue: 8,
      targetUnit: 'glasses',
      preferredTimeOfDay: 'morning',
      archived: false,
      notes: 'Keeps focus sharp before morning deep work.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'h_2',
      name: 'Deep Focus Session',
      description: 'At least 45 minutes of distraction-free uninterrupted creative work',
      category: 'productivity',
      icon: 'Sparkles',
      color: '#C86D51',
      startDate: twoDaysAgo,
      scheduleType: 'weekdays',
      targetType: 'duration',
      targetValue: 45,
      targetUnit: 'mins',
      preferredTimeOfDay: 'morning',
      archived: false,
      restDays: [0, 6], // Weekends are rest days
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'h_3',
      name: 'Reading Physical Books',
      description: 'Read 20 pages of non-fiction or literature',
      category: 'learning',
      icon: 'BookOpen',
      color: '#3E7051',
      startDate: twoDaysAgo,
      scheduleType: 'daily',
      targetType: 'numeric',
      targetValue: 20,
      targetUnit: 'pages',
      preferredTimeOfDay: 'evening',
      archived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const habitOccurrences: HabitOccurrence[] = [
    // Water
    { id: 'o_1', habitId: 'h_1', date: twoDaysAgo, recordedValue: 8, targetValue: 8, status: 'completed' },
    { id: 'o_2', habitId: 'h_1', date: yesterday, recordedValue: 8, targetValue: 8, status: 'completed' },
    { id: 'o_3', habitId: 'h_1', date: today, recordedValue: 6, targetValue: 8, status: 'completed' },
    // Focus
    { id: 'o_4', habitId: 'h_2', date: twoDaysAgo, recordedValue: 50, targetValue: 45, status: 'completed' },
    { id: 'o_5', habitId: 'h_2', date: yesterday, recordedValue: 60, targetValue: 45, status: 'completed' },
    // Reading
    { id: 'o_6', habitId: 'h_3', date: twoDaysAgo, recordedValue: 25, targetValue: 20, status: 'completed' },
    { id: 'o_7', habitId: 'h_3', date: yesterday, recordedValue: 20, targetValue: 20, status: 'completed' },
  ];

  const projects: Project[] = [
    {
      id: 'p_1',
      name: 'Daycraft Native Release',
      description: 'Polishing Android APK and Windows Tauri executables with zero external telemetry.',
      color: '#C86D51',
      icon: 'Cpu',
      startDate: twoDaysAgo,
      targetDate: in7Days,
      status: 'in_progress',
      milestones: [
        { id: 'm_1', title: 'Local database migrations', completed: true, completedAt: yesterday },
        { id: 'm_2', title: 'Offline AI tool bridge verification', completed: true },
        { id: 'm_3', title: 'Native packaging instructions audit', completed: false },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'p_2',
      name: 'Personal Life Operating System',
      description: 'Habit anchoring, daily journaling rituals, and weekly reviews.',
      color: '#3E7051',
      icon: 'Compass',
      startDate: twoDaysAgo,
      targetDate: in3Days,
      status: 'in_progress',
      milestones: [
        { id: 'm_4', title: 'Complete 7-day habit streak', completed: false },
        { id: 'm_5', title: 'Archive 1st month journal backup', completed: false },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'p_3',
      name: 'Applied Machine Learning Mastery',
      description: 'Deep study into attention mechanisms and edge quantization.',
      color: '#7C5295',
      icon: 'Brain',
      status: 'planning',
      milestones: [
        { id: 'm_6', title: 'Study 10 hours of GGUF runtime internals', completed: false },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const goals: Goal[] = [
    {
      id: 'g_1',
      title: 'Establish Unbreakable Morning & Evening Routine',
      description: 'Wake up with hydration, meditate, and read before sleep.',
      category: 'lifestyle',
      color: '#3E7051',
      startDate: twoDaysAgo,
      targetDate: in7Days,
      status: 'active',
      isMeasurable: true,
      targetValue: 30,
      currentValue: 12,
      unit: 'days',
      linkedProjectIds: ['p_2'],
      linkedHabitIds: ['h_1', 'h_3'],
      milestones: [
        { id: 'gm_1', title: 'Reach 14-day streak', completed: false },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'g_2',
      title: 'Publish Production Native Daycraft Client',
      description: 'Release verified native binaries with complete automated tests and packaging.',
      category: 'craft',
      color: '#C86D51',
      startDate: twoDaysAgo,
      targetDate: in7Days,
      status: 'active',
      isMeasurable: false,
      linkedProjectIds: ['p_1'],
      linkedHabitIds: ['h_2'],
      milestones: [
        { id: 'gm_2', title: 'End-to-end unit tests passing', completed: true },
        { id: 'gm_3', title: 'Windows & Android configs prepared', completed: true },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const calendarEvents: CalendarEvent[] = [
    {
      id: 'ev_1',
      title: 'Product Architecture Review',
      description: 'Deep dive into offline adapters and SQLite transactional guarantees',
      startDate: today,
      startTime: '14:00',
      endDate: today,
      endTime: '15:00',
      allDay: false,
      color: '#C86D51',
      location: 'Local Workstation',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'ev_2',
      title: 'Evening Study & Journaling',
      startDate: today,
      startTime: '19:30',
      endDate: today,
      endTime: '20:30',
      allDay: false,
      color: '#7C5295',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'ev_3',
      title: 'Weekly Systems Retrospective',
      startDate: in3Days,
      startTime: '10:00',
      endDate: in3Days,
      endTime: '11:00',
      allDay: false,
      color: '#3E7051',
      createdAt: new Date().toISOString(),
    },
  ];

  const timeBlocks: TimeBlock[] = [
    {
      id: 'tb_1',
      date: today,
      startTime: '09:00',
      endTime: '10:30',
      title: 'Deep Architecture Focus',
      linkedProjectId: 'p_1',
      color: '#C86D51',
    },
    {
      id: 'tb_2',
      date: today,
      startTime: '13:00',
      endTime: '14:00',
      title: 'Code review & Unit Tests validation',
      linkedTaskId: 't_1',
      color: '#3E7051',
    },
  ];

  const focusSessions: FocusSession[] = [
    {
      id: 'fs_1',
      startTime: new Date(Date.now() - 3600000).toISOString(),
      endTime: new Date().toISOString(),
      durationMinutes: 45,
      type: 'focus',
      completed: true,
      linkedTaskId: 't_1',
      notes: 'Completed database models and unit test suites.',
    },
  ];

  const studySubjects: StudySubject[] = [
    {
      id: 'sub_1',
      name: 'Distributed & Offline Systems',
      color: '#C86D51',
      icon: 'Database',
      weeklyGoalHours: 5,
      topics: ['SQLite Wal Mode', 'Forward Migrations', 'Eventual Consistency'],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'sub_2',
      name: 'Edge AI & Quantization',
      color: '#7C5295',
      icon: 'Cpu',
      weeklyGoalHours: 4,
      topics: ['GGUF 4-bit Quantization', 'Attention KV-Cache', 'llama.cpp Runtimes'],
      createdAt: new Date().toISOString(),
    },
  ];

  const studySessions: StudySession[] = [
    {
      id: 'ss_1',
      subjectId: 'sub_1',
      date: yesterday,
      durationMinutes: 60,
      topic: 'SQLite transaction isolation and integrity',
      notes: 'Explored pragma journal_mode=WAL and foreign key constraints.',
      createdAt: new Date().toISOString(),
    },
  ];

  const wellnessTrackers: WellnessTracker[] = [
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

  const wellnessEntries: WellnessEntry[] = [
    { id: 'we_1', trackerId: 'w_1', date: today, value: 7.5, recordedAt: new Date().toISOString(), note: 'Woke up feeling rested.' },
    { id: 'we_2', trackerId: 'w_2', date: today, value: 6, recordedAt: new Date().toISOString() },
    { id: 'we_3', trackerId: 'w_4', date: today, value: 4, recordedAt: new Date().toISOString() },
  ];

  const journalEntries: JournalEntry[] = [
    {
      id: 'j_1',
      date: today,
      title: 'Building Daycraft: Grounded in Calm Engineering',
      content: 'Reflecting on building a personal operating system. The most liberating design decision is true local privacy: no cloud logins, no telemetry, no remote LLMs leaking personal journals. Everything stays on device, fast and serene.',
      mood: 5,
      energy: 4,
      tags: ['engineering', 'mindset', 'privacy'],
      linkedProjectIds: ['p_1'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const xpLedger: XpLedgerEntry[] = [
    {
      id: 'xp_1',
      timestamp: new Date().toISOString(),
      xp: 25,
      sourceType: 'focus_session',
      sourceId: 'fs_1',
      description: 'Completed 45m deep focus session',
    },
    {
      id: 'xp_2',
      timestamp: new Date().toISOString(),
      xp: 15,
      sourceType: 'task_completed',
      sourceId: 't_5',
      description: 'Completed task: Configure calm workspace',
    },
  ];

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
    lastBackupDate: today,
  };

  const habitRoutines: HabitRoutine[] = [
    {
      id: 'r_1',
      name: 'Morning Momentum Stack',
      description: 'Start your morning with essential hydration, deep work priming, and focused reading.',
      icon: 'Sunrise',
      color: '#d97706',
      timeOfDay: 'morning',
      habitIds: ['h_1', 'h_2', 'h_3'],
      completionsCount: 2,
      lastCompletedDate: yesterday,
      createdAt: twoDaysAgo,
      updatedAt: yesterday,
    },
    {
      id: 'r_2',
      name: 'Evening Wind-Down Stack',
      description: 'Slow down cognitive arousal with gentle hydration and book reading before bed.',
      icon: 'Moon',
      color: '#6366f1',
      timeOfDay: 'evening',
      habitIds: ['h_3', 'h_1'],
      completionsCount: 1,
      lastCompletedDate: yesterday,
      createdAt: twoDaysAgo,
      updatedAt: yesterday,
    },
  ];

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
