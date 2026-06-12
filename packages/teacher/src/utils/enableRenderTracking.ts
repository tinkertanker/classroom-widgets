/**
 * Enable render tracking in development
 * Add this to your index.tsx or App.tsx to monitor re-renders
 * 
 * Usage:
 * import { enableRenderTracking } from './utils/enableRenderTracking';
 * if (process.env.NODE_ENV === 'development') {
 *   enableRenderTracking();
 * }
 */

import React, { useEffect, useRef } from 'react';
import { debug } from '@shared/utils/debug';

export function enableRenderTracking() {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  // Option 1: Use React DevTools Profiler
  debug('%c🔍 Render tracking enabled', 'color: #4CAF50; font-weight: bold');
  debug('Use React DevTools Profiler to monitor component renders');
  
  // Option 2: Monkey patch React to log all renders
  const reactWithMutableCreateElement = React as typeof React & {
    createElement: typeof React.createElement;
  };
  const originalCreateElement = reactWithMutableCreateElement.createElement;
  
  reactWithMutableCreateElement.createElement = function(...args: any[]) {
    if (typeof args[0] === 'function' && args[0].name) {
      // Log functional component renders
      debug(`[Render] ${args[0].name}`);
    }
    return originalCreateElement.apply(React, args as Parameters<typeof React.createElement>);
  } as typeof React.createElement;
}

/**
 * Hook to track why a component re-rendered
 * Logs all prop changes to console
 */
export function useRenderTracker(componentName: string, props: Record<string, any>) {
  const renderCount = useRef(0);
  const prevPropsRef = useRef<Record<string, any>>(undefined);
  
  renderCount.current += 1;
  
  useEffect(() => {
    if (prevPropsRef.current) {
      const allKeys = Object.keys({ ...prevPropsRef.current, ...props });
      const changedProps: Record<string, any> = {};
      
      allKeys.forEach((key) => {
        if (prevPropsRef.current![key] !== props[key]) {
          changedProps[key] = {
            from: prevPropsRef.current![key],
            to: props[key],
          };
        }
      });
      
      if (Object.keys(changedProps).length > 0) {
        debug(
          `%c[${componentName}] Re-rendered (${renderCount.current})`,
          'color: #FF9800',
          changedProps
        );
      }
    }
    
    prevPropsRef.current = props;
  });
}
