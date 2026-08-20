/**
 * Storage Format Definitions
 *
 * This file defines the storage format for persisting workspace data.
 *
 * VERSION HISTORY:
 * - Version 1: Single workspace format (removed 2026-08; no v1 population remained)
 * - Version 2: Multi-workspace format with named workspaces
 */

import { BackgroundType, WidgetType } from './index';

export type LayoutFormat = 'canvas' | 'column';

// =============================================================================
// SAVED COLLECTIONS - Persistent storage for reusable content
// =============================================================================

/**
 * Base interface for saved items
 */
export interface SavedItem {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Saved randomiser list
 */
export interface SavedRandomiserList extends SavedItem {
  type: 'randomiser';
  choices: string[];
}

/**
 * Saved question bank (for Questions widget - student submissions)
 */
export interface SavedQuestionBank extends SavedItem {
  type: 'questions';
  questions: Array<{ text: string; studentName?: string }>;
}

/**
 * Saved poll question (for Poll widget - teacher-created polls)
 */
export interface SavedPollQuestion extends SavedItem {
  type: 'poll';
  question: string;
  options: string[];
}

/**
 * Collection of all saved items
 */
export interface SavedCollections {
  randomiserLists: Record<string, SavedRandomiserList>;
  questionBanks: Record<string, SavedQuestionBank>;
  pollQuestions: Record<string, SavedPollQuestion>;
}

// =============================================================================
// CURRENT FORMAT (Version 2) - Multi-workspace support
// =============================================================================

export const CURRENT_STORAGE_VERSION = 2;
export const STORAGE_KEY = 'classroom-widgets-storage-v2';
export const LEGACY_STORAGE_KEY = 'workspace-storage';  // Zustand's old key

/**
 * Individual workspace data
 */
export interface WorkspaceData {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;

  // Workspace-specific state
  widgets: StoredWidget[];
  background: BackgroundType;
  scale: number;
  scrollPosition: { x: number; y: number };
  widgetStates: Array<[string, any]>;  // Serialized Map entries
  layoutFormat?: LayoutFormat;
}

/**
 * Widget as stored in persistence (minimal data)
 */
export interface StoredWidget {
  id: string;
  type: WidgetType;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
}

/**
 * Bottom bar configuration (global across workspaces)
 */
export interface StoredBottomBarConfig {
  visibleWidgets: WidgetType[];
  pinnedWidgets: WidgetType[];
  showClock: boolean;
  showConnectionStatus: boolean;
  voiceControlEnabled?: boolean;
  recentWidgets?: WidgetType[];
  recentWidgetsLimit?: number;
}

/**
 * Global settings shared across all workspaces
 */
export interface GlobalSettings {
  theme: 'light' | 'dark';
  bottomBar: StoredBottomBarConfig;
  /** Class end time shown by the toolbar clock (epoch ms), null when unset */
  classEndTime?: number | null;
}

/**
 * Root storage format (Version 2)
 */
export interface StorageFormatV2 {
  version: 2;
  migratedFrom?: number;  // Previous version if migrated
  migratedAt?: number;    // Timestamp of migration

  // Active workspace
  currentWorkspaceId: string;

  // All workspaces indexed by ID
  workspaces: Record<string, WorkspaceData>;

  // Settings that apply globally
  globalSettings: GlobalSettings;

  // Session data (transient, but persisted for page refresh)
  session: {
    code: string | null;
    createdAt: number | null;
  };

  // Saved collections for reusable content
  savedCollections: SavedCollections;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if storage data is Version 2 format
 */
export function isStorageV2(data: unknown): data is StorageFormatV2 {
  return (
    typeof data === 'object' &&
    data !== null &&
    'version' in data &&
    (data as any).version === 2 &&
    'workspaces' in data &&
    'currentWorkspaceId' in data
  );
}

// =============================================================================
// Default Values
// =============================================================================

export const DEFAULT_WORKSPACE_NAME = 'My Workspace';

export function createDefaultWorkspace(id: string, name: string = DEFAULT_WORKSPACE_NAME): WorkspaceData {
  return {
    id,
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    widgets: [],
    background: BackgroundType.LOWPOLY,
    scale: 1,
    scrollPosition: { x: 0, y: 0 },
    widgetStates: [],
    layoutFormat: 'canvas'
  };
}

export function createDefaultGlobalSettings(): GlobalSettings {
  return {
    theme: 'light',
    bottomBar: {
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
      showConnectionStatus: true,
      voiceControlEnabled: false,
      recentWidgets: [
        WidgetType.RANDOMISER,
        WidgetType.TIMER,
        WidgetType.LIST,
        WidgetType.TASK_CUE,
        WidgetType.TRAFFIC_LIGHT
      ],
      recentWidgetsLimit: 5
    }
  };
}

export function createDefaultSavedCollections(): SavedCollections {
  return {
    randomiserLists: {},
    questionBanks: {},
    pollQuestions: {}
  };
}

export function createDefaultStorageV2(): StorageFormatV2 {
  const defaultWorkspaceId = `workspace-${Date.now()}`;
  return {
    version: 2,
    currentWorkspaceId: defaultWorkspaceId,
    workspaces: {
      [defaultWorkspaceId]: createDefaultWorkspace(defaultWorkspaceId)
    },
    globalSettings: createDefaultGlobalSettings(),
    session: {
      code: null,
      createdAt: null
    },
    savedCollections: createDefaultSavedCollections()
  };
}
