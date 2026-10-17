import type { StoreApi } from 'zustand';
import {
  StorageFormatV2,
  createDefaultSavedCollections,
  SavedCollections,
  SavedItem,
  SavedRandomiserList,
  SavedQuestionBank,
  SavedPollQuestion
} from '@shared/types/storage';
import { saveStorage } from '@shared/utils/storageMigration';
import type { WorkspaceStore } from '../workspaceTypes';
import { loadStorageSynced } from './workspacePersistence';

type StoreSet = StoreApi<WorkspaceStore>['setState'];
type StoreGet = StoreApi<WorkspaceStore>['getState'];

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
// Saved Collections Management
// =============================================================================

export const createSavedCollectionActions = (set: StoreSet, get: StoreGet): Pick<
  WorkspaceStore,
  | 'saveRandomiserList'
  | 'getRandomiserLists'
  | 'deleteRandomiserList'
  | 'saveQuestionBank'
  | 'getQuestionBanks'
  | 'deleteQuestionBank'
  | 'savePollQuestion'
  | 'getPollQuestions'
  | 'deletePollQuestion'
> => ({
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
});
