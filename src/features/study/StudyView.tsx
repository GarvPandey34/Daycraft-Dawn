import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Plus,
  BookOpen,
  Clock,
  Calendar,
  CheckCircle2,
  Trash2,
  Target,
} from 'lucide-react';
import { db } from '../../database/db';
import { useNotifications } from '../../notifications/NotificationContext';
import { StudySession, StudySubject } from '../../domain/models';
import { addDays, formatLocalDate } from '../../services/streakService';

export interface SubjectStudyStats {
  weeklyMinutes: number;
  weeklyHours: number;
  allTimeMinutes: number;
  allTimeHours: number;
  weeklyProgressPct: number;
  weeklySessionCount: number;
  totalSessionCount: number;
}

export function calculateSubjectStudyStats(
  sessions: StudySession[],
  subjectId: string,
  weeklyGoalHours: number,
  todayStr: string = formatLocalDate(new Date())
): SubjectStudyStats {
  const weekStartStr = addDays(todayStr, -6);
  const subSessions = sessions.filter(s => s.subjectId === subjectId);
  const weeklySessions = subSessions.filter(s => s.date >= weekStartStr && s.date <= todayStr);
  const weeklyMinutes = weeklySessions.reduce((acc, s) => acc + s.durationMinutes, 0);
  const allTimeMinutes = subSessions.reduce((acc, s) => acc + s.durationMinutes, 0);
  const weeklyHours = Math.round((weeklyMinutes / 60) * 10) / 10;
  const allTimeHours = Math.round((allTimeMinutes / 60) * 10) / 10;
  const targetMinutes = Math.max(1, weeklyGoalHours * 60);
  const weeklyProgressPct = Math.min(100, Math.round((weeklyMinutes / targetMinutes) * 100));

  return {
    weeklyMinutes,
    weeklyHours,
    allTimeMinutes,
    allTimeHours,
    weeklyProgressPct,
    weeklySessionCount: weeklySessions.length,
    totalSessionCount: subSessions.length,
  };
}

export const StudyView: React.FC = () => {
  const { notify } = useNotifications();
  const [, setTick] = useState(0);

  // Subject creation
  const [isCreatingSubject, setIsCreatingSubject] = useState(false);
  const [subjectName, setSubjectName] = useState('');
  const [weeklyGoalHours, setWeeklyGoalHours] = useState(5);
  const [topicsInput, setTopicsInput] = useState('');

  // Log session form
  const [isLoggingSession, setIsLoggingSession] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [sessionTopic, setSessionTopic] = useState('');
  const [durationMins, setDurationMins] = useState(45);
  const [sessionNotes, setSessionNotes] = useState('');

  useEffect(() => {
    return db.subscribe(() => setTick(t => t + 1));
  }, []);

  const todayStr = formatLocalDate(new Date());
  const subjects = db.getStudySubjects();
  const sessions = db.getStudySessions();

  const handleCreateSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectName.trim()) return;

    const topics = topicsInput.split(',').map(t => t.trim()).filter(Boolean);
    const newSub: StudySubject = {
      id: `sub_${Date.now()}`,
      name: subjectName.trim(),
      color: '#C86D51',
      icon: 'BookOpen',
      weeklyGoalHours,
      topics,
      createdAt: new Date().toISOString(),
    };

    db.saveStudySubject(newSub);
    notify({ title: 'Study Subject Created', message: `Added "${newSub.name}"`, type: 'system' });
    setSubjectName('');
    setTopicsInput('');
    setIsCreatingSubject(false);
  };

  const handleLogSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId) return;

    const newSession: StudySession = {
      id: `ss_${Date.now()}`,
      subjectId: selectedSubjectId,
      date: todayStr,
      durationMinutes: durationMins,
      topic: sessionTopic.trim() || undefined,
      notes: sessionNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    const outcome = db.recordStudySession(newSession);
    notify({
      title: 'Study Session Logged',
      message:
        outcome.xpAwarded > 0
          ? `Logged ${durationMins}m (+${outcome.xpAwarded} XP)`
          : `Logged ${durationMins}m`,
      type: 'focus',
    });
    setSessionTopic('');
    setSessionNotes('');
    setIsLoggingSession(false);
  };

  const deleteSubject = (id: string) => {
    db.deleteStudySubject(id);
    notify({ title: 'Subject Removed', message: 'Subject and records deleted.', type: 'system' });
  };

  const deleteSession = (id: string) => {
    db.deleteStudySession(id);
    notify({ title: 'Study Session Deleted', message: 'Session record removed.', type: 'system' });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
            <GraduationCap className="w-4 h-4" />
            <span>Learning Mode</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">Study & Learning Sessions</h1>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Track study subjects, revision goals, and curriculum progress.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLoggingSession(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border shadow-xs cursor-pointer"
            style={{ backgroundColor: 'var(--bg-surface-elevated)', borderColor: 'var(--border)' }}
          >
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
            <span>Log Session</span>
          </button>
          <button
            onClick={() => setIsCreatingSubject(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all hover:brightness-105 active:scale-98 cursor-pointer"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
          >
            <Plus className="w-4 h-4" />
            <span>New Subject</span>
          </button>
        </div>
      </div>

      {/* Creation Drawer */}
      {isCreatingSubject && (
        <form
          onSubmit={handleCreateSubject}
          className="p-5 rounded-2xl border shadow-md space-y-4 animate-in fade-in"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border)',
          }}
        >
          <h3 className="text-sm font-bold">New Learning Subject</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                Subject Name *
              </label>
              <input
                type="text"
                required
                value={subjectName}
                onChange={e => setSubjectName(e.target.value)}
                placeholder="e.g. Distributed Systems"
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                Weekly Target (Hours)
              </label>
              <input
                type="number"
                min={1}
                value={weeklyGoalHours}
                onChange={e => setWeeklyGoalHours(parseInt(e.target.value) || 5)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
              Curriculum Topics (Comma-separated)
            </label>
            <input
              type="text"
              value={topicsInput}
              onChange={e => setTopicsInput(e.target.value)}
              placeholder="e.g. Consensus, Raft, Paxos, Vector Clocks"
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              type="button"
              onClick={() => setIsCreatingSubject(false)}
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
              Save Subject
            </button>
          </div>
        </form>
      )}

      {/* Log Session Drawer */}
      {isLoggingSession && (
        <form
          onSubmit={handleLogSession}
          className="p-5 rounded-2xl border shadow-md space-y-4 animate-in fade-in"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border)',
          }}
        >
          <h3 className="text-sm font-bold">Log Study Session</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                Select Subject *
              </label>
              <select
                required
                value={selectedSubjectId}
                onChange={e => setSelectedSubjectId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
              >
                <option value="">Select subject...</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                Duration (Minutes)
              </label>
              <input
                type="number"
                min={5}
                max={360}
                value={durationMins}
                onChange={e => setDurationMins(parseInt(e.target.value) || 45)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
              Topic Covered
            </label>
            <input
              type="text"
              value={sessionTopic}
              onChange={e => setSessionTopic(e.target.value)}
              placeholder="e.g. Chapter 4: SQLite WAL Mode mechanics"
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
              Session Notes / Key Takeaways
            </label>
            <textarea
              rows={2}
              value={sessionNotes}
              onChange={e => setSessionNotes(e.target.value)}
              placeholder="Optional summary, formulas, or questions for next review..."
              className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              type="button"
              onClick={() => setIsLoggingSession(false)}
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
              Commit Session
            </button>
          </div>
        </form>
      )}

      {/* Subjects Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {subjects.map(sub => {
          const stats = calculateSubjectStudyStats(sessions, sub.id, sub.weeklyGoalHours, todayStr);

          return (
            <div
              key={sub.id}
              className="p-5 rounded-2xl border shadow-sm space-y-3"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border)',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                    {sub.name}
                  </h3>
                </div>
                <button
                  onClick={() => deleteSubject(sub.id)}
                  title="Delete subject"
                  className="p-1 text-stone-400 hover:text-red-500 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  <span>This Week: {stats.weeklyHours}h / {sub.weeklyGoalHours}h target</span>
                  <span>All-Time: {stats.allTimeHours}h ({stats.totalSessionCount} sessions)</span>
                </div>
                <div className="w-full h-2 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${stats.weeklyProgressPct}%`,
                      backgroundColor: 'var(--accent)',
                    }}
                  />
                </div>
              </div>

              {sub.topics && sub.topics.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  {sub.topics.map(t => (
                    <span key={t} className="text-[10px] px-2 py-0.5 rounded-md border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recent Study Sessions Table */}
      <div
        className="p-5 rounded-2xl border shadow-sm"
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-600" />
          <span>Study Sessions History ({sessions.length})</span>
        </h3>

        {sessions.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            No study sessions recorded yet.
          </p>
        ) : (
          <div className="divide-y text-xs" style={{ borderColor: 'var(--border)' }}>
            {sessions.slice(-8).reverse().map(s => {
              const sub = subjects.find(sub => sub.id === s.subjectId);
              return (
                <div key={s.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-semibold block">{s.topic || sub?.name || 'Study session'}</span>
                    <span className="text-[11px] block" style={{ color: 'var(--text-muted)' }}>
                      {s.date} • {sub?.name}
                    </span>
                    {s.notes && (
                      <p className="text-[11px] mt-0.5 italic" style={{ color: 'var(--text-secondary)' }}>
                        {s.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold font-mono px-2 py-0.5 rounded border" style={{ borderColor: 'var(--border)' }}>
                      {s.durationMinutes}m
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteSession(s.id)}
                      title="Delete study session"
                      aria-label={`Delete study session ${s.topic || sub?.name || s.id}`}
                      className="p-1 rounded-md text-stone-400 hover:text-red-500 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
