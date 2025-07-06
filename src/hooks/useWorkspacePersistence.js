import { useEffect, useState } from 'react';

export const useWorkspacePersistence = () => {
  const [isInitialized, setIsInitialized] = useState(false);

  // Save workspace state to localStorage
  const saveWorkspaceState = (data) => {
    const workspaceData = {
      componentList: data.componentList,
      widgetPositions: Array.from(data.widgetPositions.entries()),
      widgetStates: Array.from(data.widgetStates.entries()),
      activeIndex: data.activeIndex,
      backgroundType: data.backgroundType
    };
    localStorage.setItem('workspaceState', JSON.stringify(workspaceData));
  };

  // Load workspace state from localStorage
  const loadWorkspaceState = () => {
    const savedState = localStorage.getItem('workspaceState');
    if (savedState) {
      try {
        const workspaceData = JSON.parse(savedState);
        return {
          componentList: workspaceData.componentList || [],
          widgetPositions: new Map(workspaceData.widgetPositions || []),
          widgetStates: new Map(workspaceData.widgetStates || []),
          activeIndex: workspaceData.activeIndex || null,
          backgroundType: workspaceData.backgroundType || 'geometric'
        };
      } catch (error) {
        console.error('Error loading workspace state:', error);
        return null;
      }
    }
    return null;
  };

  return { saveWorkspaceState, loadWorkspaceState, isInitialized, setIsInitialized };
};