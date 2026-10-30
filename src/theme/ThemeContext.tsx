import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../database/db';
import {
  DEFAULT_THEME_PRESET,
  resolveEligibleThemePreset,
  THEME_PRESETS,
  ThemeColors,
  ThemeMode,
  ThemePresetKey,
} from './tokens';
import { syncNativeStatusBar } from '../platform/lifecycleAdapter';

interface ThemeContextType {
  presetKey: ThemePresetKey;
  mode: ThemeMode;
  resolvedMode: 'light' | 'dark';
  colors: ThemeColors;
  setPresetKey: (key: ThemePresetKey) => boolean;
  isThemeEligible: (key: ThemePresetKey) => boolean;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const STORAGE_PRESET_KEY = 'daycraft_theme_preset';
const STORAGE_MODE_KEY = 'daycraft_theme_mode';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [presetKey, setPresetKeyState] = useState<ThemePresetKey>(() => {
    const context = db.getThemeUnlockContext();
    const dbPreset = db.getSettings().themePreset;
    try {
      const saved = localStorage.getItem(STORAGE_PRESET_KEY);
      if (saved && saved in THEME_PRESETS) {
        return resolveEligibleThemePreset(saved, context);
      }
    } catch {
      // fallback
    }
    return resolveEligibleThemePreset(dbPreset, context);
  });

  const [mode, setModeState] = useState<ThemeMode>(() => {
    const dbMode = db.getSettings().themeMode;
    try {
      const saved = localStorage.getItem(STORAGE_MODE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved as ThemeMode;
    } catch {
      // fallback
    }
    if (dbMode === 'light' || dbMode === 'dark' || dbMode === 'system') return dbMode;
    return 'light';
  });

  const [systemDark, setSystemDark] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Stay synchronized when db settings change (e.g. backup restore or reset)
  useEffect(() => {
    return db.subscribe(() => {
      const eligible = db.enforceEligibleThemePreset();
      setPresetKeyState(prev => (prev !== eligible ? eligible : prev));
      const dbMode = db.getSettings().themeMode;
      if (dbMode === 'light' || dbMode === 'dark' || dbMode === 'system') {
        setModeState(prev => (prev !== dbMode ? dbMode : prev));
      }
    });
  }, []);

  const resolvedMode: 'light' | 'dark' = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;
  const safePresetKey = db.isThemeEligible(presetKey) ? presetKey : DEFAULT_THEME_PRESET;
  const currentPreset = THEME_PRESETS[safePresetKey] || THEME_PRESETS.warm_paper;
  const colors = resolvedMode === 'dark' ? currentPreset.dark : currentPreset.light;

  // Apply CSS variables to root
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedMode);
    root.setAttribute('data-theme', safePresetKey);

    root.style.setProperty('--bg-app', colors.bgApp);
    root.style.setProperty('--bg-surface', colors.bgSurface);
    root.style.setProperty('--bg-surface-elevated', colors.bgSurfaceElevated);
    root.style.setProperty('--bg-surface-subtle', colors.bgSurfaceSubtle);
    root.style.setProperty('--border', colors.border);
    root.style.setProperty('--border-focus', colors.borderFocus);
    root.style.setProperty('--text-primary', colors.textPrimary);
    root.style.setProperty('--text-secondary', colors.textSecondary);
    root.style.setProperty('--text-muted', colors.textMuted);
    root.style.setProperty('--accent', colors.accent);
    root.style.setProperty('--accent-hover', colors.accentHover);
    root.style.setProperty('--accent-subtle', colors.accentSubtle);
    root.style.setProperty('--accent-foreground', colors.accentForeground);
    root.style.setProperty('--success', colors.success);
    root.style.setProperty('--success-subtle', colors.successSubtle);
    root.style.setProperty('--warning', colors.warning);
    root.style.setProperty('--warning-subtle', colors.warningSubtle);
    root.style.setProperty('--danger', colors.danger);
    root.style.setProperty('--danger-subtle', colors.dangerSubtle);
    root.style.setProperty('--info', colors.info);
    root.style.setProperty('--info-subtle', colors.infoSubtle);
    root.style.setProperty('--sidebar-bg', colors.sidebarBg);
    root.style.setProperty('--card-shadow', colors.cardShadow);

    document.body.style.backgroundColor = colors.bgApp;
    document.body.style.color = colors.textPrimary;
    void syncNativeStatusBar(resolvedMode, colors.bgApp);
  }, [colors, resolvedMode, safePresetKey]);

  const isThemeEligible = (key: ThemePresetKey): boolean => {
    return db.isThemeEligible(key);
  };

  const setPresetKey = (key: ThemePresetKey): boolean => {
    if (!db.isThemeEligible(key)) {
      return false;
    }
    setPresetKeyState(key);
    db.updateSettings({ themePreset: key });
    try {
      localStorage.setItem(STORAGE_PRESET_KEY, key);
    } catch {
      // ignore
    }
    return true;
  };

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    db.updateSettings({ themeMode: newMode });
    try {
      localStorage.setItem(STORAGE_MODE_KEY, newMode);
    } catch {
      // ignore
    }
  };

  const toggleMode = () => {
    const next = resolvedMode === 'dark' ? 'light' : 'dark';
    setMode(next);
  };

  return (
    <ThemeContext.Provider
      value={{
        presetKey: safePresetKey,
        mode,
        resolvedMode,
        colors,
        setPresetKey,
        isThemeEligible,
        setMode,
        toggleMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
