// Simplified store for testing
import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { BackgroundType, WidgetType } from '../shared/types';
import { WorkspaceStore } from './workspaceStore';
import { widgetRegistry } from '../services/WidgetRegistry';
import { debug } from '../shared/utils/debug';
import {
  StorageFormatV2,
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  CURRENT_STORAGE_VERSION,
  isStorageV1,
  isStorageV2,
  createDefaultStorageV2,
  createDefaultWorkspace,
  createDefaultSavedCollections,
  V1_DEPRECATION_DATE,
  SavedCollections,
  SavedRandomiserList,
  SavedQuestionBank,
  SavedPollQuestion
} from '../shared/types/storage';
import {
  migrateV1ToV2,
  loadStorage,
  saveStorage,
  addWorkspace as addWorkspaceToStorage,
  deleteWorkspace as deleteWorkspaceFromStorage,
  renameWorkspace as renameWorkspaceInStorage,
  switchWorkspace as switchWorkspaceInStorage,
  generateWorkspaceId
} from '../shared/utils/storageMigration';
import { WorkspaceMetadata } from './workspaceStore';

// Default recent widgets shown in toolbar (most recent first)
const defaultRecentWidgets = [
  WidgetType.RANDOMISER,
  WidgetType.TIMER,
  WidgetType.LIST,
  WidgetType.TASK_CUE,
  WidgetType.TRAFFIC_LIGHT
];

// =============================================================================
// Workspace Management Helpers
// =============================================================================

/**
 * Get workspace metadata list from V2 storage
 */
function getWorkspaceListFromStorage(): { currentId: string; list: WorkspaceMetadata[] } {
  const v2Data = loadStorage();
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
  const v2Data = loadStorage();
  if (!v2Data) return 'Workspace 1';

  const workspaceCount = Object.keys(v2Data.workspaces).length;
  return `Workspace ${workspaceCount + 1}`;
}

const defaultBottomBar = {
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
  voiceControlEnabled: false,  // Alpha feature - default OFF
  recentWidgets: defaultRecentWidgets,  // Track recently launched widgets
  recentWidgetsLimit: 5  // Number of recent widgets to show in toolbar
};

// =============================================================================
// Custom Storage Adapter for V2 Format
// =============================================================================

/**
 * Custom storage adapter that handles the multi-workspace V2 format.
 * Automatically migrates from V1 format if needed.
 *
 * Storage Format Versions:
 * - V1 (deprecated): Single workspace, Zustand default format
 * - V2 (current): Multi-workspace support with named workspaces
 *
 * @deprecated V1 format support will be removed after April 2026
 */
const workspaceStorage: StateStorage = {
  getItem: (name: string): string | null => {
    try {
      // First, try to load V2 format
      const v2Raw = localStorage.getItem(STORAGE_KEY);
      if (v2Raw) {
        const v2Data = JSON.parse(v2Raw) as StorageFormatV2;
        if (isStorageV2(v2Data)) {
          // Convert V2 format back to Zustand's expected format
          const currentWorkspace = v2Data.workspaces[v2Data.currentWorkspaceId];
          if (currentWorkspace) {
            return JSON.stringify({
              state: {
                widgets: currentWorkspace.widgets,
                background: currentWorkspace.background,
                scale: currentWorkspace.scale,
                scrollPosition: currentWorkspace.scrollPosition,
                widgetStates: currentWorkspace.widgetStates,
                theme: v2Data.globalSettings.theme,
                bottomBar: (v2Data.globalSettings as any).bottomBar || (v2Data.globalSettings as any).toolbar,
                sessionCode: v2Data.session.code,
                sessionCreatedAt: v2Data.session.createdAt
              },
              version: 0  // Zustand's internal version
            });
          }
        }
      }

      // Try to load and migrate V1 format (deprecated)
      const v1Raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (v1Raw) {
        const v1Data = JSON.parse(v1Raw);
        if (isStorageV1(v1Data)) {
          console.warn(
            `[Storage] Migrating from deprecated V1 format. ` +
            `V1 support will be removed after ${V1_DEPRECATION_DATE.toDateString()}.`
          );

          // Migrate to V2
          const v2Data = migrateV1ToV2(v1Data);

          // Save in new format
          localStorage.setItem(STORAGE_KEY, JSON.stringify(v2Data));

          // Backup old format
          localStorage.setItem(`${LEGACY_STORAGE_KEY}-backup-${Date.now()}`, v1Raw);

          // Return in Zustand format (will be processed normally)
          return v1Raw;
        }
      }

      return null;
    } catch (error) {
      console.error('[Storage] Error reading storage:', error);
      return null;
    }
  },

  setItem: (name: string, value: string): void => {
    try {
      const zustandData = JSON.parse(value);
      const state = zustandData.state;

      // Load existing V2 data or create new
      let v2Data: StorageFormatV2;
      const existingRaw = localStorage.getItem(STORAGE_KEY);

      if (existingRaw) {
        const existing = JSON.parse(existingRaw);
        if (isStorageV2(existing)) {
          v2Data = existing;
        } else {
          v2Data = createDefaultStorageV2();
        }
      } else {
        v2Data = createDefaultStorageV2();
      }

      // Update current workspace with new state
      const currentWorkspaceId = v2Data.currentWorkspaceId;
      const currentWorkspace = v2Data.workspaces[currentWorkspaceId] ||
        createDefaultWorkspace(currentWorkspaceId);

      v2Data.workspaces[currentWorkspaceId] = {
        ...currentWorkspace,
        updatedAt: Date.now(),
        widgets: state.widgets || [],
        background: state.background || BackgroundType.LOWPOLY,
        scale: state.scale ?? 1,
        scrollPosition: state.scrollPosition || { x: 0, y: 0 },
        widgetStates: state.widgetStates || []
      };

      // Update global settings
      v2Data.globalSettings = {
        theme: state.theme || 'light',
        bottomBar: state.bottomBar || defaultBottomBar
      };

      // Update session
      v2Data.session = {
        code: state.sessionCode || null,
        createdAt: state.sessionCreatedAt || null
      };

      // Save V2 format
      localStorage.setItem(STORAGE_KEY, JSON.stringify(v2Data));

      // Also save in legacy format for backward compatibility during transition
      // This can be removed after V1 deprecation date
      localStorage.setItem(LEGACY_STORAGE_KEY, value);

    } catch (error) {
      console.error('[Storage] Error writing storage:', error);
      // Fallback: save directly to legacy key
      localStorage.setItem(LEGACY_STORAGE_KEY, value);
    }
  },

  removeItem: (name: string): void => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
};

// =============================================================================
// Store Creation
// =============================================================================

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => ({
  // Initial State
  widgets: [],
  background: BackgroundType.LOWPOLY,
  theme: 'light',
  scale: 1,
  scrollPosition: { x: 0, y: 0 },
  sessionCode: null,
  sessionCreatedAt: null,
  dragState: {
    isDragging: false,
    draggedWidgetId: null,
    dropTarget: null
  },
  bottomBar: defaultBottomBar,
  serverStatus: {
    connected: false,
    url: import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
  },
  widgetStates: new Map(),
  eventListeners: new Map(),
  history: [],
  historyIndex: -1,
  canUndo: false,
  canRedo: false,
  focusedWidgetId: null,
  classEndTime: null,

  // Workspace management state (populated on rehydration)
  currentWorkspaceId: '',
  workspaceList: [],

  // Saved collections state (populated on rehydration)
  savedCollections: createDefaultSavedCollections(),

  // Simple action implementations
  setSessionCode: (code) => set({ 
    sessionCode: code,
    sessionCreatedAt: code ? Date.now() : null 
  }),
  closeSession: () => set({ 
    sessionCode: null,
    sessionCreatedAt: null 
  }),
  setBackground: (background) => set({ background }),
  setTheme: (theme) => set({ theme }),
  setScale: (scale) => set({ scale }),
  setScrollPosition: (position) => set({ scrollPosition: position }),
  setServerStatus: (status) => set((state) => ({ 
    serverStatus: { ...state.serverStatus, ...status } 
  })),
  
  // Widget methods
  addWidget: (type, position) => {
    // Generate unique ID using timestamp + random string to avoid collisions
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const config = widgetRegistry.get(type);
    const newWidget = {
      id,
      type,
      position: position || { x: 100 + get().widgets.length * 20, y: 100 + get().widgets.length * 20 },
      size: config?.defaultSize || { width: 350, height: 350 },
      zIndex: get().widgets.length
    };

    // Update recent widgets: move this type to the front, remove duplicates, limit to N
    const currentRecent = get().bottomBar.recentWidgets || [];
    const limit = get().bottomBar.recentWidgetsLimit || 5;
    const updatedRecent = [
      type,
      ...currentRecent.filter(t => t !== type)
    ].slice(0, limit);

    set((state) => ({
      widgets: [...state.widgets, newWidget],
      bottomBar: { ...state.bottomBar, recentWidgets: updatedRecent }
    }));
    return id;
  },
  removeWidget: (widgetId) => {
    debug('[WorkspaceStore] removeWidget called for widget:', widgetId);
    set((state) => ({ 
      widgets: state.widgets.filter(w => w.id !== widgetId) 
    }));
  },
  updateWidget: (widgetId, updates) => {
    set((state) => ({
      widgets: state.widgets.map(w => 
        w.id === widgetId ? { ...w, ...updates } : w
      )
    }));
  },
  moveWidget: (widgetId, position) => {
    set((state) => ({
      widgets: state.widgets.map(w => 
        w.id === widgetId ? { ...w, position } : w
      )
    }));
  },
  resizeWidget: (widgetId, size) => {
    set((state) => ({
      widgets: state.widgets.map(w => 
        w.id === widgetId ? { ...w, size } : w
      )
    }));
  },
  bringToFront: (widgetId) => {
    set((state) => {
      const widgets = [...state.widgets];
      const widgetIndex = widgets.findIndex(w => w.id === widgetId);
      if (widgetIndex !== -1) {
        const widget = widgets[widgetIndex];
        widgets.splice(widgetIndex, 1);
        widgets.push(widget);
        widgets.forEach((w, i) => { w.zIndex = i; });
      }
      return { widgets, focusedWidgetId: widgetId };
    });
  },
  setFocusedWidget: (widgetId) => {
    set({ focusedWidgetId: widgetId });
  },
  setClassEndTime: (time) => {
    set({ classEndTime: time });
  },
  resetWorkspace: () => {
    set({
      widgets: [],
      background: BackgroundType.LOWPOLY,
      theme: 'light',
      scale: 1,
      scrollPosition: { x: 0, y: 0 }
    });
  },
  updateBottomBar: (updates) => {
    set((state) => ({
      bottomBar: { ...state.bottomBar, ...updates }
    }));
  },
  toggleWidgetVisibility: () => {},
  pinWidget: () => {},
  unpinWidget: () => {},
  startDragging: (widgetId) => {
    set((state) => ({
      dragState: { ...state.dragState, isDragging: true, draggedWidgetId: widgetId }
    }));
  },
  stopDragging: () => {
    set((state) => ({
      dragState: { ...state.dragState, isDragging: false, draggedWidgetId: null, dropTarget: null }
    }));
  },
  setDropTarget: (target) => {
    set((state) => ({
      dragState: { ...state.dragState, dropTarget: target }
    }));
  },
  updateWidgetState: (widgetId, state) => {
    set((store) => {
      const newStates = new Map(store.widgetStates);
      newStates.set(widgetId, state);
      return { widgetStates: newStates };
    });
  },
  setWidgetState: (widgetId, state) => {
    set((store) => {
      const newStates = new Map(store.widgetStates);
      newStates.set(widgetId, state);
      return { widgetStates: newStates };
    });
  },
  emitEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  saveSnapshot: () => {},
  undo: () => {},
  redo: () => {},

  // Workspace management actions
  refreshWorkspaceList: () => {
    const { currentId, list } = getWorkspaceListFromStorage();
    set({ currentWorkspaceId: currentId, workspaceList: list });
  },

  switchWorkspace: (workspaceId: string) => {
    const v2Data = loadStorage();
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

    set({
      currentWorkspaceId: workspaceId,
      workspaceList: list,
      widgets: workspace.widgets,
      background: workspace.background,
      scale: workspace.scale,
      scrollPosition: workspace.scrollPosition,
      widgetStates: new Map(workspace.widgetStates),
      focusedWidgetId: null
    });
  },

  createWorkspace: (name?: string) => {
    const v2Data = loadStorage();
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

    set({
      currentWorkspaceId: workspaceId,
      workspaceList: list,
      widgets: workspace.widgets,
      background: workspace.background,
      scale: workspace.scale,
      scrollPosition: workspace.scrollPosition,
      widgetStates: new Map(workspace.widgetStates),
      focusedWidgetId: null
    });

    return workspaceId;
  },

  deleteWorkspace: (workspaceId: string) => {
    const v2Data = loadStorage();
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
      set({
        currentWorkspaceId: updatedStorage.currentWorkspaceId,
        workspaceList: list,
        widgets: currentWorkspace.widgets,
        background: currentWorkspace.background,
        scale: currentWorkspace.scale,
        scrollPosition: currentWorkspace.scrollPosition,
        widgetStates: new Map(currentWorkspace.widgetStates),
        focusedWidgetId: null
      });
    } else {
      set({ workspaceList: list });
    }

    return true;
  },

  renameWorkspace: (workspaceId: string, newName: string) => {
    const v2Data = loadStorage();
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
  },

  // =============================================================================
  // Saved Collections Management
  // =============================================================================

  saveRandomiserList: (name: string, choices: string[]): string => {
    const v2Data = loadStorage();
    if (!v2Data) {
      console.warn('[WorkspaceStore] Cannot save randomiser list: no storage found');
      return '';
    }

    // Ensure savedCollections exists
    if (!v2Data.savedCollections) {
      v2Data.savedCollections = createDefaultSavedCollections();
    }

    const id = `randomiser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    const savedList: SavedRandomiserList = {
      id,
      name: name.trim().slice(0, 100),
      type: 'randomiser',
      choices,
      createdAt: now,
      updatedAt: now
    };

    v2Data.savedCollections.randomiserLists[id] = savedList;
    saveStorage(v2Data);

    // Update state
    set({ savedCollections: { ...v2Data.savedCollections } });

    return id;
  },

  getRandomiserLists: (): SavedRandomiserList[] => {
    const collections = get().savedCollections;
    return Object.values(collections.randomiserLists).sort((a, b) => b.updatedAt - a.updatedAt);
  },

  deleteRandomiserList: (id: string) => {
    const v2Data = loadStorage();
    if (!v2Data || !v2Data.savedCollections) {
      return;
    }

    delete v2Data.savedCollections.randomiserLists[id];
    saveStorage(v2Data);

    // Update state
    set({ savedCollections: { ...v2Data.savedCollections } });
  },

  saveQuestionBank: (name: string, questions: Array<{ text: string; studentName?: string }>): string => {
    const v2Data = loadStorage();
    if (!v2Data) {
      console.warn('[WorkspaceStore] Cannot save question bank: no storage found');
      return '';
    }

    // Ensure savedCollections exists
    if (!v2Data.savedCollections) {
      v2Data.savedCollections = createDefaultSavedCollections();
    }

    const id = `questions-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    const savedBank: SavedQuestionBank = {
      id,
      name: name.trim().slice(0, 100),
      type: 'questions',
      questions,
      createdAt: now,
      updatedAt: now
    };

    v2Data.savedCollections.questionBanks[id] = savedBank;
    saveStorage(v2Data);

    // Update state
    set({ savedCollections: { ...v2Data.savedCollections } });

    return id;
  },

  getQuestionBanks: (): SavedQuestionBank[] => {
    const collections = get().savedCollections;
    return Object.values(collections.questionBanks).sort((a, b) => b.updatedAt - a.updatedAt);
  },

  deleteQuestionBank: (id: string) => {
    const v2Data = loadStorage();
    if (!v2Data || !v2Data.savedCollections) {
      return;
    }

    delete v2Data.savedCollections.questionBanks[id];
    saveStorage(v2Data);

    // Update state
    set({ savedCollections: { ...v2Data.savedCollections } });
  },

  savePollQuestion: (name: string, question: string, options: string[]): string => {
    const v2Data = loadStorage();
    if (!v2Data) {
      console.warn('[WorkspaceStore] Cannot save poll question: no storage found');
      return '';
    }

    // Ensure savedCollections exists
    if (!v2Data.savedCollections) {
      v2Data.savedCollections = createDefaultSavedCollections();
    }

    // Ensure pollQuestions exists (for migration from older storage)
    if (!v2Data.savedCollections.pollQuestions) {
      v2Data.savedCollections.pollQuestions = {};
    }

    const id = `poll-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    const savedPoll: SavedPollQuestion = {
      id,
      name: name.trim().slice(0, 100),
      type: 'poll',
      question,
      options,
      createdAt: now,
      updatedAt: now
    };

    v2Data.savedCollections.pollQuestions[id] = savedPoll;
    saveStorage(v2Data);

    // Update state
    set({ savedCollections: { ...v2Data.savedCollections } });

    return id;
  },

  getPollQuestions: (): SavedPollQuestion[] => {
    const collections = get().savedCollections;
    // Handle migration case where pollQuestions might not exist
    if (!collections.pollQuestions) {
      return [];
    }
    return Object.values(collections.pollQuestions).sort((a, b) => b.updatedAt - a.updatedAt);
  },

  deletePollQuestion: (id: string) => {
    const v2Data = loadStorage();
    if (!v2Data || !v2Data.savedCollections || !v2Data.savedCollections.pollQuestions) {
      return;
    }

    delete v2Data.savedCollections.pollQuestions[id];
    saveStorage(v2Data);

    // Update state
    set({ savedCollections: { ...v2Data.savedCollections } });
  }
    }),
    {
      name: 'workspace-storage', // Storage key name (used by custom adapter)
      storage: createJSONStorage(() => workspaceStorage), // Use custom V2-aware storage adapter
      partialize: (state) => ({
        // Only persist essential data
        widgets: state.widgets,
        background: state.background,
        theme: state.theme,
        scale: state.scale,
        bottomBar: state.bottomBar,
        widgetStates: Array.from(state.widgetStates.entries()),
        sessionCode: state.sessionCode,
        sessionCreatedAt: state.sessionCreatedAt,
        classEndTime: state.classEndTime
      }),
      onRehydrateStorage: () => (state) => {
        try {
          // Convert arrays back to Maps after loading from storage
          if (state && state.widgetStates && Array.isArray(state.widgetStates)) {
            state.widgetStates = new Map(state.widgetStates);
          }

          // Ensure toolbar has all required properties with defaults for missing ones
          // This handles old localStorage formats that may not have new properties
          if (state && state.bottomBar) {
            state.bottomBar = {
              ...defaultBottomBar,  // Start with defaults
              ...state.bottomBar,   // Override with stored values
              // Ensure recentWidgets is valid array, fallback to default if not
              recentWidgets: Array.isArray(state.bottomBar.recentWidgets)
                ? state.bottomBar.recentWidgets
                : defaultBottomBar.recentWidgets,
              recentWidgetsLimit: typeof state.bottomBar.recentWidgetsLimit === 'number'
                ? state.bottomBar.recentWidgetsLimit
                : defaultBottomBar.recentWidgetsLimit
            };
          }

          // Populate workspace management state
          if (state) {
            let v2Data = loadStorage();

            // If no storage exists, create default V2 storage with a workspace
            if (!v2Data) {
              console.log('[WorkspaceStore] No existing storage found, creating default workspace');
              v2Data = createDefaultStorageV2();
              saveStorage(v2Data);
            }

            // Handle missing savedCollections field (migration from older V2)
            if (!v2Data.savedCollections) {
              v2Data.savedCollections = createDefaultSavedCollections();
              saveStorage(v2Data);
            }

            // Populate workspace list from storage
            const { currentId, list } = getWorkspaceListFromStorage();
            state.currentWorkspaceId = currentId;
            state.workspaceList = list;
            state.savedCollections = v2Data.savedCollections;
          }
        } catch (error) {
          // If rehydration fails, log error but don't crash - defaults will be used
          console.error('[WorkspaceStore] Error during rehydration, using defaults:', error);
        }
      }
    }
  )
);