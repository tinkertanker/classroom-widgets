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

export function enableRenderTracking() {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  // Option 1: Use React DevTools Profiler
  console.log('%c🔍 Render tracking enabled', 'color: #4CAF50; font-weight: bold');
  console.log('Use React DevTools Profiler to monitor component renders');
  
  // Option 2: Monkey patch React to log all renders
  const React = require('react');
  const originalCreateElement = React.createElement;
  
  React.createElement = function(...args: any[]) {
    if (typeof args[0] === 'function' && args[0].name) {
      // Log functional component renders
      console.count(`[Render] ${args[0].name}`);
    }
    return originalCreateElement.apply(React, args);
  };
}

/**
 * Hook to track why a component re-rendered
 * Logs all prop changes to console
 */
export function useRenderTracker(componentName: string, props: Record<string, any>) {
  const React = require('react');
  const renderCount = React.useRef(0);
  const prevPropsRef = React.useRef<Record<string, any>>();
  
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
        console.log(
          `%c[${componentName}] Re-rendered (${renderCount.current})`,
          'color: #FF9800',
          changedProps
        );
      }
    }
    
    prevPropsRef.current = props;
  });
}