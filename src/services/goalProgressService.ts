import { Goal, XpLedgerEntry } from '../domain/models';

export interface GoalProgressSummary {
  /** Visual percentage strictly clamped to [0, 100], never NaN or Infinity */
  visualPercent: number;
  /** Clamped floating-point percentage [0, 100] before rounding */
  clampedPercent: number;
  /** Safe non-negative numeric current value */
  safeCurrentValue: number;
  /** Safe positive numeric target value, or null if non-measurable or invalid */
  safeTargetValue: number | null;
  /** Concise value/target/unit display string (e.g., "12 / 30 days") */
  valuePairLabel: string;
  /** Formatted metric string (e.g., "57 / 30 days · Completed" or "Current: 15 / 30 days") */
  metricSummary: string;
  /** Human-readable status label */
  stateLabel: 'Completed' | 'Paused' | 'Archived' | 'In progress' | 'Active';
  /** Whether the goal has a valid positive numerical target */
  hasValidTarget: boolean;
  /** Whether safeCurrentValue >= safeTargetValue for a valid measurable target */
  isTargetMet: boolean;
}

export interface GoalEditValidationResult {
  valid: boolean;
  error?: string;
  sanitizedTitle: string;
  sanitizedTargetValue?: number;
  sanitizedCurrentValue?: number;
  sanitizedUnit?: string;
}

/**
 * Format numeric metric values cleanly (integers without decimals, fractional values up to 2 decimals).
 */
export function formatGoalMetricValue(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (Number.isInteger(value)) return String(value);
  return Number(value.toFixed(2)).toString();
}

/**
 * Compute a safe non-negative progress value after applying a numeric delta (e.g., -1, +1, +5).
 */
export function applyGoalProgressDelta(currentValue: number | undefined, delta: number): number {
  const safeBase =
    typeof currentValue === 'number' && Number.isFinite(currentValue)
      ? Math.max(0, currentValue)
      : 0;
  const safeDelta = typeof delta === 'number' && Number.isFinite(delta) ? delta : 0;
  const rawNext = Math.max(0, safeBase + safeDelta);
  return Number(rawNext.toFixed(4));
}

/**
 * Validate a direct numeric progress value entered by the user.
 */
export function parseDirectGoalProgressInput(
  rawInput: string | number
): { valid: boolean; value?: number; error?: string } {
  if (typeof rawInput === 'string' && rawInput.trim().length === 0) {
    return { valid: false, error: 'Enter a valid non-negative progress number.' };
  }
  const num = typeof rawInput === 'number' ? rawInput : Number(rawInput);
  if (!Number.isFinite(num) || num < 0) {
    return { valid: false, error: 'Progress value must be 0 or greater.' };
  }
  return { valid: true, value: Number(num.toFixed(4)) };
}

/**
 * Validate goal creation/edit fields, preventing empty titles or invalid target/current values.
 */
export function validateGoalEditFields(fields: {
  title: string;
  isMeasurable: boolean;
  targetValue?: number | string;
  currentValue?: number | string;
  unit?: string;
}): GoalEditValidationResult {
  const sanitizedTitle = typeof fields.title === 'string' ? fields.title.trim() : '';
  if (!sanitizedTitle) {
    return {
      valid: false,
      error: 'Goal title is required.',
      sanitizedTitle: '',
    };
  }

  if (!fields.isMeasurable) {
    return {
      valid: true,
      sanitizedTitle,
      sanitizedTargetValue: undefined,
      sanitizedCurrentValue: undefined,
      sanitizedUnit: undefined,
    };
  }

  const rawTarget =
    typeof fields.targetValue === 'string' && fields.targetValue.trim() === ''
      ? Number.NaN
      : Number(fields.targetValue);
  if (!Number.isFinite(rawTarget) || rawTarget <= 0) {
    return {
      valid: false,
      error: 'Target value must be a number greater than 0.',
      sanitizedTitle,
    };
  }

  const rawCurrent =
    fields.currentValue === undefined ||
    (typeof fields.currentValue === 'string' && fields.currentValue.trim() === '')
      ? 0
      : Number(fields.currentValue);
  if (!Number.isFinite(rawCurrent) || rawCurrent < 0) {
    return {
      valid: false,
      error: 'Current progress value must be 0 or greater.',
      sanitizedTitle,
    };
  }

  const sanitizedUnit =
    typeof fields.unit === 'string' && fields.unit.trim().length > 0
      ? fields.unit.trim()
      : 'units';

  return {
    valid: true,
    sanitizedTitle,
    sanitizedTargetValue: Number(rawTarget.toFixed(4)),
    sanitizedCurrentValue: Number(rawCurrent.toFixed(4)),
    sanitizedUnit,
  };
}

/**
 * Deterministically calculate goal progress and display labels.
 * Never mutates the underlying Goal object or currentValue.
 */
export function calculateGoalProgress(
  goal: Pick<Goal, 'isMeasurable' | 'currentValue' | 'targetValue' | 'unit' | 'status'>
): GoalProgressSummary {
  const isAchieved = goal.status === 'achieved';
  const isPaused = goal.status === 'paused';
  const isArchived = goal.status === 'archived';

  if (!goal.isMeasurable) {
    const stateLabel: GoalProgressSummary['stateLabel'] = isAchieved
      ? 'Completed'
      : isPaused
        ? 'Paused'
        : isArchived
          ? 'Archived'
          : 'Active';

    return {
      visualPercent: isAchieved ? 100 : 0,
      clampedPercent: isAchieved ? 100 : 0,
      safeCurrentValue: 0,
      safeTargetValue: null,
      valuePairLabel: isAchieved ? 'Completed' : stateLabel,
      metricSummary: isAchieved ? 'Completed' : stateLabel,
      stateLabel,
      hasValidTarget: false,
      isTargetMet: isAchieved,
    };
  }

  const rawCurrent = goal.currentValue;
  const rawTarget = goal.targetValue;

  const safeCurrentValue =
    typeof rawCurrent === 'number' && Number.isFinite(rawCurrent)
      ? Math.max(0, rawCurrent)
      : 0;

  const hasValidTarget =
    typeof rawTarget === 'number' && Number.isFinite(rawTarget) && rawTarget > 0;

  const safeTargetValue = hasValidTarget ? rawTarget : null;
  const unitSuffix = goal.unit && goal.unit.trim().length > 0 ? ` ${goal.unit.trim()}` : '';

  if (!hasValidTarget || safeTargetValue === null) {
    const stateLabel: GoalProgressSummary['stateLabel'] = isAchieved
      ? 'Completed'
      : isPaused
        ? 'Paused'
        : isArchived
          ? 'Archived'
          : 'Active';

    const baseMetric = `${formatGoalMetricValue(safeCurrentValue)}${unitSuffix}`;
    return {
      visualPercent: isAchieved ? 100 : 0,
      clampedPercent: isAchieved ? 100 : 0,
      safeCurrentValue,
      safeTargetValue: null,
      valuePairLabel: baseMetric,
      metricSummary: isAchieved ? `${baseMetric} · Completed` : baseMetric,
      stateLabel,
      hasValidTarget: false,
      isTargetMet: false,
    };
  }

  const rawRatio = (safeCurrentValue / safeTargetValue) * 100;
  const clampedPercent = Number.isFinite(rawRatio)
    ? Math.min(100, Math.max(0, rawRatio))
    : 0;
  const visualPercent = isAchieved ? 100 : Math.round(clampedPercent);
  const isTargetMet = safeCurrentValue >= safeTargetValue;

  let stateLabel: GoalProgressSummary['stateLabel'];
  if (isAchieved) {
    stateLabel = 'Completed';
  } else if (isPaused) {
    stateLabel = 'Paused';
  } else if (isArchived) {
    stateLabel = 'Archived';
  } else if (safeCurrentValue > 0) {
    stateLabel = 'In progress';
  } else {
    stateLabel = 'Active';
  }

  const currentFormatted = formatGoalMetricValue(safeCurrentValue);
  const targetFormatted = formatGoalMetricValue(safeTargetValue);
  const basePair = `${currentFormatted} / ${targetFormatted}${unitSuffix}`;

  const metricSummary = isAchieved
    ? `${basePair} · Completed`
    : `Current: ${basePair}`;

  return {
    visualPercent,
    clampedPercent,
    safeCurrentValue,
    safeTargetValue,
    valuePairLabel: basePair,
    metricSummary,
    stateLabel,
    hasValidTarget: true,
    isTargetMet,
  };
}

/**
 * Resolve a reliable completion timestamp for an achieved goal without fabricating dates for legacy records.
 */
export function resolveGoalCompletionDate(
  goal: Pick<Goal, 'id' | 'status' | 'achievedAt'>,
  xpLedger?: XpLedgerEntry[]
): string | null {
  if (goal.status !== 'achieved') return null;

  if (typeof goal.achievedAt === 'string' && goal.achievedAt.trim().length > 0) {
    const parsed = new Date(goal.achievedAt);
    if (!Number.isNaN(parsed.getTime())) {
      return goal.achievedAt;
    }
  }

  if (Array.isArray(xpLedger)) {
    const matchingEntries = xpLedger.filter(
      e => e.sourceType === 'goal_achieved' && e.sourceId === goal.id && typeof e.timestamp === 'string'
    );
    if (matchingEntries.length > 0) {
      const latest = matchingEntries[matchingEntries.length - 1];
      const parsed = new Date(latest.timestamp);
      if (!Number.isNaN(parsed.getTime())) {
        return latest.timestamp;
      }
    }
  }

  return null;
}

/**
 * Format a resolved completion timestamp into a concise display date (e.g., "25 Oct 2026").
 * Returns null if the timestamp is absent or invalid.
 */
export function formatCompletionDateDisplay(timestamp: string | null | undefined): string | null {
  if (!timestamp || typeof timestamp !== 'string' || timestamp.trim().length === 0) {
    return null;
  }

  // Handle YYYY-MM-DD local date string without timezone shift
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(timestamp.trim());
  let dateObj: Date;
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    dateObj = new Date(year, month, day);
  } else {
    dateObj = new Date(timestamp);
  }

  if (Number.isNaN(dateObj.getTime())) {
    return null;
  }

  return dateObj.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Sort completed goals by completion date (newest first), placing legacy goals without
 * completion timestamps after dated goals in a stable deterministic order.
 */
export function sortCompletedGoals(goals: Goal[], xpLedger?: XpLedgerEntry[]): Goal[] {
  const indexed = goals.map((goal, index) => {
    const resolvedIso = resolveGoalCompletionDate(goal, xpLedger);
    const timeMs = resolvedIso ? new Date(resolvedIso).getTime() : null;
    return {
      goal,
      index,
      timeMs: timeMs !== null && !Number.isNaN(timeMs) ? timeMs : null,
    };
  });

  indexed.sort((a, b) => {
    if (a.timeMs !== null && b.timeMs !== null) {
      if (b.timeMs !== a.timeMs) {
        return b.timeMs - a.timeMs; // newest first
      }
      return a.index - b.index;
    }
    if (a.timeMs !== null && b.timeMs === null) return -1;
    if (a.timeMs === null && b.timeMs !== null) return 1;
    return a.index - b.index;
  });

  return indexed.map(item => item.goal);
}

/**
 * Partition goals strictly by their persisted status into active, paused, completed, and archived collections.
 */
export function partitionGoalsByStatus(
  goals: Goal[],
  xpLedger?: XpLedgerEntry[]
): {
  activeGoals: Goal[];
  pausedGoals: Goal[];
  completedGoals: Goal[];
  archivedGoals: Goal[];
} {
  const activeGoals: Goal[] = [];
  const pausedGoals: Goal[] = [];
  const rawCompleted: Goal[] = [];
  const archivedGoals: Goal[] = [];

  for (const goal of goals) {
    if (!goal || typeof goal !== 'object') continue;
    switch (goal.status) {
      case 'active':
        activeGoals.push(goal);
        break;
      case 'paused':
        pausedGoals.push(goal);
        break;
      case 'achieved':
        rawCompleted.push(goal);
        break;
      case 'archived':
        archivedGoals.push(goal);
        break;
      default:
        activeGoals.push(goal);
        break;
    }
  }

  return {
    activeGoals,
    pausedGoals,
    completedGoals: sortCompletedGoals(rawCompleted, xpLedger),
    archivedGoals,
  };
}
