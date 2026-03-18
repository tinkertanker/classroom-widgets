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
import {
  getDefaultTargetSelection,
  getSecondsUntilClockTime,
  type ClockTimeSelection
} from './clockTime';
import timerEndSound2 from "./timer-end-2.wav";
import timerEndSound3 from "./timer-end-3.mp3";

type SoundMode = 'quiet' | 'short' | 'long';

interface TimerProps {
  savedState?: any;
  onStateChange?: (state: any) => void;
}

const Timer: React.FC<TimerProps> = ({ savedState, onStateChange }) => {
  const { isDark } = useTheme();
  const [soundMode, setSoundMode] = useState<SoundMode>(() => savedState?.soundMode ?? 'short');
  const [showJitter, setShowJitter] = useState(false);
  const [quickAddExpanded, setQuickAddExpanded] = useState(false);
  const [targetTimeExpanded, setTargetTimeExpanded] = useState(false);
  const [targetTime, setTargetTime] = useState<ClockTimeSelection>(() => getDefaultTargetSelection());

  const { playSound: playSound2 } = useTimerAudio({
    soundUrl: timerEndSound2,
    enabled: soundMode === 'short'
  });

  const { playSound: playSound3 } = useTimerAudio({
    soundUrl: timerEndSound3,
    enabled: soundMode === 'long'
  });

  const playTimerSound = useCallback(() => {
    switch (soundMode) {
      case 'quiet':
        break;
      case 'short':
        playSound2();
        break;
      case 'long':
        playSound3();
        break;
    }
  }, [soundMode, playSound2, playSound3]);

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

  // Persist timer state for recovery across remounts.
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
    resetTimer,
    adjustTime,
    getPersistedState
  } = useTimerCountdown({
    onTimeUp: playTimerSound,
    restoredState: savedState?.timer
  });

  const segmentEditor = useTimeSegmentEditor({
    initialValues: savedState?.segmentValues ?? ['00', '00', '10'],
    isRunning,
    onValuesChange: () => {
      // Edited values are read directly from the segment editor when starting or resuming.
    }
  });

  React.useEffect(() => {
    onStateChange?.({
      timer: getPersistedState(),
      soundMode,
      segmentValues: segmentEditor.values,
    });
  }, [onStateChange, getPersistedState, soundMode, segmentEditor.values]);
  React.useEffect(() => {
    if (timerFinished) {
      setShowJitter(true);
      setQuickAddExpanded(false);
      setTargetTimeExpanded(false);
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

  const { pulseAngle, isHamsterOnColoredArc } = useTimerAnimation({
    isRunning,
    progress
  });

  const handleTargetTimeChange = useCallback(<K extends keyof ClockTimeSelection>(field: K, value: ClockTimeSelection[K]) => {
    setTargetTime(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleSetTargetTime = useCallback(() => {
    const totalSeconds = getSecondsUntilClockTime(targetTime);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const newValues = [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0')
    ];

    segmentEditor.setValues(newValues);
    segmentEditor.setTimeValues([hours, minutes, seconds]);
    resetTimer(totalSeconds);
    setTargetTimeExpanded(false);
  }, [targetTime, segmentEditor, resetTimer]);

  const handleStart = useCallback(() => {
    const totalSeconds =
      segmentEditor.timeValues[0] * 3600 +
      segmentEditor.timeValues[1] * 60 +
      segmentEditor.timeValues[2];

    if (totalSeconds > 0) {
      startTimer(totalSeconds);
    }
  }, [segmentEditor.timeValues, startTimer]);

  const handleResume = useCallback(() => {
    const editedSeconds =
      segmentEditor.timeValues[0] * 3600 +
      segmentEditor.timeValues[1] * 60 +
      segmentEditor.timeValues[2];

    if (editedSeconds !== time && editedSeconds > 0) {
      startTimer(editedSeconds, false);
    } else {
      resumeTimer();
    }
  }, [segmentEditor.timeValues, time, startTimer, resumeTimer]);

  const handleRestart = useCallback(() => {
    restartTimer();
    setQuickAddExpanded(false);
    setTargetTimeExpanded(false);
  }, [restartTimer]);

  const handleQuickAdd = useCallback((deltaSeconds: number) => {
    adjustTime(deltaSeconds);
    setQuickAddExpanded(false);
  }, [adjustTime]);

  const handleTargetTimeToggle = useCallback(() => {
    setTargetTimeExpanded(prev => {
      if (!prev) {
        setTargetTime(getDefaultTargetSelection());
      }
      return !prev;
    });
    setQuickAddExpanded(false);
  }, []);

  const handleQuickAddToggle = useCallback(() => {
    setQuickAddExpanded(prev => !prev);
    setTargetTimeExpanded(false);
  }, []);

  const showStartButton = !isRunning && !isPaused && !timerFinished;
  const showPauseButton = isRunning;
  const showResumeButton = isPaused;
  const inEditMode = !isRunning;
  const allowSegmentEditing = !isRunning;
  const showTargetTimeToggle = !isRunning && !isPaused && !timerFinished;
  const showQuickAddToggle = !timerFinished;
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
                        {allowSegmentEditing && segmentEditor.editingSegment === idx ? (
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
                            onClick={allowSegmentEditing ? () => segmentEditor.handleSegmentClick(idx) : undefined}
                            className={cn(
                              "leading-none px-1 rounded-md",
                              text.primary,
                              transitions.colors,
                              allowSegmentEditing && backgrounds.hover,
                              allowSegmentEditing ? 'cursor-pointer hover:text-sage-600' : 'cursor-default'
                            )}
                            title={allowSegmentEditing ? 'Click to edit' : ''}
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
          showTargetTimeToggle={showTargetTimeToggle}
          targetTimeExpanded={targetTimeExpanded}
          onTargetTimeToggle={handleTargetTimeToggle}
          showQuickAddToggle={showQuickAddToggle}
          quickAddExpanded={quickAddExpanded}
          onQuickAddToggle={handleQuickAddToggle}
        />

        {targetTimeExpanded && !timerFinished && !isRunning && !isPaused && (
          <div
            id="timer-target-time-tray"
            className="mt-2 overflow-hidden transition-all duration-200 ease-out"
          >
            <div className="rounded-lg border border-white/40 bg-white/45 p-2 shadow-sm backdrop-blur-md dark:border-warm-gray-600/40 dark:bg-warm-gray-800/45">
              <div className="flex items-center justify-center gap-2">
                <span className={cn("text-xs font-medium uppercase tracking-wide whitespace-nowrap", text.muted)}>
                  Until
                </span>
                  <select
                    aria-label="Target hour"
                    value={targetTime.hour}
                    onChange={(e) => handleTargetTimeChange('hour', parseInt(e.target.value, 10))}
                    className={cn(
                      "w-12 rounded-md border px-1.5 py-1 text-sm font-medium text-center",
                      backgrounds.surface,
                      text.primary
                    )}
                  >
                    {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((hour) => (
                      <option key={hour} value={hour}>{hour}</option>
                    ))}
                  </select>
                  <span className={cn("text-lg font-medium", text.muted)}>:</span>
                  <select
                    aria-label="Target minute"
                    value={targetTime.minute}
                    onChange={(e) => handleTargetTimeChange('minute', parseInt(e.target.value, 10))}
                    className={cn(
                      "w-14 rounded-md border px-1.5 py-1 text-sm font-medium text-center",
                      backgrounds.surface,
                      text.primary
                    )}
                  >
                    {Array.from({ length: 60 }, (_, minute) => (
                      <option key={minute} value={minute}>{minute.toString().padStart(2, '0')}</option>
                    ))}
                  </select>
                  <div
                    className="flex overflow-hidden rounded-md border border-white/50 dark:border-warm-gray-600/40"
                    role="group"
                    aria-label="Target period"
                  >
                    {(['AM', 'PM'] as const).map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => handleTargetTimeChange('period', period)}
                        aria-pressed={targetTime.period === period}
                        className={cn(
                          "px-2.5 py-1 text-xs font-medium transition-colors",
                          targetTime.period === period
                            ? 'bg-sage-500 text-white'
                            : 'bg-white/45 text-warm-gray-600 hover:text-sage-600 dark:bg-warm-gray-800/45 dark:text-warm-gray-300 dark:hover:text-sage-400'
                        )}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                <button
                  type="button"
                  onClick={handleSetTargetTime}
                  className={cn(buttons.primary, "whitespace-nowrap px-3 py-1 text-sm")}
                >
                  Set
                </button>
              </div>
            </div>
          </div>
        )}

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
