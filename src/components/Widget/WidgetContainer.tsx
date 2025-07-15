import React, { useState, useRef, useEffect } from 'react';
import { Rnd } from "react-rnd";
import WidgetRendererLazy from './WidgetRendererLazy';
import { WIDGET_TYPES } from "../../constants/widgetTypes";
import { WidgetInstance, WidgetPosition } from "../../types/app.types";
import { FaTrash } from 'react-icons/fa6';
import trashSound from "../../sounds/trash-crumple.mp3";

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
  onClick?: () => void;
  onDelete?: () => void;
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
  toggleConfetti,
  onClick,
  onDelete
}) => {
  const actualWidth = position.width || config.defaultWidth;
  const actualHeight = position.height || config.defaultHeight;
  
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset hasDragged flag after drag ends
  useEffect(() => {
    if (!isDragging && hasDraggedRef.current) {
      const timer = setTimeout(() => {
        hasDraggedRef.current = false;
      }, 100); // Small delay to ensure click events are blocked
      return () => clearTimeout(timer);
    }
  }, [isDragging]);

  // Show/hide trash icon based on interaction
  useEffect(() => {
    const shouldShow = isActive || isDragging || isHovered;
    
    if (shouldShow) {
      setShowTrash(true);
      // Clear any existing timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      // Set new timeout to hide after 5 seconds
      hideTimeoutRef.current = setTimeout(() => {
        setShowTrash(false);
      }, 5000);
    } else {
      // Immediately hide if no interaction
      setShowTrash(false);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    }

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [isActive, isDragging, isHovered]);

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

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Play crumple sound
    const audio = new Audio(trashSound);
    audio.play().catch(() => {});
    if (onDelete) {
      onDelete();
    }
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
        cursor: isHoveringTrash ? "not-allowed" : "move"
      }}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragStop={handleDragStop}
      onResizeStart={onResizeStart}
      onResizeStop={onResizeStop}
      onTouchStart={onTouchStart}
    >
      <div 
        className="relative w-full h-full"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div 
          className="w-full h-full"
        onClick={(e) => {
          // Only trigger if we haven't dragged
          if (!hasDraggedRef.current && onClick) {
            e.stopPropagation();
            onClick();
          }
        }}
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
        </div>
        
        {/* Per-widget trash icon */}
        <button
          onClick={handleDeleteClick}
          className={`absolute -bottom-10 left-1/2 transform -translate-x-1/2 
                     w-8 h-8 bg-warm-gray-200 hover:bg-warm-gray-300 dark:bg-warm-gray-700 dark:hover:bg-warm-gray-600
                     rounded-full flex items-center justify-center 
                     shadow-md hover:shadow-lg
                     transition-all duration-500 ease-in-out
                     ${showTrash ? 'opacity-90 scale-100 hover:opacity-100 hover:scale-110' : 'opacity-0 scale-95'}`}
          style={{
            pointerEvents: showTrash ? 'auto' : 'none'
          }}
        >
          <FaTrash className="text-warm-gray-600 dark:text-warm-gray-300 text-sm" />
        </button>
      </div>
    </Rnd>
  );
};

export default WidgetContainer;