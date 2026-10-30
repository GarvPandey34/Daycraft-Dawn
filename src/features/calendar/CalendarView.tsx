import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Trash2,
  CalendarDays,
  GripVertical,
  Check,
  Layers,
  ArrowRight,
  CheckSquare,
  CalendarPlus,
} from 'lucide-react';
import { db } from '../../database/db';
import { useNotifications } from '../../notifications/NotificationContext';
import { CalendarEvent, TimeBlock, Task } from '../../domain/models';
import { formatLocalDate, addDays, parseLocalDate } from '../../services/streakService';
import { navigationManager } from '../../components/navigationState';
import {
  setTaskDragData,
  setActiveDraggedTaskId,
  extractDraggedTaskId,
  handleTaskDropToCalendar,
  scheduleTaskToCalendar,
  clampTimeBlockEnd,
  isValidSingleDayTimeRange,
} from '../../services/workflowConnectService';

export function getCalendarTaskCollections(allTasks: Task[]) {
  const nonArchivedConfirmed = allTasks.filter(t => !t.archived && t.status !== 'inbox');
  return {
    allActiveTasks: nonArchivedConfirmed.filter(t => t.status !== 'completed'),
    scheduledTasks: nonArchivedConfirmed.filter(t => Boolean(t.dueDate)),
  };
}

export const CalendarView: React.FC = () => {
  const { notify } = useNotifications();
  const [, setTick] = useState(0);
  const [viewMode, setViewMode] = useState<'timeblock' | 'month' | 'agenda'>('timeblock');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Inline editing for TimeBlocks and CalendarEvents
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingBlockTitle, setEditingBlockTitle] = useState('');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEventTitle, setEditingEventTitle] = useState('');

  // Drag and drop for timeblock rescheduling & task-to-calendar scheduling
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [showTaskDock, setShowTaskDock] = useState(true);

  // Event modal/form state
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState(formatLocalDate(new Date()));
  const [eventStart, setEventStart] = useState('09:00');
  const [eventEnd, setEventEnd] = useState('10:00');
  const [eventColor, setEventColor] = useState('#0284C7');

  // Time-block inline form
  const [isCreatingBlock, setIsCreatingBlock] = useState(false);
  const [blockTitle, setBlockTitle] = useState('');
  const [blockStart, setBlockStart] = useState('09:00');
  const [blockEnd, setBlockEnd] = useState('10:00');
  const [blockColor, setBlockColor] = useState('#d97706');

  useEffect(() => {
    return db.subscribe(() => setTick(t => t + 1));
  }, []);

  const todayStr = formatLocalDate(new Date());
  const selectedDateStr = formatLocalDate(currentDate);
  const events = db.getCalendarEvents();
  const { allActiveTasks, scheduledTasks: tasks } = getCalendarTaskCollections(db.getTasks());
  const timeBlocks = db.getTimeBlocks();

  const commitBlockInlineEdit = (block: TimeBlock) => {
    const trimmed = editingBlockTitle.trim();
    setEditingBlockId(null);
    if (!trimmed || trimmed === block.title) return;
    db.saveTimeBlock({
      ...block,
      title: trimmed,
    });
    notify({
      title: 'Time Block Updated',
      message: `Renamed to "${trimmed}"`,
      type: 'system',
    });
  };

  const commitEventInlineEdit = (ev: CalendarEvent) => {
    const trimmed = editingEventTitle.trim();
    setEditingEventId(null);
    if (!trimmed || trimmed === ev.title) return;
    db.saveCalendarEvent({
      ...ev,
      title: trimmed,
    });
    notify({
      title: 'Event Updated',
      message: `Renamed to "${trimmed}"`,
      type: 'system',
    });
  };

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) return;
    if (!isValidSingleDayTimeRange(eventStart, eventEnd)) {
      notify({
        title: 'Invalid Time Range',
        message: 'End time must be later than start time (within 00:00–23:59).',
        type: 'system',
      });
      return;
    }

    const newEv: CalendarEvent = {
      id: `ev_${Date.now()}`,
      title: eventTitle.trim(),
      startDate: eventDate,
      startTime: eventStart,
      endDate: eventDate,
      endTime: eventEnd,
      allDay: false,
      color: eventColor,
      createdAt: new Date().toISOString(),
    };

    db.saveCalendarEvent(newEv);
    notify({ title: 'Event Created', message: `Scheduled "${eventTitle}"`, type: 'reminder' });
    setEventTitle('');
    setIsCreatingEvent(false);
  };

  const handleCreateTimeBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockTitle.trim()) return;
    if (!isValidSingleDayTimeRange(blockStart, blockEnd)) {
      notify({
        title: 'Invalid Time Range',
        message: 'End time must be later than start time (within 00:00–23:59).',
        type: 'system',
      });
      return;
    }

    const newBlock: TimeBlock = {
      id: `tb_${Date.now()}`,
      date: selectedDateStr,
      startTime: blockStart,
      endTime: blockEnd,
      title: blockTitle.trim(),
      color: blockColor,
    };

    db.saveTimeBlock(newBlock);
    notify({ title: 'Time Block Committed', message: `Scheduled ${blockStart}–${blockEnd}: "${blockTitle}"`, type: 'system' });
    setBlockTitle('');
    setIsCreatingBlock(false);
  };

  const createQuickBlockAtSlot = (slotTime: string, durationMinutes: number = 60) => {
    const { startTime, endTime: endStr, durationMinutes: clampedDuration } = clampTimeBlockEnd(
      slotTime,
      durationMinutes
    );

    const newBlock: TimeBlock = {
      id: `tb_${Date.now()}`,
      date: selectedDateStr,
      startTime,
      endTime: endStr,
      title: `Focus Sprint (${clampedDuration}m)`,
      color: durationMinutes === 30 ? '#0284c7' : '#d97706',
    };

    db.saveTimeBlock(newBlock);
    notify({ title: 'Time Block Created', message: `Reserved ${startTime}–${endStr} (${clampedDuration}m)`, type: 'system' });
  };

  const adjustBlockDuration = (block: TimeBlock, deltaMinutes: number) => {
    const [startH, startM] = block.startTime.split(':').map(Number);
    const [endH, endM] = block.endTime.split(':').map(Number);
    const currentDuration = (endH * 60 + endM) - (startH * 60 + startM);
    const requestedDuration = Math.max(30, Math.min(240, currentDuration + deltaMinutes));
    const { endTime: newEndStr, durationMinutes: actualDuration } = clampTimeBlockEnd(
      block.startTime,
      requestedDuration
    );

    db.saveTimeBlock({
      ...block,
      endTime: newEndStr,
    });
    notify({ title: 'Block Resized', message: `${block.title} duration set to ${actualDuration}m`, type: 'system' });
  };

  // Drag and drop handlers for rescheduling & task scheduling
  const handleBlockDragStart = (e: React.DragEvent, blockId: string) => {
    e.dataTransfer.setData('text/plain', blockId);
    setDraggedBlockId(blockId);
    setDraggedTaskId(null);
    setActiveDraggedTaskId(null);
  };

  const handleTaskCardDragStart = (e: React.DragEvent, task: Task) => {
    setTaskDragData(e.dataTransfer, task.id);
    setDraggedTaskId(task.id);
    setDraggedBlockId(null);
  };

  const handleTaskCardDragEnd = () => {
    setDraggedTaskId(null);
    setActiveDraggedTaskId(null);
    setDragOverSlot(null);
    setDragOverDate(null);
  };

  const handleSlotDragOver = (e: React.DragEvent, slotTime: string) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    setDragOverSlot(slotTime);
  };

  const handleSlotDrop = (e: React.DragEvent, targetSlotTime: string) => {
    e.preventDefault();
    setDragOverSlot(null);

    // 1. Check if a Task was dropped onto this time slot
    const droppedTaskId = extractDraggedTaskId(e.dataTransfer, draggedTaskId);
    if (droppedTaskId) {
      const result = handleTaskDropToCalendar(droppedTaskId, {
        date: selectedDateStr,
        startTime: targetSlotTime,
      });
      setDraggedTaskId(null);
      if (result) {
        notify({
          title: result.updatedExisting ? 'Task Time Block Moved' : 'Task Scheduled on Calendar',
          message: `"${result.task.title}" scheduled for ${result.block.startTime}–${result.block.endTime} on ${result.block.date}.`,
          type: 'task',
        });
      }
      return;
    }

    // 2. Otherwise check if an existing TimeBlock was dragged to reschedule
    const blockId = e.dataTransfer.getData('text/plain') || draggedBlockId;
    if (!blockId) return;

    const block = timeBlocks.find(b => b.id === blockId);
    if (!block) return;

    // Calculate duration and clamp to 23:59
    const [origStartH, origStartM] = block.startTime.split(':').map(Number);
    const [origEndH, origEndM] = block.endTime.split(':').map(Number);
    const durationMins = Math.max(30, (origEndH * 60 + origEndM) - (origStartH * 60 + origStartM));
    const { startTime: clampedStart, endTime: newEndStr } = clampTimeBlockEnd(
      targetSlotTime,
      durationMins
    );

    db.saveTimeBlock({
      ...block,
      date: selectedDateStr,
      startTime: clampedStart,
      endTime: newEndStr,
    });

    notify({
      title: 'Time Block Rescheduled',
      message: `Moved "${block.title}" to ${clampedStart}–${newEndStr}`,
      type: 'system',
    });
    setDraggedBlockId(null);
  };

  const handleMonthDateDragOver = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    setDragOverDate(dateStr);
  };

  const handleMonthDateDrop = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverDate(null);

    const droppedTaskId = extractDraggedTaskId(e.dataTransfer, draggedTaskId);
    if (!droppedTaskId) return;

    const result = handleTaskDropToCalendar(droppedTaskId, {
      date: dateStr,
    });
    setDraggedTaskId(null);

    if (result) {
      notify({
        title: result.updatedExisting ? 'Task Time Block Updated' : 'Task Scheduled on Calendar',
        message: `"${result.task.title}" scheduled on ${dateStr} (${result.block.startTime}–${result.block.endTime}).`,
        type: 'task',
      });
    }
  };

  const handleQuickScheduleTask = (task: Task) => {
    const { block, alreadyScheduled } = scheduleTaskToCalendar(task, { date: selectedDateStr });
    notify({
      title: alreadyScheduled ? 'Already Scheduled on This Day' : 'Task Scheduled on Calendar',
      message: `"${task.title}" is set for ${block.startTime}–${block.endTime} on ${block.date}.`,
      type: 'task',
    });
  };

  const deleteBlock = (id: string) => {
    db.deleteTimeBlock(id);
    notify({ title: 'Block Deleted', message: 'Time block removed.', type: 'system' });
  };

  const deleteEvent = (id: string) => {
    db.deleteCalendarEvent(id);
    notify({ title: 'Event Deleted', message: 'Event removed from schedule.', type: 'system' });
  };

  // Month navigation helpers
  const prevDate = () => {
    if (viewMode === 'timeblock') {
      setCurrentDate(prev => parseLocalDate(addDays(formatLocalDate(prev), -1)));
    } else {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    }
  };

  const nextDate = () => {
    if (viewMode === 'timeblock') {
      setCurrentDate(prev => parseLocalDate(addDays(formatLocalDate(prev), 1)));
    } else {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }
  };

  // Hourly slots for timeblocking grid (07:00 to 21:00)
  const timeSlots: string[] = [];
  for (let hour = 7; hour <= 21; hour++) {
    timeSlots.push(`${String(hour).padStart(2, '0')}:00`);
    timeSlots.push(`${String(hour).padStart(2, '0')}:30`);
  }

  // Current day timeblocks
  const dayBlocks = timeBlocks.filter(b => b.date === selectedDateStr);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
            <CalendarIcon className="w-4 h-4" />
            <span>Timeboxing & Schedule</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">Interactive Calendar & Timeblocking</h1>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Drag to create or reschedule 30/60-minute focus time blocks directly on the timeline grid.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setIsCreatingBlock(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border shadow-xs transition-all hover:bg-black/5"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >
            <Clock className="w-4 h-4 text-amber-500" />
            <span>New Block</span>
          </button>
          <button
            onClick={() => setIsCreatingEvent(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all hover:brightness-105 active:scale-98"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
          >
            <Plus className="w-4 h-4" />
            <span>New Event</span>
          </button>
        </div>
      </div>

      {/* Inline Event / Block Creation forms */}
      {isCreatingEvent && (
        <form
          onSubmit={handleCreateEvent}
          className="p-5 rounded-2xl border shadow-md space-y-4 animate-in fade-in"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border)',
          }}
        >
          <h3 className="text-sm font-bold">Schedule Calendar Event</h3>
          <input
            type="text"
            required
            value={eventTitle}
            onChange={e => setEventTitle(e.target.value)}
            placeholder="Event title..."
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                Date
              </label>
              <input
                type="date"
                value={eventDate}
                onChange={e => setEventDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                Start Time
              </label>
              <input
                type="time"
                value={eventStart}
                onChange={e => setEventStart(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                End Time
              </label>
              <input
                type="time"
                value={eventEnd}
                onChange={e => setEventEnd(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              type="button"
              onClick={() => setIsCreatingEvent(false)}
              className="px-3 py-1.5 rounded-lg border text-xs"
              style={{ borderColor: 'var(--border)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg text-xs font-semibold shadow-xs"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
            >
              Save Event
            </button>
          </div>
        </form>
      )}

      {isCreatingBlock && (
        <form
          onSubmit={handleCreateTimeBlock}
          className="p-5 rounded-2xl border shadow-md space-y-4 animate-in fade-in"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border)',
          }}
        >
          <h3 className="text-sm font-bold">Assign Task to Time Block</h3>
          <input
            type="text"
            required
            value={blockTitle}
            onChange={e => setBlockTitle(e.target.value)}
            placeholder="Focus block title (e.g. Deep coding sprint)..."
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                Start Time
              </label>
              <input
                type="time"
                value={blockStart}
                onChange={e => setBlockStart(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                End Time
              </label>
              <input
                type="time"
                value={blockEnd}
                onChange={e => setBlockEnd(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              type="button"
              onClick={() => setIsCreatingBlock(false)}
              className="px-3 py-1.5 rounded-lg border text-xs"
              style={{ borderColor: 'var(--border)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg text-xs font-semibold shadow-xs"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
            >
              Commit Time Block
            </button>
          </div>
        </form>
      )}

      {/* Navigation & View Mode Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold">
            {viewMode === 'timeblock'
              ? currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
              : currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </h2>
          <div className="flex items-center border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={prevDate}
              aria-label="Previous date"
              className="p-1.5 hover:bg-black/5"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-2.5 py-1 text-xs font-semibold hover:bg-black/5 border-x"
              style={{ borderColor: 'var(--border)' }}
            >
              Today
            </button>
            <button
              onClick={nextDate}
              aria-label="Next date"
              className="p-1.5 hover:bg-black/5"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View mode toggle & Task Dock toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          {viewMode !== 'agenda' && (
            <button
              type="button"
              onClick={() => setShowTaskDock(prev => !prev)}
              aria-pressed={showTaskDock}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                showTaskDock ? 'shadow-xs font-bold' : 'opacity-75 hover:opacity-100'
              }`}
              style={{
                backgroundColor: showTaskDock ? 'var(--bg-surface-elevated)' : 'transparent',
                borderColor: showTaskDock ? 'var(--accent)' : 'var(--border)',
                color: showTaskDock ? 'var(--accent)' : 'var(--text-primary)',
              }}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Tasks Queue ({allActiveTasks.length})</span>
            </button>
          )}

          <div className="flex border rounded-xl overflow-hidden text-xs font-semibold" style={{ borderColor: 'var(--border)' }}>
            {(['timeblock', 'month', 'agenda'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 capitalize transition-colors ${
                  viewMode === mode ? 'shadow-xs font-bold' : 'opacity-70 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: viewMode === mode ? 'var(--accent)' : 'transparent',
                  color: viewMode === mode ? 'var(--accent-foreground)' : 'var(--text-primary)',
                }}
              >
                {mode === 'timeblock' ? 'Timeblocking Grid' : mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Layout: Optional Draggable Task Queue + Calendar View */}
      <div className={viewMode !== 'agenda' && showTaskDock ? 'grid grid-cols-1 lg:grid-cols-12 gap-5 items-start' : ''}>
        {/* DRAGGABLE TASKS DOCK (For dragging tasks directly onto time slots or month dates) */}
        {viewMode !== 'agenda' && showTaskDock && (
          <aside
            aria-label="Draggable Tasks Queue"
            className="lg:col-span-4 rounded-2xl border shadow-sm p-4 space-y-3 lg:sticky lg:top-6"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border)',
            }}
          >
            <div className="flex items-center justify-between pb-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                  <CheckSquare className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                  <span>Drag Tasks to Schedule</span>
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {viewMode === 'timeblock'
                    ? 'Drag any task onto a time slot on the right to time-block it.'
                    : 'Drag any task onto a calendar date cell to schedule it.'}
                </p>
              </div>
            </div>

            {allActiveTasks.length === 0 ? (
              <div className="py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                All active tasks are completed.
              </div>
            ) : (
              <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
                {allActiveTasks.map(task => {
                  const blockOnSelectedDay = dayBlocks.find(b => b.linkedTaskId === task.id);
                  const anyScheduledBlock = timeBlocks.find(b => b.linkedTaskId === task.id);
                  const durationLabel = `${task.estimatedMinutes || 60}m`;

                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={e => handleTaskCardDragStart(e, task)}
                      onDragEnd={handleTaskCardDragEnd}
                      data-testid={`draggable-calendar-task-${task.id}`}
                      className={`p-2.5 rounded-xl border transition-all cursor-grab active:cursor-grabbing flex items-center justify-between gap-2 hover:shadow-xs ${
                        draggedTaskId === task.id ? 'opacity-50 ring-2 ring-amber-500' : ''
                      }`}
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: blockOnSelectedDay ? 'var(--accent)' : 'var(--border)',
                      }}
                    >
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <GripVertical className="w-3.5 h-3.5 mt-0.5 opacity-40 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{
                                backgroundColor:
                                  task.priority === 'urgent'
                                    ? 'var(--danger)'
                                    : task.priority === 'high'
                                    ? 'var(--warning)'
                                    : 'var(--accent)',
                              }}
                            />
                            <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                              {task.title}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                            <span>{durationLabel}</span>
                            {blockOnSelectedDay ? (
                              <span
                                className="px-1.5 py-0.2 rounded font-semibold"
                                style={{
                                  backgroundColor: 'var(--bg-surface-subtle)',
                                  color: 'var(--accent)',
                                }}
                              >
                                {blockOnSelectedDay.startTime}–{blockOnSelectedDay.endTime}
                              </span>
                            ) : anyScheduledBlock ? (
                              <span className="opacity-75">
                                {anyScheduledBlock.date} · {anyScheduledBlock.startTime}
                              </span>
                            ) : (
                              <span className="opacity-60">Unscheduled</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleQuickScheduleTask(task)}
                        title="Auto-schedule into next available slot on selected day"
                        aria-label={`Schedule ${task.title} on ${selectedDateStr}`}
                        className="p-1.5 rounded-lg border hover:bg-black/5 transition-colors shrink-0 cursor-pointer"
                        style={{
                          borderColor: 'var(--border)',
                          color: 'var(--accent)',
                        }}
                      >
                        <CalendarPlus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>
        )}

        <div className={viewMode !== 'agenda' && showTaskDock ? 'lg:col-span-8' : ''}>
          {/* VIEW 1: INTERACTIVE TIMEBLOCKING GRID */}
          {viewMode === 'timeblock' && (
            <div
              className="rounded-2xl border shadow-sm p-4 space-y-4"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border)',
              }}
            >
              <div className="flex items-center justify-between text-xs pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span className="font-bold">Daily Timebox Schedule</span>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    ({dayBlocks.length} blocks planned)
                  </span>
                </div>
                <span className="text-[11px] hidden sm:inline" style={{ color: 'var(--text-muted)' }}>
                  Drag tasks or blocks onto any slot • Click + to create 30m / 60m blocks
                </span>
              </div>

              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {timeSlots.map(slotTime => {
                  // Find timeblocks starting in this slot or overlapping
                  const blocksInSlot = dayBlocks.filter(b => b.startTime === slotTime);
                  const isDropTarget = dragOverSlot === slotTime;

                  return (
                    <div
                      key={slotTime}
                      data-slot-time={slotTime}
                      onDragOver={e => handleSlotDragOver(e, slotTime)}
                      onDragLeave={() => setDragOverSlot(null)}
                      onDrop={e => handleSlotDrop(e, slotTime)}
                      className={`py-2 px-3 flex items-start gap-3 transition-colors rounded-xl ${
                        isDropTarget ? 'bg-amber-500/10 ring-2 ring-amber-500' : 'hover:bg-black/2'
                      }`}
                    >
                      {/* Timestamp label */}
                      <div className="w-14 text-xs font-mono font-bold pt-1 shrink-0" style={{ color: 'var(--text-secondary)' }}>
                        {slotTime}
                      </div>

                      {/* Slot content & active blocks */}
                      <div className="flex-1 min-w-0 space-y-2">
                        {blocksInSlot.length > 0 ? (
                          blocksInSlot.map(block => (
                            <div
                              key={block.id}
                              draggable={editingBlockId !== block.id}
                              onDragStart={e => handleBlockDragStart(e, block.id)}
                              className="p-3 rounded-xl border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all"
                              style={{
                                backgroundColor: 'var(--bg-surface)',
                                borderColor: block.color || 'var(--accent)',
                              }}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <GripVertical className="w-4 h-4 opacity-40 shrink-0" />
                                <div className="w-2.5 h-8 rounded-full shrink-0" style={{ backgroundColor: block.color || 'var(--accent)' }} />
                                <div className="min-w-0 flex-1">
                                  {editingBlockId === block.id ? (
                                    <input
                                      type="text"
                                      autoFocus
                                      value={editingBlockTitle}
                                      onChange={e => setEditingBlockTitle(e.target.value)}
                                      onBlur={() => commitBlockInlineEdit(block)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') commitBlockInlineEdit(block);
                                        if (e.key === 'Escape') setEditingBlockId(null);
                                      }}
                                      className="px-2 py-0.5 rounded border text-xs font-bold focus:outline-none w-full max-w-xs"
                                      style={{
                                        backgroundColor: 'var(--bg-surface-elevated)',
                                        borderColor: 'var(--accent)',
                                        color: 'var(--text-primary)',
                                      }}
                                    />
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <h4
                                        onClick={() => {
                                          setEditingBlockId(block.id);
                                          setEditingBlockTitle(block.title);
                                        }}
                                        title="Click to edit time block title inline"
                                        className="text-xs font-bold truncate cursor-text hover:underline decoration-dotted"
                                      >
                                        {block.title}
                                      </h4>
                                      {block.linkedTaskId && (
                                        <button
                                          type="button"
                                          onClick={() => navigationManager.setView('tasks')}
                                          className="text-[10px] px-1.5 py-0.2 rounded border font-semibold cursor-pointer"
                                          style={{
                                            borderColor: 'var(--border)',
                                            color: 'var(--accent)',
                                          }}
                                          title="Jump to linked task"
                                        >
                                          Linked Task ↗
                                        </button>
                                      )}
                                    </div>
                                  )}
                                  <p className="text-[11px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                                    {block.startTime} – {block.endTime}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                {/* Duration adjusters */}
                                <button
                                  onClick={() => adjustBlockDuration(block, -30)}
                                  title="Decrease 30 mins"
                                  className="px-2 py-0.5 rounded text-[10px] font-bold border hover:bg-black/5"
                                  style={{ borderColor: 'var(--border)' }}
                                >
                                  -30m
                                </button>
                                <button
                                  onClick={() => adjustBlockDuration(block, 30)}
                                  title="Increase 30 mins"
                                  className="px-2 py-0.5 rounded text-[10px] font-bold border hover:bg-black/5"
                                  style={{ borderColor: 'var(--border)' }}
                                >
                                  +30m
                                </button>

                                <button
                                  onClick={() => deleteBlock(block.id)}
                                  title="Delete block"
                                  className="p-1 rounded text-stone-400 hover:text-red-500"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          /* Empty slot quick action */
                          <div className="flex items-center gap-2 opacity-30 hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => createQuickBlockAtSlot(slotTime, 30)}
                              className="text-[10px] px-2 py-0.5 rounded border hover:bg-amber-500/10 hover:text-amber-600"
                              style={{ borderColor: 'var(--border)' }}
                            >
                              + 30m Block
                            </button>
                            <button
                              onClick={() => createQuickBlockAtSlot(slotTime, 60)}
                              className="text-[10px] px-2 py-0.5 rounded border hover:bg-amber-500/10 hover:text-amber-600"
                              style={{ borderColor: 'var(--border)' }}
                            >
                              + 60m Sprint
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW 2: MONTH VIEW */}
          {viewMode === 'month' && (
            <div
              className="rounded-2xl border shadow-sm overflow-hidden"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border)',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              {/* Weekday headers */}
              <div className="grid grid-cols-7 border-b text-center py-2 text-xs font-bold" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface-subtle)', color: 'var(--text-secondary)' }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <span key={d}>{d}</span>
                ))}
              </div>

              {/* Month Day cells */}
              <div className="grid grid-cols-7 divide-x divide-y" style={{ borderColor: 'var(--border)' }}>
                {Array.from({ length: 35 }).map((_, idx) => {
                  const year = currentDate.getFullYear();
                  const month = currentDate.getMonth();
                  const firstDayOfWeek = new Date(year, month, 1).getDay();
                  const dayNum = idx - firstDayOfWeek + 1;
                  const dateObj = new Date(year, month, dayNum);
                  const dateStr = formatLocalDate(dateObj);
                  const isCurrentMonth = dateObj.getMonth() === month;
                  const isToday = dateStr === todayStr;
                  const isDateDropTarget = dragOverDate === dateStr;

                  const dayEvents = events.filter(e => e.startDate === dateStr);
                  const dayTasks = tasks.filter(t => t.dueDate === dateStr);
                  const dayBlocksForDate = timeBlocks.filter(b => b.date === dateStr);

                  return (
                    <div
                      key={idx}
                      data-date={dateStr}
                      onDragOver={e => handleMonthDateDragOver(e, dateStr)}
                      onDragLeave={() => setDragOverDate(null)}
                      onDrop={e => handleMonthDateDrop(e, dateStr)}
                      onClick={() => {
                        setCurrentDate(dateObj);
                        setViewMode('timeblock');
                      }}
                      className={`min-h-[90px] p-2 flex flex-col justify-between transition-colors cursor-pointer hover:bg-black/5 ${
                        !isCurrentMonth ? 'opacity-30' : ''
                      } ${isDateDropTarget ? 'ring-2 ring-amber-500 bg-amber-500/10' : ''}`}
                      style={{
                        backgroundColor: isDateDropTarget
                          ? undefined
                          : isToday
                          ? 'var(--bg-surface-subtle)'
                          : 'transparent',
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <span
                          className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                            isToday ? 'bg-amber-500 text-white' : ''
                          }`}
                        >
                          {dateObj.getDate()}
                        </span>
                        {dayBlocksForDate.length > 0 && (
                          <span className="text-[9px] px-1 rounded bg-amber-100 text-amber-800 font-bold">
                            {dayBlocksForDate.length} tb
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 mt-1">
                        {dayEvents.map(e => (
                          <div
                            key={e.id}
                            className="text-[10px] px-1.5 py-0.5 rounded truncate font-medium text-white shadow-xs"
                            style={{ backgroundColor: e.color || 'var(--accent)' }}
                          >
                            {e.startTime ? `${e.startTime} ` : ''}{e.title}
                          </div>
                        ))}
                        {dayTasks.map(t => (
                          <div
                            key={t.id}
                            className={`text-[10px] px-1.5 py-0.5 rounded truncate ${
                              t.status === 'completed' ? 'line-through opacity-50' : 'font-medium'
                            }`}
                            style={{
                              backgroundColor: 'var(--bg-surface-subtle)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            ✓ {t.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* VIEW 3: AGENDA VIEW */}
      {viewMode === 'agenda' && (
        <div
          className="rounded-2xl border shadow-sm divide-y"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--card-shadow)',
          }}
        >
          {events.length === 0 ? (
            <div className="p-12 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
              No calendar events scheduled.
            </div>
          ) : (
            events.map(ev => (
              <div key={ev.id} className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-2.5 h-10 rounded-full shrink-0" style={{ backgroundColor: ev.color || 'var(--accent)' }} />
                  <div className="flex-1 min-w-0">
                    {editingEventId === ev.id ? (
                      <input
                        type="text"
                        autoFocus
                        value={editingEventTitle}
                        onChange={e => setEditingEventTitle(e.target.value)}
                        onBlur={() => commitEventInlineEdit(ev)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitEventInlineEdit(ev);
                          if (e.key === 'Escape') setEditingEventId(null);
                        }}
                        className="px-2 py-0.5 rounded border text-sm font-bold focus:outline-none w-full max-w-sm"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--accent)',
                          color: 'var(--text-primary)',
                        }}
                      />
                    ) : (
                      <h3
                        onClick={() => {
                          setEditingEventId(ev.id);
                          setEditingEventTitle(ev.title);
                        }}
                        title="Click to edit event title inline"
                        className="text-sm font-bold cursor-text hover:underline decoration-dotted truncate"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {ev.title}
                      </h3>
                    )}
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {ev.startDate} • {ev.startTime ? `${ev.startTime} - ${ev.endTime || ''}` : 'All Day'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => deleteEvent(ev.id)}
                  title="Delete event"
                  className="p-1.5 rounded-lg text-stone-400 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
