import React, { useState, useRef, useEffect } from 'react';
import { Rnd } from "react-rnd";
import WidgetRenderer from './WidgetRenderer';
import { WIDGET_TYPES } from "../../constants/widgetTypes";

const WidgetContainer = ({ 
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

  const handleDragStart = (e, data) => {
    setIsDragging(true);
    dragStartPosRef.current = { x: data.x, y: data.y };
    hasDraggedRef.current = false;
    onDragStart(e, data);
  };

  const handleDrag = (e, data) => {
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

  const handleDragStop = (e, data) => {
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
      enableUserSelectHack={true}
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
      <WidgetRenderer
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