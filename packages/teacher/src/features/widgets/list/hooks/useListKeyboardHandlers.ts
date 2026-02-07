import { useCallback } from 'react';

interface UseListKeyboardHandlersOptions {
  onStopEditing: (id: string) => void;
  onAddItem: () => void;
  items: Array<{ id: string; text: string }>;
}

/**
 * Hook to manage keyboard interactions for list items
 */
export function useListKeyboardHandlers({
  onStopEditing,
  onAddItem,
  items
}: UseListKeyboardHandlersOptions) {
  
  const handleKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    itemId: string,
    itemIndex: number
  ) => {
    if (e.key === 'Escape') {
      onStopEditing(itemId);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onStopEditing(itemId);
      
      // If this is the last item and it has text, add a new item
      const currentItem = items.find(item => item.id === itemId);
      if (itemIndex === items.length - 1 && currentItem?.text.trim()) {
        onAddItem();
      }
    }
  }, [items, onStopEditing, onAddItem]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return {
    handleKeyDown,
    handleMouseDown
  };
}