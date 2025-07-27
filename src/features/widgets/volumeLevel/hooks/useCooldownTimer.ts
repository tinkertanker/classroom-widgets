import { useState, useCallback, useRef } from 'react';

interface UseCooldownTimerOptions {
  duration?: number;
  onCooldownStart?: () => void;
  onCooldownEnd?: () => void;
}

/**
 * Hook to manage cooldown timer functionality
 * Used to prevent alert spam by enforcing a cooldown period
 */
export function useCooldownTimer({
  duration = 5,
  onCooldownStart,
  onCooldownEnd
}: UseCooldownTimerOptions = {}) {
  const [cooldownTime, setCooldownTime] = useState(0);
  const [isInCooldown, setIsInCooldown] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startCooldown = useCallback(() => {
    if (isInCooldown) return;

    setIsInCooldown(true);
    setCooldownTime(duration);
    onCooldownStart?.();

    intervalRef.current = setInterval(() => {
      setCooldownTime(prevTime => {
        if (prevTime <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setIsInCooldown(false);
          onCooldownEnd?.();
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
  }, [duration, isInCooldown, onCooldownStart, onCooldownEnd]);

  const cancelCooldown = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsInCooldown(false);
    setCooldownTime(0);
  }, []);

  return {
    cooldownTime,
    isInCooldown,
    startCooldown,
    cancelCooldown
  };
}