// TrashZone - Drop zone for deleting widgets

import React, { useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { FaTrash } from 'react-icons/fa6';
import { useDragAndDrop } from '../../../shared/hooks/useWorkspace';

const TrashZone: React.FC = () => {
  const { isDragging, isOverTrash, setDropTarget } = useDragAndDrop();
  const trashRef = useRef<HTMLDivElement>(null);
  
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
  useEffect(() => {
    if (!isDragging || !trashRef.current) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!trashRef.current) return;
      
      const rect = trashRef.current.getBoundingClientRect();
      const isOver = e.clientX >= rect.left && 
                     e.clientX <= rect.right && 
                     e.clientY >= rect.top && 
                     e.clientY <= rect.bottom;
      
      if (isOver && !isOverTrash) {
        setDropTarget('trash');
      } else if (!isOver && isOverTrash) {
        setDropTarget(null);
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('dragover', handleMouseMove);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('dragover', handleMouseMove);
    };
  }, [isDragging, isOverTrash, setDropTarget]);
  
  const classes = clsx(
    'w-16 h-16 cursor-pointer transition-all duration-200',
    'p-3 rounded-lg flex items-center justify-center',
    'relative z-[1000]', // High z-index to ensure it's above dragged widgets
    {
      'bg-dusty-rose-500 transform scale-105': isOverTrash,
      'bg-soft-white/80 dark:bg-warm-gray-800/80': !isOverTrash
    }
  );
  
  const iconClasses = clsx(
    'w-10 h-10 transition-all duration-200',
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