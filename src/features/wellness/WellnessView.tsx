import React, { useState, useEffect } from 'react';
import {
  Heart,
  Plus,
  Moon,
  Droplet,
  Footprints,
  Zap,
  Smile,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { db } from '../../database/db';
import { useNotifications } from '../../notifications/NotificationContext';
import { WellnessTracker } from '../../domain/models';
import { formatLocalDate } from '../../services/streakService';

export const WellnessView: React.FC = () => {
  const { notify } = useNotifications();
  const [, setTick] = useState(0);
  const [selectedDate, setSelectedDate] = useState(formatLocalDate(new Date()));

  useEffect(() => {
    return db.subscribe(() => setTick(t => t + 1));
  }, []);

  const trackers = db.getWellnessTrackers();
  const entries = db.getWellnessEntries(selectedDate);

  const logValue = (trackerId: string, value: number) => {
    db.recordWellnessEntry({
      id: `we_${trackerId}_${selectedDate}`,
      trackerId,
      date: selectedDate,
      value,
      recordedAt: new Date().toISOString(),
    });
    notify({ title: 'Wellness Metric Recorded', message: 'Logged privately on-device.', type: 'system' });
  };

  const getIcon = (category: WellnessTracker['category']) => {
    switch (category) {
      case 'sleep': return <Moon className="w-5 h-5 text-indigo-400" />;
      case 'hydration': return <Droplet className="w-5 h-5 text-sky-400" />;
      case 'movement': return <Footprints className="w-5 h-5 text-emerald-400" />;
      case 'energy': return <Zap className="w-5 h-5 text-amber-400" />;
      case 'mood': return <Smile className="w-5 h-5 text-yellow-400" />;
      default: return <Heart className="w-5 h-5 text-rose-400" />;
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
            <Heart className="w-4 h-4" />
            <span>Private Wellness Tracking</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">Wellness & Habits of Body</h1>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Calm, unpressured self-observation. All records are stored 100% privately on your device.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 rounded-xl border text-xs focus-visible:outline-none"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
          />
        </div>
      </div>

      {/* Privacy Notice Banner */}
      <div
        className="p-4 rounded-2xl border text-xs flex items-center gap-3"
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border)',
        }}
      >
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
        <span style={{ color: 'var(--text-secondary)' }}>
          <strong>Privacy Guaranteed:</strong> Wellness logs are optional personal self-observation (never medical advice) and remain 100% on your device with zero external transmission.
        </span>
      </div>

      {/* Tracker Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {trackers.filter(t => t.enabled).map(tracker => {
          const entry = entries.find(e => e.trackerId === tracker.id);
          const currentVal = entry?.value ?? 0;

          return (
            <div
              key={tracker.id}
              className="p-5 rounded-2xl border shadow-sm space-y-4"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border)',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface-subtle)' }}>
                    {getIcon(tracker.category)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                      {tracker.name}
                    </h3>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      Target: {tracker.targetDailyValue ? `${tracker.targetDailyValue} ` : ''}{tracker.unit}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                    {currentVal}
                  </span>
                  <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>
                    {tracker.unit}
                  </span>
                </div>
              </div>

              {/* Quick Input Controls */}
              <div className="pt-2 border-t flex items-center justify-end gap-2" style={{ borderColor: 'var(--border)' }}>
                {tracker.type === 'scale_5' ? (
                  <div className="flex gap-1.5 w-full justify-between">
                    {[1, 2, 3, 4, 5].map(rating => (
                      <button
                        key={rating}
                        onClick={() => logValue(tracker.id, rating)}
                        className={`flex-1 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                          currentVal === rating ? 'shadow-xs' : 'hover:bg-black/5'
                        }`}
                        style={{
                          backgroundColor: currentVal === rating ? 'var(--accent)' : 'var(--bg-surface)',
                          borderColor: currentVal === rating ? 'var(--accent)' : 'var(--border)',
                          color: currentVal === rating ? 'var(--accent-foreground)' : 'var(--text-primary)',
                        }}
                      >
                        {rating}
                      </button>
                    ))}
                  </div>
                ) : tracker.type === 'duration_hours' ? (
                  <div className="flex gap-2">
                    {[6, 7, 7.5, 8, 9].map(hrs => (
                      <button
                        key={hrs}
                        onClick={() => logValue(tracker.id, hrs)}
                        className={`px-3 py-1 rounded-lg border text-xs font-semibold ${
                          currentVal === hrs ? 'shadow-xs' : ''
                        }`}
                        style={{
                          backgroundColor: currentVal === hrs ? 'var(--accent)' : 'var(--bg-surface)',
                          borderColor: 'var(--border)',
                          color: currentVal === hrs ? 'var(--accent-foreground)' : 'var(--text-primary)',
                        }}
                      >
                        {hrs}h
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => logValue(tracker.id, Math.max(0, currentVal - 1))}
                      className="px-3 py-1 rounded-lg border text-xs font-bold"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      -1
                    </button>
                    <button
                      onClick={() => logValue(tracker.id, currentVal + 1)}
                      className="px-3 py-1 rounded-lg border text-xs font-bold shadow-xs"
                      style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
                    >
                      +1 {tracker.unit}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
