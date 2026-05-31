// New Widget Wrapper component using the centralized store

import React, { useCallback, useRef, useEffect, useState, memo } from 'react';
import { Rnd } from 'react-rnd';
import { clsx } from 'clsx';
import { FaTrash, FaXmark } from 'react-icons/fa6';
import { useWidget, useWidgetDrag } from '@shared/hooks/useWidget';
import { useWorkspace } from '@shared/hooks/useWorkspace';
import { widgetRegistry } from '../../../services/WidgetRegistry';
import { Position, Size, WidgetType } from '@shared/types';
import { debug } from '@shared/utils/debug';
import { isDesktopDashboardMode } from '@shared/utils/dashboardMode';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';
import LiquidGlassOverlay from '../../desktop/LiquidGlassOverlay';

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
  const [showTrash, setShowTrash] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const hideTrashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragMovedRef = useRef(false);
  const postDragRef = useRef(false);
  // Only subscribe to setFocusedWidget action, not the focusedWidgetId value
  // This prevents re-renders when other widgets get focused
  const setFocusedWidget = useWorkspaceStore((state) => state.setFocusedWidget);
  const config = widget ? widgetRegistry.get(widget.type) : undefined;
  
  const handleDragStart = useCallback(() => {
    dragMovedRef.current = false;
    startDrag();
    focus();
  }, [startDrag, focus]);

  const handleDrag = useCallback(() => {
    dragMovedRef.current = true;
  }, []);

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
    if (dragMovedRef.current) {
      postDragRef.current = true;
      setTimeout(() => { postDragRef.current = false; }, 0);
    }
  }, [move, stopDrag, remove, widgetId]);

  const handleResizeStart = useCallback(() => {
    setIsResizing(true);
    focus();
  }, [focus]);

  const handleResizeStop = useCallback((e: any, direction: any, ref: any, delta: any, position: Position) => {
    setIsResizing(false);
    const newSize: Size = {
      width: ref.offsetWidth,
      height: ref.offsetHeight
    };
    resize(newSize);
    move(position);
  }, [resize, move]);

  // Handle zoom changes
  useEffect(() => {
    if (widget && rndRef.current && rndRef.current.updatePosition) {
      // Force position update when scale changes
      rndRef.current.updatePosition({ x: widget.position.x, y: widget.position.y });
    }
  }, [scale, widget?.position]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTrashTimeoutRef.current) {
        clearTimeout(hideTrashTimeoutRef.current);
      }
    };
  }, []);

  // Global mouseUp safety listener to clear stuck drag/resize states
  // Only attach listener when actually dragging/resizing (not for every widget)
  useEffect(() => {
    if (!isResizing && !isBeingDragged) return;

    const handleGlobalMouseUp = () => {
      if (isResizing) setIsResizing(false);
      if (isBeingDragged) stopDrag();
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isResizing, isBeingDragged, stopDrag]);

  const isTransparent = config?.features?.isTransparent || false;
  const shouldUseDashboardGlass = isDashboardMode && dashboardVisible && !isTransparent && widget.type !== WidgetType.TIMER;
  
  const wrapperClasses = clsx(
    'widget-wrapper',
    {
      // Only apply transitions when NOT dragging - transitions cause input lag during drag
      'transition-all duration-200': !isBeingDragged && !isResizing,
      'ring-2 ring-sage-500': isBeingDragged && !isTransparent,
      'hover:scale-[1.01]': !isBeingDragged && !isTransparent
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
    if (postDragRef.current) return;
    setFocusedWidget(widgetId);
    focus();
  }, [widgetId, setFocusedWidget, focus]);

  if (!widget) return null;
  if (!config) return null;

  return (
    <div 
      className="relative group"
      onMouseEnter={() => {
        setShowTrash(true);
        // Clear any pending timeout
        if (hideTrashTimeoutRef.current) {
          clearTimeout(hideTrashTimeoutRef.current);
          hideTrashTimeoutRef.current = null;
        }
      }}
      onMouseLeave={() => {
        // Delay hiding the trash button
        hideTrashTimeoutRef.current = setTimeout(() => {
          setShowTrash(false);
        }, 2000);
      }}
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
          data-dashboard-glass={shouldUseDashboardGlass ? 'true' : 'false'}
          onClick={handleWidgetClick}
        >
          {children}
          <LiquidGlassOverlay active={shouldUseDashboardGlass} />
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
