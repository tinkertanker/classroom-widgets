import { useEffect, useRef } from 'react';
import { useWorkspace } from '../store/WorkspaceContext';

interface PinchZoomOptions {
  minScale?: number;
  maxScale?: number;
  scaleSensitivity?: number;
}

export const usePinchZoom = (
  containerRef: React.RefObject<HTMLDivElement>,
  scaleRef: React.RefObject<HTMLDivElement>,
  setTransformOrigin: (origin: string) => void,
  setDebugMarker: (marker: { x: number; y: number; visible: boolean }) => void,
  options: PinchZoomOptions = {}
) => {
  const { minScale = 0.5, maxScale = 2, scaleSensitivity = 0.01 } = options;
  const { state, setScale } = useWorkspace();
  const initialDistance = useRef<number | null>(null);
  const initialScale = useRef<number>(1);
  const isScaling = useRef<boolean>(false);
  const wheelTimeout = useRef<NodeJS.Timeout | null>(null);

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
        
        // Calculate the pinch center relative to the viewport
        const center = getTouchCenter(touches);
        const containerRect = container.getBoundingClientRect();
        
        // Convert to board coordinates
        // The key insight: We need to find where this point would be on the unscaled board
        
        // Step 1: Get the current scroll position (in scaled pixels)
        const scrollX = container.scrollLeft;
        const scrollY = container.scrollTop;
        
        // Step 2: Get the viewport position
        const viewportX = center.x - containerRect.left;
        const viewportY = center.y - containerRect.top;
        
        // Step 3: Calculate the position on the unscaled board
        // The board's top-left in the viewport is at (-scrollX, -scrollY) when scaled
        // So the point on the unscaled board is:
        const boardX = (scrollX + viewportX) / state.scale;
        const boardY = (scrollY + viewportY) / state.scale;
        
        // Get the actual board element (not the wrapper)
        const boardElement = scaleElement.querySelector('.board') as HTMLElement;
        const boardRect = boardElement?.getBoundingClientRect();
        
        console.log('Pinch zoom debug:', {
          scale: state.scale,
          scroll: { x: scrollX, y: scrollY },
          mousePosition: { x: center.x, y: center.y },
          viewportPosition: { x: viewportX, y: viewportY },
          calculatedBoardPos: { x: boardX, y: boardY },
          formula: `boardX = (${scrollX} + ${viewportX}) / ${state.scale} = ${boardX}`
        });
        
        // Set transform origin to the pinch center - this stays fixed for the gesture
        setTransformOrigin(`${boardX}px ${boardY}px`);
        
        // Show debug marker at the calculated position
        setDebugMarker({ x: boardX, y: boardY, visible: true });
        
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
        
        setScale(newScale);
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        initialDistance.current = null;
        touches = null;
        isScaling.current = false;
        
        // Hide debug marker
        setDebugMarker({ x: 0, y: 0, visible: false });
      }
    };

    // Handle wheel events for trackpad pinch gestures
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        
        // Set transform origin only at the start of wheel gesture
        if (!isScaling.current) {
          isScaling.current = true;
          
          // Calculate the mouse position relative to the viewport
          const containerRect = container.getBoundingClientRect();
          
          // Convert to board coordinates
          // The key insight: We need to find where this point would be on the unscaled board
          
          // Step 1: Get the current scroll position (in scaled pixels)
          const scrollX = container.scrollLeft;
          const scrollY = container.scrollTop;
          
          // Step 2: Get the viewport position
          const viewportX = e.clientX - containerRect.left;
          const viewportY = e.clientY - containerRect.top;
          
          // Step 3: Calculate the position on the unscaled board
          // The board's top-left in the viewport is at (-scrollX, -scrollY) when scaled
          // So the point on the unscaled board is:
          const boardX = (scrollX + viewportX) / state.scale;
          const boardY = (scrollY + viewportY) / state.scale;
          
          console.log('Wheel zoom debug:', {
            scale: state.scale,
            scroll: { x: scrollX, y: scrollY },
            mousePosition: { x: e.clientX, y: e.clientY },
            viewportPosition: { x: viewportX, y: viewportY },
            calculatedBoardPos: { x: boardX, y: boardY },
            formula: `boardX = (${scrollX} + ${viewportX}) / ${state.scale} = ${boardX}`
          });
          
          // Set transform origin to the mouse position - this stays fixed for the gesture
          setTransformOrigin(`${boardX}px ${boardY}px`);
          
          // Show debug marker at the calculated position
          setDebugMarker({ x: boardX, y: boardY, visible: true });
        }
        
        // Clear existing timeout
        if (wheelTimeout.current) {
          clearTimeout(wheelTimeout.current);
        }
        
        // Set timeout to reset scaling flag after wheel events stop
        wheelTimeout.current = setTimeout(() => {
          isScaling.current = false;
          // Hide debug marker
          setDebugMarker({ x: 0, y: 0, visible: false });
        }, 150);
        
        const delta = e.deltaY;
        const scaleDelta = -delta * 0.01;
        const newScale = Math.max(
          minScale,
          Math.min(maxScale, state.scale + scaleDelta)
        );
        setScale(newScale);
      }
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
    };
  }, [containerRef, scaleRef, state.scale, setScale, setTransformOrigin, setDebugMarker, minScale, maxScale, scaleSensitivity]);
};