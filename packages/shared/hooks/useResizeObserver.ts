import { useEffect, useRef, useState, useCallback } from 'react';

interface Size {
  width: number;
  height: number;
}

/**
 * Hook to observe element resize and provide dimensions
 * @param onResize Optional callback when size changes
 * @returns [ref, size] - Ref to attach to element and current size
 */
export const useResizeObserver = <T extends HTMLElement>(
  onResize?: (size: Size) => void
): [React.RefObject<T>, Size] => {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  const handleResize = useCallback((entries: ResizeObserverEntry[]) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      const newSize = { width, height };
      setSize(newSize);
      onResize?.(newSize);
    }
  }, [onResize]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(element);

    // Get initial size
    const rect = element.getBoundingClientRect();
    const initialSize = { width: rect.width, height: rect.height };
    setSize(initialSize);
    onResize?.(initialSize);

    return () => {
      resizeObserver.disconnect();
    };
  }, [handleResize, onResize]);

  return [ref, size];
};