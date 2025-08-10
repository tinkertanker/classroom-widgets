import { useState, useCallback, useEffect } from 'react';
import { useModal } from '../../contexts/ModalContext';

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
  const [state, setState] = useState<T>(options.initialState || {} as T);

  // Notify parent of state changes
  useEffect(() => {
    if (options.onStateChange) {
      options.onStateChange(state);
    }
  }, [state, options]);

  const updateState = useCallback((updates: Partial<T>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const openSettings = useCallback(() => {
    showModal({
      title: options.title,
      content: (
        <SettingsComponent
          state={state}
          onUpdate={updateState}
          onClose={hideModal}
        />
      ),
      className: options.modalClassName || "bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-xl max-w-2xl"
    });
  }, [showModal, hideModal, state, updateState, options.title, options.modalClassName, SettingsComponent]);

  return {
    state,
    setState,
    openSettings,
    updateState
  };
}