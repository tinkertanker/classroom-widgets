import * as React from "react";
import { useState, useEffect, useRef } from "react";

// Removed Chakra UI imports

import ReusableButton from "../main/reusableButton.tsx";

// Audio import
const timerEndSound = require("./timer-end.mp3");
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

  // Initialize values based on initialTime (10 seconds)
  const [values, setValues] = useState(['00', '00', '10']);
  const [timeValues, setTimeValues] = useState([0, 0, 10]);
  const inputDisplays = ["hh", "mm", "ss"];
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Calculate SVG path for the arc
  const getArcPath = (percentage: number) => {
    const centerRadius = 45;
    const strokeWidth = 5; // Thinner stroke
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

  const handleChange = (e, index) => {
    const newValues = [...values];
    if (/^[0-9]*$/.test(e.target.value)) {
      newValues[index] = e.target.value;
    }
    setValues(newValues);
    setTimeValues(newValues.map((x) => Number(x)));

    if (e.target.value.length === 2 && index < inputRefs.current.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  useEffect(() => {
    if (time <= 0 && isRunning) {
      setIsRunning(false);
      setShowPauseResume(false);
      console.log("Done!");
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
    setValues(finalValues.map((a) => String(a).length<2 ? '0'+String(a) : String(a)));
    setInitialTime(isResume ? incomingTime-time+initialTime : incomingTime);
    setTime(incomingTime);
    setTimeout(() => setChangeTime(changeTime+1), 1000);

    setIsRunning(true);
    setInEditMode(false);
    setShowStart(false);
    setShowPauseResume(true);
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

    let actualValues = [0, 0, 0];
    actualValues[0] = Math.floor(initialTime/3600);
    actualValues[1] = Math.floor(initialTime/60) > 59 ? 59 : Math.floor(initialTime/60);
    actualValues[2] = initialTime % 60;

    setTimeValues(actualValues);
    setValues(actualValues.map((a) => String(a)));
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
        setValues(finalValues.map((a) => String(a).length<2 ? '0'+String(a) : String(a)));
        setTime(time-1);
        setTimeout(() => setChangeTime(changeTime+1), 1000);
      }
    } else {
      !showResume && setTime(initialTime);
    }
  }, [changeTime]);

  return (
    <>
      <div className="bg-white rounded-lg shadow-md border border-gray-200 w-full h-full overflow-hidden">
        <div className="h-[85%] py-1">
          <div className="w-full h-full py-1 relative">
            {/* Custom Circular Progress */}
            <div className="relative w-full h-full flex items-center justify-center">
              <svg className="w-full h-full pointer-events-none" viewBox="0 0 100 100">
                {/* Background circle (gray) */}
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  stroke="rgb(229, 231, 235)"
                  strokeWidth="5"
                  fill="none"
                />
                {/* Progress arc (blue) */}
                <path
                  d={getArcPath(time / initialTime)}
                  fill="rgb(59, 130, 246)"
                />
              </svg>
              <button
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                onClick={() => {
                  if (isRunning) {
                    pauseTimer();
                  }
                }}
              >
                {isRunning && !inEditMode ? (
                  /* DISPLAY MODE */
                  <div className="flex flex-col items-center space-y-1 pt-6">
                    <div className="flex flex-row items-center space-x-2">
                      <span className="text-[clamp(1rem,7vw,6rem)] leading-none text-gray-800">{values[0]}</span>
                      <span className="text-[clamp(1rem,7vw,6rem)] leading-none text-gray-800">:</span>
                      <span className="text-[clamp(1rem,7vw,6rem)] leading-none text-gray-800">{values[1]}</span>
                    </div>
                    <span className="text-[clamp(1rem,5vw,2rem)] text-gray-800">{values[2]}</span>
                  </div>
                ) : (
                  /* EDIT MODE */
                  <div className="flex flex-row items-center space-x-1">
                    {values.map((val, idx) => (
                      <React.Fragment key={idx}>
                        <input
                          value={val}
                          placeholder={inputDisplays[idx]}
                          onChange={(e) => handleChange(e, idx)}
                          onFocus={(e) => e.target.select()}
                          maxLength={2}
                          readOnly={isRunning && !inEditMode}
                          className="w-16 px-0 py-3 text-lg text-center text-gray-800 placeholder-gray-400 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        
                        {/* Add a colon after each input, except the last one */}
                        {idx < values.length - 1 && (
                          <span className="text-2xl leading-none text-gray-800">
                            :
                          </span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
        <div className="h-[15%] pt-0 px-4 pb-4">
          <div className="flex flex-row w-full gap-[5%] h-full">
            {showStart ? (
              <ReusableButton onClick={startTimer}>Start {'\u25B6'}</ReusableButton>
            ) : (
              <>
                {showPauseResume ?
                  (showResume ? (
                    <ReusableButton onClick={resumeTimer}>Resume {'\u25B6'}</ReusableButton>
                  ) : (
                    <ReusableButton onClick={pauseTimer}>Pause {'\u2590'} {'\u258C'}</ReusableButton>
                  )) : (
                    <></>
                  )}
                <ReusableButton onClick={restartTimer}>Restart {'\u21BB'}</ReusableButton>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default Timer;

