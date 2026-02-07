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
const noop = (..._args: any[]) => {};

// Debug logger interface
interface DebugLogger {
  (...args: any[]): void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  info: (...args: any[]) => void;
  group: (...args: any[]) => void;
  groupEnd: () => void;
}

// Create debug logger with methods
const createDebugLogger = (): DebugLogger => {
  const logger = (isDebugEnabled
    ? (...args: any[]) => console.log(...args)
    : noop) as DebugLogger;

  logger.error = isDebugEnabled
    ? (...args: any[]) => console.error(...args)
    : noop;

  logger.warn = isDebugEnabled
    ? (...args: any[]) => console.warn(...args)
    : noop;

  logger.info = isDebugEnabled
    ? (...args: any[]) => console.info(...args)
    : noop;

  logger.group = isDebugEnabled
    ? (...args: any[]) => console.group(...args)
    : noop;

  logger.groupEnd = isDebugEnabled
    ? () => console.groupEnd()
    : noop;

  return logger;
};

// Debug logger function
export const debug = createDebugLogger();

// Export a flag to check debug status
export const isDebug = isDebugEnabled;