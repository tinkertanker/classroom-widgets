/**
 * Debug logging utility for student app
 * Same as teacher app - controlled by VITE_DEBUG environment variable
 */

// Check if debug mode is enabled
const isDebugEnabled = (import.meta as any).env?.DEV && (import.meta as any).env?.VITE_DEBUG === 'true';

// Create a no-op function for production
const noop = (...args: any[]) => {};

// Debug logger function with additional methods
interface DebugFunction {
  (...args: any[]): void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  info: (...args: any[]) => void;
  group: (...args: any[]) => void;
  groupEnd: () => void;
}

// Create the debug function with proper typing
export const debug: DebugFunction = Object.assign(
  isDebugEnabled 
    ? (...args: any[]) => console.log(...args)
    : noop,
  {
    error: isDebugEnabled 
      ? (...args: any[]) => console.error(...args)
      : noop,
    warn: isDebugEnabled 
      ? (...args: any[]) => console.warn(...args)
      : noop,
    info: isDebugEnabled 
      ? (...args: any[]) => console.info(...args)
      : noop,
    group: isDebugEnabled 
      ? (...args: any[]) => console.group(...args)
      : noop,
    groupEnd: isDebugEnabled 
      ? () => console.groupEnd()
      : noop
  }
);

// Export a flag to check debug status
export const isDebug = isDebugEnabled;