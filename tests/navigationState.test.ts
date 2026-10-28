import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NavigationStateManager,
  isPrimaryWorkspaceView,
  isValidDestination,
  PRIMARY_WORKSPACE_ITEMS,
} from '../src/components/navigationState';
import { DatabaseManager } from '../src/database/db';
import {
  scheduleTaskToCalendar,
  getDailyActivitySummary,
  formatDailySummaryMarkdown,
  performEndOfDayShutdown,
  getBackupReminderStatus,
  setTaskDragData,
  extractDraggedTaskId,
  handleTaskDropToCalendar,
  TASK_DRAG_MIME,
} from '../src/services/workflowConnectService';
import { Task } from '../src/domain/models';

test('NavigationStateManager manages view transitions between Tasks, Journal, and Calendar', () => {
  const manager = new NavigationStateManager('tasks');

  assert.equal(manager.getCurrentView(), 'tasks');
  assert.equal(manager.getSnapshot().lastPrimaryView, 'tasks');
  assert.equal(manager.getSnapshot().previousView, null);

  const observed: string[] = [];
  const unsubscribe = manager.subscribe(snap => {
    observed.push(snap.currentView);
  });

  manager.setView('journal', { syncHistory: false });
  assert.equal(manager.getCurrentView(), 'journal');
  assert.equal(manager.getSnapshot().previousView, 'tasks');
  assert.equal(manager.getSnapshot().lastPrimaryView, 'journal');

  manager.setView('calendar', { syncHistory: false });
  assert.equal(manager.getCurrentView(), 'calendar');
  assert.equal(manager.getSnapshot().previousView, 'journal');
  assert.equal(manager.getSnapshot().lastPrimaryView, 'calendar');

  // Cycling primary workspaces moves Calendar -> Tasks -> Journal -> Calendar
  assert.equal(manager.cyclePrimaryWorkspace(), 'tasks');
  assert.equal(manager.getCurrentView(), 'tasks');
  assert.equal(manager.cyclePrimaryWorkspace(), 'journal');
  assert.equal(manager.getCurrentView(), 'journal');
  assert.equal(manager.cyclePrimaryWorkspace(), 'calendar');
  assert.equal(manager.getCurrentView(), 'calendar');

  unsubscribe();
  assert.deepEqual(observed, ['journal', 'calendar', 'tasks', 'journal', 'calendar']);
});

test('NavigationStateManager supports Zen Mode, Collapsible Groups, and Pinned Favorites (max 4)', () => {
  const manager = new NavigationStateManager('tasks');

  assert.equal(manager.getSnapshot().zenMode, false);
  assert.equal(manager.toggleZenMode(), true);
  assert.equal(manager.getSnapshot().zenMode, true);
  assert.equal(manager.toggleZenMode(false), false);

  assert.deepEqual(manager.getSnapshot().collapsedGroups, []);
  manager.toggleGroupCollapsed('planning');
  assert.deepEqual(manager.getSnapshot().collapsedGroups, ['planning']);
  manager.toggleGroupCollapsed('planning');
  assert.deepEqual(manager.getSnapshot().collapsedGroups, []);

  assert.deepEqual(manager.getSnapshot().pinnedDestinations, ['tasks', 'journal', 'calendar']);
  manager.togglePinnedDestination('myday');
  assert.deepEqual(manager.getSnapshot().pinnedDestinations, ['tasks', 'journal', 'calendar', 'myday']);

  // Pinning a 5th item keeps max 4
  manager.togglePinnedDestination('habits');
  assert.equal(manager.getSnapshot().pinnedDestinations.length, 4);
  assert.ok(manager.getSnapshot().pinnedDestinations.includes('habits'));

  assert.equal(isPrimaryWorkspaceView('tasks'), true);
  assert.equal(isPrimaryWorkspaceView('journal'), true);
  assert.equal(isPrimaryWorkspaceView('calendar'), true);
  assert.equal(isPrimaryWorkspaceView('settings'), false);
  assert.equal(isValidDestination('calendar'), true);
  assert.equal(isValidDestination('invalid_view'), false);
  assert.deepEqual(
    PRIMARY_WORKSPACE_ITEMS.map(i => i.id),
    ['tasks', 'journal', 'calendar']
  );
});

test('Workflow Connect: scheduleTaskToCalendar, Daily Activity Auto-Summary, 2-Minute Shutdown, and 14-day Backup Reminder', () => {
  const db = new DatabaseManager(false);
  db.migrateAndLoad({
    schemaVersion: 1,
    tasks: [],
    habits: [],
    habitOccurrences: [],
    habitRoutines: [],
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
    settings: db.getSettings(),
  });

  const date = '2026-10-27';
  const task1: Task = {
    id: 't_connect_1',
    title: 'Write architecture notes',
    description: '',
    createdAt: '2026-10-27T08:00:00.000Z',
    updatedAt: '2026-10-27T08:00:00.000Z',
    status: 'todo',
    priority: 'high',
    dueDate: date,
    estimatedMinutes: 60,
    tags: [],
    archived: false,
  };
  db.saveTask(task1);

  // 1. Send Task to Calendar creates a TimeBlock and prevents duplicates
  const firstSchedule = scheduleTaskToCalendar(task1, { date }, db);
  assert.equal(firstSchedule.alreadyScheduled, false);
  assert.equal(firstSchedule.block.linkedTaskId, task1.id);
  assert.equal(firstSchedule.block.date, date);

  const secondSchedule = scheduleTaskToCalendar(task1, { date }, db);
  assert.equal(secondSchedule.alreadyScheduled, true);
  assert.equal(secondSchedule.block.id, firstSchedule.block.id);

  // 2. Daily Activity Summary aggregates completed tasks, habits, and focus sessions
  const doneTask: Task = {
    id: 't_done_1',
    title: 'Ship sidebar navigation',
    description: '',
    createdAt: '2026-10-27T08:00:00.000Z',
    updatedAt: '2026-10-27T08:30:00.000Z',
    status: 'completed',
    completedAt: '2026-10-27T08:30:00.000Z',
    priority: 'medium',
    dueDate: date,
    tags: [],
    archived: false,
  };
  db.saveTask(doneTask);

  db.recordFocusSession({
    id: 'fs_1',
    startTime: `${date}T09:00:00`,
    endTime: `${date}T09:25:00`,
    durationMinutes: 25,
    type: 'focus',
    completed: true,
  });

  const summary = getDailyActivitySummary(date, db);
  assert.equal(summary.completedTasks.length, 1);
  assert.equal(summary.completedTasks[0].title, 'Ship sidebar navigation');
  assert.equal(summary.focusMinutes, 25);
  assert.ok(formatDailySummaryMarkdown(summary).includes('Ship sidebar navigation'));

  // 3. 2-Minute End-of-Day Shutdown rolls unfinished task1 over to tomorrow and saves Journal reflection
  const shutdownRes = performEndOfDayShutdown(
    {
      date,
      rolloverUnfinishedTasks: true,
      reflectionLine: 'Focused sprint on navigation and cross-linking.',
      mood: 5,
    },
    db
  );

  assert.equal(shutdownRes.rolledOverCount, 1);
  assert.equal(shutdownRes.targetTomorrowDate, '2026-10-28');
  const updatedTask1 = db.getTasks().find(t => t.id === task1.id);
  assert.equal(updatedTask1?.dueDate, '2026-10-28');
  assert.ok(shutdownRes.journalEntry);
  assert.ok(shutdownRes.journalEntry?.content.includes('Focused sprint on navigation and cross-linking.'));

  // 4. 14-day Automatic Local Backup Reminder
  const neverBackedUp = getBackupReminderStatus({ lastBackupDate: undefined, autoBackupDays: 14 });
  assert.equal(neverBackedUp.isDue, true);

  const recentBackup = getBackupReminderStatus(
    { lastBackupDate: '2026-10-25T00:00:00.000Z', autoBackupDays: 14 },
    new Date('2026-10-27T12:00:00.000Z')
  );
  assert.equal(recentBackup.isDue, false);

  const staleBackup = getBackupReminderStatus(
    { lastBackupDate: '2026-10-01T00:00:00.000Z', autoBackupDays: 14 },
    new Date('2026-10-27T12:00:00.000Z')
  );
  assert.equal(staleBackup.isDue, true);
  assert.equal(staleBackup.daysSinceLastBackup, 26);
});

test('Task-to-Calendar Drag-and-Drop handler encodes payload, extracts task ID, and schedules/moves TimeBlocks', () => {
  const db = new DatabaseManager(false);
  db.migrateAndLoad({
    tasks: [],
    projects: [],
    notes: [],
    journals: [],
    habits: [],
    goals: [],
    milestones: [],
    calendarEvents: [],
    timeBlocks: [],
    focusSessions: [],
    weeklyReviews: [],
    monthlyReviews: [],
    templates: [],
  });

  const dragTask: Task = {
    id: 't_drag_calendar_1',
    title: 'Design System Polish',
    description: 'Audit spacing and tokens',
    createdAt: '2026-10-27T08:00:00.000Z',
    updatedAt: '2026-10-27T08:00:00.000Z',
    status: 'todo',
    priority: 'urgent',
    estimatedMinutes: 90,
    tags: [],
    archived: false,
  };
  db.saveTask(dragTask);

  // Mock DataTransfer object
  const store = new Map<string, string>();
  const mockDataTransfer = {
    effectAllowed: 'none',
    setData: (type: string, val: string) => {
      store.set(type, val);
    },
    getData: (type: string) => store.get(type) || '',
  };

  setTaskDragData(mockDataTransfer, dragTask.id);
  assert.equal(store.get(TASK_DRAG_MIME), dragTask.id);

  const extractedId = extractDraggedTaskId(mockDataTransfer, null, db);
  assert.equal(extractedId, dragTask.id);

  // Drop task onto 10:30 time slot on 2026-10-27
  const dropResult1 = handleTaskDropToCalendar(
    extractedId!,
    { date: '2026-10-27', startTime: '10:30' },
    db
  );
  assert.ok(dropResult1);
  assert.equal(dropResult1.updatedExisting, false);
  assert.equal(dropResult1.block.linkedTaskId, dragTask.id);
  assert.equal(dropResult1.block.date, '2026-10-27');
  assert.equal(dropResult1.block.startTime, '10:30');
  assert.equal(dropResult1.block.endTime, '12:00'); // 90m duration
  assert.equal(db.getTimeBlocks().length, 1);

  // Dropping the same task onto a different slot (14:00) on the same day moves the existing block instead of duplicating
  const dropResult2 = handleTaskDropToCalendar(
    dragTask.id,
    { date: '2026-10-27', startTime: '14:00' },
    db
  );
  assert.ok(dropResult2);
  assert.equal(dropResult2.updatedExisting, true);
  assert.equal(dropResult2.block.id, dropResult1.block.id);
  assert.equal(dropResult2.block.startTime, '14:00');
  assert.equal(dropResult2.block.endTime, '15:30');
  assert.equal(db.getTimeBlocks().length, 1);
});

