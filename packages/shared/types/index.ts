// Core type definitions for the teacher app

// Widget System Types
export interface WidgetInstance {
  id: string;
  type: WidgetType;
  position: Position;
  size: Size;
  zIndex: number;
  state?: any; // Will be replaced with generic type
  hidden?: boolean; // Compact dashboard panels hide instead of unloading
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
  HANDOUT = 20,
  FILL_BLANK = 21,
  SORTING = 22,
  SEQUENCING = 23,
  MATCHING = 24,
  CODE_FILL_BLANK = 25
}

// Column layout sizing strategy
export type ColumnSizing = 'aspect-ratio' | 'content' | 'fixed';

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
  /** How the widget is sized in column layout. Defaults to 'fixed'. */
  columnSizing?: ColumnSizing;
  /** Override height for 'fixed' column sizing (defaults to defaultSize.height). */
  columnHeight?: number;
  /** Configuration for widgets that can run in an isolated native compact panel. */
  compactPanel?: {
    supported: boolean;
    preferredSize?: Size;
    minimumSize?: Size;
  };
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

export enum BackgroundType {
  GEOMETRIC = 'geometric',
  GRADIENT = 'gradient',
  LINES = 'lines',
  DOTS = 'dots',
  LOWPOLY = 'lowpoly',
  SEAWAVE = 'seawave'
}

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
}

// Export socket event types
export * from './socket.types';

// Export storage format types (for multi-workspace support)
export * from './storage';

// Export activity types
export * from './activity.types';
