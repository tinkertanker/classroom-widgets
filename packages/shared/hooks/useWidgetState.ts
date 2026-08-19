import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Structural equality for widget state, which is persisted as JSON and so is
 * built from plain objects, arrays and primitives. Nested widget state (arrays,
 * score objects) is rebuilt on every update, so a one-level comparison reports
 * every logically-unchanged value as changed.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  const objectA = a as Record<string, unknown>;
  const objectB = b as Record<string, unknown>;
  const keysA = Object.keys(objectA);
  if (keysA.length !== Object.keys(objectB).length) return false;
  return keysA.every(key =>
    Object.prototype.hasOwnProperty.call(objectB, key) && deepEqual(objectA[key], objectB[key])
  );
}

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
  const [state, setStateInternal] = useState<T>(savedState ?? initialState);

  // The value the hook and its parent last agreed on: whatever we most recently
  // pushed through onStateChange, or the last savedState we adopted. A savedState
  // matching this is our own update coming back, not an external change.
  const agreedRef = useRef<T | undefined>(savedState);
  // The last savedState the resync effect looked at, so a parent that rebuilds
  // the prop on every render reads as unchanged rather than as a new value.
  const seenSavedRef = useRef<T | undefined>(savedState);
  // Local writes the parent has not yet echoed, oldest first. A persist that
  // lands out of order (A1 while local is already A2) is an echo of an earlier
  // write, not an external change, and must not clobber A2.
  const inFlightRef = useRef<T[]>([]);

  const setState = useCallback((nextState: React.SetStateAction<T>, notifyParent = true) => {
    setStateInternal((prevState) => {
      const resolvedState = typeof nextState === 'function'
        ? (nextState as (prev: T) => T)(prevState)
        : nextState;
      if (notifyParent) {
        agreedRef.current = resolvedState;
        inFlightRef.current = [...inFlightRef.current, resolvedState];
        onStateChange?.(resolvedState);
      }
      return resolvedState;
    });
  }, [onStateChange]);

  // Adopt savedState only for changes this hook did not itself produce. The
  // comparisons are against what we sent out, never against the current local
  // state, so a widget whose state is nested (TicTacToe rebuilds `board` and
  // `score` on every move) is neither thrashed by a parent that hands back an
  // equal-but-rebuilt value nor snapped back to a savedState that is still
  // catching up with a local update.
  useEffect(() => {
    if (savedState === undefined) return;
    // The parent's value did not actually change, only its reference.
    if (deepEqual(savedState, seenSavedRef.current)) return;
    seenSavedRef.current = savedState;
    // The parent is echoing the latest update we handed it.
    if (deepEqual(savedState, agreedRef.current)) {
      inFlightRef.current = [];
      return;
    }
    const echoedIndex = inFlightRef.current.findIndex(pending => deepEqual(pending, savedState));
    if (echoedIndex !== -1) {
      // Stale echo of an earlier in-flight write. Keep the newer local value.
      inFlightRef.current = inFlightRef.current.slice(echoedIndex + 1);
      return;
    }
    inFlightRef.current = [];
    agreedRef.current = savedState;
    setState(savedState, false);
  }, [savedState, setState]);

  const updateState = useCallback((updates: Partial<T>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, [setState]);

  const resetState = useCallback(() => {
    setState(initialState);
  }, [setState, initialState]);

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
