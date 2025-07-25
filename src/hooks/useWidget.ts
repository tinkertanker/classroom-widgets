// Widget-specific hooks for easy state management

import { useCallback, useEffect } from 'react';
import { shallow } from 'zustand/shallow';
import { useWorkspaceStore } from '../store/workspaceStore.simple';
import { selectWidget } from '../store/workspaceStore';
import { WidgetInstance, Position, Size } from '../types';

// Hook for individual widget instances
export function useWidget(widgetId: string) {
  const widget = useWorkspaceStore((state) => state.widgets.find(w => w.id === widgetId));
  const widgetState = useWorkspaceStore((state) => state.widgetStates.get(widgetId));
  
  const updatePosition = useWorkspaceStore((state) => state.moveWidget);
  const updateSize = useWorkspaceStore((state) => state.resizeWidget);
  const remove = useWorkspaceStore((state) => state.removeWidget);
  const bringToFront = useWorkspaceStore((state) => state.bringToFront);
  const updateState = useWorkspaceStore((state) => state.updateWidgetState);

  const move = useCallback((position: Position) => updatePosition(widgetId, position), [widgetId, updatePosition]);
  const resize = useCallback((size: Size) => updateSize(widgetId, size), [widgetId, updateSize]);
  const removeWidget = useCallback(() => remove(widgetId), [widgetId, remove]);
  const focus = useCallback(() => bringToFront(widgetId), [widgetId, bringToFront]);
  const setState = useCallback((state: any) => updateState(widgetId, state), [widgetId, updateState]);

  return {
    widget,
    state: widgetState,
    move,
    resize,
    remove: removeWidget,
    focus,
    setState
  };
}

// Hook for widget drag state
export function useWidgetDrag(widgetId: string) {
  const { isDragging, draggedWidgetId } = useWorkspaceStore(
    (state) => state.dragState,
    shallow
  );
  
  const startDragging = useWorkspaceStore((state) => state.startDragging);
  const stopDragging = useWorkspaceStore((state) => state.stopDragging);

  const isBeingDragged = isDragging && draggedWidgetId === widgetId;

  return {
    isBeingDragged,
    startDrag: () => startDragging(widgetId),
    stopDrag: stopDragging
  };
}

// Hook for widget lifecycle
export function useWidgetLifecycle(widgetId: string, onMount?: () => void, onUnmount?: () => void) {
  useEffect(() => {
    onMount?.();
    return () => {
      onUnmount?.();
    };
  }, [widgetId, onMount, onUnmount]);
}

// Hook for widget events
export function useWidgetEvents(widgetId: string, handlers: {
  onUpdate?: (data: any) => void;
  onMove?: (position: Position) => void;
  onResize?: (size: Size) => void;
}) {
  const addEventListener = useWorkspaceStore((state) => state.addEventListener);
  const removeEventListener = useWorkspaceStore((state) => state.removeEventListener);

  useEffect(() => {
    const listener = (event: any) => {
      switch (event.type) {
        case 'update':
          handlers.onUpdate?.(event.data);
          break;
        case 'move':
          handlers.onMove?.(event.data);
          break;
        case 'resize':
          handlers.onResize?.(event.data);
          break;
      }
    };

    addEventListener(widgetId, listener);
    return () => removeEventListener(widgetId, listener);
  }, [widgetId, handlers, addEventListener, removeEventListener]);
}

// Hook for creating a new widget
export function useCreateWidget() {
  const addWidget = useWorkspaceStore((state) => state.addWidget);
  
  return addWidget;
}

// Hook for workspace-wide widget operations
export function useWidgets() {
  const widgets = useWorkspaceStore((state) => state.widgets, shallow);
  const removeWidget = useWorkspaceStore((state) => state.removeWidget);
  const resetWorkspace = useWorkspaceStore((state) => state.resetWorkspace);
  
  return {
    widgets,
    removeWidget,
    removeAll: resetWorkspace,
    count: widgets.length
  };
}