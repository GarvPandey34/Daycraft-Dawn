import React, { useState, useEffect } from 'react';
import { BookOpen, X, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  tutorialManager,
  TutorialTopicId,
} from '../services/tutorialService';
import { useMotionPreference } from '../theme/motion';
import { navigationManager } from './navigationState';

interface ContextualHintBannerProps {
  hintId: string;
  title: string;
  description: string;
  topicId: TutorialTopicId;
}

export const ContextualHintBanner: React.FC<ContextualHintBannerProps> = ({
  hintId,
  title,
  description,
  topicId,
}) => {
  const { isReduced } = useMotionPreference();
  const [dismissed, setDismissed] = useState<boolean>(() =>
    tutorialManager.isHintDismissed(hintId)
  );

  useEffect(() => {
    setDismissed(tutorialManager.isHintDismissed(hintId));
    return tutorialManager.subscribe(() => {
      setDismissed(tutorialManager.isHintDismissed(hintId));
    });
  }, [hintId]);

  const handleDismiss = () => {
    tutorialManager.dismissHint(hintId);
    setDismissed(true);
  };

  const handleOpenTutorial = () => {
    tutorialManager.startTutorial(topicId);
    navigationManager.setView('tutorial');
  };

  return (
    <AnimatePresence initial={false}>
      {!dismissed && (
        <motion.div
          initial={isReduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={isReduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
          transition={{ duration: isReduced ? 0.08 : 0.18 }}
          role="region"
          aria-label={`Tip: ${title}`}
          className="p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <div
              className="p-1.5 rounded-lg shrink-0 mt-0.5"
              style={{
                backgroundColor: 'var(--accent-subtle)',
                color: 'var(--accent)',
              }}
            >
              <BookOpen className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span
                className="font-bold block"
                style={{ color: 'var(--text-primary)' }}
              >
                {title}
              </span>
              <span
                className="text-[11px] block mt-0.5 leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                {description}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={handleOpenTutorial}
              className="px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--accent)',
              }}
            >
              <span>Open Guide</span>
              <ArrowRight className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              aria-label={`Dismiss tip: ${title}`}
              title="Dismiss tip"
              className="p-1.5 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
