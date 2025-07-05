import React, { useState, useEffect, useRef } from 'react';

interface TextBannerProps {
  savedState?: { text: string };
  onStateChange?: (state: { text: string }) => void;
}

const TextBanner: React.FC<TextBannerProps> = ({ savedState, onStateChange }) => {
  const [text, setText] = useState(savedState?.text || 'Double-click to edit');
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(text);
  const [fontSize, setFontSize] = useState(24);
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  // Calculate optimal font size to fill container
  useEffect(() => {
    const calculateFontSize = () => {
      if (!containerRef.current || !textRef.current || !text) return;

      const container = containerRef.current;
      const textElement = textRef.current;
      
      // Get container dimensions with padding
      const containerWidth = container.clientWidth - 32; // 16px padding on each side
      const containerHeight = container.clientHeight - 32;
      
      // Start with a large font size and decrease until text fits
      let size = 200; // Start with max size
      let minSize = 12;
      
      while (size > minSize) {
        textElement.style.fontSize = `${size}px`;
        
        const textWidth = textElement.scrollWidth;
        const textHeight = textElement.scrollHeight;
        
        if (textWidth <= containerWidth && textHeight <= containerHeight) {
          break;
        }
        
        size -= 2;
      }
      
      setFontSize(size);
    };

    calculateFontSize();
    
    // Recalculate on window resize
    window.addEventListener('resize', calculateFontSize);
    return () => window.removeEventListener('resize', calculateFontSize);
  }, [text]);

  // Also recalculate when container size changes (from react-rnd resize)
  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver(() => {
      const calculateFontSize = () => {
        if (!containerRef.current || !textRef.current || !text) return;

        const container = containerRef.current;
        const textElement = textRef.current;
        
        const containerWidth = container.clientWidth - 32;
        const containerHeight = container.clientHeight - 32;
        
        let size = 200;
        let minSize = 12;
        
        while (size > minSize) {
          textElement.style.fontSize = `${size}px`;
          
          const textWidth = textElement.scrollWidth;
          const textHeight = textElement.scrollHeight;
          
          if (textWidth <= containerWidth && textHeight <= containerHeight) {
            break;
          }
          
          size -= 2;
        }
        
        setFontSize(size);
      };
      
      calculateFontSize();
    });
    
    resizeObserver.observe(containerRef.current);
    
    return () => resizeObserver.disconnect();
  }, [text]);

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditText(text);
  };

  // Update text and notify parent
  const updateText = (newText: string) => {
    const finalText = newText || 'Double-click to edit';
    setText(finalText);
    if (onStateChange) {
      onStateChange({ text: finalText });
    }
  };

  const handleBlur = () => {
    updateText(editText);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      updateText(editText);
      setIsEditing(false);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="w-full h-full bg-terracotta-500 dark:bg-terracotta-600 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 flex items-center justify-center p-4 relative overflow-hidden"
      onDoubleClick={handleDoubleClick}
    >
      {isEditing ? (
        <textarea
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
          className="text-soft-white dark:text-white font-bold text-center leading-tight select-none cursor-pointer"
          style={{ fontSize: `${fontSize}px` }}
          title="Double-click to edit"
        >
          {text}
        </div>
      )}
    </div>
  );
};

export default TextBanner;