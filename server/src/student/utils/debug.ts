/**
 * Debug logging utility for student app
 * Same as teacher app - controlled by VITE_DEBUG environment variable
 */

// Check if debug mode is enabled
const isDebugEnabled = import.meta.env.DEV && import.meta.env.VITE_DEBUG === 'true';

// Create a no-op function for production
const noop = () => {};

// Debug logger function
export const debug = isDebugEnabled 
  ? (...args: any[]) => console.log(...args)
  : noop;

// Add other console methods
debug.error = isDebugEnabled 
  ? (...args: any[]) => console.error(...args)
  : noop;

debug.warn = isDebugEnabled 
  ? (...args: any[]) => console.warn(...args)
  : noop;

debug.info = isDebugEnabled 
  ? (...args: any[]) => console.info(...args)
  : noop;

debug.group = isDebugEnabled 
  ? (...args: any[]) => console.group(...args)
  : noop;

debug.groupEnd = isDebugEnabled 
  ? () => console.groupEnd()
  : noop;

// Export a flag to check debug status
export const isDebug = isDebugEnabled;