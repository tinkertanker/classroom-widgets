/**
 * Debug logging utility that can be enabled/disabled via environment variables
 * 
 * Usage:
 * - Set VITE_DEBUG=true in .env.development to enable debug logs in development
 * - Debug logs are automatically stripped from production builds
 * - Use debug() instead of console.log() for debug messages
 * - Use debug.error() instead of console.error() for debug errors
 * 
 * Example:
 * import { debug } from '@/shared/utils/debug';
 * debug('[Session] Connecting to server', { url, sessionCode });
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