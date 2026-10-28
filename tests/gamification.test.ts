import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRewardKey,
  calculateLevel,
  evaluateAchievements,
  INITIAL_ACHIEVEMENTS,
  isEligibleForHabitXp,
  isXpAlreadyAwarded,
  XP_VALUES,
} from '../src/services/gamificationService';
import { DatabaseManager } from '../src/database/db';
import { Achievement, Goal, Habit, Project, Task, XpLedgerEntry } from '../src/domain/models';
import { formatLocalDate, addDays } from '../src/services/streakService';

function createCleanDb(gamificationEnabled: boolean = true): DatabaseManager {
  const instance = new DatabaseManager(false);
  instance.migrateAndLoad({
    schemaVersion: 1,
    tasks: [],
    habits: [],
    habitOccurrences: [],
    habitRoutines: [
      {
        id: 'rt_test_1',
        name: 'Morning Stack',
        timeOfDay: 'morning',
        habitIds: ['h_test_1'],
        completionsCount: 0,
        color: '#C86D51',
        icon: 'Sunrise',
        createdAt: '2026-10-20T08:00:00Z',
        updatedAt: '2026-10-20T08:00:00Z',
      },
    ],
    projects: [],
    goals: [],
    calendarEvents: [],
    timeBlocks: [],
    focusSessions: [],
    studySubjects: [],
    studySessions: [],
    wellnessTrackers: [],
    wellnessEntries: [],
    journalEntries: [],
    achievements: INITIAL_ACHIEVEMENTS.map(a => ({ ...a })),
    xpLedger: [],
    settings: {
      gamificationEnabled,
    },
  });
  return instance;
}

test('level calculation scales deterministically', () => {
  const l1 = calculateLevel(0);
  assert.equal(l1.level, 1);
  assert.equal(l1.progressPercent, 0);

  const l2 = calculateLevel(35);
  assert.equal(l2.level, 2);

  const l3 = calculateLevel(120);
  assert.equal(l3.level, 3);
});

test('prevents XP farming for same task or habit', () => {
  const ledger: XpLedgerEntry[] = [
    {
      id: 'xp1',
      timestamp: '2026-10-21T09:00:00Z',
      xp: 15,
      sourceType: 'task_completed',
      sourceId: 'task_100',
      description: 'Completed Task',
    },
  ];

  assert.equal(isXpAlreadyAwarded(ledger, 'task_completed', 'task_100'), true);
  assert.equal(isXpAlreadyAwarded(ledger, 'task_completed', 'task_101'), false);
});

test('achievement evaluation unlocks when threshold is reached', () => {
  const { updatedAchievements, newlyUnlocked } = evaluateAchievements(INITIAL_ACHIEVEMENTS, {
    completedTasksCount: 1,
    maxHabitStreak: 3,
    totalFocusMinutes: 30,
    totalStudySessions: 0,
    totalJournalEntries: 0,
    completedProjectsCount: 0,
  });

  const firstTask = updatedAchievements.find(a => a.id === 'first_task');
  assert.ok(firstTask?.unlockedAt);
  assert.equal(firstTask?.progress, 100);

  const habit3d = updatedAchievements.find(a => a.id === 'habit_3d');
  assert.ok(habit3d?.unlockedAt);

  assert.equal(newlyUnlocked.length, 2);
});

test('evaluates streak milestones (14d, 30d, 100d) and task milestones (25, 50, 100)', () => {
  const { updatedAchievements } = evaluateAchievements(INITIAL_ACHIEVEMENTS, {
    completedTasksCount: 55,
    maxHabitStreak: 32,
    totalFocusMinutes: 320,
    totalStudySessions: 5,
    totalJournalEntries: 12,
    completedProjectsCount: 1,
    completedRoutinesCount: 2,
  });

  const habit30d = updatedAchievements.find(a => a.id === 'habit_30d');
  assert.ok(habit30d?.unlockedAt);
  assert.equal(habit30d?.progress, 100);

  const habit100d = updatedAchievements.find(a => a.id === 'habit_100d');
  assert.equal(habit100d?.unlockedAt, undefined);
  assert.equal(habit100d?.progress, 32);

  const fiftyTasks = updatedAchievements.find(a => a.id === 'fifty_tasks');
  assert.ok(fiftyTasks?.unlockedAt);

  const hundredTasks = updatedAchievements.find(a => a.id === 'hundred_tasks');
  assert.equal(hundredTasks?.unlockedAt, undefined);
  assert.equal(hundredTasks?.progress, 55);

  const firstRoutine = updatedAchievements.find(a => a.id === 'first_routine');
  assert.ok(firstRoutine?.unlockedAt);

  const focus300 = updatedAchievements.find(a => a.id === 'focus_300');
  assert.ok(focus300?.unlockedAt);
});

test('1 & 2. completing a task awards XP once, updates level/progress, and toggling does not duplicate XP', () => {
  const db = createCleanDb(true);
  const task: Task = {
    id: 't_1',
    title: 'Ship gamification fixes',
    description: '',
    createdAt: '2026-10-25T08:00:00Z',
    updatedAt: '2026-10-25T08:00:00Z',
    status: 'todo',
    priority: 'high',
    tags: [],
    archived: false,
  };

  const initialSave = db.saveTask(task);
  assert.equal(initialSave.xpAwarded, 0);
  assert.equal(db.getTotalXp(), 0);

  // Complete task for the first time -> 15 task XP + 30 first_task achievement XP = 45 XP
  const completeOutcome = db.saveTask({ ...task, status: 'completed' });
  assert.equal(completeOutcome.xpAwarded, XP_VALUES.TASK_COMPLETED);
  assert.equal(completeOutcome.newlyUnlockedAchievements.some(a => a.id === 'first_task'), true);
  assert.equal(db.getTotalXp(), XP_VALUES.TASK_COMPLETED + 30);
  assert.equal(calculateLevel(db.getTotalXp()).level, 2);

  // Toggle back to todo and then completed again -> 0 XP awarded
  const reopenOutcome = db.saveTask({ ...task, status: 'todo' });
  assert.equal(reopenOutcome.xpAwarded, 0);

  const recompleteOutcome = db.saveTask({ ...task, status: 'completed' });
  assert.equal(recompleteOutcome.xpAwarded, 0);
  assert.equal(recompleteOutcome.newlyUnlockedAchievements.length, 0);
  assert.equal(db.getTotalXp(), XP_VALUES.TASK_COMPLETED + 30);
});

test('3. creating a new task already marked completed awards XP once without allowing duplicate XP later', () => {
  const db = createCleanDb(true);
  const completedTask: Task = {
    id: 't_precompleted',
    title: 'Already done task',
    description: '',
    createdAt: '2026-10-25T08:00:00Z',
    updatedAt: '2026-10-25T08:00:00Z',
    status: 'completed',
    priority: 'medium',
    tags: [],
    archived: false,
  };

  const firstOutcome = db.saveTask(completedTask);
  assert.equal(firstOutcome.xpAwarded, XP_VALUES.TASK_COMPLETED);

  // Editing or re-saving or toggling does not award XP again
  const editOutcome = db.saveTask({ ...completedTask, title: 'Updated title' });
  assert.equal(editOutcome.xpAwarded, 0);

  db.saveTask({ ...completedTask, status: 'todo' });
  const toggleBackOutcome = db.saveTask({ ...completedTask, status: 'completed' });
  assert.equal(toggleBackOutcome.xpAwarded, 0);
});

test('4 & 5. habit completion deduplicates by (habitId, occurrenceDate) regardless of UTC timestamp and enforces historical backfill policy', () => {
  const db = createCleanDb(true);
  const todayStr = '2026-10-25';
  const habit: Habit = {
    id: 'h_test_1',
    name: 'Hydrate',
    description: '',
    category: 'Health',
    icon: 'Flame',
    color: '#3E7051',
    startDate: '2026-10-01',
    scheduleType: 'daily',
    targetType: 'boolean',
    targetValue: 1,
    targetUnit: 'times',
    archived: false,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  };
  db.saveHabit(habit);

  // First completion on todayStr awards 10 XP
  const occ1 = db.recordHabitOccurrence(
    {
      id: 'occ_1',
      habitId: habit.id,
      date: todayStr,
      recordedValue: 1,
      targetValue: 1,
      status: 'completed',
    },
    todayStr
  );
  assert.equal(occ1.xpAwarded, XP_VALUES.HABIT_COMPLETED);

  // Repeating completion on the same local date awards 0 XP
  const occ1Repeat = db.recordHabitOccurrence(
    {
      id: 'occ_1',
      habitId: habit.id,
      date: todayStr,
      recordedValue: 1,
      targetValue: 1,
      status: 'completed',
    },
    todayStr
  );
  assert.equal(occ1Repeat.xpAwarded, 0);

  // Toggling today's occurrence to missed and back to completed awards 0 XP
  db.recordHabitOccurrence(
    {
      id: 'occ_1',
      habitId: habit.id,
      date: todayStr,
      recordedValue: 0,
      targetValue: 1,
      status: 'missed',
    },
    todayStr
  );
  const occ1ToggleBack = db.recordHabitOccurrence(
    {
      id: 'occ_1',
      habitId: habit.id,
      date: todayStr,
      recordedValue: 1,
      targetValue: 1,
      status: 'completed',
    },
    todayStr
  );
  assert.equal(occ1ToggleBack.xpAwarded, 0);

  // Historical occurrence within the 7-day backfill window (e.g. 2 days ago) awards XP once
  const twoDaysAgo = addDays(todayStr, -2);
  const pastOccFirst = db.recordHabitOccurrence(
    {
      id: 'occ_past_2',
      habitId: habit.id,
      date: twoDaysAgo,
      recordedValue: 1,
      targetValue: 1,
      status: 'completed',
    },
    todayStr
  );
  assert.equal(pastOccFirst.xpAwarded, XP_VALUES.HABIT_COMPLETED);

  // Toggling that historical occurrence off and back on does NOT farm additional XP
  db.recordHabitOccurrence(
    {
      id: 'occ_past_2',
      habitId: habit.id,
      date: twoDaysAgo,
      recordedValue: 0,
      targetValue: 1,
      status: 'missed',
    },
    todayStr
  );
  const pastOccRefarm = db.recordHabitOccurrence(
    {
      id: 'occ_past_2',
      habitId: habit.id,
      date: twoDaysAgo,
      recordedValue: 1,
      targetValue: 1,
      status: 'completed',
    },
    todayStr
  );
  assert.equal(pastOccRefarm.xpAwarded, 0);

  // Ancient historical date outside the 7-day backfill window updates history but does NOT award XP
  const ancientDate = addDays(todayStr, -15);
  assert.equal(isEligibleForHabitXp(ancientDate, todayStr), false);
  const ancientOcc = db.recordHabitOccurrence(
    {
      id: 'occ_ancient',
      habitId: habit.id,
      date: ancientDate,
      recordedValue: 1,
      targetValue: 1,
      status: 'completed',
    },
    todayStr
  );
  assert.equal(ancientOcc.xpAwarded, 0);

  // Future date does NOT award XP
  const futureDate = addDays(todayStr, 2);
  assert.equal(isEligibleForHabitXp(futureDate, todayStr), false);
  const futureOcc = db.recordHabitOccurrence(
    {
      id: 'occ_future',
      habitId: habit.id,
      date: futureDate,
      recordedValue: 1,
      targetValue: 1,
      status: 'completed',
    },
    todayStr
  );
  assert.equal(futureOcc.xpAwarded, 0);
});

test('6. completing the same routine on the same local date multiple times awards daily routine bonus only once', () => {
  const db = createCleanDb(true);
  const localToday = formatLocalDate(new Date());

  const firstRun = db.recordRoutineCompletion('rt_test_1', localToday);
  assert.equal(firstRun.xpAwarded, XP_VALUES.ROUTINE_COMPLETED);
  assert.equal(db.getHabitRoutines()[0].lastCompletedDate, localToday);
  assert.equal(db.getHabitRoutines()[0].completionsCount, 1);

  const secondRunSameDay = db.recordRoutineCompletion('rt_test_1', localToday);
  assert.equal(secondRunSameDay.xpAwarded, 0);
  assert.equal(db.getHabitRoutines()[0].completionsCount, 1);

  // Next day allows earning the daily routine bonus again
  const nextDay = addDays(localToday, 1);
  const nextDayRun = db.recordRoutineCompletion('rt_test_1', nextDay);
  assert.equal(nextDayRun.xpAwarded, XP_VALUES.ROUTINE_COMPLETED);
  assert.equal(db.getHabitRoutines()[0].completionsCount, 2);
  assert.equal(db.getHabitRoutines()[0].lastCompletedDate, nextDay);
});

test('7. completing qualitative and measurable goals awards goal XP once and prevents duplicate XP on edit, reload, or toggle', () => {
  const db = createCleanDb(true);

  const qualGoal: Goal = {
    id: 'g_qual_1',
    title: 'Launch Daycraft 1.0',
    description: 'Complete Phase 1 audit fixes',
    category: 'Product',
    color: '#7C5295',
    startDate: '2026-10-01',
    targetDate: '2026-11-01',
    status: 'active',
    isMeasurable: false,
    linkedProjectIds: [],
    linkedHabitIds: [],
    milestones: [],
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  };

  // Creating active goal awards 0 XP
  assert.equal(db.saveGoal(qualGoal).xpAwarded, 0);

  // Transitioning to achieved awards 100 XP
  const achieveQual = db.saveGoal({ ...qualGoal, status: 'achieved' });
  assert.equal(achieveQual.xpAwarded, XP_VALUES.GOAL_ACHIEVED);
  assert.equal(db.getTotalXp(), XP_VALUES.GOAL_ACHIEVED);

  // Editing an already-achieved goal awards 0 XP
  const editQual = db.saveGoal({ ...qualGoal, status: 'achieved', title: 'Launch Daycraft 1.1' });
  assert.equal(editQual.xpAwarded, 0);

  // Reopening and re-completing awards 0 XP
  db.saveGoal({ ...qualGoal, status: 'active' });
  const reAchieveQual = db.saveGoal({ ...qualGoal, status: 'achieved' });
  assert.equal(reAchieveQual.xpAwarded, 0);
  assert.equal(db.getTotalXp(), XP_VALUES.GOAL_ACHIEVED);

  // Measurable goal reaching targetValue transitions to achieved and awards 100 XP once
  const measurableGoal: Goal = {
    id: 'g_meas_1',
    title: 'Read 10 Books',
    description: '',
    category: 'Learning',
    color: '#3E7051',
    startDate: '2026-10-01',
    targetDate: '2026-12-31',
    status: 'active',
    isMeasurable: true,
    targetValue: 10,
    currentValue: 5,
    unit: 'books',
    linkedProjectIds: [],
    linkedHabitIds: [],
    milestones: [],
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  };

  assert.equal(db.saveGoal(measurableGoal).xpAwarded, 0);

  const reachTarget = db.saveGoal({ ...measurableGoal, currentValue: 10, status: 'achieved' });
  assert.equal(reachTarget.xpAwarded, XP_VALUES.GOAL_ACHIEVED);
  assert.equal(db.getGoals().find(g => g.id === 'g_meas_1')?.status, 'achieved');
  assert.equal(db.getTotalXp(), XP_VALUES.GOAL_ACHIEVED * 2);
});

test('8. habit_3d does not unlock on a fresh/empty habit state before a real 3-day streak exists', () => {
  const db = createCleanDb(true);
  const habit3dBefore = db.getAchievements().find(a => a.id === 'habit_3d');
  assert.equal(habit3dBefore?.unlockedAt, undefined);
  assert.equal(habit3dBefore?.current, 0);
  assert.equal(habit3dBefore?.progress, 0);

  const todayStr = formatLocalDate(new Date());
  const habit: Habit = {
    id: 'h_streak',
    name: 'Daily Walk',
    description: '',
    category: 'Wellness',
    icon: 'Flame',
    color: '#C86D51',
    startDate: addDays(todayStr, -5),
    scheduleType: 'daily',
    targetType: 'boolean',
    targetValue: 1,
    targetUnit: 'times',
    archived: false,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  };
  db.saveHabit(habit);

  // Day 1 & Day 2 -> still not unlocked
  db.recordHabitOccurrence(
    {
      id: 'o_d1',
      habitId: habit.id,
      date: addDays(todayStr, -2),
      recordedValue: 1,
      targetValue: 1,
      status: 'completed',
    },
    todayStr
  );
  db.recordHabitOccurrence(
    {
      id: 'o_d2',
      habitId: habit.id,
      date: addDays(todayStr, -1),
      recordedValue: 1,
      targetValue: 1,
      status: 'completed',
    },
    todayStr
  );
  assert.equal(db.getAchievements().find(a => a.id === 'habit_3d')?.unlockedAt, undefined);

  // Day 3 -> unlocks habit_3d!
  const day3Outcome = db.recordHabitOccurrence(
    {
      id: 'o_d3',
      habitId: habit.id,
      date: todayStr,
      recordedValue: 1,
      targetValue: 1,
      status: 'completed',
    },
    todayStr
  );
  assert.equal(day3Outcome.newlyUnlockedAchievements.some(a => a.id === 'habit_3d'), true);
  assert.ok(db.getAchievements().find(a => a.id === 'habit_3d')?.unlockedAt);
});

test('9. first_project unlocks when a project is completed via milestones or status', () => {
  const db = createCleanDb(true);
  const project: Project = {
    id: 'p_arch_1',
    name: 'Core Platform',
    description: '',
    color: '#C86D51',
    icon: 'Folder',
    status: 'in_progress',
    milestones: [
      { id: 'm1', title: 'Schema', completed: true },
      { id: 'm2', title: 'Tests', completed: false },
    ],
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  };

  const initialSave = db.saveProject(project);
  assert.equal(initialSave.newlyUnlockedAchievements.length, 0);
  assert.equal(db.getAchievements().find(a => a.id === 'first_project')?.unlockedAt, undefined);

  // Completing all milestones unlocks first_project
  const completeMilestones = db.saveProject({
    ...project,
    milestones: [
      { id: 'm1', title: 'Schema', completed: true },
      { id: 'm2', title: 'Tests', completed: true },
    ],
    status: 'completed',
  });
  assert.equal(completeMilestones.newlyUnlockedAchievements.some(a => a.id === 'first_project'), true);
  assert.equal(completeMilestones.achievementXpAwarded, 100);
  assert.ok(db.getAchievements().find(a => a.id === 'first_project')?.unlockedAt);
});

test('10. disabling gamificationEnabled prevents XP awards across task, habit, routine, goal, focus, study, journal, and achievement paths', () => {
  const db = createCleanDb(false);
  const todayStr = formatLocalDate(new Date());

  const taskRes = db.saveTask({
    id: 't_disabled',
    title: 'No XP task',
    description: '',
    createdAt: '2026-10-25T00:00:00Z',
    updatedAt: '2026-10-25T00:00:00Z',
    status: 'completed',
    priority: 'medium',
    tags: [],
    archived: false,
  });
  assert.equal(taskRes.xpAwarded, 0);
  assert.equal(taskRes.achievementXpAwarded, 0);

  const habitRes = db.recordHabitOccurrence(
    {
      id: 'occ_disabled',
      habitId: 'h_test_1',
      date: todayStr,
      recordedValue: 1,
      targetValue: 1,
      status: 'completed',
    },
    todayStr
  );
  assert.equal(habitRes.xpAwarded, 0);

  const routineRes = db.recordRoutineCompletion('rt_test_1', todayStr);
  assert.equal(routineRes.xpAwarded, 0);

  const goalRes = db.saveGoal({
    id: 'g_disabled',
    title: 'No XP goal',
    description: '',
    category: 'Personal',
    color: '#7C5295',
    startDate: todayStr,
    targetDate: todayStr,
    status: 'achieved',
    isMeasurable: false,
    linkedProjectIds: [],
    linkedHabitIds: [],
    milestones: [],
    createdAt: '2026-10-25T00:00:00Z',
    updatedAt: '2026-10-25T00:00:00Z',
  });
  assert.equal(goalRes.xpAwarded, 0);

  const focusRes = db.recordFocusSession({
    id: 'fs_disabled',
    startTime: '2026-10-25T09:00:00Z',
    endTime: '2026-10-25T09:25:00Z',
    durationMinutes: 25,
    type: 'focus',
    completed: true,
  });
  assert.equal(focusRes.xpAwarded, 0);

  const studyRes = db.recordStudySession({
    id: 'ss_disabled',
    subjectId: 'sub_1',
    date: todayStr,
    durationMinutes: 45,
    createdAt: '2026-10-25T10:00:00Z',
  });
  assert.equal(studyRes.xpAwarded, 0);

  const journalRes = db.saveJournalEntry({
    id: 'j_disabled',
    date: todayStr,
    title: 'Quiet journal',
    content: 'Reflecting without XP.',
    tags: [],
    createdAt: '2026-10-25T11:00:00Z',
    updatedAt: '2026-10-25T11:00:00Z',
  });
  assert.equal(journalRes.xpAwarded, 0);

  assert.equal(db.getTotalXp(), 0);
  assert.equal(db.getXpLedger().length, 0);
});

test('11. achievement unlock listener fires once per newly unlocked achievement during runtime actions', () => {
  const db = createCleanDb(true);
  const unlockedEvents: Achievement[][] = [];
  const unsubscribe = db.subscribeAchievementUnlocks(unlocked => {
    unlockedEvents.push(unlocked);
  });

  db.saveTask({
    id: 't_unlock_1',
    title: 'First task',
    description: '',
    createdAt: '2026-10-25T00:00:00Z',
    updatedAt: '2026-10-25T00:00:00Z',
    status: 'completed',
    priority: 'medium',
    tags: [],
    archived: false,
  });

  assert.equal(unlockedEvents.length, 1);
  assert.equal(unlockedEvents[0][0].id, 'first_task');

  // Subsequent task completion (2nd task) does not re-emit first_task
  db.saveTask({
    id: 't_unlock_2',
    title: 'Second task',
    description: '',
    createdAt: '2026-10-25T00:00:00Z',
    updatedAt: '2026-10-25T00:00:00Z',
    status: 'completed',
    priority: 'medium',
    tags: [],
    archived: false,
  });

  assert.equal(unlockedEvents.length, 1);
  unsubscribe();
});

test('12 & 13. persisted XP, level, achievements, tasks, and goals survive archive export, validation, and restore/hydration without duplicate XP', () => {
  const db = createCleanDb(true);

  db.saveTask({
    id: 't_persist',
    title: 'Persisted Task',
    description: '',
    createdAt: '2026-10-25T00:00:00Z',
    updatedAt: '2026-10-25T00:00:00Z',
    status: 'completed',
    priority: 'high',
    tags: [],
    archived: false,
  });

  const goal: Goal = {
    id: 'g_persist',
    title: 'Persisted Goal',
    description: '',
    category: 'Growth',
    color: '#7C5295',
    startDate: '2026-10-01',
    targetDate: '2026-12-01',
    status: 'active',
    isMeasurable: false,
    linkedProjectIds: [],
    linkedHabitIds: [],
    milestones: [],
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  };
  db.saveGoal(goal);
  db.saveGoal({ ...goal, status: 'achieved' });

  const xpBeforeExport = db.getTotalXp();
  const archive = db.exportArchive();

  // Restore into a fresh DatabaseManager instance
  const restoredDb = createCleanDb(true);
  const restoreRes = restoredDb.restoreArchive(archive);
  assert.equal(restoreRes.success, true);
  assert.equal(restoreRes.errors.length, 0);

  assert.equal(restoredDb.getTotalXp(), xpBeforeExport);
  assert.equal(calculateLevel(restoredDb.getTotalXp()).level, calculateLevel(xpBeforeExport).level);
  assert.equal(restoredDb.getTasks().find(t => t.id === 't_persist')?.status, 'completed');
  assert.equal(restoredDb.getGoals().find(g => g.id === 'g_persist')?.status, 'achieved');
  assert.ok(restoredDb.getAchievements().find(a => a.id === 'first_task')?.unlockedAt);

  // Editing the restored achieved goal or completed task does not award duplicate XP
  const editGoalAfterRestore = restoredDb.saveGoal({
    ...goal,
    status: 'achieved',
    description: 'Updated after restore',
  });
  assert.equal(editGoalAfterRestore.xpAwarded, 0);
  assert.equal(restoredDb.getTotalXp(), xpBeforeExport);
});

test('buildRewardKey generates deterministic keys', () => {
  assert.equal(buildRewardKey('task_completed', 't1'), 'task_completed:t1');
  assert.equal(
    buildRewardKey('habit_completed', 'h1', '2026-10-25'),
    'habit_completed:h1:2026-10-25'
  );
});
