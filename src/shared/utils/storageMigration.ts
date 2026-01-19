/**
 * Storage Migration Utilities
 *
 * Handles migration between storage format versions.
 * Ensures backward compatibility while transitioning to new formats.
 */

import {
  StorageFormatV1,
  StorageFormatV2,
  WorkspaceData,
  GlobalSettings,
  isStorageV1,
  isStorageV2,
  createDefaultStorageV2,
  createDefaultGlobalSettings,
  createDefaultWorkspace,
  CURRENT_STORAGE_VERSION,
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  V1_DEPRECATION_DATE,
  DEFAULT_WORKSPACE_NAME
} from '../types/storage';
import { BackgroundType, WidgetType } from '../types';

// =============================================================================
// Migration Functions
// =============================================================================

/**
 * Migrate from Version 1 (single workspace) to Version 2 (multi-workspace)
 */
export function migrateV1ToV2(v1Data: StorageFormatV1): StorageFormatV2 {
  const workspaceId = `workspace-${Date.now()}`;
  const now = Date.now();

  // Extract state from v1 format
  const state = v1Data.state || {};

  // Create workspace from v1 state
  const workspace: WorkspaceData = {
    id: workspaceId,
    name: DEFAULT_WORKSPACE_NAME,
    createdAt: now,
    updatedAt: now,
    widgets: Array.isArray(state.widgets) ? state.widgets : [],
    background: state.background || BackgroundType.LOWPOLY,
    scale: typeof state.scale === 'number' ? state.scale : 1,
    scrollPosition: state.scrollPosition || { x: 0, y: 0 },
    widgetStates: Array.isArray(state.widgetStates) ? state.widgetStates : []
  };

  // Extract global settings from v1 state
  const defaultSettings = createDefaultGlobalSettings();
  const globalSettings: GlobalSettings = {
    theme: state.theme || 'light',
    toolbar: {
      ...defaultSettings.toolbar,
      ...(state.toolbar || {}),
      // Ensure arrays are valid
      visibleWidgets: Array.isArray(state.toolbar?.visibleWidgets)
        ? state.toolbar.visibleWidgets
        : defaultSettings.toolbar.visibleWidgets,
      pinnedWidgets: Array.isArray(state.toolbar?.pinnedWidgets)
        ? state.toolbar.pinnedWidgets
        : defaultSettings.toolbar.pinnedWidgets,
      recentWidgets: Array.isArray(state.toolbar?.recentWidgets)
        ? state.toolbar.recentWidgets
        : defaultSettings.toolbar.recentWidgets
    }
  };

  return {
    version: 2,
    migratedFrom: 1,
    migratedAt: now,
    currentWorkspaceId: workspaceId,
    workspaces: {
      [workspaceId]: workspace
    },
    globalSettings,
    session: {
      code: state.sessionCode || null,
      createdAt: state.sessionCreatedAt || null
    }
  };
}

// =============================================================================
// Storage Operations
// =============================================================================

/**
 * Load storage data, automatically migrating from old formats if needed.
 * Returns the current format (V2) or null if no data exists.
 */
export function loadStorage(): StorageFormatV2 | null {
  try {
    // First, try to load V2 format
    const v2Raw = localStorage.getItem(STORAGE_KEY);
    if (v2Raw) {
      const v2Data = JSON.parse(v2Raw);
      if (isStorageV2(v2Data)) {
        return v2Data;
      }
    }

    // Try to load and migrate V1 format (Zustand's format)
    const v1Raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (v1Raw) {
      const v1Data = JSON.parse(v1Raw);
      if (isStorageV1(v1Data)) {
        console.log('[Storage] Migrating from V1 to V2 format...');

        // Migrate to V2
        const v2Data = migrateV1ToV2(v1Data);

        // Save migrated data
        saveStorage(v2Data);

        // Backup old format (for safety during transition)
        localStorage.setItem(`${LEGACY_STORAGE_KEY}-backup`, v1Raw);

        // Show deprecation warning in console
        logDeprecationWarning();

        console.log('[Storage] Migration complete. Data backed up to:', `${LEGACY_STORAGE_KEY}-backup`);

        return v2Data;
      }
    }

    // No existing data found
    return null;
  } catch (error) {
    console.error('[Storage] Error loading storage:', error);
    return null;
  }
}

/**
 * Save storage data in V2 format
 */
export function saveStorage(data: StorageFormatV2): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('[Storage] Error saving storage:', error);
    return false;
  }
}

/**
 * Check if migration from V1 is needed
 */
export function needsMigration(): boolean {
  // Check if V2 already exists
  const v2Exists = localStorage.getItem(STORAGE_KEY) !== null;
  if (v2Exists) return false;

  // Check if V1 exists and needs migration
  const v1Raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (v1Raw) {
    try {
      const v1Data = JSON.parse(v1Raw);
      return isStorageV1(v1Data);
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Get information about the current storage state
 */
export function getStorageInfo(): {
  version: number | null;
  hasData: boolean;
  needsMigration: boolean;
  workspaceCount: number;
  deprecationWarning: string | null;
} {
  const v2Raw = localStorage.getItem(STORAGE_KEY);
  const v1Raw = localStorage.getItem(LEGACY_STORAGE_KEY);

  let version: number | null = null;
  let hasData = false;
  let workspaceCount = 0;
  let deprecationWarning: string | null = null;

  if (v2Raw) {
    try {
      const data = JSON.parse(v2Raw);
      if (isStorageV2(data)) {
        version = 2;
        hasData = true;
        workspaceCount = Object.keys(data.workspaces).length;
      }
    } catch { /* ignore */ }
  } else if (v1Raw) {
    try {
      const data = JSON.parse(v1Raw);
      if (isStorageV1(data)) {
        version = 1;
        hasData = true;
        workspaceCount = 1;
        deprecationWarning = getDeprecationWarning();
      }
    } catch { /* ignore */ }
  }

  return {
    version,
    hasData,
    needsMigration: needsMigration(),
    workspaceCount,
    deprecationWarning
  };
}

// =============================================================================
// Deprecation Handling
// =============================================================================

/**
 * Get deprecation warning message for V1 format
 */
export function getDeprecationWarning(): string {
  const now = new Date();
  const daysUntilRemoval = Math.ceil(
    (V1_DEPRECATION_DATE.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilRemoval <= 0) {
    return 'Warning: Your data is in a deprecated format. Please reload the app to migrate automatically.';
  }

  return `Notice: Your data format will be automatically upgraded. Old format support ends in ${daysUntilRemoval} days.`;
}

/**
 * Log deprecation warning to console
 */
function logDeprecationWarning(): void {
  const warning = getDeprecationWarning();
  console.warn(`[Storage Deprecation] ${warning}`);
  console.warn(`[Storage Deprecation] V1 format support will be removed after ${V1_DEPRECATION_DATE.toDateString()}`);
}

// =============================================================================
// Workspace Management Helpers
// =============================================================================

/**
 * Generate a unique workspace ID
 */
export function generateWorkspaceId(): string {
  return `workspace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Add a new workspace to storage
 */
export function addWorkspace(
  storage: StorageFormatV2,
  name: string = DEFAULT_WORKSPACE_NAME
): { storage: StorageFormatV2; workspaceId: string } {
  const workspaceId = generateWorkspaceId();
  const workspace = createDefaultWorkspace(workspaceId, name);

  return {
    storage: {
      ...storage,
      workspaces: {
        ...storage.workspaces,
        [workspaceId]: workspace
      }
    },
    workspaceId
  };
}

/**
 * Delete a workspace from storage
 */
export function deleteWorkspace(
  storage: StorageFormatV2,
  workspaceId: string
): StorageFormatV2 | null {
  // Can't delete the last workspace
  const workspaceIds = Object.keys(storage.workspaces);
  if (workspaceIds.length <= 1) {
    console.warn('[Storage] Cannot delete the last workspace');
    return null;
  }

  // Remove workspace
  const { [workspaceId]: removed, ...remainingWorkspaces } = storage.workspaces;

  // If deleting current workspace, switch to another
  let newCurrentId = storage.currentWorkspaceId;
  if (storage.currentWorkspaceId === workspaceId) {
    newCurrentId = workspaceIds.find(id => id !== workspaceId) || workspaceIds[0];
  }

  return {
    ...storage,
    currentWorkspaceId: newCurrentId,
    workspaces: remainingWorkspaces
  };
}

/**
 * Rename a workspace
 */
export function renameWorkspace(
  storage: StorageFormatV2,
  workspaceId: string,
  newName: string
): StorageFormatV2 {
  const workspace = storage.workspaces[workspaceId];
  if (!workspace) return storage;

  return {
    ...storage,
    workspaces: {
      ...storage.workspaces,
      [workspaceId]: {
        ...workspace,
        name: newName,
        updatedAt: Date.now()
      }
    }
  };
}

/**
 * Switch to a different workspace
 */
export function switchWorkspace(
  storage: StorageFormatV2,
  workspaceId: string
): StorageFormatV2 {
  if (!storage.workspaces[workspaceId]) {
    console.warn('[Storage] Workspace not found:', workspaceId);
    return storage;
  }

  return {
    ...storage,
    currentWorkspaceId: workspaceId
  };
}

/**
 * Duplicate a workspace
 */
export function duplicateWorkspace(
  storage: StorageFormatV2,
  sourceWorkspaceId: string,
  newName?: string
): { storage: StorageFormatV2; workspaceId: string } | null {
  const sourceWorkspace = storage.workspaces[sourceWorkspaceId];
  if (!sourceWorkspace) {
    console.warn('[Storage] Source workspace not found:', sourceWorkspaceId);
    return null;
  }

  const newWorkspaceId = generateWorkspaceId();
  const duplicatedWorkspace: WorkspaceData = {
    ...sourceWorkspace,
    id: newWorkspaceId,
    name: newName || `${sourceWorkspace.name} (Copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    // Deep copy widgets to avoid reference issues
    widgets: JSON.parse(JSON.stringify(sourceWorkspace.widgets)),
    widgetStates: JSON.parse(JSON.stringify(sourceWorkspace.widgetStates))
  };

  return {
    storage: {
      ...storage,
      workspaces: {
        ...storage.workspaces,
        [newWorkspaceId]: duplicatedWorkspace
      }
    },
    workspaceId: newWorkspaceId
  };
}
