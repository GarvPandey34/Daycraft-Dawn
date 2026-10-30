// ==========================================
// DAYCRAFT — FOCUS TIMER STATE & LOCAL DATE SERVICE
// Preserves active/paused timer state across sidebar navigation & reloads
// and resolves focus session local calendar dates accurately
// ==========================================

import { DeviceFocusMode, FocusSession } from '../domain/models';
import { DatabaseManager, db } from '../database/db';
import { formatLocalDate } from './streakService';

const FOCUS_TIMER_STORAGE_KEY = 'daycraft_active_focus_timer_v1';

export interface FocusTimerPersistentState {
  sessionId: string;
  sessionType: 'focus' | 'short_break' | 'long_break';
  durationMinutes: number;
  customInputMins: number;
  isCustomMode: boolean;
  secondsRemaining: number;
  isActive: boolean;
  isPaused: boolean;
  targetEndTime: number | null;
  sessionTaskNote: string;
  activeDeviceMode: DeviceFocusMode | null;
}

export interface FocusTimerCompletionResult {
  completed: boolean;
  alreadyFinalized: boolean;
  sessionId: string;
  sessionType: 'focus' | 'short_break' | 'long_break';
  durationMinutes: number;
  xpAwarded: number;
  notes: string;
  activeDeviceMode: DeviceFocusMode | null;
  nextState: FocusTimerPersistentState;
}

export interface ReconcileFocusTimerOptions {
  nowMs?: number;
  forceComplete?: boolean;
  database?: DatabaseManager;
  onPlaySound?: (volume: number) => void;
  onNotify?: (notification: {
    title: string;
    message: string;
    type: 'focus' | 'reminder' | 'system';
  }) => void;
  onCelebrate?: () => void;
  onRestoreDeviceMode?: (activeMode: DeviceFocusMode) => void | Promise<void>;
}

let inMemoryTimerState: FocusTimerPersistentState | null = null;
const finalizedFocusSessionIds = new Set<string>();
const completionListeners = new Set<(result: FocusTimerCompletionResult) => void>();

export function subscribeFocusTimerCompletion(
  listener: (result: FocusTimerCompletionResult) => void
): () => void {
  completionListeners.add(listener);
  return () => {
    completionListeners.delete(listener);
  };
}

/**
 * Resolves the local calendar date (YYYY-MM-DD) for a FocusSession's startTime.
 */
export function getFocusSessionLocalDate(session: Pick<FocusSession, 'startTime'>): string {
  const raw = session.startTime?.trim() || '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return formatLocalDate(parsed);
  }
  return raw.slice(0, 10);
}

/**
 * Filters completed focus sessions belonging to the specified local calendar date.
 */
export function filterTodayFocusSessions(
  sessions: FocusSession[],
  todayLocalDateStr: string = formatLocalDate(new Date())
): FocusSession[] {
  return sessions.filter(
    s => Boolean(s.completed) && getFocusSessionLocalDate(s) === todayLocalDateStr
  );
}

export function createNewFocusSessionId(): string {
  return `fs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createDefaultFocusTimerState(defaultFocusMinutes: number = 25): FocusTimerPersistentState {
  const mins = Math.max(1, defaultFocusMinutes || 25);
  return {
    sessionId: createNewFocusSessionId(),
    sessionType: 'focus',
    durationMinutes: mins,
    customInputMins: mins,
    isCustomMode: false,
    secondsRemaining: mins * 60,
    isActive: false,
    isPaused: false,
    targetEndTime: null,
    sessionTaskNote: '',
    activeDeviceMode: null,
  };
}

export function saveFocusTimerState(state: FocusTimerPersistentState): void {
  inMemoryTimerState = { ...state };
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(FOCUS_TIMER_STORAGE_KEY, JSON.stringify(inMemoryTimerState));
    } catch {
      // Ignore storage quota errors
    }
  }
}

export function loadRawFocusTimerState(): FocusTimerPersistentState | null {
  if (inMemoryTimerState) {
    return { ...inMemoryTimerState };
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(FOCUS_TIMER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<FocusTimerPersistentState>;
        if (
          parsed &&
          typeof parsed.durationMinutes === 'number' &&
          typeof parsed.secondsRemaining === 'number'
        ) {
          const hydrated: FocusTimerPersistentState = {
            sessionId: typeof parsed.sessionId === 'string' && parsed.sessionId ? parsed.sessionId : createNewFocusSessionId(),
            sessionType:
              parsed.sessionType === 'short_break' || parsed.sessionType === 'long_break'
                ? parsed.sessionType
                : 'focus',
            durationMinutes: parsed.durationMinutes,
            customInputMins:
              typeof parsed.customInputMins === 'number' ? parsed.customInputMins : parsed.durationMinutes,
            isCustomMode: Boolean(parsed.isCustomMode),
            secondsRemaining: parsed.secondsRemaining,
            isActive: Boolean(parsed.isActive),
            isPaused: Boolean(parsed.isPaused),
            targetEndTime: typeof parsed.targetEndTime === 'number' ? parsed.targetEndTime : null,
            sessionTaskNote: typeof parsed.sessionTaskNote === 'string' ? parsed.sessionTaskNote : '',
            activeDeviceMode: parsed.activeDeviceMode ?? null,
          };
          inMemoryTimerState = hydrated;
          return { ...hydrated };
        }
      }
    } catch {
      // Ignore malformed storage
    }
  }
  return null;
}

export function clearFocusTimerState(): void {
  inMemoryTimerState = null;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(FOCUS_TIMER_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
}

/**
 * Restores an active or paused timer state across view navigation or page reload.
 * Recomputes remaining seconds from targetEndTime when running so elapsed time is accurate.
 */
export function resolveRestoredFocusTimerState(
  defaultFocusMinutes: number = 25,
  nowMs: number = Date.now()
): FocusTimerPersistentState {
  const saved = loadRawFocusTimerState();
  if (!saved) {
    return createDefaultFocusTimerState(defaultFocusMinutes);
  }

  if (saved.isActive && saved.targetEndTime) {
    const remaining = Math.max(0, Math.round((saved.targetEndTime - nowMs) / 1000));
    return {
      ...saved,
      secondsRemaining: remaining,
      isActive: true,
      isPaused: false,
    };
  }

  if (saved.isPaused) {
    return {
      ...saved,
      secondsRemaining: Math.max(1, saved.secondsRemaining),
      isActive: false,
      isPaused: true,
      targetEndTime: null,
    };
  }

  return {
    ...saved,
    isActive: false,
    isPaused: false,
    targetEndTime: null,
  };
}

/**
 * Checks if an active focus timer has reached or passed its targetEndTime and finalizes it
 * at most once across the entire application lifecycle.
 * Paused or inactive timers are never finalized by expiration checks.
 */
export function reconcileExpiredFocusTimer(
  options: ReconcileFocusTimerOptions = {}
): FocusTimerCompletionResult | null {
  const nowMs = options.nowMs ?? Date.now();
  const database = options.database ?? db;
  const saved = loadRawFocusTimerState();

  if (!saved) {
    return null;
  }

  if (!options.forceComplete) {
    if (!saved.isActive || saved.targetEndTime === null) {
      return null;
    }
    if (nowMs < saved.targetEndTime) {
      return null;
    }
  }

  const settings = database.getSettings();
  const nextSessionType: 'focus' | 'short_break' =
    saved.sessionType === 'focus' ? 'short_break' : 'focus';
  const nextMins =
    nextSessionType === 'short_break'
      ? Math.max(1, settings.defaultShortBreakMinutes || 5)
      : Math.max(1, settings.defaultFocusDurationMinutes || 25);

  const nextState: FocusTimerPersistentState = {
    sessionId: createNewFocusSessionId(),
    sessionType: nextSessionType,
    durationMinutes: nextMins,
    customInputMins: nextMins,
    isCustomMode: false,
    secondsRemaining: nextMins * 60,
    isActive: false,
    isPaused: false,
    targetEndTime: null,
    sessionTaskNote: saved.sessionTaskNote,
    activeDeviceMode: null,
  };

  const alreadyInDb =
    saved.sessionType === 'focus' &&
    database.getFocusSessions().some(s => s.id === saved.sessionId);
  const alreadyFinalized = finalizedFocusSessionIds.has(saved.sessionId) || alreadyInDb;

  // Transition state immediately so concurrent or subsequent checks see an inactive timer
  finalizedFocusSessionIds.add(saved.sessionId);
  saveFocusTimerState(nextState);

  if (alreadyFinalized) {
    return {
      completed: false,
      alreadyFinalized: true,
      sessionId: saved.sessionId,
      sessionType: saved.sessionType,
      durationMinutes: saved.durationMinutes,
      xpAwarded: 0,
      notes: saved.sessionTaskNote || 'Custom focus sprint',
      activeDeviceMode: saved.activeDeviceMode,
      nextState,
    };
  }

  options.onPlaySound?.(settings.soundVolume);

  if (saved.activeDeviceMode) {
    void options.onRestoreDeviceMode?.(saved.activeDeviceMode);
  }

  let xpAwarded = 0;
  const notes = saved.sessionTaskNote || 'Custom focus sprint';

  if (saved.sessionType === 'focus') {
    const endMs = saved.targetEndTime ?? nowMs;
    const startMs = endMs - saved.durationMinutes * 60000;
    const outcome = database.recordFocusSession({
      id: saved.sessionId,
      startTime: new Date(startMs).toISOString(),
      endTime: new Date(endMs).toISOString(),
      durationMinutes: saved.durationMinutes,
      type: 'focus',
      completed: true,
      notes,
    });
    xpAwarded = outcome.xpAwarded;

    options.onNotify?.({
      title: 'Focus Sprint Completed!',
      message:
        xpAwarded > 0
          ? `Finished ${saved.durationMinutes} minutes (+${xpAwarded} XP)`
          : `Finished ${saved.durationMinutes} minutes`,
      type: 'focus',
    });
    options.onCelebrate?.();
  } else {
    options.onNotify?.({
      title: 'Break Finished',
      message: 'Recharged and ready to focus?',
      type: 'reminder',
    });
  }

  const result: FocusTimerCompletionResult = {
    completed: true,
    alreadyFinalized: false,
    sessionId: saved.sessionId,
    sessionType: saved.sessionType,
    durationMinutes: saved.durationMinutes,
    xpAwarded,
    notes,
    activeDeviceMode: saved.activeDeviceMode,
    nextState,
  };

  completionListeners.forEach(listener => listener(result));
  return result;
}
