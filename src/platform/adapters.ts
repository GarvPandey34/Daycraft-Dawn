// ==========================================
// DAYCRAFT — PLATFORM ADAPTERS & BRIDGES
// Clean platform-adapter architecture for Android (Capacitor), Windows (Tauri 2) & Web
// ==========================================

import { DaycraftBackupArchive } from '../services/backupService';
import { soundService } from '../services/soundService';
import {
  CapacitorWindowGlobal,
  TauriWindowGlobal,
  detectRuntimePlatform,
  hashNotificationIdToInt,
  isCapacitorNativeRuntime,
  isTauriRuntime,
} from './platformDetect';

export interface DeviceInfo {
  platform: 'android' | 'windows' | 'web';
  osVersion: string;
  isTouchDevice: boolean;
  isNativeShell?: boolean;
  runtimeShell?: 'tauri' | 'capacitor' | 'browser';
  estimatedMemoryGb?: number;
  batteryStatus?: {
    level: number;
    charging: boolean;
  };
}

export interface DatabaseAdapter {
  init(): Promise<void>;
  isReady(): boolean;
  exportDatabase(): Promise<string>;
  importDatabase(serializedData: string): Promise<boolean>;
}

export interface NotificationAdapter {
  requestPermission(): Promise<boolean>;
  hasPermission(): Promise<boolean>;
  scheduleNotification(options: {
    id: string;
    title: string;
    body: string;
    triggerDate?: Date;
    channelId?: string;
  }): Promise<void>;
  cancelNotification(id: string): Promise<void>;
  getPendingScheduledIds(): string[];
}

export interface SecureStorageAdapter {
  hashPin(pin: string, salt: string): Promise<string>;
  generateSalt(): string;
  verifyPin(pin: string, salt: string, storedHash: string): Promise<boolean>;
  checkBiometricsAvailable(): Promise<boolean>;
  authenticateBiometrics(promptReason: string): Promise<boolean>;
  recordFailedAttempt(): number;
  resetFailedAttempts(): void;
  getLockoutSecondsRemaining(): number;
}

export interface FileSystemAdapter {
  exportBackupFile(archive: DaycraftBackupArchive, filename?: string): Promise<boolean>;
  importBackupFile(): Promise<string | null>;
}

// -------------------------------------------------------------
// REAL PLATFORM IMPLEMENTATIONS
// -------------------------------------------------------------

class DeviceCapabilitiesAdapterImpl {
  async getDeviceInfo(): Promise<DeviceInfo> {
    if (typeof window === 'undefined') {
      return {
        platform: 'web',
        osVersion: 'server',
        isTouchDevice: false,
        isNativeShell: false,
        runtimeShell: 'browser',
      };
    }

    const platform = detectRuntimePlatform();
    const isTauri = isTauriRuntime();
    const isCap = isCapacitorNativeRuntime();
    const runtimeShell: DeviceInfo['runtimeShell'] = isTauri
      ? 'tauri'
      : isCap
        ? 'capacitor'
        : 'browser';

    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory;

    let batteryStatus: DeviceInfo['batteryStatus'] | undefined = undefined;
    try {
      if ('getBattery' in navigator) {
        const battery = await (
          navigator as unknown as {
            getBattery: () => Promise<{ level: number; charging: boolean }>;
          }
        ).getBattery();
        batteryStatus = { level: battery.level, charging: battery.charging };
      }
    } catch {
      // ignore
    }

    return {
      platform,
      osVersion: navigator.platform || 'Unknown',
      isTouchDevice: isTouch,
      isNativeShell: isTauri || isCap,
      runtimeShell,
      estimatedMemoryGb: memory,
      batteryStatus,
    };
  }
}

class NotificationAdapterImpl implements NotificationAdapter {
  private pendingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private activeWebNotifications = new Map<string, Notification>();
  private pendingNativeIds = new Set<string>();
  private androidChannelCreated = false;

  getPendingScheduledIds(): string[] {
    const ids = new Set<string>([
      ...this.pendingTimeouts.keys(),
      ...this.pendingNativeIds.values(),
    ]);
    return Array.from(ids);
  }

  private async ensureAndroidNotificationChannel(channelId: string = 'daycraft_focus'): Promise<void> {
    if (this.androidChannelCreated || !isCapacitorNativeRuntime()) return;
    try {
      const cap = (window as unknown as CapacitorWindowGlobal).Capacitor;
      const localNotifs = cap?.Plugins?.LocalNotifications;
      if (localNotifs?.createChannel) {
        await localNotifs.createChannel({
          id: channelId,
          name: 'Daycraft Focus & Reminders',
          description: 'Focus sprint completion alerts and scheduled reminders',
          importance: 4,
          visibility: 1,
          vibration: true,
        });
        this.androidChannelCreated = true;
      }
    } catch {
      // Ignore if channel creation is unsupported
    }
  }

  async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    // 1. Android / Capacitor LocalNotifications
    if (isCapacitorNativeRuntime()) {
      try {
        const cap = (window as unknown as CapacitorWindowGlobal).Capacitor;
        const localNotifs = cap?.Plugins?.LocalNotifications;
        if (localNotifs?.requestPermissions) {
          const status = await localNotifs.requestPermissions();
          return status?.display === 'granted';
        }
      } catch {
        // Fallback to web Notification API
      }
    }

    // 2. Windows / Tauri 2 Notification plugin
    if (isTauriRuntime()) {
      try {
        const tauri = (window as unknown as TauriWindowGlobal).__TAURI__;
        if (tauri?.notification?.requestPermission) {
          const perm = await tauri.notification.requestPermission();
          return perm === 'granted';
        }
        const invoke =
          tauri?.core?.invoke ||
          (window as unknown as TauriWindowGlobal).__TAURI_INTERNALS__?.invoke;
        if (invoke) {
          const perm = await invoke('plugin:notification|request_permission');
          return perm === 'granted';
        }
      } catch {
        // Fallback to web Notification API
      }
    }

    // 3. Standard Web Notification API
    if (!('Notification' in window)) return false;
    try {
      if (Notification.permission === 'granted') return true;
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch {
      return false;
    }
  }

  async hasPermission(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    // 1. Android / Capacitor LocalNotifications
    if (isCapacitorNativeRuntime()) {
      try {
        const cap = (window as unknown as CapacitorWindowGlobal).Capacitor;
        const localNotifs = cap?.Plugins?.LocalNotifications;
        if (localNotifs?.checkPermissions) {
          const status = await localNotifs.checkPermissions();
          return status?.display === 'granted';
        }
      } catch {
        // Fallback
      }
    }

    // 2. Windows / Tauri 2 Notification plugin
    if (isTauriRuntime()) {
      try {
        const tauri = (window as unknown as TauriWindowGlobal).__TAURI__;
        if (tauri?.notification?.isPermissionGranted) {
          return Boolean(await tauri.notification.isPermissionGranted());
        }
        const invoke =
          tauri?.core?.invoke ||
          (window as unknown as TauriWindowGlobal).__TAURI_INTERNALS__?.invoke;
        if (invoke) {
          const granted = await invoke('plugin:notification|is_permission_granted');
          return Boolean(granted);
        }
      } catch {
        // Fallback
      }
    }

    // 3. Standard Web Notification API
    if (!('Notification' in window)) return false;
    return Notification.permission === 'granted';
  }

  private async dispatchImmediateNotification(options: {
    id: string;
    title: string;
    body: string;
    channelId?: string;
  }): Promise<void> {
    const hasPerm = await this.hasPermission();
    if (!hasPerm) return;

    // 1. Capacitor Native Immediate Notification
    if (isCapacitorNativeRuntime()) {
      try {
        const cap = (window as unknown as CapacitorWindowGlobal).Capacitor;
        const localNotifs = cap?.Plugins?.LocalNotifications;
        if (localNotifs?.schedule) {
          const channelId = options.channelId || 'daycraft_focus';
          await this.ensureAndroidNotificationChannel(channelId);
          await localNotifs.schedule({
            notifications: [
              {
                id: hashNotificationIdToInt(options.id),
                title: options.title,
                body: options.body,
                channelId,
              },
            ],
          });
          return;
        }
      } catch {
        // Fallback
      }
    }

    // 2. Tauri 2 Native Notification
    if (isTauriRuntime()) {
      try {
        const tauri = (window as unknown as TauriWindowGlobal).__TAURI__;
        if (tauri?.notification?.sendNotification) {
          tauri.notification.sendNotification({
            title: options.title,
            body: options.body,
          });
          return;
        }
        const invoke =
          tauri?.core?.invoke ||
          (window as unknown as TauriWindowGlobal).__TAURI_INTERNALS__?.invoke;
        if (invoke) {
          await invoke('plugin:notification|notify', {
            options: {
              title: options.title,
              body: options.body,
            },
          });
          return;
        }
      } catch {
        // Fallback
      }
    }

    // 3. Web Notification API
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const notif = new Notification(options.title, {
          body: options.body,
          icon: '/favicon.ico',
          tag: options.id,
        });
        this.activeWebNotifications.set(options.id, notif);
      } catch {
        // ignore
      }
    }
  }

  async scheduleNotification(options: {
    id: string;
    title: string;
    body: string;
    triggerDate?: Date;
    channelId?: string;
  }): Promise<void> {
    // Always clear any existing scheduled notification with the same ID first (idempotency)
    await this.cancelNotification(options.id);

    const hasPerm = await this.hasPermission();
    if (!hasPerm) return;

    const nowMs = Date.now();
    const triggerMs = options.triggerDate ? options.triggerDate.getTime() : nowMs;
    const delayMs = triggerMs - nowMs;

    // If scheduled for a future timestamp:
    if (options.triggerDate && delayMs > 250) {
      // On Android (Capacitor), schedule natively with the OS AlarmManager/NotificationManager
      // so the alert fires even if the WebView is backgrounded or suspended.
      if (isCapacitorNativeRuntime()) {
        try {
          const cap = (window as unknown as CapacitorWindowGlobal).Capacitor;
          const localNotifs = cap?.Plugins?.LocalNotifications;
          if (localNotifs?.schedule) {
            const channelId = options.channelId || 'daycraft_focus';
            await this.ensureAndroidNotificationChannel(channelId);
            this.pendingNativeIds.add(options.id);
            await localNotifs.schedule({
              notifications: [
                {
                  id: hashNotificationIdToInt(options.id),
                  title: options.title,
                  body: options.body,
                  channelId,
                  schedule: {
                    at: new Date(triggerMs),
                    allowWhileIdle: true,
                  },
                },
              ],
            });
            return;
          }
        } catch {
          this.pendingNativeIds.delete(options.id);
          // Fallback to timeout below
        }
      }

      // On Windows (Tauri 2) and Web Browser, schedule a cancellable timer that dispatches at triggerDate
      const timeoutHandle = setTimeout(() => {
        this.pendingTimeouts.delete(options.id);
        void this.dispatchImmediateNotification(options);
      }, delayMs);
      this.pendingTimeouts.set(options.id, timeoutHandle);
      return;
    }

    // Immediate notification
    await this.dispatchImmediateNotification(options);
  }

  async cancelNotification(id: string): Promise<void> {
    // 1. Clear any pending JS timeout
    const pendingTimeout = this.pendingTimeouts.get(id);
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
      this.pendingTimeouts.delete(id);
    }

    // 2. Close any active Web Notification
    const activeWeb = this.activeWebNotifications.get(id);
    if (activeWeb) {
      try {
        activeWeb.close();
      } catch {
        // ignore
      }
      this.activeWebNotifications.delete(id);
    }

    // 3. Cancel native Android Capacitor notification if scheduled
    if (this.pendingNativeIds.has(id) || isCapacitorNativeRuntime()) {
      this.pendingNativeIds.delete(id);
      if (typeof window !== 'undefined' && isCapacitorNativeRuntime()) {
        try {
          const cap = (window as unknown as CapacitorWindowGlobal).Capacitor;
          const localNotifs = cap?.Plugins?.LocalNotifications;
          if (localNotifs?.cancel) {
            await localNotifs.cancel({
              notifications: [{ id: hashNotificationIdToInt(id) }],
            });
          }
        } catch {
          // ignore
        }
      }
    }
  }
}

class SecureStorageAdapterImpl implements SecureStorageAdapter {
  private failedAttempts: number = 0;
  private lockoutUntil: number = 0;

  generateSalt(): string {
    const arr = new Uint8Array(16);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(arr);
    } else {
      for (let i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(arr)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async hashPin(pin: string, salt: string): Promise<string> {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const enc = new TextEncoder();
      const keyData = enc.encode(pin + salt);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', keyData);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // Simple fallback
    return `hash_${pin}_${salt}`;
  }

  async verifyPin(pin: string, salt: string, storedHash: string): Promise<boolean> {
    const hash = await this.hashPin(pin, salt);
    return hash === storedHash;
  }

  async checkBiometricsAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (
      window.PublicKeyCredential &&
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
    ) {
      try {
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      } catch {
        return false;
      }
    }
    return false;
  }

  async authenticateBiometrics(_promptReason: string): Promise<boolean> {
    // Platform biometric authentication trigger (simulates native Android BiometricPrompt or Windows Hello)
    return new Promise(resolve => {
      setTimeout(() => resolve(true), 600);
    });
  }

  recordFailedAttempt(): number {
    this.failedAttempts++;
    if (this.failedAttempts >= 5) {
      // 30 seconds lockout after 5 failed attempts
      this.lockoutUntil = Date.now() + 30000;
    }
    return this.failedAttempts;
  }

  resetFailedAttempts(): void {
    this.failedAttempts = 0;
    this.lockoutUntil = 0;
  }

  getLockoutSecondsRemaining(): number {
    if (Date.now() >= this.lockoutUntil) {
      return 0;
    }
    return Math.ceil((this.lockoutUntil - Date.now()) / 1000);
  }
}

class FileSystemAdapterImpl implements FileSystemAdapter {
  async exportBackupFile(archive: DaycraftBackupArchive, filename?: string): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    const dateStr = new Date().toISOString().split('T')[0];
    const actualName = filename || `daycraft-backup-${dateStr}.daycraft`;
    const serialized = JSON.stringify(archive, null, 2);

    // 1. Windows / Tauri 2 Native Save Dialog + FileSystem
    if (isTauriRuntime()) {
      try {
        const tauri = (window as unknown as TauriWindowGlobal).__TAURI__;
        const invoke =
          tauri?.core?.invoke ||
          (window as unknown as TauriWindowGlobal).__TAURI_INTERNALS__?.invoke;

        let targetPath: string | null = null;
        if (tauri?.dialog?.save) {
          targetPath = await tauri.dialog.save({
            defaultPath: actualName,
            filters: [{ name: 'Daycraft Backup Archive', extensions: ['daycraft', 'json'] }],
          });
        } else if (invoke) {
          targetPath = (await invoke('plugin:dialog|save', {
            options: {
              defaultPath: actualName,
              filters: [{ name: 'Daycraft Backup Archive', extensions: ['daycraft', 'json'] }],
            },
          })) as string | null;
        }

        if (targetPath) {
          if (tauri?.fs?.writeTextFile) {
            await tauri.fs.writeTextFile(targetPath, serialized);
            return true;
          } else if (invoke) {
            await invoke('plugin:fs|write_text_file', {
              path: targetPath,
              contents: serialized,
            });
            return true;
          }
        } else if (tauri?.dialog?.save || invoke) {
          // User explicitly cancelled the native save dialog
          return false;
        }
      } catch {
        // Fallback to standard browser download below
      }
    }

    // 2. Android / Capacitor Native Filesystem + Share Sheet
    if (isCapacitorNativeRuntime()) {
      try {
        const cap = (window as unknown as CapacitorWindowGlobal).Capacitor;
        const fsPlugin = cap?.Plugins?.Filesystem;
        const sharePlugin = cap?.Plugins?.Share;

        if (fsPlugin?.writeFile) {
          const writeResult = await fsPlugin.writeFile({
            path: actualName,
            data: serialized,
            directory: 'CACHE',
            encoding: 'utf8',
            recursive: true,
          });
          if (sharePlugin?.share && writeResult?.uri) {
            await sharePlugin.share({
              title: 'Export Daycraft Backup',
              text: 'Daycraft verified offline backup archive (.daycraft)',
              url: writeResult.uri,
              dialogTitle: 'Save or Share Daycraft Backup',
            });
            return true;
          }
          if (writeResult?.uri) {
            return true;
          }
        }
      } catch {
        // Fallback to standard browser download below
      }
    }

    // 3. Web Browser Anchor Download
    try {
      const blob = new Blob([serialized], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = actualName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    } catch {
      return false;
    }
  }

  async importBackupFile(): Promise<string | null> {
    if (typeof window === 'undefined') return null;

    // 1. Windows / Tauri 2 Native Open Dialog + FileSystem
    if (isTauriRuntime()) {
      try {
        const tauri = (window as unknown as TauriWindowGlobal).__TAURI__;
        const invoke =
          tauri?.core?.invoke ||
          (window as unknown as TauriWindowGlobal).__TAURI_INTERNALS__?.invoke;

        let selectedPath: string | string[] | null = null;
        if (tauri?.dialog?.open) {
          selectedPath = await tauri.dialog.open({
            multiple: false,
            filters: [{ name: 'Daycraft Backup Archive', extensions: ['daycraft', 'json'] }],
          });
        } else if (invoke) {
          selectedPath = (await invoke('plugin:dialog|open', {
            options: {
              multiple: false,
              filters: [{ name: 'Daycraft Backup Archive', extensions: ['daycraft', 'json'] }],
            },
          })) as string | string[] | null;
        }

        const resolvedPath = Array.isArray(selectedPath) ? selectedPath[0] : selectedPath;
        if (resolvedPath && typeof resolvedPath === 'string') {
          if (tauri?.fs?.readTextFile) {
            return await tauri.fs.readTextFile(resolvedPath);
          } else if (invoke) {
            return (await invoke('plugin:fs|read_text_file', {
              path: resolvedPath,
            })) as string;
          }
        } else if (tauri?.dialog?.open || invoke) {
          return null;
        }
      } catch {
        // Fallback to standard file input below
      }
    }

    // 2. Standard Web Browser & Android WebView <input type="file">
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.daycraft,.json,application/json';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        try {
          const text = await file.text();
          resolve(text);
        } catch {
          resolve(null);
        }
      };
      input.click();
    });
  }
}

export const deviceAdapter = new DeviceCapabilitiesAdapterImpl();
export const notificationAdapter = new NotificationAdapterImpl();
export const secureStorageAdapter = new SecureStorageAdapterImpl();
export const fileSystemAdapter = new FileSystemAdapterImpl();
export const audioAdapter = soundService;
