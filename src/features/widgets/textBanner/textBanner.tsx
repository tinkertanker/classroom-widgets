import React, { useState, useEffect, useRef } from 'react';
import { useAutoFontSize } from './hooks';

interface TextBannerProps {
  savedState?: { text: string; colorIndex?: number };
  onStateChange?: (state: { text: string; colorIndex: number }) => void;
}

// Define color combinations with high contrast
const colorCombinations = [
  { bg: 'bg-terracotta-500 dark:bg-terracotta-600', text: 'text-soft-white dark:text-white' },
  { bg: 'bg-sage-600 dark:bg-sage-700', text: 'text-soft-white dark:text-white' },
  { bg: 'bg-warm-gray-800 dark:bg-warm-gray-900', text: 'text-soft-white dark:text-warm-gray-100' },
  { bg: 'bg-dusty-rose-600 dark:bg-dusty-rose-700', text: 'text-soft-white dark:text-white' },
  { bg: 'bg-soft-white dark:bg-warm-gray-200', text: 'text-warm-gray-900 dark:text-warm-gray-900' },
  { bg: 'bg-blue-600 dark:bg-blue-700', text: 'text-soft-white dark:text-white' }
];

const TextBanner: React.FC<TextBannerProps> = ({ savedState, onStateChange }) => {
  const [text, setText] = useState(savedState?.text || 'Double-click to edit');
  const [colorIndex, setColorIndex] = useState(savedState?.colorIndex ?? 0);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(text);
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Use auto font size hook
  const fontSize = useAutoFontSize({
    text,
    containerRef,
    textRef,
    maxSize: 200,
    minSize: 12,
    padding: 32
  });

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditText(text);
  };

  // Select all text when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.select();
    }
  }, [isEditing]);

  // Update state and notify parent
  const updateState = (newText?: string, newColorIndex?: number) => {
    const finalText = newText !== undefined ? (newText || 'Double-click to edit') : text;
    const finalColorIndex = newColorIndex !== undefined ? newColorIndex : colorIndex;
    
    if (newText !== undefined) setText(finalText);
    if (newColorIndex !== undefined) setColorIndex(finalColorIndex);
    
    if (onStateChange) {
      onStateChange({ text: finalText, colorIndex: finalColorIndex });
    }
  };

  const handleBlur = () => {
    updateState(editText);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      updateState(editText);
      setIsEditing(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // Only cycle colors on single click when not editing
    if (!isEditing && e.detail === 1) {
      const nextIndex = (colorIndex + 1) % colorCombinations.length;
      updateState(undefined, nextIndex);
    }
  };

  const currentColors = colorCombinations[colorIndex];

  return (
    <div 
      ref={containerRef}
      className={`w-full h-full ${currentColors.bg} rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-300 cursor-pointer`}
      onDoubleClick={handleDoubleClick}
      onClick={handleClick}
    >
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="w-full h-full p-4 text-xl bg-soft-white dark:bg-warm-gray-700 text-warm-gray-800 dark:text-warm-gray-200 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-terracotta-600 dark:focus:ring-terracotta-500"
          placeholder="Enter your message..."
          autoFocus
        />
      ) : (
        <div
          ref={textRef}
          className={`${currentColors.text} font-bold text-center leading-tight select-none`}
          style={{ fontSize: `${fontSize}px` }}
          title="Double-click to edit, click to change color"
        >
          {text}
        </div>
      )}
    </div>
  );
};

export default TextBanner;