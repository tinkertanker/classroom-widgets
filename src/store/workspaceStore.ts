// Workspace Store - Centralized state management for the teacher app

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { v4 as uuid } from 'uuid';

import { 
  WidgetInstance, 
  WorkspaceState, 
  WidgetType, 
  Position, 
  Size, 
  BackgroundType,
  DragState,
  ToolbarConfig,
  ServerStatus,
  WidgetEvent
} from '../shared/types';
import { widgetRegistry } from '../services/WidgetRegistry';

interface WorkspaceStore extends WorkspaceState {
  // Session Management
  sessionCode: string | null;
  setSessionCode: (code: string | null) => void;
  
  // Widget Actions
  addWidget: (type: WidgetType, position?: Position) => string;
  removeWidget: (widgetId: string) => void;
  updateWidget: (widgetId: string, updates: Partial<WidgetInstance>) => void;
  moveWidget: (widgetId: string, position: Position) => void;
  resizeWidget: (widgetId: string, size: Size) => void;
  bringToFront: (widgetId: string) => void;
  updateWidgetState: (widgetId: string, state: any) => void;
  
  // Workspace Actions
  setBackground: (background: BackgroundType) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setScale: (scale: number) => void;
  setScrollPosition: (position: { x: number; y: number }) => void;
  resetWorkspace: () => void;
  
  // Drag and Drop
  dragState: DragState;
  startDragging: (widgetId: string) => void;
  stopDragging: () => void;
  setDropTarget: (target: 'trash' | null) => void;
  
  // Toolbar
  toolbar: ToolbarConfig;
  updateToolbar: (updates: Partial<ToolbarConfig>) => void;
  toggleWidgetVisibility: (type: WidgetType) => void;
  pinWidget: (type: WidgetType) => void;
  unpinWidget: (type: WidgetType) => void;
  
  // Server Connection
  serverStatus: ServerStatus;
  setServerStatus: (status: Partial<ServerStatus>) => void;
  
  // Widget States Map
  widgetStates: Map<string, any>;
  
  // Event Emitter
  emitEvent: (event: WidgetEvent) => void;
  eventListeners: Map<string, Set<(event: WidgetEvent) => void>>;
  addEventListener: (id: string, listener: (event: WidgetEvent) => void) => void;
  removeEventListener: (id: string, listener: (event: WidgetEvent) => void) => void;
  
  // Undo/Redo (future enhancement)
  history: WorkspaceState[];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

const defaultToolbar: ToolbarConfig = {
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

const defaultWorkspace: WorkspaceState = {
  widgets: [],
  background: BackgroundType.NONE,
  theme: 'light',
  scale: 1,
  scrollPosition: { x: 0, y: 0 }
};

export const useWorkspaceStore = create<WorkspaceStore>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((set, get) => ({
          // Initial State
          ...defaultWorkspace,
          sessionCode: null,
          dragState: {
            isDragging: false,
            draggedWidgetId: null,
            dropTarget: null
          },
          toolbar: defaultToolbar,
          serverStatus: {
            connected: false,
            url: (() => {
              // Compute URL once during initialization
              if (import.meta.env.VITE_SERVER_URL) {
                return import.meta.env.VITE_SERVER_URL;
              }
              return window.location.hostname === 'localhost' 
                ? 'http://localhost:3001' 
                : `${window.location.protocol}//${window.location.hostname}:3001`;
            })()
          },
          widgetStates: new Map(),
          eventListeners: new Map(),
          history: [],
          historyIndex: -1,
          canUndo: false,
          canRedo: false,
          
          // Session Management
          setSessionCode: (code: string | null) => {
            set((state) => {
              state.sessionCode = code;
            });
          },

          // Widget Actions
          addWidget: (type: WidgetType, position?: Position) => {
            const id = uuid();
            const config = widgetRegistry.get(type);
            
            if (!config) {
              console.error(`Widget type ${type} not found in registry`);
              return id;
            }

            const newWidget: WidgetInstance = {
              id,
              type,
              position: position || { x: 0, y: 0 },
              size: config.defaultSize,
              zIndex: get().widgets.length
            };

            set((state) => {
              state.widgets.push(newWidget);
              state.emitEvent({
                type: 'add',
                widgetId: id,
                data: newWidget
              });
            });

            return id;
          },

          removeWidget: (widgetId: string) => {
            set((state) => {
              const index = state.widgets.findIndex(w => w.id === widgetId);
              if (index !== -1) {
                state.widgets.splice(index, 1);
                state.widgetStates.delete(widgetId);
                
                // Recalculate z-indices
                state.widgets.forEach((widget, i) => {
                  widget.zIndex = i;
                });
                
                state.emitEvent({
                  type: 'remove',
                  widgetId
                });
              }
            });
          },

          updateWidget: (widgetId: string, updates: Partial<WidgetInstance>) => {
            set((state) => {
              const widget = state.widgets.find(w => w.id === widgetId);
              if (widget) {
                Object.assign(widget, updates);
                state.emitEvent({
                  type: 'update',
                  widgetId,
                  data: updates
                });
              }
            });
          },

          moveWidget: (widgetId: string, position: Position) => {
            get().updateWidget(widgetId, { position });
            get().emitEvent({
              type: 'move',
              widgetId,
              data: position
            });
          },

          resizeWidget: (widgetId: string, size: Size) => {
            get().updateWidget(widgetId, { size });
            get().emitEvent({
              type: 'resize',
              widgetId,
              data: size
            });
          },

          bringToFront: (widgetId: string) => {
            set((state) => {
              const widgetIndex = state.widgets.findIndex(w => w.id === widgetId);
              if (widgetIndex !== -1) {
                const widget = state.widgets[widgetIndex];
                state.widgets.splice(widgetIndex, 1);
                state.widgets.push(widget);
                
                // Recalculate z-indices
                state.widgets.forEach((w, i) => {
                  w.zIndex = i;
                });
              }
            });
          },

          updateWidgetState: (widgetId: string, state: any) => {
            set((draft) => {
              draft.widgetStates.set(widgetId, state);
            });
          },

          // Workspace Actions
          setBackground: (background: BackgroundType) => {
            set((state) => {
              state.background = background;
            });
          },

          setTheme: (theme: 'light' | 'dark') => {
            set((state) => {
              state.theme = theme;
              document.documentElement.classList.toggle('dark', theme === 'dark');
            });
          },

          setScale: (scale: number) => {
            set((state) => {
              state.scale = Math.max(0.5, Math.min(2, scale));
            });
          },

          setScrollPosition: (position: { x: number; y: number }) => {
            set((state) => {
              state.scrollPosition = position;
            });
          },

          resetWorkspace: () => {
            set((state) => {
              state.widgets = [];
              state.widgetStates.clear();
              state.background = BackgroundType.NONE;
              state.scale = 1;
              state.scrollPosition = { x: 0, y: 0 };
            });
          },

          // Drag and Drop
          startDragging: (widgetId: string) => {
            set((state) => {
              state.dragState = {
                isDragging: true,
                draggedWidgetId: widgetId,
                dropTarget: null
              };
            });
          },

          stopDragging: () => {
            const { dragState } = get();
            
            if (dragState.dropTarget === 'trash' && dragState.draggedWidgetId) {
              get().removeWidget(dragState.draggedWidgetId);
            }
            
            set((state) => {
              state.dragState = {
                isDragging: false,
                draggedWidgetId: null,
                dropTarget: null
              };
            });
          },

          setDropTarget: (target: 'trash' | null) => {
            set((state) => {
              state.dragState.dropTarget = target;
            });
          },

          // Toolbar
          updateToolbar: (updates: Partial<ToolbarConfig>) => {
            set((state) => {
              Object.assign(state.toolbar, updates);
            });
          },

          toggleWidgetVisibility: (type: WidgetType) => {
            set((state) => {
              const index = state.toolbar.visibleWidgets.indexOf(type);
              if (index === -1) {
                state.toolbar.visibleWidgets.push(type);
              } else {
                state.toolbar.visibleWidgets.splice(index, 1);
              }
            });
          },

          pinWidget: (type: WidgetType) => {
            set((state) => {
              if (!state.toolbar.pinnedWidgets.includes(type)) {
                state.toolbar.pinnedWidgets.push(type);
              }
            });
          },

          unpinWidget: (type: WidgetType) => {
            set((state) => {
              const index = state.toolbar.pinnedWidgets.indexOf(type);
              if (index !== -1) {
                state.toolbar.pinnedWidgets.splice(index, 1);
              }
            });
          },

          // Server Connection
          setServerStatus: (status: Partial<ServerStatus>) => {
            set((state) => {
              Object.assign(state.serverStatus, status);
            });
          },

          // Event System
          emitEvent: (event: WidgetEvent) => {
            const listeners = get().eventListeners.get(event.widgetId);
            if (listeners) {
              listeners.forEach(listener => listener(event));
            }
          },

          addEventListener: (id: string, listener: (event: WidgetEvent) => void) => {
            set((state) => {
              if (!state.eventListeners.has(id)) {
                state.eventListeners.set(id, new Set());
              }
              state.eventListeners.get(id)!.add(listener);
            });
          },

          removeEventListener: (id: string, listener: (event: WidgetEvent) => void) => {
            set((state) => {
              state.eventListeners.get(id)?.delete(listener);
            });
          },

          // Undo/Redo (simplified for now)
          undo: () => {
            // TODO: Implement undo functionality
            console.log('Undo not yet implemented');
          },

          redo: () => {
            // TODO: Implement redo functionality
            console.log('Redo not yet implemented');
          }
        })),
        {
          name: 'classroom-widgets-workspace',
          partialize: (state) => ({
            widgets: state.widgets,
            background: state.background,
            theme: state.theme,
            toolbar: state.toolbar,
            widgetStates: Array.from(state.widgetStates.entries())
          }),
          onRehydrateStorage: () => (state) => {
            if (state && state.widgetStates) {
              // Convert array back to Map
              const statesArray = state.widgetStates as any;
              if (Array.isArray(statesArray)) {
                state.widgetStates = new Map(statesArray);
              }
            }
          }
        }
      )
    ),
    {
      name: 'WorkspaceStore'
    }
  )
);

// Selectors
export const selectWidget = (id: string) => (state: WorkspaceStore) => 
  state.widgets.find(w => w.id === id);

export const selectWidgetsByType = (type: WidgetType) => (state: WorkspaceStore) =>
  state.widgets.filter(w => w.type === type);

export const selectActiveWidget = (state: WorkspaceStore) => {
  const maxZIndex = Math.max(...state.widgets.map(w => w.zIndex), -1);
  return state.widgets.find(w => w.zIndex === maxZIndex);
};

export const selectIsConnected = (state: WorkspaceStore) => 
  state.serverStatus.connected;

export const selectTheme = (state: WorkspaceStore) => 
  state.theme;