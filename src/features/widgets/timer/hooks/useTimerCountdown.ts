import { useState, useEffect, useCallback, useRef } from 'react';

interface UseTimerCountdownProps {
  onTimeUp?: () => void;
  onTick?: (time: number) => void;
}

/**
 * Hook to manage timer countdown logic
 * Handles start, pause, resume, restart, and time calculations
 */
export function useTimerCountdown({ onTimeUp, onTick }: UseTimerCountdownProps = {}) {
  const [initialTime, setInitialTime] = useState(10);
  const [time, setTime] = useState(10);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timerFinished, setTimerFinished] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Store callbacks in refs to avoid dependency issues
  const onTimeUpRef = useRef(onTimeUp);
  const onTickRef = useRef(onTick);
  
  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
    onTickRef.current = onTick;
  }, [onTimeUp, onTick]);

  // Handle countdown tick
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTime(prevTime => {
          if (prevTime <= 1) {
            setIsRunning(false);
            setTimerFinished(true);
            onTimeUpRef.current?.();
            onTickRef.current?.(0);
            return 0;
          }
          
          const newTime = prevTime - 1;
          onTickRef.current?.(newTime);
          return newTime;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning]); // Only depend on isRunning, not time

  const startTimer = useCallback((totalSeconds: number) => {
    setInitialTime(totalSeconds);
    setTime(totalSeconds);
    setIsRunning(true);
    setIsPaused(false);
    setTimerFinished(false);
  }, []);

  const pauseTimer = useCallback(() => {
    setIsRunning(false);
    setIsPaused(true);
  }, []);

  const resumeTimer = useCallback(() => {
    if (time > 0) {
      setIsRunning(true);
      setIsPaused(false);
    }
  }, [time]);

  const restartTimer = useCallback(() => {
    setTime(initialTime);
    setIsRunning(false);
    setIsPaused(false);
    setTimerFinished(false);
  }, [initialTime]);

  const resetTimer = useCallback((newInitialTime: number) => {
    setInitialTime(newInitialTime);
    setTime(newInitialTime);
    setIsRunning(false);
    setIsPaused(false);
    setTimerFinished(false);
  }, []);

  // Calculate progress percentage
  const progress = initialTime > 0 ? time / initialTime : 0;

  return {
    time,
    initialTime,
    isRunning,
    isPaused,
    timerFinished,
    progress,
    startTimer,
    pauseTimer,
    resumeTimer,
    restartTimer,
    resetTimer
  };
}