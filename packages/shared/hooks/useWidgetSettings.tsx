import { useState, useCallback } from 'react';
import { useModal } from '@/contexts/ModalContext';

interface UseWidgetSettingsOptions<T> {
  title: string;
  initialState?: T;
  onStateChange?: (state: T) => void;
  modalClassName?: string;
}

interface UseWidgetSettingsReturn<T> {
  state: T;
  setState: React.Dispatch<React.SetStateAction<T>>;
  openSettings: () => void;
  updateState: (updates: Partial<T>) => void;
}

/**
 * Hook for managing widget settings and state
 * @param SettingsComponent React component for settings UI
 * @param options Configuration options
 * @returns State management and settings control
 */
export function useWidgetSettings<T extends object>(
  SettingsComponent: React.ComponentType<{
    state: T;
    onUpdate: (updates: Partial<T>) => void;
    onClose: () => void;
  }>,
  options: UseWidgetSettingsOptions<T>
): UseWidgetSettingsReturn<T> {
  const { showModal, hideModal } = useModal();
  const { title, initialState, onStateChange, modalClassName } = options;
  const [state, setStateInternal] = useState<T>(initialState || {} as T);

  const setState = useCallback((nextState: React.SetStateAction<T>) => {
    setStateInternal((prevState) => {
      const resolvedState = typeof nextState === 'function'
        ? (nextState as (prev: T) => T)(prevState)
        : nextState;
      onStateChange?.(resolvedState);
      return resolvedState;
    });
  }, [onStateChange]);

  const updateState = useCallback((updates: Partial<T>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, [setState]);

  const openSettings = useCallback(() => {
    showModal({
      title,
      content: (
        <SettingsComponent
          state={state}
          onUpdate={updateState}
          onClose={hideModal}
        />
      ),
      className: modalClassName || "bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-xl max-w-2xl"
    });
  }, [showModal, hideModal, state, updateState, title, modalClassName, SettingsComponent]);

  return {
    state,
    setState,
    openSettings,
    updateState
  };
}
