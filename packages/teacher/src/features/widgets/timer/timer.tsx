import React, { useCallback, useRef, useState } from "react";
import { useTheme } from "@shared/hooks/useWorkspace";
import { FaVolumeXmark, FaVolumeLow, FaVolumeHigh } from 'react-icons/fa6';
import { 
  useTimeSegmentEditor, 
  useTimerCountdown, 
  useTimerAnimation, 
  useTimerAudio 
} from "./hooks";
import { cn, widgetWrapper, widgetContainer, text, transitions, backgrounds, buttons } from '@shared/utils/styles';
import { TimerControlBar } from '../shared/components';
import { HamsterAnimation } from './components/HamsterAnimation';
import { TimeDisplay } from './components/TimeDisplay';
import timerEndSound2 from "./timer-end-2.wav";
import timerEndSound3 from "./timer-end-3.mp3";

type SoundMode = 'quiet' | 'short' | 'long';

const Timer = () => {
  const { isDark } = useTheme();
  const [soundMode, setSoundMode] = useState<SoundMode>('short');
  const [showJitter, setShowJitter] = useState(false);
  const [quickAddExpanded, setQuickAddExpanded] = useState(false);

  // Timer audio hooks for all three sounds
  const { playSound: playSound2 } = useTimerAudio({
    soundUrl: timerEndSound2,
    enabled: soundMode === 'short'
  });

  const { playSound: playSound3 } = useTimerAudio({
    soundUrl: timerEndSound3,
    enabled: soundMode === 'long'
  });

  // Play sound based on selected mode
  const playTimerSound = useCallback(() => {
    switch (soundMode) {
      case 'quiet':
        // No sound
        break;
      case 'short':
        playSound2();
        break;
      case 'long':
        playSound3();
        break;
    }
  }, [soundMode, playSound2, playSound3]);

  // Cycle through sound modes
  const cycleSoundMode = useCallback(() => {
    setSoundMode(prev => {
      switch (prev) {
        case 'quiet':
          return 'short';
        case 'short':
          return 'long';
        case 'long':
          return 'quiet';
        default:
          return 'short';
      }
    });
  }, []);

  // Get sound mode icon
  const getSoundModeIcon = () => {
    switch (soundMode) {
      case 'quiet':
        return <FaVolumeXmark className="text-xs" />;
      case 'short':
        return <FaVolumeLow className="text-xs" />;
      case 'long':
        return <FaVolumeHigh className="text-xs" />;
    }
  };

  // Get sound mode title
  const getSoundModeTitle = () => {
    switch (soundMode) {
      case 'quiet':
        return 'Sound: Off (Click to cycle: Short → Long → Off)';
      case 'short':
        return 'Sound: Short (Click to cycle: Long → Off → Short)';
      case 'long':
        return 'Sound: Long (Click to cycle: Off → Short → Long)';
    }
  };

  // Timer countdown hook
  const {
    time,
    isRunning,
    isPaused,
    timerFinished,
    progress,
    startTimer,
    pauseTimer,
    resumeTimer,
    restartTimer,
    adjustTime
  } = useTimerCountdown({
    onTimeUp: playTimerSound
  });

  // Time segment editor hook
  const segmentEditor = useTimeSegmentEditor({
    initialValues: ['00', '00', '10'],
    isRunning: isRunning, // Disable editing when actively running (allow when paused)
    onValuesChange: () => {
      // Edited values are read directly from the segment editor when starting or resuming.
    }
  });

  // Handle jitter animation - show for 5 seconds when timer finishes
  React.useEffect(() => {
    if (timerFinished) {
      setShowJitter(true);
      setQuickAddExpanded(false);
      const timer = setTimeout(() => {
        setShowJitter(false);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setShowJitter(false);
    }
  }, [timerFinished]);

  const lastSyncedTimeRef = useRef(time);

  React.useEffect(() => {
    if (segmentEditor.editingSegment === null && time !== lastSyncedTimeRef.current) {
      segmentEditor.updateFromTime(time);
    }

    lastSyncedTimeRef.current = time;
  }, [time, segmentEditor.editingSegment, segmentEditor.updateFromTime]);

  // Timer animation hook
  const { pulseAngle, isHamsterOnColoredArc } = useTimerAnimation({
    isRunning,
    progress
  });

  // Handle start button click
  const handleStart = useCallback(() => {
    const totalSeconds =
      segmentEditor.timeValues[0] * 3600 +
      segmentEditor.timeValues[1] * 60 +
      segmentEditor.timeValues[2];

    if (totalSeconds > 0) {
      startTimer(totalSeconds);
    }
  }, [segmentEditor.timeValues, startTimer]);

  // Handle resume button click - use edited time if it was changed
  const handleResume = useCallback(() => {
    const editedSeconds =
      segmentEditor.timeValues[0] * 3600 +
      segmentEditor.timeValues[1] * 60 +
      segmentEditor.timeValues[2];

    // If the edited time differs from current time, use the edited value
    if (editedSeconds !== time && editedSeconds > 0) {
      startTimer(editedSeconds, false); // Restart with new time, but don't update original
    } else {
      resumeTimer(); // Resume with current time
    }
  }, [segmentEditor.timeValues, time, startTimer, resumeTimer]);

  // Handle restart button click - go back to original initial time
  const handleRestart = useCallback(() => {
    restartTimer();
    setQuickAddExpanded(false);
  }, [restartTimer]);

  const handleQuickAdd = useCallback((deltaSeconds: number) => {
    adjustTime(deltaSeconds);
    setQuickAddExpanded(false);
  }, [adjustTime]);

  // Determine which controls to show
  const showStartButton = !isRunning && !isPaused && !timerFinished;
  const showPauseButton = isRunning;
  const showResumeButton = isPaused;
  const inEditMode = !isRunning;
  const quickAddOptions = [
    { label: '+1m', seconds: 60, title: 'Add 1 minute' },
    { label: '+2m', seconds: 120, title: 'Add 2 minutes' },
    { label: '+5m', seconds: 300, title: 'Add 5 minutes' }
  ];

  return (
    <div className={widgetWrapper}>
      <div
        className={cn(widgetContainer, "bg-transparent dark:bg-warm-gray-800/90 border-0 relative")}
        style={{
          containerType: 'size',
          ...(showJitter && {
            animation: 'jitter 0.1s ease-in-out infinite',
            borderWidth: '3px',
            borderColor: 'rgb(153, 27, 27)'
          })
        }}
      >
        <div className="flex-1 min-h-0 flex items-center justify-center relative">
          <div className="absolute flex h-full w-full items-center justify-center rounded-lg bg-transparent shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] dark:bg-warm-gray-800/90">
            <svg className="h-full w-full pointer-events-none" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="rainbowGradient" gradientUnits="userSpaceOnUse" x1="50" y1="5" x2="50" y2="95">
                  <stop offset="0%" stopColor="#ff0000" />
                  <stop offset="16.66%" stopColor="#ff8800" />
                  <stop offset="33.33%" stopColor="#ffff00" />
                  <stop offset="50%" stopColor="#00ff00" />
                  <stop offset="66.66%" stopColor="#00ffff" />
                  <stop offset="83.33%" stopColor="#0088ff" />
                  <stop offset="100%" stopColor="#ff00ff" />
                </linearGradient>

                <filter id="rainbowGlow" x="-200%" y="-200%" width="500%" height="500%">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                <filter id="enhancedRainbowGlow" x="-200%" y="-200%" width="500%" height="500%">
                  <feGaussianBlur stdDeviation="2.5" result="bigBlur" />
                  <feGaussianBlur stdDeviation="1.5" result="mediumBlur" />
                  <feColorMatrix in="bigBlur" type="saturate" values="1.5" result="saturatedBigBlur" />
                  <feMerge>
                    <feMergeNode in="saturatedBigBlur" />
                    <feMergeNode in="mediumBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                <filter id="pulsingGlow" x="-200%" y="-200%" width="500%" height="500%">
                  <feGaussianBlur stdDeviation="2.5" result="blur1">
                    <animate attributeName="stdDeviation" values="2.5;4;2.5" dur="2s" repeatCount="indefinite" />
                  </feGaussianBlur>
                  <feGaussianBlur stdDeviation="1.5" result="blur2">
                    <animate attributeName="stdDeviation" values="1.5;2.5;1.5" dur="2s" begin="0.5s" repeatCount="indefinite" />
                  </feGaussianBlur>
                  <feColorMatrix in="blur1" type="saturate" values="1.5" result="saturatedBlur" />
                  <feMerge>
                    <feMergeNode in="saturatedBlur" />
                    <feMergeNode in="blur2" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                <filter id="lightModeGlow" x="-200%" y="-200%" width="500%" height="500%">
                  <feColorMatrix type="saturate" values="0.6" result="desaturatedSource" />
                  <feGaussianBlur in="desaturatedSource" stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="desaturatedSource" />
                  </feMerge>
                </filter>

                <filter id="lightModePulsingGlow" x="-200%" y="-200%" width="500%" height="500%">
                  <feColorMatrix type="saturate" values="0.6" result="desaturatedSource" />
                  <feGaussianBlur in="desaturatedSource" stdDeviation="2" result="blur">
                    <animate attributeName="stdDeviation" values="2;3.5;2" dur="2s" repeatCount="indefinite" />
                  </feGaussianBlur>
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="desaturatedSource" />
                  </feMerge>
                </filter>

                <filter id="dropShadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="0" stdDeviation="3" floodOpacity="0.3" />
                </filter>
              </defs>

              <circle
                cx="50"
                cy="50"
                r="40"
                fill="rgba(250, 250, 249, 0.9)"
                className="dark:fill-warm-gray-800/90"
              />

              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="rgb(229, 231, 235)"
                strokeWidth="4"
                fill="none"
                className="dark:stroke-warm-gray-700"
              />

              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="url(#rainbowGradient)"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 42}
                strokeDashoffset={(2 * Math.PI * 42) * (1 - progress)}
                filter={
                  isRunning
                    ? isDark ? "url(#pulsingGlow) url(#dropShadow)" : "url(#lightModePulsingGlow) url(#dropShadow)"
                    : isDark ? "url(#enhancedRainbowGlow) url(#dropShadow)" : "url(#lightModeGlow) url(#dropShadow)"
                }
                transform="rotate(-90 50 50)"
              />

              {isRunning && time > 0 && (
                <HamsterAnimation pulseAngle={pulseAngle} isOnColoredArc={isHamsterOnColoredArc} />
              )}
            </svg>

            <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
              {timerFinished ? (
                <div className="flex h-full w-full items-center justify-center">
                  <span
                    style={{
                      fontSize: 'clamp(1.5rem, 15cqmin, 4rem)',
                      ...(showJitter && {
                        animation: 'jitter 0.1s ease-in-out infinite'
                      })
                    }}
                    className={cn("font-bold text-center text-red-800 dark:text-red-500")}
                  >
                    Time's Up!
                  </span>
                </div>
              ) : isRunning && !inEditMode ? (
                <TimeDisplay
                  time={time}
                  values={segmentEditor.values}
                  isEditing={false}
                  onPause={pauseTimer}
                />
              ) : (
                <div className="flex flex-col items-center">
                  <div className="flex flex-row items-center">
                    {segmentEditor.values.map((val, idx) => (
                      <React.Fragment key={idx}>
                        {segmentEditor.editingSegment === idx ? (
                          <input
                            ref={segmentEditor.inputRef}
                            type="text"
                            value={segmentEditor.tempValue}
                            onChange={segmentEditor.handleSegmentChange}
                            onBlur={segmentEditor.handleSegmentBlur}
                            onKeyDown={segmentEditor.handleKeyDown}
                            className={cn(
                              "text-center rounded-md outline-none focus:ring-2 focus:ring-sage-500",
                              text.primary,
                              backgrounds.surface
                            )}
                            style={{
                              width: 'clamp(2.5rem, 15cqmin, 5rem)',
                              fontSize: 'clamp(1.5rem, 12cqmin, 3rem)'
                            }}
                            autoFocus
                          />
                        ) : (
                          <span
                            onClick={() => segmentEditor.handleSegmentClick(idx)}
                            className={cn(
                              "leading-none cursor-pointer px-1 rounded-md",
                              text.primary,
                              backgrounds.hover,
                              transitions.colors,
                              !isRunning && 'hover:text-sage-600'
                            )}
                            title={!isRunning ? 'Click to edit' : ''}
                            style={{ fontSize: 'clamp(1.5rem, 12cqmin, 3rem)' }}
                          >
                            {val}
                          </span>
                        )}

                        {idx < segmentEditor.values.length - 1 && (
                          <span
                            className={cn("leading-none mx-0", text.primary)}
                            style={{ fontSize: 'clamp(1.5rem, 12cqmin, 3rem)' }}
                          >
                            :
                          </span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>

                  {!isRunning && segmentEditor.editingSegment === null && (
                    <div className={cn("text-xs mt-1", text.muted)}>
                      <span>Click to edit</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <TimerControlBar
          timerFinished={timerFinished}
          showStartButton={showStartButton}
          showPauseButton={showPauseButton}
          showResumeButton={showResumeButton}
          isRunning={isRunning}
          onStart={handleStart}
          onPause={pauseTimer}
          onResume={handleResume}
          onRestart={handleRestart}
          soundMode={soundMode}
          onSoundModeToggle={cycleSoundMode}
          soundModeIcon={getSoundModeIcon()}
          soundModeTitle={getSoundModeTitle()}
          showQuickAddToggle={!timerFinished}
          quickAddExpanded={quickAddExpanded}
          onQuickAddToggle={() => setQuickAddExpanded(prev => !prev)}
        />

        {quickAddExpanded && !timerFinished && (
          <div
            id="timer-quick-add-tray"
            className="mt-2 overflow-hidden transition-all duration-200 ease-out"
          >
            <div className="rounded-lg border border-white/40 bg-white/45 p-2 shadow-sm backdrop-blur-md dark:border-warm-gray-600/40 dark:bg-warm-gray-800/45">
              <div className="flex items-center justify-center gap-2">
                <span className={cn("text-xs font-medium uppercase tracking-wide", text.muted)}>
                  Add time
                </span>
                {quickAddOptions.map((option) => (
                  <button
                    key={option.seconds}
                    type="button"
                    onClick={() => handleQuickAdd(option.seconds)}
                    className={cn(buttons.secondary, "px-3 py-1 text-sm")}
                    title={option.title}
                    aria-label={option.title}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Timer;
