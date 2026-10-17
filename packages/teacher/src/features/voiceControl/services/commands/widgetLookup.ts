import { WidgetType, type Widget } from '@shared/types';
import { debug } from '@shared/utils/debug';
import { useWorkspaceStore } from '../../../../store/workspaceStore.simple';
import { useWorkspaceUiStore } from '../../../../store/workspaceUiStore';
import { widgetRegistry } from '../../../../services/WidgetRegistry';

/**
 * Helper Functions for Widget Lookup
 * These functions get fresh state each time to avoid stale references
 */

// Get viewport center position for new widgets
export const getViewportCenterPosition = (widgetType: WidgetType): { x: number; y: number } => {
  const scrollContainer = document.querySelector<HTMLElement>('.board-scroll-container');
  const scale = useWorkspaceStore.getState().scale || 1;

  if (!scrollContainer) {
    debug.warn('Could not find scroll container, using default position');
    return { x: 400, y: 300 };
  }

  const scrollRect = scrollContainer.getBoundingClientRect();

  // Calculate center position relative to the board
  const centerX = (scrollContainer.scrollLeft + scrollRect.width / 2) / scale;
  const centerY = (scrollContainer.scrollTop + scrollRect.height / 2) / scale;

  // Get widget size from registry
  const widgetConfig = widgetRegistry.get(widgetType);
  const widgetWidth = widgetConfig?.defaultSize.width || 350;
  const widgetHeight = widgetConfig?.defaultSize.height || 350;

  // Adjust position to center the widget
  const x = centerX - widgetWidth / 2;
  const y = centerY - widgetHeight / 2;

  debug('📍 Calculated viewport center position:', { x, y, centerX, centerY, widgetWidth, widgetHeight });

  return { x, y };
};

// Generic widget finder
const findWidgetByType = (type: WidgetType, preferFocused = true): Widget | null => {
  const store = useWorkspaceStore.getState();
  const focusedWidgetId = useWorkspaceUiStore.getState().focusedWidgetId;

  if (preferFocused && focusedWidgetId) {
    const focusedWidget = store.widgets.find(w => w.id === focusedWidgetId);
    if (focusedWidget?.type === type) return focusedWidget;
  }

  return store.widgets.find(w => w.type === type) || null;
};

/** The focused widget of this type, else the first one on the board */
export const findTargetWidget = (type: WidgetType): Widget | null =>
  findWidgetByType(type, true) || findWidgetByType(type, false);
