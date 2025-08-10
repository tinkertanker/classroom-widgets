import { useState, useCallback, useEffect } from 'react';

interface UseWidgetStateOptions<T> {
  initialState: T;
  onStateChange?: (state: T) => void;
  savedState?: T;
}

export function useWidgetState<T>({ 
  initialState, 
  onStateChange, 
  savedState 
}: UseWidgetStateOptions<T>) {
  const [state, setState] = useState<T>(savedState || initialState);

  // Update parent when state changes
  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  // Update state when savedState changes
  useEffect(() => {
    if (savedState) {
      setState(savedState);
    }
  }, [savedState]);

  const updateState = useCallback((updates: Partial<T>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const resetState = useCallback(() => {
    setState(initialState);
  }, [initialState]);

  return {
    state,
    setState,
    updateState,
    resetState
  };
}

// Common widget state patterns
export interface BaseWidgetState {
  isActive?: boolean;
  isEditing?: boolean;
  isLoading?: boolean;
  error?: string | null;
}

// Hook for common widget operations
export function useWidgetOperations() {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEditing = useCallback(() => setIsEditing(true), []);
  const stopEditing = useCallback(() => setIsEditing(false), []);
  const toggleEditing = useCallback(() => setIsEditing(prev => !prev), []);

  const startLoading = useCallback(() => setIsLoading(true), []);
  const stopLoading = useCallback(() => setIsLoading(false), []);

  const setErrorMessage = useCallback((message: string | null) => setError(message), []);
  const clearError = useCallback(() => setError(null), []);

  return {
    isEditing,
    isLoading,
    error,
    startEditing,
    stopEditing,
    toggleEditing,
    startLoading,
    stopLoading,
    setErrorMessage,
    clearError
  };
}