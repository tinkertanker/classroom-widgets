// TrashZone - Drop zone for deleting widgets

import React, { useEffect, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import { FaTrash } from 'react-icons/fa6';
import { useDragAndDrop } from '@shared/hooks/useWorkspace';

const TrashZone: React.FC = () => {
  const { isDragging, isOverTrash, setDropTarget } = useDragAndDrop();
  const trashRef = useRef<HTMLDivElement>(null);
  const cachedRectRef = useRef<DOMRect | null>(null);
  const isOverRef = useRef(false);
  const lastCheckRef = useRef(0);

  const handleMouseEnter = () => {
    if (isDragging) {
      setDropTarget('trash');
    }
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      setDropTarget(null);
    }
  };

  // Play trash sound when widget is dropped
  useEffect(() => {
    if (isOverTrash && !isDragging) {
      // Widget was just dropped on trash
      (window as any).playTrashSound?.();
    }
  }, [isOverTrash, isDragging]);

  // Track mouse position during drag to detect if over trash
  // Throttled to reduce re-renders and forced reflows
  useEffect(() => {
    if (!isDragging || !trashRef.current) {
      cachedRectRef.current = null;
      return;
    }

    // Cache the bounding rect at drag start (it won't change during drag)
    cachedRectRef.current = trashRef.current.getBoundingClientRect();
    isOverRef.current = isOverTrash;

    const handleMouseMove = (e: MouseEvent) => {
      // Throttle to max ~20 checks per second (every 50ms)
      const now = Date.now();
      if (now - lastCheckRef.current < 50) return;
      lastCheckRef.current = now;

      const rect = cachedRectRef.current;
      if (!rect) return;

      const isOver = e.clientX >= rect.left &&
                     e.clientX <= rect.right &&
                     e.clientY >= rect.top &&
                     e.clientY <= rect.bottom;

      // Only update state if changed (avoid unnecessary Zustand updates)
      if (isOver !== isOverRef.current) {
        isOverRef.current = isOver;
        setDropTarget(isOver ? 'trash' : null);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('dragover', handleMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('dragover', handleMouseMove);
    };
  }, [isDragging, setDropTarget]); // Removed isOverTrash from deps to prevent re-subscription
  
  const classes = clsx(
    'w-16 h-16 cursor-pointer transition-all duration-200',
    'max-[540px]:w-12 max-[540px]:h-12',
    'p-3 max-[540px]:p-2 rounded-lg flex items-center justify-center',
    'relative z-[1000]', // High z-index to ensure it's above dragged widgets
    {
      'bg-dusty-rose-500 transform scale-105': isOverTrash,
      'bg-soft-white/80 dark:bg-warm-gray-800/80': !isOverTrash
    }
  );
  
  const iconClasses = clsx(
    'w-10 h-10 max-[540px]:w-7 max-[540px]:h-7 transition-all duration-200',
    {
      'text-white': isOverTrash,
      'text-warm-gray-600 dark:text-warm-gray-300': !isOverTrash
    }
  );
  
  return (
    <div
      ref={trashRef}
      id="trash"
      className={classes}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onPointerEnter={handleMouseEnter}
      onPointerLeave={handleMouseLeave}
      onMouseMove={(e) => e.stopPropagation()}
      style={{ pointerEvents: 'all' }}
      title="Drag widgets here to delete"
    >
      <FaTrash className={iconClasses} />
    </div>
  );
};

export default TrashZone;
