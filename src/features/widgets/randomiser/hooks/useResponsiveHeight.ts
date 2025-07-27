import { useState, useCallback } from 'react';

/**
 * Hook to manage responsive height calculations with ResizeObserver
 */
export function useResponsiveHeight() {
  const [textHeight, setTextHeight] = useState(0);
  const [boxHeight, setBoxHeight] = useState(0);

  const textRef = useCallback((node: HTMLElement | null) => {
    if (node !== null) {
      const updateHeight = () => {
        setTextHeight(node.getBoundingClientRect().height);
      };
      
      updateHeight();
      
      const resizeObserver = new ResizeObserver(updateHeight);
      resizeObserver.observe(node);
      
      return () => resizeObserver.disconnect();
    }
  }, []);

  const boxRef = useCallback((node: HTMLElement | null) => {
    if (node !== null) {
      const updateHeight = () => {
        setBoxHeight(node.getBoundingClientRect().height);
      };
      
      updateHeight();
      
      const resizeObserver = new ResizeObserver(updateHeight);
      resizeObserver.observe(node);
      
      return () => resizeObserver.disconnect();
    }
  }, []);

  return {
    textHeight,
    boxHeight,
    textRef,
    boxRef,
    shouldAlignTop: textHeight > boxHeight
  };
}