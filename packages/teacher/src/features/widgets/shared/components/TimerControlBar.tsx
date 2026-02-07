import React from 'react';
import { FaPlay, FaPause, FaArrowRotateLeft } from 'react-icons/fa6';
import { WidgetControlBar } from './WidgetControlBar';
import { cn, buttons } from '@shared/utils/styles';

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
}

/**
 * Specialized control bar for the Timer widget with its unique state management.
 * Handles the timer's various states: finished, start, pause, resume, restart.
 */
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
  soundModeTitle
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

      {/* Sound mode toggle button */}
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
    </WidgetControlBar>
  );
};

export default TimerControlBar;