import test from 'node:test';
import assert from 'node:assert';
import {
  getSevenDayCompletionData,
  getTaskCompletionDate,
} from '../src/services/completionAnalyticsService';
import { Habit, HabitOccurrence, Task } from '../src/domain/models';

test('getTaskCompletionDate correctly resolves completion timestamp', () => {
  const task1: Task = {
    id: 't1',
    title: 'Test',
    description: '',
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T12:00:00.000Z',
    status: 'completed',
    priority: 'medium',
    completedAt: '2026-10-21T08:30:00.000Z',
    archived: false,
    tags: [],
  };
  const date = getTaskCompletionDate(task1);
  assert.ok(date);
  assert.strictEqual(date, '2026-10-21');
});

test('getTaskCompletionDate returns null for uncompleted tasks', () => {
  const task: Task = {
    id: 't2',
    title: 'Todo',
    description: '',
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T12:00:00.000Z',
    status: 'todo',
    priority: 'medium',
    archived: false,
    tags: [],
  };
  assert.strictEqual(getTaskCompletionDate(task), null);
});

test('getSevenDayCompletionData aggregates past 7 days accurately', () => {
  const refDate = '2026-10-21';
  const habits: Habit[] = [
    {
      id: 'h1',
      name: 'Hydration',
      description: '',
      category: 'wellness',
      icon: 'Droplet',
      color: '#0284C7',
      startDate: '2026-10-01',
      scheduleType: 'daily',
      targetType: 'numeric',
      targetValue: 8,
      targetUnit: 'glasses',
      archived: false,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    },
  ];

  const occurrences: HabitOccurrence[] = [
    { id: 'o1', habitId: 'h1', date: '2026-10-21', recordedValue: 8, targetValue: 8, status: 'completed' },
    { id: 'o2', habitId: 'h1', date: '2026-10-20', recordedValue: 8, targetValue: 8, status: 'completed' },
    { id: 'o3', habitId: 'h1', date: '2026-10-19', recordedValue: 4, targetValue: 8, status: 'missed' }, // should not count
  ];

  const tasks: Task[] = [
    {
      id: 't1',
      title: 'Task 1',
      description: '',
      createdAt: '2026-10-21T00:00:00Z',
      updatedAt: '2026-10-21T00:00:00Z',
      status: 'completed',
      priority: 'high',
      completedAt: '2026-10-21T10:00:00Z',
      archived: false,
      tags: [],
    },
    {
      id: 't2',
      title: 'Task 2',
      description: '',
      createdAt: '2026-10-20T00:00:00Z',
      updatedAt: '2026-10-20T00:00:00Z',
      status: 'completed',
      priority: 'medium',
      completedAt: '2026-10-20T11:00:00Z',
      archived: false,
      tags: [],
    },
    {
      id: 't3_old',
      title: 'Old Task',
      description: '',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      status: 'completed',
      priority: 'low',
      completedAt: '2026-10-10T00:00:00Z', // 11 days ago, outside 7-day window
      archived: false,
      tags: [],
    },
  ];

  const summary = getSevenDayCompletionData(tasks, habits, occurrences, refDate);

  assert.strictEqual(summary.days.length, 7);
  // Last day is today (2026-10-21)
  const todayEntry = summary.days[6];
  assert.strictEqual(todayEntry.date, '2026-10-21');
  assert.strictEqual(todayEntry.isToday, true);
  assert.strictEqual(todayEntry.tasksCount, 1);
  assert.strictEqual(todayEntry.habitsCount, 1);
  assert.strictEqual(todayEntry.totalCount, 2);

  // Yesterday (2026-10-20)
  const yesterdayEntry = summary.days[5];
  assert.strictEqual(yesterdayEntry.date, '2026-10-20');
  assert.strictEqual(yesterdayEntry.tasksCount, 1);
  assert.strictEqual(yesterdayEntry.habitsCount, 1);

  // Total tasks in 7 days should be 2 (old task excluded)
  assert.strictEqual(summary.totalTasks, 2);
  assert.strictEqual(summary.totalHabits, 2);
  assert.strictEqual(summary.grandTotal, 4);
});
