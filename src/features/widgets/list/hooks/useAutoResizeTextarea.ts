import { useCallback, useRef } from 'react';

/**
 * Hook to manage auto-resizing textarea behavior
 */
export function useAutoResizeTextarea() {
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  // Auto-resize textarea to fit content
  const adjustHeight = useCallback((element: HTMLTextAreaElement) => {
    element.style.height = 'auto';
    element.style.height = element.scrollHeight + 'px';
  }, []);

  // Handle input event for auto-resize
  const handleInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    adjustHeight(target);
  }, [adjustHeight]);

  // Handle focus event to ensure proper height
  const handleFocus = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    adjustHeight(target);
  }, [adjustHeight]);

  // Create ref callback for textarea
  const createTextareaRef = useCallback((id: string, index: number) => {
    return (el: HTMLTextAreaElement | null) => {
      if (el) {
        textareaRefs.current.set(id, el);
        el.focus();
        // Place cursor at the end instead of selecting all
        el.setSelectionRange(el.value.length, el.value.length);
        // Initial height adjustment
        adjustHeight(el);
      } else {
        textareaRefs.current.delete(id);
      }
    };
  }, [adjustHeight]);

  // Get textarea element by item ID
  const getTextarea = useCallback((id: string) => {
    return textareaRefs.current.get(id);
  }, []);

  return {
    handleInput,
    handleFocus,
    createTextareaRef,
    getTextarea,
    adjustHeight
  };
}