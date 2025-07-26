// Workspace-level hooks for managing the overall workspace state

import { useCallback } from 'react';
import { shallow } from 'zustand/shallow';
import { useWorkspaceStore } from '../../store/workspaceStore.simple';
import { BackgroundType, WidgetType } from '../types';

// Main workspace hook
export function useWorkspace() {
  const background = useWorkspaceStore((state) => state.background);
  const theme = useWorkspaceStore((state) => state.theme);
  const scale = useWorkspaceStore((state) => state.scale);
  const scrollPosition = useWorkspaceStore((state) => state.scrollPosition);

  const setBackground = useWorkspaceStore((state) => state.setBackground);
  const setTheme = useWorkspaceStore((state) => state.setTheme);
  const setScale = useWorkspaceStore((state) => state.setScale);
  const setScrollPosition = useWorkspaceStore((state) => state.setScrollPosition);
  const resetWorkspace = useWorkspaceStore((state) => state.resetWorkspace);

  return {
    background,
    theme,
    scale,
    scrollPosition,
    setBackground,
    setTheme,
    setScale,
    setScrollPosition,
    reset: resetWorkspace
  };
}

// Toolbar hook
export function useToolbar() {
  const toolbar = useWorkspaceStore((state) => state.toolbar);
  const updateToolbar = useWorkspaceStore((state) => state.updateToolbar);
  const toggleWidgetVisibility = useWorkspaceStore((state) => state.toggleWidgetVisibility);
  const pinWidget = useWorkspaceStore((state) => state.pinWidget);
  const unpinWidget = useWorkspaceStore((state) => state.unpinWidget);

  const setVisibleWidgets = useCallback((widgets: WidgetType[]) => 
    updateToolbar({ visibleWidgets: widgets }), [updateToolbar]);
  const toggleWidget = useCallback((type: WidgetType) => 
    toggleWidgetVisibility(type), [toggleWidgetVisibility]);
  const pin = useCallback((type: WidgetType) => 
    pinWidget(type), [pinWidget]);
  const unpin = useCallback((type: WidgetType) => 
    unpinWidget(type), [unpinWidget]);
  const toggleClock = useCallback(() => 
    updateToolbar({ showClock: !toolbar.showClock }), [toolbar.showClock, updateToolbar]);
  const toggleConnectionStatus = useCallback(() => 
    updateToolbar({ showConnectionStatus: !toolbar.showConnectionStatus }), [toolbar.showConnectionStatus, updateToolbar]);

  return {
    ...toolbar,
    setVisibleWidgets,
    toggleWidget,
    pin,
    unpin,
    toggleClock,
    toggleConnectionStatus
  };
}

// Server connection hook
export function useServerConnection() {
  const connected = useWorkspaceStore((state) => state.serverStatus.connected);
  const url = useWorkspaceStore((state) => state.serverStatus.url);
  const error = useWorkspaceStore((state) => state.serverStatus.error);
  const setServerStatus = useWorkspaceStore((state) => state.setServerStatus);

  const connect = useCallback(() => setServerStatus({ connected: true }), [setServerStatus]);
  const disconnect = useCallback(() => setServerStatus({ connected: false }), [setServerStatus]);
  const setUrl = useCallback((url: string) => setServerStatus({ url }), [setServerStatus]);
  const setError = useCallback((error: string | undefined) => setServerStatus({ error }), [setServerStatus]);

  return {
    connected,
    url,
    error,
    connect,
    disconnect,
    setUrl,
    setError,
    setServerStatus
  };
}

// Drag and drop hook
export function useDragAndDrop() {
  const isDragging = useWorkspaceStore((state) => state.dragState.isDragging);
  const draggedWidgetId = useWorkspaceStore((state) => state.dragState.draggedWidgetId);
  const dropTarget = useWorkspaceStore((state) => state.dragState.dropTarget);
  const setDropTarget = useWorkspaceStore((state) => state.setDropTarget);

  return {
    isDragging,
    draggedWidgetId,
    dropTarget,
    setDropTarget,
    isOverTrash: dropTarget === 'trash'
  };
}

// Theme hook with side effects
export function useTheme() {
  const theme = useWorkspaceStore((state) => state.theme);
  const setTheme = useWorkspaceStore((state) => state.setTheme);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  }, [theme, setTheme]);

  return {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark'
  };
}

// Zoom hook
export function useZoom() {
  const scale = useWorkspaceStore((state) => state.scale);
  const setScale = useWorkspaceStore((state) => state.setScale);

  const zoom = useCallback((delta: number) => {
    useWorkspaceStore.getState().setScale(useWorkspaceStore.getState().scale + delta);
  }, []);

  const zoomIn = useCallback(() => zoom(0.1), [zoom]);
  const zoomOut = useCallback(() => zoom(-0.1), [zoom]);
  const resetZoom = useCallback(() => setScale(1), [setScale]);

  return {
    scale,
    setScale,
    zoom,
    zoomIn,
    zoomOut,
    resetZoom,
    canZoomIn: scale < 2,
    canZoomOut: scale > 0.5
  };
}

// Performance metrics hook
export function usePerformanceMetrics() {
  const widgetCount = useWorkspaceStore((state) => state.widgets.length);
  
  return {
    widgetCount,
    isHighLoad: widgetCount > 50,
    performanceWarning: widgetCount > 100
  };
}