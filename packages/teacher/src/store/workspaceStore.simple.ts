// Simplified store for testing
import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { BackgroundType, WidgetType } from '@shared/types';
import { LayoutFormat } from '@shared/types/storage';
import { WorkspaceStore } from './workspaceStore';
import { widgetRegistry } from '../services/WidgetRegistry';
import { debug } from '@shared/utils/debug';
import {
  StorageFormatV2,
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  CURRENT_STORAGE_VERSION,
  isStorageV2,
  createDefaultStorageV2,
  createDefaultWorkspace,
  createDefaultSavedCollections,
  SavedCollections,
  SavedItem,
  SavedRandomiserList,
  SavedQuestionBank,
  SavedPollQuestion,
  WorkspaceData
} from '@shared/types/storage';
import {
  loadStorage,
  saveStorage,
  addWorkspace as addWorkspaceToStorage,
  deleteWorkspace as deleteWorkspaceFromStorage,
  renameWorkspace as renameWorkspaceInStorage,
  switchWorkspace as switchWorkspaceInStorage,
  generateWorkspaceId
} from '@shared/utils/storageMigration';
import { WorkspaceMetadata } from './workspaceStore';

function widgetStateEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;

  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => widgetStateEqual(item, b[index]));
  }

  const objectA = a as Record<string, unknown>;
  const objectB = b as Record<string, unknown>;
  const keysA = Object.keys(objectA);
  if (keysA.length !== Object.keys(objectB).length) return false;
  return keysA.every(key =>
    Object.prototype.hasOwnProperty.call(objectB, key) && widgetStateEqual(objectA[key], objectB[key])
  );
}

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
  | 'focusedWidgetId'
> {
  return {
    currentWorkspaceId: workspaceId,
    workspaceList,
    widgets: workspace.widgets,
    background: workspace.background,
    scale: workspace.scale,
    scrollPosition: workspace.scrollPosition,
    layoutFormat: (workspace.layoutFormat || 'canvas') as LayoutFormat,
    widgetStates: new Map(workspace.widgetStates),
    focusedWidgetId: null
  };
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

let lastPersistedZustandValue: string | null = null;

// Persisting is expensive (two JSON.parse calls plus a full re-stringify of the
// V2 storage object, written to two localStorage keys), and Zustand's persist
// middleware calls setItem on every store change — including focus changes and
// drag stops. Batch rapid updates and write at most once per window.
const PERSIST_DEBOUNCE_MS = 300;
let pendingPersistValue: string | null = null;
// Workspace the pending value belongs to, captured when the write is queued:
// another window can change currentWorkspaceId in localStorage before the
// flush fires, and the value must not be written under the new id
let pendingPersistWorkspaceId: string | null = null;
let persistTimeoutId: ReturnType<typeof setTimeout> | null = null;

function flushPendingPersist(): void {
  if (persistTimeoutId !== null) {
    clearTimeout(persistTimeoutId);
    persistTimeoutId = null;
  }
  if (pendingPersistValue !== null) {
    const value = pendingPersistValue;
    const workspaceId = pendingPersistWorkspaceId;
    pendingPersistValue = null;
    pendingPersistWorkspaceId = null;
    writeStorageValue(value, workspaceId);
  }
}

// Several store actions read localStorage directly; they must see any
// not-yet-flushed state or they would save a stale copy over it.
function loadStorageSynced() {
  flushPendingPersist();
  return loadStorage();
}

// Flush on every leave-the-page signal we can get. A hard kill (crash, power
// loss, native app terminating the webview) can still lose up to
// PERSIST_DEBOUNCE_MS of changes — an accepted trade-off
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushPendingPersist);
  window.addEventListener('beforeunload', flushPendingPersist);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushPendingPersist();
    }
  });
}

/**
 * Custom storage adapter that handles the multi-workspace V2 format.
 * (Formerly also migrated from V1's single-workspace, Zustand-default
 * format; that format's support was removed 2026-08 once no v1
 * population remained.)
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
            const zustandValue = JSON.stringify({
              state: {
                widgets: currentWorkspace.widgets,
                background: currentWorkspace.background,
                scale: currentWorkspace.scale,
                scrollPosition: currentWorkspace.scrollPosition,
                widgetStates: currentWorkspace.widgetStates,
                layoutFormat: currentWorkspace.layoutFormat || 'canvas',
                theme: v2Data.globalSettings.theme,
                bottomBar: (v2Data.globalSettings as any).bottomBar || (v2Data.globalSettings as any).toolbar,
                classEndTime: v2Data.globalSettings.classEndTime ?? null,
                sessionCode: v2Data.session.code,
                sessionCreatedAt: v2Data.session.createdAt
              },
              version: 0  // Zustand's internal version
            });
            lastPersistedZustandValue = zustandValue;
            return zustandValue;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('[Storage] Error reading storage:', error);
      return null;
    }
  },

  setItem: (name: string, value: string): void => {
    if (value === lastPersistedZustandValue && pendingPersistValue === null) {
      return;
    }

    pendingPersistValue = value;
    try {
      pendingPersistWorkspaceId = useWorkspaceStore.getState().currentWorkspaceId || null;
    } catch {
      // Store not constructed yet (persist can fire during creation)
      pendingPersistWorkspaceId = null;
    }
    if (persistTimeoutId === null) {
      persistTimeoutId = setTimeout(() => {
        persistTimeoutId = null;
        if (pendingPersistValue !== null) {
          const pending = pendingPersistValue;
          const workspaceId = pendingPersistWorkspaceId;
          pendingPersistValue = null;
          pendingPersistWorkspaceId = null;
          writeStorageValue(pending, workspaceId);
        }
      }, PERSIST_DEBOUNCE_MS);
    }
  },

  removeItem: (name: string): void => {
    if (persistTimeoutId !== null) {
      clearTimeout(persistTimeoutId);
      persistTimeoutId = null;
    }
    pendingPersistValue = null;
    pendingPersistWorkspaceId = null;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    lastPersistedZustandValue = null;
  }
};

function writeStorageValue(value: string, capturedWorkspaceId?: string | null): void {
    if (value === lastPersistedZustandValue) {
      return;
    }

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

      // Update the workspace the value was captured for; fall back to the
      // pointer in storage when no id was captured (e.g. during startup)
      const currentWorkspaceId = capturedWorkspaceId || v2Data.currentWorkspaceId;
      let currentWorkspace = v2Data.workspaces[currentWorkspaceId];
      if (!currentWorkspace) {
        if (capturedWorkspaceId) {
          // The captured workspace was deleted (e.g. by another window)
          // before the flush — drop the write rather than resurrect it
          lastPersistedZustandValue = value;
          return;
        }
        currentWorkspace = createDefaultWorkspace(currentWorkspaceId);
      }

      v2Data.workspaces[currentWorkspaceId] = {
        ...currentWorkspace,
        updatedAt: Date.now(),
        widgets: state.widgets || [],
        background: state.background || BackgroundType.LOWPOLY,
        scale: state.scale ?? 1,
        scrollPosition: state.scrollPosition || { x: 0, y: 0 },
        widgetStates: state.widgetStates || [],
        layoutFormat: state.layoutFormat || 'canvas'
      };

      // Update global settings
      v2Data.globalSettings = {
        theme: state.theme || 'light',
        bottomBar: state.bottomBar || defaultBottomBar,
        classEndTime: state.classEndTime ?? null
      };

      // Update session
      v2Data.session = {
        code: state.sessionCode || null,
        createdAt: state.sessionCreatedAt || null
      };

      // Save V2 format
      localStorage.setItem(STORAGE_KEY, JSON.stringify(v2Data));
      lastPersistedZustandValue = value;

    } catch (error) {
      console.error('[Storage] Error writing storage:', error);
    }
}

// =============================================================================
// Saved Collection Helpers
// =============================================================================

/** Which of the three saved-item dictionaries a CRUD call operates on */
type CollectionKey = keyof SavedCollections;

/** The item type stored in a given collection */
type CollectionItem<K extends CollectionKey> = SavedCollections[K][string];

/** Narrow view of the store's setter — these helpers only touch savedCollections */
type SetSavedCollections = (partial: Pick<WorkspaceStore, 'savedCollections'>) => void;

const MAX_SAVED_NAME_LENGTH = 100;

/**
 * Read a collection dictionary, creating it (and its parent) if storage predates
 * the field. Older V2 payloads can be missing `savedCollections` entirely, or an
 * individual dictionary that was added later.
 */
function ensureCollection<K extends CollectionKey>(
  v2Data: StorageFormatV2,
  key: K
): SavedCollections[K] {
  if (!v2Data.savedCollections) {
    v2Data.savedCollections = createDefaultSavedCollections();
  }
  if (!v2Data.savedCollections[key]) {
    v2Data.savedCollections[key] = {};
  }
  return v2Data.savedCollections[key];
}

/**
 * Save a new item into one of the saved collections and mirror the result into
 * store state. `createItem` receives the shared `SavedItem` fields (generated id,
 * truncated name, timestamps) and adds the type-specific ones.
 *
 * @returns the generated id, or '' when there is no storage to write to
 */
function saveCollectionItem<K extends CollectionKey>(
  setState: SetSavedCollections,
  key: K,
  idPrefix: string,
  label: string,
  name: string,
  createItem: (base: SavedItem) => CollectionItem<K>
): string {
  const v2Data = loadStorageSynced();
  if (!v2Data) {
    console.warn(`[WorkspaceStore] Cannot save ${label}: no storage found`);
    return '';
  }

  const collection = ensureCollection(v2Data, key);
  const now = Date.now();
  const id = `${idPrefix}-${now}-${Math.random().toString(36).substr(2, 9)}`;
  const item = createItem({
    id,
    name: name.trim().slice(0, MAX_SAVED_NAME_LENGTH),
    createdAt: now,
    updatedAt: now
  });

  collection[id] = item;
  saveStorage(v2Data);

  setState({ savedCollections: { ...v2Data.savedCollections } });

  return id;
}

/** All items in a collection, most recently updated first */
function getCollectionItems<K extends CollectionKey>(
  collections: SavedCollections,
  key: K
): Array<CollectionItem<K>> {
  const collection = collections?.[key];
  if (!collection) {
    return [];
  }
  return Object.values(collection).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Remove an item from a collection; a missing collection or id is a no-op */
function deleteCollectionItem(
  setState: SetSavedCollections,
  key: CollectionKey,
  id: string
): void {
  const v2Data = loadStorageSynced();
  if (!v2Data || !v2Data.savedCollections || !v2Data.savedCollections[key]) {
    return;
  }

  delete v2Data.savedCollections[key][id];
  saveStorage(v2Data);

  setState({ savedCollections: { ...v2Data.savedCollections } });
}

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
  focusedWidgetId: null,
  classEndTime: null,
  layoutFormat: 'canvas' as LayoutFormat,

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
  setLayoutFormat: (format) => set({ layoutFormat: format }),
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
      // Max + 1 (not array length): removals leave gaps, and a new widget
      // must always land on top of existing ones
      zIndex: get().widgets.reduce((max, w) => Math.max(max, w.zIndex), -1) + 1
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
      const widgetIndex = state.widgets.findIndex(w => w.id === widgetId);
      if (widgetIndex === -1) {
        return { focusedWidgetId: widgetId };
      }
      // Already on top: skip the reorder — this runs on every click inside a
      // widget. "Last in array" alone isn't enough: persisted workspaces (and
      // historical addWidget behavior) can hold gapped or out-of-order
      // zIndexes, so require fully normalized values before skipping
      if (
        widgetIndex === state.widgets.length - 1 &&
        state.widgets.every((w, i) => w.zIndex === i)
      ) {
        return state.focusedWidgetId === widgetId ? state : { focusedWidgetId: widgetId };
      }
      const reordered = [...state.widgets];
      const [moved] = reordered.splice(widgetIndex, 1);
      reordered.push(moved);
      // Replace only the widgets whose zIndex actually changed; mutating them
      // in place would leave subscribers with stale references
      const widgets = reordered.map((w, i) => (w.zIndex === i ? w : { ...w, zIndex: i }));
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
    const previous = get().widgetStates.get(widgetId);
    if (widgetStateEqual(previous, state)) {
      return;
    }
    set((store) => {
      const newStates = new Map(store.widgetStates);
      newStates.set(widgetId, state);
      return { widgetStates: newStates };
    });
  },
  emitEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},

  // Workspace management actions
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
  },

  // =============================================================================
  // Saved Collections Management
  // =============================================================================

  saveRandomiserList: (name: string, choices: string[]): string =>
    saveCollectionItem(set, 'randomiserLists', 'randomiser', 'randomiser list', name,
      (base): SavedRandomiserList => ({ ...base, type: 'randomiser', choices })),

  getRandomiserLists: (): SavedRandomiserList[] =>
    getCollectionItems(get().savedCollections, 'randomiserLists'),

  deleteRandomiserList: (id: string) => {
    deleteCollectionItem(set, 'randomiserLists', id);
  },

  saveQuestionBank: (name: string, questions: Array<{ text: string; studentName?: string }>): string =>
    saveCollectionItem(set, 'questionBanks', 'questions', 'question bank', name,
      (base): SavedQuestionBank => ({ ...base, type: 'questions', questions })),

  getQuestionBanks: (): SavedQuestionBank[] =>
    getCollectionItems(get().savedCollections, 'questionBanks'),

  deleteQuestionBank: (id: string) => {
    deleteCollectionItem(set, 'questionBanks', id);
  },

  savePollQuestion: (name: string, question: string, options: string[]): string =>
    saveCollectionItem(set, 'pollQuestions', 'poll', 'poll question', name,
      (base): SavedPollQuestion => ({ ...base, type: 'poll', question, options })),

  getPollQuestions: (): SavedPollQuestion[] =>
    getCollectionItems(get().savedCollections, 'pollQuestions'),

  deletePollQuestion: (id: string) => {
    deleteCollectionItem(set, 'pollQuestions', id);
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
        layoutFormat: state.layoutFormat,
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
            let v2Data = loadStorageSynced();

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
