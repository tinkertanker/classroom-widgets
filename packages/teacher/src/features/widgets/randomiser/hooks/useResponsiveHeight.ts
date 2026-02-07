import { useState, useCallback, useRef } from 'react';

/**
 * Hook to manage responsive height calculations with ResizeObserver
 */
export function useResponsiveHeight() {
  const [textHeight, setTextHeight] = useState(0);
  const [boxHeight, setBoxHeight] = useState(0);
  
  // Store ResizeObserver instances to clean up on node change
  const textObserverRef = useRef<ResizeObserver | null>(null);
  const boxObserverRef = useRef<ResizeObserver | null>(null);

  const textRef = useCallback((node: HTMLElement | null) => {
    // Clean up previous observer
    if (textObserverRef.current) {
      textObserverRef.current.disconnect();
      textObserverRef.current = null;
    }
    
    if (node !== null) {
      const updateHeight = () => {
        setTextHeight(node.getBoundingClientRect().height);
      };
      
      updateHeight();
      
      const resizeObserver = new ResizeObserver(updateHeight);
      resizeObserver.observe(node);
      textObserverRef.current = resizeObserver;
    }
  }, []);

  const boxRef = useCallback((node: HTMLElement | null) => {
    // Clean up previous observer
    if (boxObserverRef.current) {
      boxObserverRef.current.disconnect();
      boxObserverRef.current = null;
    }
    
    if (node !== null) {
      const updateHeight = () => {
        setBoxHeight(node.getBoundingClientRect().height);
      };
      
      updateHeight();
      
      const resizeObserver = new ResizeObserver(updateHeight);
      resizeObserver.observe(node);
      boxObserverRef.current = resizeObserver;
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