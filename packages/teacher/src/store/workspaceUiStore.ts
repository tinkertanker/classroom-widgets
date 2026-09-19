// Transient UI state kept out of the persisted workspace store so
// focus/drag/connection changes don't trigger persist serialization.
import { create } from 'zustand';
import type { DragState, ServerStatus } from './workspaceStore';

export interface WorkspaceUiStore {
  focusedWidgetId: string | null;
  dragState: DragState;
  serverStatus: ServerStatus;
  setFocusedWidget: (widgetId: string | null) => void;
  startDragging: (widgetId: string) => void;
  stopDragging: () => void;
  setDropTarget: (target: string | null) => void;
  setServerStatus: (status: Partial<ServerStatus>) => void;
}

export const useWorkspaceUiStore = create<WorkspaceUiStore>()((set) => ({
  focusedWidgetId: null,
  dragState: {
    isDragging: false,
    draggedWidgetId: null,
    dropTarget: null
  },
  serverStatus: {
    connected: false,
    url: import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
  },
  setFocusedWidget: (widgetId) => {
    set({ focusedWidgetId: widgetId });
  },
  startDragging: (widgetId) => {
    set((state) => ({
      dragState: { ...state.dragState, isDragging: true, draggedWidgetId: widgetId }
    }));
  },
  stopDragging: () => {
    set((state) => ({
      dragState: { ...state.dragState, isDragging: false, draggedWidgetId: null, dropTarget: null }
    }));
  },
  setDropTarget: (target) => {
    set((state) => ({
      dragState: { ...state.dragState, dropTarget: target }
    }));
  },
  setServerStatus: (status) => set((state) => ({
    serverStatus: { ...state.serverStatus, ...status }
  }))
}));
