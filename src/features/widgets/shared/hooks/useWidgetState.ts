import { useState, useEffect, useCallback } from 'react';
import { useWidget } from '../../../../contexts/WidgetContext';

/**
 * Hook for managing widget state with automatic persistence
 * @param initialState - Initial state for the widget
 * @param stateKey - Optional key for the state in savedState object
 */
export function useWidgetState<T>(initialState: T, stateKey?: string) {
  const { savedState, onStateChange } = useWidget();
  const [state, setState] = useState<T>(() => {
    if (savedState) {
      if (stateKey) {
        return savedState[stateKey] ?? initialState;
      }
      return savedState as T ?? initialState;
    }
    return initialState;
  });

  // Load saved state
  useEffect(() => {
    if (savedState) {
      if (stateKey && savedState[stateKey] !== undefined) {
        setState(savedState[stateKey]);
      } else if (!stateKey) {
        setState(savedState as T ?? initialState);
      }
    }
  }, [savedState, stateKey]);

  // Persist state changes
  const updateState = useCallback((newState: T | ((prev: T) => T)) => {
    setState(newState);
    if (onStateChange) {
      const updatedState = typeof newState === 'function' 
        ? (newState as (prev: T) => T)(state)
        : newState;
      
      if (stateKey) {
        onStateChange({ [stateKey]: updatedState });
      } else {
        onStateChange(updatedState);
      }
    }
  }, [state, onStateChange, stateKey]);

  return [state, updateState] as const;
}