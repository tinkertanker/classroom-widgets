// Simplified store for testing
import { create } from 'zustand';
import { BackgroundType, WidgetType } from '../types';
import { WorkspaceStore } from './workspaceStore';
import { widgetRegistry } from '../services/WidgetRegistry';

const defaultToolbar = {
  visibleWidgets: [
    WidgetType.RANDOMISER,
    WidgetType.TIMER,
    WidgetType.LIST,
    WidgetType.TASK_CUE,
    WidgetType.TRAFFIC_LIGHT,
    WidgetType.POLL
  ],
  pinnedWidgets: [],
  showClock: true,
  showConnectionStatus: true
};

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  // Initial State
  widgets: [],
  background: BackgroundType.NONE,
  theme: 'light',
  scale: 1,
  scrollPosition: { x: 0, y: 0 },
  sessionCode: null,
  dragState: {
    isDragging: false,
    draggedWidgetId: null,
    dropTarget: null
  },
  toolbar: defaultToolbar,
  serverStatus: {
    connected: false,
    url: 'http://localhost:3001'
  },
  widgetStates: new Map(),
  eventListeners: new Map(),
  history: [],
  historyIndex: -1,
  canUndo: false,
  canRedo: false,
  
  // Simple action implementations
  setSessionCode: (code) => set({ sessionCode: code }),
  setBackground: (background) => set({ background }),
  setTheme: (theme) => set({ theme }),
  setScale: (scale) => set({ scale }),
  setScrollPosition: (position) => set({ scrollPosition: position }),
  setServerStatus: (status) => set((state) => ({ 
    serverStatus: { ...state.serverStatus, ...status } 
  })),
  
  // Widget methods
  addWidget: (type, position) => {
    const id = Date.now().toString();
    const config = widgetRegistry.get(type);
    const newWidget = {
      id,
      type,
      position: position || { x: 100 + get().widgets.length * 20, y: 100 + get().widgets.length * 20 },
      size: config?.defaultSize || { width: 350, height: 350 },
      zIndex: get().widgets.length
    };
    set((state) => ({ widgets: [...state.widgets, newWidget] }));
    return id;
  },
  removeWidget: (widgetId) => {
    set((state) => ({ 
      widgets: state.widgets.filter(w => w.id !== widgetId) 
    }));
  },
  updateWidget: (widgetId, updates) => {
    set((state) => ({
      widgets: state.widgets.map(w => 
        w.id === widgetId ? { ...w, ...updates } : w
      )
    }));
  },
  moveWidget: (widgetId, position) => {
    set((state) => ({
      widgets: state.widgets.map(w => 
        w.id === widgetId ? { ...w, position } : w
      )
    }));
  },
  resizeWidget: (widgetId, size) => {
    set((state) => ({
      widgets: state.widgets.map(w => 
        w.id === widgetId ? { ...w, size } : w
      )
    }));
  },
  bringToFront: (widgetId) => {
    set((state) => {
      const widgets = [...state.widgets];
      const widgetIndex = widgets.findIndex(w => w.id === widgetId);
      if (widgetIndex !== -1) {
        const widget = widgets[widgetIndex];
        widgets.splice(widgetIndex, 1);
        widgets.push(widget);
        widgets.forEach((w, i) => { w.zIndex = i; });
      }
      return { widgets };
    });
  },
  resetWorkspace: () => {
    set({ 
      widgets: [],
      background: BackgroundType.NONE,
      theme: 'light',
      scale: 1,
      scrollPosition: { x: 0, y: 0 }
    });
  },
  updateToolbar: () => {},
  toggleWidgetVisibility: () => {},
  pinWidget: () => {},
  unpinWidget: () => {},
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
  updateWidgetState: (widgetId, state) => {
    set((store) => {
      const newStates = new Map(store.widgetStates);
      newStates.set(widgetId, state);
      return { widgetStates: newStates };
    });
  },
  setWidgetState: (widgetId, state) => {
    set((store) => {
      const newStates = new Map(store.widgetStates);
      newStates.set(widgetId, state);
      return { widgetStates: newStates };
    });
  },
  emitEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  saveSnapshot: () => {},
  undo: () => {},
  redo: () => {}
}));