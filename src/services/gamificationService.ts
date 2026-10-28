// ==========================================
// DAYCRAFT — GAMIFICATION ENGINE
// Honest, subtle, anti-farming XP & achievement system
// ==========================================

import { Achievement, XpLedgerEntry } from '../domain/models';
import { addDays, formatLocalDate } from './streakService';

export const XP_VALUES = {
  TASK_COMPLETED: 15,
  HABIT_COMPLETED: 10,
  ROUTINE_COMPLETED: 30,
  GOAL_ACHIEVED: 100,
  FOCUS_SESSION: 25,
  STUDY_SESSION: 20,
  JOURNAL_ENTRY: 10,
  ACHIEVEMENT_UNLOCKED: 50,
};

/**
 * Maximum number of past days for which logging a missed habit occurrence can still earn XP once.
 * Toggling a date off and back on never re-awards XP, and logging dates older than this window
 * updates streak/history without awarding backfill XP.
 */
export const MAX_HABIT_XP_BACKFILL_DAYS = 7;

export function buildRewardKey(
  sourceType: XpLedgerEntry['sourceType'],
  sourceId: string,
  occurrenceDate?: string
): string {
  return occurrenceDate
    ? `${sourceType}:${sourceId}:${occurrenceDate}`
    : `${sourceType}:${sourceId}`;
}

export function isEligibleForHabitXp(
  occurrenceDate: string,
  todayStr: string = formatLocalDate(new Date()),
  maxBackfillDays: number = MAX_HABIT_XP_BACKFILL_DAYS
): boolean {
  if (!occurrenceDate || occurrenceDate > todayStr) {
    return false;
  }
  const earliestEligibleDate = addDays(todayStr, -maxBackfillDays);
  return occurrenceDate >= earliestEligibleDate;
}

export interface LevelInfo {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
  totalXp: number;
  currentFloorXp: number;
  nextLevelThresholdXp: number;
  xpNeededForNextLevel: number;
  title: string;
}

export interface LevelMilestoneReward {
  level: number;
  title: string;
  rewardLabel: string;
  unlockedThemeId?: 'midnight' | 'lavender_haze' | 'aurora';
  unlockedThemeName?: string;
}

export const LEVEL_MILESTONE_REWARDS: LevelMilestoneReward[] = [
  {
    level: 2,
    title: 'Apprentice Crafter',
    rewardLabel: 'Milestone Title: Apprentice Crafter',
  },
  {
    level: 3,
    title: 'Focused Artisan',
    rewardLabel: 'Unlocks "Midnight" Visual Theme',
    unlockedThemeId: 'midnight',
    unlockedThemeName: 'Midnight',
  },
  {
    level: 4,
    title: 'Rhythm Keeper',
    rewardLabel: 'Milestone Title: Rhythm Keeper',
  },
  {
    level: 5,
    title: 'Systems Architect',
    rewardLabel: 'Unlocks "Lavender Haze" Visual Theme',
    unlockedThemeId: 'lavender_haze',
    unlockedThemeName: 'Lavender Haze',
  },
  {
    level: 6,
    title: 'Deep Work Specialist',
    rewardLabel: 'Milestone Title: Deep Work Specialist',
  },
  {
    level: 7,
    title: 'Master Craftsman',
    rewardLabel: 'Unlocks "Aurora" Visual Theme',
    unlockedThemeId: 'aurora',
    unlockedThemeName: 'Aurora',
  },
  {
    level: 10,
    title: 'Daycraft Luminary',
    rewardLabel: 'Milestone Title: Daycraft Luminary',
  },
];

export function getLevelTitle(level: number): string {
  const safeLevel = Number.isFinite(level) && level >= 1 ? Math.floor(level) : 1;
  let matched = 'Initiate Crafter';
  for (const m of LEVEL_MILESTONE_REWARDS) {
    if (safeLevel >= m.level) {
      matched = m.title;
    }
  }
  return matched;
}

export function getNextLevelReward(currentLevel: number): LevelMilestoneReward | null {
  const safeLevel = Number.isFinite(currentLevel) && currentLevel >= 1 ? Math.floor(currentLevel) : 1;
  return LEVEL_MILESTONE_REWARDS.find(r => r.level > safeLevel) ?? null;
}

export function getCrossedLevels(previousLevel: number, nextLevel: number): number[] {
  const prev = Number.isFinite(previousLevel) && previousLevel >= 1 ? Math.floor(previousLevel) : 1;
  const next = Number.isFinite(nextLevel) && nextLevel >= 1 ? Math.floor(nextLevel) : 1;
  if (next <= prev) return [];
  const crossed: number[] = [];
  for (let lvl = prev + 1; lvl <= next; lvl++) {
    crossed.push(lvl);
  }
  return crossed;
}

export function evaluateLevelProgression(
  previousTotalXp: number,
  nextTotalXp: number,
  alreadyClaimedLevels: Iterable<number> | number[] = []
): {
  previousLevel: number;
  newLevel: number;
  leveledUp: boolean;
  crossedLevels: number[];
  newlyClaimedRewards: LevelMilestoneReward[];
  updatedClaimedLevels: number[];
} {
  const prevInfo = calculateLevel(previousTotalXp);
  const nextInfo = calculateLevel(nextTotalXp);
  const claimedSet = new Set<number>(
    Array.from(alreadyClaimedLevels || []).filter(n => Number.isFinite(n) && n >= 2)
  );

  const crossedLevels = getCrossedLevels(prevInfo.level, nextInfo.level);
  const newlyClaimedRewards: LevelMilestoneReward[] = [];

  // Process all levels up to nextInfo.level in ascending order so multi-level jumps never skip a reward
  for (let lvl = 2; lvl <= nextInfo.level; lvl++) {
    if (!claimedSet.has(lvl)) {
      claimedSet.add(lvl);
      if (lvl > prevInfo.level) {
        const reward = LEVEL_MILESTONE_REWARDS.find(r => r.level === lvl) ?? {
          level: lvl,
          title: getLevelTitle(lvl),
          rewardLabel: `Reached Level ${lvl}`,
        };
        newlyClaimedRewards.push(reward);
      }
    }
  }

  return {
    previousLevel: prevInfo.level,
    newLevel: nextInfo.level,
    leveledUp: nextInfo.level > prevInfo.level,
    crossedLevels,
    newlyClaimedRewards,
    updatedClaimedLevels: Array.from(claimedSet).sort((a, b) => a - b),
  };
}

/**
 * Calculate user level and progress based on total XP
 */
export function calculateLevel(totalXp: number): LevelInfo {
  const safeXp =
    typeof totalXp === 'number' && Number.isFinite(totalXp) && totalXp > 0
      ? Math.floor(totalXp)
      : 0;

  // Level curve: Level L requires (L - 1)^2 * 30 total XP
  // L = floor(sqrt(safeXp / 30)) + 1
  const level = Math.floor(Math.sqrt(safeXp / 30)) + 1;
  const currentFloor = Math.pow(level - 1, 2) * 30;
  const nextFloor = Math.pow(level, 2) * 30;
  const range = Math.max(1, nextFloor - currentFloor);
  const currentProgress = Math.max(0, safeXp - currentFloor);
  const progressPercent = Math.min(100, Math.max(0, Math.round((currentProgress / range) * 100)));

  return {
    level,
    currentLevelXp: currentProgress,
    nextLevelXp: range,
    progressPercent,
    totalXp: safeXp,
    currentFloorXp: currentFloor,
    nextLevelThresholdXp: nextFloor,
    xpNeededForNextLevel: Math.max(0, nextFloor - safeXp),
    title: getLevelTitle(level),
  };
}

/**
 * Checks if XP was already awarded for this specific source (anti-farming protection).
 * Uses rewardKey and occurrenceDate (local YYYY-MM-DD) for date-scoped rewards.
 */
export function isXpAlreadyAwarded(
  ledger: XpLedgerEntry[],
  sourceType: XpLedgerEntry['sourceType'],
  sourceId: string,
  datePrefix?: string // e.g. "2026-10-21" for daily habit/routine occurrences
): boolean {
  const targetKey = buildRewardKey(sourceType, sourceId, datePrefix);
  return ledger.some(entry => {
    if (entry.rewardKey && entry.rewardKey === targetKey) {
      return true;
    }

    // Support backward-compatible routine completion entries that were stored under 'habit_completed'
    const typeMatches =
      entry.sourceType === sourceType ||
      (sourceType === 'routine_completed' &&
        entry.sourceType === 'habit_completed' &&
        entry.sourceId === sourceId) ||
      (sourceType === 'habit_completed' &&
        entry.sourceType === 'routine_completed' &&
        entry.sourceId === sourceId);

    if (!typeMatches || entry.sourceId !== sourceId) {
      return false;
    }

    if (datePrefix) {
      if (entry.occurrenceDate) {
        return entry.occurrenceDate === datePrefix;
      }
      if (entry.timestamp.startsWith(datePrefix)) {
        return true;
      }
      const parsed = new Date(entry.timestamp);
      if (!Number.isNaN(parsed.getTime())) {
        const localDate = formatLocalDate(parsed);
        if (localDate === datePrefix) {
          return true;
        }
      }
      return false;
    }

    return true;
  });
}

export const INITIAL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_task',
    title: 'First Step',
    description: 'Complete your first task in Daycraft',
    category: 'productivity',
    icon: 'CheckCircle2',
    xpReward: 30,
    progress: 0,
    target: 1,
    current: 0,
  },
  {
    id: 'ten_tasks',
    title: 'Flow State',
    description: 'Complete 10 tasks across projects',
    category: 'productivity',
    icon: 'ListOrdered',
    xpReward: 50,
    progress: 0,
    target: 10,
    current: 0,
  },
  {
    id: 'habit_3d',
    title: 'Rhythm Found',
    description: 'Reach a 3-day streak on any habit',
    category: 'consistency',
    icon: 'Flame',
    xpReward: 40,
    progress: 0,
    target: 3,
    current: 0,
  },
  {
    id: 'habit_7d',
    title: 'Weekly Anchor',
    description: 'Maintain a 7-day habit streak',
    category: 'consistency',
    icon: 'Sparkles',
    xpReward: 75,
    progress: 0,
    target: 7,
    current: 0,
  },
  {
    id: 'focus_60',
    title: 'Deep Immersion',
    description: 'Log 60 minutes of uninterrupted focus time',
    category: 'focus',
    icon: 'Timer',
    xpReward: 50,
    progress: 0,
    target: 60,
    current: 0,
  },
  {
    id: 'study_sessions_3',
    title: 'Dedicated Scholar',
    description: 'Log 3 study sessions across any subjects',
    category: 'learning',
    icon: 'BookOpen',
    xpReward: 50,
    progress: 0,
    target: 3,
    current: 0,
  },
  {
    id: 'journal_3d',
    title: 'Mindful Scribe',
    description: 'Write 3 daily journal reflections',
    category: 'mastery',
    icon: 'Feather',
    xpReward: 40,
    progress: 0,
    target: 3,
    current: 0,
  },
  {
    id: 'first_project',
    title: 'Grand Architect',
    description: 'Complete all milestones on an active project',
    category: 'productivity',
    icon: 'FolderCheck',
    xpReward: 100,
    progress: 0,
    target: 1,
    current: 0,
  },
  // Task Milestones
  {
    id: 'twentyfive_tasks',
    title: 'Century Quarter',
    description: 'Complete 25 tasks across all projects',
    category: 'productivity',
    icon: 'CheckSquare',
    xpReward: 75,
    progress: 0,
    target: 25,
    current: 0,
  },
  {
    id: 'fifty_tasks',
    title: 'Productivity Titan',
    description: 'Complete 50 tasks with focused discipline',
    category: 'productivity',
    icon: 'Award',
    xpReward: 120,
    progress: 0,
    target: 50,
    current: 0,
  },
  {
    id: 'hundred_tasks',
    title: 'Execution Centurion',
    description: 'Complete 100 tasks in Daycraft',
    category: 'productivity',
    icon: 'Crown',
    xpReward: 250,
    progress: 0,
    target: 100,
    current: 0,
  },
  // Habit Streak Milestones
  {
    id: 'habit_14d',
    title: 'Fortnight of Iron',
    description: 'Maintain a 14-day streak on any daily habit',
    category: 'consistency',
    icon: 'Zap',
    xpReward: 100,
    progress: 0,
    target: 14,
    current: 0,
  },
  {
    id: 'habit_30d',
    title: 'Unbreakable Habit',
    description: 'Achieve a 30-day streak on a habit anchor',
    category: 'consistency',
    icon: 'ShieldCheck',
    xpReward: 200,
    progress: 0,
    target: 30,
    current: 0,
  },
  {
    id: 'habit_100d',
    title: 'Centurion of Habit',
    description: 'Forge a 100-day legendary habit streak',
    category: 'consistency',
    icon: 'Trophy',
    xpReward: 500,
    progress: 0,
    target: 100,
    current: 0,
  },
  // Habit Routine Stacking Milestones
  {
    id: 'first_routine',
    title: 'Stack Pioneer',
    description: 'Complete all habits in an ordered routine stack',
    category: 'consistency',
    icon: 'Layers',
    xpReward: 40,
    progress: 0,
    target: 1,
    current: 0,
  },
  {
    id: 'ten_routines',
    title: 'Cascade Maestro',
    description: 'Complete 10 habit routine cascades',
    category: 'consistency',
    icon: 'Workflow',
    xpReward: 150,
    progress: 0,
    target: 10,
    current: 0,
  },
  // Focus Milestones
  {
    id: 'focus_300',
    title: 'Flow State Veteran',
    description: 'Log 300 minutes of deep focus immersion',
    category: 'focus',
    icon: 'Hourglass',
    xpReward: 100,
    progress: 0,
    target: 300,
    current: 0,
  },
  {
    id: 'focus_1000',
    title: 'Deep Work Virtuoso',
    description: 'Log 1,000 minutes of deep focus time',
    category: 'focus',
    icon: 'Compass',
    xpReward: 300,
    progress: 0,
    target: 1000,
    current: 0,
  },
  // Reflection Milestones
  {
    id: 'journal_10d',
    title: 'Chronicler of Days',
    description: 'Record 10 thoughtful journal reflections',
    category: 'mastery',
    icon: 'BookMarked',
    xpReward: 80,
    progress: 0,
    target: 10,
    current: 0,
  },
];

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'diamond' | 'obsidian';

export function getBadgeTier(target: number, category: Achievement['category']): BadgeTier {
  if (category === 'consistency') {
    if (target >= 100) return 'obsidian';
    if (target >= 30) return 'diamond';
    if (target >= 14) return 'gold';
    if (target >= 7) return 'silver';
    return 'bronze';
  }
  if (category === 'productivity') {
    if (target >= 100) return 'obsidian';
    if (target >= 50) return 'diamond';
    if (target >= 25) return 'gold';
    if (target >= 10) return 'silver';
    return 'bronze';
  }
  if (category === 'focus') {
    if (target >= 1000) return 'obsidian';
    if (target >= 300) return 'gold';
    return 'bronze';
  }
  return target > 5 ? 'gold' : 'silver';
}

export type AchievementStatus = 'unlocked' | 'in_progress' | 'locked';

export function getAchievementStatus(ach: Achievement): AchievementStatus {
  if (ach.unlockedAt) return 'unlocked';
  const safeCurrent = Number.isFinite(ach.current) && ach.current > 0 ? ach.current : 0;
  return safeCurrent > 0 ? 'in_progress' : 'locked';
}

export function getAchievementUnitLabel(ach: Achievement): string {
  switch (ach.id) {
    case 'first_task':
    case 'ten_tasks':
    case 'twentyfive_tasks':
    case 'fifty_tasks':
    case 'hundred_tasks':
      return ach.target === 1 ? 'task' : 'tasks';
    case 'habit_3d':
    case 'habit_7d':
    case 'habit_14d':
    case 'habit_30d':
    case 'habit_100d':
      return 'day streak';
    case 'first_routine':
    case 'ten_routines':
      return ach.target === 1 ? 'routine' : 'routines';
    case 'focus_60':
    case 'focus_300':
    case 'focus_1000':
      return 'mins';
    case 'study_sessions_3':
      return 'sessions';
    case 'journal_3d':
    case 'journal_10d':
      return 'entries';
    case 'first_project':
      return 'project';
    default:
      return '';
  }
}

export interface AchievementGalleryFilters {
  category?: Achievement['category'] | 'all';
  status?: AchievementStatus | 'all';
  tier?: BadgeTier | 'all';
  searchQuery?: string;
}

export function filterAchievements(
  achievements: Achievement[],
  filters: AchievementGalleryFilters = {}
): Achievement[] {
  const { category = 'all', status = 'all', tier = 'all', searchQuery = '' } = filters;
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return achievements.filter(ach => {
    if (category !== 'all' && ach.category !== category) {
      return false;
    }
    if (status !== 'all' && getAchievementStatus(ach) !== status) {
      return false;
    }
    if (tier !== 'all' && getBadgeTier(ach.target, ach.category) !== tier) {
      return false;
    }
    if (normalizedQuery) {
      const hay = `${ach.title} ${ach.description} ${ach.category}`.toLowerCase();
      if (!hay.includes(normalizedQuery)) {
        return false;
      }
    }
    return true;
  });
}

export function getAchievementSummaryStats(achievements: Achievement[]): {
  unlockedCount: number;
  inProgressCount: number;
  lockedCount: number;
  totalCount: number;
  completionPercent: number;
  totalXpEarnedFromBadges: number;
  totalXpAvailableFromBadges: number;
} {
  const totalCount = achievements.length;
  let unlockedCount = 0;
  let inProgressCount = 0;
  let lockedCount = 0;
  let totalXpEarnedFromBadges = 0;
  let totalXpAvailableFromBadges = 0;

  for (const ach of achievements) {
    const reward = Number.isFinite(ach.xpReward) && ach.xpReward > 0 ? ach.xpReward : 0;
    totalXpAvailableFromBadges += reward;
    const status = getAchievementStatus(ach);
    if (status === 'unlocked') {
      unlockedCount++;
      totalXpEarnedFromBadges += reward;
    } else if (status === 'in_progress') {
      inProgressCount++;
    } else {
      lockedCount++;
    }
  }

  const completionPercent =
    totalCount > 0
      ? Math.min(100, Math.max(0, Math.round((unlockedCount / totalCount) * 100)))
      : 0;

  return {
    unlockedCount,
    inProgressCount,
    lockedCount,
    totalCount,
    completionPercent,
    totalXpEarnedFromBadges,
    totalXpAvailableFromBadges,
  };
}

/**
 * Deterministically evaluate achievement progress
 */
export function evaluateAchievements(
  currentAchievements: Achievement[],
  stats: {
    completedTasksCount: number;
    maxHabitStreak: number;
    totalFocusMinutes: number;
    totalStudySessions: number;
    totalJournalEntries: number;
    completedProjectsCount: number;
    completedRoutinesCount?: number;
  },
  options?: {
    readOnly?: boolean;
  }
): {
  updatedAchievements: Achievement[];
  newlyUnlocked: Achievement[];
} {
  const updatedAchievements: Achievement[] = [];
  const newlyUnlocked: Achievement[] = [];
  const now = new Date().toISOString();
  const readOnly = Boolean(options?.readOnly);

  // Ensure all known achievements are tracked in canonical order (merging saved unlock states)
  const savedMap = new Map<string, Achievement>();
  for (const a of currentAchievements || []) {
    if (a && typeof a.id === 'string') {
      savedMap.set(a.id, a);
    }
  }

  const orderedDefs: Achievement[] = INITIAL_ACHIEVEMENTS.map(canonical => {
    const existing = savedMap.get(canonical.id);
    return existing ? { ...canonical, ...existing, target: canonical.target > 0 ? canonical.target : 1 } : { ...canonical };
  });

  // Preserve any custom/extra achievement records if present
  for (const [id, saved] of savedMap.entries()) {
    if (!INITIAL_ACHIEVEMENTS.some(c => c.id === id)) {
      orderedDefs.push({ ...saved });
    }
  }

  for (const ach of orderedDefs) {
    let rawCurrent = Number.isFinite(ach.current) ? ach.current : 0;

    switch (ach.id) {
      case 'first_task':
      case 'ten_tasks':
      case 'twentyfive_tasks':
      case 'fifty_tasks':
      case 'hundred_tasks':
        rawCurrent = stats.completedTasksCount;
        break;
      case 'habit_3d':
      case 'habit_7d':
      case 'habit_14d':
      case 'habit_30d':
      case 'habit_100d':
        rawCurrent = stats.maxHabitStreak;
        break;
      case 'first_routine':
      case 'ten_routines':
        rawCurrent = stats.completedRoutinesCount ?? 0;
        break;
      case 'focus_60':
      case 'focus_300':
      case 'focus_1000':
        rawCurrent = stats.totalFocusMinutes;
        break;
      case 'study_sessions_3':
        rawCurrent = stats.totalStudySessions;
        break;
      case 'journal_3d':
      case 'journal_10d':
        rawCurrent = stats.totalJournalEntries;
        break;
      case 'first_project':
        rawCurrent = stats.completedProjectsCount;
        break;
    }

    const safeTarget = Number.isFinite(ach.target) && ach.target > 0 ? ach.target : 1;
    const safeCurrent = Number.isFinite(rawCurrent) && rawCurrent > 0 ? rawCurrent : 0;
    const wasUnlocked = Boolean(ach.unlockedAt);
    const qualifiesToUnlock = !readOnly && safeCurrent >= safeTarget;
    const isUnlocked = wasUnlocked || qualifiesToUnlock;

    const progress = isUnlocked
      ? 100
      : Math.min(100, Math.max(0, Math.round((safeCurrent / safeTarget) * 100)));

    const updated: Achievement = {
      ...ach,
      target: safeTarget,
      current: wasUnlocked ? Math.max(safeCurrent, safeTarget) : safeCurrent,
      progress,
      unlockedAt: wasUnlocked ? ach.unlockedAt : qualifiesToUnlock ? now : undefined,
    };

    if (qualifiesToUnlock && !wasUnlocked) {
      newlyUnlocked.push(updated);
    }
    updatedAchievements.push(updated);
  }

  return { updatedAchievements, newlyUnlocked };
}
