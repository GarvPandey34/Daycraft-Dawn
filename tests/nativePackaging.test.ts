import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseManager, PRE_RESTORE_SNAPSHOT_KEY } from '../src/database/db';
import {
  detectRuntimePlatform,
  hashNotificationIdToInt,
  isCapacitorNativeRuntime,
  isTauriRuntime,
} from '../src/platform/platformDetect';
import {
  deviceAdapter,
  fileSystemAdapter,
  notificationAdapter,
} from '../src/platform/adapters';
import {
  registerHardwareBackButton,
  resolveBackButtonAction,
  syncNativeStatusBar,
} from '../src/platform/lifecycleAdapter';
import {
  clearFocusTimerState,
  createDefaultFocusTimerState,
  FOCUS_TIMER_NOTIFICATION_ID,
  getLastScheduledFocusNotificationKey,
  reconcileExpiredFocusTimer,
  saveFocusTimerState,
} from '../src/services/focusTimerStateService';
import { soundService } from '../src/services/soundService';

test('Step 1: Platform detection distinguishes web, Windows Tauri 2, and Android Capacitor', async () => {
  const originalWindow = (globalThis as any).window;
  const originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  try {
    // 1. Default headless/SSR fallback
    delete (globalThis as any).window;
    assert.equal(detectRuntimePlatform(), 'web');
    assert.equal(isTauriRuntime(), false);
    assert.equal(isCapacitorNativeRuntime(), false);

    // 2. Simulated Windows Tauri 2 environment
    (globalThis as any).window = {
      __TAURI_INTERNALS__: {
        invoke: async () => null,
      },
    };
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        platform: 'Win32',
        maxTouchPoints: 0,
      },
      configurable: true,
    });
    assert.equal(isTauriRuntime(), true);
    assert.equal(isCapacitorNativeRuntime(), false);
    assert.equal(detectRuntimePlatform(), 'windows');

    const tauriInfo = await deviceAdapter.getDeviceInfo();
    assert.equal(tauriInfo.platform, 'windows');
    assert.equal(tauriInfo.isNativeShell, true);
    assert.equal(tauriInfo.runtimeShell, 'tauri');

    // 3. Simulated Android Capacitor environment
    (globalThis as any).window = {
      Capacitor: {
        isNativePlatform: () => true,
        getPlatform: () => 'android',
      },
    };
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
        platform: 'Linux armv8l',
        maxTouchPoints: 5,
      },
      configurable: true,
    });
    assert.equal(isTauriRuntime(), false);
    assert.equal(isCapacitorNativeRuntime(), true);
    assert.equal(detectRuntimePlatform(), 'android');

    const capInfo = await deviceAdapter.getDeviceInfo();
    assert.equal(capInfo.platform, 'android');
    assert.equal(capInfo.isNativeShell, true);
    assert.equal(capInfo.runtimeShell, 'capacitor');

    // 4. Deterministic positive 31-bit integer notification ID hashing for Android AlarmManager
    const hashedId = hashNotificationIdToInt(FOCUS_TIMER_NOTIFICATION_ID);
    assert.equal(typeof hashedId, 'number');
    assert.ok(hashedId > 0 && hashedId <= 0x7fffffff);
    assert.equal(hashedId, hashNotificationIdToInt(FOCUS_TIMER_NOTIFICATION_ID));
  } finally {
    (globalThis as any).window = originalWindow;
    if (originalNavigatorDesc) {
      Object.defineProperty(globalThis, 'navigator', originalNavigatorDesc);
    }
  }
});

test('Step 1: Browser fallback works safely when native Tauri/Capacitor plugins are unavailable', async () => {
  const originalWindow = (globalThis as any).window;
  try {
    delete (globalThis as any).window;
    const hasPerm = await notificationAdapter.hasPermission();
    assert.equal(hasPerm, false);

    const reqPerm = await notificationAdapter.requestPermission();
    assert.equal(reqPerm, false);

    const db = new DatabaseManager();
    const exported = await fileSystemAdapter.exportBackupFile(db.exportArchive());
    assert.equal(exported, false);

    const imported = await fileSystemAdapter.importBackupFile();
    assert.equal(imported, null);
  } finally {
    (globalThis as any).window = originalWindow;
  }
});

test('Step 2: Backup restore preview validates archives, requires confirmation when personal data exists, and creates a pre-restore safety snapshot', () => {
  const sourceDb = new DatabaseManager();
  const now = new Date().toISOString();

  sourceDb.saveTask({
    id: 't_imported_1',
    title: 'Imported Cross-Platform Task',
    description: 'From desktop backup',
    status: 'completed',
    priority: 'high',
    tags: ['sync'],
    archived: false,
    createdAt: now,
    updatedAt: now,
  });
  sourceDb.saveGoal({
    id: 'g_imported_1',
    title: 'Ship Native Packages',
    description: 'Tauri 2 + Capacitor',
    category: 'Career',
    color: '#10b981',
    status: 'active',
    startDate: '2026-01-01',
    targetDate: '2026-12-31',
    isMeasurable: true,
    currentValue: 3,
    targetValue: 6,
    unit: 'steps',
    milestones: [],
    linkedProjectIds: [],
    linkedHabitIds: [],
    createdAt: now,
    updatedAt: now,
  });

  const backupArchive = sourceDb.exportArchive();

  // Destination device with existing personal records
  const targetDb = new DatabaseManager();
  targetDb.saveTask({
    id: 't_existing_local',
    title: 'Local Task Before Restore',
    description: 'Must be preserved in safety snapshot',
    status: 'todo',
    priority: 'medium',
    tags: [],
    archived: false,
    createdAt: now,
    updatedAt: now,
  });

  assert.equal(targetDb.hasPersonalActivity(), true);

  // 1. Invalid archive is rejected without touching existing data
  const invalidPreview = targetDb.previewBackupRestore({ invalid: true });
  assert.equal(invalidPreview.valid, false);
  assert.equal(invalidPreview.requiresConfirmation, false);
  assert.ok(invalidPreview.errors.length > 0);
  assert.equal(targetDb.getTasks().length, 1);
  assert.equal(targetDb.getTasks()[0].id, 't_existing_local');

  // 2. Valid archive on a populated device requires confirmation and provides side-by-side counts
  const validPreview = targetDb.previewBackupRestore(backupArchive);
  assert.equal(validPreview.valid, true);
  assert.equal(validPreview.requiresConfirmation, true);
  assert.equal(validPreview.existingCounts.tasks, 1);
  assert.equal(validPreview.existingCounts.goals, 0);
  assert.equal(validPreview.incomingCounts.tasks, 1);
  assert.equal(validPreview.incomingCounts.goals, 1);
  assert.ok(validPreview.incomingCounts.totalXp > 0);

  // 3. Restoring creates an automatic pre-restore safety snapshot
  const restoreRes = targetDb.restoreArchive(backupArchive);
  assert.equal(restoreRes.success, true);
  assert.equal(restoreRes.safetySnapshotCreated, true);
  assert.equal(targetDb.getTasks()[0].id, 't_imported_1');
  assert.equal(targetDb.getGoals().length, 1);

  const safetySnapshot = targetDb.getPreRestoreSafetySnapshot();
  assert.ok(safetySnapshot !== null);
  assert.equal(safetySnapshot?.data.tasks.length, 1);
  assert.equal(safetySnapshot?.data.tasks[0].id, 't_existing_local');

  // 4. Recovering from the pre-restore safety snapshot restores the original local records
  const undoRes = targetDb.restoreFromSafetySnapshot();
  assert.equal(undoRes.success, true);
  assert.equal(targetDb.getTasks().length, 1);
  assert.equal(targetDb.getTasks()[0].id, 't_existing_local');
  assert.equal(targetDb.getGoals().length, 0);
  assert.ok(PRE_RESTORE_SNAPSHOT_KEY.length > 0);
});

test('Step 3: Focus timer schedules native notification on start and cancels on pause, reset, or completion', async () => {
  const originalWindow = (globalThis as any).window;
  const scheduledCalls: any[] = [];
  const cancelledCalls: any[] = [];

  try {
    (globalThis as any).window = {
      Capacitor: {
        isNativePlatform: () => true,
        getPlatform: () => 'android',
        Plugins: {
          LocalNotifications: {
            checkPermissions: async () => ({ display: 'granted' }),
            requestPermissions: async () => ({ display: 'granted' }),
            createChannel: async () => {},
            schedule: async (opts: any) => {
              scheduledCalls.push(opts);
            },
            cancel: async (opts: any) => {
              cancelledCalls.push(opts);
            },
          },
        },
      },
    };

    clearFocusTimerState();
    scheduledCalls.length = 0;
    cancelledCalls.length = 0;

    const baseState = createDefaultFocusTimerState(25);
    const futureEnd = Date.now() + 25 * 60 * 1000;

    // 1. Starting timer schedules a native notification for targetEndTime
    saveFocusTimerState({
      ...baseState,
      sessionId: 'fs_native_notif_1',
      isActive: true,
      isPaused: false,
      targetEndTime: futureEnd,
      secondsRemaining: 1500,
    });

    assert.equal(getLastScheduledFocusNotificationKey(), `fs_native_notif_1:${futureEnd}`);

    // Wait microtask for async scheduleNotification
    await new Promise(r => setTimeout(r, 15));
    assert.equal(scheduledCalls.length, 1);
    assert.equal(
      scheduledCalls[0].notifications[0].id,
      hashNotificationIdToInt(FOCUS_TIMER_NOTIFICATION_ID)
    );

    // 2. Subsequent 250ms countdown ticks with the SAME sessionId + targetEndTime do NOT re-schedule
    saveFocusTimerState({
      ...baseState,
      sessionId: 'fs_native_notif_1',
      isActive: true,
      isPaused: false,
      targetEndTime: futureEnd,
      secondsRemaining: 1499,
    });
    await new Promise(r => setTimeout(r, 15));
    assert.equal(scheduledCalls.length, 1);

    // 3. Pausing the timer cancels the scheduled notification
    saveFocusTimerState({
      ...baseState,
      sessionId: 'fs_native_notif_1',
      isActive: false,
      isPaused: true,
      targetEndTime: null,
      secondsRemaining: 1499,
    });
    assert.equal(getLastScheduledFocusNotificationKey(), null);
    await new Promise(r => setTimeout(r, 15));
    assert.ok(cancelledCalls.length >= 1);

    // 4. Resuming with a new targetEndTime schedules again, and resetting clears it
    const resumedEnd = Date.now() + 1499 * 1000;
    saveFocusTimerState({
      ...baseState,
      sessionId: 'fs_native_notif_1',
      isActive: true,
      isPaused: false,
      targetEndTime: resumedEnd,
      secondsRemaining: 1499,
    });
    assert.equal(getLastScheduledFocusNotificationKey(), `fs_native_notif_1:${resumedEnd}`);

    clearFocusTimerState();
    assert.equal(getLastScheduledFocusNotificationKey(), null);
  } finally {
    clearFocusTimerState();
    (globalThis as any).window = originalWindow;
  }
});

test('Step 3: Focus timer reconciliation after background expiry is idempotent and prevents duplicate XP or sessions', () => {
  const db = new DatabaseManager();
  clearFocusTimerState();

  const pastTargetEnd = Date.now() - 5000;
  saveFocusTimerState({
    sessionId: 'fs_bg_reconcile_1',
    sessionType: 'focus',
    durationMinutes: 25,
    customInputMins: 25,
    isCustomMode: false,
    secondsRemaining: 1200,
    isActive: true,
    isPaused: false,
    targetEndTime: pastTargetEnd,
    sessionTaskNote: 'Deep work while backgrounded',
    activeDeviceMode: null,
  });

  let notifyCount = 0;
  const firstResult = reconcileExpiredFocusTimer({
    nowMs: Date.now(),
    database: db,
    onNotify: () => {
      notifyCount++;
    },
  });

  assert.ok(firstResult !== null);
  assert.equal(firstResult?.completed, true);
  assert.equal(firstResult?.alreadyFinalized, false);
  assert.ok((firstResult?.xpAwarded ?? 0) > 0);
  assert.equal(notifyCount, 1);
  assert.equal(db.getFocusSessions().length, 1);
  assert.equal(getLastScheduledFocusNotificationKey(), null);

  // Re-running reconciliation does not award duplicate XP or create duplicate sessions
  const secondResult = reconcileExpiredFocusTimer({
    nowMs: Date.now(),
    database: db,
    onNotify: () => {
      notifyCount++;
    },
  });
  assert.equal(secondResult, null);
  assert.equal(notifyCount, 1);
  assert.equal(db.getFocusSessions().length, 1);
});

test('Step 4: Android hardware back-button priority dismisses modals first, drawer second, navigates home third, and exits only on home', () => {
  // 1. Locked state blocks back navigation
  assert.equal(
    resolveBackButtonAction({
      isLocked: true,
      isQuickAddOpen: true,
      isSearchOpen: true,
      mobileDrawerOpen: true,
      currentDestination: 'tasks',
    }),
    'noop_locked'
  );

  // 2. QuickAdd modal has highest dismissal priority
  assert.equal(
    resolveBackButtonAction({
      isLocked: false,
      isQuickAddOpen: true,
      isSearchOpen: true,
      mobileDrawerOpen: true,
      currentDestination: 'tasks',
    }),
    'close_quick_add'
  );

  // 3. GlobalSearch modal is dismissed next
  assert.equal(
    resolveBackButtonAction({
      isLocked: false,
      isQuickAddOpen: false,
      isSearchOpen: true,
      mobileDrawerOpen: true,
      currentDestination: 'tasks',
    }),
    'close_search'
  );

  // 4. Mobile drawer is closed next
  assert.equal(
    resolveBackButtonAction({
      isLocked: false,
      isQuickAddOpen: false,
      isSearchOpen: false,
      mobileDrawerOpen: true,
      currentDestination: 'tasks',
    }),
    'close_mobile_drawer'
  );

  // 5. Non-home destination navigates back to home
  assert.equal(
    resolveBackButtonAction({
      isLocked: false,
      isQuickAddOpen: false,
      isSearchOpen: false,
      mobileDrawerOpen: false,
      currentDestination: 'journal',
    }),
    'navigate_home'
  );

  // 6. Home destination with no overlays open allows app exit/minimize
  assert.equal(
    resolveBackButtonAction({
      isLocked: false,
      isQuickAddOpen: false,
      isSearchOpen: false,
      mobileDrawerOpen: false,
      currentDestination: 'home',
    }),
    'exit_app'
  );
});

test('Step 4: Audio lifecycle reconciliation and native status bar theme synchronization execute safely', async () => {
  const originalWindow = (globalThis as any).window;
  const originalDocument = (globalThis as any).document;
  let statusBarStyleCalled: string | null = null;
  let statusBarBgCalled: string | null = null;

  try {
    const metaEl: Record<string, string> = {};
    (globalThis as any).document = {
      querySelector: () => metaEl,
      createElement: () => metaEl,
      head: { appendChild: () => {} },
    };
    (globalThis as any).window = {
      Capacitor: {
        isNativePlatform: () => true,
        getPlatform: () => 'android',
        Plugins: {
          StatusBar: {
            setStyle: async (opts: { style: string }) => {
              statusBarStyleCalled = opts.style;
            },
            setBackgroundColor: async (opts: { color: string }) => {
              statusBarBgCalled = opts.color;
            },
          },
        },
      },
    };

    await syncNativeStatusBar('dark', '#0D1512');
    assert.equal(metaEl.content, '#0D1512');
    assert.equal(statusBarStyleCalled, 'DARK');
    assert.equal(statusBarBgCalled, '#0D1512');

    await syncNativeStatusBar('light', '#F8F6F0');
    assert.equal(metaEl.content, '#F8F6F0');
    assert.equal(statusBarStyleCalled, 'LIGHT');
    assert.equal(statusBarBgCalled, '#F8F6F0');

    const audioResumed = await soundService.reconcileAudioLifecycle();
    assert.equal(typeof audioResumed, 'boolean');
  } finally {
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
  }
});
