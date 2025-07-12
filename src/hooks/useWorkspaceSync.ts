import { useEffect, useRef } from 'react';
import { useWorkspace } from '../store/WorkspaceContext';

/**
 * Hook to sync workspace state with localStorage
 * Handles loading initial state and auto-saving changes
 */
export const useWorkspaceSync = () => {
  const { state, loadWorkspace } = useWorkspace();
  const isInitialized = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // Load workspace from localStorage on mount
  useEffect(() => {
    if (!isInitialized.current) {
      const savedState = localStorage.getItem('workspaceState');
      if (savedState) {
        try {
          const workspaceData = JSON.parse(savedState);
          loadWorkspace({
            widgets: workspaceData.componentList || [],
            widgetPositions: new Map(workspaceData.widgetPositions || []),
            widgetStates: new Map(workspaceData.widgetStates || []),
            activeWidgetId: workspaceData.activeIndex || null,
            backgroundType: workspaceData.backgroundType || 'geometric'
          });
        } catch (error) {
          console.error('Error loading workspace state:', error);
        }
      }
      isInitialized.current = true;
    }
  }, [loadWorkspace]);

  // Save workspace to localStorage on state changes (debounced)
  useEffect(() => {
    if (!isInitialized.current) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save operation
    saveTimeoutRef.current = setTimeout(() => {
      const workspaceData = {
        componentList: state.widgets,
        widgetPositions: Array.from(state.widgetPositions.entries()),
        widgetStates: Array.from(state.widgetStates.entries()),
        activeIndex: state.activeWidgetId,
        backgroundType: state.backgroundType
      };
      localStorage.setItem('workspaceState', JSON.stringify(workspaceData));
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [state]);

  return { isInitialized: isInitialized.current };
};