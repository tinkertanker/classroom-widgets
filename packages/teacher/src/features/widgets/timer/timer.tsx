import React, { useCallback, useRef, useState } from "react";
import { useTheme } from "@shared/hooks/useWorkspace";
import { warmGray } from '@shared/constants/colors';
import { FaVolumeLow, FaVolumeHigh } from 'react-icons/fa6';
import { 
  useTimeSegmentEditor, 
  useTimerCountdown, 
  useTimerAudio 
} from "./hooks";
import { cn, widgetWrapper, text, transitions, backgrounds, buttons } from '@shared/utils/styles';
import { TimerControlBar } from '../shared/components';
import { CreatureAnimation } from './components/CreatureAnimation';
import { CreatureId, getNextCreature, isCreatureId } from './components/creatures';
import { TimeDisplay } from './components/TimeDisplay';
import {
  getDefaultTargetSelection,
  getSecondsUntilClockTime,
  secondsToTimeSegments,
  type ClockTimeSelection
} from './clockTime';
import timerEndSound2 from "./timer-end-2.wav";
import timerEndSound3 from "./timer-end-3.mp3";

type SoundMode = 'short' | 'long';
type TargetTimeField = 'hour' | 'minute';

interface TargetTimeDropdownProps {
  field: TargetTimeField;
  label: string;
  value: number;
  values: number[];
  formatValue?: (value: number) => string;
  isOpen: boolean;
  onToggle: () => void;
  onDismiss: (field: TargetTimeField) => void;
  onChange: (value: number) => void;
}

const TargetTimeDropdown: React.FC<TargetTimeDropdownProps> = ({
  field,
  label,
  value,
  values,
  formatValue = String,
  isOpen,
  onToggle,
  onDismiss,
  onChange
}) => {
  const listboxId = `${React.useId()}-${field}-options`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    listboxRef.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.focus();

    const dismissOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        onDismiss(field);
      }
    };

    document.addEventListener('pointerdown', dismissOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', dismissOnOutsidePointer);
  }, [isOpen, onDismiss]);

  const closeAndRestoreFocus = () => {
    onDismiss(field);
    triggerRef.current?.focus();
  };

  const focusOption = (index: number) => {
    const wrappedIndex = (index + values.length) % values.length;
    listboxRef.current
      ?.querySelectorAll<HTMLElement>('[role="option"]')
      .item(wrappedIndex)
      ?.focus();
  };

  const handleOptionKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusOption(index + 2);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusOption(index - 2);
        break;
      case 'ArrowRight':
        event.preventDefault();
        focusOption(index + 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        focusOption(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusOption(0);
        break;
      case 'End':
        event.preventDefault();
        focusOption(values.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        closeAndRestoreFocus();
        break;
      case 'Tab':
        onDismiss(field);
        break;
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${label}: ${formatValue(value)}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!isOpen) {
              onToggle();
            } else {
              focusOption(values.indexOf(value));
            }
          } else if (event.key === 'Escape' && isOpen) {
            event.preventDefault();
            closeAndRestoreFocus();
          }
        }}
        className={cn(
          field === 'hour' ? 'w-12' : 'w-14',
          "rounded-md border px-1.5 py-1 text-sm font-medium text-center",
          backgrounds.surface,
          text.primary
        )}
      >
        {formatValue(value)} <span aria-hidden="true">▾</span>
      </button>
      {isOpen && (
        <div
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          aria-label={`${label} options`}
          className="absolute bottom-full left-1/2 z-30 mb-1 grid min-w-[5.5rem] -translate-x-1/2 grid-cols-2 rounded-md border border-warm-gray-200 bg-white p-1 shadow-lg dark:border-warm-gray-600 dark:bg-warm-gray-800"
        >
          {values.map((option, index) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={option === value}
              onClick={() => {
                onChange(option);
                triggerRef.current?.focus();
              }}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
              className={cn(
                "block w-full rounded px-2 py-1 text-center text-sm",
                option === value
                  ? 'bg-sage-500 text-white'
                  : 'text-warm-gray-700 hover:bg-warm-gray-100 dark:text-warm-gray-200 dark:hover:bg-warm-gray-700'
              )}
            >
              {formatValue(option)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

interface TimerProps {
  savedState?: any;
  onStateChange?: (state: any) => void;
  renderTheme?: 'light' | 'dark';
  isCompactPanel?: boolean;
}

const Timer: React.FC<TimerProps> = ({ savedState, onStateChange, renderTheme }) => {
  const workspaceTheme = useTheme();
  const isDark = renderTheme ? renderTheme === 'dark' : workspaceTheme.isDark;
  const [soundMode, setSoundMode] = useState<SoundMode>(() =>
    savedState?.soundMode === 'long' ? 'long' : 'short'
  );
  // Older saved states stored mute as soundMode 'quiet'.
  const [muted, setMuted] = useState<boolean>(() =>
    savedState?.muted ?? savedState?.soundMode === 'quiet'
  );
  const [creature, setCreature] = useState<CreatureId>(() =>
    isCreatureId(savedState?.creature) ? savedState.creature : 'hamster'
  );
  const [showJitter, setShowJitter] = useState(false);
  const [quickAddExpanded, setQuickAddExpanded] = useState(false);
  const [targetTimeExpanded, setTargetTimeExpanded] = useState(false);
  const [targetTime, setTargetTime] = useState<ClockTimeSelection>(() => getDefaultTargetSelection());
  const [openTargetTimeField, setOpenTargetTimeField] = useState<TargetTimeField | null>(null);

  // Mute gates playback rather than the hooks' enabled flag, so the Audio
  // element stays alive (and preloaded) across mute toggles.
  const { playSound: playSound2, stopSound: stopSound2 } = useTimerAudio({
    soundUrl: timerEndSound2,
    enabled: soundMode === 'short'
  });

  const { playSound: playSound3, stopSound: stopSound3 } = useTimerAudio({
    soundUrl: timerEndSound3,
    enabled: soundMode === 'long'
  });

  const playTimerSound = useCallback(() => {
    if (muted) {
      return;
    }

    if (soundMode === 'short') {
      playSound2();
    } else {
      playSound3();
    }
  }, [muted, soundMode, playSound2, playSound3]);

  const cycleSoundMode = useCallback(() => {
    setSoundMode(prev => (prev === 'short' ? 'long' : 'short'));
  }, []);

  const toggleMuted = useCallback(() => {
    // Muting also cuts off an end-of-timer sound that is already playing.
    stopSound2();
    stopSound3();
    setMuted(prev => !prev);
  }, [stopSound2, stopSound3]);

  const cycleCreature = useCallback(() => {
    setCreature(prev => getNextCreature(prev));
  }, []);

  const getSoundModeIcon = () => {
    switch (soundMode) {
      case 'short':
        return <FaVolumeLow className="text-xs" />;
      case 'long':
        return <FaVolumeHigh className="text-xs" />;
    }
  };

  const getSoundModeTitle = () => {
    switch (soundMode) {
      case 'short':
        return 'End sound: Short (click for Long)';
      case 'long':
        return 'End sound: Long (click for Short)';
    }
  };

  // Persist timer state for recovery across remounts.
  const {
    initialTime,
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
      muted,
      creature,
      segmentValues: segmentEditor.values,
    });
  }, [onStateChange, getPersistedState, initialTime, isRunning, isPaused, soundMode, muted, creature, segmentEditor.values, timerFinished]);
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
    if (!isRunning && segmentEditor.editingSegment === null && time !== lastSyncedTimeRef.current) {
      segmentEditor.updateFromTime(time);
      lastSyncedTimeRef.current = time;
    }

    if (!isRunning) {
      lastSyncedTimeRef.current = time;
    }
  }, [isRunning, time, segmentEditor.editingSegment, segmentEditor.updateFromTime]);

  const handleTargetTimeChange = useCallback(<K extends keyof ClockTimeSelection>(field: K, value: ClockTimeSelection[K]) => {
    setTargetTime(prev => ({
      ...prev,
      [field]: value
    }));
    setOpenTargetTimeField(null);
  }, []);

  const handleTargetTimeDismiss = useCallback((field: TargetTimeField) => {
    setOpenTargetTimeField(currentField => currentField === field ? null : currentField);
  }, []);

  const handleSetTargetTime = useCallback(() => {
    const totalSeconds = getSecondsUntilClockTime(targetTime);
    const { hours, minutes, seconds, hoursText, minutesText, secondsText } = secondsToTimeSegments(totalSeconds);

    const newValues = [hoursText, minutesText, secondsText];

    segmentEditor.setValues(newValues);
    segmentEditor.setTimeValues([hours, minutes, seconds]);
    resetTimer(totalSeconds);
    setTargetTimeExpanded(false);
    setOpenTargetTimeField(null);
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
    const editedSeconds =
      segmentEditor.timeValues[0] * 3600 +
      segmentEditor.timeValues[1] * 60 +
      segmentEditor.timeValues[2];
    const nextTime = adjustTime(deltaSeconds, editedSeconds);
    if (!isRunning && nextTime !== undefined) {
      // The sum can equal the old countdown value, so its sync effect may not run.
      segmentEditor.updateFromTime(nextTime);
    }
    setQuickAddExpanded(false);
  }, [adjustTime, isRunning, segmentEditor.timeValues, segmentEditor.updateFromTime]);

  const handleTargetTimeToggle = useCallback(() => {
    setTargetTimeExpanded(prev => {
      if (!prev) {
        setTargetTime(getDefaultTargetSelection());
      }
      return !prev;
    });
    setOpenTargetTimeField(null);
    setQuickAddExpanded(false);
  }, []);

  const handleQuickAddToggle = useCallback(() => {
    setQuickAddExpanded(prev => !prev);
    setTargetTimeExpanded(false);
    setOpenTargetTimeField(null);
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
  const timerFaceFill = isDark ? warmGray[800] : 'rgba(250, 250, 249, 0.9)';

  return (
    <div className={widgetWrapper}>
      <div
        className="w-full h-full overflow-hidden flex flex-col relative rounded-lg bg-transparent dark:bg-transparent"
        data-testid="timer-outer-container"
        style={{
          containerType: 'size',
          ...(showJitter && {
            animation: 'jitter 0.1s ease-in-out infinite'
          })
        }}
      >
        <div className="flex-1 min-h-0 flex items-center justify-center relative">
          <div
            className="absolute flex h-full w-full items-center justify-center bg-transparent dark:bg-transparent"
            data-testid="timer-visual-shell"
          >
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

              </defs>

              <circle
                cx="50"
                cy="50"
                r="40"
                fill={timerFaceFill}
                data-testid="timer-face"
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
                strokeWidth={isRunning ? 8 : 7}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 42}
                strokeDashoffset={(2 * Math.PI * 42) * (1 - progress)}
                opacity={isRunning ? (isDark ? 0.34 : 0.24) : (isDark ? 0.25 : 0.18)}
                transform="rotate(-90 50 50)"
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
                transform="rotate(-90 50 50)"
              />

              {isRunning && time > 0 && (
                <CreatureAnimation
                  isRunning={isRunning}
                  progress={progress}
                  creature={creature}
                  onCreatureClick={cycleCreature}
                />
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

        <div
          data-testid="timer-bottom-controls-region"
        >
          <div
            data-testid="timer-bottom-controls"
            data-widget-controls
            className="transition-opacity duration-150 motion-reduce:transition-none"
          >
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
              muted={muted}
              onMuteToggle={toggleMuted}
              showTargetTimeToggle={showTargetTimeToggle}
              targetTimeExpanded={targetTimeExpanded}
              onTargetTimeToggle={handleTargetTimeToggle}
              showQuickAddToggle={showQuickAddToggle}
              quickAddExpanded={quickAddExpanded}
              onQuickAddToggle={handleQuickAddToggle}
            />
          </div>
        </div>

        {targetTimeExpanded && !timerFinished && !isRunning && !isPaused && (
          <div
            id="timer-target-time-tray"
            data-widget-controls-tray
            className="mt-2 transition-all duration-200 ease-out"
          >
            <div className="rounded-lg border border-white/40 bg-white/45 p-2 shadow-sm backdrop-blur-md dark:border-warm-gray-600/40 dark:bg-warm-gray-800/45">
              <div className="flex items-center justify-center gap-2">
                <span className={cn("text-xs font-medium uppercase tracking-wide whitespace-nowrap", text.muted)}>
                  Until
                </span>
                  <TargetTimeDropdown
                    field="hour"
                    label="Target hour"
                    value={targetTime.hour}
                    values={[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]}
                    isOpen={openTargetTimeField === 'hour'}
                    onToggle={() => setOpenTargetTimeField(prev => prev === 'hour' ? null : 'hour')}
                    onDismiss={handleTargetTimeDismiss}
                    onChange={(hour) => handleTargetTimeChange('hour', hour)}
                  />
                  <span className={cn("text-lg font-medium", text.muted)}>:</span>
                  <TargetTimeDropdown
                    field="minute"
                    label="Target minute"
                    value={targetTime.minute}
                    values={Array.from({ length: 12 }, (_, index) => index * 5)}
                    formatValue={(minute) => minute.toString().padStart(2, '0')}
                    isOpen={openTargetTimeField === 'minute'}
                    onToggle={() => setOpenTargetTimeField(prev => prev === 'minute' ? null : 'minute')}
                    onDismiss={handleTargetTimeDismiss}
                    onChange={(minute) => handleTargetTimeChange('minute', minute)}
                  />
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
            data-widget-controls-tray
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
