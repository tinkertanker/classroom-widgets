import React from 'react';
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
      onDragStart={onDragStart}
      onDrag={onDrag}
      onDragStop={onDragStop}
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
      />
    </Rnd>
  );
};

export default WidgetContainer;