import React from 'react';
import { FaRegClock } from 'react-icons/fa6';
import { WidgetControlBar } from './WidgetControlBar';
import { cn, buttons } from '@shared/utils/styles';

const pressedButtonClass = cn(
  'translate-y-px shadow-inner',
  'from-sage-400 to-sage-300/60 hover:from-sage-400 hover:to-sage-300/60',
  'dark:from-sage-950/80 dark:to-sage-900/50 dark:hover:from-sage-950/80 dark:hover:to-sage-900/50'
);

interface TimerControlBarProps {
  timerFinished: boolean;
  showStartButton: boolean;
  showPauseButton: boolean;
  showResumeButton: boolean;
  isRunning: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  disabled?: boolean;
  className?: string;
  soundMode?: 'quiet' | 'short' | 'long';
  onSoundModeToggle?: () => void;
  soundModeIcon?: React.ReactNode;
  soundModeTitle?: string;
  showQuickAddToggle?: boolean;
  quickAddExpanded?: boolean;
  onQuickAddToggle?: () => void;
  showTargetTimeToggle?: boolean;
  targetTimeExpanded?: boolean;
  onTargetTimeToggle?: () => void;
}

export const TimerControlBar: React.FC<TimerControlBarProps> = ({
  timerFinished,
  showStartButton,
  showPauseButton,
  showResumeButton,
  isRunning,
  onStart,
  onPause,
  onResume,
  onRestart,
  disabled = false,
  className,
  soundMode,
  onSoundModeToggle,
  soundModeIcon,
  soundModeTitle,
  showQuickAddToggle = false,
  quickAddExpanded = false,
  onQuickAddToggle,
  showTargetTimeToggle = false,
  targetTimeExpanded = false,
  onTargetTimeToggle
}) => {
  return (
    <WidgetControlBar className={className}>
      {timerFinished ? (
        <button
          className={cn(buttons.primary, "px-3 py-1.5 text-sm")}
          onClick={onRestart}
          disabled={disabled}
        >
          {'\u21BB'} Restart
        </button>
      ) : showStartButton ? (
        <button
          className={cn(buttons.primary, "px-3 py-1.5 text-sm")}
          onClick={onStart}
          disabled={disabled}
        >
          {'\u25B6'} Start
        </button>
      ) : (
        <div className="flex items-center gap-2">
          {showPauseButton && (
            <button
              className={cn(buttons.primary, "px-3 py-1.5 text-sm")}
              onClick={onPause}
              disabled={disabled}
            >
              {'\u23F8'} Pause
            </button>
          )}
          {showResumeButton && (
            <button
              className={cn(buttons.primary, "px-3 py-1.5 text-sm")}
              onClick={onResume}
              disabled={disabled}
            >
              {'\u25B6'} Resume
            </button>
          )}
          <button
            className={cn(buttons.primary, "px-3 py-1.5 text-sm")}
            onClick={onRestart}
            disabled={disabled}
          >
            {'\u21BB'} Restart
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        {showTargetTimeToggle && onTargetTimeToggle && (
          <button
            onClick={onTargetTimeToggle}
            disabled={disabled}
            className={cn(
              buttons.primary,
              "inline-flex items-center justify-center px-3.5 py-[9px] text-sm leading-none",
              targetTimeExpanded && "ring-2 ring-sage-400",
              targetTimeExpanded && pressedButtonClass
            )}
            title={targetTimeExpanded ? 'Hide target time picker' : 'Set timer to end at a specific time'}
            aria-label={targetTimeExpanded ? 'Hide target time picker' : 'Set target time'}
            aria-expanded={targetTimeExpanded}
            aria-controls="timer-target-time-tray"
          >
            {targetTimeExpanded ? '\u00D7' : <FaRegClock className="h-[13px] w-[13px]" />}
          </button>
        )}

        {showQuickAddToggle && onQuickAddToggle && (
          <button
            onClick={onQuickAddToggle}
            disabled={disabled}
            className={cn(
              buttons.primary,
              "px-3 py-1.5 text-sm",
              quickAddExpanded && pressedButtonClass
            )}
            title={quickAddExpanded ? 'Hide add time options' : 'Show add time options'}
            aria-label={quickAddExpanded ? 'Hide add time options' : 'Show add time options'}
            aria-expanded={quickAddExpanded}
            aria-controls="timer-quick-add-tray"
          >
            {quickAddExpanded ? '\u00D7' : '+'}
          </button>
        )}

        {onSoundModeToggle && soundModeIcon && (
          <button
            onClick={onSoundModeToggle}
            disabled={disabled}
            className="p-2 text-warm-gray-500 hover:text-warm-gray-700 dark:text-warm-gray-400 dark:hover:text-warm-gray-200 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 rounded transition-colors"
            title={soundModeTitle || 'Toggle sound mode'}
          >
            {soundModeIcon}
          </button>
        )}
      </div>
    </WidgetControlBar>
  );
};

export default TimerControlBar;
