// ==========================================
// DAYCRAFT — LOCAL DATABASE & REPOSITORY
// Versioned, transaction-safe local persistence with migration & subscriber support
// ==========================================

import {
  Achievement,
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
import {
  computeDataChecksum,
  createBackupArchive,
  DaycraftBackupArchive,
  DaycraftBackupData,
  validateBackupArchive,
} from '../services/backupService';
import {
  buildRewardKey,
  calculateLevel,
  evaluateAchievements,
  evaluateLevelProgression,
  INITIAL_ACHIEVEMENTS,
  isEligibleForHabitXp,
  isXpAlreadyAwarded,
  LevelMilestoneReward,
  XP_VALUES,
} from '../services/gamificationService';
import { calculateHabitStreak, formatLocalDate } from '../services/streakService';
import {
  getNewlyUnlockedThemes,
  isThemeUnlocked,
  PresetDefinition,
  resolveEligibleThemePreset,
  ThemePresetKey,
  ThemeUnlockContext,
} from '../theme/tokens';
import { DEFAULT_WELLNESS_TRACKERS, getInitialSeedData } from './initialSeed';
import { tutorialManager } from '../services/tutorialService';

const DB_STORAGE_KEY = 'daycraft_database_v1';
const SCHEMA_VERSION = 1;
export const RESET_CONFIRMATION_PHRASE = 'RESET';

export interface ResetPersonalDataOptions {
  confirmed: boolean;
  confirmationText?: string;
  preserveThemePreferences?: boolean;
  preserveTutorialProgress?: boolean;
}

export interface ResetPersonalDataResult {
  success: boolean;
  error?: string;
  clearedCounts: {
    tasks: number;
    habits: number;
    habitOccurrences: number;
    habitRoutines: number;
    projects: number;
    goals: number;
    calendarEvents: number;
    timeBlocks: number;
    focusSessions: number;
    studySubjects: number;
    studySessions: number;
    wellnessEntries: number;
    journalEntries: number;
    xpLedger: number;
  };
}

export interface LevelUpEvent {
  previousLevel: number;
  newLevel: number;
  crossedLevels: number[];
  newlyClaimedRewards: LevelMilestoneReward[];
  newlyUnlockedThemes: PresetDefinition[];
}

type Listener = () => void;
type AchievementUnlockListener = (achievements: Achievement[]) => void;
type LevelUpListener = (event: LevelUpEvent) => void;

export interface RewardOutcome {
  xpAwarded: number;
  achievementXpAwarded: number;
  newlyUnlockedAchievements: Achievement[];
  previousLevel?: number;
  newLevel?: number;
  leveledUp?: boolean;
  crossedLevels?: number[];
  newlyClaimedLevelRewards?: LevelMilestoneReward[];
  newlyUnlockedThemes?: PresetDefinition[];
}

const EMPTY_REWARD_OUTCOME: RewardOutcome = {
  xpAwarded: 0,
  achievementXpAwarded: 0,
  newlyUnlockedAchievements: [],
  previousLevel: 1,
  newLevel: 1,
  leveledUp: false,
  crossedLevels: [],
  newlyClaimedLevelRewards: [],
  newlyUnlockedThemes: [],
};

function isValidTimestampString(val: unknown): val is string {
  if (typeof val !== 'string' || val.trim().length === 0) return false;
  return !Number.isNaN(new Date(val).getTime());
}

function normalizeGoals(rawGoals: unknown): Goal[] {
  if (!Array.isArray(rawGoals)) return [];
  const validStatuses = new Set(['active', 'paused', 'achieved', 'archived']);
  const result: Goal[] = [];

  for (const item of rawGoals) {
    if (!item || typeof item !== 'object') continue;
    const g = item as Record<string, unknown>;
    if (typeof g.id !== 'string' || !g.id) continue;

    const status =
      typeof g.status === 'string' && validStatuses.has(g.status)
        ? (g.status as Goal['status'])
        : 'active';

    const achievedAt = isValidTimestampString(g.achievedAt) ? g.achievedAt : undefined;

    result.push({
      id: g.id,
      title: typeof g.title === 'string' ? g.title : 'Untitled Goal',
      description: typeof g.description === 'string' ? g.description : '',
      category: typeof g.category === 'string' ? g.category : 'Personal Growth',
      color: typeof g.color === 'string' ? g.color : '#3E7051',
      startDate: typeof g.startDate === 'string' ? g.startDate : formatLocalDate(new Date()),
      targetDate: typeof g.targetDate === 'string' ? g.targetDate : formatLocalDate(new Date()),
      status,
      isMeasurable: Boolean(g.isMeasurable),
      targetValue:
        typeof g.targetValue === 'number' && Number.isFinite(g.targetValue)
          ? g.targetValue
          : undefined,
      currentValue:
        typeof g.currentValue === 'number' && Number.isFinite(g.currentValue)
          ? g.currentValue
          : undefined,
      unit: typeof g.unit === 'string' ? g.unit : undefined,
      linkedProjectIds: Array.isArray(g.linkedProjectIds)
        ? g.linkedProjectIds.filter((id): id is string => typeof id === 'string')
        : [],
      linkedHabitIds: Array.isArray(g.linkedHabitIds)
        ? g.linkedHabitIds.filter((id): id is string => typeof id === 'string')
        : [],
      milestones: Array.isArray(g.milestones)
        ? g.milestones
            .filter((m): m is Record<string, unknown> => Boolean(m && typeof m === 'object'))
            .map((m, i) => ({
              id: typeof m.id === 'string' ? m.id : `gm_${g.id}_${i}`,
              title: typeof m.title === 'string' ? m.title : 'Milestone',
              targetDate: typeof m.targetDate === 'string' ? m.targetDate : undefined,
              completed: Boolean(m.completed),
            }))
        : [],
      notes: typeof g.notes === 'string' ? g.notes : undefined,
      achievedAt,
      createdAt: typeof g.createdAt === 'string' ? g.createdAt : new Date().toISOString(),
      updatedAt: typeof g.updatedAt === 'string' ? g.updatedAt : new Date().toISOString(),
    });
  }

  return result;
}

export class DatabaseManager {
  private schemaVersion: number = SCHEMA_VERSION;
  private tasks: Task[] = [];
  private habits: Habit[] = [];
  private habitOccurrences: HabitOccurrence[] = [];
  private projects: Project[] = [];
  private goals: Goal[] = [];
  private calendarEvents: CalendarEvent[] = [];
  private timeBlocks: TimeBlock[] = [];
  private focusSessions: FocusSession[] = [];
  private studySubjects: StudySubject[] = [];
  private studySessions: StudySession[] = [];
  private wellnessTrackers: WellnessTracker[] = [];
  private wellnessEntries: WellnessEntry[] = [];
  private journalEntries: JournalEntry[] = [];
  private habitRoutines: HabitRoutine[] = [];
  private achievements: Achievement[] = INITIAL_ACHIEVEMENTS.map(a => ({ ...a }));
  private xpLedger: XpLedgerEntry[] = [];
  private settings: UserSettings = getInitialSeedData().defaultSettings;

  private listeners: Set<Listener> = new Set();
  private achievementListeners: Set<AchievementUnlockListener> = new Set();
  private levelUpListeners: Set<LevelUpListener> = new Set();
  private isInitialized: boolean = false;

  constructor(autoInit: boolean = true) {
    if (autoInit) {
      this.init();
    }
  }

  init(): void {
    if (this.isInitialized) return;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(DB_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          this.migrateAndLoad(parsed);
          this.isInitialized = true;
          return;
        }
      }
    } catch {
      // In case of parsing error, seed initial data
    }

    this.seedInitial();
    this.isInitialized = true;
  }

  private syncClaimedLevelsAndTheme(): void {
    const levelProg = evaluateLevelProgression(
      0,
      this.getTotalXp(),
      this.settings.claimedLevelRewards || []
    );
    const eligibleTheme = resolveEligibleThemePreset(
      this.settings.themePreset,
      this.getThemeUnlockContext()
    );
    this.settings = {
      ...this.settings,
      claimedLevelRewards: levelProg.updatedClaimedLevels,
      unseenAchievementIds: Array.isArray(this.settings.unseenAchievementIds)
        ? this.settings.unseenAchievementIds
        : [],
      themePreset: eligibleTheme,
    };
  }

  private seedInitial(): void {
    const seed = getInitialSeedData();
    this.tasks = seed.tasks.map(t => ({ ...t }));
    this.habits = seed.habits.map(h => ({ ...h }));
    this.habitOccurrences = seed.habitOccurrences.map(o => ({ ...o }));
    this.habitRoutines = seed.habitRoutines.map(r => ({ ...r }));
    this.projects = seed.projects.map(p => ({ ...p, milestones: p.milestones.map(m => ({ ...m })) }));
    this.goals = seed.goals.map(g => ({ ...g, milestones: g.milestones.map(m => ({ ...m })) }));
    this.calendarEvents = seed.calendarEvents.map(e => ({ ...e }));
    this.timeBlocks = seed.timeBlocks.map(b => ({ ...b }));
    this.focusSessions = seed.focusSessions.map(s => ({ ...s }));
    this.studySubjects = seed.studySubjects.map(s => ({ ...s }));
    this.studySessions = seed.studySessions.map(s => ({ ...s }));
    this.wellnessTrackers = seed.wellnessTrackers.map(w => ({ ...w }));
    this.wellnessEntries = seed.wellnessEntries.map(w => ({ ...w }));
    this.journalEntries = seed.journalEntries.map(j => ({ ...j }));
    this.xpLedger = seed.xpLedger.map(x => ({ ...x }));
    this.settings = { ...seed.defaultSettings, claimedLevelRewards: [], unseenAchievementIds: [] };
    this.achievements = INITIAL_ACHIEVEMENTS.map(a => ({ ...a }));

    this.recalculateAchievements({ silent: true });
    this.syncClaimedLevelsAndTheme();
    this.persist();
  }

  migrateAndLoad(data: Record<string, unknown>): void {
    const storedVersion = (data.schemaVersion as number) || 1;

    if (storedVersion < 1) {
      // Migration v0 -> v1
    }

    this.schemaVersion = SCHEMA_VERSION;
    this.tasks = Array.isArray(data.tasks) ? (data.tasks as Task[]) : [];
    this.habits = Array.isArray(data.habits) ? (data.habits as Habit[]) : [];
    this.habitOccurrences = Array.isArray(data.habitOccurrences) ? (data.habitOccurrences as HabitOccurrence[]) : [];
    this.habitRoutines = Array.isArray(data.habitRoutines)
      ? (data.habitRoutines as HabitRoutine[])
      : getInitialSeedData().habitRoutines.map(r => ({ ...r }));
    this.projects = Array.isArray(data.projects) ? (data.projects as Project[]) : [];
    this.goals = normalizeGoals(data.goals);
    this.calendarEvents = Array.isArray(data.calendarEvents) ? (data.calendarEvents as CalendarEvent[]) : [];
    this.timeBlocks = Array.isArray(data.timeBlocks) ? (data.timeBlocks as TimeBlock[]) : [];
    this.focusSessions = Array.isArray(data.focusSessions) ? (data.focusSessions as FocusSession[]) : [];
    this.studySubjects = Array.isArray(data.studySubjects) ? (data.studySubjects as StudySubject[]) : [];
    this.studySessions = Array.isArray(data.studySessions) ? (data.studySessions as StudySession[]) : [];
    this.wellnessTrackers =
      Array.isArray(data.wellnessTrackers) && data.wellnessTrackers.length > 0
        ? (data.wellnessTrackers as WellnessTracker[])
        : DEFAULT_WELLNESS_TRACKERS.map(w => ({ ...w }));
    this.wellnessEntries = Array.isArray(data.wellnessEntries) ? (data.wellnessEntries as WellnessEntry[]) : [];
    this.journalEntries = Array.isArray(data.journalEntries) ? (data.journalEntries as JournalEntry[]) : [];
    this.achievements =
      Array.isArray(data.achievements) && data.achievements.length > 0
        ? (data.achievements as Achievement[])
        : INITIAL_ACHIEVEMENTS.map(a => ({ ...a }));
    this.xpLedger = Array.isArray(data.xpLedger) ? (data.xpLedger as XpLedgerEntry[]) : [];
    this.settings = (data.settings as UserSettings)
      ? { ...getInitialSeedData().defaultSettings, ...(data.settings as UserSettings) }
      : { ...getInitialSeedData().defaultSettings };

    this.recalculateAchievements({ silent: true });
    this.syncClaimedLevelsAndTheme();
  }

  private persist(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const payload = {
          schemaVersion: this.schemaVersion,
          tasks: this.tasks,
          habits: this.habits,
          habitOccurrences: this.habitOccurrences,
          habitRoutines: this.habitRoutines,
          projects: this.projects,
          goals: this.goals,
          calendarEvents: this.calendarEvents,
          timeBlocks: this.timeBlocks,
          focusSessions: this.focusSessions,
          studySubjects: this.studySubjects,
          studySessions: this.studySessions,
          wellnessTrackers: this.wellnessTrackers,
          wellnessEntries: this.wellnessEntries,
          journalEntries: this.journalEntries,
          achievements: this.achievements,
          xpLedger: this.xpLedger,
          settings: this.settings,
        };
        window.localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // storage error
      }
    }
    this.notify();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeAchievementUnlocks(listener: AchievementUnlockListener): () => void {
    this.achievementListeners.add(listener);
    return () => this.achievementListeners.delete(listener);
  }

  subscribeLevelUps(listener: LevelUpListener): () => void {
    this.levelUpListeners.add(listener);
    return () => this.levelUpListeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(fn => fn());
  }

  private notifyAchievementUnlocks(unlocked: Achievement[]): void {
    if (unlocked.length === 0 || !this.settings.gamificationEnabled) return;
    this.achievementListeners.forEach(fn => fn(unlocked));
  }

  private notifyLevelUp(event: LevelUpEvent): void {
    if (!this.settings.gamificationEnabled) return;
    this.levelUpListeners.forEach(fn => fn(event));
  }

  private finalizeProgressionAndPersist(
    xpAwarded: number,
    previousTotalXp: number,
    previousUnlockedIds: Set<string>,
    options?: { silent?: boolean }
  ): RewardOutcome {
    const { newlyUnlocked, achievementXpAwarded } = this.recalculateAchievements(options);
    const nextTotalXp = this.getTotalXp();
    const levelProg = evaluateLevelProgression(
      previousTotalXp,
      nextTotalXp,
      this.settings.claimedLevelRewards || []
    );

    if (this.settings.gamificationEnabled) {
      this.settings = {
        ...this.settings,
        claimedLevelRewards: levelProg.updatedClaimedLevels,
      };
    }

    const newlyUnlockedThemes = this.settings.gamificationEnabled
      ? getNewlyUnlockedThemes(
          { level: levelProg.previousLevel, unlockedAchievementIds: previousUnlockedIds },
          { level: levelProg.newLevel, unlockedAchievementIds: this.getUnlockedAchievementIds() }
        )
      : [];

    if (!options?.silent && this.settings.gamificationEnabled && levelProg.leveledUp) {
      this.notifyLevelUp({
        previousLevel: levelProg.previousLevel,
        newLevel: levelProg.newLevel,
        crossedLevels: levelProg.crossedLevels,
        newlyClaimedRewards: levelProg.newlyClaimedRewards,
        newlyUnlockedThemes,
      });
    }

    this.persist();

    return {
      xpAwarded,
      achievementXpAwarded,
      newlyUnlockedAchievements: newlyUnlocked,
      previousLevel: levelProg.previousLevel,
      newLevel: levelProg.newLevel,
      leveledUp: this.settings.gamificationEnabled ? levelProg.leveledUp : false,
      crossedLevels: this.settings.gamificationEnabled ? levelProg.crossedLevels : [],
      newlyClaimedLevelRewards: this.settings.gamificationEnabled ? levelProg.newlyClaimedRewards : [],
      newlyUnlockedThemes,
    };
  }

  private recalculateAchievements(options?: { silent?: boolean }): {
    newlyUnlocked: Achievement[];
    achievementXpAwarded: number;
  } {
    const completedTasksCount = this.tasks.filter(t => t.status === 'completed').length;
    const totalFocusMinutes = this.focusSessions
      .filter(s => s.completed)
      .reduce((acc, s) => acc + s.durationMinutes, 0);
    const totalStudySessions = this.studySessions.length;
    const totalJournalEntries = this.journalEntries.length;
    const completedProjectsCount = this.projects.filter(
      p =>
        p.status === 'completed' ||
        (p.status !== 'archived' &&
          Array.isArray(p.milestones) &&
          p.milestones.length > 0 &&
          p.milestones.every(m => m.completed))
    ).length;
    const completedRoutinesCount = this.habitRoutines.reduce(
      (acc, r) => acc + (r.completionsCount || 0),
      0
    );

    const calculatedMaxStreak = this.habits.reduce((max, h) => {
      const stats = calculateHabitStreak(h, this.habitOccurrences);
      return Math.max(max, stats.longestStreak, stats.currentStreak);
    }, 0);

    if (!this.settings.gamificationEnabled) {
      const { updatedAchievements } = evaluateAchievements(
        this.achievements,
        {
          completedTasksCount,
          maxHabitStreak: calculatedMaxStreak,
          totalFocusMinutes,
          totalStudySessions,
          totalJournalEntries,
          completedProjectsCount,
          completedRoutinesCount,
        },
        { readOnly: true }
      );
      this.achievements = updatedAchievements;
      return {
        newlyUnlocked: [],
        achievementXpAwarded: 0,
      };
    }

    const { updatedAchievements, newlyUnlocked } = evaluateAchievements(this.achievements, {
      completedTasksCount,
      maxHabitStreak: calculatedMaxStreak,
      totalFocusMinutes,
      totalStudySessions,
      totalJournalEntries,
      completedProjectsCount,
      completedRoutinesCount,
    });

    this.achievements = updatedAchievements;

    let achievementXpAwarded = 0;
    const rewardedAchievements: Achievement[] = [];

    for (const ach of newlyUnlocked) {
      if (!isXpAlreadyAwarded(this.xpLedger, 'achievement_unlocked', ach.id)) {
        this.xpLedger.push({
          id: `xp_ach_${Date.now()}_${ach.id}`,
          timestamp: new Date().toISOString(),
          xp: ach.xpReward,
          sourceType: 'achievement_unlocked',
          sourceId: ach.id,
          rewardKey: buildRewardKey('achievement_unlocked', ach.id),
          description: `Unlocked milestone badge: ${ach.title}`,
        });
        achievementXpAwarded += ach.xpReward;
        rewardedAchievements.push(ach);
      }
    }

    if (!options?.silent && rewardedAchievements.length > 0) {
      const existingUnseen = new Set(this.settings.unseenAchievementIds || []);
      for (const ach of rewardedAchievements) {
        existingUnseen.add(ach.id);
      }
      this.settings = {
        ...this.settings,
        unseenAchievementIds: Array.from(existingUnseen),
      };
      this.notifyAchievementUnlocks(rewardedAchievements);
    }

    return {
      newlyUnlocked: rewardedAchievements,
      achievementXpAwarded,
    };
  }

  // --- Snapshot Export ---
  getSnapshot(): DaycraftBackupData {
    return {
      tasks: [...this.tasks],
      habits: [...this.habits],
      habitOccurrences: [...this.habitOccurrences],
      habitRoutines: [...this.habitRoutines],
      projects: [...this.projects],
      goals: [...this.goals],
      calendarEvents: [...this.calendarEvents],
      timeBlocks: [...this.timeBlocks],
      focusSessions: [...this.focusSessions],
      studySubjects: [...this.studySubjects],
      studySessions: [...this.studySessions],
      wellnessTrackers: [...this.wellnessTrackers],
      wellnessEntries: [...this.wellnessEntries],
      journalEntries: [...this.journalEntries],
      achievements: [...this.achievements],
      xpLedger: [...this.xpLedger],
      settings: { ...this.settings },
    };
  }

  exportArchive(): DaycraftBackupArchive {
    return createBackupArchive(this.settings.appName || 'Daycraft', this.getSnapshot(), this.schemaVersion);
  }

  restoreArchive(rawArchive: unknown): { success: boolean; errors: string[] } {
    const validation = validateBackupArchive(rawArchive);
    if (!validation.valid || !validation.data) {
      return { success: false, errors: validation.errors };
    }

    const d = validation.data;
    this.tasks = d.tasks.map(t => ({ ...t }));
    this.habits = d.habits.map(h => ({ ...h }));
    this.habitOccurrences = d.habitOccurrences.map(o => ({ ...o }));
    this.habitRoutines = Array.isArray(d.habitRoutines)
      ? d.habitRoutines.map(r => ({ ...r }))
      : [];
    this.projects = d.projects.map(p => ({ ...p }));
    this.goals = normalizeGoals(d.goals);
    this.calendarEvents = d.calendarEvents.map(e => ({ ...e }));
    this.timeBlocks = d.timeBlocks.map(b => ({ ...b }));
    this.focusSessions = d.focusSessions.map(s => ({ ...s }));
    this.studySubjects = d.studySubjects.map(s => ({ ...s }));
    this.studySessions = d.studySessions.map(s => ({ ...s }));
    this.wellnessTrackers = d.wellnessTrackers.map(w => ({ ...w }));
    this.wellnessEntries = d.wellnessEntries.map(w => ({ ...w }));
    this.journalEntries = d.journalEntries.map(j => ({ ...j }));
    this.achievements = d.achievements.map(a => ({ ...a }));
    this.xpLedger = d.xpLedger.map(x => ({ ...x }));
    if (d.settings) {
      this.settings = { ...getInitialSeedData().defaultSettings, ...d.settings };
    }

    this.recalculateAchievements({ silent: true });
    this.syncClaimedLevelsAndTheme();

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem('daycraft_theme_preset', this.settings.themePreset);
        if (this.settings.themeMode) {
          window.localStorage.setItem('daycraft_theme_mode', this.settings.themeMode);
        }
      } catch {
        // ignore storage error
      }
    }

    this.persist();
    return { success: true, errors: [] };
  }

  hasPersonalActivity(): boolean {
    return (
      this.tasks.length > 0 ||
      this.habits.length > 0 ||
      this.habitOccurrences.length > 0 ||
      this.habitRoutines.length > 0 ||
      this.projects.length > 0 ||
      this.goals.length > 0 ||
      this.calendarEvents.length > 0 ||
      this.timeBlocks.length > 0 ||
      this.focusSessions.length > 0 ||
      this.studySubjects.length > 0 ||
      this.studySessions.length > 0 ||
      this.wellnessEntries.length > 0 ||
      this.journalEntries.length > 0 ||
      this.xpLedger.length > 0 ||
      this.achievements.some(a => Boolean(a.unlockedAt))
    );
  }

  resetPersonalData(options: ResetPersonalDataOptions): ResetPersonalDataResult {
    const emptyCounts = {
      tasks: 0,
      habits: 0,
      habitOccurrences: 0,
      habitRoutines: 0,
      projects: 0,
      goals: 0,
      calendarEvents: 0,
      timeBlocks: 0,
      focusSessions: 0,
      studySubjects: 0,
      studySessions: 0,
      wellnessEntries: 0,
      journalEntries: 0,
      xpLedger: 0,
    };

    if (!options || options.confirmed !== true) {
      return {
        success: false,
        error: 'Explicit confirmation is required before resetting personal data.',
        clearedCounts: emptyCounts,
      };
    }

    if (
      options.confirmationText !== undefined &&
      options.confirmationText.trim().toUpperCase() !== RESET_CONFIRMATION_PHRASE
    ) {
      return {
        success: false,
        error: `Please type "${RESET_CONFIRMATION_PHRASE}" to confirm erasing personal data.`,
        clearedCounts: emptyCounts,
      };
    }

    const clearedCounts = {
      tasks: this.tasks.length,
      habits: this.habits.length,
      habitOccurrences: this.habitOccurrences.length,
      habitRoutines: this.habitRoutines.length,
      projects: this.projects.length,
      goals: this.goals.length,
      calendarEvents: this.calendarEvents.length,
      timeBlocks: this.timeBlocks.length,
      focusSessions: this.focusSessions.length,
      studySubjects: this.studySubjects.length,
      studySessions: this.studySessions.length,
      wellnessEntries: this.wellnessEntries.length,
      journalEntries: this.journalEntries.length,
      xpLedger: this.xpLedger.length,
    };

    const preserveTheme = options.preserveThemePreferences ?? true;
    const preserveTutorial = options.preserveTutorialProgress ?? true;
    const currentSettings = { ...this.settings };
    const defaultSettings = getInitialSeedData().defaultSettings;

    // Clear all personal collections
    this.tasks = [];
    this.habits = [];
    this.habitOccurrences = [];
    this.habitRoutines = [];
    this.projects = [];
    this.goals = [];
    this.calendarEvents = [];
    this.timeBlocks = [];
    this.focusSessions = [];
    this.studySubjects = [];
    this.studySessions = [];
    this.wellnessEntries = [];
    this.journalEntries = [];
    this.xpLedger = [];
    this.wellnessTrackers = DEFAULT_WELLNESS_TRACKERS.map(w => ({ ...w }));
    this.achievements = INITIAL_ACHIEVEMENTS.map(a => ({
      ...a,
      unlockedAt: undefined,
      current: 0,
      progress: 0,
    }));

    const cleanUnlockContext: ThemeUnlockContext = {
      level: 1,
      unlockedAchievementIds: new Set<string>(),
    };

    const nextThemePreset = preserveTheme
      ? resolveEligibleThemePreset(currentSettings.themePreset, cleanUnlockContext)
      : defaultSettings.themePreset;
    const nextThemeMode = preserveTheme
      ? currentSettings.themeMode || defaultSettings.themeMode
      : defaultSettings.themeMode;

    this.settings = {
      ...defaultSettings,
      appName: currentSettings.appName || defaultSettings.appName,
      themePreset: nextThemePreset,
      themeMode: nextThemeMode,
      reduceMotion: currentSettings.reduceMotion ?? defaultSettings.reduceMotion,
      soundEnabled: currentSettings.soundEnabled ?? defaultSettings.soundEnabled,
      soundVolume: currentSettings.soundVolume ?? defaultSettings.soundVolume,
      celebrationEnabled:
        currentSettings.celebrationEnabled ?? defaultSettings.celebrationEnabled,
      quietHoursEnabled:
        currentSettings.quietHoursEnabled ?? defaultSettings.quietHoursEnabled,
      quietHoursStart: currentSettings.quietHoursStart || defaultSettings.quietHoursStart,
      quietHoursEnd: currentSettings.quietHoursEnd || defaultSettings.quietHoursEnd,
      notificationsEnabled:
        currentSettings.notificationsEnabled ?? defaultSettings.notificationsEnabled,
      remindersLeadMinutes:
        currentSettings.remindersLeadMinutes ?? defaultSettings.remindersLeadMinutes,
      gamificationEnabled:
        currentSettings.gamificationEnabled ?? defaultSettings.gamificationEnabled,
      defaultFocusDurationMinutes:
        currentSettings.defaultFocusDurationMinutes ??
        defaultSettings.defaultFocusDurationMinutes,
      defaultShortBreakMinutes:
        currentSettings.defaultShortBreakMinutes ?? defaultSettings.defaultShortBreakMinutes,
      defaultLongBreakMinutes:
        currentSettings.defaultLongBreakMinutes ?? defaultSettings.defaultLongBreakMinutes,
      focusDeviceSettings: currentSettings.focusDeviceSettings
        ? { ...currentSettings.focusDeviceSettings }
        : defaultSettings.focusDeviceSettings
          ? { ...defaultSettings.focusDeviceSettings }
          : undefined,
      autoBackupEnabled:
        currentSettings.autoBackupEnabled ?? defaultSettings.autoBackupEnabled,
      autoBackupDays: currentSettings.autoBackupDays ?? defaultSettings.autoBackupDays,
      // Reset progression, backup timestamp, and PIN lock
      appLockEnabled: false,
      appLockPinHash: undefined,
      appLockSalt: undefined,
      claimedLevelRewards: [],
      unseenAchievementIds: [],
      lastBackupDate: undefined,
    };

    this.recalculateAchievements({ silent: true });
    this.syncClaimedLevelsAndTheme();

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem('daycraft_theme_preset', this.settings.themePreset);
        if (this.settings.themeMode) {
          window.localStorage.setItem('daycraft_theme_mode', this.settings.themeMode);
        }
      } catch {
        // Ignore storage errors
      }
    }

    if (!preserveTutorial) {
      tutorialManager.resetAllTutorialProgress();
    }

    this.persist();
    return {
      success: true,
      clearedCounts,
    };
  }

  resetAllData(): void {
    this.resetPersonalData({ confirmed: true, confirmationText: RESET_CONFIRMATION_PHRASE });
  }

  // --- Tasks Repository ---
  getTasks(): Task[] {
    return [...this.tasks];
  }

  saveTask(task: Task): RewardOutcome {
    const previousTotalXp = this.getTotalXp();
    const previousUnlockedIds = this.getUnlockedAchievementIds();
    const idx = this.tasks.findIndex(t => t.id === task.id);
    const now = new Date().toISOString();
    const updated: Task = {
      ...task,
      completedAt:
        task.status === 'completed'
          ? task.completedAt || now
          : undefined,
      updatedAt: now,
    };

    const wasCompleted = idx >= 0 ? this.tasks[idx].status === 'completed' : false;
    const isNowCompleted = updated.status === 'completed';

    if (idx >= 0) {
      this.tasks = this.tasks.map((t, i) => (i === idx ? updated : t));
    } else {
      this.tasks = [...this.tasks, updated];
    }

    let xpAwarded = 0;
    if (isNowCompleted && !wasCompleted && this.settings.gamificationEnabled) {
      if (!isXpAlreadyAwarded(this.xpLedger, 'task_completed', updated.id)) {
        this.xpLedger = [
          ...this.xpLedger,
          {
            id: `xp_task_${Date.now()}_${updated.id}`,
            timestamp: now,
            xp: XP_VALUES.TASK_COMPLETED,
            sourceType: 'task_completed',
            sourceId: updated.id,
            rewardKey: buildRewardKey('task_completed', updated.id),
            description: `Completed task: ${updated.title}`,
          },
        ];
        xpAwarded = XP_VALUES.TASK_COMPLETED;
      }
    }

    return this.finalizeProgressionAndPersist(xpAwarded, previousTotalXp, previousUnlockedIds);
  }

  deleteTask(id: string): void {
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.recalculateAchievements({ silent: true });
    this.persist();
  }

  // --- Habits Repository ---
  getHabits(): Habit[] {
    return [...this.habits];
  }

  saveHabit(habit: Habit): void {
    const idx = this.habits.findIndex(h => h.id === habit.id);
    const now = new Date().toISOString();
    const updated = { ...habit, updatedAt: now };

    if (idx >= 0) {
      this.habits = this.habits.map((h, i) => (i === idx ? updated : h));
    } else {
      this.habits = [...this.habits, updated];
    }
    this.persist();
  }

  deleteHabit(id: string): void {
    this.habits = this.habits.filter(h => h.id !== id);
    this.habitOccurrences = this.habitOccurrences.filter(o => o.habitId !== id);
    this.recalculateAchievements({ silent: true });
    this.persist();
  }

  getHabitOccurrences(habitId?: string): HabitOccurrence[] {
    if (habitId) return this.habitOccurrences.filter(o => o.habitId === habitId);
    return [...this.habitOccurrences];
  }

  recordHabitOccurrence(occurrence: HabitOccurrence, referenceTodayStr?: string): RewardOutcome {
    const previousTotalXp = this.getTotalXp();
    const previousUnlockedIds = this.getUnlockedAchievementIds();
    const idx = this.habitOccurrences.findIndex(
      o => o.habitId === occurrence.habitId && o.date === occurrence.date
    );
    const wasCompleted = idx >= 0 ? this.habitOccurrences[idx].status === 'completed' : false;

    if (idx >= 0) {
      this.habitOccurrences = this.habitOccurrences.map((o, i) => (i === idx ? occurrence : o));
    } else {
      this.habitOccurrences = [...this.habitOccurrences, occurrence];
    }

    let xpAwarded = 0;
    const todayStr = referenceTodayStr || formatLocalDate(new Date());

    // Award XP once per (habitId, occurrence.date) if within valid backfill window
    if (
      occurrence.status === 'completed' &&
      !wasCompleted &&
      this.settings.gamificationEnabled &&
      isEligibleForHabitXp(occurrence.date, todayStr)
    ) {
      const occurrenceDate = occurrence.date;
      if (!isXpAlreadyAwarded(this.xpLedger, 'habit_completed', occurrence.habitId, occurrenceDate)) {
        const habit = this.habits.find(h => h.id === occurrence.habitId);
        this.xpLedger = [
          ...this.xpLedger,
          {
            id: `xp_hab_${Date.now()}_${occurrence.habitId}_${occurrenceDate}`,
            timestamp: new Date().toISOString(),
            xp: XP_VALUES.HABIT_COMPLETED,
            sourceType: 'habit_completed',
            sourceId: occurrence.habitId,
            occurrenceDate,
            rewardKey: buildRewardKey('habit_completed', occurrence.habitId, occurrenceDate),
            description: `Completed habit: ${habit?.name || 'Habit'} (${occurrenceDate})`,
          },
        ];
        xpAwarded = XP_VALUES.HABIT_COMPLETED;
      }
    }

    return this.finalizeProgressionAndPersist(xpAwarded, previousTotalXp, previousUnlockedIds);
  }

  // --- Habit Routines & Stacks Repository ---
  getHabitRoutines(): HabitRoutine[] {
    return [...this.habitRoutines];
  }

  createHabitRoutine(
    data: Omit<HabitRoutine, 'id' | 'createdAt' | 'updatedAt' | 'completionsCount'>
  ): HabitRoutine {
    const routine: HabitRoutine = {
      ...data,
      id: `routine_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      completionsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.habitRoutines = [...this.habitRoutines, routine];
    this.persist();
    return routine;
  }

  updateHabitRoutine(id: string, updates: Partial<HabitRoutine>): HabitRoutine | null {
    const idx = this.habitRoutines.findIndex(r => r.id === id);
    if (idx === -1) return null;
    const updated: HabitRoutine = {
      ...this.habitRoutines[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.habitRoutines = this.habitRoutines.map((r, i) => (i === idx ? updated : r));
    this.persist();
    return updated;
  }

  deleteHabitRoutine(id: string): boolean {
    const before = this.habitRoutines.length;
    this.habitRoutines = this.habitRoutines.filter(r => r.id !== id);
    if (this.habitRoutines.length !== before) {
      this.persist();
      return true;
    }
    return false;
  }

  recordRoutineCompletion(routineId: string, completionDate?: string): RewardOutcome {
    const routine = this.habitRoutines.find(r => r.id === routineId);
    if (!routine) return EMPTY_REWARD_OUTCOME;

    const previousTotalXp = this.getTotalXp();
    const previousUnlockedIds = this.getUnlockedAchievementIds();
    const todayStr = completionDate || formatLocalDate(new Date());
    const alreadyCompletedToday =
      routine.lastCompletedDate === todayStr ||
      isXpAlreadyAwarded(this.xpLedger, 'routine_completed', routineId, todayStr);

    if (!alreadyCompletedToday) {
      routine.completionsCount = (routine.completionsCount || 0) + 1;
      routine.lastCompletedDate = todayStr;
    }
    routine.updatedAt = new Date().toISOString();

    let xpAwarded = 0;
    if (
      this.settings.gamificationEnabled &&
      !alreadyCompletedToday &&
      !isXpAlreadyAwarded(this.xpLedger, 'routine_completed', routineId, todayStr)
    ) {
      this.xpLedger = [
        ...this.xpLedger,
        {
          id: `xp_rt_${Date.now()}_${routineId}_${todayStr}`,
          timestamp: new Date().toISOString(),
          xp: XP_VALUES.ROUTINE_COMPLETED,
          sourceType: 'routine_completed',
          sourceId: routineId,
          occurrenceDate: todayStr,
          rewardKey: buildRewardKey('routine_completed', routineId, todayStr),
          description: `Completed habit routine cascade: ${routine.name} (${todayStr})`,
        },
      ];
      xpAwarded = XP_VALUES.ROUTINE_COMPLETED;
    }

    return this.finalizeProgressionAndPersist(xpAwarded, previousTotalXp, previousUnlockedIds);
  }

  // --- Projects Repository ---
  getProjects(): Project[] {
    return [...this.projects];
  }

  saveProject(project: Project): RewardOutcome {
    const previousTotalXp = this.getTotalXp();
    const previousUnlockedIds = this.getUnlockedAchievementIds();
    const idx = this.projects.findIndex(p => p.id === project.id);
    const now = new Date().toISOString();
    const updated = { ...project, updatedAt: now };

    if (idx >= 0) {
      this.projects = this.projects.map((p, i) => (i === idx ? updated : p));
    } else {
      this.projects = [...this.projects, updated];
    }

    return this.finalizeProgressionAndPersist(0, previousTotalXp, previousUnlockedIds);
  }

  deleteProject(id: string): void {
    this.projects = this.projects.filter(p => p.id !== id);
    this.recalculateAchievements({ silent: true });
    this.persist();
  }

  // --- Goals Repository ---
  getGoals(): Goal[] {
    return [...this.goals];
  }

  saveGoal(goal: Goal): RewardOutcome {
    const previousTotalXp = this.getTotalXp();
    const previousUnlockedIds = this.getUnlockedAchievementIds();
    const idx = this.goals.findIndex(g => g.id === goal.id);
    const now = new Date().toISOString();
    const previousGoal = idx >= 0 ? this.goals[idx] : undefined;
    const wasAchieved = previousGoal ? previousGoal.status === 'achieved' : false;

    let nextStatus = goal.status;
    const hasValidPositiveTarget =
      goal.isMeasurable &&
      typeof goal.targetValue === 'number' &&
      Number.isFinite(goal.targetValue) &&
      goal.targetValue > 0;
    const hasValidCurrent =
      typeof goal.currentValue === 'number' && Number.isFinite(goal.currentValue);
    const isTransitioningToActive =
      Boolean(previousGoal) && previousGoal!.status !== 'active' && goal.status === 'active';
    const metricOrTargetChangedWhileActive =
      !previousGoal ||
      (previousGoal.status === 'active' &&
        (goal.currentValue !== previousGoal.currentValue ||
          goal.targetValue !== previousGoal.targetValue ||
          goal.isMeasurable !== previousGoal.isMeasurable));

    // Auto-complete an active measurable goal when its metric genuinely reaches a positive targetValue
    if (
      hasValidPositiveTarget &&
      hasValidCurrent &&
      goal.currentValue! >= goal.targetValue! &&
      goal.status === 'active' &&
      !isTransitioningToActive &&
      metricOrTargetChangedWhileActive
    ) {
      nextStatus = 'achieved';
    }

    const isNowAchieved = nextStatus === 'achieved';
    let nextAchievedAt: string | undefined;

    if (isNowAchieved) {
      if (wasAchieved) {
        // Editing an already-achieved goal: preserve its existing completion timestamp without replacing it
        nextAchievedAt = isValidTimestampString(previousGoal?.achievedAt)
          ? previousGoal!.achievedAt
          : isValidTimestampString(goal.achievedAt)
            ? goal.achievedAt
            : undefined;
      } else {
        // Genuine transition into achieved: preserve prior completion timestamp if reopened & re-completed, else record now
        nextAchievedAt = isValidTimestampString(previousGoal?.achievedAt)
          ? previousGoal!.achievedAt
          : isValidTimestampString(goal.achievedAt)
            ? goal.achievedAt
            : now;
      }
    } else {
      // Reopened, paused, archived, or active: preserve any prior completion timestamp so history is not silently erased
      nextAchievedAt = isValidTimestampString(previousGoal?.achievedAt)
        ? previousGoal!.achievedAt
        : isValidTimestampString(goal.achievedAt)
          ? goal.achievedAt
          : undefined;
    }

    const updated: Goal = {
      ...goal,
      status: nextStatus,
      achievedAt: nextAchievedAt,
      updatedAt: now,
    };

    if (idx >= 0) {
      this.goals = this.goals.map((g, i) => (i === idx ? updated : g));
    } else {
      this.goals = [...this.goals, updated];
    }

    let xpAwarded = 0;
    if (isNowAchieved && !wasAchieved && this.settings.gamificationEnabled) {
      if (!isXpAlreadyAwarded(this.xpLedger, 'goal_achieved', updated.id)) {
        this.xpLedger = [
          ...this.xpLedger,
          {
            id: `xp_goal_${Date.now()}_${updated.id}`,
            timestamp: now,
            xp: XP_VALUES.GOAL_ACHIEVED,
            sourceType: 'goal_achieved',
            sourceId: updated.id,
            rewardKey: buildRewardKey('goal_achieved', updated.id),
            description: `Achieved goal: ${updated.title}`,
          },
        ];
        xpAwarded = XP_VALUES.GOAL_ACHIEVED;
      }
    }

    return this.finalizeProgressionAndPersist(xpAwarded, previousTotalXp, previousUnlockedIds);
  }

  deleteGoal(id: string): void {
    this.goals = this.goals.filter(g => g.id !== id);
    this.persist();
  }

  // --- Calendar & Time-blocking ---
  getCalendarEvents(): CalendarEvent[] {
    return [...this.calendarEvents];
  }

  saveCalendarEvent(event: CalendarEvent): void {
    const idx = this.calendarEvents.findIndex(e => e.id === event.id);
    if (idx >= 0) {
      this.calendarEvents = this.calendarEvents.map((e, i) => (i === idx ? event : e));
    } else {
      this.calendarEvents = [...this.calendarEvents, event];
    }
    this.persist();
  }

  deleteCalendarEvent(id: string): void {
    this.calendarEvents = this.calendarEvents.filter(e => e.id !== id);
    this.persist();
  }

  getTimeBlocks(): TimeBlock[] {
    return [...this.timeBlocks];
  }

  saveTimeBlock(block: TimeBlock): void {
    const idx = this.timeBlocks.findIndex(b => b.id === block.id);
    if (idx >= 0) {
      this.timeBlocks = this.timeBlocks.map((b, i) => (i === idx ? block : b));
    } else {
      this.timeBlocks = [...this.timeBlocks, block];
    }
    this.persist();
  }

  deleteTimeBlock(id: string): void {
    this.timeBlocks = this.timeBlocks.filter(b => b.id !== id);
    this.persist();
  }

  // --- Focus Sessions ---
  getFocusSessions(): FocusSession[] {
    return [...this.focusSessions];
  }

  recordFocusSession(session: FocusSession): RewardOutcome {
    const previousTotalXp = this.getTotalXp();
    const previousUnlockedIds = this.getUnlockedAchievementIds();
    const existingIdx = this.focusSessions.findIndex(s => s.id === session.id);
    if (existingIdx >= 0) {
      this.focusSessions = this.focusSessions.map((s, i) => (i === existingIdx ? session : s));
    } else {
      this.focusSessions = [...this.focusSessions, session];
    }

    let xpAwarded = 0;
    if (session.completed && this.settings.gamificationEnabled) {
      if (!isXpAlreadyAwarded(this.xpLedger, 'focus_session', session.id)) {
        this.xpLedger.push({
          id: `xp_foc_${Date.now()}_${session.id}`,
          timestamp: new Date().toISOString(),
          xp: XP_VALUES.FOCUS_SESSION,
          sourceType: 'focus_session',
          sourceId: session.id,
          rewardKey: buildRewardKey('focus_session', session.id),
          description: `Completed ${session.durationMinutes}m focus session`,
        });
        xpAwarded = XP_VALUES.FOCUS_SESSION;
      }
    }

    return this.finalizeProgressionAndPersist(xpAwarded, previousTotalXp, previousUnlockedIds);
  }

  // --- Study Mode ---
  getStudySubjects(): StudySubject[] {
    return [...this.studySubjects];
  }

  saveStudySubject(sub: StudySubject): void {
    const idx = this.studySubjects.findIndex(s => s.id === sub.id);
    if (idx >= 0) {
      this.studySubjects = this.studySubjects.map((s, i) => (i === idx ? sub : s));
    } else {
      this.studySubjects = [...this.studySubjects, sub];
    }
    this.persist();
  }

  deleteStudySubject(id: string): void {
    this.studySubjects = this.studySubjects.filter(s => s.id !== id);
    this.studySessions = this.studySessions.filter(s => s.subjectId !== id);
    this.persist();
  }

  getStudySessions(): StudySession[] {
    return [...this.studySessions];
  }

  recordStudySession(session: StudySession): RewardOutcome {
    const previousTotalXp = this.getTotalXp();
    const previousUnlockedIds = this.getUnlockedAchievementIds();
    const existingIdx = this.studySessions.findIndex(s => s.id === session.id);
    if (existingIdx >= 0) {
      this.studySessions = this.studySessions.map((s, i) => (i === existingIdx ? session : s));
    } else {
      this.studySessions = [...this.studySessions, session];
    }

    let xpAwarded = 0;
    if (this.settings.gamificationEnabled) {
      if (!isXpAlreadyAwarded(this.xpLedger, 'study_session', session.id)) {
        this.xpLedger.push({
          id: `xp_stu_${Date.now()}_${session.id}`,
          timestamp: new Date().toISOString(),
          xp: XP_VALUES.STUDY_SESSION,
          sourceType: 'study_session',
          sourceId: session.id,
          rewardKey: buildRewardKey('study_session', session.id),
          description: `Logged study session: ${session.durationMinutes}m`,
        });
        xpAwarded = XP_VALUES.STUDY_SESSION;
      }
    }

    return this.finalizeProgressionAndPersist(xpAwarded, previousTotalXp, previousUnlockedIds);
  }

  // --- Wellness ---
  getWellnessTrackers(): WellnessTracker[] {
    return [...this.wellnessTrackers];
  }

  saveWellnessTracker(tracker: WellnessTracker): void {
    const idx = this.wellnessTrackers.findIndex(t => t.id === tracker.id);
    if (idx >= 0) {
      this.wellnessTrackers = this.wellnessTrackers.map((t, i) => (i === idx ? tracker : t));
    } else {
      this.wellnessTrackers = [...this.wellnessTrackers, tracker];
    }
    this.persist();
  }

  getWellnessEntries(date?: string): WellnessEntry[] {
    if (date) return this.wellnessEntries.filter(e => e.date === date);
    return [...this.wellnessEntries];
  }

  recordWellnessEntry(entry: WellnessEntry): void {
    const idx = this.wellnessEntries.findIndex(
      e => e.trackerId === entry.trackerId && e.date === entry.date
    );
    if (idx >= 0) {
      this.wellnessEntries = this.wellnessEntries.map((e, i) => (i === idx ? entry : e));
    } else {
      this.wellnessEntries = [...this.wellnessEntries, entry];
    }
    this.persist();
  }

  // --- Journal ---
  getJournalEntries(): JournalEntry[] {
    return [...this.journalEntries];
  }

  saveJournalEntry(entry: JournalEntry): RewardOutcome {
    const previousTotalXp = this.getTotalXp();
    const previousUnlockedIds = this.getUnlockedAchievementIds();
    const idx = this.journalEntries.findIndex(j => j.id === entry.id);
    const now = new Date().toISOString();
    const updated = { ...entry, updatedAt: now };

    let xpAwarded = 0;
    if (idx >= 0) {
      this.journalEntries[idx] = updated;
    } else {
      this.journalEntries.push(updated);
      if (this.settings.gamificationEnabled) {
        if (!isXpAlreadyAwarded(this.xpLedger, 'journal_entry', updated.id)) {
          this.xpLedger.push({
            id: `xp_jnl_${Date.now()}_${updated.id}`,
            timestamp: now,
            xp: XP_VALUES.JOURNAL_ENTRY,
            sourceType: 'journal_entry',
            sourceId: updated.id,
            rewardKey: buildRewardKey('journal_entry', updated.id),
            description: `Journal reflection: ${updated.title}`,
          });
          xpAwarded = XP_VALUES.JOURNAL_ENTRY;
        }
      }
    }

    return this.finalizeProgressionAndPersist(xpAwarded, previousTotalXp, previousUnlockedIds);
  }

  deleteJournalEntry(id: string): void {
    this.journalEntries = this.journalEntries.filter(j => j.id !== id);
    this.persist();
  }

  // --- Gamification ---
  getAchievements(): Achievement[] {
    return [...this.achievements];
  }

  getUnlockedAchievementIds(): Set<string> {
    return new Set(this.achievements.filter(a => Boolean(a.unlockedAt)).map(a => a.id));
  }

  getThemeUnlockContext(): ThemeUnlockContext {
    return {
      level: calculateLevel(this.getTotalXp()).level,
      unlockedAchievementIds: this.getUnlockedAchievementIds(),
    };
  }

  isThemeEligible(presetKey: string): boolean {
    return isThemeUnlocked(presetKey, this.getThemeUnlockContext());
  }

  enforceEligibleThemePreset(): ThemePresetKey {
    const eligible = resolveEligibleThemePreset(
      this.settings.themePreset,
      this.getThemeUnlockContext()
    );
    if (this.settings.themePreset !== eligible) {
      this.settings = { ...this.settings, themePreset: eligible };
    }
    return eligible;
  }

  getUnseenAchievementIds(): string[] {
    return Array.isArray(this.settings.unseenAchievementIds)
      ? [...this.settings.unseenAchievementIds]
      : [];
  }

  markAchievementsSeen(): void {
    if (
      Array.isArray(this.settings.unseenAchievementIds) &&
      this.settings.unseenAchievementIds.length > 0
    ) {
      this.settings = {
        ...this.settings,
        unseenAchievementIds: [],
      };
      this.persist();
    }
  }

  getXpLedger(): XpLedgerEntry[] {
    return [...this.xpLedger];
  }

  getTotalXp(): number {
    return this.xpLedger.reduce((acc, entry) => acc + entry.xp, 0);
  }

  // --- Settings ---
  getSettings(): UserSettings {
    return { ...this.settings };
  }

  updateSettings(partial: Partial<UserSettings>): void {
    const wasGamificationEnabled = this.settings.gamificationEnabled;
    const nextSettings: UserSettings = { ...this.settings, ...partial };

    if (partial.themePreset !== undefined) {
      // Never allow equipping a locked or invalid theme preset; keep previous eligible or default
      if (this.isThemeEligible(partial.themePreset)) {
        nextSettings.themePreset = partial.themePreset;
      } else {
        nextSettings.themePreset = resolveEligibleThemePreset(
          this.settings.themePreset,
          this.getThemeUnlockContext()
        );
      }
    }

    this.settings = nextSettings;
    if (!wasGamificationEnabled && this.settings.gamificationEnabled) {
      this.recalculateAchievements({ silent: true });
      this.syncClaimedLevelsAndTheme();
    } else if (wasGamificationEnabled && !this.settings.gamificationEnabled) {
      this.recalculateAchievements({ silent: true });
    }
    this.persist();
  }
}

export const db = new DatabaseManager();
