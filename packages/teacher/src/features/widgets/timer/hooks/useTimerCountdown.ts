import { useState, useEffect, useCallback, useRef } from 'react';

export interface TimerPersistedState {
  endTime: number | null;        // Absolute timestamp when timer hits zero
  initialTime: number;           // Total seconds the timer was set to
  originalTime: number;          // The very first time set (for restart)
  isRunning: boolean;
  isPaused: boolean;
  pausedTimeRemaining: number;   // Seconds remaining when paused
}

interface UseTimerCountdownProps {
  onTimeUp?: () => void;
  onTick?: (time: number) => void;
  restoredState?: TimerPersistedState;
}

/**
 * Hook to manage timer countdown logic
 * Handles start, pause, resume, restart, and time calculations
 * Supports state persistence via restoredState and getPersistedState
 */
export function useTimerCountdown({ onTimeUp, onTick, restoredState }: UseTimerCountdownProps = {}) {
  // Compute restored values once on mount
  const restoredRef = useRef(restoredState);
  const hasRestoredRef = useRef(false);

  const getInitialState = () => {
    const rs = restoredRef.current;
    if (!rs || hasRestoredRef.current) return null;
    hasRestoredRef.current = true;

    if (rs.isRunning && rs.endTime) {
      const remaining = Math.max(0, Math.ceil((rs.endTime - Date.now()) / 1000));
      if (remaining > 0) {
        return { time: remaining, initialTime: rs.initialTime, originalTime: rs.originalTime, isRunning: true, isPaused: false, timerFinished: false };
      } else {
        // Timer expired while unmounted
        return { time: 0, initialTime: rs.initialTime, originalTime: rs.originalTime, isRunning: false, isPaused: false, timerFinished: true };
      }
    }
    if (rs.isPaused) {
      return { time: rs.pausedTimeRemaining, initialTime: rs.initialTime, originalTime: rs.originalTime, isRunning: false, isPaused: true, timerFinished: false };
    }
    return null;
  };

  const restored = getInitialState();

  const [initialTime, setInitialTime] = useState(restored?.initialTime ?? 10);
  const [time, setTime] = useState(restored?.time ?? 10);
  const [isRunning, setIsRunning] = useState(restored?.isRunning ?? false);
  const [isPaused, setIsPaused] = useState(restored?.isPaused ?? false);
  const [timerFinished, setTimerFinished] = useState(restored?.timerFinished ?? false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(restored?.isRunning ? Date.now() : null);
  const pausedTimeRef = useRef<number>(restored?.time ?? 0);
  const originalTimeRef = useRef<number>(restored?.originalTime ?? 10);
  // Track the absolute end time for persistence
  const endTimeRef = useRef<number | null>(
    restored?.isRunning && restored.time > 0 ? Date.now() + restored.time * 1000 : null
  );

  // Store callbacks in refs to avoid dependency issues
  const onTimeUpRef = useRef(onTimeUp);
  const onTickRef = useRef(onTick);

  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
    onTickRef.current = onTick;
  }, [onTimeUp, onTick]);

  const getElapsedSeconds = useCallback(() => {
    if (startTimeRef.current === null) {
      return 0;
    }

    return Math.floor((Date.now() - startTimeRef.current) / 1000);
  }, []);

  const getRunningRemainingTime = useCallback(() => {
    return Math.max(0, pausedTimeRef.current - getElapsedSeconds());
  }, [getElapsedSeconds]);

  // Fire onTimeUp if timer expired while unmounted
  useEffect(() => {
    if (restored?.timerFinished) {
      onTimeUpRef.current?.();
    }
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
          endTimeRef.current = null;
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
    endTimeRef.current = Date.now() + totalSeconds * 1000;
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
    endTimeRef.current = null;
  }, [time]);

  const resumeTimer = useCallback(() => {
    if (time > 0) {
      setIsRunning(true);
      setIsPaused(false);
      // Reset the start time when resuming
      startTimeRef.current = Date.now();
      pausedTimeRef.current = time;
      endTimeRef.current = Date.now() + time * 1000;
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
    endTimeRef.current = null;
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
    endTimeRef.current = null;
  }, []);

  const adjustTime = useCallback((deltaSeconds: number) => {
    const safeDelta = Math.max(0, Math.floor(deltaSeconds));

    if (safeDelta === 0 || timerFinished) {
      return;
    }

    if (isRunning && startTimeRef.current !== null) {
      const nextTime = getRunningRemainingTime() + safeDelta;

      pausedTimeRef.current += safeDelta;
      originalTimeRef.current += safeDelta;
      endTimeRef.current = Date.now() + nextTime * 1000;

      setTime(nextTime);
      setInitialTime(prev => prev + safeDelta);
      onTickRef.current?.(nextTime);
      return;
    }

    const nextTime = time + safeDelta;

    pausedTimeRef.current = nextTime;
    originalTimeRef.current += safeDelta;
    endTimeRef.current = null;

    setTime(nextTime);
    setInitialTime(prev => prev + safeDelta);
    onTickRef.current?.(nextTime);
  }, [getRunningRemainingTime, isRunning, time, timerFinished]);

  // Calculate progress percentage
  const progress = initialTime > 0 ? time / initialTime : 0;

  // Get persistable state snapshot
  const getPersistedState = useCallback((): TimerPersistedState => ({
    endTime: endTimeRef.current,
    initialTime,
    originalTime: originalTimeRef.current,
    isRunning,
    isPaused,
    pausedTimeRemaining: isPaused ? time : pausedTimeRef.current,
  }), [initialTime, isRunning, isPaused, time]);

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
    resetTimer,
    adjustTime,
    getPersistedState
  };
}
