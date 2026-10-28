// ==========================================
// DAYCRAFT — CENTRALIZED PREMIUM MOTION SYSTEM
// Fluid, intentional, tactile 60 FPS transitions
// Accessible reduced-motion compliance, page-visibility
// awareness & calibrated spring tokens
// ==========================================

import { useEffect, useState, useMemo } from 'react';
import type { Transition, Variants } from 'motion/react';
import { db } from '../database/db';

export type MotionMode = 'system' | 'reduced' | 'full';

// Calibrated Timing Curves & Durations (150ms–350ms for UI, longer for atmosphere)
export const MOTION_DURATIONS = {
  instant: 0.08,
  fast: 0.15,       // 150ms: quick press/release feedback, tooltip fades
  micro: 0.18,      // 180ms: buttons, toggle switches, icon state shifts
  nav: 0.22,        // 220ms: view transitions, tabs, drawers
  modal: 0.24,      // 240ms: dialog entrance & exit
  card: 0.26,       // 260ms: expand/collapse, card layout shifts
  expand: 0.28,     // 280ms: collapsible settings & mixer panels
  atmospheric: 0.75,// 750ms: ambient background drift, soundscape crossfade
  ambientCycle: 8.0,// 8000ms: ultra-slow calm focus mode background breath
} as const;

export const MOTION_EASINGS = {
  // Smooth decelerating cubic-bezier for natural physical feel
  easeOut: [0.16, 1, 0.3, 1] as [number, number, number, number],
  easeInOut: [0.4, 0, 0.2, 1] as [number, number, number, number],
  gentleDecel: [0, 0, 0.2, 1] as [number, number, number, number],
  subtleExit: [0.4, 0, 1, 1] as [number, number, number, number],
} as const;

export const MOTION_SPRINGS = {
  gentle: { type: 'spring', stiffness: 220, damping: 24, mass: 0.8 } as Transition,
  snappy: { type: 'spring', stiffness: 360, damping: 28, mass: 0.7 } as Transition,
  tactile: { type: 'spring', stiffness: 460, damping: 32, mass: 0.6 } as Transition,
  bouncyLight: { type: 'spring', stiffness: 300, damping: 20, mass: 0.7 } as Transition,
  layout: { type: 'spring', stiffness: 320, damping: 30, mass: 0.75 } as Transition,
  indicator: { type: 'spring', stiffness: 380, damping: 30, mass: 0.65 } as Transition,
} as const;

// Helper to determine active reduced motion state
export function resolveReducedMotion(mode: MotionMode, systemReduced: boolean): boolean {
  if (mode === 'reduced') return true;
  if (mode === 'full') return false;
  return systemReduced;
}

/**
 * Helper to determine whether decorative/ambient background animations should run.
 * Pauses when reduced motion is active OR when the app/window is hidden/inactive.
 */
export function shouldRunAmbientAnimation(isReduced: boolean, isPageVisible: boolean): boolean {
  return !isReduced && isPageVisible;
}

/**
 * Hook to access motion preferences, page visibility, and reduced-motion-aware animation configurations.
 */
export function useMotionPreference() {
  const [motionMode, setMotionMode] = useState<MotionMode>(() => {
    try {
      const s = db.getSettings();
      return s.reduceMotion || 'system';
    } catch {
      return 'system';
    }
  });

  const [systemReduced, setSystemReduced] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  const [isPageVisible, setIsPageVisible] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.visibilityState !== 'hidden';
    }
    return true;
  });

  // Listen to system prefers-reduced-motion media query
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setSystemReduced(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Listen to document visibilitychange to pause non-essential animations when inactive
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibility = () => {
      setIsPageVisible(document.visibilityState !== 'hidden');
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Listen to Daycraft database settings changes
  useEffect(() => {
    const unsubscribe = db.subscribe(() => {
      const s = db.getSettings();
      const nextMode = s.reduceMotion || 'system';
      if (nextMode !== motionMode) {
        setMotionMode(nextMode);
      }
    });
    return unsubscribe;
  }, [motionMode]);

  const isReduced = useMemo(
    () => resolveReducedMotion(motionMode, systemReduced),
    [motionMode, systemReduced]
  );

  const allowAmbient = useMemo(
    () => shouldRunAmbientAnimation(isReduced, isPageVisible),
    [isReduced, isPageVisible]
  );

  // Motion-aware transitions
  const transitions = useMemo(() => {
    if (isReduced) {
      return {
        page: { duration: 0.08, ease: 'linear' as const },
        card: { duration: 0.08, ease: 'linear' as const },
        tap: { duration: 0 },
        spring: { duration: 0.08 },
        layout: { duration: 0.08 },
        fade: { duration: 0.08 },
        atmospheric: { duration: 0.15 },
      };
    }
    return {
      page: { duration: MOTION_DURATIONS.nav, ease: MOTION_EASINGS.easeOut },
      card: { duration: MOTION_DURATIONS.card, ease: MOTION_EASINGS.easeOut },
      tap: MOTION_SPRINGS.tactile,
      spring: MOTION_SPRINGS.snappy,
      layout: MOTION_SPRINGS.layout,
      fade: { duration: MOTION_DURATIONS.micro, ease: MOTION_EASINGS.easeOut },
      atmospheric: { duration: MOTION_DURATIONS.atmospheric, ease: MOTION_EASINGS.easeInOut },
    };
  }, [isReduced]);

  // Motion-aware reusable variants
  const variants: Record<string, Variants> = useMemo(() => {
    if (isReduced) {
      return {
        page: {
          initial: { opacity: 0 },
          animate: { opacity: 1, transition: { duration: 0.08 } },
          exit: { opacity: 0, transition: { duration: 0.06 } },
        },
        cardListContainer: {
          initial: {},
          animate: { transition: { staggerChildren: 0 } },
        },
        cardItem: {
          initial: { opacity: 0 },
          animate: { opacity: 1, transition: { duration: 0.08 } },
          exit: { opacity: 0, transition: { duration: 0.06 } },
        },
        activeLayerItem: {
          initial: { opacity: 0 },
          animate: { opacity: 1, transition: { duration: 0.08 } },
          exit: { opacity: 0, transition: { duration: 0.08 } },
        },
        modalOverlay: {
          initial: { opacity: 0 },
          animate: { opacity: 1, transition: { duration: 0.08 } },
          exit: { opacity: 0, transition: { duration: 0.08 } },
        },
        modalDialog: {
          initial: { opacity: 0 },
          animate: { opacity: 1, transition: { duration: 0.08 } },
          exit: { opacity: 0, transition: { duration: 0.08 } },
        },
        accordion: {
          initial: { height: 0, opacity: 0, overflow: 'hidden' },
          animate: { height: 'auto', opacity: 1, overflow: 'visible', transition: { duration: 0.08 } },
          exit: { height: 0, opacity: 0, overflow: 'hidden', transition: { duration: 0.08 } },
        },
        badgeFlip: {
          initial: { opacity: 0 },
          animate: { opacity: 1, transition: { duration: 0.08 } },
          exit: { opacity: 0, transition: { duration: 0.08 } },
        },
        emptyState: {
          initial: { opacity: 0 },
          animate: { opacity: 1, transition: { duration: 0.1 } },
        },
        statusBanner: {
          initial: { opacity: 0 },
          animate: { opacity: 1, transition: { duration: 0.1 } },
          exit: { opacity: 0, transition: { duration: 0.08 } },
        },
        toastItem: {
          initial: { opacity: 0 },
          animate: { opacity: 1, transition: { duration: 0.1 } },
          exit: { opacity: 0, transition: { duration: 0.08 } },
        },
      };
    }

    return {
      page: {
        initial: { opacity: 0, y: 6, scale: 0.996 },
        animate: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: MOTION_DURATIONS.nav, ease: MOTION_EASINGS.easeOut },
        },
        exit: {
          opacity: 0,
          y: -3,
          scale: 0.998,
          transition: { duration: 0.14, ease: MOTION_EASINGS.easeInOut },
        },
      },
      cardListContainer: {
        initial: {},
        animate: {
          transition: {
            staggerChildren: 0.032,
            delayChildren: 0.015,
          },
        },
      },
      cardItem: {
        initial: { opacity: 0, y: 7 },
        animate: {
          opacity: 1,
          y: 0,
          transition: { duration: MOTION_DURATIONS.card, ease: MOTION_EASINGS.easeOut },
        },
        exit: {
          opacity: 0,
          scale: 0.98,
          transition: { duration: 0.15, ease: MOTION_EASINGS.easeInOut },
        },
      },
      activeLayerItem: {
        initial: { opacity: 0, y: 8, scale: 0.98 },
        animate: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.22, ease: MOTION_EASINGS.easeOut },
        },
        exit: {
          opacity: 0,
          y: -4,
          scale: 0.96,
          transition: { duration: 0.18, ease: MOTION_EASINGS.easeInOut },
        },
      },
      modalOverlay: {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.18, ease: 'easeOut' as const } },
        exit: { opacity: 0, transition: { duration: 0.14, ease: 'easeIn' as const } },
      },
      modalDialog: {
        initial: { opacity: 0, scale: 0.97, y: 8 },
        animate: {
          opacity: 1,
          scale: 1,
          y: 0,
          transition: { duration: MOTION_DURATIONS.modal, ease: MOTION_EASINGS.easeOut },
        },
        exit: {
          opacity: 0,
          scale: 0.98,
          y: 4,
          transition: { duration: 0.15, ease: 'easeIn' as const },
        },
      },
      accordion: {
        initial: { height: 0, opacity: 0, overflow: 'hidden' },
        animate: {
          height: 'auto',
          opacity: 1,
          overflow: 'visible',
          transition: { duration: MOTION_DURATIONS.expand, ease: MOTION_EASINGS.easeOut },
        },
        exit: {
          height: 0,
          opacity: 0,
          overflow: 'hidden',
          transition: { duration: 0.18, ease: MOTION_EASINGS.easeInOut },
        },
      },
      badgeFlip: {
        initial: { opacity: 0, scale: 0.85, y: -3 },
        animate: {
          opacity: 1,
          scale: 1,
          y: 0,
          transition: { duration: 0.18, ease: MOTION_EASINGS.easeOut },
        },
        exit: {
          opacity: 0,
          scale: 0.85,
          y: 3,
          transition: { duration: 0.12 },
        },
      },
      emptyState: {
        initial: { opacity: 0, y: 6 },
        animate: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.26, ease: MOTION_EASINGS.easeOut },
        },
      },
      statusBanner: {
        initial: { opacity: 0, y: 4, scale: 0.98 },
        animate: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.22, ease: MOTION_EASINGS.easeOut },
        },
        exit: {
          opacity: 0,
          y: -3,
          scale: 0.98,
          transition: { duration: 0.15 },
        },
      },
      toastItem: {
        initial: { opacity: 0, y: 12, scale: 0.96 },
        animate: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: MOTION_SPRINGS.snappy,
        },
        exit: {
          opacity: 0,
          x: 24,
          scale: 0.96,
          transition: { duration: 0.16, ease: MOTION_EASINGS.easeInOut },
        },
      },
    };
  }, [isReduced]);

  // Tactile interaction props for buttons and interactive controls
  const tactileProps = useMemo(() => {
    if (isReduced) {
      return {
        whileTap: undefined,
        whileHover: undefined,
      };
    }
    return {
      whileTap: { scale: 0.975 },
      whileHover: { y: -1 },
      transition: MOTION_SPRINGS.tactile,
    };
  }, [isReduced]);

  // Tactile card hover/press props for Windows hover elevation + touch tap feedback
  const cardHoverProps = useMemo(() => {
    if (isReduced) {
      return {
        whileTap: undefined,
        whileHover: undefined,
      };
    }
    return {
      whileHover: { y: -2 },
      whileTap: { scale: 0.992 },
      transition: MOTION_SPRINGS.snappy,
    };
  }, [isReduced]);

  return {
    isReduced,
    isPageVisible,
    allowAmbient,
    motionMode,
    setMotionMode: (mode: MotionMode) => {
      setMotionMode(mode);
      db.updateSettings({ reduceMotion: mode });
    },
    transitions,
    variants,
    tactileProps,
    cardHoverProps,
  };
}
