import React from 'react';
import { FaPlay, FaPause, FaArrowRotateLeft } from 'react-icons/fa6';
import { WidgetControlBar } from './WidgetControlBar';
import { cn, buttons } from '../../../../shared/utils/styles';

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
  className
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
    </WidgetControlBar>
  );
};

export default TimerControlBar;