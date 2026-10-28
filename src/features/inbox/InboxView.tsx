import React, { useState, useEffect } from 'react';
import {
  Inbox,
  Plus,
  CheckCircle2,
  Calendar,
  Folder,
  Tag,
  Trash2,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { db } from '../../database/db';
import { useNotifications } from '../../notifications/NotificationContext';
import { parseNaturalLanguageInput } from '../../services/nlpParserService';
import { Task } from '../../domain/models';
import { formatLocalDate } from '../../services/streakService';

export const InboxView: React.FC = () => {
  const { notify } = useNotifications();
  const [, setTick] = useState(0);
  const [quickInput, setQuickInput] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [filterTag, setFilterTag] = useState<string>('');

  useEffect(() => {
    return db.subscribe(() => setTick(t => t + 1));
  }, []);

  const allTasks = db.getTasks();
  const projects = db.getProjects();
  // Inbox tasks: tasks with status 'inbox' or tasks without project/due date
  const inboxTasks = allTasks.filter(
    t => !t.archived && (t.status === 'inbox' || (!t.projectId && !t.dueDate && t.status !== 'completed'))
  );

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;

    const parsed = parseNaturalLanguageInput(quickInput);
    const now = new Date().toISOString();

    const newTask: Task = {
      id: `t_${Date.now()}`,
      title: parsed.title,
      description: '',
      createdAt: now,
      updatedAt: now,
      status: parsed.date ? 'todo' : 'inbox',
      priority: parsed.priority || 'medium',
      dueDate: parsed.date,
      dueTime: parsed.time,
      estimatedMinutes: parsed.durationMinutes,
      tags: parsed.tags,
      archived: false,
    };

    db.saveTask(newTask);
    notify({
      title: 'Captured to Inbox',
      message: `"${parsed.title}" saved locally.`,
      type: 'task',
    });
    setQuickInput('');
  };

  const assignProject = (task: Task, projectId: string) => {
    db.saveTask({
      ...task,
      projectId: projectId || undefined,
      status: 'todo',
    });
    notify({
      title: 'Task Classified',
      message: `Assigned to project.`,
      type: 'system',
    });
  };

  const scheduleForToday = (task: Task) => {
    db.saveTask({
      ...task,
      dueDate: formatLocalDate(new Date()),
      status: 'todo',
    });
    notify({
      title: 'Scheduled for Today',
      message: `Moved "${task.title}" to My Day.`,
      type: 'task',
    });
  };

  const deleteTask = (id: string) => {
    db.deleteTask(id);
    notify({ title: 'Task Deleted', message: 'Item removed from inbox.', type: 'system' });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
            <Inbox className="w-4 h-4" />
            <span>Rapid Capture</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">Inbox</h1>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Quick capture ideas, tasks, and notes now. Organize, classify, and schedule later.
          </p>
        </div>

        <span className="text-xs font-semibold px-3 py-1 rounded-full border self-start sm:self-auto" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface-elevated)' }}>
          {inboxTasks.length} Unsorted Item(s)
        </span>
      </div>

      {/* Rapid Entry Input */}
      <form onSubmit={handleQuickSubmit} className="flex gap-2">
        <input
          type="text"
          value={quickInput}
          onChange={e => setQuickInput(e.target.value)}
          placeholder="Capture an unsorted task or idea... (e.g. Call architect tomorrow at 3pm #client)"
          className="flex-1 px-4 py-3 rounded-xl border text-sm focus-visible:outline-none"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
          }}
        />
        <button
          type="submit"
          className="px-5 py-3 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all hover:brightness-105 active:scale-98"
          style={{
            backgroundColor: 'var(--accent)',
            color: 'var(--accent-foreground)',
          }}
        >
          <Plus className="w-4 h-4" />
          <span>Capture</span>
        </button>
      </form>

      {/* Task List */}
      <div
        className="rounded-2xl border shadow-sm overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <div className="px-5 py-3 border-b flex items-center justify-between text-xs font-semibold" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface-subtle)' }}>
          <span>Unsorted Records ({inboxTasks.length})</span>
          <span style={{ color: 'var(--text-muted)' }}>Classify into projects or dates</span>
        </div>

        {inboxTasks.length === 0 ? (
          <div className="p-12 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            Inbox zero! All captured tasks have been organized.
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {inboxTasks.map(task => (
              <div key={task.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {task.title}
                  </h3>
                  {task.tags && task.tags.length > 0 && (
                    <div className="flex gap-1.5 mt-1">
                      {task.tags.map(t => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick actions for classifying */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={() => scheduleForToday(task)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium hover:opacity-80"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
                  >
                    <Calendar className="w-3.5 h-3.5 text-sky-500" />
                    <span>Today</span>
                  </button>

                  <select
                    value={task.projectId || ''}
                    onChange={e => assignProject(task, e.target.value)}
                    className="px-2.5 py-1 rounded-lg border text-xs focus-visible:outline-none"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
                  >
                    <option value="">Move to Project...</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>

                  <button
                    onClick={() => deleteTask(task.id)}
                    aria-label={`Delete task: ${task.title}`}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
