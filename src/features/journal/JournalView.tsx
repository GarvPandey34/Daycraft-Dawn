import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  Calendar,
  Save,
  Search,
  Smile,
  Zap,
  Trash2,
  Tag,
  BarChart2,
  Eye,
  Edit3,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Flame,
  Timer,
} from 'lucide-react';
import { db } from '../../database/db';
import { useNotifications } from '../../notifications/NotificationContext';
import { JournalEntry } from '../../domain/models';
import { formatLocalDate } from '../../services/streakService';
import { MarkdownRenderer } from '../../components/MarkdownRenderer';
import {
  getDailyActivitySummary,
  formatDailySummaryMarkdown,
} from '../../services/workflowConnectService';

export const JournalView: React.FC = () => {
  const { notify } = useNotifications();
  const [, setTick] = useState(0);

  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit');
  const [showCorrelationGraph, setShowCorrelationGraph] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');

  // Active entry editor states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [entryDate, setEntryDate] = useState(formatLocalDate(new Date()));
  const [mood, setMood] = useState<number>(5);
  const [energy, setEnergy] = useState<number>(4);
  const [tagsInput, setTagsInput] = useState('');
  const [showDailySummaryFooter, setShowDailySummaryFooter] = useState(true);

  useEffect(() => {
    return db.subscribe(() => setTick(t => t + 1));
  }, []);

  const journalEntries = db.getJournalEntries();
  const dailySummary = getDailyActivitySummary(entryDate);

  const handleInsertDailySummary = () => {
    const markdownBlock = formatDailySummaryMarkdown(dailySummary);
    const nextContent = `${content.trim()}\n${markdownBlock}\n`;
    setContent(nextContent);
    setSaveStatus('dirty');
    notify({
      title: 'Activity Snapshot Added',
      message: `Inserted ${entryDate} summary into reflection.`,
      type: 'system',
    });
  };

  // Load first entry on initial view if available
  useEffect(() => {
    if (!selectedEntryId && journalEntries.length > 0) {
      loadEntry(journalEntries[0]);
    }
  }, [journalEntries]);

  const loadEntry = (entry: JournalEntry) => {
    setSelectedEntryId(entry.id);
    setTitle(entry.title);
    setContent(entry.content);
    setEntryDate(entry.date);
    setMood(entry.mood || 5);
    setEnergy(entry.energy || 4);
    setTagsInput(entry.tags?.join(', ') || '');
    setSaveStatus('saved');
  };

  const createNewEntry = () => {
    const today = formatLocalDate(new Date());
    const newEntry: JournalEntry = {
      id: `j_${Date.now()}`,
      date: today,
      title: 'Daily Reflection',
      content: '# Daily Reflection\n\n> Write freely about breakthroughs, struggles, and learnings today.\n\n### Mindful Focus\n- [ ] Uninterrupted deep work sprint\n- [ ] Walked outdoors or exercised\n\n### Breakthroughs & Observations\n',
      mood: 5,
      energy: 4,
      tags: ['reflection'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.saveJournalEntry(newEntry);
    loadEntry(newEntry);
    setEditorMode('edit');
    notify({ title: 'New Journal Entry', message: 'Ready for your reflection.', type: 'system' });
  };

  const handleSave = () => {
    if (!selectedEntryId) return;

    setSaveStatus('saving');
    const tags = tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);

    const updated: JournalEntry = {
      id: selectedEntryId,
      date: entryDate,
      title: title.trim() || 'Untitled Reflection',
      content,
      mood,
      energy,
      tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.saveJournalEntry(updated);
    setTimeout(() => {
      setSaveStatus('saved');
      notify({ title: 'Journal Saved', message: 'Encrypted & stored locally.', type: 'system' });
    }, 150);
  };

  const deleteEntry = (id: string) => {
    db.deleteJournalEntry(id);
    notify({ title: 'Entry Deleted', message: 'Journal reflection removed.', type: 'system' });
    setSelectedEntryId(null);
  };

  // Interactive Checklist toggle inside rendered markdown
  const handleToggleChecklist = (lineIndex: number, newChecked: boolean) => {
    const lines = content.split('\n');
    if (lineIndex < 0 || lineIndex >= lines.length) return;

    const line = lines[lineIndex];
    if (newChecked) {
      lines[lineIndex] = line.replace(/^(\s*-\s*\[)\s*(\]\s*.*)$/i, '$1x$2');
    } else {
      lines[lineIndex] = line.replace(/^(\s*-\s*\[)x(\]\s*.*)$/i, '$1 $2');
    }

    const updatedContent = lines.join('\n');
    setContent(updatedContent);

    if (selectedEntryId) {
      const entry = journalEntries.find(e => e.id === selectedEntryId);
      if (entry) {
        db.saveJournalEntry({
          ...entry,
          content: updatedContent,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  };

  // Tag Cloud computation
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    journalEntries.forEach(entry => {
      (entry.tags || []).forEach(tag => {
        const t = tag.trim().toLowerCase();
        if (t) counts[t] = (counts[t] || 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [journalEntries]);

  // Mood/Tag Correlation Analytics
  const tagMoodCorrelations = useMemo(() => {
    const correlationMap: Record<string, { totalMood: number; count: number }> = {};
    journalEntries.forEach(entry => {
      const moodVal = entry.mood;
      if (typeof moodVal === 'number') {
        (entry.tags || []).forEach(tag => {
          const t = tag.trim().toLowerCase();
          if (!t) return;
          if (!correlationMap[t]) correlationMap[t] = { totalMood: 0, count: 0 };
          correlationMap[t].totalMood += moodVal;
          correlationMap[t].count += 1;
        });
      }
    });

    return Object.entries(correlationMap)
      .map(([tag, data]) => ({
        tag,
        avgMood: parseFloat((data.totalMood / data.count).toFixed(1)),
        count: data.count,
      }))
      .sort((a, b) => b.avgMood - a.avgMood);
  }, [journalEntries]);

  // Filter entries
  const filtered = journalEntries.filter(j => {
    if (selectedTagFilter && !j.tags.some(t => t.toLowerCase() === selectedTagFilter.toLowerCase())) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      j.title.toLowerCase().includes(q) ||
      j.content.toLowerCase().includes(q) ||
      j.tags.some(t => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
            <BookOpen className="w-4 h-4" />
            <span>Private Sanctuary</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">Reflections & Journal Studio</h1>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Rich markdown reflections, interactive checklists, tag cloud filtering, and mood correlation insights.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setShowCorrelationGraph(prev => !prev)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border shadow-xs transition-all hover:bg-black/5"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >
            <BarChart2 className="w-4 h-4 text-amber-500" />
            <span>{showCorrelationGraph ? 'Hide Mood Graph' : 'Mood Correlations'}</span>
          </button>
          <button
            onClick={createNewEntry}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all hover:brightness-105 active:scale-98"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
          >
            <Plus className="w-4 h-4" />
            <span>New Reflection</span>
          </button>
        </div>
      </div>

      {/* INTERACTIVE MOOD / TAG CORRELATION GRAPH */}
      {showCorrelationGraph && tagMoodCorrelations.length > 0 && (
        <div
          className="p-5 rounded-2xl border shadow-sm space-y-3 animate-in fade-in"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-amber-500" />
              <h2 className="text-xs font-bold uppercase tracking-wider">
                Mood & Activity Correlation Analysis
              </h2>
            </div>
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              How your journal tags correlate with average subjective wellbeing (1.0 to 5.0)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {tagMoodCorrelations.map(item => {
              const percentage = (item.avgMood / 5.0) * 100;
              const isHigh = item.avgMood >= 4.0;
              const isLow = item.avgMood < 3.0;
              const barColor = isHigh ? '#16a34a' : isLow ? '#ef4444' : '#d97706';

              return (
                <button
                  key={item.tag}
                  onClick={() => setSelectedTagFilter(selectedTagFilter === item.tag ? null : item.tag)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selectedTagFilter === item.tag ? 'ring-2 ring-amber-500' : 'hover:brightness-95'
                  }`}
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold">#{item.tag}</span>
                    <span className="text-xs font-extrabold" style={{ color: barColor }}>
                      {item.avgMood} ★
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-black/10 overflow-hidden mb-1">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${percentage}%`, backgroundColor: barColor }}
                    />
                  </div>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {item.count} reflection{item.count > 1 ? 's' : ''} logged
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Editor & List layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Entries Index & Tag Cloud */}
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search reflections or content..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border text-xs focus-visible:outline-none"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
            />
          </div>

          {/* TAG CLOUD */}
          {tagCounts.length > 0 && (
            <div className="p-3 rounded-xl border space-y-2" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  <Tag className="w-3 h-3" />
                  Tag Cloud
                </span>
                {selectedTagFilter && (
                  <button
                    onClick={() => setSelectedTagFilter(null)}
                    className="text-[10px] text-amber-600 hover:underline flex items-center gap-0.5"
                  >
                    Clear Filter
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {tagCounts.map(([tag, count]) => {
                  const isActive = selectedTagFilter === tag;
                  return (
                    <button
                      key={tag}
                      onClick={() => setSelectedTagFilter(isActive ? null : tag)}
                      className={`text-[11px] px-2 py-0.5 rounded-lg border transition-all ${
                        isActive
                          ? 'bg-amber-500 text-white font-bold border-amber-500 shadow-xs'
                          : 'hover:bg-black/5 opacity-80'
                      }`}
                      style={{
                        borderColor: isActive ? 'transparent' : 'var(--border)',
                        backgroundColor: isActive ? 'var(--accent)' : 'var(--bg-surface-elevated)',
                        color: isActive ? 'var(--accent-foreground)' : 'var(--text-secondary)',
                      }}
                    >
                      #{tag} <span className="opacity-60 text-[9px]">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Entries List */}
          <div className="space-y-2 max-h-[520px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                No matching reflections found.
              </div>
            ) : (
              filtered.map(entry => {
                const isSelected = selectedEntryId === entry.id;
                return (
                  <button
                    key={entry.id}
                    onClick={() => loadEntry(entry)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                      isSelected ? 'shadow-xs font-semibold' : 'hover:brightness-95'
                    }`}
                    style={{
                      backgroundColor: isSelected ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                      borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                    }}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-sm font-bold truncate">{entry.title}</span>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{entry.date}</span>
                    </div>
                    <p className="text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                      {entry.content || 'Empty entry...'}
                    </p>
                    {entry.tags && entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {entry.tags.map(t => (
                          <span key={t} className="text-[9px] px-1 rounded bg-black/5 font-medium" style={{ color: 'var(--text-muted)' }}>
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Active Rich Editor / Markdown Renderer */}
        <div className="md:col-span-2">
          {selectedEntryId ? (
            <div
              className="p-6 rounded-2xl border shadow-sm space-y-4"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border)',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              {/* Editor Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <input
                  type="text"
                  value={title}
                  onChange={e => {
                    setTitle(e.target.value);
                    setSaveStatus('dirty');
                  }}
                  placeholder="Reflection title..."
                  className="text-lg font-bold bg-transparent focus-visible:outline-none flex-1"
                  style={{ color: 'var(--text-primary)' }}
                />

                <div className="flex items-center gap-2">
                  {/* Mode Toggle: Edit vs Preview */}
                  <div className="flex items-center p-0.5 rounded-lg border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface-subtle)' }}>
                    <button
                      onClick={() => setEditorMode('edit')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                        editorMode === 'edit' ? 'shadow-xs font-bold' : 'opacity-60 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: editorMode === 'edit' ? 'var(--bg-surface-elevated)' : 'transparent',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => setEditorMode('preview')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                        editorMode === 'preview' ? 'shadow-xs font-bold' : 'opacity-60 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: editorMode === 'preview' ? 'var(--bg-surface-elevated)' : 'transparent',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <Eye className="w-3 h-3" />
                      <span>Preview</span>
                    </button>
                  </div>

                  <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                    {saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'saving' ? 'Saving...' : '• Unsaved'}
                  </span>

                  <button
                    onClick={handleSave}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-xs"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>

                  <button
                    onClick={() => deleteEntry(selectedEntryId)}
                    title="Delete entry"
                    className="p-1.5 rounded-lg text-stone-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Mood & Energy Pickers */}
              <div className="flex flex-wrap items-center gap-6 py-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <div className="flex items-center gap-2">
                  <Smile className="w-4 h-4 text-amber-500" />
                  <span>Mood:</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(v => (
                      <button
                        key={v}
                        onClick={() => {
                          setMood(v);
                          setSaveStatus('dirty');
                        }}
                        className={`w-6 h-6 rounded-md text-xs font-bold border transition-all ${
                          mood === v ? 'bg-amber-500 text-white border-amber-500' : ''
                        }`}
                        style={{ borderColor: 'var(--border)' }}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-500" />
                  <span>Energy:</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(v => (
                      <button
                        key={v}
                        onClick={() => {
                          setEnergy(v);
                          setSaveStatus('dirty');
                        }}
                        className={`w-6 h-6 rounded-md text-xs font-bold border transition-all ${
                          energy === v ? 'bg-emerald-600 text-white border-emerald-600' : ''
                        }`}
                        style={{ borderColor: 'var(--border)' }}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="date"
                    value={entryDate}
                    onChange={e => {
                      setEntryDate(e.target.value);
                      setSaveStatus('dirty');
                    }}
                    className="px-2 py-0.5 rounded border text-xs"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
                  />
                </div>
              </div>

              {/* Content Body: Edit vs Rendered Markdown Preview */}
              {editorMode === 'edit' ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    <span>Markdown supported: **bold**, *italic*, # Header, &gt; quote, - [ ] checklist</span>
                    <button
                      onClick={() => setEditorMode('preview')}
                      className="text-amber-600 hover:underline flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" /> View Rendered
                    </button>
                  </div>
                  <textarea
                    rows={14}
                    value={content}
                    onChange={e => {
                      setContent(e.target.value);
                      setSaveStatus('dirty');
                    }}
                    placeholder="Write freely... Use markdown headings, checklists, and reflections."
                    className="w-full p-4 rounded-xl border text-sm leading-relaxed resize-none focus-visible:outline-none font-mono"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              ) : (
                <div
                  className="p-5 rounded-xl border min-h-[340px] max-h-[500px] overflow-y-auto"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                >
                  <MarkdownRenderer
                    content={content}
                    onToggleChecklist={handleToggleChecklist}
                  />
                </div>
              )}

              {/* Tags Input */}
              <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <Tag className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={tagsInput}
                  onChange={e => {
                    setTagsInput(e.target.value);
                    setSaveStatus('dirty');
                  }}
                  placeholder="Tags (comma-separated, e.g. reflection, deepwork, gratitude)..."
                  className="flex-1 px-3 py-1.5 rounded-lg border text-xs focus-visible:outline-none"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                />
              </div>

              {/* Quiet Collapsible Daily Activity Auto-Summary Footer */}
              <div
                className="rounded-xl border overflow-hidden"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border)',
                }}
              >
                <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDailySummaryFooter(prev => !prev)}
                    className="flex items-center gap-2 text-xs font-semibold cursor-pointer text-left"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {showDailySummaryFooter ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    <span>Daily Activity Context ({entryDate})</span>
                    <span
                      className="text-[11px] font-normal"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      · {dailySummary.completedTasks.length} tasks ·{' '}
                      {dailySummary.completedHabits.length} habits ·{' '}
                      {dailySummary.focusMinutes}m focus
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleInsertDailySummary}
                    className="px-2.5 py-1 rounded-lg border text-[11px] font-semibold hover:bg-black/5 cursor-pointer shrink-0"
                    style={{
                      borderColor: 'var(--border)',
                      color: 'var(--accent)',
                    }}
                  >
                    + Insert into Entry
                  </button>
                </div>

                {showDailySummaryFooter && (
                  <div
                    className="px-3.5 pb-3 pt-2 border-t grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="space-y-1">
                      <div
                        className="flex items-center gap-1.5 font-semibold text-[11px]"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Tasks Finished ({dailySummary.completedTasks.length})</span>
                      </div>
                      {dailySummary.completedTasks.length === 0 ? (
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          No tasks marked completed on this date.
                        </p>
                      ) : (
                        <ul className="space-y-0.5 text-[11px]" style={{ color: 'var(--text-primary)' }}>
                          {dailySummary.completedTasks.slice(0, 4).map(t => (
                            <li key={t.id} className="truncate">
                              • {t.title}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div
                        className="flex items-center gap-1.5 font-semibold text-[11px]"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <Flame className="w-3.5 h-3.5 text-amber-500" />
                        <span>Habits Logged ({dailySummary.completedHabits.length})</span>
                      </div>
                      {dailySummary.completedHabits.length === 0 ? (
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          No habits logged on this date.
                        </p>
                      ) : (
                        <ul className="space-y-0.5 text-[11px]" style={{ color: 'var(--text-primary)' }}>
                          {dailySummary.completedHabits.slice(0, 4).map(h => (
                            <li key={h.id} className="truncate">
                              • {h.name} ({h.recordedValue} {h.unit})
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div
                        className="flex items-center gap-1.5 font-semibold text-[11px]"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <Timer className="w-3.5 h-3.5 text-sky-500" />
                        <span>Deep Focus</span>
                      </div>
                      <p className="text-[11px]" style={{ color: 'var(--text-primary)' }}>
                        {dailySummary.focusMinutes} minutes across{' '}
                        {dailySummary.focusSessionsCount} session
                        {dailySummary.focusSessionsCount === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-16 text-center text-xs border rounded-2xl" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              Select an entry or create a new one to begin writing.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
