import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getInitialSeedData } from '../src/database/initialSeed';
import { db, RESET_CONFIRMATION_PHRASE } from '../src/database/db';
import { calculateLevel } from '../src/services/gamificationService';
import { getSevenDayCompletionData } from '../src/services/completionAnalyticsService';
import {
  TUTORIAL_TOPICS,
  TutorialManager,
  tutorialManager,
  validateTutorialCatalogIntegrity,
  FRESH_START_EMPTY_STATES,
} from '../src/services/tutorialService';
import {
  NAV_ITEMS,
  isValidDestination,
  navigationManager,
} from '../src/components/navigationState';
import { getThemeUnlockStatus } from '../src/theme/tokens';

describe('PART F.13 — Fresh-Install Experience Tests', () => {
  beforeEach(() => {
    db.resetAllData();
  });

  it('1. Fresh install starts with empty personal collections (no tasks, habits, goals, sessions, journal, or wellness entries)', () => {
    const initial = getInitialSeedData();
    assert.equal(initial.tasks.length, 0);
    assert.equal(initial.projects.length, 0);
    assert.equal(initial.habits.length, 0);
    assert.equal(initial.habitOccurrences.length, 0);
    assert.equal(initial.habitRoutines.length, 0);
    assert.equal(initial.goals.length, 0);
    assert.equal(initial.calendarEvents.length, 0);
    assert.equal(initial.timeBlocks.length, 0);
    assert.equal(initial.focusSessions.length, 0);
    assert.equal(initial.studySubjects.length, 0);
    assert.equal(initial.studySessions.length, 0);
    assert.equal(initial.wellnessEntries.length, 0);
    assert.equal(initial.journalEntries.length, 0);

    // Non-personal configuration and metric definitions remain intact
    assert.ok(initial.wellnessTrackers.length > 0);
    assert.equal(initial.defaultSettings.appName, 'Daycraft');
    assert.equal(db.hasPersonalActivity(), false);
  });

  it('2. Fresh install starts with zero completed tasks, zero completed goals, and zero habit streaks', () => {
    assert.equal(db.getTasks().filter(t => t.status === 'completed').length, 0);
    assert.equal(db.getGoals().filter(g => g.status === 'achieved' || Boolean(g.achievedAt)).length, 0);
    assert.equal(db.getHabitOccurrences().filter(o => o.status === 'completed').length, 0);
  });

  it('3. Fresh install starts with zero earned XP and Level 1', () => {
    const totalXp = db.getTotalXp();
    assert.equal(totalXp, 0);
    assert.equal(db.getXpLedger().length, 0);

    const levelInfo = calculateLevel(totalXp);
    assert.equal(levelInfo.level, 1);
    assert.equal(levelInfo.currentLevelXp, 0);
    assert.equal(levelInfo.progressPercent, 0);
  });

  it('4. Fresh install starts with all user achievements locked while keeping achievement definitions', () => {
    const achievements = db.getAchievements();
    assert.ok(achievements.length >= 19, 'Expected full catalog of 19 achievement definitions');
    for (const ach of achievements) {
      assert.equal(ach.unlockedAt, undefined, `Expected achievement ${ach.id} to start locked`);
      assert.equal(ach.progress, 0, `Expected achievement ${ach.id} to start at 0% progress`);
    }
    assert.equal(db.getUnseenAchievementIds().length, 0);
  });

  it('5. Fresh install starts with locked progression themes still locked while base themes are unlocked', () => {
    const unlockCtx = db.getThemeUnlockContext();
    assert.equal(unlockCtx.level, 1);
    const unlockedIds = Array.from(unlockCtx.unlockedAchievementIds);
    assert.equal(unlockedIds.length, 0);

    // Base themes are unlocked by default
    assert.equal(getThemeUnlockStatus('warm_paper', unlockCtx).unlocked, true);
    assert.equal(getThemeUnlockStatus('sage_garden', unlockCtx).unlocked, true);
    assert.equal(getThemeUnlockStatus('monochrome', unlockCtx).unlocked, true);

    // Progression themes are locked on a fresh install
    assert.equal(getThemeUnlockStatus('midnight', unlockCtx).unlocked, false);
    assert.equal(getThemeUnlockStatus('lavender_haze', unlockCtx).unlocked, false);
    assert.equal(getThemeUnlockStatus('aurora', unlockCtx).unlocked, false);
    assert.equal(getThemeUnlockStatus('emerald_luxe', unlockCtx).unlocked, false);
    assert.equal(getThemeUnlockStatus('solar_gold', unlockCtx).unlocked, false);
    assert.equal(getThemeUnlockStatus('sunset', unlockCtx).unlocked, false);
  });

  it('6. Dashboard and Insights render clean empty states and 0% metrics without crashing', () => {
    const summary = getSevenDayCompletionData(
      db.getTasks(),
      db.getHabits(),
      db.getHabitOccurrences()
    );
    assert.equal(summary.totalTasks, 0);
    assert.equal(summary.totalHabits, 0);
    assert.equal(summary.grandTotal, 0);
    assert.equal(summary.dailyAverage, 0);

    // Verify all Fresh-Start empty state definitions exist with non-empty copy and CTAs
    assert.equal(FRESH_START_EMPTY_STATES.tasks.headline, 'Nothing on your list yet.');
    assert.equal(FRESH_START_EMPTY_STATES.habits.headline, 'Start with one small habit.');
    assert.equal(FRESH_START_EMPTY_STATES.goals.headline, 'What would you like to work toward?');
    assert.equal(FRESH_START_EMPTY_STATES.focus.headline, 'Your next focus session starts here.');
    assert.equal(
      FRESH_START_EMPTY_STATES.insights.headline,
      'Insights will appear as you build your history.'
    );
  });
});

describe('PART F.14 — Safe Reset Personal Data Workflow Tests', () => {
  beforeEach(() => {
    db.resetAllData();
    tutorialManager.resetAllTutorialProgress();
  });

  it('7. Reset requires confirmation and does not execute when canceled or unconfirmed', () => {
    db.saveTask({
      id: 't_keep',
      title: 'Important task',
      description: '',
      status: 'todo',
      priority: 'high',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archived: false,
    });
    assert.equal(db.getTasks().length, 1);

    // Attempt reset with confirmed: false
    const canceledResult = db.resetPersonalData({ confirmed: false });
    assert.equal(canceledResult.success, false);
    assert.equal(db.getTasks().length, 1);

    // Attempt reset with wrong confirmation phrase
    const wrongPhraseResult = db.resetPersonalData({
      confirmed: true,
      confirmationText: 'DELETE',
    });
    assert.equal(wrongPhraseResult.success, false);
    assert.equal(db.getTasks().length, 1);
  });

  it('8–12. Confirmed reset clears tasks, habits, goals, sessions, journal, wellness entries, XP, levels, and unlocked achievements', () => {
    // Populate personal data across collections
    db.saveTask({
      id: 't_done',
      title: 'Completed task',
      description: '',
      status: 'completed',
      completedAt: new Date().toISOString(),
      priority: 'high',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archived: false,
    });
    db.saveHabit({
      id: 'h_1',
      name: 'Morning Walk',
      description: '',
      category: 'Movement',
      startDate: '2026-10-28',
      scheduleType: 'daily',
      targetType: 'boolean',
      targetValue: 1,
      targetUnit: 'walk',
      color: '#3D5E45',
      icon: 'Flame',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archived: false,
    });
    db.recordHabitOccurrence({
      id: 'occ_1',
      habitId: 'h_1',
      date: '2026-10-28',
      recordedValue: 1,
      targetValue: 1,
      status: 'completed',
      completedAt: new Date().toISOString(),
    });
    db.saveGoal({
      id: 'g_1',
      title: 'Ship Release',
      description: '',
      category: 'Career',
      color: '#3E7051',
      startDate: '2026-10-01',
      targetDate: '2026-11-01',
      isMeasurable: false,
      milestones: [{ id: 'm1', title: 'Step 1', completed: true }],
      linkedHabitIds: [],
      linkedProjectIds: [],
      status: 'achieved',
      achievedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    db.recordFocusSession({
      id: 'fs_1',
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      durationMinutes: 25,
      type: 'focus',
      completed: true,
    });
    db.saveJournalEntry({
      id: 'j_1',
      date: '2026-10-28',
      title: 'Reflection',
      content: 'Great progress today.',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    db.recordWellnessEntry({
      id: 'we_1',
      trackerId: 'wt_water',
      date: '2026-10-28',
      value: 2000,
      recordedAt: new Date().toISOString(),
    });

    assert.equal(db.hasPersonalActivity(), true);
    assert.ok(db.getTotalXp() > 0);
    assert.ok(db.getAchievements().some(a => Boolean(a.unlockedAt)));

    // Execute confirmed reset
    const res = db.resetPersonalData({
      confirmed: true,
      confirmationText: RESET_CONFIRMATION_PHRASE,
    });
    assert.equal(res.success, true);
    assert.ok(res.clearedCounts.tasks >= 1);
    assert.ok(res.clearedCounts.habits >= 1);
    assert.ok(res.clearedCounts.goals >= 1);
    assert.ok(res.clearedCounts.focusSessions >= 1);
    assert.ok(res.clearedCounts.journalEntries >= 1);
    assert.ok(res.clearedCounts.wellnessEntries >= 1);

    // Verify all personal collections are empty
    assert.equal(db.getTasks().length, 0);
    assert.equal(db.getHabits().length, 0);
    assert.equal(db.getHabitOccurrences().length, 0);
    assert.equal(db.getGoals().length, 0);
    assert.equal(db.getFocusSessions().length, 0);
    assert.equal(db.getJournalEntries().length, 0);
    assert.equal(db.getWellnessEntries().length, 0);
    assert.equal(db.getTotalXp(), 0);
    assert.equal(calculateLevel(db.getTotalXp()).level, 1);
    assert.equal(db.getAchievements().every(a => !a.unlockedAt && a.progress === 0), true);
    assert.equal(db.hasPersonalActivity(), false);
  });

  it('13–15. Confirmed reset re-locks progression themes, reverts ineligible equipped theme to warm_paper, preserves eligible preferences, and leaves app usable immediately', () => {
    // Equip a base theme and dark mode, plus complete a tutorial
    db.updateSettings({ themePreset: 'sage_garden', themeMode: 'dark' });
    tutorialManager.startTutorial('getting_started');
    tutorialManager.finishTutorial();
    assert.equal(tutorialManager.isTopicCompleted('getting_started'), true);

    const res = db.resetPersonalData({
      confirmed: true,
      confirmationText: 'reset',
      preserveThemePreferences: true,
      preserveTutorialProgress: true,
    });
    assert.equal(res.success, true);
    assert.equal(db.getSettings().themePreset, 'sage_garden');
    assert.equal(db.getSettings().themeMode, 'dark');
    assert.equal(tutorialManager.isTopicCompleted('getting_started'), true);

    // Now earn Level 2 XP to legitimately unlock and equip 'midnight', then verify reset reverts it to 'warm_paper'
    for (let i = 0; i < 6; i++) {
      db.saveGoal({
        id: `g_lvl_${i}`,
        title: `Goal ${i}`,
        description: '',
        category: 'Growth',
        color: '#3D5E45',
        startDate: '2026-10-01',
        targetDate: '2026-12-31',
        isMeasurable: true,
        status: 'achieved',
        achievedAt: new Date().toISOString(),
        targetValue: 1,
        currentValue: 1,
        unit: 'milestone',
        milestones: [],
        linkedHabitIds: [],
        linkedProjectIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    assert.equal(db.isThemeEligible('midnight'), true);
    db.updateSettings({ themePreset: 'midnight' });
    assert.equal(db.getSettings().themePreset, 'midnight');

    db.resetPersonalData({
      confirmed: true,
      confirmationText: 'RESET',
      preserveThemePreferences: true,
      preserveTutorialProgress: false,
    });
    assert.equal(db.isThemeEligible('midnight'), false);
    assert.equal(db.getSettings().themePreset, 'warm_paper');
    assert.equal(tutorialManager.isTopicCompleted('getting_started'), false);

    // Verify database remains immediately usable after reset
    const outcome = db.saveTask({
      id: 't_after_reset',
      title: 'First task after reset',
      description: '',
      status: 'completed',
      completedAt: new Date().toISOString(),
      priority: 'medium',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archived: false,
    });
    assert.equal(db.getTasks().length, 1);
    assert.ok(outcome.xpAwarded > 0);
  });
});

describe('PART F.15 — Permanent App Tutorial & Interactive Walkthrough Tests', () => {
  beforeEach(() => {
    tutorialManager.resetAllTutorialProgress();
  });

  it('16–18. App Tutorial appears in navigation immediately above Settings and supports state routing', () => {
    const tutorialIndex = NAV_ITEMS.findIndex(item => item.id === 'tutorial');
    const settingsIndex = NAV_ITEMS.findIndex(item => item.id === 'settings');

    assert.ok(tutorialIndex !== -1, 'Expected tutorial item in NAV_ITEMS');
    assert.ok(settingsIndex !== -1, 'Expected settings item in NAV_ITEMS');
    assert.equal(
      tutorialIndex,
      settingsIndex - 1,
      'Expected App Tutorial to be positioned immediately above Settings'
    );
    assert.equal(NAV_ITEMS[tutorialIndex].label, 'App Tutorial');
    assert.equal(isValidDestination('tutorial'), true);

    navigationManager.setView('tutorial', { syncHistory: false });
    assert.equal(navigationManager.getCurrentView(), 'tutorial');
  });

  it('19–22. All 9 required tutorial topics exist, can be started, stepped Next/Back, Skipped, Finished, and Restarted', () => {
    const requiredIds = [
      'getting_started',
      'tasks_myday',
      'habits_routines',
      'goals_milestones',
      'focus_mode',
      'achievements_themes',
      'calendar_projects_study',
      'wellness_journal_insights',
      'settings_privacy_backups',
    ] as const;

    assert.equal(TUTORIAL_TOPICS.length, requiredIds.length);
    for (const id of requiredIds) {
      const topic = TUTORIAL_TOPICS.find(t => t.id === id);
      assert.ok(topic, `Missing required tutorial topic: ${id}`);
      assert.ok(topic.steps.length >= 3, `Expected at least 3 steps for topic ${id}`);
    }

    const mgr = new TutorialManager(false);
    mgr.resetAllTutorialProgress();

    // Start 'tasks_myday'
    mgr.startTutorial('tasks_myday');
    assert.equal(mgr.getActiveSession()?.topicId, 'tasks_myday');
    assert.equal(mgr.getActiveSession()?.stepIndex, 0);

    // Next step
    mgr.nextStep();
    assert.equal(mgr.getActiveSession()?.stepIndex, 1);

    // Previous step
    mgr.prevStep();
    assert.equal(mgr.getActiveSession()?.stepIndex, 0);

    // Skip tutorial closes walkthrough without marking completed
    mgr.skipTutorial();
    assert.equal(mgr.getActiveSession(), null);
    assert.equal(mgr.isTopicCompleted('tasks_myday'), false);

    // Finish tutorial marks topic completed
    mgr.startTutorial('tasks_myday');
    mgr.finishTutorial();
    assert.equal(mgr.isTopicCompleted('tasks_myday'), true);
    assert.equal(mgr.getActiveSession(), null);

    // Restart tutorial clears completion and starts at step 0
    mgr.restartTutorial('tasks_myday');
    assert.equal(mgr.isTopicCompleted('tasks_myday'), false);
    assert.equal(mgr.getActiveSession()?.topicId, 'tasks_myday');
    assert.equal(mgr.getActiveSession()?.stepIndex, 0);
  });

  it('23–24. Tutorial completion state persists and Tutorial catalog contains zero AI Companion references', () => {
    const mgr = new TutorialManager(false);
    mgr.resetAllTutorialProgress();
    mgr.startTutorial('focus_mode');
    mgr.finishTutorial();
    assert.equal(mgr.isTopicCompleted('focus_mode'), true);
    assert.equal(mgr.getCompletionSummary().completedCount, 1);

    // Validate catalog integrity (no AI references, valid destinations)
    const validation = validateTutorialCatalogIntegrity();
    assert.equal(validation.valid, true, `Errors found: ${validation.errors.join('; ')}`);
  });
});
