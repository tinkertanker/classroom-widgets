// Workspace-level hooks for managing the overall workspace state

import { useCallback, useSyncExternalStore } from 'react';
import { useShallow } from 'zustand/shallow';
import { useWorkspaceStore } from '@/store/workspaceStore.simple';
import { useWorkspaceUiStore } from '@/store/workspaceUiStore';
import { BackgroundType, WidgetType } from '../types';
import { isNativeDesktop } from '../utils/nativeBridge';
import { createDefaultShortenerSettings, type ShortenerSettings } from '../utils/urlShortener';

declare global {
  interface Window {
    __CLASSROOM_WIDGETS_MACOS__?: boolean;
    classroomShortenerSettings?: ShortenerSettings;
  }
}

const defaultNativeShortenerSettings = createDefaultShortenerSettings();
const getNativeShortenerSettings = () => window.classroomShortenerSettings ?? defaultNativeShortenerSettings;
const subscribeNativeShortenerSettings = (listener: () => void) => {
  window.addEventListener('classroom-shortener-settings-changed', listener);
  return () => window.removeEventListener('classroom-shortener-settings-changed', listener);
};

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

// Bottom bar hook
export function useBottomBar() {
  const bottomBar = useWorkspaceStore((state) => state.bottomBar);
  const updateBottomBar = useWorkspaceStore((state) => state.updateBottomBar);
  const toggleWidgetVisibility = useWorkspaceStore((state) => state.toggleWidgetVisibility);
  const pinWidget = useWorkspaceStore((state) => state.pinWidget);
  const unpinWidget = useWorkspaceStore((state) => state.unpinWidget);

  const setVisibleWidgets = useCallback((widgets: WidgetType[]) =>
    updateBottomBar({ visibleWidgets: widgets }), [updateBottomBar]);
  const toggleWidget = useCallback((type: WidgetType) =>
    toggleWidgetVisibility(type), [toggleWidgetVisibility]);
  const pin = useCallback((type: WidgetType) =>
    pinWidget(type), [pinWidget]);
  const unpin = useCallback((type: WidgetType) =>
    unpinWidget(type), [unpinWidget]);
  const toggleClock = useCallback(() =>
    updateBottomBar({ showClock: !bottomBar.showClock }), [bottomBar.showClock, updateBottomBar]);
  const toggleConnectionStatus = useCallback(() =>
    updateBottomBar({ showConnectionStatus: !bottomBar.showConnectionStatus }), [bottomBar.showConnectionStatus, updateBottomBar]);

  return {
    ...bottomBar,
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
  const connected = useWorkspaceUiStore((state) => state.serverStatus.connected);
  const url = useWorkspaceUiStore((state) => state.serverStatus.url);
  const error = useWorkspaceUiStore((state) => state.serverStatus.error);
  const setServerStatus = useWorkspaceUiStore((state) => state.setServerStatus);

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
  const dragState = useWorkspaceUiStore(useShallow((state) => state.dragState));
  const setDropTarget = useWorkspaceUiStore((state) => state.setDropTarget);
  
  const { isDragging, draggedWidgetId, dropTarget } = dragState;

  return {
    isDragging,
    draggedWidgetId,
    dropTarget,
    setDropTarget,
    isOverTrash: dropTarget === 'trash'
  };
}

// Link shortener settings, shared by the QR Code and Link Shortener widgets
export function useLinkShortener() {
  const settings = useWorkspaceStore((state) => state.linkShortener);
  const updateSettings = useWorkspaceStore((state) => state.updateLinkShortener);
  const nativeSettings = useSyncExternalStore(subscribeNativeShortenerSettings, getNativeShortenerSettings);

  return { settings: isNativeDesktop() ? nativeSettings : settings, updateSettings };
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
