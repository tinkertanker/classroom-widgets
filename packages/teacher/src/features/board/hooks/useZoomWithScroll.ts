import { useEffect, useRef } from 'react';
import { useWorkspace } from '@shared/hooks/useWorkspace';

interface ZoomOptions {
  minScale?: number;
  maxScale?: number;
  scaleSensitivity?: number;
}

interface WebKitGestureEvent extends Event {
  readonly scale: number;
  readonly clientX: number;
  readonly clientY: number;
}

const isWebKitGestureEvent = (event: Event): event is WebKitGestureEvent => {
  const candidate = event as Partial<WebKitGestureEvent>;
  return (
    typeof candidate.scale === 'number'
    && typeof candidate.clientX === 'number'
    && typeof candidate.clientY === 'number'
  );
};

export const useZoomWithScroll = (
  containerRef: React.RefObject<HTMLDivElement>,
  scaleRef: React.RefObject<HTMLDivElement>,
  setDebugMarker: (marker: { x: number; y: number; visible: boolean; viewportX?: number; viewportY?: number }) => void,
  setViewportRect: (rect: { x: number; y: number; visible: boolean }) => void,
  options: ZoomOptions = {}
) => {
  const { scale, setScale } = useWorkspace();
  const currentScaleRef = useRef(scale);
  const initialDistance = useRef<number | null>(null);
  const initialScale = useRef(1);
  const isScaling = useRef(false);
  const zoomCenter = useRef({ x: 0, y: 0 });
  const zoomOriginBoard = useRef<{ x: number; y: number } | null>(null);
  const resetTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRaf = useRef<number | null>(null);

  const { minScale = 0.5, maxScale = 2, scaleSensitivity = 0.01 } = options;

  useEffect(() => {
    currentScaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    const container = containerRef.current;
    const scaleElement = scaleRef.current;
    if (!container || !scaleElement) return;

    const getDistance = (touches: TouchList): number => {
      const firstTouch = touches[0];
      const secondTouch = touches[1];
      const dx = secondTouch.clientX - firstTouch.clientX;
      const dy = secondTouch.clientY - firstTouch.clientY;
      return Math.hypot(dx, dy);
    };

    const getTouchCenter = (touches: TouchList): { x: number; y: number } => ({
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    });

    const scheduleScroll = (scrollX: number, scrollY: number) => {
      if (scrollRaf.current !== null) {
        cancelAnimationFrame(scrollRaf.current);
      }

      scrollRaf.current = requestAnimationFrame(() => {
        container.scrollLeft = scrollX;
        container.scrollTop = scrollY;
        scrollRaf.current = null;
      });
    };

    const applyZoom = (newScale: number) => {
      const origin = zoomOriginBoard.current;
      if (!origin) return;

      setScale(newScale);
      scheduleScroll(
        origin.x * newScale - zoomCenter.current.x,
        origin.y * newScale - zoomCenter.current.y
      );
    };

    const startZoomGesture = (clientX: number, clientY: number) => {
      initialScale.current = currentScaleRef.current;
      isScaling.current = true;

      const containerRect = container.getBoundingClientRect();
      zoomCenter.current = {
        x: clientX - containerRect.left,
        y: clientY - containerRect.top
      };
      zoomOriginBoard.current = {
        x: (container.scrollLeft + zoomCenter.current.x) / currentScaleRef.current,
        y: (container.scrollTop + zoomCenter.current.y) / currentScaleRef.current
      };

      setDebugMarker({
        x: zoomOriginBoard.current.x,
        y: zoomOriginBoard.current.y,
        visible: true,
        viewportX: zoomCenter.current.x,
        viewportY: zoomCenter.current.y
      });
      setViewportRect({ x: zoomCenter.current.x, y: zoomCenter.current.y, visible: true });
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2 || isScaling.current) return;

      initialDistance.current = getDistance(event.touches);
      const center = getTouchCenter(event.touches);
      startZoomGesture(center.x, center.y);
      event.preventDefault();
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || initialDistance.current === null) return;

      const distance = getDistance(event.touches);
      const scaleDelta = (distance - initialDistance.current) * scaleSensitivity;
      const nextScale = Math.max(minScale, Math.min(maxScale, initialScale.current + scaleDelta));
      applyZoom(nextScale);
      event.preventDefault();
    };

    const resetZoomGesture = () => {
      initialDistance.current = null;
      isScaling.current = false;
      zoomOriginBoard.current = null;

      if (resetTimeout.current) {
        clearTimeout(resetTimeout.current);
      }
      resetTimeout.current = setTimeout(() => {
        setDebugMarker({ x: 0, y: 0, visible: false });
        setViewportRect({ x: 0, y: 0, visible: false });
        resetTimeout.current = null;
      }, 500);
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) {
        resetZoomGesture();
      }
    };

    // Safari exposes trackpad pinch as dedicated gesture events. Keeping this
    // separate from wheel means ordinary trackpad scrolling stays native.
    const handleGestureStart = (event: Event) => {
      if (!isWebKitGestureEvent(event) || isScaling.current) return;

      startZoomGesture(event.clientX, event.clientY);
      event.preventDefault();
    };

    const handleGestureChange = (event: Event) => {
      if (!isWebKitGestureEvent(event) || !isScaling.current) return;

      const nextScale = Math.max(
        minScale,
        Math.min(maxScale, initialScale.current * event.scale)
      );
      applyZoom(nextScale);
      event.preventDefault();
    };

    const handleGestureEnd = (event: Event) => {
      if (!isScaling.current) return;

      resetZoomGesture();
      event.preventDefault();
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);
    container.addEventListener('gesturestart', handleGestureStart, { passive: false });
    container.addEventListener('gesturechange', handleGestureChange, { passive: false });
    container.addEventListener('gestureend', handleGestureEnd, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
      container.removeEventListener('gesturestart', handleGestureStart);
      container.removeEventListener('gesturechange', handleGestureChange);
      container.removeEventListener('gestureend', handleGestureEnd);

      if (resetTimeout.current) {
        clearTimeout(resetTimeout.current);
      }
      if (scrollRaf.current !== null) {
        cancelAnimationFrame(scrollRaf.current);
      }
    };
  }, [containerRef, scaleRef, maxScale, minScale, scaleSensitivity, setDebugMarker, setScale, setViewportRect]);
};
