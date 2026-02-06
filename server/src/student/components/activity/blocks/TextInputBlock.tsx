import React from 'react';
import type { TextInputBlock as TextInputBlockType } from '../../../../../../src/shared/types/activity.types';
import { useActivityTarget, useActivity } from '../context/ActivityContext';

interface TextInputBlockProps {
  block: TextInputBlockType;
}

export function TextInputBlock({ block }: TextInputBlockProps) {
  const { targetId, placeholder = 'Type your answer...', maxLength } = block.props;
  const { textValue, feedback, correctAnswer } = useActivityTarget(targetId);
  const { isActive, results, setTextInput } = useActivity();

  const isDisabled = !isActive || !!results;

  const getFeedbackStyles = () => {
    if (!feedback) return '';
    if (feedback === 'correct') {
      return 'border-green-500 bg-green-50 dark:bg-green-900/20 focus:border-green-500 focus:ring-green-500';
    }
    if (feedback === 'incorrect') {
      return 'border-red-500 bg-red-50 dark:bg-red-900/20 focus:border-red-500 focus:ring-red-500';
    }
    return '';
  };

  return (
    <div className="w-full">
      <input
        type="text"
        value={textValue}
        onChange={(e) => setTextInput(targetId, e.target.value)}
        disabled={isDisabled}
        maxLength={maxLength}
        placeholder={placeholder}
        className={`
          w-full px-3 py-2 rounded-lg
          border-2 border-warm-gray-300 dark:border-warm-gray-600
          bg-white dark:bg-warm-gray-800
          text-warm-gray-800 dark:text-warm-gray-200
          placeholder-warm-gray-400 dark:placeholder-warm-gray-500
          transition-all duration-150
          focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-sage-500
          ${isDisabled ? 'opacity-60 cursor-not-allowed' : ''}
          ${getFeedbackStyles()}
        `}
      />
      {feedback === 'incorrect' && correctAnswer && (
        <div className="mt-1 text-sm text-green-600 dark:text-green-400">
          Correct answer: {correctAnswer}
        </div>
      )}
    </div>
  );
}

export default TextInputBlock;
