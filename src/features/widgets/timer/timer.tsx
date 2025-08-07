import React, { useCallback } from "react";
import { 
  useTimeSegmentEditor, 
  useTimerCountdown, 
  useTimerAnimation, 
  useTimerAudio 
} from "./hooks";
import { cn, widgetContainer, buttons, text, transitions, backgrounds } from '../../../shared/utils/styles';
import { HamsterAnimation } from './components/HamsterAnimation';
import { TimeDisplay } from './components/TimeDisplay';
import timerEndSound from "./timer-end.mp3";

const Timer = () => {
  // Timer audio hook
  const { playSound } = useTimerAudio({ 
    soundUrl: timerEndSound,
    enabled: true 
  });

  // Time segment editor hook
  const segmentEditor = useTimeSegmentEditor({
    initialValues: ['00', '00', '10'],
    isRunning: false, // Will be updated by timer state
    onValuesChange: (values, timeValues) => {
      // When editing time segments, update the initial time for the timer
      const totalSeconds = timeValues[0] * 3600 + timeValues[1] * 60 + timeValues[2];
      // This will be used when starting the timer
    }
  });

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
    restartTimer
  } = useTimerCountdown({
    onTimeUp: playSound,
    onTick: (newTime) => {
      // Update the time segment editor when time changes
      segmentEditor.updateFromTime(newTime);
    }
  });

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

  // Determine which controls to show
  const showStartButton = !isRunning && !isPaused && !timerFinished;
  const showPauseButton = isRunning;
  const showResumeButton = isPaused;
  const inEditMode = !isRunning;

  return (
    <>
      <div className={cn(widgetContainer)} style={{ containerType: 'size' }}>
        <div className="flex-1 relative flex items-center justify-center p-4">
          <svg className="w-full h-full pointer-events-none" viewBox="0 0 100 100">
                {/* Background circle (gray) */}
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  stroke="rgb(229, 231, 235)"
                  strokeWidth="3"
                  fill="none"
                  className="dark:stroke-warm-gray-700"
                />
                {/* Gradient definition for rainbow arc */}
                <defs>
                  <linearGradient id="rainbowGradient" gradientUnits="userSpaceOnUse" x1="50" y1="5" x2="50" y2="95">
                    <stop offset="0%" stopColor="#ff6b6b" />
                    <stop offset="16.66%" stopColor="#ff9a44" />
                    <stop offset="33.33%" stopColor="#ffd93d" />
                    <stop offset="50%" stopColor="#6bcf7f" />
                    <stop offset="66.66%" stopColor="#4ecdc4" />
                    <stop offset="83.33%" stopColor="#5c7cfa" />
                    <stop offset="100%" stopColor="#a864fd" />
                  </linearGradient>
                  {/* Mask to show only the active portion */}
                  <mask id="progressMask">
                    <rect x="0" y="0" width="100" height="100" fill="black" />
                    <path
                      d={arcPath}
                      fill="white"
                    />
                  </mask>
                </defs>
                
                {/* Full rainbow circle (always present but masked) */}
                <g mask="url(#progressMask)">
                  <path
                    d={useTimerAnimation({ isRunning: false, progress: 1 }).arcPath}
                    fill="url(#rainbowGradient)"
                  />
                </g>
                
                {isRunning && time > 0 && <HamsterAnimation pulseAngle={pulseAngle} isOnColoredArc={isHamsterOnColoredArc} />}
              </svg>
              <div
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[70%] h-[70%] flex items-center justify-center"
              >
                {timerFinished ? (
                  /* TIME'S UP DISPLAY */
                  <div className="flex items-center justify-center w-full h-full">
                    <span 
                      style={{ fontSize: 'clamp(1.5rem, 15cqmin, 4rem)' }} 
                      className={cn("font-bold text-center", text.primary)}
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
        <div className="p-3 border-t border-warm-gray-200 dark:border-warm-gray-700 flex items-center gap-2">
          {timerFinished ? (
            <button
              className={cn(buttons.primary, "px-3 py-1.5 text-sm")}
              onClick={restartTimer}
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
                  onClick={resumeTimer}
                >
                  {'\u25B6'} Resume
                </button>
              )}
              <button
                className={cn(buttons.primary, "px-3 py-1.5 text-sm")}
                onClick={restartTimer}
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