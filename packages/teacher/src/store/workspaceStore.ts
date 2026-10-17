// The teacher workspace store: board widgets, workspace settings and saved
// collections, persisted to the V2 multi-workspace localStorage format.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { BackgroundType } from '@shared/types';
import {
  LayoutFormat,
  createDefaultStorageV2,
  createDefaultSavedCollections
} from '@shared/types/storage';
import { createDefaultShortenerSettings } from '@shared/utils/urlShortener';
import { saveStorage } from '@shared/utils/storageMigration';
import { WorkspaceStore } from './workspaceTypes';
import { defaultBottomBar } from './workspace/workspaceDefaults';
import {
  bindPersistWorkspaceId,
  loadStorageSynced,
  workspaceStorage,
  type PersistedWorkspaceState
} from './workspace/workspacePersistence';
import { createWidgetActions } from './workspace/widgetActions';
import { createWorkspaceActions, getWorkspaceListFromStorage } from './workspace/workspaceActions';
import { createSavedCollectionActions } from './workspace/savedCollectionActions';

export { widgetStateEqual } from './workspace/widgetStateEqual';

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
  bottomBar: defaultBottomBar,
  widgetStates: new Map(),
  classEndTime: null,
  linkShortener: createDefaultShortenerSettings(),
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
  
  ...createWidgetActions(set, get),
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
  updateLinkShortener: (updates) => {
    set((state) => ({
      linkShortener: { ...state.linkShortener, ...updates }
    }));
  },
  toggleWidgetVisibility: () => {},
  pinWidget: () => {},
  unpinWidget: () => {},

  // Workspace management actions
  ...createWorkspaceActions(set, get),

  // =============================================================================
  // Saved Collections Management
  // =============================================================================

  ...createSavedCollectionActions(set, get)
    }),
    {
      name: 'workspace-storage', // Storage key name (used by custom adapter)
      storage: createJSONStorage(() => workspaceStorage), // Use custom V2-aware storage adapter
      partialize: (state): PersistedWorkspaceState => ({
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
        classEndTime: state.classEndTime,
        linkShortener: state.linkShortener
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

          // Stores written before the shortener setting existed have no value
          if (state) {
            state.linkShortener = { ...createDefaultShortenerSettings(), ...(state.linkShortener || {}) };
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

// The debounced persist write records which workspace a queued value belongs to
bindPersistWorkspaceId(() => useWorkspaceStore.getState().currentWorkspaceId || null);
