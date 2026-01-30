import { BackgroundType, WidgetType, Widget, Position, Size } from '../shared/types';

export interface BottomBarConfig {
  visibleWidgets: WidgetType[];
  pinnedWidgets: WidgetType[];
  showClock: boolean;
  showConnectionStatus: boolean;
  voiceControlEnabled?: boolean;  // Alpha feature
  recentWidgets?: WidgetType[];  // Recently launched widget types (most recent first)
  recentWidgetsLimit?: number;  // Max number of recent widgets to show (default: 5)
}

export interface ServerStatus {
  connected: boolean;
  url: string;
  error?: string;
}

export interface DragState {
  isDragging: boolean;
  draggedWidgetId: string | null;
  dropTarget: string | null;
}

export interface WorkspaceMetadata {
  id: string;
  name: string;
  widgetCount: number;
  updatedAt: number;
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
  bottomBar: BottomBarConfig;
  serverStatus: ServerStatus;
  widgetStates: Map<string, any>;
  eventListeners: Map<string, Function[]>;
  history: any[];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  focusedWidgetId: string | null;

  // Workspace management state
  currentWorkspaceId: string;
  workspaceList: WorkspaceMetadata[];
  
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
  
  // Bottom bar actions
  updateBottomBar: (updates: Partial<BottomBarConfig>) => void;
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

  // Workspace management
  switchWorkspace: (workspaceId: string) => void;
  createWorkspace: (name?: string) => string;
  deleteWorkspace: (workspaceId: string) => boolean;
  renameWorkspace: (workspaceId: string, newName: string) => void;
  refreshWorkspaceList: () => void;
}