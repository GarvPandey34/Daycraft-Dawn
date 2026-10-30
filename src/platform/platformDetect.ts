// ==========================================
// DAYCRAFT — UNIFIED RUNTIME PLATFORM DETECTION
// Distinguishes Web Browser, Windows (Tauri 2), and Android (Capacitor)
// Safe for SSR/Node test runners and pure browser environments
// ==========================================

export type RuntimePlatform = 'windows' | 'android' | 'web';

export interface TauriWindowGlobal {
  __TAURI_INTERNALS__?: {
    invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
  };
  __TAURI__?: {
    core?: {
      invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
    };
    dialog?: {
      save?: (options?: Record<string, unknown>) => Promise<string | null>;
      open?: (options?: Record<string, unknown>) => Promise<string | string[] | null>;
    };
    fs?: {
      writeTextFile?: (path: string, contents: string) => Promise<void>;
      readTextFile?: (path: string) => Promise<string>;
    };
    notification?: {
      isPermissionGranted?: () => Promise<boolean>;
      requestPermission?: () => Promise<string>;
      sendNotification?: (options: { title: string; body?: string } | string) => void;
    };
  };
}

export interface CapacitorWindowGlobal {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    getPlatform?: () => string;
    isPluginAvailable?: (name: string) => boolean;
    Plugins?: {
      App?: {
        addListener?: (
          eventName: string,
          listenerFunc: (data: any) => void
        ) => Promise<{ remove: () => Promise<void> }> | { remove: () => Promise<void> };
        exitApp?: () => Promise<void>;
        minimizeApp?: () => Promise<void>;
      };
      LocalNotifications?: {
        checkPermissions?: () => Promise<{ display: string }>;
        requestPermissions?: () => Promise<{ display: string }>;
        schedule?: (options: {
          notifications: Array<{
            id: number;
            title: string;
            body: string;
            schedule?: { at: Date; allowWhileIdle?: boolean };
            channelId?: string;
            extra?: Record<string, unknown>;
          }>;
        }) => Promise<unknown>;
        cancel?: (options: { notifications: Array<{ id: number }> }) => Promise<unknown>;
        createChannel?: (channel: {
          id: string;
          name: string;
          description?: string;
          importance?: number;
          visibility?: number;
          vibration?: boolean;
        }) => Promise<void>;
      };
      Filesystem?: {
        writeFile?: (options: {
          path: string;
          data: string;
          directory?: string;
          encoding?: string;
          recursive?: boolean;
        }) => Promise<{ uri: string }>;
        readFile?: (options: {
          path: string;
          directory?: string;
          encoding?: string;
        }) => Promise<{ data: string }>;
      };
      Share?: {
        share?: (options: {
          title?: string;
          text?: string;
          url?: string;
          dialogTitle?: string;
        }) => Promise<unknown>;
      };
      StatusBar?: {
        setStyle?: (options: { style: 'DARK' | 'LIGHT' | 'DEFAULT' }) => Promise<void>;
        setBackgroundColor?: (options: { color: string }) => Promise<void>;
      };
    };
  };
}

/**
 * Returns true when running inside a Tauri 2 WebView2 shell on desktop.
 */
export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as unknown as TauriWindowGlobal;
  return Boolean(win.__TAURI_INTERNALS__ || win.__TAURI__);
}

/**
 * Returns true when running inside a native Capacitor shell (Android/iOS).
 */
export function isCapacitorNativeRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as CapacitorWindowGlobal).Capacitor;
  if (!cap) return false;
  if (typeof cap.isNativePlatform === 'function') {
    try {
      return Boolean(cap.isNativePlatform());
    } catch {
      return false;
    }
  }
  if (typeof cap.getPlatform === 'function') {
    try {
      const p = cap.getPlatform();
      return p === 'android' || p === 'ios';
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Resolves the active runtime platform:
 * - 'windows' when inside Tauri 2 desktop or Windows user-agent
 * - 'android' when inside Capacitor Android or Android user-agent
 * - 'web' otherwise
 */
export function detectRuntimePlatform(): RuntimePlatform {
  if (typeof window === 'undefined') return 'web';

  if (isTauriRuntime()) {
    return 'windows';
  }

  if (isCapacitorNativeRuntime()) {
    const cap = (window as unknown as CapacitorWindowGlobal).Capacitor;
    const p = cap?.getPlatform?.();
    if (p === 'android') return 'android';
  }

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
  if (/android/i.test(ua)) {
    return 'android';
  }
  if (/windows/i.test(ua)) {
    return 'windows';
  }

  return 'web';
}

/**
 * Deterministically maps a string notification ID (e.g. 'daycraft_focus_timer_due')
 * to a positive 31-bit integer required by Android Capacitor LocalNotifications.
 */
export function hashNotificationIdToInt(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const positive = Math.abs(hash | 0);
  return positive === 0 ? 1001 : positive;
}

/**
 * Requests persistent browser/WebView storage so the OS does not evict
 * localStorage/IndexedDB under low-disk conditions.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.persist) {
    return false;
  }
  try {
    const alreadyPersisted = await navigator.storage.persisted?.();
    if (alreadyPersisted) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
