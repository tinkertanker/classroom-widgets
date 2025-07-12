import React, { useState, useEffect, useRef } from 'react';
import { useEditMode } from '../../hooks/useEditMode';
import { useResizeObserver } from '../../hooks/useResizeObserver';

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

const TextBannerRefactored: React.FC<TextBannerProps> = ({ savedState, onStateChange }) => {
  const [text, setText] = useState(savedState?.text || 'Double-click to edit');
  const [colorIndex, setColorIndex] = useState(savedState?.colorIndex ?? 0);
  const [fontSize, setFontSize] = useState(24);
  
  const textRef = useRef<HTMLDivElement>(null);
  
  // Use shared edit mode hook
  const {
    isEditing,
    value: editText,
    inputRef,
    startEdit,
    handleChange,
    handleKeyDown,
    handleBlur
  } = useEditMode({
    initialValue: text,
    onSave: (newText) => {
      setText(newText);
      onStateChange?.({ text: newText, colorIndex });
    }
  });

  // Use shared resize observer hook
  const [containerRef, containerSize] = useResizeObserver<HTMLDivElement>(() => {
    // Recalculate font size when container resizes
    calculateFontSize();
  });

  // Calculate optimal font size to fill container
  const calculateFontSize = () => {
    if (!containerRef.current || !textRef.current || !text) return;

    const container = containerRef.current;
    const textElement = textRef.current;
    
    // Get container dimensions with padding
    const containerWidth = container.clientWidth - 32; // 16px padding on each side
    const containerHeight = container.clientHeight - 32;
    
    // Binary search for optimal font size
    let low = 12;
    let high = 200;
    let optimalSize = 12;
    
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      textElement.style.fontSize = `${mid}px`;
      
      const textWidth = textElement.scrollWidth;
      const textHeight = textElement.scrollHeight;
      
      if (textWidth <= containerWidth && textHeight <= containerHeight) {
        optimalSize = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    
    setFontSize(optimalSize);
  };

  // Recalculate font size when text changes
  useEffect(() => {
    calculateFontSize();
  }, [text, containerSize]);

  // Notify parent of state changes
  useEffect(() => {
    onStateChange?.({ text, colorIndex });
  }, [text, colorIndex, onStateChange]);

  const cycleColor = () => {
    setColorIndex((prev) => (prev + 1) % colorCombinations.length);
  };

  const currentColors = colorCombinations[colorIndex];

  return (
    <div 
      ref={containerRef}
      className={`${currentColors.bg} rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 w-full h-full flex items-center justify-center cursor-pointer relative overflow-hidden transition-colors duration-300`}
      onDoubleClick={startEdit}
      onClick={cycleColor}
    >
      {isEditing ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={editText}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className={`absolute inset-0 w-full h-full p-4 bg-transparent ${currentColors.text} text-center resize-none outline-none`}
          style={{ fontSize: `${fontSize}px` }}
        />
      ) : (
        <div 
          ref={textRef}
          className={`${currentColors.text} text-center px-4 py-4 select-none`}
          style={{ 
            fontSize: `${fontSize}px`,
            lineHeight: 1.2,
            wordBreak: 'break-word'
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
};

export default TextBannerRefactored;