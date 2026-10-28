import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyGoalProgressDelta,
  calculateGoalProgress,
  formatCompletionDateDisplay,
  parseDirectGoalProgressInput,
  partitionGoalsByStatus,
  resolveGoalCompletionDate,
  sortCompletedGoals,
  validateGoalEditFields,
} from '../src/services/goalProgressService';
import { DatabaseManager } from '../src/database/db';
import { INITIAL_ACHIEVEMENTS, XP_VALUES } from '../src/services/gamificationService';
import { Goal } from '../src/domain/models';

function createCleanDb(gamificationEnabled: boolean = true): DatabaseManager {
  const instance = new DatabaseManager(false);
  instance.migrateAndLoad({
    schemaVersion: 1,
    tasks: [],
    habits: [],
    habitOccurrences: [],
    habitRoutines: [],
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

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: overrides.id || 'g_default',
    title: overrides.title || 'Establish Unbreakable Morning & Evening Routine',
    description: overrides.description ?? 'Daily discipline anchor',
    category: overrides.category || 'Lifestyle',
    color: overrides.color || '#3E7051',
    startDate: overrides.startDate || '2026-10-01',
    targetDate: overrides.targetDate || '2026-10-31',
    status: overrides.status || 'active',
    isMeasurable: overrides.isMeasurable ?? true,
    targetValue: 'targetValue' in overrides ? overrides.targetValue : 30,
    currentValue: 'currentValue' in overrides ? overrides.currentValue : 0,
    unit: 'unit' in overrides ? overrides.unit : 'days',
    linkedProjectIds: overrides.linkedProjectIds || [],
    linkedHabitIds: overrides.linkedHabitIds || [],
    milestones: overrides.milestones || [],
    achievedAt: overrides.achievedAt,
    createdAt: overrides.createdAt || '2026-10-01T08:00:00Z',
    updatedAt: overrides.updatedAt || '2026-10-01T08:00:00Z',
  };
}

test('Progress 1–3: below target, at target, and over target (57 / 30 days) cap visual percent at 100% while preserving currentValue', () => {
  // 0 / 30 -> 0%, Active
  const zeroProg = calculateGoalProgress(makeGoal({ currentValue: 0, targetValue: 30, status: 'active' }));
  assert.equal(zeroProg.visualPercent, 0);
  assert.equal(zeroProg.stateLabel, 'Active');
  assert.equal(zeroProg.isTargetMet, false);

  // 15 / 30 -> 50%, In progress
  const halfProg = calculateGoalProgress(makeGoal({ currentValue: 15, targetValue: 30, status: 'active' }));
  assert.equal(halfProg.visualPercent, 50);
  assert.equal(halfProg.stateLabel, 'In progress');
  assert.equal(halfProg.metricSummary, 'Current: 15 / 30 days');

  // 30 / 30 -> 100%, Completed
  const exactProg = calculateGoalProgress(makeGoal({ currentValue: 30, targetValue: 30, status: 'achieved' }));
  assert.equal(exactProg.visualPercent, 100);
  assert.equal(exactProg.stateLabel, 'Completed');
  assert.equal(exactProg.metricSummary, '30 / 30 days · Completed');

  // 57 / 30 -> 100% visual bar, underlying 57 preserved
  const overGoal = makeGoal({ currentValue: 57, targetValue: 30, status: 'achieved' });
  const overProg = calculateGoalProgress(overGoal);
  assert.equal(overProg.visualPercent, 100);
  assert.equal(overProg.safeCurrentValue, 57);
  assert.equal(overGoal.currentValue, 57);
  assert.equal(overProg.metricSummary, '57 / 30 days · Completed');
});

test('Progress 4–6: zero/invalid targets, negative/non-finite values, and qualitative goals are handled safely', () => {
  // Negative current value (-2 / 30) -> 0%
  const negCurrent = calculateGoalProgress(makeGoal({ currentValue: -2, targetValue: 30, status: 'active' }));
  assert.equal(negCurrent.visualPercent, 0);
  assert.equal(negCurrent.safeCurrentValue, 0);

  // Zero target (10 / 0) -> never divides by zero or produces NaN/Infinity
  const zeroTarget = calculateGoalProgress(makeGoal({ currentValue: 10, targetValue: 0, status: 'active' }));
  assert.equal(zeroTarget.hasValidTarget, false);
  assert.equal(zeroTarget.visualPercent, 0);
  assert.equal(Number.isFinite(zeroTarget.visualPercent), true);

  // Negative target (10 / -5) -> safe fallback
  const negTarget = calculateGoalProgress(makeGoal({ currentValue: 10, targetValue: -5, status: 'active' }));
  assert.equal(negTarget.hasValidTarget, false);
  assert.equal(negTarget.visualPercent, 0);

  // NaN / Infinity values -> safe fallback
  const nanValues = calculateGoalProgress(
    makeGoal({ currentValue: Number.NaN, targetValue: Number.POSITIVE_INFINITY, status: 'active' })
  );
  assert.equal(nanValues.hasValidTarget, false);
  assert.equal(nanValues.visualPercent, 0);

  // Qualitative goal -> does not use numeric division even if targetValue/currentValue exist
  const qualActive = calculateGoalProgress(
    makeGoal({ isMeasurable: false, currentValue: 25, targetValue: 50, status: 'active' })
  );
  assert.equal(qualActive.hasValidTarget, false);
  assert.equal(qualActive.visualPercent, 0);
  assert.equal(qualActive.stateLabel, 'Active');

  const qualAchieved = calculateGoalProgress(
    makeGoal({ isMeasurable: false, currentValue: 0, targetValue: 50, status: 'achieved' })
  );
  assert.equal(qualAchieved.visualPercent, 100);
  assert.equal(qualAchieved.stateLabel, 'Completed');
});

test('Sections 7–15: partitioning separates active, paused, achieved, and archived goals, updates counts, and sorts completed goals', () => {
  const db = createCleanDb(true);

  const gActive = makeGoal({ id: 'g_act', title: 'Active Goal', status: 'active', currentValue: 5, targetValue: 10 });
  const gPaused = makeGoal({ id: 'g_pau', title: 'Paused Goal', status: 'paused', currentValue: 4, targetValue: 10 });
  const gAchievedOlder = makeGoal({
    id: 'g_ach_old',
    title: 'Older Completed Goal',
    status: 'achieved',
    currentValue: 10,
    targetValue: 10,
    achievedAt: '2026-10-10T12:00:00Z',
  });
  const gAchievedNewer = makeGoal({
    id: 'g_ach_new',
    title: 'Newer Completed Goal',
    status: 'achieved',
    currentValue: 57,
    targetValue: 30,
    achievedAt: '2026-10-20T09:00:00Z',
  });
  const gAchievedLegacy = makeGoal({
    id: 'g_ach_legacy',
    title: 'Legacy Completed Goal Without Timestamp',
    status: 'achieved',
    currentValue: 20,
    targetValue: 20,
    achievedAt: undefined,
  });
  const gArchived = makeGoal({ id: 'g_arc', title: 'Archived Goal', status: 'archived' });

  db.migrateAndLoad({
    schemaVersion: 1,
    goals: [gActive, gPaused, gAchievedOlder, gAchievedLegacy, gAchievedNewer, gArchived],
    xpLedger: [],
  });

  const sections = partitionGoalsByStatus(db.getGoals(), db.getXpLedger());

  // 7. Active goals appear in active section
  assert.deepEqual(sections.activeGoals.map(g => g.id), ['g_act']);

  // 8. Paused goals remain in paused section
  assert.deepEqual(sections.pausedGoals.map(g => g.id), ['g_pau']);

  // 9 & 10. Achieved goals disappear from active section and appear in completedGoals
  assert.equal(sections.activeGoals.some(g => g.status === 'achieved'), false);
  assert.deepEqual(sections.completedGoals.map(g => g.id), [
    'g_ach_new',
    'g_ach_old',
    'g_ach_legacy',
  ]);

  // 11. Archived goals appear in neither active nor completed sections
  assert.equal(sections.activeGoals.some(g => g.id === 'g_arc'), false);
  assert.equal(sections.completedGoals.some(g => g.id === 'g_arc'), false);
  assert.deepEqual(sections.archivedGoals.map(g => g.id), ['g_arc']);

  // 12. Completing an active goal immediately moves it to completedGoals and updates count
  db.saveGoal({ ...gActive, currentValue: 10 });
  const afterCompletion = partitionGoalsByStatus(db.getGoals(), db.getXpLedger());
  assert.equal(afterCompletion.activeGoals.length, 0);
  assert.equal(afterCompletion.completedGoals.length, 4);
  assert.equal(afterCompletion.completedGoals[0].id, 'g_act');

  // 14 & 15. Reloading preserves completed goals and handles missing legacy completion timestamps safely
  const snapshot = db.getSnapshot();
  const reloadedDb = createCleanDb(true);
  reloadedDb.migrateAndLoad(snapshot as unknown as Record<string, unknown>);
  const afterReload = partitionGoalsByStatus(reloadedDb.getGoals(), reloadedDb.getXpLedger());
  assert.equal(afterReload.completedGoals.length, 4);

  const legacyResolved = resolveGoalCompletionDate(gAchievedLegacy, []);
  assert.equal(legacyResolved, null);
  assert.equal(formatCompletionDateDisplay(legacyResolved), null);
});

test('Paused & Archived protection: paused or archived goals do not auto-complete when currentValue meets targetValue', () => {
  const db = createCleanDb(true);
  const pausedGoal = makeGoal({
    id: 'g_paused_metric',
    status: 'paused',
    isMeasurable: true,
    currentValue: 10,
    targetValue: 20,
  });
  db.saveGoal(pausedGoal);

  // Updating currentValue on a paused goal to 25 / 20 must keep status as 'paused' and award 0 XP
  const updatePausedOutcome = db.saveGoal({
    ...pausedGoal,
    currentValue: 25,
  });
  assert.equal(updatePausedOutcome.xpAwarded, 0);
  assert.equal(db.getGoals().find(g => g.id === 'g_paused_metric')?.status, 'paused');
});

test('History 16–19: achievedAt is recorded on completion, preserved on edit/reopen/reload/restore, and never fabricated for legacy data', () => {
  const db = createCleanDb(true);
  const goal = makeGoal({
    id: 'g_hist_1',
    status: 'active',
    isMeasurable: true,
    currentValue: 20,
    targetValue: 30,
  });
  db.saveGoal(goal);
  assert.equal(db.getGoals()[0].achievedAt, undefined);

  // 16. Genuine completion records achievedAt
  db.saveGoal({ ...goal, currentValue: 30 });
  const completedGoal = db.getGoals()[0];
  assert.equal(completedGoal.status, 'achieved');
  assert.ok(completedGoal.achievedAt);
  const originalAchievedAt = completedGoal.achievedAt;

  // 17. Editing an already achieved goal preserves its original achievedAt
  db.saveGoal({
    ...completedGoal,
    title: 'Edited Completed Goal Title',
    achievedAt: '2099-01-01T00:00:00Z', // even if caller passes a different timestamp while editing
  });
  assert.equal(db.getGoals()[0].achievedAt, originalAchievedAt);

  // 18. Reopening a completed measurable goal (even at 30 / 30) transitions back to 'active' and preserves achievedAt history
  const currentSaved = db.getGoals()[0];
  const reopenOutcome = db.saveGoal({ ...currentSaved, status: 'active' });
  assert.equal(reopenOutcome.xpAwarded, 0);
  assert.equal(db.getGoals()[0].status, 'active');
  assert.equal(db.getGoals()[0].achievedAt, originalAchievedAt);

  // Re-completing the reopened goal preserves original achievedAt and awards 0 duplicate XP
  const recompleteOutcome = db.saveGoal({ ...db.getGoals()[0], status: 'achieved' });
  assert.equal(recompleteOutcome.xpAwarded, 0);
  assert.equal(db.getGoals()[0].status, 'achieved');
  assert.equal(db.getGoals()[0].achievedAt, originalAchievedAt);

  // 19. Backup & restore preserves achievedAt and does not fabricate achievedAt for legacy records
  const archive = db.exportArchive();
  const restoredDb = createCleanDb(true);
  const restoreRes = restoredDb.restoreArchive(archive);
  assert.equal(restoreRes.success, true);
  assert.equal(restoredDb.getGoals()[0].achievedAt, originalAchievedAt);

  // Malformed optional historical metadata in raw storage does not crash migrateAndLoad
  const malformedDb = createCleanDb(true);
  malformedDb.migrateAndLoad({
    schemaVersion: 1,
    goals: [
      {
        id: 'g_malformed',
        title: 'Resilient Goal',
        status: 'achieved',
        isMeasurable: true,
        targetValue: 30,
        currentValue: 57,
        unit: 'days',
        achievedAt: 'not-a-valid-timestamp',
        milestones: 'invalid-array',
      },
    ],
  });
  const loadedMalformed = malformedDb.getGoals()[0];
  assert.equal(loadedMalformed.status, 'achieved');
  assert.equal(loadedMalformed.currentValue, 57);
  assert.equal(loadedMalformed.achievedAt, undefined);
  assert.deepEqual(loadedMalformed.milestones, []);
});

test('XP 20–25: completing a goal awards XP at most once across saves, reloads, restores, and respects gamificationEnabled', () => {
  const db = createCleanDb(true);
  const goal = makeGoal({
    id: 'g_xp_once',
    status: 'active',
    isMeasurable: true,
    currentValue: 10,
    targetValue: 30,
  });

  db.saveGoal(goal);
  assert.equal(db.getTotalXp(), 0);

  // 20 & 25. First legitimate completion awards 100 XP and reports xpAwarded = 100
  const firstComplete = db.saveGoal({ ...goal, currentValue: 57 });
  assert.equal(firstComplete.xpAwarded, XP_VALUES.GOAL_ACHIEVED);
  assert.equal(db.getTotalXp(), XP_VALUES.GOAL_ACHIEVED);

  // 21 & 22. Repeated saves, edits, and section partitioning do not award XP
  const repeatSave = db.saveGoal({ ...db.getGoals()[0], description: 'Refined notes' });
  assert.equal(repeatSave.xpAwarded, 0);
  partitionGoalsByStatus(db.getGoals(), db.getXpLedger());
  sortCompletedGoals(db.getGoals(), db.getXpLedger());
  assert.equal(db.getTotalXp(), XP_VALUES.GOAL_ACHIEVED);

  // 23. Restoring backup does not duplicate goal XP
  const archive = db.exportArchive();
  const restored = createCleanDb(true);
  restored.restoreArchive(archive);
  assert.equal(restored.getTotalXp(), XP_VALUES.GOAL_ACHIEVED);
  const saveAfterRestore = restored.saveGoal({ ...restored.getGoals()[0], title: 'Updated' });
  assert.equal(saveAfterRestore.xpAwarded, 0);
  assert.equal(restored.getTotalXp(), XP_VALUES.GOAL_ACHIEVED);

  // 24. Gamification disabled prevents goal XP
  const disabledDb = createCleanDb(false);
  const disabledOutcome = disabledDb.saveGoal(
    makeGoal({ id: 'g_no_xp', status: 'achieved', currentValue: 30, targetValue: 30 })
  );
  assert.equal(disabledOutcome.xpAwarded, 0);
  assert.equal(disabledDb.getTotalXp(), 0);
});

test('Reopen & Archive Bug Fix Regressions (1–9): reactive partitions, reference updates, over-target reopen, reload, XP preservation, and repeated clicks', () => {
  const db = createCleanDb(true);

  const overTargetGoal = makeGoal({
    id: 'g_reopen_over',
    title: 'Establish Unbreakable Morning & Evening Routine',
    description: 'Daily anchor',
    category: 'Lifestyle',
    targetDate: '2026-10-31',
    status: 'active',
    isMeasurable: true,
    currentValue: 10,
    targetValue: 30,
    unit: 'days',
    linkedProjectIds: ['proj_1'],
    linkedHabitIds: ['hab_1'],
  });

  const secondCompletedGoal = makeGoal({
    id: 'g_archive_done',
    title: 'Master Offline First Architecture',
    status: 'active',
    isMeasurable: false,
  });

  db.saveGoal(overTargetGoal);
  db.saveGoal(secondCompletedGoal);

  // Complete both goals (g_reopen_over reaches 57 / 30 days; g_archive_done marked achieved)
  const out1 = db.saveGoal({ ...overTargetGoal, currentValue: 57, status: 'achieved' });
  const out2 = db.saveGoal({ ...secondCompletedGoal, status: 'achieved' });
  assert.equal(out1.xpAwarded, XP_VALUES.GOAL_ACHIEVED);
  assert.equal(out2.xpAwarded, XP_VALUES.GOAL_ACHIEVED);
  assert.equal(db.getTotalXp(), XP_VALUES.GOAL_ACHIEVED * 2);

  // Simulate reactive UI state subscribed to db.subscribe() with memoized partitioning on (allGoals, xpLedger)
  let latestGoalsState = db.getGoals();
  let latestLedgerState = db.getXpLedger();
  let latestPartitions = partitionGoalsByStatus(latestGoalsState, latestLedgerState);
  let subscriberNotificationCount = 0;

  const unsubscribe = db.subscribe(() => {
    subscriberNotificationCount += 1;
    const nextGoals = db.getGoals();
    const nextLedger = db.getXpLedger();
    // Verify db.getGoals() returns a new array reference so React useState/useMemo never skips recalculation
    assert.notEqual(nextGoals, latestGoalsState);
    latestGoalsState = nextGoals;
    latestLedgerState = nextLedger;
    latestPartitions = partitionGoalsByStatus(latestGoalsState, latestLedgerState);
  });

  assert.equal(latestPartitions.completedGoals.length, 2);
  assert.equal(latestPartitions.activeGoals.length, 0);
  assert.equal(latestPartitions.archivedGoals.length, 0);

  // 1, 2, 5, 8. Reopen over-target completed goal (57 / 30 days) -> status becomes 'active', disappears from Completed Goals, appears in Active Goals immediately without auto-completing
  const goalToReopen = latestPartitions.completedGoals.find(g => g.id === 'g_reopen_over')!;
  const originalAchievedAt = goalToReopen.achievedAt;
  assert.ok(originalAchievedAt);

  const reopenRes = db.saveGoal({ ...goalToReopen, status: 'active' });
  assert.equal(reopenRes.xpAwarded, 0);
  assert.equal(subscriberNotificationCount, 1);

  const reopenedPersisted = db.getGoals().find(g => g.id === 'g_reopen_over')!;
  assert.equal(reopenedPersisted.status, 'active');
  assert.equal(reopenedPersisted.currentValue, 57);
  assert.equal(reopenedPersisted.targetValue, 30);
  assert.equal(reopenedPersisted.achievedAt, originalAchievedAt);
  assert.deepEqual(reopenedPersisted.linkedProjectIds, ['proj_1']);
  assert.deepEqual(reopenedPersisted.linkedHabitIds, ['hab_1']);

  assert.equal(latestPartitions.completedGoals.some(g => g.id === 'g_reopen_over'), false);
  assert.equal(latestPartitions.activeGoals.some(g => g.id === 'g_reopen_over'), true);
  assert.equal(latestPartitions.completedGoals.length, 1);
  assert.equal(latestPartitions.activeGoals.length, 1);

  // 9. Repeated clicks on Reopen or editing metadata on reopened over-target goal do not auto-complete or corrupt status/XP
  const repeatReopenRes = db.saveGoal({ ...reopenedPersisted, status: 'active' });
  assert.equal(repeatReopenRes.xpAwarded, 0);
  assert.equal(db.getGoals().find(g => g.id === 'g_reopen_over')?.status, 'active');
  assert.equal(latestPartitions.activeGoals.some(g => g.id === 'g_reopen_over'), true);
  assert.equal(latestPartitions.completedGoals.some(g => g.id === 'g_reopen_over'), false);

  const editReopenedRes = db.saveGoal({
    ...db.getGoals().find(g => g.id === 'g_reopen_over')!,
    description: 'Updated description while active at 57/30',
  });
  assert.equal(editReopenedRes.xpAwarded, 0);
  assert.equal(db.getGoals().find(g => g.id === 'g_reopen_over')?.status, 'active');

  // 3, 4, 5. Archive an achieved goal -> status becomes 'archived', disappears from Completed Goals, appears under Archived Goals immediately
  const goalToArchive = latestPartitions.completedGoals.find(g => g.id === 'g_archive_done')!;
  const archiveAchievedAt = goalToArchive.achievedAt;
  const archiveRes = db.saveGoal({ ...goalToArchive, status: 'archived' });
  assert.equal(archiveRes.xpAwarded, 0);

  const archivedPersisted = db.getGoals().find(g => g.id === 'g_archive_done')!;
  assert.equal(archivedPersisted.status, 'archived');
  assert.equal(archivedPersisted.achievedAt, archiveAchievedAt);

  assert.equal(latestPartitions.completedGoals.some(g => g.id === 'g_archive_done'), false);
  assert.equal(latestPartitions.archivedGoals.some(g => g.id === 'g_archive_done'), true);
  assert.equal(latestPartitions.completedGoals.length, 0);
  assert.equal(latestPartitions.archivedGoals.length, 1);

  // 9. Repeated Archive saves do not toggle back to active or alter XP
  db.saveGoal({ ...archivedPersisted, status: 'archived' });
  assert.equal(db.getGoals().find(g => g.id === 'g_archive_done')?.status, 'archived');
  assert.equal(latestPartitions.archivedGoals.length, 1);

  // 7. Previously earned XP is preserved without duplication or removal
  assert.equal(db.getTotalXp(), XP_VALUES.GOAL_ACHIEVED * 2);
  assert.equal(
    db.getXpLedger().filter(e => e.sourceType === 'goal_achieved').length,
    2
  );

  // 6. Refreshing the app (reloading from snapshot) preserves the new active and archived statuses
  const snapshot = db.getSnapshot();
  const reloadedDb = createCleanDb(true);
  reloadedDb.migrateAndLoad(snapshot as unknown as Record<string, unknown>);
  const reloadedPartitions = partitionGoalsByStatus(reloadedDb.getGoals(), reloadedDb.getXpLedger());

  assert.deepEqual(reloadedPartitions.activeGoals.map(g => g.id), ['g_reopen_over']);
  assert.deepEqual(reloadedPartitions.completedGoals.map(g => g.id), []);
  assert.deepEqual(reloadedPartitions.archivedGoals.map(g => g.id), ['g_archive_done']);
  assert.equal(reloadedDb.getTotalXp(), XP_VALUES.GOAL_ACHIEVED * 2);

  unsubscribe();
});

test('Goal Editing & Progress Controls: validate edits, apply -1/+1/+5 and direct numeric progress, persist updates, and prevent duplicate XP', () => {
  const db = createCleanDb(true);

  // 1. Validate edit fields (reject empty title or invalid target <= 0)
  const emptyTitleCheck = validateGoalEditFields({
    title: '   ',
    isMeasurable: true,
    targetValue: 30,
    currentValue: 5,
    unit: 'days',
  });
  assert.equal(emptyTitleCheck.valid, false);

  const invalidTargetCheck = validateGoalEditFields({
    title: 'Valid Title',
    isMeasurable: true,
    targetValue: 0,
    currentValue: 5,
    unit: 'days',
  });
  assert.equal(invalidTargetCheck.valid, false);

  const negativeCurrentCheck = validateGoalEditFields({
    title: 'Valid Title',
    isMeasurable: true,
    targetValue: 30,
    currentValue: -3,
    unit: 'days',
  });
  assert.equal(negativeCurrentCheck.valid, false);

  const validEditCheck = validateGoalEditFields({
    title: '  Master Systems Programming  ',
    isMeasurable: true,
    targetValue: '40',
    currentValue: '12',
    unit: ' hours ',
  });
  assert.equal(validEditCheck.valid, true);
  assert.equal(validEditCheck.sanitizedTitle, 'Master Systems Programming');
  assert.equal(validEditCheck.sanitizedTargetValue, 40);
  assert.equal(validEditCheck.sanitizedCurrentValue, 12);
  assert.equal(validEditCheck.sanitizedUnit, 'hours');

  // 2. Create a qualitative goal at 0% and convert/edit it into a measurable goal
  const initialGoal = makeGoal({
    id: 'g_edit_progress',
    title: 'Initial Goal',
    description: 'Initial description',
    category: 'Craft',
    targetDate: '2026-11-15',
    status: 'active',
    isMeasurable: false,
    targetValue: undefined,
    currentValue: undefined,
    unit: undefined,
  });
  db.saveGoal(initialGoal);
  assert.equal(calculateGoalProgress(db.getGoals()[0]).visualPercent, 0);

  // Edit goal details and configure measurable target (0 / 30 days) -> 0 XP awarded
  const editOutcome = db.saveGoal({
    ...db.getGoals()[0],
    title: 'Establish Unbreakable Routine',
    description: 'Updated motivation',
    category: 'Lifestyle',
    targetDate: '2026-12-01',
    isMeasurable: true,
    currentValue: 0,
    targetValue: 30,
    unit: 'days',
  });
  assert.equal(editOutcome.xpAwarded, 0);
  assert.equal(db.getTotalXp(), 0);

  // 3. Apply +1, +5, -1, and direct numeric input below completion threshold
  let goalState = db.getGoals()[0];
  assert.equal(applyGoalProgressDelta(goalState.currentValue, -1), 0); // clamped at 0

  const stepPlus1 = applyGoalProgressDelta(goalState.currentValue, 1);
  assert.equal(stepPlus1, 1);
  db.saveGoal({ ...goalState, currentValue: stepPlus1 });

  goalState = db.getGoals()[0];
  const stepPlus5 = applyGoalProgressDelta(goalState.currentValue, 5);
  assert.equal(stepPlus5, 6);
  db.saveGoal({ ...goalState, currentValue: stepPlus5 });

  goalState = db.getGoals()[0];
  const stepMinus1 = applyGoalProgressDelta(goalState.currentValue, -1);
  assert.equal(stepMinus1, 5);
  db.saveGoal({ ...goalState, currentValue: stepMinus1 });

  // Direct numeric input to 12 / 30 days -> 40%, 0 XP
  const direct12 = parseDirectGoalProgressInput('12');
  assert.equal(direct12.valid, true);
  assert.equal(direct12.value, 12);
  const belowThresholdSave = db.saveGoal({ ...db.getGoals()[0], currentValue: direct12.value });
  assert.equal(belowThresholdSave.xpAwarded, 0);
  assert.equal(db.getTotalXp(), 0);

  const prog12 = calculateGoalProgress(db.getGoals()[0]);
  assert.equal(prog12.valuePairLabel, '12 / 30 days');
  assert.equal(prog12.visualPercent, 40);

  // 4. Persist across reload
  const reloadSnap = db.getSnapshot();
  const reloadedDb = createCleanDb(true);
  reloadedDb.migrateAndLoad(reloadSnap as unknown as Record<string, unknown>);
  const reloadedGoal = reloadedDb.getGoals()[0];
  assert.equal(reloadedGoal.title, 'Establish Unbreakable Routine');
  assert.equal(reloadedGoal.currentValue, 12);
  assert.equal(reloadedGoal.targetValue, 30);
  assert.equal(reloadedGoal.unit, 'days');

  // 5. Paused goal progress update does not auto-complete
  db.saveGoal({ ...db.getGoals()[0], status: 'paused' });
  const pausedUpdate = db.saveGoal({ ...db.getGoals()[0], currentValue: 35, status: 'paused' });
  assert.equal(pausedUpdate.xpAwarded, 0);
  assert.equal(db.getGoals()[0].status, 'paused');
  assert.equal(db.getGoals()[0].currentValue, 35);

  // Resume back to active at 25 / 30, then reach target (30 / 30) -> auto-completes and awards 100 XP once
  db.saveGoal({ ...db.getGoals()[0], status: 'active', currentValue: 25 });
  const completeViaPlus5 = db.saveGoal({
    ...db.getGoals()[0],
    currentValue: applyGoalProgressDelta(db.getGoals()[0].currentValue, 5),
    status: 'active',
  });
  assert.equal(completeViaPlus5.xpAwarded, XP_VALUES.GOAL_ACHIEVED);
  assert.equal(db.getGoals()[0].status, 'achieved');
  assert.equal(db.getTotalXp(), XP_VALUES.GOAL_ACHIEVED);

  // 6. Reopening, editing, or re-completing never awards duplicate XP
  db.saveGoal({ ...db.getGoals()[0], status: 'active' });
  const repeatComplete = db.saveGoal({ ...db.getGoals()[0], currentValue: 35, status: 'active' });
  assert.equal(repeatComplete.xpAwarded, 0);
  assert.equal(db.getGoals()[0].status, 'achieved');
  assert.equal(db.getTotalXp(), XP_VALUES.GOAL_ACHIEVED);
});


