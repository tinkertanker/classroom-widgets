// New Widget Wrapper component using the centralized store

import React, { useCallback, useRef, useEffect, useState, memo } from 'react';
import { Rnd } from 'react-rnd';
import { clsx } from 'clsx';
import { FaTrash } from 'react-icons/fa6';
import { useWidget, useWidgetDrag } from '../../../shared/hooks/useWidget';
import { useWorkspace, useDragAndDrop } from '../../../shared/hooks/useWorkspace';
import { widgetRegistry } from '../../../services/WidgetRegistry';
import { Position, Size } from '../../../shared/types';

interface WidgetWrapperProps {
  widgetId: string;
  children: React.ReactNode;
}

const WidgetWrapper: React.FC<WidgetWrapperProps> = ({ widgetId, children }) => {
  const { widget, move, resize, focus, remove } = useWidget(widgetId);
  const { isBeingDragged, startDrag, stopDrag } = useWidgetDrag(widgetId);
  const { scale } = useWorkspace();
  const { dropTarget } = useDragAndDrop();
  const rndRef = useRef<any>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const hideTrashTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  if (!widget) return null;
  
  const config = widgetRegistry.get(widget.type);
  if (!config) return null;

  const handleDragStart = useCallback(() => {
    startDrag();
    focus();
  }, [startDrag, focus]);

  const handleDragStop = useCallback((e: any, d: any) => {
    if (dropTarget === 'trash') {
      console.log('[WidgetWrapper] Widget dropped on trash, removing widget:', widgetId);
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
  }, [move, stopDrag, dropTarget, remove, widgetId]);

  const handleResizeStop = useCallback((e: any, direction: any, ref: any, delta: any, position: Position) => {
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

  const isTransparent = config.features?.isTransparent || false;
  
  const wrapperClasses = clsx(
    'widget-wrapper',
    'transition-shadow duration-200',
    {
      'shadow-lg ring-2 ring-sage-500': isBeingDragged && !isTransparent,
      'hover:shadow-md': !isBeingDragged && !isTransparent
    }
  );

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('[WidgetWrapper] Delete button clicked, removing widget:', widgetId);
    // Play trash sound
    (window as any).playTrashSound?.();
    // Remove the widget
    remove();
  }, [remove, widgetId]);

  return (
    <div 
      className="relative group"
      onMouseEnter={() => {
        setIsHovered(true);
        setShowTrash(true);
        // Clear any pending timeout
        if (hideTrashTimeoutRef.current) {
          clearTimeout(hideTrashTimeoutRef.current);
          hideTrashTimeoutRef.current = null;
        }
      }}
      onMouseLeave={() => {
        setIsHovered(false);
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
        onResizeStop={handleResizeStop}
        bounds=".board"
        scale={scale}
        minWidth={config.minSize?.width}
        minHeight={config.minSize?.height}
        maxWidth={config.maxSize?.width}
        maxHeight={config.maxSize?.height}
        lockAspectRatio={config.maintainAspectRatio}
        style={{
          zIndex: widget.zIndex + 100,
          cursor: isBeingDragged ? 'grabbing' : 'grab'
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
        <div className="w-full h-full relative">
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