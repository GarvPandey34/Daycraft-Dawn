import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy,
  Award,
  Crown,
  Sparkles,
  Flame,
  CheckCircle2,
  ListOrdered,
  Timer,
  BookOpen,
  Feather,
  FolderCheck,
  CheckSquare,
  Zap,
  ShieldCheck,
  Layers,
  Workflow,
  Hourglass,
  Compass,
  BookMarked,
  Lock,
  Check,
  Search,
  Palette,
  ArrowUpRight,
  RotateCcw,
  Star,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../../database/db';
import { Achievement } from '../../domain/models';
import {
  BadgeTier,
  calculateLevel,
  filterAchievements,
  getAchievementStatus,
  getAchievementSummaryStats,
  getAchievementUnitLabel,
  getBadgeTier,
  getNextLevelReward,
  LEVEL_MILESTONE_REWARDS,
  AchievementStatus,
} from '../../services/gamificationService';
import {
  getThemeUnlockStatus,
  THEME_PRESETS,
  ThemePresetKey,
} from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { useMotionPreference } from '../../theme/motion';

interface AchievementsViewProps {
  onNavigate?: (destination: string) => void;
  initialHighlightAchievementId?: string | null;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  CheckCircle2,
  ListOrdered,
  Flame,
  Sparkles,
  Timer,
  BookOpen,
  Feather,
  FolderCheck,
  CheckSquare,
  Award,
  Crown,
  Zap,
  ShieldCheck,
  Trophy,
  Layers,
  Workflow,
  Hourglass,
  Compass,
  BookMarked,
};

const TIER_STYLES: Record<
  BadgeTier,
  {
    label: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    iconBg: string;
    iconColor: string;
  }
> = {
  bronze: {
    label: 'Bronze',
    badgeBg: 'rgba(180, 105, 58, 0.12)',
    badgeText: '#B4693A',
    badgeBorder: 'rgba(180, 105, 58, 0.28)',
    iconBg: 'rgba(180, 105, 58, 0.14)',
    iconColor: '#B4693A',
  },
  silver: {
    label: 'Silver',
    badgeBg: 'rgba(100, 116, 139, 0.14)',
    badgeText: '#64748B',
    badgeBorder: 'rgba(100, 116, 139, 0.3)',
    iconBg: 'rgba(100, 116, 139, 0.15)',
    iconColor: '#64748B',
  },
  gold: {
    label: 'Gold',
    badgeBg: 'rgba(202, 138, 4, 0.14)',
    badgeText: '#B47804',
    badgeBorder: 'rgba(202, 138, 4, 0.32)',
    iconBg: 'rgba(202, 138, 4, 0.16)',
    iconColor: '#CA8A04',
  },
  diamond: {
    label: 'Diamond',
    badgeBg: 'rgba(14, 116, 144, 0.14)',
    badgeText: '#0E7490',
    badgeBorder: 'rgba(14, 116, 144, 0.32)',
    iconBg: 'rgba(14, 116, 144, 0.16)',
    iconColor: '#0891B2',
  },
  obsidian: {
    label: 'Obsidian',
    badgeBg: 'rgba(124, 58, 237, 0.14)',
    badgeText: '#7C3AED',
    badgeBorder: 'rgba(124, 58, 237, 0.32)',
    iconBg: 'rgba(124, 58, 237, 0.16)',
    iconColor: '#7C3AED',
  },
};

const CATEGORY_LABELS: Record<Achievement['category'] | 'all', string> = {
  all: 'All Categories',
  productivity: 'Productivity',
  consistency: 'Consistency',
  focus: 'Deep Focus',
  learning: 'Learning',
  mastery: 'Mastery',
};

const ACHIEVEMENT_THEME_REWARDS: Record<string, ThemePresetKey> = {
  first_project: 'emerald_luxe',
  habit_7d: 'sunset',
  focus_300: 'solar_gold',
};

function formatUnlockDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export const AchievementsView: React.FC<AchievementsViewProps> = ({
  onNavigate,
  initialHighlightAchievementId,
}) => {
  const { presetKey, setPresetKey } = useTheme();
  const { variants, tactileProps } = useMotionPreference();
  const [, setTick] = useState(0);

  const [selectedCategory, setSelectedCategory] = useState<Achievement['category'] | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<AchievementStatus | 'all'>('all');
  const [selectedTier, setSelectedTier] = useState<BadgeTier | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [equippedThemeFeedback, setEquippedThemeFeedback] = useState<string | null>(null);

  useEffect(() => {
    db.markAchievementsSeen();
    return db.subscribe(() => {
      db.markAchievementsSeen();
      setTick(t => t + 1);
    });
  }, []);

  const settings = db.getSettings();
  const achievements = db.getAchievements();
  const totalXp = db.getTotalXp();
  const levelInfo = calculateLevel(totalXp);
  const nextReward = getNextLevelReward(levelInfo.level);
  const summary = useMemo(() => getAchievementSummaryStats(achievements), [achievements]);
  const unlockContext = db.getThemeUnlockContext();

  const filteredAchievements = useMemo(
    () =>
      filterAchievements(achievements, {
        category: selectedCategory,
        status: selectedStatus,
        tier: selectedTier,
        searchQuery,
      }),
    [achievements, selectedCategory, selectedStatus, selectedTier, searchQuery]
  );

  const recentlyUnlocked = useMemo(() => {
    return achievements
      .filter(a => Boolean(a.unlockedAt))
      .sort((a, b) => (b.unlockedAt || '').localeCompare(a.unlockedAt || ''))
      .slice(0, 4);
  }, [achievements]);

  const hasActiveFilters =
    selectedCategory !== 'all' ||
    selectedStatus !== 'all' ||
    selectedTier !== 'all' ||
    searchQuery.trim().length > 0;

  const resetFilters = () => {
    setSelectedCategory('all');
    setSelectedStatus('all');
    setSelectedTier('all');
    setSearchQuery('');
  };

  const handleEquipTheme = (key: ThemePresetKey, name: string) => {
    const equipped = setPresetKey(key);
    if (equipped) {
      setEquippedThemeFeedback(`Equipped "${name}" theme`);
      setTimeout(() => {
        setEquippedThemeFeedback(prev => (prev === `Equipped "${name}" theme` ? null : prev));
      }, 2500);
    }
  };

  return (
    <motion.div
      variants={variants.page}
      initial="initial"
      animate="animate"
      exit="exit"
      className="p-6 max-w-6xl mx-auto space-y-6"
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
            <Trophy className="w-4 h-4" />
            <span>Craft &amp; Mastery Progression</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">Achievements &amp; Rewards</h1>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Milestone badges, deterministic XP levels, and unlockable visual themes earned through real consistency.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <AnimatePresence>
            {equippedThemeFeedback && (
              <motion.span
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 4 }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300 whitespace-nowrap"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{equippedThemeFeedback}</span>
              </motion.span>
            )}
          </AnimatePresence>

          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <Palette className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
              <span>Theme Settings</span>
            </button>
          )}
        </div>
      </div>

      {/* Gamification Paused Notice */}
      {!settings.gamificationEnabled && (
        <div
          role="status"
          className="p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-500/10 border-amber-500/25"
        >
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-amber-800 dark:text-amber-300">
              Gamification Rewards Paused
            </div>
            <p className="text-xs text-amber-700/90 dark:text-amber-200/80">
              XP awards and new badge unlocks are currently disabled. Your existing badges, levels, and unlocked themes remain preserved.
            </p>
          </div>
          <button
            type="button"
            onClick={() => db.updateSettings({ gamificationEnabled: true })}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white cursor-pointer whitespace-nowrap self-start sm:self-auto"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Enable Gamification
          </button>
        </div>
      )}

      {/* Level Progression Hero & Summary KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Player Level & XP Progress Card */}
        <div
          className="lg:col-span-7 p-6 rounded-2xl border flex flex-col justify-between gap-5"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--card-shadow)',
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-black shrink-0 shadow-xs"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-foreground)',
                }}
              >
                <span className="text-[10px] uppercase tracking-wider font-semibold opacity-85">
                  LVL
                </span>
                <span className="text-2xl leading-none tabular-nums">{levelInfo.level}</span>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    Level {levelInfo.level} · {levelInfo.title}
                  </h2>
                  <span
                    className="text-xs px-2.5 py-0.5 rounded-md font-mono font-bold border tabular-nums"
                    style={{
                      backgroundColor: 'var(--accent-subtle)',
                      borderColor: 'var(--border)',
                      color: 'var(--accent)',
                    }}
                  >
                    {levelInfo.totalXp} Total XP
                  </span>
                </div>
                <p className="text-xs mt-1 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                  {levelInfo.currentLevelXp} / {levelInfo.nextLevelXp} XP in current level ·{' '}
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {levelInfo.xpNeededForNextLevel} XP
                  </span>{' '}
                  to reach Level {levelInfo.level + 1}
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <span className="text-[11px] uppercase tracking-wider font-semibold block" style={{ color: 'var(--text-muted)' }}>
                Level Progress
              </span>
              <span className="text-xl font-bold font-mono tabular-nums" style={{ color: 'var(--accent)' }}>
                {levelInfo.progressPercent}%
              </span>
            </div>
          </div>

          {/* Level Progress Bar */}
          <div className="space-y-2">
            <div
              className="w-full h-2.5 rounded-full overflow-hidden border"
              style={{
                backgroundColor: 'var(--bg-surface-subtle)',
                borderColor: 'var(--border)',
              }}
              role="progressbar"
              aria-valuenow={levelInfo.progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Level ${levelInfo.level} progress`}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${levelInfo.progressPercent}%`,
                  backgroundColor: 'var(--accent)',
                }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              <span className="tabular-nums">
                Level {levelInfo.level} Floor: {levelInfo.currentFloorXp} XP
              </span>
              {nextReward ? (
                <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>
                  <Star className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>
                    Next Milestone (Level {nextReward.level}):{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>{nextReward.rewardLabel}</strong>
                  </span>
                </span>
              ) : (
                <span className="font-medium text-emerald-600">
                  All level milestone rewards unlocked
                </span>
              )}
              <span className="tabular-nums">
                Level {levelInfo.level + 1} Target: {levelInfo.nextLevelThresholdXp} XP
              </span>
            </div>
          </div>
        </div>

        {/* Collection Summary Stats */}
        <div className="lg:col-span-5 grid grid-cols-2 gap-3">
          <div
            className="p-4 rounded-2xl border flex flex-col justify-between"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border)',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Badges Unlocked
              </span>
              <Trophy className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold font-mono tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {summary.unlockedCount}{' '}
                <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>
                  / {summary.totalCount}
                </span>
              </div>
              <div className="text-[11px] mt-0.5 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                {summary.completionPercent}% collection complete
              </div>
            </div>
          </div>

          <div
            className="p-4 rounded-2xl border flex flex-col justify-between"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border)',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Badge XP Earned
              </span>
              <Zap className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold font-mono tabular-nums" style={{ color: 'var(--text-primary)' }}>
                +{summary.totalXpEarnedFromBadges}
              </div>
              <div className="text-[11px] mt-0.5 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                of {summary.totalXpAvailableFromBadges} XP available
              </div>
            </div>
          </div>

          <div
            className="p-4 rounded-2xl border flex flex-col justify-between"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border)',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                In Progress
              </span>
              <Flame className="w-4 h-4 text-orange-500" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold font-mono tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {summary.inProgressCount}
              </div>
              <div className="text-[11px] mt-0.5 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                Active milestone tracks
              </div>
            </div>
          </div>

          <div
            className="p-4 rounded-2xl border flex flex-col justify-between"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border)',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Themes Unlocked
              </span>
              <Palette className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold font-mono tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {
                  (Object.keys(THEME_PRESETS) as ThemePresetKey[]).filter(k =>
                    db.isThemeEligible(k)
                  ).length
                }{' '}
                <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>
                  / {Object.keys(THEME_PRESETS).length}
                </span>
              </div>
              <div className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                Active: {THEME_PRESETS[presetKey]?.name}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recently Unlocked Strip (when at least 1 badge is unlocked) */}
      {recentlyUnlocked.length > 0 && (
        <div
          className="p-5 rounded-2xl border space-y-3"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
              <Award className="w-4 h-4 text-amber-500" />
              <span>Recently Unlocked Milestones</span>
            </h2>
            <span className="text-[11px] font-mono tabular-nums" style={{ color: 'var(--text-muted)' }}>
              Latest {recentlyUnlocked.length} earned
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {recentlyUnlocked.map(ach => {
              const IconComp = ICON_MAP[ach.icon] || Trophy;
              const tier = getBadgeTier(ach.target, ach.category);
              const tierStyle = TIER_STYLES[tier];
              return (
                <div
                  key={`recent_${ach.id}`}
                  className="p-3.5 rounded-xl border flex items-center gap-3"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: tierStyle.iconBg,
                      color: tierStyle.iconColor,
                    }}
                  >
                    <IconComp className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                        {ach.title}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-amber-600 shrink-0 tabular-nums">
                        +{ach.xpReward} XP
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      <span className="capitalize">{tierStyle.label}</span>
                      <span className="tabular-nums">{formatUnlockDate(ach.unlockedAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Bar for Complete Badge Gallery */}
      <div
        className="p-4 rounded-2xl border space-y-3"
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Achievement categories">
            {(['all', 'productivity', 'consistency', 'focus', 'learning', 'mastery'] as const).map(cat => {
              const active = selectedCategory === cat;
              const count =
                cat === 'all'
                  ? achievements.length
                  : achievements.filter(a => a.category === cat).length;

              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    active ? 'shadow-xs' : 'hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                  style={{
                    backgroundColor: active ? 'var(--accent)' : 'var(--bg-surface)',
                    color: active ? 'var(--accent-foreground)' : 'var(--text-secondary)',
                    borderColor: active ? 'var(--accent)' : 'var(--border)',
                  }}
                >
                  <span>{CATEGORY_LABELS[cat]}</span>
                  <span
                    className="text-[10px] font-mono tabular-nums opacity-80"
                  >
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search badges..."
              aria-label="Search badges"
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border text-xs font-medium focus-visible:outline-none"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>

        {/* Secondary Filter Row: Status & Rarity Tier */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold mr-1" style={{ color: 'var(--text-muted)' }}>
              Status:
            </span>
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'unlocked', label: `Unlocked (${summary.unlockedCount})` },
                { id: 'in_progress', label: `In Progress (${summary.inProgressCount})` },
                { id: 'locked', label: `Locked (${summary.lockedCount})` },
              ] as const
            ).map(st => {
              const active = selectedStatus === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setSelectedStatus(st.id)}
                  className="px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
                  style={{
                    backgroundColor: active ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                    borderColor: active ? 'var(--accent)' : 'var(--border)',
                    color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                >
                  {st.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold mr-1" style={{ color: 'var(--text-muted)' }}>
              Tier:
            </span>
            {(['all', 'bronze', 'silver', 'gold', 'diamond', 'obsidian'] as const).map(t => {
              const active = selectedTier === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedTier(t)}
                  className="px-2.5 py-1 rounded-lg border text-[11px] font-semibold capitalize transition-colors cursor-pointer whitespace-nowrap"
                  style={{
                    backgroundColor: active ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                    borderColor: active ? 'var(--accent)' : 'var(--border)',
                    color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                >
                  {t === 'all' ? 'All Tiers' : t}
                </button>
              );
            })}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer whitespace-nowrap hover:bg-black/5 dark:hover:bg-white/5"
                style={{
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Complete 19-Badge Gallery Grid */}
      {filteredAchievements.length === 0 ? (
        <div
          className="p-10 rounded-2xl border text-center space-y-3"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border)',
          }}
        >
          <Trophy className="w-8 h-8 mx-auto opacity-40" style={{ color: 'var(--text-muted)' }} />
          <div className="space-y-1">
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              No matching badges found
            </h3>
            <p className="text-xs max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
              No achievements match the selected category, status, or tier filters. Reset filters to view all {achievements.length} badges.
            </p>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Show All {achievements.length} Badges</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAchievements.map(ach => {
            const status = getAchievementStatus(ach);
            const isUnlocked = status === 'unlocked';
            const isInProgress = status === 'in_progress';
            const tier = getBadgeTier(ach.target, ach.category);
            const tierStyle = TIER_STYLES[tier];
            const IconComp = ICON_MAP[ach.icon] || Trophy;
            const unitLabel = getAchievementUnitLabel(ach);
            const rewardThemeKey = ACHIEVEMENT_THEME_REWARDS[ach.id];
            const rewardTheme = rewardThemeKey ? THEME_PRESETS[rewardThemeKey] : undefined;
            const isHighlighted = initialHighlightAchievementId === ach.id;

            return (
              <div
                key={ach.id}
                id={`achievement-card-${ach.id}`}
                className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 transition-all tactile-card ${
                  isHighlighted ? 'ring-2' : ''
                }`}
                style={{
                  backgroundColor: isUnlocked
                    ? 'var(--bg-surface-elevated)'
                    : 'var(--bg-surface)',
                  borderColor: isUnlocked
                    ? 'var(--accent)'
                    : isInProgress
                      ? 'var(--border)'
                      : 'var(--border)',
                  boxShadow: isUnlocked ? 'var(--card-shadow)' : 'none',
                  opacity: status === 'locked' ? 0.78 : 1,
                }}
              >
                <div className="space-y-3">
                  {/* Top Row: Icon + Tier & XP */}
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor: isUnlocked
                          ? tierStyle.iconBg
                          : 'var(--bg-surface-subtle)',
                        borderColor: isUnlocked ? tierStyle.badgeBorder : 'var(--border)',
                        color: isUnlocked ? tierStyle.iconColor : 'var(--text-muted)',
                      }}
                    >
                      {status === 'locked' ? (
                        <Lock className="w-5 h-5 opacity-75" />
                      ) : (
                        <IconComp className="w-6 h-6" />
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border"
                        style={{
                          backgroundColor: tierStyle.badgeBg,
                          color: tierStyle.badgeText,
                          borderColor: tierStyle.badgeBorder,
                        }}
                      >
                        {tierStyle.label}
                      </span>
                      <span
                        className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md border tabular-nums"
                        style={{
                          backgroundColor: isUnlocked
                            ? 'var(--accent-subtle)'
                            : 'var(--bg-surface-subtle)',
                          borderColor: 'var(--border)',
                          color: isUnlocked ? 'var(--accent)' : 'var(--text-secondary)',
                        }}
                      >
                        +{ach.xpReward} XP
                      </span>
                    </div>
                  </div>

                  {/* Title, Category & Description */}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                        {ach.title}
                      </h3>
                      {isUnlocked && (
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-600 shrink-0">
                          <Check className="w-3 h-3 stroke-[2.5]" />
                        </span>
                      )}
                    </div>
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider block mt-0.5"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {CATEGORY_LABELS[ach.category]}
                    </span>
                    <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {ach.description}
                    </p>
                  </div>

                  {/* Theme Unlock Bonus Tag if applicable */}
                  {rewardTheme && (
                    <div
                      className="px-3 py-2 rounded-xl border flex items-center justify-between gap-2 text-[11px]"
                      style={{
                        backgroundColor: 'var(--bg-surface-subtle)',
                        borderColor: 'var(--border)',
                      }}
                    >
                      <span className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>
                        <Palette className="w-3.5 h-3.5 shrink-0" style={{ color: rewardTheme.previewSwatches.accent }} />
                        <span>
                          Unlocks <strong>{rewardTheme.name}</strong> Theme
                        </span>
                      </span>
                      {isUnlocked && rewardThemeKey && (
                        <button
                          type="button"
                          onClick={() => handleEquipTheme(rewardThemeKey, rewardTheme.name)}
                          disabled={presetKey === rewardThemeKey}
                          className="text-[10px] font-bold underline cursor-pointer whitespace-nowrap disabled:no-underline disabled:opacity-60"
                          style={{ color: 'var(--accent)' }}
                        >
                          {presetKey === rewardThemeKey ? 'Equipped' : 'Equip'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Progress Bar & Footer */}
                <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      {Math.min(ach.current, ach.target)} / {ach.target} {unitLabel}
                    </span>
                    <span className="font-mono tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {ach.progress}%
                    </span>
                  </div>

                  <div
                    className="w-full h-1.5 rounded-full overflow-hidden"
                    style={{ backgroundColor: 'var(--bg-surface-subtle)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${ach.progress}%`,
                        backgroundColor: isUnlocked ? '#16A34A' : 'var(--accent)',
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {isUnlocked ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        Unlocked {formatUnlockDate(ach.unlockedAt)}
                      </span>
                    ) : isInProgress ? (
                      <span>
                        {Math.max(0, ach.target - ach.current)} more {unitLabel} to unlock
                      </span>
                    ) : (
                      <span>Locked · Complete milestone to earn</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Unlockable Visual Themes & Level Roadmap Section */}
      <div
        className="p-6 rounded-2xl border space-y-4"
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Palette className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <span>Unlockable Visual Themes</span>
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Reach higher levels or unlock milestone badges to expand your workspace palette collection.
            </p>
          </div>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="inline-flex items-center gap-1 text-xs font-semibold cursor-pointer whitespace-nowrap"
              style={{ color: 'var(--accent)' }}
            >
              <span>Open Appearance Settings</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {(Object.keys(THEME_PRESETS) as ThemePresetKey[]).map(key => {
            const theme = THEME_PRESETS[key];
            const status = getThemeUnlockStatus(key, unlockContext);
            const isSelected = presetKey === key;

            return (
              <div
                key={key}
                className="p-4 rounded-2xl border flex flex-col justify-between gap-3 transition-colors"
                style={{
                  backgroundColor: isSelected ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                  borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                  opacity: status.unlocked ? 1 : 0.78,
                }}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                      {theme.name}
                    </span>
                    {isSelected ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                        <Check className="w-3 h-3" />
                        <span>Equipped</span>
                      </span>
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
                    {theme.description}
                  </p>
                </div>

                <div className="space-y-2.5 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  {/* Swatches */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-4 h-4 rounded-full border border-black/15"
                        style={{ backgroundColor: theme.light.accent }}
                        title="Light Accent"
                      />
                      <span
                        className="w-4 h-4 rounded-full border border-black/15"
                        style={{ backgroundColor: theme.dark.accent }}
                        title="Dark Accent"
                      />
                      <span
                        className="w-4 h-4 rounded-full border border-black/15"
                        style={{ backgroundColor: theme.light.bgApp }}
                        title="Light Surface"
                      />
                      <span
                        className="w-4 h-4 rounded-full border border-black/15"
                        style={{ backgroundColor: theme.dark.bgApp }}
                        title="Dark Surface"
                      />
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
                      onClick={() => handleEquipTheme(key, theme.name)}
                      className="w-full py-1.5 px-3 rounded-xl border text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-default whitespace-nowrap"
                      style={{
                        backgroundColor: isSelected ? 'var(--bg-surface)' : 'var(--accent)',
                        borderColor: isSelected ? 'var(--border)' : 'var(--accent)',
                        color: isSelected ? 'var(--text-secondary)' : 'var(--accent-foreground)',
                      }}
                    >
                      {isSelected ? 'Currently Active' : 'Equip Theme'}
                    </motion.button>
                  ) : (
                    <div className="text-[11px] font-medium flex items-center justify-between" style={{ color: 'var(--text-muted)' }}>
                      <span>Requirement: {status.label}</span>
                      {status.requiredLevel && (
                        <span className="font-mono tabular-nums">
                          Lvl {levelInfo.level}/{status.requiredLevel}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Level Milestone Roadmap */}
        <div className="pt-3 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
          <span className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
            Level Milestone Roadmap
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {LEVEL_MILESTONE_REWARDS.map(m => {
              const reached = levelInfo.level >= m.level;
              return (
                <div
                  key={m.level}
                  className="p-2.5 rounded-xl border text-left"
                  style={{
                    backgroundColor: reached ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                    borderColor: reached ? 'var(--accent)' : 'var(--border)',
                    opacity: reached ? 1 : 0.7,
                  }}
                >
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="font-mono tabular-nums" style={{ color: reached ? 'var(--accent)' : 'var(--text-primary)' }}>
                      Level {m.level}
                    </span>
                    {reached ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Lock className="w-3 h-3 opacity-60" />
                    )}
                  </div>
                  <div className="text-[11px] font-semibold mt-1 truncate" style={{ color: 'var(--text-primary)' }}>
                    {m.title}
                  </div>
                  <div className="text-[10px] mt-0.5 line-clamp-1" style={{ color: 'var(--text-muted)' }}>
                    {m.unlockedThemeName ? `Theme: ${m.unlockedThemeName}` : 'Milestone Title'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
