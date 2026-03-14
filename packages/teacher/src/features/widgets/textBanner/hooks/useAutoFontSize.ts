import { useState, useEffect, RefObject } from 'react';

interface UseAutoFontSizeOptions {
  text: string;
  containerRef: RefObject<HTMLDivElement>;
  textRef: RefObject<HTMLDivElement>;
  maxSize?: number;
  minSize?: number;
  padding?: number;
  /** When true, only constrain by width — let height grow freely. */
  widthOnly?: boolean;
}

/**
 * Hook that automatically calculates the optimal font size to fit text within a container
 */
export function useAutoFontSize({
  text,
  containerRef,
  textRef,
  maxSize = 200,
  minSize = 12,
  padding = 32,
  widthOnly = false
}: UseAutoFontSizeOptions) {
  const [fontSize, setFontSize] = useState(24);

  // Calculate optimal font size
  const calculateFontSize = () => {
    if (!containerRef.current || !textRef.current || !text) return;

    const container = containerRef.current;
    const textElement = textRef.current;

    // Get container dimensions with padding
    const containerWidth = container.clientWidth - padding;
    const containerHeight = container.clientHeight - padding;

    // Binary search for optimal size (more efficient than linear)
    let low = minSize;
    let high = maxSize;
    let bestSize = minSize;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      textElement.style.fontSize = `${mid}px`;

      const textWidth = textElement.scrollWidth;
      const textHeight = textElement.scrollHeight;

      const fitsWidth = textWidth <= containerWidth;
      const fitsHeight = widthOnly || textHeight <= containerHeight;

      if (fitsWidth && fitsHeight) {
        bestSize = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    setFontSize(bestSize);
  };

  // Recalculate on text or mode change
  useEffect(() => {
    calculateFontSize();
  }, [text, widthOnly]);

  // Recalculate on window resize
  useEffect(() => {
    const handleResize = () => calculateFontSize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [text, widthOnly]);

  // Recalculate when container size changes (from react-rnd resize)
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      calculateFontSize();
    });

    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, [text, widthOnly]);

  return fontSize;
}