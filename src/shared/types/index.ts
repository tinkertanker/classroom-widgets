// Core type definitions for the teacher app

// Widget System Types
export interface WidgetInstance {
  id: string;
  type: WidgetType;
  position: Position;
  size: Size;
  zIndex: number;
  state?: any; // Will be replaced with generic type
}

// Alias for backwards compatibility
export type Widget = WidgetInstance;

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export enum WidgetType {
  RANDOMISER = 0,
  TIMER = 1,
  LIST = 2,
  TASK_CUE = 3,
  TRAFFIC_LIGHT = 4,
  SOUND_MONITOR = 5,
  LINK_SHORTENER = 6,
  TEXT_BANNER = 7,
  IMAGE_DISPLAY = 8,
  SOUND_EFFECTS = 9,
  STAMP = 10,
  POLL = 11,
  QRCODE = 12,
  LINK_SHARE = 13,
  VISUALISER = 14,
  RT_FEEDBACK = 15,
  TIC_TAC_TOE = 16,
  QUESTIONS = 17,
  WORDLE = 18,
  SNAKE = 19,
  HANDOUT = 20
}

// Widget Configuration
export interface WidgetConfig {
  type: WidgetType;
  name: string;
  icon: React.ComponentType<any>;
  component: React.ComponentType<any>;
  defaultSize: Size;
  minSize?: Size;
  maxSize?: Size;
  maintainAspectRatio?: boolean;
  category?: WidgetCategory;
  features?: WidgetFeatures;
  networked?: NetworkedWidgetConfig;
  description?: string;
}

// Widget Features
export interface WidgetFeatures {
  hasSettings?: boolean;
  hasStateManagement?: boolean;
  requiresApiKey?: boolean;
  hasAudioPlayback?: boolean;
  hasFaceDetection?: boolean;
  isResizable?: boolean;
  canTriggerConfetti?: boolean;
  isTransparent?: boolean;
  hidden?: boolean;
}

// Networked Widget Configuration
export interface NetworkedWidgetConfig {
  roomType: string;
  hasStartStop?: boolean;
  startsActive?: boolean;
  studentComponentName?: string;
}

export enum WidgetCategory {
  INTERACTIVE = 'interactive',
  TEACHING_TOOLS = 'teaching_tools',
  FUN = 'fun',
  NETWORKED = 'networked'
}

// Workspace Types
export interface WorkspaceState {
  widgets: WidgetInstance[];
  background: BackgroundType;
  theme: 'light' | 'dark';
  scale: number;
  scrollPosition: { x: number; y: number };
}

export enum BackgroundType {
  GEOMETRIC = 'geometric',
  GRADIENT = 'gradient',
  LINES = 'lines',
  DOTS = 'dots',
  LOWPOLY = 'lowpoly',
  SEAWAVE = 'seawave'
}

// Bottom Bar Types
export interface BottomBarConfig {
  visibleWidgets: WidgetType[];
  pinnedWidgets: WidgetType[];
  showClock: boolean;
  showConnectionStatus: boolean;
  voiceControlEnabled?: boolean;  // Alpha feature - optional for backwards compatibility
  recentWidgets?: WidgetType[];  // Recently launched widget types (most recent first)
  recentWidgetsLimit?: number;  // Max number of recent widgets to show (default: 5)
}

// Event Types
export interface WidgetEvent {
  type: 'add' | 'remove' | 'update' | 'move' | 'resize';
  widgetId: string;
  data?: any;
}

// Modal Types
export interface ModalConfig {
  title: string;
  content: React.ReactNode;
  className?: string;
  onClose?: () => void;
}

// Server Connection Types
export interface ServerStatus {
  connected: boolean;
  url: string;
  error?: string;
}

// Widget Props Base
export interface BaseWidgetProps {
  widgetId: string;
  savedState?: any;
  onStateChange?: (state: any) => void;
}

// Networked Widget Props
export interface NetworkedWidgetProps extends BaseWidgetProps {
  sessionCode?: string;
  socket?: any; // Will be properly typed later
}

// Widget State Types (examples for specific widgets)
export interface PollState {
  question: string;
  options: string[];
  isActive: boolean;
  results: {
    votes: Record<number, number>;
    totalVotes: number;
    participantCount: number;
  };
}

export interface TimerState {
  duration: number;
  remaining: number;
  isRunning: boolean;
  mode: 'countdown' | 'stopwatch';
}

export interface ListState {
  items: Array<{
    id: string;
    text: string;
    completed: boolean;
  }>;
  title: string;
}

// Generic Widget State Type
export type WidgetState<T = any> = T;

// Drag and Drop Types
export interface DragState {
  isDragging: boolean;
  draggedWidgetId: string | null;
  dropTarget: 'trash' | null;
}

// Persistence Types
export interface SavedWorkspace {
  version: number;
  timestamp: number;
  state: WorkspaceState;
  bottomBar: BottomBarConfig;
}

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
}

// Performance Types
export interface PerformanceMetrics {
  widgetCount: number;
  renderTime: number;
  memoryUsage?: number;
}

// Export socket event types
export * from './socket.types';

// Export storage format types (for multi-workspace support)
export * from './storage';