import React, { ReactNode, useRef, useEffect } from 'react';

// Wrapper component that blocks clicks after dragging
interface DragAwareWrapperProps {
  children: ReactNode;
  isDragging: boolean;
  hasDragged: boolean;
}

export const DragAwareWrapper: React.FC<DragAwareWrapperProps> = ({ 
  children, 
  isDragging, 
  hasDragged 
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!wrapperRef.current || !hasDragged) return;
    
    // Block all clicks for a short time after drag
    const blockClicks = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      // Stop the event from reaching any child elements
      e.stopImmediatePropagation();
    };
    
    // Capture phase to intercept before any child handlers
    wrapperRef.current.addEventListener('click', blockClicks, true);
    
    // Clean up after the block period
    const timer = setTimeout(() => {
      wrapperRef.current?.removeEventListener('click', blockClicks, true);
    }, 100);
    
    return () => {
      clearTimeout(timer);
      wrapperRef.current?.removeEventListener('click', blockClicks, true);
    };
  }, [hasDragged]);
  
  return (
    <div ref={wrapperRef} className="w-full h-full">
      {children}
    </div>
  );
};