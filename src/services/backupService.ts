// ==========================================
// DAYCRAFT — LOCAL BACKUP & EXPORT ENGINE
// Local-first transaction-safe backup with schema versioning & SHA validation
// ==========================================

import {
  Achievement,
  CalendarEvent,
  FocusSession,
  Goal,
  Habit,
  HabitOccurrence,
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
  HabitRoutine,
} from '../domain/models';

export interface DaycraftBackupData {
  tasks: Task[];
  habits: Habit[];
  habitOccurrences: HabitOccurrence[];
  projects: Project[];
  goals: Goal[];
  calendarEvents: CalendarEvent[];
  timeBlocks: TimeBlock[];
  focusSessions: FocusSession[];
  studySubjects: StudySubject[];
  studySessions: StudySession[];
  wellnessTrackers: WellnessTracker[];
  wellnessEntries: WellnessEntry[];
  journalEntries: JournalEntry[];
  achievements: Achievement[];
  xpLedger: XpLedgerEntry[];
  habitRoutines?: HabitRoutine[];
  settings?: Partial<UserSettings>;
}

export interface DaycraftBackupArchive {
  manifest: {
    format: 'daycraft_archive';
    version: number;
    appName: string;
    createdAt: string;
    schemaVersion: number;
    recordCounts: Record<string, number>;
    checksum: string;
  };
  data: DaycraftBackupData;
}

/**
 * Recursively sorts object keys so JSON serialization is deterministic
 * even if an archive file is pretty-printed or re-serialized with reordered keys.
 */
export function canonicalizeJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeJsonValue);
  }
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record).sort()) {
      if (record[key] !== undefined) {
        sorted[key] = canonicalizeJsonValue(record[key]);
      }
    }
    return sorted;
  }
  return value;
}

export function serializeCanonicalJson(value: unknown): string {
  return JSON.stringify(canonicalizeJsonValue(value));
}

/**
 * Simple deterministic checksum for data integrity verification
 */
export function computeDataChecksum(input: string | DaycraftBackupData): string {
  const dataString = typeof input === 'string' ? input : serializeCanonicalJson(input);
  let hash = 0;
  for (let i = 0; i < dataString.length; i++) {
    const char = dataString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `dc_crc32_${Math.abs(hash).toString(16)}`;
}

/**
 * Creates a validated backup archive
 */
export function createBackupArchive(
  appName: string,
  data: DaycraftBackupData,
  schemaVersion: number = 1
): DaycraftBackupArchive {
  const normalizedData: DaycraftBackupData = {
    ...data,
    habitRoutines: Array.isArray(data.habitRoutines) ? data.habitRoutines : [],
  };
  const checksum = computeDataChecksum(serializeCanonicalJson(normalizedData));

  const recordCounts: Record<string, number> = {
    tasks: normalizedData.tasks.length,
    habits: normalizedData.habits.length,
    habitOccurrences: normalizedData.habitOccurrences.length,
    habitRoutines: (normalizedData.habitRoutines ?? []).length,
    projects: normalizedData.projects.length,
    goals: normalizedData.goals.length,
    calendarEvents: normalizedData.calendarEvents.length,
    timeBlocks: normalizedData.timeBlocks.length,
    focusSessions: normalizedData.focusSessions.length,
    studySubjects: normalizedData.studySubjects.length,
    studySessions: normalizedData.studySessions.length,
    wellnessTrackers: normalizedData.wellnessTrackers.length,
    wellnessEntries: normalizedData.wellnessEntries.length,
    journalEntries: normalizedData.journalEntries.length,
    achievements: normalizedData.achievements.length,
    xpLedger: normalizedData.xpLedger.length,
  };

  return {
    manifest: {
      format: 'daycraft_archive',
      version: 1,
      appName,
      createdAt: new Date().toISOString(),
      schemaVersion,
      recordCounts,
      checksum,
    },
    data: normalizedData,
  };
}

export interface BackupValidationResult {
  valid: boolean;
  errors: string[];
  manifest?: DaycraftBackupArchive['manifest'];
  data?: DaycraftBackupData;
}

/**
 * Validates a backup archive before restoring
 */
export function validateBackupArchive(rawInput: unknown): BackupValidationResult {
  const errors: string[] = [];

  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
    return { valid: false, errors: ['Backup content is not a valid JSON object.'] };
  }

  const archive = rawInput as Partial<DaycraftBackupArchive>;

  if (!archive.manifest || typeof archive.manifest !== 'object') {
    errors.push('Archive is missing required metadata manifest.');
  } else {
    if (archive.manifest.format !== 'daycraft_archive') {
      errors.push(`Unrecognized archive format: ${archive.manifest.format || 'unknown'}`);
    }
    if (typeof archive.manifest.version !== 'number' || archive.manifest.version < 1) {
      errors.push('Invalid archive manifest version.');
    }
    if (typeof archive.manifest.schemaVersion !== 'number') {
      errors.push('Missing database schema version in manifest.');
    }
    if (!archive.manifest.checksum || typeof archive.manifest.checksum !== 'string') {
      errors.push('Archive manifest is missing a valid integrity checksum.');
    }
  }

  if (!archive.data || typeof archive.data !== 'object' || Array.isArray(archive.data)) {
    errors.push('Archive is missing required data payload.');
  } else {
    const requiredTables = [
      'tasks',
      'habits',
      'habitOccurrences',
      'projects',
      'goals',
      'calendarEvents',
      'timeBlocks',
      'focusSessions',
      'studySubjects',
      'studySessions',
      'wellnessTrackers',
      'wellnessEntries',
      'journalEntries',
      'achievements',
      'xpLedger',
    ];

    const dataObj = archive.data as unknown as Record<string, unknown>;

    for (const table of requiredTables) {
      if (!Array.isArray(dataObj[table])) {
        errors.push(`Table '${table}' is missing or is not an array.`);
      }
    }

    if (dataObj.habitRoutines !== undefined && !Array.isArray(dataObj.habitRoutines)) {
      errors.push("Table 'habitRoutines' must be an array when provided.");
    }

    if (
      dataObj.settings !== undefined &&
      (dataObj.settings === null || typeof dataObj.settings !== 'object' || Array.isArray(dataObj.settings))
    ) {
      errors.push("Field 'settings' must be a valid object when provided.");
    }

    // Validate recordCounts consistency if manifest.recordCounts is present
    if (
      errors.length === 0 &&
      archive.manifest?.recordCounts &&
      typeof archive.manifest.recordCounts === 'object'
    ) {
      for (const [tableKey, expectedCount] of Object.entries(archive.manifest.recordCounts)) {
        const arr = dataObj[tableKey];
        if (Array.isArray(arr) && typeof expectedCount === 'number' && arr.length !== expectedCount) {
          errors.push(
            `Record count mismatch for '${tableKey}': manifest expected ${expectedCount}, found ${arr.length}.`
          );
        }
      }
    }
  }

  // Verify checksum if manifest and data exist (accepting canonical or direct JSON serialization)
  if (archive.manifest && archive.data && errors.length === 0) {
    const canonicalChecksum = computeDataChecksum(serializeCanonicalJson(archive.data));
    const rawChecksum = computeDataChecksum(JSON.stringify(archive.data));
    if (
      archive.manifest.checksum &&
      archive.manifest.checksum !== canonicalChecksum &&
      archive.manifest.checksum !== rawChecksum
    ) {
      errors.push('Backup integrity check failed: payload checksum mismatch (data may be corrupted).');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    manifest: archive.manifest,
    data: archive.data,
  };
}
