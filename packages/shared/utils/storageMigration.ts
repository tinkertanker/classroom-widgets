/**
 * Storage Utilities
 *
 * Load/save the V2 storage format and CRUD helpers for the workspaces
 * within it. (Formerly also handled V1-to-V2 migration; that format's
 * support was removed 2026-08 once no v1 population remained.)
 */

import {
  StorageFormatV2,
  isStorageV2,
  createDefaultWorkspace,
  STORAGE_KEY,
  DEFAULT_WORKSPACE_NAME
} from '../types/storage';

// =============================================================================
// Storage Operations
// =============================================================================

/**
 * Load storage data. Returns the current format (V2) or null if no data exists.
 */
export function loadStorage(): StorageFormatV2 | null {
  try {
    const v2Raw = localStorage.getItem(STORAGE_KEY);
    if (v2Raw) {
      const v2Data = JSON.parse(v2Raw);
      if (isStorageV2(v2Data)) {
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

