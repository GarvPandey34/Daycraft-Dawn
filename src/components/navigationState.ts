import { useState, useEffect, useCallback } from 'react';
import {
  Home,
  Sun,
  Inbox,
  CheckCircle2,
  Flame,
  Folder,
  Target,
  Calendar,
  Timer,
  GraduationCap,
  Heart,
  BookOpen,
  BarChart3,
  Trophy,
  Settings,
} from 'lucide-react';
import React from 'react';
import { db } from '../database/db';

export type PrimaryWorkspaceView = 'tasks' | 'journal' | 'calendar';

export type Destination =
  | PrimaryWorkspaceView
  | 'home'
  | 'myday'
  | 'inbox'
  | 'habits'
  | 'projects'
  | 'goals'
  | 'focus'
  | 'study'
  | 'wellness'
  | 'insights'
  | 'achievements'
  | 'settings';

export type NavGroupKey = 'core' | 'planning' | 'reflection' | 'system';

export interface NavItem {
  id: Destination;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: NavGroupKey;
  shortcut?: string;
}

export const PRIMARY_WORKSPACE_ITEMS: NavItem[] = [
  { id: 'tasks', label: 'Tasks', icon: CheckCircle2, group: 'core', shortcut: '⌥1' },
  { id: 'journal', label: 'Journal', icon: BookOpen, group: 'reflection', shortcut: '⌥2' },
  { id: 'calendar', label: 'Calendar', icon: Calendar, group: 'planning', shortcut: '⌥3' },
];

export const ZEN_CORE_DESTINATIONS: Destination[] = [
  'myday',
  'tasks',
  'journal',
  'calendar',
  'habits',
];

export const DEFAULT_PINNED_DESTINATIONS: Destination[] = [
  'tasks',
  'journal',
  'calendar',
];

export const MAX_PINNED_DESTINATIONS = 4;

export const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home, group: 'core' },
  { id: 'myday', label: 'My Day', icon: Sun, group: 'core' },
  { id: 'inbox', label: 'Inbox', icon: Inbox, group: 'core' },
  { id: 'tasks', label: 'Tasks', icon: CheckCircle2, group: 'core', shortcut: '⌥1' },
  { id: 'habits', label: 'Habits', icon: Flame, group: 'core' },

  { id: 'projects', label: 'Projects', icon: Folder, group: 'planning' },
  { id: 'goals', label: 'Goals', icon: Target, group: 'planning' },
  { id: 'calendar', label: 'Calendar', icon: Calendar, group: 'planning', shortcut: '⌥3' },
  { id: 'focus', label: 'Focus', icon: Timer, group: 'planning' },
  { id: 'study', label: 'Study', icon: GraduationCap, group: 'planning' },

  { id: 'wellness', label: 'Wellness', icon: Heart, group: 'reflection' },
  { id: 'journal', label: 'Journal', icon: BookOpen, group: 'reflection', shortcut: '⌥2' },
  { id: 'insights', label: 'Insights', icon: BarChart3, group: 'reflection' },
  { id: 'achievements', label: 'Achievements', icon: Trophy, group: 'reflection' },

  { id: 'settings', label: 'Settings', icon: Settings, group: 'system' },
];

export const VALID_DESTINATIONS = new Set<Destination>(NAV_ITEMS.map(i => i.id));
export const PRIMARY_VIEW_SET = new Set<PrimaryWorkspaceView>(['tasks', 'journal', 'calendar']);

const NAV_STORAGE_KEY = 'daycraft_active_view_v1';
const NAV_PREFS_STORAGE_KEY = 'daycraft_nav_prefs_v1';

export function isValidDestination(value: unknown): value is Destination {
  return typeof value === 'string' && VALID_DESTINATIONS.has(value as Destination);
}

export function isPrimaryWorkspaceView(value: unknown): value is PrimaryWorkspaceView {
  return typeof value === 'string' && PRIMARY_VIEW_SET.has(value as PrimaryWorkspaceView);
}

export function getDestinationFromLocation(fallback: Destination = 'home'): Destination {
  if (typeof window !== 'undefined' && window.location.hash) {
    const raw = window.location.hash.replace(/^#\/?/, '').trim();
    if (isValidDestination(raw)) {
      return raw;
    }
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem(NAV_STORAGE_KEY);
      if (isValidDestination(saved)) {
        return saved;
      }
    } catch {
      // Ignore storage access errors
    }
  }
  return fallback;
}

export interface NavigationSnapshot {
  currentView: Destination;
  previousView: Destination | null;
  lastPrimaryView: PrimaryWorkspaceView;
  visitedCount: number;
  zenMode: boolean;
  collapsedGroups: NavGroupKey[];
  pinnedDestinations: Destination[];
}

type NavigationListener = (snapshot: NavigationSnapshot) => void;

interface StoredNavPrefs {
  zenMode?: boolean;
  collapsedGroups?: NavGroupKey[];
  pinnedDestinations?: Destination[];
}

function loadStoredNavPrefs(): StoredNavPrefs {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(NAV_PREFS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredNavPrefs;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Local state manager for AppShell and SidebarNavigation view states.
 * Manages view transitions between Tasks, Journal, Calendar, and all AppShell destinations,
 * plus Zen Mode (Core Only), collapsible navigation groups, and pinned favorite destinations.
 */
export class NavigationStateManager {
  private snapshot: NavigationSnapshot;
  private listeners = new Set<NavigationListener>();

  constructor(initialView?: Destination) {
    const startView =
      initialView && isValidDestination(initialView)
        ? initialView
        : getDestinationFromLocation('home');

    const storedPrefs = loadStoredNavPrefs();
    const validPinned = Array.isArray(storedPrefs.pinnedDestinations)
      ? storedPrefs.pinnedDestinations.filter(isValidDestination).slice(0, MAX_PINNED_DESTINATIONS)
      : [];

    this.snapshot = {
      currentView: startView,
      previousView: null,
      lastPrimaryView: isPrimaryWorkspaceView(startView) ? startView : 'tasks',
      visitedCount: 1,
      zenMode: Boolean(storedPrefs.zenMode),
      collapsedGroups: Array.isArray(storedPrefs.collapsedGroups)
        ? storedPrefs.collapsedGroups
        : [],
      pinnedDestinations:
        validPinned.length > 0 ? validPinned : [...DEFAULT_PINNED_DESTINATIONS],
    };
  }

  public getSnapshot(): NavigationSnapshot {
    return this.snapshot;
  }

  public getCurrentView(): Destination {
    return this.snapshot.currentView;
  }

  public setView(
    nextView: Destination,
    options: { syncHistory?: boolean; replaceHistory?: boolean } = {}
  ): NavigationSnapshot {
    if (!isValidDestination(nextView)) {
      return this.snapshot;
    }

    if (nextView === 'achievements') {
      db.markAchievementsSeen();
    }

    const { syncHistory = true, replaceHistory = false } = options;

    if (nextView === this.snapshot.currentView) {
      if (syncHistory && typeof window !== 'undefined' && replaceHistory) {
        window.history.replaceState({ destination: nextView }, '', `#${nextView}`);
      }
      return this.snapshot;
    }

    const prevView = this.snapshot.currentView;
    const nextPrimary: PrimaryWorkspaceView = isPrimaryWorkspaceView(nextView)
      ? nextView
      : this.snapshot.lastPrimaryView;

    this.snapshot = {
      ...this.snapshot,
      currentView: nextView,
      previousView: prevView,
      lastPrimaryView: nextPrimary,
      visitedCount: this.snapshot.visitedCount + 1,
    };

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(NAV_STORAGE_KEY, nextView);
      } catch {
        // Ignore storage errors
      }
    }

    if (syncHistory && typeof window !== 'undefined') {
      if (replaceHistory) {
        window.history.replaceState({ destination: nextView }, '', `#${nextView}`);
      } else {
        window.history.pushState({ destination: nextView }, '', `#${nextView}`);
      }
    }

    this.emit();
    return this.snapshot;
  }

  public toggleZenMode(explicitValue?: boolean): boolean {
    const nextZen =
      typeof explicitValue === 'boolean' ? explicitValue : !this.snapshot.zenMode;
    this.snapshot = {
      ...this.snapshot,
      zenMode: nextZen,
    };
    this.persistPrefs();
    this.emit();
    return nextZen;
  }

  public toggleGroupCollapsed(group: NavGroupKey): boolean {
    const exists = this.snapshot.collapsedGroups.includes(group);
    const nextGroups = exists
      ? this.snapshot.collapsedGroups.filter(g => g !== group)
      : [...this.snapshot.collapsedGroups, group];

    this.snapshot = {
      ...this.snapshot,
      collapsedGroups: nextGroups,
    };
    this.persistPrefs();
    this.emit();
    return !exists;
  }

  public togglePinnedDestination(dest: Destination): Destination[] {
    if (!isValidDestination(dest)) return this.snapshot.pinnedDestinations;

    const current = this.snapshot.pinnedDestinations;
    let nextPinned: Destination[];

    if (current.includes(dest)) {
      // Keep at least 1 pinned destination
      if (current.length <= 1) return current;
      nextPinned = current.filter(d => d !== dest);
    } else {
      if (current.length >= MAX_PINNED_DESTINATIONS) {
        // Replace the oldest non-active pin or last pin so user can always pin up to 4
        nextPinned = [...current.slice(1), dest];
      } else {
        nextPinned = [...current, dest];
      }
    }

    this.snapshot = {
      ...this.snapshot,
      pinnedDestinations: nextPinned,
    };
    this.persistPrefs();
    this.emit();
    return nextPinned;
  }

  /**
   * Cycles through the primary workspace views: Tasks -> Journal -> Calendar -> Tasks
   */
  public cyclePrimaryWorkspace(): PrimaryWorkspaceView {
    const order: PrimaryWorkspaceView[] = ['tasks', 'journal', 'calendar'];
    const currentIdx = order.indexOf(
      isPrimaryWorkspaceView(this.snapshot.currentView)
        ? this.snapshot.currentView
        : this.snapshot.lastPrimaryView
    );
    const nextPrimary = order[(currentIdx + 1) % order.length];
    this.setView(nextPrimary);
    return nextPrimary;
  }

  public subscribe(listener: NavigationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private persistPrefs(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const payload: StoredNavPrefs = {
        zenMode: this.snapshot.zenMode,
        collapsedGroups: this.snapshot.collapsedGroups,
        pinnedDestinations: this.snapshot.pinnedDestinations,
      };
      localStorage.setItem(NAV_PREFS_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage errors
    }
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.snapshot);
    }
  }
}

export const navigationManager = new NavigationStateManager();

export function useNavigationState(manager: NavigationStateManager = navigationManager) {
  const [snapshot, setSnapshot] = useState<NavigationSnapshot>(() => manager.getSnapshot());

  useEffect(() => {
    setSnapshot(manager.getSnapshot());
    return manager.subscribe(next => {
      setSnapshot(next);
    });
  }, [manager]);

  const navigateTo = useCallback(
    (dest: Destination, options?: { syncHistory?: boolean; replaceHistory?: boolean }) => {
      manager.setView(dest, options);
    },
    [manager]
  );

  return {
    currentDestination: snapshot.currentView,
    previousDestination: snapshot.previousView,
    lastPrimaryView: snapshot.lastPrimaryView,
    visitedCount: snapshot.visitedCount,
    zenMode: snapshot.zenMode,
    collapsedGroups: snapshot.collapsedGroups,
    pinnedDestinations: snapshot.pinnedDestinations,
    navigateTo,
    toggleZenMode: (val?: boolean) => manager.toggleZenMode(val),
    toggleGroupCollapsed: (group: NavGroupKey) => manager.toggleGroupCollapsed(group),
    togglePinnedDestination: (dest: Destination) => manager.togglePinnedDestination(dest),
    cyclePrimaryWorkspace: () => manager.cyclePrimaryWorkspace(),
  };
}
