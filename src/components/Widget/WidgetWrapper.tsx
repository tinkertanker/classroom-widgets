// New Widget Wrapper component using the centralized store

import React, { useCallback, useRef, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { clsx } from 'clsx';
import { useWidget, useWidgetDrag } from '../../hooks/useWidget';
import { useWorkspace } from '../../hooks/useWorkspace';
import { widgetRegistry } from '../../services/WidgetRegistry';
import { Position, Size } from '../../types';

interface WidgetWrapperProps {
  widgetId: string;
  children: React.ReactNode;
}

const WidgetWrapper: React.FC<WidgetWrapperProps> = ({ widgetId, children }) => {
  const { widget, move, resize, focus } = useWidget(widgetId);
  const { isBeingDragged, startDrag, stopDrag } = useWidgetDrag(widgetId);
  const { scale } = useWorkspace();
  const rndRef = useRef<any>(null);
  
  if (!widget) return null;
  
  const config = widgetRegistry.get(widget.type);
  if (!config) return null;

  const handleDragStart = useCallback(() => {
    startDrag();
    focus();
  }, [startDrag, focus]);

  const handleDragStop = useCallback((e: any, d: any) => {
    const newPosition: Position = { x: d.x, y: d.y };
    move(newPosition);
    stopDrag();
  }, [move, stopDrag]);

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

  const wrapperClasses = clsx(
    'widget-wrapper',
    'transition-shadow duration-200',
    {
      'shadow-lg ring-2 ring-sage-500': isBeingDragged,
      'hover:shadow-md': !isBeingDragged
    }
  );

  return (
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
      cancel=".no-drag, button, input, textarea, select, a, .clickable"
      enableResizing={{
        top: false,
        right: true,
        bottom: true,
        left: false,
        topRight: false,
        bottomRight: true,
        bottomLeft: false,
        topLeft: false
      }}
    >
      <div className="w-full h-full">
        {children}
      </div>
    </Rnd>
  );
};

export default WidgetWrapper;