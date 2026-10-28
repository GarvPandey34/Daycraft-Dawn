import test from 'node:test';
import assert from 'node:assert/strict';
import { getNextOccurrenceDate, hasDuplicateOccurrence } from '../src/services/recurrenceService';
import { RecurrenceRule } from '../src/domain/models';

test('daily recurrence advances by 1 day', () => {
  const rule: RecurrenceRule = { type: 'daily' };
  const next = getNextOccurrenceDate('2026-10-21', rule, '2026-10-21');
  assert.equal(next, '2026-10-22');
});

test('weekdays recurrence skips weekend', () => {
  const rule: RecurrenceRule = { type: 'weekdays' };
  // 2026-10-23 is Friday
  const next = getNextOccurrenceDate('2026-10-23', rule, '2026-10-23');
  // Next weekday must be Monday 2026-10-26
  assert.equal(next, '2026-10-26');
});

test('custom interval recurrence respects interval days', () => {
  const rule: RecurrenceRule = { type: 'custom', intervalDays: 3 };
  const next = getNextOccurrenceDate('2026-10-21', rule, '2026-10-21');
  assert.equal(next, '2026-10-24');
});

test('recurrence respects endDate boundary', () => {
  const rule: RecurrenceRule = { type: 'daily', endDate: '2026-10-22' };
  const next1 = getNextOccurrenceDate('2026-10-21', rule, '2026-10-21');
  assert.equal(next1, '2026-10-22');

  const next2 = getNextOccurrenceDate('2026-10-22', rule, '2026-10-22');
  assert.equal(next2, null); // Beyond endDate
});

test('hasDuplicateOccurrence detects duplicate dates', () => {
  const existing = ['2026-10-21', '2026-10-22'];
  assert.equal(hasDuplicateOccurrence(existing, '2026-10-21'), true);
  assert.equal(hasDuplicateOccurrence(existing, '2026-10-23'), false);
});
