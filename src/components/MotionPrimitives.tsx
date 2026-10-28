import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, ChevronDown, Loader2, AlertCircle } from 'lucide-react';
import { useMotionPreference, MOTION_SPRINGS } from '../theme/motion';

// ==========================================
// 1. ANIMATED TOGGLE SWITCH
// ==========================================
interface AnimatedToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
}

export const AnimatedToggle: React.FC<AnimatedToggleProps> = ({
  checked,
  onChange,
  disabled = false,
  label,
  id,
}) => {
  const { isReduced } = useMotionPreference();

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? 'border-transparent' : ''
      }`}
      style={{
        backgroundColor: checked ? 'var(--accent)' : 'var(--bg-surface-subtle)',
        borderColor: checked ? 'var(--accent)' : 'var(--border)',
      }}
    >
      <motion.span
        layout
        transition={isReduced ? { duration: 0.08 } : MOTION_SPRINGS.tactile}
        animate={{ x: checked ? 21 : 3 }}
        className="inline-block h-4 w-4 rounded-full bg-white shadow-xs pointer-events-none"
      />
    </button>
  );
};

// ==========================================
// 2. ANIMATED CHECKBOX
// ==========================================
interface AnimatedCheckboxProps {
  checked: boolean;
  onChange: () => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  accentColor?: string;
}

export const AnimatedCheckbox: React.FC<AnimatedCheckboxProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  size = 'md',
  accentColor,
}) => {
  const { isReduced } = useMotionPreference();
  const dim = size === 'sm' ? 'w-4 h-4 rounded-md' : 'w-5 h-5 rounded-lg';
  const iconDim = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5';

  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      whileTap={isReduced || disabled ? undefined : { scale: 0.88 }}
      whileHover={isReduced || disabled ? undefined : { scale: 1.05 }}
      transition={MOTION_SPRINGS.tactile}
      onClick={e => {
        e.stopPropagation();
        if (!disabled) onChange();
      }}
      className={`${dim} border flex items-center justify-center shrink-0 transition-colors duration-150 cursor-pointer disabled:opacity-40`}
      style={{
        backgroundColor: checked ? (accentColor || 'var(--success)') : 'var(--bg-surface)',
        borderColor: checked ? (accentColor || 'var(--success)') : 'var(--border)',
        color: '#FFFFFF',
      }}
    >
      <AnimatePresence initial={false}>
        {checked && (
          <motion.span
            key="check"
            initial={isReduced ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
            animate={isReduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={isReduced ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
            transition={isReduced ? { duration: 0.06 } : MOTION_SPRINGS.snappy}
            className="flex items-center justify-center"
          >
            <Check className={`${iconDim} stroke-[3]`} />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
};

// ==========================================
// 3. TACTILE STATEFUL BUTTON
// ==========================================
export type ButtonStatusState = 'idle' | 'loading' | 'success' | 'error';

interface TactileButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'subtle' | 'danger';
  statusState?: ButtonStatusState;
  loadingLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  icon?: React.ReactNode;
}

export const TactileButton: React.FC<TactileButtonProps> = ({
  variant = 'primary',
  statusState = 'idle',
  loadingLabel,
  successLabel,
  errorLabel,
  icon,
  children,
  disabled,
  className = '',
  style,
  ...rest
}) => {
  const { isReduced } = useMotionPreference();
  const isDisabled = disabled || statusState === 'loading';

  const getVariantStyles = (): React.CSSProperties => {
    if (statusState === 'success') {
      return {
        backgroundColor: 'var(--success)',
        borderColor: 'var(--success)',
        color: '#FFFFFF',
      };
    }
    if (statusState === 'error') {
      return {
        backgroundColor: 'var(--danger-subtle)',
        borderColor: 'var(--danger)',
        color: 'var(--danger)',
      };
    }
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: 'var(--accent)',
          borderColor: 'var(--accent)',
          color: 'var(--accent-foreground)',
        };
      case 'danger':
        return {
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border)',
          color: 'var(--danger)',
        };
      case 'subtle':
        return {
          backgroundColor: 'var(--bg-surface-subtle)',
          borderColor: 'var(--border)',
          color: 'var(--text-primary)',
        };
      case 'secondary':
      default:
        return {
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border)',
          color: 'var(--text-primary)',
        };
    }
  };

  return (
    <motion.button
      whileTap={isReduced || isDisabled ? undefined : { scale: 0.975 }}
      whileHover={isReduced || isDisabled ? undefined : { y: -1 }}
      transition={MOTION_SPRINGS.tactile}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold transition-colors duration-150 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap shrink-0 ${className}`}
      style={{
        ...getVariantStyles(),
        ...style,
      }}
      {...(rest as any)}
    >
      <AnimatePresence mode="wait" initial={false}>
        {statusState === 'loading' ? (
          <motion.span
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="inline-flex items-center gap-1.5"
          >
            <Loader2 className={`w-3.5 h-3.5 ${isReduced ? '' : 'animate-spin'}`} />
            <span>{loadingLabel || children}</span>
          </motion.span>
        ) : statusState === 'success' ? (
          <motion.span
            key="success"
            initial={isReduced ? { opacity: 0 } : { opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="inline-flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{successLabel || 'Saved'}</span>
          </motion.span>
        ) : statusState === 'error' ? (
          <motion.span
            key="error"
            initial={isReduced ? { opacity: 0 } : { opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="inline-flex items-center gap-1.5"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{errorLabel || 'Retry'}</span>
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="inline-flex items-center gap-1.5"
          >
            {icon}
            <span>{children}</span>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
};

// ==========================================
// 4. COLLAPSIBLE SECTION CARD
// ==========================================
interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
  className?: string;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  subtitle,
  icon,
  badge,
  defaultOpen = true,
  isOpen: controlledOpen,
  onToggle,
  children,
  className = '',
}) => {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const { isReduced, variants } = useMotionPreference();

  const expanded = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalOpen(prev => !prev);
    }
  };

  return (
    <div
      className={`rounded-3xl border transition-colors ${className}`}
      style={{
        backgroundColor: 'var(--bg-surface-elevated)',
        borderColor: 'var(--border)',
        boxShadow: 'var(--card-shadow)',
      }}
    >
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-4 p-5 sm:p-6 text-left rounded-3xl transition-colors hover:bg-black/[0.015] dark:hover:bg-white/[0.015] cursor-pointer"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="text-sm font-bold tracking-wide uppercase" style={{ color: 'var(--text-secondary)' }}>
              {title}
            </h2>
          </div>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {badge}
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={isReduced ? { duration: 0 } : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="p-1.5 rounded-xl border"
            style={{
              borderColor: 'var(--border)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-muted)',
            }}
          >
            <ChevronDown className="w-4 h-4" />
          </motion.span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            variants={variants.accordion}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <div className="px-5 pb-6 sm:px-6 pt-1 border-t space-y-5" style={{ borderColor: 'var(--border)' }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ==========================================
// 5. RESTRAINED EMPTY STATE ENTRANCE
// ==========================================
interface EmptyStateMotionProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export const EmptyStateMotion: React.FC<EmptyStateMotionProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
  children,
}) => {
  const { variants, tactileProps } = useMotionPreference();

  if (children) {
    return (
      <motion.div
        variants={variants.emptyState}
        initial="initial"
        animate="animate"
        className={className || 'p-8 text-center text-xs'}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={variants.emptyState}
      initial="initial"
      animate="animate"
      className={`p-8 sm:p-10 rounded-2xl border text-center flex flex-col items-center justify-center gap-2.5 ${className || ''}`}
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border)',
      }}
    >
      {icon && (
        <div
          className="w-10 h-10 rounded-2xl border flex items-center justify-center mb-1"
          style={{
            backgroundColor: 'var(--bg-surface-subtle)',
            borderColor: 'var(--border)',
            color: 'var(--accent)',
          }}
        >
          {icon}
        </div>
      )}
      {title && (
        <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h4>
      )}
      {description && (
        <p className="text-xs max-w-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <motion.button
          {...tactileProps}
          type="button"
          onClick={onAction}
          className="mt-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
          style={{
            backgroundColor: 'var(--accent)',
            color: 'var(--accent-foreground)',
          }}
        >
          {actionLabel}
        </motion.button>
      )}
    </motion.div>
  );
};

// ==========================================
// 6. LIGHTWEIGHT SKELETON PLACEHOLDER
// ==========================================
export const SkeletonBlock: React.FC<{ className?: string }> = ({ className = 'h-12 w-full' }) => {
  const { isReduced } = useMotionPreference();
  return (
    <div
      className={`rounded-xl border ${isReduced ? 'opacity-60' : 'animate-pulse'} ${className}`}
      style={{
        backgroundColor: 'var(--bg-surface-subtle)',
        borderColor: 'var(--border)',
      }}
      aria-hidden="true"
    />
  );
};
