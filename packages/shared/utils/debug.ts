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
 * import { debug } from '@shared/utils/debug';
 * debug('[Session] Connecting to server', { url, sessionCode });
 */

// Check if debug mode is enabled
const isDebugEnabled = import.meta.env.DEV && import.meta.env.VITE_DEBUG === 'true';

type LogFn = (...args: unknown[]) => void;

// Create a no-op function for production
const noop: LogFn = () => {};

// Debug logger interface
interface DebugLogger extends LogFn {
  error: LogFn;
  warn: LogFn;
  info: LogFn;
  group: LogFn;
  groupEnd: () => void;
}

const whenEnabled = (fn: LogFn): LogFn => (isDebugEnabled ? fn : noop);

// Create debug logger with methods
const createDebugLogger = (): DebugLogger => Object.assign(
  whenEnabled((...args) => console.log(...args)),
  {
    error: whenEnabled((...args) => console.error(...args)),
    warn: whenEnabled((...args) => console.warn(...args)),
    info: whenEnabled((...args) => console.info(...args)),
    group: whenEnabled((...args) => console.group(...args)),
    groupEnd: whenEnabled(() => console.groupEnd()),
  },
);

// Debug logger function
export const debug = createDebugLogger();
