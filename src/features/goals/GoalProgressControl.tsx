import React, { useState, useEffect } from 'react';
import { CheckCircle2, Edit2, SlidersHorizontal } from 'lucide-react';
import { Goal } from '../../domain/models';
import { db } from '../../database/db';
import {
  applyGoalProgressDelta,
  calculateGoalProgress,
  parseDirectGoalProgressInput,
} from '../../services/goalProgressService';

export interface GoalProgressControlProps {
  goal: Goal;
  onGoalAchieved?: (goal: Goal, xpAwarded: number) => void;
  onMarkAchieved?: (goal: Goal) => void;
  onConfigureTarget?: (goal: Goal) => void;
  onInvalidInput?: (message: string) => void;
}

export const GoalProgressControl: React.FC<GoalProgressControlProps> = ({
  goal,
  onGoalAchieved,
  onMarkAchieved,
  onConfigureTarget,
  onInvalidInput,
}) => {
  const progress = calculateGoalProgress(goal);
  const unitLabel = goal.unit && goal.unit.trim().length > 0 ? goal.unit.trim() : 'units';
  const [inputValue, setInputValue] = useState<string>(() => String(progress.safeCurrentValue));

  // Keep the numeric input field synchronized whenever persisted goal progress changes
  useEffect(() => {
    setInputValue(String(progress.safeCurrentValue));
  }, [goal.id, progress.safeCurrentValue]);

  const commitProgressValue = (nextValue: number) => {
    const latestGoal = db.getGoals().find(g => g.id === goal.id) ?? goal;
    if (!latestGoal.isMeasurable) return;
    if (latestGoal.status !== 'active' && latestGoal.status !== 'paused') return;

    const hasPositiveTarget =
      typeof latestGoal.targetValue === 'number' &&
      Number.isFinite(latestGoal.targetValue) &&
      latestGoal.targetValue > 0;
    if (!hasPositiveTarget) return;

    const sanitizedValue = Math.max(0, Number(nextValue.toFixed(4)));
    const shouldAutoAchieve =
      latestGoal.status === 'active' && sanitizedValue >= latestGoal.targetValue!;

    const outcome = db.saveGoal({
      ...latestGoal,
      currentValue: sanitizedValue,
      status: shouldAutoAchieve ? 'achieved' : latestGoal.status,
    });

    setInputValue(String(sanitizedValue));

    const updatedGoal = db.getGoals().find(g => g.id === latestGoal.id);
    if (updatedGoal?.status === 'achieved' && onGoalAchieved) {
      onGoalAchieved(updatedGoal, outcome.xpAwarded);
    }
  };

  const handleStepDelta = (delta: number) => {
    const latestGoal = db.getGoals().find(g => g.id === goal.id) ?? goal;
    const nextValue = applyGoalProgressDelta(latestGoal.currentValue, delta);
    commitProgressValue(nextValue);
  };

  const handleNumericSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseDirectGoalProgressInput(inputValue);
    if (!parsed.valid || parsed.value === undefined) {
      setInputValue(String(progress.safeCurrentValue));
      onInvalidInput?.(parsed.error || 'Enter a valid non-negative number.');
      return;
    }
    commitProgressValue(parsed.value);
  };

  if (!goal.isMeasurable) {
    return (
      <div
        className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t"
        style={{ borderColor: 'var(--border)' }}
      >
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Qualitative milestone — mark achieved when complete or set a numeric target.
        </span>
        <div className="flex items-center gap-2">
          {onConfigureTarget && (
            <button
              type="button"
              onClick={() => onConfigureTarget(goal)}
              aria-label={`Set numeric target for ${goal.title}`}
              className="px-2.5 py-1 rounded-lg border text-xs font-medium inline-flex items-center gap-1 whitespace-nowrap hover:bg-black/5 cursor-pointer"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Set Numeric Target</span>
            </button>
          )}
          {goal.status === 'active' && onMarkAchieved && (
            <button
              type="button"
              onClick={() => onMarkAchieved(goal)}
              className="px-3 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Complete Goal</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!progress.hasValidTarget) {
    return (
      <div
        className="flex items-center justify-between w-full gap-2 pt-3 border-t"
        style={{ borderColor: 'var(--border)' }}
      >
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Target value is not configured for this goal.
        </span>
        {onConfigureTarget && (
          <button
            type="button"
            onClick={() => onConfigureTarget(goal)}
            className="px-3 py-1 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-black/5 cursor-pointer"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Configure Target</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Increment / Decrement Buttons (-1, +1, +5) */}
      <div
        role="group"
        aria-label={`Adjust progress for ${goal.title}`}
        className="flex items-center gap-1.5 flex-nowrap shrink-0"
      >
        <span className="text-xs font-medium mr-1 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
          Progress:
        </span>
        <button
          type="button"
          disabled={progress.safeCurrentValue <= 0}
          onClick={() => handleStepDelta(-1)}
          aria-label={`Decrease ${goal.title} progress by 1`}
          className="px-2.5 py-1 rounded-lg border text-xs font-semibold tabular-nums inline-flex items-center justify-center whitespace-nowrap shrink-0 hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
        >
          -1
        </button>
        <button
          type="button"
          onClick={() => handleStepDelta(1)}
          aria-label={`Increase ${goal.title} progress by 1`}
          className="px-2.5 py-1 rounded-lg border text-xs font-semibold tabular-nums inline-flex items-center justify-center whitespace-nowrap shrink-0 hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer"
          style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
        >
          +1
        </button>
        <button
          type="button"
          onClick={() => handleStepDelta(5)}
          aria-label={`Increase ${goal.title} progress by 5`}
          className="px-2.5 py-1 rounded-lg border text-xs font-semibold tabular-nums inline-flex items-center justify-center whitespace-nowrap shrink-0 hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer"
          style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
        >
          +5
        </button>
      </div>

      {/* Small Numeric Input Field */}
      <form onSubmit={handleNumericSubmit} className="flex items-center gap-1.5 flex-nowrap shrink-0">
        <label
          htmlFor={`goal-progress-input-${goal.id}`}
          className="text-xs whitespace-nowrap"
          style={{ color: 'var(--text-secondary)' }}
        >
          Value:
        </label>
        <input
          id={`goal-progress-input-${goal.id}`}
          type="number"
          min={0}
          step="any"
          aria-label={`Numeric progress for ${goal.title}`}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          className="w-20 px-2.5 py-1 rounded-lg border text-xs font-semibold tabular-nums"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
        />
        <span className="text-xs tabular-nums whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
          / {progress.safeTargetValue} {unitLabel}
        </span>
        <button
          type="submit"
          aria-label={`Set progress for ${goal.title}`}
          className="px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
        >
          Set
        </button>
      </form>
    </div>
  );
};
