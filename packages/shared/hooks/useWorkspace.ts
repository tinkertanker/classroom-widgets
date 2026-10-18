// Workspace-level hooks for managing the overall workspace state

import { useCallback, useSyncExternalStore } from 'react';
import { useShallow } from 'zustand/shallow';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useWorkspaceUiStore } from '@/store/workspaceUiStore';
import { isNativeDesktop } from '../utils/nativeBridge';
import { createDefaultShortenerSettings, type ShortenerSettings } from '../utils/urlShortener';
import { SHORTENER_SETTINGS_CHANGED_EVENT } from '../constants/desktopHostScripts';

declare global {
  interface Window {
    __CLASSROOM_WIDGETS_MACOS__?: boolean;
    classroomShortenerSettings?: ShortenerSettings;
  }
}

const defaultNativeShortenerSettings = createDefaultShortenerSettings();
const getNativeShortenerSettings = () => window.classroomShortenerSettings ?? defaultNativeShortenerSettings;
const subscribeNativeShortenerSettings = (listener: () => void) => {
  window.addEventListener(SHORTENER_SETTINGS_CHANGED_EVENT, listener);
  return () => window.removeEventListener(SHORTENER_SETTINGS_CHANGED_EVENT, listener);
};

// Main workspace hook
export function useWorkspace() {
  const background = useWorkspaceStore((state) => state.background);
  const theme = useWorkspaceStore((state) => state.theme);
  const scale = useWorkspaceStore((state) => state.scale);

  const setBackground = useWorkspaceStore((state) => state.setBackground);
  const setTheme = useWorkspaceStore((state) => state.setTheme);
  const setScale = useWorkspaceStore((state) => state.setScale);

  return {
    background,
    theme,
    scale,
    setBackground,
    setTheme,
    setScale
  };
}

// Bottom bar hook
export function useBottomBar() {
  return useWorkspaceStore((state) => state.bottomBar);
}

// Server connection hook
export function useServerConnection() {
  const connected = useWorkspaceUiStore((state) => state.serverStatus.connected);
  const url = useWorkspaceUiStore((state) => state.serverStatus.url);
  const setServerStatus = useWorkspaceUiStore((state) => state.setServerStatus);

  return {
    connected,
    url,
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
