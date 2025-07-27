import { useState, useCallback } from 'react';
import { useAnimationFrame } from './useAnimationFrame';

interface UseAnimationOptions {
  duration?: number;
  loop?: boolean;
  fps?: number;
  easing?: (t: number) => number;
  onComplete?: () => void;
}

/**
 * Hook for managing time-based animations
 * Provides normalized progress value (0-1) over a specified duration
 */
export function useAnimation({
  duration = 1000,
  loop = false,
  fps = 60,
  easing = (t) => t, // Linear by default
  onComplete
}: UseAnimationOptions = {}) {
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);

  const animate = useCallback((deltaTime: number, timestamp: number) => {
    if (startTime === null) {
      setStartTime(timestamp);
      return;
    }

    const elapsed = timestamp - startTime;
    const rawProgress = Math.min(elapsed / duration, 1);
    const easedProgress = easing(rawProgress);
    
    setProgress(easedProgress);

    if (rawProgress >= 1) {
      if (loop) {
        setStartTime(timestamp);
        setProgress(0);
      } else {
        setIsPlaying(false);
        onComplete?.();
      }
    }
  }, [startTime, duration, loop, easing, onComplete]);

  useAnimationFrame(animate, { isActive: isPlaying, fps });

  const start = useCallback(() => {
    setIsPlaying(true);
    setStartTime(null);
    setProgress(0);
  }, []);

  const stop = useCallback(() => {
    setIsPlaying(false);
    setProgress(0);
    setStartTime(null);
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const resume = useCallback(() => {
    setIsPlaying(true);
  }, []);

  return {
    progress,
    isPlaying,
    start,
    stop,
    pause,
    resume
  };
}

// Common easing functions
export const easings = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => (--t) * t * t + 1,
  easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeInElastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    return -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI);
  },
  easeOutElastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
  }
};