// Performance optimization hooks

import { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore.simple';
import { WidgetInstance } from '../types';

// Hook for memoizing expensive widget calculations
export function useMemoizedWidget<T>(
  widgetId: string,
  calculator: (widget: WidgetInstance | undefined) => T,
  deps: React.DependencyList = []
): T {
  const widget = useWorkspaceStore(
    useCallback((state) => state.widgets.find(w => w.id === widgetId), [widgetId])
  );
  
  return useMemo(
    () => calculator(widget),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [widget, ...deps]
  );
}

// Hook for debouncing widget state updates
export function useDebouncedStateUpdate<T>(
  widgetId: string,
  delay: number = 300
) {
  const updateWidgetState = useWorkspaceStore((state) => state.updateWidgetState);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const pendingUpdateRef = useRef<T | null>(null);
  
  const debouncedUpdate = useCallback((state: T) => {
    pendingUpdateRef.current = state;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      if (pendingUpdateRef.current !== null) {
        updateWidgetState(widgetId, pendingUpdateRef.current);
        pendingUpdateRef.current = null;
      }
    }, delay);
  }, [widgetId, delay, updateWidgetState]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        // Flush pending update
        if (pendingUpdateRef.current !== null) {
          updateWidgetState(widgetId, pendingUpdateRef.current);
        }
      }
    };
  }, [widgetId, updateWidgetState]);
  
  return debouncedUpdate;
}

// Hook for throttling position updates during drag
export function useThrottledPosition(widgetId: string, delay: number = 16) {
  const moveWidget = useWorkspaceStore((state) => state.moveWidget);
  const lastUpdateRef = useRef<number>(0);
  const pendingPositionRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number>();
  
  const throttledMove = useCallback((position: { x: number; y: number }) => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;
    
    if (timeSinceLastUpdate >= delay) {
      moveWidget(widgetId, position);
      lastUpdateRef.current = now;
    } else {
      // Schedule update
      pendingPositionRef.current = position;
      
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          if (pendingPositionRef.current) {
            moveWidget(widgetId, pendingPositionRef.current);
            lastUpdateRef.current = Date.now();
            pendingPositionRef.current = null;
          }
          rafRef.current = undefined;
        });
      }
    }
  }, [widgetId, delay, moveWidget]);
  
  // Cleanup
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);
  
  return throttledMove;
}

// Hook for batching multiple widget updates
export function useBatchedUpdates() {
  const pendingUpdatesRef = useRef<Map<string, any>>(new Map());
  const rafRef = useRef<number>();

  const batchUpdate = useCallback((widgetId: string, updates: any) => {
    pendingUpdatesRef.current.set(widgetId, {
      ...pendingUpdatesRef.current.get(widgetId),
      ...updates
    });

    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        const pendingUpdates = pendingUpdatesRef.current;
        pendingUpdatesRef.current = new Map();

        // Apply all updates in a single transaction
        useWorkspaceStore.setState((state) => {
          const newWidgets = state.widgets.map((widget: WidgetInstance) => {
            const update = pendingUpdates.get(widget.id);
            return update ? { ...widget, ...update } : widget;
          });
          return { widgets: newWidgets };
        });

        rafRef.current = undefined;
      });
    }
  }, []);
  
  return batchUpdate;
}

// Hook for viewport culling - only render visible widgets
export function useVisibleWidgets(margin: number = 100) {
  const widgets = useWorkspaceStore((state) => state.widgets);
  const scale = useWorkspaceStore((state) => state.scale);
  const scrollPosition = useWorkspaceStore((state) => state.scrollPosition);
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight
  }));
  
  // Update viewport on resize
  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Calculate visible widgets
  const visibleWidgets = useMemo(() => {
    const viewportBounds = {
      left: (scrollPosition.x - margin) / scale,
      top: (scrollPosition.y - margin) / scale,
      right: (scrollPosition.x + viewport.width + margin) / scale,
      bottom: (scrollPosition.y + viewport.height + margin) / scale
    };
    
    return widgets.filter(widget => {
      const widgetBounds = {
        left: widget.position.x,
        top: widget.position.y,
        right: widget.position.x + widget.size.width,
        bottom: widget.position.y + widget.size.height
      };
      
      // Check if widget intersects with viewport
      return !(
        widgetBounds.right < viewportBounds.left ||
        widgetBounds.left > viewportBounds.right ||
        widgetBounds.bottom < viewportBounds.top ||
        widgetBounds.top > viewportBounds.bottom
      );
    });
  }, [widgets, scale, scrollPosition, viewport, margin]);
  
  return visibleWidgets;
}

// Hook for lazy loading widget components
export function useLazyWidget(widgetType: number) {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    let cancelled = false;
    
    const loadComponent = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Dynamic import based on widget type
        const module = await import(`../components/${getWidgetFolder(widgetType)}`);
        
        if (!cancelled) {
          setComponent(() => module.default);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
          setIsLoading(false);
        }
      }
    };
    
    loadComponent();
    
    return () => {
      cancelled = true;
    };
  }, [widgetType]);
  
  return { Component, isLoading, error };
}

// Helper to get widget folder name
function getWidgetFolder(widgetType: number): string {
  const folders: Record<number, string> = {
    0: 'randomiser',
    1: 'timer',
    2: 'list',
    3: 'taskCue',
    4: 'trafficLight',
    5: 'volumeLevel',
    6: 'shortenLink',
    7: 'textBanner',
    8: 'imageDisplay',
    9: 'soundEffects',
    10: 'sticker',
    11: 'poll',
    12: 'qrcode',
    13: 'linkShare',
    14: 'visualiser',
    15: 'rtFeedback',
    16: 'ticTacToe',
    17: 'questions'
  };
  
  return folders[widgetType] || 'unknown';
}

