import React, { useState, useEffect, useRef } from 'react';
import { useAutoFontSize } from './hooks';
import { cn, widgetContainer } from '../../../shared/utils/styles';
import { useWidgetState } from '../../../shared/hooks/useWidgetState';

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

const PLACEHOLDER_TEXT = 'Double-click to edit';

const normaliseText = (value: string) => (value.length > 0 ? value : PLACEHOLDER_TEXT);

const formatInlineText = (line: string) => {
  const tokens = line.split(/(\*_[^_]+_\*|\*[^*]+\*|_[^_]+_|~[^~]+~|`[^`]+`)/g);
  return tokens.map((token, index) => {
    if (token.startsWith('*_') && token.endsWith('_*')) {
      return (
        <strong key={`bold-italic-${index}`}><em>{token.slice(2, -2)}</em></strong>
      );
    }
    if (token.startsWith('*') && token.endsWith('*')) {
      return (
        <strong key={`bold-${index}`}>{token.slice(1, -1)}</strong>
      );
    }
    if (token.startsWith('_') && token.endsWith('_')) {
      return (
        <em key={`italic-${index}`}>{token.slice(1, -1)}</em>
      );
    }
    if (token.startsWith('~') && token.endsWith('~')) {
      return (
        <span key={`strike-${index}`} className="line-through">{token.slice(1, -1)}</span>
      );
    }
    if (token.startsWith('`') && token.endsWith('`')) {
      return (
        <span key={`mono-${index}`} className="font-mono">{token.slice(1, -1)}</span>
      );
    }
    return <span key={`text-${index}`}>{token}</span>;
  });
};

const renderFormattedText = (value: string) => {
  const lines = value.split('\n');
  return lines.map((line, index) => (
    <React.Fragment key={`line-${index}`}>
      {(() => {
        const headingMatch = line.match(/^\s*#{1,3}\s+(.*)$/);
        const content = headingMatch ? headingMatch[1] : line;
        const isHeading = Boolean(headingMatch);
        const headingClass = isHeading ? 'font-semibold' : undefined;
        return (
          <span className={headingClass}>
            {formatInlineText(content)}
          </span>
        );
      })()}
      {index < lines.length - 1 ? <br /> : null}
    </React.Fragment>
  ));
};

const TextBanner: React.FC<TextBannerProps> = ({ savedState, onStateChange }) => {
  const normalisedSavedState = savedState
    ? {
        text: normaliseText(savedState.text),
        colorIndex: savedState.colorIndex ?? 0
      }
    : undefined;

  const { state, updateState } = useWidgetState({
    initialState: { text: PLACEHOLDER_TEXT, colorIndex: 0 },
    savedState: normalisedSavedState,
    onStateChange
  });

  const { text, colorIndex } = state;
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(text);
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const clickTimerRef = useRef<number | null>(null);

  // Use auto font size hook
  const fontSize = useAutoFontSize({
    text,
    containerRef,
    textRef,
    maxSize: 180,
    minSize: 12,
    padding: 32
  });

  // Select all text when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.select();
    }
  }, [isEditing]);

  // Prevent delayed colour changes from firing after unmount.
  useEffect(() => {
    return () => {
      if (clickTimerRef.current !== null) {
        window.clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
    };
  }, []);

  const commitText = (nextText: string) => {
    updateState({ text: normaliseText(nextText) });
  };

  const handleBlur = () => {
    commitText(editText);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      commitText(editText);
      setIsEditing(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isEditing || e.detail !== 1) return;
    if (clickTimerRef.current) {
      window.clearTimeout(clickTimerRef.current);
    }
    clickTimerRef.current = window.setTimeout(() => {
      const nextIndex = (colorIndex + 1) % colorCombinations.length;
      updateState({ colorIndex: nextIndex });
      clickTimerRef.current = null;
    }, 500);
  };

  const handleDoubleClick = () => {
    if (clickTimerRef.current) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    setIsEditing(true);
    setEditText(text);
  };

  const currentColors = colorCombinations[colorIndex];

  return (
    <div
      ref={containerRef}
      className={cn(widgetContainer, currentColors.bg, "items-center justify-center p-4 relative overflow-hidden transition-colors duration-300 cursor-pointer")}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
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
          className={cn(currentColors.text, "text-center leading-tight select-none clickable")}
          style={{ fontSize: `${fontSize}px` }}
          title="Double-click to edit"
        >
          {renderFormattedText(text)}
        </div>
      )}
    </div>
  );
};

export default TextBanner;
