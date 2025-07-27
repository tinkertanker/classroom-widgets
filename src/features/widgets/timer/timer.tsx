import React, { useCallback, useMemo } from "react";
import { 
  useTimeSegmentEditor, 
  useTimerCountdown, 
  useTimerAnimation, 
  useTimerAudio 
} from "./hooks";

// Audio import
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
  const { pulseAngle, arcPath } = useTimerAnimation({ 
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

  // Determine which controls to show
  const showStartButton = !isRunning && !isPaused && !timerFinished;
  const showPauseButton = isRunning;
  const showResumeButton = isPaused;
  const inEditMode = !isRunning;

  return (
    <>
      <div className="bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 w-full h-full overflow-hidden flex flex-col" style={{ containerType: 'size' }}>
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
                
                {/* Animated hamster on wheel */}
                {isRunning && time > 0 && (
                    <g transform={`rotate(${pulseAngle} 50 50)`}>
                      {/* Hamster running on smaller circle path inside the wheel */}
                      <g transform="translate(50, 8) scale(0.9, -0.9)">
                      {/* Hamster body */}
                      <ellipse 
                        cx="0" 
                        cy="0" 
                        rx="6" 
                        ry="4.5" 
                        fill="#D2691E" 
                        stroke="#8B4513" 
                        strokeWidth="0.8"
                      />
                      {/* Hamster head */}
                      <circle 
                        cx="-4" 
                        cy="-1.5" 
                        r="3.5" 
                        fill="#DEB887" 
                        stroke="#8B4513" 
                        strokeWidth="0.8"
                      />
                      {/* Hamster ears */}
                      <circle cx="-5.5" cy="-3.5" r="1.3" fill="#D2691E" />
                      <circle cx="-2.5" cy="-3.5" r="1.3" fill="#D2691E" />
                      {/* Hamster eyes */}
                      <circle cx="-5" cy="-1.5" r="0.7" fill="#000" />
                      <circle cx="-3" cy="-1.5" r="0.7" fill="#000" />
                      {/* Eye sparkle */}
                      <circle cx="-4.8" cy="-1.8" r="0.3" fill="#fff" />
                      <circle cx="-2.8" cy="-1.8" r="0.3" fill="#fff" />
                      {/* Hamster nose */}
                      <circle cx="-6.5" cy="-0.5" r="0.4" fill="#8B4513" />
                      {/* Hamster feet - animated running with better visibility */}
                      <g>
                        {/* Front feet - made more visible */}
                        <ellipse 
                          cx="-2.5" 
                          cy="3.5" 
                          rx="1" 
                          ry="1.5" 
                          fill="#654321"
                          stroke="#3D2611"
                          strokeWidth="0.3"
                        >
                          <animateTransform
                            attributeName="transform"
                            attributeType="XML"
                            type="rotate"
                            values="0 -2.5 3.5;-30 -2.5 3.5;30 -2.5 3.5;0 -2.5 3.5"
                            dur="0.4s"
                            repeatCount="indefinite"
                          />
                        </ellipse>
                        <ellipse 
                          cx="-4" 
                          cy="3.5" 
                          rx="1" 
                          ry="1.5" 
                          fill="#654321"
                          stroke="#3D2611"
                          strokeWidth="0.3"
                        >
                          <animateTransform
                            attributeName="transform"
                            attributeType="XML"
                            type="rotate"
                            values="0 -4 3.5;30 -4 3.5;-30 -4 3.5;0 -4 3.5"
                            dur="0.4s"
                            repeatCount="indefinite"
                          />
                        </ellipse>
                        {/* Back feet - made more visible */}
                        <ellipse 
                          cx="1.5" 
                          cy="3.5" 
                          rx="1" 
                          ry="1.5" 
                          fill="#654321"
                          stroke="#3D2611"
                          strokeWidth="0.3"
                        >
                          <animateTransform
                            attributeName="transform"
                            attributeType="XML"
                            type="rotate"
                            values="0 1.5 3.5;30 1.5 3.5;-30 1.5 3.5;0 1.5 3.5"
                            dur="0.4s"
                            repeatCount="indefinite"
                          />
                        </ellipse>
                        <ellipse 
                          cx="3" 
                          cy="3.5" 
                          rx="1" 
                          ry="1.5" 
                          fill="#654321"
                          stroke="#3D2611"
                          strokeWidth="0.3"
                        >
                          <animateTransform
                            attributeName="transform"
                            attributeType="XML"
                            type="rotate"
                            values="0 3 3.5;-30 3 3.5;30 3 3.5;0 3 3.5"
                            dur="0.4s"
                            repeatCount="indefinite"
                          />
                        </ellipse>
                      </g>
                      {/* Hamster tail */}
                      <path 
                        d="M 4.5 0 Q 7 -1.5 8.5 1" 
                        stroke="#8B4513" 
                        strokeWidth="1.2" 
                        fill="none"
                        strokeLinecap="round"
                      />
                    </g>
                  </g>
                )}
              </svg>
              <div
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[70%] h-[70%] flex items-center justify-center"
              >
                {timerFinished ? (
                  /* TIME'S UP DISPLAY */
                  <div className="flex items-center justify-center w-full h-full">
                    <span 
                      style={{ fontSize: 'clamp(1.5rem, 15cqmin, 4rem)' }} 
                      className="font-bold text-warm-gray-900 dark:text-warm-gray-100 text-center"
                    >
                      Time's Up!
                    </span>
                  </div>
                ) : isRunning && !inEditMode ? (
                  /* DISPLAY MODE */
                  <div className="flex items-center justify-center w-full h-full cursor-pointer" onClick={pauseTimer}>
                    {time >= 3600 ? (
                      // Show hours:minutes:seconds - smaller text to fit
                      <div className="flex items-center" style={{ fontSize: 'clamp(1rem, 12cqmin, 3rem)' }}>
                        <span className="leading-none text-warm-gray-800 dark:text-warm-gray-200 font-bold">{segmentEditor.values[0]}</span>
                        <span className="leading-none text-warm-gray-800 dark:text-warm-gray-200 font-bold">:</span>
                        <span className="leading-none text-warm-gray-800 dark:text-warm-gray-200 font-bold">{segmentEditor.values[1]}</span>
                        <span className="leading-none text-warm-gray-800 dark:text-warm-gray-200 font-bold">:</span>
                        <span className="leading-none text-warm-gray-800 dark:text-warm-gray-200 font-bold">{segmentEditor.values[2]}</span>
                      </div>
                    ) : time >= 60 ? (
                      // Show minutes:seconds - medium text
                      <div className="flex items-center" style={{ fontSize: 'clamp(1.5rem, 20cqmin, 5rem)' }}>
                        <span className="leading-none text-warm-gray-800 dark:text-warm-gray-200 font-bold">{segmentEditor.values[1]}</span>
                        <span className="leading-none text-warm-gray-800 dark:text-warm-gray-200 font-bold">:</span>
                        <span className="leading-none text-warm-gray-800 dark:text-warm-gray-200 font-bold">{segmentEditor.values[2]}</span>
                      </div>
                    ) : (
                      // Show only seconds - largest text
                      <div className="flex items-center" style={{ fontSize: 'clamp(2rem, 28cqmin, 7rem)' }}>
                        <span className="leading-none text-warm-gray-800 dark:text-warm-gray-200 font-bold">{time}</span>
                      </div>
                    )}
                  </div>
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
                              className="text-center text-warm-gray-800 dark:text-warm-gray-200 bg-warm-gray-100 dark:bg-warm-gray-700 rounded-md outline-none focus:ring-2 focus:ring-sage-500"
                              style={{ 
                                width: 'clamp(2.5rem, 15cqmin, 5rem)',
                                fontSize: 'clamp(1.5rem, 12cqmin, 3rem)'
                              }}
                              autoFocus
                            />
                          ) : (
                            <span
                              onClick={() => segmentEditor.handleSegmentClick(idx)}
                              className={`leading-none text-warm-gray-800 dark:text-warm-gray-200 cursor-pointer hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 px-1 rounded-md transition-colors ${
                                !isRunning ? 'hover:text-sage-600' : ''
                              }`}
                              title={!isRunning ? 'Click to edit' : ''}
                              style={{ fontSize: 'clamp(1.5rem, 12cqmin, 3rem)' }}
                            >
                              {val}
                            </span>
                          )}
                          
                          {/* Colon separator */}
                          {idx < segmentEditor.values.length - 1 && (
                            <span className="leading-none text-warm-gray-800 dark:text-warm-gray-200 mx-0" style={{ fontSize: 'clamp(1.5rem, 12cqmin, 3rem)' }}>
                              :
                            </span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                    {!isRunning && segmentEditor.editingSegment === null && (
                      <div className="text-xs text-warm-gray-500 dark:text-warm-gray-400 mt-1">
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
              className="px-3 py-1.5 bg-sage-500 hover:bg-sage-600 dark:bg-sage-600 dark:hover:bg-sage-700 text-white text-sm rounded transition-colors duration-200"
              onClick={restartTimer}
            >
              {'\u21BB'} Restart
            </button>
          ) : showStartButton ? (
            <button
              className="px-3 py-1.5 bg-sage-500 hover:bg-sage-600 dark:bg-sage-600 dark:hover:bg-sage-700 text-white text-sm rounded transition-colors duration-200"
              onClick={handleStart}
            >
              {'\u25B6'} Start
            </button>
          ) : (
            <>
              {showPauseButton && (
                <button
                  className="px-3 py-1.5 bg-sage-500 hover:bg-sage-600 dark:bg-sage-600 dark:hover:bg-sage-700 text-white text-sm rounded transition-colors duration-200"
                  onClick={pauseTimer}
                >
                  {'\u23F8'} Pause
                </button>
              )}
              {showResumeButton && (
                <button
                  className="px-3 py-1.5 bg-sage-500 hover:bg-sage-600 dark:bg-sage-600 dark:hover:bg-sage-700 text-white text-sm rounded transition-colors duration-200"
                  onClick={resumeTimer}
                >
                  {'\u25B6'} Resume
                </button>
              )}
              <button
                className="px-3 py-1.5 bg-sage-500 hover:bg-sage-600 dark:bg-sage-600 dark:hover:bg-sage-700 text-white text-sm rounded transition-colors duration-200"
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