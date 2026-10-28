import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateHabitStreak, isHabitScheduledOnDate } from '../src/services/streakService';
import { Habit, HabitOccurrence } from '../src/domain/models';

test('isHabitScheduledOnDate respects planned rest days', () => {
  const habit: Habit = {
    id: 'h1',
    name: 'Morning Run',
    description: '',
    category: 'fitness',
    icon: 'Activity',
    color: '#E86E4A',
    startDate: '2026-10-01',
    scheduleType: 'daily',
    targetType: 'duration',
    targetValue: 30,
    targetUnit: 'mins',
    archived: false,
    restDays: [0], // Sunday is rest day
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  };

  // 2026-10-18 is Sunday (getDay() === 0)
  assert.equal(isHabitScheduledOnDate(habit, '2026-10-18'), false);
  // 2026-10-19 is Monday (getDay() === 1)
  assert.equal(isHabitScheduledOnDate(habit, '2026-10-19'), true);
});

test('streak does not break on planned rest day', () => {
  const habit: Habit = {
    id: 'h2',
    name: 'Gym Workout',
    description: '',
    category: 'fitness',
    icon: 'Dumbbell',
    color: '#3E7051',
    startDate: '2026-10-16', // Friday
    scheduleType: 'daily',
    targetType: 'boolean',
    targetValue: 1,
    targetUnit: 'done',
    archived: false,
    restDays: [0], // Sunday is rest day
    createdAt: '2026-10-16T00:00:00Z',
    updatedAt: '2026-10-16T00:00:00Z',
  };

  // Friday: completed
  // Saturday: completed
  // Sunday: Rest day (no completion required!)
  // Monday: completed
  const occurrences: HabitOccurrence[] = [
    { id: 'o1', habitId: 'h2', date: '2026-10-16', recordedValue: 1, targetValue: 1, status: 'completed' },
    { id: 'o2', habitId: 'h2', date: '2026-10-17', recordedValue: 1, targetValue: 1, status: 'completed' },
    // 2026-10-18 is Sunday (rest day)
    { id: 'o3', habitId: 'h2', date: '2026-10-19', recordedValue: 1, targetValue: 1, status: 'completed' },
  ];

  const stats = calculateHabitStreak(habit, occurrences, '2026-10-19');
  assert.equal(stats.currentStreak, 3); // 3 completed active days, unbroken across Sunday rest day
  assert.equal(stats.longestStreak, 3);
});

test('streak preserves on explicitly skipped occurrence (excused)', () => {
  const habit: Habit = {
    id: 'h3',
    name: 'Read Book',
    description: '',
    category: 'learning',
    icon: 'BookOpen',
    color: '#2563EB',
    startDate: '2026-10-15',
    scheduleType: 'daily',
    targetType: 'numeric',
    targetValue: 20,
    targetUnit: 'pages',
    archived: false,
    createdAt: '2026-10-15T00:00:00Z',
    updatedAt: '2026-10-15T00:00:00Z',
  };

  const occurrences: HabitOccurrence[] = [
    { id: 'o1', habitId: 'h3', date: '2026-10-15', recordedValue: 20, targetValue: 20, status: 'completed' },
    { id: 'o2', habitId: 'h3', date: '2026-10-16', recordedValue: 25, targetValue: 20, status: 'completed' },
    { id: 'o3', habitId: 'h3', date: '2026-10-17', recordedValue: 0, targetValue: 20, status: 'skipped', note: 'Traveling' },
    { id: 'o4', habitId: 'h3', date: '2026-10-18', recordedValue: 20, targetValue: 20, status: 'completed' },
  ];

  const stats = calculateHabitStreak(habit, occurrences, '2026-10-18');
  assert.equal(stats.currentStreak, 3); // skipped day did not break streak
});

test('genuinely missed day resets streak', () => {
  const habit: Habit = {
    id: 'h4',
    name: 'Meditate',
    description: '',
    category: 'wellness',
    icon: 'Brain',
    color: '#7C5295',
    startDate: '2026-10-15',
    scheduleType: 'daily',
    targetType: 'boolean',
    targetValue: 1,
    targetUnit: 'session',
    archived: false,
    createdAt: '2026-10-15T00:00:00Z',
    updatedAt: '2026-10-15T00:00:00Z',
  };

  // Missed Oct 16
  const occurrences: HabitOccurrence[] = [
    { id: 'o1', habitId: 'h4', date: '2026-10-15', recordedValue: 1, targetValue: 1, status: 'completed' },
    // 2026-10-16: completely missing / missed
    { id: 'o2', habitId: 'h4', date: '2026-10-17', recordedValue: 1, targetValue: 1, status: 'completed' },
    { id: 'o3', habitId: 'h4', date: '2026-10-18', recordedValue: 1, targetValue: 1, status: 'completed' },
  ];

  const stats = calculateHabitStreak(habit, occurrences, '2026-10-18');
  assert.equal(stats.currentStreak, 2); // 17 and 18
  assert.equal(stats.longestStreak, 2);
});

test('numeric habit requires recordedValue >= targetValue', () => {
  const habit: Habit = {
    id: 'h5',
    name: 'Drink Water',
    description: '',
    category: 'wellness',
    icon: 'Droplet',
    color: '#0284C7',
    startDate: '2026-10-18',
    scheduleType: 'daily',
    targetType: 'numeric',
    targetValue: 8,
    targetUnit: 'glasses',
    archived: false,
    createdAt: '2026-10-18T00:00:00Z',
    updatedAt: '2026-10-18T00:00:00Z',
  };

  // Only drank 5 glasses out of 8 target
  const occurrences: HabitOccurrence[] = [
    { id: 'o1', habitId: 'h5', date: '2026-10-18', recordedValue: 5, targetValue: 8, status: 'completed' },
  ];

  const stats = calculateHabitStreak(habit, occurrences, '2026-10-18');
  assert.equal(stats.currentStreak, 0); // 5 < 8, not completed
});
