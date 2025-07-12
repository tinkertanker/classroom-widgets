import React, { useState, useRef, useEffect } from 'react';
import { Rnd } from "react-rnd";
import WidgetRendererLazy from './WidgetRendererLazy';
import { WIDGET_TYPES } from "../../constants/widgetTypes";
import { WidgetInstance, WidgetPosition } from "../../types/app.types";

interface WidgetConfig {
  defaultWidth: number;
  defaultHeight: number;
  minWidth: number;
  minHeight: number;
  lockAspectRatio: boolean | number;
}

interface WidgetContainerProps {
  widget: WidgetInstance;
  position: WidgetPosition;
  config: WidgetConfig;
  isActive: boolean;
  isHoveringTrash: boolean;
  savedState: any;
  onDragStart: (e: any, data: any) => void;
  onDrag: (e: any, data: any) => void;
  onDragStop: (e: any, data: any) => void;
  onResizeStart: () => void;
  onResizeStop: (e: any, direction: any, ref: any, delta: any, position: any) => void;
  onTouchStart: () => void;
  onStateChange: (state: any) => void;
  toggleConfetti: (value: boolean) => void;
}

const WidgetContainer: React.FC<WidgetContainerProps> = ({ 
  widget, 
  position, 
  config,
  isActive,
  isHoveringTrash,
  savedState,
  onDragStart,
  onDrag,
  onDragStop,
  onResizeStart,
  onResizeStop,
  onTouchStart,
  onStateChange,
  toggleConfetti
}) => {
  const actualWidth = position.width || config.defaultWidth;
  const actualHeight = position.height || config.defaultHeight;
  
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);

  // Reset hasDragged flag after drag ends
  useEffect(() => {
    if (!isDragging && hasDraggedRef.current) {
      const timer = setTimeout(() => {
        hasDraggedRef.current = false;
      }, 100); // Small delay to ensure click events are blocked
      return () => clearTimeout(timer);
    }
  }, [isDragging]);

  const handleDragStart = (e: any, data: any) => {
    setIsDragging(true);
    dragStartPosRef.current = { x: data.x, y: data.y };
    hasDraggedRef.current = false;
    onDragStart(e, data);
  };

  const handleDrag = (e: any, data: any) => {
    // Check if actually dragged more than a threshold
    const distance = Math.sqrt(
      Math.pow(data.x - dragStartPosRef.current.x, 2) + 
      Math.pow(data.y - dragStartPosRef.current.y, 2)
    );
    if (distance > 5) {
      hasDraggedRef.current = true;
    }
    onDrag(e, data);
  };

  const handleDragStop = (e: any, data: any) => {
    setIsDragging(false);
    onDragStop(e, data);
  };

  return (
    <Rnd
      default={{
        x: position.x,
        y: position.y,
        width: `${actualWidth}px`,
        height: `${actualHeight}px`,
      }}
      minWidth={`${config.minWidth}px`}
      minHeight={`${config.minHeight}px`}
      key={widget.id}
      id={widget.id}
      lockAspectRatio={config.lockAspectRatio}
      bounds="#widget-board"
      style={{
        zIndex: widget.index === WIDGET_TYPES.STAMP 
          ? (isActive ? 999 : 900) // Stickers always 900+
          : (isActive ? 500 : "auto"), // Other widgets max 500
        opacity: isHoveringTrash ? 0.2 : 1,
        transition: "opacity 0.2s ease",
        cursor: isHoveringTrash ? "not-allowed" : "auto"
      }}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragStop={handleDragStop}
      onResizeStart={onResizeStart}
      onResizeStop={onResizeStop}
      onTouchStart={onTouchStart}
    >
      <WidgetRendererLazy
        widgetType={widget.index}
        widgetId={widget.id}
        savedState={savedState}
        isActive={isActive}
        onStateChange={onStateChange}
        toggleConfetti={toggleConfetti}
        isDragging={isDragging}
        hasDragged={hasDraggedRef.current}
      />
    </Rnd>
  );
};

export default WidgetContainer;