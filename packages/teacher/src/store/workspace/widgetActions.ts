import type { StoreApi } from 'zustand';
import { debug } from '@shared/utils/debug';
import type { WorkspaceStore } from '../workspaceStore';
import { useWorkspaceUiStore } from '../workspaceUiStore';
import { widgetRegistry } from '../../services/WidgetRegistry';
import { trackWidgetAdd } from '../../services/usageTracking';
import { widgetStateEqual } from './widgetStateEqual';

type StoreSet = StoreApi<WorkspaceStore>['setState'];
type StoreGet = StoreApi<WorkspaceStore>['getState'];

/** Adding, arranging and removing widgets on the board, and their saved state */
export const createWidgetActions = (set: StoreSet, get: StoreGet): Pick<
  WorkspaceStore,
  | 'addWidget'
  | 'removeWidget'
  | 'updateWidget'
  | 'moveWidget'
  | 'resizeWidget'
  | 'bringToFront'
  | 'updateWidgetState'
> => ({
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
    trackWidgetAdd(type);
    return id;
  },
  removeWidget: (widgetId) => {
    debug('[WorkspaceStore] removeWidget called for widget:', widgetId);
    set((state) => {
      const newStates = new Map(state.widgetStates);
      newStates.delete(widgetId);
      return {
        widgets: state.widgets.filter(w => w.id !== widgetId),
        widgetStates: newStates
      };
    });
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
    const setFocusedWidget = useWorkspaceUiStore.getState().setFocusedWidget;
    const state = get();
    const widgetIndex = state.widgets.findIndex(w => w.id === widgetId);
    if (widgetIndex === -1) {
      setFocusedWidget(widgetId);
      return;
    }
    // Already on top: skip the reorder — this runs on every click inside a
    // widget. "Last in array" alone isn't enough: persisted workspaces (and
    // historical addWidget behavior) can hold gapped or out-of-order
    // zIndexes, so require fully normalized values before skipping
    if (
      widgetIndex === state.widgets.length - 1 &&
      state.widgets.every((w, i) => w.zIndex === i)
    ) {
      setFocusedWidget(widgetId);
      return;
    }
    const reordered = [...state.widgets];
    const [moved] = reordered.splice(widgetIndex, 1);
    reordered.push(moved);
    // Replace only the widgets whose zIndex actually changed; mutating them
    // in place would leave subscribers with stale references
    const widgets = reordered.map((w, i) => (w.zIndex === i ? w : { ...w, zIndex: i }));
    set({ widgets });
    setFocusedWidget(widgetId);
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
  }
});
