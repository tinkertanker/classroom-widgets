import { BackgroundType, WidgetType, Widget, Position, Size } from '../shared/types';

export interface ToolbarConfig {
  visibleWidgets: WidgetType[];
  pinnedWidgets: WidgetType[];
  showClock: boolean;
  showConnectionStatus: boolean;
}

export interface ServerStatus {
  connected: boolean;
  url: string;
}

export interface DragState {
  isDragging: boolean;
  draggedWidgetId: string | null;
  dropTarget: string | null;
}

export interface WorkspaceStore {
  // State
  widgets: Widget[];
  background: BackgroundType;
  theme: 'light' | 'dark';
  scale: number;
  scrollPosition: Position;
  sessionCode: string | null;
  sessionCreatedAt: number | null;
  dragState: DragState;
  toolbar: ToolbarConfig;
  serverStatus: ServerStatus;
  widgetStates: Map<string, any>;
  eventListeners: Map<string, Function[]>;
  history: any[];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  focusedWidgetId: string | null;
  
  // Actions
  setSessionCode: (code: string | null) => void;
  closeSession: () => void;
  setBackground: (background: BackgroundType) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setScale: (scale: number) => void;
  setScrollPosition: (position: Position) => void;
  setServerStatus: (status: Partial<ServerStatus>) => void;
  
  // Widget actions
  addWidget: (type: WidgetType, position?: Position) => string;
  removeWidget: (widgetId: string) => void;
  updateWidget: (widgetId: string, updates: Partial<Widget>) => void;
  moveWidget: (widgetId: string, position: Position) => void;
  resizeWidget: (widgetId: string, size: Size) => void;
  bringToFront: (widgetId: string) => void;
  setFocusedWidget: (widgetId: string | null) => void;
  resetWorkspace: () => void;
  
  // Toolbar actions
  updateToolbar: (updates: Partial<ToolbarConfig>) => void;
  toggleWidgetVisibility: (widgetType: WidgetType) => void;
  pinWidget: (widgetType: WidgetType) => void;
  unpinWidget: (widgetType: WidgetType) => void;
  
  // Drag actions
  startDragging: (widgetId: string) => void;
  stopDragging: () => void;
  setDropTarget: (target: string | null) => void;
  
  // Widget state management
  updateWidgetState: (widgetId: string, state: any) => void;
  setWidgetState: (widgetId: string, state: any) => void;
  
  // Event management
  emitEvent: (event: string, data?: any) => void;
  addEventListener: (event: string, listener: Function) => void;
  removeEventListener: (event: string, listener: Function) => void;
  
  // History management
  saveSnapshot: () => void;
  undo: () => void;
  redo: () => void;
}