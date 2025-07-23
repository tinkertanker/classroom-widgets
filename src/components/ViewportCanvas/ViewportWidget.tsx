import React from 'react';
import { Rnd } from 'react-rnd';
import WidgetRendererLazy from '../Widget/WidgetRendererLazy';
import { WIDGET_TYPES } from '../../constants/widgetTypes';

interface ViewportWidgetProps {
  widgetId: string;
  widgetType: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
  isActive: boolean;
  savedState: any;
  scale: number;
  onDragStop: (e: any, data: any) => void;
  onResizeStop: (e: any, direction: any, ref: any, delta: any, position: any) => void;
  onClick: () => void;
  onStateChange: (state: any) => void;
  onRemove: () => void;
  minWidth?: number;
  minHeight?: number;
  lockAspectRatio?: boolean | number;
}

export const ViewportWidget: React.FC<ViewportWidgetProps> = ({
  widgetId,
  widgetType,
  position,
  size,
  isActive,
  savedState,
  scale,
  onDragStop,
  onResizeStop,
  onClick,
  onStateChange,
  onRemove,
  minWidth = 200,
  minHeight = 200,
  lockAspectRatio = false
}) => {
  // Calculate scaled bounds for dragging
  const bounds = {
    left: 0,
    top: 0,
    right: 3000 - size.width,
    bottom: 2000 - size.height
  };

  return (
    <Rnd
      position={position}
      size={size}
      onDragStop={onDragStop}
      onResizeStop={onResizeStop}
      bounds={bounds}
      minWidth={minWidth}
      minHeight={minHeight}
      lockAspectRatio={lockAspectRatio}
      enableResizing={isActive}
      disableDragging={false}
      className={`widget-item ${isActive ? 'ring-2 ring-sage-500' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        zIndex: isActive ? 1000 : 100
      }}
    >
      <div className="w-full h-full">
        <WidgetRendererLazy
          index={widgetType}
          widgetId={widgetId}
          savedState={savedState}
          onStateChange={onStateChange}
        />
      </div>
    </Rnd>
  );
};