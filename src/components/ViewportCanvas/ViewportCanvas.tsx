import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { DraggableWidget } from './DraggableWidget';
import WidgetRendererLazy from '../Widget/WidgetRendererLazy';
import { getWidgetConfig } from '../../constants/widgetConfigs';

interface ViewportCanvasProps {
  background?: React.ReactNode;
  scale: number;
  onScaleChange: (scale: number) => void;
  widgets: Array<{
    id: string;
    type: number;
    position: { x: number; y: number };
    size: { width: number; height: number };
  }>;
  activeWidgetId: string | null;
  widgetStates: Map<string, any>;
  widgetConfigs?: Map<number, any>; // Optional widget configs for constraints
  stickerMode?: boolean;
  onCanvasClick?: (x: number, y: number) => void;
  onToggleConfetti?: (value: boolean) => void;
  onWidgetStateChange: (widgetId: string, state: any) => void;
  onWidgetRemove: (id: string) => void;
  onWidgetClick: (id: string) => void;
  onWidgetPositionChange: (id: string, position: { x: number; y: number }) => void;
  onWidgetSizeChange: (id: string, size: { width: number; height: number }) => void;
}

interface Viewport {
  x: number;      // Top-left x position in canvas coordinates
  y: number;      // Top-left y position in canvas coordinates
  width: number;  // Width of viewport in canvas coordinates
  height: number; // Height of viewport in canvas coordinates
}

// Canvas dimensions in logical units
const CANVAS_WIDTH = 3000;
const CANVAS_HEIGHT = 2000;

export const ViewportCanvas: React.FC<ViewportCanvasProps> = ({
  background,
  scale,
  onScaleChange,
  widgets,
  activeWidgetId,
  widgetStates,
  stickerMode = false,
  onCanvasClick,
  onToggleConfetti,
  onWidgetStateChange,
  onWidgetRemove,
  onWidgetClick,
  onWidgetPositionChange,
  onWidgetSizeChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [viewport, setViewport] = useState<Viewport>({
    x: 0,
    y: 0,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT
  });
  
  // Track if we're panning
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, viewportX: 0, viewportY: 0 });

  // Update container size on mount and resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Update viewport size based on scale
  useEffect(() => {
    if (containerSize.width > 0 && containerSize.height > 0) {
      // As scale increases, viewport gets smaller (zoomed in)
      // As scale decreases, viewport gets larger (zoomed out)
      const viewportWidth = containerSize.width / scale;
      const viewportHeight = containerSize.height / scale;

      setViewport(prev => ({
        ...prev,
        width: Math.min(viewportWidth, CANVAS_WIDTH),
        height: Math.min(viewportHeight, CANVAS_HEIGHT)
      }));
    }
  }, [scale, containerSize]);

  // Constrain viewport to canvas bounds
  const constrainViewport = useCallback((vp: Viewport): Viewport => {
    return {
      x: Math.max(0, Math.min(vp.x, CANVAS_WIDTH - vp.width)),
      y: Math.max(0, Math.min(vp.y, CANVAS_HEIGHT - vp.height)),
      width: vp.width,
      height: vp.height
    };
  }, []);

  // Handle mouse wheel for zoom and trackpad pan
  const handleWheel = useCallback((e: WheelEvent) => {
    // Check if the event target or any of its parents is scrollable
    const isScrollableElement = (element: HTMLElement | null): boolean => {
      while (element) {
        const style = window.getComputedStyle(element);
        const isScrollable = (
          (element.scrollHeight > element.clientHeight && (style.overflowY === 'auto' || style.overflowY === 'scroll')) ||
          (element.scrollWidth > element.clientWidth && (style.overflowX === 'auto' || style.overflowX === 'scroll'))
        );
        
        if (isScrollable) {
          // Additional check: only consider it scrollable if it actually has scroll content
          const hasVerticalScroll = element.scrollHeight > element.clientHeight;
          const hasHorizontalScroll = element.scrollWidth > element.clientWidth;
          if ((hasVerticalScroll && Math.abs(e.deltaY) > Math.abs(e.deltaX)) ||
              (hasHorizontalScroll && Math.abs(e.deltaX) > Math.abs(e.deltaY))) {
            return true;
          }
        }
        
        // Stop at widget boundaries to prevent scrolling from affecting the canvas
        if (element.classList.contains('widget-item')) {
          break;
        }
        
        element = element.parentElement;
      }
      return false;
    };
    
    // If this is a two-finger scroll on a scrollable element, let it scroll naturally
    if (!e.ctrlKey && isScrollableElement(e.target as HTMLElement)) {
      return; // Don't prevent default, let the element scroll
    }
    
    e.preventDefault();
    
    // Check if this is a pinch zoom gesture (ctrl key is pressed on trackpad pinch)
    if (e.ctrlKey) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Different sensitivities for different zoom methods
      let sensitivity: number;
      
      // Detect zoom method:
      // 1. deltaMode 0 = pixels (usually trackpad)
      // 2. deltaMode 1 = lines (usually mouse wheel)
      // 3. deltaMode 2 = pages (rare)
      // Also, pinch gestures tend to have fractional deltaY values
      const isTrackpadPinch = e.deltaMode === 0 && e.deltaY % 1 !== 0;
      const isMouseWheel = e.deltaMode === 1 || (e.deltaMode === 0 && e.deltaY % 1 === 0);
      
      if (isTrackpadPinch) {
        // Trackpad pinch - smooth zooming
        sensitivity = 0.01;
        console.log('Zoom method: Trackpad pinch', { deltaY: e.deltaY, deltaMode: e.deltaMode });
      } else if (isMouseWheel) {
        // Ctrl/Cmd + mouse wheel - stepped zooming
        sensitivity = 0.005;
        console.log('Zoom method: Mouse wheel', { deltaY: e.deltaY, deltaMode: e.deltaMode });
      } else {
        // Fallback
        sensitivity = 0.008;
        console.log('Zoom method: Unknown', { deltaY: e.deltaY, deltaMode: e.deltaMode });
      }
      
      // Calculate zoom with exponential scaling for more natural feel
      const delta = e.deltaY * -sensitivity;
      const zoomFactor = Math.exp(delta);
      const newScale = Math.min(Math.max(0.5, scale * zoomFactor), 2);
      
      if (newScale !== scale) {
        // Calculate the point in canvas coordinates under the mouse
        const canvasX = viewport.x + (mouseX / containerSize.width) * viewport.width;
        const canvasY = viewport.y + (mouseY / containerSize.height) * viewport.height;
        
        // Calculate new viewport size
        const newViewportWidth = containerSize.width / newScale;
        const newViewportHeight = containerSize.height / newScale;
        
        // Calculate new viewport position to keep the canvas point under the mouse
        const newViewportX = canvasX - (mouseX / containerSize.width) * newViewportWidth;
        const newViewportY = canvasY - (mouseY / containerSize.height) * newViewportHeight;
        
        setViewport(constrainViewport({
          x: newViewportX,
          y: newViewportY,
          width: Math.min(newViewportWidth, CANVAS_WIDTH),
          height: Math.min(newViewportHeight, CANVAS_HEIGHT)
        }));
        
        onScaleChange(newScale);
      }
    } else {
      // This is a two-finger pan (or regular mouse wheel)
      // Use deltaX and deltaY to pan
      const panSpeed = 1;
      const deltaX = e.deltaX * panSpeed / scale;
      const deltaY = e.deltaY * panSpeed / scale;
      
      setViewport(prev => constrainViewport({
        x: prev.x + deltaX,
        y: prev.y + deltaY,
        width: prev.width,
        height: prev.height
      }));
    }
  }, [scale, onScaleChange, viewport, containerSize, constrainViewport]);

  // Handle pan start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Check if clicking on canvas background (not on a widget)
    const target = e.target as HTMLElement;
    const isCanvasClick = target.closest('.viewport-canvas-content') && !target.closest('.widget-item');
    const isOutsideCanvas = !target.closest('.viewport-canvas-content');
    
    // If clicking outside canvas content entirely, deselect widget
    if (isOutsideCanvas && activeWidgetId) {
      onWidgetClick(null);
    }
    
    // Pan with left button on canvas, middle mouse button, or left button with space/cmd key
    if ((e.button === 0 && isCanvasClick) || e.button === 1 || (e.button === 0 && (e.metaKey || e.ctrlKey))) {
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        viewportX: viewport.x,
        viewportY: viewport.y
      };
      e.preventDefault();
    }
  }, [viewport, activeWidgetId, onWidgetClick]);

  // Handle pan move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;

    const deltaX = (e.clientX - panStartRef.current.x) / scale;
    const deltaY = (e.clientY - panStartRef.current.y) / scale;

    setViewport(constrainViewport({
      x: panStartRef.current.viewportX - deltaX,
      y: panStartRef.current.viewportY - deltaY,
      width: viewport.width,
      height: viewport.height
    }));
  }, [isPanning, scale, viewport.width, viewport.height, constrainViewport]);

  // Handle pan end
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Add wheel listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Calculate transform for the canvas content
  const canvasTransform = `translate(${-viewport.x * scale}px, ${-viewport.y * scale}px) scale(${scale})`;
  
  // Count visible widgets for debug info
  let visibleWidgetCount = 0;

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen overflow-hidden bg-warm-gray-100"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: isPanning ? 'grabbing' : stickerMode ? 'crosshair' : 'default' }}
    >

      {/* Canvas container */}
      <div
        className="absolute origin-top-left viewport-canvas-content"
        style={{
          transform: canvasTransform,
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT
        }}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          const isClickOnWidget = target.closest('.widget-item');
          
          if (!isClickOnWidget) {
            // Clicking on background - deselect active widget
            if (activeWidgetId) {
              onWidgetClick(null);
            }
            
            // Handle sticker mode
            if (stickerMode && onCanvasClick) {
              // Convert click position to canvas coordinates
              const rect = containerRef.current?.getBoundingClientRect();
              if (rect) {
                const clickX = (e.clientX - rect.left) / scale + viewport.x;
                const clickY = (e.clientY - rect.top) / scale + viewport.y;
                onCanvasClick(clickX, clickY);
              }
            }
          }
        }}
      >
        {/* Background */}
        <div 
          className="absolute inset-0"
          onClick={(e) => {
            // Only deselect if clicking directly on background, not bubbled from widget
            if (e.target === e.currentTarget && activeWidgetId) {
              onWidgetClick(null);
            }
          }}
        >
          {background}
        </div>

        {/* Widgets */}
        {widgets.map((widget) => {
          // Viewport culling - check if widget is visible
          const isVisible = (
            widget.position.x + widget.size.width >= viewport.x &&
            widget.position.x <= viewport.x + viewport.width &&
            widget.position.y + widget.size.height >= viewport.y &&
            widget.position.y <= viewport.y + viewport.height
          );
          
          if (!isVisible) {
            return null; // Don't render widgets outside viewport
          }
          
          visibleWidgetCount++;
          
          // Get widget config for constraints
          const config = getWidgetConfig(widget.type);
          
          return (
            <DraggableWidget
              key={widget.id}
              id={widget.id}
              x={widget.position.x}
              y={widget.position.y}
              width={widget.size.width}
              height={widget.size.height}
              scale={scale}
              isActive={activeWidgetId === widget.id}
              minWidth={config.minWidth}
              minHeight={config.minHeight}
              maxWidth={config.maxWidth}
              maxHeight={config.maxHeight}
              lockAspectRatio={config.lockAspectRatio}
              onPositionChange={(x, y) => onWidgetPositionChange(widget.id, { x, y })}
              onSizeChange={(width, height) => onWidgetSizeChange(widget.id, { width, height })}
              onClick={() => onWidgetClick(widget.id)}
              onRemove={() => onWidgetRemove(widget.id)}
            >
              {(isDragging: boolean, hasDragged: boolean) => (
                <div className="w-full h-full">
                  <WidgetRendererLazy
                    widgetType={widget.type}
                    widgetId={widget.id}
                    savedState={widgetStates.get(widget.id)}
                    isActive={activeWidgetId === widget.id}
                    onStateChange={(state) => onWidgetStateChange(widget.id, state)}
                    toggleConfetti={onToggleConfetti || (() => {})}
                    isDragging={isDragging}
                    hasDragged={hasDragged}
                  />
                </div>
              )}
            </DraggableWidget>
          );
        })}

      </div>
    </div>
  );
};