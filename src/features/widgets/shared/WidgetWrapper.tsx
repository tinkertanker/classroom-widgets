// New Widget Wrapper component using the centralized store

import React, { useCallback, useRef, useEffect, useState, memo } from 'react';
import { Rnd } from 'react-rnd';
import { clsx } from 'clsx';
import { FaTrash } from 'react-icons/fa6';
import { useWidget, useWidgetDrag } from '../../../shared/hooks/useWidget';
import { useWorkspace } from '../../../shared/hooks/useWorkspace';
import { widgetRegistry } from '../../../services/WidgetRegistry';
import { Position, Size } from '../../../shared/types';
import { debug } from '../../../shared/utils/debug';
import { useWorkspaceStore } from '../../../store/workspaceStore.simple';

interface WidgetWrapperProps {
  widgetId: string;
  children: React.ReactNode;
}

const WidgetWrapper: React.FC<WidgetWrapperProps> = ({ widgetId, children }) => {
  const { widget, move, resize, focus, remove } = useWidget(widgetId);
  const { isBeingDragged, startDrag, stopDrag } = useWidgetDrag(widgetId);
  const { scale } = useWorkspace();
  const rndRef = useRef<any>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const hideTrashTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Only subscribe to setFocusedWidget action, not the focusedWidgetId value
  // This prevents re-renders when other widgets get focused
  const setFocusedWidget = useWorkspaceStore((state) => state.setFocusedWidget);
  
  if (!widget) return null;
  
  const config = widgetRegistry.get(widget.type);
  if (!config) return null;

  const handleDragStart = useCallback(() => {
    startDrag();
    focus();
  }, [startDrag, focus]);

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
    if (rndRef.current && rndRef.current.updatePosition) {
      // Force position update when scale changes
      rndRef.current.updatePosition({ x: widget.position.x, y: widget.position.y });
    }
  }, [scale, widget.position]);
  
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

  const isTransparent = config.features?.isTransparent || false;
  
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
    setFocusedWidget(widgetId);
    focus();
  }, [widgetId, setFocusedWidget, focus]);

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
        // click handler. Add any clickable elements here or use the 'no-drag' class.
        cancel=".no-drag, button, input, textarea, select, a, .clickable, .delete-button"
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
        <div className="w-full h-full relative" onClick={handleWidgetClick}>
          {children}
          {/* Hover trash icon */}
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
        </div>
      </Rnd>
    </div>
  );
};

export default memo(WidgetWrapper);
