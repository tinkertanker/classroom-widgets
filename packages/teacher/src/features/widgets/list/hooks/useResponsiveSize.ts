import { useState, useEffect, RefObject } from 'react';

interface UseResponsiveSizeOptions {
  threshold?: number;
  containerRef: RefObject<HTMLElement>;
}

/**
 * Hook to detect and manage responsive size changes
 */
export function useResponsiveSize({
  threshold = 400,
  containerRef: ref
}: UseResponsiveSizeOptions) {
  const [isLarge, setIsLarge] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        // Consider "large" when width is greater than threshold
        setIsLarge(width > threshold);
      }
    });

    resizeObserver.observe(ref.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [threshold, ref]);

  return { isLarge };
}