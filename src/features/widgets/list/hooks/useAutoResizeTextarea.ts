import { useCallback, useRef } from 'react';

/**
 * Hook to manage auto-resizing textarea behavior
 */
export function useAutoResizeTextarea() {
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const cursorPositions = useRef<Map<string, number>>(new Map());

  // Auto-resize textarea to fit content
  const adjustHeight = useCallback((element: HTMLTextAreaElement) => {
    // Temporarily set to auto to get the true scrollHeight
    const previousHeight = element.style.height;
    element.style.height = 'auto';
    const newHeight = element.scrollHeight;

    // Only apply if content needs more space than min-height
    // Otherwise, let CSS min-height handle it
    element.style.height = newHeight + 'px';
  }, []);

  // Handle input event for auto-resize
  const handleInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    adjustHeight(target);
    // Save cursor position after input
    const id = target.getAttribute('data-item-id');
    if (id) {
      cursorPositions.current.set(id, target.selectionStart);
    }
  }, [adjustHeight]);

  // Handle focus event - no height adjustment needed
  const handleFocus = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    // Focus event doesn't need height adjustment
    // Let CSS min-height handle the initial height
  }, []);

  // Handle click to save cursor position
  const handleClick = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    const id = target.getAttribute('data-item-id');
    if (id) {
      // Use setTimeout to get position after click event completes
      setTimeout(() => {
        cursorPositions.current.set(id, target.selectionStart);
      }, 0);
    }
  }, []);

  // Stable ref callback for all textareas
  const textareaRef = useCallback((el: HTMLTextAreaElement | null) => {
    if (el) {
      const id = el.getAttribute('data-item-id');
      if (!id) return;

      const wasAlreadyMounted = textareaRefs.current.has(id);
      textareaRefs.current.set(id, el);

      if (!wasAlreadyMounted) {
        // Just entered edit mode - focus and position cursor
        el.focus();
        const cursorPos = el.value.length; // End of text
        el.setSelectionRange(cursorPos, cursorPos);
        cursorPositions.current.set(id, cursorPos);
        // Don't adjust height on mount - let CSS min-height handle it
      } else {
        // Re-render during editing - restore cursor position
        const savedPosition = cursorPositions.current.get(id);
        if (savedPosition !== undefined) {
          el.setSelectionRange(savedPosition, savedPosition);
        }
        // Don't adjust height on re-render either - only on input
      }
    } else {
      // Cleanup - element is being removed from DOM (exiting edit mode)
      // We'll get the id from the keys when iterating, but for now just clear all removed ones
      // This happens when switching from editing to non-editing mode
    }
  }, []);

  // Get textarea element by item ID
  const getTextarea = useCallback((id: string) => {
    return textareaRefs.current.get(id);
  }, []);

  // Cleanup function to call when exiting edit mode
  const cleanupTextarea = useCallback((id: string) => {
    textareaRefs.current.delete(id);
    // Keep cursorPositions for next edit session
  }, []);

  return {
    handleInput,
    handleFocus,
    handleClick,
    textareaRef,
    getTextarea,
    adjustHeight,
    cleanupTextarea
  };
}