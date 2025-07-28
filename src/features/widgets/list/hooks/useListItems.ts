import { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface ListItem {
  id: string;
  text: string;
  status: number;
  isEditing?: boolean;
}

interface UseListItemsOptions {
  initialItems?: ListItem[];
  savedState?: {
    inputs: string[];
    statuses: number[];
    items?: ListItem[];
  };
  onStateChange?: (state: any) => void;
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

  const isFirstRender = useRef(true);

  // Notify parent of state changes
  const updateState = useCallback(() => {
    if (onStateChange) {
      onStateChange({
        items,
        // Keep backward compatibility
        inputs: items.map(item => item.text),
        statuses: items.map(item => item.status)
      });
    }
  }, [items, onStateChange]);

  // Update state whenever items change (skip initial render)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    updateState();
  }, [items, updateState]);

  // Add new item
  const addItem = useCallback(() => {
    const newItem = { id: uuidv4(), text: "", status: 0 };
    setItems(prevItems => [...prevItems, newItem]);
    return newItem;
  }, []);

  // Update item text
  const updateItemText = useCallback((id: string, text: string) => {
    setItems(prevItems => 
      prevItems.map(item => 
        item.id === id ? { ...item, text } : item
      )
    );
  }, []);

  // Cycle item status (0-4)
  const cycleItemStatus = useCallback((id: string) => {
    setItems(prevItems =>
      prevItems.map(item =>
        item.id === id ? { ...item, status: (item.status + 1) % 5 } : item
      )
    );
  }, []);

  // Delete item
  const deleteItem = useCallback((id: string) => {
    setItems(prevItems => prevItems.filter(item => item.id !== id));
  }, []);

  // Start editing an item
  const startEditing = useCallback((id: string) => {
    setItems(prevItems =>
      prevItems.map(item =>
        item.id === id ? { ...item, isEditing: true } : { ...item, isEditing: false }
      )
    );
  }, []);

  // Stop editing an item
  const stopEditing = useCallback((id: string) => {
    setItems(prevItems =>
      prevItems.map(item =>
        item.id === id ? { ...item, isEditing: false } : item
      )
    );
  }, []);

  // Reorder items (for drag and drop)
  const reorderItems = useCallback((startIndex: number, endIndex: number) => {
    setItems(prevItems => {
      const result = Array.from(prevItems);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result;
    });
  }, []);

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