/**
 * Storage Format Definitions
 *
 * This file defines the versioned storage formats for persisting workspace data.
 *
 * VERSION HISTORY:
 * - Version 1: Single workspace format (deprecated, remove support after April 2026)
 * - Version 2: Multi-workspace format with named workspaces
 *
 * MIGRATION: The app automatically migrates from v1 to v2 on load.
 * Old format data is preserved in a backup key for safety.
 */

import { BackgroundType, WidgetType } from './index';

// =============================================================================
// CURRENT FORMAT (Version 2) - Multi-workspace support
// =============================================================================

export const CURRENT_STORAGE_VERSION = 2;
export const STORAGE_KEY = 'classroom-widgets-storage-v2';
export const LEGACY_STORAGE_KEY = 'workspace-storage';  // Zustand's old key

/**
 * Deprecation date for Version 1 format.
 * After this date, v1 migration support may be removed.
 */
export const V1_DEPRECATION_DATE = new Date('2026-04-19');

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
 * Toolbar configuration (global across workspaces)
 */
export interface StoredToolbarConfig {
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
  toolbar: StoredToolbarConfig;
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
}

// =============================================================================
// LEGACY FORMAT (Version 1) - Single workspace (DEPRECATED)
// =============================================================================

/**
 * @deprecated This format is deprecated and will stop being supported after April 2026.
 * Use StorageFormatV2 instead.
 *
 * This is the format used by Zustand persist middleware.
 */
export interface StorageFormatV1 {
  state: {
    widgets: StoredWidget[];
    background: BackgroundType;
    theme: 'light' | 'dark';
    scale: number;
    scrollPosition: { x: number; y: number };
    toolbar: StoredToolbarConfig;
    widgetStates: Array<[string, any]>;
    sessionCode: string | null;
    sessionCreatedAt: number | null;
  };
  version?: number;  // Zustand's internal version (usually 0)
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

/**
 * Check if storage data is Version 1 (legacy Zustand) format
 */
export function isStorageV1(data: unknown): data is StorageFormatV1 {
  return (
    typeof data === 'object' &&
    data !== null &&
    'state' in data &&
    typeof (data as any).state === 'object' &&
    !('workspaces' in data)
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
    widgetStates: []
  };
}

export function createDefaultGlobalSettings(): GlobalSettings {
  return {
    theme: 'light',
    toolbar: {
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
    }
  };
}
