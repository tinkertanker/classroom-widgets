import React, { useState, useEffect, useRef } from "react";

// Audio import
import timerEndSound from "./timer-end.mp3";
const timerEndAudio = new Audio(timerEndSound);

const Timer = () => {
  const [initialTime, setInitialTime] = useState(10);
  const [time, setTime] = useState(10);
  const [changeTime, setChangeTime] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [inEditMode, setInEditMode] = useState(false);
  const [showStart, setShowStart] = useState(true);
  const [showResume, setShowResume] = useState(false);
  const [showPauseResume, setShowPauseResume] = useState(true);
  const [timerFinished, setTimerFinished] = useState(false);

  // Initialize values based on initialTime (10 seconds)
  const [values, setValues] = useState(['00', '00', '10']);
  const [timeValues, setTimeValues] = useState([0, 0, 10]);
  const [editingSegment, setEditingSegment] = useState<number | null>(null);
  const [tempValue, setTempValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [pulseAngle, setPulseAngle] = useState(-90); // Start at top

  // Calculate SVG path for the arc
  const getArcPath = (percentage: number) => {
    const centerRadius = 45;
    const strokeWidth = 3; // Thinner stroke
    const outerRadius = centerRadius + strokeWidth / 2;
    const innerRadius = centerRadius - strokeWidth / 2;
    const startAngle = -90; // Start at top
    const endAngle = startAngle + (percentage * 360);
    
    const startAngleRad = (startAngle * Math.PI) / 180;
    const endAngleRad = (endAngle * Math.PI) / 180;
    
    // Outer arc points
    const x1 = 50 + outerRadius * Math.cos(startAngleRad);
    const y1 = 50 + outerRadius * Math.sin(startAngleRad);
    const x2 = 50 + outerRadius * Math.cos(endAngleRad);
    const y2 = 50 + outerRadius * Math.sin(endAngleRad);
    
    // Inner arc points
    const x3 = 50 + innerRadius * Math.cos(endAngleRad);
    const y3 = 50 + innerRadius * Math.sin(endAngleRad);
    const x4 = 50 + innerRadius * Math.cos(startAngleRad);
    const y4 = 50 + innerRadius * Math.sin(startAngleRad);
    
    const largeArcFlag = percentage > 0.5 ? 1 : 0;
    
    if (percentage >= 0.9999) {
      // Full circle requires special handling
      return `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 1 1 ${x1 - 0.01} ${y1} L ${x4 - 0.01} ${y4} A ${innerRadius} ${innerRadius} 0 1 0 ${x4} ${y4} Z`;
    } else if (percentage <= 0.0001) {
      return '';
    }
    
    return `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4} Z`;
  };

  const handleSegmentClick = (index: number) => {
    if (!isRunning) {
      setEditingSegment(index);
      setTempValue(values[index]);
      setTimeout(() => inputRef.current?.select(), 0);
    }
  };

  const handleSegmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^[0-9]*$/.test(value) && value.length <= 2) {
      setTempValue(value);
    }
  };

  const handleSegmentBlur = () => {
    if (editingSegment !== null) {
      const newValues = [...values];
      const numValue = parseInt(tempValue) || 0;
      
      // Validate ranges
      let validValue = numValue;
      if (editingSegment === 0) { // hours
        validValue = Math.min(99, numValue);
      } else { // minutes or seconds
        validValue = Math.min(59, numValue);
      }
      
      newValues[editingSegment] = validValue.toString().padStart(2, '0');
      setValues(newValues);
      setTimeValues(newValues.map((x) => Number(x)));
      setEditingSegment(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSegmentBlur();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleSegmentBlur();
      const nextSegment = editingSegment !== null ? (editingSegment + 1) % 3 : 0;
      handleSegmentClick(nextSegment);
    } else if (e.key === 'Escape') {
      setEditingSegment(null);
      setTempValue('');
    }
  };

  useEffect(() => {
    if (time <= 0 && isRunning) {
      setIsRunning(false);
      setShowPauseResume(false);
      setTimerFinished(true);
      // Play the timer end sound
      timerEndAudio.play().catch(error => {
        console.error("Error playing timer end sound:", error);
      });
    }
  }, [time, isRunning]);

  const startTimer = (isResume=false) => {
    if (!timeValues[0] && !timeValues[1] && !timeValues[2]) return;

    let changes = [0, 0, 0];
    let incomingTime = timeValues[2] + timeValues[1]*60 + timeValues[0]*3600;
    if (timeValues[2] > 60) {
      changes[1] += 1;
      changes[2] -= 60;
    }
    if (timeValues[1]+changes[1] > 60) {
      changes[0] += 1;
      changes[1] -= 60;
    }
    if (timeValues[0]+changes[0] > 23) {
      let change = timeValues[0]+changes[0]-23;
      changes[0] -= change;
      incomingTime -= change*3600;
    }

    let finalValues = timeValues.map((a, i) => a+changes[i]);
    setTimeValues(finalValues);
    setValues(finalValues.map((a) => String(a).padStart(2, '0')));
    setInitialTime(isResume ? incomingTime-time+initialTime : incomingTime);
    setTime(incomingTime);
    setTimeout(() => setChangeTime(changeTime+1), 1000);

    setIsRunning(true);
    setInEditMode(false);
    setShowStart(false);
    setShowPauseResume(true);
    setTimerFinished(false);
  };
  const pauseTimer = () => {
    setIsRunning(false);
    setInEditMode(true);
    setShowResume(true);
  };
  const resumeTimer = () => {
    setShowResume(false);
    startTimer(true);
  };
  const restartTimer = () => {
    setIsRunning(false);
    setInEditMode(true);
    setShowStart(true);
    setShowResume(false);
    setTime(initialTime);
    setTimerFinished(false);

    let actualValues = [0, 0, 0];
    actualValues[0] = Math.floor(initialTime/3600);
    actualValues[1] = Math.floor(initialTime/60) > 59 ? 59 : Math.floor(initialTime/60);
    actualValues[2] = initialTime % 60;

    setTimeValues(actualValues);
    setValues(actualValues.map((a) => String(a).padStart(2, '0')));
  };

  // Timer logic
  useEffect(() => {
    if (isRunning) {
      if (time > 0) {
        let changes = [0, 0 ,0];

        if (timeValues[2] > 0) {
          changes[2]--;
        } else if (timeValues[1] > 0) {
          changes[1]--;
          changes[2]+=59;
        } else if (timeValues[0] > 0) {
          changes[0]--;
          changes[1]+=59;
          changes[2]+=59;
        }

        let finalValues = timeValues.map((a, i) => a+changes[i]);
        setTimeValues(finalValues);
        setValues(finalValues.map((a) => String(a).padStart(2, '0')));
        setTime(time-1);
        setTimeout(() => setChangeTime(changeTime+1), 1000);
      }
    } else {
      !showResume && !timerFinished && setTime(initialTime);
    }
  }, [changeTime]);

  // When entering edit mode, you can click on any segment to edit
  useEffect(() => {
    if (inEditMode) {
      // Reset editing state when entering edit mode
      setEditingSegment(null);
    }
  }, [inEditMode]);

  // Animate the pulse around the arc when timer is running
  useEffect(() => {
    if (isRunning) {
      const startTime = Date.now();
      let animationFrameId: number;
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        // Complete one rotation every 3 seconds counter-clockwise (-120 degrees/second)
        const angle = -90 - (elapsed / 1000) * 120;
        console.log(`Elapsed: ${elapsed/1000}s, Angle: ${angle}`);
        setPulseAngle(angle);
        
        animationFrameId = requestAnimationFrame(animate);
      };
      
      animationFrameId = requestAnimationFrame(animate);
      
      return () => {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
      };
    } else {
      // Reset to top when not running
      setPulseAngle(-90);
    }
  }, [isRunning]);

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
                      d={getArcPath(time / initialTime)}
                      fill="white"
                    />
                  </mask>
                </defs>
                
                {/* Full rainbow circle (always present but masked) */}
                <g mask="url(#progressMask)">
                  <path
                    d={getArcPath(1)}
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
                        <span className="leading-none text-warm-gray-800 dark:text-warm-gray-200 font-bold">{values[0]}</span>
                        <span className="leading-none text-warm-gray-800 dark:text-warm-gray-200 font-bold">:</span>
                        <span className="leading-none text-warm-gray-800 dark:text-warm-gray-200 font-bold">{values[1]}</span>
                        <span className="leading-none text-warm-gray-800 dark:text-warm-gray-200 font-bold">:</span>
                        <span className="leading-none text-warm-gray-800 dark:text-warm-gray-200 font-bold">{values[2]}</span>
                      </div>
                    ) : time >= 60 ? (
                      // Show minutes:seconds - medium text
                      <div className="flex items-center" style={{ fontSize: 'clamp(1.5rem, 20cqmin, 5rem)' }}>
                        <span className="leading-none text-warm-gray-800 dark:text-warm-gray-200 font-bold">{values[1]}</span>
                        <span className="leading-none text-warm-gray-800 dark:text-warm-gray-200 font-bold">:</span>
                        <span className="leading-none text-warm-gray-800 dark:text-warm-gray-200 font-bold">{values[2]}</span>
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
                      {values.map((val, idx) => (
                        <React.Fragment key={idx}>
                          {editingSegment === idx ? (
                            <input
                              ref={inputRef}
                              type="text"
                              value={tempValue}
                              onChange={handleSegmentChange}
                              onBlur={handleSegmentBlur}
                              onKeyDown={handleKeyDown}
                              className="text-center text-warm-gray-800 dark:text-warm-gray-200 bg-warm-gray-100 dark:bg-warm-gray-700 rounded-md outline-none focus:ring-2 focus:ring-sage-500"
                              style={{ 
                                width: 'clamp(2.5rem, 15cqmin, 5rem)',
                                fontSize: 'clamp(1.5rem, 12cqmin, 3rem)'
                              }}
                              autoFocus
                            />
                          ) : (
                            <span
                              onClick={() => handleSegmentClick(idx)}
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
                          {idx < values.length - 1 && (
                            <span className="leading-none text-warm-gray-800 dark:text-warm-gray-200 mx-0" style={{ fontSize: 'clamp(1.5rem, 12cqmin, 3rem)' }}>
                              :
                            </span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                    {!isRunning && editingSegment === null && (
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
          ) : showStart ? (
            <button
              className="px-3 py-1.5 bg-sage-500 hover:bg-sage-600 dark:bg-sage-600 dark:hover:bg-sage-700 text-white text-sm rounded transition-colors duration-200"
              onClick={() => startTimer()}
            >
              {'\u25B6'} Start
            </button>
          ) : (
            <>
              {showPauseResume && (
                showResume ? (
                  <button
                    className="px-3 py-1.5 bg-sage-500 hover:bg-sage-600 dark:bg-sage-600 dark:hover:bg-sage-700 text-white text-sm rounded transition-colors duration-200"
                    onClick={resumeTimer}
                  >
                    {'\u25B6'} Resume
                  </button>
                ) : (
                  <button
                    className="px-3 py-1.5 bg-sage-500 hover:bg-sage-600 dark:bg-sage-600 dark:hover:bg-sage-700 text-white text-sm rounded transition-colors duration-200"
                    onClick={pauseTimer}
                  >
                    {'\u23F8'} Pause
                  </button>
                )
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

