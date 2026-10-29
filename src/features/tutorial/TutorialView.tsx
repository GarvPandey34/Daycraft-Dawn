import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Compass,
  CheckSquare,
  Flame,
  Target,
  Timer,
  Trophy,
  Calendar,
  HeartPulse,
  Shield,
  Play,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  X,
  ArrowRight,
  Clock,
  Layers,
} from 'lucide-react';
import {
  TUTORIAL_TOPICS,
  tutorialManager,
  TutorialTopicId,
  TutorialTopic,
  TutorialProgressState,
  ActiveWalkthroughSession,
} from '../../services/tutorialService';
import { Destination } from '../../components/navigationState';
import { motion, AnimatePresence } from 'motion/react';
import { useMotionPreference } from '../../theme/motion';

interface TutorialViewProps {
  onNavigate: (destination: Destination) => void;
  onOpenQuickAdd?: () => void;
  onClose?: () => void;
}

const TOPIC_ICON_MAP: Record<TutorialTopicId, React.ComponentType<{ className?: string }>> = {
  getting_started: Compass,
  tasks_myday: CheckSquare,
  habits_routines: Flame,
  goals_milestones: Target,
  focus_mode: Timer,
  achievements_themes: Trophy,
  calendar_projects_study: Calendar,
  wellness_journal_insights: HeartPulse,
  settings_privacy_backups: Shield,
};

const WORKSPACE_PILLARS = [
  {
    title: 'Daily Flow',
    subtitle: 'My Day, Tasks & Focus',
    description: 'Plan your priorities, schedule time blocks, and enter deep work timers.',
    destination: 'home' as Destination,
    icon: CheckSquare,
  },
  {
    title: 'Consistency & Growth',
    subtitle: 'Habits, Routines & Goals',
    description: 'Build sustainable daily rituals and track milestone-driven long-term goals.',
    destination: 'habits' as Destination,
    icon: Flame,
  },
  {
    title: 'Reflection & Insights',
    subtitle: 'Journal, Wellness & Insights',
    description: 'Capture quiet reflections, optional self-observations, and real activity trends.',
    destination: 'journal' as Destination,
    icon: HeartPulse,
  },
  {
    title: 'Progression & Ownership',
    subtitle: 'Achievements, Themes & Backups',
    description: 'Unlock botanical themes through real XP and keep 100% control of your local data.',
    destination: 'achievements' as Destination,
    icon: Trophy,
  },
];

export const TutorialView: React.FC<TutorialViewProps> = ({
  onNavigate,
  onOpenQuickAdd,
  onClose,
}) => {
  const { variants, transitions } = useMotionPreference();
  const [progressState, setProgressState] = useState<TutorialProgressState>(() =>
    tutorialManager.getProgressState()
  );
  const [activeSession, setActiveSession] = useState<ActiveWalkthroughSession | null>(() =>
    tutorialManager.getActiveSession()
  );
  const modalFirstButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    return tutorialManager.subscribe(() => {
      setProgressState(tutorialManager.getProgressState());
      setActiveSession(tutorialManager.getActiveSession());
    });
  }, []);

  const activeTopic: TutorialTopic | undefined = activeSession
    ? TUTORIAL_TOPICS.find((t) => t.id === activeSession.topicId)
    : undefined;

  const activeStep =
    activeTopic && activeSession ? activeTopic.steps[activeSession.stepIndex] : undefined;

  const handleCloseTutorial = () => {
    tutorialManager.exitWalkthrough();
    if (onClose) {
      onClose();
    } else {
      onNavigate('home');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (activeTopic) {
          tutorialManager.exitWalkthrough();
        } else {
          handleCloseTutorial();
        }
      } else if (activeTopic && e.key === 'ArrowRight') {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          e.preventDefault();
          tutorialManager.nextStep();
        }
      } else if (activeTopic && e.key === 'ArrowLeft') {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          e.preventDefault();
          tutorialManager.prevStep();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTopic, onClose, onNavigate]);

  useEffect(() => {
    if (activeTopic && modalFirstButtonRef.current) {
      modalFirstButtonRef.current.focus();
    }
  }, [activeTopic?.id]);

  const { completedCount, totalCount, percent: completionPercent } =
    tutorialManager.getCompletionSummary();

  const handleActionTrigger = (destination?: Destination, openQuickAdd?: boolean) => {
    if (openQuickAdd && onOpenQuickAdd) {
      tutorialManager.exitWalkthrough();
      onOpenQuickAdd();
      return;
    }
    if (destination) {
      tutorialManager.exitWalkthrough();
      onNavigate(destination);
    }
  };

  return (
    <motion.div
      variants={variants.cardListContainer}
      initial="initial"
      animate="animate"
      className="p-6 max-w-6xl mx-auto space-y-8 pb-12"
    >
      {/* Header Banner */}
      <motion.div
        variants={variants.cardItem}
        className="rounded-3xl p-6 sm:p-8 border shadow-sm relative overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        {/* Top-right Close Icon Button */}
        <button
          type="button"
          onClick={handleCloseTutorial}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 rounded-xl border transition-colors hover:opacity-80 cursor-pointer"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border)',
            color: 'var(--text-secondary)',
          }}
          title="Close Tutorial (Esc)"
          aria-label="Close Tutorial"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pr-8 sm:pr-10">
          <div className="space-y-3 max-w-2xl">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{
                backgroundColor: 'var(--accent-subtle)',
                color: 'var(--accent)',
              }}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Permanent Guide &amp; Interactive Walkthroughs</span>
            </div>
            <h1
              className="text-2xl sm:text-3xl font-bold tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              App Tutorial
            </h1>
            <p
              className="text-sm sm:text-base leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              Welcome to Daycraft. Learn the essentials at your own pace, and come back whenever you need a refresher.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() =>
                tutorialManager.startFullTour({
                  restart: completedCount === totalCount,
                })
              }
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity shadow-xs cursor-pointer"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-foreground)',
              }}
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {completedCount === 0
                  ? 'Start Full Guided Tour'
                  : completedCount < totalCount
                  ? 'Continue Guided Tour'
                  : 'Replay Full Guided Tour'}
              </span>
            </button>
            {completedCount > 0 && (
              <button
                type="button"
                onClick={() => tutorialManager.resetAllTutorialProgress()}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-colors cursor-pointer"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-secondary)',
                }}
                title="Reset all tutorial completion badges and restore contextual hints"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset Progress</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleCloseTutorial}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-colors hover:opacity-90 cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
              title="Close App Tutorial and return to workspace (Esc)"
            >
              <X className="w-4 h-4" />
              <span>Close Tutorial</span>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div
          className="mt-6 pt-6 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm"
              style={{
                backgroundColor: 'var(--accent-subtle)',
                color: 'var(--accent)',
              }}
            >
              {completedCount}/{totalCount}
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {completedCount === totalCount
                  ? 'All feature guides completed!'
                  : `${completedCount} of ${totalCount} tutorials completed`}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Progress is saved locally on your device so you can pause or replay any time.
              </div>
            </div>
          </div>

          <div className="w-full sm:w-64">
            <div
              className="flex justify-between text-xs font-medium mb-1.5"
              style={{ color: 'var(--text-muted)' }}
            >
              <span>Completion</span>
              <span>{completionPercent}%</span>
            </div>
            <div
              className="w-full h-2.5 rounded-full overflow-hidden border"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border)',
              }}
              role="progressbar"
              aria-valuenow={completionPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Overall tutorial completion progress"
            >
              <div
                className="h-full transition-all duration-500 rounded-full"
                style={{
                  width: `${completionPercent}%`,
                  backgroundColor: 'var(--accent)',
                }}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* How Daycraft Is Organized */}
      <motion.section
        variants={variants.cardItem}
        aria-labelledby="workspace-overview-heading"
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2
              id="workspace-overview-heading"
              className="text-lg font-bold flex items-center gap-2"
              style={{ color: 'var(--text-primary)' }}
            >
              <Layers className="w-5 h-5" style={{ color: 'var(--accent)' }} />
              <span>How Daycraft Is Organized</span>
            </h2>
            <p className="text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
              Four calm pillars designed to work together without clutter or pressure.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {WORKSPACE_PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className="rounded-2xl p-5 border flex flex-col justify-between gap-4 transition-colors"
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border)',
                  boxShadow: 'var(--card-shadow)',
                }}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span
                      className="text-xs font-bold uppercase tracking-wider"
                      style={{ color: 'var(--accent)' }}
                    >
                      {pillar.title}
                    </span>
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{
                        backgroundColor: 'var(--accent-subtle)',
                        color: 'var(--accent)',
                      }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {pillar.subtitle}
                  </h3>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {pillar.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate(pillar.destination)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline cursor-pointer w-fit"
                  style={{ color: 'var(--accent)' }}
                >
                  <span>Open {pillar.title}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </motion.section>

      {/* Topic Cards Grid */}
      <motion.section
        variants={variants.cardItem}
        aria-labelledby="feature-tutorials-heading"
        className="space-y-4"
      >
        <div>
          <h2
            id="feature-tutorials-heading"
            className="text-lg font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            Interactive Feature Guides
          </h2>
          <p className="text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
            Choose any topic to launch a step-by-step interactive walkthrough, or jump straight to that feature.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {TUTORIAL_TOPICS.map((topic, index) => {
            const Icon = TOPIC_ICON_MAP[topic.id] || BookOpen;
            const isCompleted = progressState.completedTopicIds.includes(topic.id);
            const savedStep = progressState.currentStepByTopic[topic.id] ?? 0;
            const hasInProgress = !isCompleted && savedStep > 0;

            return (
              <div
                key={topic.id}
                data-testid={`tutorial-card-${topic.id}`}
                className="rounded-2xl p-6 border flex flex-col justify-between gap-5 transition-all shadow-xs hover:shadow-md"
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: isCompleted ? 'var(--accent)' : 'var(--border)',
                  boxShadow: 'var(--card-shadow)',
                }}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: isCompleted
                            ? 'var(--accent)'
                            : 'var(--accent-subtle)',
                          color: isCompleted
                            ? 'var(--accent-foreground)'
                            : 'var(--accent)',
                        }}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <span
                          className="text-[11px] font-bold uppercase tracking-wider"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          Guide {index + 1} of {TUTORIAL_TOPICS.length}
                        </span>
                        <h3
                          className="text-base font-bold leading-snug"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {topic.title}
                        </h3>
                      </div>
                    </div>

                    {isCompleted && (
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0"
                        style={{
                          backgroundColor: 'var(--accent-subtle)',
                          color: 'var(--accent)',
                        }}
                        title="Completed"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Done</span>
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                    {topic.categoryLabel}
                  </p>
                  <p
                    className="text-xs sm:text-sm leading-relaxed"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {topic.summary}
                  </p>
                </div>

                <div
                  className="pt-4 border-t space-y-3"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div
                    className="flex items-center justify-between text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{topic.estimatedMinutes} min read</span>
                    </span>
                    <span>{topic.steps.length} steps</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        isCompleted
                          ? tutorialManager.restartTutorial(topic.id)
                          : tutorialManager.startTutorial(topic.id)
                      }
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      style={{
                        backgroundColor: isCompleted
                          ? 'var(--bg-surface)'
                          : 'var(--accent)',
                        borderColor: isCompleted ? 'var(--border)' : 'transparent',
                        color: isCompleted
                          ? 'var(--text-primary)'
                          : 'var(--accent-foreground)',
                      }}
                    >
                      {isCompleted ? (
                        <>
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restart Tutorial</span>
                        </>
                      ) : hasInProgress ? (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>Continue (Step {savedStep + 1})</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>Start Tutorial</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onNavigate(topic.primaryDestination)}
                      className="px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border)',
                        color: 'var(--text-secondary)',
                      }}
                      title={`Go to ${topic.title}`}
                    >
                      Open
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.section>

      {/* Interactive Walkthrough Modal */}
      <AnimatePresence>
        {activeTopic && activeStep && activeSession && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tutorial-walkthrough-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={transitions.card}
              className="rounded-3xl border max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border)',
              }}
            >
              {/* Walkthrough Top Header */}
              <div
                className="px-6 py-4 border-b flex items-center justify-between gap-4"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border)',
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: 'var(--accent-subtle)',
                      color: 'var(--accent)',
                    }}
                  >
                    {React.createElement(TOPIC_ICON_MAP[activeTopic.id] || BookOpen, {
                      className: 'w-4 h-4',
                    })}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[11px] font-bold uppercase tracking-wider"
                        style={{ color: 'var(--accent)' }}
                      >
                        {activeSession.mode === 'full_tour'
                          ? `Full Guided Tour (${activeSession.tourTopicIndex + 1}/${activeSession.totalTourTopics})`
                          : 'Interactive Walkthrough'}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        •
                      </span>
                      <span
                        className="text-xs font-semibold"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Step {activeSession.stepIndex + 1} of {activeTopic.steps.length}
                      </span>
                    </div>
                    <h2
                      id="tutorial-walkthrough-title"
                      className="text-sm sm:text-base font-bold truncate"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {activeTopic.title}
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => tutorialManager.restartTutorial(activeTopic.id)}
                    className="p-2 rounded-lg transition-colors cursor-pointer"
                    style={{ color: 'var(--text-muted)' }}
                    title="Restart this tutorial from Step 1"
                    aria-label="Restart tutorial"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    ref={modalFirstButtonRef}
                    type="button"
                    onClick={() => tutorialManager.exitWalkthrough()}
                    className="p-2 rounded-lg transition-colors cursor-pointer"
                    style={{ color: 'var(--text-muted)' }}
                    title="Exit tutorial (Esc)"
                    aria-label="Exit tutorial"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Step Progress Bar */}
              <div className="px-6 pt-4">
                <div className="flex items-center gap-1.5">
                  {activeTopic.steps.map((step, idx) => {
                    const isCurrent = idx === activeSession.stepIndex;
                    const isPassed = idx < activeSession.stepIndex;
                    return (
                      <div
                        key={step.id}
                        className="h-1.5 flex-1 rounded-full transition-all"
                        style={{
                          backgroundColor: isCurrent
                            ? 'var(--accent)'
                            : isPassed
                            ? 'var(--accent-subtle)'
                            : 'var(--bg-surface)',
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Step Body */}
              <div className="p-6 sm:p-8 space-y-6 overflow-y-auto">
                <div className="space-y-3">
                  <h3
                    className="text-xl sm:text-2xl font-bold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {activeStep.title}
                  </h3>
                  <p
                    className="text-sm sm:text-base leading-relaxed"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {activeStep.instruction}
                  </p>
                </div>

                <div
                  className="rounded-2xl p-4 sm:p-5 border flex items-start gap-3.5"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      backgroundColor: 'var(--accent-subtle)',
                      color: 'var(--accent)',
                    }}
                  >
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div
                      className="text-xs font-bold uppercase tracking-wider"
                      style={{ color: 'var(--accent)' }}
                    >
                      Key Detail
                    </div>
                    <p
                      className="text-xs sm:text-sm font-medium leading-relaxed"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {activeStep.detail}
                    </p>
                    {activeStep.tip && (
                      <p
                        className="text-xs pt-1"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Tip: {activeStep.tip}
                      </p>
                    )}
                  </div>
                </div>

                {activeStep.tryItAction && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        handleActionTrigger(
                          activeStep.tryItAction?.destination,
                          activeStep.tryItAction?.openQuickAdd
                        )
                      }
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer"
                      style={{
                        backgroundColor: 'var(--accent-subtle)',
                        color: 'var(--accent)',
                      }}
                    >
                      <span>{activeStep.tryItAction.label}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Walkthrough Footer Controls */}
              <div
                className="px-6 py-4 border-t flex flex-wrap items-center justify-between gap-3"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border)',
                }}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => tutorialManager.prevStep()}
                    disabled={
                      activeSession.stepIndex === 0 &&
                      (activeSession.mode !== 'full_tour' || activeSession.tourTopicIndex === 0)
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                    style={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => tutorialManager.skipTutorial()}
                    className="px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Skip
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {activeSession.stepIndex < activeTopic.steps.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => tutorialManager.nextStep()}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold hover:opacity-90 transition-opacity cursor-pointer"
                      style={{
                        backgroundColor: 'var(--accent)',
                        color: 'var(--accent-foreground)',
                      }}
                    >
                      <span>Next Step</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : activeSession.mode === 'full_tour' &&
                    activeSession.tourTopicIndex < activeSession.totalTourTopics - 1 ? (
                    <button
                      type="button"
                      onClick={() => tutorialManager.nextStep()}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold hover:opacity-90 transition-opacity cursor-pointer"
                      style={{
                        backgroundColor: 'var(--accent)',
                        color: 'var(--accent-foreground)',
                      }}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Finish &amp; Next Guide</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => tutorialManager.finishTutorial()}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold hover:opacity-90 transition-opacity cursor-pointer"
                      style={{
                        backgroundColor: 'var(--accent)',
                        color: 'var(--accent-foreground)',
                      }}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Finish Tutorial</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
