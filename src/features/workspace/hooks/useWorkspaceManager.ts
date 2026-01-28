import { useCallback, useMemo } from 'react';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';
import { WorkspaceMetadata } from '../../../store/workspaceStore';

export function useWorkspaceManager() {
  // Selectors
  const currentWorkspaceId = useWorkspaceStore(state => state.currentWorkspaceId);
  const workspaceList = useWorkspaceStore(state => state.workspaceList);

  // Actions from store
  const storeSwitchWorkspace = useWorkspaceStore(state => state.switchWorkspace);
  const storeCreateWorkspace = useWorkspaceStore(state => state.createWorkspace);
  const storeDeleteWorkspace = useWorkspaceStore(state => state.deleteWorkspace);
  const storeRenameWorkspace = useWorkspaceStore(state => state.renameWorkspace);
  const storeRefreshWorkspaceList = useWorkspaceStore(state => state.refreshWorkspaceList);

  // Memoized callbacks
  const switchWorkspace = useCallback((workspaceId: string) => {
    storeSwitchWorkspace(workspaceId);
  }, [storeSwitchWorkspace]);

  const createWorkspace = useCallback((name?: string) => {
    return storeCreateWorkspace(name);
  }, [storeCreateWorkspace]);

  const deleteWorkspace = useCallback((workspaceId: string) => {
    return storeDeleteWorkspace(workspaceId);
  }, [storeDeleteWorkspace]);

  const renameWorkspace = useCallback((workspaceId: string, newName: string) => {
    storeRenameWorkspace(workspaceId, newName);
  }, [storeRenameWorkspace]);

  const refreshWorkspaceList = useCallback(() => {
    storeRefreshWorkspaceList();
  }, [storeRefreshWorkspaceList]);

  // Computed values
  const currentWorkspace = useMemo(() => {
    return workspaceList.find(ws => ws.id === currentWorkspaceId);
  }, [workspaceList, currentWorkspaceId]);

  const canDeleteWorkspace = useMemo(() => {
    return workspaceList.length > 1;
  }, [workspaceList]);

  return {
    currentWorkspaceId,
    currentWorkspace,
    workspaceList,
    canDeleteWorkspace,
    switchWorkspace,
    createWorkspace,
    deleteWorkspace,
    renameWorkspace,
    refreshWorkspaceList
  };
}
