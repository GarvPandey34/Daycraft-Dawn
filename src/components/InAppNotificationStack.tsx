import React from 'react';
import {
  CheckCircle2,
  Flame,
  Timer,
  Trophy,
  Bell,
  AlertCircle,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications } from '../notifications/NotificationContext';
import { NotificationItem } from '../domain/models';
import { useMotionPreference } from '../theme/motion';

export const InAppNotificationStack: React.FC = () => {
  const { notifications, dismiss } = useNotifications();
  const { variants } = useMotionPreference();

  const renderIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'task':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />;
      case 'habit':
        return <Flame className="w-5 h-5 text-amber-500 shrink-0" />;
      case 'focus':
        return <Timer className="w-5 h-5 text-indigo-500 shrink-0" />;
      case 'achievement':
        return <Trophy className="w-5 h-5 text-yellow-500 shrink-0" />;
      case 'reminder':
        return <Bell className="w-5 h-5 text-sky-500 shrink-0" />;
      default:
        return <AlertCircle className="w-5 h-5 text-stone-500 shrink-0" />;
    }
  };

  return (
    <aside
      aria-label="Notifications"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
    >
      <AnimatePresence initial={false}>
        {notifications.map((item) => (
          <motion.div
            key={item.id}
            layout
            variants={variants.toastItem}
            initial="initial"
            animate="animate"
            exit="exit"
            role="status"
            className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl shadow-lg border"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div className="mt-0.5">{renderIcon(item.type)}</div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>
                {item.title}
              </h4>
              <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                {item.message}
              </p>
            </div>
            <button
              onClick={() => dismiss(item.id)}
              aria-label={`Dismiss notification: ${item.title}`}
              className="p-1 rounded-md transition-colors hover:opacity-75 focus-visible:outline-none cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </aside>
  );
};
