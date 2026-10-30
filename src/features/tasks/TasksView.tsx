import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Plus,
  Calendar,
  CalendarPlus,
  Clock,
  Trash2,
  Copy,
  Search,
  LayoutList,
  Columns3,
  GripVertical,
  Edit3,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../../database/db';
import { useNotifications } from '../../notifications/NotificationContext';
import { Task, Priority, TaskStatus } from '../../domain/models';
import { formatLocalDate } from '../../services/streakService';
import { useMotionPreference, MOTION_SPRINGS } from '../../theme/motion';
import { AnimatedCheckbox, EmptyStateMotion } from '../../components/MotionPrimitives';
import {
  scheduleTaskToCalendar,
  setTaskDragData,
  setActiveDraggedTaskId,
  extractDraggedTaskId,
} from '../../services/workflowConnectService';
import { navigationManager } from '../../components/navigationState';

const KANBAN_COLUMNS: { id: TaskStatus; title: string; color: string }[] = [
  { id: 'inbox', title: 'Inbox & Backlog', color: '#64748b' },
  { id: 'todo', title: 'To Do', color: '#d97706' },
  { id: 'in_progress', title: 'In Progress', color: '#2563eb' },
  { id: 'completed', title: 'Completed', color: '#16a34a' },
];

export type TasksViewTab = 'all' | 'today' | 'upcoming' | 'overdue' | 'completed' | 'archived';

export function filterTasksByTab(
  tasks: Task[],
  activeTab: TasksViewTab,
  todayStr: string
): Task[] {
  return tasks.filter(t => {
    if (activeTab === 'archived') return t.archived;
    if (t.archived) return false;

    if (activeTab === 'completed') return t.status === 'completed';
    if (activeTab === 'today') {
      return t.status !== 'completed' && t.status !== 'inbox' && t.dueDate === todayStr;
    }
    if (activeTab === 'upcoming') {
      return Boolean(
        t.status !== 'completed' && t.status !== 'inbox' && t.dueDate && t.dueDate > todayStr
      );
    }
    if (activeTab === 'overdue') {
      return Boolean(
        t.status !== 'completed' && t.status !== 'inbox' && t.dueDate && t.dueDate < todayStr
      );
    }
    if (activeTab === 'all') return t.status !== 'completed' && t.status !== 'inbox';
    return true;
  });
}

export const TasksView: React.FC = () => {
  const { notify, triggerCelebration } = useNotifications();
  const { isReduced, variants, tactileProps, cardHoverProps } = useMotionPreference();
  const [, setTick] = useState(0);
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [activeTab, setActiveTab] = useState<'all' | 'today' | 'upcoming' | 'overdue' | 'completed' | 'archived'>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

  // Inline title editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');

  // Drag and drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  // New task inline form
  const [isCreating, setIsCreating] = useState(false);
  const [creatingInStatus, setCreatingInStatus] = useState<TaskStatus>('todo');
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [newProjectId, setNewProjectId] = useState('');

  useEffect(() => {
    return db.subscribe(() => setTick(t => t + 1));
  }, []);

  const todayStr = formatLocalDate(new Date());
  const tasks = db.getTasks();
  const projects = db.getProjects();
  const timeBlocks = db.getTimeBlocks();
  const effectiveProjectId =
    selectedProjectId !== 'all' && projects.some(p => p.id === selectedProjectId)
      ? selectedProjectId
      : 'all';

  useEffect(() => {
    if (selectedProjectId !== 'all' && !projects.some(p => p.id === selectedProjectId)) {
      setSelectedProjectId('all');
    }
  }, [projects, selectedProjectId]);

  const startInlineEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setEditingTitleValue(task.title);
  };

  const commitInlineEdit = (task: Task) => {
    const trimmed = editingTitleValue.trim();
    setEditingTaskId(null);
    if (!trimmed || trimmed === task.title) return;
    db.saveTask({
      ...task,
      title: trimmed,
      updatedAt: new Date().toISOString(),
    });
    notify({
      title: 'Task Updated',
      message: `Renamed to "${trimmed}"`,
      type: 'task',
    });
  };

  const handleSendToCalendar = (task: Task) => {
    const { block, alreadyScheduled } = scheduleTaskToCalendar(task);
    if (alreadyScheduled) {
      notify({
        title: 'Already on Calendar',
        message: `"${task.title}" is scheduled for ${block.date} (${block.startTime}–${block.endTime}). Opening Calendar...`,
        type: 'system',
      });
      navigationManager.setView('calendar');
    } else {
      notify({
        title: 'Scheduled on Calendar',
        message: `Time-blocked "${task.title}" on ${block.date} (${block.startTime}–${block.endTime}).`,
        type: 'task',
      });
    }
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const now = new Date().toISOString();
    const task: Task = {
      id: `t_${Date.now()}`,
      title: newTitle.trim(),
      description: '',
      createdAt: now,
      updatedAt: now,
      status: creatingInStatus,
      priority: newPriority,
      dueDate: newDueDate || undefined,
      projectId: newProjectId || undefined,
      tags: [],
      archived: false,
    };

    db.saveTask(task);
    notify({ title: 'Task Created', message: `Added "${task.title}"`, type: 'task' });
    setNewTitle('');
    setNewDueDate('');
    setIsCreating(false);
  };

  const toggleTask = (task: Task) => {
    const isCompleted = task.status === 'completed';
    const now = new Date().toISOString();

    const outcome = db.saveTask({
      ...task,
      status: isCompleted ? 'todo' : 'completed',
      completedAt: isCompleted ? undefined : now,
    });

    if (!isCompleted) {
      notify({
        title: 'Task Completed',
        message:
          outcome.xpAwarded > 0
            ? `Finished "${task.title}" (+${outcome.xpAwarded} XP)`
            : `Finished "${task.title}"`,
        type: 'task',
      });
      triggerCelebration();

      if (outcome.spawnedNextTask) {
        notify({
          title: 'Recurring Task Scheduled',
          message: `Next occurrence on ${outcome.spawnedNextTask.dueDate}`,
          type: 'system',
        });
      }
    }
  };

  const moveTaskStatus = (task: Task, targetStatus: TaskStatus) => {
    if (task.status === targetStatus) return;
    const isCompleted = targetStatus === 'completed';
    const now = new Date().toISOString();

    const outcome = db.saveTask({
      ...task,
      status: targetStatus,
      completedAt: isCompleted ? now : undefined,
    });

    if (isCompleted) {
      notify({
        title: 'Task Completed',
        message:
          outcome.xpAwarded > 0
            ? `Completed "${task.title}" (+${outcome.xpAwarded} XP)`
            : `Completed "${task.title}"`,
        type: 'task',
      });
      triggerCelebration();

      if (outcome.spawnedNextTask) {
        notify({
          title: 'Recurring Task Scheduled',
          message: `Next occurrence on ${outcome.spawnedNextTask.dueDate}`,
          type: 'system',
        });
      }
    } else {
      notify({ title: 'Task Moved', message: `Moved to ${targetStatus.replace('_', ' ')}`, type: 'system' });
    }
  };

  const duplicateTask = (task: Task) => {
    const now = new Date().toISOString();
    const duplicated: Task = {
      ...task,
      id: `t_dup_${Date.now()}`,
      title: `${task.title} (Copy)`,
      status: task.status === 'completed' ? 'todo' : task.status,
      completedAt: undefined,
      createdAt: now,
      updatedAt: now,
    };
    db.saveTask(duplicated);
    notify({ title: 'Task Duplicated', message: `Created copy of "${task.title}"`, type: 'system' });
  };

  const deleteTask = (id: string) => {
    db.deleteTask(id);
    notify({ title: 'Task Deleted', message: 'Item deleted.', type: 'system' });
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setTaskDragData(e.dataTransfer, id);
    setDraggedTaskId(id);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setActiveDraggedTaskId(null);
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDragOverCol(colId);
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    const taskId =
      extractDraggedTaskId(e.dataTransfer, draggedTaskId) ||
      e.dataTransfer.getData('text/plain') ||
      draggedTaskId;
    if (!taskId) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    moveTaskStatus(task, targetStatus);
    setDraggedTaskId(null);
    setActiveDraggedTaskId(null);
  };

  // Filter logic
  let filtered = filterTasksByTab(tasks, activeTab, todayStr);

  if (priorityFilter !== 'all') {
    filtered = filtered.filter(t => t.priority === priorityFilter);
  }
  if (effectiveProjectId !== 'all') {
    filtered = filtered.filter(t => t.projectId === effectiveProjectId);
  }
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(t => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
  }

  // Board view tasks
  const boardTasks = tasks.filter(t => {
    if (t.archived) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (effectiveProjectId !== 'all' && t.projectId !== effectiveProjectId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
            <CheckCircle2 className="w-4 h-4" />
            <span>Task Engine & Sprints</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">Tasks & Sprint Planning</h1>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Complete, priority-driven offline task management with visual Kanban board and drag-and-drop workflow.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* View Mode Toggle: List vs Board */}
          <div className="flex items-center p-1 rounded-xl border bg-black/5" style={{ borderColor: 'var(--border)' }}>
            {(['list', 'board'] as const).map(mode => {
              const active = viewMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    active ? '' : 'opacity-60 hover:opacity-100'
                  }`}
                  style={{
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  {active && (
                    <motion.span
                      layoutId="tasksViewModePill"
                      className="absolute inset-0 rounded-lg shadow-xs"
                      style={{ backgroundColor: 'var(--bg-surface-elevated)', zIndex: 0 }}
                      transition={isReduced ? { duration: 0 } : MOTION_SPRINGS.snappy}
                    />
                  )}
                  {mode === 'list' ? (
                    <LayoutList className="w-3.5 h-3.5 relative z-10" />
                  ) : (
                    <Columns3 className="w-3.5 h-3.5 relative z-10" />
                  )}
                  <span className="capitalize relative z-10">{mode}</span>
                </button>
              );
            })}
          </div>

          <motion.button
            {...tactileProps}
            onClick={() => {
              setCreatingInStatus('todo');
              setIsCreating(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all hover:brightness-105 cursor-pointer"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </motion.button>
        </div>
      </div>

      {/* Inline Creation Card */}
      <AnimatePresence initial={false}>
        {isCreating && (
          <motion.form
            variants={variants.accordion}
            initial="initial"
            animate="animate"
            exit="exit"
            onSubmit={handleCreateTask}
            className="overflow-hidden"
          >
            <div
              className="p-4 rounded-2xl border shadow-md space-y-3"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border)',
              }}
            >
              <input
                type="text"
                required
                autoFocus
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder={`Task title for ${creatingInStatus.replace('_', ' ')}...`}
                className="w-full px-3 py-2 rounded-lg border text-sm font-medium focus-visible:outline-none"
                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
              />

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span style={{ color: 'var(--text-muted)' }}>Column:</span>
                  <select
                    value={creatingInStatus}
                    onChange={e => setCreatingInStatus(e.target.value as TaskStatus)}
                    className="px-2 py-1 rounded-md border"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                  >
                    <option value="inbox">Inbox & Backlog</option>
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={e => setNewDueDate(e.target.value)}
                    className="px-2 py-1 rounded-md border"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span style={{ color: 'var(--text-muted)' }}>Priority:</span>
                  <select
                    value={newPriority}
                    onChange={e => setNewPriority(e.target.value as Priority)}
                    className="px-2 py-1 rounded-md border"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span style={{ color: 'var(--text-muted)' }}>Project:</span>
                  <select
                    value={newProjectId}
                    onChange={e => setNewProjectId(e.target.value)}
                    className="px-2 py-1 rounded-md border"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                  >
                    <option value="">No Project</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-3 py-1 rounded-md border text-xs cursor-pointer"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    Cancel
                  </button>
                  <motion.button
                    {...tactileProps}
                    type="submit"
                    className="px-4 py-1 rounded-md text-xs font-semibold shadow-xs cursor-pointer"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
                  >
                    Save Task
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Filters & Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* View Tabs (in List mode) */}
        {viewMode === 'list' ? (
          <div
            className="flex items-center gap-1 p-1 rounded-xl border overflow-x-auto text-xs"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
          >
            {[
              { id: 'all', label: 'Active' },
              { id: 'today', label: 'Today' },
              { id: 'upcoming', label: 'Upcoming' },
              { id: 'overdue', label: 'Overdue' },
              { id: 'completed', label: 'Completed' },
              { id: 'archived', label: 'Archived' },
            ].map(tab => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`relative px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    active ? 'font-semibold' : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-70 hover:opacity-100'
                  }`}
                  style={{
                    color: active ? 'var(--accent-foreground)' : 'var(--text-primary)',
                  }}
                >
                  {active && (
                    <motion.span
                      layoutId="tasksTabIndicator"
                      className="absolute inset-0 rounded-lg shadow-xs"
                      style={{ backgroundColor: 'var(--accent)', zIndex: 0 }}
                      transition={isReduced ? { duration: 0 } : MOTION_SPRINGS.snappy}
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            Drag and drop cards between sprint columns to update workflow status
          </div>
        )}

        {/* Global Filters & Search */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter tasks..."
              className="pl-8 pr-3 py-1 rounded-lg border text-xs focus-visible:outline-none"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
            />
          </div>

          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="px-2 py-1 rounded-lg border text-xs"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
            className="px-2 py-1 rounded-lg border text-xs"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
          >
            <option value="all">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* VIEW MODE 1: KANBAN BOARD */}
      {viewMode === 'board' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {KANBAN_COLUMNS.map(col => {
            const colTasks = boardTasks.filter(t => t.status === col.id);
            const isDropTarget = dragOverCol === col.id;

            return (
              <div
                key={col.id}
                onDragOver={e => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, col.id)}
                className={`rounded-2xl border p-3 flex flex-col transition-all min-h-[420px] ${
                  isDropTarget ? 'ring-2 ring-amber-500 scale-[1.01]' : ''
                }`}
                style={{
                  backgroundColor: isDropTarget ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                  borderColor: 'var(--border)',
                }}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 mb-2 border-b" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                    <h3 className="text-xs font-bold tracking-tight">{col.title}</h3>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-black/5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      {colTasks.length}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setCreatingInStatus(col.id);
                      setIsCreating(true);
                    }}
                    title={`Add card to ${col.title}`}
                    className="p-1 rounded-md opacity-60 hover:opacity-100 transition-opacity hover:bg-black/5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Cards List in Column */}
                <div className="flex-1 space-y-2.5">
                  {colTasks.length === 0 ? (
                    <div className="py-12 text-center text-[11px] border border-dashed rounded-xl opacity-40" style={{ borderColor: 'var(--border)' }}>
                      Drag tasks here or click +
                    </div>
                  ) : (
                    colTasks.map(task => {
                      const isCompleted = task.status === 'completed';
                      const isOverdue = !isCompleted && task.dueDate && task.dueDate < todayStr;
                      const project = projects.find(p => p.id === task.projectId);
                      const scheduledBlock = timeBlocks.find(b => b.linkedTaskId === task.id);

                      return (
                        <motion.div
                          key={task.id}
                          layout
                          {...cardHoverProps}
                          draggable={editingTaskId !== task.id}
                          onDragStart={e => handleDragStart(e as unknown as React.DragEvent, task.id)}
                          onDragEnd={handleDragEnd}
                          className="tactile-card p-3 rounded-xl border shadow-xs transition-all cursor-grab active:cursor-grabbing space-y-2"
                          style={{
                            backgroundColor: 'var(--bg-surface-elevated)',
                            borderColor: 'var(--border)',
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <div className="mt-0.5">
                                <AnimatedCheckbox
                                  checked={isCompleted}
                                  onChange={() => toggleTask(task)}
                                  label={`Toggle task: ${task.title}`}
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                {editingTaskId === task.id ? (
                                  <input
                                    type="text"
                                    autoFocus
                                    value={editingTitleValue}
                                    onChange={e => setEditingTitleValue(e.target.value)}
                                    onBlur={() => commitInlineEdit(task)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') commitInlineEdit(task);
                                      if (e.key === 'Escape') setEditingTaskId(null);
                                    }}
                                    className="w-full px-1.5 py-0.5 rounded border text-xs font-semibold focus:outline-none"
                                    style={{
                                      backgroundColor: 'var(--bg-surface)',
                                      borderColor: 'var(--accent)',
                                      color: 'var(--text-primary)',
                                    }}
                                  />
                                ) : (
                                  <h4
                                    onClick={() => startInlineEdit(task)}
                                    title="Click to edit title inline"
                                    className={`text-xs font-semibold leading-snug cursor-text hover:underline decoration-dotted ${
                                      isCompleted ? 'line-through opacity-50' : ''
                                    }`}
                                    style={{ color: 'var(--text-primary)' }}
                                  >
                                    {task.title}
                                  </h4>
                                )}
                                {task.description && (
                                  <p className="text-[11px] line-clamp-2 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                    {task.description}
                                  </p>
                                )}
                              </div>
                            </div>

                            <GripVertical className="w-3.5 h-3.5 opacity-30 shrink-0" />
                          </div>

                          {/* Metadata row */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px]">
                            {project && (
                              <span className="px-1.5 py-0.5 rounded font-medium border" style={{ borderColor: 'var(--border)', color: project.color }}>
                                {project.name}
                              </span>
                            )}

                            <span
                              className="px-1.5 py-0.2 rounded font-bold uppercase"
                              style={{
                                backgroundColor:
                                  task.priority === 'urgent'
                                    ? 'var(--danger-subtle)'
                                    : task.priority === 'high'
                                    ? 'var(--warning-subtle)'
                                    : 'var(--bg-surface-subtle)',
                                color:
                                  task.priority === 'urgent'
                                    ? 'var(--danger)'
                                    : task.priority === 'high'
                                    ? 'var(--warning)'
                                    : 'var(--text-secondary)',
                              }}
                            >
                              {task.priority}
                            </span>

                            {task.dueDate && (
                              <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 font-bold' : 'opacity-70'}`}>
                                <Calendar className="w-2.5 h-2.5" />
                                {task.dueDate}
                              </span>
                            )}

                            {scheduledBlock && (
                              <button
                                type="button"
                                onClick={() => navigationManager.setView('calendar')}
                                className="flex items-center gap-1 px-1.5 py-0.2 rounded font-mono font-semibold cursor-pointer"
                                style={{
                                  backgroundColor: 'var(--bg-surface-subtle)',
                                  color: 'var(--accent)',
                                }}
                                title="View scheduled time block on Calendar"
                              >
                                <Clock className="w-2.5 h-2.5" />
                                <span>{scheduledBlock.startTime}</span>
                              </button>
                            )}
                          </div>

                          {/* Quick Column Shift Actions */}
                          <div className="flex items-center justify-between pt-1 border-t text-[10px] opacity-70 group-hover:opacity-100" style={{ borderColor: 'var(--border)' }}>
                            <div className="flex gap-1">
                              {col.id !== 'inbox' && (
                                <button
                                  onClick={() => moveTaskStatus(task, 'inbox')}
                                  title="Move to Inbox"
                                  className="px-1.5 py-0.5 rounded border hover:bg-black/5 cursor-pointer"
                                  style={{ borderColor: 'var(--border)' }}
                                >
                                  Inbox
                                </button>
                              )}
                              {col.id !== 'todo' && (
                                <button
                                  onClick={() => moveTaskStatus(task, 'todo')}
                                  title="Move to To Do"
                                  className="px-1.5 py-0.5 rounded border hover:bg-black/5 cursor-pointer"
                                  style={{ borderColor: 'var(--border)' }}
                                >
                                  To Do
                                </button>
                              )}
                              {col.id !== 'in_progress' && (
                                <button
                                  onClick={() => moveTaskStatus(task, 'in_progress')}
                                  title="Move to In Progress"
                                  className="px-1.5 py-0.5 rounded border hover:bg-black/5 cursor-pointer"
                                  style={{ borderColor: 'var(--border)' }}
                                >
                                  In Prog
                                </button>
                              )}
                              {col.id !== 'completed' && (
                                <button
                                  onClick={() => moveTaskStatus(task, 'completed')}
                                  title="Mark Completed"
                                  className="px-1.5 py-0.5 rounded border hover:bg-black/5 cursor-pointer"
                                  style={{ borderColor: 'var(--border)' }}
                                >
                                  Done
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              {!isCompleted && (
                                <button
                                  onClick={() => handleSendToCalendar(task)}
                                  title="Send to Calendar time block"
                                  aria-label={`Schedule ${task.title} on Calendar`}
                                  className="p-1 rounded opacity-70 hover:opacity-100 cursor-pointer"
                                  style={{ color: 'var(--accent)' }}
                                >
                                  <CalendarPlus className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                onClick={() => duplicateTask(task)}
                                title="Duplicate"
                                className="p-1 rounded opacity-50 hover:opacity-100 cursor-pointer"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => deleteTask(task.id)}
                                title="Delete"
                                className="p-1 rounded text-stone-400 hover:text-red-500 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VIEW MODE 2: CLASSIC LIST */
        <div
          className="rounded-2xl border shadow-sm overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--card-shadow)',
          }}
        >
          {filtered.length === 0 ? (
            <EmptyStateMotion className="p-12 text-center text-xs">
              <span style={{ color: 'var(--text-muted)' }}>No tasks found in this view.</span>
            </EmptyStateMotion>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {filtered.map(task => {
                const isCompleted = task.status === 'completed';
                const isOverdue = !isCompleted && task.dueDate && task.dueDate < todayStr;
                const project = projects.find(p => p.id === task.projectId);
                const scheduledBlock = timeBlocks.find(b => b.linkedTaskId === task.id);

                return (
                  <div
                    key={task.id}
                    draggable={editingTaskId !== task.id}
                    onDragStart={e => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    className="p-4 flex items-center justify-between gap-3 group transition-colors hover:bg-black/[0.015] dark:hover:bg-white/[0.015] cursor-grab active:cursor-grabbing"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <GripVertical
                        className="w-3.5 h-3.5 opacity-25 group-hover:opacity-60 transition-opacity shrink-0"
                        aria-hidden="true"
                      />
                      <AnimatedCheckbox
                        checked={isCompleted}
                        onChange={() => toggleTask(task)}
                        label={`Toggle task completion: ${task.title}`}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {editingTaskId === task.id ? (
                            <input
                              type="text"
                              autoFocus
                              value={editingTitleValue}
                              onChange={e => setEditingTitleValue(e.target.value)}
                              onBlur={() => commitInlineEdit(task)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') commitInlineEdit(task);
                                if (e.key === 'Escape') setEditingTaskId(null);
                              }}
                              className="px-2 py-0.5 rounded border text-sm font-medium focus:outline-none min-w-[220px]"
                              style={{
                                backgroundColor: 'var(--bg-surface)',
                                borderColor: 'var(--accent)',
                                color: 'var(--text-primary)',
                              }}
                            />
                          ) : (
                            <span
                              onClick={() => startInlineEdit(task)}
                              title="Click to edit task title inline"
                              className={`text-sm font-medium tracking-tight transition-opacity cursor-text hover:underline decoration-dotted ${
                                isCompleted ? 'line-through opacity-45' : ''
                              }`}
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {task.title}
                            </span>
                          )}
                          {project && (
                            <span className="text-xs font-normal flex items-center gap-0.5 opacity-70 hover:opacity-100" style={{ color: project.color || 'var(--text-secondary)' }}>
                              <span className="opacity-50">#</span>
                              <span>{project.name}</span>
                            </span>
                          )}
                          {task.recurrence && task.recurrence.type !== 'none' && (
                            <span className="text-[11px] font-mono text-sky-600 dark:text-sky-400">
                              ↻ {task.recurrence.type}
                            </span>
                          )}
                          {scheduledBlock && (
                            <button
                              type="button"
                              onClick={() => navigationManager.setView('calendar')}
                              className="text-[11px] font-mono px-2 py-0.5 rounded-md border flex items-center gap-1 cursor-pointer hover:brightness-95"
                              style={{
                                backgroundColor: 'var(--bg-surface-subtle)',
                                borderColor: 'var(--border)',
                                color: 'var(--accent)',
                              }}
                              title="Open scheduled time block on Calendar"
                            >
                              <Clock className="w-3 h-3" />
                              <span>
                                {scheduledBlock.date === todayStr ? 'Today' : scheduledBlock.date}{' '}
                                {scheduledBlock.startTime}
                              </span>
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5 text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                          {task.dueDate && (
                            <span className={`flex items-center gap-1 font-mono text-[11px] ${isOverdue ? 'text-rose-600 dark:text-rose-400 font-semibold' : ''}`}>
                              <Calendar className="w-3 h-3 opacity-65" />
                              <span>{task.dueDate}{task.dueTime ? ` · ${task.dueTime}` : ''}</span>
                            </span>
                          )}
                          {task.estimatedMinutes && (
                            <span className="flex items-center gap-1 font-mono text-[11px] opacity-75">
                              <Clock className="w-3 h-3 opacity-65" />
                              <span>{task.estimatedMinutes}m</span>
                            </span>
                          )}
                          {task.status !== 'todo' && task.status !== 'completed' && (
                            <span className="text-[11px] capitalize text-sky-600 dark:text-sky-400 font-medium">
                              · {task.status.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {!isCompleted && (
                        <button
                          type="button"
                          onClick={() => handleSendToCalendar(task)}
                          title="Send task to today's Calendar as a time block"
                          aria-label={`Send ${task.title} to Calendar`}
                          className="px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 transition-all hover:bg-black/5 cursor-pointer"
                          style={{
                            borderColor: 'var(--border)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <CalendarPlus className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                          <span className="hidden sm:inline">
                            {scheduledBlock ? 'On Calendar' : 'Send to Calendar'}
                          </span>
                        </button>
                      )}

                      {/* Typographic Priority with colored dot */}
                      <span className="flex items-center gap-1.5 text-xs font-medium">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{
                            backgroundColor:
                              task.priority === 'urgent'
                                ? 'var(--danger)'
                                : task.priority === 'high'
                                ? 'var(--warning)'
                                : 'var(--text-muted)',
                          }}
                        />
                        <span
                          className="capitalize text-[11px]"
                          style={{
                            color:
                              task.priority === 'urgent'
                                ? 'var(--danger)'
                                : task.priority === 'high'
                                ? 'var(--warning)'
                                : 'var(--text-secondary)',
                          }}
                        >
                          {task.priority}
                        </span>
                      </span>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startInlineEdit(task)}
                          title="Edit title inline"
                          className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => duplicateTask(task)}
                          title="Duplicate task"
                          className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteTask(task.id)}
                          title="Delete task"
                          className="p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 text-stone-400 hover:text-red-500 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
