// ==========================================
// DAYCRAFT — IN-APP NOTIFICATION ENGINE
// Expressive floating cards, sound feedback & stacking
// ==========================================

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { db } from '../database/db';
import { NotificationItem } from '../domain/models';
import { soundService } from '../services/soundService';

interface NotificationContextType {
  notifications: NotificationItem[];
  notify: (item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
  triggerCelebration: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const notify = useCallback((item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => {
    const settings = db.getSettings();

    // Check quiet hours
    if (settings.quietHoursEnabled) {
      const now = new Date();
      const currentH = now.getHours();
      const currentM = now.getMinutes();
      const currentTimeStr = `${String(currentH).padStart(2, '0')}:${String(currentM).padStart(2, '0')}`;
      if (currentTimeStr >= settings.quietHoursStart || currentTimeStr <= settings.quietHoursEnd) {
        // In quiet hours: don't play sound
      } else if (settings.soundEnabled) {
        soundService.playClick(settings.soundVolume);
      }
    } else if (settings.soundEnabled) {
      if (item.type === 'achievement' || item.type === 'task') {
        soundService.playCompletionChime(settings.soundVolume);
      } else {
        soundService.playClick(settings.soundVolume);
      }
    }

    const newNotification: NotificationItem = {
      ...item,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };

    setNotifications(prev => [newNotification, ...prev.slice(0, 4)]); // Stack max 5

    // Auto-dismiss after 4.5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== newNotification.id));
    }, 4500);
  }, []);

  const dismiss = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const triggerCelebration = useCallback(() => {
    const settings = db.getSettings();
    if (!settings.celebrationEnabled) return;

    // Respect app-level or system reduced-motion preference
    const prefersReduced =
      settings.reduceMotion === 'reduced' ||
      (settings.reduceMotion !== 'full' &&
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

    if (prefersReduced) return;

    try {
      confetti({
        particleCount: 45,
        spread: 55,
        origin: { y: 0.8 },
        colors: ['#C86D51', '#3E7051', '#7C5295', '#D47B5F', '#0284C7'],
      });
    } catch {
      // Confetti fallback
    }
  }, []);

  useEffect(() => {
    const unsubAchievements = db.subscribeAchievementUnlocks(unlocked => {
      if (!db.getSettings().gamificationEnabled) return;
      unlocked.forEach(ach => {
        notify({
          title: `Achievement Unlocked: ${ach.title}`,
          message: `${ach.description} (+${ach.xpReward} XP)`,
          type: 'achievement',
        });
      });
      if (unlocked.length > 0) {
        triggerCelebration();
      }
    });

    const unsubLevelUps = db.subscribeLevelUps(event => {
      if (!db.getSettings().gamificationEnabled) return;
      for (const reward of event.newlyClaimedRewards) {
        const themeNote = reward.unlockedThemeName
          ? ` · Theme "${reward.unlockedThemeName}" unlocked in Settings`
          : '';
        notify({
          title: `Level ${reward.level} Reached · ${reward.title}`,
          message: `${reward.rewardLabel}${themeNote}`,
          type: 'achievement',
        });
      }
      if (event.crossedLevels.length > 0 || event.newlyClaimedRewards.length > 0) {
        triggerCelebration();
      }
    });

    return () => {
      unsubAchievements();
      unsubLevelUps();
    };
  }, [notify, triggerCelebration]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        notify,
        dismiss,
        clearAll,
        triggerCelebration,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};
