// TrashZone - Drop zone for deleting widgets

import React, { useEffect, useState, useRef } from 'react';
import { clsx } from 'clsx';
import { FaTrash } from 'react-icons/fa6';
import { useDragAndDrop } from '../../hooks/useWorkspace';

const TrashZone: React.FC = () => {
  const { isDragging, isOverTrash, setDropTarget } = useDragAndDrop();
  const [isVisible, setIsVisible] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Show trash when dragging or hovering
  useEffect(() => {
    if (isDragging || isHovering) {
      setIsVisible(true);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    } else {
      // Hide after delay when not dragging or hovering
      hideTimeoutRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 1500);
    }
    
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [isDragging, isHovering]);
  
  const handleMouseEnter = () => {
    setIsHovering(true);
    if (isDragging) {
      setDropTarget('trash');
    }
  };
  
  const handleMouseLeave = () => {
    setIsHovering(false);
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
  
  const classes = clsx(
    'absolute bottom-8 left-1/2 transform -translate-x-1/2',
    'bg-warm-gray-800 dark:bg-warm-gray-900',
    'rounded-full p-4',
    'transition-all duration-300',
    'shadow-lg',
    {
      'opacity-0 pointer-events-none': !isVisible,
      'opacity-100': isVisible,
      'scale-110 bg-dusty-rose-500': isOverTrash,
      'hover:scale-105': !isOverTrash && isVisible
    }
  );
  
  const iconClasses = clsx(
    'text-2xl',
    {
      'text-white': isOverTrash,
      'text-warm-gray-300': !isOverTrash
    }
  );
  
  return (
    <div
      className={classes}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={(e) => e.stopPropagation()}
    >
      <FaTrash className={iconClasses} />
      {isOverTrash && (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-dusty-rose-500 text-white px-3 py-1 rounded text-sm whitespace-nowrap">
          Drop to delete
        </div>
      )}
    </div>
  );
};

export default TrashZone;