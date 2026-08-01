import type { Size, WidgetType } from './index';
import type { SavedRandomiserList } from './storage';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface CompactWidgetSnapshot {
  schemaVersion: 1;
  workspaceId: string;
  revision: number;
  stateRevision: number;
  widgetId: string;
  widgetType: WidgetType;
  title: string;
  preferredSize: Size;
  minimumSize: Size;
  maximumSize: Size | null;
  isResizable: boolean;
  maintainsAspectRatio: boolean;
  state: JsonValue | null;
  theme: 'light' | 'dark';
  savedRandomiserLists: SavedRandomiserList[];
}

export interface CompactWidgetOption {
  widgetType: WidgetType;
  title: string;
}

/**
 * Complete native-panel inventory sent from the dashboard host. The inventory
 * revision is independent of individual widget state revisions so removals,
 * including an empty inventory, can be reconciled safely.
 */
export interface CompactWidgetPanelInventory {
  type: 'widget-panels-changed';
  schemaVersion: 1;
  hostInstanceId: string;
  inventoryRevision: number;
  windowMode: 'compact' | 'canvas';
  widgets: CompactWidgetSnapshot[];
  compactWidgetOptions: CompactWidgetOption[];
}

export interface CompactPanelStateChange {
  schemaVersion: 1;
  widgetId: string;
  baseRevision: number;
  state: JsonValue;
  flush?: true;
}

export type CompactRandomiserListChange = {
  type: 'randomiser-list-save';
  schemaVersion: 1;
  widgetId: string;
  name: string;
  choices: string[];
} | {
  type: 'randomiser-list-delete';
  schemaVersion: 1;
  widgetId: string;
  id: string;
};

export interface CompactPanelHostBridge {
  applyStateChange: (change: CompactPanelStateChange) => boolean;
  applyRandomiserListChange: (change: CompactRandomiserListChange) => boolean;
  addWidget: (widgetType: WidgetType) => boolean;
  removeWidget: (widgetId: string) => boolean;
}

export interface CompactWidgetPanelBridge {
  receiveSnapshot: (snapshot: CompactWidgetSnapshot) => void;
  getRandomiserLists: () => SavedRandomiserList[];
  subscribeRandomiserLists: (listener: (lists: SavedRandomiserList[]) => void) => () => void;
  saveRandomiserList: (name: string, choices: string[]) => void;
  deleteRandomiserList: (id: string) => void;
  takePendingState: () => CompactPanelStateChange | null;
}
