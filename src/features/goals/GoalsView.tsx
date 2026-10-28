import React, { useState, useEffect, useMemo } from 'react';
import {
  Target,
  Plus,
  CheckCircle2,
  Calendar,
  Trash2,
  ChevronDown,
  ChevronRight,
  PauseCircle,
  PlayCircle,
  Archive,
  RotateCcw,
  Edit2,
  Folder,
  Flame,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../../database/db';
import { useNotifications } from '../../notifications/NotificationContext';
import { Goal } from '../../domain/models';
import { formatLocalDate } from '../../services/streakService';
import {
  calculateGoalProgress,
  formatCompletionDateDisplay,
  partitionGoalsByStatus,
  resolveGoalCompletionDate,
  validateGoalEditFields,
} from '../../services/goalProgressService';
import { useMotionPreference } from '../../theme/motion';
import { GoalProgressControl } from './GoalProgressControl';
import { navigationManager } from '../../components/navigationState';

export const GoalsView: React.FC = () => {
  const { notify, triggerCelebration } = useNotifications();
  const { variants } = useMotionPreference();
  const [allGoals, setAllGoals] = useState<Goal[]>(() => db.getGoals());
  const [xpLedger, setXpLedger] = useState(() => db.getXpLedger());
  const [projects, setProjects] = useState(() => db.getProjects());
  const [habits, setHabits] = useState(() => db.getHabits());
  const [isCreating, setIsCreating] = useState(false);

  // Edit goal state
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editTargetDate, setEditTargetDate] = useState('');
  const [editIsMeasurable, setEditIsMeasurable] = useState(true);
  const [editTargetValue, setEditTargetValue] = useState<string>('30');
  const [editCurrentValue, setEditCurrentValue] = useState<string>('0');
  const [editUnit, setEditUnit] = useState('days');
  const [editError, setEditError] = useState<string | null>(null);

  // Create form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Personal Growth');
  const [targetDate, setTargetDate] = useState('');
  const [isMeasurable, setIsMeasurable] = useState(true);
  const [targetValue, setTargetValue] = useState<string>('30');
  const [unit, setUnit] = useState('days');
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    const syncFromDb = () => {
      setAllGoals(db.getGoals());
      setXpLedger(db.getXpLedger());
      setProjects(db.getProjects());
      setHabits(db.getHabits());
    };
    syncFromDb();
    return db.subscribe(syncFromDb);
  }, []);

  const { activeGoals, pausedGoals, completedGoals, archivedGoals } = useMemo(
    () => partitionGoalsByStatus(allGoals, xpLedger),
    [allGoals, xpLedger]
  );

  // Collapsible section states (default to open when <= 5 items, preserving user toggles thereafter)
  const [isCompletedOpen, setIsCompletedOpen] = useState<boolean>(() => completedGoals.length <= 5);
  const [isArchivedOpen, setIsArchivedOpen] = useState<boolean>(() => archivedGoals.length <= 5);

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateGoalEditFields({
      title,
      isMeasurable,
      targetValue,
      currentValue: 0,
      unit,
    });

    if (!validation.valid) {
      setCreateError(validation.error || 'Please check the goal fields.');
      return;
    }

    setCreateError(null);
    const now = new Date().toISOString();
    const newGoal: Goal = {
      id: `g_${Date.now()}`,
      title: validation.sanitizedTitle,
      description: description.trim(),
      category: category.trim() || 'Personal Growth',
      color: '#3E7051',
      startDate: formatLocalDate(new Date()),
      targetDate: targetDate || formatLocalDate(new Date()),
      status: 'active',
      isMeasurable,
      targetValue: validation.sanitizedTargetValue,
      currentValue: isMeasurable ? 0 : undefined,
      unit: validation.sanitizedUnit,
      linkedProjectIds: [],
      linkedHabitIds: [],
      milestones: [],
      createdAt: now,
      updatedAt: now,
    };

    db.saveGoal(newGoal);
    notify({ title: 'Goal Established', message: `Added "${newGoal.title}"`, type: 'system' });
    setTitle('');
    setDescription('');
    setTargetValue('30');
    setUnit('days');
    setIsCreating(false);
  };

  const startEditingGoal = (goal: Goal, forceMeasurable?: boolean) => {
    const latestGoal = db.getGoals().find(g => g.id === goal.id) ?? goal;
    const nextMeasurable = forceMeasurable !== undefined ? forceMeasurable : latestGoal.isMeasurable;
    const safeTarget =
      typeof latestGoal.targetValue === 'number' &&
      Number.isFinite(latestGoal.targetValue) &&
      latestGoal.targetValue > 0
        ? latestGoal.targetValue
        : 30;
    const safeCurrent =
      typeof latestGoal.currentValue === 'number' &&
      Number.isFinite(latestGoal.currentValue) &&
      latestGoal.currentValue >= 0
        ? latestGoal.currentValue
        : 0;

    setEditingGoalId(latestGoal.id);
    setEditTitle(latestGoal.title);
    setEditDescription(latestGoal.description || '');
    setEditCategory(latestGoal.category || 'Personal Growth');
    setEditTargetDate(latestGoal.targetDate || '');
    setEditIsMeasurable(nextMeasurable);
    setEditTargetValue(String(safeTarget));
    setEditCurrentValue(String(safeCurrent));
    setEditUnit(latestGoal.unit && latestGoal.unit.trim().length > 0 ? latestGoal.unit : 'days');
    setEditError(null);
  };

  const cancelEditingGoal = () => {
    setEditingGoalId(null);
    setEditError(null);
  };

  const handleSaveEdit = (e: React.FormEvent, goal: Goal) => {
    e.preventDefault();
    const validation = validateGoalEditFields({
      title: editTitle,
      isMeasurable: editIsMeasurable,
      targetValue: editTargetValue,
      currentValue: editCurrentValue,
      unit: editUnit,
    });

    if (!validation.valid) {
      setEditError(validation.error || 'Please check the goal fields.');
      return;
    }

    setEditError(null);
    const latestGoal = db.getGoals().find(g => g.id === goal.id) ?? goal;
    const wasAchieved = latestGoal.status === 'achieved';

    const outcome = db.saveGoal({
      ...latestGoal,
      title: validation.sanitizedTitle,
      description: editDescription.trim(),
      category: editCategory.trim() || 'Personal Growth',
      targetDate: editTargetDate || latestGoal.targetDate,
      isMeasurable: editIsMeasurable,
      currentValue: validation.sanitizedCurrentValue,
      targetValue: validation.sanitizedTargetValue,
      unit: validation.sanitizedUnit,
    });

    const updatedGoal = db.getGoals().find(g => g.id === goal.id);
    if (updatedGoal?.status === 'achieved' && !wasAchieved) {
      notify({
        title: 'Goal Achieved!',
        message:
          outcome.xpAwarded > 0
            ? `Completed "${updatedGoal.title}" (+${outcome.xpAwarded} XP)`
            : `Completed "${updatedGoal.title}"`,
        type: 'achievement',
      });
      triggerCelebration();
    } else {
      notify({
        title: 'Goal Updated',
        message: `Saved changes to "${validation.sanitizedTitle}"`,
        type: 'system',
      });
    }

    setEditingGoalId(null);
  };

  const markGoalAchieved = (goal: Goal) => {
    const latestGoal = db.getGoals().find(g => g.id === goal.id) ?? goal;
    if (latestGoal.status === 'achieved') return;
    const hasPositiveTarget =
      latestGoal.isMeasurable &&
      typeof latestGoal.targetValue === 'number' &&
      Number.isFinite(latestGoal.targetValue) &&
      latestGoal.targetValue > 0;

    const outcome = db.saveGoal({
      ...latestGoal,
      status: 'achieved',
      currentValue: hasPositiveTarget
        ? Math.max(latestGoal.currentValue || 0, latestGoal.targetValue!)
        : latestGoal.currentValue,
    });

    notify({
      title: 'Goal Achieved!',
      message:
        outcome.xpAwarded > 0
          ? `Completed "${latestGoal.title}" (+${outcome.xpAwarded} XP)`
          : `Completed "${latestGoal.title}"`,
      type: 'achievement',
    });
    triggerCelebration();
  };

  const reopenGoal = (goal: Goal) => {
    const latestGoal = db.getGoals().find(g => g.id === goal.id) ?? goal;
    if (latestGoal.status === 'active') return;
    db.saveGoal({
      ...latestGoal,
      status: 'active',
    });
    notify({
      title: 'Goal Reopened',
      message: `"${latestGoal.title}" returned to active goals.`,
      type: 'system',
    });
  };

  const togglePauseGoal = (goal: Goal) => {
    const latestGoal = db.getGoals().find(g => g.id === goal.id) ?? goal;
    const nextStatus: Goal['status'] = latestGoal.status === 'paused' ? 'active' : 'paused';
    db.saveGoal({
      ...latestGoal,
      status: nextStatus,
    });
    notify({
      title: nextStatus === 'paused' ? 'Goal Paused' : 'Goal Resumed',
      message:
        nextStatus === 'paused'
          ? `"${latestGoal.title}" moved to paused goals.`
          : `"${latestGoal.title}" is active again.`,
      type: 'system',
    });
  };

  const archiveGoal = (goal: Goal) => {
    const latestGoal = db.getGoals().find(g => g.id === goal.id) ?? goal;
    if (latestGoal.status === 'archived') return;
    db.saveGoal({
      ...latestGoal,
      status: 'archived',
    });
    notify({
      title: 'Goal Archived',
      message: `"${latestGoal.title}" moved to archive.`,
      type: 'system',
    });
  };

  const restoreArchivedGoal = (goal: Goal) => {
    const latestGoal = db.getGoals().find(g => g.id === goal.id) ?? goal;
    if (latestGoal.status !== 'archived') return;
    db.saveGoal({
      ...latestGoal,
      status: 'active',
    });
    notify({
      title: 'Goal Restored',
      message: `"${latestGoal.title}" restored to active goals.`,
      type: 'system',
    });
  };

  const deleteGoal = (id: string) => {
    db.deleteGoal(id);
    notify({ title: 'Goal Deleted', message: 'Goal removed.', type: 'system' });
  };

  const renderLinkedSummary = (goal: Goal) => {
    const linkedProjects = projects.filter(p => goal.linkedProjectIds?.includes(p.id));
    const linkedHabits = habits.filter(h => goal.linkedHabitIds?.includes(h.id));
    if (linkedProjects.length === 0 && linkedHabits.length === 0) return null;

    return (
      <div className="flex flex-wrap items-center gap-2 pt-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
        {linkedProjects.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => navigationManager.setView('projects')}
            title={`Jump to Project: ${p.name}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border transition-colors hover:bg-black/5 cursor-pointer"
            style={{
              borderColor: 'var(--border)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-primary)',
            }}
          >
            <Folder className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
            <span>{p.name} ↗</span>
          </button>
        ))}
        {linkedHabits.map(h => (
          <button
            key={h.id}
            type="button"
            onClick={() => navigationManager.setView('habits')}
            title={`Jump to Habit: ${h.name}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border transition-colors hover:bg-black/5 cursor-pointer"
            style={{
              borderColor: 'var(--border)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-primary)',
            }}
          >
            <Flame className="w-3.5 h-3.5 text-amber-600" />
            <span>{h.name} ↗</span>
          </button>
        ))}
      </div>
    );
  };

  const renderEditForm = (goal: Goal) => (
    <form onSubmit={e => handleSaveEdit(e, goal)} aria-label={`Edit ${goal.title}`} className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
          Edit Goal Details & Target
        </span>
      </div>

      {editError && (
        <div
          role="alert"
          className="px-3 py-2 rounded-lg text-xs font-medium border"
          style={{
            backgroundColor: 'rgba(220, 38, 38, 0.08)',
            borderColor: 'rgba(220, 38, 38, 0.3)',
            color: '#dc2626',
          }}
        >
          {editError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label
            htmlFor={`edit-title-${goal.id}`}
            className="block text-xs font-semibold mb-1"
            style={{ color: 'var(--text-secondary)' }}
          >
            Goal Title *
          </label>
          <input
            id={`edit-title-${goal.id}`}
            type="text"
            required
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg border text-sm"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
          />
        </div>
        <div>
          <label
            htmlFor={`edit-category-${goal.id}`}
            className="block text-xs font-semibold mb-1"
            style={{ color: 'var(--text-secondary)' }}
          >
            Category
          </label>
          <input
            id={`edit-category-${goal.id}`}
            type="text"
            value={editCategory}
            onChange={e => setEditCategory(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg border text-sm"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label
            htmlFor={`edit-desc-${goal.id}`}
            className="block text-xs font-semibold mb-1"
            style={{ color: 'var(--text-secondary)' }}
          >
            Why It Matters / Description
          </label>
          <input
            id={`edit-desc-${goal.id}`}
            type="text"
            value={editDescription}
            onChange={e => setEditDescription(e.target.value)}
            placeholder="Motivation or outcome for this goal..."
            className="w-full px-3 py-1.5 rounded-lg border text-sm"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
          />
        </div>
        <div>
          <label
            htmlFor={`edit-date-${goal.id}`}
            className="block text-xs font-semibold mb-1"
            style={{ color: 'var(--text-secondary)' }}
          >
            Target Date
          </label>
          <input
            id={`edit-date-${goal.id}`}
            type="date"
            value={editTargetDate}
            onChange={e => setEditTargetDate(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg border text-sm"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <input
          type="checkbox"
          id={`edit-measurable-${goal.id}`}
          checked={editIsMeasurable}
          onChange={e => setEditIsMeasurable(e.target.checked)}
          className="rounded cursor-pointer"
        />
        <label
          htmlFor={`edit-measurable-${goal.id}`}
          className="text-xs font-semibold cursor-pointer"
          style={{ color: 'var(--text-secondary)' }}
        >
          Measurable target with numerical progress (e.g. 30 days, 50 hours)
        </label>
      </div>

      {editIsMeasurable && (
        <div
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl border"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface-subtle)' }}
        >
          <div>
            <label
              htmlFor={`edit-current-${goal.id}`}
              className="block text-xs font-semibold mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              Current Progress
            </label>
            <input
              id={`edit-current-${goal.id}`}
              type="number"
              min={0}
              step="any"
              value={editCurrentValue}
              onChange={e => setEditCurrentValue(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border text-sm"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
            />
          </div>
          <div>
            <label
              htmlFor={`edit-target-${goal.id}`}
              className="block text-xs font-semibold mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              Target Value *
            </label>
            <input
              id={`edit-target-${goal.id}`}
              type="number"
              min={0.01}
              step="any"
              required
              value={editTargetValue}
              onChange={e => setEditTargetValue(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border text-sm"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
            />
          </div>
          <div>
            <label
              htmlFor={`edit-unit-${goal.id}`}
              className="block text-xs font-semibold mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              Unit
            </label>
            <input
              id={`edit-unit-${goal.id}`}
              type="text"
              value={editUnit}
              onChange={e => setEditUnit(e.target.value)}
              placeholder="days, hours, books..."
              className="w-full px-3 py-1.5 rounded-lg border text-sm"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
            />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
        <button
          type="button"
          onClick={cancelEditingGoal}
          className="px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-black/5 cursor-pointer"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
        >
          Save Changes
        </button>
      </div>
    </form>
  );

  const renderGoalCard = (goal: Goal) => {
    const progress = calculateGoalProgress(goal);
    const isEditing = editingGoalId === goal.id;

    return (
      <motion.div
        key={goal.id}
        variants={variants.cardItem}
        initial="initial"
        animate="animate"
        layout
        className="p-5 rounded-2xl border shadow-sm space-y-4"
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        {isEditing ? (
          renderEditForm(goal)
        ) : (
          <>
            {/* Card Header & Consistent Non-Wrapping Action Row */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span className="font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                    {goal.category}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{progress.stateLabel}</span>
                  {goal.targetDate && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        <span>Target: {goal.targetDate}</span>
                      </span>
                    </>
                  )}
                </div>

                <h3 className="text-base font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
                  {goal.title}
                </h3>

                {goal.description && (
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {goal.description}
                  </p>
                )}

                {renderLinkedSummary(goal)}
              </div>

              <div
                role="toolbar"
                aria-label={`Actions for ${goal.title}`}
                className="flex items-center gap-1.5 shrink-0 flex-nowrap whitespace-nowrap self-start max-w-full overflow-x-auto"
              >
                {goal.status === 'active' && (
                  <button
                    type="button"
                    onClick={() => markGoalAchieved(goal)}
                    title="Mark goal achieved"
                    aria-label={`Mark ${goal.title} achieved`}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
                    <span>Mark Achieved</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => startEditingGoal(goal)}
                  title="Edit goal"
                  aria-label={`Edit ${goal.title}`}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  <Edit2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Edit</span>
                </button>

                <button
                  type="button"
                  onClick={() => togglePauseGoal(goal)}
                  title={goal.status === 'paused' ? 'Resume goal' : 'Pause goal'}
                  aria-label={goal.status === 'paused' ? `Resume ${goal.title}` : `Pause ${goal.title}`}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  {goal.status === 'paused' ? (
                    <>
                      <PlayCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Resume</span>
                    </>
                  ) : (
                    <>
                      <PauseCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Pause</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => archiveGoal(goal)}
                  title="Archive goal"
                  aria-label={`Archive ${goal.title}`}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  <Archive className="w-3.5 h-3.5 shrink-0" />
                  <span>Archive</span>
                </button>

                <button
                  type="button"
                  onClick={() => deleteGoal(goal.id)}
                  title="Delete goal"
                  aria-label={`Delete ${goal.title}`}
                  className="p-1.5 rounded-lg border text-stone-400 hover:text-red-500 transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                </button>
              </div>
            </div>

            {/* Clear Current Progress Display (e.g., '12 / 30 days') & Progress Bar */}
            <div>
              <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
                  {goal.isMeasurable ? (
                    <>
                      <span
                        className="text-sm font-bold tabular-nums tracking-tight"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {progress.valuePairLabel}
                      </span>
                      <span aria-hidden="true" className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        ·
                      </span>
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {progress.hasValidTarget ? progress.stateLabel : 'Target not set'}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      Milestone status · {progress.stateLabel}
                    </span>
                  )}
                </div>
                <span
                  className="text-xs font-bold tabular-nums shrink-0"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {progress.visualPercent}%
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={`${goal.title} progress`}
                aria-valuenow={progress.visualPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                className="w-full h-2 rounded-full overflow-hidden"
                style={{ backgroundColor: 'var(--bg-surface-subtle)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{
                    width: `${progress.visualPercent}%`,
                    backgroundColor: goal.color || 'var(--accent)',
                  }}
                />
              </div>
            </div>

            {/* Visible Progress Control Component (-1, +1, +5 & Small Numeric Input Field) */}
            <GoalProgressControl
              goal={goal}
              onGoalAchieved={(achievedGoal, xpAwarded) => {
                notify({
                  title: 'Goal Achieved!',
                  message:
                    xpAwarded > 0
                      ? `Completed "${achievedGoal.title}" (+${xpAwarded} XP)`
                      : `Completed "${achievedGoal.title}"`,
                  type: 'achievement',
                });
                triggerCelebration();
              }}
              onMarkAchieved={markGoalAchieved}
              onConfigureTarget={g => startEditingGoal(g, true)}
              onInvalidInput={message =>
                notify({
                  title: 'Invalid Progress Value',
                  message,
                  type: 'system',
                })
              }
            />
          </>
        )}
      </motion.div>
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
            <Target className="w-4 h-4" />
            <span>Vision & Objectives</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">Goals & Milestones</h1>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Qualitative and measurable long-term targets connected to daily habits and active projects.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all hover:brightness-105 active:scale-98 self-start sm:self-auto cursor-pointer"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
        >
          <Plus className="w-4 h-4" />
          <span>New Goal</span>
        </button>
      </div>

      {/* Creation Form */}
      {isCreating && (
        <form
          onSubmit={handleCreateGoal}
          className="p-5 rounded-2xl border shadow-md space-y-4 animate-in fade-in"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border)',
          }}
        >
          <h2 className="text-sm font-bold">Set Strategic Goal</h2>
          {createError && (
            <div
              role="alert"
              className="px-3 py-2 rounded-lg text-xs font-medium border"
              style={{
                backgroundColor: 'rgba(220, 38, 38, 0.08)',
                borderColor: 'rgba(220, 38, 38, 0.3)',
                color: '#dc2626',
              }}
            >
              {createError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                Goal Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Master Offline First Architecture"
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                Target Completion Date
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                Category
              </label>
              <input
                type="text"
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="Personal Growth, Craft, Health..."
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Why this goal matters..."
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is-measurable"
              checked={isMeasurable}
              onChange={e => setIsMeasurable(e.target.checked)}
              className="rounded cursor-pointer"
            />
            <label htmlFor="is-measurable" className="text-xs font-semibold cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
              Measurable target with numerical metric (e.g. 30 days, 50 hours)
            </label>
          </div>

          {isMeasurable && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface-subtle)' }}>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Target Value *
                </label>
                <input
                  type="number"
                  min={0.01}
                  step="any"
                  required
                  value={targetValue}
                  onChange={e => setTargetValue(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Unit
                </label>
                <input
                  type="text"
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  placeholder="days, hours, books..."
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setCreateError(null);
              }}
              className="px-3 py-1.5 rounded-lg border text-xs cursor-pointer"
              style={{ borderColor: 'var(--border)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
            >
              Save Goal
            </button>
          </div>
        </form>
      )}

      {/* Active Goals Section */}
      <section aria-labelledby="active-goals-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="active-goals-heading" className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              Active Goals ({activeGoals.length})
            </h2>
          </div>
        </div>

        {activeGoals.length === 0 ? (
          <div className="p-8 text-center text-xs border rounded-2xl" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            No active goals right now. Create a new goal or review your completed milestones below.
          </div>
        ) : (
          <motion.div variants={variants.cardListContainer} initial="initial" animate="animate" className="space-y-4">
            {activeGoals.map(goal => renderGoalCard(goal))}
          </motion.div>
        )}
      </section>

      {/* Paused Goals Section */}
      {pausedGoals.length > 0 && (
        <section aria-labelledby="paused-goals-heading" className="space-y-4 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <h2 id="paused-goals-heading" className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            Paused Goals ({pausedGoals.length})
          </h2>
          <div className="space-y-4">
            {pausedGoals.map(goal => renderGoalCard(goal))}
          </div>
        </section>
      )}

      {/* Completed Goals Section */}
      <section aria-labelledby="completed-goals-heading" className="pt-4 border-t space-y-4" style={{ borderColor: 'var(--border)' }}>
        <button
          type="button"
          aria-expanded={isCompletedOpen}
          aria-controls="completed-goals-panel"
          onClick={() => setIsCompletedOpen(prev => !prev)}
          className="w-full flex items-center justify-between text-left py-2 rounded-xl transition-colors hover:bg-black/5 px-2 -mx-2 cursor-pointer"
        >
          <div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <h2 id="completed-goals-heading" className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                Completed Goals
              </h2>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                · {completedGoals.length}
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Your progress, preserved.
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            <span>{isCompletedOpen ? 'Hide' : 'Show'}</span>
            {isCompletedOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </button>

        <AnimatePresence initial={false}>
          {isCompletedOpen && (
            <motion.div
              id="completed-goals-panel"
              key="completed-goals-panel"
              variants={variants.accordion}
              initial="initial"
              animate="animate"
              exit="exit"
              className="space-y-3"
            >
              {completedGoals.length === 0 ? (
                <p className="text-xs py-3 px-1" style={{ color: 'var(--text-muted)' }}>
                  Completed goals will appear here when you reach your milestones.
                </p>
              ) : (
                completedGoals.map(goal => {
                  const progress = calculateGoalProgress(goal);
                  const resolvedDate = resolveGoalCompletionDate(goal, xpLedger);
                  const formattedCompletionDate = formatCompletionDateDisplay(resolvedDate);
                  const isEditing = editingGoalId === goal.id;

                  return (
                    <div
                      key={goal.id}
                      className="p-5 rounded-2xl border space-y-3 transition-colors"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border)',
                      }}
                    >
                      {isEditing ? (
                        renderEditForm(goal)
                      ) : (
                        <>
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                <span className="font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                                  {goal.category}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--accent)' }}>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Completed</span>
                                </span>
                                {formattedCompletionDate && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span>Completion date: {formattedCompletionDate}</span>
                                  </>
                                )}
                              </div>

                              <h3 className="text-base font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
                                {goal.title}
                              </h3>

                              {goal.description && (
                                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                                  {goal.description}
                                </p>
                              )}

                              {renderLinkedSummary(goal)}
                            </div>

                            <div
                              role="toolbar"
                              aria-label={`Actions for ${goal.title}`}
                              className="flex items-center gap-1.5 shrink-0 flex-nowrap whitespace-nowrap self-start max-w-full overflow-x-auto"
                            >
                              <button
                                type="button"
                                onClick={() => reopenGoal(goal)}
                                aria-label={`Reopen ${goal.title}`}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer"
                                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                              >
                                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                                <span>Reopen</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => startEditingGoal(goal)}
                                title="Edit completed goal"
                                aria-label={`Edit ${goal.title}`}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer"
                                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                              >
                                <Edit2 className="w-3.5 h-3.5 shrink-0" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => archiveGoal(goal)}
                                title="Archive completed goal"
                                aria-label={`Archive ${goal.title}`}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer"
                                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                              >
                                <Archive className="w-3.5 h-3.5 shrink-0" />
                                <span>Archive</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteGoal(goal.id)}
                                title="Delete goal"
                                aria-label={`Delete ${goal.title}`}
                                className="p-1.5 rounded-lg border text-stone-400 hover:text-red-500 transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer"
                                style={{ borderColor: 'var(--border)' }}
                              >
                                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                              </button>
                            </div>
                          </div>

                          {/* Completed Progress Bar (visually capped at 100%) */}
                          <div>
                            <div className="flex items-baseline justify-between gap-3 mb-1.5">
                              <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
                                {goal.isMeasurable ? (
                                  <>
                                    <span
                                      className="text-sm font-bold tabular-nums tracking-tight"
                                      style={{ color: 'var(--text-primary)' }}
                                    >
                                      {progress.valuePairLabel}
                                    </span>
                                    <span aria-hidden="true" className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                      ·
                                    </span>
                                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                                      {progress.stateLabel}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                    Completed
                                  </span>
                                )}
                              </div>
                              <span
                                className="text-xs font-bold tabular-nums shrink-0"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                {progress.visualPercent}%
                              </span>
                            </div>
                            <div
                              role="progressbar"
                              aria-label={`${goal.title} completed progress`}
                              aria-valuenow={progress.visualPercent}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              className="w-full h-2 rounded-full overflow-hidden"
                              style={{ backgroundColor: 'var(--bg-surface-subtle)' }}
                            >
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${progress.visualPercent}%`,
                                  backgroundColor: 'var(--accent)',
                                }}
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Archived Goals Section (separate from Active and Completed) */}
      {archivedGoals.length > 0 && (
        <section aria-labelledby="archived-goals-heading" className="pt-4 border-t space-y-3" style={{ borderColor: 'var(--border)' }}>
          <button
            type="button"
            aria-expanded={isArchivedOpen}
            aria-controls="archived-goals-panel"
            onClick={() => setIsArchivedOpen(prev => !prev)}
            className="w-full flex items-center justify-between text-left py-1.5 rounded-xl transition-colors hover:bg-black/5 px-2 -mx-2 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <h2 id="archived-goals-heading" className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                Archived Goals · {archivedGoals.length}
              </h2>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              <span>{isArchivedOpen ? 'Hide' : 'Show'}</span>
              {isArchivedOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </div>
          </button>

          {isArchivedOpen && (
            <div id="archived-goals-panel" className="space-y-3">
              {archivedGoals.map(goal => (
                <div
                  key={goal.id}
                  className="p-4 rounded-xl border flex items-center justify-between gap-3"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                >
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {goal.title}
                    </h3>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {goal.category} · Archived
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => restoreArchivedGoal(goal)}
                      className="px-2.5 py-1 rounded-lg border text-xs font-semibold hover:bg-black/5 cursor-pointer"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteGoal(goal.id)}
                      title="Delete archived goal"
                      className="p-1 text-stone-400 hover:text-red-500 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
