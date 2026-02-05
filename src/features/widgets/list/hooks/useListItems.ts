import { useState, useCallback, type SetStateAction } from 'react';
import { v4 as uuidv4 } from 'uuid';

export interface ListItem {
  id: string;
  text: string;
  status: number;
  isEditing?: boolean;
}

export interface ListWidgetState {
  items: ListItem[];
  inputs: string[];
  statuses: number[];
}

interface UseListItemsOptions {
  initialItems?: ListItem[];
  savedState?: {
    inputs: string[];
    statuses: number[];
    items?: ListItem[];
  };
  onStateChange?: (state: ListWidgetState) => void;
}

/**
 * Hook to manage list items with add, update, delete, and status cycling
 */
export function useListItems({ initialItems, savedState, onStateChange }: UseListItemsOptions) {
  // Initialize items with stable IDs
  const [items, setItems] = useState<ListItem[]>(() => {
    if (initialItems) return initialItems;
    if (savedState?.items) return savedState.items;
    // Convert legacy format to new format with IDs
    if (savedState?.inputs) {
      return savedState.inputs.map((text, index) => ({
        id: uuidv4(),
        text,
        status: savedState.statuses?.[index] || 0
      }));
    }
    return [{ id: uuidv4(), text: "", status: 0 }];
  });

  const notifyStateChange = useCallback((nextItems: ListItem[]) => {
    if (!onStateChange) return;
    onStateChange({
      items: nextItems,
      // Keep backward compatibility
      inputs: nextItems.map(item => item.text),
      statuses: nextItems.map(item => item.status)
    });
  }, [onStateChange]);

  const setItemsAndNotify = useCallback((nextItems: SetStateAction<ListItem[]>) => {
    setItems(prevItems => {
      const resolvedItems = typeof nextItems === 'function'
        ? (nextItems as (prev: ListItem[]) => ListItem[])(prevItems)
        : nextItems;
      notifyStateChange(resolvedItems);
      return resolvedItems;
    });
  }, [notifyStateChange]);

  // Add new item
  const addItem = useCallback(() => {
    const newItem = { id: uuidv4(), text: "", status: 0 };
    setItemsAndNotify(prevItems => [...prevItems, newItem]);
    return newItem;
  }, [setItemsAndNotify]);

  // Update item text
  const updateItemText = useCallback((id: string, text: string) => {
    setItemsAndNotify(prevItems => 
      prevItems.map(item => 
        item.id === id ? { ...item, text } : item
      )
    );
  }, [setItemsAndNotify]);

  // Cycle item status (0-4)
  const cycleItemStatus = useCallback((id: string) => {
    setItemsAndNotify(prevItems =>
      prevItems.map(item =>
        item.id === id ? { ...item, status: (item.status + 1) % 5 } : item
      )
    );
  }, [setItemsAndNotify]);

  // Delete item
  const deleteItem = useCallback((id: string) => {
    setItemsAndNotify(prevItems => prevItems.filter(item => item.id !== id));
  }, [setItemsAndNotify]);

  // Start editing an item
  const startEditing = useCallback((id: string) => {
    setItemsAndNotify(prevItems =>
      prevItems.map(item =>
        item.id === id ? { ...item, isEditing: true } : { ...item, isEditing: false }
      )
    );
  }, [setItemsAndNotify]);

  // Stop editing an item
  const stopEditing = useCallback((id: string) => {
    setItemsAndNotify(prevItems =>
      prevItems.map(item =>
        item.id === id ? { ...item, isEditing: false } : item
      )
    );
  }, [setItemsAndNotify]);

  // Reorder items (for drag and drop)
  const reorderItems = useCallback((startIndex: number, endIndex: number) => {
    setItemsAndNotify(prevItems => {
      const result = Array.from(prevItems);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result;
    });
  }, [setItemsAndNotify]);

  return {
    items,
    addItem,
    updateItemText,
    cycleItemStatus,
    deleteItem,
    startEditing,
    stopEditing,
    reorderItems
  };
}
