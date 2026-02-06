import React, { useRef, useEffect } from 'react';
import type { CodeEditorBlock as CodeEditorBlockType } from '../../../../../../src/shared/types/activity.types';
import { useActivityTarget, useActivity } from '../context/ActivityContext';

interface CodeEditorBlockProps {
  block: CodeEditorBlockType;
}

/**
 * CodeEditorBlock - A code input block with basic syntax highlighting
 * Used for code fill-in-the-blank activities
 */
export function CodeEditorBlock({ block }: CodeEditorBlockProps) {
  const {
    targetId,
    language = 'text',
    placeholder = 'Type your code...',
    prefillCode,
    maxLines = 10,
    showLineNumbers = true
  } = block.props;

  const { textValue, feedback, correctAnswer } = useActivityTarget(targetId);
  const { isActive, results, setTextInput, activity } = useActivity();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isDisabled = !isActive || !!results;

  // Get the correct answer content for display
  const correctItem = correctAnswer ? activity?.items.find(i => i.id === correctAnswer) : null;
  const correctContent = correctItem?.content || correctAnswer;

  // Adjust textarea height based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const lineHeight = 24; // Approximate line height in pixels
      const minHeight = lineHeight * 2;
      const maxHeight = lineHeight * maxLines;
      const contentHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(Math.max(contentHeight, minHeight), maxHeight)}px`;
    }
  }, [textValue, maxLines]);

  const getFeedbackStyles = () => {
    if (!feedback) return '';
    if (feedback === 'correct') {
      return 'border-green-500 bg-green-900/20';
    }
    if (feedback === 'incorrect') {
      return 'border-red-500 bg-red-900/20';
    }
    return '';
  };

  // Language-specific styling classes
  const getLanguageClass = () => {
    switch (language) {
      case 'python':
        return 'text-blue-300';
      case 'javascript':
        return 'text-yellow-300';
      default:
        return 'text-warm-gray-200';
    }
  };

  return (
    <div className="w-full">
      {/* Prefill code (read-only context) */}
      {prefillCode && (
        <pre className={`
          font-mono text-sm p-3 rounded-t-lg
          bg-warm-gray-900 dark:bg-warm-gray-950
          text-warm-gray-400 dark:text-warm-gray-500
          border border-b-0 border-warm-gray-700 dark:border-warm-gray-800
          overflow-x-auto whitespace-pre-wrap
        `}>
          {prefillCode}
        </pre>
      )}

      {/* Code input area */}
      <div className={`
        relative font-mono text-sm
        bg-warm-gray-900 dark:bg-warm-gray-950
        ${prefillCode ? 'rounded-b-lg border-t-0' : 'rounded-lg'}
        border-2 border-warm-gray-700 dark:border-warm-gray-800
        transition-all duration-150
        ${isDisabled ? 'opacity-60' : ''}
        ${getFeedbackStyles()}
      `}>
        {showLineNumbers && (
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-warm-gray-800 dark:bg-warm-gray-900 rounded-l-lg border-r border-warm-gray-700 dark:border-warm-gray-800 flex flex-col items-center pt-3 text-warm-gray-500 text-xs select-none">
            {(textValue || placeholder).split('\n').slice(0, maxLines).map((_, i) => (
              <div key={i} className="h-6 leading-6">{i + 1}</div>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={textValue}
          onChange={(e) => setTextInput(targetId, e.target.value)}
          disabled={isDisabled}
          placeholder={placeholder}
          spellCheck={false}
          className={`
            w-full p-3 bg-transparent
            ${showLineNumbers ? 'pl-10' : ''}
            ${getLanguageClass()}
            placeholder-warm-gray-600 dark:placeholder-warm-gray-500
            focus:outline-none focus:ring-0
            resize-none overflow-hidden
            ${isDisabled ? 'cursor-not-allowed' : ''}
          `}
          style={{
            minHeight: '48px',
            lineHeight: '24px'
          }}
        />
      </div>

      {/* Feedback message */}
      {feedback === 'incorrect' && correctContent && (
        <div className="mt-2 p-2 rounded bg-green-900/30 border border-green-700">
          <p className="text-xs text-green-400 mb-1">Correct answer:</p>
          <code className="text-sm text-green-300 font-mono">{correctContent}</code>
        </div>
      )}

      {feedback === 'correct' && (
        <div className="mt-2 text-sm text-green-400">
          Correct!
        </div>
      )}
    </div>
  );
}

export default CodeEditorBlock;
