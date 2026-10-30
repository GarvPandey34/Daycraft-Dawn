import React, { useState, useEffect, useRef } from 'react';
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Plus,
  Minus,
  Sliders,
  CloudRain,
  CloudLightning,
  Flame,
  Wind,
  Waves,
  Radio,
  Disc,
  Coffee,
  Moon,
  CheckCircle2,
  Clock,
  Sparkles,
  Music2,
  Square,
  Wand2,
  BellOff,
  Bell,
  Vibrate,
  X,
  Award,
  Zap,
  SkipForward,
  Check,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../../database/db';
import { useNotifications } from '../../notifications/NotificationContext';
import {
  soundService,
  AMBIENT_TRACK_LIST,
  SOUNDSCAPE_PRESETS,
  AmbientSoundType,
} from '../../services/soundService';
import {
  deviceModeService,
  AppliedDeviceResult,
} from '../../services/deviceModeService';
import { DeviceFocusMode } from '../../domain/models';
import { useMotionPreference, MOTION_SPRINGS } from '../../theme/motion';
import { AudioVisualizer } from './AudioVisualizer';
import { AnimatedCheckbox, EmptyStateMotion } from '../../components/MotionPrimitives';
import { formatLocalDate } from '../../services/streakService';
import {
  clearFocusTimerState,
  createNewFocusSessionId,
  filterTodayFocusSessions,
  reconcileExpiredFocusTimer,
  resolveRestoredFocusTimerState,
  saveFocusTimerState,
  subscribeFocusTimerCompletion,
} from '../../services/focusTimerStateService';

export const FocusTimerView: React.FC = () => {
  const { notify, triggerCelebration } = useNotifications();
  const settings = db.getSettings();
  const { isReduced, allowAmbient, variants, tactileProps, cardHoverProps } = useMotionPreference();

  const initialTimerState = useRef(
    resolveRestoredFocusTimerState(settings.defaultFocusDurationMinutes || 25)
  ).current;
  const sessionIdRef = useRef<string>(initialTimerState.sessionId);

  // Timer states
  const [sessionType, setSessionType] = useState<'focus' | 'short_break' | 'long_break'>(
    initialTimerState.sessionType
  );
  const [durationMinutes, setDurationMinutes] = useState(initialTimerState.durationMinutes);
  const [customInputMins, setCustomInputMins] = useState(initialTimerState.customInputMins);
  const [isCustomMode, setIsCustomMode] = useState(initialTimerState.isCustomMode);
  const [secondsRemaining, setSecondsRemaining] = useState(initialTimerState.secondsRemaining);
  const [isActive, setIsActive] = useState(initialTimerState.isActive);
  const [isPaused, setIsPaused] = useState(initialTimerState.isPaused);
  const [justCompleted, setJustCompleted] = useState(false);
  const [sessionTaskNote, setSessionTaskNote] = useState(initialTimerState.sessionTaskNote);

  // Device mode & distraction control states
  const [showDevicePrompt, setShowDevicePrompt] = useState(false);
  const [activeDeviceMode, setActiveDeviceMode] = useState<DeviceFocusMode | null>(
    initialTimerState.activeDeviceMode
  );
  const [appliedDeviceResult, setAppliedDeviceResult] = useState<AppliedDeviceResult | null>(null);
  const [restoredFeedbackMsg, setRestoredFeedbackMsg] = useState<string | null>(null);
  const [promptRememberChoice, setPromptRememberChoice] = useState(false);
  const [promptSelectedMode, setPromptSelectedMode] = useState<DeviceFocusMode>(
    settings.focusDeviceSettings?.defaultMode && settings.focusDeviceSettings.defaultMode !== 'ask'
      ? settings.focusDeviceSettings.defaultMode
      : 'silent'
  );

  // Soundscape mixer states (synchronized with soundService)
  const [activeSounds, setActiveSounds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    AMBIENT_TRACK_LIST.forEach(t => {
      if (soundService.isTrackActive(t.id)) {
        initial[t.id] = true;
      }
    });
    return initial;
  });
  const [soundVolumes, setSoundVolumes] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    AMBIENT_TRACK_LIST.forEach(t => {
      initial[t.id] = soundService.getTrackVolume(t.id);
    });
    return initial;
  });
  const [masterVolume, setMasterVolume] = useState(() => soundService.getMasterVolume());
  const [isMuted, setIsMuted] = useState(() => soundService.isMuted());
  const [showMixerPanel, setShowMixerPanel] = useState(true);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  // Completed session celebration modal
  const [completedSummary, setCompletedSummary] = useState<{
    duration: number;
    notes: string;
    xp: number;
    restoredMessage?: string;
  } | null>(null);

  const targetEndTimeRef = useRef<number | null>(initialTimerState.targetEndTime);

  // Persist active or paused timer state across view switches & reloads
  useEffect(() => {
    saveFocusTimerState({
      sessionId: sessionIdRef.current,
      sessionType,
      durationMinutes,
      customInputMins,
      isCustomMode,
      secondsRemaining,
      isActive,
      isPaused,
      targetEndTime: isActive
        ? targetEndTimeRef.current || Date.now() + secondsRemaining * 1000
        : null,
      sessionTaskNote,
      activeDeviceMode,
    });
  }, [
    sessionType,
    durationMinutes,
    customInputMins,
    isCustomMode,
    secondsRemaining,
    isActive,
    isPaused,
    sessionTaskNote,
    activeDeviceMode,
  ]);

  // Keep mixer UI synchronized with soundService
  useEffect(() => {
    return soundService.subscribe(() => {
      const nextActive: Record<string, boolean> = {};
      const nextVols: Record<string, number> = {};
      AMBIENT_TRACK_LIST.forEach(t => {
        nextActive[t.id] = soundService.isTrackActive(t.id);
        nextVols[t.id] = soundService.getTrackVolume(t.id);
      });
      setActiveSounds(nextActive);
      setSoundVolumes(nextVols);
      setMasterVolume(soundService.getMasterVolume());
      setIsMuted(soundService.isMuted());
    });
  }, []);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDevicePrompt) setShowDevicePrompt(false);
        if (completedSummary) setCompletedSummary(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDevicePrompt, completedSummary]);

  // Synchronize local state if global focus timer reconciliation completes the session
  useEffect(() => {
    return subscribeFocusTimerCompletion(result => {
      sessionIdRef.current = result.nextState.sessionId;
      targetEndTimeRef.current = null;
      setIsActive(false);
      setIsPaused(false);
      setJustCompleted(true);
      setActiveDeviceMode(null);
      setAppliedDeviceResult(null);
      setSessionType(result.nextState.sessionType);
      setDurationMinutes(result.nextState.durationMinutes);
      setCustomInputMins(result.nextState.customInputMins);
      setIsCustomMode(result.nextState.isCustomMode);
      setSecondsRemaining(result.nextState.secondsRemaining);

      if (result.completed && result.sessionType === 'focus') {
        setCompletedSummary({
          duration: result.durationMinutes,
          notes: result.notes || 'Deep Focus Sprint',
          xp: result.xpAwarded,
        });
      }
    });
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive) {
      if (!targetEndTimeRef.current) {
        targetEndTimeRef.current = Date.now() + secondsRemaining * 1000;
      } else {
        const immediateRemaining = Math.max(
          0,
          Math.round((targetEndTimeRef.current - Date.now()) / 1000)
        );
        if (immediateRemaining <= 0) {
          handleComplete();
          return;
        }
      }

      interval = setInterval(() => {
        if (targetEndTimeRef.current) {
          const remaining = Math.max(0, Math.round((targetEndTimeRef.current - Date.now()) / 1000));
          setSecondsRemaining(remaining);

          if (remaining <= 0) {
            handleComplete();
          }
        }
      }, 250);
    } else {
      targetEndTimeRef.current = null;
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, secondsRemaining]);

  const handleStart = async () => {
    setJustCompleted(false);
    setRestoredFeedbackMsg(null);

    // If resuming from pause, start immediately without re-prompting device mode
    if (isPaused) {
      startTimerCore();
      return;
    }

    const deviceSettings = settings.focusDeviceSettings || deviceModeService.getDefaultSettings();

    // Check if quiet hours suppress prompt
    const inQuietHours =
      (deviceSettings.suppressPromptDuringQuietHours ?? deviceSettings.suppressDuringQuietHours)
        ? deviceModeService.isQuietHours()
        : false;

    if (deviceSettings.askBeforeSession && !inQuietHours && !activeDeviceMode) {
      setShowDevicePrompt(true);
      return;
    }

    // Start timer immediately so animation/device mode never delays countdown start
    startTimerCore();

    const targetMode =
      inQuietHours
        ? 'dnd'
        : deviceSettings.defaultMode || deviceSettings.defaultDeviceMode || 'ask';

    if (
      (deviceSettings.allowAutomaticChanges ?? deviceSettings.allowAutoModeChanges ?? true) &&
      targetMode !== 'ask'
    ) {
      const res = await deviceModeService.applySessionMode(targetMode);
      if (res.success) {
        setActiveDeviceMode(targetMode);
        setAppliedDeviceResult(res);
      }
    }
  };

  const startTimerCore = () => {
    targetEndTimeRef.current = Date.now() + secondsRemaining * 1000;
    setIsActive(true);
    setIsPaused(false);
    soundService.playClick(settings.soundVolume);
  };

  const handleConfirmDeviceMode = async (mode: DeviceFocusMode | null) => {
    setShowDevicePrompt(false);
    // Start timer immediately without waiting for animations
    startTimerCore();

    if (mode) {
      const res = await deviceModeService.applySessionMode(mode);
      if (res.success) {
        setActiveDeviceMode(mode);
        setAppliedDeviceResult(res);
      }

      if (promptRememberChoice) {
        const current = settings.focusDeviceSettings || deviceModeService.getDefaultSettings();
        db.updateSettings({
          focusDeviceSettings: {
            ...current,
            askBeforeSession: false,
            defaultMode: mode,
            defaultDeviceMode: mode,
          },
        });
      }
    } else {
      setActiveDeviceMode(null);
      setAppliedDeviceResult(null);
    }
  };

  const handlePause = () => {
    setIsActive(false);
    setIsPaused(true);
    targetEndTimeRef.current = null;
    soundService.playClick(settings.soundVolume * 0.8);
  };

  const handleReset = async () => {
    setIsActive(false);
    setIsPaused(false);
    setJustCompleted(false);
    targetEndTimeRef.current = null;
    sessionIdRef.current = createNewFocusSessionId();
    clearFocusTimerState();
    setSecondsRemaining(durationMinutes * 60);

    if (activeDeviceMode) {
      const deviceSettings = settings.focusDeviceSettings || deviceModeService.getDefaultSettings();
      const restoreRes = await deviceModeService.restorePreviousMode(
        deviceSettings.restoreAfterFocus ?? deviceSettings.restorePreviousMode ?? true
      );
      setActiveDeviceMode(null);
      setAppliedDeviceResult(null);
      if (restoreRes.restored) {
        setRestoredFeedbackMsg(restoreRes.message);
        setTimeout(() => setRestoredFeedbackMsg(null), 4000);
      }
    }
  };

  const handleSkipSession = async () => {
    await handleReset();
    if (sessionType === 'focus') {
      const breakMins = settings.defaultShortBreakMinutes || 5;
      setSessionType('short_break');
      setDurationMinutes(breakMins);
      setCustomInputMins(breakMins);
      setSecondsRemaining(breakMins * 60);
      notify({
        title: 'Switched to Short Break',
        message: `Ready for a ${breakMins}-minute recharge.`,
        type: 'system',
      });
    } else {
      const focusMins = settings.defaultFocusDurationMinutes || 25;
      setSessionType('focus');
      setDurationMinutes(focusMins);
      setCustomInputMins(focusMins);
      setSecondsRemaining(focusMins * 60);
      notify({
        title: 'Switched to Focus Sprint',
        message: `Ready for a ${focusMins}-minute focus session.`,
        type: 'system',
      });
    }
  };

  const adjustMinutes = (delta: number) => {
    if (isActive) return;
    const next = Math.max(1, Math.min(240, durationMinutes + delta));
    setDurationMinutes(next);
    setCustomInputMins(next);
    setSecondsRemaining(next * 60);
    setIsPaused(false);
  };

  const setExactMinutes = (mins: number, isPresetClick: boolean = false) => {
    if (isActive) return;
    const clamped = Math.max(1, Math.min(240, mins));
    setDurationMinutes(clamped);
    setCustomInputMins(clamped);
    setSecondsRemaining(clamped * 60);
    setIsPaused(false);
    if (!isPresetClick) {
      setIsCustomMode(true);
    }
  };

  const selectSessionType = (type: 'focus' | 'short_break' | 'long_break', mins: number) => {
    handleReset();
    setSessionType(type);
    setDurationMinutes(mins);
    setCustomInputMins(mins);
    setSecondsRemaining(mins * 60);
    setIsCustomMode(false);
  };

  const handleComplete = async () => {
    // Ensure latest in-memory state is persisted before reconciling completion
    saveFocusTimerState({
      sessionId: sessionIdRef.current,
      sessionType,
      durationMinutes,
      customInputMins,
      isCustomMode,
      secondsRemaining: 0,
      isActive: true,
      isPaused: false,
      targetEndTime: targetEndTimeRef.current ?? Date.now(),
      sessionTaskNote,
      activeDeviceMode,
    });

    let restoredMsg: string | undefined;
    const result = reconcileExpiredFocusTimer({
      forceComplete: true,
      database: db,
      onPlaySound: vol => soundService.playTimerBell(vol),
      onNotify: notify,
      onCelebrate: triggerCelebration,
    });

    if (activeDeviceMode) {
      const deviceSettings = settings.focusDeviceSettings || deviceModeService.getDefaultSettings();
      const restoreRes = await deviceModeService.restorePreviousMode(
        deviceSettings.restoreAfterFocus ?? deviceSettings.restorePreviousMode ?? true
      );
      setActiveDeviceMode(null);
      setAppliedDeviceResult(null);
      if (restoreRes.restored) {
        restoredMsg = restoreRes.message;
        setRestoredFeedbackMsg(restoreRes.message);
      }
    }

    if (result && result.completed && result.sessionType === 'focus' && restoredMsg) {
      setCompletedSummary({
        duration: result.durationMinutes,
        notes: result.notes || 'Deep Focus Sprint',
        xp: result.xpAwarded,
        restoredMessage: restoredMsg,
      });
    }
  };

  // --- SOUNDSCAPE MIXER HANDLERS ---

  const handleToggleSound = (type: AmbientSoundType) => {
    const currentVol = soundVolumes[type] ?? 0.5;
    const isNowActive = soundService.toggleTrack(type, currentVol);
    setActiveSounds(prev => ({ ...prev, [type]: isNowActive }));
    if (!soundVolumes[type]) {
      setSoundVolumes(prev => ({ ...prev, [type]: 0.5 }));
    }
    setActivePresetId(null); // Custom blend active
  };

  const handleRemoveSoundLayer = (type: AmbientSoundType) => {
    soundService.stopTrack(type);
    setActiveSounds(prev => ({ ...prev, [type]: false }));
    setActivePresetId(null);
  };

  const handleSoundVolumeChange = (type: AmbientSoundType, vol: number) => {
    setSoundVolumes(prev => ({ ...prev, [type]: vol }));
    soundService.setTrackVolume(type, vol);
  };

  const handleMasterVolumeChange = (vol: number) => {
    setMasterVolume(vol);
    soundService.setMasterVolume(vol);
    db.updateSettings({ soundVolume: vol });
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundService.setMute(next);
  };

  const handleApplyPreset = (preset: typeof SOUNDSCAPE_PRESETS[0]) => {
    soundService.applyPreset(preset);
    const newActives: Record<string, boolean> = {};
    const newVolumes: Record<string, number> = {};

    Object.entries(preset.tracks).forEach(([track, vol]) => {
      newActives[track] = true;
      newVolumes[track] = vol as number;
    });

    setActiveSounds(newActives);
    setSoundVolumes(prev => ({ ...prev, ...newVolumes }));
    setActivePresetId(preset.id);
    notify({
      title: 'Soundscape Crossfaded',
      message: `Atmosphere: ${preset.name}`,
      type: 'system',
    });
  };

  const handleStopAllSounds = () => {
    soundService.stopAllTracks();
    setActiveSounds({});
    setActivePresetId(null);
  };

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const totalSecs = Math.max(1, durationMinutes * 60);
  const progressRatio = Math.max(0, Math.min(1, (totalSecs - secondsRemaining) / totalSecs));
  const progressPct = Math.round(progressRatio * 100);

  // Circular SVG progress ring geometry
  const ringRadius = 118;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringDashOffset = ringCircumference * (1 - progressRatio);

  const allSessions = db.getFocusSessions();
  const pastSessions = allSessions.slice(-5).reverse();
  const todayLocalDate = formatLocalDate(new Date());
  const todaySessions = filterTodayFocusSessions(allSessions, todayLocalDate);
  const todayTotalMinutes = todaySessions.reduce((acc, s) => acc + s.durationMinutes, 0);

  const activeTrackItems = AMBIENT_TRACK_LIST.filter(t => Boolean(activeSounds[t.id]));
  const activeCount = activeTrackItems.length;

  const getSoundIcon = (id: AmbientSoundType, isAudible: boolean) => {
    const activeClass = isAudible ? 'text-emerald-300' : 'text-emerald-500/80';
    switch (id) {
      case 'rain':
        return <CloudRain className={`w-4 h-4 ${isAudible ? 'text-sky-300' : activeClass}`} />;
      case 'thunder':
        return <CloudLightning className={`w-4 h-4 ${isAudible ? 'text-amber-300' : activeClass}`} />;
      case 'campfire':
        return <Flame className={`w-4 h-4 ${isAudible ? 'text-orange-300' : activeClass}`} />;
      case 'forest_wind':
        return <Wind className={`w-4 h-4 ${isAudible ? 'text-emerald-300' : activeClass}`} />;
      case 'ocean_waves':
        return <Waves className={`w-4 h-4 ${isAudible ? 'text-teal-300' : activeClass}`} />;
      case 'white_noise':
        return <Radio className={`w-4 h-4 ${isAudible ? 'text-stone-200' : activeClass}`} />;
      case 'brown_noise':
        return <Disc className={`w-4 h-4 ${isAudible ? 'text-indigo-300' : activeClass}`} />;
      case 'cafe_murmur':
        return <Coffee className={`w-4 h-4 ${isAudible ? 'text-amber-400' : activeClass}`} />;
      case 'crickets':
        return <Moon className={`w-4 h-4 ${isAudible ? 'text-purple-300' : activeClass}`} />;
      default:
        return <Music2 className="w-4 h-4 text-emerald-300" />;
    }
  };

  return (
    <motion.div
      variants={variants.page}
      initial="initial"
      animate="animate"
      exit="exit"
      className="p-6 max-w-5xl mx-auto space-y-6"
    >
      {/* Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <div>
          <div
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--accent)' }}
          >
            <Timer className="w-4 h-4" />
            <span>Immersion Mode & Sound Studio</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">Focus Timer & Soundscape Mixer</h1>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Calm, distraction-free sprint workspace with multi-layer acoustic ambient synthesis.
          </p>
        </div>

        <motion.button
          {...tactileProps}
          type="button"
          onClick={() => setShowMixerPanel(!showMixerPanel)}
          aria-expanded={showMixerPanel}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
          style={{
            backgroundColor: showMixerPanel ? '#13281E' : 'var(--bg-surface-elevated)',
            borderColor: showMixerPanel ? '#2A543E' : 'var(--border)',
            color: showMixerPanel ? '#D1FAE5' : 'var(--text-primary)',
          }}
        >
          <Sliders className="w-3.5 h-3.5 text-emerald-400" />
          <span>Soundscape Mixer</span>
          <AnimatePresence mode="wait">
            <motion.span
              key={activeCount}
              variants={variants.badgeFlip}
              initial="initial"
              animate="animate"
              exit="exit"
              className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold tabular-nums"
              style={{
                backgroundColor: activeCount > 0 ? '#059669' : 'rgba(255,255,255,0.08)',
                color: activeCount > 0 ? '#FFFFFF' : 'var(--text-muted)',
              }}
            >
              {activeCount}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Main Timer Workspace Card */}
      <motion.div
        layout
        initial={isReduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.992 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={isReduced ? { duration: 0.08 } : { duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="p-7 sm:p-10 rounded-3xl border shadow-xl flex flex-col items-center text-center relative overflow-hidden transition-colors"
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: isActive ? 'color-mix(in srgb, var(--accent) 45%, var(--border))' : 'var(--border)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        {/* Extremely slow, low-contrast atmospheric depth when Focus Session is active */}
        <AnimatePresence>
          {isActive && allowAmbient && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2 }}
              className="absolute inset-0 pointer-events-none focus-ambient-breath"
              style={{
                background:
                  'radial-gradient(circle at 50% 42%, rgba(52, 125, 84, 0.11) 0%, rgba(20, 60, 40, 0.04) 55%, transparent 80%)',
              }}
              aria-hidden="true"
            />
          )}
        </AnimatePresence>

        {/* Session Type Presets with Shared Layout Active Indicator */}
        <div
          className="flex flex-wrap justify-center border rounded-xl p-1 gap-1 mb-5 z-10"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface-subtle)' }}
        >
          {[
            { id: 'pomo25', type: 'focus' as const, mins: 25, label: 'Pomodoro (25m)' },
            { id: 'deep45', type: 'focus' as const, mins: 45, label: 'Deep Sprint (45m)' },
            { id: 'power60', type: 'focus' as const, mins: 60, label: 'Power Hour (60m)' },
            { id: 'short5', type: 'short_break' as const, mins: 5, label: 'Short Break (5m)' },
            { id: 'long15', type: 'long_break' as const, mins: 15, label: 'Long Break (15m)' },
          ].map(tab => {
            const isSelected =
              !isCustomMode &&
              sessionType === tab.type &&
              (tab.type !== 'focus' || durationMinutes === tab.mins);
            return (
              <motion.button
                key={tab.id}
                {...tactileProps}
                type="button"
                onClick={() => selectSessionType(tab.type, tab.mins)}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isSelected ? 'font-semibold' : 'opacity-75 hover:opacity-100'
                }`}
                style={{
                  color: isSelected ? 'var(--accent-foreground)' : 'var(--text-primary)',
                }}
              >
                {isSelected && (
                  <motion.span
                    layoutId="focusSessionPresetPill"
                    transition={isReduced ? { duration: 0.06 } : MOTION_SPRINGS.indicator}
                    className="absolute inset-0 rounded-lg shadow-xs"
                    style={{ backgroundColor: 'var(--accent)', zIndex: 0 }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </motion.button>
            );
          })}
        </div>

        {/* Custom Duration Config Controls */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mb-4 text-xs z-10">
          <span className="font-medium text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            Custom:
          </span>

          <div
            className="flex items-center rounded-xl border p-0.5"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
          >
            <motion.button
              {...tactileProps}
              type="button"
              disabled={isActive}
              onClick={() => adjustMinutes(-5)}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 transition-colors cursor-pointer"
              title="Minus 5 minutes"
              aria-label="Decrease duration by 5 minutes"
            >
              <Minus className="w-3 h-3" />
            </motion.button>
            <div className="flex items-center px-1.5 font-mono text-xs font-bold tabular-nums">
              <input
                type="number"
                min={1}
                max={240}
                disabled={isActive}
                value={customInputMins}
                onChange={e => {
                  const val = parseInt(e.target.value) || 1;
                  setExactMinutes(val, false);
                }}
                aria-label="Custom duration in minutes"
                className="w-10 text-center bg-transparent border-none focus:outline-none tabular-nums"
              />
              <span className="text-[11px] font-normal opacity-65 pr-1">min</span>
            </div>
            <motion.button
              {...tactileProps}
              type="button"
              disabled={isActive}
              onClick={() => adjustMinutes(5)}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 transition-colors cursor-pointer"
              title="Plus 5 minutes"
              aria-label="Increase duration by 5 minutes"
            >
              <Plus className="w-3 h-3" />
            </motion.button>
          </div>

          <div className="flex items-center gap-1">
            {[10, 15, 30, 50, 90].map(minsVal => (
              <motion.button
                key={minsVal}
                {...tactileProps}
                type="button"
                disabled={isActive}
                onClick={() => setExactMinutes(minsVal, true)}
                className={`px-2 py-0.5 rounded-lg border text-[11px] font-mono font-medium tabular-nums transition-colors disabled:opacity-40 cursor-pointer ${
                  durationMinutes === minsVal && isCustomMode
                    ? 'shadow-xs font-bold'
                    : 'opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
                style={{
                  backgroundColor:
                    durationMinutes === minsVal && isCustomMode ? 'var(--accent)' : 'var(--bg-surface)',
                  borderColor:
                    durationMinutes === minsVal && isCustomMode ? 'transparent' : 'var(--border)',
                  color:
                    durationMinutes === minsVal && isCustomMode
                      ? 'var(--accent-foreground)'
                      : 'var(--text-secondary)',
                }}
              >
                {minsVal}m
              </motion.button>
            ))}
          </div>
        </div>

        {/* Circular Progress Ring + Monolithic Jitter-Free Monospace Time Display */}
        <div className="relative my-2 flex flex-col items-center justify-center select-none z-10">
          <div className="relative flex items-center justify-center w-64 h-64 sm:w-68 sm:h-68">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 260 260" aria-hidden="true">
              <circle
                cx="130"
                cy="130"
                r={ringRadius}
                fill="none"
                stroke="var(--border)"
                strokeWidth="5"
                className="opacity-45"
              />
              <motion.circle
                cx="130"
                cy="130"
                r={ringRadius}
                fill="none"
                stroke={justCompleted ? 'var(--success)' : 'var(--accent)'}
                strokeWidth="5.5"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                animate={{ strokeDashoffset: ringDashOffset }}
                transition={isReduced ? { duration: 0.08 } : { duration: 0.35, ease: 'easeOut' }}
              />
            </svg>

            {/* Center Countdown Readout */}
            <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
              <span
                className="text-[11px] font-semibold uppercase tracking-widest mb-1"
                style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
              >
                {isActive
                  ? sessionType === 'focus'
                    ? 'Focusing'
                    : 'Recharging'
                  : isPaused
                  ? 'Paused'
                  : justCompleted
                  ? 'Completed'
                  : sessionType === 'focus'
                  ? 'Ready'
                  : 'Break Ready'}
              </span>

              <div
                className="flex items-center justify-center font-mono font-black tracking-tight text-5xl sm:text-6xl tabular-nums"
                style={{ color: 'var(--text-primary)' }}
              >
                <span className="w-20 sm:w-24 text-right tabular-nums">{String(mins).padStart(2, '0')}</span>
                <span className="px-0.5 font-sans opacity-55">:</span>
                <span className="w-20 sm:w-24 text-left tabular-nums">{String(secs).padStart(2, '0')}</span>
              </div>

              <div
                className="text-[11px] font-medium tracking-wide mt-1.5 tabular-nums"
                style={{ color: 'var(--text-muted)' }}
              >
                {durationMinutes}m · {progressPct}% elapsed
              </div>
            </div>
          </div>

          {/* Verified Active Device Mode Status Banner */}
          <AnimatePresence mode="wait">
            {activeDeviceMode && (settings.focusDeviceSettings?.showStatusDuringFocus ?? true) && (
              <motion.div
                key={`status-${activeDeviceMode}`}
                variants={variants.statusBanner}
                initial="initial"
                animate="animate"
                exit="exit"
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border mt-2 shadow-xs ${
                  appliedDeviceResult?.verification === 'unsupported_fallback'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
                    : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-300'
                }`}
              >
                {appliedDeviceResult?.verification === 'unsupported_fallback' ? (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                ) : (
                  <>
                    {activeDeviceMode === 'silent' && <VolumeX className="w-3.5 h-3.5 shrink-0" />}
                    {activeDeviceMode === 'vibrate' && <Vibrate className="w-3.5 h-3.5 shrink-0" />}
                    {activeDeviceMode === 'dnd' && <Moon className="w-3.5 h-3.5 shrink-0" />}
                    {activeDeviceMode === 'sound' && <Bell className="w-3.5 h-3.5 shrink-0" />}
                  </>
                )}
                <span>
                  {appliedDeviceResult?.appliedScopeLabel ||
                    (activeDeviceMode === 'silent'
                      ? 'Silent Mode Active'
                      : activeDeviceMode === 'vibrate'
                      ? 'Vibrate Mode Active'
                      : activeDeviceMode === 'dnd'
                      ? 'Do Not Disturb Active'
                      : 'Normal Sound Active')}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await deviceModeService.restorePreviousMode(true);
                    setActiveDeviceMode(null);
                    setAppliedDeviceResult(null);
                    if (res.restored) {
                      setRestoredFeedbackMsg(res.message);
                      setTimeout(() => setRestoredFeedbackMsg(null), 4000);
                      notify({
                        title: 'Device Mode Restored',
                        message: res.message,
                        type: 'system',
                      });
                    }
                  }}
                  className="ml-1 text-[11px] font-semibold underline opacity-80 hover:opacity-100 cursor-pointer"
                  title="Restore original device settings now"
                >
                  Restore
                </button>
              </motion.div>
            )}

            {!activeDeviceMode && restoredFeedbackMsg && (
              <motion.div
                key="restored-feedback"
                variants={variants.statusBanner}
                initial="initial"
                animate="animate"
                exit="exit"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium border bg-stone-500/10 border-stone-500/20 mt-2"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>{restoredFeedbackMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Task Note Input */}
        <input
          type="text"
          value={sessionTaskNote}
          onChange={e => setSessionTaskNote(e.target.value)}
          placeholder="What are you dedicating this focus sprint to?"
          className="mt-3 max-w-sm w-full px-4 py-2 rounded-xl border text-xs text-center focus-visible:outline-none transition-shadow z-10"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
          }}
        />

        {/* Main Session Controls (Reset, Start/Pause/Resume, Skip, Finish Early) */}
        <motion.div layout className="flex flex-wrap items-center justify-center gap-3 mt-6 z-10">
          <motion.button
            {...tactileProps}
            type="button"
            onClick={handleReset}
            aria-label="Reset timer"
            title="Reset timer & restore device mode"
            className="p-3 rounded-2xl border transition-colors hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            style={{
              backgroundColor: 'var(--bg-surface-subtle)',
              borderColor: 'var(--border)',
              color: 'var(--text-secondary)',
            }}
          >
            <RotateCcw className="w-4 h-4" />
          </motion.button>

          <AnimatePresence mode="wait" initial={false}>
            {isActive ? (
              <motion.button
                key="pause-btn"
                {...tactileProps}
                type="button"
                onClick={handlePause}
                className="flex items-center gap-2 px-8 py-3 rounded-2xl font-semibold text-xs shadow-md cursor-pointer"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-foreground)',
                }}
              >
                <Pause className="w-4 h-4 fill-current" />
                <span>Pause Focus</span>
              </motion.button>
            ) : (
              <motion.button
                key="start-btn"
                {...tactileProps}
                type="button"
                onClick={handleStart}
                className="flex items-center gap-2 px-8 py-3 rounded-2xl font-semibold text-xs shadow-md hover:brightness-105 cursor-pointer"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-foreground)',
                }}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{isPaused ? 'Resume Focus' : sessionType === 'focus' ? 'Start Focus' : 'Start Break'}</span>
              </motion.button>
            )}
          </AnimatePresence>

          <motion.button
            {...tactileProps}
            type="button"
            onClick={handleSkipSession}
            title={sessionType === 'focus' ? 'Skip to break' : 'Skip to focus sprint'}
            aria-label={sessionType === 'focus' ? 'Skip to break' : 'Skip to focus sprint'}
            className="p-3 rounded-2xl border transition-colors hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            style={{
              backgroundColor: 'var(--bg-surface-subtle)',
              borderColor: 'var(--border)',
              color: 'var(--text-secondary)',
            }}
          >
            <SkipForward className="w-4 h-4" />
          </motion.button>

          {(isActive || isPaused) && (
            <motion.button
              {...tactileProps}
              type="button"
              onClick={handleComplete}
              title="Complete and log session now"
              aria-label="Complete and log session now"
              className="flex items-center gap-1.5 px-3.5 py-3 rounded-2xl border text-xs font-semibold transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-600 cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-surface-subtle)',
                borderColor: 'var(--border)',
              }}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>End &amp; Log</span>
            </motion.button>
          )}
        </motion.div>
      </motion.div>

      {/* Signature Dark-Green Ambient Soundscape Mixer Studio */}
      <AnimatePresence initial={false}>
        {showMixerPanel && (
          <motion.div
            variants={variants.accordion}
            initial="initial"
            animate="animate"
            exit="exit"
            className="rounded-3xl border shadow-lg overflow-hidden"
            style={{
              background: 'linear-gradient(165deg, #102118 0%, #0C1912 60%, #09140E 100%)',
              borderColor: '#1F3D2D',
              color: '#ECFDF5',
            }}
          >
            <div className="p-6 space-y-5">
              {/* Mixer Header, Master Volume & Real-Time Audio Visualizer */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-emerald-900/50">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <Music2 className="w-4 h-4 text-emerald-400" />
                    <h2 className="text-sm font-bold tracking-tight text-emerald-50">
                      Ambient Soundscape Mixer
                    </h2>
                    {/* Fluid Layer Count Badge */}
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={activeCount}
                        variants={variants.badgeFlip}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold border tabular-nums"
                        style={{
                          backgroundColor: activeCount > 0 ? 'rgba(16, 185, 129, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                          borderColor: activeCount > 0 ? 'rgba(52, 211, 153, 0.45)' : 'rgba(255, 255, 255, 0.12)',
                          color: activeCount > 0 ? '#6EE7B7' : '#9CA3AF',
                        }}
                      >
                        {activeCount} layer{activeCount === 1 ? '' : 's'} active
                      </motion.span>
                    </AnimatePresence>
                  </div>
                  <p className="text-xs mt-0.5 text-emerald-200/65">
                    Multi-layer procedural acoustic synthesis with smooth crossfading and live signal analysis.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Optional Real Web Audio Output Visualizer */}
                  <AudioVisualizer height={22} showToggle={true} />

                  {/* Master Volume Control */}
                  <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-800/40">
                    <motion.button
                      {...tactileProps}
                      type="button"
                      onClick={handleToggleMute}
                      aria-label={isMuted ? 'Unmute master output' : 'Mute master output'}
                      className="p-1 rounded-lg hover:bg-emerald-900/50 transition-colors cursor-pointer"
                    >
                      {isMuted || masterVolume === 0 ? (
                        <VolumeX className="w-4 h-4 text-rose-400" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-emerald-300" />
                      )}
                    </motion.button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.02"
                      value={isMuted ? 0 : masterVolume}
                      onChange={e => {
                        if (isMuted) setIsMuted(false);
                        soundService.setMute(false);
                        handleMasterVolumeChange(parseFloat(e.target.value));
                      }}
                      className="w-20 mixer-slider cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #34D399 ${Math.round((isMuted ? 0 : masterVolume) * 100)}%, rgba(255,255,255,0.14) ${Math.round((isMuted ? 0 : masterVolume) * 100)}%)`,
                      }}
                      title="Master Soundscape Volume"
                      aria-label="Master Soundscape Volume"
                    />
                    <span className="text-[11px] font-mono font-semibold text-emerald-200/80 w-8 text-right tabular-nums">
                      {isMuted ? 'Mute' : `${Math.round(masterVolume * 100)}%`}
                    </span>
                  </div>

                  <AnimatePresence>
                    {activeCount > 0 && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.92 }}
                        {...tactileProps}
                        type="button"
                        onClick={handleStopAllSounds}
                        className="px-3 py-1.5 rounded-xl border border-rose-500/35 bg-rose-950/40 text-xs font-semibold text-rose-300 hover:bg-rose-900/50 transition-colors cursor-pointer"
                      >
                        Stop All
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Active Sound Layers Tray — Smoothly Animates Added & Removed Layers */}
              <AnimatePresence initial={false}>
                {activeTrackItems.length > 0 && (
                  <motion.div
                    variants={variants.accordion}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="p-3.5 rounded-2xl bg-emerald-950/55 border border-emerald-800/45 space-y-2.5"
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-emerald-300/75 px-1">
                      <span>Active Mixer Channels</span>
                      <span>Immediate Gain Staging</span>
                    </div>

                    <motion.div
                      variants={variants.cardListContainer}
                      initial="initial"
                      animate="animate"
                      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5"
                    >
                      <AnimatePresence initial={false}>
                        {activeTrackItems.map(track => {
                          const trackVol = soundVolumes[track.id] ?? 0.5;
                          const isAudible = !isMuted && masterVolume > 0.001 && trackVol > 0.001;
                          return (
                            <motion.div
                              key={`active-layer-${track.id}`}
                              layout
                              variants={variants.activeLayerItem}
                              initial="initial"
                              animate="animate"
                              exit="exit"
                              className="flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl bg-emerald-900/35 border border-emerald-700/45"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {getSoundIcon(track.id, isAudible)}
                                <span className="text-xs font-semibold text-emerald-50 truncate">
                                  {track.label}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <input
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.02"
                                  value={trackVol}
                                  onChange={e => handleSoundVolumeChange(track.id, parseFloat(e.target.value))}
                                  aria-label={`${track.label} layer volume`}
                                  className="w-16 mixer-slider cursor-pointer"
                                  style={{
                                    background: `linear-gradient(to right, #34D399 ${Math.round(trackVol * 100)}%, rgba(255,255,255,0.15) ${Math.round(trackVol * 100)}%)`,
                                  }}
                                />
                                <span className="text-[10px] font-mono font-bold text-emerald-200 w-7 text-right tabular-nums">
                                  {Math.round(trackVol * 100)}%
                                </span>
                                <motion.button
                                  {...tactileProps}
                                  type="button"
                                  onClick={() => handleRemoveSoundLayer(track.id)}
                                  aria-label={`Remove ${track.label} layer`}
                                  title={`Remove ${track.label}`}
                                  className="p-1 rounded-lg text-emerald-300/70 hover:text-rose-300 hover:bg-rose-950/50 transition-colors cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </motion.button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Curated Soundscape Presets with Coherent Selection Indicator & Crossfading */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1.5 text-emerald-300/75">
                  <Wand2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Curated Soundscape Presets (Click-Free Crossfade)</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {SOUNDSCAPE_PRESETS.map(preset => {
                    const isSelected = activePresetId === preset.id;
                    return (
                      <motion.button
                        key={preset.id}
                        {...tactileProps}
                        type="button"
                        onClick={() => handleApplyPreset(preset)}
                        className={`relative px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
                          isSelected
                            ? 'border-emerald-400/70 text-emerald-50 shadow-sm'
                            : 'border-emerald-800/45 bg-emerald-950/40 text-emerald-100/80 hover:border-emerald-700/60 hover:bg-emerald-900/35'
                        }`}
                        title={preset.description}
                      >
                        {isSelected && (
                          <motion.span
                            layoutId="selectedSoundPresetSurface"
                            transition={isReduced ? { duration: 0.06 } : MOTION_SPRINGS.indicator}
                            className="absolute inset-0 rounded-xl bg-emerald-800/45 border border-emerald-400/50"
                            style={{ zIndex: 0 }}
                          />
                        )}
                        <motion.span
                          animate={isSelected && !isReduced ? { rotate: [0, 12, 0], scale: 1.08 } : { rotate: 0, scale: 1 }}
                          transition={{ duration: 0.24 }}
                          className="relative z-10 flex items-center"
                        >
                          <Sparkles
                            className={`w-3.5 h-3.5 ${
                              isSelected ? 'text-amber-300 fill-amber-300/40' : 'text-emerald-400/70'
                            }`}
                          />
                        </motion.span>
                        <span className="relative z-10">{preset.name}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Stable 3x3 Sound Library Cards Grid with Tactile Feedback & Real Playback Indicator */}
              <motion.div
                variants={variants.cardListContainer}
                initial="initial"
                animate="animate"
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1"
              >
                {AMBIENT_TRACK_LIST.map(track => {
                  const isPlaying = Boolean(activeSounds[track.id]);
                  const trackVol = soundVolumes[track.id] ?? 0.5;
                  const isAudible = isPlaying && !isMuted && masterVolume > 0.001 && trackVol > 0.001;

                  return (
                    <motion.div
                      key={track.id}
                      variants={variants.cardItem}
                      {...cardHoverProps}
                      className={`p-3.5 rounded-2xl border transition-colors duration-200 flex flex-col justify-between ${
                        isPlaying
                          ? 'bg-emerald-900/40 border-emerald-500/60 shadow-md'
                          : 'bg-emerald-950/35 border-emerald-900/50 hover:border-emerald-700/55 hover:bg-emerald-900/20'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <motion.div
                              animate={
                                isAudible && !isReduced
                                  ? { scale: 1.06, y: -1 }
                                  : { scale: 1, y: 0 }
                              }
                              transition={MOTION_SPRINGS.snappy}
                              className={`p-2 rounded-xl border transition-colors shrink-0 ${
                                isPlaying
                                  ? 'bg-emerald-950/90 border-emerald-400/50'
                                  : 'bg-emerald-950/50 border-emerald-800/40'
                              }`}
                            >
                              {getSoundIcon(track.id, isAudible)}
                            </motion.div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-emerald-50 truncate">
                                  {track.label}
                                </span>
                                {/* Real Playback Activity Indicator */}
                                <AnimatePresence>
                                  {isPlaying && (
                                    <motion.span
                                      initial={{ opacity: 0, scale: 0.7 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={{ opacity: 0, scale: 0.7 }}
                                      transition={{ duration: 0.16 }}
                                      className="inline-flex items-end gap-0.5 h-2.5 px-1"
                                      title={isAudible ? 'Playing audio' : 'Layer active (muted)'}
                                    >
                                      {[0, 1, 2].map(barIdx => (
                                        <motion.span
                                          key={barIdx}
                                          animate={
                                            isAudible && allowAmbient
                                              ? {
                                                  height: [
                                                    '35%',
                                                    barIdx === 1 ? '100%' : '75%',
                                                    '40%',
                                                  ],
                                                }
                                              : { height: isAudible ? '65%' : '25%' }
                                          }
                                          transition={
                                            isAudible && allowAmbient
                                              ? {
                                                  duration: 0.9 + barIdx * 0.2,
                                                  repeat: Infinity,
                                                  ease: 'easeInOut',
                                                }
                                              : { duration: 0.15 }
                                          }
                                          className="w-0.5 rounded-full"
                                          style={{
                                            backgroundColor: isAudible ? '#34D399' : '#6B7280',
                                          }}
                                        />
                                      ))}
                                    </motion.span>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          </div>

                          <motion.button
                            {...tactileProps}
                            type="button"
                            onClick={() => handleToggleSound(track.id)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                              isPlaying
                                ? 'bg-emerald-500 text-emerald-950 shadow-xs hover:bg-emerald-400'
                                : 'border border-emerald-700/50 bg-emerald-950/60 text-emerald-200 hover:bg-emerald-900/60'
                            }`}
                          >
                            {isPlaying ? 'Active' : 'Add'}
                          </motion.button>
                        </div>

                        <p className="text-[11px] mb-2 line-clamp-1 text-emerald-200/65">
                          {track.description}
                        </p>
                      </div>

                      {/* Smoothly expanding track volume slider */}
                      <AnimatePresence initial={false}>
                        {isPlaying && (
                          <motion.div
                            variants={variants.accordion}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="pt-2.5 mt-1 border-t border-emerald-800/45 flex items-center gap-2.5 text-[10px]"
                          >
                            <span className="text-emerald-300/70 font-medium">Vol</span>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.02"
                              value={trackVol}
                              onChange={e =>
                                handleSoundVolumeChange(track.id, parseFloat(e.target.value))
                              }
                              aria-label={`${track.label} volume`}
                              className="flex-1 mixer-slider cursor-pointer"
                              style={{
                                background: `linear-gradient(to right, #34D399 ${Math.round(trackVol * 100)}%, rgba(255,255,255,0.14) ${Math.round(trackVol * 100)}%)`,
                              }}
                            />
                            <span className="font-mono font-bold w-8 text-right text-emerald-200 tabular-nums">
                              {Math.round(trackVol * 100)}%
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Focus History Log */}
      <motion.div
        layout
        className="p-6 rounded-2xl border shadow-xs"
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Recent Completed Sprints</span>
          </div>
          <span className="text-[11px] font-mono tabular-nums" style={{ color: 'var(--text-muted)' }}>
            Today: {todaySessions.length} sprint{todaySessions.length === 1 ? '' : 's'} ({todayTotalMinutes}m)
          </span>
        </div>

        {pastSessions.length === 0 ? (
          <EmptyStateMotion
            icon={<Timer className="w-5 h-5" />}
            title="No focus sprints logged yet"
            description="Select a timer preset above and start your first distraction-free session."
            actionLabel="Start 25m Sprint"
            onAction={() => {
              selectSessionType('focus', 25);
              handleStart();
            }}
          />
        ) : (
          <div className="divide-y text-xs" style={{ borderColor: 'var(--border)' }}>
            {pastSessions.map(s => (
              <div key={s.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-semibold block">{s.notes || 'Focus sprint'}</span>
                  <span className="text-[11px] font-mono tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    {new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <span
                  className="font-bold font-mono tabular-nums px-2 py-0.5 rounded border"
                  style={{ borderColor: 'var(--border)' }}
                >
                  +{s.durationMinutes}m
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Prepare Your Device For Focus Modal */}
      <AnimatePresence>
        {showDevicePrompt && (
          <motion.div
            variants={variants.modalOverlay}
            initial="initial"
            animate="animate"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-labelledby="device-prompt-title"
            onClick={() => setShowDevicePrompt(false)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              variants={variants.modalDialog}
              initial="initial"
              animate="animate"
              exit="exit"
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg rounded-3xl border p-6 sm:p-7 shadow-2xl space-y-5"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border"
                    style={{
                      backgroundColor: 'var(--accent-subtle)',
                      borderColor: 'var(--accent)',
                      color: 'var(--accent)',
                    }}
                  >
                    <BellOff className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 id="device-prompt-title" className="text-base font-bold tracking-tight">
                      Prepare your device for focus
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Choose how interruptions should be handled during your {durationMinutes}-minute session.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDevicePrompt(false)}
                  className="p-1.5 rounded-xl border hover:bg-black/5 cursor-pointer"
                  style={{ borderColor: 'var(--border)' }}
                  aria-label="Close dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mode Selection Options with Animated Indicator */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {[
                  {
                    id: 'silent' as DeviceFocusMode,
                    label: 'Silent',
                    icon: <VolumeX className="w-4 h-4 text-emerald-600" />,
                    desc: 'Mutes in-app alert chimes and audible notifications.',
                  },
                  {
                    id: 'vibrate' as DeviceFocusMode,
                    label: 'Vibrate',
                    icon: <Vibrate className="w-4 h-4 text-indigo-500" />,
                    desc: 'Tactile haptic pulses for milestones (falls back to silent if no vibration motor).',
                  },
                  {
                    id: 'dnd' as DeviceFocusMode,
                    label: 'Do Not Disturb',
                    icon: <Moon className="w-4 h-4 text-purple-500" />,
                    desc: 'Deep immersion: suppresses in-app banners, alerts, and chimes.',
                  },
                  {
                    id: 'sound' as DeviceFocusMode,
                    label: 'Normal Sound',
                    icon: <Bell className="w-4 h-4 text-amber-500" />,
                    desc: 'Maintains regular reminder tones and completion chimes.',
                  },
                ].map(opt => {
                  const isSelected = promptSelectedMode === opt.id;
                  const support = deviceModeService.inspectModeSupport(opt.id);
                  return (
                    <motion.button
                      key={opt.id}
                      {...tactileProps}
                      type="button"
                      onClick={() => setPromptSelectedMode(opt.id)}
                      className={`relative p-3.5 rounded-2xl border text-left transition-colors flex flex-col justify-between cursor-pointer ${
                        isSelected ? 'ring-1' : 'hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                      style={{
                        backgroundColor: isSelected ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                        borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                      }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 font-bold text-xs">
                          {opt.icon}
                          <span>{opt.label}</span>
                        </div>
                        {isSelected && (
                          <motion.span
                            layoutId="promptDeviceModeDot"
                            transition={isReduced ? { duration: 0.06 } : MOTION_SPRINGS.indicator}
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: 'var(--accent)' }}
                          />
                        )}
                      </div>
                      <p className="text-[11px] leading-tight" style={{ color: 'var(--text-muted)' }}>
                        {opt.desc}
                      </p>
                      <span
                        className="mt-2 text-[10px] font-mono block opacity-75"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {support.badgeLabel}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Remember Choice Checkbox */}
              <div
                onClick={() => setPromptRememberChoice(!promptRememberChoice)}
                className="flex items-center gap-2.5 text-xs cursor-pointer select-none pt-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                <AnimatedCheckbox
                  size="sm"
                  checked={promptRememberChoice}
                  onChange={() => setPromptRememberChoice(!promptRememberChoice)}
                  label="Remember my choice and don't ask again before sessions"
                />
                <span>Remember my choice and don&apos;t ask again before sessions</span>
              </div>

              {/* Actions */}
              <div
                className="flex flex-col sm:flex-row items-center gap-2.5 pt-2 border-t"
                style={{ borderColor: 'var(--border)' }}
              >
                <button
                  type="button"
                  onClick={() => handleConfirmDeviceMode(null)}
                  className="w-full sm:w-auto flex-1 px-4 py-2.5 rounded-xl border text-xs font-semibold hover:bg-black/5 transition-colors text-center cursor-pointer"
                  style={{ borderColor: 'var(--border)' }}
                >
                  Start Without Changing Mode
                </button>
                <motion.button
                  {...tactileProps}
                  type="button"
                  onClick={() => handleConfirmDeviceMode(promptSelectedMode)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold shadow-md hover:brightness-105 text-center shrink-0 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-foreground)',
                  }}
                >
                  Apply Mode &amp; Start Focus
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Restrained Focus Completion Summary Modal */}
      <AnimatePresence>
        {completedSummary && (
          <motion.div
            variants={variants.modalOverlay}
            initial="initial"
            animate="animate"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-labelledby="focus-complete-title"
            onClick={() => setCompletedSummary(null)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              variants={variants.modalDialog}
              initial="initial"
              animate="animate"
              exit="exit"
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl border p-6 sm:p-7 shadow-2xl text-center space-y-4"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <motion.div
                initial={isReduced ? { opacity: 0 } : { scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={isReduced ? { duration: 0.08 } : MOTION_SPRINGS.bouncyLight}
                className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center border shadow-xs"
                style={{
                  backgroundColor: 'var(--accent-subtle)',
                  borderColor: 'var(--accent)',
                  color: 'var(--accent)',
                }}
              >
                <Award className="w-6 h-6" />
              </motion.div>

              <div>
                <h3 id="focus-complete-title" className="text-lg font-bold tracking-tight">
                  Focus Sprint Accomplished
                </h3>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {completedSummary.notes}
                </p>
              </div>

              <div
                className="grid grid-cols-3 gap-2.5 py-2 border-y"
                style={{ borderColor: 'var(--border)' }}
              >
                <div
                  className="p-2.5 rounded-xl border"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
                >
                  <span className="block text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                    Sprint Time
                  </span>
                  <span
                    className="text-base font-black font-mono tabular-nums"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {completedSummary.duration}m
                  </span>
                </div>
                <div
                  className="p-2.5 rounded-xl border"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
                >
                  <span className="block text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                    Today Total
                  </span>
                  <span
                    className="text-base font-black font-mono tabular-nums"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {todayTotalMinutes}m
                  </span>
                </div>
                <div
                  className="p-2.5 rounded-xl border"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
                >
                  <span className="block text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                    Reward
                  </span>
                  <span className="text-base font-black font-mono tabular-nums text-amber-600 flex items-center justify-center gap-0.5">
                    <Zap className="w-3.5 h-3.5 fill-amber-500" />
                    +{completedSummary.xp}
                  </span>
                </div>
              </div>

              {completedSummary.restoredMessage && (
                <div
                  className="px-3 py-2 rounded-xl border text-[11px] flex items-center justify-center gap-1.5"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{completedSummary.restoredMessage}</span>
                </div>
              )}

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setCompletedSummary(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border text-xs font-semibold hover:bg-black/5 transition-colors cursor-pointer"
                  style={{ borderColor: 'var(--border)' }}
                >
                  Close Summary
                </button>
                <motion.button
                  {...tactileProps}
                  type="button"
                  onClick={() => {
                    setCompletedSummary(null);
                    selectSessionType('short_break', settings.defaultShortBreakMinutes || 5);
                    startTimerCore();
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold shadow-md hover:brightness-105 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-foreground)',
                  }}
                >
                  Start {settings.defaultShortBreakMinutes || 5}m Break
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
