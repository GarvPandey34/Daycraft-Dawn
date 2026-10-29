// ==========================================
// DAYCRAFT — PERMANENT APP TUTORIAL & WALKTHROUGH SERVICE
// Interactive step-by-step tutorials & isolated local progress state
// ==========================================

import { Destination, isValidDestination } from '../components/navigationState';

export const TUTORIAL_PROGRESS_STORAGE_KEY = 'daycraft_tutorial_progress_v1';

export type TutorialTopicId =
  | 'getting_started'
  | 'tasks_myday'
  | 'habits_routines'
  | 'goals_milestones'
  | 'focus_mode'
  | 'achievements_themes'
  | 'calendar_projects_study'
  | 'wellness_journal_insights'
  | 'settings_privacy_backups';

export interface TutorialTryItAction {
  label: string;
  destination?: Destination;
  openQuickAdd?: boolean;
}

export interface TutorialStep {
  id: string;
  title: string;
  instruction: string;
  detail: string;
  tip?: string;
  tryItAction?: TutorialTryItAction;
}

export interface TutorialTopic {
  id: TutorialTopicId;
  title: string;
  summary: string;
  categoryLabel: string;
  estimatedMinutes: number;
  primaryDestination: Destination;
  steps: TutorialStep[];
}

export interface TutorialProgressState {
  completedTopicIds: TutorialTopicId[];
  currentStepByTopic: Partial<Record<TutorialTopicId, number>>;
  lastActiveTopicId: TutorialTopicId | null;
  dismissedHints: string[];
}

export interface ActiveWalkthroughSession {
  mode: 'single' | 'full_tour';
  topicId: TutorialTopicId;
  stepIndex: number;
  tourTopicIndex: number;
  totalTourTopics: number;
}

export interface FreshStartEmptyStateSpec {
  section: 'tasks' | 'habits' | 'goals' | 'focus' | 'insights' | 'achievements';
  headline: string;
  description: string;
  actionLabel: string;
  destination: Destination;
  secondaryActionLabel?: string;
  secondaryDestination?: Destination;
}

export const FRESH_START_EMPTY_STATES: Record<
  FreshStartEmptyStateSpec['section'],
  FreshStartEmptyStateSpec
> = {
  tasks: {
    section: 'tasks',
    headline: 'Nothing on your list yet.',
    description: 'Capture what matters today with a due date or priority.',
    actionLabel: 'Create your first task',
    destination: 'tasks',
    secondaryActionLabel: 'Explore the app tutorial',
    secondaryDestination: 'tutorial',
  },
  habits: {
    section: 'habits',
    headline: 'Start with one small habit.',
    description: 'Build daily or weekday anchors and track genuine streaks.',
    actionLabel: 'Create a habit',
    destination: 'habits',
  },
  goals: {
    section: 'goals',
    headline: 'What would you like to work toward?',
    description: 'Set a qualitative milestone or a measurable target.',
    actionLabel: 'Set a goal',
    destination: 'goals',
  },
  focus: {
    section: 'focus',
    headline: 'Your next focus session starts here.',
    description: 'Run a distraction-free Pomodoro timer with optional ambient soundscapes.',
    actionLabel: 'Start a focus session',
    destination: 'focus',
  },
  insights: {
    section: 'insights',
    headline: 'Insights will appear as you build your history.',
    description:
      'Completion velocity, weekday consistency, and habit streaks are computed locally from your real activity.',
    actionLabel: 'Explore the app tutorial',
    destination: 'tutorial',
  },
  achievements: {
    section: 'achievements',
    headline: 'All milestone badges begin locked.',
    description:
      'Complete tasks, habits, goals, focus sprints, and reflections to earn XP, level up, and unlock visual themes.',
    actionLabel: 'Create your first task',
    destination: 'tasks',
  },
};

export const TUTORIAL_TOPICS: TutorialTopic[] = [
  {
    id: 'getting_started',
    title: 'Getting Started',
    summary: 'Navigate Daycraft, customize your Home dashboard, and use Quick Add and Command Search.',
    categoryLabel: 'Essentials',
    estimatedMinutes: 2,
    primaryDestination: 'home',
    steps: [
      {
        id: 'gs_1',
        title: 'Navigate the application',
        instruction:
          'Use the left sidebar on desktop or the top menu drawer on mobile to switch between Daily Flow, Planning & Sprints, and Reflect & Growth.',
        detail:
          'You can collapse sidebar sections, pin up to 4 favorite views to the top switcher, or toggle Zen Mode (Core) to show only My Day, Tasks, Journal, Calendar, and Habits.',
        tip: 'Press Alt+1, Alt+2, or Alt+3 at any time to jump directly to Tasks, Journal, or Calendar.',
        tryItAction: {
          label: 'Open Home Dashboard',
          destination: 'home',
        },
      },
      {
        id: 'gs_2',
        title: 'Understand the Home dashboard',
        instruction:
          'Home brings together your daily completion progress, 7-day activity chart, priorities due today, habit anchors, active goals, and focus launcher.',
        detail:
          'Select the "Widgets" button in the top-right corner of Home to show or hide individual dashboard cards. Your layout preferences are saved locally.',
        tryItAction: {
          label: 'View Home Widgets',
          destination: 'home',
        },
      },
      {
        id: 'gs_3',
        title: 'Use Quick Add & Command Search',
        instruction:
          'Select "Quick Add" (⌘Q) in the sidebar to capture a task, habit, or calendar event from anywhere, or select "Command & Search" (⌘K) to search all records and run quick actions.',
        detail:
          'Quick Add supports natural date and priority phrases such as "Review roadmap tomorrow at 14:00 !high #work".',
        tryItAction: {
          label: 'Try Quick Add now',
          openQuickAdd: true,
        },
      },
      {
        id: 'gs_4',
        title: 'Find App Tutorial & Settings',
        instruction:
          'App Tutorial sits permanently right above Settings at the bottom of the navigation menu so you can revisit any walkthrough whenever you need a refresher.',
        detail:
          'Settings lets you customize themes, motion preferences, audio, local PIN security, and offline backups.',
        tryItAction: {
          label: 'Open Settings',
          destination: 'settings',
        },
      },
    ],
  },
  {
    id: 'tasks_myday',
    title: 'Tasks & My Day',
    summary: 'Create tasks, organize priorities and due dates, plan My Day, and understand task completion.',
    categoryLabel: 'Daily Flow',
    estimatedMinutes: 3,
    primaryDestination: 'tasks',
    steps: [
      {
        id: 'tm_1',
        title: 'Create a task',
        instruction:
          'Open Tasks and select the "New Task" button (or press ⌘Q) to add something you want to accomplish.',
        detail:
          'Give your task a clear title, optional description, tags, and an estimated duration in minutes.',
        tryItAction: {
          label: 'Open Tasks',
          destination: 'tasks',
        },
      },
      {
        id: 'tm_2',
        title: 'Set priority and due date',
        instruction:
          'Assign a priority level (Low, Medium, High, or Urgent) and choose a due date or due time to organize your schedule.',
        detail:
          'Tasks due today automatically surface in My Day and on the Home dashboard under Today’s Priorities.',
        tryItAction: {
          label: 'Plan in My Day',
          destination: 'myday',
        },
      },
      {
        id: 'tm_3',
        title: 'Mark a task complete & organize by project',
        instruction:
          'Select the checkbox next to any task to mark it completed. You can also link tasks to a Project or drag a task onto Calendar to time-block it.',
        detail:
          'In My Day, use the 2-minute "Evening Shutdown" button at the end of the day to roll unfinished tasks over to tomorrow and log a brief reflection.',
        tryItAction: {
          label: 'Go to My Day',
          destination: 'myday',
        },
      },
      {
        id: 'tm_4',
        title: 'What happens when a task is reopened',
        instruction:
          'Unchecking a completed task reopens it and returns it to active status so you can continue working on it.',
        detail:
          'Completing a task for the first time awards +15 XP (when gamification is enabled). Reopening and re-completing the same task never awards duplicate XP.',
        tryItAction: {
          label: 'Explore Tasks',
          destination: 'tasks',
        },
      },
    ],
  },
  {
    id: 'habits_routines',
    title: 'Habits & Routines',
    summary: 'Build recurring habits, log daily occurrences, track streaks, and run ordered routine stacks.',
    categoryLabel: 'Consistency',
    estimatedMinutes: 3,
    primaryDestination: 'habits',
    steps: [
      {
        id: 'hr_1',
        title: 'Create a habit',
        instruction:
          'Open Habits and select "New Habit" to define a recurring practice such as hydration, reading, or morning movement.',
        detail:
          'Choose a schedule (Daily or Weekdays) and a target type (Checkmark, Numeric count, or Duration in minutes).',
        tryItAction: {
          label: 'Open Habits',
          destination: 'habits',
        },
      },
      {
        id: 'hr_2',
        title: 'Planned habit vs. completed occurrence',
        instruction:
          'A Habit is your recurring plan and target definition; an Occurrence is the record logged for a specific calendar date.',
        detail:
          'When your recorded value for a date meets or exceeds the habit’s target value, that date’s occurrence is marked Completed.',
        tryItAction: {
          label: 'View Habit Tracker',
          destination: 'habits',
        },
      },
      {
        id: 'hr_3',
        title: 'Understand streaks and historical logging',
        instruction:
          'Streaks count consecutive scheduled days you complete a habit. Configured rest days (such as weekends on weekday habits) do not break your streak.',
        detail:
          'You can log today’s completion or backfill recent days. Completing a habit awards +10 XP once per habit per date (within the 7-day backfill window).',
        tryItAction: {
          label: 'Check Habit Streaks',
          destination: 'habits',
        },
      },
      {
        id: 'hr_4',
        title: 'Use recurring Habit Routines',
        instruction:
          'Group multiple habits into an ordered Morning, Afternoon, Evening, or Anytime routine stack in the Habits view.',
        detail:
          'Completing a routine cascade marks its linked habits done for today and awards a +30 XP routine bonus once per day.',
        tryItAction: {
          label: 'Explore Routines in Habits',
          destination: 'habits',
        },
      },
    ],
  },
  {
    id: 'goals_milestones',
    title: 'Goals & Milestones',
    summary: 'Set qualitative or measurable goals, update progress safely, and manage completed or archived goals.',
    categoryLabel: 'Planning & Sprints',
    estimatedMinutes: 4,
    primaryDestination: 'goals',
    steps: [
      {
        id: 'gm_1',
        title: 'Create a qualitative or measurable goal',
        instruction:
          'Open Goals and select "New Goal". Choose either a Measurable Goal (with a numeric target and unit, like "30 days") or a Qualitative Goal.',
        detail:
          'You can also set a category, target date, and link related Projects or Habits to keep context connected.',
        tryItAction: {
          label: 'Open Goals',
          destination: 'goals',
        },
      },
      {
        id: 'gm_2',
        title: 'Edit a goal & update measurable progress',
        instruction:
          'Use the quick step buttons (-1, +1, +5) or direct numeric input on any active measurable goal card to update your current value, or select "Edit" to modify goal details.',
        detail:
          'Visual progress bars cap cleanly at 100% even if your current value exceeds the target (for example, 35 / 30 days), while preserving your exact recorded number.',
        tryItAction: {
          label: 'Manage Goals',
          destination: 'goals',
        },
      },
      {
        id: 'gm_3',
        title: 'Completed Goals & completion rewards',
        instruction:
          'When an active measurable goal reaches its positive target—or when you click "Complete"—it moves automatically to the Completed Goals section.',
        detail:
          'Completing a goal records its completion timestamp (achievedAt) and awards +100 XP once.',
        tryItAction: {
          label: 'View Goals Sections',
          destination: 'goals',
        },
      },
      {
        id: 'gm_4',
        title: 'Pause, reopen, and archive goals',
        instruction:
          'Use the action row on any goal card to Pause an active goal, Reopen a completed goal back to Active Goals, or Archive a goal you no longer want in active view.',
        detail:
          'Paused or archived goals never auto-complete when edited. Reopening a completed goal preserves its original completion timestamp and will not double-award XP if completed again.',
        tryItAction: {
          label: 'Go to Goals',
          destination: 'goals',
        },
      },
    ],
  },
  {
    id: 'focus_mode',
    title: 'Focus Mode',
    summary: 'Run Pomodoro focus sessions, mix procedural ambient sounds, and understand device distraction controls.',
    categoryLabel: 'Deep Work',
    estimatedMinutes: 3,
    primaryDestination: 'focus',
    steps: [
      {
        id: 'fm_1',
        title: 'Start, pause, resume, and finish a session',
        instruction:
          'Open Focus to launch a countdown timer. You can pause and resume at any point, reset the timer, or complete the session to log your focus minutes.',
        detail:
          'Each completed focus session is saved to your local history and awards +25 XP.',
        tryItAction: {
          label: 'Open Focus Timer',
          destination: 'focus',
        },
      },
      {
        id: 'fm_2',
        title: 'Adjust session and break durations',
        instruction:
          'Switch between Focus Sprint, Short Break, and Long Break, or select preset durations (15m, 25m, 45m, 60m) and custom minute values.',
        detail:
          'You can attach a session note describing what you are working on before or during the sprint.',
        tryItAction: {
          label: 'Configure Focus Timer',
          destination: 'focus',
        },
      },
      {
        id: 'fm_3',
        title: 'Ambient soundscapes & volume mixer',
        instruction:
          'Toggle procedural audio tracks—such as Rain, Fireplace, Forest Wind, Ocean Waves, or Coffee Shop—and adjust individual track sliders or master volume.',
        detail:
          'All ambient soundscapes are synthesized locally in real time using the Web Audio API with zero external audio downloads.',
        tryItAction: {
          label: 'Try Soundscape Mixer',
          destination: 'focus',
        },
      },
      {
        id: 'fm_4',
        title: 'Device distraction modes & permission limits',
        instruction:
          'Before a session starts, you can choose Silent, Vibrate, Do Not Disturb, or Normal Sound, and automatically restore your previous mode when the session ends.',
        detail:
          'Honest capability note: In-app banner and chime suppression works everywhere. Hardware vibration requires a device vibration actuator, and OS-wide ringer/DND changes require native Android or Windows integration (browser tabs use in-app DND fallback).',
        tryItAction: {
          label: 'Review Focus Settings',
          destination: 'settings',
        },
      },
    ],
  },
  {
    id: 'achievements_themes',
    title: 'Achievements, Levels & Themes',
    summary: 'Understand how XP is earned, explore the 19-badge gallery, track level milestones, and equip unlockable themes.',
    categoryLabel: 'Progression',
    estimatedMinutes: 3,
    primaryDestination: 'achievements',
    steps: [
      {
        id: 'at_1',
        title: 'How XP and levels work',
        instruction:
          'Genuine actions earn XP: Tasks (+15), Habits (+10), Routines (+30), Focus (+25), Study (+20), Journal (+10), Goals (+100), and Milestone Badges (+30 to +500).',
        detail:
          'Every new installation begins at Level 1 with 0 XP. You can pause or re-enable gamification at any time in Settings.',
        tryItAction: {
          label: 'Open Achievements',
          destination: 'achievements',
        },
      },
      {
        id: 'at_2',
        title: 'Explore the badge gallery',
        instruction:
          'Open Achievements in the sidebar to view all 19 badges across Productivity, Consistency, Deep Focus, Learning, and Mastery.',
        detail:
          'Filter badges by status (All, Unlocked, In Progress, Locked), category, or rarity tier (Bronze, Silver, Gold, Diamond, Obsidian). Locked badges clearly show the exact requirement needed to earn them.',
        tryItAction: {
          label: 'Browse Badge Gallery',
          destination: 'achievements',
        },
      },
      {
        id: 'at_3',
        title: 'Unlock visual themes through progression',
        instruction:
          'Warm Paper, Sage Garden, and Monochrome are unlocked from Level 1. Additional themes unlock as you reach Level 3 (Midnight), Level 5 (Lavender Haze), Level 7 (Aurora), or specific achievements (Emerald Luxe, Sunset, Solar Gold).',
        detail:
          'Unlocking a theme never overwrites your current appearance automatically—you choose when to equip it.',
        tryItAction: {
          label: 'Preview Themes in Achievements',
          destination: 'achievements',
        },
      },
      {
        id: 'at_4',
        title: 'Equip an unlocked theme',
        instruction:
          'Select "Equip Theme" on any unlocked palette in either the Achievements Theme Collection or under Settings > Theme Presets & Palette Engine.',
        detail:
          'You can also toggle between Light, Dark, and System appearance modes for any equipped palette.',
        tryItAction: {
          label: 'Open Theme Settings',
          destination: 'settings',
        },
      },
    ],
  },
  {
    id: 'calendar_projects_study',
    title: 'Calendar, Projects & Study',
    summary: 'Time-block your schedule on the Calendar, track multi-step Projects, and log Study sessions.',
    categoryLabel: 'Planning & Learning',
    estimatedMinutes: 3,
    primaryDestination: 'calendar',
    steps: [
      {
        id: 'cps_1',
        title: 'Schedule events & time blocks on Calendar',
        instruction:
          'Open Calendar to view your schedule by day or month, add events, or create focused time blocks.',
        detail:
          'You can drag a task card from Tasks and drop it onto a Calendar time slot (or click "Send to Calendar" in My Day) to schedule a time block automatically.',
        tryItAction: {
          label: 'Open Calendar',
          destination: 'calendar',
        },
      },
      {
        id: 'cps_2',
        title: 'Organize work into Projects',
        instruction:
          'Open Projects to group related tasks under a larger initiative and break work down into checkable project milestones.',
        detail:
          'Completing all milestones on an active project marks the project completed and unlocks the "Grand Architect" badge.',
        tryItAction: {
          label: 'Open Projects',
          destination: 'projects',
        },
      },
      {
        id: 'cps_3',
        title: 'Track subjects in Study Mode',
        instruction:
          'Open Study to create learning subjects with weekly hour goals and topic tags, then select "Log Session" whenever you finish studying.',
        detail:
          'Logging a study session records your duration and topic history and awards +20 XP.',
        tryItAction: {
          label: 'Open Study Mode',
          destination: 'study',
        },
      },
    ],
  },
  {
    id: 'wellness_journal_insights',
    title: 'Wellness, Journal & Insights',
    summary: 'Log optional self-observation metrics, write Markdown reflections, and review local analytics.',
    categoryLabel: 'Reflect & Growth',
    estimatedMinutes: 3,
    primaryDestination: 'journal',
    steps: [
      {
        id: 'wji_1',
        title: 'Optional tracking in Wellness',
        instruction:
          'Open Wellness to optionally log Sleep Quality, Daily Hydration, Movement, and Energy Level for any date.',
        detail:
          'Important: Wellness tracking is for calm, personal self-observation only and is never medical advice. All entries start at 0 on a fresh install.',
        tryItAction: {
          label: 'Open Wellness',
          destination: 'wellness',
        },
      },
      {
        id: 'wji_2',
        title: 'Write reflections in Journal',
        instruction:
          'Open Journal to write Markdown entries with headings, interactive checklists, tags, and 1–5 mood and energy ratings.',
        detail:
          'Each entry includes a collapsible Daily Activity Context footer summarizing tasks completed, habits logged, and focus minutes for that date.',
        tryItAction: {
          label: 'Open Journal',
          destination: 'journal',
        },
      },
      {
        id: 'wji_3',
        title: 'Understand Insights & empty-state behavior',
        instruction:
          'Open Insights to inspect your 7-day completion velocity chart (Grouped, Stacked, or Trend Area), habit streak rates, and weekday distribution.',
        detail:
          'When your database has no records yet, Insights shows honest zero values and helpful next actions rather than fabricated productivity scores.',
        tryItAction: {
          label: 'Open Insights',
          destination: 'insights',
        },
      },
    ],
  },
  {
    id: 'settings_privacy_backups',
    title: 'Settings, Privacy & Backups',
    summary: 'Understand local storage, export/restore verified backups, and safely reset personal data.',
    categoryLabel: 'System & Data',
    estimatedMinutes: 3,
    primaryDestination: 'settings',
    steps: [
      {
        id: 'spb_1',
        title: 'Customize preferences & App Lock',
        instruction:
          'Open Settings to configure your workspace display name, theme palette, Reduce Motion accessibility mode, UI sound volume, and optional 4-digit PIN App Lock.',
        detail:
          'Your PIN is stored locally as a salted SHA-256 hash to lock the interface on shared devices.',
        tryItAction: {
          label: 'Open Settings',
          destination: 'settings',
        },
      },
      {
        id: 'spb_2',
        title: 'Local storage & verified .daycraft backups',
        instruction:
          'Daycraft stores your data locally on your device (in browser/local storage) with no cloud accounts or background sync.',
        detail:
          'Use "Export Verified Backup (.daycraft)" in Settings to save a JSON backup file with a CRC32 integrity checksum. Backups are plain JSON archives (not encrypted), so store exported files in a trusted location.',
        tryItAction: {
          label: 'View Backup Controls',
          destination: 'settings',
        },
      },
      {
        id: 'spb_3',
        title: 'Resetting personal data safely',
        instruction:
          'Under Settings > Local Database Backups & Restore, selecting "Reset Personal Data" lets you erase all tasks, habits, goals, sessions, journals, XP, and unlocked badges.',
        detail:
          'Because local data cannot be recovered without a backup file, Reset Personal Data requires explicit confirmation (typing RESET) before returning Daycraft to a clean initial state.',
        tryItAction: {
          label: 'Go to Data Management',
          destination: 'settings',
        },
      },
    ],
  },
];

function createDefaultProgressState(): TutorialProgressState {
  return {
    completedTopicIds: [],
    currentStepByTopic: {},
    lastActiveTopicId: null,
    dismissedHints: [],
  };
}

function isValidTopicId(value: unknown): value is TutorialTopicId {
  return (
    typeof value === 'string' &&
    TUTORIAL_TOPICS.some(topic => topic.id === value)
  );
}

export class TutorialManager {
  private state: TutorialProgressState = createDefaultProgressState();
  private activeSession: ActiveWalkthroughSession | null = null;
  private listeners = new Set<() => void>();

  constructor(autoLoad: boolean = true) {
    if (autoLoad) {
      this.load();
    }
  }

  public load(): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      const raw = window.localStorage.getItem(TUTORIAL_PROGRESS_STORAGE_KEY);
      if (!raw) {
        this.state = createDefaultProgressState();
        return;
      }
      const parsed = JSON.parse(raw) as Partial<TutorialProgressState>;
      const completed = Array.isArray(parsed.completedTopicIds)
        ? parsed.completedTopicIds.filter(isValidTopicId)
        : [];
      const stepMap: Partial<Record<TutorialTopicId, number>> = {};
      if (parsed.currentStepByTopic && typeof parsed.currentStepByTopic === 'object') {
        for (const [k, v] of Object.entries(parsed.currentStepByTopic)) {
          if (isValidTopicId(k) && typeof v === 'number' && Number.isFinite(v) && v >= 0) {
            const topic = this.getTopic(k);
            if (topic) {
              stepMap[k] = Math.min(Math.floor(v), Math.max(0, topic.steps.length - 1));
            }
          }
        }
      }
      const lastActive = isValidTopicId(parsed.lastActiveTopicId)
        ? parsed.lastActiveTopicId
        : null;
      const dismissedHints = Array.isArray(parsed.dismissedHints)
        ? parsed.dismissedHints.filter((h): h is string => typeof h === 'string')
        : [];

      this.state = {
        completedTopicIds: Array.from(new Set(completed)),
        currentStepByTopic: stepMap,
        lastActiveTopicId: lastActive,
        dismissedHints: Array.from(new Set(dismissedHints)),
      };
    } catch {
      this.state = createDefaultProgressState();
    }
  }

  private persist(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(
          TUTORIAL_PROGRESS_STORAGE_KEY,
          JSON.stringify(this.state)
        );
      } catch {
        // Ignore storage errors
      }
    }
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach(fn => fn());
  }

  public getTopics(): TutorialTopic[] {
    return TUTORIAL_TOPICS;
  }

  public getTopic(topicId: TutorialTopicId): TutorialTopic | undefined {
    return TUTORIAL_TOPICS.find(t => t.id === topicId);
  }

  public getProgressState(): TutorialProgressState {
    return {
      completedTopicIds: [...this.state.completedTopicIds],
      currentStepByTopic: { ...this.state.currentStepByTopic },
      lastActiveTopicId: this.state.lastActiveTopicId,
      dismissedHints: [...this.state.dismissedHints],
    };
  }

  public getActiveSession(): ActiveWalkthroughSession | null {
    return this.activeSession ? { ...this.activeSession } : null;
  }

  public isTopicCompleted(topicId: TutorialTopicId): boolean {
    return this.state.completedTopicIds.includes(topicId);
  }

  public getSavedStepIndex(topicId: TutorialTopicId): number {
    const saved = this.state.currentStepByTopic[topicId];
    return typeof saved === 'number' && saved >= 0 ? saved : 0;
  }

  public getCompletionSummary(): {
    completedCount: number;
    totalCount: number;
    percent: number;
  } {
    const totalCount = TUTORIAL_TOPICS.length;
    const completedCount = this.state.completedTopicIds.length;
    const percent =
      totalCount > 0 ? Math.min(100, Math.round((completedCount / totalCount) * 100)) : 0;
    return { completedCount, totalCount, percent };
  }

  /**
   * Starts or resumes a single tutorial topic.
   */
  public startTutorial(
    topicId: TutorialTopicId,
    options?: { restart?: boolean }
  ): ActiveWalkthroughSession | null {
    const topic = this.getTopic(topicId);
    if (!topic) return null;

    const startStep = options?.restart ? 0 : this.getSavedStepIndex(topicId);
    const tourIdx = TUTORIAL_TOPICS.findIndex(t => t.id === topicId);

    this.state = {
      ...this.state,
      currentStepByTopic: {
        ...this.state.currentStepByTopic,
        [topicId]: startStep,
      },
      lastActiveTopicId: topicId,
    };

    this.activeSession = {
      mode: 'single',
      topicId,
      stepIndex: startStep,
      tourTopicIndex: Math.max(0, tourIdx),
      totalTourTopics: TUTORIAL_TOPICS.length,
    };

    this.persist();
    return this.getActiveSession();
  }

  /**
   * Starts the full guided tour across all tutorial topics in sequence.
   */
  public startFullTour(options?: { restart?: boolean }): ActiveWalkthroughSession {
    let startTopicIndex = 0;
    if (!options?.restart) {
      const firstIncompleteIdx = TUTORIAL_TOPICS.findIndex(
        t => !this.state.completedTopicIds.includes(t.id)
      );
      if (firstIncompleteIdx >= 0) {
        startTopicIndex = firstIncompleteIdx;
      }
    }

    const firstTopic = TUTORIAL_TOPICS[startTopicIndex] || TUTORIAL_TOPICS[0];
    this.state = {
      ...this.state,
      currentStepByTopic: {
        ...this.state.currentStepByTopic,
        [firstTopic.id]: 0,
      },
      lastActiveTopicId: firstTopic.id,
    };

    this.activeSession = {
      mode: 'full_tour',
      topicId: firstTopic.id,
      stepIndex: 0,
      tourTopicIndex: startTopicIndex,
      totalTourTopics: TUTORIAL_TOPICS.length,
    };

    this.persist();
    return this.getActiveSession()!;
  }

  /**
   * Advances to the next step in the active tutorial (or next topic in full tour mode).
   */
  public nextStep(): ActiveWalkthroughSession | null {
    if (!this.activeSession) return null;
    const topic = this.getTopic(this.activeSession.topicId);
    if (!topic) return null;

    if (this.activeSession.stepIndex < topic.steps.length - 1) {
      const nextIdx = this.activeSession.stepIndex + 1;
      this.activeSession = {
        ...this.activeSession,
        stepIndex: nextIdx,
      };
      this.state = {
        ...this.state,
        currentStepByTopic: {
          ...this.state.currentStepByTopic,
          [topic.id]: nextIdx,
        },
        lastActiveTopicId: topic.id,
      };
      this.persist();
      return this.getActiveSession();
    }

    // At the final step of the current topic
    this.markTopicCompletedInternal(topic.id);

    if (
      this.activeSession.mode === 'full_tour' &&
      this.activeSession.tourTopicIndex < TUTORIAL_TOPICS.length - 1
    ) {
      const nextTourIdx = this.activeSession.tourTopicIndex + 1;
      const nextTopic = TUTORIAL_TOPICS[nextTourIdx];
      this.activeSession = {
        mode: 'full_tour',
        topicId: nextTopic.id,
        stepIndex: 0,
        tourTopicIndex: nextTourIdx,
        totalTourTopics: TUTORIAL_TOPICS.length,
      };
      this.state = {
        ...this.state,
        currentStepByTopic: {
          ...this.state.currentStepByTopic,
          [nextTopic.id]: 0,
        },
        lastActiveTopicId: nextTopic.id,
      };
      this.persist();
      return this.getActiveSession();
    }

    // Finished walkthrough
    this.activeSession = null;
    this.persist();
    return null;
  }

  /**
   * Moves back one step in the active tutorial (or to the previous topic in full tour mode).
   */
  public prevStep(): ActiveWalkthroughSession | null {
    if (!this.activeSession) return null;
    const topic = this.getTopic(this.activeSession.topicId);
    if (!topic) return null;

    if (this.activeSession.stepIndex > 0) {
      const prevIdx = this.activeSession.stepIndex - 1;
      this.activeSession = {
        ...this.activeSession,
        stepIndex: prevIdx,
      };
      this.state = {
        ...this.state,
        currentStepByTopic: {
          ...this.state.currentStepByTopic,
          [topic.id]: prevIdx,
        },
      };
      this.persist();
      return this.getActiveSession();
    }

    if (this.activeSession.mode === 'full_tour' && this.activeSession.tourTopicIndex > 0) {
      const prevTourIdx = this.activeSession.tourTopicIndex - 1;
      const prevTopic = TUTORIAL_TOPICS[prevTourIdx];
      const lastStepIdx = Math.max(0, prevTopic.steps.length - 1);
      this.activeSession = {
        mode: 'full_tour',
        topicId: prevTopic.id,
        stepIndex: lastStepIdx,
        tourTopicIndex: prevTourIdx,
        totalTourTopics: TUTORIAL_TOPICS.length,
      };
      this.state = {
        ...this.state,
        currentStepByTopic: {
          ...this.state.currentStepByTopic,
          [prevTopic.id]: lastStepIdx,
        },
        lastActiveTopicId: prevTopic.id,
      };
      this.persist();
      return this.getActiveSession();
    }

    return this.getActiveSession();
  }

  /**
   * Skips the current tutorial (or advances to the next topic in full tour mode without marking current completed).
   */
  public skipTutorial(): ActiveWalkthroughSession | null {
    if (!this.activeSession) return null;

    if (
      this.activeSession.mode === 'full_tour' &&
      this.activeSession.tourTopicIndex < TUTORIAL_TOPICS.length - 1
    ) {
      const nextTourIdx = this.activeSession.tourTopicIndex + 1;
      const nextTopic = TUTORIAL_TOPICS[nextTourIdx];
      this.activeSession = {
        mode: 'full_tour',
        topicId: nextTopic.id,
        stepIndex: 0,
        tourTopicIndex: nextTourIdx,
        totalTourTopics: TUTORIAL_TOPICS.length,
      };
      this.state = {
        ...this.state,
        lastActiveTopicId: nextTopic.id,
      };
      this.persist();
      return this.getActiveSession();
    }

    this.activeSession = null;
    this.notify();
    return null;
  }

  /**
   * Completes the current tutorial topic immediately and closes the active walkthrough.
   */
  public finishTutorial(): void {
    if (!this.activeSession) return;
    this.markTopicCompletedInternal(this.activeSession.topicId);
    this.activeSession = null;
    this.persist();
  }

  /**
   * Exits/closes the active walkthrough while remembering the current step index.
   */
  public exitWalkthrough(): void {
    if (!this.activeSession) return;
    this.activeSession = null;
    this.notify();
  }

  /**
   * Restarts a specific tutorial topic from Step 1 (index 0) and clears its completed flag until finished again.
   */
  public restartTutorial(topicId: TutorialTopicId): ActiveWalkthroughSession | null {
    const topic = this.getTopic(topicId);
    if (!topic) return null;

    this.state = {
      ...this.state,
      completedTopicIds: this.state.completedTopicIds.filter(id => id !== topicId),
      currentStepByTopic: {
        ...this.state.currentStepByTopic,
        [topicId]: 0,
      },
      lastActiveTopicId: topicId,
    };

    const tourIdx = TUTORIAL_TOPICS.findIndex(t => t.id === topicId);
    this.activeSession = {
      mode: 'single',
      topicId,
      stepIndex: 0,
      tourTopicIndex: Math.max(0, tourIdx),
      totalTourTopics: TUTORIAL_TOPICS.length,
    };

    this.persist();
    return this.getActiveSession();
  }

  /**
   * Resets all tutorial completion progress and dismissed hints.
   */
  public resetAllTutorialProgress(): void {
    this.state = createDefaultProgressState();
    this.activeSession = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(TUTORIAL_PROGRESS_STORAGE_KEY);
      } catch {
        // Ignore storage errors
      }
    }
    this.persist();
  }

  public isHintDismissed(hintId: string): boolean {
    return this.state.dismissedHints.includes(hintId);
  }

  public dismissHint(hintId: string): void {
    if (!hintId || this.state.dismissedHints.includes(hintId)) return;
    this.state = {
      ...this.state,
      dismissedHints: [...this.state.dismissedHints, hintId],
    };
    this.persist();
  }

  private markTopicCompletedInternal(topicId: TutorialTopicId): void {
    const completedSet = new Set(this.state.completedTopicIds);
    completedSet.add(topicId);
    this.state = {
      ...this.state,
      completedTopicIds: Array.from(completedSet),
      currentStepByTopic: {
        ...this.state.currentStepByTopic,
        [topicId]: 0,
      },
      lastActiveTopicId: topicId,
    };
  }
}

/**
 * Validates that every tutorial topic and step references only existing destinations
 * and contains no obsolete AI Companion instructions.
 */
export function validateTutorialCatalogIntegrity(): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const forbiddenTerms = ['ai companion', 'offline ai', 'gguf', 'webllm', 'llama.cpp'];

  for (const topic of TUTORIAL_TOPICS) {
    if (!isValidDestination(topic.primaryDestination)) {
      errors.push(`Topic "${topic.id}" has invalid primaryDestination "${topic.primaryDestination}".`);
    }
    if (!topic.steps || topic.steps.length === 0) {
      errors.push(`Topic "${topic.id}" has no steps.`);
    }
    for (const step of topic.steps) {
      if (
        step.tryItAction?.destination &&
        !isValidDestination(step.tryItAction.destination)
      ) {
        errors.push(
          `Step "${step.id}" in topic "${topic.id}" has invalid tryItAction destination "${step.tryItAction.destination}".`
        );
      }
      const combinedText = `${topic.title} ${topic.summary} ${step.title} ${step.instruction} ${step.detail} ${step.tip || ''}`.toLowerCase();
      for (const term of forbiddenTerms) {
        if (combinedText.includes(term)) {
          errors.push(`Step "${step.id}" in topic "${topic.id}" contains obsolete term "${term}".`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export const tutorialManager = new TutorialManager();
