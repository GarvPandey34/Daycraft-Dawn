import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Palette,
  Lock,
  Download,
  Upload,
  Volume2,
  Bell,
  RotateCcw,
  Smartphone,
  Monitor,
  Check,
  Moon,
  VolumeX,
  Sliders,
  BellOff,
  Gauge,
  Vibrate,
  HelpCircle,
  AlertCircle,
  ShieldCheck,
  ChevronsUpDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../../database/db';
import { useTheme } from '../../theme/ThemeContext';
import { getThemeUnlockStatus, THEME_PRESETS, ThemePresetKey } from '../../theme/tokens';
import { useNotifications } from '../../notifications/NotificationContext';
import { fileSystemAdapter, notificationAdapter, secureStorageAdapter } from '../../platform/adapters';
import { soundService } from '../../services/soundService';
import { deviceModeService, AppliedDeviceResult } from '../../services/deviceModeService';
import { DeviceFocusMode, FocusDeviceSettings } from '../../domain/models';
import { useMotionPreference, MotionMode, MOTION_SPRINGS } from '../../theme/motion';
import {
  AnimatedToggle,
  TactileButton,
  ButtonStatusState,
  CollapsibleSection,
} from '../../components/MotionPrimitives';

interface SettingsViewProps {
  onNavigate?: (destination: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onNavigate }) => {
  const { presetKey, setPresetKey, mode, setMode } = useTheme();
  const { isReduced, motionMode, setMotionMode, variants, tactileProps } = useMotionPreference();
  const { notify, triggerCelebration } = useNotifications();
  const [, setTick] = useState(0);

  const settings = db.getSettings();
  const unlockContext = db.getThemeUnlockContext();

  // Collapsible section states
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    identity: true,
    theme: true,
    motion: true,
    focusDevice: true,
    audio: true,
    security: true,
    backup: true,
    packaging: false,
  });

  const allExpanded = Object.values(openSections).every(Boolean);
  const toggleAllSections = () => {
    const nextState = !allExpanded;
    const next: Record<string, boolean> = {};
    Object.keys(openSections).forEach(k => {
      next[k] = nextState;
    });
    setOpenSections(next);
  };

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // App lock config state
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinBtnState, setPinBtnState] = useState<ButtonStatusState>('idle');

  // Stateful feedback for Backup, Restore & Notification test buttons
  const [exportBtnState, setExportBtnState] = useState<ButtonStatusState>('idle');
  const [importBtnState, setImportBtnState] = useState<ButtonStatusState>('idle');
  const [notifBtnState, setNotifBtnState] = useState<ButtonStatusState>('idle');
  const [savedSettingBanner, setSavedSettingBanner] = useState<string | null>(null);

  // Device-mode interactive verification & restoration test state
  const [deviceTestStatus, setDeviceTestStatus] = useState<'idle' | 'testing' | 'completed'>('idle');
  const [deviceTestResult, setDeviceTestResult] = useState<AppliedDeviceResult | null>(null);
  const [deviceRestoredBanner, setDeviceRestoredBanner] = useState<string | null>(null);

  useEffect(() => {
    return db.subscribe(() => setTick(t => t + 1));
  }, []);

  const flashSavedFeedback = (label: string) => {
    setSavedSettingBanner(label);
    setTimeout(() => {
      setSavedSettingBanner(prev => (prev === label ? null : prev));
    }, 2400);
  };

  const handleUpdateAppName = (name: string) => {
    db.updateSettings({ appName: name });
    flashSavedFeedback('Application name saved');
  };

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.length !== 4) {
      setPinError('PIN must be exactly 4 digits.');
      setPinBtnState('error');
      setTimeout(() => setPinBtnState('idle'), 1800);
      return;
    }
    if (pinInput !== pinConfirm) {
      setPinError('PINs do not match.');
      setPinBtnState('error');
      setTimeout(() => setPinBtnState('idle'), 1800);
      return;
    }

    setPinBtnState('loading');
    const salt = secureStorageAdapter.generateSalt();
    const hash = await secureStorageAdapter.hashPin(pinInput, salt);

    db.updateSettings({
      appLockEnabled: true,
      appLockPinHash: hash,
      appLockSalt: salt,
    });

    setPinBtnState('success');
    setTimeout(() => setPinBtnState('idle'), 1800);

    notify({
      title: 'App Lock Configured',
      message: '4-digit security PIN is now active on this device.',
      type: 'system',
    });

    setPinInput('');
    setPinConfirm('');
    setPinError(null);
  };

  const handleDisableLock = () => {
    db.updateSettings({
      appLockEnabled: false,
      appLockPinHash: undefined,
      appLockSalt: undefined,
    });
    notify({ title: 'App Lock Disabled', message: 'Security lock turned off.', type: 'system' });
    flashSavedFeedback('App Lock disabled');
  };

  const handleExportBackup = async () => {
    setExportBtnState('loading');
    const archive = db.exportArchive();
    const success = await fileSystemAdapter.exportBackupFile(archive);
    if (success) {
      setExportBtnState('success');
      notify({
        title: 'Local Backup Exported',
        message: 'Saved verified .daycraft archive.',
        type: 'system',
      });
      flashSavedFeedback('Verified backup exported');
    } else {
      setExportBtnState('error');
    }
    setTimeout(() => setExportBtnState('idle'), 2200);
  };

  const handleImportBackup = async () => {
    setImportBtnState('loading');
    const text = await fileSystemAdapter.importBackupFile();
    if (!text) {
      setImportBtnState('idle');
      return;
    }

    try {
      const parsed = JSON.parse(text);
      const res = db.restoreArchive(parsed);
      if (res.success) {
        setImportBtnState('success');
        notify({
          title: 'Backup Restored',
          message: 'All records restored successfully.',
          type: 'system',
        });
        triggerCelebration();
      } else {
        setImportBtnState('error');
        notify({
          title: 'Restore Failed',
          message: res.errors.join(', '),
          type: 'system',
        });
      }
    } catch {
      setImportBtnState('error');
      notify({
        title: 'Invalid File',
        message: 'Could not parse JSON backup payload.',
        type: 'system',
      });
    }
    setTimeout(() => setImportBtnState('idle'), 2200);
  };

  const handleTestNotification = async () => {
    setNotifBtnState('loading');
    const granted = await notificationAdapter.requestPermission();
    if (granted) {
      notificationAdapter.scheduleNotification({
        id: 'test_notif',
        title: 'Daycraft Test Notification',
        body: 'Native OS notifications are operating correctly!',
      });
      setNotifBtnState('success');
      notify({
        title: 'Native Notification Sent',
        message: 'Dispatched to system notification center.',
        type: 'system',
      });
    } else {
      setNotifBtnState('error');
      notify({
        title: 'Permission Denied',
        message: 'System notifications permission is currently blocked in browser/OS settings.',
        type: 'system',
      });
    }
    setTimeout(() => setNotifBtnState('idle'), 2200);
  };

  const currentDefaultDeviceMode: DeviceFocusMode =
    settings.focusDeviceSettings?.defaultMode ||
    settings.focusDeviceSettings?.defaultDeviceMode ||
    'ask';

  const handleSelectDefaultDeviceMode = (nextMode: DeviceFocusMode) => {
    const updated: FocusDeviceSettings = {
      ...deviceModeService.getDefaultSettings(),
      ...settings.focusDeviceSettings,
      defaultMode: nextMode,
      defaultDeviceMode: nextMode,
    };
    db.updateSettings({ focusDeviceSettings: updated });
    // Selecting a default preference only saves the preference — clear any prior test result so we never imply immediate hardware activation
    setDeviceTestStatus('idle');
    setDeviceTestResult(null);
    setDeviceRestoredBanner(null);
    flashSavedFeedback(`Default preference set to ${nextMode.toUpperCase()} (applies when Focus starts)`);
  };

  const handleTestDeviceModeNow = async () => {
    const target = currentDefaultDeviceMode === 'ask' ? 'silent' : currentDefaultDeviceMode;
    setDeviceTestStatus('testing');
    setDeviceRestoredBanner(null);
    await new Promise(r => setTimeout(r, 180));
    const res = await deviceModeService.applySessionMode(target);
    setDeviceTestResult(res);
    setDeviceTestStatus('completed');
  };

  const handleRestoreFromTest = async () => {
    const res = await deviceModeService.restorePreviousMode(true);
    if (res.restored) {
      setDeviceTestResult(null);
      setDeviceTestStatus('idle');
      setDeviceRestoredBanner(res.message);
      setTimeout(() => setDeviceRestoredBanner(null), 4000);
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
            <SettingsIcon className="w-4 h-4" />
            <span>Preferences &amp; System</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">Settings</h1>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Customize themes, motion accessibility, distraction control, local security, and offline backups.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <AnimatePresence>
            {savedSettingBanner && (
              <motion.span
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 4 }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{savedSettingBanner}</span>
              </motion.span>
            )}
          </AnimatePresence>

          <motion.button
            {...tactileProps}
            type="button"
            onClick={toggleAllSections}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border)',
              color: 'var(--text-secondary)',
            }}
          >
            <ChevronsUpDown className="w-3.5 h-3.5" />
            <span>{allExpanded ? 'Collapse All' : 'Expand All'}</span>
          </motion.button>
        </div>
      </div>

      {/* 1. General & Brand Configuration */}
      <CollapsibleSection
        title="Product Identity & Gamification"
        subtitle="Configure your personal workspace display title and progression rewards."
        isOpen={openSections.identity}
        onToggle={() => toggleSection('identity')}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <label
              htmlFor="app-name-input"
              className="block text-xs font-semibold mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              Application Name (Configurable globally)
            </label>
            <input
              id="app-name-input"
              type="text"
              value={settings.appName || 'Daycraft'}
              onChange={e => handleUpdateAppName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border text-sm font-medium focus-visible:outline-none"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
            />
          </div>

          <div
            className="p-4 rounded-2xl border flex items-center justify-between gap-4"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
          >
            <div className="min-w-0">
              <span className="text-xs font-bold block" style={{ color: 'var(--text-primary)' }}>
                Gamification, XP &amp; Achievements
              </span>
              <span className="text-[11px] block mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Earn XP, level milestones, and unlockable themes from tasks, habits, and goals.
              </span>
            </div>
            <AnimatedToggle
              checked={settings.gamificationEnabled}
              onChange={val => {
                db.updateSettings({ gamificationEnabled: val });
                flashSavedFeedback(`Gamification ${val ? 'enabled' : 'paused'}`);
              }}
              label="Gamification, XP and Achievements"
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* 2. Theme & Visual Experience */}
      <CollapsibleSection
        title="Theme Presets & Palette Engine"
        subtitle="Handcrafted palettes and unlockable progression themes with warm surfaces and high readability."
        icon={<Palette className="w-4 h-4 text-emerald-600" />}
        isOpen={openSections.theme}
        onToggle={() => toggleSection('theme')}
        badge={
          <div
            onClick={e => e.stopPropagation()}
            className="flex border rounded-xl overflow-hidden text-xs font-semibold p-0.5"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
          >
            {(['light', 'dark', 'system'] as const).map(m => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    flashSavedFeedback(`Appearance mode: ${m}`);
                  }}
                  className={`relative px-2.5 py-1 rounded-lg capitalize transition-colors cursor-pointer ${
                    active ? 'font-bold' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{
                    color: active ? 'var(--accent-foreground)' : 'var(--text-primary)',
                  }}
                >
                  {active && (
                    <motion.span
                      layoutId="themeModeActiveSegment"
                      transition={isReduced ? { duration: 0.06 } : MOTION_SPRINGS.indicator}
                      className="absolute inset-0 rounded-lg"
                      style={{ backgroundColor: 'var(--accent)', zIndex: 0 }}
                    />
                  )}
                  <span className="relative z-10">{m}</span>
                </button>
              );
            })}
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
          {(Object.keys(THEME_PRESETS) as ThemePresetKey[]).map(key => {
            const p = THEME_PRESETS[key];
            const isSelected = presetKey === key;
            const status = getThemeUnlockStatus(key, unlockContext);

            return (
              <div
                key={key}
                className={`p-4 rounded-2xl border text-left transition-colors relative flex flex-col justify-between gap-3 tactile-card ${
                  isSelected ? 'shadow-xs ring-1' : ''
                }`}
                style={{
                  backgroundColor: isSelected ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                  borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                  opacity: status.unlocked ? 1 : 0.78,
                }}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                      {p.name}
                    </span>
                    {isSelected ? (
                      <motion.span
                        layoutId="selectedThemePresetCheck"
                        transition={isReduced ? { duration: 0.06 } : MOTION_SPRINGS.indicator}
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Equipped</span>
                      </motion.span>
                    ) : status.unlocked ? (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md border"
                        style={{
                          backgroundColor: 'var(--bg-surface-subtle)',
                          borderColor: 'var(--border)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        Unlocked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-300">
                        <Lock className="w-3 h-3" />
                        <span>Locked</span>
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                    {p.description}
                  </p>
                </div>

                <div className="space-y-2.5 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1.5">
                      <div className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: p.light.accent }} title="Light Accent" />
                      <div className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: p.dark.accent }} title="Dark Accent" />
                      <div className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: p.light.bgApp }} title="Light Surface" />
                      <div className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: p.dark.bgApp }} title="Dark Surface" />
                    </div>
                    <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                      {status.label}
                    </span>
                  </div>

                  {status.unlocked ? (
                    <motion.button
                      {...tactileProps}
                      type="button"
                      disabled={isSelected}
                      onClick={() => {
                        const equipped = setPresetKey(key);
                        if (equipped) {
                          flashSavedFeedback(`Theme preset: ${p.name}`);
                        }
                      }}
                      className="w-full py-1.5 px-3 rounded-xl border text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-default whitespace-nowrap"
                      style={{
                        backgroundColor: isSelected ? 'var(--bg-surface)' : 'var(--accent)',
                        borderColor: isSelected ? 'var(--border)' : 'var(--accent)',
                        color: isSelected ? 'var(--text-secondary)' : 'var(--accent-foreground)',
                      }}
                    >
                      {isSelected ? 'Active Theme' : 'Equip Theme'}
                    </motion.button>
                  ) : (
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate" style={{ color: 'var(--text-muted)' }}>
                        {status.label}
                      </span>
                      {onNavigate && (
                        <button
                          type="button"
                          onClick={() => onNavigate('achievements')}
                          className="font-semibold underline shrink-0 cursor-pointer whitespace-nowrap"
                          style={{ color: 'var(--accent)' }}
                        >
                          View Milestone
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CollapsibleSection>

      {/* 3. Motion Design & Accessibility */}
      <CollapsibleSection
        title="Motion Design & Accessibility"
        subtitle="Calibrated 60 FPS spring physics, tactile touch responses, and reduced-motion overrides."
        icon={<Gauge className="w-4 h-4 text-emerald-600" />}
        isOpen={openSections.motion}
        onToggle={() => toggleSection('motion')}
        badge={
          <span
            className="text-[11px] font-mono px-2.5 py-1 rounded-full border w-fit"
            style={{
              backgroundColor: isReduced ? 'var(--bg-surface-subtle)' : 'var(--accent-subtle)',
              borderColor: isReduced ? 'var(--border)' : 'var(--accent)',
              color: isReduced ? 'var(--text-muted)' : 'var(--accent)',
            }}
          >
            {isReduced ? 'Active: Reduced Motion' : 'Active: Full Motion (60 FPS)'}
          </span>
        }
      >
        <div className="pt-2">
          <label className="text-xs font-bold block mb-1" style={{ color: 'var(--text-primary)' }}>
            Reduce Motion
          </label>
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
            Control how interface transitions, staggered cards, and Focus Mode ambient visuals behave.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                id: 'system' as MotionMode,
                label: 'System Default',
                badge: 'Default',
                desc: 'Automatically respects your operating system reduced-motion preference.',
              },
              {
                id: 'reduced' as MotionMode,
                label: 'Reduced',
                badge: 'Accessibility',
                desc: 'Replaces movement-heavy transitions and ambient motion with fast, subtle fades.',
              },
              {
                id: 'full' as MotionMode,
                label: 'Full',
                badge: 'Fluid 60 FPS',
                desc: 'Enables spring micro-interactions, smooth layout transitions, and live audio visuals.',
              },
            ].map(opt => {
              const isSelected = motionMode === opt.id;
              return (
                <motion.button
                  key={opt.id}
                  {...tactileProps}
                  type="button"
                  onClick={() => {
                    setMotionMode(opt.id);
                    flashSavedFeedback(`Reduce Motion set to ${opt.label}`);
                    notify({
                      title: 'Motion Preference Saved',
                      message: `Reduce Motion: ${opt.label}`,
                      type: 'system',
                    });
                  }}
                  className={`p-4 rounded-2xl border text-left transition-colors relative cursor-pointer tactile-card ${
                    isSelected ? 'shadow-xs ring-1' : ''
                  }`}
                  style={{
                    backgroundColor: isSelected ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                    borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                      {opt.label}
                    </span>
                    {isSelected && (
                      <motion.span
                        layoutId="reduceMotionSelectionIndicator"
                        transition={isReduced ? { duration: 0.06 } : MOTION_SPRINGS.indicator}
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: 'var(--accent)' }}
                      />
                    )}
                  </div>
                  <span
                    className="inline-block text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border mb-2"
                    style={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderColor: 'var(--border)',
                      color: isSelected ? 'var(--accent)' : 'var(--text-muted)',
                    }}
                  >
                    {opt.badge}
                  </span>
                  <p className="text-[11px] leading-tight" style={{ color: 'var(--text-secondary)' }}>
                    {opt.desc}
                  </p>
                </motion.button>
              );
            })}
          </div>
        </div>
      </CollapsibleSection>

      {/* 4. Focus Mode & Distraction Control */}
      <CollapsibleSection
        title="Focus Mode & Distraction Control"
        subtitle="Configure pre-session device preparation, ringer/vibration behavior, and automatic restoration."
        icon={<BellOff className="w-4 h-4 text-emerald-600" />}
        isOpen={openSections.focusDevice}
        onToggle={() => toggleSection('focusDevice')}
        badge={
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-full border bg-emerald-500/10 text-emerald-600 border-emerald-500/20 w-fit">
            Cross-Platform Ringer &amp; DND
          </span>
        }
      >
        {/* Interactive Default Device Mode Selector Cards */}
        <div className="pt-2 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <label className="text-xs font-bold block" style={{ color: 'var(--text-primary)' }}>
                Default Focus Device Mode Preference
              </label>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Select the target mode to pre-select or apply when a Focus session begins. Selecting an option below saves your preference without changing your current device mode until a session starts.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {[
              {
                id: 'ask' as DeviceFocusMode,
                label: 'Ask Every Time',
                icon: <HelpCircle className="w-4 h-4 text-sky-500" />,
                desc: 'Prompt before each session starts.',
              },
              {
                id: 'silent' as DeviceFocusMode,
                label: 'Silent',
                icon: <VolumeX className="w-4 h-4 text-emerald-600" />,
                desc: 'Mute alert chimes and audible notifications.',
              },
              {
                id: 'vibrate' as DeviceFocusMode,
                label: 'Vibrate',
                icon: <Vibrate className="w-4 h-4 text-indigo-500" />,
                desc: 'Haptic vibration pulses for session milestones.',
              },
              {
                id: 'dnd' as DeviceFocusMode,
                label: 'Do Not Disturb',
                icon: <Moon className="w-4 h-4 text-purple-500" />,
                desc: 'Suppress all in-app banners and alert chimes.',
              },
              {
                id: 'sound' as DeviceFocusMode,
                label: 'Normal Sound',
                icon: <Bell className="w-4 h-4 text-amber-500" />,
                desc: 'Keep standard audio reminders enabled.',
              },
            ].map(choice => {
              const isSelected = currentDefaultDeviceMode === choice.id;
              const support = deviceModeService.inspectModeSupport(choice.id);

              return (
                <motion.button
                  key={choice.id}
                  {...tactileProps}
                  type="button"
                  onClick={() => handleSelectDefaultDeviceMode(choice.id)}
                  className={`p-3.5 rounded-2xl border text-left transition-colors relative flex flex-col justify-between cursor-pointer tactile-card ${
                    isSelected ? 'ring-1 shadow-xs' : ''
                  }`}
                  style={{
                    backgroundColor: isSelected ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                    borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        {choice.icon}
                        <span>{choice.label}</span>
                      </div>
                      {isSelected && (
                        <motion.span
                          layoutId="settingsDefaultDeviceModeDot"
                          transition={isReduced ? { duration: 0.06 } : MOTION_SPRINGS.indicator}
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: 'var(--accent)' }}
                        />
                      )}
                    </div>
                    <p className="text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
                      {choice.desc}
                    </p>
                  </div>

                  <div className="mt-2.5 pt-2 border-t text-[10px] font-mono" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                    {support.badgeLabel}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Toggle Preferences Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {[
            {
              key: 'askBeforeSession',
              label: 'Ask Before Each Session',
              desc: 'Show the device preparation prompt (Silent, Vibrate, DND, Sound) before starting a focus timer.',
              checked: settings.focusDeviceSettings?.askBeforeSession ?? true,
              onChange: (val: boolean) => {
                const updated: FocusDeviceSettings = {
                  ...deviceModeService.getDefaultSettings(),
                  ...settings.focusDeviceSettings,
                  askBeforeSession: val,
                };
                db.updateSettings({ focusDeviceSettings: updated });
                flashSavedFeedback(`Ask Before Session: ${val ? 'On' : 'Off'}`);
              },
            },
            {
              key: 'restoreAfterFocus',
              label: 'Restore Previous Mode After Focus',
              desc: 'Revert device audio and notification policies back to their prior state when a session ends or resets.',
              checked: settings.focusDeviceSettings?.restoreAfterFocus ?? true,
              onChange: (val: boolean) => {
                const updated: FocusDeviceSettings = {
                  ...deviceModeService.getDefaultSettings(),
                  ...settings.focusDeviceSettings,
                  restoreAfterFocus: val,
                  restorePreviousMode: val,
                };
                db.updateSettings({ focusDeviceSettings: updated });
                flashSavedFeedback(`Restore After Focus: ${val ? 'On' : 'Off'}`);
              },
            },
            {
              key: 'allowAutoModeChanges',
              label: 'Allow Automatic Mode Changes',
              desc: 'Apply the selected focus profile directly when starting a sprint without extra confirmation dialogs.',
              checked: settings.focusDeviceSettings?.allowAutoModeChanges ?? true,
              onChange: (val: boolean) => {
                const updated: FocusDeviceSettings = {
                  ...deviceModeService.getDefaultSettings(),
                  ...settings.focusDeviceSettings,
                  allowAutoModeChanges: val,
                  allowAutomaticChanges: val,
                };
                db.updateSettings({ focusDeviceSettings: updated });
                flashSavedFeedback(`Automatic Mode Changes: ${val ? 'On' : 'Off'}`);
              },
            },
            {
              key: 'showStatusDuringFocus',
              label: 'Show Device Status During Focus',
              desc: 'Display a verified active status badge on the focus timer screen with one-click restoration.',
              checked: settings.focusDeviceSettings?.showStatusDuringFocus ?? true,
              onChange: (val: boolean) => {
                const updated: FocusDeviceSettings = {
                  ...deviceModeService.getDefaultSettings(),
                  ...settings.focusDeviceSettings,
                  showStatusDuringFocus: val,
                  showDeviceModeStatus: val,
                };
                db.updateSettings({ focusDeviceSettings: updated });
                flashSavedFeedback(`Show Device Status: ${val ? 'On' : 'Off'}`);
              },
            },
            {
              key: 'suppressDuringQuietHours',
              label: 'Suppress Prompt During Quiet Hours',
              desc: 'Skip the preparation dialog between 22:00 and 07:00, automatically applying Do Not Disturb.',
              checked: settings.focusDeviceSettings?.suppressDuringQuietHours ?? true,
              onChange: (val: boolean) => {
                const updated: FocusDeviceSettings = {
                  ...deviceModeService.getDefaultSettings(),
                  ...settings.focusDeviceSettings,
                  suppressDuringQuietHours: val,
                  suppressPromptDuringQuietHours: val,
                };
                db.updateSettings({ focusDeviceSettings: updated });
                flashSavedFeedback(`Quiet Hours Suppression: ${val ? 'On' : 'Off'}`);
              },
            },
          ].map(item => (
            <div
              key={item.key}
              className="p-4 rounded-2xl border flex items-start justify-between gap-4"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
            >
              <div className="min-w-0">
                <label className="text-xs font-bold block" style={{ color: 'var(--text-primary)' }}>
                  {item.label}
                </label>
                <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {item.desc}
                </p>
              </div>
              <AnimatedToggle
                checked={item.checked}
                onChange={item.onChange}
                label={item.label}
              />
            </div>
          ))}
        </div>

        {/* Platform Capabilities & Live Mode Verification Bar */}
        {(() => {
          const caps = deviceModeService.getPlatformCapabilities();
          return (
            <div
              className="p-4 rounded-2xl border text-xs space-y-3"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold" style={{ color: 'var(--text-primary)' }}>
                  <Sliders className="w-4 h-4 text-emerald-600" />
                  <span>
                    Active Hardware &amp; OS Profile: <span className="capitalize">{caps.platform}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <TactileButton
                    variant="secondary"
                    statusState={deviceTestStatus === 'testing' ? 'loading' : 'idle'}
                    loadingLabel="Checking Platform..."
                    onClick={handleTestDeviceModeNow}
                  >
                    Test &amp; Verify Mode ({currentDefaultDeviceMode === 'ask' ? 'Silent' : currentDefaultDeviceMode})
                  </TactileButton>

                  {deviceModeService.isFocusSessionActive() && (
                    <TactileButton
                      variant="subtle"
                      onClick={handleRestoreFromTest}
                    >
                      Restore Original Mode
                    </TactileButton>
                  )}
                </div>
              </div>

              <div
                className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]"
                style={{ color: 'var(--text-secondary)' }}
              >
                <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5">
                  <span className="font-semibold block">Haptic / Vibration Hardware</span>
                  <span>
                    {caps.canVibrate
                      ? 'Supported (Hardware vibration actuator)'
                      : 'Unsupported on this device (Uses silent fallback)'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5">
                  <span className="font-semibold block">In-App Audio &amp; Banner Isolation</span>
                  <span>Supported (Zero-leak in-app suppression)</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5">
                  <span className="font-semibold block">OS System DND / Focus Assist</span>
                  <span>
                    {caps.platform === 'android'
                      ? 'Supported via Capacitor NotificationPolicy'
                      : caps.platform === 'windows'
                      ? 'Managed via Windows Focus Assist'
                      : 'Browser sandbox (In-app DND active)'}
                  </span>
                </div>
              </div>

              {/* Honest Verification Result or Restoration Feedback */}
              <AnimatePresence mode="wait">
                {deviceTestStatus === 'completed' && deviceTestResult && (
                  <motion.div
                    key="test-result"
                    variants={variants.statusBanner}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className={`p-3 rounded-xl border flex items-start justify-between gap-3 ${
                      deviceTestResult.verification === 'unsupported_fallback'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
                        : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-300'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {deviceTestResult.verification === 'unsupported_fallback' ? (
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                      )}
                      <div>
                        <span className="font-bold block text-xs">
                          {deviceTestResult.appliedScopeLabel}
                        </span>
                        <span className="text-[11px] block mt-0.5 opacity-90">
                          {deviceTestResult.explanatoryNote || deviceTestResult.message}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRestoreFromTest}
                      className="text-xs font-semibold underline shrink-0 cursor-pointer"
                    >
                      Restore Now
                    </button>
                  </motion.div>
                )}

                {deviceRestoredBanner && (
                  <motion.div
                    key="restored-banner"
                    variants={variants.statusBanner}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="p-3 rounded-xl border bg-stone-500/10 border-stone-500/20 flex items-center gap-2 text-xs"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{deviceRestoredBanner}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })()}
      </CollapsibleSection>

      {/* 5. Audio & Native Notifications */}
      <CollapsibleSection
        title="Sound & Native Notifications"
        subtitle="Configure UI synthesis feedback, celebration effects, and native OS notification permissions."
        icon={<Volume2 className="w-4 h-4 text-emerald-600" />}
        isOpen={openSections.audio}
        onToggle={() => toggleSection('audio')}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div
            className="p-4 rounded-2xl border space-y-3"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold block">Synthesized UI Sounds</span>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Tactile clicks and completion chimes
                </span>
              </div>
              <AnimatedToggle
                checked={settings.soundEnabled}
                onChange={val => {
                  db.updateSettings({ soundEnabled: val });
                  flashSavedFeedback(`Synthesized sounds ${val ? 'enabled' : 'disabled'}`);
                }}
                label="Synthesized UI Sounds"
              />
            </div>
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <label style={{ color: 'var(--text-secondary)' }}>UI Chime &amp; Bell Volume</label>
                <span className="font-mono font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {Math.round(settings.soundVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.soundVolume}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  db.updateSettings({ soundVolume: val });
                  soundService.playClick(val);
                }}
                aria-label="UI Chime and Bell Volume"
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>
          </div>

          <div
            className="p-4 rounded-2xl border space-y-3 flex flex-col justify-between"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold block">Confetti Celebrations</span>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Celebratory burst on major milestones
                </span>
              </div>
              <AnimatedToggle
                checked={settings.celebrationEnabled}
                onChange={val => {
                  db.updateSettings({ celebrationEnabled: val });
                  flashSavedFeedback(`Celebrations ${val ? 'enabled' : 'disabled'}`);
                }}
                label="Confetti Celebrations"
              />
            </div>
            <TactileButton
              variant="secondary"
              statusState={notifBtnState}
              loadingLabel="Requesting Permission..."
              successLabel="Notification Dispatched"
              errorLabel="Permission Blocked"
              icon={<Bell className="w-3.5 h-3.5" />}
              onClick={handleTestNotification}
              className="w-full"
            >
              Test Native OS Notification
            </TactileButton>
          </div>
        </div>
      </CollapsibleSection>

      {/* 6. Local App Lock & Security */}
      <CollapsibleSection
        title="On-Device App Lock"
        subtitle="Salted SHA-256 PIN hash with brute-force rate limiting."
        icon={<Lock className="w-4 h-4 text-amber-500" />}
        isOpen={openSections.security}
        onToggle={() => toggleSection('security')}
        badge={
          settings.appLockEnabled ? (
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              PIN Active
            </span>
          ) : (
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              Disabled
            </span>
          )
        }
      >
        {!settings.appLockEnabled ? (
          <form onSubmit={handleSetPin} className="max-w-md space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Enter 4-Digit PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={pinInput}
                  onChange={e => {
                    setPinError(null);
                    setPinInput(e.target.value.replace(/\D/g, ''));
                  }}
                  placeholder="••••"
                  className="w-full px-3 py-2 rounded-xl border text-sm text-center font-mono tracking-widest focus-visible:outline-none"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Confirm PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={pinConfirm}
                  onChange={e => {
                    setPinError(null);
                    setPinConfirm(e.target.value.replace(/\D/g, ''));
                  }}
                  placeholder="••••"
                  className="w-full px-3 py-2 rounded-xl border text-sm text-center font-mono tracking-widest focus-visible:outline-none"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                />
              </div>
            </div>

            <AnimatePresence>
              {pinError && (
                <motion.p
                  initial={{ opacity: 0, y: -3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-red-500 flex items-center gap-1.5"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{pinError}</span>
                </motion.p>
              )}
            </AnimatePresence>

            <TactileButton
              type="submit"
              variant="primary"
              statusState={pinBtnState}
              loadingLabel="Encrypting PIN..."
              successLabel="PIN Activated"
              errorLabel="Check PIN"
            >
              Activate PIN Lock
            </TactileButton>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-4 p-3.5 rounded-2xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs mt-2">
            <span>App lock is active. You will be prompted for your PIN upon opening the app.</span>
            <TactileButton variant="danger" onClick={handleDisableLock}>
              Disable Lock
            </TactileButton>
          </div>
        )}
      </CollapsibleSection>

      {/* 7. Local Backup & Restore */}
      <CollapsibleSection
        title="Local Database Backups & Restore"
        subtitle="Export your entire relational database into a validated, versioned archive. No cloud sync."
        icon={<Download className="w-4 h-4 text-emerald-600" />}
        isOpen={openSections.backup}
        onToggle={() => toggleSection('backup')}
      >
        <div className="flex flex-wrap gap-3 pt-2">
          <TactileButton
            variant="secondary"
            statusState={exportBtnState}
            loadingLabel="Packaging Archive..."
            successLabel="Archive Exported"
            errorLabel="Export Failed"
            icon={<Download className="w-4 h-4 text-emerald-600" />}
            onClick={handleExportBackup}
          >
            Export Verified Backup (.daycraft)
          </TactileButton>

          <TactileButton
            variant="secondary"
            statusState={importBtnState}
            loadingLabel="Verifying Archive..."
            successLabel="Archive Restored"
            errorLabel="Invalid Archive"
            icon={<Upload className="w-4 h-4 text-indigo-500" />}
            onClick={handleImportBackup}
          >
            Restore From File...
          </TactileButton>

          <TactileButton
            variant="danger"
            icon={<RotateCcw className="w-4 h-4" />}
            onClick={() => {
              db.resetAllData();
              notify({
                title: 'Database Reset',
                message: 'Restored initial sample data.',
                type: 'system',
              });
              flashSavedFeedback('Demo data restored');
            }}
            className="ml-auto"
          >
            Reset Demo Data
          </TactileButton>
        </div>
      </CollapsibleSection>

      {/* 8. Native Packaging & Platform Instructions */}
      <CollapsibleSection
        title="Android & Windows Native Distribution Specifications"
        subtitle="Capacitor Android APK/AAB and Tauri 2 Windows installer build commands."
        icon={<Smartphone className="w-4 h-4 text-emerald-600" />}
        isOpen={openSections.packaging}
        onToggle={() => toggleSection('packaging')}
      >
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed pt-2"
          style={{ color: 'var(--text-secondary)' }}
        >
          <div
            className="p-4 rounded-2xl border space-y-2"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
          >
            <div className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Smartphone className="w-4 h-4 text-emerald-600" />
              <span>Android (Capacitor Bridge)</span>
            </div>
            <p>
              Pre-configured for Capacitor native compilation. Runs offline on Android 10+ with local SQLite plugin support and background alarm receiver for habit and task reminders.
            </p>
            <div className="font-mono text-[11px] p-2.5 rounded-xl bg-black/5 dark:bg-white/5">
              npm run build
              <br />
              npx cap sync android
              <br />
              npx cap open android
            </div>
          </div>

          <div
            className="p-4 rounded-2xl border space-y-2"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
          >
            <div className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Monitor className="w-4 h-4 text-sky-600" />
              <span>Windows (Tauri 2 Native App)</span>
            </div>
            <p>
              Rust-backed lightweight desktop binary using WebView2. Uses native Windows notifications, local file-system dialogs, and native SQLite drivers.
            </p>
            <div className="font-mono text-[11px] p-2.5 rounded-xl bg-black/5 dark:bg-white/5">
              cargo tauri build
              <br />
              # Produces Daycraft_x64_en-US.msi
            </div>
          </div>
        </div>
      </CollapsibleSection>
    </motion.div>
  );
};
