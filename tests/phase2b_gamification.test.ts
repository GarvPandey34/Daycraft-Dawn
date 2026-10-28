import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateLevel,
  evaluateAchievements,
  evaluateLevelProgression,
  filterAchievements,
  getAchievementStatus,
  getAchievementSummaryStats,
  getBadgeTier,
  getCrossedLevels,
  getNextLevelReward,
  INITIAL_ACHIEVEMENTS,
} from '../src/services/gamificationService';
import {
  DEFAULT_THEME_PRESET,
  getNewlyUnlockedThemes,
  getThemeUnlockStatus,
  isThemeUnlocked,
  resolveEligibleThemePreset,
  THEME_PRESETS,
} from '../src/theme/tokens';
import {
  createBackupArchive,
  serializeCanonicalJson,
  validateBackupArchive,
} from '../src/services/backupService';
import { DatabaseManager, LevelUpEvent } from '../src/database/db';
import { Achievement } from '../src/domain/models';

function createCleanDb(gamificationEnabled: boolean = true): DatabaseManager {
  const instance = new DatabaseManager(false);
  instance.migrateAndLoad({
    schemaVersion: 1,
    tasks: [],
    habits: [],
    habitOccurrences: [],
    habitRoutines: [
      {
        id: 'rt_1',
        name: 'Morning Stack',
        description: '',
        timeOfDay: 'morning',
        habitIds: ['h_1'],
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
      themePreset: 'warm_paper',
    },
  });
  return instance;
}

test('Phase 2B — 1. All 19 canonical achievements exist and filter/summary helpers work deterministically', () => {
  assert.equal(INITIAL_ACHIEVEMENTS.length, 19);

  const db = createCleanDb(true);
  // Complete 1 task -> unlocks first_task (1/1) and makes ten_tasks, twentyfive_tasks, fifty_tasks, hundred_tasks in_progress (1/N)
  db.saveTask({
    id: 't_filter_1',
    title: 'First task',
    description: '',
    createdAt: '2026-10-25T08:00:00Z',
    updatedAt: '2026-10-25T08:00:00Z',
    status: 'completed',
    priority: 'medium',
    tags: [],
    archived: false,
  });

  const achievements = db.getAchievements();
  assert.equal(achievements.length, 19);

  const summary = getAchievementSummaryStats(achievements);
  assert.equal(summary.totalCount, 19);
  assert.equal(summary.unlockedCount, 1);
  assert.equal(summary.inProgressCount, 4); // 10, 25, 50, 100 task badges
  assert.equal(summary.lockedCount, 14);
  assert.equal(summary.totalXpEarnedFromBadges, 30);

  // Filter by status
  assert.equal(filterAchievements(achievements, { status: 'unlocked' }).length, 1);
  assert.equal(filterAchievements(achievements, { status: 'in_progress' }).length, 4);
  assert.equal(filterAchievements(achievements, { status: 'locked' }).length, 14);

  // Filter by category
  const productivityBadges = filterAchievements(achievements, { category: 'productivity' });
  assert.equal(productivityBadges.length, 6); // 5 task badges + first_project

  // Filter by tier
  const obsidianBadges = filterAchievements(achievements, { tier: 'obsidian' });
  assert.ok(obsidianBadges.length >= 3);
  obsidianBadges.forEach(b => {
    assert.equal(getBadgeTier(b.target, b.category), 'obsidian');
  });

  // Filter by search query
  const grandArchitect = filterAchievements(achievements, { searchQuery: 'Grand Architect' });
  assert.equal(grandArchitect.length, 1);
  assert.equal(grandArchitect[0].id, 'first_project');
});

test('Phase 2B — 2. Achievement evaluation guards against invalid targets and preserves unlocked status at 100%', () => {
  const malformedAchievements: Achievement[] = [
    {
      ...INITIAL_ACHIEVEMENTS[0],
      target: 0, // invalid target
      current: -5,
    },
    {
      ...INITIAL_ACHIEVEMENTS[1],
      unlockedAt: '2026-10-01T12:00:00.000Z',
      current: 10,
      progress: 100,
    },
  ];

  // Even if current stats drop to 0, already-unlocked achievement stays unlocked at 100% and does not re-trigger newlyUnlocked
  const { updatedAchievements, newlyUnlocked } = evaluateAchievements(malformedAchievements, {
    completedTasksCount: 0,
    maxHabitStreak: 0,
    totalFocusMinutes: 0,
    totalStudySessions: 0,
    totalJournalEntries: 0,
    completedProjectsCount: 0,
    completedRoutinesCount: 0,
  });

  const firstTask = updatedAchievements.find(a => a.id === 'first_task')!;
  assert.equal(firstTask.target, 1);
  assert.equal(firstTask.progress, 0);
  assert.equal(Number.isNaN(firstTask.progress), false);

  const tenTasks = updatedAchievements.find(a => a.id === 'ten_tasks')!;
  assert.equal(tenTasks.unlockedAt, '2026-10-01T12:00:00.000Z');
  assert.equal(tenTasks.progress, 100);
  assert.equal(getAchievementStatus(tenTasks), 'unlocked');
  assert.equal(newlyUnlocked.length, 0);
});

test('Phase 2B — 3. Unseen achievement indicator tracks new unlocks and clears when viewed', () => {
  const db = createCleanDb(true);
  assert.equal(db.getUnseenAchievementIds().length, 0);

  db.saveTask({
    id: 't_unseen_1',
    title: 'Trigger first_task badge',
    description: '',
    createdAt: '2026-10-25T08:00:00Z',
    updatedAt: '2026-10-25T08:00:00Z',
    status: 'completed',
    priority: 'medium',
    tags: [],
    archived: false,
  });

  assert.deepEqual(db.getUnseenAchievementIds(), ['first_task']);

  // Viewing achievements page clears unseen indicator
  db.markAchievementsSeen();
  assert.deepEqual(db.getUnseenAchievementIds(), []);
});

test('Phase 2B — 4. calculateLevel handles 0, negative, NaN, and exact threshold boundaries consistently', () => {
  const atZero = calculateLevel(0);
  assert.equal(atZero.level, 1);
  assert.equal(atZero.currentLevelXp, 0);
  assert.equal(atZero.nextLevelXp, 30);
  assert.equal(atZero.xpNeededForNextLevel, 30);
  assert.equal(atZero.progressPercent, 0);

  const atNegative = calculateLevel(-100);
  assert.equal(atNegative.level, 1);
  assert.equal(atNegative.totalXp, 0);
  assert.equal(atNegative.nextLevelXp, 30);

  const atNaN = calculateLevel(Number.NaN);
  assert.equal(atNaN.level, 1);
  assert.equal(atNaN.totalXp, 0);

  // Level 2 starts at 30 XP, Level 3 at 120 XP (span = 90 XP)
  const at30 = calculateLevel(30);
  assert.equal(at30.level, 2);
  assert.equal(at30.currentLevelXp, 0);
  assert.equal(at30.nextLevelXp, 90);
  assert.equal(at30.xpNeededForNextLevel, 90);
  assert.equal(at30.progressPercent, 0);

  // Level 3 starts at 120 XP, Level 4 at 270 XP (span = 150 XP)
  const at120 = calculateLevel(120);
  assert.equal(at120.level, 3);
  assert.equal(at120.currentFloorXp, 120);
  assert.equal(at120.nextLevelThresholdXp, 270);
});

test('Phase 2B — 5. Multi-level jumps process all crossed levels in ascending order and claim rewards idempotently', () => {
  assert.deepEqual(getCrossedLevels(1, 4), [2, 3, 4]);
  assert.deepEqual(getCrossedLevels(3, 3), []);

  // Jump directly from 0 XP (Level 1) to 300 XP (Level 4: 270..480)
  const jump = evaluateLevelProgression(0, 300, []);
  assert.equal(jump.previousLevel, 1);
  assert.equal(jump.newLevel, 4);
  assert.equal(jump.leveledUp, true);
  assert.deepEqual(jump.crossedLevels, [2, 3, 4]);
  assert.deepEqual(
    jump.newlyClaimedRewards.map(r => r.level),
    [2, 3, 4]
  );
  assert.equal(
    jump.newlyClaimedRewards.find(r => r.level === 3)?.unlockedThemeId,
    'midnight'
  );

  // Re-evaluating at the same XP with updatedClaimedLevels claims nothing again
  const repeat = evaluateLevelProgression(300, 300, jump.updatedClaimedLevels);
  assert.equal(repeat.leveledUp, false);
  assert.equal(repeat.newlyClaimedRewards.length, 0);

  // Next level reward from Level 4 is Level 5 (Lavender Haze)
  const nextFrom4 = getNextLevelReward(4);
  assert.equal(nextFrom4?.level, 5);
  assert.equal(nextFrom4?.unlockedThemeId, 'lavender_haze');
});

test('Phase 2B — 6. Runtime level-up listener fires once per crossed level and unlocks level-gated themes without auto-equipping', () => {
  const db = createCleanDb(true);
  const events: LevelUpEvent[] = [];
  const unsub = db.subscribeLevelUps(ev => events.push(ev));

  // Achieve a goal (+100 XP) -> jumps from 0 XP (Level 1) to 100 XP (Level 2: 30..120)
  const g1Outcome = db.saveGoal({
    id: 'g_lvl_1',
    title: 'First Goal',
    description: '',
    category: 'Craft',
    color: '#3E7051',
    startDate: '2026-10-01',
    targetDate: '2026-11-01',
    status: 'achieved',
    isMeasurable: false,
    linkedProjectIds: [],
    linkedHabitIds: [],
    milestones: [],
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  });

  assert.equal(g1Outcome.leveledUp, true);
  assert.equal(g1Outcome.previousLevel, 1);
  assert.equal(g1Outcome.newLevel, 2);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].crossedLevels, [2]);

  // Achieve a second goal (+100 XP -> 200 Total XP, Level 3: 120..270) -> unlocks "midnight" theme
  const g2Outcome = db.saveGoal({
    id: 'g_lvl_2',
    title: 'Second Goal',
    description: '',
    category: 'Craft',
    color: '#3E7051',
    startDate: '2026-10-01',
    targetDate: '2026-11-01',
    status: 'achieved',
    isMeasurable: false,
    linkedProjectIds: [],
    linkedHabitIds: [],
    milestones: [],
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  });

  assert.equal(g2Outcome.leveledUp, true);
  assert.equal(g2Outcome.newLevel, 3);
  assert.equal(g2Outcome.newlyUnlockedThemes?.some(t => t.id === 'midnight'), true);
  assert.equal(db.isThemeEligible('midnight'), true);
  // Active theme remains warm_paper (never auto-equipped without user choice)
  assert.equal(db.getSettings().themePreset, 'warm_paper');

  unsub();
});

test('Phase 2B — 7. Theme eligibility enforces level and achievement locks and prevents equipping locked themes', () => {
  const lowContext = { level: 1, unlockedAchievementIds: [] };
  assert.equal(isThemeUnlocked('warm_paper', lowContext), true);
  assert.equal(isThemeUnlocked('sage_garden', lowContext), true);
  assert.equal(isThemeUnlocked('monochrome', lowContext), true);
  assert.equal(isThemeUnlocked('midnight', lowContext), false);
  assert.equal(isThemeUnlocked('emerald_luxe', lowContext), false);
  assert.equal(isThemeUnlocked('aurora', lowContext), false);
  assert.equal(isThemeUnlocked('solar_gold', lowContext), false);

  // Level 3 unlocks midnight, first_project unlocks emerald_luxe
  const midContext = { level: 3, unlockedAchievementIds: ['first_project'] };
  assert.equal(isThemeUnlocked('midnight', midContext), true);
  assert.equal(isThemeUnlocked('emerald_luxe', midContext), true);
  assert.equal(isThemeUnlocked('aurora', midContext), false);

  const newlyUnlocked = getNewlyUnlockedThemes(lowContext, midContext);
  assert.deepEqual(
    newlyUnlocked.map(t => t.id).sort(),
    ['emerald_luxe', 'midnight']
  );

  const auroraStatus = getThemeUnlockStatus('aurora', midContext);
  assert.equal(auroraStatus.unlocked, false);
  assert.equal(auroraStatus.requiredLevel, 7);

  // DatabaseManager refuses to equip a locked theme and keeps eligible theme
  const db = createCleanDb(true);
  db.updateSettings({ themePreset: 'aurora' });
  assert.equal(db.getSettings().themePreset, DEFAULT_THEME_PRESET);

  // Unlocking first_project via project completion unlocks emerald_luxe and allows equipping it
  db.saveProject({
    id: 'p_luxe',
    name: 'Emerald Project',
    description: '',
    color: '#1B6B4A',
    icon: 'Folder',
    status: 'completed',
    milestones: [{ id: 'm1', title: 'Done', completed: true }],
    createdAt: '2026-10-25T00:00:00Z',
    updatedAt: '2026-10-25T00:00:00Z',
  });
  assert.equal(db.isThemeEligible('emerald_luxe'), true);
  db.updateSettings({ themePreset: 'emerald_luxe' });
  assert.equal(db.getSettings().themePreset, 'emerald_luxe');
});

test('Phase 2B — 8. Backup and restore preserves habitRoutines, canonical checksums, XP, achievements, and falls back if restored theme is locked', () => {
  const db = createCleanDb(true);

  // Complete a project to unlock first_project (+100 XP -> Level 2) and emerald_luxe theme
  db.saveProject({
    id: 'p_backup_1',
    name: 'Backup Project',
    description: '',
    color: '#1B6B4A',
    icon: 'Folder',
    status: 'completed',
    milestones: [{ id: 'm1', title: 'Ship', completed: true }],
    createdAt: '2026-10-25T00:00:00Z',
    updatedAt: '2026-10-25T00:00:00Z',
  });
  db.updateSettings({ themePreset: 'emerald_luxe' });

  const archive = db.exportArchive();
  assert.equal(archive.manifest.recordCounts.habitRoutines, 1);
  assert.equal(archive.data.settings?.themePreset, 'emerald_luxe');

  // Re-ordering keys / pretty-printing JSON still passes checksum validation
  const reorderedData: Record<string, unknown> = {};
  for (const key of Object.keys(archive.data).reverse()) {
    reorderedData[key] = (archive.data as unknown as Record<string, unknown>)[key];
  }
  const prettyPrinted = JSON.parse(
    JSON.stringify({ manifest: archive.manifest, data: reorderedData }, null, 2)
  );
  const validPretty = validateBackupArchive(prettyPrinted);
  assert.equal(validPretty.valid, true);

  // Tampering with XP in the archive fails checksum validation
  const tampered = JSON.parse(JSON.stringify(archive));
  tampered.data.xpLedger[0].xp = 99999;
  const tamperedValidation = validateBackupArchive(tampered);
  assert.equal(tamperedValidation.valid, false);
  assert.ok(tamperedValidation.errors.some(e => e.includes('checksum')));

  // Restoring valid archive into a fresh DB preserves XP, achievements, routines, and eligible theme
  const restoredDb = createCleanDb(true);
  const restoreRes = restoredDb.restoreArchive(archive);
  assert.equal(restoreRes.success, true);
  assert.equal(restoredDb.getTotalXp(), db.getTotalXp());
  assert.equal(restoredDb.getHabitRoutines().length, 1);
  assert.equal(restoredDb.getSettings().themePreset, 'emerald_luxe');
  assert.deepEqual(restoredDb.getSettings().claimedLevelRewards, [2]);

  // If an archive has a locked theme (e.g. 'aurora' while user is only Level 2), restore falls back safely to 'warm_paper'
  const snapshotWithLockedTheme = {
    ...db.getSnapshot(),
    settings: {
      ...db.getSettings(),
      themePreset: 'aurora' as const,
    },
  };
  const archiveWithLockedTheme = createBackupArchive('Daycraft', snapshotWithLockedTheme, 1);
  const fallbackDb = createCleanDb(true);
  const fallbackRes = fallbackDb.restoreArchive(archiveWithLockedTheme);
  assert.equal(fallbackRes.success, true);
  assert.equal(fallbackDb.getSettings().themePreset, 'warm_paper');
  assert.equal(
    resolveEligibleThemePreset('aurora', fallbackDb.getThemeUnlockContext()),
    'warm_paper'
  );
  assert.ok(serializeCanonicalJson(snapshotWithLockedTheme).length > 0);
});
