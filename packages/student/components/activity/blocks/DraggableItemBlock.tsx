import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { DraggableItemBlock as DraggableItemBlockType } from '@shared/types/activity.types';
import { useActivityItem, useActivity } from '../context/ActivityContext';

interface DraggableItemBlockProps {
  block: DraggableItemBlockType;
}

export function DraggableItemBlock({ block }: DraggableItemBlockProps) {
  const { itemId, content, imageUrl, disabled: blockDisabled } = block.props;
  const { placed } = useActivityItem(itemId);
  const { isActive, results } = useActivity();

  const isDisabled = blockDisabled || !isActive || !!results;

  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging
  } = useDraggable({
    id: itemId,
    disabled: isDisabled || placed
  });

  // Don't apply transform here - DragOverlay handles the dragging visual
  // Just make the original element semi-transparent when dragging
  const style = isDragging
    ? { opacity: 0.4 }
    : undefined;

  // Don't render if item is placed in a target
  if (placed) {
    return null;
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        inline-flex items-center gap-2 px-3 py-2 rounded-lg
        bg-sage-100 dark:bg-sage-900/40
        border-2 border-sage-300 dark:border-sage-700
        text-sage-800 dark:text-sage-200
        font-medium text-sm
        select-none
        transition-all duration-150
        ${isDragging
          ? 'shadow-lg scale-105 opacity-90 cursor-grabbing'
          : isDisabled
            ? 'opacity-50 cursor-not-allowed'
            : 'cursor-grab hover:shadow-md hover:border-sage-400 dark:hover:border-sage-600'
        }
      `}
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          className="w-6 h-6 object-cover rounded"
        />
      )}
      <span>{content}</span>
    </div>
  );
}

export default DraggableItemBlock;
