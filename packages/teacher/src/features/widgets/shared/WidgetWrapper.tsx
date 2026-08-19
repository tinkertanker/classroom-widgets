// New Widget Wrapper component using the centralized store

import React, { useCallback, useRef, useEffect, memo } from 'react';
import { Rnd } from 'react-rnd';
import { clsx } from 'clsx';
import { FaTrash, FaXmark } from 'react-icons/fa6';
import { useWidget, useWidgetDrag } from '@shared/hooks/useWidget';
import { useWorkspace } from '@shared/hooks/useWorkspace';
import { widgetRegistry } from '../../../services/WidgetRegistry';
import { Position, Size } from '@shared/types';
import { debug } from '@shared/utils/debug';
import { isDesktopDashboardMode } from '@shared/utils/dashboardMode';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';
import { useHoverDelay } from './useHoverDelay';
import { useWidgetInteractionState } from './useWidgetInteractionState';

interface WidgetWrapperProps {
  widgetId: string;
  children: React.ReactNode;
  dashboardVisible?: boolean;
}

const WidgetWrapper: React.FC<WidgetWrapperProps> = ({ widgetId, children, dashboardVisible = true }) => {
  const { widget, move, resize, focus, remove } = useWidget(widgetId);
  const { isBeingDragged, startDrag, stopDrag } = useWidgetDrag(widgetId);
  const { scale } = useWorkspace();
  const isDashboardMode = isDesktopDashboardMode();
  const rndRef = useRef<any>(null);
  // Give the pointer a generous 2s to reach the trash button, which sits outside
  // the widget's own bounds on the canvas
  const { visible: showTrash, onMouseEnter, onMouseLeave } = useHoverDelay(2000);
  // One machine for the whole pointer gesture: drag, resize, and whether the
  // click that follows a drag is a real click. `isBeingDragged` above stays the
  // store's answer and is what the render path below keeps reading.
  const {
    isResizing,
    dispatch: dispatchInteraction,
    isClickSuppressed
  } = useWidgetInteractionState();
  // Only subscribe to setFocusedWidget action, not the focusedWidgetId value
  // This prevents re-renders when other widgets get focused
  const setFocusedWidget = useWorkspaceStore((state) => state.setFocusedWidget);
  const config = widget ? widgetRegistry.get(widget.type) : undefined;
  
  const handleDragStart = useCallback(() => {
    dispatchInteraction({ type: 'dragStart' });
    startDrag();
    focus();
  }, [dispatchInteraction, startDrag, focus]);

  const handleDrag = useCallback(() => {
    dispatchInteraction({ type: 'dragMove' });
  }, [dispatchInteraction]);

  const handleDragStop = useCallback((e: any, d: any) => {
    // Read dropTarget directly from store to avoid subscribing to it
    // This prevents re-renders when dropTarget changes during drag
    const currentDropTarget = useWorkspaceStore.getState().dragState.dropTarget;
    if (currentDropTarget === 'trash') {
      debug('[WidgetWrapper] Widget dropped on trash, removing widget:', widgetId);
      // Play trash sound
      (window as any).playTrashSound?.();
      // Remove the widget
      remove();
    } else {
      // Normal drag end - update position
      const newPosition: Position = { x: d.x, y: d.y };
      move(newPosition);
    }
    stopDrag();
    // Entering `postDrag` is what suppresses the click the browser fires next;
    // the machine reopens clicks on its own a tick later.
    dispatchInteraction({ type: 'dragStop' });
  }, [move, stopDrag, remove, widgetId, dispatchInteraction]);

  const handleResizeStart = useCallback(() => {
    dispatchInteraction({ type: 'resizeStart' });
    focus();
  }, [dispatchInteraction, focus]);

  const handleResizeStop = useCallback((e: any, direction: any, ref: any, delta: any, position: Position) => {
    dispatchInteraction({ type: 'resizeStop' });
    const newSize: Size = {
      width: ref.offsetWidth,
      height: ref.offsetHeight
    };
    resize(newSize);
    move(position);
  }, [dispatchInteraction, resize, move]);

  // Handle zoom changes
  useEffect(() => {
    if (widget && rndRef.current && rndRef.current.updatePosition) {
      // Force position update when scale changes
      rndRef.current.updatePosition({ x: widget.position.x, y: widget.position.y });
    }
  }, [scale, widget?.position]);

  // Global mouseUp safety listener to clear stuck drag/resize states
  // Only attach listener when actually dragging/resizing (not for every widget)
  useEffect(() => {
    if (!isResizing && !isBeingDragged) return;

    const handleGlobalMouseUp = () => {
      dispatchInteraction({ type: 'globalMouseUp' });
      if (isBeingDragged) stopDrag();
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isResizing, isBeingDragged, stopDrag, dispatchInteraction]);

  const isTransparent = config?.features?.isTransparent || false;
  
  const wrapperClasses = clsx(
    'widget-wrapper',
    {
      // Only apply transitions when NOT dragging - transitions cause input lag during drag
      'transition-all duration-200': !isBeingDragged && !isResizing,
      'ring-2 ring-sage-500': isBeingDragged && !isTransparent,
      // No hover scale in the macOS overlay: the scaled rect wouldn't match the
      // interactive/glass regions published to native, leaving the blur edge and
      // click-through ring misaligned for the whole hover.
      'hover:scale-[1.01]': !isBeingDragged && !isTransparent && !isDashboardMode
    }
  );

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    debug('[WidgetWrapper] Delete button clicked, removing widget:', widgetId);
    // Play trash sound
    (window as any).playTrashSound?.();
    // Remove the widget
    remove();
  }, [remove, widgetId]);

  const handleWidgetClick = useCallback(() => {
    if (isClickSuppressed()) return;
    setFocusedWidget(widgetId);
    focus();
  }, [widgetId, setFocusedWidget, focus, isClickSuppressed]);

  if (!widget) return null;
  if (!config) return null;
  return (
    <div 
      className="relative group"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <Rnd
        ref={rndRef}
        position={widget.position}
        size={widget.size}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragStop={handleDragStop}
        onResizeStart={handleResizeStart}
        onResizeStop={handleResizeStop}
        disableDragging={isResizing}
        bounds=".board"
        scale={scale}
        minWidth={config.minSize?.width}
        minHeight={config.minSize?.height}
        maxWidth={config.maxSize?.width}
        maxHeight={config.maxSize?.height}
        lockAspectRatio={config.maintainAspectRatio}
        style={{
          zIndex: widget.zIndex + 100,
          cursor: isResizing ? 'nwse-resize' : isBeingDragged ? 'grabbing' : 'grab'
        }}
        className={wrapperClasses}
        // IMPORTANT: The 'cancel' prop prevents react-rnd from starting a drag operation
        // when clicking on interactive elements. Without this, the first click on these
        // elements gets consumed by the drag handler instead of triggering the element's
        // click handler. Add interactive elements here or apply the 'no-drag' class.
        cancel=".no-drag, button, input, textarea, select, a, .delete-button"
        enableResizing={{
          top: true,
          right: true,
          bottom: true,
          left: true,
          topRight: true,
          bottomRight: true,
          bottomLeft: true,
          topLeft: true
        }}
      >
        <div
          className="widget-surface w-full h-full relative"
          onClick={handleWidgetClick}
        >
          {children}
          {isDashboardMode ? (
            <div
              className={`dashboard-widget-chrome no-drag absolute top-2 right-2 flex items-center gap-1 transition-all duration-200 ${
                showTrash && !isBeingDragged ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              data-dashboard-interactive="true"
              style={{ zIndex: 9999 }}
            >
              <button
                onClick={handleDeleteClick}
                className="delete-button no-drag w-7 h-7 rounded-full bg-white/90 dark:bg-warm-gray-800/90 text-warm-gray-600 dark:text-warm-gray-200 border border-warm-gray-200/80 dark:border-warm-gray-600/80 shadow-lg flex items-center justify-center hover:bg-dusty-rose-500 hover:text-white transition-colors"
                title="Close widget"
                aria-label="Close widget"
              >
                <FaXmark className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleDeleteClick}
              className={`delete-button absolute -bottom-8 left-1/2 transform -translate-x-1/2
                         bg-warm-gray-200 dark:bg-warm-gray-600 hover:bg-dusty-rose-500 dark:hover:bg-dusty-rose-500
                         text-warm-gray-500 dark:text-warm-gray-400 hover:text-white p-2 rounded-full
                         shadow-lg transition-all duration-300 ${
                           showTrash && !isBeingDragged ? 'opacity-100' : 'opacity-0 pointer-events-none'
                         }`}
              style={{ zIndex: 9999 }}
              title="Delete widget"
            >
              <FaTrash className="w-3 h-3" />
            </button>
          )}
        </div>
      </Rnd>
    </div>
  );
};

export default memo(WidgetWrapper);
