import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBackupArchive,
  DaycraftBackupData,
  validateBackupArchive,
} from '../src/services/backupService';

const sampleData: DaycraftBackupData = {
  tasks: [],
  habits: [],
  habitOccurrences: [],
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
  achievements: [],
  xpLedger: [],
};

test('createBackupArchive produces valid checksum and format', () => {
  const archive = createBackupArchive('Daycraft', sampleData, 1);

  assert.equal(archive.manifest.format, 'daycraft_archive');
  assert.equal(archive.manifest.appName, 'Daycraft');
  assert.ok(archive.manifest.checksum.startsWith('dc_crc32_'));

  const validation = validateBackupArchive(archive);
  assert.equal(validation.valid, true);
  assert.equal(validation.errors.length, 0);
});

test('validateBackupArchive detects corrupted payload checksum', () => {
  const archive = createBackupArchive('Daycraft', sampleData, 1);
  // Tamper with the checksum
  archive.manifest.checksum = 'dc_crc32_invalid_corrupted';

  const validation = validateBackupArchive(archive);
  assert.equal(validation.valid, false);
  assert.match(validation.errors[0], /checksum mismatch/i);
});

test('validateBackupArchive detects missing required tables', () => {
  const brokenData = { tasks: [] }; // missing all other tables
  const brokenArchive = {
    manifest: {
      format: 'daycraft_archive',
      version: 1,
      appName: 'Daycraft',
      createdAt: '2026-10-21T00:00:00Z',
      schemaVersion: 1,
      recordCounts: {},
      checksum: 'fake',
    },
    data: brokenData,
  };

  const validation = validateBackupArchive(brokenArchive);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some(e => e.includes("Table 'habits' is missing")));
});
