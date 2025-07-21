import { useEffect, useRef } from 'react';
import { useWorkspace } from '../store/WorkspaceContext';

interface ZoomOptions {
  minScale?: number;
  maxScale?: number;
  scaleSensitivity?: number;
}

export const useZoomWithScroll = (
  containerRef: React.RefObject<HTMLDivElement>,
  scaleRef: React.RefObject<HTMLDivElement>,
  setDebugMarker: (marker: { x: number; y: number; visible: boolean; viewportX?: number; viewportY?: number }) => void,
  setViewportRect: (rect: { x: number; y: number; visible: boolean }) => void,
  options: ZoomOptions = {}
) => {
  const { minScale = 0.5, maxScale = 2, scaleSensitivity = 0.01 } = options;
  const { state, setScale } = useWorkspace();
  const initialDistance = useRef<number | null>(null);
  const initialScale = useRef<number>(1);
  const isScaling = useRef<boolean>(false);
  const wheelTimeout = useRef<NodeJS.Timeout | null>(null);
  const zoomCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const zoomOriginBoard = useRef<{ x: number; y: number } | null>(null);
  const isApplyingZoom = useRef<boolean>(false);
  const pendingZoom = useRef<{ scale: number; scrollX: number; scrollY: number } | null>(null);
  const zoomRaf = useRef<number | null>(null);
  const lastWheelTime = useRef<number>(0);
  const wheelEventBuffer = useRef<WheelEvent[]>([]);

  const applyZoom = (newScale: number, centerX: number, centerY: number, isFirstZoom: boolean = false) => {
    const container = containerRef.current;
    if (!container) return;

    const currentScale = state.scale;
    
    // On first zoom of gesture, calculate and store the board origin point
    if (isFirstZoom) {
      const scrollX = container.scrollLeft;
      const scrollY = container.scrollTop;
      
      // Calculate board coordinates at the zoom center
      const boardX = (scrollX + centerX) / currentScale;
      const boardY = (scrollY + centerY) / currentScale;
      
      zoomOriginBoard.current = { x: boardX, y: boardY };
      zoomCenter.current = { x: centerX, y: centerY };
      setDebugMarker({ x: boardX, y: boardY, visible: true, viewportX: centerX, viewportY: centerY });
      
      
      // Also show viewport rect for touch events
      setViewportRect({ x: centerX, y: centerY, visible: true });
    }
    
    // Use the stored board origin point
    if (!zoomOriginBoard.current) return;
    
    // Calculate new scroll position to keep board point at same viewport position
    // Formula: boardPoint * newScale - viewportPoint = newScroll
    // This ensures that the board coordinate stays at the same viewport position
    const targetScrollX = zoomOriginBoard.current.x * newScale - zoomCenter.current.x;
    const targetScrollY = zoomOriginBoard.current.y * newScale - zoomCenter.current.y;
    
    // Apply the new scale
    setScale(newScale);
    
    // Apply scroll after React renders the new scale
    // This is only used for touch pinch gestures now
    setTimeout(() => {
      container.scrollLeft = targetScrollX;
      container.scrollTop = targetScrollY;
    }, 0);
  };

  useEffect(() => {
    const container = containerRef.current;
    const scaleElement = scaleRef.current;
    if (!container || !scaleElement) return;

    let touches: TouchList | null = null;

    const getDistance = (touches: TouchList): number => {
      const touch1 = touches[0];
      const touch2 = touches[1];
      const dx = touch2.clientX - touch1.clientX;
      const dy = touch2.clientY - touch1.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const getTouchCenter = (touches: TouchList): { x: number; y: number } => {
      const touch1 = touches[0];
      const touch2 = touches[1];
      return {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2
      };
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2 && !isScaling.current) {
        touches = e.touches;
        initialDistance.current = getDistance(touches);
        initialScale.current = state.scale;
        isScaling.current = true;
        
        // Calculate and store the pinch center
        const center = getTouchCenter(touches);
        const containerRect = container.getBoundingClientRect();
        zoomCenter.current = {
          x: center.x - containerRect.left,
          y: center.y - containerRect.top
        };
        
        // First zoom of the gesture
        applyZoom(state.scale, zoomCenter.current.x, zoomCenter.current.y, true);
        
        e.preventDefault();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistance.current !== null) {
        touches = e.touches;
        const currentDistance = getDistance(touches);
        const scaleDelta = (currentDistance - initialDistance.current) * scaleSensitivity;
        const newScale = Math.max(
          minScale,
          Math.min(maxScale, initialScale.current + scaleDelta)
        );
        
        // Continue zoom with same center
        applyZoom(newScale, zoomCenter.current.x, zoomCenter.current.y, false);
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        initialDistance.current = null;
        touches = null;
        isScaling.current = false;
        zoomOriginBoard.current = null;
        
        // Hide debug marker and viewport rect
        setTimeout(() => {
          setDebugMarker({ x: 0, y: 0, visible: false });
          setViewportRect({ x: 0, y: 0, visible: false });
        }, 500);
      }
    };

    // Handle wheel events for trackpad pinch gestures
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        
        // Buffer wheel events to batch them
        const now = performance.now();
        const timeSinceLastWheel = now - lastWheelTime.current;
        lastWheelTime.current = now;
        
        // If this is a new zoom gesture or significant time has passed, process immediately
        if (!isScaling.current || timeSinceLastWheel > 100) {
          processWheelEvent(e);
        } else {
          // Buffer the event for batch processing
          wheelEventBuffer.current.push(e);
          
          // Cancel any pending batch processing
          if (zoomRaf.current) {
            cancelAnimationFrame(zoomRaf.current);
          }
          
          // Schedule batch processing
          zoomRaf.current = requestAnimationFrame(() => {
            if (wheelEventBuffer.current.length > 0) {
              // Process the accumulated delta
              const totalDeltaY = wheelEventBuffer.current.reduce((sum, event) => sum + event.deltaY, 0);
              const lastEvent = wheelEventBuffer.current[wheelEventBuffer.current.length - 1];
              
              // Clear buffer
              wheelEventBuffer.current = [];
              
              // Create synthetic event with accumulated delta
              const syntheticEvent = new WheelEvent('wheel', {
                deltaY: totalDeltaY,
                clientX: lastEvent.clientX,
                clientY: lastEvent.clientY,
                ctrlKey: lastEvent.ctrlKey,
                metaKey: lastEvent.metaKey
              });
              
              processWheelEvent(syntheticEvent);
            }
          });
        }
      }
    };
    
    const processWheelEvent = (e: WheelEvent) => {
        // Get mouse position relative to container (viewport coordinates)
        const containerRect = container.getBoundingClientRect();
        const viewportX = e.clientX - containerRect.left;
        const viewportY = e.clientY - containerRect.top;
        
        // Start of zoom gesture - store the initial state
        if (!isScaling.current) {
          isScaling.current = true;
          
          // Calculate board coordinates at mouse position
          const scrollX = container.scrollLeft;
          const scrollY = container.scrollTop;
          const boardX = (scrollX + viewportX) / state.scale;
          const boardY = (scrollY + viewportY) / state.scale;
          
          // Store zoom origin in both coordinate systems
          zoomOriginBoard.current = { x: boardX, y: boardY };
          zoomCenter.current = { x: viewportX, y: viewportY };
          
          
          setDebugMarker({ x: boardX, y: boardY, visible: true, viewportX: viewportX, viewportY: viewportY });
          setViewportRect({ x: viewportX, y: viewportY, visible: true });
        }
        
        // Calculate new scale with smoother delta calculation
        const delta = e.deltaY;
        const scaleFactor = 1 + (-delta * 0.001); // Smoother scaling factor
        const targetScale = state.scale * scaleFactor;
        const newScale = Math.max(
          minScale,
          Math.min(maxScale, targetScale)
        );
        
        // Calculate where the debug marker will be in visual coordinates at new scale
        // Visual coords = board coords × scale
        const markerVisualX = zoomOriginBoard.current.x * newScale;
        const markerVisualY = zoomOriginBoard.current.y * newScale;
        
        // Calculate scroll offsets needed to put marker at desired viewport position
        // Scroll = visual position - viewport position
        const newScrollX = markerVisualX - zoomCenter.current.x;
        const newScrollY = markerVisualY - zoomCenter.current.y;
        
        
        // Store pending zoom state
        pendingZoom.current = { scale: newScale, scrollX: newScrollX, scrollY: newScrollY };
        
        // Apply scale and scroll together
        const applyZoomAndScroll = () => {
          if (!pendingZoom.current) return;
          
          const { scale, scrollX, scrollY } = pendingZoom.current;
          pendingZoom.current = null;
          
          // Apply scale
          setScale(scale);
          
          // Force synchronous layout/paint
          container.offsetHeight; // Force reflow
          
          // Apply scroll immediately after reflow
          container.scrollLeft = scrollX;
          container.scrollTop = scrollY;
        };
        
        // Apply immediately
        applyZoomAndScroll();
        
        // Clear existing timeout
        if (wheelTimeout.current) {
          clearTimeout(wheelTimeout.current);
        }
        
        // Set timeout to hide marker and reset
        wheelTimeout.current = setTimeout(() => {
          setDebugMarker({ x: 0, y: 0, visible: false });
          setViewportRect({ x: 0, y: 0, visible: false });
          isScaling.current = false;
          zoomOriginBoard.current = null;
          zoomCenter.current = { x: 0, y: 0 };
          wheelEventBuffer.current = [];
          lastWheelTime.current = 0;
        }, 500);
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
      container.removeEventListener('wheel', handleWheel);
      
      // Clear timeout on cleanup
      if (wheelTimeout.current) {
        clearTimeout(wheelTimeout.current);
      }
      if (zoomRaf.current) {
        cancelAnimationFrame(zoomRaf.current);
      }
    };
  }, [containerRef, scaleRef, state.scale, setScale, setDebugMarker, setViewportRect, minScale, maxScale, scaleSensitivity]);
};