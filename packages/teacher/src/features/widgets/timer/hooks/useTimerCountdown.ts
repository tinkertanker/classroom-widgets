import { useState, useEffect, useCallback, useRef } from 'react';

export interface TimerPersistedState {
  endTime: number | null;        // Absolute timestamp when timer hits zero
  initialTime: number;           // Total seconds the timer was set to
  originalTime: number;          // The very first time set (for restart)
  isRunning: boolean;
  isPaused: boolean;
  pausedTimeRemaining: number;   // Seconds remaining when paused
  timerFinished?: boolean;
}

/**
 * The countdown is always in exactly one of these four states. Modelling it as
 * a union instead of three independent booleans keeps the four nonsensical
 * combinations (running *and* paused, finished *and* running, ...) out of the
 * type. `endTime` only exists on the running variant because it is only
 * meaningful there.
 */
export type TimerStatus =
  | { kind: 'idle' }
  | { kind: 'running'; endTime: number }
  | { kind: 'paused' }
  | { kind: 'finished' };

interface RestoredSnapshot {
  status: TimerStatus;
  time: number;
  initialTime: number;
  originalTime: number;
  /**
   * True only for the one restore branch that inherits an *unfired* end-of-timer
   * callback: the timer ran past its deadline while this widget was unmounted.
   * A payload persisted as already-finished had its callback fired in the
   * previous session, so it restores silently. Deliberately kept outside
   * TimerStatus and read once on mount — if "already notified" lived in the
   * union, `tick` would have to write it back after firing, which is exactly
   * how a double-fire gets in. As written the two notify sources are mutually
   * exclusive: this effect only fires from the restore path, and `tick` only
   * fires from the running state.
   */
  notifyTimeUp: boolean;
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

  /**
   * Maps a persisted payload onto a single TimerStatus. The persisted wire
   * format is still the historical boolean triple, so this has to cope with
   * payloads written by an older tab: `timerFinished` may be absent entirely,
   * and a payload may claim several states at once. The branch order decides
   * which claim wins, and a payload matching nothing falls through to idle.
   */
  const getInitialState = (): RestoredSnapshot | null => {
    const rs = restoredRef.current;
    if (!rs || hasRestoredRef.current) return null;
    hasRestoredRef.current = true;

    const base = { initialTime: rs.initialTime, originalTime: rs.originalTime };

    // A running payload without a usable deadline tells us nothing about when
    // it would have expired, so it falls through to the later branches.
    if (rs.isRunning && rs.endTime) {
      const remaining = Math.max(0, Math.ceil((rs.endTime - Date.now()) / 1000));
      if (remaining > 0) {
        return { ...base, time: remaining, status: { kind: 'running', endTime: rs.endTime }, notifyTimeUp: false };
      }
      // Timer expired while unmounted, so nobody has sounded the alarm yet.
      return { ...base, time: 0, status: { kind: 'finished' }, notifyTimeUp: true };
    }
    if (rs.isPaused) {
      return { ...base, time: rs.pausedTimeRemaining, status: { kind: 'paused' }, notifyTimeUp: false };
    }
    if (rs.timerFinished) {
      return { ...base, time: 0, status: { kind: 'finished' }, notifyTimeUp: false };
    }
    return null;
  };

  const restored = getInitialState();

  const [initialTime, setInitialTime] = useState(restored?.initialTime ?? 10);
  const [time, setTime] = useState(restored?.time ?? 10);
  const [status, setStatus] = useState<TimerStatus>(restored?.status ?? { kind: 'idle' });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(restored?.status.kind === 'running' ? Date.now() : null);
  const pausedTimeRef = useRef<number>(restored?.time ?? 0);
  const originalTimeRef = useRef<number>(restored?.originalTime ?? 10);

  const isRunning = status.kind === 'running';
  const isPaused = status.kind === 'paused';
  const timerFinished = status.kind === 'finished';

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

  useEffect(() => {
    if (!restored?.notifyTimeUp) {
      return;
    }
    const notification = setTimeout(() => {
      onTimeUpRef.current?.();
    }, 0);
    return () => clearTimeout(notification);
    // The restored snapshot is intentionally read only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearScheduledTick = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // The deadline is passed in rather than read from state: every change to it
  // produces a new running status, which restarts the schedule below, so a
  // self-scheduled tick can never carry a stale deadline.
  const tick = useCallback((endTime: number) => {
    const now = Date.now();
    const newTime = Math.max(0, Math.ceil((endTime - now) / 1000));

    setTime((currentTime) => (currentTime === newTime ? currentTime : newTime));

    if (newTime <= 0) {
      clearScheduledTick();
      setStatus({ kind: 'finished' });
      onTimeUpRef.current?.();
      onTickRef.current?.(0);
      return;
    }

    onTickRef.current?.(newTime);

    const msUntilNextSecond = Math.max(16, endTime - now - (newTime - 1) * 1000);
    timeoutRef.current = setTimeout(() => tick(endTime), msUntilNextSecond);
  }, [clearScheduledTick]);

  // Handle countdown tick only when the visible second changes.
  useEffect(() => {
    clearScheduledTick();

    if (status.kind === 'running') {
      tick(status.endTime);
    }

    return clearScheduledTick;
  }, [clearScheduledTick, status, tick]);

  const startTimer = useCallback((totalSeconds: number, updateOriginal: boolean = true) => {
    const now = Date.now();

    setInitialTime(totalSeconds);
    setTime(totalSeconds);
    setStatus({ kind: 'running', endTime: now + totalSeconds * 1000 });
    startTimeRef.current = now;
    pausedTimeRef.current = totalSeconds;
    // Only update the original time on the very first start, not on resume with edits
    if (updateOriginal) {
      originalTimeRef.current = totalSeconds;
    }
  }, []);

  const pauseTimer = useCallback(() => {
    clearScheduledTick();
    setStatus({ kind: 'paused' });
    // Store the current time when pausing
    pausedTimeRef.current = time;
    startTimeRef.current = null;
  }, [clearScheduledTick, time]);

  const resumeTimer = useCallback(() => {
    if (time > 0) {
      const now = Date.now();

      setStatus({ kind: 'running', endTime: now + time * 1000 });
      // Reset the start time when resuming
      startTimeRef.current = now;
      pausedTimeRef.current = time;
    }
  }, [time]);

  const restartTimer = useCallback(() => {
    // Restart always goes back to the original time, not edited time
    const timeToRestore = originalTimeRef.current;
    setTime(timeToRestore);
    setInitialTime(timeToRestore);
    setStatus({ kind: 'idle' });
    startTimeRef.current = null;
    pausedTimeRef.current = timeToRestore;
  }, []);

  const resetTimer = useCallback((newInitialTime: number) => {
    clearScheduledTick();
    setInitialTime(newInitialTime);
    setTime(newInitialTime);
    setStatus({ kind: 'idle' });
    startTimeRef.current = null;
    pausedTimeRef.current = newInitialTime;
    originalTimeRef.current = newInitialTime;
  }, [clearScheduledTick]);

  const adjustTime = useCallback((deltaSeconds: number) => {
    const safeDelta = Math.max(0, Math.floor(deltaSeconds));

    if (safeDelta === 0 || status.kind === 'finished') {
      return;
    }

    if (status.kind === 'running' && startTimeRef.current !== null) {
      const nextTime = getRunningRemainingTime() + safeDelta;

      pausedTimeRef.current += safeDelta;
      originalTimeRef.current += safeDelta;

      setStatus({ kind: 'running', endTime: Date.now() + nextTime * 1000 });
      setTime(nextTime);
      setInitialTime(prev => prev + safeDelta);
      onTickRef.current?.(nextTime);
      return;
    }

    const nextTime = time + safeDelta;

    pausedTimeRef.current = nextTime;
    originalTimeRef.current += safeDelta;

    setTime(nextTime);
    setInitialTime(prev => prev + safeDelta);
    onTickRef.current?.(nextTime);
  }, [getRunningRemainingTime, status, time]);

  // Calculate progress percentage
  const progress = initialTime > 0 ? time / initialTime : 0;

  // Get persistable state snapshot. The wire format stays the historical
  // boolean triple so tabs running either version of this code can read each
  // other's saved state.
  const getPersistedState = useCallback((): TimerPersistedState => ({
    endTime: status.kind === 'running' ? status.endTime : null,
    initialTime,
    originalTime: originalTimeRef.current,
    isRunning: status.kind === 'running',
    isPaused: status.kind === 'paused',
    pausedTimeRemaining: pausedTimeRef.current,
    timerFinished: status.kind === 'finished',
  }), [initialTime, status]);

  return {
    time,
    initialTime,
    originalTime: originalTimeRef.current,
    status,
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
