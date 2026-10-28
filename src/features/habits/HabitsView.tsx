import React, { useState, useEffect } from 'react';
import {
  Flame,
  Plus,
  Check,
  Trash2,
  Layers,
  ArrowRight,
  Play,
  CheckCircle2,
  Circle,
  Sunrise,
  Moon,
  X,
  Trophy,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../../database/db';
import { useNotifications } from '../../notifications/NotificationContext';
import { Habit, HabitScheduleType, HabitTargetType } from '../../domain/models';
import { calculateHabitStreak, formatLocalDate, addDays } from '../../services/streakService';
import { soundService } from '../../services/soundService';
import { useMotionPreference } from '../../theme/motion';
import { AnimatedCheckbox, EmptyStateMotion } from '../../components/MotionPrimitives';

export const HabitsView: React.FC = () => {
  const { notify, triggerCelebration } = useNotifications();
  const { variants, tactileProps, cardHoverProps } = useMotionPreference();
  const [, setTick] = useState(0);
  const [isCreatingHabit, setIsCreatingHabit] = useState(false);
  const [isCreatingRoutine, setIsCreatingRoutine] = useState(false);

  // Active routine cascade runner state
  const [runningRoutineId, setRunningRoutineId] = useState<string | null>(null);
  const [cascadeStepIndex, setCascadeStepIndex] = useState(0);
  const [routineFinished, setRoutineFinished] = useState(false);

  // New habit form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scheduleType, setScheduleType] = useState<HabitScheduleType>('daily');
  const [targetType, setTargetType] = useState<HabitTargetType>('boolean');
  const [targetValue, setTargetValue] = useState(1);
  const [targetUnit, setTargetUnit] = useState('times');
  const [color] = useState('#C86D51');
  const [restDaySunday, setRestDaySunday] = useState(false);

  // New routine form
  const [routineName, setRoutineName] = useState('');
  const [routineDesc, setRoutineDesc] = useState('');
  const [routineTimeOfDay, setRoutineTimeOfDay] = useState<'morning' | 'afternoon' | 'evening' | 'anytime'>('morning');
  const [routineColor] = useState('#d97706');
  const [selectedHabitIds, setSelectedHabitIds] = useState<string[]>([]);

  useEffect(() => {
    return db.subscribe(() => setTick(t => t + 1));
  }, []);

  const todayStr = formatLocalDate(new Date());
  const habits = db.getHabits().filter(h => !h.archived);
  const occurrences = db.getHabitOccurrences();
  const routines = db.getHabitRoutines();

  // Habit CRUD
  const handleCreateHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const now = new Date().toISOString();
    const newHabit: Habit = {
      id: `h_${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      category: 'personal',
      icon: 'Flame',
      color,
      startDate: todayStr,
      scheduleType,
      targetType,
      targetValue,
      targetUnit,
      restDays: restDaySunday ? [0] : undefined,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };

    db.saveHabit(newHabit);
    notify({ title: 'Habit Anchor Created', message: `Added "${newHabit.name}"`, type: 'habit' });
    setName('');
    setDescription('');
    setIsCreatingHabit(false);
  };

  const recordValue = (habit: Habit, dateStr: string, value: number) => {
    const isDone = value >= habit.targetValue;
    const outcome = db.recordHabitOccurrence({
      id: `occ_${habit.id}_${dateStr}`,
      habitId: habit.id,
      date: dateStr,
      recordedValue: value,
      targetValue: habit.targetValue,
      status: isDone ? 'completed' : 'missed',
      completedAt: isDone ? new Date().toISOString() : undefined,
    });

    if (isDone) {
      soundService.playCompletionChime();
      notify({
        title: 'Habit Recorded',
        message:
          outcome.xpAwarded > 0
            ? `Goal met for "${habit.name}" (+${outcome.xpAwarded} XP)`
            : `Goal met for "${habit.name}"`,
        type: 'habit',
      });
      triggerCelebration();
    }
  };

  const excuseDay = (habit: Habit, dateStr: string) => {
    db.recordHabitOccurrence({
      id: `occ_${habit.id}_${dateStr}`,
      habitId: habit.id,
      date: dateStr,
      recordedValue: 0,
      targetValue: habit.targetValue,
      status: 'skipped',
      note: 'Excused / rest day',
    });
    notify({ title: 'Habit Excused', message: `Day skipped without breaking streak.`, type: 'system' });
  };

  const deleteHabit = (id: string) => {
    db.deleteHabit(id);
    notify({ title: 'Habit Removed', message: 'Habit and history deleted.', type: 'system' });
  };

  // Routine Stack Management
  const handleCreateRoutine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!routineName.trim() || selectedHabitIds.length === 0) return;

    db.createHabitRoutine({
      name: routineName.trim(),
      description: routineDesc.trim(),
      icon: routineTimeOfDay === 'morning' ? 'Sunrise' : routineTimeOfDay === 'evening' ? 'Moon' : 'Sun',
      color: routineColor,
      timeOfDay: routineTimeOfDay,
      habitIds: selectedHabitIds,
    });

    notify({ title: 'Routine Stack Created', message: `Formed "${routineName.trim()}" with ${selectedHabitIds.length} habits`, type: 'habit' });
    setRoutineName('');
    setRoutineDesc('');
    setSelectedHabitIds([]);
    setIsCreatingRoutine(false);
  };

  const startRoutineCascade = (routineId: string) => {
    const routine = routines.find(r => r.id === routineId);
    if (!routine || routine.habitIds.length === 0) return;
    setRunningRoutineId(routineId);
    setCascadeStepIndex(0);
    setRoutineFinished(false);
    notify({ title: 'Routine Stack Started', message: `Beginning "${routine.name}" cascade`, type: 'habit' });
  };

  const completeCurrentCascadeStep = () => {
    if (!runningRoutineId) return;
    const routine = routines.find(r => r.id === runningRoutineId);
    if (!routine) return;

    const currentHabitId = routine.habitIds[cascadeStepIndex];
    const currentHabit = habits.find(h => h.id === currentHabitId);
    if (currentHabit) {
      recordValue(currentHabit, todayStr, currentHabit.targetValue);
    }

    if (cascadeStepIndex < routine.habitIds.length - 1) {
      setCascadeStepIndex(prev => prev + 1);
    } else {
      const outcome = db.recordRoutineCompletion(routine.id, todayStr);
      setRoutineFinished(true);
      triggerCelebration();
      notify({
        title: 'Routine Stack Accomplished!',
        message:
          outcome.xpAwarded > 0
            ? `Completed "${routine.name}" cascade (+${outcome.xpAwarded} XP Bonus)`
            : `Completed "${routine.name}" cascade`,
        type: 'achievement',
      });
    }
  };

  const skipCurrentCascadeStep = () => {
    if (!runningRoutineId) return;
    const routine = routines.find(r => r.id === runningRoutineId);
    if (!routine) return;

    if (cascadeStepIndex < routine.habitIds.length - 1) {
      setCascadeStepIndex(prev => prev + 1);
    } else {
      setRunningRoutineId(null);
    }
  };

  const activeRoutine = runningRoutineId ? routines.find(r => r.id === runningRoutineId) : null;
  const activeRoutineHabits = activeRoutine
    ? activeRoutine.habitIds.map(id => habits.find(h => h.id === id)).filter(Boolean) as Habit[]
    : [];
  const currentCascadeHabit = activeRoutineHabits[cascadeStepIndex];

  // Generate last 7 days window for mini heatmap
  const past7Days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    past7Days.push(addDays(todayStr, -i));
  }

  return (
    <motion.div
      variants={variants.cardListContainer}
      initial="initial"
      animate="animate"
      className="p-6 max-w-5xl mx-auto space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
            <Flame className="w-4 h-4" />
            <span>Habits & Routine Stacking</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">Habit Stacks & Daily Anchors</h1>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Forgiving streak engine and habit routine stacking. Completing one habit prompts the next in a fluid cascade.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <motion.button
            {...tactileProps}
            onClick={() => setIsCreatingRoutine(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border shadow-xs transition-all hover:bg-black/5 cursor-pointer"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >
            <Layers className="w-4 h-4 text-amber-500" />
            <span>New Routine Stack</span>
          </motion.button>
          <motion.button
            {...tactileProps}
            onClick={() => setIsCreatingHabit(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all hover:brightness-105 cursor-pointer"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
          >
            <Plus className="w-4 h-4" />
            <span>New Habit</span>
          </motion.button>
        </div>
      </div>

      {/* ACTIVE ROUTINE CASCADE RUNNER MODAL / HERO */}
      <AnimatePresence initial={false}>
        {activeRoutine && (
          <motion.div
            variants={variants.statusBanner}
            initial="initial"
            animate="animate"
            exit="exit"
            className="p-5 rounded-2xl border shadow-lg space-y-4"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: activeRoutine.color || 'var(--accent)',
              boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl text-white shadow-xs" style={{ backgroundColor: activeRoutine.color || 'var(--accent)' }}>
                  {activeRoutine.timeOfDay === 'morning' ? <Sunrise className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold">{activeRoutine.name}</h2>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                      Step {cascadeStepIndex + 1} of {activeRoutineHabits.length}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {activeRoutine.description}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setRunningRoutineId(null)}
                className="p-1 rounded-lg opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ordered Chain Cascade Tracker */}
            <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border bg-black/5" style={{ borderColor: 'var(--border)' }}>
              {activeRoutineHabits.map((h, idx) => {
                const isPast = idx < cascadeStepIndex;
                const isCurrent = idx === cascadeStepIndex;
                const occ = occurrences.find(o => o.habitId === h.id && o.date === todayStr);
                const isDone = occ && occ.recordedValue >= h.targetValue;

                return (
                  <React.Fragment key={h.id}>
                    <div
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        isCurrent
                          ? 'shadow-sm font-bold scale-105'
                          : isPast || isDone
                          ? 'opacity-80'
                          : 'opacity-40'
                      }`}
                      style={{
                        backgroundColor: isCurrent ? 'var(--accent)' : 'var(--bg-surface)',
                        color: isCurrent ? 'var(--accent-foreground)' : 'var(--text-primary)',
                        borderColor: 'var(--border)',
                      }}
                    >
                      {isDone || isPast ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Circle className="w-3.5 h-3.5" />
                      )}
                      <span>{idx + 1}. {h.name}</span>
                    </div>
                    {idx < activeRoutineHabits.length - 1 && (
                      <ArrowRight className="w-3.5 h-3.5 opacity-30" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Step Action Body or Completion Card */}
            {routineFinished ? (
              <div className="p-6 text-center space-y-3 rounded-xl border bg-emerald-50/50 border-emerald-200">
                <Trophy className="w-10 h-10 text-emerald-600 mx-auto" />
                <h3 className="text-lg font-bold text-emerald-800">Routine Stack Completed!</h3>
                <p className="text-xs text-emerald-700 max-w-md mx-auto">
                  You successfully chained all {activeRoutineHabits.length} habits in sequence. Consistency anchors your peak momentum! (+30 XP Bonus)
                </p>
                <motion.button
                  {...tactileProps}
                  onClick={() => setRunningRoutineId(null)}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-sm cursor-pointer"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  Done
                </motion.button>
              </div>
            ) : currentCascadeHabit ? (
              <div
                className="p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                    Up Next in Cascade:
                  </span>
                  <h3 className="text-lg font-bold mt-0.5">{currentCascadeHabit.name}</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    Target: {currentCascadeHabit.targetValue} {currentCascadeHabit.targetUnit}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={skipCurrentCascadeStep}
                    className="px-3 py-2 rounded-xl border text-xs font-semibold hover:bg-black/5 cursor-pointer"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    Skip Step
                  </button>
                  <motion.button
                    {...tactileProps}
                    onClick={completeCurrentCascadeStep}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md cursor-pointer"
                    style={{ backgroundColor: currentCascadeHabit.color || 'var(--accent)' }}
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {cascadeStepIndex < activeRoutineHabits.length - 1
                        ? 'Complete & Prompt Next'
                        : 'Complete Routine Stack (+30 XP)'}
                    </span>
                  </motion.button>
                </div>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ROUTINE STACKS SECTION */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              Habit Routine Stacks ({routines.length})
            </h2>
          </div>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Sequential habit chains that trigger peak performance
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {routines.map(routine => {
            const routineHabits = routine.habitIds.map(id => habits.find(h => h.id === id)).filter(Boolean) as Habit[];
            const isCompletedToday = routine.lastCompletedDate === todayStr;

            return (
              <motion.div
                key={routine.id}
                variants={variants.cardItem}
                {...cardHoverProps}
                className="tactile-card p-4 rounded-2xl border shadow-xs space-y-3"
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border)',
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-xs shrink-0"
                      style={{ backgroundColor: routine.color }}
                    >
                      {routine.timeOfDay === 'morning' ? <Sunrise className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold">{routine.name}</h3>
                      <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                        {routine.timeOfDay.toUpperCase()} • {routineHabits.length} Habit Chain
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-mono tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    {routine.completionsCount} completions
                  </span>
                </div>

                {/* Habit Cascade Preview */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs pt-1">
                  {routineHabits.map((h, i) => (
                    <React.Fragment key={h.id}>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {h.name}
                      </span>
                      {i < routineHabits.length - 1 && (
                        <span className="font-light px-0.5" style={{ color: 'var(--text-muted)' }}>›</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>

                {/* Action button */}
                <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {isCompletedToday ? '✓ Done today' : 'Ready to start'}
                  </span>

                  <motion.button
                    {...tactileProps}
                    onClick={() => startRoutineCascade(routine.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-xs cursor-pointer"
                    style={{ backgroundColor: routine.color }}
                  >
                    <Play className="w-3 h-3 fill-white" />
                    <span>Start Routine</span>
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Routine Stack Creation Form */}
      <AnimatePresence initial={false}>
        {isCreatingRoutine && (
          <motion.form
            variants={variants.accordion}
            initial="initial"
            animate="animate"
            exit="exit"
            onSubmit={handleCreateRoutine}
            className="overflow-hidden"
          >
            <div
              className="p-5 rounded-2xl border shadow-md space-y-4"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border)',
              }}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Design New Habit Routine Stack</h3>
                <button
                  type="button"
                  onClick={() => setIsCreatingRoutine(false)}
                  className="p-1 rounded-md opacity-60 hover:opacity-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Routine Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={routineName}
                    onChange={e => setRoutineName(e.target.value)}
                    placeholder="e.g. Work Kickoff Ritual"
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Target Time of Day
                  </label>
                  <select
                    value={routineTimeOfDay}
                    onChange={e => setRoutineTimeOfDay(e.target.value as typeof routineTimeOfDay)}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                  >
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="evening">Evening</option>
                    <option value="anytime">Anytime</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Select Ordered Habits to Stack in Sequence (Click to toggle):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {habits.map(h => {
                    const isSelected = selectedHabitIds.includes(h.id);
                    const orderIndex = selectedHabitIds.indexOf(h.id);

                    return (
                      <motion.button
                        {...tactileProps}
                        type="button"
                        key={h.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedHabitIds(prev => prev.filter(id => id !== h.id));
                          } else {
                            setSelectedHabitIds(prev => [...prev, h.id]);
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between text-xs transition-all cursor-pointer ${
                          isSelected ? 'font-bold ring-2 ring-amber-500' : 'opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                      >
                        <span>{h.name}</span>
                        {isSelected && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-amber-500 text-white">
                            #{orderIndex + 1}
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setIsCreatingRoutine(false)}
                  className="px-3 py-1.5 rounded-lg border text-xs cursor-pointer"
                  style={{ borderColor: 'var(--border)' }}
                >
                  Cancel
                </button>
                <motion.button
                  {...tactileProps}
                  type="submit"
                  disabled={selectedHabitIds.length === 0}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold shadow-xs disabled:opacity-40 cursor-pointer"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
                >
                  Create Routine Stack
                </motion.button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Habit Creation Form */}
      <AnimatePresence initial={false}>
        {isCreatingHabit && (
          <motion.form
            variants={variants.accordion}
            initial="initial"
            animate="animate"
            exit="exit"
            onSubmit={handleCreateHabit}
            className="overflow-hidden"
          >
            <div
              className="p-5 rounded-2xl border shadow-md space-y-4"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border)',
              }}
            >
              <h3 className="text-sm font-bold">Configure New Habit Anchor</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Habit Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Read Physical Book"
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Schedule Type
                  </label>
                  <select
                    value={scheduleType}
                    onChange={e => setScheduleType(e.target.value as HabitScheduleType)}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                  >
                    <option value="daily">Every Day</option>
                    <option value="weekdays">Weekdays Only (Mon-Fri)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Target Type
                  </label>
                  <select
                    value={targetType}
                    onChange={e => {
                      const val = e.target.value as HabitTargetType;
                      setTargetType(val);
                      if (val === 'boolean') {
                        setTargetValue(1);
                        setTargetUnit('done');
                      } else if (val === 'duration') {
                        setTargetValue(30);
                        setTargetUnit('mins');
                      } else {
                        setTargetValue(10);
                        setTargetUnit('pages');
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                  >
                    <option value="boolean">Yes / No (Boolean)</option>
                    <option value="numeric">Numeric Value</option>
                    <option value="duration">Duration (Minutes)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Target Amount
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={targetValue}
                    onChange={e => setTargetValue(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Unit Label
                  </label>
                  <input
                    type="text"
                    value={targetUnit}
                    onChange={e => setTargetUnit(e.target.value)}
                    placeholder="pages, mins, glasses..."
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <AnimatedCheckbox
                  checked={restDaySunday}
                  onChange={() => setRestDaySunday(!restDaySunday)}
                  label="Sunday is a planned rest day"
                />
                <span
                  onClick={() => setRestDaySunday(!restDaySunday)}
                  className="text-xs cursor-pointer select-none"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Sunday is a planned rest day (will never break streak)
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setIsCreatingHabit(false)}
                  className="px-3 py-1.5 rounded-lg border text-xs cursor-pointer"
                  style={{ borderColor: 'var(--border)' }}
                >
                  Cancel
                </button>
                <motion.button
                  {...tactileProps}
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
                >
                  Save Habit
                </motion.button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Habit Cards */}
      <div className="space-y-4">
        {habits.length === 0 ? (
          <EmptyStateMotion className="p-12 text-center text-xs border rounded-2xl">
            <span style={{ color: 'var(--text-muted)' }}>
              No habits configured yet. Create one to start building your streak!
            </span>
          </EmptyStateMotion>
        ) : (
          habits.map(habit => {
            const stats = calculateHabitStreak(habit, occurrences, todayStr);
            const todayOcc = occurrences.find(o => o.habitId === habit.id && o.date === todayStr);
            const isTodayDone = Boolean(todayOcc && todayOcc.recordedValue >= habit.targetValue);
            const isTodaySkipped = todayOcc?.status === 'skipped';

            return (
              <motion.div
                key={habit.id}
                variants={variants.cardItem}
                {...cardHoverProps}
                className="tactile-card p-5 rounded-2xl border shadow-sm space-y-4"
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border)',
                  boxShadow: 'var(--card-shadow)',
                }}
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs shrink-0"
                      style={{ backgroundColor: habit.color || 'var(--accent)' }}
                    >
                      <Flame className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                        {habit.name}
                      </h3>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        Target: {habit.targetValue} {habit.targetUnit} • Schedule: {habit.scheduleType}
                      </p>
                    </div>
                  </div>

                  {/* Streak Stats */}
                  <div className="flex items-center gap-3 text-xs self-start sm:self-auto">
                    <div className="flex items-center gap-1.5 font-semibold" style={{ color: 'var(--text-primary)' }}>
                      <Flame className="w-4 h-4 text-amber-500 fill-amber-500/20" />
                      <span className="font-mono font-bold text-sm tabular-nums">{stats.currentStreak}</span>
                      <span className="font-normal text-xs" style={{ color: 'var(--text-secondary)' }}>day streak</span>
                    </div>
                    <span style={{ color: 'var(--text-muted)' }}>·</span>
                    <div className="text-[11px] font-mono tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      Best {stats.longestStreak}d · 30d {stats.completionRate30d}%
                    </div>
                    <button
                      onClick={() => deleteHabit(habit.id)}
                      title="Delete habit"
                      className="p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 text-stone-400 hover:text-red-500 transition-colors ml-1 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 7-Day Mini Heatmap */}
                <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="text-[11px] font-semibold mb-2 flex items-center justify-between" style={{ color: 'var(--text-muted)' }}>
                    <span>Past 7 Days History</span>
                    <span>Click day to toggle or excuse</span>
                  </div>

                  <div className="grid grid-cols-7 gap-2">
                    {past7Days.map(dateStr => {
                      const occ = occurrences.find(o => o.habitId === habit.id && o.date === dateStr);
                      const isComplete = occ && occ.recordedValue >= habit.targetValue;
                      const isSkipped = occ?.status === 'skipped';
                      const isToday = dateStr === todayStr;

                      return (
                        <div
                          key={dateStr}
                          className="flex flex-col items-center p-2 rounded-xl border text-center transition-all"
                          style={{
                            backgroundColor: isComplete
                              ? 'var(--success-subtle)'
                              : isSkipped
                              ? 'var(--bg-surface-subtle)'
                              : 'var(--bg-surface)',
                            borderColor: isToday
                              ? 'var(--accent)'
                              : isComplete
                              ? 'var(--success)'
                              : 'var(--border)',
                          }}
                        >
                          <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
                            {new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'narrow' })}
                          </span>
                          <span className="text-xs font-semibold my-1 tabular-nums" style={{ color: 'var(--text-primary)' }}>
                            {dateStr.split('-')[2]}
                          </span>

                          <div className="mt-1 flex gap-1">
                            {isComplete ? (
                              <Check className="w-4 h-4 text-emerald-600" />
                            ) : isSkipped ? (
                              <span className="text-[10px] font-bold text-amber-600">Rest</span>
                            ) : (
                              <button
                                onClick={() => recordValue(habit, dateStr, habit.targetValue)}
                                className="w-5 h-5 rounded border flex items-center justify-center hover:bg-emerald-500/10 text-stone-400 hover:text-emerald-600 cursor-pointer"
                                style={{ borderColor: 'var(--border)' }}
                                title="Mark Completed"
                              >
                                +
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Today's Action Bar */}
                <div className="flex items-center justify-between pt-2">
                  <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    Today's status:{' '}
                    <span className="font-bold">
                      {isTodayDone ? 'Completed' : isTodaySkipped ? 'Excused / Rest Day' : 'Pending'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <motion.button
                      {...tactileProps}
                      onClick={() => excuseDay(habit, todayStr)}
                      className="px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-black/5 cursor-pointer"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                    >
                      Excuse Today
                    </motion.button>

                    <motion.button
                      {...tactileProps}
                      onClick={() => recordValue(habit, todayStr, isTodayDone ? 0 : habit.targetValue)}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                      style={{
                        backgroundColor: isTodayDone ? 'var(--bg-surface-subtle)' : 'var(--accent)',
                        color: isTodayDone ? 'var(--text-primary)' : 'var(--accent-foreground)',
                      }}
                    >
                      {isTodayDone ? 'Mark Incomplete' : 'Complete Today'}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
};
