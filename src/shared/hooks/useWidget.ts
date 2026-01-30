// Widget-specific hooks for easy state management

import { useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import { useWorkspaceStore } from '../../store/workspaceStore.simple';
import { WidgetInstance, Position, Size, WidgetType } from '../types';
import { findAvailablePosition } from '../utils/widgetHelpers';
import { widgetRegistry } from '../../services/WidgetRegistry';

// Hook for individual widget instances
export function useWidget(widgetId: string) {
  const widget = useWorkspaceStore(
    useCallback((state) => state.widgets.find(w => w.id === widgetId), [widgetId])
  );
  const widgetState = useWorkspaceStore(
    useCallback((state) => state.widgetStates.get(widgetId), [widgetId])
  );
  
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
    useShallow((state) => state.dragState)
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
  const widgets = useWorkspaceStore(useShallow((state) => state.widgets));
  const scale = useWorkspaceStore((state) => state.scale);
  
  const createWidget = useCallback((type: WidgetType, position?: Position) => {
    // If position is provided, use it
    if (position) {
      return addWidget(type, position);
    }
    
    // Get widget default size from registry
    const widgetConfig = widgetRegistry.get(type);
    const widgetSize = widgetConfig?.defaultSize || { width: 350, height: 350 };
    
    // Calculate position based on viewport
    const boardContainer = document.querySelector('.board-scroll-container') as HTMLElement;
    if (boardContainer) {
      const scrollLeft = boardContainer.scrollLeft;
      const scrollTop = boardContainer.scrollTop;
      const viewportWidth = boardContainer.clientWidth;
      const viewportHeight = boardContainer.clientHeight;
      
      // Create viewport info for findAvailablePosition
      const viewport = {
        x: scrollLeft / scale,
        y: scrollTop / scale,
        width: viewportWidth / scale,
        height: viewportHeight / scale
      };
      
      // Create widget positions map with size info
      const widgetPositions = new Map();
      widgets.forEach(widget => {
        const widgetConfig = widgetRegistry.get(widget.type);
        const size = widget.size || widgetConfig?.defaultSize || { width: 350, height: 350 };
        widgetPositions.set(widget.id, {
          x: widget.position.x,
          y: widget.position.y,
          width: size.width,
          height: size.height
        });
      });
      
      // Find available position that minimizes overlap
      const availablePosition = findAvailablePosition(
        widgetSize.width,
        widgetSize.height,
        widgetPositions,
        scale,
        viewport
      );
      
      return addWidget(type, availablePosition);
    }
    
    // Fallback to default position
    return addWidget(type);
  }, [addWidget, widgets, scale]);
  
  return createWidget;
}

// Hook for workspace-wide widget operations
export function useWidgets() {
  const widgets = useWorkspaceStore(useShallow((state) => state.widgets));
  const removeWidget = useWorkspaceStore((state) => state.removeWidget);
  const resetWorkspace = useWorkspaceStore((state) => state.resetWorkspace);
  
  return {
    widgets,
    removeWidget,
    removeAll: resetWorkspace,
    count: widgets.length
  };
}