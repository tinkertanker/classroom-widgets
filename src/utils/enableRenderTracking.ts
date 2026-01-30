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

import { debug } from '../shared/utils/debug';

export function enableRenderTracking() {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  // Option 1: Use React DevTools Profiler
  debug('%c🔍 Render tracking enabled', 'color: #4CAF50; font-weight: bold');
  debug('Use React DevTools Profiler to monitor component renders');
  
  // Option 2: Monkey patch React to log all renders
  const React = require('react');
  const originalCreateElement = React.createElement;
  
  React.createElement = function(...args: any[]) {
    if (typeof args[0] === 'function' && args[0].name) {
      // Log functional component renders
      debug(`[Render] ${args[0].name}`);
    }
    return originalCreateElement.apply(React, args);
  };
}

/**
 * Hook to track why a component re-rendered
 * Logs all prop changes to console
 */
export function useRenderTracker(componentName: string, props: Record<string, any>) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react') as typeof import('react');
  const renderCount = React.useRef(0);
  const prevPropsRef = React.useRef<Record<string, any>>(undefined);
  
  renderCount.current += 1;
  
  React.useEffect(() => {
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