import type { StateStorage } from 'zustand/middleware';
import { BackgroundType } from '@shared/types';
import { createDefaultShortenerSettings } from '@shared/utils/urlShortener';
import {
  StorageFormatV2,
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  GlobalSettings,
  isStorageV2,
  createDefaultStorageV2,
  createDefaultWorkspace
} from '@shared/types/storage';
import { loadStorage } from '@shared/utils/storageMigration';
import type { WorkspaceStore } from '../workspaceTypes';
import { defaultBottomBar } from './workspaceDefaults';

/**
 * The slice of store state Zustand persists (see `partialize` in
 * workspaceStore.ts). `widgetStates` is serialised as Map entries.
 */
export type PersistedWorkspaceState = Pick<
  WorkspaceStore,
  | 'widgets'
  | 'background'
  | 'theme'
  | 'scale'
  | 'layoutFormat'
  | 'bottomBar'
  | 'sessionCode'
  | 'sessionCreatedAt'
  | 'classEndTime'
  | 'linkShortener'
> & {
  widgetStates: Array<[string, any]>;
  scrollPosition?: WorkspaceStore['scrollPosition'];
};

// Storage written before the toolbar was renamed to the bottom bar
type LegacyGlobalSettings = Partial<Pick<GlobalSettings, 'bottomBar'>> & {
  toolbar?: GlobalSettings['bottomBar'];
};

// Where the debounced write learns which workspace a queued value belongs to.
// Bound by the store once it exists; until then nothing is captured.
let currentWorkspaceIdSource: () => string | null = () => null;

export function bindPersistWorkspaceId(source: () => string | null): void {
  currentWorkspaceIdSource = source;
}

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
export function loadStorageSynced() {
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
export const workspaceStorage: StateStorage = {
  getItem: (_name: string): string | null => {
    try {
      // First, try to load V2 format
      const v2Raw = localStorage.getItem(STORAGE_KEY);
      if (v2Raw) {
        const v2Data: unknown = JSON.parse(v2Raw);
        if (isStorageV2(v2Data)) {
          // Convert V2 format back to Zustand's expected format
          const currentWorkspace = v2Data.workspaces[v2Data.currentWorkspaceId];
          if (currentWorkspace) {
            const legacySettings = v2Data.globalSettings as LegacyGlobalSettings;
            const zustandValue = JSON.stringify({
              state: {
                widgets: currentWorkspace.widgets,
                background: currentWorkspace.background,
                scale: currentWorkspace.scale,
                scrollPosition: currentWorkspace.scrollPosition,
                widgetStates: currentWorkspace.widgetStates,
                layoutFormat: currentWorkspace.layoutFormat || 'canvas',
                theme: v2Data.globalSettings.theme,
                bottomBar: legacySettings.bottomBar || legacySettings.toolbar,
                classEndTime: v2Data.globalSettings.classEndTime ?? null,
                linkShortener: v2Data.globalSettings.linkShortener ?? createDefaultShortenerSettings(),
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

  setItem: (_name: string, value: string): void => {
    if (value === lastPersistedZustandValue && pendingPersistValue === null) {
      return;
    }

    pendingPersistValue = value;
    try {
      pendingPersistWorkspaceId = currentWorkspaceIdSource();
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

  removeItem: (_name: string): void => {
    if (persistTimeoutId !== null) {
      clearTimeout(persistTimeoutId);
      persistTimeoutId = null;
    }
    pendingPersistValue = null;
    pendingPersistWorkspaceId = null;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    lastPersistedZustandValue = null;
    lastWrittenV2 = null;
  }
};

// The last V2 blob this module wrote, kept so the debounced persist flush can
// skip re-parsing localStorage when nothing else touched it since.
let lastWrittenV2: { raw: string; data: StorageFormatV2 } | null = null;

function writeStorageValue(value: string, capturedWorkspaceId?: string | null): void {
    if (value === lastPersistedZustandValue) {
      return;
    }

    try {
      // Zustand serialised this from partialize; fields may still be missing
      // when it rehydrated from older storage
      const zustandData = JSON.parse(value) as { state: Partial<PersistedWorkspaceState> };
      const state = zustandData.state;

      // Load existing V2 data or create new
      let v2Data: StorageFormatV2;
      const existingRaw = localStorage.getItem(STORAGE_KEY);

      if (existingRaw && lastWrittenV2 && existingRaw === lastWrittenV2.raw) {
        v2Data = lastWrittenV2.data;
      } else if (existingRaw) {
        const existing: unknown = JSON.parse(existingRaw);
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
        classEndTime: state.classEndTime ?? null,
        linkShortener: state.linkShortener || createDefaultShortenerSettings()
      };

      // Update session
      v2Data.session = {
        code: state.sessionCode || null,
        createdAt: state.sessionCreatedAt || null
      };

      // Save V2 format
      const raw = JSON.stringify(v2Data);
      localStorage.setItem(STORAGE_KEY, raw);
      lastWrittenV2 = { raw, data: v2Data };
      lastPersistedZustandValue = value;

    } catch (error) {
      console.error('[Storage] Error writing storage:', error);
    }
}
