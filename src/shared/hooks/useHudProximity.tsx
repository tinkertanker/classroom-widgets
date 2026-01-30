import { useState, useEffect, useCallback, useRef, createContext, useContext, ReactNode } from 'react';

interface ProximityState {
  topLeft: boolean;
  topRight: boolean;
  bottom: boolean;
}

// Distance threshold in pixels - mouse closer than this gets full opacity
const PROXIMITY_THRESHOLD = 150;

// Calculate distance from a point to a rectangle
function distanceToRect(
  mouseX: number,
  mouseY: number,
  rect: DOMRect
): number {
  // Find closest point on rectangle to mouse
  const closestX = Math.max(rect.left, Math.min(mouseX, rect.right));
  const closestY = Math.max(rect.top, Math.min(mouseY, rect.bottom));

  // Calculate distance from mouse to closest point
  const dx = mouseX - closestX;
  const dy = mouseY - closestY;

  return Math.sqrt(dx * dx + dy * dy);
}

export function useHudProximity() {
  const [isNear, setIsNear] = useState<ProximityState>({
    topLeft: true,
    topRight: true,
    bottom: true,
  });

  // Refs to store the HUD element references
  const topLeftRef = useRef<HTMLElement | null>(null);
  const topRightRef = useRef<HTMLElement | null>(null);
  const bottomRef = useRef<HTMLElement | null>(null);

  // Throttle mouse move updates for performance
  const lastUpdateRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  const updateProximity = useCallback((mouseX: number, mouseY: number) => {
    const newState: ProximityState = {
      topLeft: true,
      topRight: true,
      bottom: true,
    };

    // Check top-left region
    if (topLeftRef.current) {
      const rect = topLeftRef.current.getBoundingClientRect();
      const distance = distanceToRect(mouseX, mouseY, rect);
      newState.topLeft = distance < PROXIMITY_THRESHOLD;
    }

    // Check top-right region
    if (topRightRef.current) {
      const rect = topRightRef.current.getBoundingClientRect();
      const distance = distanceToRect(mouseX, mouseY, rect);
      newState.topRight = distance < PROXIMITY_THRESHOLD;
    }

    // Check bottom region
    if (bottomRef.current) {
      const rect = bottomRef.current.getBoundingClientRect();
      const distance = distanceToRect(mouseX, mouseY, rect);
      newState.bottom = distance < PROXIMITY_THRESHOLD;
    }

    setIsNear(prev => {
      // Only update if something changed
      if (
        prev.topLeft !== newState.topLeft ||
        prev.topRight !== newState.topRight ||
        prev.bottom !== newState.bottom
      ) {
        return newState;
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Throttle updates to ~60fps
      const now = performance.now();
      if (now - lastUpdateRef.current < 16) {
        return;
      }
      lastUpdateRef.current = now;

      // Cancel any pending animation frame
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      // Schedule update on next animation frame
      rafRef.current = requestAnimationFrame(() => {
        updateProximity(e.clientX, e.clientY);
      });
    };

    // Also handle when mouse leaves the window - show all HUDs
    const handleMouseLeave = () => {
      setIsNear({
        topLeft: true,
        topRight: true,
        bottom: true,
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [updateProximity]);

  // Function to register HUD elements
  const registerHudElement = useCallback((
    region: 'topLeft' | 'topRight' | 'bottom',
    element: HTMLElement | null
  ) => {
    switch (region) {
      case 'topLeft':
        topLeftRef.current = element;
        break;
      case 'topRight':
        topRightRef.current = element;
        break;
      case 'bottom':
        bottomRef.current = element;
        break;
    }
  }, []);

  return {
    isNear,
    registerHudElement,
  };
}

// Context to share the proximity state across components
interface HudProximityContextType {
  isNear: ProximityState;
  registerHudElement: (region: 'topLeft' | 'topRight' | 'bottom', element: HTMLElement | null) => void;
}

const HudProximityContext = createContext<HudProximityContextType | null>(null);

export function HudProximityProvider({ children }: { children: ReactNode }) {
  const { isNear, registerHudElement } = useHudProximity();

  return (
    <HudProximityContext.Provider value={{ isNear, registerHudElement }}>
      {children}
    </HudProximityContext.Provider>
  );
}

export function useHudProximityContext() {
  const context = useContext(HudProximityContext);
  if (!context) {
    throw new Error('useHudProximityContext must be used within a HudProximityProvider');
  }
  return context;
}
