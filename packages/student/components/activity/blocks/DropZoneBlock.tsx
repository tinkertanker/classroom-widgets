import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { DropZoneBlock as DropZoneBlockType } from '@shared/types/activity.types';
import { useActivityTarget, useActivity } from '../context/ActivityContext';

interface DropZoneBlockProps {
  block: DropZoneBlockType;
}

export function DropZoneBlock({ block }: DropZoneBlockProps) {
  const { targetId, label, placeholder = 'Drop here', accepts = 'single', showFeedback = true, inline = false } = block.props;
  const { filled, item, feedback, correctAnswer } = useActivityTarget(targetId);
  const { isActive, results, activity, removeItem } = useActivity();

  const { setNodeRef, isOver, active } = useDroppable({
    id: targetId,
    disabled: !isActive || !!results
  });

  // Find the correct item to show when revealed
  const correctItem = correctAnswer ? activity?.items.find(i => i.id === correctAnswer) : null;

  const getFeedbackStyles = () => {
    if (!showFeedback || !feedback) return '';
    if (feedback === 'correct') {
      return 'border-green-500 bg-green-50 dark:bg-green-900/20';
    }
    if (feedback === 'incorrect') {
      return 'border-red-500 bg-red-50 dark:bg-red-900/20';
    }
    return '';
  };

  const handleRemoveItem = () => {
    if (item && isActive && !results) {
      removeItem(item.id);
    }
  };

  // Inline mode for fill-in-the-blank
  if (inline) {
    return (
      <span
        ref={setNodeRef}
        className={`
          inline-flex items-center justify-center
          min-w-[80px] px-1 py-0.5 mx-1
          rounded
          transition-all duration-150
          ${filled
            ? 'bg-transparent'
            : isOver
              ? 'bg-sage-300 dark:bg-sage-600 scale-105'
              : 'bg-warm-gray-300 dark:bg-warm-gray-600'
          }
          ${getFeedbackStyles()}
        `}
      >
        {filled && item ? (
          <button
            onClick={handleRemoveItem}
            disabled={!isActive || !!results}
            className={`
              px-2 py-0.5 rounded
              bg-sage-200 dark:bg-sage-800
              text-sage-800 dark:text-sage-200
              text-sm font-medium
              ${isActive && !results ? 'hover:bg-sage-300 dark:hover:bg-sage-700 cursor-pointer' : ''}
              ${feedback === 'correct' ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200' : ''}
              ${feedback === 'incorrect' ? 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200' : ''}
            `}
          >
            {item.content}
          </button>
        ) : correctAnswer && correctItem ? (
          <span className="text-green-600 dark:text-green-400 text-sm font-medium">
            {correctItem.content}
          </span>
        ) : (
          <span className="inline-block w-16 h-5" />
        )}
      </span>
    );
  }

  // Block mode for sorting/matching
  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col items-center justify-center
        min-h-[60px] p-3 rounded-lg
        border-2 border-dashed
        transition-all duration-150
        ${filled
          ? 'border-sage-500 dark:border-sage-400 bg-sage-50 dark:bg-sage-900/20'
          : isOver
            ? 'border-sage-400 dark:border-sage-500 bg-sage-100 dark:bg-sage-900/30 scale-[1.02]'
            : 'border-warm-gray-300 dark:border-warm-gray-600 bg-warm-gray-50 dark:bg-warm-gray-800/50'
        }
        ${getFeedbackStyles()}
      `}
    >
      {label && !filled && (
        <span className="text-xs text-warm-gray-500 dark:text-warm-gray-400 mb-1">
          {label}
        </span>
      )}

      {filled && item ? (
        <button
          onClick={handleRemoveItem}
          disabled={!isActive || !!results}
          className={`
            px-3 py-2 rounded-lg
            bg-sage-200 dark:bg-sage-800
            text-sage-800 dark:text-sage-200
            font-medium text-sm
            ${isActive && !results ? 'hover:bg-sage-300 dark:hover:bg-sage-700 cursor-pointer' : ''}
            ${feedback === 'correct' ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200' : ''}
            ${feedback === 'incorrect' ? 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200' : ''}
          `}
        >
          {item.content}
        </button>
      ) : correctAnswer && correctItem ? (
        <span className="text-green-600 dark:text-green-400 font-medium">
          {correctItem.content}
        </span>
      ) : (
        <span className="text-warm-gray-400 dark:text-warm-gray-500 text-sm">
          {isOver ? 'Release to drop' : placeholder}
        </span>
      )}
    </div>
  );
}

export default DropZoneBlock;
