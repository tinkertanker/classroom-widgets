import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import { isOverTrash } from '../../utils/widgetHelpers';
import trashSound from '../../sounds/trash-crumple.mp3';
import { FaTrash } from 'react-icons/fa6';

interface DraggableWidgetProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  isActive: boolean;
  canResize?: boolean;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  lockAspectRatio?: boolean | number;
  onPositionChange: (x: number, y: number) => void;
  onSizeChange: (width: number, height: number) => void;
  onClick: () => void;
  onRemove?: () => void;
  children: React.ReactNode | ((isDragging: boolean, hasDragged: boolean) => React.ReactNode);
}

type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

const DraggableWidgetComponent: React.FC<DraggableWidgetProps> = ({
  id,
  x,
  y,
  width,
  height,
  scale,
  isActive,
  canResize = true,
  minWidth = 100,
  minHeight = 100,
  maxWidth = 1000,
  maxHeight = 1000,
  lockAspectRatio = false,
  onPositionChange,
  onSizeChange,
  onClick,
  onRemove,
  children
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
  const [isOverTrashState, setIsOverTrashState] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Ref to the widget element for direct DOM manipulation
  const widgetRef = useRef<HTMLDivElement>(null);
  
  // Store the actual position/size in refs to avoid state updates during drag
  const positionRef = useRef({ x, y });
  const sizeRef = useRef({ width, height });
  
  // Update refs when props change
  useEffect(() => {
    if (!isDragging && !isResizing) {
      positionRef.current = { x, y };
      sizeRef.current = { width, height };
      // Update DOM directly
      if (widgetRef.current) {
        widgetRef.current.style.transform = `translate(${x}px, ${y}px)`;
        widgetRef.current.style.width = `${width}px`;
        widgetRef.current.style.height = `${height}px`;
      }
    }
  }, [x, y, width, height, isDragging, isResizing]);
  
  const dragStart = useRef({ x: 0, y: 0, widgetX: 0, widgetY: 0 });
  const resizeStart = useRef({ 
    x: 0, 
    y: 0, 
    widgetX: 0, 
    widgetY: 0, 
    widgetWidth: 0, 
    widgetHeight: 0,
    aspectRatio: 1
  });
  
  // Track if mouse has moved (to distinguish click from drag)
  const hasDraggedRef = useRef(false);
  const DRAG_THRESHOLD = 3; // pixels
  
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
      // Add a delay before hiding when hovering out
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      // Wait 1.5 seconds before hiding the trash icon
      hideTimeoutRef.current = setTimeout(() => {
        setShowTrash(false);
      }, 1500);
    }

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [isActive, isDragging, isHovered]);

  // Handle drag start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    
    // Don't start drag if clicking on resize handle
    const target = e.target as HTMLElement;
    if (target.classList.contains('resize-handle')) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(true);
    hasDraggedRef.current = false;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      widgetX: x,
      widgetY: y
    };
    
    // Always make widget active when starting interaction (click or drag)
    onClick();
  }, [x, y, onClick]);

  // Handle resize start
  const handleResizeMouseDown = useCallback((handle: ResizeHandle) => (e: React.MouseEvent) => {
    if (e.button !== 0 || !canResize) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    setResizeHandle(handle);
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      widgetX: x,
      widgetY: y,
      widgetWidth: width,
      widgetHeight: height,
      aspectRatio: width / height
    };
    
    // Still call onClick to maintain active state when resizing
    onClick();
  }, [x, y, width, height, canResize, onClick]);


  // Handle mouse move
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging && widgetRef.current) {
      const deltaX = (e.clientX - dragStart.current.x) / scale;
      const deltaY = (e.clientY - dragStart.current.y) / scale;
      
      // Check if mouse has moved beyond threshold
      if (!hasDraggedRef.current && 
          (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD)) {
        hasDraggedRef.current = true;
      }
      
      const newX = Math.max(0, Math.min(3000 - sizeRef.current.width, dragStart.current.widgetX + deltaX));
      const newY = Math.max(0, Math.min(2000 - sizeRef.current.height, dragStart.current.widgetY + deltaY));
      
      // Update position ref
      positionRef.current = { x: newX, y: newY };
      
      // Use transform for better performance
      widgetRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
      
      // Check if over trash
      const overTrash = isOverTrash(e.clientX, e.clientY);
      setIsOverTrashState(overTrash);
      
      // Update trash visual state
      const trashElement = document.getElementById('trash');
      if (trashElement) {
        if (overTrash) {
          trashElement.classList.add('bg-dusty-rose-500', 'transform', 'scale-105');
          trashElement.classList.remove('bg-soft-white/80', 'dark:bg-warm-gray-800/80');
        } else {
          trashElement.classList.remove('bg-dusty-rose-500', 'transform', 'scale-105');
          trashElement.classList.add('bg-soft-white/80', 'dark:bg-warm-gray-800/80');
        }
      }
    } else if (isResizing && resizeHandle && widgetRef.current) {
      const deltaX = (e.clientX - resizeStart.current.x) / scale;
      const deltaY = (e.clientY - resizeStart.current.y) / scale;
      
      let newX = resizeStart.current.widgetX;
      let newY = resizeStart.current.widgetY;
      let newWidth = resizeStart.current.widgetWidth;
      let newHeight = resizeStart.current.widgetHeight;
      
      // Calculate new dimensions based on handle
      switch (resizeHandle) {
        case 'e':
          newWidth = resizeStart.current.widgetWidth + deltaX;
          break;
        case 'w':
          newWidth = resizeStart.current.widgetWidth - deltaX;
          newX = resizeStart.current.widgetX + deltaX;
          break;
        case 's':
          newHeight = resizeStart.current.widgetHeight + deltaY;
          break;
        case 'n':
          newHeight = resizeStart.current.widgetHeight - deltaY;
          newY = resizeStart.current.widgetY + deltaY;
          break;
        case 'se':
          newWidth = resizeStart.current.widgetWidth + deltaX;
          newHeight = resizeStart.current.widgetHeight + deltaY;
          break;
        case 'sw':
          newWidth = resizeStart.current.widgetWidth - deltaX;
          newHeight = resizeStart.current.widgetHeight + deltaY;
          newX = resizeStart.current.widgetX + deltaX;
          break;
        case 'ne':
          newWidth = resizeStart.current.widgetWidth + deltaX;
          newHeight = resizeStart.current.widgetHeight - deltaY;
          newY = resizeStart.current.widgetY + deltaY;
          break;
        case 'nw':
          newWidth = resizeStart.current.widgetWidth - deltaX;
          newHeight = resizeStart.current.widgetHeight - deltaY;
          newX = resizeStart.current.widgetX + deltaX;
          newY = resizeStart.current.widgetY + deltaY;
          break;
      }
      
      // Apply aspect ratio lock if needed
      if (lockAspectRatio) {
        const aspectRatio = typeof lockAspectRatio === 'number' 
          ? lockAspectRatio 
          : resizeStart.current.aspectRatio;
        
        if (resizeHandle.includes('e') || resizeHandle.includes('w')) {
          newHeight = newWidth / aspectRatio;
        } else {
          newWidth = newHeight * aspectRatio;
        }
      }
      
      // Apply constraints
      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
      
      // Ensure widget stays within bounds
      if (newX !== resizeStart.current.widgetX) {
        newX = Math.max(0, Math.min(3000 - newWidth, newX));
      }
      if (newY !== resizeStart.current.widgetY) {
        newY = Math.max(0, Math.min(2000 - newHeight, newY));
      }
      
      // Update refs
      positionRef.current = { x: newX, y: newY };
      sizeRef.current = { width: newWidth, height: newHeight };
      
      // Use transform for position, direct style for size
      widgetRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
      widgetRef.current.style.width = `${newWidth}px`;
      widgetRef.current.style.height = `${newHeight}px`;
    }
  }, [isDragging, isResizing, resizeHandle, scale, 
      minWidth, minHeight, maxWidth, maxHeight, lockAspectRatio]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    // We now handle deletion via the trash button, not drag-to-trash
    // Just reset the visual state of the toolbar trash
    const trashElement = document.getElementById('trash');
    if (trashElement) {
      trashElement.classList.remove('bg-dusty-rose-500', 'transform', 'scale-105');
      trashElement.classList.add('bg-soft-white/80', 'dark:bg-warm-gray-800/80');
    }
    
    // No need to handle click here since we already called onClick on mouse down
    
    // Send final position/size to parent only when drag/resize ends
    if (isDragging && hasDraggedRef.current) {
      onPositionChange(positionRef.current.x, positionRef.current.y);
    }
    if (isResizing) {
      onPositionChange(positionRef.current.x, positionRef.current.y);
      onSizeChange(sizeRef.current.width, sizeRef.current.height);
    }
    
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
    setIsOverTrashState(false);
  }, [isDragging, isResizing, isOverTrashState, onRemove, onPositionChange, onSizeChange]);

  // Add global event listeners
  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  const resizeHandles: ResizeHandle[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

  return (
    <div
      ref={widgetRef}
      className={`widget-item absolute ${
        isActive ? 'ring-1 ring-sage-400/30' : ''
      } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${
        isOverTrashState ? 'opacity-50 scale-95' : ''
      } ${isDragging || isResizing ? '' : 'transition-all duration-200'}`}
      style={{
        transform: `translate(${x}px, ${y}px)`,
        width: `${width}px`,
        height: `${height}px`,
        zIndex: isActive ? 1000 : 100,
        userSelect: 'none',
        willChange: isDragging || isResizing ? 'transform' : 'auto'
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {typeof children === 'function' ? children(isDragging, hasDraggedRef.current) : children}
      
      {/* Resize handles */}
      {isActive && canResize && (
        <>
          {resizeHandles.map(handle => (
            <div
              key={handle}
              className={`resize-handle resize-handle-${handle} absolute bg-warm-gray-400/50 hover:bg-sage-500/70 transition-all duration-200 rounded-full`}
              onMouseDown={handleResizeMouseDown(handle)}
              style={{
                ...getHandleStyle(handle),
                cursor: getCursor(handle)
              }}
            />
          ))}
        </>
      )}
      
      {/* Per-widget trash icon */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (onRemove) {
            // Play trash sound
            const trashAudio = new Audio(trashSound);
            trashAudio.play().catch(error => {
              console.error("Error playing trash sound:", error);
            });
            onRemove();
          }
        }}
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
  );
};

// Helper functions for resize handles
function getHandleStyle(handle: ResizeHandle): React.CSSProperties {
  const size = 6;
  const offset = -size / 2;
  
  switch (handle) {
    case 'n':
      return { top: offset, left: '50%', transform: 'translateX(-50%)', width: size * 4, height: size };
    case 'ne':
      return { top: offset, right: offset, width: size, height: size };
    case 'e':
      return { top: '50%', right: offset, transform: 'translateY(-50%)', width: size, height: size * 4 };
    case 'se':
      return { bottom: offset, right: offset, width: size, height: size };
    case 's':
      return { bottom: offset, left: '50%', transform: 'translateX(-50%)', width: size * 4, height: size };
    case 'sw':
      return { bottom: offset, left: offset, width: size, height: size };
    case 'w':
      return { top: '50%', left: offset, transform: 'translateY(-50%)', width: size, height: size * 4 };
    case 'nw':
      return { top: offset, left: offset, width: size, height: size };
    default:
      return {};
  }
}

function getCursor(handle: ResizeHandle): string {
  switch (handle) {
    case 'n':
    case 's':
      return 'ns-resize';
    case 'e':
    case 'w':
      return 'ew-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
    case 'nw':
    case 'se':
      return 'nwse-resize';
    default:
      return 'move';
  }
}

// Memoize the component to prevent re-renders when other widgets move
export const DraggableWidget = memo(DraggableWidgetComponent, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return (
    prevProps.id === nextProps.id &&
    prevProps.x === nextProps.x &&
    prevProps.y === nextProps.y &&
    prevProps.width === nextProps.width &&
    prevProps.height === nextProps.height &&
    prevProps.scale === nextProps.scale &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.canResize === nextProps.canResize &&
    prevProps.minWidth === nextProps.minWidth &&
    prevProps.minHeight === nextProps.minHeight &&
    prevProps.maxWidth === nextProps.maxWidth &&
    prevProps.maxHeight === nextProps.maxHeight &&
    prevProps.lockAspectRatio === nextProps.lockAspectRatio
  );
});