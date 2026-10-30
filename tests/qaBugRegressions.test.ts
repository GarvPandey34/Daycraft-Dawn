import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseManager } from '../src/database/db';
import {
  getMyDayScheduledTasks,
  resolveRescheduledTaskDate,
} from '../src/features/myday/MyDayView';
import { buildInboxCaptureTask, getInboxTasks } from '../src/features/inbox/InboxView';
import { filterTasksByTab } from '../src/features/tasks/TasksView';
import { getHomeDashboardTasks } from '../src/features/home/HomeDashboard';
import { getCalendarTaskCollections } from '../src/features/calendar/CalendarView';
import {
  clearFocusTimerState,
  filterTodayFocusSessions,
  getFocusSessionLocalDate,
  reconcileExpiredFocusTimer,
  resolveRestoredFocusTimerState,
  saveFocusTimerState,
} from '../src/services/focusTimerStateService';
import {
  computeSafeEndTime,
  parseNaturalLanguageInput,
  resolveHabitScheduleFromRecurrence,
} from '../src/services/nlpParserService';
import {
  applyManualQuickAddHabitSchedule,
  applyNlpToQuickAddHabitSchedule,
  createInitialQuickAddHabitScheduleState,
  resolveFinalQuickAddHabitSchedule,
} from '../src/components/QuickAddModal';
import { reconcileRoutineCascadeState } from '../src/features/habits/HabitsView';
import {
  clampTimeBlockEnd,
  findNextAvailableTimeSlot,
  isValidSingleDayTimeRange,
} from '../src/services/workflowConnectService';
import { calculateSubjectStudyStats } from '../src/features/study/StudyView';
import {
  buildUpdatedJournalEntry,
  clearJournalSaveTimeout,
  DirtyJournalDraftRefState,
  flushDirtyJournalDraft,
} from '../src/features/journal/JournalView';
import { addDays, formatLocalDate } from '../src/services/streakService';

test('BUG-001: deleting a habit cleans up routine habitIds and goal linkedHabitIds', () => {
  const db = new DatabaseManager();
  const now = new Date().toISOString();

  db.saveHabit({
    id: 'h_1',
    name: 'Hydrate',
    description: '',
    category: 'Wellness',
    icon: 'Flame',
    color: '#10b981',
    startDate: '2026-10-01',
    scheduleType: 'daily',
    targetType: 'boolean',
    targetValue: 1,
    targetUnit: 'done',
    archived: false,
    createdAt: now,
    updatedAt: now,
  });
  db.saveHabit({
    id: 'h_2',
    name: 'Stretch',
    description: '',
    category: 'Wellness',
    icon: 'Flame',
    color: '#10b981',
    startDate: '2026-10-01',
    scheduleType: 'daily',
    targetType: 'boolean',
    targetValue: 1,
    targetUnit: 'done',
    archived: false,
    createdAt: now,
    updatedAt: now,
  });

  const routine = db.createHabitRoutine({
    name: 'Morning Stack',
    description: '',
    icon: 'Sunrise',
    color: '#f59e0b',
    timeOfDay: 'morning',
    habitIds: ['h_1', 'h_2'],
  });

  db.saveGoal({
    id: 'g_1',
    title: 'Vitality Goal',
    description: '',
    category: 'Health',
    color: '#10b981',
    startDate: '2026-10-01',
    targetDate: '2026-12-31',
    status: 'active',
    isMeasurable: false,
    linkedProjectIds: [],
    linkedHabitIds: ['h_1', 'h_2'],
    milestones: [],
    createdAt: now,
    updatedAt: now,
  });

  // Delete the first habit
  db.deleteHabit('h_1');

  const updatedRoutine = db.getHabitRoutines().find(r => r.id === routine.id);
  assert.ok(updatedRoutine);
  assert.deepEqual(updatedRoutine.habitIds, ['h_2']);

  const updatedGoal = db.getGoals().find(g => g.id === 'g_1');
  assert.ok(updatedGoal);
  assert.deepEqual(updatedGoal.linkedHabitIds, ['h_2']);

  // Routine with remaining valid habit can still be completed cleanly
  const outcome = db.recordRoutineCompletion(routine.id, '2026-10-29');
  assert.ok(outcome.xpAwarded > 0);
  assert.equal(db.getHabitRoutines().find(r => r.id === routine.id)?.completionsCount, 1);
});

test('BUG-002: overdue task rescheduling in My Day anchors to todayStr for Today (0) and Tomorrow (1)', () => {
  const todayStr = '2026-10-29';
  const overdueTaskDue = '2026-10-20'; // 9 days overdue

  const movedToToday = resolveRescheduledTaskDate(todayStr, 0);
  const movedToTomorrow = resolveRescheduledTaskDate(todayStr, 1);

  assert.notEqual(movedToToday, overdueTaskDue);
  assert.equal(movedToToday, '2026-10-29');
  assert.equal(movedToTomorrow, '2026-10-30');
});

test('BUG-003: completing a recurring task spawns next occurrence once and never duplicates on reopen/edit', () => {
  const db = new DatabaseManager();
  const now = new Date().toISOString();
  const todayStr = formatLocalDate(new Date());
  const tomorrowStr = addDays(todayStr, 1);

  db.saveTask({
    id: 't_rec_base',
    title: 'Daily Standup Prep',
    description: 'Review blockers',
    createdAt: now,
    updatedAt: now,
    status: 'todo',
    priority: 'high',
    dueDate: todayStr,
    actualMinutes: 30,
    recurrence: { type: 'daily' },
    tags: ['work'],
    archived: false,
  });

  // Complete the recurring task (pathway used by List, Kanban, My Day, Home)
  const existing = db.getTasks().find(t => t.id === 't_rec_base')!;
  const outcome1 = db.saveTask({
    ...existing,
    status: 'completed',
  });

  assert.ok(outcome1.spawnedNextTask, 'Expected next occurrence to be spawned on completion');
  assert.equal(outcome1.spawnedNextTask.dueDate, tomorrowStr);
  assert.equal(outcome1.spawnedNextTask.status, 'todo');
  assert.equal(outcome1.spawnedNextTask.actualMinutes, undefined, 'actualMinutes should reset on next occurrence');
  assert.equal(db.getTasks().length, 2);

  // Editing the already-completed task must NOT spawn another occurrence
  const completedTask = db.getTasks().find(t => t.id === 't_rec_base')!;
  const outcomeEdit = db.saveTask({
    ...completedTask,
    description: 'Updated notes after completion',
  });
  assert.equal(outcomeEdit.spawnedNextTask, undefined);
  assert.equal(db.getTasks().length, 2);

  // Reopening and re-completing when the next occurrence date already exists must NOT duplicate it or double-award XP
  const outcomeReopen = db.saveTask({
    ...completedTask,
    status: 'todo',
  });
  assert.equal(outcomeReopen.spawnedNextTask, undefined);

  const outcomeRecomplete = db.saveTask({
    ...completedTask,
    status: 'completed',
  });
  assert.equal(outcomeRecomplete.spawnedNextTask, undefined);
  assert.equal(outcomeRecomplete.xpAwarded, 0);
  assert.equal(db.getTasks().length, 2);
});

test('BUG-004: Inbox rapid capture preserves status="inbox" even when a date/time is parsed', () => {
  const db = new DatabaseManager();
  const refDate = new Date('2026-10-29T10:00:00');
  const captured = buildInboxCaptureTask('Call architect tomorrow at 3pm #client', refDate);

  assert.equal(captured.status, 'inbox');
  assert.equal(captured.title, 'Call architect');
  assert.equal(captured.dueDate, '2026-10-30');
  assert.equal(captured.dueTime, '15:00');
  assert.deepEqual(captured.tags, ['client']);

  db.saveTask(captured);
  const inboxItems = getInboxTasks(db.getTasks());
  assert.equal(inboxItems.length, 1);
  assert.equal(inboxItems[0].id, captured.id);
});

test('BUG-005: Focus session local-date filter and timer persistence across navigation', () => {
  const localNow = new Date(2026, 9, 29, 21, 30, 0); // Oct 29, 2026 21:30 local
  const localDateStr = formatLocalDate(localNow);

  const session = {
    id: 'fs_local_1',
    startTime: localNow.toISOString(),
    endTime: new Date(localNow.getTime() + 25 * 60000).toISOString(),
    durationMinutes: 25,
    type: 'focus' as const,
    completed: true,
  };

  assert.equal(getFocusSessionLocalDate(session), localDateStr);
  const filtered = filterTodayFocusSessions([session], localDateStr);
  assert.equal(filtered.length, 1);

  // Timer state persistence across navigation / remount
  clearFocusTimerState();
  const startMs = 1_700_000_000_000;
  const targetEndMs = startMs + 25 * 60 * 1000;

  saveFocusTimerState({
    sessionId: 'fs_persist_test',
    sessionType: 'focus',
    durationMinutes: 25,
    customInputMins: 25,
    isCustomMode: false,
    secondsRemaining: 1500,
    isActive: true,
    isPaused: false,
    targetEndTime: targetEndMs,
    sessionTaskNote: 'Deep work on bug sprint',
    activeDeviceMode: 'dnd',
  });

  // Simulate remount 5 minutes (300 seconds) later
  const restored = resolveRestoredFocusTimerState(25, startMs + 300 * 1000);
  assert.equal(restored.isActive, true);
  assert.equal(restored.isPaused, false);
  assert.equal(restored.secondsRemaining, 1200);
  assert.equal(restored.sessionId, 'fs_persist_test');
  assert.equal(restored.sessionTaskNote, 'Deep work on bug sprint');
  assert.equal(restored.activeDeviceMode, 'dnd');
  clearFocusTimerState();
});

test('BUG-006: habit occurrence deletion resets day to unlogged without allowing duplicate XP farming, and routine deletion works', () => {
  const db = new DatabaseManager();
  const now = new Date().toISOString();
  const todayStr = formatLocalDate(new Date());

  db.saveHabit({
    id: 'h_cycle',
    name: 'Read 20 Pages',
    description: '',
    category: 'Growth',
    icon: 'Flame',
    color: '#10b981',
    startDate: todayStr,
    scheduleType: 'daily',
    targetType: 'numeric',
    targetValue: 20,
    targetUnit: 'pages',
    archived: false,
    createdAt: now,
    updatedAt: now,
  });

  // 1. Mark completed -> awards XP once
  const firstOutcome = db.recordHabitOccurrence({
    id: `occ_h_cycle_${todayStr}`,
    habitId: 'h_cycle',
    date: todayStr,
    recordedValue: 20,
    targetValue: 20,
    status: 'completed',
    completedAt: now,
  });
  assert.ok(firstOutcome.xpAwarded > 0);
  assert.equal(db.getHabitOccurrences('h_cycle').length, 1);

  // 2. Cycle to skipped / excused
  db.recordHabitOccurrence({
    id: `occ_h_cycle_${todayStr}`,
    habitId: 'h_cycle',
    date: todayStr,
    recordedValue: 0,
    targetValue: 20,
    status: 'skipped',
  });
  assert.equal(db.getHabitOccurrences('h_cycle')[0].status, 'skipped');

  // 3. Delete occurrence to return day to unlogged
  db.deleteHabitOccurrence('h_cycle', todayStr);
  assert.equal(db.getHabitOccurrences('h_cycle').length, 0);

  // 4. Re-completing same day does not double-award XP
  const secondOutcome = db.recordHabitOccurrence({
    id: `occ_h_cycle_${todayStr}`,
    habitId: 'h_cycle',
    date: todayStr,
    recordedValue: 20,
    targetValue: 20,
    status: 'completed',
    completedAt: now,
  });
  assert.equal(secondOutcome.xpAwarded, 0);

  // 5. Routine deletion
  const routine = db.createHabitRoutine({
    name: 'Evening Wind Down',
    description: '',
    icon: 'Moon',
    color: '#6366f1',
    timeOfDay: 'evening',
    habitIds: ['h_cycle'],
  });
  assert.equal(db.getHabitRoutines().length, 1);
  assert.equal(db.deleteHabitRoutine(routine.id), true);
  assert.equal(db.getHabitRoutines().length, 0);
});

test('BUG-007: Quick Add computeSafeEndTime and resolveHabitScheduleFromRecurrence handle minutes, clamping, and weekday schedules', () => {
  // Preserves minutes and zero-pads hours
  assert.equal(computeSafeEndTime('08:30', 60), '09:30');
  assert.equal(computeSafeEndTime('09:45', 45), '10:30');
  assert.equal(computeSafeEndTime('08:00', 60), '09:00');

  // Clamps late-evening events at 23:59 instead of overflowing to 24:00+
  assert.equal(computeSafeEndTime('23:00', 60), '23:59');
  assert.equal(computeSafeEndTime('23:30', 60), '23:59');

  // Weekday habit recurrence mapping
  const parsedWeekdayHabit = parseNaturalLanguageInput('Meditate for 15 minutes every weekday');
  assert.equal(parsedWeekdayHabit.detectedType, 'habit');
  assert.equal(parsedWeekdayHabit.recurrence, 'weekdays');
  assert.equal(resolveHabitScheduleFromRecurrence(parsedWeekdayHabit.recurrence), 'weekdays');
});

test('BUG-008: deleting a project cleans up tasks, timeBlocks, and goals referencing that project', () => {
  const db = new DatabaseManager();
  const now = new Date().toISOString();

  db.saveProject({
    id: 'p_cleanup',
    name: 'Website Redesign',
    description: '',
    color: '#3E7051',
    icon: 'Folder',
    status: 'in_progress',
    startDate: '2026-10-01',
    milestones: [],
    createdAt: now,
    updatedAt: now,
  });

  db.saveTask({
    id: 't_proj_1',
    title: 'Design hero section',
    description: '',
    createdAt: now,
    updatedAt: now,
    status: 'todo',
    priority: 'medium',
    projectId: 'p_cleanup',
    tags: [],
    archived: false,
  });

  db.saveTimeBlock({
    id: 'tb_proj_1',
    date: '2026-10-29',
    startTime: '10:00',
    endTime: '11:00',
    title: 'Design hero section',
    linkedTaskId: 't_proj_1',
    linkedProjectId: 'p_cleanup',
    color: '#3E7051',
  });

  db.saveGoal({
    id: 'g_proj_1',
    title: 'Launch v2',
    description: '',
    category: 'Work',
    color: '#3E7051',
    startDate: '2026-10-01',
    targetDate: '2026-12-01',
    status: 'active',
    isMeasurable: false,
    linkedProjectIds: ['p_cleanup'],
    linkedHabitIds: [],
    milestones: [],
    createdAt: now,
    updatedAt: now,
  });

  db.deleteProject('p_cleanup');

  assert.equal(db.getProjects().length, 0);
  assert.equal(db.getTasks().find(t => t.id === 't_proj_1')?.projectId, undefined);
  assert.equal(db.getTimeBlocks().find(tb => tb.id === 'tb_proj_1')?.linkedProjectId, undefined);
  assert.deepEqual(db.getGoals().find(g => g.id === 'g_proj_1')?.linkedProjectIds, []);
});

test('BUG-009: Calendar time block end-of-day clamping and time range validation', () => {
  // End-of-day clamping at 23:59
  const clamped = clampTimeBlockEnd('23:30', 60);
  assert.equal(clamped.startTime, '23:30');
  assert.equal(clamped.endTime, '23:59');
  assert.equal(clamped.durationMinutes, 29);

  // Valid vs invalid single-day time ranges
  assert.equal(isValidSingleDayTimeRange('09:00', '10:30'), true);
  assert.equal(isValidSingleDayTimeRange('23:00', '23:59'), true);
  assert.equal(isValidSingleDayTimeRange('14:00', '14:00'), false);
  assert.equal(isValidSingleDayTimeRange('15:00', '14:00'), false);
  assert.equal(isValidSingleDayTimeRange('23:30', '24:30'), false);
});

test('BUG-010: Study mode separates weekly hours from all-time hours and supports deleting individual study sessions', () => {
  const db = new DatabaseManager();
  const now = new Date().toISOString();
  const todayStr = '2026-10-29';

  db.saveStudySubject({
    id: 'sub_sys',
    name: 'Distributed Systems',
    color: '#C86D51',
    icon: 'BookOpen',
    weeklyGoalHours: 4,
    topics: ['Raft', 'Paxos'],
    createdAt: now,
  });

  // Session 20 days ago (outside current 7-day window): 120 minutes (2h)
  db.recordStudySession({
    id: 'ss_old',
    subjectId: 'sub_sys',
    date: '2026-10-05',
    durationMinutes: 120,
    topic: 'Paxos basics',
    notes: 'Historical session',
    createdAt: now,
  });

  // Session today (inside current 7-day window): 60 minutes (1h)
  db.recordStudySession({
    id: 'ss_recent',
    subjectId: 'sub_sys',
    date: todayStr,
    durationMinutes: 60,
    topic: 'Raft leader election',
    notes: 'Covered split-vote randomized timeouts',
    createdAt: now,
  });

  const stats = calculateSubjectStudyStats(db.getStudySessions(), 'sub_sys', 4, todayStr);
  assert.equal(stats.weeklyMinutes, 60);
  assert.equal(stats.weeklyHours, 1);
  assert.equal(stats.allTimeMinutes, 180);
  assert.equal(stats.allTimeHours, 3);
  assert.equal(stats.weeklyProgressPct, 25); // 1h of 4h weekly target

  // Delete individual study session
  db.deleteStudySession('ss_old');
  assert.equal(db.getStudySessions().length, 1);
  assert.equal(db.getStudySessions()[0].id, 'ss_recent');
  assert.equal(db.getStudySessions()[0].notes, 'Covered split-vote randomized timeouts');
});

test('BUG-011: editing an existing journal entry preserves original createdAt while updating updatedAt', () => {
  const db = new DatabaseManager();
  const originalCreatedAt = '2026-10-01T08:00:00.000Z';
  const laterUpdatedAt = '2026-10-29T18:30:00.000Z';

  db.saveJournalEntry({
    id: 'j_preserve',
    date: '2026-10-01',
    title: 'Initial Reflection',
    content: 'First draft.',
    mood: 4,
    energy: 4,
    tags: ['focus'],
    createdAt: originalCreatedAt,
    updatedAt: originalCreatedAt,
  });

  const existing = db.getJournalEntries().find(j => j.id === 'j_preserve');
  assert.ok(existing);

  const updatedPayload = buildUpdatedJournalEntry(
    existing,
    {
      id: 'j_preserve',
      date: '2026-10-01',
      title: 'Refined Reflection',
      content: 'Updated thoughts.',
      mood: 5,
      energy: 4,
      tags: ['focus', 'growth'],
    },
    laterUpdatedAt
  );

  assert.equal(updatedPayload.createdAt, originalCreatedAt);
  assert.equal(updatedPayload.updatedAt, laterUpdatedAt);

  // Even if caller passes a newer createdAt to db.saveJournalEntry, DatabaseManager preserves existing createdAt
  const editOutcome = db.saveJournalEntry({
    ...updatedPayload,
    createdAt: '2026-10-29T19:00:00.000Z',
  });
  assert.equal(editOutcome.xpAwarded, 0);

  const saved = db.getJournalEntries().find(j => j.id === 'j_preserve')!;
  assert.equal(saved.createdAt, originalCreatedAt);
  assert.equal(saved.title, 'Refined Reflection');
});

test('NEW-BUG-001: My Day focus session filtering uses local calendar date and excludes incomplete sessions', () => {
  const localMorning = new Date(2026, 9, 29, 9, 30, 0);
  const localLateNight = new Date(2026, 9, 29, 23, 45, 0);
  const localPreviousDay = new Date(2026, 9, 28, 22, 15, 0);
  const targetLocalDate = formatLocalDate(localMorning);

  const sessions = [
    {
      id: 'fs_morning_done',
      startTime: localMorning.toISOString(),
      endTime: new Date(localMorning.getTime() + 25 * 60000).toISOString(),
      durationMinutes: 25,
      type: 'focus' as const,
      completed: true,
    },
    {
      id: 'fs_latenight_done',
      startTime: localLateNight.toISOString(),
      endTime: new Date(localLateNight.getTime() + 45 * 60000).toISOString(),
      durationMinutes: 45,
      type: 'focus' as const,
      completed: true,
    },
    {
      id: 'fs_incomplete',
      startTime: localMorning.toISOString(),
      endTime: new Date(localMorning.getTime() + 10 * 60000).toISOString(),
      durationMinutes: 30,
      type: 'focus' as const,
      completed: false,
    },
    {
      id: 'fs_prev_day',
      startTime: localPreviousDay.toISOString(),
      endTime: new Date(localPreviousDay.getTime() + 25 * 60000).toISOString(),
      durationMinutes: 25,
      type: 'focus' as const,
      completed: true,
    },
  ];

  const filtered = filterTodayFocusSessions(sessions, targetLocalDate);
  assert.equal(filtered.length, 2);
  assert.deepEqual(
    filtered.map(s => s.id),
    ['fs_morning_done', 'fs_latenight_done']
  );
  const totalMinutes = filtered.reduce((acc, s) => acc + s.durationMinutes, 0);
  assert.equal(totalMinutes, 70);
});

test('NEW-BUG-002: Focus timer expiration reconciles once across navigation, prevents duplicate records/XP/sounds/notifications, and ignores paused timers', () => {
  const db = new DatabaseManager();
  clearFocusTimerState();

  const startMs = 1_760_000_000_000;
  const targetEndMs = startMs + 25 * 60_000;

  saveFocusTimerState({
    sessionId: 'fs_nav_away_1',
    sessionType: 'focus',
    durationMinutes: 25,
    customInputMins: 25,
    isCustomMode: false,
    secondsRemaining: 1500,
    isActive: true,
    isPaused: false,
    targetEndTime: targetEndMs,
    sessionTaskNote: 'Architecture Review Sprint',
    activeDeviceMode: null,
  });

  let soundCount = 0;
  let notifyCount = 0;
  let celebrateCount = 0;

  // Before expiry: should not complete
  const beforeExpiry = reconcileExpiredFocusTimer({
    nowMs: targetEndMs - 5000,
    database: db,
    onPlaySound: () => {
      soundCount += 1;
    },
    onNotify: () => {
      notifyCount += 1;
    },
    onCelebrate: () => {
      celebrateCount += 1;
    },
  });
  assert.equal(beforeExpiry, null);
  assert.equal(db.getFocusSessions().length, 0);

  // At/after expiry while viewing another screen: completes once
  const firstCompletion = reconcileExpiredFocusTimer({
    nowMs: targetEndMs + 250,
    database: db,
    onPlaySound: () => {
      soundCount += 1;
    },
    onNotify: () => {
      notifyCount += 1;
    },
    onCelebrate: () => {
      celebrateCount += 1;
    },
  });

  assert.ok(firstCompletion);
  assert.equal(firstCompletion.completed, true);
  assert.equal(firstCompletion.alreadyFinalized, false);
  assert.equal(firstCompletion.xpAwarded, 25);
  assert.equal(soundCount, 1);
  assert.equal(notifyCount, 1);
  assert.equal(celebrateCount, 1);
  assert.equal(db.getFocusSessions().length, 1);
  assert.equal(db.getFocusSessions()[0].id, 'fs_nav_away_1');

  // State is now transitioned to inactive break ready state
  const postExpiryState = resolveRestoredFocusTimerState(25, targetEndMs + 1000);
  assert.equal(postExpiryState.isActive, false);
  assert.equal(postExpiryState.sessionType, 'short_break');

  // Repeated checks after expiry (or concurrent check on returning to Focus Mode) must not duplicate
  const secondCheck = reconcileExpiredFocusTimer({
    nowMs: targetEndMs + 1000,
    database: db,
    onPlaySound: () => {
      soundCount += 1;
    },
    onNotify: () => {
      notifyCount += 1;
    },
    onCelebrate: () => {
      celebrateCount += 1;
    },
  });
  assert.equal(secondCheck, null);

  // Even if stale state with the same sessionId were re-evaluated with forceComplete, idempotency prevents duplicates
  saveFocusTimerState({
    sessionId: 'fs_nav_away_1',
    sessionType: 'focus',
    durationMinutes: 25,
    customInputMins: 25,
    isCustomMode: false,
    secondsRemaining: 0,
    isActive: true,
    isPaused: false,
    targetEndTime: targetEndMs,
    sessionTaskNote: 'Architecture Review Sprint',
    activeDeviceMode: null,
  });

  const duplicateAttempt = reconcileExpiredFocusTimer({
    nowMs: targetEndMs + 2000,
    forceComplete: true,
    database: db,
    onPlaySound: () => {
      soundCount += 1;
    },
    onNotify: () => {
      notifyCount += 1;
    },
    onCelebrate: () => {
      celebrateCount += 1;
    },
  });

  assert.ok(duplicateAttempt);
  assert.equal(duplicateAttempt.completed, false);
  assert.equal(duplicateAttempt.alreadyFinalized, true);
  assert.equal(duplicateAttempt.xpAwarded, 0);
  assert.equal(soundCount, 1);
  assert.equal(notifyCount, 1);
  assert.equal(celebrateCount, 1);
  assert.equal(db.getFocusSessions().length, 1);
  assert.equal(
    db.getSnapshot().xpLedger.filter(e => e.sourceType === 'focus_session').length,
    1
  );

  // Paused session must never auto-complete regardless of elapsed time
  saveFocusTimerState({
    sessionId: 'fs_paused_session',
    sessionType: 'focus',
    durationMinutes: 25,
    customInputMins: 25,
    isCustomMode: false,
    secondsRemaining: 600,
    isActive: false,
    isPaused: true,
    targetEndTime: null,
    sessionTaskNote: 'Paused Work',
    activeDeviceMode: null,
  });

  const pausedCheck = reconcileExpiredFocusTimer({
    nowMs: targetEndMs + 86_400_000,
    database: db,
  });
  assert.equal(pausedCheck, null);
  const restoredPaused = resolveRestoredFocusTimerState(25, targetEndMs + 86_400_000);
  assert.equal(restoredPaused.isPaused, true);
  assert.equal(restoredPaused.secondsRemaining, 600);
  clearFocusTimerState();
});

test('NEW-BUG-003: Quick Add habit schedule dropdown respects manual overrides and preserves NLP defaults', () => {
  // 1. "Read 10 pages every day" followed by manually selecting weekdays
  let state1 = createInitialQuickAddHabitScheduleState();
  const parsedDaily = parseNaturalLanguageInput('Read 10 pages every day');
  state1 = applyNlpToQuickAddHabitSchedule(state1, 'Read 10 pages every day');
  assert.equal(state1.schedule, 'daily');
  state1 = applyManualQuickAddHabitSchedule(state1, 'weekdays');
  assert.equal(resolveFinalQuickAddHabitSchedule(state1, parsedDaily.recurrence), 'weekdays');

  // 2. "Read 10 pages every weekday" followed by manually selecting daily
  let state2 = createInitialQuickAddHabitScheduleState();
  const parsedWeekdays = parseNaturalLanguageInput('Read 10 pages every weekday');
  state2 = applyNlpToQuickAddHabitSchedule(state2, 'Read 10 pages every weekday');
  assert.equal(state2.schedule, 'weekdays');
  state2 = applyManualQuickAddHabitSchedule(state2, 'daily');
  assert.equal(resolveFinalQuickAddHabitSchedule(state2, parsedWeekdays.recurrence), 'daily');

  // 3. Saving without manually changing the default
  let state3 = createInitialQuickAddHabitScheduleState();
  state3 = applyNlpToQuickAddHabitSchedule(state3, 'Read 10 pages every weekday');
  assert.equal(resolveFinalQuickAddHabitSchedule(state3, parsedWeekdays.recurrence), 'weekdays');

  let state3Default = createInitialQuickAddHabitScheduleState();
  const parsedNoRecurrence = parseNaturalLanguageInput('Drink 8 glasses');
  state3Default = applyNlpToQuickAddHabitSchedule(state3Default, 'Drink 8 glasses');
  assert.equal(
    resolveFinalQuickAddHabitSchedule(state3Default, parsedNoRecurrence.recurrence),
    'daily'
  );

  // 4. Editing the input after changing the dropdown preserves the manual override
  let state4 = createInitialQuickAddHabitScheduleState();
  state4 = applyNlpToQuickAddHabitSchedule(state4, 'Read 10 pages every day');
  state4 = applyManualQuickAddHabitSchedule(state4, 'weekdays');
  const editedParsed = parseNaturalLanguageInput('Read 20 pages every day');
  state4 = applyNlpToQuickAddHabitSchedule(state4, 'Read 20 pages every day');
  assert.equal(state4.schedule, 'weekdays');
  assert.equal(state4.hasManualOverride, true);
  assert.equal(resolveFinalQuickAddHabitSchedule(state4, editedParsed.recurrence), 'weekdays');
});

test('NEW-OBS-001: deleting habits during an active routine clamps step index or closes cascade when empty', () => {
  // Out-of-bounds step index clamps to last remaining valid habit
  const clamped = reconcileRoutineCascadeState(
    {
      runningRoutineId: 'r_morning',
      cascadeStepIndex: 2,
      routineFinished: false,
    },
    true,
    2
  );
  assert.equal(clamped.runningRoutineId, 'r_morning');
  assert.equal(clamped.cascadeStepIndex, 1);
  assert.equal(clamped.routineFinished, false);

  // Deleting all valid habits in the active routine closes the cascade cleanly
  const closedWhenEmpty = reconcileRoutineCascadeState(
    {
      runningRoutineId: 'r_morning',
      cascadeStepIndex: 0,
      routineFinished: false,
    },
    true,
    0
  );
  assert.equal(closedWhenEmpty.runningRoutineId, null);
  assert.equal(closedWhenEmpty.cascadeStepIndex, 0);
  assert.equal(closedWhenEmpty.routineFinished, false);
});

test('NEW-OBS-002: dated Inbox items remain in Inbox only until confirmed to todo', () => {
  const todayStr = '2026-10-29';
  const tomorrowStr = '2026-10-30';
  const yesterdayStr = '2026-10-28';

  const inboxToday = buildInboxCaptureTask(
    'Submit tax form today at 14:00',
    new Date('2026-10-29T08:00:00')
  );
  // Ensure dueDate is set to todayStr
  inboxToday.dueDate = todayStr;
  inboxToday.dueTime = '14:00';

  const inboxUpcoming = {
    ...inboxToday,
    id: 't_inbox_upcoming',
    dueDate: tomorrowStr,
  };
  const inboxOverdue = {
    ...inboxToday,
    id: 't_inbox_overdue',
    dueDate: yesterdayStr,
  };

  const allTasks = [inboxToday, inboxUpcoming, inboxOverdue];

  // Unconfirmed inbox items appear in Inbox, with dueDate and dueTime preserved
  const inboxList = getInboxTasks(allTasks);
  assert.equal(inboxList.length, 3);
  assert.equal(inboxToday.dueDate, todayStr);
  assert.equal(inboxToday.dueTime, '14:00');

  // Unconfirmed inbox items must NOT appear in My Day or Today/Upcoming/Overdue tabs
  const myDayBefore = getMyDayScheduledTasks(allTasks, todayStr, todayStr);
  assert.equal(myDayBefore.dateTasks.length, 0);
  assert.equal(myDayBefore.overdueTasks.length, 0);

  assert.equal(filterTasksByTab(allTasks, 'today', todayStr).length, 0);
  assert.equal(filterTasksByTab(allTasks, 'upcoming', todayStr).length, 0);
  assert.equal(filterTasksByTab(allTasks, 'overdue', todayStr).length, 0);

  // Confirm items from Inbox (status -> 'todo')
  const confirmedTasks = allTasks.map(t => ({ ...t, status: 'todo' as const }));
  const myDayAfter = getMyDayScheduledTasks(confirmedTasks, todayStr, todayStr);
  assert.equal(myDayAfter.dateTasks.length, 1);
  assert.equal(myDayAfter.overdueTasks.length, 1);

  assert.equal(filterTasksByTab(confirmedTasks, 'today', todayStr).length, 1);
  assert.equal(filterTasksByTab(confirmedTasks, 'upcoming', todayStr).length, 1);
  assert.equal(filterTasksByTab(confirmedTasks, 'overdue', todayStr).length, 1);
});

test('NEW-OBS-003: findNextAvailableTimeSlot handles 23:30, 23:58, 23:59, and normal daytime slots safely', () => {
  const dateStr = '2026-10-29';

  const slot2330 = findNextAvailableTimeSlot([], dateStr, 60, '23:30');
  assert.equal(slot2330.startTime, '23:30');
  assert.equal(slot2330.endTime, '23:59');
  assert.equal(isValidSingleDayTimeRange(slot2330.startTime, slot2330.endTime), true);

  const slot2358 = findNextAvailableTimeSlot([], dateStr, 45, '23:58');
  assert.equal(slot2358.startTime, '23:58');
  assert.equal(slot2358.endTime, '23:59');
  assert.equal(isValidSingleDayTimeRange(slot2358.startTime, slot2358.endTime), true);

  const slot2359 = findNextAvailableTimeSlot([], dateStr, 30, '23:59');
  assert.equal(slot2359.startTime, '23:58');
  assert.equal(slot2359.endTime, '23:59');
  assert.notEqual(slot2359.startTime, slot2359.endTime);
  assert.equal(isValidSingleDayTimeRange(slot2359.startTime, slot2359.endTime), true);

  const daytimeSlot = findNextAvailableTimeSlot([], dateStr, 45, '14:15');
  assert.equal(daytimeSlot.startTime, '14:15');
  assert.equal(daytimeSlot.endTime, '15:00');
  assert.equal(isValidSingleDayTimeRange(daytimeSlot.startTime, daytimeSlot.endTime), true);
});

test('NEW-OBS-004: flushDirtyJournalDraft persists dirty journal edits on navigation unmount once and preserves createdAt', () => {
  const db = new DatabaseManager();
  const originalCreatedAt = '2026-10-10T09:00:00.000Z';
  const unmountSaveIso = '2026-10-29T20:15:00.000Z';

  db.saveJournalEntry({
    id: 'j_nav_dirty',
    date: '2026-10-10',
    title: 'Morning Note',
    content: 'Initial paragraph.',
    mood: 3,
    energy: 3,
    tags: ['morning'],
    createdAt: originalCreatedAt,
    updatedAt: originalCreatedAt,
  });

  const draftRef: { current: DirtyJournalDraftRefState } = {
    current: {
      isDirty: true,
      selectedEntryId: 'j_nav_dirty',
      entryDate: '2026-10-10',
      title: 'Morning Note (Edited before sidebar click)',
      content: 'Updated paragraph before navigating away.',
      mood: 5,
      energy: 4,
      tagsInput: 'morning, clarity',
    },
  };

  // First flush (simulating unmount or Strict Mode cleanup) saves the dirty draft
  const flushed = flushDirtyJournalDraft(draftRef, db, unmountSaveIso);
  assert.ok(flushed);
  assert.equal(flushed.createdAt, originalCreatedAt);
  assert.equal(flushed.updatedAt, unmountSaveIso);
  assert.equal(draftRef.current.isDirty, false);

  const persisted = db.getJournalEntries().find(e => e.id === 'j_nav_dirty')!;
  const firstPersistedUpdatedAt = persisted.updatedAt;
  assert.equal(persisted.title, 'Morning Note (Edited before sidebar click)');
  assert.equal(persisted.content, 'Updated paragraph before navigating away.');
  assert.equal(persisted.createdAt, originalCreatedAt);
  assert.notEqual(firstPersistedUpdatedAt, originalCreatedAt);
  assert.deepEqual(persisted.tags, ['morning', 'clarity']);

  // Second flush without new edits is a no-op (prevents duplicate saves under Strict Mode)
  const secondFlush = flushDirtyJournalDraft(draftRef, db, '2026-10-29T21:00:00.000Z');
  assert.equal(secondFlush, null);
  assert.equal(
    db.getJournalEntries().find(e => e.id === 'j_nav_dirty')!.updatedAt,
    firstPersistedUpdatedAt
  );
});

test('UAT-OBS-001: unconfirmed Inbox tasks are excluded from Home, Calendar, and Tasks All until confirmed to todo', () => {
  const todayStr = formatLocalDate(new Date());
  const tomorrowStr = addDays(todayStr, 1);
  const yesterdayStr = addDays(todayStr, -1);

  const inboxTodayUrgent = buildInboxCaptureTask(
    'Pay invoice today at 14:00 !urgent #finance',
    new Date(`${todayStr}T09:00:00`)
  );
  inboxTodayUrgent.dueDate = todayStr;
  inboxTodayUrgent.dueTime = '14:00';
  inboxTodayUrgent.priority = 'urgent';

  const inboxOverdue = {
    ...inboxTodayUrgent,
    id: 't_inbox_overdue_uat',
    title: 'Overdue unconfirmed inbox capture',
    dueDate: yesterdayStr,
    priority: 'high' as const,
  };

  const inboxUpcoming = {
    ...inboxTodayUrgent,
    id: 't_inbox_upcoming_uat',
    title: 'Upcoming unconfirmed inbox capture',
    dueDate: tomorrowStr,
    priority: 'medium' as const,
  };

  const unconfirmedTasks = [inboxTodayUrgent, inboxOverdue, inboxUpcoming];

  // 1. Remains accessible in Inbox with parsed dueDate, dueTime, and priority preserved
  const inboxItems = getInboxTasks(unconfirmedTasks);
  assert.equal(inboxItems.length, 3);
  assert.equal(inboxItems[0].dueDate, todayStr);
  assert.equal(inboxItems[0].dueTime, '14:00');
  assert.equal(inboxItems[0].priority, 'urgent');

  // 2. Excluded from Home Dashboard Today's Priorities and overdue counts
  const homeBefore = getHomeDashboardTasks(unconfirmedTasks, todayStr);
  assert.equal(homeBefore.todayTasks.length, 0);
  assert.equal(homeBefore.overdueTasks.length, 0);
  assert.equal(homeBefore.completedTodayTasks.length, 0);

  // 3. Excluded from Calendar task dock and scheduled task collections
  const calendarBefore = getCalendarTaskCollections(unconfirmedTasks);
  assert.equal(calendarBefore.allActiveTasks.length, 0);
  assert.equal(calendarBefore.scheduledTasks.length, 0);

  // 4. Excluded from Tasks All tab (as well as Today, Upcoming, Overdue)
  assert.equal(filterTasksByTab(unconfirmedTasks, 'all', todayStr).length, 0);
  assert.equal(filterTasksByTab(unconfirmedTasks, 'today', todayStr).length, 0);
  assert.equal(filterTasksByTab(unconfirmedTasks, 'upcoming', todayStr).length, 0);
  assert.equal(filterTasksByTab(unconfirmedTasks, 'overdue', todayStr).length, 0);

  // 5. Once confirmed (status === 'todo'), tasks immediately appear in scheduled views
  const confirmedTasks = unconfirmedTasks.map(t => ({ ...t, status: 'todo' as const }));

  assert.equal(getInboxTasks(confirmedTasks).length, 0);

  const homeAfter = getHomeDashboardTasks(confirmedTasks, todayStr);
  assert.equal(homeAfter.todayTasks.length, 1);
  assert.equal(homeAfter.todayTasks[0].id, inboxTodayUrgent.id);
  assert.equal(homeAfter.overdueTasks.length, 1);
  assert.equal(homeAfter.overdueTasks[0].id, inboxOverdue.id);

  const calendarAfter = getCalendarTaskCollections(confirmedTasks);
  assert.equal(calendarAfter.allActiveTasks.length, 3);
  assert.equal(calendarAfter.scheduledTasks.length, 3);

  assert.equal(filterTasksByTab(confirmedTasks, 'all', todayStr).length, 3);
  assert.equal(filterTasksByTab(confirmedTasks, 'today', todayStr).length, 1);
  assert.equal(filterTasksByTab(confirmedTasks, 'upcoming', todayStr).length, 1);
  assert.equal(filterTasksByTab(confirmedTasks, 'overdue', todayStr).length, 1);
});

test('UAT-OBS-002: clearJournalSaveTimeout cancels pending 150ms manual save timer without affecting persistence', async () => {
  const db = new DatabaseManager();
  const originalCreatedAt = '2026-10-12T08:00:00.000Z';
  const manualSaveIso = '2026-10-30T10:00:00.000Z';

  db.saveJournalEntry({
    id: 'j_manual_save_unmount',
    date: '2026-10-12',
    title: 'Initial Title',
    content: 'Initial body',
    mood: 3,
    energy: 3,
    tags: ['work'],
    createdAt: originalCreatedAt,
    updatedAt: originalCreatedAt,
  });

  // Simulate manual Save click: synchronous save runs immediately, then 150ms timer is scheduled
  const existing = db.getJournalEntries().find(e => e.id === 'j_manual_save_unmount');
  const updated = buildUpdatedJournalEntry(
    existing,
    {
      id: 'j_manual_save_unmount',
      date: '2026-10-12',
      title: 'Saved Manually Before Navigation',
      content: 'Saved content body',
      mood: 5,
      energy: 4,
      tags: ['work', 'shipped'],
    },
    manualSaveIso
  );
  db.saveJournalEntry(updated);
  const savedBeforeUnmountUpdatedAt = db.getJournalEntries().find(e => e.id === 'j_manual_save_unmount')!.updatedAt;

  const draftRef: { current: DirtyJournalDraftRefState } = {
    current: {
      isDirty: false, // marked clean right after synchronous manual save
      selectedEntryId: updated.id,
      entryDate: updated.date,
      title: updated.title,
      content: updated.content,
      mood: 5,
      energy: 4,
      tagsInput: 'work, shipped',
    },
  };

  let postUnmountCallbackFired = false;
  const saveTimeoutRef: { current: ReturnType<typeof setTimeout> | null } = {
    current: setTimeout(() => {
      postUnmountCallbackFired = true;
    }, 150),
  };

  // Simulate immediate navigation unmount before 150ms elapses
  clearJournalSaveTimeout(saveTimeoutRef);
  const unmountFlushResult = flushDirtyJournalDraft(draftRef, db);

  assert.equal(saveTimeoutRef.current, null);
  assert.equal(unmountFlushResult, null, 'Already saved entry should not be re-flushed on unmount');

  // Wait past 150ms to verify the cleared timer never fires
  await new Promise(resolve => setTimeout(resolve, 180));
  assert.equal(postUnmountCallbackFired, false);

  // Confirm synchronous save persisted cleanly with original createdAt preserved
  const persisted = db.getJournalEntries().find(e => e.id === 'j_manual_save_unmount')!;
  assert.equal(persisted.title, 'Saved Manually Before Navigation');
  assert.equal(persisted.content, 'Saved content body');
  assert.equal(persisted.createdAt, originalCreatedAt);
  assert.notEqual(persisted.updatedAt, originalCreatedAt);
  assert.equal(persisted.updatedAt, savedBeforeUnmountUpdatedAt);
});


