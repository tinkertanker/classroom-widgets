import { useCallback, useEffect, useRef, useState } from 'react';

export function useTemporaryState<T>(initialValue: T, defaultDurationMs: number) {
  const [value, setValue] = useState<T>(initialValue);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimeoutRef = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const setTemporaryValue = useCallback((nextValue: T, durationMs?: number) => {
    setValue(nextValue);
    clearTimeoutRef();
    timeoutRef.current = setTimeout(() => {
      setValue(initialValue);
      timeoutRef.current = null;
    }, durationMs ?? defaultDurationMs);
  }, [clearTimeoutRef, defaultDurationMs, initialValue]);

  const clear = useCallback(() => {
    clearTimeoutRef();
    setValue(initialValue);
  }, [clearTimeoutRef, initialValue]);

  useEffect(() => {
    return () => {
      clearTimeoutRef();
    };
  }, [clearTimeoutRef]);

  return {
    value,
    setValue,
    setTemporaryValue,
    clear
  };
}
