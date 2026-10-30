import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  Flame,
  FolderPlus,
  Target,
  Calendar,
  Timer,
  BookOpen,
  ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../database/db';
import {
  computeSafeEndTime,
  parseNaturalLanguageInput,
  resolveHabitScheduleFromRecurrence,
} from '../services/nlpParserService';
import { useNotifications } from '../notifications/NotificationContext';
import { formatLocalDate } from '../services/streakService';
import { useMotionPreference, MOTION_SPRINGS } from '../theme/motion';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type QuickTab = 'task' | 'habit' | 'project' | 'goal' | 'event' | 'journal' | 'focus';

export type QuickAddHabitSchedule = 'daily' | 'weekdays' | 'custom';

export interface QuickAddHabitScheduleState {
  schedule: QuickAddHabitSchedule;
  hasManualOverride: boolean;
}

export function createInitialQuickAddHabitScheduleState(): QuickAddHabitScheduleState {
  return {
    schedule: 'daily',
    hasManualOverride: false,
  };
}

export function applyNlpToQuickAddHabitSchedule(
  state: QuickAddHabitScheduleState,
  rawInput: string
): QuickAddHabitScheduleState {
  if (state.hasManualOverride) {
    return state;
  }
  if (rawInput.trim().length <= 3) {
    return {
      schedule: 'daily',
      hasManualOverride: false,
    };
  }
  const parsed = parseNaturalLanguageInput(rawInput);
  return {
    schedule: resolveHabitScheduleFromRecurrence(parsed.recurrence, 'daily'),
    hasManualOverride: false,
  };
}

export function applyManualQuickAddHabitSchedule(
  _state: QuickAddHabitScheduleState,
  manualSchedule: QuickAddHabitSchedule
): QuickAddHabitScheduleState {
  return {
    schedule: manualSchedule,
    hasManualOverride: true,
  };
}

export function resolveFinalQuickAddHabitSchedule(
  state: QuickAddHabitScheduleState,
  parsedRecurrence?: 'daily' | 'weekly' | 'weekdays'
): QuickAddHabitSchedule {
  if (state.hasManualOverride) {
    return state.schedule;
  }
  return resolveHabitScheduleFromRecurrence(parsedRecurrence, state.schedule);
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({ isOpen, onClose }) => {
  const { notify } = useNotifications();
  const { isReduced, variants, tactileProps } = useMotionPreference();
  const [activeTab, setActiveTab] = useState<QuickTab>('task');
  const [nlpInput, setNlpInput] = useState('');
  const [parsedPreview, setParsedPreview] = useState<ReturnType<typeof parseNaturalLanguageInput> | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(formatLocalDate(new Date()));
  const [time, setTime] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [habitScheduleState, setHabitScheduleState] = useState<QuickAddHabitScheduleState>(
    createInitialQuickAddHabitScheduleState
  );
  const [habitTarget, setHabitTarget] = useState(1);
  const [habitUnit, setHabitUnit] = useState('times');
  const [durationMins, setDurationMins] = useState(25);
  const [category] = useState('Personal');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleNlpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNlpInput(val);
    setHabitScheduleState(prev => applyNlpToQuickAddHabitSchedule(prev, val));
    if (val.trim().length > 3) {
      const parsed = parseNaturalLanguageInput(val);
      setParsedPreview(parsed);
      setTitle(parsed.title);
      if (parsed.date) setDate(parsed.date);
      if (parsed.time) setTime(parsed.time);
      if (parsed.priority) setPriority(parsed.priority);
      if (parsed.durationMinutes) setDurationMins(parsed.durationMinutes);
      if (parsed.detectedType === 'habit') {
        setActiveTab('habit');
        if (parsed.habitTargetValue) setHabitTarget(parsed.habitTargetValue);
        if (parsed.habitTargetUnit) setHabitUnit(parsed.habitTargetUnit);
      } else if (parsed.detectedType === 'focus') {
        setActiveTab('focus');
      } else if (parsed.detectedType === 'event') {
        setActiveTab('event');
      } else if (parsed.detectedType === 'task') {
        setActiveTab(prev => (prev === 'habit' || prev === 'focus' ? 'task' : prev));
      }
    } else {
      setParsedPreview(null);
      setActiveTab(prev => (prev === 'habit' || prev === 'focus' ? 'task' : prev));
    }
  };

  const resetForm = () => {
    setNlpInput('');
    setParsedPreview(null);
    setTitle('');
    setDescription('');
    setTime('');
    setPriority('medium');
    setHabitScheduleState(createInitialQuickAddHabitScheduleState());
    setHabitTarget(1);
    setHabitUnit('times');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const now = new Date().toISOString();

    switch (activeTab) {
      case 'task':
        db.saveTask({
          id: `t_${Date.now()}`,
          title: title.trim(),
          description: description.trim(),
          createdAt: now,
          updatedAt: now,
          status: 'todo',
          priority,
          dueDate: date || undefined,
          dueTime: time || undefined,
          estimatedMinutes: durationMins,
          tags: parsedPreview?.tags || [],
          archived: false,
        });
        notify({ title: 'Task Created', message: `Added "${title}"`, type: 'task' });
        break;

      case 'habit': {
        const resolvedSchedule = resolveFinalQuickAddHabitSchedule(
          habitScheduleState,
          parsedPreview?.recurrence
        );
        db.saveHabit({
          id: `h_${Date.now()}`,
          name: title.trim(),
          description: description.trim(),
          category,
          icon: 'Flame',
          color: '#C86D51',
          startDate: date,
          scheduleType: resolvedSchedule,
          targetType: habitUnit === 'times' || habitUnit === 'done' ? 'boolean' : 'numeric',
          targetValue: habitTarget,
          targetUnit: habitUnit,
          archived: false,
          createdAt: now,
          updatedAt: now,
        });
        notify({ title: 'Habit Created', message: `Anchor set for "${title}"`, type: 'habit' });
        break;
      }

      case 'project':
        db.saveProject({
          id: `p_${Date.now()}`,
          name: title.trim(),
          description: description.trim(),
          color: '#3E7051',
          icon: 'Folder',
          status: 'planning',
          startDate: date,
          milestones: [],
          createdAt: now,
          updatedAt: now,
        });
        notify({ title: 'Project Created', message: `Initiated "${title}"`, type: 'system' });
        break;

      case 'goal':
        db.saveGoal({
          id: `g_${Date.now()}`,
          title: title.trim(),
          description: description.trim(),
          category,
          color: '#7C5295',
          startDate: date,
          targetDate: date,
          status: 'active',
          isMeasurable: false,
          linkedProjectIds: [],
          linkedHabitIds: [],
          milestones: [],
          createdAt: now,
          updatedAt: now,
        });
        notify({ title: 'Goal Established', message: `Vision set: "${title}"`, type: 'system' });
        break;

      case 'event': {
        const resolvedStart = time || '09:00';
        const resolvedEnd = time
          ? computeSafeEndTime(time, parsedPreview?.durationMinutes || 60)
          : '10:00';
        db.saveCalendarEvent({
          id: `ev_${Date.now()}`,
          title: title.trim(),
          description: description.trim(),
          startDate: date,
          startTime: resolvedStart,
          endDate: date,
          endTime: resolvedEnd,
          allDay: !time,
          color: '#0284C7',
          createdAt: now,
        });
        notify({ title: 'Event Scheduled', message: `Calendar booked for "${title}"`, type: 'reminder' });
        break;
      }

      case 'journal':
        db.saveJournalEntry({
          id: `j_${Date.now()}`,
          date,
          title: title.trim(),
          content: description.trim() || 'Quick note saved.',
          tags: parsedPreview?.tags || [],
          createdAt: now,
          updatedAt: now,
        });
        notify({ title: 'Journal Saved', message: `Private reflection logged.`, type: 'system' });
        break;

      case 'focus':
        db.recordFocusSession({
          id: `fs_${Date.now()}`,
          startTime: now,
          endTime: new Date(Date.now() + durationMins * 60000).toISOString(),
          durationMinutes: durationMins,
          type: 'focus',
          completed: true,
          notes: title.trim(),
        });
        notify({ title: 'Focus Logged', message: `Completed ${durationMins}m on "${title}"`, type: 'focus' });
        break;
    }

    onClose();
    resetForm();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={variants.modalOverlay}
          initial="initial"
          animate="animate"
          exit="exit"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-add-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40"
          onClick={onClose}
        >
          <motion.div
            variants={variants.modalDialog}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border shadow-2xl flex flex-col overflow-hidden"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)' }}>
                  <Sparkles className="w-4 h-4" />
                </div>
                <h2 id="quick-add-title" className="text-base font-bold">Universal Quick Add</h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close modal"
                className="p-1.5 rounded-lg transition-colors hover:opacity-70 cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* NLP Natural Language Input */}
            <div className="p-6 border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface-subtle)' }}>
              <label htmlFor="nlp-capture-input" className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                Natural Language Capture (Offline)
              </label>
              <div className="relative">
                <input
                  id="nlp-capture-input"
                  type="text"
                  autoFocus
                  value={nlpInput}
                  onChange={handleNlpChange}
                  placeholder="e.g. Study machine learning tomorrow at 7 PM for 45 minutes #ai"
                  className="w-full px-3.5 py-2.5 rounded-xl border text-sm transition-colors focus-visible:outline-none"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              <AnimatePresence>
                {parsedPreview && (
                  <motion.div
                    variants={variants.statusBanner}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="mt-2.5 p-2 rounded-lg text-xs flex flex-wrap gap-2 items-center"
                    style={{ backgroundColor: 'var(--accent-subtle)', color: 'var(--text-primary)' }}
                  >
                    <span className="font-semibold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Parsed:
                    </span>
                    <span><strong>Type:</strong> {parsedPreview.detectedType}</span>
                    {parsedPreview.date && <span><strong>Date:</strong> {parsedPreview.date}</span>}
                    {parsedPreview.time && <span><strong>Time:</strong> {parsedPreview.time}</span>}
                    {parsedPreview.durationMinutes && <span><strong>Duration:</strong> {parsedPreview.durationMinutes}m</span>}
                    {parsedPreview.tags.length > 0 && <span><strong>Tags:</strong> #{parsedPreview.tags.join(', #')}</span>}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Destination Type Selector Tabs */}
            <div className="flex border-b px-6 overflow-x-auto gap-1 py-2 text-xs font-medium" style={{ borderColor: 'var(--border)' }}>
              {[
                { id: 'task', label: 'Task', icon: CheckCircle2 },
                { id: 'habit', label: 'Habit', icon: Flame },
                { id: 'project', label: 'Project', icon: FolderPlus },
                { id: 'goal', label: 'Goal', icon: Target },
                { id: 'event', label: 'Event', icon: Calendar },
                { id: 'focus', label: 'Focus', icon: Timer },
                { id: 'journal', label: 'Journal', icon: BookOpen },
              ].map(tab => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as QuickTab)}
                    className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      active ? 'font-semibold' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{
                      color: active ? 'var(--accent-foreground)' : 'var(--text-secondary)',
                    }}
                  >
                    {active && (
                      <motion.span
                        layoutId="quickAddTabPill"
                        className="absolute inset-0 rounded-lg shadow-xs"
                        style={{ backgroundColor: 'var(--accent)', zIndex: 0 }}
                        transition={isReduced ? { duration: 0 } : MOTION_SPRINGS.snappy}
                      />
                    )}
                    <Icon className="w-3.5 h-3.5 relative z-10" />
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Detailed Form */}
            <form onSubmit={handleSave} className="p-6 flex flex-col gap-4 max-h-[50vh] overflow-y-auto">
              <div>
                <label htmlFor="quick-add-title-input" className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Title / Name *
                </label>
                <input
                  id="quick-add-title-input"
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="What would you like to create?"
                  className="w-full px-3 py-2 rounded-lg border text-sm focus-visible:outline-none"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div>
                <label htmlFor="quick-add-desc-input" className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Description / Notes
                </label>
                <textarea
                  id="quick-add-desc-input"
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Optional notes or context..."
                  className="w-full px-3 py-2 rounded-lg border text-sm resize-none focus-visible:outline-none"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="quick-add-date-input" className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Target Date
                  </label>
                  <input
                    id="quick-add-date-input"
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border text-sm focus-visible:outline-none"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                {activeTab === 'task' && (
                  <div>
                    <label htmlFor="quick-add-priority-select" className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                      Priority
                    </label>
                    <select
                      id="quick-add-priority-select"
                      value={priority}
                      onChange={e => setPriority(e.target.value as 'low' | 'medium' | 'high' | 'urgent')}
                      className="w-full px-3 py-2 rounded-lg border text-sm focus-visible:outline-none"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                )}

                {activeTab === 'habit' && (
                  <>
                    <div>
                      <label htmlFor="quick-add-habit-schedule-select" className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                        Schedule
                      </label>
                      <select
                        id="quick-add-habit-schedule-select"
                        value={habitScheduleState.schedule}
                        onChange={e =>
                          setHabitScheduleState(prev =>
                            applyManualQuickAddHabitSchedule(
                              prev,
                              e.target.value as QuickAddHabitSchedule
                            )
                          )
                        }
                        className="w-full px-3 py-2 rounded-lg border text-sm focus-visible:outline-none"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <option value="daily">Every Day</option>
                        <option value="weekdays">Weekdays (Mon–Fri)</option>
                        <option value="custom">Custom / Weekly</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label htmlFor="quick-add-habit-target-input" className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                        Target (e.g. 20 pages)
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="quick-add-habit-target-input"
                          type="number"
                          min={1}
                          value={habitTarget}
                          onChange={e => setHabitTarget(parseInt(e.target.value) || 1)}
                          className="w-16 px-2 py-2 rounded-lg border text-sm"
                          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                        />
                        <input
                          type="text"
                          value={habitUnit}
                          onChange={e => setHabitUnit(e.target.value)}
                          placeholder="unit"
                          className="flex-1 px-2 py-2 rounded-lg border text-sm"
                          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {(activeTab === 'event' || activeTab === 'task') && (
                  <div>
                    <label htmlFor="quick-add-time-input" className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                      Scheduled Time
                    </label>
                    <input
                      id="quick-add-time-input"
                      type="time"
                      value={time}
                      onChange={e => setTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border text-sm focus-visible:outline-none"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                )}

                {activeTab === 'focus' && (
                  <div>
                    <label htmlFor="quick-add-duration-input" className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                      Duration (Minutes)
                    </label>
                    <input
                      id="quick-add-duration-input"
                      type="number"
                      min={5}
                      max={180}
                      value={durationMins}
                      onChange={e => setDurationMins(parseInt(e.target.value) || 25)}
                      className="w-full px-3 py-2 rounded-lg border text-sm focus-visible:outline-none"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Footer Submit */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t mt-2" style={{ borderColor: 'var(--border)' }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-xs font-medium transition-colors hover:opacity-75 cursor-pointer"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
                <motion.button
                  {...tactileProps}
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all hover:brightness-105 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-foreground)',
                  }}
                >
                  Save {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                  <ArrowRight className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
