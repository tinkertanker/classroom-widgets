import { useEffect, useRef, useCallback } from 'react';

interface UseAnimationFrameOptions {
  isActive?: boolean;
  fps?: number;
}

/**
 * Hook to manage requestAnimationFrame loops
 * Provides a consistent way to run animation loops with automatic cleanup
 * 
 * @param callback - Function to call on each animation frame
 * @param options - Configuration options
 * @param options.isActive - Whether the animation should be running (default: true)
 * @param options.fps - Target frames per second (default: 60, use null for max FPS)
 */
export function useAnimationFrame(
  callback: (deltaTime: number, timestamp: number) => void,
  { isActive = true, fps = 60 }: UseAnimationFrameOptions = {}
) {
  const requestRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);
  const callbackRef = useRef(callback);
  
  // Update callback ref to avoid stale closures
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const animate = useCallback((timestamp: number) => {
    if (previousTimeRef.current === null) {
      previousTimeRef.current = timestamp;
    }

    const deltaTime = timestamp - previousTimeRef.current;
    
    // If FPS is specified, only update at the target frame rate
    const targetFrameTime = fps ? 1000 / fps : 0;
    
    if (!fps || deltaTime >= targetFrameTime) {
      callbackRef.current(deltaTime, timestamp);
      previousTimeRef.current = timestamp;
    }

    requestRef.current = requestAnimationFrame(animate);
  }, [fps]);

  useEffect(() => {
    if (isActive) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
      previousTimeRef.current = null;
    }

    return () => {
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  }, [isActive, animate]);

  // Return control functions
  return {
    start: () => {
      if (requestRef.current === null) {
        requestRef.current = requestAnimationFrame(animate);
      }
    },
    stop: () => {
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
        previousTimeRef.current = null;
      }
    }
  };
}