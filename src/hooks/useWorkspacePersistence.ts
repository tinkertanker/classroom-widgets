import { useEffect, useState } from 'react';
import { WidgetInstance, WidgetPositionsMap, WidgetStatesMap, BackgroundType } from '../types/app.types';

interface WorkspaceData {
  componentList: WidgetInstance[];
  widgetPositions: WidgetPositionsMap;
  widgetStates: WidgetStatesMap;
  activeIndex: string | null;
  backgroundType: BackgroundType;
}

interface UseWorkspacePersistenceReturn {
  saveWorkspaceState: (data: WorkspaceData) => void;
  loadWorkspaceState: () => WorkspaceData | null;
  isInitialized: boolean;
  setIsInitialized: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useWorkspacePersistence = (): UseWorkspacePersistenceReturn => {
  const [isInitialized, setIsInitialized] = useState(false);

  // Save workspace state to localStorage
  const saveWorkspaceState = (data: WorkspaceData) => {
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
  const loadWorkspaceState = (): WorkspaceData | null => {
    const savedState = localStorage.getItem('workspaceState');
    if (savedState) {
      try {
        const workspaceData = JSON.parse(savedState);
        return {
          componentList: workspaceData.componentList || [],
          widgetPositions: new Map(workspaceData.widgetPositions || []) as WidgetPositionsMap,
          widgetStates: new Map(workspaceData.widgetStates || []) as WidgetStatesMap,
          activeIndex: workspaceData.activeIndex || null,
          backgroundType: workspaceData.backgroundType || 'geometric' as BackgroundType
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