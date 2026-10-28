import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNaturalLanguageInput } from '../src/services/nlpParserService';

test('parses "Study machine learning tomorrow at 7 PM for 45 minutes"', () => {
  // Reference date: Wednesday 2026-10-21
  const refDate = new Date(2026, 9, 21, 10, 0, 0);
  const result = parseNaturalLanguageInput('Study machine learning tomorrow at 7 PM for 45 minutes', refDate);

  assert.equal(result.title, 'Study machine learning');
  assert.equal(result.date, '2026-10-22');
  assert.equal(result.time, '19:00');
  assert.equal(result.durationMinutes, 45);
});

test('parses habit with daily recurrence and tags', () => {
  const refDate = new Date(2026, 9, 21, 10, 0, 0);
  const result = parseNaturalLanguageInput('Drink 8 glasses of water every day #health', refDate);

  assert.equal(result.detectedType, 'habit');
  assert.equal(result.recurrence, 'daily');
  assert.equal(result.habitTargetValue, 8);
  assert.equal(result.habitTargetUnit, 'glasses');
  assert.deepEqual(result.tags, ['health']);
});

test('parses priority and weekday target', () => {
  const refDate = new Date(2026, 9, 21, 10, 0, 0); // Wednesday Oct 21
  const result = parseNaturalLanguageInput('Deploy server patch on friday at 2pm !urgent', refDate);

  assert.equal(result.priority, 'urgent');
  assert.equal(result.date, '2026-10-23'); // Friday Oct 23
  assert.equal(result.time, '14:00');
});
