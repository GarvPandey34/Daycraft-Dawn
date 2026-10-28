import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import {
  CheckCircle2,
  Flame,
  TrendingUp,
  Calendar,
  Layers,
  BarChart3,
  LineChart as LineChartIcon,
  Sparkles,
  Award,
  ArrowUpRight,
  ChevronRight,
  Info,
} from 'lucide-react';
import { db } from '../../database/db';
import {
  getSevenDayCompletionData,
  DayCompletionData,
} from '../../services/completionAnalyticsService';

interface SevenDayCompletionDashboardProps {
  onNavigateToTasks?: () => void;
  onNavigateToHabits?: () => void;
}

export const SevenDayCompletionDashboard: React.FC<SevenDayCompletionDashboardProps> = ({
  onNavigateToTasks,
  onNavigateToHabits,
}) => {
  const [chartType, setChartType] = useState<'grouped' | 'stacked' | 'area'>('grouped');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const tasks = db.getTasks();
  const habits = db.getHabits().filter(h => !h.archived);
  const occurrences = db.getHabitOccurrences();

  const summary = useMemo(() => {
    return getSevenDayCompletionData(tasks, habits, occurrences);
  }, [tasks, habits, occurrences]);

  // Selected day data for detailed inspection
  const activeDay: DayCompletionData = useMemo(() => {
    if (selectedDate) {
      const match = summary.days.find(d => d.date === selectedDate);
      if (match) return match;
    }
    // Default to today (the last element)
    return summary.days[summary.days.length - 1];
  }, [selectedDate, summary.days]);

  // Chart data formatted for Recharts
  const chartData = useMemo(() => {
    return summary.days.map(d => ({
      date: d.date,
      name: d.dayLabel,
      displayDate: d.displayDate,
      isToday: d.isToday,
      Tasks: d.tasksCount,
      Habits: d.habitsCount,
      Total: d.totalCount,
      completedTasks: d.completedTasks,
      completedHabits: d.completedHabits,
    }));
  }, [summary.days]);

  // Color tokens aligned with Daycraft Warm Paper design system
  const TASK_COLOR = '#C86D51'; // Terracotta
  const HABIT_COLOR = '#3E7051'; // Forest Sage
  const TOTAL_COLOR = '#D97706'; // Warm Amber

  return (
    <div
      className="p-6 rounded-3xl border shadow-sm space-y-6"
      style={{
        backgroundColor: 'var(--bg-surface-elevated)',
        borderColor: 'var(--border)',
        boxShadow: 'var(--card-shadow)',
      }}
    >
      {/* Top Header & Visualizer Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
            <Sparkles className="w-4 h-4" />
            <span>7-Day Productivity Velocity</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight mt-0.5" style={{ color: 'var(--text-primary)' }}>
            Completed Tasks & Habits Dashboard
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Interactive daily completion metrics tracked over the past 7 days across all projects and habit anchors.
          </p>
        </div>

        {/* Chart View Switcher */}
        <div
          className="flex items-center gap-1 p-1 rounded-xl border self-start sm:self-auto"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
        >
          <button
            onClick={() => setChartType('grouped')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              chartType === 'grouped' ? 'shadow-xs font-bold' : 'hover:bg-black/5 opacity-70 hover:opacity-100'
            }`}
            style={{
              backgroundColor: chartType === 'grouped' ? 'var(--accent)' : 'transparent',
              color: chartType === 'grouped' ? 'var(--accent-foreground)' : 'var(--text-primary)',
            }}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Grouped</span>
          </button>
          <button
            onClick={() => setChartType('stacked')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              chartType === 'stacked' ? 'shadow-xs font-bold' : 'hover:bg-black/5 opacity-70 hover:opacity-100'
            }`}
            style={{
              backgroundColor: chartType === 'stacked' ? 'var(--accent)' : 'transparent',
              color: chartType === 'stacked' ? 'var(--accent-foreground)' : 'var(--text-primary)',
            }}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Stacked</span>
          </button>
          <button
            onClick={() => setChartType('area')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              chartType === 'area' ? 'shadow-xs font-bold' : 'hover:bg-black/5 opacity-70 hover:opacity-100'
            }`}
            style={{
              backgroundColor: chartType === 'area' ? 'var(--accent)' : 'transparent',
              color: chartType === 'area' ? 'var(--accent-foreground)' : 'var(--text-primary)',
            }}
          >
            <LineChartIcon className="w-3.5 h-3.5" />
            <span>Trend Area</span>
          </button>
        </div>
      </div>

      {/* KPI Highlight Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div
          className="p-4 rounded-2xl border transition-all"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              Tasks Completed
            </span>
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${TASK_COLOR}20` }}>
              <CheckCircle2 className="w-3.5 h-3.5" style={{ color: TASK_COLOR }} />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono mt-1.5" style={{ color: 'var(--text-primary)' }}>
            {summary.totalTasks}
          </div>
          <div className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            <span>{summary.taskPercentage}% of all completions</span>
          </div>
        </div>

        <div
          className="p-4 rounded-2xl border transition-all"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              Habits Kept
            </span>
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${HABIT_COLOR}20` }}>
              <Flame className="w-3.5 h-3.5" style={{ color: HABIT_COLOR }} />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono mt-1.5" style={{ color: 'var(--text-primary)' }}>
            {summary.totalHabits}
          </div>
          <div className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            <span>{summary.habitPercentage}% of all completions</span>
          </div>
        </div>

        <div
          className="p-4 rounded-2xl border transition-all"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              Daily Average
            </span>
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${TOTAL_COLOR}20` }}>
              <TrendingUp className="w-3.5 h-3.5" style={{ color: TOTAL_COLOR }} />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono mt-1.5" style={{ color: 'var(--text-primary)' }}>
            {summary.dailyAverage}
          </div>
          <div className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            <span className="capitalize">{summary.velocityTrend} momentum</span>
          </div>
        </div>

        <div
          className="p-4 rounded-2xl border transition-all"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              Peak Performance
            </span>
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--accent-subtle)' }}>
              <Award className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono mt-1.5 truncate" style={{ color: 'var(--text-primary)' }}>
            {summary.bestDay ? `${summary.bestDay.totalCount}` : '0'}
          </div>
          <div className="text-[11px] mt-0.5 flex items-center gap-1 truncate" style={{ color: 'var(--text-muted)' }}>
            <span>{summary.bestDay ? `${summary.bestDay.dayLabel} (${summary.bestDay.displayDate})` : 'No data yet'}</span>
          </div>
        </div>
      </div>

      {/* Recharts Visualization Canvas */}
      <div
        className="p-5 rounded-2xl border"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              7-Day Activity Volume
            </span>
            <span className="text-xs font-mono font-medium" style={{ color: 'var(--text-secondary)' }}>
              · {summary.grandTotal} Total Completed
            </span>
          </div>

          {/* Legend indicator */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: TASK_COLOR }} />
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Tasks</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: HABIT_COLOR }} />
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Habits</span>
            </div>
          </div>
        </div>

        {/* Responsive Recharts Container */}
        <div className="w-full h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="taskAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={TASK_COLOR} stopOpacity={0.6} />
                    <stop offset="95%" stopColor={TASK_COLOR} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="habitAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={HABIT_COLOR} stopOpacity={0.6} />
                    <stop offset="95%" stopColor={HABIT_COLOR} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(150, 140, 130, 0.18)" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="var(--text-muted)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="var(--text-muted)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div
                          className="p-3.5 rounded-xl border shadow-lg text-xs space-y-2 min-w-44"
                          style={{
                            backgroundColor: 'var(--bg-surface-elevated)',
                            borderColor: 'var(--border)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <div className="flex items-center justify-between border-b pb-1.5" style={{ borderColor: 'var(--border)' }}>
                            <span className="font-bold">{data.name} ({data.displayDate})</span>
                            <span className="font-mono font-bold text-amber-600">{data.Total} total</span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between" style={{ color: TASK_COLOR }}>
                              <span className="font-semibold">Tasks Completed:</span>
                              <span className="font-mono font-bold">{data.Tasks}</span>
                            </div>
                            <div className="flex items-center justify-between" style={{ color: HABIT_COLOR }}>
                              <span className="font-semibold">Habits Kept:</span>
                              <span className="font-mono font-bold">{data.Habits}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="Tasks"
                  stroke={TASK_COLOR}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#taskAreaGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="Habits"
                  stroke={HABIT_COLOR}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#habitAreaGradient)"
                />
              </AreaChart>
            ) : (
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload.length) {
                    setSelectedDate(e.activePayload[0].payload.date);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(150, 140, 130, 0.18)" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="var(--text-muted)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="var(--text-muted)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div
                          className="p-3.5 rounded-xl border shadow-lg text-xs space-y-2 min-w-48"
                          style={{
                            backgroundColor: 'var(--bg-surface-elevated)',
                            borderColor: 'var(--border)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <div className="flex items-center justify-between border-b pb-1.5" style={{ borderColor: 'var(--border)' }}>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold">{data.name}</span>
                              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{data.displayDate}</span>
                            </div>
                            <span className="font-mono font-bold px-1.5 py-0.5 rounded text-[11px]" style={{ backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)' }}>
                              {data.Total} total
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between" style={{ color: TASK_COLOR }}>
                              <span className="font-semibold">Tasks Finished:</span>
                              <span className="font-mono font-bold">{data.Tasks}</span>
                            </div>
                            <div className="flex items-center justify-between" style={{ color: HABIT_COLOR }}>
                              <span className="font-semibold">Habits Kept:</span>
                              <span className="font-mono font-bold">{data.Habits}</span>
                            </div>
                          </div>
                          <div className="pt-1 text-[10px] text-right" style={{ color: 'var(--text-muted)' }}>
                            Click bar to inspect day details
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {chartType === 'stacked' ? (
                  <>
                    <Bar dataKey="Tasks" stackId="a" fill={TASK_COLOR} radius={[0, 0, 0, 0]} maxBarSize={48}>
                      {chartData.map(entry => (
                        <Cell
                          key={`task-${entry.date}`}
                          fill={TASK_COLOR}
                          opacity={activeDay.date === entry.date ? 1 : 0.85}
                        />
                      ))}
                    </Bar>
                    <Bar dataKey="Habits" stackId="a" fill={HABIT_COLOR} radius={[6, 6, 0, 0]} maxBarSize={48}>
                      {chartData.map(entry => (
                        <Cell
                          key={`habit-${entry.date}`}
                          fill={HABIT_COLOR}
                          opacity={activeDay.date === entry.date ? 1 : 0.85}
                        />
                      ))}
                    </Bar>
                  </>
                ) : (
                  <>
                    <Bar dataKey="Tasks" fill={TASK_COLOR} radius={[6, 6, 0, 0]} maxBarSize={32}>
                      {chartData.map(entry => (
                        <Cell
                          key={`task-${entry.date}`}
                          fill={TASK_COLOR}
                          opacity={activeDay.date === entry.date ? 1 : 0.85}
                        />
                      ))}
                    </Bar>
                    <Bar dataKey="Habits" fill={HABIT_COLOR} radius={[6, 6, 0, 0]} maxBarSize={32}>
                      {chartData.map(entry => (
                        <Cell
                          key={`habit-${entry.date}`}
                          fill={HABIT_COLOR}
                          opacity={activeDay.date === entry.date ? 1 : 0.85}
                        />
                      ))}
                    </Bar>
                  </>
                )}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* 7-Day Day Selector Bar */}
        <div className="grid grid-cols-7 gap-1.5 pt-4 border-t mt-3" style={{ borderColor: 'var(--border)' }}>
          {summary.days.map(d => {
            const isSelected = activeDay.date === d.date;
            return (
              <button
                key={d.date}
                onClick={() => setSelectedDate(d.date)}
                className={`flex flex-col items-center py-2 px-1 rounded-xl border text-center transition-all ${
                  isSelected
                    ? 'ring-2 ring-offset-1 font-bold'
                    : 'hover:bg-black/5 opacity-80 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: isSelected ? 'var(--bg-surface-elevated)' : 'var(--bg-surface-subtle)',
                  borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                  outlineColor: 'var(--accent)',
                }}
              >
                <span className="text-[11px] font-bold" style={{ color: isSelected ? 'var(--accent)' : 'var(--text-primary)' }}>
                  {d.dayLabel}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {d.displayDate}
                </span>
                <div className="flex items-center gap-1 mt-1 font-mono text-[11px]">
                  <span style={{ color: TASK_COLOR }}>{d.tasksCount}</span>
                  <span className="opacity-40">/</span>
                  <span style={{ color: HABIT_COLOR }}>{d.habitsCount}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Day Drilldown Inspector */}
      <div
        className="p-5 rounded-2xl border"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Completed Records on {activeDay.dayLabel} ({activeDay.displayDate})
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)' }}>
              {activeDay.totalCount} Accomplished
            </span>
          </div>

          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {activeDay.tasksCount} tasks • {activeDay.habitsCount} habit anchors
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
          {/* Completed Tasks on this day */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: TASK_COLOR }}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Finished Tasks ({activeDay.completedTasks.length})</span>
              </span>
              {onNavigateToTasks && (
                <button
                  onClick={onNavigateToTasks}
                  className="text-[11px] font-semibold flex items-center gap-0.5 transition-colors hover:underline"
                  style={{ color: 'var(--accent)' }}
                >
                  <span>Open Tasks</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {activeDay.completedTasks.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed text-center text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                No tasks marked completed on this day.
              </div>
            ) : (
              <div className="space-y-1.5">
                {activeDay.completedTasks.map(task => (
                  <div
                    key={task.id}
                    className="p-2.5 rounded-xl border flex items-start gap-2.5"
                    style={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: TASK_COLOR }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold truncate line-through opacity-85" style={{ color: 'var(--text-primary)' }}>
                          {task.title}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-bold uppercase" style={{ backgroundColor: 'var(--bg-surface-subtle)', color: 'var(--text-muted)' }}>
                          {task.priority}
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-[11px] line-clamp-1 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                          {task.description}
                        </p>
                      )}
                      {task.tags && task.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {task.tags.map(tag => (
                            <span key={tag} className="text-[9px] px-1.5 py-0.2 rounded font-mono" style={{ backgroundColor: 'var(--bg-surface-subtle)', color: 'var(--text-muted)' }}>
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Completed Habits on this day */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: HABIT_COLOR }}>
                <Flame className="w-3.5 h-3.5" />
                <span>Habit Anchors Kept ({activeDay.completedHabits.length})</span>
              </span>
              {onNavigateToHabits && (
                <button
                  onClick={onNavigateToHabits}
                  className="text-[11px] font-semibold flex items-center gap-0.5 transition-colors hover:underline"
                  style={{ color: 'var(--accent)' }}
                >
                  <span>Open Habits</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {activeDay.completedHabits.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed text-center text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                No habit completions recorded on this day.
              </div>
            ) : (
              <div className="space-y-1.5">
                {activeDay.completedHabits.map(habit => (
                  <div
                    key={habit.habitId}
                    className="p-2.5 rounded-xl border flex items-center justify-between gap-3"
                    style={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0"
                        style={{ backgroundColor: `${habit.color}20`, color: habit.color }}
                      >
                        <Flame className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold block truncate" style={{ color: 'var(--text-primary)' }}>
                          {habit.habitName}
                        </span>
                        <span className="text-[10px] capitalize" style={{ color: 'var(--text-muted)' }}>
                          {habit.category}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold font-mono block" style={{ color: HABIT_COLOR }}>
                        {habit.recordedValue} / {habit.targetValue} {habit.targetUnit}
                      </span>
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-600">
                        Completed
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
