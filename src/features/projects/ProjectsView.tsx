import React, { useState, useEffect } from 'react';
import {
  Folder,
  Plus,
  CheckCircle2,
  Circle,
  Calendar,
  Trash2,
  Edit2,
  ListTodo,
  Check,
  Archive,
} from 'lucide-react';
import { db } from '../../database/db';
import { useNotifications } from '../../notifications/NotificationContext';
import { Project, Task } from '../../domain/models';

export const ProjectsView: React.FC = () => {
  const { notify, triggerCelebration } = useNotifications();
  const [, setTick] = useState(0);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#C86D51');
  const [targetDate, setTargetDate] = useState('');

  // Milestone inline creation
  const [milestoneInput, setMilestoneInput] = useState('');

  useEffect(() => {
    return db.subscribe(() => setTick(t => t + 1));
  }, []);

  const projects = db.getProjects();
  const tasks = db.getTasks().filter(t => !t.archived);

  // Default select first project if none selected
  const activeProject = projects.find(p => p.id === selectedProjectId) || projects[0];

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const now = new Date().toISOString();
    const newProject: Project = {
      id: `p_${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      color,
      icon: 'Folder',
      targetDate: targetDate || undefined,
      status: 'in_progress',
      milestones: [],
      createdAt: now,
      updatedAt: now,
    };

    db.saveProject(newProject);
    notify({ title: 'Project Created', message: `Initialized "${newProject.name}"`, type: 'system' });
    setSelectedProjectId(newProject.id);
    setName('');
    setDescription('');
    setIsCreating(false);
  };

  const addMilestone = () => {
    if (!milestoneInput.trim() || !activeProject) return;
    const updatedMilestones = [
      ...activeProject.milestones,
      {
        id: `m_${Date.now()}`,
        title: milestoneInput.trim(),
        completed: false,
      },
    ];

    db.saveProject({
      ...activeProject,
      milestones: updatedMilestones,
      status: activeProject.status === 'completed' ? 'in_progress' : activeProject.status,
    });
    setMilestoneInput('');
  };

  const toggleMilestone = (mId: string) => {
    if (!activeProject) return;
    const wasCompleted = activeProject.status === 'completed';
    const updated = activeProject.milestones.map(m => {
      if (m.id === mId) {
        return { ...m, completed: !m.completed, completedAt: !m.completed ? new Date().toISOString() : undefined };
      }
      return m;
    });

    const allMilestonesDone = updated.length > 0 && updated.every(m => m.completed);
    const nextStatus: Project['status'] = allMilestonesDone
      ? 'completed'
      : activeProject.status === 'completed'
        ? 'in_progress'
        : activeProject.status;

    db.saveProject({
      ...activeProject,
      milestones: updated,
      status: nextStatus,
    });

    if (nextStatus === 'completed' && !wasCompleted) {
      notify({
        title: 'Project Completed!',
        message: `All milestones finished for "${activeProject.name}"`,
        type: 'achievement',
      });
      triggerCelebration();
    }
  };

  const toggleProjectStatus = (project: Project) => {
    const nextStatus: Project['status'] = project.status === 'completed' ? 'in_progress' : 'completed';
    db.saveProject({
      ...project,
      status: nextStatus,
    });

    if (nextStatus === 'completed') {
      notify({
        title: 'Project Completed!',
        message: `Marked "${project.name}" as completed.`,
        type: 'achievement',
      });
      triggerCelebration();
    } else {
      notify({
        title: 'Project Reopened',
        message: `"${project.name}" is now active.`,
        type: 'system',
      });
    }
  };

  const deleteProject = (id: string) => {
    db.deleteProject(id);
    notify({ title: 'Project Deleted', message: 'Project removed.', type: 'system' });
    if (selectedProjectId === id) setSelectedProjectId(null);
  };

  const projectTasks = activeProject ? tasks.filter(t => t.projectId === activeProject.id) : [];
  const completedCount = projectTasks.filter(t => t.status === 'completed').length;
  const progressPercent = projectTasks.length > 0 ? Math.round((completedCount / projectTasks.length) * 100) : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
            <Folder className="w-4 h-4" />
            <span>Structured Work</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">Projects & Milestones</h1>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Connect tasks, track milestones, and measure progress deterministically.
          </p>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all hover:brightness-105 active:scale-98 self-start sm:self-auto"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* Creation Form */}
      {isCreating && (
        <form
          onSubmit={handleCreateProject}
          className="p-5 rounded-2xl border shadow-md space-y-4 animate-in fade-in"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border)',
          }}
        >
          <h3 className="text-sm font-bold">Initiate Project</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                Project Title *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Daycraft Production Release"
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

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
              Description & Objectives
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What are the key outcomes of this project?"
              className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
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
              Create Project
            </button>
          </div>
        </form>
      )}

      {/* Projects Grid / Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Project Selector List */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            All Projects ({projects.length})
          </h3>

          <div className="space-y-2">
            {projects.map(p => {
              const pTasks = tasks.filter(t => t.projectId === p.id);
              const pDone = pTasks.filter(t => t.status === 'completed').length;
              const pct = pTasks.length > 0 ? Math.round((pDone / pTasks.length) * 100) : 0;
              const isSelected = activeProject?.id === p.id;

              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedProjectId(p.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                    isSelected ? 'shadow-sm font-semibold' : 'hover:brightness-95'
                  }`}
                  style={{
                    backgroundColor: isSelected ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                    borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                  }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-bold truncate">{p.name}</span>
                    <span className="text-xs font-mono font-bold" style={{ color: 'var(--text-secondary)' }}>{pct}%</span>
                  </div>

                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-surface-subtle)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: p.color || 'var(--accent)' }} />
                  </div>

                  <div className="flex justify-between items-center text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
                    <span>{pTasks.length} task(s)</span>
                    <span className="capitalize">{p.status.replace('_', ' ')}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Active Project Detail */}
        {activeProject ? (
          <div className="md:col-span-2 space-y-6">
            <div
              className="p-6 rounded-2xl border shadow-sm space-y-4"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border)',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <div className="flex justify-between items-start gap-3">
                <div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    {activeProject.name}
                  </h2>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {activeProject.description || 'No description provided.'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleProjectStatus(activeProject)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                      activeProject.status === 'completed'
                        ? 'bg-emerald-600/10 text-emerald-600 border-emerald-600/30'
                        : 'hover:bg-black/5'
                    }`}
                    style={
                      activeProject.status === 'completed'
                        ? undefined
                        : { borderColor: 'var(--border)', color: 'var(--text-primary)' }
                    }
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{activeProject.status === 'completed' ? 'Completed (Reopen)' : 'Mark Completed'}</span>
                  </button>
                  <button
                    onClick={() => deleteProject(activeProject.id)}
                    title="Delete project"
                    className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>Completion Rate ({completedCount} / {projectTasks.length} tasks)</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-surface-subtle)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${progressPercent}%`, backgroundColor: activeProject.color || 'var(--accent)' }} />
                </div>
              </div>

              {/* Milestones Section */}
              <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Milestones
                </h3>

                <div className="space-y-2 mb-3">
                  {activeProject.milestones.map(m => (
                    <div
                      key={m.id}
                      onClick={() => toggleMilestone(m.id)}
                      className="p-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer hover:bg-black/5"
                      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${m.completed ? 'bg-emerald-600 border-emerald-600 text-white' : ''}`}>
                          {m.completed && <Check className="w-3 h-3" />}
                        </div>
                        <span className={m.completed ? 'line-through opacity-60' : ''}>{m.title}</span>
                      </div>
                      {m.targetDate && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{m.targetDate}</span>}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={milestoneInput}
                    onChange={e => setMilestoneInput(e.target.value)}
                    placeholder="Add milestone..."
                    className="flex-1 px-3 py-1.5 rounded-lg border text-xs"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                    onKeyDown={e => e.key === 'Enter' && addMilestone()}
                  />
                  <button
                    onClick={addMilestone}
                    className="px-3 py-1.5 rounded-lg border text-xs font-semibold"
                    style={{ backgroundColor: 'var(--bg-surface-subtle)', borderColor: 'var(--border)' }}
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Linked Tasks */}
              <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Linked Tasks ({projectTasks.length})
                </h3>

                <div className="divide-y text-xs" style={{ borderColor: 'var(--border)' }}>
                  {projectTasks.map(t => (
                    <div key={t.id} className="py-2.5 flex items-center justify-between">
                      <span className={t.status === 'completed' ? 'line-through opacity-50' : ''}>{t.title}</span>
                      <span className="text-[10px] uppercase font-bold" style={{ color: 'var(--text-secondary)' }}>{t.priority}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="md:col-span-2 p-12 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            Select a project to inspect details.
          </div>
        )}
      </div>
    </div>
  );
};
