import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { BackgroundType, WidgetType } from '@shared/types';
import {
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  SavedCollections,
  SavedItem,
  StorageFormatV2,
  StoredBottomBarConfig,
  WorkspaceData,
  createDefaultSavedCollections
} from '@shared/types/storage';
import { loadStorage, saveStorage } from '@shared/utils/storageMigration';
import { useWorkspaceStore } from './workspaceStore.simple';

// -----------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------

const baseBottomBar: StoredBottomBarConfig = {
  visibleWidgets: [WidgetType.RANDOMISER, WidgetType.TIMER],
  pinnedWidgets: [],
  showClock: true,
  showConnectionStatus: true,
  voiceControlEnabled: false,
  recentWidgets: [WidgetType.TIMER],
  recentWidgetsLimit: 5
};

function makeWorkspace(id: string, overrides: Partial<WorkspaceData> = {}): WorkspaceData {
  return {
    id,
    name: id,
    createdAt: 1,
    updatedAt: 1,
    widgets: [],
    background: BackgroundType.LOWPOLY,
    scale: 1,
    scrollPosition: { x: 0, y: 0 },
    widgetStates: [],
    layoutFormat: 'canvas',
    ...overrides
  };
}

// Workspace ids are unique per seeded test: the store's persist middleware is
// debounced, so a write queued by one test can flush during the next. A write
// whose captured workspace no longer exists is dropped, which keeps each test's
// storage clean.
let seedCount = 0;

interface Seed {
  idA: string;
  idB: string;
}

/** Write a two-workspace V2 payload to localStorage and rehydrate the store from it */
async function seedStorage(
  workspaceOverrides: { a?: Partial<WorkspaceData>; b?: Partial<WorkspaceData> } = {}
): Promise<Seed> {
  seedCount += 1;
  const idA = `ws-a-${seedCount}`;
  const idB = `ws-b-${seedCount}`;

  const storage: StorageFormatV2 = {
    version: 2,
    currentWorkspaceId: idA,
    workspaces: {
      [idA]: makeWorkspace(idA, workspaceOverrides.a),
      [idB]: makeWorkspace(idB, workspaceOverrides.b)
    },
    globalSettings: {
      theme: 'light',
      bottomBar: baseBottomBar,
      classEndTime: null
    },
    session: { code: null, createdAt: null },
    savedCollections: createDefaultSavedCollections()
  };

  localStorage.clear();
  saveStorage(storage);
  await useWorkspaceStore.persist.rehydrate();

  return { idA, idB };
}

const store = () => useWorkspaceStore.getState();

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
});

// -----------------------------------------------------------------------------
// T1-A: the shared workspace snapshot patch
// -----------------------------------------------------------------------------

describe('workspace snapshot', () => {
  it('loads every per-workspace field from the target workspace on switch', async () => {
    const { idB } = await seedStorage({
      b: {
        widgets: [
          {
            id: 'w-b',
            type: WidgetType.TIMER,
            position: { x: 11, y: 22 },
            size: { width: 300, height: 200 },
            zIndex: 0
          }
        ],
        background: BackgroundType.GEOMETRIC,
        scale: 1.75,
        scrollPosition: { x: 30, y: 40 },
        widgetStates: [['w-b', { seconds: 90 }]],
        layoutFormat: 'column'
      }
    });

    store().setFocusedWidget('something-from-workspace-a');
    store().switchWorkspace(idB);

    const state = store();
    expect(state.currentWorkspaceId).toBe(idB);
    expect(state.workspaceList.map(w => w.id).sort()).toEqual([idB, `ws-a-${seedCount}`].sort());
    expect(state.widgets).toHaveLength(1);
    expect(state.widgets[0].id).toBe('w-b');
    expect(state.background).toBe(BackgroundType.GEOMETRIC);
    expect(state.scale).toBe(1.75);
    expect(state.scrollPosition).toEqual({ x: 30, y: 40 });
    expect(state.layoutFormat).toBe('column');
    expect(state.widgetStates).toBeInstanceOf(Map);
    expect(state.widgetStates.get('w-b')).toEqual({ seconds: 90 });
    expect(state.focusedWidgetId).toBeNull();
  });

  it('defaults layoutFormat to canvas when the stored workspace predates the field', async () => {
    const { idB } = await seedStorage({ b: { layoutFormat: undefined } });

    store().setLayoutFormat('column');
    store().switchWorkspace(idB);

    expect(store().layoutFormat).toBe('canvas');
  });

  it('skips identical widget state updates', async () => {
    await seedStorage();
    const timerId = store().addWidget(WidgetType.TIMER, { x: 0, y: 0 });
    store().updateWidgetState(timerId, { seconds: 42 });
    const firstStates = store().widgetStates;

    store().updateWidgetState(timerId, { seconds: 42 });
    expect(store().widgetStates).toBe(firstStates);
  });

  it('round-trips per-workspace state through create, switch and delete', async () => {
    const { idA } = await seedStorage();

    // Give workspace A distinctive state
    const timerId = store().addWidget(WidgetType.TIMER, { x: 5, y: 6 });
    store().setBackground(BackgroundType.GEOMETRIC);
    store().setScale(1.75);
    store().setLayoutFormat('column');
    store().updateWidgetState(timerId, { seconds: 42 });

    // Creating a workspace persists A and loads the new (empty) workspace
    const idC = store().createWorkspace('Workspace C');
    expect(idC).not.toBe('');
    expect(store().currentWorkspaceId).toBe(idC);
    expect(store().widgets).toEqual([]);
    expect(store().background).toBe(BackgroundType.LOWPOLY);
    expect(store().scale).toBe(1);
    expect(store().layoutFormat).toBe('canvas');
    expect(store().widgetStates.size).toBe(0);
    expect(store().focusedWidgetId).toBeNull();
    expect(store().workspaceList).toHaveLength(3);

    // Give workspace C its own distinctive state
    const listId = store().addWidget(WidgetType.LIST, { x: 1, y: 2 });
    store().setScale(0.5);

    // Switching back restores A exactly, with none of C's state leaking in
    store().switchWorkspace(idA);
    expect(store().currentWorkspaceId).toBe(idA);
    expect(store().widgets.map(w => w.id)).toEqual([timerId]);
    expect(store().background).toBe(BackgroundType.GEOMETRIC);
    expect(store().scale).toBe(1.75);
    expect(store().layoutFormat).toBe('column');
    expect(store().widgetStates.get(timerId)).toEqual({ seconds: 42 });

    // ...and forward again restores C
    store().switchWorkspace(idC);
    expect(store().widgets.map(w => w.id)).toEqual([listId]);
    expect(store().scale).toBe(0.5);

    // Deleting the current workspace loads whichever workspace we land on
    expect(store().deleteWorkspace(idC)).toBe(true);
    expect(store().workspaceList.map(w => w.id)).not.toContain(idC);
    expect(store().currentWorkspaceId).not.toBe(idC);
    expect(store().widgets.map(w => w.id)).not.toContain(listId);
    expect(store().focusedWidgetId).toBeNull();
  });

  it('only refreshes the list when deleting a workspace that is not current', async () => {
    const { idA, idB } = await seedStorage();

    store().setScale(1.25);
    expect(store().deleteWorkspace(idB)).toBe(true);

    expect(store().currentWorkspaceId).toBe(idA);
    expect(store().workspaceList.map(w => w.id)).toEqual([idA]);
    expect(store().scale).toBe(1.25);
  });
});

// -----------------------------------------------------------------------------
// The assertion this task exists for: global settings are NOT per-workspace
// -----------------------------------------------------------------------------

describe('global settings', () => {
  it('keeps theme, classEndTime and bottomBar unchanged across switch/create/delete', async () => {
    const { idA, idB } = await seedStorage();

    store().setTheme('dark');
    store().setClassEndTime(1893456000000);
    store().updateBottomBar({ showClock: false, voiceControlEnabled: true });

    const expectGlobalsIntact = (label: string) => {
      expect(store().theme, label).toBe('dark');
      expect(store().classEndTime, label).toBe(1893456000000);
      expect(store().bottomBar.showClock, label).toBe(false);
      expect(store().bottomBar.voiceControlEnabled, label).toBe(true);
    };

    store().switchWorkspace(idB);
    expectGlobalsIntact('after switching to B');

    store().switchWorkspace(idA);
    expectGlobalsIntact('after switching back to A');

    const idC = store().createWorkspace('Workspace C');
    expectGlobalsIntact('after creating C');

    store().deleteWorkspace(idC);
    expectGlobalsIntact('after deleting C');
  });
});

// -----------------------------------------------------------------------------
// T1-B: the generic keyed-collection helpers
// -----------------------------------------------------------------------------

interface CollectionCase {
  label: string;
  dictKey: keyof SavedCollections;
  idPrefix: string;
  save: (name: string) => string;
  list: () => SavedItem[];
  remove: (id: string) => void;
}

const collectionCases: CollectionCase[] = [
  {
    label: 'randomiser lists',
    dictKey: 'randomiserLists',
    idPrefix: 'randomiser-',
    save: name => store().saveRandomiserList(name, ['alpha', 'beta']),
    list: () => store().getRandomiserLists(),
    remove: id => store().deleteRandomiserList(id)
  },
  {
    label: 'question banks',
    dictKey: 'questionBanks',
    idPrefix: 'questions-',
    save: name => store().saveQuestionBank(name, [{ text: 'why?' }]),
    list: () => store().getQuestionBanks(),
    remove: id => store().deleteQuestionBank(id)
  },
  {
    label: 'poll questions',
    dictKey: 'pollQuestions',
    idPrefix: 'poll-',
    save: name => store().savePollQuestion(name, 'Favourite colour?', ['red', 'blue']),
    list: () => store().getPollQuestions(),
    remove: id => store().deletePollQuestion(id)
  }
];

describe.each(collectionCases)('saved collections: $label', testCase => {
  const { dictKey, idPrefix, save, list, remove } = testCase;

  beforeEach(async () => {
    await seedStorage();
  });

  it('generates a prefixed id and persists the item', () => {
    const id = save('My list');

    expect(id.startsWith(idPrefix)).toBe(true);
    expect(list().map(item => item.id)).toEqual([id]);

    const stored = loadStorage();
    expect(stored?.savedCollections[dictKey][id]?.name).toBe('My list');
  });

  it('trims and truncates the name to 100 characters', () => {
    const id = save(`  ${'x'.repeat(150)}  `);

    const saved = list().find(item => item.id === id);
    expect(saved?.name).toBe('x'.repeat(100));
  });

  it('returns items sorted by updatedAt descending', () => {
    const nowSpy = vi.spyOn(Date, 'now');

    nowSpy.mockReturnValue(1_000);
    save('oldest');
    nowSpy.mockReturnValue(3_000);
    save('newest');
    nowSpy.mockReturnValue(2_000);
    save('middle');
    nowSpy.mockRestore();

    expect(list().map(item => item.name)).toEqual(['newest', 'middle', 'oldest']);
  });

  it('deletes only the requested item and no-ops on an unknown id', () => {
    const keepId = save('keep');
    const dropId = save('drop');

    remove(dropId);
    expect(list().map(item => item.id)).toEqual([keepId]);
    expect(loadStorage()?.savedCollections[dictKey][dropId]).toBeUndefined();

    remove('does-not-exist');
    expect(list().map(item => item.id)).toEqual([keepId]);
  });

  it('auto-creates the collection dict when older storage is missing it', () => {
    // Simulate storage written before this collection existed
    const stored = loadStorage();
    expect(stored).not.toBeNull();
    delete (stored!.savedCollections as Partial<SavedCollections>)[dictKey];
    saveStorage(stored!);
    useWorkspaceStore.setState({ savedCollections: stored!.savedCollections });

    expect(list()).toEqual([]);

    const id = save('after migration');
    expect(id.startsWith(idPrefix)).toBe(true);
    expect(list().map(item => item.id)).toEqual([id]);
    expect(loadStorage()?.savedCollections[dictKey][id]).toBeDefined();
  });

  it('no-ops on delete when the collection dict is missing', () => {
    const stored = loadStorage();
    delete (stored!.savedCollections as Partial<SavedCollections>)[dictKey];
    saveStorage(stored!);
    useWorkspaceStore.setState({ savedCollections: stored!.savedCollections });

    expect(() => remove('anything')).not.toThrow();
  });
});

// -----------------------------------------------------------------------------
// SH1-B: V1 storage migration removed — first load must still work cleanly
// -----------------------------------------------------------------------------

describe('storage: no v1 population', () => {
  it('creates a default workspace on a genuinely empty first load', async () => {
    localStorage.clear();

    await useWorkspaceStore.persist.rehydrate();

    const state = store();
    expect(state.currentWorkspaceId).not.toBe('');
    expect(state.workspaceList).toHaveLength(1);
    expect(state.widgets).toEqual([]);

    // The default workspace was actually persisted in V2 format...
    const stored = loadStorage();
    expect(stored?.workspaces[state.currentWorkspaceId]).toBeDefined();

    // ...and no v1-shaped key was ever written.
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
  });

  it('ignores a stale legacy key instead of trying to read it as v1 data', async () => {
    localStorage.clear();
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({ state: { widgets: ['not-real-data'] }, version: 0 }));

    await useWorkspaceStore.persist.rehydrate();

    const state = store();
    // A fresh default workspace, not anything derived from the legacy blob.
    expect(state.widgets).toEqual([]);
    expect(state.workspaceList).toHaveLength(1);
  });

  it('never writes to the legacy key on subsequent saves', async () => {
    await seedStorage();

    store().addWidget(WidgetType.TIMER, { x: 1, y: 2 });
    // Persisting is debounced; the same 'pagehide' listener a real tab-close
    // relies on flushes it synchronously for the test.
    window.dispatchEvent(new Event('pagehide'));

    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
  });
});

describe('saved collections: isolation between kinds', () => {
  it('keeps the three collections independent', async () => {
    await seedStorage();

    const randomiserId = store().saveRandomiserList('names', ['a']);
    const questionId = store().saveQuestionBank('bank', [{ text: 'q' }]);
    const pollId = store().savePollQuestion('poll', 'q?', ['yes', 'no']);

    store().deleteRandomiserList(randomiserId);

    expect(store().getRandomiserLists()).toEqual([]);
    expect(store().getQuestionBanks().map(item => item.id)).toEqual([questionId]);
    expect(store().getPollQuestions().map(item => item.id)).toEqual([pollId]);
  });
});
