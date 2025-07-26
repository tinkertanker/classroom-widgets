// TrashZone - Drop zone for deleting widgets

import React, { useEffect } from 'react';
import { clsx } from 'clsx';
import { FaTrash } from 'react-icons/fa6';
import { useDragAndDrop } from '../../../shared/hooks/useWorkspace';

const TrashZone: React.FC = () => {
  const { isDragging, isOverTrash, setDropTarget } = useDragAndDrop();
  
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
  
  const classes = clsx(
    'w-16 h-16 cursor-pointer transition-all duration-200',
    'p-3 rounded-lg flex items-center justify-center',
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
      id="trash"
      className={classes}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={(e) => e.stopPropagation()}
      title="Drag widgets here to delete"
    >
      <FaTrash className={iconClasses} />
    </div>
  );
};

export default TrashZone;