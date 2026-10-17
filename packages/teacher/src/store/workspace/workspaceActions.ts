import type { StoreApi } from 'zustand';
import { LayoutFormat, WorkspaceData } from '@shared/types/storage';
import {
  saveStorage,
  addWorkspace as addWorkspaceToStorage,
  deleteWorkspace as deleteWorkspaceFromStorage,
  renameWorkspace as renameWorkspaceInStorage,
  switchWorkspace as switchWorkspaceInStorage
} from '@shared/utils/storageMigration';
import type { WorkspaceMetadata, WorkspaceStore } from '../workspaceStore';
import { useWorkspaceUiStore } from '../workspaceUiStore';
import { loadStorageSynced } from './workspacePersistence';

type StoreSet = StoreApi<WorkspaceStore>['setState'];
type StoreGet = StoreApi<WorkspaceStore>['getState'];

// =============================================================================
// Workspace Management Helpers
// =============================================================================

/**
 * Get workspace metadata list from V2 storage
 */
export function getWorkspaceListFromStorage(): { currentId: string; list: WorkspaceMetadata[] } {
  const v2Data = loadStorageSynced();
  if (!v2Data) {
    return { currentId: '', list: [] };
  }

  const list: WorkspaceMetadata[] = Object.values(v2Data.workspaces)
    .map(ws => ({
      id: ws.id,
      name: ws.name,
      widgetCount: ws.widgets.length,
      updatedAt: ws.updatedAt
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return { currentId: v2Data.currentWorkspaceId, list };
}

/**
 * Count existing workspaces with default naming pattern to generate next name
 */
function getNextWorkspaceName(): string {
  const v2Data = loadStorageSynced();
  if (!v2Data) return 'Workspace 1';

  const workspaceCount = Object.keys(v2Data.workspaces).length;
  return `Workspace ${workspaceCount + 1}`;
}

/**
 * Build the state patch that loads a workspace's saved data into the store.
 *
 * Only per-workspace fields belong here. `theme`, `bottomBar` and `classEndTime`
 * live in `globalSettings` and must survive a workspace switch unchanged, so
 * they are deliberately absent.
 */
function applyWorkspaceSnapshot(
  workspace: WorkspaceData,
  workspaceId: string,
  workspaceList: WorkspaceMetadata[]
): Pick<
  WorkspaceStore,
  | 'currentWorkspaceId'
  | 'workspaceList'
  | 'widgets'
  | 'background'
  | 'scale'
  | 'scrollPosition'
  | 'layoutFormat'
  | 'widgetStates'
> {
  return {
    currentWorkspaceId: workspaceId,
    workspaceList,
    widgets: workspace.widgets,
    background: workspace.background,
    scale: workspace.scale,
    scrollPosition: workspace.scrollPosition,
    layoutFormat: (workspace.layoutFormat || 'canvas') as LayoutFormat,
    widgetStates: new Map(workspace.widgetStates)
  };
}

// =============================================================================
// Workspace management actions
// =============================================================================

export const createWorkspaceActions = (set: StoreSet, get: StoreGet): Pick<
  WorkspaceStore,
  'refreshWorkspaceList' | 'switchWorkspace' | 'createWorkspace' | 'deleteWorkspace' | 'renameWorkspace'
> => ({
  refreshWorkspaceList: () => {
    const { currentId, list } = getWorkspaceListFromStorage();
    set({ currentWorkspaceId: currentId, workspaceList: list });
  },

  switchWorkspace: (workspaceId: string) => {
    const v2Data = loadStorageSynced();
    if (!v2Data || !v2Data.workspaces[workspaceId]) {
      console.warn('[WorkspaceStore] Cannot switch: workspace not found:', workspaceId);
      return;
    }

    // Update storage to point to new workspace
    const updatedStorage = switchWorkspaceInStorage(v2Data, workspaceId);
    saveStorage(updatedStorage);

    // Load the new workspace's data into the store
    const workspace = updatedStorage.workspaces[workspaceId];
    const { list } = getWorkspaceListFromStorage();

    set(applyWorkspaceSnapshot(workspace, workspaceId, list));
    useWorkspaceUiStore.getState().setFocusedWidget(null);
  },

  createWorkspace: (name?: string) => {
    const v2Data = loadStorageSynced();
    if (!v2Data) {
      console.warn('[WorkspaceStore] Cannot create workspace: no storage found');
      return '';
    }

    const workspaceName = name || getNextWorkspaceName();
    const { storage: updatedStorage, workspaceId } = addWorkspaceToStorage(v2Data, workspaceName);

    // Switch to the new workspace
    const finalStorage = switchWorkspaceInStorage(updatedStorage, workspaceId);
    saveStorage(finalStorage);

    // Load the new workspace (empty) into the store
    const workspace = finalStorage.workspaces[workspaceId];
    const { list } = getWorkspaceListFromStorage();

    set(applyWorkspaceSnapshot(workspace, workspaceId, list));
    useWorkspaceUiStore.getState().setFocusedWidget(null);

    return workspaceId;
  },

  deleteWorkspace: (workspaceId: string) => {
    const v2Data = loadStorageSynced();
    if (!v2Data) {
      console.warn('[WorkspaceStore] Cannot delete workspace: no storage found');
      return false;
    }

    const updatedStorage = deleteWorkspaceFromStorage(v2Data, workspaceId);
    if (!updatedStorage) {
      // Cannot delete the last workspace
      return false;
    }

    saveStorage(updatedStorage);

    // If we deleted the current workspace, we've been switched to another
    const currentWorkspace = updatedStorage.workspaces[updatedStorage.currentWorkspaceId];
    const { list } = getWorkspaceListFromStorage();

    // Only update state if we deleted the current workspace
    if (workspaceId === get().currentWorkspaceId) {
      set(applyWorkspaceSnapshot(
        currentWorkspace,
        updatedStorage.currentWorkspaceId,
        list
      ));
      useWorkspaceUiStore.getState().setFocusedWidget(null);
    } else {
      set({ workspaceList: list });
    }

    return true;
  },

  renameWorkspace: (workspaceId: string, newName: string) => {
    const v2Data = loadStorageSynced();
    if (!v2Data) {
      console.warn('[WorkspaceStore] Cannot rename workspace: no storage found');
      return;
    }

    const trimmedName = newName.trim().slice(0, 50); // Max 50 chars
    if (!trimmedName) return;

    const updatedStorage = renameWorkspaceInStorage(v2Data, workspaceId, trimmedName);
    saveStorage(updatedStorage);

    // Update workspace list
    const { list } = getWorkspaceListFromStorage();
    set({ workspaceList: list });
  }
});
