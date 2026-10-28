import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Flame,
  CheckCircle2,
  Clock,
  Trophy,
  TrendingUp,
  Target,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { db } from '../../database/db';
import { calculateHabitStreak, formatLocalDate, addDays } from '../../services/streakService';
import { calculateLevel } from '../../services/gamificationService';
import { SevenDayCompletionDashboard } from './SevenDayCompletionDashboard';

interface InsightsViewProps {
  onNavigate?: (destination: string) => void;
}

export const InsightsView: React.FC<InsightsViewProps> = ({ onNavigate }) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    return db.subscribe(() => setTick(t => t + 1));
  }, []);

  const todayStr = formatLocalDate(new Date());
  const tasks = db.getTasks();
  const habits = db.getHabits().filter(h => !h.archived);
  const occurrences = db.getHabitOccurrences();
  const focusSessions = db.getFocusSessions().filter(s => s.completed);
  const studySessions = db.getStudySessions();
  const achievements = db.getAchievements();
  const totalXp = db.getTotalXp();
  const levelInfo = calculateLevel(totalXp);

  // Completed tasks count
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const overdueTasks = tasks.filter(t => t.status !== 'completed' && t.dueDate && t.dueDate < todayStr);

  // Total minutes
  const totalFocusMinutes = focusSessions.reduce((acc, s) => acc + s.durationMinutes, 0);
  const totalStudyMinutes = studySessions.reduce((acc, s) => acc + s.durationMinutes, 0);

  // Weekday distribution analysis for habits
  const weekdayStats: Record<string, { total: number; completed: number }> = {
    Sun: { total: 0, completed: 0 },
    Mon: { total: 0, completed: 0 },
    Tue: { total: 0, completed: 0 },
    Wed: { total: 0, completed: 0 },
    Thu: { total: 0, completed: 0 },
    Fri: { total: 0, completed: 0 },
    Sat: { total: 0, completed: 0 },
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  occurrences.forEach(occ => {
    const d = new Date(occ.date + 'T00:00:00');
    const name = dayNames[d.getDay()];
    if (weekdayStats[name]) {
      weekdayStats[name].total++;
      if (occ.status === 'completed') {
        weekdayStats[name].completed++;
      }
    }
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
            <BarChart3 className="w-4 h-4" />
            <span>Deterministic Metrics</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">Productivity & Habit Insights</h1>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Computed 100% locally from your SQLite records. Zero telemetry, zero guesswork.
          </p>
        </div>
      </div>

      {/* 7-Day Completion Visualization Dashboard (Recharts) */}
      <SevenDayCompletionDashboard
        onNavigateToTasks={() => onNavigate?.('tasks')}
        onNavigateToHabits={() => onNavigate?.('habits')}
      />

      {/* Gamification Level Hero */}
      <div
        className="p-6 rounded-3xl border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6"
        style={{
          backgroundColor: 'var(--accent-subtle)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl shadow-sm"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
          >
            {levelInfo.level}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                Level {levelInfo.level} Master
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full font-bold border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
                {totalXp} Total XP
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {levelInfo.currentLevelXp} / {levelInfo.nextLevelXp} XP to reach Level {levelInfo.level + 1}
            </p>
          </div>
        </div>

        <div className="w-full sm:w-48">
          <div className="flex justify-between text-xs font-semibold mb-1">
            <span>Next Level</span>
            <span>{levelInfo.progressPercent}%</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${levelInfo.progressPercent}%`, backgroundColor: 'var(--accent)' }} />
          </div>
        </div>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border shadow-xs" style={{ backgroundColor: 'var(--bg-surface-elevated)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Tasks Finished</span>
          </div>
          <div className="text-2xl font-bold font-mono mt-2" style={{ color: 'var(--text-primary)' }}>
            {completedTasks.length}
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {overdueTasks.length} overdue currently
          </div>
        </div>

        <div className="p-4 rounded-2xl border shadow-xs" style={{ backgroundColor: 'var(--bg-surface-elevated)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            <Clock className="w-4 h-4 text-indigo-500" />
            <span>Focus Logged</span>
          </div>
          <div className="text-2xl font-bold font-mono mt-2" style={{ color: 'var(--text-primary)' }}>
            {Math.round((totalFocusMinutes / 60) * 10) / 10}h
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {focusSessions.length} sessions completed
          </div>
        </div>

        <div className="p-4 rounded-2xl border shadow-xs" style={{ backgroundColor: 'var(--bg-surface-elevated)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            <GraduationCap className="w-4 h-4 text-amber-500" />
            <span>Study Logged</span>
          </div>
          <div className="text-2xl font-bold font-mono mt-2" style={{ color: 'var(--text-primary)' }}>
            {Math.round((totalStudyMinutes / 60) * 10) / 10}h
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {studySessions.length} learning modules
          </div>
        </div>

        <div className="p-4 rounded-2xl border shadow-xs" style={{ backgroundColor: 'var(--bg-surface-elevated)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            <Flame className="w-4 h-4 text-rose-500" />
            <span>Active Habits</span>
          </div>
          <div className="text-2xl font-bold font-mono mt-2" style={{ color: 'var(--text-primary)' }}>
            {habits.length}
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {occurrences.length} recorded checkpoints
          </div>
        </div>
      </div>

      {/* Weekday Consistency & Habit Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Habit Performance Table */}
        <div
          className="p-5 rounded-2xl border shadow-sm"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--card-shadow)',
          }}
        >
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-500" />
            <span>Habit Consistency & Streaks</span>
          </h3>

          <div className="divide-y text-xs" style={{ borderColor: 'var(--border)' }}>
            {habits.map(h => {
              const stats = calculateHabitStreak(h, occurrences, todayStr);
              return (
                <div key={h.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold block">{h.name}</span>
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      Target: {h.targetValue} {h.targetUnit}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="font-bold text-amber-600 block">
                      {stats.currentStreak}d streak
                    </span>
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      30d rate: {stats.completionRate30d}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Day-of-Week Distribution Pattern */}
        <div
          className="p-5 rounded-2xl border shadow-sm"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--card-shadow)',
          }}
        >
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            <span>Consistency by Day of Week</span>
          </h3>

          <div className="grid grid-cols-7 gap-2 pt-4">
            {dayNames.map(day => {
              const stat = weekdayStats[day];
              const pct = stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0;

              return (
                <div key={day} className="flex flex-col items-center">
                  <div className="w-full h-24 rounded-lg flex items-end p-1 justify-center" style={{ backgroundColor: 'var(--bg-surface-subtle)' }}>
                    <div
                      className="w-full rounded transition-all"
                      style={{
                        height: `${Math.max(8, pct)}%`,
                        backgroundColor: 'var(--accent)',
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-bold mt-2">{day}</span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Achievements Roster */}
      <div
        className="p-5 rounded-2xl border shadow-sm"
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span>Milestone Achievements</span>
          </h3>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('achievements')}
              className="text-xs font-semibold underline cursor-pointer whitespace-nowrap"
              style={{ color: 'var(--accent)' }}
            >
              Open Full Gallery &amp; Themes
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {achievements.map(ach => {
            const isUnlocked = Boolean(ach.unlockedAt);
            return (
              <div
                key={ach.id}
                className="p-3.5 rounded-xl border flex items-center gap-3"
                style={{
                  backgroundColor: isUnlocked ? 'var(--bg-surface)' : 'var(--bg-surface-subtle)',
                  borderColor: isUnlocked ? 'var(--accent)' : 'var(--border)',
                  opacity: isUnlocked ? 1 : 0.6,
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shrink-0"
                  style={{
                    backgroundColor: isUnlocked ? 'var(--accent-subtle)' : 'var(--border)',
                    color: isUnlocked ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                >
                  <Trophy className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                      {ach.title}
                    </span>
                    <span className="text-[10px] font-bold text-amber-600">+{ach.xpReward} XP</span>
                  </div>
                  <p className="text-[11px] mt-0.5 line-clamp-1" style={{ color: 'var(--text-secondary)' }}>
                    {ach.description}
                  </p>
                  <div className="w-full h-1 rounded-full overflow-hidden mt-1.5" style={{ backgroundColor: 'var(--border)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${ach.progress}%`, backgroundColor: 'var(--accent)' }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
