// ==========================================
// DAYCRAFT — NATIVE LIFECYCLE, BACK-BUTTON & STATUS BAR ADAPTER
// Coordinates Android hardware back-button priority, app resume reconciliation,
// and status bar theme synchronization with zero web regressions.
// ==========================================

import {
  CapacitorWindowGlobal,
  isCapacitorNativeRuntime,
} from './platformDetect';

export interface BackButtonUIState {
  isLocked: boolean;
  isQuickAddOpen: boolean;
  isSearchOpen: boolean;
  mobileDrawerOpen: boolean;
  currentDestination: string;
  canGoBackInHistory?: boolean;
}

export type BackButtonActionType =
  | 'noop_locked'
  | 'close_quick_add'
  | 'close_search'
  | 'close_mobile_drawer'
  | 'navigate_back'
  | 'navigate_home'
  | 'exit_app';

/**
 * Pure, deterministic resolver for Android hardware back-button priority:
 * 1. If app lock overlay is active -> block navigation ('noop_locked')
 * 2. If QuickAddModal is open -> dismiss modal ('close_quick_add')
 * 3. If GlobalSearchModal is open -> dismiss modal ('close_search')
 * 4. If mobile navigation drawer is open -> close drawer ('close_mobile_drawer')
 * 5. If not on 'home' -> navigate back / to 'home' ('navigate_home')
 * 6. If already on 'home' with no overlays open -> allow app exit/minimize ('exit_app')
 */
export function resolveBackButtonAction(state: BackButtonUIState): BackButtonActionType {
  if (state.isLocked) {
    return 'noop_locked';
  }
  if (state.isQuickAddOpen) {
    return 'close_quick_add';
  }
  if (state.isSearchOpen) {
    return 'close_search';
  }
  if (state.mobileDrawerOpen) {
    return 'close_mobile_drawer';
  }
  if (state.currentDestination !== 'home') {
    return state.canGoBackInHistory ? 'navigate_back' : 'navigate_home';
  }
  return 'exit_app';
}

export interface BackButtonCallbacks {
  getState: () => BackButtonUIState;
  closeQuickAdd: () => void;
  closeSearch: () => void;
  closeMobileDrawer: () => void;
  navigateHome: () => void;
  navigateBack?: () => void;
}

/**
 * Registers the Android hardware back-button listener when running inside Capacitor.
 * Returns a cleanup function that removes the listener.
 */
export function registerHardwareBackButton(callbacks: BackButtonCallbacks): () => void {
  if (typeof window === 'undefined') return () => {};

  let removeListener: (() => void) | null = null;
  let cancelled = false;

  const handleBackButton = (event?: { canGoBack?: boolean }) => {
    const state = callbacks.getState();
    const action = resolveBackButtonAction({
      ...state,
      canGoBackInHistory: Boolean(event?.canGoBack && state.canGoBackInHistory),
    });

    switch (action) {
      case 'noop_locked':
        return;
      case 'close_quick_add':
        callbacks.closeQuickAdd();
        return;
      case 'close_search':
        callbacks.closeSearch();
        return;
      case 'close_mobile_drawer':
        callbacks.closeMobileDrawer();
        return;
      case 'navigate_back':
        if (callbacks.navigateBack) {
          callbacks.navigateBack();
        } else {
          callbacks.navigateHome();
        }
        return;
      case 'navigate_home':
        callbacks.navigateHome();
        return;
      case 'exit_app': {
        const cap = (window as unknown as CapacitorWindowGlobal).Capacitor;
        const appPlugin = cap?.Plugins?.App;
        if (appPlugin?.minimizeApp) {
          void appPlugin.minimizeApp();
        } else if (appPlugin?.exitApp) {
          void appPlugin.exitApp();
        }
        return;
      }
    }
  };

  if (isCapacitorNativeRuntime()) {
    const cap = (window as unknown as CapacitorWindowGlobal).Capacitor;
    const appPlugin = cap?.Plugins?.App;
    if (appPlugin?.addListener) {
      Promise.resolve(appPlugin.addListener('backButton', handleBackButton))
        .then(handle => {
          if (cancelled) {
            void handle?.remove?.();
          } else if (handle?.remove) {
            removeListener = () => {
              void handle.remove();
            };
          }
        })
        .catch(() => {
          // Ignore if App plugin is not installed
        });
    }
  }

  // Also support custom 'daycraft:hardware-back' DOM events for testing & Android WebView bridges
  const domHandler = (e: Event) => {
    const customEvent = e as CustomEvent<{ canGoBack?: boolean }>;
    handleBackButton(customEvent.detail);
  };
  window.addEventListener('daycraft:hardware-back', domHandler);

  return () => {
    cancelled = true;
    window.removeEventListener('daycraft:hardware-back', domHandler);
    if (removeListener) {
      removeListener();
    }
  };
}

export interface AppLifecycleCallbacks {
  onResume: () => void;
  onPause?: () => void;
}

/**
 * Subscribes to application resume/pause across Web (`visibilitychange`, `focus`),
 * Windows (Tauri window focus), and Android (Capacitor `appStateChange`).
 */
export function registerAppLifecycleListeners(callbacks: AppLifecycleCallbacks): () => void {
  if (typeof window === 'undefined') return () => {};

  let removeCapListener: (() => void) | null = null;
  let cancelled = false;

  const handleVisibilityChange = () => {
    if (typeof document === 'undefined') return;
    if (document.visibilityState === 'visible') {
      callbacks.onResume();
    } else if (document.visibilityState === 'hidden') {
      callbacks.onPause?.();
    }
  };

  const handleWindowFocus = () => {
    callbacks.onResume();
  };

  window.addEventListener('focus', handleWindowFocus);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  if (isCapacitorNativeRuntime()) {
    const cap = (window as unknown as CapacitorWindowGlobal).Capacitor;
    const appPlugin = cap?.Plugins?.App;
    if (appPlugin?.addListener) {
      Promise.resolve(
        appPlugin.addListener('appStateChange', (state: { isActive?: boolean }) => {
          if (state?.isActive) {
            callbacks.onResume();
          } else {
            callbacks.onPause?.();
          }
        })
      )
        .then(handle => {
          if (cancelled) {
            void handle?.remove?.();
          } else if (handle?.remove) {
            removeCapListener = () => {
              void handle.remove();
            };
          }
        })
        .catch(() => {
          // Ignore if plugin unavailable
        });
    }
  }

  return () => {
    cancelled = true;
    window.removeEventListener('focus', handleWindowFocus);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    if (removeCapListener) {
      removeCapListener();
    }
  };
}

/**
 * Synchronizes the native Android StatusBar style & background color and the document's
 * `<meta name="theme-color">` with the active Daycraft theme preset and mode.
 */
export async function syncNativeStatusBar(
  resolvedMode: 'light' | 'dark',
  backgroundColorHex: string
): Promise<void> {
  if (typeof document !== 'undefined') {
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = backgroundColorHex;
  }

  if (!isCapacitorNativeRuntime() || typeof window === 'undefined') {
    return;
  }

  try {
    const cap = (window as unknown as CapacitorWindowGlobal).Capacitor;
    const statusBar = cap?.Plugins?.StatusBar;
    if (statusBar) {
      // In Capacitor StatusBar, Style.Dark means light text for dark backgrounds,
      // and Style.Light means dark text for light backgrounds.
      if (statusBar.setStyle) {
        await statusBar.setStyle({
          style: resolvedMode === 'dark' ? 'DARK' : 'LIGHT',
        });
      }
      if (statusBar.setBackgroundColor && /^#[0-9A-Fa-f]{6}$/.test(backgroundColorHex)) {
        await statusBar.setBackgroundColor({ color: backgroundColorHex });
      }
    }
  } catch {
    // Graceful no-op if StatusBar plugin is not present
  }
}
