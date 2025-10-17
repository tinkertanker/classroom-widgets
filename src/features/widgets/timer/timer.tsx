import React, { useCallback, useRef } from "react";
import { useTheme } from "../../../shared/hooks/useWorkspace";
import { 
  useTimeSegmentEditor, 
  useTimerCountdown, 
  useTimerAnimation, 
  useTimerAudio 
} from "./hooks";
import { cn, widgetWrapper, widgetContainer, widgetControls, buttons, text, transitions, backgrounds } from '../../../shared/utils/styles';
import { HamsterAnimation } from './components/HamsterAnimation';
import { TimeDisplay } from './components/TimeDisplay';
import timerEndSound1 from "./timer-end.mp3";
import timerEndSound2 from "./timer-end-2.wav";
import timerEndSound3 from "./timer-end-3.mp3";

const Timer = () => {
  const { isDark } = useTheme();

  // Timer audio hooks for all three sounds
  const { playSound: playSound1 } = useTimerAudio({ 
    soundUrl: timerEndSound1,
    enabled: true 
  });
  
  const { playSound: playSound2 } = useTimerAudio({ 
    soundUrl: timerEndSound2,
    enabled: true 
  });
  
  const { playSound: playSound3 } = useTimerAudio({ 
    soundUrl: timerEndSound3,
    enabled: true 
  });

  // Randomly play one of the three sounds
  const playRandomSound = useCallback(() => {
    const randomChoice = Math.random();
    if (randomChoice < 0.33) {
      playSound1();
    } else if (randomChoice < 0.67) {
      playSound2();
    } else {
      playSound3();
    }
  }, [playSound1, playSound2, playSound3]);

  // Store segment editor update function in ref to avoid circular dependency
  const segmentEditorUpdateRef = React.useRef<((time: number) => void) | null>(null);

  // Timer countdown hook
  const {
    time,
    initialTime,
    originalTime,
    isRunning,
    isPaused,
    timerFinished,
    progress,
    startTimer,
    pauseTimer,
    resumeTimer,
    restartTimer
  } = useTimerCountdown({
    onTimeUp: playRandomSound,
    onTick: (newTime) => {
      // Update the time segment editor when time changes
      segmentEditorUpdateRef.current?.(newTime);
    }
  });

  // Time segment editor hook
  const segmentEditor = useTimeSegmentEditor({
    initialValues: ['00', '00', '10'],
    isRunning: isRunning, // Disable editing when actively running (allow when paused)
    onValuesChange: (values, timeValues) => {
      // When editing time segments while paused, the new value will be used on resume
      const totalSeconds = timeValues[0] * 3600 + timeValues[1] * 60 + timeValues[2];
      // This will be used when starting/resuming the timer
    }
  });

  // Store the update function in ref
  segmentEditorUpdateRef.current = segmentEditor.updateFromTime;

  // Timer animation hook
  const { pulseAngle, arcPath, isHamsterOnColoredArc, isHamsterOnGreyArc } = useTimerAnimation({
    isRunning,
    progress
  });

  // You can now use isHamsterOnColoredArc and isHamsterOnGreyArc
  // These values update in real-time as the hamster moves around the circle

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
    // Update segment editor to show the original time (not the edited time)
    segmentEditor.updateFromTime(originalTime);
  }, [restartTimer, segmentEditor.updateFromTime, originalTime]);

  // Determine which controls to show
  const showStartButton = !isRunning && !isPaused && !timerFinished;
  const showPauseButton = isRunning;
  const showResumeButton = isPaused;
  const inEditMode = !isRunning;

  return (
    <>
      <style>{`
        @keyframes pulse-scale {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes border-pulse {
          0%, 100% {
            border-color: rgb(153, 27, 27);
            box-shadow: 0 0 0 0 rgba(153, 27, 27, 0.7);
          }
          50% {
            border-color: rgb(185, 28, 28);
            box-shadow: 0 0 0 8px rgba(153, 27, 27, 0);
          }
        }
      `}</style>
      <div className={widgetWrapper}>
        <div
          className="rounded-lg  dark:border-warm-gray-700 w-full h-full flex flex-col relative"
          style={{
            containerType: 'size',
            ...(timerFinished && {
              animation: 'border-pulse 1.5s ease-in-out infinite',
              borderWidth: '3px',
              borderColor: 'rgb(153, 27, 27)'
            })
          }}
        >
          {/* Content area - fills remaining vertical space */}
          <div className="flex-1 flex items-center justify-center relative">
            {/* Content area with card background - full coverage */}
            <div className="w-full h-full bg-soft-white dark:bg-warm-gray-800 rounded-t-lg flex items-center justify-center absolute shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)]">
              <svg className="w-full h-full pointer-events-none" viewBox="0 0 100 100">
                  {/* Gradient definition for rainbow arc */}
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

                    {/* Moderate glow filter */}
                    <filter id="rainbowGlow" x="-200%" y="-200%" width="500%" height="500%">
                      <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>

                    {/* Enhanced glow filter - more subtle */}
                    <filter id="enhancedRainbowGlow" x="-200%" y="-200%" width="500%" height="500%">
                      <feGaussianBlur stdDeviation="4" result="bigBlur"/>
                      <feGaussianBlur stdDeviation="2" result="mediumBlur"/>
                      <feColorMatrix in="bigBlur" type="saturate" values="1.5" result="saturatedBigBlur"/>
                      <feMerge>
                        <feMergeNode in="saturatedBigBlur"/>
                        <feMergeNode in="mediumBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>

                    {/* Pulsing glow for running state (Dark Mode) */}
                    <filter id="pulsingGlow" x="-200%" y="-200%" width="500%" height="500%">
                      <feGaussianBlur stdDeviation="4" result="blur1">
                        <animate attributeName="stdDeviation" values="4;8;4" dur="2s" repeatCount="indefinite"/>
                      </feGaussianBlur>
                      <feGaussianBlur stdDeviation="2" result="blur2">
                        <animate attributeName="stdDeviation" values="2;4;2" dur="2s" begin="0.5s" repeatCount="indefinite"/>
                      </feGaussianBlur>
                      <feColorMatrix in="blur1" type="saturate" values="1.5" result="saturatedBlur"/>
                      <feMerge>
                        <feMergeNode in="saturatedBlur"/>
                        <feMergeNode in="blur2"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>

                    {/* Light Mode Glow Filters */}
                    <filter id="lightModeGlow" x="-200%" y="-200%" width="500%" height="500%">
                      <feColorMatrix type="saturate" values="0.6" result="desaturatedSource"/>
                      <feGaussianBlur in="desaturatedSource" stdDeviation="3" result="blur"/>
                      <feMerge>
                        <feMergeNode in="blur"/>
                        <feMergeNode in="desaturatedSource"/>
                      </feMerge>
                    </filter>
                    <filter id="lightModePulsingGlow" x="-200%" y="-200%" width="500%" height="500%">
                      <feColorMatrix type="saturate" values="0.6" result="desaturatedSource"/>
                      <feGaussianBlur in="desaturatedSource" stdDeviation="3" result="blur">
                        <animate attributeName="stdDeviation" values="3;5;3" dur="2s" repeatCount="indefinite"/>
                      </feGaussianBlur>
                      <feMerge>
                        <feMergeNode in="blur"/>
                        <feMergeNode in="desaturatedSource"/>
                      </feMerge>
                    </filter>

                    {/* Simple drop shadow for extra definition */}
                    <filter id="dropShadow" x="-50%" y="-50%" width="200%" height="200%">
                      <feDropShadow dx="0" dy="0" stdDeviation="3" floodOpacity="0.3"/>
                    </filter>
                  </defs>

                  {/* 2. Background circle (gray) - shows full timer path */}
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    stroke="rgb(229, 231, 235)"
                    strokeWidth="3"
                    fill="none"
                    className="dark:stroke-warm-gray-700"
                  />

                  {/* 3. Main rainbow arc on top - shows progress */}
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    stroke="url(#rainbowGradient)"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 45}
                    strokeDashoffset={(2 * Math.PI * 45) * (1 - progress)}
                    filter={
                      isRunning
                        ? isDark ? "url(#pulsingGlow) url(#dropShadow)" : "url(#lightModePulsingGlow) url(#dropShadow)"
                        : isDark ? "url(#enhancedRainbowGlow) url(#dropShadow)" : "url(#lightModeGlow) url(#dropShadow)"
                    }
                    transform="rotate(-90 50 50)"
                  />

                  {isRunning && time > 0 && <HamsterAnimation pulseAngle={pulseAngle} isOnColoredArc={isHamsterOnColoredArc} />}
                </svg>
                <div
                  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
                >
                  {timerFinished ? (
                    /* TIME'S UP DISPLAY */
                    <div className="flex items-center justify-center w-full h-full">
                      <span
                        style={{
                          fontSize: 'clamp(1.5rem, 15cqmin, 4rem)',
                          animation: 'pulse-scale 1s ease-in-out infinite'
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
                    /* EDIT MODE - Inline Editable Display */
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

                            {/* Colon separator */}
                            {idx < segmentEditor.values.length - 1 && (
                              <span className={cn("leading-none mx-0", text.primary)} style={{ fontSize: 'clamp(1.5rem, 12cqmin, 3rem)' }}>
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
          </div>

        {/* Control bar emerging from below */}
        <div className={cn(widgetControls, "gap-2 justify-between")}>
          {timerFinished ? (
            <button
              className={cn(buttons.primary, "px-3 py-1.5 text-sm")}
              onClick={handleRestart}
            >
              {'\u21BB'} Restart
            </button>
          ) : showStartButton ? (
            <button
              className={cn(buttons.primary, "px-3 py-1.5 text-sm")}
              onClick={handleStart}
            >
              {'\u25B6'} Start
            </button>
          ) : (
            <>
              {showPauseButton && (
                <button
                  className={cn(buttons.primary, "px-3 py-1.5 text-sm")}
                  onClick={pauseTimer}
                >
                  {'\u23F8'} Pause
                </button>
              )}
              {showResumeButton && (
                <button
                  className={cn(buttons.primary, "px-3 py-1.5 text-sm")}
                  onClick={handleResume}
                >
                  {'\u25B6'} Resume
                </button>
              )}
              <button
                className={cn(buttons.primary, "px-3 py-1.5 text-sm")}
                onClick={handleRestart}
              >
                {'\u21BB'} Restart
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default Timer;