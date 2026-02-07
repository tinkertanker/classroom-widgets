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
  const startTimeRef = useRef<number | null>(null);
  const pausedTimeRef = useRef<number>(0);
  const originalTimeRef = useRef<number>(10); // Store the very first time set

  // Store callbacks in refs to avoid dependency issues
  const onTimeUpRef = useRef(onTimeUp);
  const onTickRef = useRef(onTick);

  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
    onTickRef.current = onTick;
  }, [onTimeUp, onTick]);

  // Handle countdown tick using timestamp-based timing
  useEffect(() => {
    if (isRunning && startTimeRef.current !== null) {
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - startTimeRef.current!) / 1000);
        const newTime = Math.max(0, pausedTimeRef.current - elapsed);

        setTime(newTime);

        if (newTime <= 0) {
          setIsRunning(false);
          setTimerFinished(true);
          onTimeUpRef.current?.();
          onTickRef.current?.(0);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        } else {
          onTickRef.current?.(newTime);
        }
      }, 100); // Check every 100ms for smoother updates
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
  }, [isRunning]); // Only depend on isRunning

  const startTimer = useCallback((totalSeconds: number, updateOriginal: boolean = true) => {
    setInitialTime(totalSeconds);
    setTime(totalSeconds);
    setIsRunning(true);
    setIsPaused(false);
    setTimerFinished(false);
    startTimeRef.current = Date.now();
    pausedTimeRef.current = totalSeconds;
    // Only update the original time on the very first start, not on resume with edits
    if (updateOriginal) {
      originalTimeRef.current = totalSeconds;
    }
  }, []);

  const pauseTimer = useCallback(() => {
    setIsRunning(false);
    setIsPaused(true);
    // Store the current time when pausing
    pausedTimeRef.current = time;
    startTimeRef.current = null;
  }, [time]);

  const resumeTimer = useCallback(() => {
    if (time > 0) {
      setIsRunning(true);
      setIsPaused(false);
      // Reset the start time when resuming
      startTimeRef.current = Date.now();
      pausedTimeRef.current = time;
    }
  }, [time]);

  const restartTimer = useCallback(() => {
    // Restart always goes back to the original time, not edited time
    const timeToRestore = originalTimeRef.current;
    setTime(timeToRestore);
    setInitialTime(timeToRestore);
    setIsRunning(false);
    setIsPaused(false);
    setTimerFinished(false);
    startTimeRef.current = null;
    pausedTimeRef.current = timeToRestore;
  }, []);

  const resetTimer = useCallback((newInitialTime: number) => {
    setInitialTime(newInitialTime);
    setTime(newInitialTime);
    setIsRunning(false);
    setIsPaused(false);
    setTimerFinished(false);
    startTimeRef.current = null;
    pausedTimeRef.current = newInitialTime;
    originalTimeRef.current = newInitialTime;
  }, []);

  // Calculate progress percentage
  const progress = initialTime > 0 ? time / initialTime : 0;

  return {
    time,
    initialTime,
    originalTime: originalTimeRef.current,
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